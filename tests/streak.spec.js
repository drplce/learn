// Streak maths — the part that must be exactly right, because a wrongly
// broken streak is precisely the confidence-killer the app exists to avoid.
const {test, expect} = require('@playwright/test');
const {open} = require('./helpers');

test.describe('streak logic', () => {

  test('consecutive days count one per day', async ({page}) => {
    await open(page, '2026-07-28');
    const info = await page.evaluate(() => {
      const a = window.__acorn;
      return a.streakInfo([{date:'2026-07-26'},{date:'2026-07-27'},{date:'2026-07-28'}], '2026-07-28');
    });
    expect(info.current).toBe(3);
    expect(info.rests).toBe(0);
    expect(info.readToday).toBe(true);
  });

  test('a single missed day is forgiven and counted as a rest day', async ({page}) => {
    await open(page, '2026-07-28');
    // read Sat 25, missed Sun 26, read Mon 27 + Tue 28 -> 3 days read, 1 rest
    const info = await page.evaluate(() => window.__acorn.streakInfo(
      [{date:'2026-07-25'},{date:'2026-07-27'},{date:'2026-07-28'}], '2026-07-28'));
    expect(info.current).toBe(3);
    expect(info.rests).toBe(1);
  });

  test('the streak counts days read, never calendar days spanned', async ({page}) => {
    await open(page, '2026-07-28');
    const info = await page.evaluate(() => window.__acorn.streakInfo(
      [{date:'2026-07-24'},{date:'2026-07-26'},{date:'2026-07-28'}], '2026-07-28'));
    expect(info.current).toBe(3);   // spans 5 calendar days, but only 3 were read
    expect(info.rests).toBe(2);
  });

  test('two missed days in a row ends the run', async ({page}) => {
    await open(page, '2026-07-28');
    const info = await page.evaluate(() => window.__acorn.streakInfo(
      [{date:'2026-07-20'},{date:'2026-07-21'},{date:'2026-07-24'},{date:'2026-07-28'}], '2026-07-28'));
    // 28 is alive; 24 is 4 days earlier (3 missed) so the run stops at 1
    expect(info.current).toBe(1);
  });

  test('not having read yet today does not break the streak', async ({page}) => {
    await open(page, '2026-07-28');
    const info = await page.evaluate(() => window.__acorn.streakInfo(
      [{date:'2026-07-26'},{date:'2026-07-27'}], '2026-07-28'));
    expect(info.alive).toBe(true);
    expect(info.current).toBe(2);
    expect(info.readToday).toBe(false);
  });

  test('one full day missed keeps the streak alive and savable', async ({page}) => {
    await open(page, '2026-07-28');
    // last read 26th; 27th missed; today (28th) not read yet -> still alive
    const info = await page.evaluate(() => window.__acorn.streakInfo(
      [{date:'2026-07-25'},{date:'2026-07-26'}], '2026-07-28'));
    expect(info.alive).toBe(true);
    expect(info.current).toBe(2);
  });

  test('two full days missed reads as a fresh start', async ({page}) => {
    await open(page, '2026-07-28');
    const info = await page.evaluate(() => window.__acorn.streakInfo(
      [{date:'2026-07-24'},{date:'2026-07-25'}], '2026-07-28'));
    expect(info.alive).toBe(false);
    expect(info.current).toBe(0);
  });

  test('an empty log is zero, not an error', async ({page}) => {
    await open(page, '2026-07-28');
    const info = await page.evaluate(() => window.__acorn.streakInfo([], '2026-07-28'));
    expect(info.current).toBe(0);
    expect(info.alive).toBe(false);
  });

  test('duplicate dates in the log count once', async ({page}) => {
    await open(page, '2026-07-28');
    const info = await page.evaluate(() => window.__acorn.streakInfo(
      [{date:'2026-07-28'},{date:'2026-07-28'},{date:'2026-07-27'}], '2026-07-28'));
    expect(info.current).toBe(2);
  });

  test('longest run is found in history and never regresses', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      // a 5-day run in June, then a broken gap, then 2 days now
      const log = ['2026-06-01','2026-06-02','2026-06-03','2026-06-04','2026-06-05',
                   '2026-07-27','2026-07-28'].map(d => ({date:d}));
      return {longest: a.longestRun(log), current: a.streakInfo(log, '2026-07-28').current};
    });
    expect(out.longest).toBe(5);
    expect(out.current).toBe(2);
  });

  test('day difference absorbs a daylight-saving change', async ({page}) => {
    await open(page, '2026-04-06');
    // AEDT -> AEST ends first Sunday of April 2026 (5 April): that local day is 25 hours
    const d = await page.evaluate(() => window.__acorn.dayDiff('2026-04-06', '2026-04-05'));
    expect(d).toBe(1);
  });
});
