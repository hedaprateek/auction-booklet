// Sheets of labelled QR codes — one per form, one per event, one per notice.
//
// A club running an auction is usually running six other things at once: a
// registration form, a quiz entry, the digital booklet, a WhatsApp group, the
// entry fee. Each wants a code on a wall, and printing them one at a time is
// the slow way.
//
// Codes are drawn as inline SVG (see qrSvg in render.js), so they print at any
// size without going soft and need no network.

import { esc } from './format.js';
import { qrSvg } from './render.js';

export const QR_LAYOUTS = [
  { id: 'grid4',  label: '4 per page — notice board', cols: 2, rows: 2 },
  { id: 'grid6',  label: '6 per page',                cols: 2, rows: 3 },
  { id: 'grid9',  label: '9 per page — table cards',  cols: 3, rows: 3 },
  { id: 'poster', label: 'One per page — poster',     cols: 1, rows: 1 },
];

export const getQrLayout = id => QR_LAYOUTS.find(l => l.id === id) || QR_LAYOUTS[0];

const PAGE_SIZES = {
  a4:     { w: '210mm',   h: '297mm',   css: 'A4' },
  letter: { w: '215.9mm', h: '279.4mm', css: 'Letter' },
};

/**
 * One entry per line: `Label | https://… | optional note`.
 * A comma works too when there is no pipe, which is what people type first.
 */
export function parseQrList(text) {
  return String(text || '').split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const parts = line.includes('|')
      ? line.split('|')
      : splitOnFirstComma(line);
    return {
      label: (parts[0] || '').trim(),
      url: normaliseTarget((parts[1] || '').trim()),
      note: (parts[2] || '').trim(),
    };
  }).filter(x => x.label || x.url);
}

function splitOnFirstComma(line) {
  const i = line.indexOf(',');
  return i < 0 ? [line, ''] : [line.slice(0, i), line.slice(i + 1)];
}

/**
 * A code holding "forms.gle/abc" scans as plain text and opens nothing, so a
 * bare domain gets https://. Anything with its own scheme — upi:, tel:,
 * mailto:, whatsapp: — is left exactly as typed.
 */
export function normaliseTarget(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;         // already has a scheme
  if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(s)) return `https://${s}`;
  return s;                                             // plain text, deliberately
}

/** UPI collect link — the entry-fee code. */
export function upiUri({ pa, pn, am, tn, cu = 'INR' }) {
  const q = new URLSearchParams();
  if (pa) q.set('pa', pa.trim());
  if (pn) q.set('pn', pn.trim());
  if (am) q.set('am', String(am).trim());
  if (tn) q.set('tn', tn.trim());
  q.set('cu', cu);
  return `upi://pay?${q.toString()}`;
}

/** What to print under the code, without dumping a 200-character URL. */
export function prettyTarget(url) {
  const s = String(url || '');
  if (/^upi:/i.test(s)) {
    const pa = /[?&]pa=([^&]+)/.exec(s);
    return pa ? `UPI · ${decodeURIComponent(pa[1])}` : 'UPI payment';
  }
  if (/^tel:/i.test(s)) return s.replace(/^tel:/i, '☎ ');
  if (/^mailto:/i.test(s)) return s.replace(/^mailto:/i, '✉ ');
  const bare = s.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  return bare.length > 46 ? bare.slice(0, 44) + '…' : bare;
}

export function buildQrSheet(items, settings = {}) {
  const layout = getQrLayout(settings.qrLayout);
  const size = PAGE_SIZES[settings.pageSize] || PAGE_SIZES.a4;
  const per = layout.cols * layout.rows;
  const list = items.filter(i => i.url);
  const pages = [];

  for (let i = 0; i < Math.max(1, Math.ceil(list.length / per)); i++) {
    const slice = list.slice(i * per, (i + 1) * per);
    pages.push(`<section class="page qr-page" data-lay="${esc(layout.id)}">
      ${settings.qrHeading !== false ? `<div class="qs-head">
        <span>${esc(settings.title || '')}</span>
        <span>${esc(settings.subtitle || '')}</span>
      </div>` : ''}
      <div class="qs-grid" style="--cols:${layout.cols};--rows:${layout.rows}">
        ${slice.map(it => card(it, settings)).join('')}
      </div>
      <div class="qs-foot">${esc(settings.footer || '')}
        <span>Stunity tech - by Prateek</span></div>
    </section>`);
  }

  const style = `--accent:${cssColor(settings.accent)};--pw:${size.w};--ph:${size.h}`;
  return {
    html: `<div class="bk" data-theme="${esc(settings.theme || 'classic')}" style="${style}">${pages.join('')}</div>`,
    pageCount: pages.length,
    pageSizeCss: size.css,
    count: list.length,
  };
}

function card(it, s) {
  return `<div class="qs-card">
    <div class="qs-label">${esc(it.label || 'Scan')}</div>
    <div class="qs-code">${qrSvg(it.url)}</div>
    ${it.note ? `<div class="qs-note">${esc(it.note)}</div>` : ''}
    ${s.qrShowUrl !== false ? `<div class="qs-url">${esc(prettyTarget(it.url))}</div>` : ''}
  </div>`;
}

const cssColor = v => (/^#[0-9a-f]{3,8}$/i.test(String(v || '')) ? v : '#c2410c');
