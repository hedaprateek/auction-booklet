// Flex banners — the vinyl sheets that go up on the society gate.
//
// Printers here work in feet and take a PDF at true size, so that is what this
// produces: the artwork is laid out at its real dimensions (a 6 × 4 ft banner
// is a 72 × 48 inch page) and printed straight to PDF. Text stays vector, so it
// is sharp however large the shop blows it up, and the photos ride along as
// embedded data.
//
// Every measurement is a multiple of --u, one hundredth of the banner's
// shorter edge. That way a single template holds together at 2 × 3 ft and at
// 10 × 6 ft without a second set of sizes.

import { esc, formatMoney, initials } from './format.js';
import { avatarMark } from './avatars.js';
import { parseTeams } from './render.js';
import { normalizeKey } from './images.js';

export const FLEX_SIZES = [
  { id: '6x4',  label: '6 × 4 ft — gate backdrop', w: 6,  h: 4 },
  { id: '8x4',  label: '8 × 4 ft — wide backdrop', w: 8,  h: 4 },
  { id: '10x6', label: '10 × 6 ft — stage',        w: 10, h: 6 },
  { id: '4x6',  label: '4 × 6 ft — portrait',      w: 4,  h: 6 },
  { id: '3x6',  label: '3 × 6 ft — standee',       w: 3,  h: 6 },
  { id: '2x3',  label: '2 × 3 ft — notice board',  w: 2,  h: 3 },
];

export const FLEX_TEMPLATES = [
  { id: 'event',     label: 'Event announcement' },
  { id: 'squad',     label: 'Team squad' },
  { id: 'winners',   label: 'Winners' },
  { id: 'spotlight', label: 'Player spotlight' },
];

export { squadColumns };

export const getFlexSize = id => FLEX_SIZES.find(s => s.id === id) || FLEX_SIZES[0];

/* ── builder ────────────────────────────────────────────────────────────── */

export function buildFlex(cfg, ctx = {}) {
  const size = cfg.customW && cfg.customH
    ? { w: Number(cfg.customW), h: Number(cfg.customH) }
    : getFlexSize(cfg.sizeId);
  const wIn = Math.max(6, size.w * 12);
  const hIn = Math.max(6, size.h * 12);

  const aspect = wIn / hIn;
  const body = {
    event: eventBanner,
    squad: squadBanner,
    winners: winnersBanner,
    spotlight: spotlightBanner,
  }[cfg.template] || eventBanner;

  // --u is 1% of the SHORTER edge. Scaling from height alone made the type
  // enormous relative to the width on a tall, narrow banner — a 3 x 6 ft
  // standee got the same headline size as a 10 ft stage backdrop.
  const style = [
    `--u:${Math.min(wIn, hIn) / 100}in`,
    `--fw:${wIn}in`,
    `--fh:${hIn}in`,
    `--accent:${cssColor(cfg.accent)}`,
    `--ink:${cfg.dark ? '#ffffff' : '#141210'}`,
    `--ground:${cfg.dark ? '#141210' : '#ffffff'}`,
  ].join(';');

  ctx = { ...ctx, aspect };
  return {
    html: `<div class="flexwrap"><div class="flex-banner${cfg.safe ? ' safe' : ''}"
      data-tpl="${esc(cfg.template)}" style="${style}">
      ${cfg.bg ? `<img class="fx-bg" src="${esc(cfg.bg)}" alt="" style="opacity:${
        Math.max(0, Math.min(1, Number(cfg.bgOpacity ?? 0.25)))}">` : ''}
      <div class="fx-inner">${body(cfg, ctx)}</div>
    </div></div>`,
    wIn,
    hIn,
    pageSizeCss: `${wIn}in ${hIn}in`,
    label: `${size.w} × ${size.h} ft`,
  };
}

/* ── templates ──────────────────────────────────────────────────────────── */

function header(cfg) {
  return `
    ${cfg.logo ? `<img class="fx-logo" src="${esc(cfg.logo)}" alt="">` : ''}
    ${cfg.kicker ? `<div class="fx-kicker">${esc(cfg.kicker)}</div>` : ''}
    <h1 class="fx-title">${esc(cfg.title || 'Tournament')}</h1>
    ${cfg.subtitle ? `<div class="fx-sub">${esc(cfg.subtitle)}</div>` : ''}`;
}

function footer(cfg) {
  const bits = [cfg.venue, cfg.date].filter(Boolean);
  return `
    ${bits.length ? `<div class="fx-band">${bits.map(b =>
      `<span>${esc(b)}</span>`).join('<i></i>')}</div>` : ''}
    ${cfg.footer ? `<div class="fx-foot">${esc(cfg.footer)}</div>` : ''}
    ${cfg.sponsors ? `<div class="fx-sponsors">
      <span class="fx-sp-label">${esc(cfg.sponsorLabel || 'Our sponsors')}</span>
      <div class="fx-sp-list">${cfg.sponsors.split('\n').map(s => s.trim()).filter(Boolean)
        .map(s => `<span>${esc(s)}</span>`).join('')}</div>
    </div>` : ''}`;
}

const eventBanner = (cfg, ctx) => `
  <div class="fx-stack">
    ${header(cfg)}
    ${cfg.blurb ? `<p class="fx-blurb">${esc(cfg.blurb)}</p>` : ''}
    ${ctx.facts?.length ? `<div class="fx-facts">${ctx.facts.map(f =>
      `<div><b>${esc(f.n)}</b><span>${esc(f.l)}</span></div>`).join('')}</div>` : ''}
  </div>
  ${footer(cfg)}`;

/**
 * Columns have to follow the banner's shape, not just the headcount: five
 * across is right on a 10 ft stage banner and spills off a 2 ft notice.
 */
function squadColumns(n, aspect) {
  const max = aspect >= 1.6 ? 5 : aspect >= 1.1 ? 4 : 3;
  return Math.max(1, Math.min(max, n, Math.round(Math.sqrt(n * aspect)) || 1));
}

function squadBanner(cfg, ctx) {
  const list = (ctx.squad || []).slice(0, 20);
  const cols = squadColumns(list.length, (ctx.aspect || 1.5));
  const money = v => formatMoney(v, ctx.settings?.currency, ctx.settings?.numberFormat);
  return `
    <div class="fx-stack tight">
      ${cfg.teamLogo ? `<img class="fx-logo" src="${esc(cfg.teamLogo)}" alt="">` : ''}
      ${cfg.kicker ? `<div class="fx-kicker">${esc(cfg.kicker)}</div>` : ''}
      <h1 class="fx-title">${esc(cfg.teamName || cfg.title || 'Squad')}</h1>
      ${cfg.subtitle ? `<div class="fx-sub">${esc(cfg.subtitle)}</div>` : ''}
    </div>
    ${list.length ? `<div class="fx-squad" style="--cols:${cols}">
      ${list.map(p => `<figure class="fx-p">
        <div class="fx-p-img">${p.photo
          ? `<img src="${esc(p.photo)}" alt="">`
          : avatarMark(p, ctx.settings?.avatarStyle || 'monogram', cfg.accent)}</div>
        <figcaption>
          <span class="n">${esc(p.name)}</span>
          ${p.price != null ? `<span class="m">${esc(money(p.price))}</span>`
            : p.category && p.category !== 'All Players' ? `<span class="m">${esc(p.category)}</span>` : ''}
        </figcaption>
      </figure>`).join('')}
    </div>` : '<p class="fx-blurb">Pick a team with players in it.</p>'}
    ${footer(cfg)}`;
}

function winnersBanner(cfg, ctx) {
  const places = (ctx.winners || []).slice(0, 3);
  return `
    <div class="fx-stack tight">${header(cfg)}</div>
    <div class="fx-winners">
      ${places.map((w, i) => `<div class="fx-w" data-place="${i + 1}">
        <div class="fx-w-img">${w.photo
          ? `<img src="${esc(w.photo)}" alt="">`
          : avatarMark(w, ctx.settings?.avatarStyle || 'monogram', cfg.accent)}</div>
        <div class="fx-w-place">${['1st', '2nd', '3rd'][i]}</div>
        <div class="fx-w-name">${esc(w.name)}</div>
        ${w.note ? `<div class="fx-w-note">${esc(w.note)}</div>` : ''}
      </div>`).join('')}
    </div>
    ${footer(cfg)}`;
}

function spotlightBanner(cfg, ctx) {
  const p = ctx.spotlight;
  return `
    <div class="fx-spot">
      <div class="fx-spot-img">${p?.photo
        ? `<img src="${esc(p.photo)}" alt="">`
        : avatarMark(p || { name: cfg.title || '?' }, ctx.settings?.avatarStyle || 'monogram', cfg.accent)}</div>
      <div class="fx-spot-text">
        ${cfg.logo ? `<img class="fx-logo" src="${esc(cfg.logo)}" alt="">` : ''}
        ${cfg.kicker ? `<div class="fx-kicker">${esc(cfg.kicker)}</div>` : ''}
        <h1 class="fx-title">${esc(p?.name || cfg.title || 'Player')}</h1>
        ${p?.category && p.category !== 'All Players'
          ? `<div class="fx-sub">${esc(p.category)}</div>` : ''}
        ${p?.stats?.length ? `<div class="fx-spot-stats">${p.stats.slice(0, 4).map(s =>
          `<div><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join('')}</div>` : ''}
        ${cfg.blurb ? `<p class="fx-blurb">${esc(cfg.blurb)}</p>` : ''}
        ${footer(cfg)}
      </div>
    </div>`;
}

const cssColor = v => (/^#[0-9a-f]{3,8}$/i.test(String(v || '')) ? v : '#c2410c');

/* ── picking the people who go on it ────────────────────────────────────── */

/**
 * Who counts as a team's squad, in order of how definitive the source is:
 * what the auction actually sold, then a drawn team, then a Team column.
 */
export function squadFor(teamName, { auction, draft, players }) {
  if (!teamName || !players?.length) return [];
  const byLot = new Map(players.map(p => [p.lot, p]));

  if (auction?.results) {
    const sold = Object.entries(auction.results)
      .filter(([, r]) => r.status === 'sold' && r.team === teamName)
      .map(([lot, r]) => ({ ...byLot.get(lot), price: r.price }))
      .filter(p => p.name);
    if (sold.length) return sold;
  }
  const drawn = draft?.find(t => t.name === teamName);
  if (drawn?.players?.length) return drawn.players;

  return players.filter(p => p.team === teamName);
}

export const teamNames = (settings, draft) => {
  const fromSettings = parseTeams(settings.teamsText).map(t => t.name);
  const fromDraft = (draft || []).map(t => t.name);
  return [...new Set([...fromSettings, ...fromDraft])];
};

export const teamLogoFor = (name, teamLogos) =>
  (teamLogos || new Map()).get(normalizeKey(name)) || '';
