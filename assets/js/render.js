// Rows + settings -> booklet HTML.
//
// Everything here returns strings rather than touching the DOM, so the exact
// same output feeds the on-screen preview, the print view, and the shareable
// single-file export.

import { byRole } from './mapping.js';
import { formatMoney, esc, initials, compareValues } from './format.js';
import { lookupPhoto, isUrl, normalizeKey, normalizeImageUrl } from './images.js';
import { avatarMark } from './avatars.js';
import qrcode from '../vendor/qrcode.mjs';

const LAYOUT = {
  1: { cols: 1, rows: 1, density: 'roomy',  maxStats: 9 },
  2: { cols: 1, rows: 2, density: 'roomy',  maxStats: 9 },
  4: { cols: 2, rows: 2, density: 'normal', maxStats: 6 },
  // 6-up cards are wide but short: a photo on top leaves too little room for
  // the body, so this density moves it alongside.
  6: { cols: 2, rows: 3, density: 'mid',    maxStats: 6 },
  8: { cols: 2, rows: 4, density: 'tight',  maxStats: 4 },
  9: { cols: 3, rows: 3, density: 'tight',  maxStats: 4 },
};

const PAGE_SIZES = {
  a4:     { w: '210mm',   h: '297mm',   mmH: 297,   css: 'A4' },
  letter: { w: '215.9mm', h: '279.4mm', mmH: 279.4, css: 'Letter' },
};

// Millimetre budget for a page, used only by continuous-flow pagination.
// These mirror the paddings in booklet.css; the browser test asserts that
// nothing overflows, so they stay honest.
const PAD = 11, GAP = 4, RHEAD_H = 11.5, RFOOT_H = 8, BAND_H = 11.5;

const INDEX_ROWS_PER_PAGE = 30;
const UNGROUPED = 'All Players';

/* ── step 1: rows -> player objects ─────────────────────────────────────── */

export function normalize(rows, fields, settings, photoIndex = new Map()) {
  const m = byRole(fields);
  const labelOf = Object.fromEntries(fields.map(f => [f.key, f.label]));
  const layout = LAYOUT[settings.perPage] || LAYOUT[4];

  let players = rows.map((row, i) => {
    const name = m.name ? row[m.name] : '';
    const rawId = m.id ? row[m.id] : '';
    const photoValue = m.photo ? row[m.photo] : '';
    const embedded = lookupPhoto(photoIndex, { photoValue, id: rawId, name });

    const pick = keys => (keys || [])
      .map(k => ({ label: labelOf[k] || k, value: row[k] }))
      .filter(x => x.value !== '' && x.value != null);

    return {
      i,
      lot: settings.sequentialLots || !rawId ? String(i + 1) : String(rawId),
      name: String(name || `Player ${i + 1}`),
      category: (m.category ? row[m.category] : '') || UNGROUPED,
      team: m.team ? row[m.team] : '',
      teamLabel: m.team ? (labelOf[m.team] || 'Team') : '',
      basePrice: m.basePrice ? row[m.basePrice] : '',
      baseLabel: m.basePrice ? (labelOf[m.basePrice] || 'Base Price') : 'Base Price',
      photo: embedded || (isUrl(photoValue) ? normalizeImageUrl(photoValue) : null),
      subtitle: pick(m.subtitle),
      badges: pick(m.badge),
      stats: pick(m.stat),
      notes: pick(m.note),
      maxStats: layout.maxStats,
      row,
    };
  });

  if (settings.sortBy) {
    const dir = settings.sortDesc ? -1 : 1;
    players = players
      .map((p, idx) => ({ p, idx }))
      .sort((a, b) => {
        const c = compareValues(a.p.row[settings.sortBy], b.p.row[settings.sortBy]);
        return c !== 0 ? c * dir : a.idx - b.idx;
      })
      .map(x => x.p);
  }
  if (settings.sequentialLots) players.forEach((p, idx) => { p.lot = String(idx + 1); });

  return players;
}

export function groupPlayers(players, groupBy) {
  if (!groupBy) return [{ title: UNGROUPED, players, ungrouped: true }];
  const map = new Map();
  for (const p of players) {
    const key = String(p.row[groupBy] ?? '').trim() || 'Unspecified';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  }
  return [...map.entries()].map(([title, list]) => ({ title, players: list }));
}

/* ── step 2: pagination ─────────────────────────────────────────────────── */

/**
 * Continuous flow: sections run on from one another instead of each starting
 * a fresh page. Pages are packed by millimetre budget and every row track is
 * emitted explicitly, so a card is exactly as tall here as in sectioned mode.
 */
function flowPages(groups, layout, size, grouped) {
  const contentH = size.mmH - 2 * PAD - RHEAD_H - RFOOT_H;
  // Height of a card row on a page with no section band on it.
  const nominal = (contentH - (layout.rows - 1) * GAP) / layout.rows;
  // Bands eat into the card rows on their page, exactly as in sectioned mode.
  // Stop packing once that squeeze would take a row below this much of normal.
  const MIN_SQUEEZE = 0.6;

  const rowHeight = (rows, bands) =>
    (contentH - bands * BAND_H - Math.max(0, rows + bands - 1) * GAP) / rows;

  const pages = [];
  let cur = { items: [], rows: 0, bands: 0 };
  const fits = (addRows, addBands) => {
    const rows = cur.rows + addRows, bands = cur.bands + addBands;
    if (rows > layout.rows) return false;
    return rows === 0 || rowHeight(rows, bands) >= nominal * MIN_SQUEEZE;
  };
  const flush = () => {
    if (cur.items.length) pages.push(cur);
    cur = { items: [], rows: 0, bands: 0 };
  };

  for (const g of groups) {
    if (grouped) {
      // A band claims room for the first row beneath it, so a heading is
      // never left stranded at the foot of a page.
      if (!fits(1, 1)) flush();
      cur.items.push({ type: 'band', group: g });
      cur.bands++;
    }
    for (const cards of chunk(g.players, layout.cols)) {
      if (!fits(1, 0)) flush();
      cur.items.push({ type: 'row', cards, group: g });
      cur.rows++;
    }
  }
  flush();

  for (const pg of pages) {
    // Cap at nominal so a half-empty last page doesn't stretch its cards.
    const h = round(Math.min(nominal, rowHeight(pg.rows, pg.bands)));
    pg.rowsCss = pg.items.map(it => it.type === 'band' ? `${BAND_H}mm` : `${h}mm`).join(' ');
  }
  return pages;
}

const round = n => Math.round(n * 100) / 100;

export function buildBook(players, settings, assets = {}) {
  const layout = LAYOUT[settings.perPage] || LAYOUT[4];
  const size = PAGE_SIZES[settings.pageSize] || PAGE_SIZES.a4;
  const groups = groupPlayers(players, settings.groupBy);
  const grouped = !!settings.groupBy;
  const continuous = settings.sectionBreak === false;

  // Page numbers are worked out first so the index can point at real pages.
  const indexPages = settings.showIndex ? Math.max(1, Math.ceil(players.length / INDEX_ROWS_PER_PAGE)) : 0;
  const teams = parseTeams(settings.teamsText);
  const preludes = (settings.rulesText.trim() ? 1 : 0) + (teams.length ? 1 : 0);
  const firstPlayerPage = 1 + preludes + indexPages;

  let flow = null;
  let playerPageCount;
  if (continuous) {
    flow = flowPages(groups, layout, size, grouped);
    flow.forEach((pg, i) => {
      for (const it of pg.items) {
        if (it.type === 'row') it.cards.forEach(c => { c.page = firstPlayerPage + i; });
      }
    });
    playerPageCount = flow.length;
  } else {
    let n = firstPlayerPage;
    for (const g of groups) {
      g.chunks = chunk(g.players, settings.perPage);
      g.players.forEach((p, i) => { p.page = n + Math.floor(i / settings.perPage); });
      n += g.chunks.length;
    }
    playerPageCount = n - firstPlayerPage;
  }

  const ctx = { settings, layout, size, assets, total: firstPlayerPage + playerPageCount - 1 };
  let pageNo = 1;
  const out = [];

  if (settings.showCover) out.push(coverPage(players, groups, settings, ctx));
  if (settings.rulesText.trim()) out.push(rulesPage(settings, ctx, pageNo++));
  if (teams.length) out.push(teamsPage(teams, settings, ctx, pageNo++));
  for (let i = 0; i < indexPages; i++) {
    out.push(indexPage(players.slice(i * INDEX_ROWS_PER_PAGE, (i + 1) * INDEX_ROWS_PER_PAGE),
      settings, ctx, pageNo++, i, indexPages));
  }
  if (continuous) {
    for (const pg of flow) out.push(flowPage(pg, settings, ctx, pageNo++));
  } else {
    for (const g of groups) {
      g.chunks.forEach((cards, i) => {
        out.push(cardsPage(cards, g, settings, ctx, pageNo++, i, g.chunks.length));
      });
    }
  }

  const style = `--accent:${cssColor(settings.accent)};--pw:${size.w};--ph:${size.h};--cols:${layout.cols};--rows:${layout.rows}`;
  return {
    html: `<div class="bk" data-theme="${esc(settings.theme)}" style="${style}">${out.join('')}</div>`,
    pageCount: out.length,
    pageSizeCss: size.css,
  };
}

/* ── pages ──────────────────────────────────────────────────────────────── */

function coverPage(players, groups, s, ctx) {
  const facts = [
    { n: players.length, l: 'Players' },
    groups.length > 1 ? { n: groups.length, l: 'Categories' } : null,
    parseTeams(s.teamsText).length ? { n: parseTeams(s.teamsText).length, l: 'Teams' } : null,
  ].filter(Boolean);

  const qr = s.qrLink && s.qrLink.trim()
    ? `<div class="cover-qr">${qrSvg(s.qrLink.trim())}
        <span>${esc(s.qrCaption || 'Scan for the digital booklet')}</span></div>`
    : '';

  return page('cover', `
    <div class="cover-band"></div>
    <div class="cover-main">
      ${s.logo ? `<img class="cover-logo" src="${esc(s.logo)}" alt="">` : ''}
      <div class="cover-kicker">Auction Booklet</div>
      <h1 class="cover-title">${esc(s.title || 'Player Auction')}</h1>
      <div class="cover-rule"></div>
      ${s.subtitle ? `<p class="cover-sub">${esc(s.subtitle)}</p>` : ''}
      ${facts.length ? `<div class="cover-facts">${facts.map(f =>
        `<div class="cover-fact"><b>${f.n}</b><span>${f.l}</span></div>`).join('')}</div>` : ''}
      ${qr}
    </div>
    <div class="cover-foot">${esc(s.footer || '')}</div>
    <div class="cover-band"></div>
  `);
}

function rulesPage(s, ctx, no) {
  const blocks = s.rulesText.split(/\n/).map(line => {
    const t = line.trim();
    if (!t) return '';
    if (t.startsWith('#')) return `<h3>${esc(t.replace(/^#+\s*/, ''))}</h3>`;
    return `<p>${esc(t)}</p>`;
  }).join('');
  return page('', rhead(s) + `<h2 class="ptitle">Rules &amp; Information</h2>
    <div class="rules">${blocks}</div>` + rfoot(s, ctx, no));
}

function teamsPage(teams, s, ctx, no) {
  const slots = Math.max(3, Number(s.teamSlots) || 8);
  const logos = ctx.assets.teamLogos || new Map();
  return page('', rhead(s) + `
    <h2 class="ptitle">Teams<small>${teams.length} squads</small></h2>
    <div class="teams">${teams.map(t => {
      const logo = logos.get(normalizeKey(t.name));
      return `<div class="team">
        <div class="team-head">
          ${logo ? `<img class="team-logo" src="${esc(logo)}" alt="">` : ''}
          <div>
            <h3>${esc(t.name)}</h3>
            ${t.purse ? `<div class="purse">Purse ${esc(formatMoney(t.purse, s.currency, s.numberFormat))}</div>` : ''}
          </div>
        </div>
        <div class="slots">${Array.from({ length: slots }, () => '<div class="slot"></div>').join('')}</div>
      </div>`;
    }).join('')}</div>` + rfoot(s, ctx, no));
}

function indexPage(rows, s, ctx, no, part, parts) {
  const showCat = !!s.groupBy;
  const showTeam = rows.some(p => p.team);
  const showBase = rows.some(p => p.basePrice !== '');
  return page('', rhead(s) + `
    <h2 class="ptitle">Index of Players${parts > 1 ? `<small>Part ${part + 1} of ${parts}</small>` : ''}</h2>
    <table class="idx">
      <thead><tr>
        <th class="c-lot">Lot</th><th>Player</th>
        ${showCat ? '<th>Category</th>' : ''}
        ${showTeam ? '<th>Team</th>' : ''}
        ${showBase ? '<th class="c-num">Base</th>' : ''}
        <th class="c-pg">Pg</th>
      </tr></thead>
      <tbody>${rows.map(p => `<tr>
        <td class="c-lot">${esc(p.lot)}</td>
        <td class="c-name">${esc(p.name)}</td>
        ${showCat ? `<td>${esc(p.row[s.groupBy] || '—')}</td>` : ''}
        ${showTeam ? `<td>${esc(p.team || '—')}</td>` : ''}
        ${showBase ? `<td class="c-num">${esc(formatMoney(p.basePrice, s.currency, s.numberFormat) || '—')}</td>` : ''}
        <td class="c-pg">${p.page}</td>
      </tr>`).join('')}</tbody>
    </table>` + rfoot(s, ctx, no));
}

/** One page in sectioned mode: a single section's cards on a fixed grid. */
function cardsPage(cards, group, s, ctx, no, part, parts) {
  const band = group.ungrouped ? '' : sectionBand(group, parts > 1 ? `${part + 1}/${parts}` : '');
  return page('', rhead(s, group.ungrouped ? 'Players' : group.title) + band + `
    <div class="cards" data-density="${ctx.layout.density}" data-photos="${s.showPhotos ? 'on' : 'off'}">
      ${cards.map(p => card(p, s)).join('')}
    </div>` + rfoot(s, ctx, no));
}

/** One page in continuous mode: bands and card rows interleaved in one grid. */
function flowPage(pg, s, ctx, no) {
  const first = pg.items.find(i => i.group);
  const items = pg.items.map(it => it.type === 'band'
    ? sectionBand(it.group, '')
    : it.cards.map(p => card(p, s)).join('')).join('');
  return page('', rhead(s, first && !first.group.ungrouped ? first.group.title : 'Players') + `
    <div class="cards flow" data-density="${ctx.layout.density}" data-photos="${s.showPhotos ? 'on' : 'off'}"
         style="grid-template-rows:${pg.rowsCss}">
      ${items}
    </div>` + rfoot(s, ctx, no));
}

const sectionBand = (group, suffix) => `
  <div class="sband">
    <h2>${esc(group.title)}</h2>
    <span>${group.players.length} player${group.players.length === 1 ? '' : 's'}${suffix ? ` · ${suffix}` : ''}</span>
  </div>`;

/* ── the player card ────────────────────────────────────────────────────── */

function card(p, s) {
  const stats = p.stats.slice(0, p.maxStats);
  // The initials always sit underneath, and the photo covers them. A URL that
  // fails — a Drive folder that was never shared, a booklet read offline —
  // then falls back to something that looks deliberate instead of broken.
  const photo = s.showPhotos
    ? `<div class="card-photo">
       <div class="noimg">${avatarMark(p, s.avatarStyle, s.accent)}</div>
       ${p.photo ? `<img src="${esc(p.photo)}" alt="" loading="lazy">` : ''}
       <div class="lot">${esc(p.lot)}</div></div>`
    : `<div class="card-photo"></div>`;

  const sub = [p.team && p.teamLabel ? p.team : '', ...p.subtitle.map(x => x.value)]
    .filter(Boolean).join(' · ');

  return `<article class="card">
    ${photo}
    <div class="card-body">
      ${s.showPhotos ? '' : `<div class="lot">${esc(p.lot)}</div>`}
      <h3 class="card-name">${esc(p.name)}</h3>
      ${sub ? `<div class="card-sub">${esc(sub)}</div>` : ''}
      ${p.badges.length ? `<div class="pills">${p.badges.map(b =>
        `<span class="pill">${esc(b.value === 'Yes' || b.value === 'yes' || b.value === 'TRUE' ? b.label : b.value)}</span>`).join('')}</div>` : ''}
      ${stats.length ? `<dl class="stats">${stats.map(st =>
        `<div class="stat"><dt>${esc(st.label)}</dt><dd>${esc(st.value)}</dd></div>`).join('')}</dl>` : ''}
      ${p.notes.length ? `<div class="note">${esc(p.notes.map(n => n.value).join(' · '))}</div>` : ''}
      <div class="card-foot">
        ${p.basePrice !== '' ? `<div class="base">
          <span class="k">${esc(p.baseLabel)}</span>
          <span class="v">${esc(formatMoney(p.basePrice, s.currency, s.numberFormat))}</span>
        </div>` : ''}
        ${s.writeIn ? `<div class="writein">
          <div><span>Sold to</span></div><div><span>Price</span></div>
        </div>` : ''}
      </div>
    </div>
  </article>`;
}

/* ── drafted teams sheet ────────────────────────────────────────────────── */

/**
 * The balanced-draft equivalent of the booklet: one printable sheet listing
 * each squad. Uses the booklet's own page styling so it prints on the same
 * paper with the same identity.
 */
export function buildDraftSheet(teams, settings, { ratingOf = () => null, spread = null } = {}) {
  const size = PAGE_SIZES[settings.pageSize] || PAGE_SIZES.a4;
  const showRating = teams.some(t => t.players.some(p => ratingOf(p) != null));

  const blocks = teams.map(t => `
    <div class="squad">
      <div class="squad-head">
        <h3>${esc(t.name)}</h3>
        <div class="m">${t.players.length} player${t.players.length === 1 ? '' : 's'}
          ${showRating ? `<b>${t.average} avg</b>` : ''}</div>
      </div>
      <table>${t.players.map((p, i) => `<tr>
        <td class="n">${i + 1}</td>
        <td>${esc(p.name)}${p.category && p.category !== 'All Players'
          ? ` <span class="sq-cat">· ${esc(p.category)}</span>` : ''}</td>
        ${showRating ? `<td class="p">${esc(ratingOf(p) ?? '—')}</td>` : ''}
      </tr>`).join('')}</table>
    </div>`).join('');

  const style = `--accent:${cssColor(settings.accent)};--pw:${size.w};--ph:${size.h}`;
  return {
    html: `<div class="bk" data-theme="${esc(settings.theme)}" style="${style}">
      <section class="page grow">
        <h2 class="ptitle">Teams<small>${esc(settings.title || 'Draft')}${
          settings.subtitle ? ` · ${esc(settings.subtitle)}` : ''}</small></h2>
        ${spread ? `<p class="draft-note">Squads drawn to balance player ratings —
          the strongest and weakest sides are ${spread.averageGap} apart on average rating.</p>` : ''}
        <div class="squads">${blocks}</div>
        <div class="draft-foot">${esc(settings.footer || '')}</div>
      </section>
    </div>`,
    pageCount: 1,
    pageSizeCss: size.css,
  };
}

/* ── small helpers ──────────────────────────────────────────────────────── */

/** Print-quality QR as inline SVG — one path, no raster, no runtime dependency. */
export function qrSvg(text, dark = '#16130f') {
  const qr = qrcode(0, 'M');
  qr.addData(String(text));
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  }
  const m = 2;
  return `<svg class="qr" viewBox="${-m} ${-m} ${n + m * 2} ${n + m * 2}" role="img" aria-label="QR code">`
    + `<rect x="${-m}" y="${-m}" width="${n + m * 2}" height="${n + m * 2}" fill="#fff"/>`
    + `<path d="${d}" fill="${dark}"/></svg>`;
}

const page = (cls, inner) => `<section class="page ${cls}">${inner}</section>`;

const rhead = (s, right = '') => `<div class="rhead">
  <span><strong>${esc(s.title || 'Auction')}</strong>${s.subtitle ? ` · ${esc(s.subtitle)}` : ''}</span>
  <span>${esc(right)}</span></div>`;

const rfoot = (s, ctx, no) => `<div class="rfoot">
  <span>${esc(s.footer || '')}</span>
  <span class="pageno">${no} / ${ctx.total}</span></div>`;

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out.length ? out : [[]];
}

export function parseTeams(text) {
  return String(text || '').split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const parts = line.split(',');
    return { name: parts[0].trim(), purse: parts[1] ? parts[1].trim() : '' };
  }).filter(t => t.name);
}

function cssColor(v) {
  return /^#[0-9a-f]{3,8}$/i.test(String(v || '')) ? v : '#c2410c';
}

export { LAYOUT, PAGE_SIZES };
