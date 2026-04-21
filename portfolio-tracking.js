const API_BASE = window.__API_BASE__ || 'https://admin-roan-omega.vercel.app';
const SESSION_ID = sessionStorage.getItem('portfolio_session_id') || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
sessionStorage.setItem('portfolio_session_id', SESSION_ID);

function pagePath() {
  return location.pathname + location.hash;
}

function deviceType() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
}

function browserName() {
  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('OPR/') || ua.includes('Opera')) return 'Opera';
  if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Chrome';
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Safari/') && ua.includes('Version/') && !ua.includes('Chrome/')) return 'Safari';
  return 'Other';
}

function osName() {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macOS';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'iOS';
  if (ua.includes('linux')) return 'Linux';
  return 'Other';
}

async function sendEvent(payload) {
  payload.sessionId = SESSION_ID;
  payload.page = pagePath();
  payload.referrer = document.referrer || '';
  payload.device = deviceType();
  payload.browser = browserName();
  payload.os = osName();
  payload.title = document.title || '';
  try {
    await fetch(API_BASE + '/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {}
}

async function sendLead(payload) {
  payload.sessionId = SESSION_ID;
  payload.page = pagePath();
  payload.referrer = document.referrer || '';
  payload.device = deviceType();
  payload.browser = browserName();
  payload.os = osName();
  try {
    await fetch(API_BASE + '/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {}
}

window.trackPortfolioVisit = () => sendEvent({ type: 'visit' });
window.trackPortfolioClick = (name, extra = {}) => sendEvent({ type: 'click', name, extra });
window.trackPortfolioDownload = (file) => sendEvent({ type: 'download', file });
window.trackDegreeClick = () => sendEvent({ type: 'degree_click' });
window.trackPortfolioLead = (name, email, subject, message) => sendLead({ name, email, subject, message });

document.addEventListener('DOMContentLoaded', () => {
  sendEvent({ type: 'visit' });

  document.addEventListener('click', e => {
    const el = e.target.closest('a,button');
    if (!el) return;
    const text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!text) return;
    sendEvent({ type: 'click', name: text });
  }, true);
});
