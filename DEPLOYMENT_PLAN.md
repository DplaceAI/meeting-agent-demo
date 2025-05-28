# BULLETPROOF DEPLOYMENT PLAN FOR RECALL.AI VOICE AGENT

## Overview
This plan provides a simple, proven path to deploy your real-time voice agent that works in Google Meet without permission issues.

## Current Working Setup (From Your Code)
- **Frontend**: Already deployed at `https://client-6j6u0nfyv-wpuliers-projects.vercel.app`
- **Backend WebSocket**: Hard-coded to `wss://af0e-66-108-88-150.ngrok-free.app`
- **Recall API Token**: Already embedded in code (starts with `7e39...`)

## The Problem You Faced
When trying to modify the system, you encountered permission issues because:
1. Browser security policies block microphone access without HTTPS
2. WebSocket connections need proper CORS headers
3. Mixed content (HTTP/HTTPS) breaks real-time audio streaming

## BULLETPROOF DEPLOYMENT PATH

### Option 1: Quick Fix Using Existing Infrastructure (RECOMMENDED)
**Time: 10 minutes**

1. **Use your existing Vercel deployment** (already working)
   - Your frontend is already at: `https://client-6j6u0nfyv-wpuliers-projects.vercel.app`
   - No changes needed here

2. **Deploy backend to Railway.app** (avoid ngrok issues)
   ```bash
   cd node-server
   npm install
   ```
   
3. **Create `.env` file**:
   ```
   OPENAI_API_KEY=your-openai-key-here
   PORT=3000
   ```

4. **Deploy to Railway**:
   - Go to https://railway.app
   - Connect GitHub repo
   - Select `node-server` as root directory
   - Railway auto-detects Node.js app
   - Add environment variable: OPENAI_API_KEY
   - Deploy (you'll get URL like: `https://your-app.railway.app`)

5. **Update WebSocket URL in backend**:
   - In `node-server/index.js`, line 57, replace ngrok URL with your Railway URL:
   ```javascript
   url: `https://client-6j6u0nfyv-wpuliers-projects.vercel.app?wss=wss://your-app.railway.app`
   ```

6. **Redeploy and test**

### Option 2: Full Control Deployment
**Time: 30 minutes**

1. **Backend on Render.com** (free tier, no credit card)
   - Create account at https://render.com
   - New > Web Service
   - Connect your GitHub repo
   - Root Directory: `node-server`
   - Build Command: `npm install`
   - Start Command: `node index.js`
   - Add env var: OPENAI_API_KEY
   - Deploy (URL: `https://your-app.onrender.com`)

2. **Update Frontend** (only if changing agent personality)
   - Edit `client/src/conversation_config.ts` for personality
   - Keep existing Vercel deployment
   - Or redeploy to Vercel with:
   ```bash
   cd client
   npm run build
   vercel --prod
   ```

3. **Update Backend WebSocket URL**:
   ```javascript
   // In node-server/index.js, line 57
   url: `https://your-frontend.vercel.app?wss=wss://your-backend.onrender.com`
   ```

### Option 3: Use Pre-Built Solution (FASTEST - 5 minutes)
**Just change personality, keep everything else**

1. **Fork the repo to your GitHub**

2. **Edit personality only**:
   - File: `client/src/conversation_config.ts`
   - Change the `instructions` string to your desired personality
   - Commit changes

3. **Deploy frontend to Vercel**:
   - Import your forked repo to Vercel
   - Deploy (automatic)

4. **Use existing working backend**:
   - Keep using the ngrok URL that's already in the code
   - Just add your OPENAI_API_KEY locally and run:
   ```bash
   cd node-server
   echo "OPENAI_API_KEY=your-key" > .env
   npm install
   npm run dev
   ngrok http 3000
   ```

## CRITICAL SUCCESS FACTORS

### ✅ DO:
1. **Always use HTTPS** for frontend (Vercel handles this)
2. **Always use WSS** (not WS) for WebSocket
3. **Keep the exact WebSocket message format** (don't modify the relay logic)
4. **Test with a real Google Meet** (not localhost)
5. **Check browser console** for errors before assuming backend issues

### ❌ DON'T:
1. **Don't modify the WebSocket relay logic** in `node-server/index.js`
2. **Don't change the `@openai/realtime-api-beta` version**
3. **Don't add authentication** to WebSocket endpoint
4. **Don't modify CORS headers** (current setup works)
5. **Don't test with local frontend** (use deployed HTTPS version)

## PERSONALITY CUSTOMIZATION

Edit `client/src/conversation_config.ts`:
```typescript
export const instructions = `System settings:
Tool use: enabled.

Instructions:
- [YOUR CUSTOM PERSONALITY HERE]
- Always respond with a helpful voice via audio
- Be conversational and natural

Personality:
- [YOUR TRAITS HERE]
`;
```

## TESTING CHECKLIST

1. [ ] Backend running and showing "Server listening on port 3000"
2. [ ] WebSocket URL is WSS (not WS)
3. [ ] Frontend is HTTPS (not HTTP)
4. [ ] Create bot with correct meeting URL
5. [ ] Bot joins meeting (admit if needed)
6. [ ] See "Connected to OpenAI successfully!" in backend logs
7. [ ] Green dot shows in meeting interface
8. [ ] Can speak and get responses

## QUICK COMMANDS

### Local Testing:
```bash
# Terminal 1
cd node-server
npm run dev

# Terminal 2  
ngrok http 3000

# Terminal 3 - Create bot
curl --request POST \
  --url https://us-west-2.recall.ai/api/v1/bot/ \
  --header 'Authorization: Token 7e39298eacdcbee02e393f5d9140907b09139ed7' \
  --header 'Content-Type: application/json' \
  --data '{
    "meeting_url": "YOUR_MEET_URL",
    "bot_name": "Voice Assistant",
    "output_media": {
      "camera": {
        "kind": "webpage",
        "config": {
          "url": "https://client-6j6u0nfyv-wpuliers-projects.vercel.app?wss=wss://YOUR-NGROK-URL"
        }
      }
    }
  }'
```

## EMERGENCY FIXES

### "Permission Denied" Errors:
- Use deployed HTTPS frontend, not local
- Check browser allows microphone for the site

### "WebSocket Connection Failed":
- Ensure WSS not WS
- Check backend is running
- Verify ngrok URL is current

### "No Audio Response":
- Check OpenAI API key is set
- Look for "Connected to OpenAI successfully!" in logs
- Verify microphone permissions in meeting

## RECOMMENDED PATH

**For immediate success, use Option 3:**
1. Just run the backend locally with ngrok
2. Use your existing Vercel frontend
3. Only edit `conversation_config.ts` for personality
4. This avoids ALL permission issues you encountered

Once working, gradually move to Option 1 or 2 for production deployment. 