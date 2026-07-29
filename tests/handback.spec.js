// A grown-up looks in mid-word, and hands the phone back.
//
// Leaving her screen used to throw the sitting away outright — go() nulled it on the
// way out — and coming back built a new one. Two things went with it. Her half-typed
// answer, which is annoying. And the record of which words she had already been shown,
// so a word she had covered up and was writing from memory got shown to her again: a
// grown-up glancing at Progress silently turned the one exercise that works into a
// copying exercise.
//
// The sitting is kept now and checked on the way back. It survives a look; it does not
// survive anything that makes it wrong.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

async function midWord(page, words){
  await page.evaluate(ws => {
    const a = window.__acorn;
    a.state.words.lists = [{id: 'w1', name: 'Week 5', words: ws}];
    a.state.words.activeId = 'w1';
    a.state.words.mastery = {}; a.state.words.sessions = [];
    a.save(); a.go('day');
    if(!a.session()) a.start();
    if(a.session().stage === 'look') a.cover();       // she has covered it up
  }, words || ['said', 'went', 'rain']);
}
const where = page => page.evaluate(() => {
  const a = window.__acorn, s = a.session();
  return {
    stage: s && s.stage, word: s && s.words[s.i], n: s && s.words.length,
    typed: (document.querySelector('#type') || {}).value,
    list: (a.activeList() || {}).id,
    // The word on screen must be one she can actually be asked.
    onList: s ? a.wordsOf(a.activeList()).indexOf(s.words[s.i]) >= 0
               || a.allWords().indexOf(s.words[s.i]) >= 0 : null,
  };
});

test.describe('handing the phone back', () => {

  test('a look at Progress does not show her the word again', async ({page}) => {
    await open(page, '2026-08-01');
    await midWord(page);
    const before = await where(page);
    expect(before.stage).toBe('write');
    await page.evaluate(() => { window.__acorn.go('parent'); window.__acorn.go('day'); });
    const after = await where(page);
    expect(after.stage, 'she was shown the word she was writing from memory').toBe('write');
    expect(after.word).toBe(before.word);
    expect(errorsOf(page)).toEqual([]);
  });

  test('and does not lose what she had typed', async ({page}) => {
    await open(page, '2026-08-01');
    await midWord(page);
    await page.locator('#type').fill('sai');
    await page.evaluate(() => { window.__acorn.go('parent'); window.__acorn.go('day'); });
    expect(await page.locator('#type').inputValue()).toBe('sai');
  });

  test('changing her text size does not rewind her', async ({page}) => {
    // A cosmetic setting must not cost her the word she is on. This was the case
    // that made the whole thing visible: it goes through the same render path.
    await open(page, '2026-08-01');
    await midWord(page);
    await page.evaluate(() => {
      const a = window.__acorn;
      a.go('parent');
      a.state.settings.textScale = 1.5; a.save();
      a.go('day');
    });
    const after = await where(page);
    expect(after.stage).toBe('write');
  });

  test('switching lists gives her a fresh sitting on the new one', async ({page}) => {
    await open(page, '2026-08-01');
    await midWord(page);
    await page.evaluate(() => {
      const a = window.__acorn;
      a.go('parent'); a.state.words.activeId = 'tricky'; a.save(); a.go('day');
    });
    const after = await where(page);
    expect(after.list).toBe('tricky');
    expect(after.onList, 'she was left on a word from the list she is no longer on').toBe(true);
    const words = await page.evaluate(() => window.__acorn.session().words);
    const tricky = await page.evaluate(() =>
      window.__acorn.wordsOf(window.__acorn.allLists().find(l => l.id === 'tricky')));
    for(const w of words) expect(tricky).toContain(w);
  });

  test('deleting the list she was on does not leave her stranded', async ({page}) => {
    await open(page, '2026-08-01');
    await midWord(page);
    await page.evaluate(() => {
      const a = window.__acorn;
      a.go('parent');
      a.state.words.lists = [];                      // the list she was on is gone
      a.state.words.activeId = 'easy';
      a.save(); a.go('day');
    });
    const after = await where(page);
    expect(after.stage, 'no word at all after the list went').toBeTruthy();
    expect(after.onList).toBe(true);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a restored backup replaces the sitting rather than half-replacing it',
    async ({page}) => {
      await open(page, '2026-08-01');
      await midWord(page);
      await page.evaluate(() => {
        const a = window.__acorn;
        a.go('parent');
        localStorage.setItem('acorn.v1', JSON.stringify({
          profile: {name: '', createdAt: '2026-07-01'},
          words: {lists: [{id: 'b', name: 'Backup', words: ['apple', 'pear']}],
                  mastery: {}, activeId: 'b', sessions: []},
          settings: {textScale: 1, tint: 'cream', readAloud: true, sound: true, voice: null},
        }));
        a.load(); a.go('day');
      });
      const after = await where(page);
      expect(after.list).toBe('b');
      expect(['apple', 'pear']).toContain(after.word);
    });

  test('midnight arriving while a grown-up is looking starts her a new day',
    async ({page}) => {
      // The one that makes keeping the sitting safe: a sitting belongs to a day, and
      // carrying yesterday's into today would record it against the wrong date.
      await open(page, '2026-08-01');
      await midWord(page);
      await page.evaluate(() => {
        const a = window.__acorn;
        a.go('parent');
        a.setToday('2026-08-02');
        a.go('day');
      });
      const after = await where(page);
      expect(after.stage, 'yesterday’s sitting was handed back today').toBe('look');
      const day = await page.evaluate(() => window.__acorn.session().day);
      expect(day).toBe('2026-08-02');
    });

  test('the sitting she gets back is the same sitting, not a rebuilt lookalike',
    async ({page}) => {
      // Halfway through, then a look and back: the words already answered must not
      // come round again and the plan must not restart.
      await open(page, '2026-08-01');
      await page.evaluate(() => {
        const a = window.__acorn;
        a.state.words.activeId = 'easy';
        a.state.words.mastery = {}; a.state.words.sessions = [];
        a.save(); a.go('day');
        if(!a.session()) a.start();
        for(let n = 0; n < 3; n++){
          const W = a.session();
          if(!W) break;
          if(W.stage === 'look'){ a.cover(); n--; continue; }
          a.type(W.words[W.i]); a.check(); a.next();
        }
      });
      const before = await page.evaluate(() => {
        const s = window.__acorn.session();
        return {i: s.i, plan: s.plan, done: (s.done || []).length, words: s.words.slice()};
      });
      expect(before.i, 'she had not got far enough in for this to prove anything')
        .toBeGreaterThan(0);
      await page.evaluate(() => { window.__acorn.go('parent'); window.__acorn.go('day'); });
      const after = await page.evaluate(() => {
        const s = window.__acorn.session();
        return {i: s.i, plan: s.plan, words: s.words.slice()};
      });
      expect(after.i).toBe(before.i);
      expect(after.plan).toBe(before.plan);
      expect(after.words).toEqual(before.words);
      expect(errorsOf(page)).toEqual([]);
    });

});
