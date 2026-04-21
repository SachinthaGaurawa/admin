// backend/server.js
// Stateless Serverless Express Backend with MongoDB Atlas

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const mongoose = require('mongoose');

// Environmental Context
const PORT = process.env.PORT |

| 8787;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN |

| '8f7c2a91b4d6e3f0c5a8b1d9e4f2c7a6KQmR';
const MONGODB_URI = process.env.MONGODB_URI;

// Security and Origin Whitelisting
const ALLOWED_ORIGINS = [
  'https://sachinthagaurawa.github.io',
  'https://sachinthagaurawa.github.io/admin',
  'http://localhost:5500',
  'http://localhost:8787'
];

// ---------------------------------------------------------
// Global Connection Cache for MongoDB (Singleton Pattern)
// Prevents connection pool exhaustion in Serverless 
// ---------------------------------------------------------
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    const opts = { maxPoolSize: 5, serverSelectionTimeoutMS: 5000 };
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => mongoose);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

// ---------------------------------------------------------
// Mongoose Schema Design
// ---------------------------------------------------------
const EventSchema = new mongoose.Schema({
  ts: { type: Date, default: Date.now },
  ipHash: { type: String, required: true },
  country: { type: String, default: 'Unknown' },
  device: { type: String, default: 'Desktop' },
  browser: { type: String, default: 'Other' },
  os: { type: String, default: 'Other' },
  referrer: { type: String, default: '' },
  page: { type: String, default: '/' },
  sessionId: { type: String, required: true },
  type: { type: String, required: true, index: true },
  name: { type: String, default: '' },
  file: { type: String, default: '' },
  email: { type: String, default: '' },
  subject: { type: String, default: '' },
  message: { type: String, default: '' }
});

const TelemetryEvent = mongoose.models.Event |

| mongoose.model('Event', EventSchema);

// ---------------------------------------------------------
// Application Middleware
// ---------------------------------------------------------
const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin |

| ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('CORS execution blocked by origin policy.'));
  },
  credentials: false
}));

// In-Memory Rate Limiting 
const eventLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
const adminLimiter = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });

// ---------------------------------------------------------
// Security & Context Handlers
// ---------------------------------------------------------
function hashIP(req) {
  const ip = req.headers['x-forwarded-for'] |

| req.socket.remoteAddress |
| '127.0.0.1';
  return crypto.createHash('sha256').update(String(ip).split(',').trim()).digest('hex').slice(0, 12);
}

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token |

| token!== ADMIN_TOKEN) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  next();
}

// ---------------------------------------------------------
// API Endpoints
// ---------------------------------------------------------
app.post('/api/event', eventLimiter, async (req, res) => {
  try {
    await connectToDatabase();
    
    // Extract Edge Network Headers for Geolocation 
    const country = req.headers['x-vercel-ip-country'] |

| 'Unknown';
    
    const doc = new TelemetryEvent({
      ipHash: hashIP(req),
      country: country,
      device: req.body.device,
      browser: req.body.browser,
      os: req.body.os,
      referrer: req.body.referrer,
      page: req.body.page,
      sessionId: req.body.sessionId |

| crypto.randomUUID(),
      type: req.body.type |

| 'event',
      name: req.body.name,
      file: req.body.file
    });

    await doc.save();
    res.status(201).json({ ok: true, id: doc._id });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Ingestion fault' });
  }
});

app.post('/api/lead', eventLimiter, async (req, res) => {
  try {
    await connectToDatabase();
    const country = req.headers['x-vercel-ip-country'] |

| 'Unknown';
    
    const doc = new TelemetryEvent({
      ipHash: hashIP(req),
      country: country,
      device: req.body.device,
      browser: req.body.browser,
      os: req.body.os,
      type: 'lead',
      name: req.body.name,
      email: req.body.email,
      subject: req.body.subject,
      message: req.body.message,
      page: req.body.page,
      sessionId: req.body.sessionId |

| crypto.randomUUID()
    });

    await doc.save();
    res.status(201).json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Lead capture fault' });
  }
});

app.get('/api/stats', adminLimiter, adminAuth, async (req, res) => {
  try {
    await connectToDatabase();
    const events = await TelemetryEvent.find().sort({ ts: 1 }).lean();

    const stats = { byType: {}, byDay: {}, byPage: {}, byCountry: {}, byDevice: {}, byBrowser: {} };
    const lists = { downloads:, leads:, degreeClicks: };
    const sets = { sessions: new Set(), visitors: new Set() };

    events.forEach(e => {
      stats.byType[e.type] = (stats.byType[e.type] |

| 0) + 1;
      const day = new Date(e.ts).toISOString().slice(0, 10);
      stats.byDay[day] = (stats.byDay[day] |

| 0) + 1;
      
      if (e.page) stats.byPage[e.page] = (stats.byPage[e.page] |

| 0) + 1;
      if (e.country && e.country!== 'Unknown') stats.byCountry[e.country] = (stats.byCountry[e.country] |

| 0) + 1;
      if (e.device) stats.byDevice[e.device] = (stats.byDevice[e.device] |

| 0) + 1;
      if (e.browser) stats.byBrowser[e.browser] = (stats.byBrowser[e.browser] |

| 0) + 1;
      
      if (e.sessionId) sets.sessions.add(e.sessionId);
      if (e.ipHash) sets.visitors.add(e.ipHash);
      
      if (e.type === 'download') lists.downloads.push(e);
      if (e.type === 'lead') lists.leads.push(e);
      if (e.type === 'degree_click') lists.degreeClicks.push(e);
    });

    const sortObj = (obj) => Object.entries(obj).sort((a, b) => b - a).slice(0, 8);

    res.json({
      totalEvents: events.length,
      uniqueVisitors: sets.visitors.size,
      sessions: sets.sessions.size,
      totalLeads: lists.leads.length,
      totalDownloads: lists.downloads.length,
      totalDegreeClicks: lists.degreeClicks.length,
      byType: stats.byType,
      byDay: stats.byDay,
      byDevice: stats.byDevice,
      topPages: sortObj(stats.byPage),
      topCountries: sortObj(stats.byCountry),
      topBrowsers: sortObj(stats.byBrowser),
      latest: events.slice(-150).reverse(),
      leads: lists.leads.slice(-50).reverse(),
      downloads: lists.downloads.slice(-50).reverse()
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Aggregation fault' });
  }
});

app.get('/api/export.csv', adminLimiter, adminAuth, async (req, res) => {
  try {
    await connectToDatabase();
    const events = await TelemetryEvent.find().sort({ ts: -1 }).lean();
    
    const rows =];
    events.forEach(e => {
      rows.push();
    });
    
    const csvData = rows.map(r => r.map(v => `"${String(v |

| '').replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="export.csv"');
    res.send(csvData);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'CSV serialization fault' });
  }
});

module.exports = app;
