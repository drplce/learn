const {test, expect} = require('@playwright/test');
const {open} = require('./helpers');
// The word she memorises must not move vertically between stages: the trace word,
// the write box, and the checked word all sit on one line. Measured, because the
// three are different elements (.tracew / .spellin / .word) laid out separately —
// only the shared .wordscreen grid keeps them aligned, and nothing else would catch
// it drifting.
async function center(page){
  return page.evaluate(() => {
    const e = document.querySelector('.tracew, .spellin, .word, .marked');
    if(!e) return null;
    const r = e.getBoundingClientRect();
    return Math.round(r.top + r.height/2);
  });
}
test('the word holds one vertical position across look, write and check', async ({page}) => {
  await page.setViewportSize({width:390, height:844});
  await open(page, '2026-08-01');
  await page.evaluate(() => {
    const a = window.__acorn;
    a.state.words.lists=[{id:'w',name:'T',words:['banana','cat']}];
    a.state.words.activeId='w'; a.state.words.mastery={}; a.state.words.sessions=[];
    a.save(); a.go('day'); a.start();
  });
  const at = [];
  at.push(await center(page));                       // look / trace
  await page.locator('#type').click().catch(()=>{});
  await page.keyboard.type('banana', {delay:10});
  await page.waitForTimeout(750);                     // out past the 500ms settle
  at.push(await center(page));                        // write box
  await page.locator('#type').click().catch(()=>{});
  await page.keyboard.type('banana', {delay:10});
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  at.push(await center(page));                        // checked word
  const vals = at.filter(v => v != null);
  expect(vals.length).toBe(3);
  expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(4);
});
