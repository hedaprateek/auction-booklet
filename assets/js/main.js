import { readWorkbook, sheetGrid, gridToTable, toNumber } from './parse.js';
import { autoMap, prettyLabel } from './mapping.js';
import { ROLES, PRESETS, getPreset } from './presets.js';
import { balanceTeams, teamSpread, teamsAsText } from './teams.js';
import { buildAppsScript, buildQuestionList, DEFAULT_FORM } from './formbuilder.js';
import { COMPETITIONS, getCompetition, isCompetition, criteriaTotal } from './competitions.js';
import { buildJudgeSheets, buildCertificates, buildScoringWorkbook, buildBlankTemplate, workbookBytes } from './judging.js';
import { buildOwnerPacks, buildOwnerWorkbook } from './ownerpack.js';
import * as A from './auctioneer.js';
import { FLEX_SIZES, FLEX_TEMPLATES, buildFlex, squadFor, teamNames, teamLogoFor } from './flex.js';
import { createAuction } from './auctioneer.js';
import { normalize, buildBook, buildDraftSheet, parseTeams } from './render.js';
import { buildPhotoIndex, resizeToDataURL, normalizeKey } from './images.js';
import { buildShareFile } from './export.js';
import { buildLiveBoard } from './liveboard.js';
import { esc, formatMoney } from './format.js';
import { AVATAR_STYLES, avatarMark } from './avatars.js';
import { SAMPLE } from './sample-data.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const DEFAULTS = {
  preset: 'generic',
  title: '', subtitle: '', footer: '', logo: '',
  accent: '#c2410c', theme: 'classic',
  pageSize: 'a4', perPage: 9,
  groupBy: '', sortBy: '', sortDesc: false,
  currency: '₹', numberFormat: 'indian',
  showCover: true, showIndex: true, writeIn: true, showPhotos: true,
  sequentialLots: false, sectionBreak: false,
  teamsText: '', rulesText: '', tracker: true, qrLink: '',
  ratingSource: 'manual', ratingColumn: '', avatarStyle: 'monogram',
  judges: '', noun: '', criteria: null,
  minSquad: 11, maxSquad: 14, minBase: '',
};

const S = {
  wb: null, sheetName: '', headerRow: 1,
  headers: [], rows: [], fields: [],
  photoIndex: new Map(),
  teamLogos: new Map(),
  settings: { ...DEFAULTS },
  zoom: 'fit',
  book: null, players: null,
  ratings: {}, ratingsSig: null, draft: null, draftSeed: 1, view: 'booklet',
  criteria: [], auction: null, flexBg: '',
};

export const BRAND = 'Stunity tech - by Prateek';

const assets = () => ({ teamLogos: S.teamLogos });

/** A judged preset brings criteria; a sports preset has none. */
const defaultCriteria = id => (getCompetition(id)?.criteria || []).map(c => ({ ...c }));

/* ── boot ───────────────────────────────────────────────────────────────── */

function boot() {
  $('#s-avatar').innerHTML = AVATAR_STYLES.map(a =>
    `<option value="${a.id}">${esc(a.label)}</option>`).join('');
  $('#preset-select').innerHTML =
    '<optgroup label="Sports auctions">'
    + PRESETS.map(p => `<option value="${p.id}">${esc(p.label)}</option>`).join('')
    + '</optgroup><optgroup label="Judged competitions">'
    + COMPETITIONS.map(c => `<option value="${c.id}">${esc(c.label)}</option>`).join('')
    + '</optgroup>';

  restoreSettings();
  S.criteria = S.settings.criteria || defaultCriteria(S.settings.preset);
  $('#j-judges').value = S.settings.judges || '';
  renderCriteria();
  bindData();
  bindSettings();
  bindActions();
  bindZoom();
  bindDraft();
  bindJudging();
  bindTemplates();
  bindOwners();
  bindAuction();
  bindFlex();
  bindForm();
  registerServiceWorker();
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

  $('#s-teamlogos').addEventListener('change', async e => {
    if (!e.target.files?.length) return;
    $('#logo-status').textContent = 'Reading logos…';
    S.teamLogos = await buildPhotoIndex(e.target.files);
    const names = parseTeams(S.settings.teamsText).map(t => normalizeKey(t.name));
    const matched = names.filter(n => S.teamLogos.has(n)).length;
    $('#logo-status').textContent =
      `${S.teamLogos.size} logo${S.teamLogos.size === 1 ? '' : 's'} loaded · matched to ${matched} of ${names.length} teams`;
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
  $$('#btn-print, #btn-print-2, #btn-export, #btn-export-2, #btn-save-project, #btn-liveboard, #d-make, #d-shuffle, #j-sheets, #j-workbook, #j-certs')
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
  const g = $('#s-groupby'), s = $('#s-sortby'), r = $('#d-column');
  g.innerHTML = `<option value="">No sections</option>${opts}`;
  s.innerHTML = `<option value="">Spreadsheet order</option>${opts}`;
  g.value = S.settings.groupBy || '';
  s.value = S.settings.sortBy || '';

  // A column already mapped as Rating is the obvious default.
  const rated = S.fields.find(f => f.role === 'rating');
  r.innerHTML = opts;
  if (rated) {
    S.settings.ratingColumn ||= rated.key;
    if (S.settings.ratingSource === 'manual') S.settings.ratingSource = 'column';
  }
  r.value = S.settings.ratingColumn || '';
  $('#d-source').value = S.settings.ratingSource;
  $('#d-col-wrap').hidden = S.settings.ratingSource !== 'column';
  $('#d-manual').hidden = S.settings.ratingSource === 'column';
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
  ['#s-lot', 'sequentialLots', 'checked'], ['#s-avatar', 'avatarStyle', 'value'], ['#s-sectionbreak', 'sectionBreak', 'checked'],
  ['#s-teams', 'teamsText', 'value'], ['#s-rules', 'rulesText', 'value'],
  ['#s-tracker', 'tracker', 'checked'], ['#s-qrlink', 'qrLink', 'value'],
  ['#s-minsquad', 'minSquad', 'number'], ['#s-maxsquad', 'maxSquad', 'number'],
  ['#s-minbase', 'minBase', 'value'],
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

    // A judged competition brings its own criteria, vocabulary and colour.
    // Switching back to a sport must CLEAR them, not leave the last
    // competition's criteria sitting in the Judging panel.
    const comp = getCompetition(e.target.value);
    S.criteria = comp ? comp.criteria.map(c => ({ ...c })) : [];
    S.settings.noun = comp ? comp.noun : '';
    S.settings.criteria = S.criteria;
    renderCriteria();
    if (comp) {
      $('#panel-judge').open = true;
      toast(`${comp.label}: ${comp.criteria.length} criteria loaded. Edit them in Judging.`);
    }

    const p = comp || getPreset(e.target.value);
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
    localStorage.setItem('auctionbook:settings',
      JSON.stringify({ ...rest, v: SETTINGS_VERSION }));
  } catch { /* storage may be unavailable; settings just won't persist */ }
}

/**
 * Settings saved by an older build take precedence over DEFAULTS, which means
 * changing a default never reaches anyone who has used the app before — they
 * keep whatever their browser stored. LAYOUT_KEYS are the ones where a new
 * default is a deliberate improvement rather than a preference, so a bump to
 * SETTINGS_VERSION re-applies them once and leaves everything else alone.
 */
const SETTINGS_VERSION = 2;
const LAYOUT_KEYS = ['perPage', 'sectionBreak'];

function restoreSettings() {
  try {
    const raw = localStorage.getItem('auctionbook:settings');
    if (raw) {
      const saved = JSON.parse(raw);
      Object.assign(S.settings, saved);
      if (saved.v !== SETTINGS_VERSION) {
        for (const k of LAYOUT_KEYS) S.settings[k] = DEFAULTS[k];
        persistSettings();
      }
    }
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

  // These tabs are the only way to reach the judging sheets, certificates,
  // owner packs and the auction console. They used to appear only after a team
  // draw, which left most of the tool unreachable.
  $('#view-tabs').hidden = false;
  $$('#view-tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === S.view));

  // The console is a live UI, not a printable page — it replaces the preview.
  const running = S.view === 'auction';
  $('#console').hidden = !running;
  $('#preview').hidden = running;
  if (running) {
    if (!S.auction) S.auction = loadAuction();
    $('#page-count').textContent = `${S.players.length} lots`;
    renderConsole();
    return;
  }

  if (S.view === 'flex') {
    const cfg = flexConfig();
    const f = buildFlex(cfg, flexContext(cfg));
    S.book = { html: f.html, pageCount: 1, pageSizeCss: f.pageSizeCss };
    $('#page-count').textContent = `Flex banner · ${f.label}`;
    updateFlexNote();
  } else if (S.view === 'judge') {
    S.book = buildJudgeSheets(S.players, judgeConfig());
    const n = judgeConfig().judges.length || 1;
    $('#page-count').textContent =
      `${S.book.pageCount} sheet${S.book.pageCount === 1 ? '' : 's'} · ${n} judge${n === 1 ? '' : 's'}`;
  } else if (S.view === 'certs') {
    S.book = buildCertificates(S.players, judgeConfig());
    $('#page-count').textContent = `${S.book.pageCount} certificates`;
  } else if (S.view === 'owners') {
    S.book = buildOwnerPacks(S.settings, { teamLogos: S.teamLogos, categories: ownerCategories() });
    const t = parseTeams(S.settings.teamsText).length;
    $('#page-count').textContent = `${t} owner pack${t === 1 ? '' : 's'} · ${S.book.pageCount} pages`;
  } else if (S.view === 'draft' && S.draft) {
    S.book = buildDraftSheet(S.draft, S.settings, { ratingOf, spread: teamSpread(S.draft) });
    $('#page-count').textContent = `${S.draft.length} teams · ${S.players.length} players`;
  } else {
    S.book = buildBook(S.players, S.settings, assets());
    $('#page-count').textContent =
      `${S.book.pageCount} page${S.book.pageCount === 1 ? '' : 's'} · ${S.players.length} players`;
  }
  $('#preview').innerHTML = S.book.html;

  let ps = document.getElementById('print-style');
  if (!ps) {
    ps = document.createElement('style');
    ps.id = 'print-style';
    document.head.appendChild(ps);
  }
  ps.textContent = `@page { size: ${S.book.pageSizeCss}; margin: 0; }`;
  applyZoom();

  // These depend on S.players, which only exists once the booklet has been
  // built — so they belong here rather than in reparse().
  if (S.view === 'booklet') renderRatings();
  seedFormFromData();
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
  // A flex banner is not a .bk of pages — without this it sat at full size
  // (a 6 ft banner is 6912px wide) and the preview showed a fragment of it.
  const bk = $('#preview .bk') || $('#preview .flexwrap');
  if (!bk) return;
  const page = bk.querySelector('.page') || bk.querySelector('.flex-banner');
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

/* ── 5 · judging ────────────────────────────────────────────────────────── */

function judgeConfig() {
  return {
    ...S.settings,
    noun: S.settings.noun || 'Participant',
    judges: $('#j-judges').value.split('\n').map(s => s.trim()).filter(Boolean),
    criteria: S.criteria,
  };
}

function bindJudging() {
  $('#j-judges').addEventListener('input', () => { S.settings.judges = $('#j-judges').value; persistSettings(); });

  $('#j-criteria').addEventListener('input', e => {
    const i = e.target.dataset.i;
    if (i == null) return;
    S.criteria[i][e.target.dataset.k] = e.target.dataset.k === 'max'
      ? Number(e.target.value) || 0 : e.target.value;
    updateCriteriaTotal();
  });
  $('#j-criteria').addEventListener('click', e => {
    const i = e.target.dataset.del;
    if (i == null) return;
    S.criteria.splice(Number(i), 1);
    renderCriteria();
  });
  $('#j-add').addEventListener('click', () => {
    S.criteria.push({ name: 'New criterion', max: 10 });
    renderCriteria();
  });

  $('#j-sheets').addEventListener('click', () => showView('judge'));
  $('#j-certs').addEventListener('click', () => showView('certs'));
  $('#j-workbook').addEventListener('click', () => {
    if (!S.players?.length) return;
    const wb = buildScoringWorkbook(S.players, judgeConfig());
    download(`${slug(S.settings.title || 'competition')}-scoring.xlsx`,
      workbookBytes(wb), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const n = judgeConfig().judges.length || 1;
    toast(`Workbook downloaded — ${n} judge tab${n === 1 ? '' : 's'} plus a summary that ranks itself.`);
  });
}

function renderCriteria() {
  $('#j-criteria').innerHTML = S.criteria.map((c, i) => `
    <div class="maprow">
      <input type="text" data-i="${i}" data-k="name" value="${esc(c.name).replace(/"/g, '&quot;')}">
      <input type="number" data-i="${i}" data-k="max" min="1" max="100" value="${c.max}">
      <button class="btn btn-icon" data-del="${i}" title="Remove">×</button>
    </div>`).join('');
  updateCriteriaTotal();
  S.settings.criteria = S.criteria;
  persistSettings();
}

function updateCriteriaTotal() {
  const t = criteriaTotal(S.criteria);
  $('#j-total').innerHTML = t === 100
    ? `Total <strong>${t}</strong> — judges mark each entry out of 100.`
    : `Total <strong>${t}</strong>. Most events add up to 100, but any total works — the sheets and workbook follow whatever you set.`;
}

function showView(view) {
  S.view = view;
  $('#view-tabs').hidden = false;
  $$('#view-tabs button').forEach(x => x.classList.toggle('on', x.dataset.view === view));
  render();
}

/* ── flex banner ────────────────────────────────────────────────────────── */

const FLEX_FIELDS = [
  ['#x-kicker', 'kicker'], ['#x-title', 'title'], ['#x-sub', 'subtitle'],
  ['#x-date', 'date'], ['#x-venue', 'venue'], ['#x-blurb', 'blurb'],
  ['#x-footer', 'footer'], ['#x-sponsors', 'sponsors'],
];

function flexConfig() {
  const c = { accent: S.settings.accent, logo: S.settings.logo, bg: S.flexBg };
  for (const [sel, k] of FLEX_FIELDS) c[k] = $(sel).value;
  c.sizeId = $('#x-size').value;
  c.template = $('#x-tpl').value;
  c.customW = $('#x-w').value;
  c.customH = $('#x-h').value;
  c.dark = $('#x-dark').checked;
  c.safe = $('#x-safe').checked;
  c.bgOpacity = Number($('#x-bgop').value) / 100;
  c.teamName = $('#x-team').value;
  c.teamLogo = teamLogoFor(c.teamName, S.teamLogos);
  return c;
}

function flexContext(cfg) {
  const ctx = { settings: S.settings };
  if (cfg.template === 'squad') {
    ctx.squad = squadFor(cfg.teamName, { auction: S.auction, draft: S.draft, players: S.players });
  } else if (cfg.template === 'spotlight') {
    ctx.spotlight = S.players?.find(p => p.lot === $('#x-player').value) || S.players?.[0];
  } else if (cfg.template === 'winners') {
    // Top three by price paid, once the auction has run.
    const sold = S.auction ? A.soldLots(S.auction) : [];
    const byLot = new Map((S.players || []).map(p => [p.lot, p]));
    ctx.winners = sold
      .map(lot => ({ ...byLot.get(lot), note: S.auction.results[lot].team,
        price: Number(S.auction.results[lot].price) || 0 }))
      .sort((a, b) => b.price - a.price).slice(0, 3);
    if (!ctx.winners.length) ctx.winners = (S.players || []).slice(0, 3).map(p => ({ ...p, note: '' }));
  } else if (cfg.template === 'event') {
    ctx.facts = [
      S.players?.length ? { n: S.players.length, l: 'Players' } : null,
      teamNames(S.settings, S.draft).length
        ? { n: teamNames(S.settings, S.draft).length, l: 'Teams' } : null,
    ].filter(Boolean);
  }
  return ctx;
}

function bindFlex() {
  $('#x-size').innerHTML = FLEX_SIZES.map(s =>
    `<option value="${s.id}">${esc(s.label)}</option>`).join('');
  $('#x-tpl').innerHTML = FLEX_TEMPLATES.map(t =>
    `<option value="${t.id}">${esc(t.label)}</option>`).join('');

  const live = () => { if (S.view === 'flex') render(); else updateFlexNote(); };
  for (const [sel] of FLEX_FIELDS) $(sel).addEventListener('input', live);
  ['#x-size', '#x-tpl', '#x-w', '#x-h', '#x-dark', '#x-safe', '#x-bgop', '#x-team', '#x-player']
    .forEach(sel => $(sel).addEventListener('input', () => { flexPickers(); live(); }));

  $('#x-bg').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) { S.flexBg = ''; return live(); }
    try {
      // Banners are big; keep the source generous so it does not go soft.
      S.flexBg = await resizeToDataURL(f, 2000);
      live();
    } catch { toast('That image could not be read.', 'error'); }
  });

  $('#x-show').addEventListener('click', () => { seedFlex(); showView('flex'); });
  $('#x-print').addEventListener('click', () => {
    seedFlex();
    showView('flex');
    setTimeout(() => {
      const el = $('#preview .flex-banner');
      if (el) { el.style.transform = 'none'; }
      window.print();
      applyZoom();
    }, 250);
  });
}

/** Fill the banner from the booklet's own settings the first time. */
function seedFlex() {
  const set = (sel, v) => { const el = $(sel); if (!el.dataset.touched && !el.value && v) el.value = v; };
  set('#x-title', S.settings.title);
  set('#x-sub', S.settings.subtitle);
  set('#x-footer', S.settings.footer);
  set('#x-kicker', 'Auction');
  flexPickers();
}

function flexPickers() {
  const tpl = $('#x-tpl').value;
  $('#x-team-wrap').hidden = tpl !== 'squad';
  $('#x-player-wrap').hidden = tpl !== 'spotlight';

  const teams = teamNames(S.settings, S.draft);
  const keepT = $('#x-team').value;
  $('#x-team').innerHTML = teams.map(t => `<option>${esc(t)}</option>`).join('');
  if (teams.includes(keepT)) $('#x-team').value = keepT;

  const keepP = $('#x-player').value;
  $('#x-player').innerHTML = (S.players || []).map(p =>
    `<option value="${esc(p.lot)}">${esc(p.lot)} · ${esc(p.name)}</option>`).join('');
  if (keepP) $('#x-player').value = keepP;
}

function updateFlexNote() {
  const f = buildFlex(flexConfig(), flexContext(flexConfig()));
  $('#x-note').innerHTML = `Prints as one page at <strong>${esc(f.label)}</strong>
    (${f.wIn} × ${f.hIn} in). In the print dialog choose <strong>Save as PDF</strong>,
    margins <strong>None</strong>, and turn on <strong>background graphics</strong>.
    Hand that PDF to the flex shop.`;
}

/* ── the auctioneer's console ───────────────────────────────────────────── */

const auctionKey = () => `auctionbook:auction:${slug(S.settings.title || 'auction')}`;

function saveAuction() {
  try { localStorage.setItem(auctionKey(), JSON.stringify(S.auction)); } catch { /* full or blocked */ }
}

/** Resume where the room actually is, or start a fresh run. */
function loadAuction() {
  if (!S.players?.length) return null;
  try {
    const raw = localStorage.getItem(auctionKey());
    if (raw) {
      const a = JSON.parse(raw);
      // Only reuse it if it still matches the loaded player list.
      const lots = S.players.map(p => p.lot).join('|');
      if (a.order?.join('|') === lots) return a;
    }
  } catch { /* ignore */ }
  return createAuction(S.players, S.settings);
}

function bindAuction() {
  $('#c-undo').addEventListener('click', () => { A.undo(S.auction); afterMove(); });
  $('#c-skip').addEventListener('click', () => { A.skip(S.auction); afterMove(); });
  $('#c-unsold').addEventListener('click', () => sellOrPass(null));
  $('#c-reopen').addEventListener('click', () => {
    const n = A.unsoldPile(S.auction).length;
    if (!n) return toast('Nothing in the unsold pile yet.');
    A.reopenUnsold(S.auction);
    afterMove();
    toast(`${n} unsold player${n === 1 ? '' : 's'} back in the queue — round ${S.auction.round}.`);
  });
  $('#c-csv').addEventListener('click', () => {
    download(`${slug(S.settings.title || 'auction')}-results.csv`,
      A.resultsCsv(S.auction, S.players, S.settings), 'text/csv');
    toast('Results exported.');
  });
  $('#c-reset').addEventListener('click', () => {
    if (!confirm('Clear every sale and start this auction again?')) return;
    S.auction = createAuction(S.players, S.settings);
    afterMove();
  });

  $('#c-steps').addEventListener('click', e => {
    const b = e.target.closest('[data-step]');
    if (!b) return;
    S.auction.bid = Math.max(0, S.auction.bid + Number(b.dataset.step));
    afterMove();
  });
  $('#c-teams').addEventListener('click', e => {
    const b = e.target.closest('[data-team]');
    if (b && !b.disabled) sellOrPass(b.dataset.team);
  });

  // An auctioneer works at speaking pace, not mouse pace.
  document.addEventListener('keydown', e => {
    if (S.view !== 'auction' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const teams = A.teamStats(S.auction, S.settings);
    const k = e.key.toLowerCase();
    if (k >= '1' && k <= '9') {
      const t = teams[Number(k) - 1];
      if (t && A.canBid(t, S.auction.bid)) sellOrPass(t.name);
    } else if (k === 'u') sellOrPass(null);
    else if (k === 's') { A.skip(S.auction); afterMove(); }
    else if (k === 'z') { A.undo(S.auction); afterMove(); }
    else if (e.key === 'ArrowRight') { A.goTo(S.auction, S.auction.idx + 1); afterMove(); }
    else if (e.key === 'ArrowLeft') { A.goTo(S.auction, S.auction.idx - 1); afterMove(); }
    else if (e.key === '+' || e.key === '=') { bumpBid(1); }
    else if (e.key === '-') { bumpBid(-1); }
    else return;
    e.preventDefault();
  });
}

const bumpBid = dir => {
  S.auction.bid = Math.max(0, S.auction.bid + dir * A.bidSteps(S.settings)[0]);
  afterMove();
};

function sellOrPass(teamName) {
  const lot = S.auction.order[S.auction.idx];
  if (!lot || S.auction.results[lot]) return;
  if (teamName) {
    if (!S.auction.bid) return toast('Set the winning bid first.', 'error');
    A.sell(S.auction, lot, teamName, S.auction.bid);
  } else {
    A.markUnsold(S.auction, lot);
  }
  afterMove();
}

function afterMove() { saveAuction(); renderConsole(); }

function renderConsole() {
  if (!S.auction || !S.players?.length) return;
  const st = S.settings;
  const money = v => formatMoney(v, st.currency, st.numberFormat);
  const byLot = new Map(S.players.map(p => [p.lot, p]));
  const lot = S.auction.order[S.auction.idx];
  const p = byLot.get(lot);
  const done = A.progress(S.auction);

  $('#c-prog').innerHTML =
    `<b>${done.sold}</b> sold · <b>${done.unsold}</b> unsold · <b>${done.left}</b> to call`;
  $('#c-round').textContent = `Round ${S.auction.round}`;

  // ── the lot on the block ──
  if (!p || done.left === 0) {
    $('#c-lot').innerHTML = `<div class="con-done">
      Every player has been called. ${done.unsold} unsold —
      use <strong>Reopen unsold</strong> for another round, or export the results.</div>`;
  } else {
    const sub = [p.category !== 'All Players' ? p.category : '', ...p.subtitle.map(x => x.value)]
      .filter(Boolean).join(' · ');
    $('#c-lot').innerHTML = `
      <div class="con-photo">${p.photo
        ? `<img src="${esc(p.photo)}" alt="">`
        : avatarMark(p, st.avatarStyle, st.accent)}</div>
      <div class="con-info">
        <span class="con-lotno">Lot ${esc(p.lot)}</span>
        <h2>${esc(p.name)}</h2>
        ${sub ? `<div class="sub">${esc(sub)}</div>` : ''}
        ${p.stats.length ? `<dl class="con-stats">${p.stats.slice(0, 5).map(s =>
          `<div class="con-stat"><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('')}</dl>` : ''}
        ${p.basePrice !== '' ? `<div class="con-basep">Base price
          <b>${esc(money(p.basePrice))}</b></div>` : ''}
      </div>`;
    if (!S.auction.bid) S.auction.bid = A.openingBid(p, st);
  }

  $('#c-amount').textContent = S.auction.bid ? money(S.auction.bid) : '—';
  $('#c-steps').innerHTML = A.bidSteps(st).map(v =>
    `<button class="btn" data-step="${v}">+${money(v)}</button>`).join('')
    + `<button class="btn" data-step="${-A.bidSteps(st)[0]}">−</button>`;

  // ── who can actually take it ──
  const teams = A.teamStats(S.auction, st);
  $('#c-teams').innerHTML = teams.length
    ? teams.map((t, i) => {
      const ok = A.canBid(t, S.auction.bid) && done.left > 0;
      return `<button class="con-team" data-team="${esc(t.name)}" ${ok ? '' : 'disabled'}
        title="${t.full ? 'Squad full' : `Max bid ${money(t.maxBid)}`}">
        <span class="k">${i + 1}</span>${esc(t.name)}
        <span class="max">${t.full ? 'squad full' : `max ${money(t.maxBid)}`}</span>
      </button>`;
    }).join('')
    : '<p class="hint">Add teams in panel 4 to record who wins each player.</p>';

  $('#c-strip').innerHTML = teams.map(t => `
    <div class="con-purse ${t.balance <= 0 ? 'spent' : ''}">
      <div class="n">${esc(t.name)}</div>
      <div class="b">${esc(money(t.balance))}</div>
      <div class="m">${t.bought} bought · ${t.slotsLeft} slot${t.slotsLeft === 1 ? '' : 's'} to fill</div>
    </div>`).join('');
}

/* ── team owner packs ───────────────────────────────────────────────────── */

function ownerCategories() {
  if (!S.players?.length || !S.settings.groupBy) return [];
  return [...new Set(S.players
    .map(p => String(p.row[S.settings.groupBy] || '').trim())
    .filter(Boolean))];
}

function bindOwners() {
  $('#btn-ownerpack').addEventListener('click', () => {
    if (!parseTeams(S.settings.teamsText).length) {
      toast('Add your teams above first — one per line, as “Name, Purse”.', 'error');
      return;
    }
    showView('owners');
  });

  $('#btn-ownerbook').addEventListener('click', () => {
    if (!parseTeams(S.settings.teamsText).length) {
      toast('Add your teams above first — one per line, as “Name, Purse”.', 'error');
      return;
    }
    download(`${slug(S.settings.title || 'auction')}-bidding-tracker.xlsx`,
      workbookBytes(buildOwnerWorkbook(S.settings)),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    toast('Tracker downloaded — one tab per team, and the max-bid figure updates itself.');
  });
}

/* ── 6 · blank templates ────────────────────────────────────────────────── */

function bindTemplates() {
  const opts = [
    '<optgroup label="Judged competitions">',
    ...COMPETITIONS.map(c => `<option value="c:${c.id}">${esc(c.label)}</option>`),
    '</optgroup><optgroup label="Sports auctions">',
    ...PRESETS.map(p => `<option value="p:${p.id}">${esc(p.label)}</option>`),
    '</optgroup>',
  ].join('');
  $('#t-pick').innerHTML = opts;
  $('#t-pick').addEventListener('change', describeTemplate);
  describeTemplate();

  $('#t-download').addEventListener('click', () => {
    const comp = pickedTemplate();
    download(`${slug(comp.label)}-template.xlsx`,
      workbookBytes(buildBlankTemplate(comp)),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    toast(`${comp.label} template downloaded.`);
  });
}

function pickedTemplate() {
  const v = $('#t-pick').value;
  const id = v.slice(2);
  return v.startsWith('c:')
    ? getCompetition(id)
    : { ...getPreset(id), fields: [], categories: [] };
}

function describeTemplate() {
  const c = pickedTemplate();
  $('#t-about').innerHTML = c.criteria
    ? `Columns for ${esc(c.label.toLowerCase())}, plus a sheet listing the judging criteria — ${
      c.criteria.map(x => `${esc(x.name)} ${x.max}`).join(', ')}.`
    : `Columns for ${esc(c.label.toLowerCase())}, including a base price for the auction.`;
}

/* ── 7 · draft teams (no auction) ───────────────────────────────────────── */

const ratingKey = p => p.lot + '|' + p.name;
const scaleMax = () => Number($('#d-scale').value) || 10;

function ratingOf(p) {
  if (S.settings.ratingSource === 'column' && S.settings.ratingColumn) {
    const n = toNumber(p.row[S.settings.ratingColumn]);
    if (n != null) return n;
  }
  const r = S.ratings[ratingKey(p)];
  return r == null ? Math.round(scaleMax() / 2) : r;
}

function bindDraft() {
  $('#d-source').addEventListener('change', e => {
    S.settings.ratingSource = e.target.value;
    $('#d-col-wrap').hidden = e.target.value !== 'column';
    $('#d-manual').hidden = e.target.value === 'column';
    persistSettings();
    renderRatings(true);
  });
  $('#d-column').addEventListener('change', e => { S.settings.ratingColumn = e.target.value; persistSettings(); });
  $('#d-scale').addEventListener('change', () => { S.ratings = {}; renderRatings(true); });
  $('#d-search').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    $$('#d-ratings .rate-row').forEach(r => { r.hidden = !!q && !r.dataset.find.includes(q); });
  });
  $('#d-reset-ratings').addEventListener('click', () => { S.ratings = {}; renderRatings(true); });

  $('#d-ratings').addEventListener('input', e => {
    const row = e.target.closest('.rate-row');
    if (!row) return;
    S.ratings[row.dataset.key] = Number(e.target.value);
    row.querySelector('.val').textContent = e.target.value;
  });

  $('#d-make').addEventListener('click', () => { S.draftSeed = (S.draftSeed || 1); drawTeams(); });
  $('#d-shuffle').addEventListener('click', () => { S.draftSeed = (S.draftSeed || 1) + 1; drawTeams(); });
  $('#d-copy').addEventListener('click', async () => {
    if (!S.draft) return;
    const text = teamsAsText(S.draft, { title: S.settings.title, ratingOf, showRatings: true })
      + `\n\n${BRAND}`;
    await copy(text, 'Teams copied — paste them straight into WhatsApp.');
  });

  $('#view-tabs').addEventListener('click', e => {
    const b = e.target.closest('button[data-view]');
    if (!b) return;
    // The teams sheet needs a draw first, and would otherwise silently show
    // the booklet again.
    if (b.dataset.view === 'draft' && !S.draft) {
      toast('Draw the teams first — panel 7, “Draw the teams”.');
      $('#panel-draft').open = true;
      return;
    }
    S.view = b.dataset.view;
    $$('#view-tabs button').forEach(x => x.classList.toggle('on', x === b));
    render();
  });
}

/**
 * Rebuild the ratings list only when the roster or the scale actually changes.
 * This runs on every render, and rebuilding regardless would reset the search
 * filter and replace the DOM under a slider being dragged.
 */
function renderRatings(force = false) {
  if (!S.players) return;
  const max = scaleMax();
  const sig = `${max}|${S.players.map(ratingKey).join('~')}`;
  if (!force && sig === S.ratingsSig) return;
  S.ratingsSig = sig;
  $('#d-ratings').innerHTML = S.players.map(p => {
    const v = S.ratings[ratingKey(p)] ?? Math.round(max / 2);
    return `<div class="rate-row" data-key="${esc(ratingKey(p))}" data-find="${esc((p.name + ' ' + p.category).toLowerCase())}">
      <span class="who"><span class="nm">${esc(p.name)}</span>
        <span class="ct">${esc(p.category === 'All Players' ? '' : p.category)}</span></span>
      <input type="range" min="1" max="${max}" step="1" value="${v}">
      <span class="val">${v}</span>
    </div>`;
  }).join('');
}

function drawTeams() {
  if (!S.players?.length) return;
  const names = $('#d-usenames').checked ? parseTeams(S.settings.teamsText).map(t => t.name) : [];
  S.draft = balanceTeams(S.players, {
    teamCount: Number($('#d-count').value) || 4,
    teamNames: names,
    ratingOf,
    groupOf: p => p.category,
    byCategory: $('#d-bycat').checked,
    seed: S.draftSeed,
  });
  const sp = teamSpread(S.draft);
  $('#d-result').innerHTML = S.draft.map(t =>
    `<div class="row"><span>${esc(t.name)}</span><b>${t.players.length} · avg ${t.average}</b></div>`).join('')
    + `<p class="fair">Strongest and weakest squad are <strong>${sp.averageGap}</strong> apart on average rating.
       Shuffle again for a different fair draw.</p>`;
  $('#d-copy').disabled = false;
  $('#view-tabs').hidden = false;
  S.view = 'draft';
  $$('#view-tabs button').forEach(x => x.classList.toggle('on', x.dataset.view === 'draft'));
  render();
  toast(`Drew ${S.draft.length} teams.`);
}

/* ── 6 · registration form ──────────────────────────────────────────────── */

const FORM_FIELDS = [
  ['#f-title', 'title'], ['#f-event', 'eventLine'], ['#f-fee', 'fee'], ['#f-closes', 'closes'],
];
const FORM_LISTS = [['#f-cats', 'categories'], ['#f-bands', 'priceBands'],
  ['#f-stats', 'stats'], ['#f-subs', 'subtitles']];
const FORM_FLAGS = [['#f-phone', 'askPhone'], ['#f-photo', 'askPhoto'], ['#f-note', 'askNote'],
  ['#f-email', 'collectEmail'], ['#f-limit', 'limitOne']];

function formConfig() {
  const c = { ...DEFAULT_FORM, currency: S.settings.currency };
  for (const [sel, k] of FORM_FIELDS) c[k] = $(sel).value.trim();
  for (const [sel, k] of FORM_LISTS) {
    c[k] = $(sel).value.split('\n').map(s => s.trim()).filter(Boolean);
  }
  for (const [sel, k] of FORM_FLAGS) c[k] = $(sel).checked;
  if (!c.title) c.title = (S.settings.title || 'Player') + ' — Registration';
  return c;
}

function bindForm() {
  // Once a field has been edited it belongs to the user; seeding leaves it be.
  for (const [sel] of [...FORM_FIELDS, ...FORM_LISTS]) {
    $(sel).addEventListener('input', e => { e.target.dataset.touched = '1'; });
  }

  // Seed from the sport preset, and from the loaded sheet if there is one.
  seedFormFromData();
  $('#preset-select').addEventListener('change', () => setTimeout(seedFormFromData, 0));

  $('#f-copy').addEventListener('click', () =>
    copy(buildAppsScript(formConfig()), 'Script copied. Paste it into script.google.com and press Run.'));
  $('#f-list').addEventListener('click', () =>
    copy(buildQuestionList(formConfig()), 'Question list copied.'));
  $('#f-download').addEventListener('click', () => {
    const c = formConfig();
    download(`${slug(c.title)}.gs`, buildAppsScript(c), 'text/plain');
    toast('Script downloaded. Open script.google.com and paste it in.');
  });
}

/**
 * Fill the form-builder fields from the loaded sheet — but only ever into a
 * field the user has not touched. This runs on every render, so without the
 * touched guard, clearing a box and changing any other setting would refill it
 * from the defaults: edits appear not to stick and content keeps coming back.
 */
function seedFormFromData() {
  const preset = getPreset(S.settings.preset);
  const set = (sel, arr) => {
    const el = $(sel);
    if (el.dataset.touched || el.value.trim()) return;
    el.value = arr.join('\n');
  };

  // Categories and stats from the sheet if it's loaded; otherwise the preset.
  let cats = [], stats = [];
  if (S.players?.length && S.settings.groupBy) {
    cats = [...new Set(S.players.map(p => String(p.row[S.settings.groupBy] || '').trim()).filter(Boolean))];
  }
  if (S.fields?.length) {
    stats = S.fields.filter(f => f.role === 'stat').map(f => f.label).slice(0, 6);
  }
  set('#f-cats', cats.length ? cats : DEFAULT_FORM.categories);
  set('#f-stats', stats.length ? stats : (preset.stats.length
    ? preset.stats.slice(0, 5).map(s => s.replace(/\b\w/g, c => c.toUpperCase()))
    : DEFAULT_FORM.stats));
  set('#f-bands', DEFAULT_FORM.priceBands);
  set('#f-subs', DEFAULT_FORM.subtitles);
  const fill = (sel, v) => {
    const el = $(sel);
    if (!el.dataset.touched && !el.value && v) el.value = v;
  };
  fill('#f-title', S.settings.title && `${S.settings.title} — Player Registration`);
  fill('#f-event', S.settings.subtitle);
}

async function copy(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMsg);
  } catch {
    // Clipboard needs a secure context; fall back to a file so nothing is lost.
    download('auctionbook.txt', text, 'text/plain');
    toast('Clipboard unavailable here — downloaded it as a file instead.');
  }
}

/* ── actions ────────────────────────────────────────────────────────────── */

function bindActions() {
  $$('#btn-print, #btn-print-2').forEach(b => b.addEventListener('click', () => {
    const bk = $('#preview .bk');
    if (bk) { bk.style.transform = 'none'; bk.style.height = 'auto'; }
    setTimeout(() => { window.print(); applyZoom(); }, 80);
  }));

  $$('#btn-export, #btn-export-2').forEach(b => b.addEventListener('click', doExport));
  $('#btn-liveboard').addEventListener('click', () => {
    if (!S.players) return;
    try {
      const html = buildLiveBoard(S.players, S.settings);
      download(`${slug(S.settings.title || 'auction')}-live-board.html`, html, 'text/html');
      toast('Live board ready. Publish it as a Claude Artifact to share it with everyone.');
    } catch (err) {
      toast(`Could not build the live board: ${err.message}`, 'error');
    }
  });
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
      teamLogos: S.teamLogos,
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
    teamLogos: [...S.teamLogos.entries()],
    // Only ratings for players still in the sheet. Otherwise every edited
    // upload leaves its old keys behind and the project file grows forever.
    ratings: Object.fromEntries((S.players || [])
      .map(p => [ratingKey(p), S.ratings[ratingKey(p)]])
      .filter(([, v]) => v != null)),
    criteria: S.criteria,
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
      S.teamLogos = new Map(p.teamLogos || []);
      S.ratings = p.ratings || {};
      S.criteria = p.criteria || defaultCriteria(S.settings.preset);
      renderCriteria();
      writeSettingsToForm();
      fillColumnSelects();
      renderMapList();
      $('#data-summary').classList.add('hidden');
      $('#row-count').textContent = S.rows.length;
      $$('#btn-print, #btn-print-2, #btn-export, #btn-export-2, #btn-save-project, #btn-liveboard')
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

/* ── offline ────────────────────────────────────────────────────────────── */

/**
 * The whole tool is static, so it can be made to work with no connection at
 * all — useful at a ground with no signal on auction day.
 */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;         // no SW without a server
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('Offline support unavailable:', err.message);
    });
  });
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
