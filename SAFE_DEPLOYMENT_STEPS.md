# SAFE DEPLOYMENT STEPS - AVOIDING PERMISSION ISSUES

## Current Situation
- ✅ Backend is running locally on port 3000
- ✅ Ngrok is exposing it at: https://b336-66-108-88-150.ngrok-free.app
- ❌ Frontend Vercel deployment failed
- ⚠️ Need to avoid the permission/auth issues from before

## The Safe Path Forward

### Step 1: Fix the Frontend to Use Your Current Ngrok URL

First, let's update the hardcoded URLs in your frontend to use YOUR current ngrok URL:

```bash
cd client
```

Edit `src/App.tsx` line 161-162:
```javascript
// CHANGE FROM:
const wsUrl = 'wss://af0e-66-108-88-150.ngrok-free.app';
const backendUrl = 'https://af0e-66-108-88-150.ngrok-free.app';

// TO YOUR CURRENT NGROK:
const wsUrl = 'wss://b336-66-108-88-150.ngrok-free.app';
const backendUrl = 'https://b336-66-108-88-150.ngrok-free.app';
```

### Step 2: Deploy Frontend to Vercel (Web Interface)

**DO NOT use Vercel CLI** - use the web interface to ensure proper permissions:

1. Go to https://vercel.com
2. Log in with your account
3. Click "Add New..." → "Project"
4. Import your GitHub repository
5. **IMPORTANT**: Set root directory to `client`
6. Framework Preset: Vite
7. Build Command: `npm run build`
8. Output Directory: `dist`
9. Install Command: `npm install`
10. Deploy

### Step 3: Update Backend to Use Your Vercel Frontend

Once deployed, update `node-server/index.js` line 57:

```javascript
// CHANGE FROM:
url: `https://client-6j6u0nfyv-wpuliers-projects.vercel.app?wss=${websocket_url || 'wss://af0e-66-108-88-150.ngrok-free.app'}`

// TO:
url: `https://YOUR-NEW-VERCEL-URL.vercel.app?wss=${websocket_url || 'wss://b336-66-108-88-150.ngrok-free.app'}`
```

### Step 4: Test Carefully

1. Restart your node server:
   ```bash
   cd node-server
   npm run dev
   ```

2. Open your Vercel frontend URL
3. Enter a Google Meet URL
4. Click "Create Bot"
5. The bot should join the meeting
6. Test speech functionality

## What Could Break (and How to Fix)

### 1. CORS Issues
If you see CORS errors in browser console:
- The backend already has proper CORS headers, don't modify them
- Make sure you're using HTTPS frontend URL

### 2. WebSocket Connection Failed
If WebSocket fails to connect:
- Verify ngrok is still running
- Check that you're using `wss://` not `ws://`
- Ensure the ngrok URL in frontend matches your current ngrok session

### 3. Microphone Permissions
If you get permission errors:
- This happens when the bot webpage tries to access mic
- The bot webpage (what shows in the meeting) needs HTTPS
- Your control panel doesn't need mic access

## Emergency Fallback

If Vercel deployment fails again, use GitHub Pages:

1. Build the client:
   ```bash
   cd client
   npm run build
   ```

2. Create a new branch:
   ```bash
   git checkout -b gh-pages
   cd ..
   cp -r client/dist/* .
   git add .
   git commit -m "Deploy to GitHub Pages"
   git push origin gh-pages
   ```

3. Enable GitHub Pages in repo settings
4. Use source: Deploy from branch (gh-pages)
5. Your frontend will be at: https://YOUR-USERNAME.github.io/voice-agent-demo

## The Key Rule

**DO NOT MODIFY**:
- The WebSocket relay logic in `node-server/index.js`
- The audio handling in the client
- The OpenAI realtime client setup
- Any of the wavtools library

**ONLY MODIFY**:
- URLs to match your current setup
- The personality in `conversation_config.ts`
- UI elements that don't touch audio 