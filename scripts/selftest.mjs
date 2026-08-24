// Smoke test for the rendering pipeline — runs without a browser.
//   node scripts/selftest.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { SAMPLE } from '../assets/js/sample-data.js';
import vm from 'node:vm';
import { gridToTable } from '../assets/js/parse.js';
import { balanceTeams, teamSpread, teamsAsText } from '../assets/js/teams.js';
import { buildAppsScript, buildQuestionList } from '../assets/js/formbuilder.js';
import { autoMap, byRole, prettyLabel } from '../assets/js/mapping.js';
import { normalizeImageUrl, lookupPhoto } from '../assets/js/images.js';
import { normalize, buildBook, parseTeams, qrSvg } from '../assets/js/render.js';
import { formatMoney } from '../assets/js/format.js';

let failures = 0;
const check = (label, cond, detail) => {
  if (cond) { console.log(`  ok   ${label}`); }
  else { failures++; console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
};

const rows = SAMPLE.rows.map(r => Object.fromEntries(
  Object.entries(r).map(([k, v]) => [k, v == null ? '' : String(v)])));
const headers = Object.keys(SAMPLE.rows[0]);

console.log('\nColumn mapping');
const fields = autoMap(headers, rows, 'cricket');
const roles = byRole(fields);
check('finds the name column', roles.name === 'Player Name', roles.name);
check('finds the lot column', roles.id === 'S.No', roles.id);
check('finds the category column', roles.category === 'Category', roles.category);
check('finds the base price column', roles.basePrice === 'Base Price', roles.basePrice);
check('hides the Mobile column', fields.find(f => f.key === 'Mobile').role === 'ignore');
check('treats Runs as a stat', roles.stat?.includes('Runs'), JSON.stringify(roles.stat));
check('treats Remarks as a note', roles.note?.includes('Remarks'));

console.log('\nMoney formatting');
check('50000 -> ₹50,000', formatMoney(50000, '₹', 'indian') === '₹50,000', formatMoney(50000, '₹', 'indian'));
check('500000 -> ₹5 L', formatMoney(500000, '₹', 'indian') === '₹5 L', formatMoney(500000, '₹', 'indian'));
check('25000000 -> ₹2.5 Cr', formatMoney(25000000, '₹', 'indian') === '₹2.5 Cr', formatMoney(25000000, '₹', 'indian'));
check('grouped is Indian style', formatMoney(1234567, '₹', 'grouped') === '₹12,34,567', formatMoney(1234567, '₹', 'grouped'));
check('non-numeric passes through', formatMoney('Negotiable', '₹', 'indian') === 'Negotiable');

console.log('\nBooklet build');
const settings = {
  ...SAMPLE.settings,
  logo: '', theme: 'classic', pageSize: 'a4', perPage: 4,
  groupBy: 'Category', sortBy: '', sortDesc: false,
  showCover: true, showIndex: true, writeIn: true, showPhotos: true, sequentialLots: false,
  sectionBreak: true, qrLink: '',
};
const players = normalize(rows, fields, settings);
const book = buildBook(players, settings);

check('every player is normalized', players.length === 24, players.length);
check('names survive', players[0].name === 'Arjun Menon', players[0].name);
check('teams parse', parseTeams(settings.teamsText).length === 4);
check('page count is sane', book.pageCount >= 8 && book.pageCount <= 20, book.pageCount);
check('every player got a page number', players.every(p => p.page >= 1));

const pages = (book.html.match(/class="page /g) || []).length;
check('rendered page sections match the count', pages === book.pageCount, `${pages} vs ${book.pageCount}`);
check('no undefined leaked into the html', !book.html.includes('undefined'));
check('no [object Object] leaked', !book.html.includes('[object Object]'));
check('index links to real pages', /<td class="c-pg">\d+<\/td>/.test(book.html));
check('cover shows the title', book.html.includes('Riverside Premier League'));
check('rules page rendered', book.html.includes('Rules &amp; Information'));
check('section bands rendered', book.html.includes('class="sband"'));
check('write-in line rendered', book.html.includes('class="writein"'));
check('base price formatted on cards', book.html.includes('₹50,000'));
check('personal column never appears', !book.html.includes('Mobile'));

console.log('\nLayout variants');
for (const perPage of [1, 2, 4, 6, 8, 9]) {
  const b = buildBook(normalize(rows, fields, { ...settings, perPage }), { ...settings, perPage });
  check(`${perPage} per page builds`, b.pageCount > 0 && !b.html.includes('undefined'));
}
const noGroup = buildBook(normalize(rows, fields, { ...settings, groupBy: '' }), { ...settings, groupBy: '' });
check('ungrouped build has no section band', !noGroup.html.includes('class="sband"'));

const sorted = normalize(rows, fields, { ...settings, sortBy: 'Runs', sortDesc: true });
check('descending sort puts the top scorer first', sorted[0].name === 'Rohit Sabharwal', sorted[0].name);

console.log('\nContinuous flow');
const flowSettings = { ...settings, sectionBreak: false };
const flowBook = buildBook(normalize(rows, fields, flowSettings), flowSettings);
check('uses fewer pages than sectioned mode', flowBook.pageCount < book.pageCount,
  `${flowBook.pageCount} vs ${book.pageCount}`);
check('still renders every card', (flowBook.html.match(/class="card"/g) || []).length === 24);
check('keeps every section band', (flowBook.html.match(/class="sband"/g) || []).length === 5);
check('emits explicit row tracks', /grid-template-rows:[\d.]+mm/.test(flowBook.html));
check('no undefined leaked', !flowBook.html.includes('undefined'));

const flowPlayers = normalize(rows, fields, flowSettings);
buildBook(flowPlayers, flowSettings);
check('every player still gets a page number', flowPlayers.every(p => p.page >= 1));
const maxPage = Math.max(...flowPlayers.map(p => p.page));
check('index never points past the last page', maxPage <= flowBook.pageCount, `${maxPage} vs ${flowBook.pageCount}`);

for (const perPage of [1, 2, 4, 6, 8, 9]) {
  const st = { ...flowSettings, perPage };
  const b = buildBook(normalize(rows, fields, st), st);
  const tracks = [...b.html.matchAll(/grid-template-rows:([^"]+)"/g)]
    .map(m => m[1].trim().split(/\s+/).length);
  check(`${perPage}/page flows without an empty page`, b.pageCount > 0 && tracks.every(t => t > 0));
}

console.log('\nQR code');
const svg = qrSvg('https://example.com/booklet.html');
check('produces an svg', svg.startsWith('<svg') && svg.includes('</svg>'));
check('draws modules', (svg.match(/M\d+ \d+h1v1h-1z/g) || []).length > 40);
const qrBook = buildBook(normalize(rows, fields, settings), { ...settings, qrLink: 'https://example.com/b.html' });
check('cover carries the qr', qrBook.html.includes('cover-qr') && qrBook.html.includes('<svg class="qr"'));
check('no qr when no link', !book.html.includes('cover-qr'));

console.log('\nTeam logos');
const logoBook = buildBook(normalize(rows, fields, settings), settings,
  { teamLogos: new Map([['harbour hawks', 'data:image/png;base64,AAAA']]) });
check('logo reaches the teams page', logoBook.html.includes('class="team-logo"'));
check('only the matched team gets one', (logoBook.html.match(/team-logo/g) || []).length === 1);

console.log('\nGoogle Forms response sheets');
{
  const fh = [
    'Timestamp', 'Email Address',
    'Full name (as it should appear in the booklet)',
    'Which category are you registering for?',
    'Your age', 'City / locality', 'Batting style',
    'Matches played (approx.)', 'Total runs (approx.)',
    'Upload a recent photo', 'Anything team owners should know about you?',
    'Mobile number', 'T-shirt size', 'How did you hear about us?',
  ];
  const frows = [Object.fromEntries(fh.map(h => [h,
    h === 'Upload a recent photo' ? 'https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWx'
      : /age|Matches|runs/i.test(h) ? '24' : 'x']))];
  const ff = autoMap(fh, frows, 'cricket');
  const roleFor = k => ff.find(f => f.key === k).role;
  const labelFor = k => ff.find(f => f.key === k).label;

  check('hides the form Timestamp', roleFor('Timestamp') === 'ignore', roleFor('Timestamp'));
  check('hides the collected email', roleFor('Email Address') === 'ignore');
  check('hides the phone number', roleFor('Mobile number') === 'ignore');
  check('hides T-shirt size', roleFor('T-shirt size') === 'ignore', roleFor('T-shirt size'));
  check('hides "how did you hear about us"', roleFor('How did you hear about us?') === 'ignore');
  check('finds the name behind the question',
    roleFor('Full name (as it should appear in the booklet)') === 'name');
  check('finds the category', roleFor('Which category are you registering for?') === 'category');
  check('finds the photo upload', roleFor('Upload a recent photo') === 'photo');
  check('keeps the free-text answer as a note',
    roleFor('Anything team owners should know about you?') === 'note');
  check('trims a question into a stat label',
    labelFor('Matches played (approx.)') === 'Matches played', labelFor('Matches played (approx.)'));
  check('drops a leading "Your"', labelFor('Your age') === 'Age', labelFor('Your age'));
  check('keeps a plain header intact',
    prettyLabel('Strike Rate') === 'Strike Rate' && prettyLabel('RUNS_SCORED') === 'Runs Scored');
}

console.log('\nDrive photo links');
check('rewrites an open?id= link',
  normalizeImageUrl('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWx')
    === 'https://lh3.googleusercontent.com/d/1AbCdEfGhIjKlMnOpQrStUvWx=w800');
check('rewrites a /file/d/ link',
  normalizeImageUrl('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWx/view?usp=sharing')
    === 'https://lh3.googleusercontent.com/d/1AbCdEfGhIjKlMnOpQrStUvWx=w800');
check('leaves an ordinary image url alone',
  normalizeImageUrl('https://example.com/players/ravi.jpg') === 'https://example.com/players/ravi.jpg');

console.log('\nPhoto file matching');
{
  const idx = new Map([
    ['ravi kumar img 2231', 'A'],
    ['sana iqbal photo', 'B'],
    ['12', 'C'],
    ['arjun menon', 'D'],
  ]);
  const find = (name, id) => lookupPhoto(idx, { photoValue: '', id, name });
  check('exact name still wins', find('Arjun Menon', '') === 'D');
  check('matches a Forms upload prefix', find('Ravi Kumar', '') === 'A', find('Ravi Kumar', ''));
  check('matches "<name> photo.jpg"', find('Sana Iqbal', '') === 'B');
  check('matches on lot number', find('Someone Else', '12') === 'C');
  check('no match rather than a wrong face', find('Unknown Player', '') === null);
  const ambiguous = new Map([['ravi kumar a', 'X'], ['ravi kumar b', 'Y']]);
  check('refuses an ambiguous prefix',
    lookupPhoto(ambiguous, { photoValue: '', id: '', name: 'Ravi Kumar' }) === null);
}

console.log('\nExample input files');
{
  const require = createRequire(import.meta.url);
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const XLSX = require(path.join(root, 'assets/vendor/xlsx.full.min.js'));
  const dir = path.join(root, 'sample', 'formats');

  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.csv'))) {
    const grid = XLSX.utils.sheet_to_json(
      XLSX.read(fs.readFileSync(dir + '/' + file, 'utf8'), { type: 'string' }).Sheets.Sheet1,
      { header: 1, blankrows: false, defval: '', raw: false });
    const { headers, rows } = gridToTable(grid, 1);
    const f = autoMap(headers, rows, 'generic');
    const m = byRole(f);
    const st = {
      ...SAMPLE.settings, logo: '', theme: 'classic', pageSize: 'a4', perPage: 4,
      groupBy: m.category || '', sortBy: '', sortDesc: false, showCover: true, showIndex: true,
      writeIn: true, showPhotos: true, sequentialLots: false, sectionBreak: true, qrLink: '',
    };
    const players = normalize(rows, f, st);
    const b = buildBook(players, st);
    const ok = !!m.name && players.length === rows.length && b.pageCount > 0
      && !b.html.includes('undefined') && players.every(p => p.name && p.name !== 'Player 1');
    check(`${file} loads and builds`, ok,
      `name=${m.name} players=${players.length}/${rows.length} pages=${b.pageCount}`);
  }

  // The Forms sheet is the one with traps in it — check them by name.
  const g = XLSX.utils.sheet_to_json(
    XLSX.read(fs.readFileSync(dir + '/google-form-responses.csv', 'utf8'), { type: 'string' }).Sheets.Sheet1,
    { header: 1, blankrows: false, defval: '', raw: false });
  const gt = gridToTable(g, 1);
  const gf = autoMap(gt.headers, gt.rows, 'cricket');
  const gp = normalize(gt.rows, gf, { ...SAMPLE.settings, groupBy: '', sortBy: '', perPage: 4 });
  const gh = buildBook(gp, { ...SAMPLE.settings, logo: '', theme: 'classic', pageSize: 'a4',
    perPage: 4, groupBy: '', sortBy: '', sortDesc: false, showCover: true, showIndex: true,
    writeIn: true, showPhotos: true, sequentialLots: false, sectionBreak: true, qrLink: '' }).html;
  check('form sheet: names survive', gp[0].name === 'Arjun Menon', gp[0].name);
  check('form sheet: Drive links become renderable',
    gp[0].photo?.startsWith('https://lh3.googleusercontent.com/d/'), gp[0].photo);
  check('form sheet: no phone number reaches the page', !gh.includes('98xxxxxx'));
  check('form sheet: no email reaches the page', !gh.includes('@example.com'));
  check('form sheet: no timestamp reaches the page', !gh.includes('19:04:11'));
  check('form sheet: T-shirt size stays out', !/T.?shirt/i.test(gh));
}

console.log('\nBalanced team draft');
{
  const mk = (n, cats) => Array.from({ length: n }, (_, i) =>
    ({ name: `P${i + 1}`, rating: 1 + (i * 7) % 10, cat: cats[i % cats.length] }));
  const ratingOf = p => p.rating, groupOf = p => p.cat;

  for (const [n, tc, cats] of [[24, 4, ['Bat', 'Bowl', 'AR', 'WK']], [23, 4, ['Bat', 'Bowl']],
    [30, 6, ['A', 'B', 'C']], [7, 3, ['X']], [100, 8, ['A', 'B', 'C', 'D']]]) {
    const pool = mk(n, cats);
    const teams = balanceTeams(pool, { teamCount: tc, ratingOf, groupOf, byCategory: true, seed: 7 });
    const names = teams.flatMap(t => t.players.map(p => p.name));
    const sizes = teams.map(t => t.players.length);
    const catCounts = cats.map(c => teams.map(t => t.players.filter(p => p.cat === c).length));
    const { averageGap } = teamSpread(teams);
    check(`${n} players into ${tc} teams: everyone placed once`,
      names.length === n && new Set(names).size === n);
    check(`${n}/${tc}: squad sizes within one`, Math.max(...sizes) - Math.min(...sizes) <= 1, sizes.join(','));
    check(`${n}/${tc}: categories spread within one`,
      catCounts.every(c => Math.max(...c) - Math.min(...c) <= 1), JSON.stringify(catCounts));
    check(`${n}/${tc}: average ratings within 1.5`, averageGap <= 1.5, String(averageGap));
  }

  const pool = mk(24, ['A', 'B']);
  const draw = s => balanceTeams(pool, { teamCount: 4, ratingOf, groupOf, seed: s })
    .map(t => t.players.map(p => p.name).join(',')).join('|');
  check('same seed reproduces the same draw', draw(3) === draw(3));
  check('a new seed redraws', draw(3) !== draw(9));

  const flat = balanceTeams(mk(12, ['A']), { teamCount: 3, ratingOf: () => 5, groupOf, seed: 1 });
  check('equal ratings still split evenly', teamSpread(flat).totalGap === 0);
  check('handles more teams than players',
    balanceTeams(mk(3, ['A']), { teamCount: 8, ratingOf, groupOf }).length <= 3 + 5);

  const txt = teamsAsText(balanceTeams(mk(4, ['A']), { teamCount: 2, ratingOf, groupOf, seed: 1 }),
    { title: 'Sunday Friendly', ratingOf });
  check('WhatsApp text lists every player', (txt.match(/^\d+\. P\d/gm) || []).length === 4, txt.slice(0, 40));
}

console.log('\nGoogle Form generator');
{
  // Run the generated script against a mock FormApp. This proves the file
  // executes and asks for the right questions — string matching cannot.
  const run = cfg => {
    const src = buildAppsScript(cfg);
    const log = [];
    const chain = () => new Proxy({}, {
      get: (_, k) => (...a) => { log.push([String(k), ...a]); return k === 'build' ? {} : chain(); },
    });
    const form = new Proxy({}, {
      get: (_, k) => (...a) => {
        log.push([String(k), ...a]);
        if (String(k).startsWith('get')) return `https://forms.example/${String(k)}`;
        return String(k).startsWith('add') ? chain() : form;
      },
    });
    const ctx = {
      FormApp: { create: (...a) => { log.push(['create', ...a]); return form; },
        createTextValidation: () => chain() },
      Logger: { log: m => log.push(['LOG', m]) },
    };
    vm.createContext(ctx);
    new vm.Script(src + '\ncreateAuctionForm();').runInContext(ctx);
    return { log, titles: log.filter(r => r[0] === 'setTitle').map(r => r[1]) };
  };

  const { log, titles } = run({
    title: 'Riverside "Premier" League', categories: ['Batter', 'Bowler'],
    priceBands: ['10000', '25000'], stats: ['Runs scored', 'Wickets taken'],
    subtitles: ['Age'], currency: '₹',
  });
  check('the generated script runs', log.length > 0);
  check('creates a form with the exact title',
    log.find(r => r[0] === 'create')?.[1] === 'Riverside "Premier" League');
  check('asks for the name first', titles[0].startsWith('Full name'));
  check('asks every configured stat',
    titles.includes('Runs scored') && titles.includes('Wickets taken'));
  check('offers the categories as choices',
    log.some(r => r[0] === 'setChoiceValues' && r[1].join() === 'Batter,Bowler'));
  check('prefixes price bands with the currency',
    log.some(r => r[0] === 'setChoiceValues' && r[1].join() === '₹10000,₹25000'));
  check('logs the links at the end', log.filter(r => r[0] === 'LOG').length === 2);
  check('defaults also run', run({}).titles.length > 5);

  const list = buildQuestionList({ categories: ['A'], stats: ['S'], subtitles: [], priceBands: [] });
  check('question list is numbered', /^1\. Full name/m.test(list));
  check('question list carries the footer', list.includes('Stunity tech - by Prateek'));
}

console.log('\nOffline cache');
{
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const listed = new Set([...sw.matchAll(/^\s*'([^']+)',/gm)].map(m => m[1]));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  // Everything index.html pulls in must be cached.
  const refs = [...html.matchAll(/(?:href|src)="((?!https?:|data:)[^"#]+)"/g)]
    .map(m => m[1]).filter(u => !u.endsWith('.xlsx'));
  for (const r of refs) check(`index.html asset cached: ${r}`, listed.has(r));

  // So must every module, or it breaks the moment the network goes.
  for (const f of fs.readdirSync(path.join(root, 'assets/js'))) {
    check(`module cached: ${f}`, listed.has(`assets/js/${f}`));
  }
  for (const f of fs.readdirSync(path.join(root, 'assets/css'))) {
    check(`stylesheet cached: ${f}`, listed.has(`assets/css/${f}`));
  }
  // And nothing listed may be missing from disk.
  for (const u of listed) {
    if (u === './') continue;
    check(`cached file exists: ${u}`, fs.existsSync(path.join(root, u)));
  }
  check('cache name is versioned', /const CACHE = 'auctionbook-v\d+'/.test(sw));
}

console.log(failures ? `\n${failures} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failures ? 1 : 0);
