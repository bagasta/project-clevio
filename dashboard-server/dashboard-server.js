// dashboard-server.js

// Load environment variables & modules
const path = require('path');
const fs   = require('fs');
try { require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); }
catch { console.warn('dotenv not found; skipping .env'); }

const express = require('express');
const cors    = require('cors');
const session = require('express-session');
const axios   = require('axios');
const { Client, LocalAuth } = require('whatsapp-web.js');

// ── SETUP AUTH PERSISTENCE ─────────────────────────────────────────────────────
const AUTH_ROOT    = path.resolve(__dirname, '../data/auth');
fs.mkdirSync(AUTH_ROOT, { recursive: true });

// File untuk persist sesi metadata
const SESSIONS_FILE = path.resolve(__dirname, '../data/sessions.json');
function loadSessionMeta() {
  if (!fs.existsSync(SESSIONS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(SESSIONS_FILE)); }
  catch { return []; }
}
function saveSessionMeta() {
  const meta = Object.entries(sessions).map(([name, sess]) => ({
    name,
    webhook: sess.webhook
  }));
  fs.mkdirSync(path.dirname(SESSIONS_FILE), { recursive: true });
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(meta, null, 2));
}

// In-memory store & SSE clients
const sessions   = {};
const sseClients = [];

// ── EXPRESS SETUP ───────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboard cat',
  resave: false,
  saveUninitialized: false,
}));
app.use(express.static(path.join(__dirname, '../public')));

// Auth guard untuk dashboard/api
function requireLogin(req, res, next) {
  if (req.session?.loggedIn) return next();
  return res.redirect('/login.html');
}

// ── SSE BROADCAST ──────────────────────────────────────────────────────────────
function getSessionSummary() {
  return Object.entries(sessions).map(([name, sess]) => ({
    name,
    status:    sess.status,
    webhook:   sess.webhook,
    qr:        sess.qr,
    createdAt: sess.createdAt,
  }));
}
function broadcastSessions() {
  const data = JSON.stringify(getSessionSummary());
  sseClients.forEach(res => res.write(`data: ${data}\n\n`));
}

// ── SESSION MANAGEMENT ─────────────────────────────────────────────────────────

/**
 * Buat dan initialize session baru
 */
async function createSession(name, webhook) {
  if (sessions[name]) throw new Error('Session already exists');

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: name,
      dataPath: AUTH_ROOT
    }),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
  });

  const sessionObj = {
    client,
    status:    'starting',
    qr:        null,
    webhook:   webhook || null,
    createdAt: new Date().toISOString(),
  };
  sessions[name] = sessionObj;
  saveSessionMeta();

  // Event handler lifecycle
  client.on('qr', qr => {
    sessionObj.status = 'qr';
    sessionObj.qr     = qr;
    broadcastSessions();
  });
  client.on('authenticated', () => {
    sessionObj.status = 'authenticated';
    sessionObj.qr     = null;
    broadcastSessions();
  });
  client.on('ready', () => {
    sessionObj.status = 'ready';
    sessionObj.qr     = null;
    broadcastSessions();
  });
  client.on('auth_failure', () => {
    sessionObj.status = 'failed';
    sessionObj.qr     = null;
    broadcastSessions();
  });
  client.on('disconnected', () => {
    sessionObj.status = 'disconnected';
    sessionObj.qr     = null;
    broadcastSessions();
  });

  // Forward semua jenis pesan ke webhook, termasuk nama kontak & grup
  client.on('message', async msg => {
    if (!sessionObj.webhook) return;
    const contact = await msg.getContact();
    const chat    = await msg.getChat();

    const payload = {
      session:     name,
      from:        msg.from,
      to:          msg.to || null,
      id:          msg.id._serialized,
      timestamp:   msg.timestamp,
      type:        msg.type,
      isGroupMsg:  msg.isGroupMsg || false,
      author:      msg.author || null,
      contactName: contact.pushname || contact.name || contact.number,
      chatName:    chat.isGroup ? chat.name : (contact.pushname || contact.name),
      body:        msg.body || null
    };

    if (msg.hasMedia) {
      try {
        const media = await msg.downloadMedia();
        payload.media = {
          mimetype: media.mimetype,
          data:      media.data,
          filename:  media.filename
        };
      } catch (e) {
        console.error('Error download media:', e);
      }
    }

    if (msg.location) {
      payload.location = {
        latitude:  msg.location.latitude,
        longitude: msg.location.longitude,
        name:      msg.location.name,
        address:   msg.location.address
      };
    }

    try {
      await axios.post(sessionObj.webhook, payload);
    } catch (err) {
      console.error(`❌ Gagal kirim pesan session ${name} ke webhook:`, err.message);
    }
  });

  await client.initialize();
  return sessionObj;
}

/**
 * Hapus session (destroy client, tapi jangan hapus folder auth)
 */
async function deleteSession(name) {
  const sess = sessions[name];
  if (!sess) throw new Error('Session not found');
  try { await sess.client.destroy(); } catch {}
  delete sessions[name];
  saveSessionMeta();
  broadcastSessions();
}

/**
 * Logout lalu re-init session (trigger QR ulang)
 */
async function rescanSession(name) {
  const sess = sessions[name];
  if (!sess) throw new Error('Session not found');

  sess.status = 'rescan';
  sess.qr     = null;
  broadcastSessions();

  try {
    await sess.client.logout();
    await sess.client.destroy();
  } catch {}

  // Re-create client dengan dataPath yang sama
  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: name,
      dataPath: AUTH_ROOT
    }),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
  });
  sessions[name].client    = client;
  sessions[name].status    = 'starting';
  sessions[name].qr        = null;

  // Pasang ulang event handler & message-forward (sama seperti di createSession)
  client.on('qr', qr => {
    sessions[name].status = 'qr';
    sessions[name].qr     = qr;
    broadcastSessions();
  });
  client.on('authenticated', () => {
    sessions[name].status = 'authenticated';
    sessions[name].qr     = null;
    broadcastSessions();
  });
  client.on('ready', () => {
    sessions[name].status = 'ready';
    sessions[name].qr     = null;
    broadcastSessions();
  });
  client.on('auth_failure', () => {
    sessions[name].status = 'failed';
    sessions[name].qr     = null;
    broadcastSessions();
  });
  client.on('disconnected', () => {
    sessions[name].status = 'disconnected';
    sessions[name].qr     = null;
    broadcastSessions();
  });
  client.on('message', async msg => {
    if (!sessions[name].webhook) return;
    const contact = await msg.getContact();
    const chat    = await msg.getChat();

    const payload = {
      session:     name,
      from:        msg.from,
      to:          msg.to || null,
      id:          msg.id._serialized,
      timestamp:   msg.timestamp,
      type:        msg.type,
      isGroupMsg:  msg.isGroupMsg || false,
      author:      msg.author || null,
      contactName: contact.pushname || contact.name || contact.number,
      chatName:    chat.isGroup ? chat.name : (contact.pushname || contact.name),
      body:        msg.body || null
    };

    if (msg.hasMedia) {
      try {
        const media = await msg.downloadMedia();
        payload.media = {
          mimetype: media.mimetype,
          data:      media.data,
          filename:  media.filename
        };
      } catch {}
    }
    if (msg.location) {
      payload.location = {
        latitude:  msg.location.latitude,
        longitude: msg.location.longitude,
        name:      msg.location.name,
        address:   msg.location.address
      };
    }

    try {
      await axios.post(sessions[name].webhook, payload);
    } catch (e) {
      console.error(`❌ Gagal kirim pesan session ${name}:`, e.message);
    }
  });

  await client.initialize();
}

// ── ROUTES: LOGIN & DASHBOARD ─────────────────────────────────────────────────
app.get('/login.html', (req, res, next) => {
  if (req.session?.loggedIn) return res.redirect('/dashboard.html');
  next();
});
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.CLEVIO_USERNAME && password === process.env.CLEVIO_PASSWORD) {
    req.session.loggedIn = true;
    return res.json({ success: true });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// ── API CRUD SESSIONS ─────────────────────────────────────────────────────────
const api = express.Router();
api.use(requireLogin);

api.get('/sessions', (req, res) => {
  res.json(getSessionSummary());
});

api.post('/sessions', async (req, res) => {
  const { name, webhook } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const sess = await createSession(name, webhook);
    return res.json({ name, status: sess.status, webhook: sess.webhook });
  } catch (err) {
    console.error('Error creating session', err);
    return res.status(500).json({ error: err.message });
  }
});

api.put('/sessions/:name/webhook', (req, res) => {
  const { name } = req.params;
  const { webhook } = req.body;
  if (!webhook) return res.status(400).json({ error: 'webhook is required' });
  const sess = sessions[name];
  if (!sess) return res.status(404).json({ error: 'Session not found' });
  sess.webhook = webhook;
  saveSessionMeta();
  broadcastSessions();
  res.json({ success: true });
});

api.post('/sessions/:name/rescan', async (req, res) => {
  try {
    await rescanSession(req.params.name);
    res.json({ success: true });
  } catch (err) {
    console.error('Error rescanning session', err);
    res.status(500).json({ error: err.message });
  }
});

api.delete('/sessions/:name', async (req, res) => {
  try {
    await deleteSession(req.params.name);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting session', err);
    res.status(500).json({ error: err.message });
  }
});

// SSE endpoint for realtime status
api.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.write(`data: ${JSON.stringify(getSessionSummary())}\n\n`);
  sseClients.push(res);
  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx >= 0) sseClients.splice(idx, 1);
  });
});

app.use('/api', api);
app.get('/dashboard.html', requireLogin, (_, res, next) => next());
app.get('/', (req, res) => {
  return req.session?.loggedIn
    ? res.redirect('/dashboard.html')
    : res.redirect('/login.html');
});

// ── STARTUP: restore & listen ─────────────────────────────────────────────────
async function start() {
  // Restore sessions dari metadata file
  const metas = loadSessionMeta();
  for (const { name, webhook } of metas) {
    try {
      await createSession(name, webhook);
    } catch (err) {
      console.error('Error restoring session', name, err);
    }
  }

  const PORT = process.env.DASHBOARD_PORT || 4000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Clevio Pro dashboard running on http://localhost:${PORT}`);
  });
}

start();
