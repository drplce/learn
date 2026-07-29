// What tonight actually did.
//
// A sitting knew how many words she got right and not which of them moved, and the
// sitting was thrown away at the end of it. So the screen at the end could only
// describe her evening in the abstract. These three lists are the honest basis for
// a picture of it: met for the first time, climbed a box, slipped back.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

async function sitting(page, words, answer){
  return page.evaluate(o => {
    const a = window.__acorn;
    a.state.words.lists = [{id:'w1', name:'T', words:o.words}];
    a.state.words.activeId = 'w1'; a.save();
    a.start();
    let guard = 0;
    while(a.session() && guard++ < 60){
      const W = a.session(), w = W.words[W.i];
      if(W.stage === 'look'){ a.cover(); continue; }
      if(W.stage === 'write'){
        a.type(o.wrong.indexOf(w) >= 0 ? 'zzz' : w);
        a.check(); a.next(); continue;
      }
      a.next();
    }
    return a.tonight();
  }, {words, wrong: answer});
}

test.describe('what tonight did', () => {

  test('a word met for the first time is recorded as met tonight', async ({page}) => {
    await open(page, '2026-08-01');
    const t = await sitting(page, ['rain', 'boat'], []);
    expect(t.fresh.sort()).toEqual(['boat', 'rain']);
    expect(t.slipped).toEqual([]);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a word she already had, got right after a gap, is recorded as climbed', async ({page}) => {
    await open(page, '2026-08-05');
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.mastery = {rain: {right:2, wrong:0, box:2, lastSeen:'2026-08-01'},
                               boat: {right:2, wrong:0, box:2, lastSeen:'2026-08-01'}};
      a.save();
    });
    const t = await sitting(page, ['rain', 'boat'], []);
    expect(t.grew.sort()).toEqual(['boat', 'rain']);
    expect(t.fresh, 'words she already had are not new').toEqual([]);
  });

  test('a word she lost is recorded as slipped, not as grown', async ({page}) => {
    await open(page, '2026-08-05');
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.mastery = {rain: {right:6, wrong:0, box:6, lastSeen:'2026-08-01'},
                               boat: {right:6, wrong:0, box:6, lastSeen:'2026-08-01'}};
      a.save();
    });
    const t = await sitting(page, ['rain', 'boat'], ['rain']);
    expect(t.slipped).toEqual(['rain']);
    expect(t.grew, 'a word she lost must not be shown as growth').not.toContain('rain');
    // She got it right on the retry, which is not a day's progress either.
    expect(t.grew).not.toContain('rain');
  });

  /* A brand-new word is the only one that gets asked twice in an evening: shown,
     covered, written, and then requeued so its first cold retrieval happens today.
     So it is the only word that can climb and then slip in one sitting — a review
     word she gets right is asked once and that is that. */
  test('a word that climbs and then slips in one sitting counts as slipped', async ({page}) => {
    await open(page, '2026-08-05');
    const t = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'w1', name:'T', words:['rain', 'boat']}];
      a.state.words.activeId = 'w1'; a.save();
      a.start();
      const seen = {};
      let guard = 0;
      while(a.session() && guard++ < 40){
        const W = a.session(), w = W.words[W.i];
        if(W.stage === 'look'){ a.cover(); continue; }
        if(W.stage === 'write'){
          // Right the first time it is asked, wrong when it comes back.
          const again = seen[w];
          seen[w] = 1;
          a.type(again ? 'zzz' : w);
          a.check(); a.next(); continue;
        }
        a.next();
      }
      return {t: a.tonight(), box: a.state.words.mastery.rain.box};
    });
    // It went up and then came back down, so the evening did not grow it.
    expect(t.t.slipped, 'the slip was not recorded').toContain('rain');
    expect(t.t.grew, 'a word she lost is not growth').not.toContain('rain');
    // It is still a word she met tonight — that much did happen.
    expect(t.t.fresh).toContain('rain');
  });

  test('it survives a reload, and does not leak into tomorrow', async ({page}) => {
    await open(page, '2026-08-01');
    await sitting(page, ['rain', 'boat'], []);
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    const after = await page.evaluate(() => {
      window.__acorn.setToday('2026-08-01');
      return window.__acorn.tonight();
    });
    expect(after.fresh.sort(), 'lost on reload').toEqual(['boat', 'rain']);
    const tomorrow = await page.evaluate(() => {
      window.__acorn.setToday('2026-08-02');
      return window.__acorn.tonight();
    });
    expect(tomorrow.fresh, "yesterday's evening is not tonight's").toEqual([]);
  });

  test('the record is small enough to keep sixty of', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => {
      const a = window.__acorn;
      const ws = [];
      for(let i = 0; i < 40; i++) ws.push('word' + i);
      a.state.words.lists = [{id:'w1', name:'T', words:ws}];
      a.state.words.activeId = 'w1'; a.save();
      for(let d = 0; d < 70; d++){
        a.setToday(new Date(Date.UTC(2026, 7, 1 + d)).toISOString().slice(0, 10));
        if(!a.start()) continue;
        let g = 0;
        while(a.session() && g++ < 60){
          const W = a.session();
          if(W.stage === 'look'){ a.cover(); continue; }
          if(W.stage === 'write'){ a.type(W.words[W.i]); a.check(); a.next(); continue; }
          a.next();
        }
      }
    });
    const size = await page.evaluate(() => (localStorage.getItem('acorn.v1') || '').length);
    expect(await page.evaluate(() => window.__acorn.state.words.sessions.length))
      .toBeLessThanOrEqual(60);
    // Well inside any browser's quota, so remembering this cannot cost her progress.
    expect(size, 'stored state grew too much').toBeLessThan(120 * 1024);
  });
});
