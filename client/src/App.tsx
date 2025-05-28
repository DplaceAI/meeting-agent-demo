import { useState, useEffect, useRef, useCallback } from "react";
import { RealtimeClient } from "@openai/realtime-api-beta";
// @ts-expect-error - External library without type definitions
import { WavRecorder, WavStreamPlayer } from "./lib/wavtools/index.js";
import { instructions, listeningModeInstructions } from "./conversation_config.js";
import "./App.css";

// Global refs to maintain state across renders
const clientRef = { current: null as RealtimeClient | null };
const wavRecorderRef = { current: null as WavRecorder | null };
const wavStreamPlayerRef = { current: null as WavStreamPlayer | null };

export function App() {
  const params = new URLSearchParams(window.location.search);
  const RELAY_SERVER_URL = params.get("wss");
  const [connectionStatus, setConnectionStatus] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  const [meetingUrl, setMeetingUrl] = useState('');
  const [isCreatingBot, setIsCreatingBot] = useState(false);
  const [botCreated, setBotCreated] = useState(false);
  const [error, setError] = useState('');
  const [botName, setBotName] = useState('Breakout Room Assistant');
  const [backgroundColor, setBackgroundColor] = useState('#e3f2fd');
  const [isListeningMode, setIsListeningMode] = useState(false);

  // Initialize clients
  if (!clientRef.current) {
    clientRef.current = new RealtimeClient({
      url: RELAY_SERVER_URL || undefined,
    });
  }
  if (!wavRecorderRef.current) {
    wavRecorderRef.current = new WavRecorder({ sampleRate: 24000 });
  }
  if (!wavStreamPlayerRef.current) {
    wavStreamPlayerRef.current = new WavStreamPlayer({ sampleRate: 24000 });
  }
  
  const isConnectedRef = useRef(false);
  
  const toggleListeningMode = useCallback(() => {
    const client = clientRef.current;
    if (!client || connectionStatus !== "connected") return;
    
    const newMode = !isListeningMode;
    setIsListeningMode(newMode);
    
    // Update the session with new instructions
    client.updateSession({
      instructions: newMode ? listeningModeInstructions : instructions,
      voice: 'shimmer',
      turn_detection: { type: "server_vad" },
    });
  }, [isListeningMode, connectionStatus]);
  
  const connectConversation = useCallback(async () => {
    if (isConnectedRef.current) return;
    isConnectedRef.current = true;
    setConnectionStatus("connecting");
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    if (!client || !wavRecorder || !wavStreamPlayer) return;

    try {
      // Connect to microphone
      await wavRecorder.begin();

      // Connect to audio output
      await wavStreamPlayer.connect();

      // Connect to realtime API
      await client.connect();

      setConnectionStatus("connected");

      client.on("error", (event: any) => {
        console.error(event);
        setConnectionStatus("disconnected");
      });

      client.on("disconnected", () => {
        setConnectionStatus("disconnected");
      });

      client.sendUserMessageContent([
        {
          type: `input_text`,
          text: `Hello! I'm your Breakout Room Assistant. I'm ready to help you manage breakout rooms and facilitate your meeting. How can I help you today?`,
        },
      ]);

      // Configure session with instructions, voice, and VAD mode
      client.updateSession({ 
        instructions: isListeningMode ? listeningModeInstructions : instructions,
        voice: 'shimmer', // Female voice
        turn_detection: { type: "server_vad" },
      });

      // Check if we're already recording before trying to pause
      if (wavRecorder.recording) {
        await wavRecorder.pause();
      }

      // Check if we're already paused before trying to record
      if (!wavRecorder.recording) {
        await wavRecorder.record((data: { mono: Float32Array }) =>
          client.appendInputAudio(data.mono)
        );
      }
    } catch (error) {
      console.error("Connection error:", error);
      setConnectionStatus("disconnected");
    }
  }, [isListeningMode]);

  const errorMessage = !RELAY_SERVER_URL
    ? 'Missing required "wss" parameter in URL'
    : (() => {
        try {
          new URL(RELAY_SERVER_URL);
          return null;
        } catch {
          return 'Invalid URL format for "wss" parameter';
        }
      })();

  /**
   * Core RealtimeClient and audio capture setup
   * Set all of our instructions, tools, events and more
   */
  useEffect(() => {
    // Only run the effect if there's no error
    if (!errorMessage) {
      connectConversation();
      const wavStreamPlayer = wavStreamPlayerRef.current;
      const client = clientRef.current;
      if (!client || !wavStreamPlayer) return;

      // handle realtime events from client + server for event logging
      client.on("error", (event: any) => console.error(event));
      client.on("conversation.interrupted", async () => {
        const trackSampleOffset = await wavStreamPlayer.interrupt();
        if (trackSampleOffset?.trackId) {
          const { trackId, offset } = trackSampleOffset;
          await client.cancelResponse(trackId, offset);
        }
      });
      client.on("conversation.updated", async ({ item, delta }: any) => {
        client.conversation.getItems();
        if (delta?.audio) {
          wavStreamPlayer.add16BitPCM(delta.audio, item.id);
        }
        if (item.status === "completed" && item.formatted.audio?.length) {
          const wavFile = await WavRecorder.decode(
            item.formatted.audio,
            24000,
            24000
          );
          item.formatted.file = wavFile;
        }
      });

      return () => {
        client.reset();
      };
    }
  }, [errorMessage, connectConversation]);

  const createBot = async () => {
    if (!meetingUrl) {
      setError('Please enter a Google Meet URL');
      return;
    }

    setIsCreatingBot(true);
    setError('');

    try {
      // Use environment variable or fallback to ngrok for local development
      const backendHost = import.meta.env.VITE_BACKEND_URL || 'https://b336-66-108-88-150.ngrok-free.app';
      const wsUrl = backendHost.replace('https://', 'wss://');
      const backendUrl = backendHost;
      
      const response = await fetch(`${backendUrl}/create-bot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meeting_url: meetingUrl,
          bot_name: botName,
          websocket_url: wsUrl,
          background_color: backgroundColor
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to create bot: ${errorData}`);
      }

      const data = await response.json();
      console.log('Bot created:', data);
      setBotCreated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create bot');
    } finally {
      setIsCreatingBot(false);
    }
  };

  // If we have wss parameter, show the bot interface (what the bot shows in the meeting)
  if (RELAY_SERVER_URL) {
    // Parse background color from URL
    const bgColor = params.get('bg') || '#e3f2fd';
    
    return (
      <div className="app-container" style={{ backgroundColor: bgColor }}>
        <div className="bot-identity">
          <div className="bot-avatar">👥</div>
          <h2 className="bot-name">Breakout Room Assistant</h2>
        </div>
        <div className="status-indicator">
          <div
            className={`status-dot ${
              errorMessage ? "disconnected" : connectionStatus
            }`}
          />
          <div className="status-text">
            <div className="status-label">
              {errorMessage
                ? "Error:"
                : connectionStatus === "connecting"
                ? "Connecting to:"
                : connectionStatus === "connected"
                ? isListeningMode ? "Listening quietly (muted)" : "Ready to help with breakouts"
                : "Failed to connect to:"}
            </div>
            <div className="status-url">{errorMessage || (connectionStatus === "connected" ? isListeningMode ? "Say 'Hey Assistant' to activate" : "Listening to conversation..." : RELAY_SERVER_URL)}</div>
          </div>
        </div>
        {connectionStatus === "connected" && (
          <button 
            onClick={toggleListeningMode}
            style={{
              position: 'absolute',
              bottom: '20px',
              right: '20px',
              padding: '10px 20px',
              backgroundColor: isListeningMode ? '#10b981' : '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            {isListeningMode ? '🔇 Listening Mode (Click to Activate)' : '🎤 Active Mode (Click to Mute)'}
          </button>
        )}
      </div>
    );
  }

  // Otherwise show the control panel for creating bots
  return (
    <div className="App" style={{ backgroundColor: 'white', padding: '1rem' }}>
      <h1 style={{ color: 'black', marginBottom: '2rem' }}>Breakout Room Orchestrator</h1>
      
      <div style={{ display: 'flex', justifyContent: 'center', padding: '0 1rem' }}>
        <div className="form-container" style={{ 
          flex: 1, 
          maxWidth: '800px',
          backgroundColor: 'white',
          padding: '2rem 3rem',
          borderRadius: '12px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1), 0 8px 16px rgba(0, 0, 0, 0.06)',
          border: '1px solid #e5e7eb'
        }}>
          <h3 style={{ color: 'black', marginBottom: '1.25rem', textAlign: 'center' }}>Configure Your Assistant</h3>
          
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500', color: 'black' }}>
              Assistant Name
            </label>
            <input
              type="text"
              placeholder="e.g., Marketing Team Assistant, Engineering Bot, etc."
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              disabled={isCreatingBot || botCreated}
              style={{ 
                color: 'black',
                width: '100%'
              }}
            />
          </div>
          
          <div className="color-picker-section" style={{ marginBottom: '1.25rem' }}>
            <label className="color-picker-label" style={{ color: 'black' }}>Background Color</label>
            <input
              type="color"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              disabled={isCreatingBot || botCreated}
              style={{ width: '60px', height: '40px' }}
            />
            <span className="color-value" style={{ color: 'black' }}>{backgroundColor}</span>
          </div>
          
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500', color: 'black' }}>
              Google Meet URL
            </label>
            <input
              type="url"
              placeholder="Paste your Google Meet link here (e.g., https://meet.google.com/xxx-xxxx-xxx)"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              disabled={isCreatingBot || botCreated}
              style={{ 
                color: 'black',
                width: '100%'
              }}
            />
          </div>
          
          <div style={{ marginTop: '1.25rem', marginBottom: '1.25rem' }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: 'black',
              padding: '1rem 1.25rem',
              background: '#fafafa',
              border: '2px solid #e5e7eb',
              borderRadius: '12px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!isCreatingBot && !botCreated) {
                e.currentTarget.style.borderColor = '#9ca3af';
                e.currentTarget.style.background = 'white';
              }
            }}
            onMouseLeave={(e) => {
              if (!isCreatingBot && !botCreated) {
                e.currentTarget.style.borderColor = '#e5e7eb';
                e.currentTarget.style.background = '#fafafa';
              }
            }}>
              <input
                type="checkbox"
                checked={isListeningMode}
                onChange={(e) => setIsListeningMode(e.target.checked)}
                disabled={isCreatingBot || botCreated}
                style={{ 
                  width: '20px', 
                  height: '20px',
                  cursor: 'pointer',
                  accentColor: '#3b82f6'
                }}
              />
              <span>Start in Listening Mode (Bot stays quiet until called)</span>
            </label>
          </div>
          
          <button
            onClick={createBot}
            disabled={isCreatingBot || botCreated}
            style={{
              minWidth: '200px'
            }}
          >
            {isCreatingBot ? 'Creating Assistant...' : botCreated ? 'Assistant Created!' : 'Create Assistant'}
          </button>
          
          <div style={{ 
            minHeight: '60px',
            marginTop: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start'
          }}>
            {error && <div className="error-text">{error}</div>}
            
            {botCreated && (
              <div className="success-message">
                <p>✅ Assistant created successfully!</p>
                <p>Your breakout room assistant will join the meeting shortly. Please admit it when prompted.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
