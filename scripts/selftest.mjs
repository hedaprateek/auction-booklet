// Smoke test for the rendering pipeline — runs without a browser.
//   node scripts/selftest.mjs
import { SAMPLE } from '../assets/js/sample-data.js';
import { autoMap, byRole } from '../assets/js/mapping.js';
import { normalize, buildBook, parseTeams } from '../assets/js/render.js';
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

console.log(failures ? `\n${failures} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failures ? 1 : 0);
