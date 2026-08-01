// What her keyboard actually types.
//
// iOS Smart Punctuation is on by default and cannot be turned off from a web
// page: autocorrect="off" does not touch it. So when she types don't, the phone
// puts a curly ’ in the box. The app compared that against the plain ' in the
// word list, decided she had it wrong, and marked the apostrophe as her mistake.
//
// Worse, the same characters came in from the other end. A list pasted out of a
// school newsletter or a Word document carries curly apostrophes and
// non-breaking hyphens, and the paste stripped them instead of tidying them —
// storing "dont", "oclock" and "motherinlaw" as the spellings she then had to
// reproduce.
const {test, expect} = require('@playwright/test');
const {open, errorsOf, write} = require('./helpers');

// Everything a phone or a word processor puts in place of ' and -.
const CURLY = '’', OPEN = '‘', PRIME = '′';
const NBHYPHEN = '‑', ENDASH = '–', EMDASH = '—', MINUS = '−';

async function answer(page, target, typed){
  return page.evaluate(o => {
    const a = window.__acorn;
    a.state.words.lists = [{id:'w1', name:'T', words:[o.target]}];
    a.state.words.activeId = 'w1'; a.state.words.mastery = {}; a.state.words.sessions = [];
    a.save(); a.go('day'); a.start(); a.cover(); a.type(o.typed); a.check();
    const m = a.state.words.mastery[o.target] || {};
    const v = document.querySelector('.verdict, .headline');
    return {right: m.right || 0, wrong: m.wrong || 0, verdict: (v ? v.textContent : '').trim(),
            won: !!document.querySelector('.word.won'),   // WIN-5: the green word IS the win
            said: ((document.querySelector('#say') || {}).textContent || '').trim()};
  }, {target, typed});
}

test.describe('the apostrophe her phone types', () => {

  test('a curly apostrophe is the same word', async ({page}) => {
    await open(page, '2026-08-01');
    for(const [target, typed] of [
      ["don't", 'don' + CURLY + 't'],
      ["o'clock", 'o' + CURLY + 'clock'],
      ["can't", 'can' + PRIME + 't'],
      ["it's", 'it' + OPEN + 's'],
    ]){
      const r = await answer(page, target, typed);
      expect(r.wrong, `${typed} for ${target} was marked wrong`).toBe(0);
      expect(r.right, `${typed} for ${target} did not count`).toBe(1);
      expect(r.won, `${typed} for ${target} did not show the win`).toBe(true);
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('the dashes a word processor substitutes are still hyphens', async ({page}) => {
    await open(page, '2026-08-01');
    // "well-known" is on one of her built-in lists.
    for(const dash of [NBHYPHEN, ENDASH, EMDASH, MINUS]){
      const r = await answer(page, 'well-known', 'well' + dash + 'known');
      expect(r.wrong, `well${dash}known was marked wrong`).toBe(0);
      expect(r.right).toBe(1);
    }
  });

  test('the plain characters still work, and a real miss is still a miss', async ({page}) => {
    await open(page, '2026-08-01');
    expect((await answer(page, "don't", "don't")).right).toBe(1);
    // Tidying punctuation must not start accepting the wrong word.
    const miss = await answer(page, "don't", 'dont');
    expect(miss.right).toBe(0);
    expect(miss.wrong).toBe(1);
    const other = await answer(page, "don't", "doesn't");
    expect(other.wrong).toBe(1);
  });

  test('dropping the apostrophe is named as one, not marked as a letter', async ({page}) => {
    /* When the only thing she left out is the apostrophe — the commonest slip on a
       contraction — the verdict used to say "So close. Look at this letter." and read
       aloud as "Look at the letter '.", pointing a nine-year-old at a mark that is not a
       letter and cannot be spoken as one. It has to be named: an apostrophe is a thing
       she is taught. */
    await open(page, '2026-08-01');
    for(const [target, typed] of [["don't", 'dont'], ["it's", 'its'],
                                  ["they're", 'theyre'], ["o'clock", 'oclock']]){
      const r = await answer(page, target, typed);
      // No visible caption now (David: "ditch the re-trace caption"); the naming lives on the
      // live region (r.said), which the read-aloud checks below already use.
      expect(r.said, `${typed} for ${target}`).toMatch(/So close — it needs an apostrophe\./);
      // Never "the letter '", on screen or read aloud. The spelt-out word at the end of
      // the announcement still names every character of the correct spelling, which is
      // right — that is the spelling, not a list of what she missed.
      expect(r.said, `${typed} read aloud as "${r.said}"`).not.toMatch(/letter '|letter ’/);
      expect(r.said).toMatch(/needs an apostrophe/);
    }
    // The hyphen gets its own name for the same reason.
    const h = await answer(page, 'well-known', 'wellknown');
    expect(h.said).toMatch(/So close — it needs a hyphen\./);
    expect(h.said).not.toMatch(/letter -/);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a missing letter still says "letter", not a mark', async ({page}) => {
    // The named-mark wording must not swallow the ordinary case: a real dropped letter
    // is still pointed at as a letter.
    await open(page, '2026-08-01');
    const r = await answer(page, "don't", "dnt");        // dropped the o as well
    expect(r.said, 'a dropped letter was called a mark').not.toMatch(/apostrophe|hyphen/);
    const s = await answer(page, 'friend', 'frend');     // plain word, dropped an i
    expect(s.said).toMatch(/Look at the letter/);        // named on the live region
  });
});

test.describe('the list a grown-up pastes in', () => {

  test('curly apostrophes are tidied, not deleted', async ({page}) => {
    await open(page, '2026-08-01');
    const got = await page.evaluate(o => window.__acorn.parseWordList(
      'don' + o.c + 't, can' + o.c + 't, o' + o.c + 'clock, it' + o.c + 's, they' + o.c + 're'),
      {c: CURLY});
    // Not "dont", "cant", "oclock" — those are misspellings, and she would have
    // been taught them.
    expect(got).toEqual(["don't", "can't", "o'clock", "it's", "they're"]);
  });

  test('substituted dashes are tidied too', async ({page}) => {
    await open(page, '2026-08-01');
    const got = await page.evaluate(o => window.__acorn.parseWordList(
      'mother' + o.nb + 'in' + o.nb + 'law well' + o.en + 'known up' + o.fig + 'to' + o.fig + 'date'),
      {nb: NBHYPHEN, en: ENDASH, fig: '\u2012'});
    expect(got).toEqual(['mother-in-law', 'well-known', 'up-to-date']);
  });

  // An em dash is punctuation between words, never a hyphen inside one, so it
  // has to keep separating them.
  test('an em dash still separates words rather than joining them', async ({page}) => {
    await open(page, '2026-08-01');
    const got = await page.evaluate(o => window.__acorn.parseWordList(
      'because' + o.em + 'friend, thought' + o.em + ' rain'), {em: EMDASH});
    expect(got).toEqual(['because', 'friend', 'thought', 'rain']);
  });

  test('a tidied word still splits into pieces that spell it', async ({page}) => {
    await open(page, '2026-08-01');
    const bad = await page.evaluate(o => {
      const a = window.__acorn;
      const ws = a.parseWordList('don' + o.c + 't o' + o.c + 'clock mother' + o.nb + 'in' + o.nb + 'law');
      return ws.filter(w => a.syllables(w).join('') !== w)
               .map(w => w + ' → ' + a.syllables(w).join('·'));
    }, {c: CURLY, nb: NBHYPHEN});
    expect(bad).toEqual([]);
  });

  test('a pasted list of these words practises end to end', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('#paste').fill('don’t, can’t, o’clock');
    await page.locator('#pname2').fill('Week 5');
    await page.locator('#pasteSave').click();
    await page.locator('.back').click();
    // She types what her phone types, all the way through. Driven by stage — the trace
    // box and the write box are both #type, so the stage is what tells them apart; the
    // trace itself is skipped with cover() since this is about the apostrophe, not the copy.
    for(let i = 0; i < 20; i++){
      const stage = await page.evaluate(() => {
        const W = window.__acorn.session(); return W ? W.stage : 'done'; });
      if(stage === 'done') break;
      if(stage === 'look'){ await page.evaluate(() => window.__acorn.cover()); continue; }
      if(stage === 'write'){
        const w = await page.evaluate(() => {
          const W = window.__acorn.session(); return W ? W.words[W.i] : null; });
        if(!w) break;
        await write(page, w.replace(/'/g, CURLY));
        await page.evaluate(() => window.__acorn.check());
        continue;
      }
      await page.evaluate(() => window.__acorn.next());
    }
    const m = await page.evaluate(() => window.__acorn.state.words.mastery);
    const wrong = Object.keys(m).filter(w => m[w].wrong > 0);
    expect(wrong, 'she spelt them all correctly').toEqual([]);
    expect(Object.keys(m).sort()).toEqual(["can't", "don't", "o'clock"]);
    expect(errorsOf(page)).toEqual([]);
  });
});
