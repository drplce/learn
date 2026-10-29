// The 4× special edition. David, 2026-10-29: "Can I get a 4x table special edition
// for 144" — school is doing the 4s now, and the 4× table sits SEVENTH in
// TABLE_ORDER, so the ladder would not reach it for months.
//
// The whole point is that it is a run of its own: she can play the 4s TONIGHT, the
// ladder stays exactly where she left it, and what she answers still counts. Those
// three things are what these tests hold.
const {test, expect} = require('@playwright/test');
const {open, errorsOf, answer} = require('./helpers');

const placed = (page, cleared) => page.evaluate(c => {
  const a = window.__144;
  a.state.prog.placed = true; a.state.prog.cleared = c;
  a.save(); a.render();
}, cleared);

test.describe('the 4× special edition', () => {

  test('every fact in it is a 4× fact, and the whole table is there', async ({page}) => {
    await open(page);
    const r = await page.evaluate(() => {
      const a = window.__144, seen = {};
      const notFour = [];
      a.SPECIAL.forEach((lv, i) => lv.facts.forEach(k => {
        seen[k] = 1;
        const p = k.split('x').map(Number);
        if(p[0] !== a.SPECIAL_TABLE && p[1] !== a.SPECIAL_TABLE)
          notFour.push(`level ${i + 1}: ${k}`);
      }));
      const want = [];
      for(let b = 1; b <= 12; b++) want.push(a.key(a.SPECIAL_TABLE, b));
      return {notFour, missing: want.filter(k => !seen[k]), n: a.SPECIAL.length,
              kinds: a.SPECIAL.map(l => l.kind)};
    });
    expect(r.notFour, 'the 4× special asked something that is not a 4× fact').toEqual([]);
    expect(r.missing, 'the 4× table is not all in it').toEqual([]);
    // Meet-then-recall across the twelve, then a mix, then the boss.
    expect(r.kinds).toEqual(['learn','recall','learn','recall','learn','recall','mix','boss']);
  });

  test('it is reachable tonight, without scrolling the path', async ({page}) => {
    /* The reason this is a test and not an eyeball: the first build put the badge
       above the path, which renderHome() then scrolls past to reach the level she is
       on — so at level 12 it was off-screen and she would have had to scroll back up
       forty stones to find it. It is sticky now. */
    await page.setViewportSize({width: 375, height: 667});
    await open(page);
    await placed(page, 12);
    const go = page.locator('#specgo');
    await expect(go, 'there is no way in to the special run').toHaveCount(1);
    await expect(go).toBeInViewport();
    const box = await go.boundingBox();
    expect(box.height, 'too small to tap').toBeGreaterThanOrEqual(48);
    expect(errorsOf(page)).toEqual([]);
  });

  test('and it is not offered before her first go has placed her', async ({page}) => {
    await open(page);
    await expect(page.locator('#specgo'),
      'the special run jumped in front of the placement round').toHaveCount(0);
  });

  test('clearing a special level moves the special run and NOT the ladder',
    async ({page}) => {
    /* The one that matters most. Walking prog.cleared would march her up a ladder she
       has not played, past tables she has not met, and drag the countdown and the
       buddy's stages with it. */
    await open(page);
    await placed(page, 12);
    const r = await page.evaluate(async () => {
      const a = window.__144;
      const before = {cleared: a.state.prog.cleared, special: a.specialDone(),
                      watts: a.state.power.watts};
      a.start(a.SPECIAL[a.specialIndex()]);
      // A learn level shows her the fact before asking it; get past that first.
      if(a.meeting && a.meeting()) a.skipMeet();
      await new Promise(r2 => setTimeout(r2, 250));
      /* A right answer is followed by a short transition to the next question, and an
         answer offered during it is declined — so the pacing here matches the app's own
         helper rather than hammering it. Measured: at 120ms every second call was a
         no-op. */
      for(let i = 0; i < 40; i++){
        const W = a.sitting();
        if(!W || W.done >= W.goal) break;
        if(a.meeting && a.meeting()) a.skipMeet();
        a.answer(true);
        await new Promise(r2 => setTimeout(r2, 320));
      }
      await new Promise(r2 => setTimeout(r2, 900));
      return {before, after: {cleared: a.state.prog.cleared, special: a.specialDone(),
                              watts: a.state.power.watts}};
    });
    expect(r.after.special, 'the special run did not move').toBe(r.before.special + 1);
    expect(r.after.cleared, 'the special run walked her up the ladder').toBe(r.before.cleared);
    expect(r.after.watts, 'a cleared level paid her nothing').toBeGreaterThan(r.before.watts);
  });

  test('what she answers in it counts, like every other answer', async ({page}) => {
    // School is doing the 4s. A week of them has to land in the same boxes as
    // everything else, or the special edition is a toy that teaches nothing.
    await open(page);
    await placed(page, 12);
    const r = await page.evaluate(async () => {
      const a = window.__144;
      a.start(a.SPECIAL[0]);
      const facts = a.SPECIAL[0].facts.slice();
      const before = facts.map(k => (a.state.facts[k] || {}).seen || 0);
      for(let i = 0; i < 8; i++){
        if(a.meeting && a.meeting()) a.skipMeet();
        a.answer(true);
        await new Promise(r2 => setTimeout(r2, 320));
      }
      await new Promise(r2 => setTimeout(r2, 400));
      return {before, after: facts.map(k => (a.state.facts[k] || {}).seen || 0)};
    });
    expect(r.after.reduce((x, y) => x + y, 0),
      'a sitting in the special run taught the engine nothing')
      .toBeGreaterThan(r.before.reduce((x, y) => x + y, 0));
  });

  test('a half-finished special level is not confused with a ladder one',
    async ({page}) => {
    /* They look identical from the outside — a 4× `learn` of four facts either way —
       so the part-finished record has to say which run it belongs to, or she would be
       handed back the wrong one. */
    await open(page);
    await placed(page, 12);
    const r = await page.evaluate(async () => {
      const a = window.__144;
      a.start(a.SPECIAL[0]);
      for(let i = 0; i < 3; i++){
        if(a.meeting && a.meeting()) a.skipMeet();
        a.answer(true);
        await new Promise(r2 => setTimeout(r2, 320));
      }
      const sit = JSON.parse(JSON.stringify(a.state.sit || {}));
      // Now open the ladder's level: it must NOT pick her special progress up.
      a.start(a.LEVELS[a.levelIndex()]);
      const carried = a.sitting() ? a.sitting().done : -1;
      return {sit, carried};
    });
    expect(r.sit.sp, 'the part-finished level did not record which run it was').toBe(true);
    expect(String(r.sit.k).startsWith('sp:'),
      `a special level keyed as a ladder one: ${r.sit.k}`).toBe(true);
    expect(r.carried, 'the ladder level resumed from the special run').toBe(0);
  });

  test('nothing on it is unkind, and its counts agree with their nouns',
    async ({page}) => {
    await open(page);
    for(const done of [0, 1, 7, 8]){
      await page.evaluate(d => { const a = window.__144;
        a.state.prog.placed = true; a.state.prog.cleared = 12;
        a.state.special.done = d; a.save(); a.render(); }, done);
      const said = await page.evaluate(() => {
        const b = document.querySelector('#specgo');
        return b ? (b.innerText + ' ' + (b.getAttribute('aria-label') || '')) : '';
      });
      expect(said, `nothing is shown at ${done} of 8`).not.toBe('');
      expect(said).not.toMatch(/\b(wrong|fail|failed|bad|stupid|easy)\b/i);
      expect(said, 'the app named her').not.toMatch(/\bher\b/i);
      expect(said, 'a count disagrees with its noun').not.toMatch(/\b1 (facts|levels|goes)\b/);
    }
    expect(errorsOf(page)).toEqual([]);
  });
});
