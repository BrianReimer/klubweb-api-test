const BASE_URL = 'https://apitest.dbu.dk/v1';

const KEYS = {
  access:    'dbu_access_token',
  refresh:   'dbu_refresh_token',
  expiresAt: 'dbu_token_expires_at',
};

// ── Token storage ──────────────────────────────────────────
function storeTokens({ access_token, refresh_token, expires_in }) {
  localStorage.setItem(KEYS.access,    access_token);
  localStorage.setItem(KEYS.refresh,   refresh_token);
  localStorage.setItem(KEYS.expiresAt, String(Date.now() + expires_in * 1000));
}

function clearTokens() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}

function isTokenExpired() {
  const expiresAt = Number(localStorage.getItem(KEYS.expiresAt) ?? 0);
  return Date.now() > expiresAt - 30_000; // 30s buffer
}

export function isLoggedIn() {
  return !!localStorage.getItem(KEYS.access);
}

// ── Token fetch ────────────────────────────────────────────
async function fetchToken(body) {
  const res = await fetch(`${BASE_URL}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Public: login ──────────────────────────────────────────
export async function login(username, password) {
  try {
    const data = await fetchToken({ grant_type: 'password', username, password });
    storeTokens(data);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'Forkert brugernavn eller adgangskode.' };
  }
}

// ── Internal: refresh ──────────────────────────────────────
async function refreshToken() {
  const token = localStorage.getItem(KEYS.refresh);
  if (!token) throw new Error('no_refresh_token');
  const data = await fetchToken({ grant_type: 'refresh_token', refresh_token: token });
  storeTokens(data);
}

// ── Public: logout ─────────────────────────────────────────
export function logout() {
  clearTokens();
}

// ── URL builder ────────────────────────────────────────────
function buildUrl(endpoint, paramValues) {
  let path = endpoint.path;

  for (const p of endpoint.params.filter(p => p.location === 'path')) {
    const val = paramValues[p.name] ?? '';
    path = path.replace(`{${p.name}}`, encodeURIComponent(val));
  }

  const queryParams = endpoint.params.filter(p => p.location === 'query');
  const qs = queryParams
    .filter(p => paramValues[p.name])
    .map(p => `${encodeURIComponent(p.name)}=${encodeURIComponent(paramValues[p.name])}`)
    .join('&');

  return `${BASE_URL}${path}${qs ? '?' + qs : ''}`;
}

// ── Public: callEndpoint ───────────────────────────────────
export async function callEndpoint(endpoint, paramValues) {
  if (isTokenExpired()) {
    try {
      await refreshToken();
    } catch {
      clearTokens();
      return { ok: false, status: 401, error: 'Session udløbet — log ind igen.', sessionExpired: true };
    }
  }

  const url = buildUrl(endpoint, paramValues);
  const accessToken = localStorage.getItem(KEYS.access);

  let res;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (networkErr) {
    return { ok: false, status: 0, error: 'Netværksfejl — tjek forbindelsen eller CORS.' };
  }

  const rawText = await res.text();
  let data = null;
  try { data = JSON.parse(rawText); } catch { /* not JSON */ }

  if (!res.ok) {
    const msg = (data && (data.message || data.Message || data.error)) || rawText || `HTTP ${res.status}`;
    return { ok: false, status: res.status, error: msg, data, rawText };
  }

  return { ok: true, status: res.status, data, rawText };
}
