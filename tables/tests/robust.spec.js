// When the phone is having a bad day.
//
// A full disk, a private-mode quota, a clock that jumps. None of these are her
// fault and none of them may cost her an evening, break a level she is halfway
// through, or throw where she can see it.
const {test, expect} = require('@playwright/test');
const {APP, open, errorsOf, answer, playLevel, play, alreadyMet} = require('./helpers');

// Make every write fail, the way a full disk does.
async function jamStorage(page){
  await page.evaluate(() => {
    window.__jammed = true;
    const real = localStorage.setItem.bind(localStorage);
    window.__unjam = () => { localStorage.setItem = real; window.__jammed = false; };
    localStorage.setItem = () => { throw new DOMException('QuotaExceededError'); };
  });
}

test.describe('a full disk', () => {

  test('she can keep playing, and nothing throws where she can see it', async ({page}) => {
    await open(page);
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });
    await alreadyMet(page);            // this is about a full disk, not the teaching step
    await play(page);
    await jamStorage(page);

    // four answers with the disk full
    for(let i = 0; i < 4; i++){ await answer(page, true); await page.waitForTimeout(280); }
    const s = await page.evaluate(() => ({
      done: window.__144.sitting().done,
      watts: window.__144.state.power.watts,
      onScreen: !!document.querySelector('#play.on'),
      orbs: document.querySelectorAll('.orb').length}));
    expect(s.done, 'the level stopped counting when the disk filled').toBeGreaterThanOrEqual(4);
    expect(s.watts).toBeGreaterThan(0);
    expect(s.onScreen).toBe(true);
    expect(s.orbs).toBeGreaterThan(0);              // still playable
    expect(errorsOf(page)).toEqual([]);
  });

  test('when the disk frees up, everything she did is written at once', async ({page}) => {
    await open(page);
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });
    await alreadyMet(page);            // this is about a full disk, not the teaching step
    await play(page);
    await jamStorage(page);
    for(let i = 0; i < 5; i++){ await answer(page, true); await page.waitForTimeout(280); }
    const inMemory = await page.evaluate(() => window.__144.state.power.watts);

    await page.evaluate(() => window.__unjam());
    await answer(page, true);                        // one more answer, disk working again
    await page.waitForTimeout(320);

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('144.v1')));
    expect(stored.power.watts, 'the evening was lost rather than caught up')
      .toBeGreaterThanOrEqual(inMemory);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a failed write does not let a later one clobber another window', async ({page}) => {
    // The nasty interaction: if `rev` advanced on a write that never landed, this
    // window would think it was ahead of storage and stop merging — so a stale
    // window plus a full disk would quietly eat her progress.
    await open(page);
    await page.evaluate(() => { window.__144.state.power.watts = 10; window.__144.save(); });
    await jamStorage(page);
    // several writes that all fail
    await page.evaluate(() => { for(let i = 0; i < 5; i++){
      window.__144.state.power.watts += 1; window.__144.save(); } });
    await page.evaluate(() => window.__unjam());

    // meanwhile another window banked a real evening, which we never heard about
    await page.evaluate(() => {
      const newer = JSON.parse(localStorage.getItem('144.v1'));
      newer.rev += 1; newer.power.watts = 500; newer.prog.cleared = 9;
      localStorage.setItem('144.v1', JSON.stringify(newer));
    });
    await page.evaluate(() => { window.__144.state.set.sound = false; window.__144.save(); });

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('144.v1')));
    expect(stored.power.watts, 'a failed write let this window clobber the other').toBe(500);
    expect(stored.prog.cleared).toBe(9);
  });

});

/* Site data turned off altogether.
   The full-disk tests above cover a localStorage that REFUSES WRITES. This is the
   other shape of the same problem and the one a ten-year-old is more likely to meet:
   a phone where a grown-up has blocked cookies and site data, or a private window.
   There, touching `localStorage` at all throws a SecurityError — on the very first
   read, at boot, before any of the write guards get a say.

   Everything the app does with storage is already inside a try/catch, including the
   property access itself, so this passes today. It is guarded because the app is one
   file with no build step: a new read added at boot, or a `try` moved by one line,
   would turn a playable evening into a blank screen and nothing else would notice. */
test.describe('a phone with site data switched off', () => {

  const blocked = async page => page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get(){ throw new DOMException('The operation is insecure.', 'SecurityError'); }
    });
  });

  test('it still opens, still teaches, and she can still play a round', async ({page}) => {
    const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if(m.type() === 'error' && !/Failed to load resource/i.test(m.text()))
      errs.push('console: ' + m.text()); });
    await blocked(page);
    await page.goto(APP);
    await page.waitForTimeout(500);

    expect(await page.evaluate(() => !!window.__144),
      'the app did not come up at all with site data blocked').toBe(true);
    expect(await page.evaluate(() => {
      const app = document.getElementById('app');
      return app ? app.children.length : 0;
    }), 'she is looking at a blank screen').toBeGreaterThan(0);

    // into a level, through the teaching step, and answer one
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });
    await page.click('#nowlevel');
    await page.waitForTimeout(300);
    if(await page.evaluate(() => window.__144.meeting())){
      await page.evaluate(() => window.__144.skipMeet());
      await page.waitForTimeout(500);
    }
    expect(await page.evaluate(() => document.querySelectorAll('.orb').length),
      'no answers to tap').toBeGreaterThan(1);
    expect(await page.evaluate(() => window.__144.answer(true)),
      'her answer did not land').toBe(true);
    await page.waitForTimeout(400);
    const s = await page.evaluate(() => ({done: window.__144.sitting().done,
      watts: window.__144.state.power.watts}));
    expect(s.done, 'the level did not count her answer').toBeGreaterThan(0);
    expect(s.watts, 'she earned nothing for it').toBeGreaterThan(0);

    // the one thing that IS allowed to fail is saving — silently, never at her
    expect(errs, 'an error reached the console with site data blocked').toEqual([]);
  });

});

test.describe('a clock that jumps', () => {

  test('a day rolling over mid-level does not break it or lose progress', async ({page}) => {
    await open(page, '2026-08-11');
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });
    await page.click('#nowlevel');
    await page.waitForTimeout(200);
    for(let i = 0; i < 3; i++){ await answer(page, true); await page.waitForTimeout(280); }
    const mid = await page.evaluate(() => window.__144.sitting().done);

    // midnight arrives while she is still playing
    await page.evaluate(() => window.__144.setToday('2026-08-12'));
    await page.waitForTimeout(150);
    for(let i = 0; i < 3; i++){ await answer(page, true); await page.waitForTimeout(280); }

    const s = await page.evaluate(() => ({
      done: window.__144.sitting() ? window.__144.sitting().done : null,
      cleared: !!document.querySelector('#clear.on'),
      watts: window.__144.state.power.watts}));
    // either she is still going with her count intact, or the level finished cleanly
    if(s.done !== null) expect(s.done).toBeGreaterThan(mid);
    expect(s.watts).toBeGreaterThan(0);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a clock moved backwards hands out nothing and loses nothing', async ({page}) => {
    await open(page, '2026-08-11');
    await page.evaluate(() => {
      const a = window.__144;
      a.state.prog.placed = true; a.state.power.watts = 300; a.state.prog.cleared = 6;
      a.state.facts['7x8'] = {box:6, right:6, wrong:0, seen:6, last:'2026-08-11'};
      a.save();
    });
    const before = await page.evaluate(() => ({
      w: window.__144.state.power.watts, c: window.__144.state.prog.cleared,
      charge: window.__144.state.power.charge}));

    // the phone's clock goes back a week
    await page.evaluate(() => {
      window.__144.setToday('2026-08-04');
      window.__144.state.power.at = Date.now() + 7 * 24 * 3600 * 1000;   // "at" now in the future
      window.__144.settleCharge();
      window.__144.save();
    });
    const after = await page.evaluate(() => ({
      w: window.__144.state.power.watts, c: window.__144.state.prog.cleared,
      charge: window.__144.state.power.charge,
      box: window.__144.state.facts['7x8'].box}));

    expect(after.w).toBe(before.w);                  // no watts lost…
    expect(after.c).toBe(before.c);                  // …no levels lost…
    expect(after.box).toBe(6);                       // …and no learning rolled back
    expect(after.charge).toBeLessThanOrEqual(100);   // and no free power either
    expect(after.charge).toBeGreaterThanOrEqual(0);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a long jump forwards empties the battery but keeps everything else', async ({page}) => {
    await open(page, '2026-08-11');
    await page.evaluate(() => {
      const a = window.__144;
      a.state.power.watts = 420; a.state.prog.cleared = 11; a.save();
    });
    await page.evaluate(() => {
      window.__144.state.power.at = Date.now() - 60 * 24 * 3600 * 1000;   // two months idle
      window.__144.settleCharge(); window.__144.save();
    });
    const s = await page.evaluate(() => ({
      charge: window.__144.state.power.charge,
      w: window.__144.state.power.watts, c: window.__144.state.prog.cleared}));
    expect(s.charge).toBe(0);                        // flat, as it should be
    expect(s.w).toBe(420);                           // but she keeps what she earned
    expect(s.c).toBe(11);
    expect(errorsOf(page)).toEqual([]);
  });

});
