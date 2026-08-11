// Two windows on the same phone.
//
// Acorn's hardest-won lesson, and the one that actually loses a child's work: a
// tab left open on the sofa, opened again hours later, writes its stale idea of
// the world over everything she did since. Nobody notices until the progress is
// gone.
const {test, expect} = require('@playwright/test');
const {open, openRaw, errorsOf} = require('./helpers');

test.describe('two windows', () => {

  test('a window left open cannot undo the newest work', async ({browser}) => {
    const ctx = await browser.newContext();          // one context = one localStorage
    const a = await openRaw(await ctx.newPage());
    await a.evaluate(() => window.__144.reset());

    // she plays in the first window
    await a.evaluate(() => {
      const s = window.__144.state;
      s.power.watts = 100; s.prog.cleared = 2; s.prog.placed = true;
      s.facts['6x7'] = {box:4, right:4, wrong:0, seen:4, last:window.__144.todayISO()};
      window.__144.save();
    });

    // a second window opens and sits there, holding this moment in memory
    const b = await openRaw(await ctx.newPage());
    expect(await b.evaluate(() => window.__144.state.power.watts)).toBe(100);

    // she keeps playing in the first window
    await a.evaluate(() => {
      const s = window.__144.state;
      s.power.watts = 260; s.prog.cleared = 5;
      s.facts['6x7'] = {box:6, right:6, wrong:0, seen:6, last:window.__144.todayISO()};
      s.facts['8x9'] = {box:3, right:3, wrong:0, seen:3, last:window.__144.todayISO()};
      window.__144.save();
    });

    // and now the stale window writes — a tap on anything is enough
    await b.evaluate(() => { window.__144.state.set.sound = false; window.__144.save(); });

    const stored = await b.evaluate(() => JSON.parse(localStorage.getItem('144.v1')));
    expect(stored.power.watts, 'the stale window ate her watts').toBeGreaterThanOrEqual(260);
    expect(stored.prog.cleared, 'the stale window undid her levels').toBeGreaterThanOrEqual(5);
    expect(stored.facts['6x7'].box, 'the stale window pushed a fact back down').toBeGreaterThanOrEqual(6);
    expect(stored.facts['8x9'], 'the stale window lost a fact entirely').toBeTruthy();
    // and the thing the stale window actually changed still took effect
    expect(stored.set.sound).toBe(false);
    expect(errorsOf(a).concat(errorsOf(b))).toEqual([]);
    await ctx.close();
  });

  test('a window that never heard the news still does not undo it', async ({page}) => {
    // On a phone the other window's `storage` event may never arrive: the tab was
    // frozen, or the phone was asleep. Writing to storage from inside this page
    // fires no event here, which is exactly that situation — so the merge on the
    // way out is the only thing standing between her and losing an evening.
    await open(page);
    await page.evaluate(() => {
      const a = window.__144;
      a.state.power.watts = 40; a.save();
      // …meanwhile, unheard: another window banks a much better evening
      const newer = JSON.parse(localStorage.getItem('144.v1'));
      newer.rev += 50; newer.power.watts = 900; newer.prog.cleared = 12;
      newer.facts['7x8'] = {box:7, right:9, wrong:0, seen:9, last:a.todayISO()};
      localStorage.setItem('144.v1', JSON.stringify(newer));
    });
    // this window, none the wiser, writes
    await page.evaluate(() => { window.__144.state.set.sound = false; window.__144.save(); });
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('144.v1')));
    expect(stored.power.watts, 'her banked watts were rolled back').toBe(900);
    expect(stored.prog.cleared, 'her levels were rolled back').toBe(12);
    expect(stored.facts['7x8'].box, 'a mastered fact was pushed back down').toBe(7);
    expect(stored.set.sound).toBe(false);            // and her tap still counted
    expect(errorsOf(page)).toEqual([]);
  });

  test('a second window notices what the first one did', async ({browser}) => {
    const ctx = await browser.newContext();
    const a = await openRaw(await ctx.newPage());
    await a.evaluate(() => window.__144.reset());
    const b = await openRaw(await ctx.newPage());

    await a.evaluate(() => { window.__144.state.power.watts = 777; window.__144.save(); });
    // the other window should catch up on its own, not sit on a stale number
    await b.waitForFunction(() => window.__144.state.power.watts === 777, null, {timeout: 3000});
    expect(await b.evaluate(() => document.getElementById('wattN').textContent)).toBe('777');
    await ctx.close();
  });

  test('painting does not write to storage', async ({page}) => {
    // A save on every repaint is how two windows end up racing each other, and it
    // made her progress depend on a paint rather than on her answer.
    await open(page);
    const before = await page.evaluate(() => window.__144.state.rev);
    await page.evaluate(() => { for(let i = 0; i < 5; i++) window.__144.render(); });
    expect(await page.evaluate(() => window.__144.state.rev)).toBe(before);
  });

});
