// Builds a live auction board from the demo data, for publishing as an Artifact.
//   node scripts/make-liveboard.mjs [outfile]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE } from '../assets/js/sample-data.js';
import { autoMap } from '../assets/js/mapping.js';
import { normalize } from '../assets/js/render.js';
import { buildLiveBoard } from '../assets/js/liveboard.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rows = SAMPLE.rows.map(r => Object.fromEntries(
  Object.entries(r).map(([k, v]) => [k, v == null ? '' : String(v)])));
const fields = autoMap(Object.keys(SAMPLE.rows[0]), rows, 'cricket');
const settings = { ...SAMPLE.settings, groupBy: 'Category', sortBy: '', sortDesc: false,
  perPage: 4, sequentialLots: false };

const html = buildLiveBoard(normalize(rows, fields, settings), settings);
const out = process.argv[2] || path.join(root, 'sample', 'demo-live-board.html');
fs.writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB, ${rows.length} players)`);
