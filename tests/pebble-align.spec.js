const {test, expect} = require('@playwright/test');
const {open} = require('./helpers');
/* The progress pebbles are seeded organic blobs, and the current one is scaled up 1.5. If a
   blob's mass sits off the box centre (its own jitter, plus the old y-jitter), that offset is
   invisible on a small grey dot but the 1.5 scale magnified it into a visible DROP when the
   dot filled green — the reported "pebbles move slightly down when green". Each blob is now
   centred by its true bounding box, so every pebble — done, current, upcoming — sits on the
   same line and the scale grows it symmetrically. Measured in viewBox units via getBBox, which
   ignores the CSS scale, so it is the geometry that is checked, not the rendering. */
test('every pebble blob is vertically centred, so none drifts down when it goes green', async ({page}) => {
  await open(page, '2026-08-01');
  await page.evaluate(() => {
    const a = window.__acorn;
    a.state.words.lists = [{id:'w', name:'T',
      words:['went','like','because','friend','thought','through','enough','said','rain']}];
    a.state.words.activeId = 'w';
    a.state.words.mastery = {went:{right:3,wrong:0,box:2,lastSeen:'2026-06-01'},
                             like:{right:3,wrong:0,box:2,lastSeen:'2026-06-01'}};
    a.state.words.sessions = [];
    a.save(); a.go('day'); a.start();
  });
  // Finish a few so the row has done (green), current (green, scaled 1.5) and upcoming (grey).
  await page.evaluate(() => { const a = window.__acorn;
    for(let k = 0; k < 3 && a.session(); k++){ const W = a.session();
      if(W.stage === 'look') a.cover(); a.type(W.words[W.i]); a.check(); a.next(); }
    const W = a.session(); if(W && W.stage === 'look') a.cover(); });
  const rows = await page.evaluate(() => {
    const box = 20;                              // DOT_BOX — the viewBox is 0 0 20 20
    return [...document.querySelectorAll('.dots i')].map(i => {
      const bb = i.querySelector('path').getBBox();     // viewBox coords, ignores the CSS scale
      return { state: i.className || 'grey', centreY: bb.y + bb.height / 2, box };
    });
  });
  expect(rows.length).toBeGreaterThan(4);
  // At least one of each so the guard actually covers the states that were drifting.
  expect(rows.some(r => r.state === 'now')).toBe(true);
  expect(rows.some(r => r.state === 'on')).toBe(true);
  expect(rows.some(r => r.state === 'grey')).toBe(true);
  for(const r of rows){
    expect(Math.abs(r.centreY - r.box / 2),
      `${r.state} pebble centre ${r.centreY.toFixed(2)} is off the box middle (10)`).toBeLessThan(0.15);
  }
});

/* The two-tone dome is the SECOND layer of the pebble and it completes only when she has written
   the word correctly a SECOND time within the SAME sitting (David, 13.29): the from-memory requeue
   she then nails, or any word she gets right twice tonight. It is earned inside the sitting
   (W.corr >= 2), not carried in from long-term mastery — so a review word she gets right once
   tonight does NOT arrive pre-domed. A word collected once is flat accent green; the twice-collected
   one grows the deep rim + lit dome. This is what turns "collected once" and "done again from
   memory" into two different pebbles she can tell apart, on the night it happens. */
test('the lit dome fills only on the second time through, in the same sitting', async ({page}) => {
  await open(page, '2026-08-01');
  const r = await page.evaluate(() => {
    const a = window.__acorn;
    // Two brand-new words: each is shown, then requeued to be written again from memory, so each
    // can reach a second correct go tonight without any long-term mastery in play.
    a.state.words.lists = [{id:'p', name:'T', words:['beautiful','wonderful']}];
    a.state.words.activeId = 'p';
    a.state.words.mastery = {};
    a.state.words.sessions = []; a.save(); a.go('day'); a.start();

    const domeOn = w => {
      const S = a.session();
      const dot = [...document.querySelectorAll('.dots i')].find((_, k) => S.words[k] === w);
      const d = dot && dot.querySelector('.pb-dome');
      return !!d && getComputedStyle(d).display !== 'none';
    };
    const baseFill = w => {
      const S = a.session();
      const dot = [...document.querySelectorAll('.dots i')].find((_, k) => S.words[k] === w);
      return getComputedStyle(dot.querySelector('.pb-base')).fill;
    };

    // Complete every word each time it is asked. Snapshot the dome for "beautiful" the first time
    // it is done (corr 1) and again the second time (corr 2, the from-memory go), then stop while
    // the dots are still on screen.
    let afterFirst = null, afterSecond = null, flatBase = null, rootedBase = null;
    for(let guard = 0; guard < 20 && a.session(); guard++){
      const W = a.session(); const w = W.words[W.i];
      if(W.stage === 'look') a.cover();
      a.type(w); a.check();
      if(w === 'beautiful'){
        if(afterFirst === null){ afterFirst = domeOn('beautiful'); flatBase = baseFill('beautiful'); }
        else { afterSecond = domeOn('beautiful'); rootedBase = baseFill('beautiful'); break; }
      }
      a.next();
    }
    return {afterFirst, afterSecond, deepened: flatBase !== rootedBase};
  });
  expect(r.afterFirst, 'collected once tonight — no dome yet').toBe(false);
  expect(r.afterSecond, 'done a second time tonight — the dome lights').toBe(true);
  expect(r.deepened, 'the rooted pebble takes the deep rim, not the flat green it had first').toBe(true);
});

/* The enlarged "now" pebble marks the word she is on. It used to be chosen by how many words were
   done (dot[done]) — but a miss moves her forward without finishing anything, so the big pebble
   fell behind onto the word she had just left (David spotted it after a repeat). Keyed off the
   current word now, it follows her wherever she is, including back onto an earlier word's own
   pebble when that word comes round again. */
test('the enlarged pebble follows the word she is on, even after a miss', async ({page}) => {
  await open(page, '2026-08-01');
  await page.evaluate(() => {
    const a = window.__acorn;
    a.state.words.lists = [{id:'f', name:'T', words:['because','friend','thought']}];
    a.state.words.activeId = 'f';
    // Review words (box 2) so each is written from memory, no trace step in the way.
    const m = () => ({right:2, wrong:0, box:2, lastSeen:'2026-07-31'});
    a.state.words.mastery = {because:m(), friend:m(), thought:m()};
    a.state.words.sessions = []; a.save(); a.go('day'); a.start();
  });
  const focus = () => page.evaluate(() => {
    const a = window.__acorn, W = a.session();
    const dots = [...document.querySelectorAll('.dots i')];
    const now = dots.findIndex(i => i.classList.contains('now'));
    return {current: W.words[W.i], nowWord: now >= 0 ? W.words[now] : null,
            nowCount: dots.filter(i => i.classList.contains('now')).length};
  });
  // On the first word to start with.
  expect((await focus()).nowWord).toBe('because');
  // Miss "because" -> it re-traces; complete the copy -> she advances to "friend".
  await page.locator('#type').click();
  for(const c of 'becuase') await page.keyboard.press(c);
  await page.keyboard.press('Enter');
  await page.locator('#type').click();
  for(const c of 'because') await page.keyboard.press(c);
  await page.waitForFunction(() =>
    window.__acorn.session().words[window.__acorn.session().i] === 'friend', null, {timeout: 2500});
  const f = await focus();
  expect(f.current).toBe('friend');
  expect(f.nowCount, 'exactly one pebble is the enlarged one').toBe(1);
  expect(f.nowWord, 'the enlarged pebble is stuck behind the word she is on').toBe('friend');
});

/* The pebble greens on SUCCESS, not on arrival (David): the word she is ON stays the faint blob
   (just enlarged) until she spells it right, and only then fills — the fill is a reward animation
   (syncPebbles greens it in over ~half a second WHILE it is still large), so the green is read
   after it settles, not on the instant of the check. So "where she is" and "what she has already
   done" are different colours — an empty pebble she is about to fill, not one that is green before
   she has written a letter. */
test('the pebble she is on stays faint until she spells it — it greens on success', async ({page}) => {
  await open(page, '2026-08-01');
  const before = await page.evaluate(() => {
    const a = window.__acorn;
    a.state.words.lists = [{id:'s', name:'T', words:['because','friend','thought']}];
    a.state.words.activeId = 's';
    const m = () => ({right:2, wrong:0, box:2, lastSeen:'2026-07-31'});   // review: written from memory
    a.state.words.mastery = {because:m(), friend:m(), thought:m()};
    a.state.words.sessions = []; a.save(); a.go('day'); a.start();
    const baseOf = w => {
      const S = a.session();
      const dot = [...document.querySelectorAll('.dots i')].find((_, k) => S.words[k] === w);
      return getComputedStyle(dot.querySelector('.pb-base')).fill;
    };
    const faint = baseOf('thought');        // an unmet word she has not reached: the faint blob
    const onArrival = baseOf('because');     // the word she is ON, before she has written it
    const W = a.session(); if(W.stage === 'look') a.cover();
    a.type('because'); a.check();            // spell it right — the reward fill begins
    return {faint, onArrival};
  });
  expect(before.onArrival, 'the word she is on is still the faint blob before she spells it')
    .toBe(before.faint);
  // Let the reward fill settle, then read the pebble she just won: it is no longer faint.
  const afterSuccess = await page.evaluate(async () => {
    const a = window.__acorn;
    const baseOf = () => {
      const S = a.session();
      const dot = [...document.querySelectorAll('.dots i')].find((_, k) => S.words[k] === 'because');
      return dot && dot.querySelector('.pb-base');
    };
    const base = baseOf();
    if(base) await Promise.all(base.getAnimations().map(an => an.finished.catch(() => {})));
    const settled = baseOf();          // re-query in case a re-render replaced the element
    return settled ? getComputedStyle(settled).fill : '';
  });
  expect(afterSuccess, 'once she spells it right, the pebble fills green').not.toBe(before.faint);
});

/* The reward choreography (David: "one of the main reward features"). Size and fill are independent
   states: on a win the pebble she is on greens (gains `on`) WHILE it is still the large one (keeps
   `now`) — that is the reward, the fill landing on the big pebble. Only when she moves on does it
   lose `now` (shrink) and the next word gain it (grow), so the big pebble hands off. This holds the
   state model that syncPebbles animates; if a win made the pebble small at the instant it greened,
   the fill would never be seen on the large one. */
test('on a win the pebble is large AND green at once, then hands the size off to the next word', async ({page}) => {
  await open(page, '2026-08-01');
  await page.evaluate(() => {
    const a = window.__acorn;
    a.state.words.lists = [{id:'h', name:'T', words:['because','friend','thought']}];
    a.state.words.activeId = 'h';
    const m = () => ({right:2, wrong:0, box:2, lastSeen:'2026-07-31'});
    a.state.words.mastery = {because:m(), friend:m(), thought:m()};
    a.state.words.sessions = []; a.save(); a.go('day'); a.start();
  });
  const cls = () => page.evaluate(() => {
    const a = window.__acorn, S = a.session();
    const at = w => { const d = [...document.querySelectorAll('.dots i')].find((_, k) => S.words[k] === w);
      return d ? d.className : null; };
    return {because: at('because'), friend: at('friend')};
  });
  // Win "because" — at the verdict beat its pebble is both large (now) and green (on).
  await page.evaluate(() => { const a = window.__acorn, W = a.session();
    if(W.stage === 'look') a.cover(); a.type('because'); a.check(); });
  const won = await cls();
  expect(won.because, 'the just-won pebble is still the large one').toContain('now');
  expect(won.because, 'the just-won pebble has filled green').toContain('on');
  // Move on — the big pebble hands off: "because" is green but no longer large; "friend" is large.
  await page.evaluate(() => window.__acorn.next());
  const moved = await cls();
  expect(moved.because, 'the word she left is still green').toContain('on');
  expect(moved.because.split(/\s+/), 'the word she left is no longer the large one').not.toContain('now');
  expect(moved.friend, 'the next word is now the large one').toContain('now');
});
