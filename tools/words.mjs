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
import {chromium} from '@playwright/test';

const require$ = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const INDEX = resolve(here, '..', 'index.html');
const {findChromium} = require$('../playwright.config.js');
const Hypher = require$('hypher');
const hyphen = new Hypher(require$('hyphenation.en-gb'));

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
  const browser = await chromium.launch({executablePath: findChromium()});
  const page = await browser.newPage();
  await page.goto('file://' + INDEX);
  await page.waitForFunction(() => !!window.__acorn);
  try { return await fn(page); } finally { await browser.close(); }
}

if (cmd === 'check') {
  // Every hand split in the app, against the dictionary and against the rules.
  const rows = await withApp(page => page.evaluate(() => {
    const a = window.__acorn, out = [];
    a.allLists().forEach(l => {
      const hand = l.words && !Array.isArray(l.words) ? l.words : null;
      a.wordsOf(l).forEach(w => out.push({
        list: l.id, word: w,
        hand: hand && hand[w] ? String(hand[w]).toLowerCase() : null,
        rules: a.syllables(w).join('·'),
      }));
    });
    return out;
  }));

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

  const rows = unique.map((w, i) => {
    const r = lookup(w, rules[i].split('·'));
    return {word: w, parts: r.parts.join('·'), from: r.from, rules: rules[i],
            agree: r.from === 'dictionary' ? r.parts.join('·') === rules[i] : null};
  });

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
