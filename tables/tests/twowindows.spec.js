// Two windows on the same phone.
//
// Acorn's hardest-won lesson, and the one that actually loses a child's work: a
// tab left open on the sofa, opened again hours later, writes its stale idea of
// the world over everything she did since. Nobody notices until the progress is
// gone.
const {test, expect} = require('@playwright/test');
const {open, openRaw, errorsOf} = require('./helpers');

test.describe('two windows', () => {

  /* Two REAL windows, and the second one has caught up before it writes.
     This was called "a window left open cannot undo the newest work" and its comments
     said the second window was "holding this moment in memory" — and on 2026-09-02 an
     assertion added to check that precondition found the second window's watts were
     260, not 100. It had never been stale: the `storage` event reaches it and it
     merges. So the test has always measured a caught-up window writing, which is a
     weaker claim than its name, and the timing of that catch-up is part of why it
     flaked. Renamed to what it does, and it now WAITS for the catch-up so the state it
     measures is settled rather than whatever the event loop had managed.
     The genuinely-stale case — the event never arriving, a frozen tab, a sleeping
     phone — is the sibling test below ("a window that never heard the news"), which
     writes from inside the page so no event fires. That one is where the merge is
     really on trial. */
  test('a second real window, caught up, writes without losing anything', async ({browser}) => {
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

    // a second window opens on that moment
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

    /* Check the ground truth before the interesting bit, so a failure below can
       only mean the merge let her down — not that something else moved the disk.

       Read it from the window that WROTE it. This read used to come from `b`, and it
       returned 100 instead of 260 on one full-suite run in three (caught 2026-09-02 by
       capturing the output to a file, after a fortnight of the failure being seen once
       and lost). Two Playwright pages share an origin but not necessarily a renderer
       process, so one page's view of localStorage can lag another's write — a race in
       the harness, not in the app, and nothing a phone with one tab would ever meet. */
    const onDisk = await a.evaluate(() => JSON.parse(localStorage.getItem('144.v1')));
    expect(onDisk && onDisk.power.watts,
      'precondition lost: storage did not hold the newest work before the stale write').toBe(260);
    // Wait for the second window to hear about it, so what follows is a settled state
    // rather than a race with the event loop.
    await b.waitForFunction(() => window.__144.state.power.watts === 260, null, {timeout: 4000});

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
