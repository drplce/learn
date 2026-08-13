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
  await page.click('#nowlevel');
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

  test('OK puts the card away and hands her back to the path', async ({page}) => {
    // It used to say "keep going" and start the next level straight away. David,
    // 2026-08-13: "Rename the keep going to OK and on pressing go back to path. and
    // ditch the button for 'back to path'." The path is the hub now — one way out.
    await open(page);
    await intoLevel(page);
    const first = await page.evaluate(() => window.__144.sitting().level);
    await playLevel(page);
    const cleared = await page.evaluate(() => window.__144.state.prog.cleared);
    expect((await page.locator('#clearOn').innerText()).trim().toLowerCase()).toBe('ok');
    expect(await page.locator('#clearHome').count(), 'the second button is still there').toBe(0);

    await page.click('#clearOn');
    await page.waitForTimeout(300);
    const s = await page.evaluate(() => ({
      screen: window.__144.screen(),
      cardGone: !document.querySelector('#clear.on'),
      cleared: window.__144.state.prog.cleared,
      playing: !!window.__144.sitting() && !!document.querySelector('#play.on')}));
    expect(s.cardGone, 'the card stayed up').toBe(true);
    expect(s.screen, 'OK did not take her back to the path').toBe('home');
    expect(s.playing, 'it started another level instead of letting her choose').toBe(false);
    expect(s.cleared, 'clearing was counted twice').toBe(cleared);
    expect(errorsOf(page)).toEqual([]);
  });

  test('and the next level she starts is the next one, from the beginning', async ({page}) => {
    await open(page);
    await intoLevel(page);
    const first = await page.evaluate(() => window.__144.sitting().level);
    await playLevel(page);
    await page.click('#clearOn');
    await page.waitForTimeout(300);
    await page.click('#nowlevel');
    await page.waitForTimeout(300);
    const s = await page.evaluate(() => ({
      done: window.__144.sitting().done, level: window.__144.sitting().level}));
    expect(s.done).toBe(0);
    expect(s.level).not.toEqual(first);
  });

});
