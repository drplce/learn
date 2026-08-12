// What she actually gets asked.
//
// The picker is the whole engine as far as she is concerned: the Leitner boxes only
// matter if the questions they imply reach her. This is the test that would have
// caught v1.9's worst defect — the picker scored every fact and took the single
// highest, so over a 78-fact pool it returned FIVE different facts in a thousand
// picks and never asked the other seventy-three all year. Nothing on screen looked
// wrong. She would simply never have been shown most of the table.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

// A believable mid-year state: everything met, boxes spread, and a realistic
// spread of lifetime misses — including facts she has missed many times.
async function midYear(page){
  return page.evaluate(() => {
    const a = window.__144;
    const pool = [];
    for(let x = 1; x <= 12; x++) for(let y = x; y <= 12; y++) pool.push(a.key(x, y));
    pool.forEach((k, i) => {
      a.state.facts[k] = {box: 2 + (i % 5), right: 4 + (i % 7), wrong: i % 9,
                          seen: 8 + (i % 11), last: '2026-08-01'};
    });
    a.save();
    return pool;
  });
}
// Ask the real picker N times over the real pool.
async function draw(page, n){
  return page.evaluate(count => {
    const a = window.__144;
    const pool = [];
    for(let x = 1; x <= 12; x++) for(let y = x; y <= 12; y++) pool.push(a.key(x, y));
    const counts = {}; let backToBack = 0, prev = null;
    for(let i = 0; i < count; i++){
      const k = a.pickFact(pool);
      if(k === prev) backToBack++;
      prev = k;
      counts[k] = (counts[k] || 0) + 1;
    }
    const rate = k => {
      const f = a.state.facts[k];
      return (f.right + f.wrong) ? f.wrong / (f.right + f.wrong) : 0;
    };
    const share = arr => arr.reduce((s, k) => s + (counts[k] || 0), 0) / count;
    return {
      pool: pool.length,
      distinct: Object.keys(counts).length,
      never: pool.filter(k => !counts[k]).length,
      topShare: Math.max(...Object.values(counts)) / count,
      backToBack: backToBack,
      weakShare: share(pool.filter(k => rate(k) >= 0.5)),
      weakPop: pool.filter(k => rate(k) >= 0.5).length / pool.length,
      strongShare: share(pool.filter(k => rate(k) < 0.2)),
      strongPop: pool.filter(k => rate(k) < 0.2).length / pool.length,
      lowBox: share(pool.filter(k => a.state.facts[k].box <= 2)),
      highBox: share(pool.filter(k => a.state.facts[k].box >= 6)),
      lowPop: pool.filter(k => a.state.facts[k].box <= 2).length / pool.length,
      highPop: pool.filter(k => a.state.facts[k].box >= 6).length / pool.length
    };
  }, n);
}

test.describe('what she gets asked', () => {

  test('over a year of review, every fact in the pool actually comes up', async ({page}) => {
    await open(page);
    await midYear(page);
    const d = await draw(page, 2000);
    expect(d.pool).toBe(78);
    expect(d.never, 'facts she would never once be asked').toBe(0);
    expect(d.distinct).toBe(78);
    // and no fact may hog the sitting: one in twelve would already be a lot
    expect(d.topShare, 'one fact is taking over the whole pool').toBeLessThan(0.08);
    expect(errorsOf(page)).toEqual([]);
  });

  test('weak-first is a bias, not a monopoly', async ({page}) => {
    await open(page);
    await midYear(page);
    const d = await draw(page, 2000);
    // Thresholds sit clear of the measured ratios (weak 1.25, strong 0.77, low box
    // 1.37, high box 0.49 over 20,000 draws) so this fails on a real regression
    // rather than on the roll of the dice.
    // the ones she gets wrong come up MORE than their share of the pool…
    expect(d.weakShare / d.weakPop, 'the ones she misses are not favoured')
      .toBeGreaterThan(1.12);
    // …and the ones she owns come up LESS
    expect(d.strongShare / d.strongPop, 'the ones she owns are not stepping aside')
      .toBeLessThan(0.9);
    // same story by box, and more strongly, because that is the readier signal
    expect(d.lowBox / d.lowPop).toBeGreaterThan(1.2);
    expect(d.highBox / d.highPop).toBeLessThan(0.65);
    // but nothing is shut out: a well-known fact still gets asked sometimes
    expect(d.highBox, 'a well-known fact is never revisited').toBeGreaterThan(0.04);
  });

  test('never the same fact twice in a row', async ({page}) => {
    await open(page);
    await midYear(page);
    const d = await draw(page, 1000);
    expect(d.backToBack).toBe(0);
  });

  test('a fact she has never met jumps the queue', async ({page}) => {
    await open(page);
    const share = await page.evaluate(() => {
      const a = window.__144;
      const pool = [];
      for(let x = 1; x <= 12; x++) for(let y = x; y <= 12; y++) pool.push(a.key(x, y));
      // all met and well known, except one she has never seen
      pool.forEach(k => { a.state.facts[k] = {box:6, right:9, wrong:0, seen:9, last:'2026-08-01'}; });
      const fresh = pool[40];
      delete a.state.facts[fresh];
      let hits = 0;
      for(let i = 0; i < 2000; i++) if(a.pickFact(pool) === fresh) hits++;
      return hits / 2000;
    });
    // One fact in 78, so its fair share is 1.3%. Assert the multiple rather than an
    // absolute number: the no-repeats rule caps how often any single fact can come
    // up, so an absolute threshold near the ceiling is a coin-flip, not a check.
    expect(share, 'a fact she has never met is not being prioritised')
      .toBeGreaterThan(5 / 78);
  });

  test('a one-fact pool still works', async ({page}) => {
    // A learn level filtered down to its last unfinished fact, or a gap level with
    // only one met fact: the no-repeats rule must not leave it with nothing to ask.
    await open(page);
    const got = await page.evaluate(() => {
      const a = window.__144;
      const k = a.key(7, 8);
      a.state.facts[k] = {box:2, right:1, wrong:1, seen:2, last:'2026-08-01'};
      return [a.pickFact([k]), a.pickFact([k]), a.pickFact([k])];
    });
    expect(got).toEqual(['7x8', '7x8', '7x8']);
    expect(errorsOf(page)).toEqual([]);
  });

});
