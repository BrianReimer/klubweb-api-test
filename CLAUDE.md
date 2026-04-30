# KlubWeb API Test — Teknisk dokumentation

## Formål

Testmiljø til afprøvning af KlubWeb API og JavaScript-widgets. Projektet er rettet mod klubber der bruger KlubOffice og ønsker at integrere live-data (hold, kampe, stillinger) på egne hjemmesider via API eller widget-kode.

## Deployment

- **Platform:** Railway (auto-deploy ved push til `main`)
- **Produktions-URL:** `https://klubweb-api-test-production.up.railway.app`
- **Lokal udvikling:** `node server.js` → `http://localhost:3000`

## Projektstruktur

```
klubweb-api-test/
├── index.html          # Forside + login + API-explorer (én SPA)
├── widgets.html        # Standalone widgets-sandbox (ingen login)
├── server.js           # Express-server (statiske filer + webhook-modtager)
├── css/
│   └── dbu.css         # Hele design-systemet (DBU tokens, komponenter)
├── js/
│   ├── app.js          # SPA-logik: screens, navigation, API-kald, smart views
│   ├── api.js          # Auth-lag: login, token-refresh, callEndpoint
│   ├── endpoints.js    # Endpoint-definitioner (grupper, parametre, paths)
│   └── widgets.js      # Widget-sandbox logik (kør JS i iframe)
└── webhook/            # (mappe — ikke i brug pt.)
```

## Server (`server.js`)

Node.js + Express. Håndterer tre ansvarsområder:

1. **Statiske filer** — serverer hele frontend via `express.static`
2. **Webhook-modtager** — `POST /webhook` gemmer indkommende requests i hukommelsen (max 100), broadcaster via SSE til alle åbne viewers
3. **Webhook-viewer** — `GET /webhook-view` returnerer et selvstændigt HTML-UI til at se indkommende webhooks live

**Rate limiting:** Max 10 requests/minut på `/webhook`, `/events`, `/clear`, `/webhook-view` via `express-rate-limit`.

**SSE:** `GET /events` holder en åben forbindelse og streamer nye webhooks til viewer-klienter i realtid. In-memory store — data forsvinder ved server-genstart.

## Frontend-arkitektur

### `index.html` — SPA med tre skærme

Styres udelukkende med `hidden`-attributten — ingen routing eller URL-ændringer.

| Screen | ID | Vises når |
|---|---|---|
| Forside | `screen-home` | Ikke logget ind (default) |
| Login | `screen-login` | Bruger klikker API på forsiden |
| Explorer | `screen-explorer` | Succesfuldt login |

### `js/api.js` — Auth-lag

- Autentificerer mod `https://apitest.dbu.dk/v1/api/token` med `grant_type: password`
- Tokens gemmes i `localStorage` — persisteres på tværs af faner (samme origin), så webhook-vieweren kan genbruge tokenet
- Auto-refresh: hvis access token udløber (med 30 sek. buffer), forsøges refresh automatisk før næste API-kald
- Ved refresh-fejl: tokens ryddes og bruger sendes til login

### `js/endpoints.js` — Endpoint-definitioner

Alle API-endpoints er defineret som dataobjekter med `id`, `group`, `label`, `description`, `method`, `path` og `params`. Parametre har `location: 'path' | 'query'` og bruges til automatisk URL-byggeri i `api.js`.

Grupper: **Hold**, **Kamp**, **Skole**

### `js/app.js` — Explorer-logik

- Renderer navigation (gruppe-tabs + endpoint-knapper) dynamisk fra `endpoints.js`
- **Smart views:** hvert endpoint-ID har en dedikeret render-funktion der viser data pænt (tabeller, rækker, farve-chips, osv.) i stedet for rå JSON
- **Response-cache:** `Map` med nøgle `endpointId|params` — navigerer man tilbage til et endpoint genskabes svaret uden nyt netværkskald
- **Smart links:** knapper i smart views kalder `navigateTo(endpointId, params)` for at hoppe direkte til relaterede endpoints med præudfyldte parametre (fx "Kampprogram" fra holdlisten)

### `widgets.html` + `js/widgets.js` — Widget-sandbox

Ingen login påkrævet. Bruger skriver JavaScript i en textarea, klikker "Vis", og koden køres i en sandboxed `<iframe>` via `srcdoc`. Iframen er resizable (CSS `resize: both`) med en visuel handle i nederste højre hjørne.

## Design-system (`css/dbu.css`)

DBU-farvetokens defineret som CSS custom properties:

| Token | Værdi | Brug |
|---|---|---|
| `--dbu-red` | `#C90B0E` | Primær farve, knapper, aktive states |
| `--dbu-bg` | `#F1F1F1` | Sidebagggrund |
| `--dbu-nav-dark` | `#1D1D1D` | Header, kode-blokke |
| `--dbu-border` | `#E2E2E2` | Kanter på kort og inputs |

Skrifttype: **Space Grotesk** (Google Fonts), weight 300/500/600.

## API

Ekstern API: `https://apitest.dbu.dk/v1`

Alle kald kræver `Authorization: Bearer <access_token>` header. Kaldene foretages direkte fra brugerens browser — der er ingen backend-proxy.

### Endpoints

| ID | Sti | Parametre |
|---|---|---|
| `club-teams` | `GET /api/club-teams` | — |
| `team-standings` | `GET /api/team-standings/{rowId}/{teamId}` | rowId, teamId |
| `team-contacts` | `GET /api/team-contacts/{rowId}/{teamId}` | rowId, teamId |
| `team-kits` | `GET /api/team-kits/{rowId}/{teamId}` | rowId, teamId |
| `match-schedule` | `GET /api/match-schedule/{rowId}/{teamId}` | rowId, teamId, poolId (query) |
| `match-info` | `GET /api/match-info/{matchId}/{poolId}` | matchId, poolId |
| `match-lineup` | `GET /api/match-lineup/{matchId}/{poolId}` | matchId, poolId |
| `match-events` | `GET /api/match-events/{matchId}/{poolId}` | matchId, poolId |
| `school-list` | `GET /api/school-list` | — |
| `school-get` | `GET /api/school/{id}` | id |
