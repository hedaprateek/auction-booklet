// Documents for the people doing the bidding, rather than the ones running it.
//
// A team owner needs three things an organiser's booklet does not give them:
// a plan for dividing the purse before the auction, somewhere to write each
// purchase down as it happens, and — at every moment — the one number that
// actually governs the next bid.
//
// That number is not the balance. An owner holding ₹80,000 with four squad
// slots still to fill cannot bid ₹80,000: three of those slots must still be
// bought at the minimum. So
//
//     max bid now = balance − (slots still to fill − 1) × minimum base price
//
// Every sheet here is built around it.

import { esc, formatMoney } from './format.js';
import { parseTeams } from './render.js';
import { normalizeKey } from './images.js';

const PAGE_SIZES = {
  a4:     { w: '210mm',   h: '297mm',   css: 'A4', rows: 22 },
  letter: { w: '215.9mm', h: '279.4mm', css: 'Letter', rows: 21 },
};

const num = v => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
};

/** Reserve the owner must hold back with `slots` still to fill, bidding on one. */
export const reserveFor = (slots, minBase) => Math.max(0, slots - 1) * minBase;
export const maxBid = (balance, slots, minBase) =>
  Math.max(0, balance - reserveFor(slots, minBase));

/* ── the one sheet ──────────────────────────────────────────────────────── */

/**
 * Everything an owner needs on a single side of A4: their own purchases with a
 * running balance down the left, and every other team's down the right, because
 * a rival running out of money changes what you should bid.
 *
 * This is the default. The multi-page pack below still exists for anyone who
 * wants a sheet per purpose, but one page is what actually gets carried to a
 * table and written on.
 */
export function buildOwnerSheet(settings, { teamLogos = new Map() } = {}) {
  const size = PAGE_SIZES[settings.pageSize] || PAGE_SIZES.a4;
  const teams = parseTeams(settings.teamsText);
  const list = teams.length ? teams : [{ name: 'Team', purse: '' }];
  const minSquad = Math.max(1, Number(settings.minSquad) || 11);
  const maxSquad = Math.max(minSquad, Number(settings.maxSquad) || minSquad + 3);
  const minBase = Math.max(0, num(settings.minBase));
  const money = v => formatMoney(v, settings.currency, settings.numberFormat);

  const pages = list.map(team => {
    const purse = num(team.purse);
    const others = list.filter(t => t.name !== team.name);
    // A row per squad slot; the rows then stretch to fill the page.
    const mine = Math.min(Math.max(maxSquad, 11), 20);
    // Past four rivals a single row of columns gets too narrow to write a name
    // in, so they wrap onto two shorter rows instead — and fewer rows fit.
    const wrapped = others.length > 4;
    const cols = wrapped ? Math.ceil(others.length / 2) : (others.length || 1);
    const theirs = wrapped ? Math.min(mine, 10) : mine;

    return page('owner-one', `
      ${ownerHead(team, teamLogos.get(normalizeKey(team.name)), settings, money, purse)}
      <div class="one-rule">
        Squad ${minSquad}–${maxSquad} · lowest base ${esc(minBase ? money(minBase) : '—')} ·
        <strong>max bid = balance − (slots still to fill − 1) × lowest base</strong>
      </div>
      <div class="one-cols">
        <section class="one-mine">
          <h3>My squad</h3>
          <table class="one-t">
            <thead><tr><th class="c-n">#</th><th>Player</th>
              <th class="c-m">Price</th><th class="c-m">Balance</th></tr></thead>
            <tbody>
              <tr class="one-open"><td class="c-n"></td><td>Opening purse</td>
                <td class="c-m"></td><td class="c-m v">${esc(purse ? money(purse) : '')}</td></tr>
              ${Array.from({ length: mine }, (_, i) => `<tr>
                <td class="c-n">${i + 1}</td><td></td><td class="c-m"></td><td class="c-m"></td>
              </tr>`).join('')}
              <tr class="one-tot"><td class="c-n"></td><td class="lbl">Spent</td>
                <td class="c-m"></td><td class="c-m lbl">Left</td></tr>
            </tbody>
          </table>
        </section>

        <section class="one-others">
          <h3>Other teams</h3>
          <div class="one-grid" style="--n:${cols}">
            ${others.map(t => `<div class="one-team">
              <div class="one-team-n">${esc(t.name)}</div>
              <div class="one-team-p">${t.purse ? esc(money(num(t.purse))) : '—'}</div>
              <table class="one-mini">
                <thead><tr><th>Player</th><th class="c-m">Price</th></tr></thead>
                <tbody>${Array.from({ length: theirs }, () =>
                  '<tr><td></td><td class="c-m"></td></tr>').join('')}
                  <tr class="one-tot"><td class="lbl">Left</td><td class="c-m"></td></tr>
                </tbody>
              </table>
            </div>`).join('')}
          </div>
        </section>
      </div>
      ${ownerFoot(settings)}
    `);
  });

  const style = `--accent:${cssColor(settings.accent)};--pw:${size.w};--ph:${size.h}`;
  return {
    html: `<div class="bk" data-theme="${esc(settings.theme || 'classic')}" style="${style}">${pages.join('')}</div>`,
    pageCount: pages.length,
    pageSizeCss: size.css,
  };
}

/* ── printed pack ───────────────────────────────────────────────────────── */

export function buildOwnerPacks(settings, { teamLogos = new Map(), categories = [] } = {}) {
  const size = PAGE_SIZES[settings.pageSize] || PAGE_SIZES.a4;
  const teams = parseTeams(settings.teamsText);
  const minSquad = Math.max(1, Number(settings.minSquad) || 11);
  const maxSquad = Math.max(minSquad, Number(settings.maxSquad) || minSquad + 3);
  const minBase = Math.max(0, num(settings.minBase));
  const money = v => formatMoney(v, settings.currency, settings.numberFormat);
  const pages = [];

  for (const team of (teams.length ? teams : [{ name: 'Team', purse: '' }])) {
    const purse = num(team.purse);
    const logo = teamLogos.get(normalizeKey(team.name));

    // How much is still spendable with N slots left, before anything is bought.
    const ladder = [];
    for (let slots = minSquad; slots >= 1; slots--) {
      ladder.push({ slots, reserve: reserveFor(slots, minBase) });
    }

    pages.push(page('owner-brief', `
      ${ownerHead(team, logo, settings, money, purse)}
      <div class="ow-grid">
        <div class="ow-box">
          <h3>Your purse</h3>
          <table class="ow-kv">
            <tr><td>Total points</td><td class="v">${esc(purse ? money(purse) : '—')}</td></tr>
            <tr><td>Squad minimum</td><td class="v">${minSquad}</td></tr>
            <tr><td>Squad maximum</td><td class="v">${maxSquad}</td></tr>
            <tr><td>Lowest base price</td><td class="v">${esc(minBase ? money(minBase) : '—')}</td></tr>
            <tr><td>Average per player</td><td class="v">${esc(purse && minSquad ? money(Math.round(purse / minSquad)) : '—')}</td></tr>
          </table>
        </div>
        <div class="ow-box">
          <h3>How the bidding works</h3>
          <ol class="ow-steps">
            <li>Write every purchase into the ledger overleaf as soon as the hammer falls.</li>
            <li>Subtract it from your balance in the same row — do not leave it until later.</li>
            <li>Before each bid, check <strong>max bid now</strong>: your balance minus the money
                you must keep back to fill your remaining slots.</li>
            <li>You cannot leave the auction below ${minSquad} players.</li>
          </ol>
        </div>
      </div>

      <h3 class="ow-h">Dividing the purse</h3>
      <p class="ow-note">What you can spend on one player, by how many squad slots you still
        have to fill. Every remaining slot after this one still costs at least
        ${esc(minBase ? money(minBase) : 'the minimum base price')}.</p>
      <table class="ow-ladder">
        <thead><tr><th>Slots still to fill</th><th>Must keep back</th><th class="v">Most you can bid</th></tr></thead>
        <tbody>${ladder.map(l => `<tr>
          <td>${l.slots}</td>
          <td>${esc(money(l.reserve))}</td>
          <td class="v">${esc(purse ? money(Math.max(0, purse - l.reserve)) : '—')}</td>
        </tr>`).join('')}</tbody>
      </table>
      <p class="ow-note">The last column assumes a full purse. Once you have bought someone,
        work from your own balance instead — the middle column does not change.</p>

      ${categories.length ? `
        <h3 class="ow-h">Squad checklist</h3>
        <div class="ow-check">${categories.map(c => `
          <div class="ow-cat"><span>${esc(c)}</span><i></i><i></i><i></i><i></i></div>`).join('')}
        </div>` : ''}
      ${ownerFoot(settings)}
    `));

    // ── the ledger ──
    const rows = Math.max(size.rows, maxSquad + 4);
    pages.push(page('owner-ledger', `
      ${ownerHead(team, logo, settings, money, purse, 'Bidding record')}
      <table class="ow-led">
        <thead><tr>
          <th class="c-n">#</th>
          <th>Player</th>
          <th class="c-cat">Category</th>
          <th class="c-m">Base</th>
          <th class="c-m">Price paid</th>
          <th class="c-m">Balance left</th>
          <th class="c-s">Slots left</th>
        </tr></thead>
        <tbody>
          <tr class="ow-open">
            <td class="c-n"></td><td colspan="4">Opening purse</td>
            <td class="c-m v">${esc(purse ? money(purse) : '')}</td>
            <td class="c-s">${minSquad}</td>
          </tr>
          ${Array.from({ length: rows }, (_, i) => `<tr>
            <td class="c-n">${i + 1}</td><td></td><td class="c-cat"></td>
            <td class="c-m"></td><td class="c-m"></td><td class="c-m"></td><td class="c-s"></td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="ow-sign">
        <div><span>Team owner</span></div>
        <div><span>Auctioneer</span></div>
      </div>
      ${ownerFoot(settings)}
    `));

    // The rest of the kit: this owner's view of everybody else.
    const head = kicker => ownerHead(team, logo, settings, money, purse, kicker);
    if (settings.packAllTeams !== false && teams.length) {
      pages.push(...allTeamsPages(teams, settings, size, money, head));
    }
    if (settings.packSaleLog !== false) {
      pages.push(...saleLogPages(settings, size, head, Number(settings.packLogPages) || 2));
    }
    if (settings.packUnsold !== false) pages.push(unsoldPage(settings, size, head));
  }

  const style = `--accent:${cssColor(settings.accent)};--pw:${size.w};--ph:${size.h}`;
  return {
    html: `<div class="bk" data-theme="${esc(settings.theme || 'classic')}" style="${style}">${pages.join('')}</div>`,
    pageCount: pages.length,
    pageSizeCss: size.css,
  };
}

/* ── sheets for tracking the whole room ─────────────────────────────────── */

/**
 * Owners do not only watch their own purse — they watch everyone's, because a
 * rival running out of money changes what you should bid. These are the blank
 * sheets they keep that on.
 */

/** Teams across the top, purchases down the side, totals at the foot. */
function allTeamsPages(teams, s, size, money, head) {
  const perPage = 4;                      // more than four and the columns die
  const rows = Math.max(12, Number(s.minSquad) || 11);
  const groups = [];
  for (let i = 0; i < teams.length; i += perPage) groups.push(teams.slice(i, i + perPage));

  return groups.map((group, gi) => page('owner-ledger', `
    ${head(`Every team · ${gi + 1} of ${groups.length}`)}
    <p class="ow-note">Write each purchase under the team that won it. The totals at
      the foot are what everyone has left to bid with.</p>
    <table class="ow-all">
      <thead>
        <tr><th class="c-n" rowspan="2">#</th>${group.map(t =>
          `<th colspan="2">${esc(t.name)}</th>`).join('')}</tr>
        <tr>${group.map(() => '<th class="c-sub">Player</th><th class="c-sub c-m">Price</th>').join('')}</tr>
      </thead>
      <tbody>
        ${Array.from({ length: rows }, (_, i) => `<tr>
          <td class="c-n">${i + 1}</td>
          ${group.map(() => '<td></td><td class="c-m"></td>').join('')}
        </tr>`).join('')}
        <tr class="ow-tot"><td class="c-n"></td>${group.map(() =>
          '<td class="lbl">Spent</td><td class="c-m"></td>').join('')}</tr>
        <tr class="ow-tot"><td class="c-n"></td>${group.map(t =>
          `<td class="lbl">Purse left${t.purse ? ` of ${esc(money(num(t.purse)))}` : ''}</td>
           <td class="c-m"></td>`).join('')}</tr>
      </tbody>
    </table>
    ${ownerFoot(s)}`));
}

/** One line per sale, in the order the auctioneer calls them. */
function saleLogPages(s, size, head, pages = 2) {
  // Row height is 8.4mm; more than this and the table runs off the sheet.
  const rows = size.rows + 3;
  return Array.from({ length: pages }, (_, i) => page('owner-ledger', `
    ${head(`Sale log · sheet ${i + 1} of ${pages}`)}
    <table class="ow-led">
      <thead><tr>
        <th class="c-n">#</th><th class="c-n">Lot</th><th>Player</th>
        <th class="c-cat">Category</th><th class="c-cat">Sold to</th><th class="c-m">Price</th>
      </tr></thead>
      <tbody>${Array.from({ length: rows }, (_, r) => `<tr>
        <td class="c-n">${i * rows + r + 1}</td><td class="c-n"></td><td></td>
        <td class="c-cat"></td><td class="c-cat"></td><td class="c-m"></td>
      </tr>`).join('')}</tbody>
    </table>
    ${ownerFoot(s)}`));
}

/** The pile that comes back round. */
function unsoldPage(s, size, head) {
  return page('owner-ledger', `
    ${head('Unsold register')}
    <p class="ow-note">Players who went unsold in the first round. Tick them off as they
      come back up, and note what they finally went for.</p>
    <table class="ow-led">
      <thead><tr>
        <th class="c-n">#</th><th class="c-n">Lot</th><th>Player</th>
        <th class="c-m">Base</th><th class="c-tick">Called again</th>
        <th class="c-cat">Sold to</th><th class="c-m">Price</th>
      </tr></thead>
      <tbody>${Array.from({ length: size.rows - 1 }, (_, r) => `<tr>
        <td class="c-n">${r + 1}</td><td class="c-n"></td><td></td>
        <td class="c-m"></td><td class="c-tick"><i></i></td>
        <td class="c-cat"></td><td class="c-m"></td>
      </tr>`).join('')}</tbody>
    </table>
    ${ownerFoot(s)}`);
}

const ownerHead = (team, logo, s, money, purse, kicker = "Team owner's pack") => `
  <div class="ow-head">
    ${logo ? `<img class="ow-logo" src="${esc(logo)}" alt="">` : ''}
    <div class="ow-id">
      <span class="ow-kicker">${esc(kicker)}</span>
      <h2>${esc(team.name)}</h2>
      <p>${esc(s.title || '')}${s.subtitle ? ` · ${esc(s.subtitle)}` : ''}</p>
    </div>
    ${purse ? `<div class="ow-purse"><span>Purse</span><strong>${esc(money(purse))}</strong></div>` : ''}
  </div>`;

const ownerFoot = s => `<div class="ow-foot">${esc(s.footer || '')}
  <span>Stunity tech - by Prateek</span></div>`;

const page = (cls, inner) => `<section class="page ${cls}">${inner}</section>`;
const cssColor = v => (/^#[0-9a-f]{3,8}$/i.test(String(v || '')) ? v : '#c2410c');

/* ── bidding workbook ───────────────────────────────────────────────────── */

const cell = (r, c) => XLSX.utils.encode_cell({ r, c });
/** SheetJS drops formula cells with no cached value — see judging.js. */
const formula = f => ({ t: 'n', f, v: 0 });
const safeSheet = n => String(n).replace(/[:\\/?*[\]]/g, '-').slice(0, 31) || 'Team';

/**
 * One tab per team. The owner types a price into Price paid and everything
 * else — spent, balance, slots left, and what they can still bid — follows.
 */
export function buildOwnerWorkbook(settings, { rows = 24 } = {}) {
  const teams = parseTeams(settings.teamsText);
  const list = teams.length ? teams : [{ name: 'Team 1', purse: '' }];
  const minSquad = Math.max(1, Number(settings.minSquad) || 11);
  const minBase = Math.max(0, num(settings.minBase));
  const wb = XLSX.utils.book_new();
  const names = list.map(t => safeSheet(t.name));

  const HEAD = 7;                      // 0-based row of the ledger header
  const first = HEAD + 1;
  const last = first + rows - 1;

  list.forEach((team, ti) => {
    const purse = num(team.purse);
    const aoa = [
      ['Team', team.name],
      ['Purse', purse],
      ['Squad minimum', minSquad],
      ['Lowest base price', minBase],
      [],
      ['Bought', null, 'Spent', null, 'Balance', null, 'MAX BID NOW', null],
      [],
      ['#', 'Player', 'Category', 'Base', 'Price paid', 'Spent so far', 'Balance', 'Slots left'],
    ];
    for (let i = 0; i < rows; i++) aoa.push([i + 1, '', '', '', '', null, null, null]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    const priceRange = `E${first + 1}:E${last + 1}`;   // 1-based for formulas
    // Live summary — the block the owner actually watches.
    ws.B6 = formula(`COUNT(${priceRange})`);
    ws.D6 = formula(`SUM(${priceRange})`);
    ws.F6 = formula('B2-D6');
    // Balance, minus the reserve for every slot after the one being bid on.
    ws.H6 = formula('MAX(0,F6-MAX(0,B3-B6-1)*B4)');

    for (let i = 0; i < rows; i++) {
      const r = first + i, n = r + 1;                   // n = 1-based row
      ws[cell(r, 5)] = formula(`SUM($E$${first + 1}:E${n})`);
      ws[cell(r, 6)] = formula(`$B$2-F${n}`);
      ws[cell(r, 7)] = formula(`MAX(0,$B$3-COUNT($E$${first + 1}:E${n}))`);
    }
    ws['!ref'] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: last, c: 7 });
    ws['!cols'] = [{ wch: 6 }, { wch: 26 }, { wch: 15 }, { wch: 12 },
      { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 11 }];
    XLSX.utils.book_append_sheet(wb, ws, names[ti]);
  });

  // ── all teams at a glance ──
  const sHead = [['Team', 'Purse', 'Bought', 'Spent', 'Balance', 'Slots left', 'Max bid now']];
  const sum = XLSX.utils.aoa_to_sheet([...sHead, ...list.map(t => [t.name, num(t.purse)])]);
  list.forEach((_, i) => {
    const r = i + 1, q = `'${names[i]}'`;
    sum[cell(r, 2)] = formula(`${q}!B6`);
    sum[cell(r, 3)] = formula(`${q}!D6`);
    sum[cell(r, 4)] = formula(`${q}!F6`);
    sum[cell(r, 5)] = formula(`MAX(0,${q}!B3-${q}!B6)`);
    sum[cell(r, 6)] = formula(`${q}!H6`);
  });
  sum['!ref'] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: list.length, c: 6 });
  sum['!cols'] = [{ wch: 24 }, { wch: 13 }, { wch: 9 }, { wch: 13 }, { wch: 13 }, { wch: 11 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, sum, 'All teams');

  const help = [
    ['Team owner bidding tracker'],
    [],
    ['Type the price into "Price paid" as soon as you win a player.'],
    ['Everything else works itself out.'],
    [],
    ['MAX BID NOW (cell H6) is the number to watch. It is your balance minus'],
    ['the money you must keep back to fill your remaining squad slots:'],
    [],
    ['   max bid = balance - (slots still to fill - 1) x lowest base price'],
    [],
    ['Bidding above it means you cannot afford to complete your squad.'],
    [],
    ['Change Purse, Squad minimum or Lowest base price at the top and every'],
    ['figure updates. "All teams" pulls the same numbers together.'],
    [],
    ['Stunity tech - by Prateek'],
  ];
  const hws = XLSX.utils.aoa_to_sheet(help);
  hws['!cols'] = [{ wch: 72 }];
  XLSX.utils.book_append_sheet(wb, hws, 'How to use');

  return wb;
}
