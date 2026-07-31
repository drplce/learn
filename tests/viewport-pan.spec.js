const {test, expect} = require('@playwright/test');
const {open} = require('./helpers');
/* LAY-2c: with the keyboard up iOS can PAN the visual viewport to chase the caret, and
   with the body pinned (position:fixed) that pan gets stuck — the write box ends up shoved
   off the top until a keyboard hide/show jolts it back (reported: "the first one was almost
   all the way off... then hiding and pulling up the keyboard again moved the box"). fitViewport
   cancels it: when visualViewport.offsetTop > 0 on a word, the root gets [data-panned] and
   --vvtop, and #app is translated back down onto the visible region. Playwright can't make iOS
   pan, so we shadow offsetTop and assert the compensation wiring — it must fire on the word
   screen and stay OFF everywhere else (a stray transform there would move screens that never
   pan). */
function stubPan(px){
  // Shadow the read-only offsetTop on the live visualViewport, then run fitViewport the way a
  // real pan does — through the resize listener the app is already wired to.
  Object.defineProperty(window.visualViewport, 'offsetTop', {get(){ return px; }, configurable:true});
  window.visualViewport.dispatchEvent(new Event('resize'));
}
test('a stuck visual-viewport pan on a word is cancelled by translating the app back', async ({page}) => {
  await page.setViewportSize({width:375, height:667});
  await open(page, '2026-08-01');
  await page.evaluate(() => { const a=window.__acorn;
    a.state.words.lists=[{id:'w',name:'T',words:['because']}]; a.state.words.activeId='w';
    a.state.words.mastery={because:{right:0,wrong:0,box:1,lastSeen:''}};
    a.state.words.sessions=[]; a.save(); a.go('day'); a.start(); });
  await page.waitForTimeout(150);
  // Baseline: no pan → no compensation, whatever the app is doing normally.
  const before = await page.evaluate(() => ({
    panned: document.documentElement.hasAttribute('data-panned'),
    transform: getComputedStyle(document.querySelector('#app')).transform,
  }));
  expect(before.panned).toBe(false);
  expect(before.transform === 'none' || before.transform === 'matrix(1, 0, 0, 1, 0, 0)').toBeTruthy();
  // Now iOS pans the visual viewport 180px down and it sticks.
  const after = await page.evaluate((fn) => { eval('(' + fn + ')')(180);
    const cs = getComputedStyle(document.querySelector('#app'));
    return { panned: document.documentElement.hasAttribute('data-panned'),
             vvtop: document.documentElement.style.getPropertyValue('--vvtop'),
             transform: cs.transform };
  }, stubPan.toString());
  expect(after.panned).toBe(true);
  expect(after.vvtop).toBe('180px');
  // #app is pushed back down by exactly the pan — the last cell of the 2D matrix is +180.
  expect(after.transform).toMatch(/matrix\(1, 0, 0, 1, 0, 180\)/);
});
test('the same pan on the grown-ups screen moves nothing', async ({page}) => {
  await page.setViewportSize({width:375, height:667});
  await open(page, '2026-08-01');
  await page.evaluate(() => { window.__acorn.go('parent'); });
  await page.waitForTimeout(150);
  const after = await page.evaluate((fn) => { eval('(' + fn + ')')(180);
    const cs = getComputedStyle(document.querySelector('#app'));
    return { panned: document.documentElement.hasAttribute('data-panned'), transform: cs.transform };
  }, stubPan.toString());
  expect(after.panned).toBe(false);   // not a word — never compensate
  expect(after.transform === 'none' || after.transform === 'matrix(1, 0, 0, 1, 0, 0)').toBeTruthy();
});
