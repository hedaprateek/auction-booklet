// Builds a live auction board: one HTML page meant to be published as a
// Claude Artifact with the `artifact` capability.
//
// On a live-doc artifact the page's markup IS the shared document — whatever a
// writer's click or keystroke does to the DOM is saved as them and reaches
// every other view. That shapes the whole design:
//
//   * every player row is SERVED as HTML here, never rendered by script on
//     load, because script output with no gesture behind it is not the document
//   * state lives in `data-*` attributes on the row, which patch other views
//     in place instead of reloading them
//   * team choice is a row of buttons, not a <select> — select values are
//     never captured
//   * the price is an <input>, whose value IS captured
//   * anything computed (purse totals, search, filters) sits inside
//     <artifact-local> so it stays this viewer's own

import { esc, formatMoney, initials } from './format.js';
import { parseTeams } from './render.js';

const FONTS = 'https://fonts.googleapis.com/css2?family=Oswald:wght@500;600&family=Source+Sans+3:wght@400;600;700&display=swap';

export function buildLiveBoard(players, settings, opts = {}) {
  const teams = parseTeams(settings.teamsText);
  const title = settings.title || 'Player Auction';
  const cats = [...new Set(players.map(p => p.category))];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} Live Board</title>
<link rel="stylesheet" href="${FONTS}">
<style>${CSS}</style>
</head>
<body>

<header class="head">
  <div class="head-id">
    <h1>${esc(title)}</h1>
    ${settings.subtitle ? `<p>${esc(settings.subtitle)}</p>` : ''}
  </div>
  <artifact-local><div class="mode" id="mode" data-state="checking">Connecting…</div></artifact-local>
</header>

<artifact-local>
  <section class="rail" id="rail" aria-label="Team purses"></section>
  <div class="tools">
    <input id="q" type="search" placeholder="Search players, teams, stats…" autocomplete="off">
    <div class="filters" id="filters">
      <button class="chip on" data-cat="">All</button>
      ${cats.map(c => `<button class="chip" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
      <span class="sep"></span>
      <button class="chip" data-only="open">Not yet called</button>
    </div>
  </div>
</artifact-local>

<main>
<table class="ledger">
  <thead><tr>
    <th class="c-lot">Lot</th>
    <th>Player</th>
    <th class="c-base">Base</th>
    <th class="c-act">Result</th>
    <th class="c-team">Team</th>
    <th class="c-price">Price</th>
  </tr></thead>
  <tbody id="rows">
${players.map(p => row(p, teams, settings)).join('\n')}
  </tbody>
</table>
</main>

<footer class="foot">
  <span>${esc(settings.footer || '')}</span>
  <span>Stunity tech - by Prateek</span>
  <artifact-local><span class="hint" id="hint"></span></artifact-local>
</footer>

<script>
const TEAMS = ${JSON.stringify(teams.map(t => ({ name: t.name, purse: t.purse })))};
const CURRENCY = ${JSON.stringify(settings.currency || '₹')};
${SCRIPT}
</script>
</body>
</html>`;
}

function row(p, teams, s) {
  const sub = [p.category, ...p.subtitle.map(x => x.value)].filter(Boolean).join(' · ');
  const stats = p.stats.slice(0, 3).map(st => `${st.label} ${st.value}`).join(' · ');
  return `    <tr data-lot="${esc(p.lot)}" data-key="${esc(p.lot)}" data-status="" data-team=""
        data-search="${esc([p.name, p.category, sub, stats].join(' ').toLowerCase())}" data-cat="${esc(p.category)}">
      <td class="c-lot"><span class="lot">${esc(p.lot)}</span></td>
      <td class="who">
        <span class="avatar">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : esc(initials(p.name))}</span>
        <span class="who-t"><span class="nm">${esc(p.name)}</span><span class="sub">${esc(sub)}</span>
        ${stats ? `<span class="st">${esc(stats)}</span>` : ''}</span>
      </td>
      <td class="c-base">${esc(formatMoney(p.basePrice, s.currency, s.numberFormat) || '—')}</td>
      <td class="c-act">
        <button class="res sold" data-act="sold" type="button">Sold</button>
        <button class="res unsold" data-act="unsold" type="button">Unsold</button>
      </td>
      <td class="c-team"><div class="teamrow">
${teams.map(t => `        <button class="tm" data-team="${esc(t.name)}" type="button" aria-pressed="false" title="${esc(t.name)}">${esc(shortTeam(t.name))}</button>`).join('\n')}
      </div></td>
      <td class="c-price"><input class="pz" type="text" inputmode="numeric" value="" aria-label="Price for ${esc(p.name)}"></td>
    </tr>`;
}

/** "Riverside Royals" -> "RR", "Falcons" -> "FAL" */
function shortTeam(name) {
  const words = String(name).trim().split(/\s+/);
  if (words.length > 1) return words.map(w => w[0]).join('').slice(0, 3).toUpperCase();
  return words[0].slice(0, 3).toUpperCase();
}

/* ─────────────────────────── styles ─────────────────────────── */

const CSS = `
:root{
  --ground:#eef0f5; --surface:#fff; --surface-2:#f7f8fb;
  --ink:#151922; --ink-2:#535c6f; --ink-3:#8b93a5;
  --line:#dce0ea; --line-2:#c6ccdb;
  --accent:#a35d05; --accent-soft:#fdf1dd;
  --sold:#0d6b46; --sold-soft:#dff3e9;
  --unsold:#9c3322; --unsold-soft:#fbe6e1;
  --focus:#2563eb;
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --ground:#10131a; --surface:#181c25; --surface-2:#1f242f;
    --ink:#eef1f7; --ink-2:#a4adc0; --ink-3:#7b8496;
    --line:#282e3a; --line-2:#39414f;
    --accent:#f0a92e; --accent-soft:#2e2416;
    --sold:#3ecb90; --sold-soft:#12301f;
    --unsold:#f2836b; --unsold-soft:#341c19;
    --focus:#6ea0ff;
  }
}
:root[data-theme="dark"]{
  --ground:#10131a; --surface:#181c25; --surface-2:#1f242f;
  --ink:#eef1f7; --ink-2:#a4adc0; --ink-3:#7b8496;
  --line:#282e3a; --line-2:#39414f;
  --accent:#f0a92e; --accent-soft:#2e2416;
  --sold:#3ecb90; --sold-soft:#12301f;
  --unsold:#f2836b; --unsold-soft:#341c19;
  --focus:#6ea0ff;
}
*{box-sizing:border-box}
body{
  margin:0; background:var(--ground); color:var(--ink);
  font:16px/1.45 "Source Sans 3", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing:antialiased;
}
h1,.lot,.tm,.res,.rail b,th{font-family:Oswald, "Arial Narrow", Impact, sans-serif}
:focus-visible{outline:2px solid var(--focus); outline-offset:2px}

.head{
  display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;
  padding:14px 20px; background:var(--surface); border-bottom:1px solid var(--line);
  position:sticky; top:0; z-index:20;
}
.head h1{margin:0; font-size:23px; font-weight:600; letter-spacing:.02em; text-transform:uppercase}
.head p{margin:1px 0 0; font-size:13.5px; color:var(--ink-3)}
.mode{
  font-size:12px; font-weight:700; letter-spacing:.07em; text-transform:uppercase;
  padding:5px 12px; border-radius:999px; border:1px solid var(--line-2); color:var(--ink-2);
  display:flex; align-items:center; gap:7px; white-space:nowrap;
}
.mode::before{content:""; width:7px; height:7px; border-radius:50%; background:var(--ink-3)}
.mode[data-state="live"]{color:var(--sold); border-color:var(--sold); background:var(--sold-soft)}
.mode[data-state="live"]::before{background:var(--sold)}
.mode[data-state="readonly"]{color:var(--accent); border-color:var(--accent); background:var(--accent-soft)}
.mode[data-state="readonly"]::before{background:var(--accent)}
.mode[data-state="local"]{color:var(--ink-2)}

.rail{
  display:flex; gap:10px; overflow-x:auto; padding:12px 20px;
  background:var(--surface-2); border-bottom:1px solid var(--line); scrollbar-width:thin;
}
.purse{
  flex:0 0 auto; min-width:168px; background:var(--surface);
  border:1px solid var(--line); border-left:4px solid var(--accent);
  border-radius:8px; padding:9px 12px;
}
.purse .n{font-size:13px; font-weight:700; letter-spacing:.02em}
.purse .c{font-size:11.5px; color:var(--ink-3); text-transform:uppercase; letter-spacing:.06em}
.purse b{display:block; font-size:21px; font-weight:600; margin-top:3px; font-variant-numeric:tabular-nums; letter-spacing:.01em}
.purse[data-over="1"] b{color:var(--unsold)}
.purse.tally{border-left-color:var(--ink-3)}

.tools{display:flex; gap:10px; padding:12px 20px; flex-wrap:wrap; align-items:center}
#q{
  flex:1 1 240px; min-width:0; font:inherit; font-size:15px; padding:9px 13px;
  border:1px solid var(--line-2); border-radius:9px; background:var(--surface); color:var(--ink);
}
.filters{display:flex; gap:6px; flex-wrap:wrap; align-items:center}
.chip{
  font:inherit; font-size:13.5px; font-weight:600; padding:6px 13px; border-radius:999px;
  border:1px solid var(--line-2); background:var(--surface); color:var(--ink-2); cursor:pointer;
}
.chip:hover{border-color:var(--ink-3)}
.chip.on{background:var(--ink); border-color:var(--ink); color:var(--ground)}
.sep{width:1px; height:20px; background:var(--line-2); margin:0 3px}

main{padding:0 20px 40px}
.ledger{width:100%; border-collapse:collapse; background:var(--surface); border:1px solid var(--line); border-radius:10px}
.ledger th{
  text-align:left; font-size:11.5px; font-weight:500; letter-spacing:.1em; text-transform:uppercase;
  color:var(--ink-3); padding:9px 12px; border-bottom:1px solid var(--line-2); white-space:nowrap;
}
.ledger td{padding:9px 12px; border-bottom:1px solid var(--line); vertical-align:middle}
.ledger tr:last-child td{border-bottom:0}
/* data-local-* never leaves this view, so one person's search does not
   hide rows for everyone else. A plain [hidden] would. */
.ledger tr[data-local-hidden]{display:none}

.c-lot{width:52px}
.lot{
  display:inline-flex; align-items:center; justify-content:center; min-width:30px; height:26px;
  padding:0 6px; border-radius:6px; background:var(--surface-2); border:1px solid var(--line);
  font-size:15px; font-weight:600; font-variant-numeric:tabular-nums; color:var(--ink-2);
}
.who{display:flex; align-items:center; gap:11px; min-width:0}
.avatar{
  width:38px; height:38px; flex:0 0 38px; border-radius:8px; overflow:hidden;
  background:var(--accent-soft); color:var(--accent);
  display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px;
}
.avatar img{width:100%; height:100%; object-fit:cover}
.who-t{display:flex; flex-direction:column; min-width:0}
.nm{font-size:16.5px; font-weight:600; line-height:1.2}
.sub{font-size:12.5px; color:var(--ink-3)}
.st{font-size:12px; color:var(--ink-2); font-variant-numeric:tabular-nums}
.c-base{white-space:nowrap; font-variant-numeric:tabular-nums; color:var(--ink-2); font-weight:600}

.c-act{width:196px; white-space:nowrap}
.res{
  font:inherit; font-size:13px; font-weight:500; letter-spacing:.05em; text-transform:uppercase;
  padding:7px 12px; border-radius:7px; border:1px solid var(--line-2);
  background:var(--surface); color:var(--ink-2); cursor:pointer; margin-right:5px;
}
.res:hover{border-color:var(--ink-3)}
tr[data-status="sold"] .res.sold{background:var(--sold); border-color:var(--sold); color:#fff}
tr[data-status="unsold"] .res.unsold{background:var(--unsold); border-color:var(--unsold); color:#fff}
tr[data-status="sold"]{background:var(--sold-soft)}
tr[data-status="unsold"]{background:var(--unsold-soft); color:var(--ink-2)}
tr[data-status="unsold"] .avatar{opacity:.5}

.c-team{width:1%}
.teamrow{display:flex; gap:4px}
.tm{
  font:inherit; font-size:12.5px; font-weight:600; letter-spacing:.04em; min-width:38px;
  padding:6px 8px; border-radius:7px; border:1px solid var(--line-2);
  background:var(--surface); color:var(--ink-3); cursor:pointer;
}
.tm:hover{border-color:var(--ink-3); color:var(--ink-2)}
.tm[aria-pressed="true"]{background:var(--accent); border-color:var(--accent); color:#fff}
:root:not([data-theme="light"]) .tm[aria-pressed="true"]{color:#241a08}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]) .tm[aria-pressed="true"]{color:#fff}}

.c-price{width:118px}
.pz{
  width:100%; font:inherit; font-size:15px; font-weight:600; font-variant-numeric:tabular-nums;
  padding:7px 10px; border:1px solid var(--line-2); border-radius:7px;
  background:var(--surface-2); color:var(--ink); text-align:right;
}
.pz::placeholder{color:var(--ink-3); font-weight:400}

.foot{
  display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;
  padding:16px 20px 40px; font-size:12.5px; color:var(--ink-3);
}

/* When this view cannot write, the runtime marks the sync region off. */
[artifact-sync-state="off"] .res,
[artifact-sync-state="off"] .tm,
[artifact-sync-state="off"] .pz{opacity:.55; pointer-events:none}

@media (max-width:860px){
  .ledger thead{display:none}
  .ledger, .ledger tbody, .ledger tr, .ledger td{display:block; width:auto}
  .ledger{border:0; background:none}
  .ledger tr{
    background:var(--surface); border:1px solid var(--line); border-radius:10px;
    margin-bottom:10px; padding:10px 12px; display:grid;
    grid-template-columns:auto 1fr; gap:8px 12px; align-items:center;
  }
  .ledger td{border:0; padding:0}
  .c-lot{grid-row:1; grid-column:1}
  .who{grid-row:1; grid-column:2}
  .c-base{grid-row:2; grid-column:1/-1; font-size:13px}
  .c-act{grid-row:3; grid-column:1/-1; width:auto; display:flex; gap:6px}
  .res{flex:1; margin:0}
  .c-team{grid-row:4; grid-column:1/-1; width:auto}
  .teamrow{flex-wrap:wrap}
  .tm{flex:1 0 auto}
  .c-price{grid-row:5; grid-column:1/-1; width:auto}
  .head{position:static}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important; animation:none!important}}
`;

/* ─────────────────────────── page script ─────────────────────────── */

const SCRIPT = `
(function(){
  var rows = function(){ return [].slice.call(document.querySelectorAll('#rows tr')); };
  var num = function(v){ var n = parseFloat(String(v||'').replace(/[^0-9.\\-]/g,'')); return isNaN(n)?0:n; };
  var fmt = function(n){ return CURRENCY + Math.round(n).toLocaleString('en-IN'); };
  var mode = document.getElementById('mode');

  /* ---- writing ------------------------------------------------------
     On a live doc, a change made inside a real event handler is already
     the document — there is nothing to call. The capability is resolved only
     to tell the viewer which mode they are in, and so a page opened outside
     the artifact runtime still works locally.                          */
  var ns = null, checked = false;
  function setMode(state, text){ mode.dataset.state = state; mode.textContent = text; }
  (async function(){
    try { ns = (window.claude && claude.use) ? await claude.use('artifact') : null; }
    catch (e) { ns = null; }
    checked = true;
    setMode(ns ? 'live' : 'local',
      ns ? 'Live · everyone sees this' : 'Local only · not shared');
  })();

  document.addEventListener('claude:sync-off', function(){
    setMode('readonly', 'Read-only view');
    document.getElementById('hint').textContent =
      'You can follow along here, but only the auction organisers can record results.';
  });

  /* ---- gestures ----------------------------------------------------- */
  document.getElementById('rows').addEventListener('click', function(e){
    var act = e.target.closest('[data-act]');
    var tm  = e.target.closest('[data-team]');
    var tr  = e.target.closest('tr');
    if (!tr || (!act && !tm)) return;

    if (act) {
      var want = act.getAttribute('data-act');
      tr.dataset.status = tr.dataset.status === want ? '' : want;
      if (tr.dataset.status !== 'sold') { tr.dataset.team = ''; paintTeams(tr); }
    } else {
      var name = tm.getAttribute('data-team');
      tr.dataset.team = tr.dataset.team === name ? '' : name;
      if (tr.dataset.team && tr.dataset.status !== 'sold') tr.dataset.status = 'sold';
      paintTeams(tr);
    }
    refresh();
  });

  document.getElementById('rows').addEventListener('input', function(e){
    if (e.target.classList.contains('pz')) refresh();
  });

  // Chip pressed-state is derived from the row, so it is set inside the
  // gesture (saved) and re-derived when someone else's edit lands (local).
  function paintTeams(tr){
    var chosen = tr.dataset.team;
    [].forEach.call(tr.querySelectorAll('.tm'), function(b){
      b.setAttribute('aria-pressed', b.getAttribute('data-team') === chosen ? 'true' : 'false');
    });
  }

  /* ---- another writer's edit landed --------------------------------- */
  document.addEventListener('claude:edit', function(){
    rows().forEach(paintTeams);
    refresh();
  });

  /* ---- viewer-local: purses, search, filters ------------------------ */
  var q = '', cat = '', openOnly = false;

  function refresh(){
    var spent = {}, count = {};
    var sold = 0, unsold = 0;
    rows().forEach(function(tr){
      var s = tr.dataset.status;
      if (s === 'sold') {
        sold++;
        var t = tr.dataset.team || '—';
        spent[t] = (spent[t] || 0) + num(tr.querySelector('.pz').value);
        count[t] = (count[t] || 0) + 1;
      } else if (s === 'unsold') unsold++;
    });

    var rail = document.getElementById('rail');
    var html = TEAMS.map(function(t){
      var purse = num(t.purse), used = spent[t.name] || 0, left = purse - used;
      return '<div class="purse" data-over="' + (purse && left < 0 ? 1 : 0) + '">' +
        '<div class="n">' + t.name + '</div>' +
        '<div class="c">' + (count[t.name] || 0) + ' signed</div>' +
        '<b>' + (purse ? fmt(left) + '' : fmt(used)) + '</b>' +
        '<div class="c">' + (purse ? 'remaining' : 'spent') + '</div></div>';
    }).join('');
    html += '<div class="purse tally"><div class="n">Progress</div>' +
      '<div class="c">' + sold + ' sold · ' + unsold + ' unsold</div>' +
      '<b>' + (rows().length - sold - unsold) + '</b><div class="c">still to call</div></div>';
    rail.innerHTML = html;

    rows().forEach(function(tr){
      var show = true;
      if (cat && tr.dataset.cat !== cat) show = false;
      if (show && openOnly && tr.dataset.status) show = false;
      if (show && q && tr.dataset.search.indexOf(q) < 0) show = false;
      if (show) tr.removeAttribute('data-local-hidden');
      else tr.setAttribute('data-local-hidden', '');
    });
  }

  document.getElementById('q').addEventListener('input', function(e){
    q = e.target.value.trim().toLowerCase(); refresh();
  });
  document.getElementById('filters').addEventListener('click', function(e){
    var b = e.target.closest('.chip'); if (!b) return;
    if (b.hasAttribute('data-only')) { openOnly = !openOnly; b.classList.toggle('on', openOnly); }
    else {
      cat = b.getAttribute('data-cat');
      [].forEach.call(document.querySelectorAll('.chip[data-cat]'), function(x){ x.classList.toggle('on', x === b); });
    }
    refresh();
  });

  rows().forEach(paintTeams);
  refresh();
})();
`;
