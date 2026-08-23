// Sport presets. These only seed defaults — the user can override every column.
// Nothing in the rendering engine is sport-specific; a preset just supplies an
// accent colour and hints about which headers matter most for that sport.

export const ROLES = [
  { id: 'name',      label: 'Name',      single: true,  help: 'The player name (required)' },
  { id: 'id',        label: 'Lot / ID',  single: true,  help: 'Lot or serial number shown on the card' },
  { id: 'photo',     label: 'Photo',     single: true,  help: 'Image URL, or a file name to match against uploaded photos' },
  { id: 'category',  label: 'Category',  single: true,  help: 'Splits the booklet into sections' },
  { id: 'team',      label: 'Team',      single: true,  help: 'Current or previous team' },
  { id: 'basePrice', label: 'Base price', single: true, help: 'Highlighted on the card and in the index' },
  { id: 'subtitle',  label: 'Subtitle',  single: false, help: 'Small line under the name' },
  { id: 'badge',     label: 'Badge',     single: false, help: 'Small pill on the card' },
  { id: 'stat',      label: 'Stat',      single: false, help: 'Shown in the stat grid' },
  { id: 'note',      label: 'Note',      single: false, help: 'Longer free text at the bottom of the card' },
  { id: 'ignore',    label: 'Hide',      single: false, help: 'Not shown anywhere' },
];

export const SINGLE_ROLES = ROLES.filter(r => r.single).map(r => r.id);

export const PRESETS = [
  {
    id: 'generic', label: 'Generic / other sport', accent: '#c2410c',
    stats: [], badges: [],
  },
  {
    id: 'cricket', label: 'Cricket', accent: '#166534',
    stats: ['matches', 'runs', 'wickets', 'average', 'avg', 'strike rate', 'sr', 'economy', 'catches', 'highest', 'fifties', 'centuries', '50s', '100s'],
    badges: ['icon', 'marquee', 'captain', 'wicket ?keeper', 'wk', 'overseas'],
    subtitles: ['batting style', 'bowling style', 'bats', 'bowls', 'hand'],
  },
  {
    id: 'football', label: 'Football / Soccer', accent: '#1d4ed8',
    stats: ['appearances', 'apps', 'goals', 'assists', 'clean sheets', 'saves', 'minutes', 'yellow', 'red', 'pass'],
    badges: ['captain', 'icon', 'foreign', 'foot'],
    subtitles: ['position', 'preferred foot', 'foot', 'height'],
  },
  {
    id: 'kabaddi', label: 'Kabaddi', accent: '#b91c1c',
    stats: ['raid points', 'raids', 'tackle points', 'tackles', 'super raids', 'super tackles', 'matches', 'total points'],
    badges: ['captain', 'icon', 'category'],
    subtitles: ['position', 'height', 'weight'],
  },
  {
    id: 'volleyball', label: 'Volleyball', accent: '#a16207',
    stats: ['spikes', 'blocks', 'aces', 'serves', 'digs', 'points', 'matches', 'height'],
    badges: ['captain', 'libero', 'setter'],
    subtitles: ['position', 'height', 'reach'],
  },
  {
    id: 'basketball', label: 'Basketball', accent: '#c2410c',
    stats: ['points', 'ppg', 'rebounds', 'rpg', 'assists', 'apg', 'steals', 'blocks', 'games', 'fg%', '3p%'],
    badges: ['captain', 'mvp'],
    subtitles: ['position', 'height', 'weight'],
  },
  {
    id: 'racquet', label: 'Badminton / Tennis / TT', accent: '#6d28d9',
    stats: ['rank', 'ranking', 'matches', 'wins', 'losses', 'win %', 'titles', 'points'],
    badges: ['seed', 'captain'],
    subtitles: ['plays', 'hand', 'style', 'grip'],
  },
  {
    id: 'hockey', label: 'Hockey', accent: '#0f766e',
    stats: ['matches', 'goals', 'assists', 'penalty corners', 'saves', 'green', 'yellow'],
    badges: ['captain', 'goalkeeper', 'gk'],
    subtitles: ['position', 'stick'],
  },
  {
    id: 'esports', label: 'Esports', accent: '#4338ca',
    stats: ['kd', 'k/d', 'kills', 'deaths', 'adr', 'rating', 'hs%', 'win rate', 'matches', 'mmr', 'rank'],
    badges: ['igl', 'captain', 'region'],
    subtitles: ['role', 'main', 'agent', 'hero', 'server'],
  },
];

export const getPreset = id => PRESETS.find(p => p.id === id) || PRESETS[0];
