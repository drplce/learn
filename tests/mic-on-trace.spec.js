const {test, expect} = require('@playwright/test');
const {open} = require('./helpers');
// She found the mic key. If she taps it on the TRACE screen (a whole-word insert),
// the "not written by hand" flag must not follow her into the blind write and hand
// back the word she then writes by her own hand — that would make a moment of a
// hand-back on an honest answer, which the written-answer check must never do.
test('a mic tap on the trace does not hand back the later hand-written answer', async ({page}) => {
  await open(page, '2026-08-01');
  await page.evaluate(() => {
    const a = window.__acorn;
    a.state.words.lists=[{id:'w',name:'T',words:['rain']}];
    a.state.words.activeId='w'; a.state.words.mastery={}; a.state.words.sessions=[];
    a.save(); a.go('day'); a.start();
  });
  // mic on the trace: the phone spells it — a whole word in one event, no keydown
  await page.evaluate(() => {
    const box = document.querySelector('#type');
    box.focus(); box.value = 'rain';
    box.dispatchEvent(new InputEvent('input', {inputType:'insertText', data:'rain', bubbles:true}));
  });
  // she traces it by hand, which completes -> blind write
  await page.locator('#type').click().catch(()=>{});
  await page.keyboard.type('rain', {delay:8});
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.__acorn.session().stage)).toBe('write');
  // the flag must be clean going into the write
  expect(await page.evaluate(() => window.__acorn.session().notWritten)).toBeFalsy();
  // she writes it from memory BY HAND and submits
  await page.locator('#type').click().catch(()=>{});
  await page.keyboard.type('rain', {delay:8});
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  // she gets a real result, not a silent hand-back (empty box, no feedback). WIN-5: a
  // plain win shows as the word going green, not a "that's it" line.
  await expect(page.locator('.word.won')).toBeVisible();
  expect(await page.evaluate(() => window.__acorn.mastery('rain').box)).toBe(2);
});
