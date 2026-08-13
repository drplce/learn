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
