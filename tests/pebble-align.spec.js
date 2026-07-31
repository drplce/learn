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
