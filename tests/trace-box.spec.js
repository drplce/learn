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
