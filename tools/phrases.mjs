/* What needs a recording. Derived from the app itself rather than a copy of the
 * word lists, so it cannot drift: it drives index.html and asks it for every
 * built-in word and every syllable piece those words split into.
 *
 *   node tools/phrases.mjs        -> writes tools/phrases.json
 */
import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const {findChromium} = createRequire(import.meta.url)('../playwright.config.js');

// Spoken by the app itself. Anything containing her name is deliberately absent:
// her name must never enter this repo, and those lines fall back to the phone.
const UI = ['Every word counts.'];

const browser = await chromium.launch({executablePath: findChromium()});
const page = await browser.newPage();
await page.goto('file://' + resolve(here, '..', 'index.html'));
await page.waitForFunction(() => !!window.__acorn);

const {words, pieces} = await page.evaluate(() => {
  const a = window.__acorn, words = new Set(), pieces = new Set();
  a.allLists().forEach(l => {
    const list = a.state.words.lists.concat(a.allLists()).find(x => x.id === l.id) || l;
    a.wordsOf(l).forEach(w => {
      words.add(w);
      // The hand-checked split where a list carries one, the algorithm otherwise
      // — exactly what her screen will show.
      const hand = list.words && !Array.isArray(list.words) ? list.words[w] : null;
      const parts = hand ? String(hand).split('·') : a.syllables(w);
      if (parts.length > 1) parts.forEach(p => pieces.add(p));
    });
  });
  return {words: [...words], pieces: [...pieces]};
});
await browser.close();

const all = [...new Set([...words, ...pieces, ...UI].map(t => t.trim().toLowerCase()))]
  .filter(Boolean).sort();

// The app derives a filename from the text with the same rule; a collision would
// silently give two phrases one recording.
const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const seen = new Map();
for (const t of all) {
  const s = slug(t);
  if (seen.has(s)) throw new Error(`slug collision: "${t}" and "${seen.get(s)}" both -> ${s}`);
  seen.set(s, t);
}

writeFileSync(resolve(here, 'phrases.json'),
  JSON.stringify({words: words.length, pieces: pieces.length, ui: UI.length, all}, null, 1) + '\n');
console.log(`${all.length} phrases (${words.length} words, ${pieces.length} pieces, ${UI.length} spoken by the app)`);
console.log('written to tools/phrases.json');
