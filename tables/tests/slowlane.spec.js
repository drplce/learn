// The slow lane, and reading the path.
//
// Both come from David playing it on 2026-08-13:
//
//   "trying to say the full question equals answer is not working — real game play
//    doesn't allow it. So scratch that step. Possibly look at a slower level type
//    which is focused on slow ingestion of question and answer and then we can
//    revert to the faster pace of the other levels."
//
//   "The path is also storing all the completed levels as gold, rather than keeping
//    some identifiable information shape or colour of the level type. Also on the
//    sides of the path (in the negative space) some character or level numbers or
//    something to fill the space."
//
// The slow lane also closes the oldest finding on file: the pacing simulation kept
// saying 144 only ever TESTS a fact and never teaches one.
const {test, expect} = require('@playwright/test');
const {open, errorsOf, answer, alreadyMet} = require('./helpers');

// A learn level with nothing met at all: it has to teach before it asks.
async function untaught(page){
  return page.evaluate(() => {
    const a = window.__144;
    const i = a.LEVELS.findIndex(l => l.kind === 'learn');
    a.state.prog.placed = true; a.state.prog.cleared = i;
    a.state.facts = {};
    a.save();
    a.start(a.LEVELS[i]);
    return {i, facts: a.LEVELS[i].facts.slice()};
  });
}
const look = page => page.evaluate(() => ({
  meeting: window.__144.meeting(),
  prompt: document.getElementById('prompt').innerText.replace(/\s+/g, ' ').trim(),
  orbs: document.querySelectorAll('.orb').length,
  done: window.__144.sitting().done,
  cue: document.getElementById('cue').textContent.toLowerCase()
}));

test.describe('the slow lane', () => {

  test('a brand-new fact is shown whole before it is ever asked', async ({page}) => {
    await open(page);
    await untaught(page);
    await page.waitForTimeout(250);
    const s = await look(page);
    const cur = await page.evaluate(() => {
      const c = window.__144.sitting().cur; return {a:c.a, b:c.b};
    });
    expect(s.meeting, 'it went straight to asking a fact she has never seen').toBe(true);
    expect(s.prompt, 'the answer is not on show').toContain(String(cur.a * cur.b));
    expect(s.orbs, 'there is something to tap at during the slow lane').toBe(0);
    expect(s.cue).toMatch(/look/);
    expect(errorsOf(page)).toEqual([]);
  });

  test('nothing she does during it can count for or against her', async ({page}) => {
    await open(page);
    await untaught(page);
    await page.waitForTimeout(250);
    const before = await page.evaluate(() => ({
      done: window.__144.sitting().done, watts: window.__144.state.power.watts}));
    // a stray tap on the field while she is just looking
    await page.evaluate(() => window.__144.score && window.__144.score(true, 10, 10, null));
    const after = await page.evaluate(() => ({
      done: window.__144.sitting().done, watts: window.__144.state.power.watts}));
    expect(after).toEqual(before);
  });

  test('then it asks the same fact, with the answer taken away', async ({page}) => {
    await open(page);
    await untaught(page);
    await page.waitForTimeout(250);
    const shown = await page.evaluate(() => {
      const c = window.__144.sitting().cur; return {a:c.a, b:c.b};
    });
    await page.evaluate(() => window.__144.skipMeet());
    await page.waitForTimeout(250);
    const s = await look(page);
    const now = await page.evaluate(() => {
      const c = window.__144.sitting().cur; return {a:c.a, b:c.b};
    });
    expect(s.meeting).toBe(false);
    expect([now.a, now.b].sort(), 'it asked a different fact from the one it taught')
      .toEqual([shown.a, shown.b].sort());
    expect(s.prompt, 'the answer is still on screen').not.toContain('=');
    expect(s.orbs, 'nothing to answer with').toBeGreaterThan(2);
  });

  test('a tap moves it along, for when she already knows this one', async ({page}) => {
    await open(page);
    await untaught(page);
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.__144.meeting())).toBe(true);
    await page.click('#field');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__144.meeting()),
      'tapping did not get her past it').toBe(false);
    expect(await page.evaluate(() => document.querySelectorAll('.orb').length))
      .toBeGreaterThan(2);
  });

  test('a fact she has already met is not taught again', async ({page}) => {
    await open(page);
    await page.evaluate(() => {
      const a = window.__144;
      const i = a.LEVELS.findIndex(l => l.kind === 'learn');
      a.state.prog.placed = true; a.state.prog.cleared = i;
      a.state.facts = {};
      a.LEVELS[i].facts.forEach(k => {
        a.state.facts[k] = {box:3, right:3, wrong:0, seen:3, last:a.todayISO()};
      });
      a.save(); a.start(a.LEVELS[i]);
    });
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.__144.meeting()),
      'it stopped to teach her something she already knows').toBe(false);
    expect(await page.evaluate(() => document.querySelectorAll('.orb').length)).toBeGreaterThan(2);
  });

  /* Which facts the slow lane picks, as her record changes underneath it.
     David, 2026-08-13: "Probably not each new fact for the learn level, maybe ones that
     user is finding tricky." `tricky()` is the answer to that, and every test above it
     seeds a fact once and plays one level — so what has never been checked is the part
     that matters: does the choice FOLLOW her, days later, when the same fact has got
     worse or better? A slow lane pinned to a fixed list would look identical on day one
     and be useless by week two. */

  // Put a learn level's facts in a known state on a known day, then play it.
  async function lane(page, seed){
    return page.evaluate(f => {
      const a = window.__144;
      const i = a.LEVELS.findIndex(l => l.kind === 'learn');
      a.state.prog.placed = true; a.state.prog.cleared = i;
      a.state.facts = {};
      const facts = a.LEVELS[i].facts.slice();
      facts.forEach((k, n) => { a.state.facts[k] = Object.assign({}, f.solid); });
      if(f.spoil !== undefined) a.state.facts[facts[f.spoil]] = Object.assign({}, f.state);
      if(f.all) facts.forEach(k => { a.state.facts[k] = Object.assign({}, f.state); });
      a.save(); a.start(a.LEVELS[i]);
      return {facts, spoiled: f.spoil !== undefined ? facts[f.spoil] : null};
    }, seed);
  }
  const laneState = page => page.evaluate(() => {
    const W = window.__144.sitting();
    return {meeting: window.__144.meeting(), meets: W.meets || 0,
            shown: Object.keys(W.metShown || {})};
  });

  test('a fact she has started losing is taught again, days after she first met it',
    async ({page}) => {
      await open(page, '2026-09-01');
      // all four solid, except one she has been dropping: bottom box, missing two in three
      const r = await lane(page, {
        solid: {box:4, right:6, wrong:0, seen:6, last:'2026-08-25'},
        spoil: 2,
        state: {box:2, right:2, wrong:4, seen:6, last:'2026-08-31'}
      });
      await page.waitForTimeout(300);
      expect(await page.evaluate(k => window.__144.tricky(k), r.spoiled),
        'a fact in the bottom box missed two goes in three does not read as tricky').toBe(true);

      /* Play forward until it is taught or the level runs out. The first version of this
         test read `meeting` once, right after the level opened, and so quietly depended on
         the picker drawing the spoiled fact FIRST — about a two-in-five chance. It passed
         four runs in a row and then failed in the full suite. The claim was never about
         draw order: it is that a fact she is losing gets taught again at some point in the
         level, and that is what this now waits for. */
      let taught = null;
      for(let g = 0; g < 60 && !taught; g++){
        const st = await laneState(page);
        if(st.meeting){
          taught = st.shown.indexOf(r.spoiled) >= 0 ? r.spoiled : (st.shown[0] || 'something else');
          await page.evaluate(() => window.__144.skipMeet());
          await page.waitForTimeout(240);
          if(taught === r.spoiled) break;
          taught = null;                       // it taught another one; keep watching
          continue;
        }
        if(!await answer(page, true)){ await page.waitForTimeout(200); continue; }
        await page.waitForTimeout(320);
        if(await page.evaluate(() => !!document.querySelector('#clear.on'))) break;
      }
      expect(taught, 'the fact she is losing was never taught again').toBe(r.spoiled);
      expect(errorsOf(page)).toEqual([]);
    });

  test('a fact she has pulled back is left alone again', async ({page}) => {
    // The same fact, later, after she has got on top of it. The slow lane has to let go
    // as readily as it takes hold, or it becomes a fact she is nagged about for ever.
    await open(page, '2026-09-20');
    const r = await lane(page, {
      solid: {box:4, right:6, wrong:0, seen:6, last:'2026-09-14'},
      spoil: 2,
      /* The miss rate is deliberately STILL above the tricky threshold — 4 of 10, where
         0.34 is the line — and only the box has moved. The first version of this test
         gave it 4 misses in 24, and it passed with the box check deleted, because the
         low rate was doing the work: the test named the box and measured the rate.
         Isolated like this, only the box can carry it.
         (This is also the fact the v1.18 digest flags to David under "counted as known,
         but missed a lot". The two are meant to disagree: the slow lane lets go, and the
         export tells him about it. That is the division of labour, not a contradiction.) */
      state: {box:5, right:6, wrong:4, seen:10, last:'2026-09-19'}
    });
    await page.waitForTimeout(300);
    expect(await page.evaluate(k => window.__144.tricky(k), r.spoiled),
      'a fact she has climbed out of the bottom boxes is still being called tricky').toBe(false);
    expect((await laneState(page)).meeting,
      'it stopped to teach her one she has already pulled back').toBe(false);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a bad week does not turn the whole level into a lecture', async ({page}) => {
    // The cap, under the condition that actually tests it: EVERY fact tricky at once,
    // which is exactly what a rough week looks like. Two teaching moments is a pause;
    // one per fact is the game stopping to talk at her.
    await open(page, '2026-09-10');
    await lane(page, {
      solid: {box:2, right:2, wrong:4, seen:6, last:'2026-09-09'},
      all: true,
      state: {box:2, right:2, wrong:4, seen:6, last:'2026-09-09'}
    });
    await page.waitForTimeout(300);
    const cap = await page.evaluate(() => window.__144.MEETS_PER_LEVEL);
    // play the level right through, skipping each teaching moment as she would
    let meets = 0;
    for(let g = 0; g < 90; g++){
      const st = await page.evaluate(() => ({
        cleared: !!document.querySelector('#clear.on'), meeting: window.__144.meeting()}));
      if(st.cleared) break;
      if(st.meeting){
        meets++;
        await page.evaluate(() => window.__144.skipMeet());
        await page.waitForTimeout(240);
        continue;
      }
      if(!await answer(page, true)){ await page.waitForTimeout(200); continue; }
      await page.waitForTimeout(320);
    }
    expect(meets, `every fact was tricky and it taught ${meets} of them, cap is ${cap}`)
      .toBeLessThanOrEqual(cap);
    expect(meets, 'a level full of tricky facts taught none of them').toBeGreaterThan(0);
    expect(errorsOf(page)).toEqual([]);
  });

  test('with motion turned down it is shorter, not skipped', async ({page}) => {
    await page.emulateMedia({reducedMotion: 'reduce'});
    await open(page);
    await untaught(page);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__144.meeting()),
      'reduced motion skipped the teaching step entirely').toBe(true);
    await page.waitForTimeout(1400);
    expect(await page.evaluate(() => window.__144.meeting()),
      'it never moved on').toBe(false);
  });

});

test.describe('reading the path', () => {

  // Everything visible on the path at a given point of progress.
  async function pathAt(page, cleared){
    await page.evaluate(n => {
      const a = window.__144;
      a.state.prog.placed = true; a.state.prog.cleared = n; a.save(); a.render();
    }, cleared);
    await page.waitForTimeout(250);
    return page.evaluate(() => {
      const nodes = [...document.querySelectorAll('#path .level')];
      const nums = [...document.querySelectorAll('#path .lvlnum')];
      return {
        nodes: nodes.length,
        shapes: nodes.map(b => (b.querySelector('path,circle') || {}).getAttribute
          ? (b.querySelector('path') ? b.querySelector('path').getAttribute('d').slice(0, 12) : 'circle')
          : '?'),
        doneShapes: nodes.filter(b => b.classList.contains('done'))
          .map(b => b.querySelector('path') ? b.querySelector('path').getAttribute('d').slice(0, 12) : 'circle'),
        numbers: nums.map(n => n.textContent),
        // does any number actually collide with its node, or with the wire's beads?
        overlaps: nums.filter((n, i) => {
          const a = n.getBoundingClientRect();
          return nodes.some(b => {
            const r = b.getBoundingClientRect();
            return a.right > r.left && a.left < r.right && a.bottom > r.top && a.top < r.bottom;
          });
        }).map(n => n.textContent)
      };
    });
  }

  test('a finished level still says what kind of work it was', async ({page}) => {
    // They were all turning into the same gold bead, so a month of the path told
    // her nothing about what she had actually done.
    await open(page);
    const p = await pathAt(page, 20);
    expect(p.doneShapes.length).toBeGreaterThan(6);
    const kinds = new Set(p.doneShapes);
    expect(kinds.size, 'every finished level is drawn identically').toBeGreaterThan(2);
    expect(errorsOf(page)).toEqual([]);
  });

  test('the level numbers fill the space beside the path', async ({page}) => {
    await open(page);
    const p = await pathAt(page, 20);
    expect(p.numbers.length, 'no numbers on the path').toBe(p.nodes);
    expect(p.numbers).toContain('21');                 // the level she is on
    expect(p.numbers).toContain('20');
    // out in the margin: never drawn over a node, which is the whole point of
    // putting them in the negative space
    expect(p.overlaps, 'a level number is drawn on top of a node').toEqual([]);
  });

  test('the number for where she is now is the loud one', async ({page}) => {
    await open(page);
    await page.evaluate(() => {
      const a = window.__144;
      a.state.prog.placed = true; a.state.prog.cleared = 20; a.save(); a.render();
    });
    await page.waitForTimeout(250);
    const s = await page.evaluate(() => {
      const now = document.querySelector('#path .lvlnum.now');
      const done = document.querySelector('#path .lvlnum.done');
      const px = e => parseFloat(getComputedStyle(e).fontSize);
      return {nowText: now && now.textContent, nowSize: px(now), doneSize: px(done),
              nowColour: getComputedStyle(now).color};
    });
    expect(s.nowText).toBe('21');
    expect(s.nowSize).toBeGreaterThan(s.doneSize);
    expect(s.nowColour).toBe('rgb(255, 255, 255)');
  });

});
