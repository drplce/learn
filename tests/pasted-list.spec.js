// What the clipboard really delivers.
//
// A grown-up pastes this week's list out of a school email, a PDF or a Word document.
// Driven as a real paste event rather than fill(), which is how the zero-width space
// turned up: \s does not match it, so "said​they​went" came through the split as
// one token, had the invisible characters stripped out as non-letters, and saved a single
// twelve-letter non-word with a confident "1 word saved." She would have been asked to
// spell "saidtheywent" every evening and could never have got it right.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

// Fires a real paste, then reads back the list the app saved.
async function pasteList(page, text){
  await page.evaluate(() => {
    const a = window.__acorn;
    a.state.words.lists = [];
    a.save(); a.go('parent');
  });
  await page.locator('#paste').click();
  await page.evaluate(t => {
    const el = document.querySelector('#paste');
    const dt = new DataTransfer();
    dt.setData('text/plain', t);
    el.dispatchEvent(new ClipboardEvent('paste',
      {clipboardData: dt, bubbles: true, cancelable: true}));
    // Headless has no clipboard permission, so the default action does not fill it.
    if(!el.value) el.value = t;
    el.dispatchEvent(new Event('input', {bubbles: true}));
  }, text);
  await page.locator('#pname2').fill('Week 9');
  await page.locator('#pasteSave').click();
  return page.evaluate(() => {
    const a = window.__acorn;
    const l = a.state.words.lists[a.state.words.lists.length - 1];
    return {words: l ? a.wordsOf(l) : [],
            toast: (document.querySelector('#toast') || {}).textContent || ''};
  });
}

test.describe('pasting this week’s list', () => {

  test('invisible characters between words still separate them', async ({page}) => {
    await open(page, '2026-08-01');
    for(const [name, sep] of [['zero-width space', '​'],
                              ['zero-width non-joiner', '‌'],
                              ['zero-width joiner', '‍'],
                              ['word joiner', '⁠'],
                              ['byte-order mark', '﻿']]){
      const r = await pasteList(page, 'said' + sep + 'they' + sep + 'went');
      expect(r.words, `${name} merged the list into ${JSON.stringify(r.words)}`)
        .toEqual(['said', 'they', 'went']);
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('and mixed in with ordinary separators', async ({page}) => {
    await open(page, '2026-08-01');
    const r = await pasteList(page, 'said,​ they​\nwent ⁠ rain');
    expect(r.words).toEqual(['said', 'they', 'went', 'rain']);
  });

  test('a soft hyphen inside a word is not a separator', async ({page}) => {
    // Word hyphenates long words with U+00AD. It belongs to the word, and dropping it
    // as a non-letter is what puts the word back together.
    await open(page, '2026-08-01');
    const r = await pasteList(page, 'beau­ti­ful, friend');
    expect(r.words).toEqual(['beautiful', 'friend']);
  });

  test('every shape a school list really arrives in', async ({page}) => {
    await open(page, '2026-08-01');
    for(const [why, text] of [
      ['plain commas',        'said, they, went'],
      ['one per line',        'said\nthey\nwent'],
      ['numbered',            '1. said\n2. they\n3. went'],
      ['numbered with )',     '1) said\n2) they\n3) went'],
      ['bulleted',            '• said\n• they\n• went'],
      ['tabs from a table',   'said\tthey\twent'],
      ['non-breaking spaces', 'said they went'],
      ['line separators',     'said they went'],
      ['em dashes',           'said — they — went'],
      ['double spaces',       'said,  they,   went'],
      ['trailing junk',       'said, they, went,,,   \n\n'],
      ['mixed case',          'Said, THEY, Went'],
      ['carriage returns',    'said\r\nthey\r\nwent'],
    ]){
      const r = await pasteList(page, text);
      expect(r.words, `${why}: ${JSON.stringify(r.words)}`).toEqual(['said', 'they', 'went']);
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('a curly apostrophe survives, because the word needs it', async ({page}) => {
    await open(page, '2026-08-01');
    const r = await pasteList(page, 'don’t, isn’t');
    expect(r.words).toEqual(["don't", "isn't"]);
  });

  test('the count it reports is the count it saved', async ({page}) => {
    // "1 word saved" was the only sign anything had gone wrong with the zero-width
    // paste, so the number has to be trustworthy.
    await open(page, '2026-08-01');
    for(const text of ['said, they, went', 'said', 'said​they', 'a, said, they']){
      const r = await pasteList(page, text);
      const m = r.toast.match(/(\d+) words? saved/);
      expect(m, `no count in "${r.toast}"`).not.toBeNull();
      expect(Number(m[1]), `said ${m[1]} but saved ${r.words.length}`).toBe(r.words.length);
      // And singular reads right.
      if(r.words.length === 1) expect(r.toast).toMatch(/1 word saved/);
    }
  });

  test('a word repeated in the paste is saved once', async ({page}) => {
    /* A real school list can repeat a word, or a grown-up types one twice by accident. Kept
       once, so she is never asked the same word twice in a sitting, and the count she is told
       is the count of distinct words — "3 words saved" for "said, said, they, said, went",
       not five. Case-insensitively, because "A" and "a" are the same word to spell. */
    await open(page, '2026-08-01');
    for(const [text, want] of [
      ['said, said, they, said, went', ['said', 'they', 'went']],
      ['rain rain rain',               ['rain']],
      ['they; THEY; They',             ['they']],
      ['beau, beau, beautiful',        ['beau', 'beautiful']],
    ]){
      const r = await pasteList(page, text);
      expect(r.words, `${JSON.stringify(text)} kept repeats`).toEqual(want);
      const m = r.toast.match(/(\d+) words? saved/);
      expect(Number(m[1]), `counted ${m[1]}, saved ${r.words.length}`).toBe(want.length);
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('and a list that already holds duplicates never asks the same word twice',
    async ({page}) => {
    /* The parser dedupes on the way in, but a hand-edited backup could still carry a list
       with repeats. Session building is the last line: it must not put the same word in a
       sitting more than once, whatever the source list looks like. */
    await open(page, '2026-08-01');
    const r = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id: 'dup', name: 'D', words: ['said', 'said', 'they', 'said', 'went']}];
      a.state.words.activeId = 'dup';
      a.state.words.mastery = {}; a.state.words.sessions = [];
      a.save(); a.go('day'); if(!a.session()) a.start();
      const w = a.session().words;
      return {words: w, unique: new Set(w).size, plan: a.session().plan};
    });
    expect(r.unique, `the sitting was ${JSON.stringify(r.words)}`).toBe(r.words.length);
    expect(r.words).not.toContain(undefined);
    expect(r.plan, 'the plan counted the duplicates').toBe(r.words.length);
  });

  test('nothing usable in the paste is refused rather than saved empty', async ({page}) => {
    await open(page, '2026-08-01');
    for(const text of ['​​​', '   ', '1. 2. 3.', '• •', '...']){
      const before = await page.evaluate(() => window.__acorn.state.words.lists.length);
      await page.evaluate(() => window.__acorn.go('parent'));
      await page.locator('#paste').fill(text);
      await page.locator('#pname2').fill('Week 9');
      await page.locator('#pasteSave').click();
      const after = await page.evaluate(() => window.__acorn.state.words.lists.length);
      expect(after, `${JSON.stringify(text)} was saved as a list`).toBe(before);
      await expect(page.locator('#toast')).toContainText(/No words found/);
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('an accented word keeps its letters, whichever way it is encoded', async ({page}) => {
    /* The same word arrives from the clipboard in two Unicode forms. Decomposed, the
       combining mark was already dropped as a non-letter and the word came out right.
       Precomposed, the whole character is one code point and went with it: "café" saved
       as "caf", "naïve" as "nave", "façade" as "faade" — a mangled word she could never
       have spelled, saved silently. */
    await open(page, '2026-08-01');
    for(const [text, want] of [
      ['caf\u00e9', 'cafe'],           ['cafe\u0301', 'cafe'],
      ['na\u00efve', 'naive'],         ['nai\u0308ve', 'naive'],
      ['fa\u00e7ade', 'facade'],       ['r\u00f4le', 'role'],
      ['cr\u00e8che', 'creche'],       ['Zo\u00eb', 'zoe'],
    ]){
      const r = await pasteList(page, text + ', rain');
      expect(r.words, `${JSON.stringify(text)} came through as ${JSON.stringify(r.words)}`)
        .toEqual([want, 'rain']);
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('and an accent she types matches the list stored without one', async ({page}) => {
    // Both sides go through the same tidying, so the two cannot disagree and leave her
    // with a word that is impossible to get right.
    await open(page, '2026-08-01');
    const r = await page.evaluate(() => {
      const a = window.__acorn;
      return {plain: a.sameWord('cafe', 'cafe'),
              acute: a.sameWord('caf\u00e9', 'cafe'),
              combining: a.sameWord('cafe\u0301', 'cafe'),
              wrong: a.sameWord('caff', 'cafe')};
    });
    expect(r.plain).toBe(true);
    expect(r.acute, 'an accent she typed made a correct spelling wrong').toBe(true);
    expect(r.combining).toBe(true);
    expect(r.wrong).toBe(false);
  });

  test('a word made only of invisible characters never reaches her', async ({page}) => {
    // The end of the same story: whatever survives the parse has to be a word she can
    // actually be asked and can actually spell.
    await open(page, '2026-08-01');
    const r = await pasteList(page, 'said, ​‌‍, they');
    expect(r.words).toEqual(['said', 'they']);
    for(const w of r.words) expect(w).toMatch(/^[a-z'-]+$/);
  });

});
