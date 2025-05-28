import { WebSocketServer } from 'ws';
import { RealtimeClient } from '@openai/realtime-api-beta';
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';

dotenv.config();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://meeting-agent-demo.vercel.app';
const WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'wss://b336-66-108-88-150.ngrok-free.app';

if (!OPENAI_API_KEY) {
  console.error('Missing OpenAI API key. Please set it in the .env file.');
  process.exit(1);
}

// Create Express app
const app = express();
app.use(express.json());

// Enable CORS for your frontend
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://meeting-agent-demo.vercel.app',
    'https://meeting-agent-demo-git-main-wpuliers-projects.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Create bot endpoint
app.post('/create-bot', async (req, res) => {
  const { meeting_url, bot_name, websocket_url } = req.body;
  
  if (!meeting_url) {
    return res.status(400).json({ error: 'Meeting URL is required' });
  }

  try {
    const response = await fetch('https://us-west-2.recall.ai/api/v1/bot/', {
      method: 'POST',
      headers: {
        'Authorization': 'Token 7e39298eacdcbee02e393f5d9140907b09139ed7',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        meeting_url,
        bot_name: bot_name || "Voice Assistant",
        output_media: {
          camera: {
            kind: "webpage",
            config: {
              url: `${FRONTEND_URL}?wss=${websocket_url || WEBSOCKET_URL}`
            }
          }
        },
        variant: {
          zoom: "web_4_core",
          google_meet: "web_4_core",
          microsoft_teams: "web_4_core"
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    res.json(data);
  } catch (error) {
    console.error('Error creating bot:', error);
    res.status(500).json({ error: 'Failed to create bot' });
  }
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server using the same HTTP server
const wss = new WebSocketServer({ server });

// Start server on port 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT} (HTTP + WebSocket)`);
});

wss.on("connection", async (ws, req) => {
  if (!req.url) {
    console.log("No URL provided, closing connection.");
    ws.close();
    return;
  }

  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname !== "/") {
    console.log(`Invalid pathname: "${pathname}"`);
    ws.close();
    return;
  }

  const client = new RealtimeClient({ apiKey: OPENAI_API_KEY });

  // Relay: OpenAI Realtime API Event -> Browser Event
  client.realtime.on("server.*", (event) => {
    console.log(`Relaying "${event.type}" to Client`);
    if (event.type === 'error') {
      console.error('OpenAI Error:', event);
    }
    ws.send(JSON.stringify(event));
  });
  client.realtime.on("close", () => ws.close());

  // Relay: Browser Event -> OpenAI Realtime API Event
  // We need to queue data waiting for the OpenAI connection
  const messageQueue = [];
  const messageHandler = (data) => {
    try {
      const event = JSON.parse(data);
      console.log(`Relaying "${event.type}" to OpenAI`);
      if (event.type === 'response.create') {
        console.log('Response create event:', JSON.stringify(event, null, 2));
      }
      client.realtime.send(event.type, event);
    } catch (e) {
      console.error(e.message);
      console.log(`Error parsing event from client: ${data}`);
    }
  };
  ws.on("message", (data) => {
    if (!client.isConnected()) {
      messageQueue.push(data);
    } else {
      messageHandler(data);
    }
  });
  ws.on("close", () => client.disconnect());

  // Connect to OpenAI Realtime API
  try {
    console.log(`Connecting to OpenAI...`);
    await client.connect();
  } catch (e) {
    console.log(`Error connecting to OpenAI: ${e.message}`);
    ws.close();
    return;
  }
  console.log(`Connected to OpenAI successfully!`);
  while (messageQueue.length) {
    messageHandler(messageQueue.shift());
  }
});
