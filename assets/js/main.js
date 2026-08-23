import { readWorkbook, sheetGrid, gridToTable } from './parse.js';
import { autoMap, prettyLabel } from './mapping.js';
import { ROLES, PRESETS, getPreset } from './presets.js';
import { normalize, buildBook } from './render.js';
import { buildPhotoIndex, resizeToDataURL } from './images.js';
import { buildShareFile } from './export.js';
import { SAMPLE } from './sample-data.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const DEFAULTS = {
  preset: 'generic',
  title: '', subtitle: '', footer: '', logo: '',
  accent: '#c2410c', theme: 'classic',
  pageSize: 'a4', perPage: 4,
  groupBy: '', sortBy: '', sortDesc: false,
  currency: '₹', numberFormat: 'indian',
  showCover: true, showIndex: true, writeIn: true, showPhotos: true,
  sequentialLots: false,
  teamsText: '', rulesText: '', tracker: true,
};

const S = {
  wb: null, sheetName: '', headerRow: 1,
  headers: [], rows: [], fields: [],
  photoIndex: new Map(),
  settings: { ...DEFAULTS },
  zoom: 'fit',
  book: null, players: null,
};

/* ── boot ───────────────────────────────────────────────────────────────── */

function boot() {
  $('#preset-select').innerHTML = PRESETS.map(p =>
    `<option value="${p.id}">${p.label}</option>`).join('');

  restoreSettings();
  bindData();
  bindSettings();
  bindActions();
  bindZoom();
  window.addEventListener('resize', () => { if (S.zoom === 'fit') applyZoom(); });
}

/* ── 1 · data ───────────────────────────────────────────────────────────── */

function bindData() {
  const dz = $('#dropzone'), input = $('#file-input');
  dz.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') input.click(); });
  $('#btn-browse').addEventListener('click', () => input.click());
  input.addEventListener('change', e => e.target.files[0] && loadFile(e.target.files[0]));

  ['dragenter', 'dragover'].forEach(t => dz.addEventListener(t, e => {
    e.preventDefault(); dz.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach(t => dz.addEventListener(t, e => {
    e.preventDefault(); dz.classList.remove('over');
  }));
  dz.addEventListener('drop', e => {
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  });

  $('#sheet-select').addEventListener('change', e => {
    S.sheetName = e.target.value; S.headerRow = 1; $('#header-row').value = 1; reparse(true);
  });
  $('#header-row').addEventListener('change', e => {
    S.headerRow = Math.max(1, Number(e.target.value) || 1); reparse(true);
  });

  $('#photo-input').addEventListener('change', async e => {
    const files = e.target.files;
    if (!files?.length) return;
    $('#photo-status').textContent = 'Reading photos…';
    S.photoIndex = await buildPhotoIndex(files, (done, total) => {
      $('#photo-status').textContent = `Reading photos… ${done} of ${total}`;
    });
    const matched = countMatchedPhotos();
    $('#photo-status').textContent =
      `${S.photoIndex.size} image${S.photoIndex.size === 1 ? '' : 's'} loaded · matched to ${matched} of ${S.rows.length} players`;
    if (S.photoIndex.size && !matched) {
      toast('No photos matched. Name each file after the player or their lot number.', 'error');
    }
    refresh();
  });

  $('#btn-load-sample').addEventListener('click', loadSample);
  $('#btn-load-sample-2').addEventListener('click', loadSample);
}

async function loadFile(file) {
  try {
    if (/\.(csv|txt)$/i.test(file.name)) {
      S.wb = XLSX.read(await file.text(), { type: 'string' });
    } else {
      S.wb = readWorkbook(await file.arrayBuffer());
    }
    S.sheetName = S.wb.SheetNames[0];
    S.headerRow = 1;
    $('#header-row').value = 1;
    $('#sheet-select').innerHTML = S.wb.SheetNames.map(n =>
      `<option value="${n}">${n}</option>`).join('');
    $('#data-summary').classList.remove('hidden');
    if (!S.settings.title) {
      S.settings.title = prettyLabel(file.name.replace(/\.[^.]+$/, ''));
      $('#s-title').value = S.settings.title;
    }
    reparse(true);
    toast(`Loaded ${S.rows.length} players from ${file.name}`);
  } catch (err) {
    console.error(err);
    toast(`Could not read that file: ${err.message}`, 'error');
  }
}

function loadSample() {
  const ws = XLSX.utils.json_to_sheet(SAMPLE.rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Players');
  S.wb = wb;
  S.sheetName = 'Players';
  S.headerRow = 1;
  $('#sheet-select').innerHTML = '<option>Players</option>';
  $('#data-summary').classList.remove('hidden');
  Object.assign(S.settings, SAMPLE.settings);
  writeSettingsToForm();
  reparse(true);
  $('#panel-data').open = false;
  $('#panel-columns').open = true;
  toast('Demo data loaded — try changing the sport preset or cards per page.');
}

function reparse(remap) {
  if (!S.wb) return;
  const grid = sheetGrid(S.wb, S.sheetName);
  const { headers, rows } = gridToTable(grid, S.headerRow);
  S.headers = headers;
  S.rows = rows;
  $('#row-count').textContent = rows.length;
  $('#col-count').textContent = headers.length;
  $('#col-badge').textContent = headers.length;

  if (remap) {
    S.fields = autoMap(headers, rows, S.settings.preset);
    const cat = S.fields.find(f => f.role === 'category');
    S.settings.groupBy = cat ? cat.key : '';
  }
  renderMapList();
  fillColumnSelects();
  $$('#btn-print, #btn-print-2, #btn-export, #btn-export-2, #btn-save-project')
    .forEach(b => { b.disabled = rows.length === 0; });
  refresh();
}

function countMatchedPhotos() {
  if (!S.photoIndex.size) return 0;
  const players = normalize(S.rows, S.fields, S.settings, S.photoIndex);
  return players.filter(p => p.photo).length;
}

/* ── 2 · columns ────────────────────────────────────────────────────────── */

function renderMapList() {
  $('#maplist').innerHTML = S.fields.map((f, i) => `
    <div class="maprow" data-role="${f.role}">
      <span class="src" title="${f.key}">${f.key}</span>
      <input type="text" data-i="${i}" data-k="label" value="${f.label.replace(/"/g, '&quot;')}">
      <select data-i="${i}" data-k="role">
        ${ROLES.map(r => `<option value="${r.id}" ${r.id === f.role ? 'selected' : ''}>${r.label}</option>`).join('')}
      </select>
    </div>`).join('');

  $('#maplist').oninput = e => {
    const i = e.target.dataset.i;
    if (i == null) return;
    const key = e.target.dataset.k;
    S.fields[i][key] = e.target.value;
    if (key === 'role') {
      // Roles that can only belong to one column steal it from whoever had it.
      const role = ROLES.find(r => r.id === e.target.value);
      if (role?.single) {
        S.fields.forEach((f, j) => { if (j != i && f.role === role.id) f.role = 'stat'; });
        renderMapList();
      } else {
        e.target.closest('.maprow').dataset.role = e.target.value;
      }
      fillColumnSelects();
    }
    refresh();
  };
}

function fillColumnSelects() {
  const opts = S.headers.map(h => {
    const f = S.fields.find(x => x.key === h);
    return `<option value="${h}">${f ? f.label : h}</option>`;
  }).join('');
  const g = $('#s-groupby'), s = $('#s-sortby');
  g.innerHTML = `<option value="">No sections</option>${opts}`;
  s.innerHTML = `<option value="">Spreadsheet order</option>${opts}`;
  g.value = S.settings.groupBy || '';
  s.value = S.settings.sortBy || '';
}

/* ── 3 · settings ───────────────────────────────────────────────────────── */

const BINDINGS = [
  ['#s-title', 'title', 'value'], ['#s-subtitle', 'subtitle', 'value'],
  ['#s-footer', 'footer', 'value'], ['#s-accent', 'accent', 'value'],
  ['#s-theme', 'theme', 'value'], ['#s-pagesize', 'pageSize', 'value'],
  ['#s-percard', 'perPage', 'number'], ['#s-groupby', 'groupBy', 'value'],
  ['#s-sortby', 'sortBy', 'value'], ['#s-sortdesc', 'sortDesc', 'checked'],
  ['#s-currency', 'currency', 'value'], ['#s-numfmt', 'numberFormat', 'value'],
  ['#s-cover', 'showCover', 'checked'], ['#s-index', 'showIndex', 'checked'],
  ['#s-writein', 'writeIn', 'checked'], ['#s-photos', 'showPhotos', 'checked'],
  ['#s-lot', 'sequentialLots', 'checked'],
  ['#s-teams', 'teamsText', 'value'], ['#s-rules', 'rulesText', 'value'],
  ['#s-tracker', 'tracker', 'checked'],
];

function bindSettings() {
  for (const [sel, key, kind] of BINDINGS) {
    const el = $(sel);
    if (!el) continue;
    el.addEventListener('input', () => {
      S.settings[key] = kind === 'checked' ? el.checked
        : kind === 'number' ? Number(el.value) : el.value;
      if (key === 'accent') document.documentElement.style.setProperty('--accent', el.value);
      persistSettings();
      refresh();
    });
  }

  $('#preset-select').addEventListener('change', e => {
    S.settings.preset = e.target.value;
    const p = getPreset(e.target.value);
    S.settings.accent = p.accent;
    $('#s-accent').value = p.accent;
    document.documentElement.style.setProperty('--accent', p.accent);
    if (S.rows.length) {
      S.fields = autoMap(S.headers, S.rows, p.id);
      const cat = S.fields.find(f => f.role === 'category');
      S.settings.groupBy = cat ? cat.key : '';
      renderMapList();
      fillColumnSelects();
    }
    persistSettings();
    refresh();
  });

  $('#s-logo').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) { S.settings.logo = ''; refresh(); return; }
    try {
      S.settings.logo = await resizeToDataURL(f, 700);
      refresh();
    } catch { toast('That logo could not be read.', 'error'); }
  });
}

function writeSettingsToForm() {
  for (const [sel, key, kind] of BINDINGS) {
    const el = $(sel);
    if (!el) continue;
    if (kind === 'checked') el.checked = !!S.settings[key];
    else el.value = S.settings[key];
  }
  $('#preset-select').value = S.settings.preset;
  document.documentElement.style.setProperty('--accent', S.settings.accent);
}

function persistSettings() {
  try {
    const { logo, ...rest } = S.settings;
    localStorage.setItem('auctionbook:settings', JSON.stringify(rest));
  } catch { /* storage may be unavailable; settings just won't persist */ }
}

function restoreSettings() {
  try {
    const raw = localStorage.getItem('auctionbook:settings');
    if (raw) Object.assign(S.settings, JSON.parse(raw));
  } catch { /* ignore */ }
  writeSettingsToForm();
}

/* ── preview ────────────────────────────────────────────────────────────── */

let timer;
function refresh() {
  clearTimeout(timer);
  timer = setTimeout(render, 90);
}

function render() {
  if (!S.rows.length) return;
  $('#empty-state').classList.add('hidden');

  S.players = normalize(S.rows, S.fields, S.settings, S.photoIndex);
  S.book = buildBook(S.players, S.settings);
  $('#preview').innerHTML = S.book.html;
  $('#page-count').textContent =
    `${S.book.pageCount} page${S.book.pageCount === 1 ? '' : 's'} · ${S.players.length} players`;

  let ps = document.getElementById('print-style');
  if (!ps) {
    ps = document.createElement('style');
    ps.id = 'print-style';
    document.head.appendChild(ps);
  }
  ps.textContent = `@page { size: ${S.book.pageSizeCss}; margin: 0; }`;
  applyZoom();
}

function bindZoom() {
  const LEVELS = ['fit', 0.5, 0.75, 1, 1.25];
  const step = dir => {
    const i = LEVELS.indexOf(S.zoom);
    S.zoom = LEVELS[Math.min(LEVELS.length - 1, Math.max(0, i + dir))];
    applyZoom();
  };
  $('#zoom-in').addEventListener('click', () => step(1));
  $('#zoom-out').addEventListener('click', () => step(-1));
}

function applyZoom() {
  const bk = $('#preview .bk');
  if (!bk) return;
  const page = bk.querySelector('.page');
  if (!page) return;
  bk.style.transform = 'none';
  const pw = page.getBoundingClientRect().width;
  const avail = $('#preview-scroll').clientWidth - 40;
  const scale = S.zoom === 'fit' ? Math.min(1, avail / pw) : S.zoom;
  bk.style.transformOrigin = 'top center';
  bk.style.transform = `scale(${scale})`;
  bk.style.height = `${bk.scrollHeight * scale}px`;
  $('#zoom-label').textContent = S.zoom === 'fit' ? 'Fit' : `${Math.round(scale * 100)}%`;
}

/* ── actions ────────────────────────────────────────────────────────────── */

function bindActions() {
  $$('#btn-print, #btn-print-2').forEach(b => b.addEventListener('click', () => {
    const bk = $('#preview .bk');
    if (bk) { bk.style.transform = 'none'; bk.style.height = 'auto'; }
    setTimeout(() => { window.print(); applyZoom(); }, 80);
  }));

  $$('#btn-export, #btn-export-2').forEach(b => b.addEventListener('click', doExport));
  $('#btn-save-project').addEventListener('click', saveProject);
  $('#btn-load-project').addEventListener('click', openProject);
}

async function doExport() {
  if (!S.book) return;
  toast('Building your shareable booklet…');
  try {
    const groupField = S.fields.find(f => f.key === S.settings.groupBy);
    const html = await buildShareFile(S.players, S.book, {
      ...S.settings,
      groupLabel: groupField ? groupField.label : 'Category',
    }, {
      tracker: S.settings.tracker,
      id: slug(S.settings.title || 'auction'),
    });
    download(`${slug(S.settings.title || 'auction-booklet')}.html`, html, 'text/html');
    const mb = (new Blob([html]).size / 1048576).toFixed(1);
    toast(`Booklet ready — ${mb} MB. Send that file to your participants.`);
  } catch (err) {
    console.error(err);
    toast(`Export failed: ${err.message}`, 'error');
  }
}

function saveProject() {
  const project = {
    v: 1,
    settings: S.settings,
    fields: S.fields,
    headers: S.headers,
    rows: S.rows,
    photos: [...S.photoIndex.entries()],
  };
  download(`${slug(S.settings.title || 'auction')}.auctionbook.json`,
    JSON.stringify(project), 'application/json');
  toast('Project saved. Re-open it any time with “Open project”.');
}

function openProject() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json,.auctionbook.json';
  inp.onchange = async () => {
    const f = inp.files[0];
    if (!f) return;
    try {
      const p = JSON.parse(await f.text());
      if (!p.rows) throw new Error('not an AuctionBook project');
      Object.assign(S.settings, DEFAULTS, p.settings);
      S.fields = p.fields;
      S.headers = p.headers;
      S.rows = p.rows;
      S.photoIndex = new Map(p.photos || []);
      writeSettingsToForm();
      fillColumnSelects();
      renderMapList();
      $('#data-summary').classList.add('hidden');
      $('#row-count').textContent = S.rows.length;
      $$('#btn-print, #btn-print-2, #btn-export, #btn-export-2, #btn-save-project')
        .forEach(b => { b.disabled = false; });
      $('#empty-state').classList.add('hidden');
      render();
      toast(`Reopened ${S.rows.length} players.`);
    } catch (err) {
      toast(`Could not open that project: ${err.message}`, 'error');
    }
  };
  inp.click();
}

/* ── utilities ──────────────────────────────────────────────────────────── */

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '').slice(0, 60) || 'auction';

let toastTimer;
function toast(msg, kind = 'ok') {
  const t = $('#toast');
  t.textContent = msg;
  t.dataset.kind = kind;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, kind === 'error' ? 6000 : 3500);
}

boot();
