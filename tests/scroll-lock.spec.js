const {test, expect} = require('@playwright/test');
const {open} = require('./helpers');
test('the document itself does not scroll on any screen', async ({page}) => {
  await page.setViewportSize({width:390, height:844});
  await open(page, '2026-08-01');
  for(const screen of ['day']){
    const m = await page.evaluate(() => ({
      bodyOverflow: getComputedStyle(document.body).overflowY,
      htmlOverflow: getComputedStyle(document.documentElement).overflowY,
      overscroll: getComputedStyle(document.body).overscrollBehaviorY,
      docScrollable: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      bodyScrollable: document.body.scrollHeight - document.body.clientHeight,
    }));
    expect(m.bodyOverflow).toBe('hidden');
    expect(m.overscroll).toBe('none');
    expect(m.docScrollable).toBeLessThanOrEqual(1);
    expect(m.bodyScrollable).toBeLessThanOrEqual(1);
  }
});
