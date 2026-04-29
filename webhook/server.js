const express = require('express');
const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.text({ limit: '1mb' }));

// In-memory store — last 100 requests
const requests = [];
const MAX = 100;

// SSE clients
const clients = new Set();

function broadcast(event) {
  const msg = `data: ${JSON.stringify(event)}\n\n`;
  clients.forEach(res => res.write(msg));
}

// ── POST /webhook ──────────────────────────────────────────
app.post('/webhook', (req, res) => {
  const event = {
    id:      Date.now(),
    time:    new Date().toISOString(),
    method:  req.method,
    headers: req.headers,
    query:   req.query,
    body:    req.body,
  };
  requests.unshift(event);
  if (requests.length > MAX) requests.pop();
  broadcast(event);
  res.status(200).json({ ok: true });
});

// Also accept GET for easy browser testing
app.get('/webhook', (req, res) => {
  const event = {
    id:      Date.now(),
    time:    new Date().toISOString(),
    method:  req.method,
    headers: req.headers,
    query:   req.query,
    body:    null,
  };
  requests.unshift(event);
  if (requests.length > MAX) requests.pop();
  broadcast(event);
  res.status(200).json({ ok: true });
});

// ── GET /events  (SSE) ─────────────────────────────────────
app.get('/events', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send existing requests on connect
  res.write(`data: ${JSON.stringify({ type: 'init', requests })}\n\n`);

  clients.add(res);
  req.on('close', () => clients.delete(res));
});

// ── GET /history  (JSON) ───────────────────────────────────
app.get('/history', (req, res) => {
  res.json(requests);
});

// ── DELETE /clear ──────────────────────────────────────────
app.delete('/clear', (req, res) => {
  requests.length = 0;
  broadcast({ type: 'clear' });
  res.json({ ok: true });
});

// ── GET /  (UI) ────────────────────────────────────────────
app.get('/', (req, res) => {
  const host = req.headers.host;
  const webhookUrl = `${req.protocol}://${host}/webhook`;
  res.send(buildUI(webhookUrl));
});

// ── Start ──────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Webhook receiver running on port ${PORT}`));

// ── UI ─────────────────────────────────────────────────────
function buildUI(webhookUrl) {
  return `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DBU Webhook Modtager</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --red: #C90B0E; --red-hover: #FD0000; --black: #000; --nav-dark: #1D1D1D;
      --gray-dark: #676767; --gray: #888; --bg: #F1F1F1; --white: #fff;
      --border: #E2E2E2; --green: #3BA81E; --radius: 5px;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Space Grotesk', system-ui, sans-serif; background: var(--bg); color: var(--black); font-weight: 300; line-height: 1.4; }

    header {
      background: var(--red); color: white; padding: 0 1.5rem; height: 56px;
      display: flex; align-items: center; gap: 1rem;
      position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,.2);
    }
    .header-logo {
      background: white; color: var(--red); font-weight: 700; font-size: .875rem;
      padding: .25rem .625rem; border-radius: var(--radius); letter-spacing: 2px;
    }
    .header-title { flex: 1; font-size: .8125rem; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; color: rgba(255,255,255,.85); }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #ccc; }
    .status-dot.live { background: #4ade80; box-shadow: 0 0 6px #4ade80; }
    .status-label { font-size: .8125rem; color: rgba(255,255,255,.7); }

    main { max-width: 860px; margin: 2rem auto; padding: 0 1.5rem 4rem; }

    .url-card {
      background: var(--white); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;
    }
    .url-label { font-size: .75rem; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; color: var(--gray); margin-bottom: .5rem; }
    .url-row { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
    .url-display {
      flex: 1; font-family: 'SF Mono', 'Fira Code', monospace; font-size: .9rem;
      background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius);
      padding: .625rem .875rem; color: var(--nav-dark); min-width: 0; overflow-x: auto; white-space: nowrap;
    }
    .btn {
      display: inline-flex; align-items: center; gap: .4rem; padding: 10px 20px;
      border-radius: var(--radius); font-family: inherit; font-size: .875rem; font-weight: 300;
      cursor: pointer; border: 2px solid transparent; transition: all 200ms ease-in-out; white-space: nowrap;
    }
    .btn-primary { background: var(--red); color: white; border-color: var(--red); }
    .btn-primary:hover { background: var(--red-hover); border-color: var(--red-hover); }
    .btn-secondary { background: #E6E6E6; color: #666; border-color: #CECECE; font-size: .8125rem; }
    .btn-secondary:hover { background: #ACACAC; }
    .btn-danger { background: white; color: #B7090C; border-color: var(--red); font-size: .8125rem; }
    .btn-danger:hover { background: #FEF2F2; }

    .toolbar { display: flex; align-items: center; gap: .75rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .toolbar h2 { font-size: 1rem; font-weight: 600; flex: 1; }
    .count-badge {
      background: var(--red); color: white; border-radius: 999px;
      font-size: .75rem; font-weight: 600; padding: .1rem .5rem; min-width: 20px; text-align: center;
    }

    .empty-state {
      text-align: center; padding: 4rem 2rem; color: var(--gray);
      background: var(--white); border: 1px solid var(--border); border-radius: var(--radius);
    }
    .empty-state .pulse { font-size: 2rem; margin-bottom: 1rem; animation: pulse 2s ease-in-out infinite; }
    @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }

    .request-card {
      background: var(--white); border: 1px solid var(--border); border-radius: var(--radius);
      margin-bottom: .75rem; overflow: hidden;
      animation: slideIn .2s ease;
    }
    @keyframes slideIn { from { opacity:0; transform: translateY(-8px); } to { opacity:1; transform: translateY(0); } }

    .request-header {
      display: flex; align-items: center; gap: .75rem; padding: .75rem 1rem;
      cursor: pointer; user-select: none;
    }
    .request-header:hover { background: var(--bg); }
    .method-badge {
      background: var(--nav-dark); color: white; padding: .2rem .5rem;
      border-radius: var(--radius); font-family: monospace; font-size: .75rem; font-weight: 600;
    }
    .method-badge.GET { background: #2563EB; }
    .method-badge.POST { background: var(--green); }
    .request-time { font-size: .8125rem; color: var(--gray); font-family: monospace; }
    .request-summary { flex: 1; font-size: .875rem; color: var(--gray-dark); }
    .chevron { font-size: .75rem; color: var(--gray); transition: transform 200ms; }
    .request-card.open .chevron { transform: rotate(180deg); }

    .request-body { display: none; padding: 0 1rem 1rem; border-top: 1px solid var(--border); }
    .request-card.open .request-body { display: block; }

    .section-label {
      font-size: .75rem; font-weight: 600; text-transform: uppercase; letter-spacing: .5px;
      color: var(--gray); margin: .875rem 0 .375rem;
    }
    .code-block {
      background: var(--nav-dark); color: #E8E8E8; border-radius: var(--radius); padding: .875rem 1rem;
      font-family: 'SF Mono', 'Fira Code', monospace; font-size: .8rem; line-height: 1.6;
      max-height: 340px; overflow-y: auto; white-space: pre-wrap; word-break: break-all;
    }
    .code-block::-webkit-scrollbar { width: 6px; }
    .code-block::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
  </style>
</head>
<body>

<header>
  <span class="header-logo">DBU</span>
  <span class="header-title">Webhook Modtager</span>
  <span class="status-dot" id="status-dot"></span>
  <span class="status-label" id="status-label">Forbinder…</span>
</header>

<main>
  <div class="url-card">
    <div class="url-label">Din Webhook URL</div>
    <div class="url-row">
      <div class="url-display" id="webhook-url">${webhookUrl}</div>
      <button class="btn btn-primary" onclick="copyUrl()">Kopier URL</button>
    </div>
  </div>

  <div class="toolbar">
    <h2>Indkommende requests <span class="count-badge" id="count">0</span></h2>
    <button class="btn btn-danger" onclick="clearAll()">Ryd alt</button>
  </div>

  <div id="list">
    <div class="empty-state">
      <div class="pulse">📡</div>
      <p>Venter på indkommende webhooks…</p>
      <p style="margin-top:.5rem;font-size:.8125rem;">Send en POST til URL'en ovenfor</p>
    </div>
  </div>
</main>

<script>
  const listEl  = document.getElementById('list');
  const countEl = document.getElementById('count');
  const dotEl   = document.getElementById('status-dot');
  const labelEl = document.getElementById('status-label');
  let total = 0;

  function setLive(on) {
    dotEl.className  = 'status-dot' + (on ? ' live' : '');
    labelEl.textContent = on ? 'Live' : 'Afbrudt';
  }

  function copyUrl() {
    navigator.clipboard.writeText(document.getElementById('webhook-url').textContent).then(() => {
      const btn = event.target;
      btn.textContent = 'Kopieret!';
      setTimeout(() => btn.textContent = 'Kopier URL', 1500);
    });
  }

  function clearAll() {
    fetch('/clear', { method: 'DELETE' });
  }

  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function summarize(req) {
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length) {
      return Object.keys(req.body).slice(0, 3).join(', ');
    }
    if (req.query && Object.keys(req.query).length) {
      return '?' + new URLSearchParams(req.query).toString().slice(0, 60);
    }
    return 'Ingen body';
  }

  function renderRequest(req) {
    const card = document.createElement('div');
    card.className = 'request-card';
    card.dataset.id = req.id;

    const bodyStr  = req.body   ? JSON.stringify(req.body,    null, 2) : '(ingen body)';
    const queryStr = req.query && Object.keys(req.query).length ? JSON.stringify(req.query, null, 2) : '(ingen)';
    const headStr  = JSON.stringify(req.headers, null, 2);

    card.innerHTML = \`
      <div class="request-header" onclick="toggle(this)">
        <span class="method-badge \${req.method}">\${req.method}</span>
        <span class="request-time">\${formatTime(req.time)}</span>
        <span class="request-summary">\${summarize(req)}</span>
        <span class="chevron">▼</span>
      </div>
      <div class="request-body">
        <div class="section-label">Body</div>
        <div class="code-block">\${escHtml(bodyStr)}</div>
        <div class="section-label">Query parametre</div>
        <div class="code-block">\${escHtml(queryStr)}</div>
        <div class="section-label">Headers</div>
        <div class="code-block">\${escHtml(headStr)}</div>
      </div>
    \`;
    return card;
  }

  function toggle(header) {
    header.closest('.request-card').classList.toggle('open');
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function addRequest(req) {
    // Remove empty state
    const empty = listEl.querySelector('.empty-state');
    if (empty) empty.remove();
    listEl.prepend(renderRequest(req));
    total++;
    countEl.textContent = total;
  }

  function loadInit(reqs) {
    total = reqs.length;
    countEl.textContent = total;
    if (!reqs.length) return;
    listEl.innerHTML = '';
    reqs.forEach(r => listEl.appendChild(renderRequest(r)));
  }

  // SSE
  function connect() {
    const es = new EventSource('/events');
    es.onopen = () => setLive(true);
    es.onerror = () => { setLive(false); setTimeout(connect, 3000); };
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'init') {
        loadInit(data.requests);
      } else if (data.type === 'clear') {
        listEl.innerHTML = '<div class="empty-state"><div class="pulse">📡</div><p>Venter på indkommende webhooks…</p></div>';
        total = 0; countEl.textContent = 0;
      } else {
        addRequest(data);
      }
    };
  }

  connect();
</script>
</body>
</html>`;
}
