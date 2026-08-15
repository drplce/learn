// A whole evening, end to end.
//
// Every other spec in this suite plays ONE level and reloads. Her diagnostics from
// 2026-08-13 say she played NINETEEN in a single sitting, so the state that builds
// up across an evening — the combo, the round colour, the fact pool, the orbs in the
// DOM, the timers left running by the slow lane — has never once been tested in the
// shape she actually plays it. That is the gap this file closes.
//
// The interesting failures here are the ones that need a boundary to happen: a pool
// that leaks from one level into the next, a streak that survives a level it did not
// earn, nodes that pile up until the phone crawls.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

// Play the level on screen right through, handling the slow lane the way she does —
// by looking at it and moving on — and stop at the clear card.
async function playThrough(page, {missEvery = 0} = {}){
  let answers = 0;
  for(let guard = 0; guard < 160; guard++){
    const st = await page.evaluate(() => {
      const a = window.__144, W = a.sitting();
      return {cleared: !!document.querySelector('#clear.on'),
              meeting: !!(W && a.meeting && a.meeting()),
              done: W ? W.done : -1, goal: W ? W.goal : -1};
    });
    if(st.cleared) break;
    if(st.meeting){                                   // "have a look at this one"
      await page.evaluate(() => window.__144.skipMeet());
      await page.waitForTimeout(240);
      continue;
    }
    const right = !(missEvery && answers % missEvery === 0);
    // answer() returns false when there is nothing on screen to tap — between the
    // last answer and the clear card, for one. Counting those would inflate the
    // total and make the diary look like it was dropping answers.
    const took = await page.evaluate(r => window.__144.answer(r), right);
    if(!took){ await page.waitForTimeout(200); continue; }
    answers++;
    await page.waitForTimeout(right ? 320 : 840);
  }
  await page.waitForTimeout(500);
  return answers;
}

// The one button on the clear card, back to the path.
async function okAndBack(page){
  await page.click('#clearOn');
  await page.waitForTimeout(320);
}

const snap = page => page.evaluate(() => {
  const a = window.__144;
  return {
    level: a.level(),
    cleared: a.state.prog.cleared,
    watts: a.state.power.watts,
    allNodes: document.querySelectorAll('body *').length,
    answers: a.state.log.recent.length,
    sit: a.state.sit
  };
});

test.describe('a whole evening in one sitting', () => {

  test('six levels back to back, and the path really moves six', async ({page}) => {
    test.setTimeout(180000);
    await open(page);
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });

    const start = await snap(page);
    const perLevel = [];
    for(let i = 0; i < 6; i++){
      await page.click('#nowlevel');
      await page.waitForTimeout(220);
      const before = await page.evaluate(() => window.__144.state.log.recent.length);
      const facts = await page.evaluate(() => window.__144.sitting().level.facts.slice());
      const n = await playThrough(page, {missEvery: i === 3 ? 4 : 0});
      await expect(page.locator('#clear')).toHaveClass(/on/);
      const asked = await page.evaluate(b =>
        window.__144.state.log.recent.slice(b).map(e => e.k),
        before);
      perLevel.push({n, facts, asked});
      await okAndBack(page);
    }
    const end = await snap(page);

    expect(end.cleared - start.cleared, 'six levels played, the path did not move six')
      .toBe(6);
    expect(end.watts).toBeGreaterThan(start.watts);
    expect(end.sit, 'a finished evening left a half-done level behind').toBe(null);
    perLevel.forEach((L, i) =>
      expect(L.n, `level ${i + 1} never asked her anything`).toBeGreaterThan(0));
    expect(errorsOf(page)).toEqual([]);
  });

  test('a level only ever asks its own facts, however many came before it', async ({page}) => {
    // The pool is rebuilt per level, but `W.pool` is carried on the sitting object and
    // the mix levels read it directly. If a stale pool ever survived a boundary she
    // would be asked something the level was not about, and the path would be lying
    // about what she just practised.
    test.setTimeout(180000);
    await open(page);
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });

    for(let i = 0; i < 5; i++){
      await page.click('#nowlevel');
      await page.waitForTimeout(220);
      const before = await page.evaluate(() => window.__144.state.log.recent.length);
      const facts = await page.evaluate(() => window.__144.sitting().level.facts.slice());
      await playThrough(page);
      const asked = await page.evaluate(b =>
        window.__144.state.log.recent.slice(b).map(e => e.k), before);
      const strays = asked.filter(k => facts.indexOf(k) < 0);
      expect(strays, `level ${i + 1} asked facts belonging to another level`).toEqual([]);
      await okAndBack(page);
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('a streak does not survive a level she has already been paid for', async ({page}) => {
    // Ending level 4 on a nine-answer run and starting level 5 already at ×4 would
    // hand her a multiplier she has not earned this level, and the combo sound would
    // open at the top of its range with nowhere left to climb.
    await open(page);
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });
    await page.click('#nowlevel');
    await page.waitForTimeout(220);
    await playThrough(page);
    // the clear card is up but the sitting object is still the one she just finished
    const finished = await page.evaluate(() => window.__144.sitting().combo);
    expect(finished, 'she did not finish the level on a streak, so this proves nothing')
      .toBeGreaterThan(2);
    await okAndBack(page);
    await page.click('#nowlevel');
    await page.waitForTimeout(260);
    const fresh = await page.evaluate(() => window.__144.sitting().combo);
    expect(fresh, 'the streak carried into the next level').toBe(0);
    expect(await page.evaluate(() => window.__144.sitting().round),
      'the round did not restart, so the colour and speed carried over').toBe(1);
    expect(errorsOf(page)).toEqual([]);
  });

  test('the screen does not fill up with leftovers over a long sitting', async ({page}) => {
    // Every level spawns orbs and sparks and removes them. "Removes them" is the part
    // worth checking on the sixth level rather than the first — this is the failure
    // that shows up on her phone as the game getting slower the longer she plays, and
    // no single-level test can see it.
    test.setTimeout(180000);
    await open(page);
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });

    let afterFirst = 0;
    for(let i = 0; i < 6; i++){
      await page.click('#nowlevel');
      await page.waitForTimeout(220);
      await playThrough(page);
      await okAndBack(page);
      const n = (await snap(page)).allNodes;
      if(i === 0) afterFirst = n;
      else expect(n, `the DOM grew from ${afterFirst} to ${n} by level ${i + 1}`)
        .toBeLessThan(afterFirst + 60);
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('the evening is one day in the diary, not six', async ({page}) => {
    test.setTimeout(180000);
    await open(page);
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });
    let total = 0;
    for(let i = 0; i < 4; i++){
      await page.click('#nowlevel');
      await page.waitForTimeout(220);
      total += await playThrough(page);
      await okAndBack(page);
    }
    const L = await page.evaluate(() => window.__144.state.log);
    const days = Object.keys(L.days);
    expect(days.length, 'one sitting was written down as several days').toBe(1);
    const day = L.days[days[0]];
    expect(day.lv, 'the levels she finished were not all counted').toBe(4);
    expect(day.a, 'the answers were not all counted').toBe(total);
    expect(day.ms, 'no time was recorded for the sitting').toBeGreaterThan(0);
    expect(day.ms, 'the sitting is recorded as hours long').toBeLessThan(30 * 60000);
    expect(errorsOf(page)).toEqual([]);
  });

});
