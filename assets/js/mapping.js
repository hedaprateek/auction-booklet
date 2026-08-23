// Guess what each spreadsheet column means, so the booklet is usable
// before the user touches anything.

import { columnType } from './parse.js';
import { getPreset, SINGLE_ROLES } from './presets.js';

// Columns that should never end up in a document handed to a room full of people.
const PRIVATE = /(phone|mobile|whats ?app|contact|e-?mail|aadhaar|aadhar|pan\b|address|dob|date of birth|password|account|ifsc|upi)/i;

const RULES = [
  ['name',      /^(player|full|player's)?\s*name$|^player$|^name of/i,               100],
  ['name',      /name/i,                                                              40],
  ['photo',     /(photo|image|pic(ture)?|avatar|headshot|thumbnail)/i,                90],
  ['id',        /^(s\.?\s*no|sr\.?\s*no|serial|lot(\s*(no|number))?|#|id|player id|reg(n|istration)? ?(no)?)\b/i, 90],
  ['basePrice', /(base\s*(price|value|bid)|reserve\s*price|starting\s*(price|bid)|min(imum)? ?price)/i, 95],
  ['basePrice', /^(price|value|cost|amount|bid)$/i,                                   50],
  ['category',  /(categor|player\s*type|^type$|^set$|^group$|^grade$|^tier$|division|pool)/i, 90],
  ['category',  /(role|position|speciali[sz]ation|skill)/i,                           60],
  ['team',      /(team|club|franchise|squad|department|company|college|school|village|previous team)/i, 70],
  ['note',      /(remark|note|comment|about|bio|descri|achievement|highlight)/i,      80],
  ['badge',     /(icon|marquee|captain|star|retained|overseas|seed|grade)/i,          55],
  // Word boundaries matter here: without them "Average" reads as "age".
  ['subtitle',  /\b(age|city|town|village|state|country|district|nationality|height|weight|hand|style|experience|years|occupation)\b/i, 50],
];

export function autoMap(headers, rows, presetId) {
  const preset = getPreset(presetId);
  const claimed = new Set();
  const roleOf = new Map();

  // Score every (header, rule) pair, then hand out the single-slot roles
  // to the strongest candidate first.
  const candidates = [];
  headers.forEach(h => {
    if (PRIVATE.test(h)) { roleOf.set(h, 'ignore'); return; }
    RULES.forEach(([role, re, score]) => {
      if (re.test(h)) candidates.push({ h, role, score });
    });
  });
  candidates.sort((a, b) => b.score - a.score);

  for (const c of candidates) {
    if (roleOf.has(c.h)) continue;
    if (SINGLE_ROLES.includes(c.role) && claimed.has(c.role)) continue;
    roleOf.set(c.h, c.role);
    if (SINGLE_ROLES.includes(c.role)) claimed.add(c.role);
  }

  // Preset hints get a second pass at anything still unassigned.
  const hint = (list, role) => (list || []).forEach(word => {
    const re = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    headers.forEach(h => { if (!roleOf.has(h) && re.test(h)) roleOf.set(h, role); });
  });
  hint(preset.badges, 'badge');
  hint(preset.subtitles, 'subtitle');
  hint(preset.stats, 'stat');

  // Whatever is left: numbers and short text become stats, empty columns hide.
  headers.forEach(h => {
    if (roleOf.has(h)) return;
    const t = columnType(rows, h);
    roleOf.set(h, t === 'empty' ? 'ignore' : t === 'text-long' ? 'note' : 'stat');
  });

  // No name column found? Fall back to the first text column so something renders.
  if (!claimed.has('name')) {
    const first = headers.find(h => columnType(rows, h) === 'text' && roleOf.get(h) !== 'photo')
      || headers[0];
    if (first) roleOf.set(first, 'name');
  }

  return headers.map(h => ({ key: h, label: prettyLabel(h), role: roleOf.get(h) || 'ignore' }));
}

/** "STRIKE_RATE" -> "Strike Rate", "runs_scored" -> "Runs Scored" */
export function prettyLabel(h) {
  const s = h.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) return s;          // already mixed case, leave it
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

/** fields -> { name: 'Player Name', stat: ['Runs', 'Wickets'], ... } */
export function byRole(fields) {
  const out = {};
  for (const f of fields) {
    if (f.role === 'ignore') continue;
    if (SINGLE_ROLES.includes(f.role)) out[f.role] = f.key;
    else (out[f.role] ||= []).push(f.key);
  }
  return out;
}
