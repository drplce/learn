// The buddy, once it is awake.
//
// David, 2026-08-13: "once the buddy is awake - I can see eyes now. The colour locks
// in so can't change colour or name anymore."
//
// The one thing that must not happen: her finding out afterwards. Losing a choice
// she did not know was about to close is exactly the kind of small heartbreak this
// app is not allowed to hand out, so the warning goes on screen while it still is
// a choice.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

async function atLevel(page, cleared){
  await page.evaluate(n => {
    const a = window.__144;
    a.state.prog.placed = true; a.state.prog.cleared = n;
    a.save(); a.go('power');
  }, cleared);
  await page.waitForTimeout(250);
}
const room = page => page.evaluate(() => ({
  stage: window.__144.buddyStage(),
  locked: window.__144.locked(),
  eyes: document.querySelectorAll('#bigcube .eye').length,
  hint: document.getElementById('shellhint').textContent.toLowerCase(),
  swatches: document.querySelectorAll('#shells button').length,
  enabled: [...document.querySelectorAll('#shells button')].filter(b => !b.disabled).length,
  nameBtn: getComputedStyle(document.getElementById('nameit')).display,
  shell: window.__144.state.buddy.shell,
  name: window.__144.state.buddy.name
}));

test.describe('while it is still asleep', () => {

  test('the colour is hers to change, and it says so before it stops being', async ({page}) => {
    await open(page);
    await atLevel(page, 10);                       // stage 0: no face yet
    const r = await room(page);
    expect(r.locked).toBe(false);
    expect(r.eyes).toBe(0);
    expect(r.enabled).toBe(r.swatches);
    expect(r.nameBtn).not.toBe('none');
    // the warning has to be there BEFORE the choice closes
    expect(r.hint, 'nothing warns her that the colour will lock in').toMatch(/lock/);
    expect(errorsOf(page)).toEqual([]);
  });

  test('she can still change it at the stirring stage', async ({page}) => {
    await open(page);
    await atLevel(page, 15);                       // stage 1: a filament, not yet awake
    expect((await room(page)).locked).toBe(false);
    await page.click('[data-shell="violet"]');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__144.state.buddy.shell)).toBe('violet');
  });

});

test.describe('once it wakes up', () => {

  test('the eyes are open and the colour is settled', async ({page}) => {
    await open(page);
    await page.evaluate(() => { window.__144.state.buddy.shell = 'lime'; window.__144.save(); });
    await atLevel(page, 30);                       // stage 2: eyes
    const r = await room(page);
    expect(r.eyes).toBe(2);
    expect(r.locked).toBe(true);
    expect(r.enabled, 'the colours are still on offer after it woke up').toBe(0);
    expect(r.hint).not.toMatch(/lock/);            // no longer a warning, just a fact
    expect(r.shell).toBe('lime');
  });

  test('tapping a colour changes nothing, even if the button is reachable', async ({page}) => {
    // Belt and braces: a stale screen, a fast tap, or a disabled attribute that
    // never made it must not be able to repaint a buddy that has woken up.
    await open(page);
    await page.evaluate(() => { window.__144.state.buddy.shell = 'gold'; window.__144.save(); });
    await atLevel(page, 30);
    await page.evaluate(() => {
      const b = document.querySelector('[data-shell="magenta"]');
      b.disabled = false;                          // as if the lock had been missed
      b.click();
    });
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__144.state.buddy.shell),
      'an awake buddy was repainted').toBe('gold');
  });

  test('the name it was given is the name it keeps', async ({page}) => {
    await open(page);
    await page.evaluate(() => { window.__144.state.buddy.name = 'Zap'; window.__144.save(); });
    await atLevel(page, 30);
    const r = await room(page);
    expect(r.name).toBe('Zap');
    expect(r.nameBtn, 'it still offers to rename an awake buddy').toBe('none');
    // and the naming path itself refuses, however it is reached
    await page.evaluate(() => {
      const i = document.getElementById('nameinput');
      i.classList.add('on'); i.value = 'Something Else';
      i.dispatchEvent(new Event('change'));
    });
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.__144.state.buddy.name),
      'an awake buddy was renamed').toBe('Zap');
  });

  test('nothing about it is unkind', async ({page}) => {
    await open(page);
    await atLevel(page, 30);
    const words = (await page.locator('#power .scroll').innerText()).toLowerCase();
    for(const w of ['too late', 'cannot', "can't", 'sorry', 'locked', 'no longer', 'denied'])
      expect(words, `"${w}" is on her screen`).not.toContain(w);
  });

});
