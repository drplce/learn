// What a phone keyboard actually puts in the box.
//
// Everything else in this suite types through the test API, which sets the value
// directly. Driving real keystrokes on an iPhone profile found two things it had hidden.
//
// "said." was marked wrong and her box for the word dropped from 2 to 1. On iOS a
// double-tapped space inserts ". " and the comma key sits against the space bar, so she
// was penalised for a keystroke she did not mean, on a word she had spelled correctly.
// And a single "." was recorded as a miss and requeued the word — the same fumble the
// empty box is already forgiven for.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

/* A new list id every call. With the same id, 10.6's session-preservation hands back
   the previous call's sitting — same list, same day, so it looks valid — and the second
   case in a loop finds itself on a verdict screen with no box to type in. */
let nth = 0;
async function typeReal(page, word, typed){
  await page.evaluate(w => {
    const a = window.__acorn;
    const id = 'x' + (++window.__nth || (window.__nth = 1));
    a.state.words.lists = [{id: id, name: 'T', words: [w, 'rain']}];
    a.state.words.activeId = id;
    a.state.words.mastery = {}; a.state.words.sessions = [];
    a.save(); a.go('day');
    if(!a.session()) a.start();
  }, word);
  await page.evaluate(() => { const a = window.__acorn; if(a.session() && a.session().stage === "look") a.cover(); });
  await page.locator('#type').click();
  await page.keyboard.type(typed);                 // one keystroke at a time
  await page.keyboard.press("Enter");             // return submits — no Check button
  return page.evaluate(w => {
    const a = window.__acorn, m = a.mastery(w), s = a.session();
    const v = (document.querySelector('.verdict') || {}).textContent || '';
    return {right: /that’s it|got there/.test(v), verdict: v, box: m.box,
            wrong: m.wrong, rights: m.right, stage: s && s.stage,
            toast: (document.querySelector('#toast') || {}).textContent || ''};
  }, word);
}

test.describe('typing it on a phone', () => {

  test('the letters are what counts, not the punctuation round them', async ({page}) => {
    await open(page, '2026-08-01');
    // Every one of these is "said" spelled correctly, with something the keyboard or a
    // stray finger added at an end.
    for(const typed of ['said', 'Said', 'SAID', ' said', 'said ', '  said  ',
                        'said.', 'said,', 'said!', 'said?', '"said"', 'said. ']){
      const r = await typeReal(page, 'said', typed);
      expect(r.right, `${JSON.stringify(typed)} was marked as a miss: "${r.verdict}"`).toBe(true);
      expect(r.wrong, `${JSON.stringify(typed)} cost her a box`).toBe(0);
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('a space inside the word is still not the word', async ({page}) => {
    // Only the ends are tidied. "sa id" is not a spelling of "said", and pretending it
    // is would let her past a word she cannot write.
    await open(page, '2026-08-01');
    for(const typed of ['sa id', 's a i d', 'sai d']){
      const r = await typeReal(page, 'said', typed);
      expect(r.right, `${JSON.stringify(typed)} was accepted`).toBe(false);
    }
  });

  test('an answer with no letters in it is a fumble, not a miss', async ({page}) => {
    // The empty box is already forgiven. A single full stop is the same accident.
    await open(page, '2026-08-01');
    for(const typed of ['.', ',', '. ', '!!', '?', '  ']){
      const r = await typeReal(page, 'said', typed);
      expect(r.wrong, `${JSON.stringify(typed)} was recorded as a miss`).toBe(0);
      expect(r.rights, `${JSON.stringify(typed)} was recorded as right`).toBe(0);
      expect(r.stage, `${JSON.stringify(typed)} moved her off the writing screen`).toBe('write');
      expect(r.toast).toMatch(/Have a go/);
    }
  });

  test('a word that really contains an apostrophe or hyphen keeps it', async ({page}) => {
    // The tidying strips what cannot be part of a word. These can, so a target word
    // may hold them and her answer has to be allowed to as well.
    await open(page, '2026-08-01');
    for(const [word, typed, want] of [
      ["don't", "don't", true],
      ["don't", "don't.", true],          // the same word with a stray full stop
      ["don't", "dont", false],           // the apostrophe really is missing
      ['well-known', 'well-known', true],
      ['well-known', 'well-known,', true],
      ['well-known', 'wellknown', false],
    ]){
      const r = await typeReal(page, word, typed);
      expect(r.right, `${JSON.stringify(typed)} for "${word}": "${r.verdict}"`).toBe(want);
    }
  });

  test('the marking lines up with the verdict, not with the punctuation', async ({page}) => {
    // matched() and sameWord() have to judge the same letters. If one saw the full stop
    // and the other did not, a correct answer could be marked up as having an extra bit.
    await open(page, '2026-08-01');
    const r = await page.evaluate(() => {
      const a = window.__acorn;
      const cases = [['said', 'siad'], ['said', 'siad.'], ['said', ' siad '],
                     ['beautiful', 'beatiful,'], ['thought', 'thort.']];
      return cases.map(([w, t]) => {
        const m = a.matched(t, w);
        return {w, t, count: m.count, hit: m.hit,
                missing: w.length - m.count, same: a.sameWord(t, w)};
      });
    });
    for(const c of r){
      // The punctuation must not show up as a letter she got or one she missed.
      const clean = c.t.replace(/[^a-z]/g, '');
      const bare = r.find(x => x.w === c.w && x.t === clean);
      if(bare) expect(c.count, `"${c.t}" scored differently from "${clean}"`).toBe(bare.count);
      expect(c.count).toBeLessThanOrEqual(c.w.length);
    }
  });

  test('pressing Enter checks the word, like the button', async ({page}) => {
    // enterkeyhint="done" promises it, and the on-screen keyboard's key is nearer than
    // the button.
    await open(page, '2026-08-01');
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id: 'x', name: 'T', words: ['said', 'rain']}];
      a.state.words.activeId = 'x';
      a.state.words.mastery = {}; a.state.words.sessions = [];
      a.save(); a.go('day');
      if(!a.session()) a.start();
    });
    await page.evaluate(() => { const a = window.__acorn; if(a.session() && a.session().stage === "look") a.cover(); });
    await page.locator('#type').click();
    await page.keyboard.type('said');
    await page.keyboard.press('Enter');
    const r = await page.evaluate(() => {
      const s = window.__acorn.session();
      return {stage: s && s.stage, right: window.__acorn.mastery('said').right};
    });
    expect(r.stage, 'Enter did not check the word').toBe('check');
    expect(r.right).toBe(1);
  });

  test('a long word typed for real is not cut off in the box', async ({page}) => {
    // The box is styled, not just present: a word she cannot see all of is one she
    // cannot check over.
    await open(page, '2026-08-01');
    await page.setViewportSize({width: 320, height: 568});
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.settings.textScale = 1.5;
      a.state.words.lists = [{id: 'x', name: 'T', words: ['antidisestablishment', 'rain']}];
      a.state.words.activeId = 'x';
      a.state.words.mastery = {}; a.state.words.sessions = [];
      a.save(); a.go('day');
      if(!a.session()) a.start();
    });
    await page.evaluate(() => { const a = window.__acorn; if(a.session() && a.session().stage === "look") a.cover(); });
    await page.locator('#type').click();
    await page.keyboard.type('antidisestablishment');
    const r = await page.evaluate(() => {
      const i = document.querySelector('#type');
      const b = i.getBoundingClientRect();
      return {value: i.value, fits: b.right <= document.documentElement.clientWidth + 1,
              sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1};
    });
    expect(r.value).toBe('antidisestablishment');
    expect(r.fits, 'the box runs off the side of the screen').toBe(true);
    expect(r.sideways, 'typing a long word made the page scroll sideways').toBe(false);
  });

});
