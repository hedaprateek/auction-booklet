// Stand-in artwork for players who sent no photo.
//
// Deliberately generated rather than borrowed: a real stranger's face under a
// named player's card reads as that player, and this booklet gets printed and
// bid against. These are obviously-not-a-photograph marks that still give every
// card its own identity.
//
// Everything is inline SVG — no network, prints sharp at any size, and embeds
// in the shareable file for free. The same player always gets the same mark,
// so a re-render never reshuffles the booklet.

import { esc, initials } from './format.js';

export const AVATAR_STYLES = [
  { id: 'initials',   label: 'Initials only' },
  { id: 'monogram',   label: 'Initials on colour' },
  { id: 'pattern',    label: 'Geometric pattern' },
  { id: 'silhouette', label: 'Player silhouette' },
  { id: 'jersey',     label: 'Numbered jersey' },
];

/** FNV-1a — small, fast, and well spread for short strings. */
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/* ── colour ─────────────────────────────────────────────────────────────── */

function hexToHsl(hex) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(String(hex || '').trim());
  if (!m) return { h: 22, s: 88, l: 40 };
  const [r, g, b] = m.slice(1).map(v => parseInt(v, 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 };
}

// Offsets around the booklet's accent hue. Every card looks like it belongs to
// the same publication while still being distinguishable at arm's length.
const OFFSETS = [0, 28, 55, 95, 140, 190, 225, 262, 300, 332];

function tones(seed, accent) {
  const base = hexToHsl(accent);
  // Rounded: an unrounded hue carries fourteen decimals into every colour on
  // every card, for no visible difference.
  const h = Math.round((base.h + OFFSETS[seed % OFFSETS.length]) % 360);
  const shift = (seed >> 4) % 3;                       // small tonal variety
  return {
    ink: `hsl(${h} 52% ${30 + shift * 4}%)`,
    mid: `hsl(${h} 46% ${55 + shift * 3}%)`,
    pale: `hsl(${h} 44% ${91 - shift * 2}%)`,
  };
}

/* ── the marks ──────────────────────────────────────────────────────────── */

/**
 * The photo slot is wide and short, so a square design cropped to fill it
 * loses its top and bottom — a jersey ends up beheaded and its number sliced.
 * Figurative marks are fitted whole ('meet') with the pale tone painted on the
 * SVG itself so the slot is still filled edge to edge; only the pattern, which
 * is designed to be cropped anywhere, fills by slicing.
 */
const wrap = (inner, bg, fit = 'meet') =>
  `<svg class="av" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid ${fit}"`
  + `${bg ? ` style="background:${bg}"` : ''} role="img" aria-hidden="true" focusable="false">`
  + `${inner}</svg>`;

/**
 * A 5-wide grid mirrored about the centre column, so it reads as a deliberate
 * emblem rather than noise. Same idea as an identicon.
 */
function pattern(seed, c) {
  let cells = '';
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 5; row++) {
      // one bit of the hash per cell, re-mixed so columns don't repeat
      const bit = (seed >> ((col * 5 + row) % 29)) & 1;
      const alt = (seed >> ((col + row) % 17)) & 1;
      if (!bit) continue;
      const fill = alt ? c.mid : c.ink;
      for (const x of col === 2 ? [40] : [col * 20, 80 - col * 20]) {
        cells += `<rect x="${x}" y="${row * 20}" width="20" height="20" fill="${fill}"/>`;
      }
    }
  }
  return wrap(`<rect width="100" height="100" fill="${c.pale}"/>${cells}`, c.pale, 'slice');
}

function monogram(seed, c, name) {
  const text = esc(initials(name));
  return wrap(
    `<rect width="100" height="100" fill="${c.pale}"/>`
    + `<circle cx="50" cy="50" r="31" fill="${c.mid}"/>`
    + `<text x="50" y="50" fill="#fff" font-family="Georgia, 'Times New Roman', serif"`
    + ` font-size="${text.length > 1 ? 30 : 40}" font-weight="700" text-anchor="middle"`
    + ` dominant-baseline="central">${text}</text>`,
    c.pale
  );
}

function silhouette(seed, c) {
  return wrap(
    `<rect width="100" height="100" fill="${c.pale}"/>`
    + `<circle cx="50" cy="38" r="17" fill="${c.mid}"/>`
    + `<path d="M18 100c0-19 14-31 32-31s32 12 32 31z" fill="${c.mid}"/>`,
    c.pale
  );
}

function jersey(seed, c, lot) {
  const n = esc(String(lot ?? '').slice(0, 3));
  return wrap(
    `<rect width="100" height="100" fill="${c.pale}"/>`
    + `<path d="M35 22 L20 30 L14 48 L26 52 L26 86 L74 86 L74 52 L86 48 L80 30 L65 22 `
    + `Q50 34 35 22 Z" fill="${c.mid}"/>`
    + `<path d="M35 22 Q50 34 65 22 L58 20 Q50 26 42 20 Z" fill="${c.ink}"/>`
    + (n ? `<text x="50" y="64" fill="#fff" font-family="Helvetica, Arial, sans-serif"`
      + ` font-size="26" font-weight="700" text-anchor="middle"`
      + ` dominant-baseline="central">${n}</text>` : ''),
    c.pale
  );
}

/**
 * Markup for a player with no photograph.
 * Returns plain initials for the 'initials' style so nothing changes for
 * anyone who preferred the original look.
 */
export function avatarMark(player, style, accent) {
  const name = player?.name || '';
  const seed = hash(`${name}|${player?.lot ?? ''}`);
  if (!style || style === 'initials') return esc(initials(name));

  const c = tones(seed, accent);
  switch (style) {
    case 'pattern': return pattern(seed, c);
    case 'silhouette': return silhouette(seed, c);
    case 'jersey': return jersey(seed, c, player?.lot);
    case 'monogram':
    default: return monogram(seed, c, name);
  }
}
