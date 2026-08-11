// The level-clear card.
//
// It is the moment the whole loop pays off, and it is the one screen that makes
// promises: this many watts, this much charge. If those numbers are not exactly
// what she got, the app is lying to a nine-year-old about the only score she has.
const {test, expect} = require('@playwright/test');
const {open, errorsOf, answer, playLevel} = require('./helpers');

// Get past the placement check and into a real level.
async function intoLevel(page){
  await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });
  await page.click('#go');
  await page.waitForTimeout(200);
}

test.describe('the level-clear card', () => {

  test('the watts on the card are exactly the watts she earned', async ({page}) => {
    await open(page);
    await intoLevel(page);
    const before = await page.evaluate(() => window.__144.state.power.watts);
    await playLevel(page);
    const s = await page.evaluate(() => ({
      shown: Number(document.getElementById('clearWatts').textContent),
      banked: window.__144.state.power.watts,
      on: !!document.querySelector('#clear.on')}));
    expect(s.on, 'the level never cleared').toBe(true);
    expect(s.shown).toBe(s.banked - before);
    expect(s.shown).toBeGreaterThan(0);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a full battery is never promised a charge it cannot take', async ({page}) => {
    // Every right answer asks for 2% and clearing asks for 15%, but a battery at
    // 98% can only take 2. The card must count what landed, not what was asked.
    await open(page);
    await page.evaluate(() => { window.__144.state.power.charge = 98; });
    await intoLevel(page);
    await playLevel(page);
    const s = await page.evaluate(() => ({
      shown: document.getElementById('clearCharge').textContent,
      charge: window.__144.state.power.charge}));
    expect(s.charge).toBe(100);                        // it did fill up
    expect(s.shown, 'the card claimed a charge she never got').not.toMatch(/[1-9]\d%/);
    expect(s.shown).toMatch(/full|^[0-2]%$/);
  });

  test('the charge on the card is the charge the battery actually moved', async ({page}) => {
    await open(page);
    await page.evaluate(() => { window.__144.state.power.charge = 10; });
    await intoLevel(page);
    const before = await page.evaluate(() => window.__144.state.power.charge);
    await playLevel(page);
    const s = await page.evaluate(() => ({
      shown: document.getElementById('clearCharge').textContent,
      charge: window.__144.state.power.charge}));
    const moved = Math.round(s.charge - before);
    expect(Number(s.shown.replace('%',''))).toBe(moved);
  });

  test('“keep going” takes her on, never back to the level she just cleared', async ({page}) => {
    await open(page);
    await intoLevel(page);
    const first = await page.evaluate(() => window.__144.sitting().level);
    await playLevel(page);
    const cleared = await page.evaluate(() => window.__144.state.prog.cleared);
    await page.click('#clearOn');
    await page.waitForTimeout(250);
    const s = await page.evaluate(() => ({
      level: window.__144.sitting().level,
      done: window.__144.sitting().done,
      cleared: window.__144.state.prog.cleared,
      cardGone: !document.querySelector('#clear.on')}));
    expect(s.cardGone, 'the card stayed up over the new level').toBe(true);
    expect(s.cleared, 'clearing was counted twice').toBe(cleared);
    expect(s.done).toBe(0);                            // a fresh level, from the start
    expect(s.level).not.toEqual(first);                // and not the one she just finished
    expect(errorsOf(page)).toEqual([]);
  });

  test('leaving by the path puts the card away', async ({page}) => {
    await open(page);
    await intoLevel(page);
    await playLevel(page);
    await page.click('#clearHome');
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => !!document.querySelector('#clear.on'))).toBe(false);
    expect(await page.evaluate(() => window.__144.screen())).toBe('home');
  });

});
