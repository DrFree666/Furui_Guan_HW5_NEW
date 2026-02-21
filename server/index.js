require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const URI = process.env.REACT_APP_MONGODB_URI || process.env.MONGODB_URI || process.env.REACT_APP_MONGO_URI;
const DB = 'chatapp';

let db;

async function connect() {
  const client = await MongoClient.connect(URI);
  db = client.db(DB);
  console.log('MongoDB connected');
}

app.get('/', (req, res) => {
  res.send(`
    <html>
      <body style="font-family:sans-serif;padding:2rem;background:#00356b;color:white;min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0">
        <div style="text-align:center">
          <h1>Chat API Server</h1>
          <p>Backend is running. Use the React app at <a href="http://localhost:3000" style="color:#ffd700">localhost:3000</a></p>
          <p><a href="/api/status" style="color:#ffd700">Check DB status</a></p>
        </div>
      </body>
    </html>
  `);
});

app.get('/api/status', async (req, res) => {
  try {
    const usersCount = await db.collection('users').countDocuments();
    const sessionsCount = await db.collection('sessions').countDocuments();
    res.json({ usersCount, sessionsCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Users ────────────────────────────────────────────────────────────────────

app.post('/api/users', async (req, res) => {
  try {
    const { username, password, email, firstName, lastName } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password required' });
    const name = String(username).trim().toLowerCase();
    const existing = await db.collection('users').findOne({ username: name });
    if (existing) return res.status(400).json({ error: 'Username already exists' });
    const hashed = await bcrypt.hash(password, 10);
    await db.collection('users').insertOne({
      username: name,
      password: hashed,
      email: email ? String(email).trim().toLowerCase() : null,
      firstName: firstName ? String(firstName).trim() : null,
      lastName: lastName ? String(lastName).trim() : null,
      createdAt: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password required' });
    const name = username.trim().toLowerCase();
    const user = await db.collection('users').findOne({ username: name });
    if (!user) return res.status(401).json({ error: 'User not found' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid password' });
    res.json({
      ok: true,
      username: name,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Sessions ─────────────────────────────────────────────────────────────────

app.get('/api/sessions', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'username required' });
    const sessions = await db
      .collection('sessions')
      .find({ username })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(
      sessions.map((s) => ({
        id: s._id.toString(),
        agent: s.agent || null,
        title: s.title || null,
        createdAt: s.createdAt,
        messageCount: (s.messages || []).length,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const { username, agent } = req.body;
    if (!username) return res.status(400).json({ error: 'username required' });
    const { title } = req.body;
    const result = await db.collection('sessions').insertOne({
      username,
      agent: agent || null,
      title: title || null,
      createdAt: new Date().toISOString(),
      messages: [],
    });
    res.json({ id: result.insertedId.toString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sessions/:id', async (req, res) => {
  try {
    await db.collection('sessions').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/sessions/:id/title', async (req, res) => {
  try {
    const { title } = req.body;
    await db.collection('sessions').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { title } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Messages ─────────────────────────────────────────────────────────────────

app.post('/api/messages', async (req, res) => {
  try {
    const { session_id, role, content, imageData, charts, toolCalls } = req.body;
    if (!session_id || !role || content === undefined)
      return res.status(400).json({ error: 'session_id, role, content required' });
    const msg = {
      role,
      content,
      timestamp: new Date().toISOString(),
      ...(imageData && {
        imageData: Array.isArray(imageData) ? imageData : [imageData],
      }),
      ...(charts?.length && { charts }),
      ...(toolCalls?.length && { toolCalls }),
    };
    await db.collection('sessions').updateOne(
      { _id: new ObjectId(session_id) },
      { $push: { messages: msg } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    const doc = await db
      .collection('sessions')
      .findOne({ _id: new ObjectId(session_id) });
    const raw = doc?.messages || [];
    const msgs = raw.map((m, i) => {
      const arr = m.imageData
        ? Array.isArray(m.imageData)
          ? m.imageData
          : [m.imageData]
        : [];
      return {
        id: `${doc._id}-${i}`,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        images: arr.length
          ? arr.map((img) => ({ data: img.data, mimeType: img.mimeType }))
          : undefined,
        charts: m.charts?.length ? m.charts : undefined,
        toolCalls: m.toolCalls?.length ? m.toolCalls : undefined,
      };
    });
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── YouTube Channel Data ──────────────────────────────────────────────────────

const YOUTUBE_API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;

function parseChannelUrl(url) {
  const u = url.trim();
  const handleMatch = u.match(/youtube\.com\/@([^/?]+)/);
  if (handleMatch) return { type: 'handle', value: handleMatch[1] };
  const channelMatch = u.match(/youtube\.com\/channel\/([^/?]+)/);
  if (channelMatch) return { type: 'channelId', value: channelMatch[1] };
  const customMatch = u.match(/youtube\.com\/c\/([^/?]+)/);
  if (customMatch) return { type: 'custom', value: customMatch[1] };
  return null;
}

app.get('/api/youtube/channel', async (req, res) => {
  if (!YOUTUBE_API_KEY) {
    return res.status(503).json({ error: 'YouTube API key not configured (YOUTUBE_API_KEY or REACT_APP_YOUTUBE_API_KEY)' });
  }
  const url = req.query.url || req.query.channelUrl;
  const max = Math.min(100, Math.max(1, parseInt(req.query.max || req.query.maxVideos || '10', 10) || 10));
  if (!url) return res.status(400).json({ error: 'url or channelUrl required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  try {
    const parsed = parseChannelUrl(url);
    if (!parsed) {
      send({ error: 'Invalid YouTube channel URL. Use e.g. https://www.youtube.com/@handle' });
      return res.end();
    }

    let channelId;
    const base = 'https://www.googleapis.com/youtube/v3';

    if (parsed.type === 'handle') {
      const r = await fetch(
        `${base}/channels?part=id&forHandle=${encodeURIComponent(parsed.value)}&key=${YOUTUBE_API_KEY}`
      );
      const j = await r.json();
      if (!j.items?.length) {
        send({ error: `Channel not found for handle @${parsed.value}` });
        return res.end();
      }
      channelId = j.items[0].id;
    } else if (parsed.type === 'channelId') {
      channelId = parsed.value;
    } else {
      const r = await fetch(
        `${base}/search?part=snippet&type=channel&q=${encodeURIComponent(parsed.value)}&key=${YOUTUBE_API_KEY}&maxResults=1`
      );
      const j = await r.json();
      if (!j.items?.length) {
        send({ error: `Channel not found for ${parsed.value}` });
        return res.end();
      }
      channelId = j.items[0].snippet.channelId;
    }

    const channelRes = await fetch(
      `${base}/channels?part=snippet,contentDetails&id=${channelId}&key=${YOUTUBE_API_KEY}`
    );
    const channelData = await channelRes.json();
    const uploadsId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsId) {
      send({ error: 'Could not get uploads playlist' });
      return res.end();
    }

    const playlistRes = await fetch(
      `${base}/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=${max}&key=${YOUTUBE_API_KEY}`
    );
    const playlistData = await playlistRes.json();
    const videoIds = (playlistData.items || []).map((i) => i.snippet.resourceId.videoId).filter(Boolean);
    const total = videoIds.length;
    if (total === 0) {
      send({ error: 'No videos found', data: { channelId, channelTitle: channelData.items?.[0]?.snippet?.title, videos: [] } });
      return res.end();
    }

    const channelTitle = channelData.items?.[0]?.snippet?.title || 'Unknown';
    const videos = [];

    for (let i = 0; i < videoIds.length; i++) {
      send({ progress: i + 1, total });
      const vRes = await fetch(
        `${base}/videos?part=snippet,statistics,contentDetails&id=${videoIds[i]}&key=${YOUTUBE_API_KEY}`
      );
      const vData = await vRes.json();
      const v = vData.items?.[0];
      if (v) {
        const snippet = v.snippet || {};
        const stats = v.statistics || {};
        const details = v.contentDetails || {};
        videos.push({
          videoId: v.id,
          title: snippet.title || '',
          description: (snippet.description || '').slice(0, 5000),
          duration: details.duration || null,
          publishedAt: snippet.publishedAt || null,
          viewCount: parseInt(stats.viewCount, 10) || 0,
          likeCount: parseInt(stats.likeCount, 10) || 0,
          commentCount: parseInt(stats.commentCount, 10) || 0,
          thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || null,
          url: `https://www.youtube.com/watch?v=${v.id}`,
          transcript: null,
        });
      }
    }

    send({
      progress: total,
      total,
      done: true,
      data: {
        channelId,
        channelTitle,
        channelUrl: url,
        downloadedAt: new Date().toISOString(),
        videoCount: videos.length,
        videos,
      },
    });
  } catch (err) {
    send({ error: err.message || 'YouTube API error' });
  }
  res.end();
});

// ── Image generation (Gemini / Imagen) ────────────────────────────────────────

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

app.post('/api/generate-image', async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(503).json({ error: 'Gemini API key not configured' });
  }
  try {
    const { prompt, imageBase64, mimeType } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt required' });
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GEMINI_API_KEY}`;
    const parts = [{ text: prompt }];
    if (imageBase64 && mimeType) {
      parts.unshift({
        inlineData: {
          mimeType: mimeType || 'image/png',
          data: imageBase64,
        },
      });
    }
    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        responseMimeType: 'text/plain',
      },
    };
    const apiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await apiRes.json();
    if (data.error) {
      return res.status(400).json({ error: data.error.message || 'Image generation failed' });
    }
    const candidate = data.candidates?.[0];
    const content = candidate?.content?.parts;
    const imagePart = content?.find((p) => p.inlineData);
    if (!imagePart?.inlineData) {
      return res.status(400).json({ error: 'No image in response', detail: data });
    }
    res.json({
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || 'image/png',
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Image generation failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;

connect()
  .then(() => {
    app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
