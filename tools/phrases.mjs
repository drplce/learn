/* What needs a recording: every built-in word and every syllable piece those
 * words split into, read straight out of index.html.
 *
 *   node tools/phrases.mjs        -> writes tools/phrases.json
 *
 * No dependencies. It used to drive the app in a browser to ask it for the
 * splits, which meant installing Playwright to get a word list; every built-in
 * word carries a hand-checked split in the source, so the source is enough.
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const INDEX = resolve(here, '..', 'index.html');

// Spoken by the app itself. Anything containing her name is deliberately absent:
// her name must never enter this repo, and those lines fall back to the phone.
const UI = ['Every word counts.'];

const html = readFileSync(INDEX, 'utf8');

// The list block is a plain data literal — objects of word: 'split' — so it can
// be lifted out and evaluated on its own. Anything else in there is a bug.
const start = html.indexOf('var LISTS = [');
if (start < 0) { console.error('could not find the word lists in index.html'); process.exit(1); }
const end = html.indexOf('\n];', start);
if (end < 0) { console.error('could not find the end of the word lists'); process.exit(1); }
const literal = html.slice(start + 'var LISTS = '.length, end + 2);
if (/[(){}]\s*=>|function\s*\(|`/.test(literal)) {
  console.error('the list block is no longer plain data — it needs reading another way');
  process.exit(1);
}

let LISTS;
try { LISTS = new Function('return ' + literal)(); }
catch (e) { console.error('could not read the word lists: ' + e.message); process.exit(1); }

const words = [], pieces = new Set(), noSplit = [];
for (const list of LISTS) {
  const hand = list.words && !Array.isArray(list.words) ? list.words : null;
  const keys = hand ? Object.keys(hand) : (list.words || []);
  for (const w of keys) {
    words.push(w);
    const split = hand && hand[w] ? String(hand[w]).toLowerCase() : null;
    if (!split) { noSplit.push(w); continue; }
    const parts = split.split('·');
    if (parts.join('') !== w)
      console.warn(`  warning: ${w} splits to ${split}, which is not the same word`);
    if (parts.length > 1) parts.forEach(p => pieces.add(p));
  }
}
if (noSplit.length) {
  console.warn(`\n${noSplit.length} word(s) with no hand split, so no syllable pieces for them:`);
  noSplit.forEach(w => console.warn('  ' + w));
  console.warn('Add splits with: node tools/words.mjs add ' + noSplit.join(' ') + '\n');
}

const all = [...new Set([...words, ...pieces, ...UI].map(t => t.trim().toLowerCase()))]
  .filter(Boolean).sort();

// The app builds a filename from the text with the same rule; a collision would
// silently give two phrases one recording.
const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const seen = new Map();
for (const t of all) {
  const s = slug(t);
  if (seen.has(s)) { console.error(`slug collision: "${t}" and "${seen.get(s)}" both -> ${s}`); process.exit(1); }
  seen.set(s, t);
}

writeFileSync(resolve(here, 'phrases.json'),
  JSON.stringify({words: words.length, pieces: pieces.size, ui: UI.length, all}, null, 1) + '\n');
console.log(`${all.length} phrases (${words.length} words, ${pieces.size} pieces, ${UI.length} spoken by the app)`);
console.log('written to tools/phrases.json');
