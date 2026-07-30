// Which of the new-word ceilings actually decides anything, at the shipped defaults.
//
// The live intake ceiling is now a grown-up setting — settings.newMax, default 3, with
// ACQUIRING_CAP as only its default. poolCap() is
// min(newMax, max(newWordsToday(), floor(sessionWords() * NEW_SHARE))), so at the default
// newMax of 3 it reduces to the old min(3, floor(sessionWords() * NEW_SHARE)) in every
// band and nothing below has moved — measured over 60 simulated days on the easy list:
//
//   newMax 3 -> 87.0% first go, 56.3 of 100 known well   (the default)
//   newMax 4 -> 87.0%, 56.3      byte-identical            at these session sizes
//   newMax 5 -> 87.0%, 56.3      byte-identical
//   newMax 2 -> 91.2%, 44.9      slower and easier
//
// Because sessionWords() is 9 when she is flying, floor(9/3) is exactly 3, so at the
// default the share term ties with the ceiling and raising newMax to 4 or 5 changes
// nothing at her real session sizes — the effect of lifting it is proven in
// tests/pace-settings.spec.js, which drives buildSession rather than the arithmetic. This
// file pins the DEFAULT arithmetic: that newMax at 3 leaves the old mechanic exactly where
// it was, so a change to the wiring that moved the defaults would fail here.
const {test, expect} = require('@playwright/test');
const {open} = require('./helpers');

// Puts her at a chosen recent accuracy by writing sittings she can be judged on.
async function atAccuracy(page, right, asked){
  return page.evaluate(({r, n}) => {
    const a = window.__acorn;
    const sessions = [];
    for(let i = 0; i < 5; i++)
      // firstTime is the field the pace reads: right-first-go, not right eventually.
      sessions.push({date: '2026-07-' + (20 + i), asked: n, right: r, words: n,
                     firstTime: r, fresh: [], grew: [], slipped: []});
    a.state.words.sessions = sessions;
    a.save();
    return {acc: a.recentAccuracy(), words: a.sessionWords(),
            pool: a.poolCap(), today: a.newWordsToday(),
            // The live ceiling is the grown-up setting now; ACQUIRING_CAP is only its
            // default, and at the default they are the same 3.
            cap: a.state.settings.newMax};
  }, {r: right, n: asked});
}

test.describe('the new-word ceilings', () => {

  test('the share of the sitting is what binds, not the cap', async ({page}) => {
    await open(page, '2026-08-01');
    // Flying: 9 words a sitting, so the share term is floor(9/3) = 3, which is the
    // cap exactly. Raising the cap cannot raise the ceiling.
    const flying = await atAccuracy(page, 19, 20);
    expect(flying.acc).toBeGreaterThanOrEqual(0.85);
    expect(flying.words).toBe(9);
    expect(flying.pool).toBe(Math.min(flying.cap, Math.floor(flying.words / 3)));
    expect(flying.pool, 'the cap and the share no longer tie when she is flying')
      .toBe(flying.cap);
  });

  test('in the middle band the share is the only thing holding her back', async ({page}) => {
    await open(page, '2026-08-01');
    // Between .70 and .85: 8 words a sitting, floor(8/3) = 2, well under the cap.
    const mid = await atAccuracy(page, 15, 20);
    expect(mid.acc).toBeGreaterThanOrEqual(0.70);
    expect(mid.acc).toBeLessThan(0.85);
    expect(mid.words).toBe(8);
    expect(mid.pool).toBe(2);
    expect(mid.pool, 'the cap is doing the work here, which it never used to')
      .toBeLessThan(mid.cap);
  });

  test('struggling adds nothing new at all', async ({page}) => {
    await open(page, '2026-08-01');
    const hard = await atAccuracy(page, 11, 20);
    expect(hard.acc).toBeLessThan(0.70);
    expect(hard.today, 'a new word was offered on a day she is struggling').toBe(0);
    // The sitting shrinks too, so what she does get is shorter.
    expect(hard.words).toBe(6);
  });

  test('the ceilings never disagree in a way that lets more through', async ({page}) => {
    // newWordsToday() has its own literal ceiling. Whatever it says, poolCap() is
    // the one buildSession honours, so it must never be the looser of the two.
    await open(page, '2026-08-01');
    for(const [right, asked] of [[19, 20], [15, 20], [11, 20], [20, 20], [0, 20]]){
      const r = await atAccuracy(page, right, asked);
      expect(r.pool, `at ${right}/${asked} the pool cap is above the cap`)
        .toBeLessThanOrEqual(r.cap);
      expect(r.pool).toBeLessThanOrEqual(Math.max(1, Math.floor(r.words / 3)));
    }
  });

  test('her very first sitting is not held to the share at all', async ({page}) => {
    // Nothing is known yet, so a third of it being new is impossible.
    await open(page, '2026-08-01');
    const first = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.sessions = []; a.state.words.mastery = {}; a.save();
      return {pool: a.poolCap(), today: a.newWordsToday(), seed: a.SEED_NEW};
    });
    expect(first.pool).toBe(first.seed);
    expect(first.today).toBe(first.seed);
  });

});
