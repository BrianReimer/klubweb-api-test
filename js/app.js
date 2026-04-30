import { login, logout, isLoggedIn, callEndpoint } from './api.js';
import { GROUPS, ENDPOINTS, getEndpointsByGroup } from './endpoints.js';

// ── State ──────────────────────────────────────────────────
let activeGroup    = GROUPS[0];
let activeEndpoint = getEndpointsByGroup(GROUPS[0])[0];
let activeSection  = 'api';

// Cache for responses so navigating back restores the result
const responseCache = new Map(); // endpointId+JSON(params) → { data, rawJson }

// ── DOM refs ───────────────────────────────────────────────
const screenLogin    = document.getElementById('screen-login');
const screenExplorer = document.getElementById('screen-explorer');
const loginForm      = document.getElementById('login-form');
const loginError     = document.getElementById('login-error');
const btnLogin       = document.getElementById('btn-login');
const btnLogout      = document.getElementById('btn-logout');
const navEl          = document.getElementById('endpoint-nav');
const subnavEl       = document.getElementById('endpoint-subnav');
const mainEl         = document.getElementById('main-content');
const tabApi         = document.getElementById('tab-api');
const tabWidgets     = document.getElementById('tab-widgets');
const widgetsPanel   = document.getElementById('widgets-panel');

// ── Section switching ──────────────────────────────────────
function switchSection(section) {
  activeSection = section;
  tabApi.classList.toggle('active', section === 'api');
  tabWidgets.classList.toggle('active', section === 'widgets');
  navEl.hidden        = section !== 'api';
  subnavEl.hidden     = section !== 'api';
  mainEl.hidden       = section !== 'api';
  widgetsPanel.hidden = section !== 'widgets';
}

tabApi.addEventListener('click', () => switchSection('api'));
tabWidgets.addEventListener('click', () => switchSection('widgets'));

document.getElementById('btn-run-widget').addEventListener('click', () => {
  const code = document.getElementById('widget-code').value.trim();
  const html = `<!DOCTYPE html><html lang="da"><head><meta charset="UTF-8">
<style>body{font-family:'Space Grotesk',system-ui,sans-serif;padding:1.5rem;background:#fff;color:#000;}*{box-sizing:border-box;}</style>
</head><body><div id="output"></div>
<script>(function(){try{${code}}catch(e){document.body.innerHTML='<pre style="color:#E3140D;padding:1rem;background:#FEECEC;border-radius:4px">'+e.name+': '+e.message+'</pre>';}})();<\/script></body></html>`;
  document.getElementById('widget-frame').srcdoc = html;
});

// ── Screen helpers ─────────────────────────────────────────
function showExplorer() {
  screenLogin.hidden    = true;
  screenExplorer.hidden = false;
  switchSection('api');
  renderNav();
  renderSubnav();
  // Auto-fetch holdliste on first open (no required params)
  const cached = responseCache.get(cacheKey('club-teams', {}));
  if (cached) {
    renderPanel({}, cached);
  } else {
    renderPanel();
    setTimeout(() => doFetch(activeEndpoint, {}), 50);
  }
}

function showLogin(errorMsg) {
  screenExplorer.hidden = true;
  screenLogin.hidden    = false;
  if (errorMsg) showLoginError(errorMsg);
}

function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.hidden = false;
}

function hideLoginError() {
  loginError.hidden = true;
  loginError.textContent = '';
}

// ── Cache key ──────────────────────────────────────────────
function cacheKey(endpointId, params) {
  return endpointId + '|' + JSON.stringify(params);
}

// ── Navigate to endpoint with pre-filled params ────────────
export function navigateTo(endpointId, params = {}) {
  const ep = ENDPOINTS.find(e => e.id === endpointId);
  if (!ep) return;
  activeGroup    = ep.group;
  activeEndpoint = ep;
  renderNav();
  renderSubnav();

  const cached = responseCache.get(cacheKey(endpointId, params));
  if (cached) {
    renderPanel(params, cached);
  } else {
    renderPanel(params);
    const allFilled = ep.params.filter(p => p.required).every(p => params[p.name]);
    if (allFilled) setTimeout(() => doFetch(ep, params), 50);
  }
}

// ── Login form ─────────────────────────────────────────────
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideLoginError();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    showLoginError('Udfyld både brugernavn og adgangskode.');
    return;
  }

  btnLogin.disabled = true;
  btnLogin.textContent = 'Logger ind…';

  const result = await login(username, password);

  btnLogin.disabled = false;
  btnLogin.textContent = 'Log ind';

  if (result.ok) {
    showExplorer();
  } else {
    showLoginError(result.error);
  }
});

// ── Logout ─────────────────────────────────────────────────
btnLogout.addEventListener('click', () => {
  logout();
  showLogin();
});

// ── Navigation ─────────────────────────────────────────────
function renderNav() {
  navEl.innerHTML = GROUPS.map(group => `
    <button class="nav-group-btn${group === activeGroup ? ' active' : ''}" data-group="${group}">
      ${group}
    </button>
  `).join('');

  navEl.querySelectorAll('.nav-group-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeGroup    = btn.dataset.group;
      activeEndpoint = getEndpointsByGroup(activeGroup)[0];
      renderNav();
      renderSubnav();
      renderPanel();
    });
  });
}

function renderSubnav() {
  const endpoints = getEndpointsByGroup(activeGroup);
  subnavEl.innerHTML = endpoints.map(ep => `
    <button class="subnav-btn${ep.id === activeEndpoint.id ? ' active' : ''}" data-id="${ep.id}">
      ${ep.label}
    </button>
  `).join('');

  subnavEl.querySelectorAll('.subnav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ep = ENDPOINTS.find(e => e.id === btn.dataset.id);
      activeEndpoint = ep;
      renderSubnav();
      // Restore from cache if available (no params = empty params for paramless endpoints)
      const cached = responseCache.get(cacheKey(ep.id, {}));
      if (cached) {
        renderPanel({}, cached);
      } else {
        renderPanel();
        // Auto-fetch if no required params
        if (ep.params.filter(p => p.required).length === 0) {
          setTimeout(() => doFetch(ep, {}), 50);
        }
      }
    });
  });
}

// ── Endpoint Panel ─────────────────────────────────────────
function renderPanel(prefill = {}, cached = null) {
  const ep = activeEndpoint;

  const paramsHtml = ep.params.length === 0 ? '' : `
    <div class="params-section">
      <h4>Parametre</h4>
      ${ep.params.map(p => `
        <label for="param-${p.name}">
          ${p.label}${p.required ? ' <span style="color:var(--dbu-error)">*</span>' : ''}
        </label>
        <input
          id="param-${p.name}"
          type="${p.type}"
          class="input"
          placeholder="${p.placeholder ?? ''}"
          data-param="${p.name}"
          value="${escAttr(prefill[p.name] ?? '')}"
          ${p.required ? 'required' : ''}
        >
      `).join('')}
    </div>
  `;

  mainEl.innerHTML = `
    <div class="endpoint-panel">
      <div class="endpoint-header">
        <h3>${ep.label}</h3>
        <p style="margin-top:.25rem;font-size:.875rem;">${ep.description}</p>
        <div class="endpoint-meta">
          <span class="method-badge">${ep.method}</span>
          <span class="endpoint-path">/v1${ep.path}</span>
        </div>
      </div>

      ${paramsHtml}

      <button class="btn btn-primary" id="btn-fetch">Hent data</button>

      <div class="response-section" id="response-section">
        <div class="response-header">
          <h4>Svar</h4>
          <span id="status-badge"></span>
          <button class="btn btn-tertiary" id="btn-copy" hidden>Kopier JSON</button>
          <button class="btn btn-tertiary" id="btn-raw" hidden>Vis rå JSON</button>
        </div>
        <div id="response-output">
          <div class="response-empty">Ingen data hentet endnu.</div>
        </div>
      </div>
    </div>
  `;

  const fetchBtn = document.getElementById('btn-fetch');
  fetchBtn.addEventListener('click', () => doFetch(ep));

  if (cached) {
    restoreFromCache(ep, prefill, cached);
  }
}

// ── API call & render response ─────────────────────────────
async function doFetch(ep, prefillParams) {
  const paramValues = prefillParams ?? {};
  if (!prefillParams) {
    document.querySelectorAll('[data-param]').forEach(input => {
      paramValues[input.dataset.param] = input.value.trim();
    });
  }

  const missing = ep.params.filter(p => p.required && !paramValues[p.name]);
  if (missing.length > 0) {
    alert(`Udfyld venligst: ${missing.map(p => p.label).join(', ')}`);
    return;
  }

  const btnFetch    = document.getElementById('btn-fetch');
  const outputEl    = document.getElementById('response-output');
  const statusBadge = document.getElementById('status-badge');
  const btnCopy     = document.getElementById('btn-copy');
  const btnRaw      = document.getElementById('btn-raw');

  btnFetch.disabled     = true;
  btnCopy.hidden        = true;
  btnRaw.hidden         = true;
  statusBadge.innerHTML = '';
  outputEl.innerHTML    = '<div class="spinner"></div>';

  const result = await callEndpoint(ep, paramValues);

  btnFetch.disabled = false;

  if (result.sessionExpired) {
    showLogin('Din session er udløbet. Log ind igen.');
    return;
  }

  const statusClass = result.ok ? 'badge-success' : 'badge-error';
  const statusText  = result.status ? `HTTP ${result.status}` : 'Fejl';
  statusBadge.innerHTML = `<span class="badge ${statusClass}">${statusText}</span>`;

  if (!result.ok) {
    outputEl.innerHTML = `<div class="response-block error-response">${escHtml(result.error || result.rawText || 'Ukendt fejl')}</div>`;
    return;
  }

  const rawJson = JSON.stringify(result.data, null, 2);

  // Save to cache
  responseCache.set(cacheKey(ep.id, paramValues), { data: result.data, rawJson, status: result.status });

  applyResult(ep, paramValues, result.data, rawJson, result.status, outputEl, statusBadge, btnCopy, btnRaw);
}

// ── Restore panel from cache (instant, no network) ─────────
function restoreFromCache(ep, paramValues, cached) {
  const outputEl    = document.getElementById('response-output');
  const statusBadge = document.getElementById('status-badge');
  const btnCopy     = document.getElementById('btn-copy');
  const btnRaw      = document.getElementById('btn-raw');
  applyResult(ep, paramValues, cached.data, cached.rawJson, cached.status, outputEl, statusBadge, btnCopy, btnRaw);
}

// ── Shared render logic ────────────────────────────────────
function applyResult(ep, paramValues, data, rawJson, status, outputEl, statusBadge, btnCopy, btnRaw) {
  statusBadge.innerHTML = `<span class="badge badge-success">HTTP ${status}</span>`;

  let showingRaw = false;
  outputEl.innerHTML = renderSmartView(ep.id, data, paramValues);
  wireSmartLinks(outputEl);

  btnCopy.hidden = false;
  btnCopy.onclick = () => {
    navigator.clipboard.writeText(rawJson).then(() => {
      btnCopy.textContent = 'Kopieret!';
      setTimeout(() => { btnCopy.textContent = 'Kopier JSON'; }, 1500);
    });
  };

  btnRaw.hidden = false;
  btnRaw.textContent = 'Vis rå JSON';
  btnRaw.onclick = () => {
    showingRaw = !showingRaw;
    if (showingRaw) {
      outputEl.innerHTML = `<pre class="response-block">${escHtml(rawJson)}</pre>`;
      btnRaw.textContent = 'Vis pæn visning';
    } else {
      outputEl.innerHTML = renderSmartView(ep.id, data, paramValues);
      wireSmartLinks(outputEl);
      btnRaw.textContent = 'Vis rå JSON';
    }
  };
}

// ── Smart view dispatcher ──────────────────────────────────
function renderSmartView(endpointId, data, params) {
  if (!Array.isArray(data) && typeof data !== 'object') {
    return `<pre class="response-block">${escHtml(JSON.stringify(data, null, 2))}</pre>`;
  }

  switch (endpointId) {
    case 'club-teams':     return renderTeamList(data);
    case 'team-standings': return renderStandings(data, params);
    case 'match-schedule': return renderSchedule(data, params);
    case 'match-info':     return renderMatchInfo(data);
    case 'match-lineup':   return renderLineup(data);
    case 'match-events':   return renderEvents(data, params);
    case 'team-contacts':  return renderContacts(data);
    case 'team-kits':      return renderKits(data);
    case 'school-list':    return renderSchoolList(data);
    case 'school-get':     return renderSchoolDetail(data);
    default:               return `<pre class="response-block">${escHtml(JSON.stringify(data, null, 2))}</pre>`;
  }
}

// ── Render: Holdliste ──────────────────────────────────────
function renderTeamList(teams) {
  const byDiv = groupBy(teams, 'DivisionName');
  return `
    <div class="smart-view">
      ${Object.entries(byDiv).map(([div, list]) => `
        <div class="data-group">
          <div class="data-group-title">${escHtml(div)}</div>
          ${list.map(t => `
            <div class="data-row">
              <div class="data-row-main">
                <span class="data-row-name">${escHtml(t.PoolName)}</span>
                <span class="data-row-sub">${escHtml(t.GenderName)} · ${escHtml(t.RowName)}</span>
              </div>
              <div class="data-row-actions">
                <button class="link-btn" data-ep="match-schedule" data-params='${jsonAttr({rowId: t.RowId, teamId: t.TeamId, poolId: t.PoolId})}'>Kampprogram</button>
                <button class="link-btn" data-ep="team-standings" data-params='${jsonAttr({rowId: t.RowId, teamId: t.TeamId})}'>Stilling</button>
                <button class="link-btn" data-ep="team-contacts" data-params='${jsonAttr({rowId: t.RowId, teamId: t.TeamId})}'>Kontakter</button>
                <button class="link-btn" data-ep="team-kits" data-params='${jsonAttr({rowId: t.RowId, teamId: t.TeamId})}'>Trøjer</button>
              </div>
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>
  `;
}

// ── Render: Stilling ───────────────────────────────────────
function renderStandings(rows, params) {
  if (!rows.length) return '<div class="response-empty">Ingen stillingsdata.</div>';
  return `
    <div class="smart-view">
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th><th>Hold</th><th>K</th><th>V</th><th>U</th><th>T</th><th>Mål</th><th>Pts</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr class="${r.TeamId == 1658 ? 'highlight-row' : ''}">
              <td class="pos">${r.Position}</td>
              <td class="team-name">
                ${escHtml(r.TeamName)}
              </td>
              <td>${r.Games}</td>
              <td>${r.Wins}</td>
              <td>${r.Draws}</td>
              <td>${r.Losses}</td>
              <td>${r.GoalsFor}–${r.GoalsAgainst}</td>
              <td class="pts">${r.Points}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ── Render: Kampprogram ────────────────────────────────────
function renderSchedule(matches, params) {
  if (!matches.length) return '<div class="response-empty">Ingen kampe fundet.</div>';
  return `
    <div class="smart-view">
      ${matches.map(m => {
        const dt = new Date(m.MatchDateTime);
        const dateStr = dt.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' });
        const timeStr = dt.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
        const played  = m.HomeScore !== null && m.AwayScore !== null;
        return `
          <div class="data-row match-row">
            <div class="match-datetime">
              <span class="match-date">${dateStr}</span>
              <span class="match-time">${timeStr}</span>
            </div>
            <div class="match-teams">
              <span class="match-home">${escHtml(m.HomeTeamName)}</span>
              <span class="match-score ${played ? 'played' : 'upcoming'}">
                ${played ? `${m.HomeScore}–${m.AwayScore}` : 'vs'}
              </span>
              <span class="match-away">${escHtml(m.AwayTeamName)}</span>
            </div>
            <div class="match-venue">${escHtml(m.StadiumName ?? '')}</div>
            <div class="data-row-actions">
              <button class="link-btn" data-ep="match-info" data-params='${jsonAttr({matchId: m.MatchId, poolId: params.poolId})}'>Info</button>
              <button class="link-btn" data-ep="match-lineup" data-params='${jsonAttr({matchId: m.MatchId, poolId: params.poolId})}'>Opstilling</button>
              <button class="link-btn" data-ep="match-events" data-params='${jsonAttr({matchId: m.MatchId, poolId: params.poolId})}'>Begivenheder</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ── Render: Kampinfo ───────────────────────────────────────
function renderMatchInfo(data) {
  if (!data || (Array.isArray(data) && !data.length)) return '<div class="response-empty">Ingen kampdata.</div>';
  const m = Array.isArray(data) ? data[0] : data;
  return `
    <div class="smart-view">
      <div class="detail-card">
        <div class="detail-row"><span>Hjemmehold</span><strong>${escHtml(m.HomeTeamName ?? '–')}</strong></div>
        <div class="detail-row"><span>Udehold</span><strong>${escHtml(m.AwayTeamName ?? '–')}</strong></div>
        <div class="detail-row"><span>Resultat</span><strong>${m.HomeScore !== null ? `${m.HomeScore}–${m.AwayScore}` : 'Ikke spillet'}</strong></div>
        ${m.MatchDateTime ? `<div class="detail-row"><span>Dato/tid</span><strong>${new Date(m.MatchDateTime).toLocaleString('da-DK')}</strong></div>` : ''}
        ${m.StadiumName ? `<div class="detail-row"><span>Stadion</span><strong>${escHtml(m.StadiumName)}</strong></div>` : ''}
        ${m.RefereeNames ? `<div class="detail-row"><span>Dommer</span><strong>${escHtml(m.RefereeNames)}</strong></div>` : ''}
        ${m.Spectators != null ? `<div class="detail-row"><span>Tilskuere</span><strong>${m.Spectators}</strong></div>` : ''}
      </div>
    </div>
  `;
}

// ── Render: Opstilling ─────────────────────────────────────
function renderLineup(data) {
  if (!data || !data.length) return '<div class="response-empty">Ingen opstillingsdata.</div>';
  const byTeam = groupBy(data, 'TeamName');
  return `
    <div class="smart-view">
      ${Object.entries(byTeam).map(([team, players]) => `
        <div class="data-group">
          <div class="data-group-title">${escHtml(team)}</div>
          <table class="data-table">
            <thead><tr><th>#</th><th>Navn</th><th>Pos</th></tr></thead>
            <tbody>
              ${players.map(p => `
                <tr>
                  <td class="pos">${p.ShirtNumber ?? '–'}</td>
                  <td>${escHtml(p.PlayerName ?? '–')}</td>
                  <td>${escHtml(p.PositionName ?? '–')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
    </div>
  `;
}

// ── Render: Begivenheder ───────────────────────────────────
function renderEvents(data, params) {
  if (!data || !data.length) return '<div class="response-empty">Ingen begivenheder.</div>';
  const icons = { Goal: '⚽', YellowCard: '🟨', RedCard: '🟥', Substitution: '🔄' };
  return `
    <div class="smart-view">
      ${data.map(ev => `
        <div class="event-row">
          <span class="event-min">${ev.Minute ?? '–'}'</span>
          <span class="event-icon">${icons[ev.EventType] ?? '•'}</span>
          <span class="event-desc">
            <strong>${escHtml(ev.PlayerName ?? ev.EventType ?? '–')}</strong>
            ${ev.TeamName ? `<span class="data-row-sub">${escHtml(ev.TeamName)}</span>` : ''}
          </span>
        </div>
      `).join('')}
    </div>
  `;
}

// ── Render: Kontakter ──────────────────────────────────────
function renderContacts(data) {
  if (!data || !data.length) return '<div class="response-empty">Ingen kontakter.</div>';
  return `
    <div class="smart-view">
      ${data.map(c => {
        const name = [c.FirstName, c.LastName].filter(Boolean).join(' ') || c.Name || '–';
        const phone = c.Mobile || c.Telephone || c.Phone;
        return `
          <div class="data-row">
            <div class="data-row-main">
              <span class="data-row-name">${escHtml(name)}</span>
              <span class="data-row-sub">${escHtml(c.AssignmentName ?? c.Role ?? '')}</span>
            </div>
            <div class="data-row-actions">
              ${phone ? `<span class="data-chip">📞 ${escHtml(phone)}</span>` : ''}
              ${c.Email ? `<a class="link-btn" href="mailto:${escAttr(c.Email)}">${escHtml(c.Email)}</a>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ── Render: Trøjer ─────────────────────────────────────────
function renderKits(data) {
  if (!data || (!data.HomePlayerKit && !data.AwayPlayerKit)) {
    return '<div class="response-empty">Ingen trøjedata.</div>';
  }

  const kitLabels = { Shirt: 'Trøje', Shorts: 'Shorts', Socks: 'Strømper' };

  function renderKit(kit, title) {
    if (!kit) return '';
    const parts = Object.entries(kit)
      .filter(([, colors]) => Array.isArray(colors) && colors.length)
      .map(([part, colors]) => `
        <div class="detail-row">
          <span>${kitLabels[part] ?? part}</span>
          <strong style="display:flex;align-items:center;gap:.375rem;">
            ${colors.map(c => `
              <span class="color-chip" style="background:${escAttr(c.HexValue)}" title="${escAttr(c.Name)} ${escAttr(c.HexValue)}"></span>
              <span>${escHtml(c.Name)}</span>
            `).join('<span style="color:var(--dbu-gray);padding:0 .25rem">+</span>')}
          </strong>
        </div>
      `).join('');

    if (!parts) return '';
    return `
      <div class="data-group">
        <div class="data-group-title">${escHtml(title)}</div>
        <div class="detail-card" style="border:none;border-radius:0">${parts}</div>
      </div>
    `;
  }

  return `
    <div class="smart-view">
      ${renderKit(data.HomePlayerKit, 'Hjemmesæt')}
      ${renderKit(data.AwayPlayerKit, 'Udesæt')}
    </div>
  `;
}

// ── Render: Skoleliste ─────────────────────────────────────
function renderSchoolList(data) {
  if (!data || !data.length) return '<div class="response-empty">Ingen skoler fundet.</div>';
  return `
    <div class="smart-view">
      ${data.map(s => `
        <div class="data-row">
          <div class="data-row-main">
            <span class="data-row-name">${escHtml(s.Name ?? s.SchoolName ?? '–')}</span>
            <span class="data-row-sub">${escHtml(s.Municipality ?? s.City ?? '')}</span>
          </div>
          <div class="data-row-actions">
            <button class="link-btn" data-ep="school-get" data-params='${jsonAttr({id: s.Id ?? s.SchoolId})}'>Detaljer</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ── Render: Skoledetaljer ──────────────────────────────────
function renderSchoolDetail(data) {
  const s = Array.isArray(data) ? data[0] : data;
  if (!s) return '<div class="response-empty">Ingen data.</div>';
  return `
    <div class="smart-view">
      <div class="detail-card">
        ${Object.entries(s).map(([k, v]) => v != null ? `
          <div class="detail-row">
            <span>${escHtml(k)}</span>
            <strong>${escHtml(String(v))}</strong>
          </div>
        ` : '').join('')}
      </div>
    </div>
  `;
}

// ── Wire smart link buttons ────────────────────────────────
function wireSmartLinks(container) {
  container.querySelectorAll('[data-ep]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ep     = btn.dataset.ep;
      const params = JSON.parse(btn.dataset.params ?? '{}');
      navigateTo(ep, params);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

// ── Utilities ──────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function jsonAttr(obj) {
  return escAttr(JSON.stringify(obj));
}
function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key] ?? 'Andet';
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {});
}

// ── Init ───────────────────────────────────────────────────
if (isLoggedIn()) {
  showExplorer();
} else {
  showLogin();
}
