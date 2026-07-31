const {test, expect} = require('@playwright/test');
const {open} = require('./helpers');
/* The pebble-echo box means "this is where you write", so it frames the trace too — the
   trace is a writing moment (she copies the word into it). Same box as the writing screen,
   drawn from the same seed, holding the same vertical position, so trace -> write is one
   box, not two. The lit-letter guidance rides on top of it. */

async function seedTrace(page, word){
  await page.evaluate(w => {
    const a = window.__acorn;
    a.state.words.lists = [{id:'w', name:'T', words:[w]}];
    a.state.words.activeId = 'w';
    a.state.words.mastery = {};              // never met -> trace/look stage
    a.state.words.sessions = [];
    a.save(); a.go('day'); a.start();
  }, word);
}

test('the trace screen carries the box, drawn behind the letters', async ({page}) => {
  await open(page, '2026-08-01');
  await seedTrace(page, 'because');
  // The look stage is the trace.
  expect(await page.evaluate(() => window.__acorn.session().stage)).toBe('look');
  // The box SVG is present inside .trace, behind the lit letters (the letters paint above it).
  const r = await page.evaluate(() => {
    const trace = document.querySelector('.trace');
    const hair = trace && trace.querySelector('svg.hair path');
    const letters = trace && trace.querySelector('.tracew');
    return {
      hasBox: !!hair,
      lettersAboveBox: letters ? Number(getComputedStyle(letters).zIndex) >= 1 : false,
      lit: !!trace.querySelector('.tracew .now'),   // the letter she is on is still lit
    };
  });
  expect(r.hasBox, 'the trace has no box drawn behind it').toBe(true);
  expect(r.lettersAboveBox, 'the letters would be hidden behind the box fill').toBe(true);
  expect(r.lit, 'the lit-letter guidance was lost').toBe(true);
});

test('the box holds one vertical position from trace to write to check', async ({page}) => {
  await open(page, '2026-08-01');
  await page.setViewportSize({width:375, height:667});
  await seedTrace(page, 'because');
  const mid = sel => page.evaluate(s => {
    const n = document.querySelector(s);
    if(!n) return null;
    const r = n.getBoundingClientRect();
    return Math.round((r.top + r.bottom) / 2);
  }, sel);
  const traceMid = await mid('.trace');
  await page.evaluate(() => { window.__acorn.cover(); window.__acorn.type('becau'); });
  const writeMid = await mid('.spellinwrap');
  await page.evaluate(() => { window.__acorn.type('because'); window.__acorn.check(); });
  const wordMid = await mid('.word');
  // All three within a couple of px — the word never jumps between the stages.
  expect(Math.abs(traceMid - writeMid), `trace ${traceMid} vs write ${writeMid}`).toBeLessThanOrEqual(4);
  expect(Math.abs(writeMid - wordMid), `write ${writeMid} vs word ${wordMid}`).toBeLessThanOrEqual(4);
});

/* The trace box (look) and the writing box (write) are meant to be one box: she copies the
   word into it, then writes it into it. On device the trace box came out ~10px shorter than
   the writing box (an explicit 1.35 line-height on the trace letters vs the input's inherited
   1.7), so the box "grew" on the trace->write flip. They must be the SAME height at every text
   scale — the trace letters now inherit the same line-box the input does. */
test('the trace box and the writing box are the same height at every text scale', async ({page}) => {
  await open(page, '2026-08-01');
  await page.setViewportSize({width:375, height:667});
  for(const scale of [0.9, 1, 1.25, 1.5]){
    const {traceH, writeH} = await page.evaluate(sc => {
      const a = window.__acorn;
      a.state.settings.textScale = sc;
      a.state.words.lists = [{id:'w', name:'T', words:['because']}];
      a.state.words.activeId = 'w';
      a.state.words.mastery = {};
      a.state.words.sessions = [];
      a.save(); a.go('day'); a.start();
      const traceH = document.querySelector('.trace').getBoundingClientRect().height;
      a.cover(); a.type('bec');
      const writeH = document.querySelector('.spellinwrap').getBoundingClientRect().height;
      return {traceH, writeH};
    }, scale);
    // One box, not two — no eye-catching jump on the flip. A pixel of rounding is fine.
    expect(Math.abs(traceH - writeH), `${scale}x: trace ${traceH} vs write ${writeH}`).toBeLessThanOrEqual(2);
  }
});

/* The box edge is an SVG hairline (boxHairPath) whose perimeter points are jittered along
   each edge's outward normal by up to +-amp. With preserveAspectRatio="none" a point sitting
   ON the viewBox boundary lands on the very element edge, where the non-scaling stroke
   straddles it and renders thin/clipped — the reported "right-hand side of the green hairline
   too thin". The viewBox now carries a uniform margin, so no path point reaches the boundary
   and the hairline is one weight all the way round. Same box (seed + viewBox) on both stages. */
test('the box hairline stays inside its viewBox on every edge (no clipped/thin edge)', async ({page}) => {
  await open(page, '2026-08-01');
  await page.setViewportSize({width:375, height:667});
  await seedTrace(page, 'because');
  const check = await page.evaluate(() => {
    function extents(svg){
      const vb = svg.getAttribute('viewBox').split(/\s+/).map(Number);
      const [vx, vy, vw, vh] = vb;
      const nums = svg.querySelector('path').getAttribute('d').match(/-?\d+\.?\d*/g).map(Number);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for(let i = 0; i + 1 < nums.length; i += 2){
        minX = Math.min(minX, nums[i]); maxX = Math.max(maxX, nums[i]);
        minY = Math.min(minY, nums[i+1]); maxY = Math.max(maxY, nums[i+1]);
      }
      // How far inside each boundary the drawn path sits, in viewBox units.
      return {left: minX - vx, right: (vx + vw) - maxX, top: minY - vy, bottom: (vy + vh) - maxY};
    }
    const trace = extents(document.querySelector('.trace svg.hair'));
    return {trace};
  });
  // Every edge inset from the viewBox boundary — with margin to spare over the stroke, so
  // preserveAspectRatio="none" cannot push any edge off the element and thin it.
  for(const side of ['left', 'right', 'top', 'bottom']){
    expect(check.trace[side], `${side} edge overshoots the viewBox (${check.trace[side]})`).toBeGreaterThan(1);
  }
});
