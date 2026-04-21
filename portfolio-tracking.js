// public/js/portfolio-tracking.js
// Client-Side Telemetry Interface

const API_BASE = window.__API_BASE__ |

| 'https://admin-roan-omega.vercel.app';

// Manage Session State
const SESSION_ID = sessionStorage.getItem('portfolio_session_id') |

| 
  (window.crypto && crypto.randomUUID? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substring(2)}`);
sessionStorage.setItem('portfolio_session_id', SESSION_ID);

// Context Extraction Helpers
const getPagePath = () => window.location.pathname + window.location.hash;

const getDeviceType = () => {
  const ua = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'Tablet';
  if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile/.test(ua)) return 'Mobile';
  return 'Desktop';
};

const getBrowserName = () => {
  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('OPR/') |

| ua.includes('Opera')) return 'Opera';
  if (ua.includes('Chrome/') &&!ua.includes('Edg/')) return 'Chrome';
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Safari/') && ua.includes('Version/')) return 'Safari';
  return 'Other';
};

const getOSName = () => {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('mac os') |

| ua.includes('macintosh')) return 'macOS';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('iphone') |

| ua.includes('ipad') |
| ua.includes('ios')) return 'iOS';
  if (ua.includes('linux')) return 'Linux';
  return 'Other';
};

// Core Network Dispatcher
async function sendTelemetryEvent(payload) {
  const enrichedPayload = {
   ...payload,
    sessionId: SESSION_ID,
    page: getPagePath(),
    referrer: document.referrer |

| '',
    device: getDeviceType(),
    browser: getBrowserName(),
    os: getOSName(),
    title: document.title |

| ''
  };

  try {
    await fetch(`${API_BASE}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enrichedPayload),
      keepalive: true // Crucial for capturing exit-clicks
    });
  } catch (error) {
    console.warn('Telemetry transmission aborted:', error);
  }
}

// Dedicated Lead Transmission
async function sendLeadData(payload) {
  const enrichedPayload = {
   ...payload,
    sessionId: SESSION_ID,
    page: getPagePath(),
    referrer: document.referrer |

| '',
    device: getDeviceType(),
    browser: getBrowserName(),
    os: getOSName()
  };

  try {
    const response = await fetch(`${API_BASE}/api/lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enrichedPayload)
    });
    return response.ok;
  } catch (error) {
    console.error('Lead insertion failed:', error);
    return false;
  }
}

// Public API Bindings
window.trackPortfolioVisit = () => sendTelemetryEvent({ type: 'visit' });
window.trackPortfolioClick = (name, extra = {}) => sendTelemetryEvent({ type: 'click', name, extra });
window.trackPortfolioDownload = (file) => sendTelemetryEvent({ type: 'download', file });
window.trackDegreeClick = () => sendTelemetryEvent({ type: 'degree_click' });
window.trackPortfolioLead = async (name, email, subject, message) => {
  return await sendLeadData({ name, email, subject, message });
};

// Global Bootstrapping
document.addEventListener('DOMContentLoaded', () => {
  sendTelemetryEvent({ type: 'visit' });

  // Passive event delegation for interactive elements
  document.addEventListener('click', (event) => {
    const targetElement = event.target.closest('a, button');
    if (!targetElement) return;
    
    const elementText = (targetElement.innerText |

| targetElement.getAttribute('aria-label') |
| '')
     .trim().replace(/\s+/g, ' ').slice(0, 80);
      
    if (elementText) sendTelemetryEvent({ type: 'click', name: elementText });
  }, { capture: true, passive: true });
});
