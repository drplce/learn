// Does it feel like she is getting anywhere?
//
// Two defects sit behind this file, both reported by David on 2026-08-12 as "the
// path appears to be stuck as level 4" — while he was actually on level 15.
//
//   1. The path only ever drew three finished nodes above the current one, so the
//      level she was on sat fourth from the top every single session. The path is
//      deliberately wordless, so there was nothing else to tell him otherwise.
//   2. A level restarted from zero every time she left it. She plays in bursts —
//      six answers, put the phone down — so a twelve-answer level could never be
//      finished, while the watts kept piling up. That is what "stuck" really was.
const {test, expect} = require('@playwright/test');
const {open, errorsOf, answer} = require('./helpers');

// Drop her at a level, mid-ladder, with the check behind her.
async function at(page, cleared){
  return page.evaluate(n => {
    const a = window.__144;
    a.state.prog.placed = true;
    a.state.prog.cleared = n;
    a.save(); a.render();
    return {level: a.level(), kind: a.LEVELS[a.levelIndex()].kind};
  }, cleared);
}

test.describe('seeing that she is getting somewhere', () => {

  test('the lit chain grows as she clears levels', async ({page}) => {
    await open(page);
    const shape = async n => {
      await at(page, n);
      await page.waitForTimeout(200);
      return page.evaluate(() => {
        const nodes = [...document.querySelectorAll('#path .level')];
        return {done: nodes.filter(b => b.classList.contains('done')).length,
                total: nodes.length,
                nowAt: nodes.findIndex(b => b.classList.contains('now'))};
      });
    };
    const a = await shape(3), b = await shape(14), c = await shape(30);
    expect(a.done).toBe(3);
    expect(b.done, 'the path still shows three beads at level 15').toBeGreaterThan(a.done);
    expect(c.done, 'the path stops growing').toBeGreaterThan(b.done);
    // and the current level is not pinned to the same rung every session
    expect(new Set([a.nowAt, b.nowAt, c.nowAt]).size,
      'the current level sits in the same place no matter how far she has come')
      .toBeGreaterThan(1);
    expect(errorsOf(page)).toEqual([]);
  });

  test('the path itself says which level she is on', async ({page}) => {
    // There is no big button any more (David, 2026-08-13: "we can see the play
    // button on the current level"), so the number in the margin and the node's own
    // label carry it.
    await open(page);
    await at(page, 14);
    await page.waitForTimeout(200);
    const s = await page.evaluate(() => ({
      margin: (document.querySelector('#path .lvlnum.now') || {}).textContent,
      label: document.getElementById('nowlevel').getAttribute('aria-label')
    }));
    expect(s.margin).toBe('15');
    expect(s.label.toLowerCase()).toContain('level 15');
  });

});

test.describe('a level she walked away from', () => {

  test('is waiting where she left it, not back at the start', async ({page}) => {
    await open(page);
    await at(page, 14);
    await page.click('#nowlevel');
    await page.waitForTimeout(250);
    const goal = await page.evaluate(() => window.__144.sitting().goal);
    for(let i = 0; i < 6; i++){ await answer(page, true); await page.waitForTimeout(340); }
    const mid = await page.evaluate(() => window.__144.sitting().done);
    expect(mid).toBe(6);
    expect(mid).toBeLessThan(goal);

    // she puts the phone down and comes back to the path
    await page.evaluate(() => window.__144.go('home'));
    await page.waitForTimeout(250);
    await page.click('#nowlevel');
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.__144.sitting().done),
      'six answers were thrown away').toBe(6);

    // and the harder case: the app was closed entirely
    await page.reload();
    await page.waitForFunction(() => !!window.__144);
    await page.waitForTimeout(150);
    await page.click('#nowlevel');
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.__144.sitting().done),
      'closing the app threw her progress away').toBe(6);
    expect(errorsOf(page)).toEqual([]);
  });

  test('so a long level can be finished across two sittings', async ({page}) => {
    await open(page);
    await at(page, 14);                                   // a mix level: twelve answers
    await page.click('#nowlevel');
    await page.waitForTimeout(250);
    const goal = await page.evaluate(() => window.__144.sitting().goal);
    const cleared = await page.evaluate(() => window.__144.state.prog.cleared);
    // half tonight…
    for(let i = 0; i < Math.floor(goal / 2); i++){ await answer(page, true); await page.waitForTimeout(340); }
    await page.reload();
    await page.waitForFunction(() => !!window.__144);
    await page.waitForTimeout(150);
    // …half tomorrow
    await page.click('#nowlevel');
    await page.waitForTimeout(250);
    for(let i = 0; i < goal; i++){
      const on = await page.evaluate(() => !!window.__144.sitting() && !document.querySelector('#clear.on'));
      if(!on) break;
      await answer(page, true); await page.waitForTimeout(340);
    }
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => window.__144.state.prog.cleared),
      'the level never completed across two sittings').toBe(cleared + 1);
  });

  test('once it is cleared there is nothing left to come back to', async ({page}) => {
    await open(page);
    await at(page, 14);
    await page.click('#nowlevel');
    await page.waitForTimeout(250);
    const goal = await page.evaluate(() => window.__144.sitting().goal);
    for(let i = 0; i < goal; i++){ await answer(page, true); await page.waitForTimeout(340); }
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => window.__144.state.sit),
      'a finished level is still marked as part-done').toBe(null);
    // the next level starts from nothing
    await page.click('#clearOn');
    await page.waitForTimeout(350);
    expect(await page.evaluate(() => window.__144.sitting().done)).toBe(0);
  });

  test('a stored sitting can never hand her a level she has not played', async ({page}) => {
    await open(page);
    await at(page, 14);
    // storage says she is one answer from finishing — with an absurd count
    await page.evaluate(() => {
      const a = window.__144;
      const raw = JSON.parse(localStorage.getItem('144.v1'));
      raw.sit = {i: 14, k: 'mix:5:23', done: 9999, asked: 9999, round: 99};
      localStorage.setItem('144.v1', JSON.stringify(raw));
    });
    await page.reload();
    await page.waitForFunction(() => !!window.__144);
    const sit = await page.evaluate(() => window.__144.state.sit);
    const goal = await page.evaluate(() => window.__144.goalOf(window.__144.LEVELS[14]));
    expect(sit.done, 'a corrupt count could finish a level for her').toBeLessThan(goal);
    await page.click('#nowlevel');
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => !!document.querySelector('#clear.on')),
      'the level cleared itself on opening').toBe(false);
  });

  test('a sitting from an older shape of the ladder is ignored, not misapplied', async ({page}) => {
    // The ladder has been rewritten once already (v1.8 inserted the gap levels). A
    // level part-finished under the old numbering must not resume onto a different
    // level under the new one.
    await open(page);
    await at(page, 14);
    await page.evaluate(() => {
      const a = window.__144;
      const raw = JSON.parse(localStorage.getItem('144.v1'));
      raw.sit = {i: 14, k: 'boss:11:12', done: 5, asked: 5, round: 2};   // not this level
      localStorage.setItem('144.v1', JSON.stringify(raw));
    });
    await page.reload();
    await page.waitForFunction(() => !!window.__144);
    await page.click('#nowlevel');
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__144.sitting().done),
      'progress from a different level was carried over').toBe(0);
  });

  test('two windows: the one that got further wins', async ({page}) => {
    await open(page);
    await at(page, 14);
    await page.evaluate(() => {
      const a = window.__144;
      a.state.sit = {i:14, k:'mix:5:23', done:2, asked:2, round:1};
      a.save();
      // meanwhile, unheard, the other window got further on the same level
      const newer = JSON.parse(localStorage.getItem('144.v1'));
      newer.rev += 20;
      newer.sit = {i:14, k:'mix:5:23', done:9, asked:9, round:3};
      localStorage.setItem('144.v1', JSON.stringify(newer));
    });
    await page.evaluate(() => { window.__144.state.set.sound = false; window.__144.save(); });
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('144.v1')).sit);
    expect(stored.done, 'the further-along sitting was rolled back').toBe(9);
  });

});
