export const GROUPS = ['Hold', 'Kamp', 'Skole'];

export const ENDPOINTS = [
  // ── Hold ──────────────────────────────────────────────────
  {
    id: 'club-teams',
    group: 'Hold',
    label: 'Holdliste',
    description: 'Henter alle hold tilknyttet klubben.',
    method: 'GET',
    path: '/api/club-teams',
    params: [],
  },
  {
    id: 'team-standings',
    group: 'Hold',
    label: 'Stilling',
    description: 'Henter stillingen for et specifikt hold i en given række.',
    method: 'GET',
    path: '/api/team-standings/{rowId}/{teamId}',
    params: [
      { name: 'rowId',  label: 'Række-ID',  type: 'text', location: 'path', required: true, placeholder: 'fx 12345' },
      { name: 'teamId', label: 'Hold-ID',   type: 'text', location: 'path', required: true, placeholder: 'fx 67890' },
    ],
  },
  {
    id: 'team-contacts',
    group: 'Hold',
    label: 'Kontakter',
    description: 'Henter kontaktpersoner for et specifikt hold.',
    method: 'GET',
    path: '/api/team-contacts/{rowId}/{teamId}',
    params: [
      { name: 'rowId',  label: 'Række-ID', type: 'text', location: 'path', required: true, placeholder: 'fx 12345' },
      { name: 'teamId', label: 'Hold-ID',  type: 'text', location: 'path', required: true, placeholder: 'fx 67890' },
    ],
  },
  {
    id: 'team-kits',
    group: 'Hold',
    label: 'Trøjer',
    description: 'Henter trøje-/kitoplysninger for et specifikt hold.',
    method: 'GET',
    path: '/api/team-kits/{rowId}/{teamId}',
    params: [
      { name: 'rowId',  label: 'Række-ID', type: 'text', location: 'path', required: true, placeholder: 'fx 12345' },
      { name: 'teamId', label: 'Hold-ID',  type: 'text', location: 'path', required: true, placeholder: 'fx 67890' },
    ],
  },
  {
    id: 'match-schedule',
    group: 'Hold',
    label: 'Kampprogram',
    description: 'Henter kampprogrammet for et specifikt hold.',
    method: 'GET',
    path: '/api/match-schedule/{rowId}/{teamId}',
    params: [
      { name: 'rowId',  label: 'Række-ID', type: 'text', location: 'path', required: true, placeholder: 'fx 12345' },
      { name: 'teamId', label: 'Hold-ID',  type: 'text', location: 'path', required: true, placeholder: 'fx 67890' },
    ],
  },

  // ── Kamp ──────────────────────────────────────────────────
  {
    id: 'match-info',
    group: 'Kamp',
    label: 'Kampinfo',
    description: 'Henter generelle oplysninger om en specifik kamp.',
    method: 'GET',
    path: '/api/match-info/{matchId}/{poolId}',
    params: [
      { name: 'matchId', label: 'Kamp-ID',    type: 'text', location: 'path', required: true, placeholder: 'fx 98765' },
      { name: 'poolId',  label: 'Pulje-ID',   type: 'text', location: 'path', required: true, placeholder: 'fx 1' },
    ],
  },
  {
    id: 'match-lineup',
    group: 'Kamp',
    label: 'Opstilling',
    description: 'Henter holdopstillingen for et hold i en specifik kamp.',
    method: 'GET',
    path: '/api/match-lineup/{matchId}/{poolId}',
    params: [
      { name: 'matchId', label: 'Kamp-ID',  type: 'text', location: 'path',  required: true,  placeholder: 'fx 98765' },
      { name: 'poolId',  label: 'Pulje-ID', type: 'text', location: 'path',  required: true,  placeholder: 'fx 1' },
      { name: 'teamId',  label: 'Hold-ID',  type: 'text', location: 'query', required: false, placeholder: 'valgfrit' },
    ],
  },
  {
    id: 'match-events',
    group: 'Kamp',
    label: 'Begivenheder',
    description: 'Henter begivenheder (mål, kort, mv.) for en specifik kamp.',
    method: 'GET',
    path: '/api/match-events/{matchId}/{poolId}',
    params: [
      { name: 'matchId', label: 'Kamp-ID',  type: 'text', location: 'path', required: true, placeholder: 'fx 98765' },
      { name: 'poolId',  label: 'Pulje-ID', type: 'text', location: 'path', required: true, placeholder: 'fx 1' },
    ],
  },

  // ── Skole ──────────────────────────────────────────────────
  {
    id: 'school-list',
    group: 'Skole',
    label: 'Søg skole',
    description: 'Søger efter skoler ud fra navn.',
    method: 'GET',
    path: '/api/FS_School/List',
    params: [
      { name: 'name', label: 'Skolenavn', type: 'text', location: 'query', required: true, placeholder: 'fx Østerbro Skole' },
    ],
  },
  {
    id: 'school-get',
    group: 'Skole',
    label: 'Hent skole',
    description: 'Henter detaljer om en specifik skole via ID.',
    method: 'GET',
    path: '/api/FS_School/Get',
    params: [
      { name: 'id', label: 'Skole-ID', type: 'text', location: 'query', required: true, placeholder: 'fx 42' },
    ],
  },
];

export function getEndpointById(id) {
  return ENDPOINTS.find(e => e.id === id) ?? null;
}

export function getEndpointsByGroup(group) {
  return ENDPOINTS.filter(e => e.group === group);
}
