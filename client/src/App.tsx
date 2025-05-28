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
      <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '3rem', fontSize: '1.1rem' }}>
        Create AI-powered meeting assistants to help orchestrate productive breakout sessions
      </p>
      
      <div style={{ display: 'flex', gap: '3rem', alignItems: 'flex-start' }}>
        <div className="form-container" style={{ flex: 1, minWidth: '400px' }}>
          <h3>Configure Your Assistant</h3>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
              Assistant Name
            </label>
            <input
              type="text"
              placeholder="Enter assistant name"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              disabled={isCreatingBot || botCreated}
            />
          </div>
          
          <div className="color-picker-section">
            <label className="color-picker-label">Background Color</label>
            <input
              type="color"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              disabled={isCreatingBot || botCreated}
              style={{ width: '60px', height: '40px' }}
            />
            <span className="color-value">{backgroundColor}</span>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
              Google Meet URL
            </label>
            <input
              type="text"
              placeholder="https://meet.google.com/xxx-xxxx-xxx"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              disabled={isCreatingBot || botCreated}
            />
          </div>
          
          <button
            onClick={createBot}
            disabled={isCreatingBot || botCreated}
          >
            {isCreatingBot ? 'Creating Assistant...' : botCreated ? 'Assistant Created!' : 'Create Assistant'}
          </button>
          
          {error && <div className="error-text">{error}</div>}
          
          {botCreated && (
            <div className="success-message">
              <p>✅ Assistant created successfully!</p>
              <p>Your breakout room assistant will join the meeting shortly. Please admit it when prompted.</p>
            </div>
          )}
        </div>
        
        <div className="preview-container" style={{ flex: 1, minWidth: '300px' }}>
          <h3>Live Preview</h3>
          <div 
            className="preview-bot"
            style={{ 
              backgroundColor: backgroundColor, 
              padding: '3rem 2rem',
            }}
          >
            <div className="preview-avatar">👥</div>
            <h4 className="preview-name">{botName}</h4>
            <p className="preview-subtitle">Ready to orchestrate breakout rooms</p>
          </div>
          
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', fontSize: '0.875rem', color: '#64748b' }}>
            <strong>What this assistant does:</strong>
            <ul style={{ margin: '0.5rem 0', paddingLeft: '1.25rem' }}>
              <li>Listens to meeting conversations</li>
              <li>Suggests optimal breakout room timing</li>
              <li>Recommends group sizes and activities</li>
              <li>Helps facilitate smooth transitions</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
