// Fill the gap — the level type that cannot be won by elimination.
//
// The bubble game has a secret: with four rising answers, the wrong ones are
// near-misses she can reason against, so what it trains is process-of-elimination
// rather than knowing the fact. This level removes that entirely. The question
// carries the product and hides a factor, the answer is always 1–12, and the pad
// shows the same twelve keys in the same places on every single question — so the
// options carry no information at all. There is nothing to eliminate against.
const {test, expect} = require('@playwright/test');
const {open, errorsOf, answer, playLevel, seed} = require('./helpers');

// Put her on the first fill-the-gap level, with its facts already met.
async function intoGap(page){
  return page.evaluate(() => {
    const a = window.__144;
    const i = a.LEVELS.findIndex(l => l.kind === 'recall');
    a.state.prog.placed = true;
    a.state.prog.cleared = i;
    a.LEVELS[i].facts.forEach(k => {
      a.state.facts[k] = {box:3, right:3, wrong:0, seen:3, last:a.todayISO()};
    });
    a.save();
    a.start(a.LEVELS[i]);
    return {i: i, facts: a.LEVELS[i].facts.slice(), table: a.LEVELS[i].table};
  });
}

test.describe('the ladder', () => {

  test('every set of new facts is followed by filling the gap on the same facts', async ({page}) => {
    await open(page);
    const p = await page.evaluate(() => {
      const L = window.__144.LEVELS;
      let pairs = 0, mismatched = 0, learns = 0;
      for(let i = 0; i < L.length; i++){
        if(L[i].kind !== 'learn') continue;
        learns++;
        const next = L[i+1];
        if(next && next.kind === 'recall'){
          pairs++;
          // the same numbers, or the whole point is lost
          const same = next.facts.length === L[i].facts.length &&
                       next.facts.every(k => L[i].facts.indexOf(k) >= 0);
          if(!same) mismatched++;
        }
      }
      return {learns, pairs, mismatched,
              recall: L.filter(l => l.kind === 'recall').length,
              inPhase2: L.filter(l => l.kind === 'recall' && l.phase === 2).length};
    });
    expect(p.learns).toBeGreaterThan(10);
    expect(p.pairs, 'a set of new facts was not followed by a gap level').toBe(p.learns);
    expect(p.mismatched, 'a gap level drills different numbers from the level before it').toBe(0);
    expect(p.inPhase2, 'the gap work stops when acquisition ends').toBeGreaterThan(20);
  });

  test('it is a short, effortful dose — not another twelve-answer grind', async ({page}) => {
    await open(page);
    const goals = await page.evaluate(() => {
      const a = window.__144;
      const g = k => a.goalOf(a.LEVELS.find(l => l.kind === k));
      return {recall: g('recall'), mix: g('mix'), boss: g('boss')};
    });
    expect(goals.recall).toBeLessThan(goals.mix);
    expect(goals.recall).toBeGreaterThan(5);
  });

});

test.describe('filling the gap', () => {

  test('the question shows the product and hides a factor — and there are no answer bubbles',
    async ({page}) => {
    await open(page);
    const {facts} = await intoGap(page);
    await page.waitForTimeout(250);
    const s = await page.evaluate(() => ({
      prompt: document.getElementById('prompt').innerText.replace(/\s+/g, ' ').trim(),
      gaps: document.querySelectorAll('#prompt .gap').length,
      orbs: document.querySelectorAll('.orb').length,
      padOn: !!document.querySelector('#pad.on'),
      want: window.__144.sitting().cur.want,
      a: window.__144.sitting().cur.a, b: window.__144.sitting().cur.b}));
    expect(s.orbs, 'there are still answers floating up the screen').toBe(0);
    expect(s.padOn).toBe(true);
    expect(s.gaps).toBe(1);
    expect(s.prompt).toContain(String(s.a * s.b));       // the product is the question
    expect(s.prompt).toContain('?');
    expect([s.a, s.b]).toContain(s.want);                // the answer is one of the factors
    expect(s.want).toBeGreaterThanOrEqual(1);
    expect(s.want).toBeLessThanOrEqual(12);
    expect(errorsOf(page)).toEqual([]);
  });

  test('the pad is the same twelve keys every time, so there is nothing to eliminate',
    async ({page}) => {
    await open(page);
    await intoGap(page);
    await page.waitForTimeout(250);
    const read = () => page.evaluate(() => ({
      keys: [...document.querySelectorAll('#pad button')].map(b => b.textContent),
      places: [...document.querySelectorAll('#pad button')]
        .map(b => Math.round(b.getBoundingClientRect().left) + ',' + Math.round(b.getBoundingClientRect().top))}));
    const first = await read();
    expect(first.keys).toEqual(['1','2','3','4','5','6','7','8','9','10','11','12']);
    for(let i = 0; i < 4; i++){ await answer(page, true); await page.waitForTimeout(420); }
    const later = await read();
    expect(later.keys, 'the keys changed between questions').toEqual(first.keys);
    expect(later.places, 'the keys moved between questions').toEqual(first.places);
  });

  test('it asks the gap on both sides across a level', async ({page}) => {
    await open(page);
    await intoGap(page);
    const sides = new Set();
    for(let i = 0; i < 9; i++){
      sides.add(await page.evaluate(() => window.__144.sitting().cur.gapFirst));
      await answer(page, true);
      await page.waitForTimeout(420);
    }
    expect(sides.size, 'the gap is always on the same side').toBe(2);
  });

  test('a right key pays double, because it is the harder ask', async ({page}) => {
    await open(page);
    await intoGap(page);
    await page.waitForTimeout(250);
    const before = await page.evaluate(() => window.__144.state.power.watts);
    await answer(page, true);
    await page.waitForTimeout(420);
    const gained = await page.evaluate(() => window.__144.state.power.watts) - before;
    expect(gained).toBe(2);                              // first answer: combo 1, x1 mult, doubled
    expect(errorsOf(page)).toEqual([]);
  });

  test('a wrong key costs her nothing and leaves the gap open', async ({page}) => {
    await open(page);
    await intoGap(page);
    await page.waitForTimeout(250);
    const before = await page.evaluate(() => ({
      watts: window.__144.state.power.watts,
      done: window.__144.sitting().done,
      want: window.__144.sitting().cur.want}));
    await answer(page, false);
    await page.waitForTimeout(450);
    const after = await page.evaluate(() => ({
      watts: window.__144.state.power.watts,
      done: window.__144.sitting().done,
      want: window.__144.sitting().cur.want,
      padOn: !!document.querySelector('#pad.on'),
      cue: document.getElementById('cue').textContent.toLowerCase()}));
    expect(after.watts, 'a miss took watts off her').toBe(before.watts);
    expect(after.done).toBe(before.done);                 // no progress, but nothing lost
    expect(after.want, 'the question changed after a miss').toBe(before.want);
    expect(after.padOn).toBe(true);
    for(const word of ['wrong', 'incorrect', 'failed', 'bad', 'no!'])
      expect(after.cue).not.toContain(word);
    // and she can still get it: the same question is answerable
    await answer(page, true);
    await page.waitForTimeout(420);
    expect(await page.evaluate(() => window.__144.sitting().done)).toBe(before.done + 1);
  });

  test('it never asks for a factor of a fact she has never met', async ({page}) => {
    await open(page);
    // land on a gap level with NOTHING met, the worst case
    await page.evaluate(() => {
      const a = window.__144;
      const i = a.LEVELS.findIndex(l => l.kind === 'recall');
      a.state.prog.placed = true; a.state.prog.cleared = i;
      a.state.facts = {};                                 // she has met nothing at all
      const facts = a.LEVELS[i].facts;
      // one fact met, the rest unseen
      a.state.facts[facts[0]] = {box:3, right:3, wrong:0, seen:3, last:a.todayISO()};
      a.save(); a.start(a.LEVELS[i]);
    });
    await page.waitForTimeout(250);
    const asked = new Set();
    for(let i = 0; i < 6; i++){
      asked.add(await page.evaluate(() => window.__144.sitting().cur.k));
      await answer(page, true);
      await page.waitForTimeout(420);
    }
    const only = await page.evaluate(() => {
      const a = window.__144;
      return a.LEVELS[a.state.prog.cleared >= 0 ? a.LEVELS.findIndex(l => l.kind === 'recall') : 0].facts[0];
    });
    expect([...asked], 'it asked for a fact she had never seen').toEqual([only]);
    expect(errorsOf(page)).toEqual([]);
  });

  test('finishing it clears the level and puts the pad away', async ({page}) => {
    await open(page);
    await intoGap(page);
    const goal = await page.evaluate(() => window.__144.sitting().goal);
    for(let i = 0; i < goal; i++){ await answer(page, true); await page.waitForTimeout(420); }
    await page.waitForTimeout(600);
    const s = await page.evaluate(() => ({
      cleared: !!document.querySelector('#clear.on'),
      padOn: !!document.querySelector('#pad.on'),
      watts: Number(document.getElementById('clearWatts').textContent)}));
    expect(s.cleared).toBe(true);
    expect(s.padOn, 'the keypad is showing on top of the clear card').toBe(false);
    expect(s.watts).toBeGreaterThan(goal);               // doubled, so more than one each
    expect(errorsOf(page)).toEqual([]);
  });

  test('on the smallest phone the sum sits right above the pad', async ({page}) => {
    // Same trap as the bubble screen had: a question pinned at the top and the
    // input at the bottom leaves a third of the phone empty in between.
    await page.setViewportSize({width: 375, height: 667});
    await open(page);
    await intoGap(page);
    await page.waitForTimeout(300);
    const s = await page.evaluate(() => {
      const pr = document.getElementById('prompt').getBoundingClientRect();
      const pad = document.getElementById('pad').getBoundingClientRect();
      const keys = [...document.querySelectorAll('#pad button')].map(b => b.getBoundingClientRect());
      return {gap: pad.top - pr.bottom, h: innerHeight,
              padBottom: pad.bottom, minKey: Math.min(...keys.map(k => Math.min(k.width, k.height))),
              leftMost: Math.min(...keys.map(k => k.left)),
              rightMost: Math.max(...keys.map(k => k.right))};
    });
    expect(s.gap, 'a void opened up between the sum and the pad').toBeLessThan(s.h * 0.2);
    expect(s.gap).toBeGreaterThan(0);
    expect(s.padBottom, 'the bottom row is off the screen').toBeLessThanOrEqual(s.h);
    expect(s.minKey, 'a key is too small to hit').toBeGreaterThanOrEqual(48);
    expect(s.leftMost).toBeGreaterThanOrEqual(8);
    expect(s.rightMost).toBeLessThanOrEqual(375 - 8);
  });

  test('the gap level looks different on the path — a lime hexagon, not a bead', async ({page}) => {
    await open(page);
    await intoGap(page);
    await page.evaluate(() => window.__144.go('home'));
    await page.waitForTimeout(300);
    const s = await page.evaluate(() => {
      const now = document.querySelector('#path .level.now');
      return {isRecall: now.classList.contains('recall'),
              label: now.getAttribute('aria-label'),
              colour: getComputedStyle(now).borderTopColor,
              btn: document.getElementById('go').innerText.toLowerCase()};
    });
    expect(s.isRecall).toBe(true);
    expect(s.label).toMatch(/gap/i);                     // named, even though wordless on screen
    expect(s.colour).not.toBe('rgb(34, 230, 255)');      // not the cyan of an ordinary level
    expect(s.btn).toContain('gap');
  });

});
