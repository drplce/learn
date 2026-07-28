/* Adding words, and getting their splits right.
 *
 * The split is looked up in a hyphenation dictionary first (TeX en-GB patterns,
 * the same data typesetters use, derived from printed dictionaries). The app's
 * own rules are the fallback for words the dictionary declines. Where the two
 * disagree the word is flagged, because that is where mistakes live.
 *
 * A hyphenation point is not a syllable boundary, and the difference runs one
 * way: the dictionary is systematically coarser. Audited against the hundred
 * hand-checked splits already in the app, it disagreed on eight — together,
 * separate, direction, decision, television, sorted, recognise, jewellery —
 * and in every one of the eight the hand split was the correct syllabification
 * and the dictionary had simply declined a break. So treat it as the better
 * starting proposal, not as the answer: run `check` after adding anything.
 *
 *   node tools/words.mjs check                       # audit every built-in split
 *   node tools/words.mjs add before morning almost   # propose splits for new words
 *   node tools/words.mjs add --file week6.txt --name "Week 6" --write
 *
 * --write inserts a new built-in list into index.html. Without it, nothing is
 * changed and the proposal is printed for you to look over.
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require$ = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const INDEX = resolve(here, '..', 'index.html');

// The dictionary is the point of this tool, so its absence is fatal — but it is
// two small packages and neither downloads a browser.
let hyphen;
try {
  const Hypher = require$('hypher');
  hyphen = new Hypher(require$('hyphenation.en-gb'));
} catch {
  console.error('This needs the hyphenation dictionary:\n');
  console.error('  npm install hypher hyphenation.en-gb\n');
  console.error('Two small packages, no browser download.');
  process.exit(2);
}

// The app's own rules, for comparison only. Reading them means running the app,
// which means a browser; without one the comparison is simply skipped.
let chromium = null, findChromium = null;
try {
  ({chromium} = await import('@playwright/test'));
  ({findChromium} = require$('../playwright.config.js'));
} catch { /* the dictionary alone is enough to be useful */ }

// The list block in index.html is a plain data literal, so it can be read
// without running the app.
function readLists() {
  const html = readFileSync(INDEX, 'utf8');
  const start = html.indexOf('var LISTS = [');
  const end = html.indexOf('\n];', start);
  if (start < 0 || end < 0) { console.error('could not find the word lists'); process.exit(1); }
  const lists = new Function('return ' + html.slice(start + 'var LISTS = '.length, end + 2))();
  return lists.map(l => {
    const hand = l.words && !Array.isArray(l.words) ? l.words : {};
    const lower = {};
    for (const w in hand) lower[w] = String(hand[w]).toLowerCase();
    return {id: l.id, name: l.name, hand: lower};
  });
}

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = n => { const i = argv.indexOf('--' + n); return i < 0 ? null : argv[i + 1]; };

// The dictionary, then the app's rules. Neither is trusted blindly.
function lookup(word, algorithmic) {
  const dict = hyphen.hyphenate(word);
  if (dict.length > 1) return {parts: dict, from: 'dictionary'};
  return {parts: algorithmic, from: 'rules'};
}

async function withApp(fn) {
  if (!chromium) return null;
  const browser = await chromium.launch({executablePath: findChromium()});
  const page = await browser.newPage();
  await page.goto('file://' + INDEX);
  await page.waitForFunction(() => !!window.__acorn);
  try { return await fn(page); } finally { await browser.close(); }
}

if (cmd === 'check') {
  // Every hand split in the app, against the dictionary and against the rules.
  // Read the hand splits from the source; ask the app for its rules only if a
  // browser happens to be installed.
  const rows = readLists().flatMap(l => Object.keys(l.hand).map(w =>
    ({list: l.id, word: w, hand: l.hand[w], rules: null})));
  const rules = await withApp(page => page.evaluate(ws =>
    ws.map(w => window.__acorn.syllables(w).join('·')), rows.map(r => r.word)));
  if (rules) rows.forEach((r, i) => { r.rules = rules[i]; });
  else console.log('(no browser installed, so the app\'s own rules are not compared)\n');

  const disagree = [], missing = [];
  for (const r of rows) {
    const dict = hyphen.hyphenate(r.word);
    r.dict = dict.length > 1 ? dict.join('·') : null;
    if (!r.hand) { missing.push(r); continue; }
    if (r.dict && r.dict !== r.hand) disagree.push(r);
  }
  console.log(`${rows.length} words in ${new Set(rows.map(r => r.list)).size} built-in lists\n`);
  if (missing.length) {
    console.log(`${missing.length} with no hand split (the rules are deciding):`);
    missing.forEach(r => console.log(`  ${r.list}/${r.word}  rules ${r.rules}` +
                                     (r.dict ? `  dictionary ${r.dict}` : '')));
    console.log('');
  }
  console.log(`${disagree.length} where the dictionary disagrees with the hand split:`);
  disagree.forEach(r => console.log(`  ${r.word.padEnd(14)} hand ${r.hand.padEnd(16)} dictionary ${r.dict}`));
  if (!disagree.length) console.log('  none');
  process.exit(0);
}

if (cmd === 'add') {
  const file = flag('file');
  const words = (file ? readFileSync(resolve(process.cwd(), file), 'utf8').split(/[\s,]+/)
                      : argv.slice(1).filter(w => !w.startsWith('--') &&
                                                  argv[argv.indexOf(w) - 1] !== '--name' &&
                                                  argv[argv.indexOf(w) - 1] !== '--file'))
    .map(w => w.trim().toLowerCase().replace(/[^a-z'-]/g, '')).filter(w => w.length > 1);
  const unique = [...new Set(words)];
  if (!unique.length) { console.error('no words given'); process.exit(2); }

  const rules = await withApp(page =>
    page.evaluate(ws => ws.map(w => window.__acorn.syllables(w).join('·')), unique));
  if (!rules) console.log('(no browser installed, so the app\'s own rules are not compared)\n');

  const rows = unique.map((w, i) => {
    const fallback = rules ? rules[i].split('·') : [w];
    const r = lookup(w, fallback);
    return {word: w, parts: r.parts.join('·'), from: r.from,
            rules: rules ? rules[i] : null,
            agree: (rules && r.from === 'dictionary') ? r.parts.join('·') === rules[i] : null};
  });
  const undecided = rows.filter(r => r.from === 'rules' && !rules);
  if (undecided.length) {
    console.log(`${undecided.length} word(s) the dictionary declined. With no browser there is`);
    console.log('nothing to fall back to, so split these by hand before --write:');
    undecided.forEach(r => console.log('  ' + r.word));
    console.log('');
  }

  const check = rows.filter(r => r.agree === false);
  console.log(`${rows.length} words\n`);
  rows.forEach(r => console.log(
    `  ${r.word.padEnd(14)} ${r.parts.padEnd(18)} ${r.from}` +
    (r.agree === false ? `   (the rules would say ${r.rules} — worth a look)` : '')));
  if (check.length) {
    console.log(`\n${check.length} where the dictionary and the rules disagree — check these by eye.`);
    console.log('The dictionary declines breaks that syllabification makes, so where it is');
    console.log('coarser than the rules the rules are often right.');
  }

  const name = flag('name') || 'New words';
  const id = (flag('id') || name).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12) || 'newlist';
  const block = `  {id:'${id}', name:'${name.replace(/'/g, "\\'")}', words:{\n` +
    rows.map(r => `    ${r.word}:'${r.parts}'`).join(', ').replace(/(.{86}), /g, '$1,\n    ') +
    `}},\n`;

  if (!argv.includes('--write')) {
    console.log('\nNothing changed. The list would be:\n');
    console.log(block);
    console.log('Add --write to insert it into index.html.');
    process.exit(0);
  }

  const html = readFileSync(INDEX, 'utf8');
  const anchor = "  {id:'aussie',";
  if (!html.includes(anchor)) { console.error('could not find where the lists end'); process.exit(1); }
  writeFileSync(INDEX, html.replace(anchor, block + anchor));
  console.log(`\ninserted "${name}" into index.html as '${id}'.`);
  console.log('Next: node tools/phrases.mjs   then   ACORN_TTS=say ACORN_VOICE=Matilda node tools/voice.mjs');
  process.exit(0);
}

console.error('usage: node tools/words.mjs check | add <words...> [--name "..."] [--write]');
process.exit(2);
