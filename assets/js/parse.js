// Spreadsheet -> { headers, rows } using SheetJS (loaded globally from assets/vendor).

export function readWorkbook(arrayBuffer) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: true });
  if (!wb.SheetNames.length) throw new Error('That file has no sheets in it.');
  return wb;
}

/** Pull a grid of raw values out of one sheet. */
export function sheetGrid(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '', raw: false, dateNF: 'yyyy-mm-dd' });
}

/**
 * Turn a raw grid into headers + row objects.
 * headerRow is 1-based to match what people see in Excel.
 */
export function gridToTable(grid, headerRow = 1) {
  const hi = Math.max(0, headerRow - 1);
  const rawHeaders = grid[hi] || [];
  const width = grid.reduce((w, r) => Math.max(w, r.length), rawHeaders.length);

  const seen = new Map();
  const headers = [];
  for (let c = 0; c < width; c++) {
    let h = String(rawHeaders[c] ?? '').replace(/\s+/g, ' ').trim();
    if (!h) h = `Column ${c + 1}`;
    if (seen.has(h)) {
      const n = seen.get(h) + 1;
      seen.set(h, n);
      h = `${h} (${n})`;
    } else {
      seen.set(h, 1);
    }
    headers.push(h);
  }

  const rows = [];
  for (let r = hi + 1; r < grid.length; r++) {
    const line = grid[r] || [];
    const obj = {};
    let hasValue = false;
    for (let c = 0; c < width; c++) {
      const v = String(line[c] ?? '').trim();
      obj[headers[c]] = v;
      if (v) hasValue = true;
    }
    if (hasValue) rows.push(obj);
  }

  // Drop trailing columns that are empty in every row and were unnamed.
  const used = headers.filter((h, i) =>
    !/^Column \d+$/.test(h) || rows.some(r => r[h] !== '')
  );

  return { headers: used, rows };
}

/** Rough type of a column, used to decide what makes a good stat. */
export function columnType(rows, header) {
  let nums = 0, filled = 0;
  for (const r of rows) {
    const v = r[header];
    if (!v) continue;
    filled++;
    if (isNumericish(v)) nums++;
  }
  if (!filled) return 'empty';
  if (nums / filled > 0.7) return 'number';
  const avgLen = rows.reduce((s, r) => s + (r[header] || '').length, 0) / Math.max(filled, 1);
  return avgLen > 45 ? 'text-long' : 'text';
}

export function isNumericish(v) {
  if (typeof v === 'number') return true;
  const s = String(v).replace(/[,\s₹$€£%]/g, '');
  return s !== '' && !isNaN(Number(s));
}

export function toNumber(v) {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').replace(/[,\s₹$€£]/g, '');
  const n = Number(s);
  return isNaN(n) ? null : n;
}
