// Balanced team draft — for leagues that rate players instead of auctioning them.
//
// Give every player a rating, say how many teams you want, and this splits them
// into squads of near-equal strength. Two stages:
//
//   1. a greedy assignment, done per category so each squad gets its share of
//      keepers / defenders / raiders rather than one team taking them all;
//   2. a local search that swaps players between teams to flatten the totals.
//
// Swaps are same-category only, so stage 2 can never undo stage 1's spread.
// Randomness is seeded, so "shuffle again" gives a different draw and the same
// seed always reproduces the same one.

/** Small seeded PRNG — deterministic draws, and re-rollable. */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sum = (list, of) => list.reduce((s, p) => s + of(p), 0);

/**
 * @param players  the pool
 * @param ratingOf (player) => number
 * @param groupOf  (player) => string   category, for even distribution
 */
export function balanceTeams(players, {
  teamCount = 4,
  teamNames = [],
  ratingOf = () => 5,
  groupOf = null,
  byCategory = true,
  seed = 1,
} = {}) {
  const n = Math.max(2, Math.min(Math.floor(teamCount) || 2, Math.max(2, players.length)));
  const rnd = mulberry32(seed >>> 0 || 1);
  const teams = Array.from({ length: n }, (_, i) => ({
    name: teamNames[i] || `Team ${i + 1}`,
    players: [],
  }));
  if (!players.length) return decorate(teams, ratingOf);

  // ── stage 1: strongest first, into whoever needs them most ──────────────
  const buckets = byCategory && groupOf
    ? [...groupPlayers(players, groupOf).values()]
    : [players];

  for (const bucket of buckets) {
    for (const p of strongestFirst(bucket, ratingOf, rnd)) {
      // fewest players wins; ties go to the weakest squad, then a coin toss
      let best = teams[0];
      for (const t of teams) {
        const d = t.players.length - best.players.length
          || sum(t.players, ratingOf) - sum(best.players, ratingOf)
          || (rnd() < 0.5 ? -1 : 1);
        if (d < 0) best = t;
      }
      best.players.push(p);
    }
  }

  improve(teams, ratingOf, groupOf, byCategory);
  return decorate(teams, ratingOf);
}

/** Descending by rating, with equal ratings shuffled so draws differ. */
function strongestFirst(list, ratingOf, rnd) {
  return list
    .map(p => ({ p, k: rnd() }))
    .sort((a, b) => ratingOf(b.p) - ratingOf(a.p) || a.k - b.k)
    .map(x => x.p);
}

function groupPlayers(players, groupOf) {
  const map = new Map();
  for (const p of players) {
    const k = String(groupOf(p) ?? '').trim() || 'Unspecified';
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(p);
  }
  return map;
}

/** Spread we are trying to shrink: how far team totals sit from the mean. */
function spread(teams, ratingOf) {
  const totals = teams.map(t => sum(t.players, ratingOf));
  const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
  return totals.reduce((s, v) => s + (v - mean) ** 2, 0);
}

/**
 * Swap pairs of players between teams while it makes the totals more even.
 * Only same-category swaps, so the category balance from stage 1 survives.
 */
function improve(teams, ratingOf, groupOf, byCategory) {
  const cat = p => (byCategory && groupOf ? String(groupOf(p) ?? '') : '');
  const MAX_PASSES = 40;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let best = null;
    let bestGain = 1e-9;              // only accept a real improvement
    const before = spread(teams, ratingOf);

    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const A = teams[i], B = teams[j];
        for (let a = 0; a < A.players.length; a++) {
          for (let b = 0; b < B.players.length; b++) {
            if (cat(A.players[a]) !== cat(B.players[b])) continue;
            if (ratingOf(A.players[a]) === ratingOf(B.players[b])) continue;
            swap(A, a, B, b);
            const gain = before - spread(teams, ratingOf);
            swap(A, a, B, b);          // put it back
            if (gain > bestGain) { bestGain = gain; best = [A, a, B, b]; }
          }
        }
      }
    }

    if (!best) break;                  // nothing left worth doing
    swap(best[0], best[1], best[2], best[3]);
  }
}

function swap(A, a, B, b) {
  const t = A.players[a];
  A.players[a] = B.players[b];
  B.players[b] = t;
}

function decorate(teams, ratingOf) {
  for (const t of teams) {
    t.total = Math.round(sum(t.players, ratingOf) * 100) / 100;
    t.average = t.players.length
      ? Math.round((t.total / t.players.length) * 100) / 100 : 0;
    t.players.sort((x, y) => ratingOf(y) - ratingOf(x));
  }
  return teams;
}

/** How even the result is — for showing the organiser it's fair. */
export function teamSpread(teams) {
  if (!teams.length) return { totalGap: 0, averageGap: 0 };
  const totals = teams.map(t => t.total);
  const avgs = teams.map(t => t.average);
  const gap = a => Math.round((Math.max(...a) - Math.min(...a)) * 100) / 100;
  return { totalGap: gap(totals), averageGap: gap(avgs) };
}

/** Plain text for pasting into WhatsApp — the way most clubs actually share it. */
export function teamsAsText(teams, { title = '', ratingOf = () => 0, showRatings = true } = {}) {
  const lines = [];
  if (title) lines.push(title, '');
  for (const t of teams) {
    lines.push(`*${t.name}*${showRatings ? `  (avg ${t.average})` : ''}`);
    t.players.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.name}${showRatings ? ` — ${ratingOf(p)}` : ''}`);
    });
    lines.push('');
  }
  return lines.join('\n').trim();
}
