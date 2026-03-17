# ahh — Discord Bot Dashboard

A full-stack dashboard for your Discord bot. No CORS issues — the backend proxies all Discord API calls.

---

## 🚀 Deploy to Railway (FREE — takes 5 minutes)

### Step 1 — Install Git (if you don't have it)
Download from: https://git-scm.com/downloads

### Step 2 — Create a GitHub account (if you don't have one)
Go to: https://github.com

### Step 3 — Upload this project to GitHub
1. Go to https://github.com/new
2. Name it `ahh-dashboard`, click **Create repository**
3. Open a terminal / command prompt in this folder and run:

```
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ahh-dashboard.git
git push -u origin main
```
(replace YOUR_USERNAME with your GitHub username)

### Step 4 — Deploy on Railway
1. Go to https://railway.app and sign up (free)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `ahh-dashboard` repo
4. Railway will detect it's a Node.js app and deploy automatically

### Step 5 — Add your bot token as an environment variable
1. In Railway, click your project → **Variables**
2. Add:
   - `BOT_TOKEN` = `MTQ4MzU4NTE3MDk3OTI5NTIzMg.G2yesf.Pts901Vhrq4LDj-Nm8tdjxR9Hfuuhcml3nRESg`
   - `PORT` = `3000`
3. Railway will auto-redeploy

### Step 6 — Open your dashboard
Railway gives you a free URL like `https://ahh-dashboard-production.up.railway.app`
Click it — your dashboard is live and fully working ✅

---

## 💻 Run locally (for testing)

```bash
# Install dependencies
npm install

# Start the server
npm start

# Open in browser
http://localhost:3000
```

---

## 📁 Project structure

```
ahh-bot/
├── server.js          ← Node.js backend (proxies Discord API)
├── package.json       ← Dependencies
├── railway.toml       ← Railway deploy config
├── .env               ← Your bot token (DO NOT share/commit this)
├── .gitignore         ← Ignores .env and node_modules
└── public/
    └── index.html     ← The full dashboard UI
```

---

## ⚠️ Important

- Your `.env` file is in `.gitignore` — it will NOT be uploaded to GitHub
- Always add your token via Railway's Variables panel, never hardcode it
- If your token gets leaked, reset it at: https://discord.com/developers/applications

---

## 🔧 Enable Server Members Intent (for Members tab)

1. Go to https://discord.com/developers/applications
2. Select your bot → **Bot** tab
3. Turn ON **Server Members Intent**
4. Save changes
