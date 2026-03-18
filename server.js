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

async function discord(endpoint) {
  const res = await fetch(DISCORD_API + endpoint, {
    headers: { Authorization: 'Bot ' + TOKEN, 'Content-Type': 'application/json' }
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch (e) { return { error: text }; }
}

app.get('/api/bot', async (req, res) => {
  try {
    const t0 = Date.now();
    const data = await discord('/users/@me');
    res.json({ ...data, _ping: Date.now() - t0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/guilds', async (req, res) => {
  try {
    const guilds = await discord('/users/@me/guilds');
    if (!Array.isArray(guilds)) return res.json(guilds);
    const detailed = await Promise.all(guilds.map(async g => {
      try {
        const full = await discord('/guilds/' + g.id + '?with_counts=true');
        return {
          id: g.id, name: g.name, icon: g.icon, owner: g.owner,
          member_count: full.approximate_member_count || full.member_count || 0,
          presence_count: full.approximate_presence_count || 0,
        };
      } catch (e) {
        return { id: g.id, name: g.name, icon: g.icon, owner: g.owner, member_count: 0 };
      }
    }));
    res.json(detailed);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/guilds/:id', async (req, res) => {
  try {
    const data = await discord('/guilds/' + req.params.id + '?with_counts=true');
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/guilds/:id/members', async (req, res) => {
  try {
    const limit = req.query.limit || 100;
    const data = await discord('/guilds/' + req.params.id + '/members?limit=' + limit);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/guilds/:id/channels', async (req, res) => {
  try {
    const data = await discord('/guilds/' + req.params.id + '/channels');
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/guilds/:id/roles', async (req, res) => {
  try {
    const data = await discord('/guilds/' + req.params.id + '/roles');
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/ping', async (req, res) => {
  try {
    const t0 = Date.now();
    await discord('/users/@me');
    res.json({ ping: Date.now() - t0, status: 'online' });
  } catch (e) { res.json({ ping: -1, status: 'error', error: e.message }); }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ahh dashboard running on port ${PORT}`);
});
