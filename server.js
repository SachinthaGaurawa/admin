const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();

const PORT = process.env.PORT || 8787;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'change-this-admin-token';
const ALLOWED_ORIGINS = [
  'https://sachinthagaurawa.github.io',
  'https://sachinthagaurawa.github.io/admin',
  'https://sachinthagaurawa.github.io/admin/',
  'https://sachinthagaurawa.github.io/admin/index',
  'https://sachinthagaurawa.github.io/admin/index.html',
  'https://admin.sachinthagaurawa.github.io',
  'http://localhost:5500',
  'http://localhost:8787'
];

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'events.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ events: [] }, null, 2));

function loadDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function uid() {
  return crypto.randomBytes(16).toString('hex');
}

function getIp(req) {
  return (
    req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.socket.remoteAddress ||
    ''
  ).toString().split(',')[0].trim();
}

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || token !== ADMIN_TOKEN) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  next();
}

function corsOptions(req, callback) {
  const origin = req.header('Origin');
  if (!origin) return callback(null, { origin: true });
  if (ALLOWED_ORIGINS.includes(origin)) return callback(null, { origin: true, credentials: false });
  return callback(null, { origin: false });
}

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors(corsOptions));
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true }));

const eventLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false
});

function parseDevice(ua) {
  const s = (ua || '').toLowerCase();
  if (/mobile|android|iphone|ipad|ipod/.test(s)) return 'mobile';
  if (/tablet/.test(s)) return 'tablet';
  return 'desktop';
}

function parseBrowser(ua) {
  const s = ua || '';
  if (s.includes('Edg/')) return 'Edge';
  if (s.includes('OPR/') || s.includes('Opera')) return 'Opera';
  if (s.includes('Chrome/') && !s.includes('Edg/')) return 'Chrome';
  if (s.includes('Firefox/')) return 'Firefox';
  if (s.includes('Safari/') && s.includes('Version/') && !s.includes('Chrome/')) return 'Safari';
  return 'Other';
}

function parseOS(ua) {
  const s = (ua || '').toLowerCase();
  if (s.includes('windows')) return 'Windows';
  if (s.includes('mac os') || s.includes('macintosh')) return 'macOS';
  if (s.includes('android')) return 'Android';
  if (s.includes('iphone') || s.includes('ipad') || s.includes('ios')) return 'iOS';
  if (s.includes('linux')) return 'Linux';
  return 'Other';
}

function isPrivateIp(ip) {
  return !ip || ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('::1') || ip.startsWith('172.16.');
}

function anonCountryFromIp(ip) {
  if (isPrivateIp(ip)) return 'Local';
  return 'Unknown';
}

app.post('/api/event', eventLimiter, (req, res) => {
  const db = loadDB();
  const ua = req.headers['user-agent'] || '';
  const ip = getIp(req);
  const body = req.body || {};

  const event = {
    id: uid(),
    ts: new Date().toISOString(),
    ipHash: crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 12),
    country: body.country || anonCountryFromIp(ip),
    device: body.device || parseDevice(ua),
    browser: body.browser || parseBrowser(ua),
    os: body.os || parseOS(ua),
    referrer: body.referrer || '',
    page: body.page || '',
    sessionId: body.sessionId || '',
    type: body.type || 'event',
    name: body.name || '',
    file: body.file || '',
    title: body.title || '',
    email: body.email || '',
    message: body.message || '',
    extra: body.extra || {}
  };

  db.events.push(event);
  if (db.events.length > 100000) db.events = db.events.slice(-100000);
  saveDB(db);

  res.json({ ok: true, id: event.id });
});

app.post('/api/lead', eventLimiter, (req, res) => {
  const db = loadDB();
  const ua = req.headers['user-agent'] || '';
  const ip = getIp(req);
  const body = req.body || {};

  const lead = {
    id: uid(),
    ts: new Date().toISOString(),
    ipHash: crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 12),
    country: anonCountryFromIp(ip),
    device: parseDevice(ua),
    browser: parseBrowser(ua),
    os: parseOS(ua),
    type: 'lead',
    name: body.name || '',
    email: body.email || '',
    subject: body.subject || '',
    message: body.message || '',
    page: body.page || '',
    sessionId: body.sessionId || ''
  };

  db.events.push(lead);
  saveDB(db);
  res.json({ ok: true, id: lead.id });
});

app.get('/api/stats', adminLimiter, adminAuth, (req, res) => {
  const db = loadDB();
  const events = db.events;

  const byType = {};
  const byDay = {};
  const byPage = {};
  const byReferrer = {};
  const byCountry = {};
  const byDevice = {};
  const byBrowser = {};
  const byOS = {};
  const downloads = [];
  const leads = [];
  const degreeClicks = [];
  const sessions = new Map();
  const visitors = new Set();

  for (const e of events) {
    byType[e.type] = (byType[e.type] || 0) + 1;
    const day = (e.ts || '').slice(0, 10);
    if (day) byDay[day] = (byDay[day] || 0) + 1;
    if (e.page) byPage[e.page] = (byPage[e.page] || 0) + 1;
    if (e.referrer) byReferrer[e.referrer] = (byReferrer[e.referrer] || 0) + 1;
    if (e.country) byCountry[e.country] = (byCountry[e.country] || 0) + 1;
    if (e.device) byDevice[e.device] = (byDevice[e.device] || 0) + 1;
    if (e.browser) byBrowser[e.browser] = (byBrowser[e.browser] || 0) + 1;
    if (e.os) byOS[e.os] = (byOS[e.os] || 0) + 1;
    if (e.sessionId) sessions.set(e.sessionId, (sessions.get(e.sessionId) || 0) + 1);
    if (e.ipHash) visitors.add(e.ipHash);
    if (e.type === 'download') downloads.push(e);
    if (e.type === 'lead') leads.push(e);
    if (e.type === 'degree_click') degreeClicks.push(e);
  }

  const latest = events.slice(-200).reverse();

  const topPages = Object.entries(byPage).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topReferrers = Object.entries(byReferrer).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topCountries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topBrowsers = Object.entries(byBrowser).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topOS = Object.entries(byOS).sort((a, b) => b[1] - a[1]).slice(0, 10);

  res.json({
    totalEvents: events.length,
    uniqueVisitors: visitors.size,
    sessions: sessions.size,
    totalLeads: leads.length,
    totalDownloads: downloads.length,
    totalDegreeClicks: degreeClicks.length,
    byType,
    byDay,
    byPage,
    byReferrer,
    byCountry,
    byDevice,
    byBrowser,
    byOS,
    topPages,
    topReferrers,
    topCountries,
    topBrowsers,
    topOS,
    latest,
    leads: leads.slice(-100).reverse(),
    downloads: downloads.slice(-100).reverse(),
    degreeClicks: degreeClicks.slice(-100).reverse()
  });
});

app.get('/api/export.csv', adminLimiter, adminAuth, (req, res) => {
  const db = loadDB();
  const rows = [
    ['ts','type','page','name','file','country','device','browser','os','referrer','sessionId','email','message']
  ];
  for (const e of db.events) {
    rows.push([
      e.ts || '',
      e.type || '',
      e.page || '',
      e.name || '',
      e.file || '',
      e.country || '',
      e.device || '',
      e.browser || '',
      e.os || '',
      e.referrer || '',
      e.sessionId || '',
      e.email || '',
      e.message || ''
    ]);
  }
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="portfolio-analytics.csv"');
  res.send(csv);
});

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.listen(PORT, () => console.log(`API running on ${PORT}`));
