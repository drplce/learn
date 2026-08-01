// What she is told, and what moves, when she cannot see the screen or cannot take
// the motion.
//
// Four defects, each measured before it was fixed: the finished screen's flourish
// ignored a reduced-motion request; the mark named itself twice on every screen; the
// finished screen announced a total it no longer draws and never the line it leads
// with; and "Look at this letter" pointed at something a screen reader cannot see.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

async function finishASitting(page){
  await page.evaluate(() => {
    const a = window.__acorn;
    a.state.words.activeId = 'easy';
    a.save(); a.go('parent'); a.go('day');
    if(!a.session()) a.start();
    for(let g = 0; g < 90 && a.session(); g++){
      const W = a.session();
      if(W.stage === 'look'){ a.cover(); continue; }
      if(W.stage === 'write'){ a.type(W.words[W.i]); a.check(); a.next(); continue; }
      a.next();
    }
  });
}

const said = page => page.evaluate(() => document.querySelector('#say').textContent.trim());

test.describe('reduced motion', () => {

  test('the flourish is the end state, not the same dance at zero speed', async ({page}) => {
    // Killing transition-duration alone left every delay in place, so the cells
    // still arrived one at a time — fourteen words was 2.8 seconds of popping for
    // someone who asked for no motion. The arrival is driven by the Web Animations
    // API now (a CSS transition on fresh DOM was silently skipped on a fast
    // compositor); arriveMap reads the reduced-motion query itself and creates no
    // animation at all, so there is nothing to run, not a run at zero speed.
    await page.emulateMedia({reducedMotion: 'reduce'});
    await open(page, '2026-08-01');
    await finishASitting(page);
    const running = await page.evaluate(() =>
      [...document.querySelectorAll('#screen .net-cell.arriving')]
        .map(c => c.getAnimations().length));
    expect(running.length, 'nothing was flourishing, so this proves nothing').toBeGreaterThan(0);
    for(const n of running) expect(n, 'a cell is still animating under reduced motion').toBe(0);
    expect(errorsOf(page)).toEqual([]);
  });

  test('and it still plays for everyone else', async ({page}) => {
    await page.emulateMedia({reducedMotion: 'no-preference'});
    await open(page, '2026-08-01');
    await finishASitting(page);
    // The stagger lives in each cell's animation delay now, not a CSS transition-delay.
    const delays = await page.evaluate(() =>
      [...document.querySelectorAll('#screen .net-cell.arriving')]
        .map(c => { const an = c.getAnimations()[0];
                    return an ? an.effect.getTiming().delay : 0; }));  // milliseconds
    expect(delays.length).toBeGreaterThan(1);
    // Staggered, slow and gentle — the thing she practises more to see again.
    expect(Math.max(...delays), 'the flourish stopped being staggered').toBeGreaterThan(150);
  });

});

test.describe('what a screen reader is told', () => {

  test('the mark names itself once, not twice', async ({page}) => {
    await open(page, '2026-08-01');
    // The heading held a labelled <svg role="img">, so the heading took its name
    // from the label and both appeared: "Acorn, heading" then "Acorn, image".
    const marks = await page.evaluate(() => {
      const h = document.querySelector('#wordmark');
      const svg = h.querySelector('svg');
      return {label: h.getAttribute('aria-label'),
              svgHidden: svg.getAttribute('aria-hidden'),
              svgRole: svg.getAttribute('role'),
              svgLabel: svg.getAttribute('aria-label')};
    });
    expect(marks.label).toBe('Acorn');
    expect(marks.svgHidden, 'the drawing inside the heading still announces itself').toBe('true');
    expect(marks.svgRole).toBeNull();
    expect(marks.svgLabel).toBeNull();
  });

  test('and not in capitals, which is what makes it spelled out', async ({page}) => {
    await open(page, '2026-08-01');
    /* The accessible name of rendered text is the transformed text, not the source,
       and .wordmark is uppercase — so a visually-hidden "Acorn" inside it named the
       heading "ACORN", which is what makes a screen reader spell a word out. An
       aria-label is never rendered, so it is immune. It also adds no line boxes to
       a header that is measured for wrapping. */
    const r = await page.evaluate(() => {
      const h = document.querySelector('#wordmark');
      const range = document.createRange();
      range.selectNodeContents(h);
      return {name: h.getAttribute('aria-label'),
              text: h.textContent,
              boxes: [...range.getClientRects()].length};
    });
    expect(r.name).toBe('Acorn');
    expect(r.name).not.toBe(r.name.toUpperCase());
    expect(r.text, 'the name is rendered text again, so text-transform reaches it').toBe('');
    expect(r.boxes, 'the name added line boxes to the header').toBeLessThanOrEqual(1);
  });

  test('the finished screen is not silent, and leads with what tonight did',
    async ({page}) => {
      await open(page, '2026-08-01');
      await finishASitting(page);
      const heard = await said(page);
      // The screen is wordless now (David) — there is no headline to read — but it must not arrive
      // silent for the child who listens: the reward is spoken through the live region, leading
      // with what tonight did.
      expect(heard.length, 'the finished screen arrived silent').toBeGreaterThan(4);
      expect(heard, 'the reward line is not what she hears first')
        .toMatch(/^(\w+ took root tonight|All done|Great effort)/);
      /* The total is still not announced. Read back, the old reasoning did not survive contact
         with the sentence it produced: "Three took root tonight. Every one, first go, Ivy. 0 of
         100 words known well." A perfect evening, and then a nought. The bar and the total came off
         this screen in 9.7 because they read as a target she has not reached rather than as work she
         has done. The picture carries those numbers as its own label — "3 met, 0 known well, 100 in
         all" — so a screen reader still finds them where the sighted child finds the picture. */
      expect(heard, 'a count she cannot see is being read out again').not.toMatch(/known well/);
      expect(errorsOf(page)).toEqual([]);
    });

  test('a dead end is not said twice', async ({page}) => {
    await open(page, '2026-08-01');
    // With nothing to practise the line at the top already is the message, so
    // appending the count would repeat the whole sentence.
    const heard = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'e', name:'Empty', words:[]}];
      a.state.words.activeId = 'e';
      a.state.words.mastery = {};
      a.save(); a.go('parent'); a.go('day');
      return document.querySelector('#say').textContent.trim();
    });
    expect(heard).toMatch(/Ask a grown-up/);
    expect(heard.match(/Ask a grown-up/g).length, `said twice: "${heard}"`).toBe(1);
  });

  test('the letter to look at is named, not pointed at', async ({page}) => {
    await open(page, '2026-08-01');
    // On screen the slipped letter is marked orange in the re-trace (WIN-1). To a screen reader
    // that colour carries nothing — the word is one role=img with a spelled-out label — so the
    // announcement has to NAME the letter rather than point at it.
    const r = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'x', name:'T', words:['said']}];
      a.state.words.activeId = 'x';
      a.save(); a.go('parent'); a.go('day');
      if(!a.session()) a.start();
      if(a.session().stage === 'look') a.cover();
      a.type('sid'); a.check();                       // one letter missing: a
      return {heard: document.querySelector('#say').textContent.trim(),
              marked: !!document.querySelector('#screen .tracew .slip')};
    });
    // The re-trace carries no visible caption any more (David: "ditch the re-trace caption") —
    // the orange slipped letter is the steer she sees. The screen-reader announcement still has
    // to NAME the letter rather than point at it, since "this letter" means nothing read aloud.
    expect(r.marked, 'this attempt was not close enough to mark the slipped letter').toBe(true);
    expect(r.heard, `pointed instead of named: "${r.heard}"`).toMatch(/Look at the letter a\./);
    // Never her own spelling, here or anywhere.
    expect(r.heard).not.toContain('sid');
  });

  test('several letters are read as a list, not a run of commas', async ({page}) => {
    await open(page, '2026-08-01');
    const heard = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'x', name:'T', words:['beautiful']}];
      a.state.words.activeId = 'x';
      a.save(); a.go('parent'); a.go('day');
      if(!a.session()) a.start();
      if(a.session().stage === 'look') a.cover();
      a.type('beatiful'); a.check();
      return document.querySelector('#say').textContent.trim();
    });
    if(/Look at the letters/.test(heard))
      expect(heard, 'a list read aloud needs an "and"').toMatch(/Look at the letters [^.]* and /);
    else
      expect(heard).toMatch(/Look at the letter /);
  });

  test('arriving at a screen puts her on the box or button that moves her on', async ({page}) => {
    // Since 13.0 the trace and write stages are boxes she types into, focused on arrival;
    // the verdict carries her on with a return. A keyboard-only sitting needs no Tabbing:
    // typing the word finishes the trace, typing and return submits, return advances.
    await open(page, '2026-08-01');
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.activeId = 'easy'; a.save(); a.go('parent'); a.go('day');
      if(!a.session()) a.start();
    });
    // Keyboard mode only turns on once Tab has been pressed, and that press moves
    // the focus itself — so render once more afterwards, which is what really
    // happens the moment she does anything.
    await page.keyboard.press('Tab');
    await page.evaluate(() => window.__acorn.go('day'));
    const seen = [];
    for(let step = 0; step < 60; step++){
      const st = await page.evaluate(() => {
        const a = window.__acorn, W = a.session();
        return {stage: W ? W.stage : 'done', focus: (document.activeElement || {}).id || '',
                word: W ? W.words[W.i] : null};
      });
      if(st.stage === 'done') break;
      seen.push([st.stage, st.focus]);
      if(st.stage === 'look'){                    // the trace box: copying the word advances it
        await page.evaluate(() => { const t = document.querySelector('#type'); if(t) t.focus(); });
        await page.keyboard.type(st.word);
        await page.waitForFunction(() => window.__acorn.session()
          && window.__acorn.session().stage !== 'look', null, {timeout: 2000});
      }else if(st.stage === 'write'){
        await page.keyboard.type(st.word);
        await page.keyboard.press('Enter');
      }else{
        await page.keyboard.press('Enter');       // return carries her on from the verdict
      }
    }
    // The two boxes she types into are focused the moment she arrives — no hunt.
    for(const [stage, focus] of seen)
      if(stage === 'look' || stage === 'write')
        expect(focus, `arriving at ${stage}, focus was on "${focus}"`).toBe('type');
    // And keys alone got her all the way through, with no Tabbing.
    expect(await page.evaluate(() => !window.__acorn.session()),
           'keys did not move her all the way through').toBe(true);
    expect(errorsOf(page)).toEqual([]);
  });

  test('nothing on any of her screens is interactive without a name', async ({page}) => {
    await open(page, '2026-08-01');
    const stages = ['look', 'write', 'check', 'done'];
    for(const stage of stages){
      const nameless = await page.evaluate(s => {
        const a = window.__acorn;
        a.state.words.activeId = 'easy'; a.save(); a.go('parent'); a.go('day');
        if(!a.session()) a.start();
        if(s !== 'look' && a.session() && a.session().stage === 'look') a.cover();
        if(s === 'check'){ a.type('zz'); a.check(); }
        if(s === 'done'){
          for(let g = 0; g < 90 && a.session(); g++){
            const W = a.session();
            if(W.stage === 'look'){ a.cover(); continue; }
            if(W.stage === 'write'){ a.type(W.words[W.i]); a.check(); a.next(); continue; }
            a.next();
          }
        }
        return [...document.querySelectorAll('button, input, [role=img]')].filter(e => {
          if(e.closest('[aria-hidden=true]') || e.getAttribute('aria-hidden') === 'true') return false;
          if(e.getAttribute('tabindex') === '-1' && e.tagName === 'INPUT') return false;
          const n = (e.getAttribute('aria-label') || e.textContent || '').trim();
          return !n;
        }).map(e => e.tagName.toLowerCase() + '.' + e.className);
      }, stage);
      expect(nameless, `unnamed on the ${stage} screen`).toEqual([]);
    }
    expect(errorsOf(page)).toEqual([]);
  });

});
