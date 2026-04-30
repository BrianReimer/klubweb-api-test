const express   = require('express');
const rateLimit = require('express-rate-limit');
const path      = require('path');
const app       = express();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'For mange requests — prøv igen om et minut.' },
});

app.use('/webhook',      limiter);
app.use('/events',       limiter);
app.use('/clear',        limiter);
app.use('/webhook-view', limiter);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.text({ limit: '1mb' }));

// In-memory store — last 100 webhook requests
const requests = [];
const MAX = 100;
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

// ── GET /events  (SSE) ─────────────────────────────────────
app.get('/events', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: 'init', requests })}\n\n`);
  clients.add(res);
  req.on('close', () => clients.delete(res));
});

// ── DELETE /clear ──────────────────────────────────────────
app.delete('/clear', (req, res) => {
  requests.length = 0;
  broadcast({ type: 'clear' });
  res.json({ ok: true });
});

// ── GET /webhook-view ──────────────────────────────────────
app.get('/webhook-view', (req, res) => {
  const host = req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const webhookUrl = `${protocol}://${host}/webhook`;
  res.send(buildUI(webhookUrl));
});

// ── Static files ───────────────────────────────────────────
app.use(express.static(path.join(__dirname)));

// ── Start ──────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// ── Webhook viewer UI ──────────────────────────────────────
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
    .header-logo { background: white; color: var(--red); font-weight: 700; font-size: .875rem; padding: .25rem .625rem; border-radius: var(--radius); letter-spacing: 2px; }
    .header-title { flex: 1; font-size: .8125rem; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; color: rgba(255,255,255,.85); }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #ccc; }
    .status-dot.live { background: #4ade80; box-shadow: 0 0 6px #4ade80; }
    .status-label { font-size: .8125rem; color: rgba(255,255,255,.7); }
    main { max-width: 860px; margin: 2rem auto; padding: 0 1.5rem 4rem; }
    .url-card { background: var(--white); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; }
    .url-label { font-size: .75rem; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; color: var(--gray); margin-bottom: .5rem; }
    .url-row { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
    .url-display { flex: 1; font-family: 'SF Mono', 'Fira Code', monospace; font-size: .9rem; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); padding: .625rem .875rem; color: var(--nav-dark); min-width: 0; overflow-x: auto; white-space: nowrap; }
    .btn { display: inline-flex; align-items: center; gap: .4rem; padding: 10px 20px; border-radius: var(--radius); font-family: inherit; font-size: .875rem; font-weight: 300; cursor: pointer; border: 2px solid transparent; transition: all 200ms ease-in-out; white-space: nowrap; }
    .btn-primary { background: var(--red); color: white; border-color: var(--red); }
    .btn-primary:hover { background: var(--red-hover); border-color: var(--red-hover); }
    .btn-danger { background: white; color: #B7090C; border-color: var(--red); font-size: .8125rem; }
    .btn-danger:hover { background: #FEF2F2; }
    .toolbar { display: flex; align-items: center; gap: .75rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .toolbar h2 { font-size: 1rem; font-weight: 600; flex: 1; }
    .count-badge { background: var(--red); color: white; border-radius: 999px; font-size: .75rem; font-weight: 600; padding: .1rem .5rem; min-width: 20px; text-align: center; }
    .empty-state { text-align: center; padding: 4rem 2rem; color: var(--gray); background: var(--white); border: 1px solid var(--border); border-radius: var(--radius); }
    .empty-state .pulse { font-size: 2rem; margin-bottom: 1rem; animation: pulse 2s ease-in-out infinite; }
    @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
    .request-card { background: var(--white); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: .75rem; overflow: hidden; animation: slideIn .2s ease; }
    @keyframes slideIn { from { opacity:0; transform: translateY(-8px); } to { opacity:1; transform: translateY(0); } }
    .request-header { display: flex; align-items: center; gap: .75rem; padding: .75rem 1rem; cursor: pointer; user-select: none; }
    .request-header:hover { background: var(--bg); }
    .method-badge { background: var(--nav-dark); color: white; padding: .2rem .5rem; border-radius: var(--radius); font-family: monospace; font-size: .75rem; font-weight: 600; }
    .method-badge.GET { background: #2563EB; }
    .method-badge.POST { background: var(--green); }
    .request-time { font-size: .8125rem; color: var(--gray); font-family: monospace; }
    .request-summary { flex: 1; font-size: .875rem; color: var(--gray-dark); }
    .chevron { font-size: .75rem; color: var(--gray); transition: transform 200ms; }
    .request-card.open .chevron { transform: rotate(180deg); }
    .request-body { display: none; padding: 0 1rem 1rem; border-top: 1px solid var(--border); }
    .request-card.open .request-body { display: block; }
    .section-label { font-size: .75rem; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; color: var(--gray); margin: .875rem 0 .375rem; }
    .code-block { background: var(--nav-dark); color: #E8E8E8; border-radius: var(--radius); padding: .875rem 1rem; font-family: 'SF Mono', 'Fira Code', monospace; font-size: .8rem; line-height: 1.6; max-height: 340px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
    .code-block::-webkit-scrollbar { width: 6px; }
    .code-block::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
    .match-events-block { margin-top: .875rem; border: 1.5px solid #C90B0E22; border-radius: var(--radius); overflow: hidden; }
    .match-events-header { background: #FFF7F7; padding: .5rem 1rem; font-size: .75rem; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; color: #C90B0E; border-bottom: 1px solid #C90B0E22; display: flex; align-items: center; gap: .5rem; }
    .match-events-body { padding: .75rem 1rem; display: flex; flex-direction: column; gap: .375rem; background: var(--white); }
    .match-event-row { display: flex; align-items: center; gap: .75rem; font-size: .875rem; padding: .375rem 0; border-bottom: 1px solid var(--border); }
    .match-event-row:last-child { border-bottom: none; }
    .match-event-min { font-size: .8125rem; font-weight: 600; color: var(--gray); width: 32px; text-align: right; flex-shrink: 0; }
    .match-event-icon { font-size: 1.1rem; flex-shrink: 0; }
    .match-event-desc { display: flex; flex-direction: column; gap: .1rem; }
    .match-event-desc strong { font-weight: 500; color: var(--black); }
    .match-event-desc span { font-size: .8125rem; color: var(--gray); }
    .match-events-note { padding: .75rem 1rem; font-size: .8125rem; color: var(--gray); font-style: italic; }
    .match-events-loading { padding: .75rem 1rem; font-size: .8125rem; color: var(--gray); }
    .auth-bar { background: var(--white); border: 1px solid var(--border); border-radius: var(--radius); padding: .875rem 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
    .auth-bar-label { font-size: .8125rem; font-weight: 600; color: var(--gray-dark); white-space: nowrap; }
    .auth-bar input { flex: 1; min-width: 140px; padding: .4rem .75rem; border: 1.5px solid var(--border); border-radius: var(--radius); font-family: inherit; font-size: .8125rem; outline: none; }
    .auth-bar input:focus { border-color: var(--red); }
    .auth-status { font-size: .8125rem; color: var(--green); font-weight: 500; }
    .auth-status.error { color: var(--red); }
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
  <div class="auth-bar" id="auth-bar">
    <span class="auth-bar-label">KlubOffice login</span>
    <input id="auth-user" type="text" placeholder="Brugernavn" autocomplete="username">
    <input id="auth-pass" type="password" placeholder="Adgangskode" autocomplete="current-password">
    <button class="btn btn-primary" style="padding:.4rem 1rem;font-size:.8125rem;" onclick="doLogin()">Log ind</button>
    <span class="auth-status" id="auth-status" hidden></span>
  </div>
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
  let apiToken = null;

  // ── Auth ───────────────────────────────────────────────────
  async function doLogin() {
    const user = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value;
    const statusEl = document.getElementById('auth-status');
    if (!user || !pass) return;
    statusEl.textContent = 'Logger ind…';
    statusEl.className = 'auth-status';
    statusEl.hidden = false;
    try {
      const res = await fetch('https://apitest.dbu.dk/v1/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'password', username: user, password: pass }),
      });
      if (!res.ok) throw new Error('Forkert brugernavn eller adgangskode');
      const data = await res.json();
      apiToken = data.access_token;
      statusEl.textContent = '✓ Logget ind';
      statusEl.className = 'auth-status';
      document.getElementById('auth-user').value = '';
      document.getElementById('auth-pass').value = '';
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = 'auth-status error';
    }
  }

  document.getElementById('auth-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });

  function setLive(on) {
    dotEl.className = 'status-dot' + (on ? ' live' : '');
    labelEl.textContent = on ? 'Live' : 'Afbrudt';
  }
  function copyUrl() {
    navigator.clipboard.writeText(document.getElementById('webhook-url').textContent).then(() => {
      const btn = event.target;
      btn.textContent = 'Kopieret!';
      setTimeout(() => btn.textContent = 'Kopier URL', 1500);
    });
  }
  function clearAll() { fetch('/clear', { method: 'DELETE' }); }
  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  function summarize(req) {
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length)
      return Object.keys(req.body).slice(0, 3).join(', ');
    if (req.query && Object.keys(req.query).length)
      return '?' + new URLSearchParams(req.query).toString().slice(0, 60);
    return 'Ingen body';
  }
  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  const EVENT_ICONS = { Goal: '⚽', YellowCard: '🟨', RedCard: '🟥', Substitution: '🔄' };

  function renderMatchEventsBlock(events) {
    if (!events.length) return '<div class="match-events-note">Ingen begivenheder fundet.</div>';
    return \`<div class="match-events-body">
      \${events.map(ev => \`
        <div class="match-event-row">
          <span class="match-event-min">\${escHtml(String(ev.Minute ?? '–'))}'</span>
          <span class="match-event-icon">\${EVENT_ICONS[ev.EventType] ?? '•'}</span>
          <span class="match-event-desc">
            <strong>\${escHtml(ev.PlayerName ?? ev.EventType ?? '–')}</strong>
            \${ev.TeamName ? \`<span>\${escHtml(ev.TeamName)}</span>\` : ''}
          </span>
        </div>
      \`).join('')}
    </div>\`;
  }

  async function fetchMatchEvents(matchId, poolId, container) {
    const token = apiToken;
    if (!token) {
      container.innerHTML = '<div class="match-events-note">Log ind ovenfor for at hente kampbegivenheder automatisk.</div>';
      return;
    }
    container.innerHTML = '<div class="match-events-loading">Henter kampbegivenheder…</div>';
    try {
      const res = await fetch(\`https://apitest.dbu.dk/v1/api/match-events/\${encodeURIComponent(matchId)}/\${encodeURIComponent(poolId)}\`, {
        headers: { Authorization: \`Bearer \${token}\` }
      });
      if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
      const data = await res.json();
      const rawJson = JSON.stringify(data, null, 2);
      const events = Array.isArray(data) ? data : [];

      let showingRaw = false;
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'btn btn-danger';
      toggleBtn.style.cssText = 'padding:.25rem .75rem;font-size:.75rem;margin:.75rem 1rem .25rem;';
      toggleBtn.textContent = 'Vis rå JSON';

      const contentDiv = document.createElement('div');
      contentDiv.innerHTML = renderMatchEventsBlock(events);

      toggleBtn.addEventListener('click', () => {
        showingRaw = !showingRaw;
        toggleBtn.textContent = showingRaw ? 'Vis pæn visning' : 'Vis rå JSON';
        contentDiv.innerHTML = showingRaw
          ? \`<div class="code-block" style="margin:.5rem 1rem 1rem;max-height:400px;">\${escHtml(rawJson)}</div>\`
          : renderMatchEventsBlock(events);
      });

      container.innerHTML = '';
      container.appendChild(toggleBtn);
      container.appendChild(contentDiv);
    } catch (err) {
      container.innerHTML = \`<div class="match-events-note">Kunne ikke hente data: \${escHtml(err.message)}</div>\`;
    }
  }

  function renderRequest(req) {
    const card = document.createElement('div');
    card.className = 'request-card';
    card.dataset.id = req.id;
    const bodyStr  = req.body ? JSON.stringify(req.body, null, 2) : '(ingen body)';
    const queryStr = req.query && Object.keys(req.query).length ? JSON.stringify(req.query, null, 2) : '(ingen)';
    const headStr  = JSON.stringify(req.headers, null, 2);

    const isMatchEvent = req.body && req.body.WebhookTypeName === 'MatchEvent';
    const matchId = req.body && (req.body.MatchId ?? req.body.matchId);
    const poolId  = req.body && (req.body.PoolId  ?? req.body.poolId);

    card.innerHTML = \`
      <div class="request-header" onclick="toggle(this)">
        <span class="method-badge \${req.method}">\${req.method}</span>
        <span class="request-time">\${formatTime(req.time)}</span>
        <span class="request-summary">\${isMatchEvent ? '⚽ MatchEvent — kamp ' + escHtml(String(matchId ?? '')) : summarize(req)}</span>
        <span class="chevron">▼</span>
      </div>
      <div class="request-body">
        \${isMatchEvent && matchId && poolId ? \`
          <div class="match-events-block">
            <div class="match-events-header">⚽ Kampbegivenheder — match-events/\${escHtml(String(matchId))}/\${escHtml(String(poolId))}</div>
            <div class="match-events-content"></div>
          </div>
        \` : ''}
        <div class="section-label">Body</div>
        <div class="code-block">\${escHtml(bodyStr)}</div>
        <div class="section-label">Query parametre</div>
        <div class="code-block">\${escHtml(queryStr)}</div>
        <div class="section-label">Headers</div>
        <div class="code-block">\${escHtml(headStr)}</div>
      </div>
    \`;

    if (isMatchEvent && matchId && poolId) {
      const container = card.querySelector('.match-events-content');
      fetchMatchEvents(matchId, poolId, container);
    }

    return card;
  }
  function toggle(header) { header.closest('.request-card').classList.toggle('open'); }
  function addRequest(req) {
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
  function connect() {
    const es = new EventSource('/events');
    es.onopen = () => setLive(true);
    es.onerror = () => { setLive(false); setTimeout(connect, 3000); };
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'init') loadInit(data.requests);
      else if (data.type === 'clear') {
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
