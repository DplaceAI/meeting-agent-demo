import { useState, useEffect, useRef, useCallback } from "react";
import { RealtimeClient } from "@openai/realtime-api-beta";
// @ts-expect-error - External library without type definitions
import { WavRecorder, WavStreamPlayer } from "./lib/wavtools/index.js";
import { instructions } from "./conversation_config.js";
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
          text: `Hello!`,
        },
      ]);

      // Always use VAD mode
      client.updateSession({
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
  }, []);

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

      // Set instructions
      client.updateSession({ instructions: instructions });

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
                ? "Ready to help with breakouts"
                : "Failed to connect to:"}
            </div>
            <div className="status-url">{errorMessage || (connectionStatus === "connected" ? "Listening to conversation..." : RELAY_SERVER_URL)}</div>
          </div>
        </div>
      </div>
    );
  }

  // Otherwise show the control panel for creating bots
  return (
    <div className="App">
      <h1>Breakout Room Orchestrator</h1>
      
      <div style={{ display: 'flex', gap: '40px', maxWidth: '900px', margin: '0 auto' }}>
        <div className="form-container" style={{ flex: 1 }}>
          <h3>Configure Your Bot</h3>
          <input
            type="text"
            placeholder="Bot Name"
            value={botName}
            onChange={(e) => setBotName(e.target.value)}
            disabled={isCreatingBot || botCreated}
            style={{ width: '100%', padding: '10px', marginBottom: '10px' }}
          />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <label style={{ fontSize: '14px' }}>Background Color:</label>
            <input
              type="color"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              disabled={isCreatingBot || botCreated}
              style={{ width: '60px', height: '40px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '14px', color: '#666' }}>{backgroundColor}</span>
          </div>
          
          <input
            type="text"
            placeholder="Enter Google Meet URL"
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            disabled={isCreatingBot || botCreated}
            style={{ width: '100%', padding: '10px', marginBottom: '10px' }}
          />
          
          <button
            onClick={createBot}
            disabled={isCreatingBot || botCreated}
            style={{ padding: '10px 20px', cursor: 'pointer', width: '100%' }}
          >
            {isCreatingBot ? 'Creating Bot...' : botCreated ? 'Bot Created!' : 'Create Bot'}
          </button>
          
          {error && <p style={{ color: 'red' }}>{error}</p>}
          
          {botCreated && (
            <div style={{ marginTop: '20px', padding: '20px', background: '#f0f0f0', borderRadius: '8px' }}>
              <p>✅ Bot created successfully!</p>
              <p>The bot will join your meeting. Please admit it when it tries to join.</p>
            </div>
          )}
        </div>
        
        <div style={{ flex: 1 }}>
          <h3>Preview</h3>
          <div style={{ 
            backgroundColor: backgroundColor, 
            padding: '40px', 
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>👥</div>
            <h4 style={{ margin: 0, color: '#333' }}>{botName}</h4>
            <p style={{ marginTop: '10px', color: '#666', fontSize: '14px' }}>
              Ready to orchestrate breakout rooms
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
