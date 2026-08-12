// 144 — the game she actually plays.
//
// The bar these hold: she can always tell what to do next, a right answer always
// pays, a wrong answer never costs her anything, and nothing on screen ever calls
// her wrong. Everything else is decoration.
const {test, expect} = require('@playwright/test');
const {open, errorsOf, answer, playLevel, seed} = require('./helpers');

test.describe('opening it', () => {

  test('it opens on the path with something to do, and no errors', async ({page}) => {
    await open(page);
    await expect(page.locator('#home')).toHaveClass(/on/);
    // The first thing offered is the check, not a wall of tables.
    expect(await page.locator('#go').innerText()).toMatch(/what you know/i);
    await expect(page.locator('#path .level')).toHaveCount(1);
    expect(errorsOf(page)).toEqual([]);
  });

  test('the path is the 45-day plan: easy tables first, a boss at the end of each', async ({page}) => {
    await open(page);
    const p = await page.evaluate(() => {
      const a = window.__144;
      const acq = a.LEVELS.filter(s => s.phase !== 2);
      return {
        n: a.LEVELS.length,
        acq: acq.length,
        order: a.TABLE_ORDER,
        firstTable: a.LEVELS[0].table,
        bosses: acq.filter(s => s.kind === 'boss').length,
        // every one of the 78 real facts is introduced exactly once
        introduced: acq.filter(s => s.kind === 'learn')
                       .reduce((s, x) => s.concat(x.facts), []),
      };
    });
    expect(p.order[0]).toBe(2);                       // an anchor table, not the 7s
    expect(p.firstTable).toBe(2);
    expect(p.bosses).toBe(12);                        // one per table, in acquisition
    expect(p.introduced.length).toBe(78);             // 12x12 is 144 cells but 78 facts
    expect(new Set(p.introduced).size).toBe(78);      // and none twice
    expect(p.acq).toBeGreaterThan(40);
  });

  test('the path does not dead-end: there is a phase 2 to carry the rest of the year', async ({page}) => {
    // tests/sim.js caught her replaying the last boss for a hundred days once
    // acquisition ran out — about three weeks in, at two sittings a day — while
    // nothing new ever stuck. The ladder has to outlast the plan.
    await open(page);
    const p = await page.evaluate(() => {
      const a = window.__144;
      const acq = a.LEVELS.filter(s => s.phase !== 2);
      const rev = a.LEVELS.filter(s => s.phase === 2);
      return {acq: acq.length, rev: rev.length, total: a.LEVELS.length,
              // review draws on everything, so the weak-first picker can reach any fact
              widest: Math.max.apply(null, rev.map(s => s.facts.length)),
              kinds: [...new Set(rev.map(s => s.kind))].sort()};
    });
    // the plan is 142 days at ~2 sessions a day: the path must have that many levels
    expect(p.total).toBeGreaterThanOrEqual(284);
    expect(p.rev).toBeGreaterThan(p.acq);
    expect(p.widest).toBe(78);                        // review can reach every fact
    // mix, boss, and filling the gap — the three kinds of work, no NEW mechanics
    expect(p.kinds).toEqual(['boss', 'mix', 'recall']);
  });

});

test.describe('the look of it', () => {

  test('the path carries no words at all — a level is a shape and a light', async ({page}) => {
    await open(page);
    await page.evaluate(() => { window.__144.state.prog.cleared = 6;
      window.__144.state.prog.placed = true; window.__144.render(); });
    await page.waitForTimeout(200);
    const txt = (await page.locator('#path').innerText()).replace(/\s+/g, '');
    expect(txt).toBe('');                              // not a label, not a number, nothing
    // and it is still readable to something that cannot see: every node is named
    const named = await page.evaluate(() => [...document.querySelectorAll('#path .level')]
      .every(b => (b.getAttribute('aria-label') || '').length > 0));
    expect(named).toBe(true);
    expect(await page.locator('#path .level').count()).toBeGreaterThan(4);
    expect(errorsOf(page)).toEqual([]);
  });

  test('the path meanders instead of running straight down', async ({page}) => {
    await open(page);
    await page.evaluate(() => { window.__144.state.prog.cleared = 6;
      window.__144.state.prog.placed = true; window.__144.render(); });
    await page.waitForTimeout(200);
    const xs = await page.evaluate(() => [...document.querySelectorAll('#path .level')]
      .map(b => Math.round(b.getBoundingClientRect().left)));
    expect(new Set(xs).size).toBeGreaterThan(2);       // not one column
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(60);
    // and the wire is drawn through them
    expect(await page.locator('#wire .seg').count()).toBeGreaterThan(3);
  });

  test('every bubble in a round is the same colour, and the colour changes as rounds climb', async ({page}) => {
    await open(page);
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });
    await page.click('#go');
    await page.waitForTimeout(250);
    const read = () => page.evaluate(() => {
      const orbs = [...document.querySelectorAll('.orb')];
      return {colours: [...new Set(orbs.map(o => getComputedStyle(o).borderTopColor))],
              round: window.__144.sitting().round,
              inside: getComputedStyle(orbs[0]).backgroundImage};
    });
    const r1 = await read();
    // one colour for the whole round: colour can never hint at the right answer
    expect(r1.colours.length).toBe(1);
    // dark inside, lit outside — a ring, not a filled tile
    expect(r1.inside).toMatch(/radial-gradient/);

    for(let i = 0; i < 5; i++){ await answer(page, true); await page.waitForTimeout(280); }
    const r2 = await read();
    expect(r2.round).toBeGreaterThan(r1.round);
    expect(r2.colours.length).toBe(1);                 // still one colour…
    expect(r2.colours[0]).not.toBe(r1.colours[0]);     // …but a different one
  });

  test('the bubbles are round', async ({page}) => {
    await open(page);
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });
    await page.click('#go');
    await page.waitForTimeout(250);
    const s = await page.evaluate(() => {
      const o = document.querySelector('.orb'), c = getComputedStyle(o);
      const r = o.getBoundingClientRect();
      return {radius: c.borderRadius, w: Math.round(r.width), h: Math.round(r.height)};
    });
    expect(s.radius).toMatch(/50%/);
    expect(s.w).toBe(s.h);                             // a circle, not a rounded square
    expect(s.w).toBeGreaterThanOrEqual(48);            // still a comfortable tap target
  });

  test('on the smallest phone the sum and the bubbles share one screen', async ({page}) => {
    // On an iPhone SE the sum sat at the top of the screen and the bubbles rose
    // from the bottom, with half a screen of nothing between them — her eyes had
    // to travel the whole phone to play. And a bubble grazed the right edge.
    await page.setViewportSize({width: 375, height: 667});
    // Both motion settings. With motion OFF the bubbles never rise, so wherever
    // they spawn is where she reads them — that layout has to hold too, and it is
    // also the deterministic one to measure.
    for(const motion of ['no-preference', 'reduce']){
      await page.emulateMedia({reducedMotion: motion});
      await open(page);
      await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });
      await page.click('#go');
      await page.waitForTimeout(120);
      if(motion !== 'reduce'){
        // Wait for the bubbles to have actually started climbing rather than for a
        // stopwatch — on a loaded machine the frame loop can be starved, and then
        // this measures a moment that never reaches her eyes.
        await page.evaluate(() => { window.__spawnTop = Math.min(
          ...[...document.querySelectorAll('.orb')].map(o => o.getBoundingClientRect().top)); });
        await page.waitForFunction(() => {
          const os = [...document.querySelectorAll('.orb')];
          if(!os.length) return false;
          return Math.min(...os.map(o => o.getBoundingClientRect().top)) <= window.__spawnTop - 30;
        }, null, {timeout: 4000});
      }
      const s = await page.evaluate(() => {
        const f = document.getElementById('field').getBoundingClientRect();
        const p = document.getElementById('prompt').getBoundingClientRect();
        const orbs = [...document.querySelectorAll('.orb')].map(o => o.getBoundingClientRect());
        return {fh: f.height, still: matchMedia('(prefers-reduced-motion: reduce)').matches,
          inField: p.top >= f.top && p.bottom <= f.bottom,
          gap: Math.min(...orbs.map(o => o.top)) - p.bottom,
          inset: Math.min(...orbs.map(o => Math.min(o.left - f.left, f.right - o.right)))};
      });
      expect(s.still, 'the motion setting did not take').toBe(motion === 'reduce');
      expect(s.inField, `[${motion}] the sum is not over the play area`).toBe(true);
      expect(s.gap, `[${motion}] a void opened up between the sum and the bubbles`)
        .toBeLessThan(s.fh * 0.35);
      expect(s.gap, `[${motion}] the sum and the bubbles overlap`).toBeGreaterThan(0);
      expect(s.inset, `[${motion}] a bubble is grazing the edge of the phone`)
        .toBeGreaterThanOrEqual(12);
    }
  });

});

test.describe('the first-open check', () => {

  test('it asks each fact once — a miss moves on instead of asking again', async ({page}) => {
    await open(page);
    await page.click('#go');
    await page.waitForTimeout(150);
    const goal = await page.evaluate(() => window.__144.sitting().goal);
    // get every single one wrong: it must still end after exactly `goal` answers
    const n = await playLevel(page, {wrongEvery: 1});
    expect(n).toBe(goal);
    expect(await page.evaluate(() => window.__144.state.prog.placed)).toBe(true);
    expect(errorsOf(page)).toEqual([]);
  });

  test('what she gets right starts high, what she misses starts low', async ({page}) => {
    await open(page);
    await page.click('#go');
    await page.waitForTimeout(150);
    await playLevel(page);                                  // all correct
    const boxes = await page.evaluate(() =>
      Object.keys(window.__144.state.facts).map(k => window.__144.state.facts[k].box));
    expect(boxes.length).toBeGreaterThan(10);
    // A right answer in the check is evidence she owns it, so it does not have to
    // climb from box 1 — that is the whole reason for asking before teaching.
    expect(Math.min(...boxes)).toBeGreaterThanOrEqual(4);
  });

  test('the check is never the thing standing between her and playing', async ({page}) => {
    await open(page);
    const cue = await page.evaluate(() => {
      window.__144.start(window.__144.placementLevel());
      return document.getElementById('cue').textContent;
    });
    expect(cue).toMatch(/nothing to get wrong/i);
  });

});

test.describe('playing a level', () => {

  test('clearing one moves her along the path and lights it up', async ({page}) => {
    await open(page);
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });
    const before = await page.evaluate(() => window.__144.levelIndex());
    await page.click('#go');
    await page.waitForTimeout(200);
    await playLevel(page);
    await expect(page.locator('#clear')).toHaveClass(/on/);
    const after = await page.evaluate(() => window.__144.levelIndex());
    expect(after).toBe(before + 1);
    await page.click('#clearHome');
    await page.waitForTimeout(300);
    await expect(page.locator('#path .level.done')).not.toHaveCount(0);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a right answer pays, and a wrong answer costs her nothing', async ({page}) => {
    await open(page);
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });
    await page.click('#go');
    await page.waitForTimeout(200);
    await answer(page, true);
    await page.waitForTimeout(300);
    const afterRight = await page.evaluate(() => ({
      w: window.__144.state.power.watts, c: window.__144.state.power.charge}));
    expect(afterRight.w).toBeGreaterThan(0);

    await answer(page, false);
    await page.waitForTimeout(300);
    const afterWrong = await page.evaluate(() => ({
      w: window.__144.state.power.watts, c: window.__144.state.power.charge}));
    // Never a penalty. The streak resets — that is the only thing a miss costs.
    expect(afterWrong.w).toBe(afterRight.w);
    expect(afterWrong.c).toBe(afterRight.c);
    expect(await page.evaluate(() => window.__144.sitting().combo)).toBe(0);
  });

  test('a miss keeps the same question up rather than skipping it', async ({page}) => {
    await open(page);
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });
    await page.click('#go');
    await page.waitForTimeout(200);
    const q1 = await page.evaluate(() => window.__144.sitting().cur.k);
    await answer(page, false);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.__144.sitting().cur.k)).toBe(q1);
  });

  test('the wrong answers offered are the mistakes she would really make', async ({page}) => {
    await open(page);
    const d = await page.evaluate(() => window.__144.distractors(6, 7, 3));
    expect(d).not.toContain(42);                       // never the right one
    expect(d.every(v => v > 0 && v <= 200)).toBe(true);
    expect(new Set(d).size).toBe(3);                   // no repeats
    // near-misses, not random noise: everything within a table-step of the answer
    expect(d.every(v => Math.abs(v - 42) <= 12)).toBe(true);
  });

  test('a streak builds a multiplier, and the jackpot pays extra', async ({page}) => {
    await open(page);
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });
    await page.click('#go');
    await page.waitForTimeout(200);
    for(let i = 0; i < 5; i++){ await answer(page, true); await page.waitForTimeout(300); }
    const s = await page.evaluate(() => ({combo: window.__144.sitting().combo,
      lbl: document.getElementById('combolbl').textContent,
      on: document.getElementById('combolbl').classList.contains('on')}));
    expect(s.combo).toBeGreaterThanOrEqual(4);
    expect(s.on).toBe(true);
    expect(s.lbl).toMatch(/COMBO ×\d/);
  });

  test('it starts gentle and speeds up as the rounds climb', async ({page}) => {
    await open(page);
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });
    await page.click('#go');
    await page.waitForTimeout(200);
    const early = await page.evaluate(() => document.querySelectorAll('.orb').length);
    expect(early).toBe(3);                             // fewer choices while she finds her feet
    // The ramp has to arrive inside a single level, so it steps every 4 answers.
    for(let i = 0; i < 5; i++){ await answer(page, true); await page.waitForTimeout(280); }
    const later = await page.evaluate(() => ({orbs: document.querySelectorAll('.orb').length,
      round: window.__144.sitting().round}));
    expect(later.round).toBeGreaterThan(1);
    expect(later.orbs).toBe(4);
  });

});

test.describe('what the app remembers', () => {

  test('a fact is one fact: 7x8 and 8x7 light up together', async ({page}) => {
    await open(page);
    await seed(page, {'7x8': {box: 6, right: 6}});
    await page.evaluate(() => window.__144.go('power'));
    await page.waitForTimeout(300);
    const cells = await page.evaluate(() => {
      const c = [...document.querySelectorAll('#grid .c')];
      // 13 wide: row r, col c is index r*13 + c
      return {a: c[7 * 13 + 8].className, b: c[8 * 13 + 7].className,
              at: c[7 * 13 + 8].textContent, bt: c[8 * 13 + 7].textContent};
    });
    expect(cells.at).toBe('56');
    expect(cells.bt).toBe('56');
    expect(cells.a).toMatch(/lv3/);                    // mastered
    expect(cells.b).toMatch(/lv3/);                    // and so is its mirror
  });

  test('the grid is all 144, and counts what she knows', async ({page}) => {
    await open(page);
    await page.evaluate(() => window.__144.go('power'));
    await expect(page.locator('#grid .c:not(.hd)')).toHaveCount(144);
    expect(await page.locator('#knownN').innerText()).toBe('0');
    await seed(page, {'6x7': {box: 5}, '8x9': {box: 6}});
    await page.evaluate(() => window.__144.render());
    await page.waitForTimeout(200);
    // two facts known, four cells lit (each mirrors)
    expect(await page.locator('#knownN').innerText()).toBe('4');
  });

  test('progress survives a reload', async ({page}) => {
    await open(page);
    await seed(page, {'6x7': {box: 5}});
    await page.evaluate(() => { window.__144.state.power.watts = 321;
      window.__144.state.prog.cleared = 3; window.__144.state.buddy.shell = 'magenta';
      window.__144.save(); });
    await page.reload();
    await page.waitForFunction(() => !!window.__144);
    const s = await page.evaluate(() => ({w: window.__144.state.power.watts,
      cleared: window.__144.state.prog.cleared, shell: window.__144.state.buddy.shell,
      box: window.__144.state.facts['6x7'].box}));
    expect(s).toEqual({w: 321, cleared: 3, shell: 'magenta', box: 5});
  });

  test('junk in storage cannot brick it', async ({page}) => {
    await open(page);
    for(const bad of ['not json', '{}', '[]', 'null',
        JSON.stringify({power: {watts: 'lots', charge: 9e9}, prog: {cleared: -5}, facts: {'99x99': {box: 99}}}),
        JSON.stringify({facts: {'__proto__': {box: 7}, '6x7': {box: 'x'}}, buddy: {shell: 'chartreuse'}})]){
      await page.evaluate(v => localStorage.setItem('144.v1', v), bad);
      await page.reload();
      await page.waitForFunction(() => !!window.__144);
      const s = await page.evaluate(() => ({w: window.__144.state.power.watts,
        c: window.__144.state.power.charge, cleared: window.__144.state.prog.cleared,
        shell: window.__144.state.buddy.shell, keys: Object.keys(window.__144.state.facts),
        onScreen: !!document.querySelector('#home.on')}));
      expect(s.onScreen).toBe(true);                   // she still gets a working app
      expect(s.w).toBeGreaterThanOrEqual(0);
      expect(s.c).toBeGreaterThanOrEqual(0);
      expect(s.c).toBeLessThanOrEqual(100);
      expect(s.cleared).toBeGreaterThanOrEqual(0);
      expect(s.shell).toBe('cyan');                    // an offered colour, not whatever was stored
      expect(s.keys).not.toContain('99x99');           // not a real fact
      expect(s.keys.every(k => /^([1-9]|1[0-2])x([1-9]|1[0-2])$/.test(k))).toBe(true);
    }
    expect(errorsOf(page)).toEqual([]);
  });

});

test.describe('the buddy and its power', () => {

  test('the charge drains across her day and pauses overnight', async ({page}) => {
    await open(page);
    const h = await page.evaluate(() => {
      const w = window.__144.wakingHoursBetween;
      const D = (y, m, d, hh) => new Date(y, m - 1, d, hh, 0, 0).getTime();
      return {
        day:       w(D(2026, 8, 11, 9),  D(2026, 8, 11, 12)),   // 3 waking hours
        overnight: w(D(2026, 8, 11, 20), D(2026, 8, 12, 7)),    // asleep: none
        across:    w(D(2026, 8, 11, 19), D(2026, 8, 12, 8)),    // an hour either side
        backwards: w(D(2026, 8, 11, 12), D(2026, 8, 11, 9)),    // a clock moved back
      };
    });
    expect(h.day).toBeCloseTo(3, 1);
    expect(h.overnight).toBe(0);          // she is never punished for sleeping
    expect(h.across).toBeCloseTo(2, 1);
    expect(h.backwards).toBe(0);          // and never given free power either
  });

  test('a long absence empties the battery but never goes below nothing', async ({page}) => {
    await open(page);
    const c = await page.evaluate(() => {
      const a = window.__144;
      a.state.power.charge = 100;
      a.state.power.at = Date.now() - 40 * 24 * 3600 * 1000;
      a.settleCharge();
      return a.state.power.charge;
    });
    expect(c).toBe(0);
  });

  test('a flat battery is asleep, never sad — and it wakes the moment she plays', async ({page}) => {
    await open(page);
    await page.evaluate(() => { window.__144.state.power.charge = 0; window.__144.render(); });
    const words = (await page.locator('#hud').innerText()).toLowerCase();
    expect(words).not.toMatch(/dead|dying|sad|starv|hungry|miss you|disappoint/);
    await page.evaluate(() => window.__144.go('power'));
    await page.waitForTimeout(200);
    const room = (await page.locator('#power .scroll').innerText()).toLowerCase();
    expect(room).toMatch(/asleep|sleep/);
    expect(room).not.toMatch(/dead|dying|sad|starv|hungry|disappoint/);
  });

  test('it boots up as she climbs, and not before', async ({page}) => {
    await open(page);
    for(const [cleared, stage] of [[0, 0], [14, 0], [15, 1], [29, 1], [30, 2], [45, 3]]){
      const s = await page.evaluate(n => { window.__144.state.prog.cleared = n;
        return window.__144.buddyStage(); }, cleared);
      expect(s, `cleared ${cleared}`).toBe(stage);
    }
    // at level 1 there is no face at all — just the light inside
    await page.evaluate(() => { window.__144.state.prog.cleared = 0; window.__144.go('power'); });
    await page.waitForTimeout(200);
    expect(await page.locator('#bigcube .eye').count()).toBe(0);
    expect(await page.locator('#bigcube .fil').count()).toBe(0);
    expect(await page.locator('#bigcube .glow').count()).toBe(1);
    // and by level 30 the eyes are on
    await page.evaluate(() => { window.__144.state.prog.cleared = 30; window.__144.render(); });
    await page.waitForTimeout(200);
    expect(await page.locator('#bigcube .eye').count()).toBe(2);
  });

  test('the shell colour is hers to pick, and it sticks', async ({page}) => {
    await open(page);
    await page.evaluate(() => window.__144.go('power'));
    await page.waitForTimeout(200);
    await page.click('[data-shell="violet"]');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__144.state.buddy.shell)).toBe('violet');
    await page.reload();
    await page.waitForFunction(() => !!window.__144);
    expect(await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--shell').trim())).toBe('#B15CFF');
  });

  test('she can name it, rename it, and un-name it back to something friendly', async ({page}) => {
    // The one place in the whole app where she types. A name of nothing but
    // spaces used to stick, leaving the heading blank instead of falling back.
    await open(page);
    await page.evaluate(() => window.__144.go('power'));
    await page.waitForTimeout(150);
    const name = () => page.locator('#buddyName').innerText();

    await page.click('#nameit');
    await page.type('#nameinput', '  Zap  ');
    await page.press('#nameinput', 'Enter');
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.__144.state.buddy.name)).toBe('Zap');  // trimmed
    expect(await name()).toBe('Zap');

    // it survives a reload, because it is hers
    await page.reload();
    await page.waitForFunction(() => !!window.__144);
    await page.evaluate(() => window.__144.go('power'));
    await page.waitForTimeout(150);
    expect(await name()).toBe('Zap');

    // and clearing it hands back the friendly default, not a blank line
    await page.click('#nameit');
    await page.fill('#nameinput', '   ');
    await page.press('#nameinput', 'Enter');
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.__144.state.buddy.name)).toBe('');
    expect((await name()).trim()).toBe('buddy');
    expect(errorsOf(page)).toEqual([]);
  });

  test('a name is shown as her words, never run as markup', async ({page}) => {
    await open(page);
    await page.evaluate(() => window.__144.go('power'));
    await page.waitForTimeout(150);
    await page.click('#nameit');
    await page.fill('#nameinput', '<b>hi</b>');
    await page.press('#nameinput', 'Enter');
    await page.waitForTimeout(150);
    expect(await page.locator('#buddyName').innerText()).toBe('<b>hi</b>');
    expect(await page.locator('#buddyName b').count()).toBe(0);
  });

  test('the naming field is not hidden under a software keyboard', async ({page}) => {
    // The keyboard covers roughly the bottom 45% of an iPhone. The field must sit
    // above that line when it opens, or she types blind. (Whether the *document*
    // gets pushed up cannot be tested here — no headless browser opens a real
    // keyboard — so that one is handled defensively in the blur handler.)
    await page.setViewportSize({width: 375, height: 667});
    await open(page);
    await page.evaluate(() => window.__144.go('power'));
    await page.waitForTimeout(150);
    await page.click('#nameit');
    await page.waitForTimeout(150);
    const r = await page.evaluate(() => {
      const b = document.getElementById('nameinput').getBoundingClientRect();
      return {bottom: b.bottom, h: innerHeight, on: document.activeElement.id};
    });
    expect(r.on, 'tapping "name it" did not put the cursor in the field').toBe('nameinput');
    expect(r.bottom, 'the field opens under where the keyboard will be')
      .toBeLessThan(r.h * 0.55);
  });

});

test.describe('sound', () => {

  test('it can be muted, and the choice is remembered', async ({page}) => {
    await open(page);
    expect(await page.evaluate(() => window.__144.state.set.sound)).toBe(true);
    await page.click('#soundbtn');
    expect(await page.evaluate(() => window.__144.state.set.sound)).toBe(false);
    await page.reload();
    await page.waitForFunction(() => !!window.__144);
    expect(await page.evaluate(() => window.__144.state.set.sound)).toBe(false);
    expect(await page.locator('#soundbtn').innerText()).toBe('🔇');
  });

});

test.describe('the words she reads', () => {

  test('nothing calls her wrong, failed, or bad at this', async ({page}) => {
    await open(page);
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });
    const seen = [];
    seen.push(await page.locator('#home').innerText());
    await page.click('#go');
    await page.waitForTimeout(200);
    await answer(page, false);                        // the miss wording
    await page.waitForTimeout(300);
    seen.push(await page.locator('#cue').innerText());
    await answer(page, true);
    await page.waitForTimeout(300);
    seen.push(await page.locator('#cue').innerText());
    await page.evaluate(() => window.__144.go('power'));
    await page.waitForTimeout(200);
    seen.push(await page.locator('#power .scroll').innerText());

    const all = seen.join(' | ').toLowerCase();
    for(const word of ['wrong answer', 'incorrect', 'failed', 'fail', 'bad', 'stupid',
                       'you lose', 'lost', 'error', 'try harder'])
      expect(all, `"${word}" is on her screen`).not.toContain(word);
    // and the miss still tells her something useful
    expect(seen[1].toLowerCase()).toMatch(/not that one|another look|list/);
  });

  test('the app never says "her" — the buddy is just the buddy', async ({page}) => {
    // David, 2026-08-12: "Ditch the word 'her' throughout. Like her buddy should
    // just be buddy." Nothing on screen speaks about her in the third person.
    await open(page);
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });
    const seen = [];
    seen.push(await page.locator('#home').innerText());
    seen.push(await page.locator('#hud').innerText());
    await page.click('#go');
    await page.waitForTimeout(250);
    seen.push(await page.locator('#play').innerText());
    await page.evaluate(() => window.__144.go('power'));
    await page.waitForTimeout(250);
    seen.push(await page.locator('#power .scroll').innerText());
    // the labels a screen reader would speak, too
    seen.push((await page.evaluate(() => [...document.querySelectorAll('[aria-label]')]
      .map(e => e.getAttribute('aria-label')).join(' '))));

    for(const text of seen)
      expect(text, `"her" is on her screen: ${text.slice(0, 80)}`)
        .not.toMatch(/\bher\b|\bhers\b/i);
  });

  test('her name is nowhere in the app', async ({page}) => {
    await open(page);
    // 144 never stores or shows a child's name — only a pet name for the buddy,
    // typed on the device and never leaving it.
    const src = await page.content();
    expect(src.toLowerCase()).not.toMatch(/data-name=|profile\.name/);
    expect(await page.evaluate(() => Object.keys(window.__144.state))).not.toContain('profile');
  });

});
