// The console the auctioneer actually drives the room from.
//
// Everything else in this tool either prepares for an auction or writes down
// what happened. This runs it: one lot at a time, a bid that goes up, and a
// team that wins it — with the arithmetic checked before the hammer falls
// rather than discovered at the end.
//
// Three things an auction floor demands that a form does not:
//
//   * It must not let a team overbid. A side holding 80,000 with four squad
//     slots left cannot spend 80,000 (see ownerpack.js) — those buttons are
//     disabled, so the mistake is impossible rather than merely discouraged.
//   * Undo. Auctioneers misclick, and a wrong sale two lots back must come out
//     cleanly, purse and all.
//   * It must survive a closed laptop. Every change is written to storage, so
//     reopening mid-auction resumes exactly where the room is.
//
// State functions here are pure and unit-tested; the DOM lives in main.js.

import { maxBid } from './ownerpack.js';
import { parseTeams } from './render.js';

const num = v => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
};

export function createAuction(players, settings) {
  return {
    order: players.map(p => p.lot),
    idx: 0,
    bid: 0,
    results: {},          // lot -> { status: 'sold'|'unsold', team, price }
    history: [],          // for undo
    round: 1,
  };
}

/** Lots still to be called in this round, in order. */
export const pending = state =>
  state.order.filter(lot => !state.results[lot]);

export const unsoldPile = state =>
  state.order.filter(lot => state.results[lot]?.status === 'unsold');

export const soldLots = state =>
  state.order.filter(lot => state.results[lot]?.status === 'sold');

/**
 * Live position of every team: what they have spent, what is left, how many
 * squad slots they still owe, and the most they may bid for the next player.
 */
export function teamStats(state, settings) {
  const minSquad = Math.max(1, Number(settings.minSquad) || 11);
  const maxSquad = Math.max(minSquad, Number(settings.maxSquad) || minSquad + 3);
  const minBase = Math.max(0, num(settings.minBase));

  return parseTeams(settings.teamsText).map(t => {
    const purse = num(t.purse);
    const mine = soldLots(state).filter(lot => state.results[lot].team === t.name);
    const spent = mine.reduce((s, lot) => s + num(state.results[lot].price), 0);
    const balance = purse - spent;
    const slotsLeft = Math.max(0, minSquad - mine.length);
    return {
      name: t.name,
      purse,
      bought: mine.length,
      spent,
      balance,
      slotsLeft,
      full: mine.length >= maxSquad,
      maxBid: maxBid(balance, slotsLeft, minBase),
    };
  });
}

/** Can this team take the current bid? Used to disable the button outright. */
export function canBid(team, amount) {
  if (team.full) return false;
  return amount > 0 && amount <= team.maxBid;
}

/* ── moves ──────────────────────────────────────────────────────────────── */

const record = (state, entry) => {
  state.history.push(entry);
  if (state.history.length > 200) state.history.shift();
};

export function sell(state, lot, teamName, price) {
  record(state, { type: 'result', lot, prev: state.results[lot] ?? null, idx: state.idx });
  state.results[lot] = { status: 'sold', team: teamName, price: num(price) };
  advance(state);
  return state;
}

export function markUnsold(state, lot) {
  record(state, { type: 'result', lot, prev: state.results[lot] ?? null, idx: state.idx });
  state.results[lot] = { status: 'unsold' };
  advance(state);
  return state;
}

/** Move on without deciding — the lot stays in the queue. */
export function skip(state) {
  record(state, { type: 'move', idx: state.idx });
  state.idx = nextPendingIndex(state, state.idx + 1);
  state.bid = 0;
  return state;
}

function advance(state) {
  state.idx = nextPendingIndex(state, state.idx);
  state.bid = 0;
}

/** First unresolved lot at or after `from`, wrapping once. */
function nextPendingIndex(state, from) {
  const n = state.order.length;
  for (let i = 0; i < n; i++) {
    const at = (from + i) % n;
    if (!state.results[state.order[at]]) return at;
  }
  return Math.min(from, n - 1);      // everything resolved; sit on the last lot
}

export function goTo(state, index) {
  record(state, { type: 'move', idx: state.idx });
  state.idx = Math.max(0, Math.min(index, state.order.length - 1));
  state.bid = 0;
  return state;
}

export function undo(state) {
  const last = state.history.pop();
  if (!last) return state;
  if (last.type === 'result') {
    if (last.prev) state.results[last.lot] = last.prev;
    else delete state.results[last.lot];
  }
  state.idx = last.idx;
  state.bid = 0;
  return state;
}

/**
 * Put the unsold players back in the queue for another round. Their earlier
 * result is cleared, so they are simply pending again.
 */
export function reopenUnsold(state) {
  const pile = unsoldPile(state);
  if (!pile.length) return state;
  record(state, {
    type: 'reopen',
    idx: state.idx,
    cleared: pile.map(lot => [lot, state.results[lot]]),
  });
  for (const lot of pile) delete state.results[lot];
  state.round += 1;
  state.idx = nextPendingIndex(state, 0);
  state.bid = 0;
  return state;
}

export function progress(state) {
  const sold = soldLots(state).length;
  const unsold = unsoldPile(state).length;
  return { sold, unsold, left: state.order.length - sold - unsold, total: state.order.length };
}

/* ── results ────────────────────────────────────────────────────────────── */

export function resultsCsv(state, players, settings) {
  const byLot = new Map(players.map(p => [p.lot, p]));
  const rows = [['Lot', 'Player', 'Category', 'Base price', 'Status', 'Team', 'Price']];
  for (const lot of state.order) {
    const r = state.results[lot];
    if (!r) continue;
    const p = byLot.get(lot) || { name: lot, category: '', basePrice: '' };
    rows.push([lot, p.name, p.category === 'All Players' ? '' : p.category,
      p.basePrice, r.status, r.team || '', r.price ?? '']);
  }
  return rows
    .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

/** Suggested opening bid: the player's base price, rounded to the step. */
export function openingBid(player, settings) {
  const base = num(player?.basePrice);
  return base > 0 ? base : Math.max(0, num(settings.minBase));
}

/** Increment ladder, scaled to the money in play so the buttons stay useful. */
export function bidSteps(settings) {
  const base = Math.max(1000, num(settings.minBase) || 1000);
  return [base / 4, base / 2, base, base * 2].map(v => Math.max(100, Math.round(v / 100) * 100));
}
