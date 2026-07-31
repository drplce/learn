const {test, expect} = require('@playwright/test');
const {open} = require('./helpers');
const fire = (page, sel) => page.evaluate((sel) => {
  const el = document.querySelector(sel); if(!el) return 'no-el';
  const ev = new Event('touchmove', {bubbles:true, cancelable:true});
  el.dispatchEvent(ev); return ev.defaultPrevented;
}, sel);
test('touch-drag is blocked on the word screen, allowed in scrollable grown-ups', async ({page}) => {
  await page.setViewportSize({width:375, height:667});
  await open(page, '2026-08-01');
  // word screen (write)
  await page.evaluate(() => { const a=window.__acorn;
    a.state.words.lists=[{id:'w',name:'T',words:['friend']}]; a.state.words.activeId='w';
    a.state.words.mastery={friend:{right:3,wrong:0,box:2,lastSeen:'2026-06-01'}}; a.state.words.sessions=[];
    a.save(); a.go('day'); a.start(); });
  await page.waitForTimeout(150);
  console.log('word-screen box:', await fire(page, '.spellin'));   // expect true (blocked)
  console.log('word-screen main:', await fire(page, 'main'));       // expect true (blocked)
  expect(await fire(page, '.spellin')).toBe(true);
  // grown-ups (scrollable)
  await page.evaluate(() => { window.__acorn.state.settings.textScale=1.5; window.__acorn.save(); window.__acorn.go('parent'); });
  await page.waitForTimeout(150);
  const gu = await fire(page, 'main .pw-word, main input, main .sect, main');   // inside scrollable main
  console.log('grownups inner:', gu);
  expect(gu).toBe(false);   // allowed to scroll
});
