# My Tracker

A personal task tracker with Gmail sync, deployed on Vercel.

## Setup (one time, ~15 minutes)

### 1. Push to GitHub
- Create a new **private** repository on GitHub (e.g. `my-tracker`)
- Upload these three files: `index.html`, `api/gmail.js`, `vercel.json`
  - You can drag and drop them into the GitHub web UI

### 2. Deploy to Vercel
- Go to [vercel.com](https://vercel.com) and sign in with GitHub
- Click **Add New → Project**
- Select your `my-tracker` repository
- Click **Deploy** (no build settings needed — leave everything default)

### 3. Add your Anthropic API Key
- In your Vercel project, go to **Settings → Environment Variables**
- Add a new variable:
  - **Name:** `ANTHROPIC_API_KEY`
  - **Value:** your key from [console.anthropic.com](https://console.anthropic.com)
- Click **Save**
- Go to **Deployments** and click **Redeploy** on the latest deployment

### 4. Connect Gmail
- In [claude.ai](https://claude.ai) settings, make sure **Gmail** is connected
- The Gmail sync uses your Claude account's Gmail connection via the API

### 5. Open your app
- Vercel gives you a URL like `https://my-tracker-abc123.vercel.app`
- Bookmark it — works on any browser, including mobile

## Updating the app
Whenever changes are made to your tracker, just replace the files in your GitHub repo.
Vercel redeploys automatically within ~30 seconds.

## Notes
- Task data is saved in your browser's localStorage on whatever device you use
- Gmail sync button appears on any task list view
- Emails need `[task]` in the subject line to be picked up
