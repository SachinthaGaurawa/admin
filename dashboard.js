const API_BASE = window.__API_BASE__ || 'https://admin.sachinthagaurawa.vercel.app';

let lastStats = null;

function token() {
  return localStorage.getItem('admin_token') || window.__ADMIN_TOKEN__ || '';
}

function saveToken() {
  const v = document.getElementById('adminToken').value.trim();
  localStorage.setItem('admin_token', v);
  window.__ADMIN_TOKEN__ = v;
  toast('Admin token saved');
  loadStats();
}

async function api(path, options = {}) {
  const headers = options.headers || {};
  headers['x-admin-token'] = token();
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const res = await fetch(API_BASE + path, { ...options, headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

function toast(message, type = 'info') {
  const host = document.getElementById('toastHost');
  const el = document.createElement('div');
  el.className = 'toastx';
  el.innerHTML = `<div class="d-flex justify-content-between gap-3"><div>${message}</div><button class="btn btn-sm btn-close btn-close-white"></button></div>`;
  host.appendChild(el);
  el.querySelector('button').onclick = () => el.remove();
  setTimeout(() => el.remove(), 3500);
}

function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts || '';
  }
}

function mapToXY(obj) {
  return {
    x: Object.keys(obj || {}),
    y: Object.values(obj || {})
  };
}

function renderChart(id, x, y, type, color) {
  Plotly.newPlot(id, [{
    x, y,
    type,
    marker: { color }
  }], {
    margin: { t: 20, l: 40, r: 20, b: 40 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#eaf2ff' },
    xaxis: { gridcolor: '#20314d', automargin: true },
    yaxis: { gridcolor: '#20314d' }
  }, { responsive: true, displayModeBar: false });
}

function renderEvents() {
  if (!lastStats) return;
  const q = document.getElementById('searchBox').value.toLowerCase().trim();
  const filter = document.getElementById('typeFilter').value;
  const rows = lastStats.latest.filter(e => {
    const hay = `${e.type} ${e.page} ${e.name} ${e.file} ${e.country} ${e.device} ${e.browser} ${e.os} ${e.email} ${e.message}`.toLowerCase();
    return (!filter || e.type === filter) && (!q || hay.includes(q));
  }).slice(0, 200);

  document.getElementById('eventRows').innerHTML = rows.map(e => `
    <tr>
      <td>${fmtTime(e.ts)}</td>
      <td><span class="badge text-bg-secondary">${e.type || ''}</span></td>
      <td>${e.page || ''}</td>
      <td>${e.device || ''}</td>
      <td>${e.browser || ''}</td>
      <td>${e.country || ''}</td>
      <td>${e.file || e.name || e.email || e.message || ''}</td>
    </tr>
  `).join('') || `<tr><td colspan="7" class="text-center text-white-50 py-4">No events found</td></tr>`;
}

function renderList(elId, items, kind) {
  const el = document.getElementById(elId);
  el.innerHTML = items.map(e => {
    if (kind === 'lead') {
      return `<div class="list-item"><div class="item-title">${e.name || 'Anonymous'} <span class="badge text-bg-info ms-2">${e.email || 'no email'}</span></div><div class="item-sub">${fmtTime(e.ts)} • ${e.page || ''} • ${e.subject || ''}</div><div class="item-sub">${(e.message || '').slice(0, 120)}</div></div>`;
    }
    if (kind === 'download') {
      return `<div class="list-item"><div class="item-title">${e.file || 'Document'}</div><div class="item-sub">${fmtTime(e.ts)} • ${e.page || ''}</div></div>`;
    }
    if (kind === 'degree') {
      return `<div class="list-item"><div class="item-title">Degree verification clicked</div><div class="item-sub">${fmtTime(e.ts)} • ${e.page || ''}</div></div>`;
    }
    return `<div class="list-item"><div class="item-title">${e.type || 'Event'}</div><div class="item-sub">${fmtTime(e.ts)} • ${e.page || ''}</div></div>`;
  }).join('') || `<div class="list-item text-white-50">No data</div>`;
}

async function loadStats() {
  try {
    const res = await api('/api/stats');
    const d = await res.json();
    lastStats = d;

    document.getElementById('totalEvents').textContent = d.totalEvents || 0;
    document.getElementById('uniqueVisitors').textContent = d.uniqueVisitors || 0;
    document.getElementById('sessions').textContent = d.sessions || 0;
    document.getElementById('totalLeads').textContent = d.totalLeads || 0;
    document.getElementById('totalDownloads').textContent = d.totalDownloads || 0;
    document.getElementById('totalDegreeClicks').textContent = d.totalDegreeClicks || 0;

    const day = mapToXY(d.byDay);
    renderChart('chartDay', day.x, day.y, 'scatter', '#5b8cff');

    const types = mapToXY(d.byType);
    renderChart('chartType', types.x, types.y, 'bar', '#7cf3c5');

    const pages = (d.topPages || []).slice(0, 8);
    renderChart('chartPages', pages.map(x => x[0]), pages.map(x => x[1]), 'bar', '#f8b84e');

    const countries = (d.topCountries || []).slice(0, 8);
    renderChart('chartCountries', countries.map(x => x[0]), countries.map(x => x[1]), 'pie', '#79a8ff');

    const browsers = (d.topBrowsers || []).slice(0, 8);
    renderChart('chartBrowsers', browsers.map(x => x[0]), browsers.map(x => x[1]), 'bar', '#9e7cff');

    const devices = mapToXY(d.byDevice);
    renderChart('chartDevices', devices.x, devices.y, 'bar', '#ff8aa1');

    renderEvents();
    renderList('leadList', d.leads || [], 'lead');
    renderList('downloadList', d.downloads || [], 'download');
    renderList('degreeList', d.degreeClicks || [], 'degree');
    toast('Stats updated', 'success');
  } catch (e) {
    toast('Failed to load stats. Check token and backend.', 'error');
    console.error(e);
  }
}

function downloadCSV() {
  const t = token();
  if (!t) return toast('Add admin token first', 'error');
  const a = document.createElement('a');
  a.href = API_BASE + '/api/export.csv';
  a.setAttribute('download', 'portfolio-analytics.csv');
  a.click();
}

document.getElementById('searchBox').addEventListener('input', renderEvents);
document.getElementById('typeFilter').addEventListener('change', renderEvents);

loadStats();
setInterval(loadStats, 30000);
