// Builds the shareable booklet: one self-contained .html file with the pages,
// the photos, a phone-friendly card list, search/filters and an optional
// auction tracker. No network access required once it is saved.

import { esc, formatMoney, initials } from './format.js';
import { parseTeams } from './render.js';
import { normalizeKey } from './images.js';

/**
 * Photos appear in both the printed pages and the card list. Hoisting each
 * data URL into one array and referencing it by index keeps the file from
 * carrying every image twice.
 */
function dedupePhotos(html, players) {
  const list = [];
  const index = new Map();
  const idOf = src => {
    if (!src) return -1;
    if (!index.has(src)) { index.set(src, list.length); list.push(src); }
    return index.get(src);
  };
  const out = html.replace(/<img src="([^"]+)" alt="" loading="lazy">/g,
    (_, src) => `<img data-ph="${idOf(src.replace(/&amp;/g, '&'))}" alt="" loading="lazy">`);
  return { html: out, photos: list, idOf };
}

function playerPayload(players, settings, idOf) {
  return players.map(p => ({
    l: p.lot,
    n: p.name,
    c: p.category,
    t: p.team,
    b: p.basePrice === '' ? '' : formatMoney(p.basePrice, settings.currency, settings.numberFormat),
    bl: p.baseLabel,
    s: [p.team, ...p.subtitle.map(x => x.value)].filter(Boolean).join(' · '),
    g: p.badges.map(b => b.value),
    st: p.stats.map(x => [x.label, x.value]),
    nt: p.notes.map(x => x.value).join(' · '),
    p: p.photo ? idOf(p.photo) : -1,
    pg: p.page,
  }));
}

export async function buildShareFile(players, book, settings, opts = {}) {
  const bookletCss = await fetch(new URL('../css/booklet.css', import.meta.url)).then(r => r.text());
  const { html, photos, idOf } = dedupePhotos(book.html, players);
  const data = {
    title: settings.title || 'Player Auction',
    subtitle: settings.subtitle || '',
    footer: settings.footer || '',
    accent: settings.accent,
    currency: settings.currency,
    tracker: !!opts.tracker,
    groupLabel: settings.groupLabel || 'Category',
    teams: parseTeams(settings.teamsText).map(t => {
      const logo = (opts.teamLogos || new Map()).get(normalizeKey(t.name));
      return { name: t.name, purse: t.purse, p: logo ? idOf(logo) : -1 };
    }),
    id: opts.id || 'book',
    players: playerPayload(players, settings, idOf),
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(data.title)}</title>
<meta name="robots" content="noindex">
<style>
@page { size: ${book.pageSizeCss}; margin: 0; }
${bookletCss}
${VIEWER_CSS}
</style>
</head>
<body data-view="cards">
<header class="vbar">
  <div class="vbar-top">
    <div class="vtitle">
      <strong>${esc(data.title)}</strong>
      ${data.subtitle ? `<span>${esc(data.subtitle)}</span>` : ''}
    </div>
    <div class="vtabs" role="tablist">
      <button data-view="cards" class="on">Players</button>
      <button data-view="book">Booklet</button>
      ${data.tracker ? '<button data-view="track">Tracker</button>' : ''}
    </div>
  </div>
  <div class="vtools">
    <input id="q" type="search" placeholder="Search players, teams, stats…" autocomplete="off">
    <select id="sort">
      <option value="">Booklet order</option>
      <option value="n">Name A→Z</option>
      <option value="b">Base price (high→low)</option>
    </select>
    <button id="printbtn" class="vghost" title="Print or save as PDF">Print</button>
  </div>
  <div id="chips" class="vchips"></div>
</header>

<main>
  <div id="cards" class="vgrid"></div>
  <div id="empty" class="vempty" hidden>No players match that search.</div>
  <div id="book" class="vbookwrap">${html}</div>
  <div id="track" class="vtrack"></div>
  <div id="squads" class="vsquads">
    <div class="squad-bar">
      <button class="vghost" id="squads-back">← Back to tracker</button>
      <button class="vghost" id="squads-print">Print squads</button>
    </div>
    <div class="bk" data-theme="${esc(settings.theme)}"
      style="--accent:${esc(data.accent)};--pw:${book.pageSizeCss === 'A4' ? '210mm' : '215.9mm'};--ph:${book.pageSizeCss === 'A4' ? '297mm' : '279.4mm'}"></div>
  </div>
</main>

<footer class="vfoot">${esc(data.footer)} <span>· Built with AuctionBook · Stunity tech - by Prateek</span></footer>

<script>
const PHOTOS = ${JSON.stringify(photos)};
const DATA = ${JSON.stringify(data)};
${VIEWER_JS}
</script>
</body>
</html>`;
}

/* ───────────────────────── viewer styles ───────────────────────── */

const VIEWER_CSS = `
:root{--vbg:#f5f4f2;--vsurf:#fff;--vink:#1a1714;--vink2:#5d564e;--vink3:#8d857c;--vline:#e2ded8;--vacc:#c2410c;--vradius:12px}
@media (prefers-color-scheme:dark){:root{--vbg:#151412;--vsurf:#1f1d1a;--vink:#f2efec;--vink2:#b5aea6;--vink3:#877f77;--vline:#33302c}}
*{box-sizing:border-box}
body{margin:0;background:var(--vbg);color:var(--vink);font:15px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:1180px;margin:0 auto;padding:16px 14px 60px}
.vbar{position:sticky;top:0;z-index:10;background:var(--vsurf);border-bottom:1px solid var(--vline)}
.vbar-top{max-width:1180px;margin:0 auto;padding:11px 14px;display:flex;align-items:center;gap:14px;justify-content:space-between;flex-wrap:wrap}
.vtitle strong{display:block;font-size:16px;letter-spacing:-.01em}
.vtitle span{font-size:12.5px;color:var(--vink3)}
.vtabs{display:flex;gap:2px;background:var(--vbg);border:1px solid var(--vline);border-radius:999px;padding:3px}
.vtabs button{font:inherit;font-size:13px;font-weight:600;border:0;background:none;color:var(--vink2);padding:5px 14px;border-radius:999px;cursor:pointer}
.vtabs button.on{background:var(--vacc);color:#fff}
.vtools{max-width:1180px;margin:0 auto;padding:0 14px 11px;display:flex;gap:8px}
.vtools input,.vtools select,.vghost{font:inherit;font-size:14px;padding:8px 11px;border:1px solid var(--vline);border-radius:9px;background:var(--vbg);color:var(--vink)}
.vtools input{flex:1;min-width:0}
.vghost{cursor:pointer;font-weight:600;font-size:13px}
.vchips{max-width:1180px;margin:0 auto;padding:0 14px 10px;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}
.vchips::-webkit-scrollbar{display:none}
.vchip{white-space:nowrap;font-size:12.5px;font-weight:600;padding:5px 12px;border-radius:999px;border:1px solid var(--vline);background:var(--vbg);color:var(--vink2);cursor:pointer}
.vchip.on{background:var(--vacc);border-color:var(--vacc);color:#fff}

.vgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
.vcard{background:var(--vsurf);border:1px solid var(--vline);border-radius:var(--vradius);overflow:hidden;display:flex;flex-direction:column}
.vcard.sold{border-color:#15803d}.vcard.unsold{opacity:.62}
.vc-top{display:flex;gap:11px;padding:12px}
.vc-ph{width:64px;height:64px;flex:none;border-radius:10px;object-fit:cover;background:var(--vbg)}
.vc-ph.noimg{display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--vacc);font-size:19px}
.vc-id{font-size:11px;font-weight:700;color:var(--vink3);letter-spacing:.06em}
.vc-name{font-size:16px;font-weight:650;letter-spacing:-.01em;margin:1px 0 2px;line-height:1.25}
.vc-sub{font-size:12.5px;color:var(--vink3);line-height:1.35}
.vc-badges{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.vc-badge{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--vacc);background:color-mix(in srgb,var(--vacc) 12%,transparent);border-radius:999px;padding:2px 8px}
/* Borders on the tiles rather than a grid gap, so a half-empty last row
   does not leave a phantom tile hanging in the card. */
.vc-stats{display:grid;grid-template-columns:repeat(3,1fr)}
.vc-stat{padding:7px 9px;min-width:0;border-top:1px solid var(--vline);border-right:1px solid var(--vline)}
.vc-stat:nth-child(3n){border-right:0}
.vc-stat dt{font-size:9.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--vink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vc-stat dd{margin:1px 0 0;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vc-note{padding:9px 12px;font-size:12.5px;color:var(--vink2);border-top:1px solid var(--vline);line-height:1.45}
.vc-foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;border-top:1px solid var(--vline)}
.vc-base{font-size:12px;color:var(--vink3)}
.vc-base b{display:block;font-size:14.5px;color:var(--vacc)}
.vc-act{display:flex;gap:5px}
.vc-act button{font:inherit;font-size:12px;font-weight:650;padding:5px 10px;border-radius:7px;border:1px solid var(--vline);background:var(--vbg);color:var(--vink2);cursor:pointer}
.vc-act button.on{background:var(--vacc);border-color:var(--vacc);color:#fff}
.vc-sold{padding:8px 12px;border-top:1px solid var(--vline);font-size:12.5px;display:flex;gap:6px}
.vc-sold select,.vc-sold input{font:inherit;font-size:12.5px;padding:5px 7px;border:1px solid var(--vline);border-radius:7px;background:var(--vbg);color:var(--vink);min-width:0;flex:1}
.vempty{text-align:center;color:var(--vink3);padding:60px 20px}

.vbookwrap{display:none;justify-content:center;flex-direction:column;align-items:center;gap:18px}
body[data-view="book"] .vbookwrap{display:flex}
body[data-view="book"] .vgrid,body[data-view="book"] #empty,body[data-view="book"] .vtrack,
body[data-view="cards"] .vtrack,body[data-view="track"] .vgrid,body[data-view="track"] #empty{display:none}
body[data-view="book"] .vtools,body[data-view="book"] .vchips,body[data-view="track"] .vchips{display:none}
.vbookwrap .bk{transform-origin:top center}

.vtrack{display:none;gap:12px;flex-direction:column}
body[data-view="track"] .vtrack{display:flex}
.vt-sum{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}
.vt-team{background:var(--vsurf);border:1px solid var(--vline);border-left:4px solid var(--vacc);border-radius:10px;padding:12px}
.vt-team h3{margin:0 0 3px;font-size:15px}
.vt-team .m{font-size:12px;color:var(--vink3)}
.vt-team .r{font-size:18px;font-weight:700;margin-top:6px;font-variant-numeric:tabular-nums}
.vt-team ol{margin:8px 0 0;padding-left:18px;font-size:12.5px;color:var(--vink2);line-height:1.6}
.vt-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.vt-bar b{font-size:14px}
.vfoot{max-width:1180px;margin:0 auto;padding:18px 14px 40px;font-size:12px;color:var(--vink3)}
.vfoot span{opacity:.7}

/* Final squads sheet — rendered with the booklet's own page styling so it
   prints on the same paper as everything else. */
.vsquads{display:none;flex-direction:column;align-items:center;gap:12px}
body[data-view="squads"] .vsquads{display:flex}
.squad-bar{display:flex;gap:8px;align-self:flex-start}
body[data-view="squads"] .vgrid,body[data-view="squads"] #empty,
body[data-view="squads"] .vtrack,body[data-view="squads"] .vbookwrap,
body[data-view="squads"] .vtools,body[data-view="squads"] .vchips{display:none}
.vsquads .squad{break-inside:avoid;page-break-inside:avoid;margin-bottom:6mm}
.vsquads .squad-head{display:flex;align-items:center;gap:3mm;border-bottom:1pt solid var(--accent);padding-bottom:2mm;margin-bottom:2.5mm}
.vsquads .squad-head img{width:12mm;height:12mm;object-fit:contain;flex:none}
.vsquads .squad-head h3{margin:0;font-family:var(--serif);font-size:13pt}
.vsquads .squad-head .m{margin-left:auto;text-align:right;font-size:8pt;color:var(--ink-3);letter-spacing:.05em;text-transform:uppercase}
.vsquads .squad-head .m b{display:block;font-size:12pt;color:var(--accent);letter-spacing:0}
.vsquads table{width:100%;border-collapse:collapse;font-size:9pt}
.vsquads td{padding:1.4mm 2mm;border-bottom:.5pt solid var(--line)}
.vsquads td.n{width:8mm;color:var(--ink-3);font-variant-numeric:tabular-nums}
.vsquads td.p{text-align:right;font-variant-numeric:tabular-nums;font-weight:700;white-space:nowrap}
.vsquads .none{font-size:9pt;color:var(--ink-3);font-style:italic;padding:2mm}

@media print{
  .vbar,.vfoot,.vgrid,.vtrack,#empty{display:none!important}
  body{background:#fff}
  main{max-width:none;padding:0;margin:0}
  .vbookwrap{display:flex!important;gap:0}
  .vbookwrap .bk{transform:none!important}
  body[data-view="squads"] .vbookwrap{display:none!important}
  body[data-view="squads"] .vsquads{display:block!important}
  .squad-bar{display:none!important}
}`;

/* ───────────────────────── viewer script ───────────────────────── */

const VIEWER_JS = `
(function(){
  var $ = function(s){ return document.querySelector(s); };
  var KEY = 'auctionbook:' + DATA.id;
  var state = { q:'', cat:'', sort:'', track:{} };

  document.documentElement.style.setProperty('--vacc', DATA.accent);
  try { state.track = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch(e){}
  var save = function(){ try { localStorage.setItem(KEY, JSON.stringify(state.track)); } catch(e){} };

  // Photos are stored once and wired up by index.
  document.querySelectorAll('img[data-ph]').forEach(function(img){
    var src = PHOTOS[+img.getAttribute('data-ph')];
    if (src) img.src = src;
  });

  var esc = function(s){ return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
  var money = function(v){ return String(v || ''); };
  var num = function(v){ var n = parseFloat(String(v).replace(/[^0-9.\\-]/g,'')); return isNaN(n) ? 0 : n; };

  /* ── filters ── */
  var cats = [];
  DATA.players.forEach(function(p){ if (p.c && cats.indexOf(p.c) < 0) cats.push(p.c); });
  if (cats.length > 1) {
    $('#chips').innerHTML = ['<button class="vchip on" data-c="">All ' + DATA.players.length + '</button>']
      .concat(cats.map(function(c){
        var n = DATA.players.filter(function(p){ return p.c === c; }).length;
        return '<button class="vchip" data-c="' + esc(c) + '">' + esc(c) + ' ' + n + '</button>';
      })).join('');
    $('#chips').addEventListener('click', function(e){
      var b = e.target.closest('.vchip'); if (!b) return;
      state.cat = b.getAttribute('data-c');
      $('#chips').querySelectorAll('.vchip').forEach(function(x){ x.classList.toggle('on', x === b); });
      renderCards();
    });
  }

  function visible(){
    var q = state.q.toLowerCase();
    var list = DATA.players.filter(function(p){
      if (state.cat && p.c !== state.cat) return false;
      if (!q) return true;
      var hay = [p.n, p.c, p.t, p.s, p.nt, p.l].concat(p.g)
        .concat(p.st.map(function(s){ return s[0] + ' ' + s[1]; })).join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    if (state.sort === 'n') list = list.slice().sort(function(a,b){ return a.n.localeCompare(b.n); });
    if (state.sort === 'b') list = list.slice().sort(function(a,b){ return num(b.b) - num(a.b); });
    return list;
  }

  /* ── card list ── */
  function renderCards(){
    var list = visible();
    $('#empty').hidden = list.length > 0;
    $('#cards').innerHTML = list.map(function(p){
      var t = state.track[p.l] || {};
      var ph = p.p >= 0
        ? '<img class="vc-ph" src="' + PHOTOS[p.p] + '" alt="">'
        : '<div class="vc-ph noimg">' + esc(p.n.split(/\\s+/).slice(0,2).map(function(w){ return w[0]||''; }).join('').toUpperCase()) + '</div>';
      return '<article class="vcard ' + (t.status || '') + '" data-l="' + esc(p.l) + '">' +
        '<div class="vc-top">' + ph + '<div style="min-width:0">' +
          '<div class="vc-id">LOT ' + esc(p.l) + '</div>' +
          '<div class="vc-name">' + esc(p.n) + '</div>' +
          (p.s ? '<div class="vc-sub">' + esc(p.s) + '</div>' : '') +
          (p.g.length ? '<div class="vc-badges">' + p.g.map(function(g){ return '<span class="vc-badge">' + esc(g) + '</span>'; }).join('') + '</div>' : '') +
        '</div></div>' +
        (p.st.length ? '<dl class="vc-stats">' + p.st.slice(0,6).map(function(s){
          return '<div class="vc-stat"><dt>' + esc(s[0]) + '</dt><dd>' + esc(s[1]) + '</dd></div>'; }).join('') + '</dl>' : '') +
        (p.nt ? '<div class="vc-note">' + esc(p.nt) + '</div>' : '') +
        '<div class="vc-foot">' +
          (p.b ? '<div class="vc-base">' + esc(p.bl) + '<b>' + esc(money(p.b)) + '</b></div>' : '<span class="vc-base">Page ' + p.pg + '</span>') +
          (DATA.tracker ? '<div class="vc-act">' +
            '<button data-act="sold" class="' + (t.status === 'sold' ? 'on' : '') + '">Sold</button>' +
            '<button data-act="unsold" class="' + (t.status === 'unsold' ? 'on' : '') + '">Unsold</button>' +
          '</div>' : '') +
        '</div>' +
        (DATA.tracker && t.status === 'sold' ? '<div class="vc-sold">' +
          '<select data-f="team"><option value="">Team…</option>' + DATA.teams.map(function(tm){
            return '<option ' + (t.team === tm.name ? 'selected' : '') + '>' + esc(tm.name) + '</option>'; }).join('') + '</select>' +
          '<input data-f="price" inputmode="numeric" placeholder="Price" value="' + esc(t.price || '') + '">' +
        '</div>' : '') +
      '</article>';
    }).join('');
  }

  $('#cards').addEventListener('click', function(e){
    var btn = e.target.closest('[data-act]'); if (!btn) return;
    var lot = e.target.closest('.vcard').getAttribute('data-l');
    var cur = state.track[lot] || {};
    var act = btn.getAttribute('data-act');
    if (cur.status === act) delete state.track[lot];
    else state.track[lot] = Object.assign({}, cur, { status: act });
    save(); renderCards(); renderTrack();
  });
  $('#cards').addEventListener('change', function(e){
    var f = e.target.getAttribute && e.target.getAttribute('data-f'); if (!f) return;
    var lot = e.target.closest('.vcard').getAttribute('data-l');
    state.track[lot] = Object.assign({}, state.track[lot], (f === 'team' ? { team: e.target.value } : { price: e.target.value }));
    save(); renderTrack();
  });

  /* ── tracker summary ── */
  function renderTrack(){
    if (!DATA.tracker) return;
    var sold = Object.keys(state.track).filter(function(k){ return state.track[k].status === 'sold'; });
    var byName = {};
    DATA.players.forEach(function(p){ byName[p.l] = p.n; });
    var teams = DATA.teams.length ? DATA.teams : [{ name: 'Unassigned', purse: '' }];
    var html = '<div class="vt-bar"><b>' + sold.length + '</b> sold · <b>' +
      Object.keys(state.track).filter(function(k){ return state.track[k].status === 'unsold'; }).length + '</b> unsold · <b>' +
      (DATA.players.length - Object.keys(state.track).length) + '</b> remaining' +
      '<button class="vghost" id="squadsbtn" style="margin-left:auto">Final squads</button>' +
      '<button class="vghost" id="csv">Export CSV</button>' +
      '<button class="vghost" id="reset">Reset</button></div>';
    html += '<div class="vt-sum">' + teams.map(function(tm){
      var picks = sold.filter(function(k){ return (state.track[k].team || 'Unassigned') === tm.name; });
      var spent = picks.reduce(function(s, k){ return s + num(state.track[k].price); }, 0);
      var purse = num(tm.purse);
      return '<div class="vt-team"><h3>' + esc(tm.name) + '</h3>' +
        '<div class="m">' + picks.length + ' player' + (picks.length === 1 ? '' : 's') +
          (purse ? ' · spent ' + DATA.currency + spent.toLocaleString('en-IN') : '') + '</div>' +
        (purse ? '<div class="r">' + DATA.currency + (purse - spent).toLocaleString('en-IN') + ' left</div>' : '') +
        '<ol>' + picks.map(function(k){
          return '<li>' + esc(byName[k] || k) + (state.track[k].price ? ' — ' + DATA.currency + esc(state.track[k].price) : '') + '</li>';
        }).join('') + '</ol></div>';
    }).join('') + '</div>';
    $('#track').innerHTML = html;

    $('#squadsbtn').onclick = function(){ renderSquads(); document.body.dataset.view = 'squads'; };
    $('#reset').onclick = function(){
      if (confirm('Clear every sold/unsold mark on this device?')) { state.track = {}; save(); renderCards(); renderTrack(); }
    };
    $('#csv').onclick = function(){
      var rows = [['Lot','Player','Status','Team','Price']];
      DATA.players.forEach(function(p){
        var t = state.track[p.l]; if (!t) return;
        rows.push([p.l, p.n, t.status, t.team || '', t.price || '']);
      });
      var csv = rows.map(function(r){ return r.map(function(c){ return '"' + String(c).replace(/"/g,'""') + '"'; }).join(','); }).join('\\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'auction-results.csv'; a.click();
      setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
    };
  }

  /* ── final squads sheet ── */
  function renderSquads(){
    var byLot = {};
    DATA.players.forEach(function(p){ byLot[p.l] = p; });
    var sold = Object.keys(state.track).filter(function(k){ return state.track[k].status === 'sold'; });
    var teams = DATA.teams.length ? DATA.teams : [{ name: 'Unassigned', purse: '', p: -1 }];
    var money = function(n){ return DATA.currency + n.toLocaleString('en-IN'); };

    var blocks = teams.map(function(tm){
      var picks = sold.filter(function(k){ return (state.track[k].team || 'Unassigned') === tm.name; });
      var spent = picks.reduce(function(s, k){ return s + num(state.track[k].price); }, 0);
      var purse = num(tm.purse);
      return '<div class="squad">' +
        '<div class="squad-head">' +
          (tm.p >= 0 ? '<img src="' + PHOTOS[tm.p] + '" alt="">' : '') +
          '<h3>' + esc(tm.name) + '</h3>' +
          '<div class="m">' + picks.length + ' player' + (picks.length === 1 ? '' : 's') +
            (purse ? '<b>' + money(purse - spent) + ' left</b>' : (spent ? '<b>' + money(spent) + '</b>' : '')) +
          '</div>' +
        '</div>' +
        (picks.length
          ? '<table>' + picks.map(function(k, i){
              var p = byLot[k] || { n: k, s: '' };
              return '<tr><td class="n">' + (i + 1) + '</td><td>' + esc(p.n) +
                (p.s ? ' <span style="color:var(--ink-3)">· ' + esc(p.s) + '</span>' : '') + '</td>' +
                '<td class="p">' + (state.track[k].price ? money(num(state.track[k].price)) : '—') + '</td></tr>';
            }).join('') + '</table>'
          : '<div class="none">No players yet.</div>') +
      '</div>';
    }).join('');

    var unsold = Object.keys(state.track).filter(function(k){ return state.track[k].status === 'unsold'; });
    if (unsold.length) {
      blocks += '<div class="squad"><div class="squad-head"><h3>Unsold</h3>' +
        '<div class="m">' + unsold.length + ' player' + (unsold.length === 1 ? '' : 's') + '</div></div>' +
        '<table>' + unsold.map(function(k, i){
          var p = byLot[k] || { n: k };
          return '<tr><td class="n">' + (i + 1) + '</td><td>' + esc(p.n) + '</td><td class="p">—</td></tr>';
        }).join('') + '</table></div>';
    }

    $('#squads .bk').innerHTML = '<section class="page grow">' +
      '<h2 class="ptitle">Final Squads<small>' + esc(DATA.title) +
        (DATA.subtitle ? ' · ' + esc(DATA.subtitle) : '') + '</small></h2>' +
      blocks + '</section>';
  }

  /* ── chrome ── */
  $('#q').addEventListener('input', function(e){ state.q = e.target.value; renderCards(); });
  $('#sort').addEventListener('change', function(e){ state.sort = e.target.value; renderCards(); });
  $('#printbtn').addEventListener('click', function(){ document.body.dataset.view = 'book'; setTimeout(function(){ window.print(); }, 60); });
  $('#squads-print').addEventListener('click', function(){ window.print(); });
  $('#squads-back').addEventListener('click', function(){ document.body.dataset.view = 'track'; });
  document.querySelector('.vtabs').addEventListener('click', function(e){
    var b = e.target.closest('button[data-view]'); if (!b) return;
    document.body.dataset.view = b.getAttribute('data-view');
    document.querySelectorAll('.vtabs button').forEach(function(x){ x.classList.toggle('on', x === b); });
    fitBook();
  });

  // The booklet is a fixed paper width; scale it down to fit narrow screens.
  function fitBook(){
    var bk = document.querySelector('.vbookwrap .bk'); if (!bk) return;
    var page = bk.querySelector('.page'); if (!page) return;
    bk.style.transform = 'none';
    var w = page.getBoundingClientRect().width;
    var avail = document.querySelector('main').clientWidth;
    var k = Math.min(1, avail / (w + 2));
    bk.style.transform = 'scale(' + k + ')';
    bk.style.height = (bk.scrollHeight * k) + 'px';
  }
  window.addEventListener('resize', fitBook);

  if (window.matchMedia('(max-width: 760px)').matches === false && DATA.players.length === 0) {
    document.body.dataset.view = 'book';
  }
  renderCards(); renderTrack(); setTimeout(fitBook, 50);
})();
`;
