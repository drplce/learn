const {test, expect} = require('@playwright/test');
const {open} = require('./helpers');
const dir = '/tmp/claude-0/-home-user-learn/b08bd8ab-bc53-5856-9718-4d30bd04e0a5/scratchpad/';
/* The write screen carries no instruction line at all any more (WIN-4: "no other text").
   She hears the word when it appears and a tap replays it; the spoken cue still tells her,
   through the live region, to listen then write. This used to differ by word type — a cold
   review word ("Listen, then write it.") vs a just-traced new word (nothing) — and now both
   are silent on screen. The spoken announcement is unchanged and is checked in speech tests. */
async function note(page){
  return page.evaluate(() => {
    const n = document.querySelector('.above .note');
    return n ? n.textContent.trim() : null;
  });
}
test('a cold review word shows no instruction line either (WIN-4)', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await open(page, '2026-08-01');
  await page.evaluate(() => {
    const a = window.__acorn;
    a.state.words.lists=[{id:'w',name:'T',words:['friend']}];
    a.state.words.activeId='w';
    a.state.words.mastery={friend:{right:3,wrong:0,box:2,lastSeen:'2026-06-01'}};
    a.state.words.sessions=[]; a.save(); a.go('day'); a.start();
  });
  expect(await page.locator('.spellin').count()).toBe(1);   // straight to write (cold review)
  expect(await page.locator('.tracew').count()).toBe(0);
  expect(await note(page)).toBeNull();                       // no "Listen, then write it." any more
  await page.screenshot({path:dir+'write-review.png'});
});
test('a just-traced new word writes with no instruction line', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await open(page, '2026-08-01');
  await page.evaluate(() => {
    const a = window.__acorn;
    a.state.words.lists=[{id:'w',name:'T',words:['banana']}];
    a.state.words.activeId='w'; a.state.words.mastery={}; a.state.words.sessions=[];
    a.save(); a.go('day'); a.start();
  });
  await page.locator('#type').click().catch(()=>{});
  await page.keyboard.type('banana', {delay:8});
  await page.waitForTimeout(750);
  expect(await page.locator('.spellin').count()).toBe(1);
  expect(await note(page)).toBeNull();
  await page.screenshot({path:dir+'write-new.png'});
});
