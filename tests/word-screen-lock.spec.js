const {test, expect} = require('@playwright/test');
const {open} = require('./helpers');
/* LAY-2: the word screen never scrolls — main is locked so iOS can't rubber-band/
   drag it with the keyboard up (the reported bug). Safe because LAY-1 made the word
   one deterministic size and the tight shed drops the rest, so the content fits above
   the keyboard with nothing to spare, and the way-on button lives in #act below main.
   The genuinely-long grown-ups screen keeps its scroll. */
test('word screen main is locked and nothing clips at 1.5x on the smallest phone', async ({page}) => {
  await open(page, '2026-08-01');
  await page.setViewportSize({width:375, height:360});      // SE visible area above the keyboard
  await page.evaluate(() => { const a=window.__acorn; a.state.settings.textScale=1.5;
    a.state.words.lists=[{id:'w',name:'T',words:['responsibility']}]; a.state.words.activeId='w';
    a.state.words.mastery={responsibility:{right:3,wrong:0,box:2,lastSeen:'2026-06-01'}};
    a.state.words.sessions=[]; a.save(); a.go('day'); a.start(); });
  await page.waitForTimeout(200);
  await page.locator('#type').click(); for(const c of 'responsibilty') await page.keyboard.press(c);
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  const m = await page.evaluate(() => {
    // A miss re-traces (WIN-1), so the word on this checked screen is in the trace box (.tracew).
    const main = document.querySelector('main'); const word = document.querySelector('.word,.tracew');
    const vh = document.documentElement.clientHeight; const wr = word && word.getBoundingClientRect();
    return { overflowY: getComputedStyle(main).overflowY, overflow: main.scrollHeight - main.clientHeight,
             within: wr ? (wr.top >= -1 && wr.bottom <= vh + 1) : false };
  });
  expect(m.overflowY).toBe('hidden');    // locked — cannot scroll/drag
  expect(m.overflow).toBeLessThanOrEqual(1);   // nothing to scroll
  expect(m.within).toBeTruthy();         // word not clipped
});
test('the long grown-ups screen still scrolls to the bottom', async ({page}) => {
  await page.setViewportSize({width:375, height:667});
  await open(page, '2026-08-01');
  await page.evaluate(() => { window.__acorn.state.settings.textScale=1.5; window.__acorn.save(); window.__acorn.go('parent'); });
  await page.waitForTimeout(200);
  const g = await page.evaluate(() => { const m=document.querySelector('main'); m.scrollTop=1e6;
    return { overflowY:getComputedStyle(m).overflowY, reached:m.scrollTop>100 }; });
  expect(g.overflowY).toBe('auto');
  expect(g.reached).toBeTruthy();
});
