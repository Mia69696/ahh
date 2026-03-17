require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.BOT_TOKEN;
const DISCORD_API = 'https://discord.com/api/v10';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── helper: call Discord API from server (no CORS issues) ──
async function discord(endpoint) {
  const res = await fetch(DISCORD_API + endpoint, {
    headers: {
      Authorization: 'Bot ' + TOKEN,
      'Content-Type': 'application/json'
    }
  });
  return res.json();
}

// ── ROUTES ──────────────────────────────────────────────

// Bot info
app.get('/api/bot', async (req, res) => {
  try {
    const t0 = Date.now();
    const data = await discord('/users/@me');
    res.json({ ...data, _ping: Date.now() - t0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Servers / guilds
app.get('/api/guilds', async (req, res) => {
  try {
    const data = await discord('/users/@me/guilds');
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Guild details (icon, name, member count)
app.get('/api/guilds/:id', async (req, res) => {
  try {
    const data = await discord('/guilds/' + req.params.id + '?with_counts=true');
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Members of a guild
app.get('/api/guilds/:id/members', async (req, res) => {
  try {
    const limit = req.query.limit || 100;
    const data = await discord('/guilds/' + req.params.id + '/members?limit=' + limit);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Channels of a guild
app.get('/api/guilds/:id/channels', async (req, res) => {
  try {
    const data = await discord('/guilds/' + req.params.id + '/channels');
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Roles of a guild
app.get('/api/guilds/:id/roles', async (req, res) => {
  try {
    const data = await discord('/guilds/' + req.params.id + '/roles');
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ping / health check
app.get('/api/ping', async (req, res) => {
  try {
    const t0 = Date.now();
    await discord('/users/@me');
    res.json({ ping: Date.now() - t0, status: 'online' });
  } catch (e) {
    res.json({ ping: -1, status: 'error', error: e.message });
  }
});

// Fallback — serve dashboard
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ahh dashboard running on http://localhost:${PORT}`);
});
