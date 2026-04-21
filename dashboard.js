// admin/dashboard.js
// Dashboard Logic and Data Visualization Controller

const API_BASE = (window.__API_BASE__ |

| 'https://admin-roan-omega.vercel.app').replace(/\/+$/, '');
let lastStatsData = null;

function getStoredToken() {
  return localStorage.getItem('admin_token') |

| window.__ADMIN_TOKEN__ |
| '';
}

function saveToken() {
  const inputEl = document.getElementById('adminToken');
  if (!inputEl) return showToast('Interface missing', 'error');
  
  const tokenValue = inputEl.value.trim();
  localStorage.setItem('admin_token', tokenValue);
  window.__ADMIN_TOKEN__ = tokenValue;
  showToast('Token stored securely', 'success');
  loadStats();
}

async function fetchFromAPI(endpoint, options = {}) {
  const headers = {...(options.headers |

| {}) };
  const token = getStoredToken();
  
  if (token) headers['x-admin-token'] = token;
  if (options.body &&!headers) headers = 'application/json';
  
  const response = await fetch(API_BASE + endpoint, {...options, headers });
  if (!response.ok) throw new Error(`Server Error: HTTP ${response.status}`);
  return response;
}

function showToast(message, type = 'info') {
  const host = document.getElementById('toastHost');
  if (!host) return;
  const toastEl = document.createElement('div');
  toastEl.className = 'toastx';
  toastEl.innerHTML = `<div class="d-flex justify-content-between gap-3"><div>${message}</div><button class="btn btn-sm btn-close btn-close-white"></button></div>`;
  host.appendChild(toastEl);
  toastEl.querySelector('button').onclick = () => toastEl.remove();
  setTimeout(() => toastEl.remove(), 4000);
}

function formatTimestamp(isoString) {
  try { return new Date(isoString).toLocaleString(); } catch { return isoString |

| ''; }
}

function extractChartData(aggregationObject) {
  return { x: Object.keys(aggregationObject |

| {}), y: Object.values(aggregationObject |
| {}) };
}

function renderPlotlyChart(containerId, xData, yData, chartType, colorHex) {
  if (!document.getElementById(containerId) ||!window.Plotly) return;
  const trace = {
    x: chartType === 'pie'? undefined : xData,
    y: chartType === 'pie'? undefined : yData,
    labels: chartType === 'pie'? xData : undefined,
    values: chartType === 'pie'? yData : undefined,
    type: chartType,
    marker: { color: chartType === 'pie'? ['#5b8cff', '#7cf3c5', '#f8b84e', '#79a8ff'] : colorHex },
    textinfo: chartType === 'pie'? 'percent+label' : undefined
  };
  const layout = {
    margin: { t: 20, l: 40, r: 20, b: 40 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#eaf2ff' },
    xaxis: { gridcolor: 'rgba(255,255,255,0.1)' },
    yaxis: { gridcolor: 'rgba(255,255,255,0.1)' }
  };
  Plotly.react(containerId, [trace], layout, { responsive: true, displayModeBar: false });
}

function renderTelemetryTable() {
  if (!lastStatsData) return;
  const searchInput = (document.getElementById('searchBox')?.value |

| '').toLowerCase();
  const filterInput = document.getElementById('typeFilter')?.value |

| '';
  
  const filteredEvents = (lastStatsData.latest ||).filter(evt => {
    const searchString = `${evt.type} ${evt.page} ${evt.country} ${evt.device} ${evt.browser}`.toLowerCase();
    return (!filterInput |

| evt.type === filterInput) && (!searchInput |
| searchString.includes(searchInput));
  }).slice(0, 150);

  const tbody = document.getElementById('eventRows');
  if (!tbody) return;

  tbody.innerHTML = filteredEvents.map(evt => `
    <tr>
      <td class="text-white-50">${formatTimestamp(evt.ts)}</td>
      <td><span class="badge bg-secondary text-uppercase">${evt.type |

| 'unknown'}</span></td>
      <td>${evt.page |

| '/'}</td>
      <td>${evt.device} / ${evt.browser}</td>
      <td>${evt.country |

| 'Local'}</td>
      <td class="text-truncate" style="max-width: 150px;">${evt.file |

| evt.name |
| evt.email |
| 'N/A'}</td>
    </tr>
  `).join('') |

| `<tr><td colspan="6" class="text-center text-muted py-4">No data</td></tr>`;
}

function renderLists(containerId, dataset, itemType) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = (dataset ||).map(item => {
    if (itemType === 'lead') {
      return `<div class="list-item"><div class="item-title">${item.name} <span class="badge bg-primary">${item.email}</span></div>
              <div class="item-sub">${formatTimestamp(item.ts)} | ${item.subject}</div></div>`;
    }
    return `<div class="list-item"><div class="item-title">${item.file |

| 'Event'}</div>
            <div class="item-sub">${formatTimestamp(item.ts)}</div></div>`;
  }).join('') |

| `<div class="list-item text-muted">No entries</div>`;
}

async function loadStats() {
  if (!getStoredToken()) return;
  try {
    const response = await fetchFromAPI('/api/stats');
    const data = await response.json();
    lastStatsData = data;

   
     .forEach(id => { document.getElementById(id).textContent = data[id] |

| 0; });

    const day = extractChartData(data.byDay);
    renderPlotlyChart('chartDay', day.x, day.y, 'scatter', '#5b8cff');

    const types = extractChartData(data.byType);
    renderPlotlyChart('chartType', types.x, types.y, 'bar', '#7cf3c5');

    renderTelemetryTable();
    renderLists('leadList', data.leads, 'lead');
    renderLists('downloadList', data.downloads, 'download');
    
    showToast('Dashboard synchronized', 'success');
  } catch (error) { showToast(error.message, 'error'); }
}

async function downloadCSV() {
  if (!getStoredToken()) return showToast('Authentication required', 'error');
  const anchor = document.createElement('a');
  anchor.href = API_BASE + '/api/export.csv';
  anchor.download = 'portfolio-export.csv';
  anchor.click();
}

document.addEventListener('DOMContentLoaded', () => {
  const tokenInput = document.getElementById('adminToken');
  if (tokenInput) tokenInput.value = getStoredToken();
  document.getElementById('searchBox')?.addEventListener('input', renderTelemetryTable);
  document.getElementById('typeFilter')?.addEventListener('change', renderTelemetryTable);
  
  if (getStoredToken()) {
    loadStats();
    setInterval(loadStats, 45000); 
  }
});
