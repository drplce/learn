// The two pace levers a grown-up can move: newMax (new words on a flying day) and
// newMin (on a hard one). The wiring is deliberately defaults-preserving — at newMax 3,
// newMin 0 the engine behaves exactly as it did before the levers existed, which is what
// keeps tests/sim.js byte-for-byte unchanged — so these tests pin both halves: that the
// defaults reproduce the old tiers, and that moving a lever actually moves the intake.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

// Puts her at a chosen recent accuracy by writing sittings she can be judged on — the
// firstTime field is what the pace reads, right-first-go rather than right eventually.
function sessionsAt(right, asked){
  const ss = [];
  for(let i = 0; i < 5; i++)
    ss.push({date: '2026-07-' + (20 + i), asked, right, words: asked,
             firstTime: right, fresh: [], grew: [], slipped: []});
  return ss;
}

// Reads newWordsToday()/poolCap() at a given accuracy and settings, in the page.
async function pace(page, {right, asked, newMax, newMin}){
  return page.evaluate(o => {
    const a = window.__acorn;
    if(o.newMax !== undefined) a.state.settings.newMax = o.newMax;
    if(o.newMin !== undefined) a.state.settings.newMin = o.newMin;
    a.state.words.sessions = o.sessions;
    a.save();
    return {acc: a.recentAccuracy(), words: a.sessionWords(),
            today: a.newWordsToday(), pool: a.poolCap()};
  }, {sessions: (right === null ? [] : sessionsAt(right, asked)),
      newMax, newMin});
}

// Builds a real session and returns how many of its words she has never met — the new
// intake buildSession actually delivered. A list of review words she already knows plus a
// run of unseen ones, at whatever accuracy and settings the caller wants.
async function deliveredNew(page, {right, asked, newMax, newMin}){
  return page.evaluate(o => {
    const a = window.__acorn;
    const review = [], fresh = [];
    for(let i = 0; i < 8; i++) review.push('rev' + i);
    for(let i = 0; i < 12; i++) fresh.push('new' + i);
    a.state.words.lists = [{id: 'w1', name: 'W', words: review.concat(fresh)}];
    a.state.words.activeId = 'w1';
    const m = {};
    // Met, out of the acquiring boxes, and long overdue so they are available as review.
    review.forEach(w => { m[w] = {right: 5, wrong: 0, box: 3, lastSeen: '2026-01-01'}; });
    a.state.words.mastery = m;
    a.state.words.sessions = o.sessions;
    if(o.newMax !== undefined) a.state.settings.newMax = o.newMax;
    if(o.newMin !== undefined) a.state.settings.newMin = o.newMin;
    a.save();
    const out = a.buildSession(a.activeList(), '2026-08-01');
    return out.filter(w => !a.state.words.mastery[w]).length;
  }, {sessions: sessionsAt(right, asked), newMax, newMin});
}

test.describe('the pace levers', () => {

  test('at the defaults, newWordsToday keeps the old 3 / 1 / 0 tiers', async ({page}) => {
    await open(page, '2026-08-01');
    // First night, too-early, flying, middle band, struggling.
    expect((await pace(page, {right: null})).today, 'her first sitting').toBe(3);
    expect((await pace(page, {right: 5, asked: 6})).today, 'too early to judge').toBe(1);
    expect((await pace(page, {right: 19, asked: 20})).today, 'flying').toBe(3);
    expect((await pace(page, {right: 15, asked: 20})).today, 'the sweet spot').toBe(1);
    expect((await pace(page, {right: 11, asked: 20})).today, 'struggling').toBe(0);
  });

  test('at the defaults, poolCap is the same {first 3, flying 3, mid 2, hard 2}', async ({page}) => {
    await open(page, '2026-08-01');
    expect((await pace(page, {right: null})).pool, 'her first night is all new').toBe(3);
    expect((await pace(page, {right: 19, asked: 20})).pool, 'flying').toBe(3);
    expect((await pace(page, {right: 15, asked: 20})).pool, 'the middle band').toBe(2);
    expect((await pace(page, {right: 11, asked: 20})).pool, 'struggling').toBe(2);
  });

  test('lowering newMax to 1 delivers fewer new words in a real sitting', async ({page}) => {
    await open(page, '2026-08-01');
    const atThree = await deliveredNew(page, {right: 19, asked: 20, newMax: 3, newMin: 0});
    const atOne   = await deliveredNew(page, {right: 19, asked: 20, newMax: 1, newMin: 0});
    expect(atThree, 'a flying day at the default ceiling introduces three').toBe(3);
    expect(atOne, 'lowering the ceiling to one cuts the intake').toBe(1);
    expect(atOne).toBeLessThan(atThree);
  });

  test('raising newMin to 2 introduces new words on a night she is struggling', async ({page}) => {
    await open(page, '2026-08-01');
    // Under 70% right first time, the default floor is zero new words.
    const atZero = await deliveredNew(page, {right: 11, asked: 20, newMax: 3, newMin: 0});
    const atTwo  = await deliveredNew(page, {right: 11, asked: 20, newMax: 3, newMin: 2});
    expect(atZero, 'the default consolidates and adds nothing on a hard night').toBe(0);
    expect(atTwo, 'lifting the floor to two keeps some new material coming')
      .toBeGreaterThan(0);
    expect(atTwo).toBeGreaterThan(atZero);
  });

  test('newMin can never sit above newMax — through the buttons', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    // Raise the floor to 2, then drag the ceiling down under it a step at a time.
    await page.locator('[data-newmin="1"]').click();
    await page.locator('[data-newmin="1"]').click();
    expect(await page.evaluate(() => window.__acorn.state.settings.newMin)).toBe(2);
    await page.locator('[data-newmax="-1"]').click();   // 3 -> 2
    await page.locator('[data-newmax="-1"]').click();   // 2 -> 1, floor must follow
    const s = await page.evaluate(() => window.__acorn.state.settings);
    expect(s.newMax, 'the ceiling came down to one').toBe(1);
    expect(s.newMin, 'the floor was dragged down with it').toBe(1);
    expect(s.newMin).toBeLessThanOrEqual(s.newMax);
    // And the + on the floor is disabled once it has reached the ceiling.
    expect(await page.locator('[data-newmin="1"]').isDisabled(),
      'raising the floor above the ceiling is blocked').toBe(true);
  });

  test('newMin can never sit above newMax — through saneSettings', async ({page}) => {
    await open(page, '2026-08-01');
    const r = await page.evaluate(() => {
      const a = window.__acorn;
      return {
        over: a.saneSettings({newMin: 5, newMax: 2}),   // floor past ceiling -> clamped down
        huge: a.saneSettings({newMax: 99, newMin: -4}),
      };
    });
    expect(r.over.newMax).toBe(2);
    expect(r.over.newMin, 'a stored floor above the ceiling is clamped to it').toBe(2);
    expect(r.huge.newMax, 'a huge ceiling is clamped to five').toBe(5);
    expect(r.huge.newMin, 'a negative floor is clamped to nought').toBe(0);
  });

  test('junk in either lever sanitises to the default and never throws', async ({page}) => {
    await open(page, '2026-08-01');
    const r = await page.evaluate(() => {
      const a = window.__acorn;
      // Strings, NaN, fractions, objects — none of it may throw.
      const cases = [
        a.saneSettings({newMax: 'lots', newMin: 'none'}),
        a.saneSettings({newMax: NaN, newMin: NaN}),
        a.saneSettings({newMax: 2.7, newMin: 1.4}),
        a.saneSettings({newMax: null, newMin: undefined}),
        a.saneSettings({newMax: {}, newMin: []}),
      ];
      return cases.map(c => [c.newMax, c.newMin]);
    });
    // Junk falls back to the defaults; a fraction rounds to a whole number in band.
    expect(r[0]).toEqual([3, 0]);
    expect(r[1]).toEqual([3, 0]);
    expect(r[2]).toEqual([3, 1]);
    expect(r[3]).toEqual([3, 0]);
    expect(r[4]).toEqual([3, 0]);
  });

  test('junk arriving through storage sanitises on load without throwing', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => {
      localStorage.setItem('acorn.v1', JSON.stringify({
        settings: {newMax: 'heaps', newMin: 42, tint: 'cream'},
        words: {lists: [], mastery: {}, sessions: []}
      }));
    });
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    const s = await page.evaluate(() => window.__acorn.state.settings);
    expect(s.newMax, 'a junk ceiling loads as the default').toBe(3);
    expect(s.newMin, 'a floor of 42 is clamped into band and under the ceiling').toBe(3);
    expect(s.newMin).toBeLessThanOrEqual(s.newMax);
    expect(errorsOf(page), 'loading corrupt settings threw or logged').toEqual([]);
  });

  test('"Back to recommended" restores 3 and 0', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('[data-newmax="1"]').click();   // 3 -> 4
    await page.locator('[data-newmax="1"]').click();   // 4 -> 5
    await page.locator('[data-newmin="1"]').click();   // 0 -> 1
    expect(await page.evaluate(() => window.__acorn.state.settings.newMax)).toBe(5);
    await page.locator('#paceReset').click();
    const s = await page.evaluate(() => window.__acorn.state.settings);
    expect(s.newMax, 'the ceiling is back to three').toBe(3);
    expect(s.newMin, 'the floor is back to nought').toBe(0);
  });

  test('a change to either lever survives a reload', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('[data-newmax="1"]').click();   // 3 -> 4
    await page.locator('[data-newmin="1"]').click();   // 0 -> 1
    await page.locator('[data-newmin="1"]').click();   // 1 -> 2
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    const s = await page.evaluate(() => window.__acorn.state.settings);
    expect(s.newMax, 'the ceiling was remembered').toBe(4);
    expect(s.newMin, 'the floor was remembered').toBe(2);
  });

  test('every stepper and the reset button is a full 44px target', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    for(const sel of ['[data-newmax="-1"]', '[data-newmax="1"]',
                      '[data-newmin="-1"]', '[data-newmin="1"]', '#paceReset']){
      const box = await page.locator(sel).boundingBox();
      expect(box, `${sel} is missing`).not.toBeNull();
      expect(box.width, `${sel} is under 44px wide`).toBeGreaterThanOrEqual(44);
      expect(box.height, `${sel} is under 44px tall`).toBeGreaterThanOrEqual(44);
    }
  });

  test('the levers render and drive with no page or console error', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('[data-newmax="1"]').click();
    await page.locator('[data-newmin="1"]').click();
    await page.locator('[data-newmax="-1"]').click();
    await page.locator('#paceReset').click();
    expect(errorsOf(page)).toEqual([]);
  });

});
