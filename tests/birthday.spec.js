// A flower and a greeting on her birthday — only on the day (David).
//
// A once-a-year surprise that sits above her normal screen: a flower blooms,
// "Happy birthday!" is shown and spoken, and a tap clears it. It must light up on
// the day and stay away every other day, and it must never get in the way of the
// spelling app underneath.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

// The boot auto-show is suppressed under automation (navigator.webdriver), so the
// suite is untouched by the fact the real clock may be her birthday. Tests reach
// the greeting through the exposed showBirthday(), on a date they set themselves.
test.describe('her birthday', () => {

  test('a flower and a greeting appear on the day, and it is spoken', async ({page}) => {
    await open(page, '2026-08-05');
    const spoke = await page.evaluate(() => {
      const said = [];
      const real = window.speechSynthesis.speak;
      window.speechSynthesis.speak = u => { said.push(String(u.text)); };
      window.__acorn.showBirthday();
      window.speechSynthesis.speak = real;
      return said;
    });
    await expect(page.locator('#bday')).toHaveCount(1);
    // The flower is drawn, with its eight petals.
    await expect(page.locator('#bday svg.flower')).toHaveCount(1);
    expect(await page.locator('#bday .petal').count()).toBe(8);
    // The words are there, and a screen reader is told what it is (one label, no double).
    expect(await page.locator('#bday .bday-msg').innerText()).toMatch(/happy birthday/i);
    await expect(page.locator('#bday')).toHaveAttribute('role', 'img');
    await expect(page.locator('#bday')).toHaveAttribute('aria-label', 'Happy birthday!');
    // And it was spoken.
    expect(spoke.some(t => /happy birthday/i.test(t))).toBe(true);
    expect(errorsOf(page)).toEqual([]);
  });

  test('it stays away every other day', async ({page}) => {
    await open(page, '2026-08-04');
    expect(await page.evaluate(() => window.__acorn.isBirthday())).toBe(false);
    await page.evaluate(() => window.__acorn.showBirthday());   // a no-op off the day
    await expect(page.locator('#bday')).toHaveCount(0);
    // The day before rolls into the day.
    await page.evaluate(() => window.__acorn.setToday('2026-08-05'));
    expect(await page.evaluate(() => window.__acorn.isBirthday())).toBe(true);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a tap clears it, and her app is there underneath', async ({page}) => {
    await open(page, '2026-08-05');
    // Give her a sitting, so there is a real word screen behind the flower.
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'w1', name:'T', words:['rain','boat','said']}];
      a.state.words.activeId = 'w1'; a.save(); a.go('parent'); a.go('day');
      if(!a.session()) a.start();
      window.__acorn.showBirthday();
    });
    await expect(page.locator('#bday')).toHaveCount(1);
    await page.locator('#bday').click();
    // It fades and is gone, and the word screen is usable.
    await expect(page.locator('#bday')).toHaveCount(0);
    await expect(page.locator('#screen .wordscreen, #screen .net')).not.toHaveCount(0);
    expect(errorsOf(page)).toEqual([]);
  });

  test('showing it twice does not stack two flowers', async ({page}) => {
    await open(page, '2026-08-05');
    await page.evaluate(() => { window.__acorn.showBirthday(); window.__acorn.showBirthday(); });
    await expect(page.locator('#bday')).toHaveCount(1);
    expect(errorsOf(page)).toEqual([]);
  });

});
