// Which of the three new-word ceilings actually decides anything.
//
// poolCap() is min(ACQUIRING_CAP, floor(sessionWords() * NEW_SHARE)), and
// newWordsToday() has its own literal ceiling on top of that. Three numbers, and at
// her real session sizes only one of them ever moves the outcome — measured over 60
// simulated days on the easy list:
//
//   ACQUIRING_CAP 3 -> 87.0% first go, 56.3 of 100 known well
//   ACQUIRING_CAP 4 -> 87.0%, 56.3      byte-identical
//   ACQUIRING_CAP 5 -> 87.0%, 56.3      byte-identical
//   ACQUIRING_CAP 2 -> 91.2%, 44.9      slower and easier
//
// Because sessionWords() is 9 when she is flying, floor(9/3) is exactly 3, so the cap
// ties with the share term and can never bind above it. It is a one-way lever: it can
// only ever slow her down. Anyone reaching for ACQUIRING_CAP to speed her up will
// change nothing and conclude the engine ignores them, so this pins the arithmetic.
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
            cap: a.ACQUIRING_CAP};
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
