import { toNumber } from './parse.js';

/**
 * Money for the card and index.
 * "indian" is the default because lakh/crore is what most local auctions speak.
 */
export function formatMoney(value, currency = '₹', style = 'indian') {
  if (value === '' || value == null) return '';
  if (style === 'raw') return String(value);

  const n = toNumber(value);
  if (n == null) return String(value);

  if (style === 'indian') {
    const abs = Math.abs(n);
    if (abs >= 1e7) return `${currency}${trim(n / 1e7)} Cr`;
    if (abs >= 1e5) return `${currency}${trim(n / 1e5)} L`;
    if (abs >= 1e3) return `${currency}${groupIndian(n)}`;
    return `${currency}${trim(n)}`;
  }
  if (style === 'grouped') return `${currency}${groupIndian(n)}`;
  return `${currency}${n.toLocaleString('en-US')}`;
}

function trim(n) {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0$/, '');
}

/** 1234567 -> 12,34,567 */
function groupIndian(n) {
  const neg = n < 0;
  const [int, dec] = Math.abs(n).toString().split('.');
  let out;
  if (int.length <= 3) out = int;
  else {
    const last3 = int.slice(-3);
    const rest = int.slice(0, -3);
    out = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  }
  return (neg ? '-' : '') + out + (dec ? '.' + dec : '');
}

export const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2)
    .map(w => w[0] || '').join('').toUpperCase() || '?';
}

/** Sort helper that keeps numbers numeric and text alphabetical. */
export function compareValues(a, b) {
  const na = toNumber(a), nb = toNumber(b);
  if (na != null && nb != null) return na - nb;
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' });
}
