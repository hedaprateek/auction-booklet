// Regenerates sample/sample-cricket.xlsx from the demo data used by the app.
//   node scripts/make-sample.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { SAMPLE } from '../assets/js/sample-data.js';

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const XLSX = require(path.join(root, 'assets/vendor/xlsx.full.min.js'));

const rows = SAMPLE.rows.map(r => ({ ...r, Mobile: undefined }));
const ws = XLSX.utils.json_to_sheet(rows);
ws['!cols'] = Object.keys(SAMPLE.rows[0]).map(k => ({ wch: Math.max(10, k.length + 4) }));

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Players');

// The vendored build is the browser bundle, so write the bytes ourselves.
const out = path.join(root, 'sample', 'sample-cricket.xlsx');
fs.writeFileSync(out, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
console.log(`wrote ${out} (${SAMPLE.rows.length} players)`);
