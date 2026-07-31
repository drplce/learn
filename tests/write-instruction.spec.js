const {test, expect} = require('@playwright/test');
const {open} = require('./helpers');
const dir = '/tmp/claude-0/-home-user-learn/b08bd8ab-bc53-5856-9718-4d30bd04e0a5/scratchpad/';
/* The write screen's instruction. "fresh" in the code means "not yet shown this
   session" — which is a COLD REVIEW word (it goes straight to write), NOT a new one:
   a new word is traced first and so is already in `shown` by the time it is written.
     - cold review word  -> "Listen, then write it."  (she has not seen it; hear it first)
     - just-traced new word -> no line at all          (she just copied it; the box says enough)
   Dropped: "Now write it from memory." on the just-traced word — the same sentence
   every time, over a word she had that second finished tracing. */
async function note(page){
  return page.evaluate(() => {
    const n = document.querySelector('.above .note');
    return n ? n.textContent.trim() : null;
  });
}
test('a cold review word keeps "Listen, then write it"', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await open(page, '2026-08-01');
  await page.evaluate(() => {
    const a = window.__acorn;
    a.state.words.lists=[{id:'w',name:'T',words:['friend']}];
    a.state.words.activeId='w';
    a.state.words.mastery={friend:{right:3,wrong:0,box:2,lastSeen:'2026-06-01'}};
    a.state.words.sessions=[]; a.save(); a.go('day'); a.start();
  });
  expect(await page.locator('.spellin').count()).toBe(1);
  expect(await page.locator('.tracew').count()).toBe(0);
  expect(await note(page)).toBe('Listen, then write it.');
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
  expect(await note(page)).toBeNull();       // "Now write it from memory." is gone
  await page.screenshot({path:dir+'write-new.png'});
});
