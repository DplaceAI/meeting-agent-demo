# Recall.ai Real-Time Voice Agent

A voice assistant bot for Google Meet, Zoom, and Microsoft Teams using Recall.ai and OpenAI's real-time API.

## Quick Start

### Prerequisites
1. [Node.js](https://nodejs.org/en/)
2. [Ngrok](https://ngrok.com/docs/getting-started/)
3. [Recall.ai API Key](https://www.recall.ai/)
4. [OpenAI API Key](https://platform.openai.com/docs/overview)

### Setup (5 minutes)

1. **Clone and install:**
```bash
git clone <this-repo>
cd voice-agent-demo/node-server
npm install
```

2. **Add your OpenAI API key:**
```bash
echo "OPENAI_API_KEY=your-openai-api-key-here" > .env
```

3. **Start the server:**
```bash
npm run dev
```

4. **In a new terminal, expose your server:**
```bash
ngrok http 3000
```
Copy the `https` URL (e.g., `https://abc123.ngrok-free.app`)

5. **Create a bot for your meeting:**
```bash
curl --request POST \
  --url https://us-west-2.recall.ai/api/v1/bot/ \
  --header 'Authorization: Token YOUR_RECALL_TOKEN' \
  --header 'accept: application/json' \
  --header 'content-type: application/json' \
  --data '{
    "meeting_url": "YOUR_MEETING_URL",
    "bot_name": "Voice Assistant",
    "output_media": {
      "camera": {
        "kind": "webpage",
        "config": {
          "url": "https://recallai-demo.netlify.app?wss=wss://YOUR_NGROK_URL"
        }
      }
    }
  }'
```

### Template Variables
- `YOUR_RECALL_TOKEN`: Your Recall.ai API token
- `YOUR_MEETING_URL`: Full meeting URL (e.g., `https://meet.google.com/abc-defg-hij`)
- `YOUR_NGROK_URL`: Your ngrok domain (e.g., `abc123.ngrok-free.app`)

### Example (Working Command)
```bash
curl --request POST \
  --url https://us-west-2.recall.ai/api/v1/bot/ \
  --header 'Authorization: Token 7e39298eacdcbee02e393f5d9140907b09139ed7' \
  --header 'accept: application/json' \
  --header 'content-type: application/json' \
  --data '{
    "meeting_url": "https://meet.google.com/zgb-ycxu-zkc",
    "bot_name": "Voice Assistant",
    "output_media": {
      "camera": {
        "kind": "webpage",
        "config": {
          "url": "https://recallai-demo.netlify.app?wss=wss://af0e-66-108-88-150.ngrok-free.app"
        }
      }
    }
  }'
```

## How It Works

1. The bot joins your meeting and displays a voice interface
2. When you speak, audio is streamed to your local server via WebSocket
3. Your server forwards the audio to OpenAI's real-time API
4. OpenAI processes the speech and generates a response
5. The response audio is streamed back through your server to the meeting

## Troubleshooting

- **Bot doesn't respond**: Check your server logs for "Connected to OpenAI successfully!"
- **Invalid API key error**: Restart your server after updating the `.env` file
- **Bot doesn't join**: Verify your meeting URL is correct and the meeting is active

## Advanced Usage

For custom UI or behavior modifications, see the original documentation below.

---

### [Watch the Demo Here!](https://www.loom.com/share/2a02fac2643441c1990da861e829892c)

This demo application uses Recall.ai's [Output Media](https://docs.recall.ai/docs/stream-media) feature and OpenAI's [real-time API](https://platform.openai.com/docs/guides/realtime) to add an interactive voice agent to meetings.

## Prerequisites

1. [Node.js](https://nodejs.org/en/) (for Node.js server implementation)
2. [Python 3.8+](https://www.python.org/downloads/) (for Python server implementation)
3. [Ngrok](https://ngrok.com/docs/getting-started/)
4. [Recall.ai API Key](https://www.recall.ai/)
5. [OpenAI API Key](https://platform.openai.com/docs/overview)

## Installation

### Clone the Repository

```bash
git clone ...
```

### Install Dependencies

#### Client

```bash
cd client
npm install
```

#### Server

The server implementation is available in both Node.js and Python. Choose your preferred implementation:

##### Node.js Implementation

```bash
cd ../node-server
npm install
```

##### Python Implementation

```bash
cd ../python-server
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Configuration

### OpenAI API Key

#### Node.js Server

In the node-server directory, copy the `.env.example` file and rename it to `.env`. Then, add your OpenAI API key.

#### Python Server

In the python-server directory, copy the `.env.example` file and rename it to `.env`. Then, add your OpenAI API key. The PORT is optional and defaults to 3000 if not specified.

## Quickstart

If you want to quickly test the functionality of this application, you don't need to host the frontend yourself. You can use our pre-hosted demo frontend at [https://recallai-demo.netlify.app](https://recallai-demo.netlify.app). However, you will still need to provide your OpenAI API key and ngrok URL.

1. Start your backend server (choose either Node.js or Python implementation) and expose it using ngrok:

Node.js:

```bash
cd node-server
npm run dev
```

Python:

```bash
cd python-server
python server.py
```

Then in a separate terminal:

```bash
ngrok http 3000
```

2. Create a bot by sending the following curl request, replacing YOUR_RECALL_TOKEN and YOUR_NGROK_URL with your values:

```bash
curl --request POST \
  --url https://us-east-1.recall.ai/api/v1/bot/ \
  --header 'Authorization: YOUR_RECALL_TOKEN' \
  --header 'accept: application/json' \
  --header 'content-type: application/json' \
  --data '{
    "meeting_url": "YOUR_MEETING_URL",
    "bot_name": "Recall.ai Notetaker",
    "output_media": {
      "camera": {
        "kind": "webpage",
        "config": {
          "url": "https://recallai-demo.netlify.app?wss=wss://YOUR_NGROK_URL"
        }
      }
    },
    "variant": {
      "zoom": "web_4_core",
      "google_meet": "web_4_core",
      "microsoft_teams": "web_4_core"
    }
  }'
```

The bot will join your meeting URL and stream the demo webpage's content directly to your meeting.

If you'd like to customize the webpage shown by the bot, or change the interaction with the OpenAI agent, follow the complete setup instructions below.

## Customizing the Webpage

### Local Development Setup

Navigate to the client directory and start the development server:

```bash
cd client
npm run dev
```

The client will be available at `http://localhost:5173`.

### Modifying the Agent

You can modify the initial prompt of the agent by editing the `conversation_config.ts` file.

### Building for Production

Build the client application:

```bash
npm run build
```

The built files will be in the `dist` directory, ready to be deployed to your hosting service.

Once the frontend is deployed on a hosting service, update your bot configuration to use your custom webpage URL:

```json
{
  "output_media": {
    "kind": "webpage",
    "config": {
      "url": "https://your-custom-url.com?wss=wss://your-server.com"
    }
  }
}
```

Using this, you will be able to interact with a customized voice agent.

## Acknowledgements

This project incorporates code from [OpenAI's real-time API demo](https://github.com/openai/openai-realtime-console), which is under the MIT License.
