// Judging kit: score sheets to print, and a scoring workbook to total up.
//
// Two outputs, because organisers use both. On the day, judges want paper —
// a clipboard sheet per judge with a column per criterion. Afterwards someone
// types the numbers in, and that is where the workbook earns its keep: it has
// real formulas, so totals, per-judge averages and ranks compute themselves the
// moment it opens in Excel or Google Sheets.
//
// XLSX is the globally-loaded SheetJS build (see assets/vendor).

import { esc } from './format.js';
import { criteriaTotal } from './competitions.js';

const PAGE_SIZES = {
  a4: { w: '210mm', h: '297mm', css: 'A4', rows: 18 },
  letter: { w: '215.9mm', h: '279.4mm', css: 'Letter', rows: 17 },
};

/* ── printable score sheets ─────────────────────────────────────────────── */

/**
 * One sheet per judge, split across pages when there are many entrants.
 * Every page repeats the judge's name, because clipboard pages get separated.
 */
export function buildJudgeSheets(participants, s) {
  const size = PAGE_SIZES[s.pageSize] || PAGE_SIZES.a4;
  const judges = (s.judges || []).filter(Boolean);
  const list = judges.length ? judges : ['Judge'];
  const criteria = s.criteria || [];
  const total = criteriaTotal(criteria);
  const pages = [];

  for (const judge of list) {
    const chunks = chunk(participants, size.rows);
    chunks.forEach((rows, i) => {
      pages.push(page(`
        <div class="js-head">
          <div>
            <h2>${esc(s.title || 'Competition')}</h2>
            ${s.subtitle ? `<p>${esc(s.subtitle)}</p>` : ''}
          </div>
          <div class="js-judge">
            <span>Judge</span>
            <strong>${esc(judge)}</strong>
          </div>
        </div>
        <table class="js-table">
          <thead><tr>
            <th class="c-no">#</th>
            <th>${esc(s.noun || 'Participant')}</th>
            ${criteria.map(c => `<th class="c-sc">${esc(c.name)}<em>${c.max}</em></th>`).join('')}
            <th class="c-tot">Total<em>${total}</em></th>
            <th class="c-rem">Remarks</th>
          </tr></thead>
          <tbody>
            ${rows.map(p => `<tr>
              <td class="c-no">${esc(p.lot)}</td>
              <td class="c-name">${esc(p.name)}${p.category && p.category !== 'All Players'
                ? `<span class="c-cat">${esc(p.category)}</span>` : ''}</td>
              ${criteria.map(() => '<td class="c-sc"></td>').join('')}
              <td class="c-tot"></td>
              <td class="c-rem"></td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div class="js-foot">
          <div class="js-sign"><span>Judge's signature</span></div>
          <div class="js-page">${[chunks.length > 1 ? `Page ${i + 1} of ${chunks.length}` : '', esc(s.footer || '')].filter(Boolean).join(' · ')}</div>
        </div>
      `));
    });
  }

  const style = `--accent:${cssColor(s.accent)};--pw:${size.w};--ph:${size.h}`;
  return {
    html: `<div class="bk" data-theme="${esc(s.theme || 'classic')}" style="${style}">${pages.join('')}</div>`,
    pageCount: pages.length,
    pageSizeCss: size.css,
  };
}

const page = (inner, cls = "judge-sheet") => `<section class="page ${cls}">${inner}</section>`;

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out.length ? out : [[]];
}

const cssColor = v => (/^#[0-9a-f]{3,8}$/i.test(String(v || '')) ? v : '#0f766e');

/* ── certificates ───────────────────────────────────────────────────────── */

/**
 * One certificate per page: a participation certificate for everyone, and
 * blank winner certificates at the front to fill in on the day — because the
 * results are not known until the judging is done.
 */
export function buildCertificates(participants, s) {
  const size = PAGE_SIZES[s.pageSize] || PAGE_SIZES.a4;
  const places = ['First Place', 'Second Place', 'Third Place'];

  const cert = (kicker, name, sub, blank) => page(`
    <div class="cert">
      <div class="cert-rule"></div>
      ${s.logo ? `<img class="cert-logo" src="${esc(s.logo)}" alt="">` : ''}
      <div class="cert-event">${esc(s.title || 'Competition')}</div>
      ${s.subtitle ? `<div class="cert-when">${esc(s.subtitle)}</div>` : ''}
      <div class="cert-kicker">${esc(kicker)}</div>
      <div class="cert-preamble">This is to certify that</div>
      ${blank
        ? '<div class="cert-blank"></div>'
        : `<div class="cert-name">${esc(name)}</div>`}
      <div class="cert-sub">${esc(sub || '')}</div>
      <div class="cert-sign">
        <div><span>Judge</span></div>
        <div><span>Organiser</span></div>
      </div>
      <div class="cert-foot">${esc(s.footer || '')}</div>
      <div class="cert-rule"></div>
    </div>
  `, 'cert-page');

  const pages = [];
  if (s.winnerCerts !== false) {
    // Left blank on purpose — the winners are not known until judging ends.
    for (const p of places) pages.push(cert(p, '', '', true));
  }
  for (const p of participants) {
    pages.push(cert('Certificate of Participation', p.name,
      p.category && p.category !== 'All Players' ? p.category : '', false));
  }

  const style = `--accent:${cssColor(s.accent)};--pw:${size.w};--ph:${size.h}`;
  return {
    html: `<div class="bk" data-theme="${esc(s.theme || 'classic')}" style="${style}">${pages.join('')}</div>`,
    pageCount: pages.length,
    pageSizeCss: size.css,
  };
}

/* ── scoring workbook ───────────────────────────────────────────────────── */

const col = (r, c) => XLSX.utils.encode_cell({ r, c });

/**
 * A formula cell MUST carry a cached value. SheetJS drops formula-only cells
 * when it writes the file — without this the workbook would ship with the
 * Total, Average and Rank columns empty. The cached 0 is honest for an unscored
 * sheet, and Excel recalculates each cell as soon as anything it depends on is
 * typed in, which is the moment it starts to matter.
 */
const formula = f => ({ t: 'n', f, v: 0 });
/** Sheet names cannot hold : \ / ? * [ ] and cap at 31 characters. */
const safeSheet = n => String(n).replace(/[:\\/?*[\]]/g, '-').slice(0, 31) || 'Judge';

/**
 * One tab per judge with a live SUM per row, then a Summary tab that pulls each
 * judge's total across, averages them and ranks. Opens ready to use.
 */
export function buildScoringWorkbook(participants, s) {
  const criteria = s.criteria || [];
  const judges = (s.judges || []).filter(Boolean);
  const list = judges.length ? judges : ['Judge 1'];
  const wb = XLSX.utils.book_new();
  const names = list.map(safeSheet);

  const firstScore = 3;                       // A=#, B=Name, C=Category
  const lastScore = firstScore + criteria.length - 1;
  const totalCol = lastScore + 1;

  list.forEach((judge, ji) => {
    const head = ['#', s.noun || 'Participant', 'Category',
      ...criteria.map(c => `${c.name} (${c.max})`), `Total (${criteriaTotal(criteria)})`, 'Remarks'];
    const aoa = [head, ...participants.map(p => [p.lot, p.name, p.category === 'All Players' ? '' : p.category])];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    participants.forEach((_, i) => {
      const r = i + 1;                        // row 0 is the header
      // Blank score cells so the grid is visibly there to type into.
      for (let c = firstScore; c <= lastScore; c++) ws[col(r, c)] = { t: 's', v: '' };
      ws[col(r, totalCol)] = formula(`SUM(${col(r, firstScore)}:${col(r, lastScore)})`);
      ws[col(r, totalCol + 1)] = { t: 's', v: '' };
    });
    ws['!ref'] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: participants.length, c: totalCol + 1 });
    ws['!cols'] = [{ wch: 5 }, { wch: 26 }, { wch: 14 },
      ...criteria.map(c => ({ wch: Math.max(10, c.name.length + 5) })), { wch: 12 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, ws, names[ji]);
  });

  // ── summary ──
  const sHead = ['#', s.noun || 'Participant', 'Category', ...list, 'Average', 'Rank'];
  const sAoa = [sHead, ...participants.map(p => [p.lot, p.name, p.category === 'All Players' ? '' : p.category])];
  const sum = XLSX.utils.aoa_to_sheet(sAoa);
  const firstJudge = 3;
  const lastJudge = firstJudge + list.length - 1;
  const avgCol = lastJudge + 1;
  const rankCol = avgCol + 1;

  participants.forEach((_, i) => {
    const r = i + 1;
    list.forEach((_, ji) => {
      // Pull that judge's total straight off their own tab.
      sum[col(r, firstJudge + ji)] = formula(`'${names[ji]}'!${col(r, totalCol)}`);
    });
    sum[col(r, avgCol)] = formula(`IFERROR(AVERAGE(${col(r, firstJudge)}:${col(r, lastJudge)}),0)`);
    const range = `$${XLSX.utils.encode_col(avgCol)}$2:$${XLSX.utils.encode_col(avgCol)}$${participants.length + 1}`;
    sum[col(r, rankCol)] = formula(`IF(${col(r, avgCol)}=0,"",RANK(${col(r, avgCol)},${range}))`);
  });
  sum['!ref'] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: participants.length, c: rankCol });
  sum['!cols'] = [{ wch: 5 }, { wch: 26 }, { wch: 14 },
    ...list.map(j => ({ wch: Math.max(10, j.length + 2) })), { wch: 10 }, { wch: 7 }];
  XLSX.utils.book_append_sheet(wb, sum, 'Summary');

  // ── how to use ──
  const notes = [
    [`${s.title || 'Competition'} — scoring workbook`],
    [],
    ['Each judge has their own tab. Type scores into the criteria columns;'],
    ['the Total column adds them up on its own.'],
    [],
    ['The Summary tab pulls every judge\'s total across, averages them and ranks.'],
    ['Nothing needs to be typed on Summary — it fills itself in.'],
    [],
    ['Do not rename the judge tabs: the Summary formulas point at them by name.'],
    ['Adding a judge later? Copy a judge tab, then widen the AVERAGE on Summary.'],
    [],
    ['Criteria and weights:'],
    ...criteria.map(c => [`   ${c.name}`, c.max]),
    ['   TOTAL', criteriaTotal(criteria)],
    [],
    ['Generated by AuctionBook — Stunity tech - by Prateek'],
  ];
  const nws = XLSX.utils.aoa_to_sheet(notes);
  nws['!cols'] = [{ wch: 62 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, nws, 'How to use');

  return wb;
}

/* ── blank registration template ────────────────────────────────────────── */

/**
 * A starting spreadsheet for an event that has no data yet: the columns this
 * competition wants, in the order the booklet reads them, with one clearly
 * marked example row so the shape is obvious.
 */
export function buildBlankTemplate(comp, { rows = 0 } = {}) {
  const wb = XLSX.utils.book_new();
  const isJudged = !!comp.criteria;

  const headers = ['Entry No', isJudged ? 'Participant Name' : 'Player Name', 'Category',
    ...(comp.fields || []),
    ...(isJudged ? [] : ['Base Price']),
    'Age', 'City', 'Mobile', 'Photo', 'Remarks'];

  const example = ['1', 'EXAMPLE — delete this row', (comp.categories || ['Open'])[0],
    ...(comp.fields || []).map(f => `e.g. ${f.toLowerCase()}`),
    ...(isJudged ? [] : ['10000']),
    '24', 'Pune', '98xxxxxx01', 'ravi-kumar.jpg', 'Optional note'];

  const aoa = [headers, example];
  for (let i = 0; i < rows; i++) aoa.push(headers.map(() => ''));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map(h => ({ wch: Math.max(12, h.length + 4) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Participants');

  const help = [
    [`${comp.label} — registration template`],
    [],
    ['One row per entrant. Keep the header row exactly as it is; add or remove'],
    ['columns freely — anything unrecognised becomes a stat on the printed card.'],
    [],
    ['Delete the EXAMPLE row before you use this.'],
    [],
    ['Mobile is collected for the organisers and is hidden from anything printed.'],
    ['Photo takes a file name — put the images in a folder and select them in the app.'],
    [],
    ...(comp.categories ? [['Suggested categories:'], ...comp.categories.map(c => [`   ${c}`])] : []),
    ...(comp.criteria ? [[], ['Judging criteria (out of 100):'],
      ...comp.criteria.map(c => [`   ${c.name}`, c.max])] : []),
    [],
    ['Open it at: https://hedaprateek.github.io/auction-booklet/'],
    ['Stunity tech - by Prateek'],
  ];
  const hws = XLSX.utils.aoa_to_sheet(help);
  hws['!cols'] = [{ wch: 70 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, hws, 'How to use');

  return wb;
}

/** SheetJS writes a browser-safe array we can hand straight to a Blob. */
export const workbookBytes = wb =>
  XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
