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

test.describe('the battery', () => {

  test('a full charge is gone in four waking hours, not twelve', async ({page}) => {
    // David, 2026-08-13: "drain the energy faster, so drains from full in 4hrs".
    // At twelve it sat near full permanently and meant nothing.
    await open(page);
    const r = await page.evaluate(() => {
      const a = window.__144;
      const perHour = 100 / a.BATTERY_HOURS();
      // and end to end: a day away is far more than four waking hours, so flat
      a.state.power.charge = 100;
      a.state.power.at = Date.now() - 24 * 3600 * 1000;
      a.settleCharge();
      const afterADay = a.state.power.charge;
      return {hours: a.BATTERY_HOURS(), perHour, afterADay};
    });
    expect(r.hours).toBe(4);
    expect(r.perHour).toBe(25);                      // a quarter of the battery an hour
    expect(r.afterADay, 'a day away should leave it flat').toBe(0);
  });

  test('a level tops it up, but nowhere near a full tank', async ({page}) => {
    // The other half of the same brief: "lessen the amount of energy given for each
    // round". A finished level used to hand back most of the battery.
    await open(page);
    const per = await page.evaluate(() => ({
      answer: window.__144.CHARGE_PER_ANSWER(),
      level: window.__144.CHARGE_PER_LEVEL(),
      hours: window.__144.BATTERY_HOURS()}));
    expect(per.hours).toBe(4);
    expect(per.answer).toBeLessThan(2);
    expect(per.level).toBeLessThan(15);
    // a whole twelve-answer level puts back well under half the battery
    expect(per.level + per.answer * 12).toBeLessThan(50);
    expect(per.level + per.answer * 12, 'a level does nothing visible to the battery')
      .toBeGreaterThan(10);
  });

  test('a flat battery is still only ever asleep, never a telling-off', async ({page}) => {
    // Draining four times faster means she WILL meet a flat buddy often. That must
    // stay a warm reason to play, never a reprimand.
    await open(page);
    await page.evaluate(() => {
      window.__144.state.power.charge = 0;
      window.__144.state.prog.placed = true;
      window.__144.save(); window.__144.go('power');
    });
    await page.waitForTimeout(250);
    const words = (await page.locator('#power .scroll').innerText()).toLowerCase();
    expect(words).toMatch(/asleep|sleep/);
    for(const w of ['dead', 'dying', 'sad', 'starv', 'hungry', 'you forgot', 'where were you'])
      expect(words, `"${w}" is on her screen`).not.toContain(w);
    expect(errorsOf(page)).toEqual([]);
  });

});

test.describe('the charge, shown as a level', () => {

  // David picked idea 1 from the mockups: the light fills the glass, instead of the
  // single pulsing core that looked the same at 90% as at 9%.
  const read = (page, big) => page.evaluate(isBig => {
    const host = isBig ? document.getElementById('bigcube') : document.getElementById('buddybtn');
    const lvl = host.querySelector('.lvl');
    const box = host.getBoundingClientRect();
    return {
      has: !!lvl,
      fill: lvl ? lvl.getBoundingClientRect().height / box.height : 0,
      pulsing: !!host.querySelector('.glow, .bglow'),
      eyes: host.querySelectorAll('.eye, .beye').length,
      eyeVisible: [...host.querySelectorAll('.eye, .beye')].every(e => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && Number(getComputedStyle(e).opacity) > .5;
      })
    };
  }, big);

  async function atCharge(page, pct){
    await page.evaluate(v => {
      const a = window.__144;
      a.state.prog.placed = true; a.state.prog.cleared = 39;   // awake, eyes open
      a.state.power.charge = v; a.state.power.at = Date.now();
      a.save(); a.render(); a.go('power');
    }, pct);
    await page.waitForTimeout(250);
  }

  test('the light fills the glass in proportion to the charge', async ({page}) => {
    await open(page);
    for(const pct of [100, 60, 25]){
      await atCharge(page, pct);
      const big = await read(page, true), hud = await read(page, false);
      expect(big.has, `no level shown at ${pct}%`).toBe(true);
      expect(big.fill, `the level is wrong at ${pct}%`).toBeCloseTo(pct / 100, 1);
      expect(hud.fill, `the HUD level is wrong at ${pct}%`).toBeCloseTo(pct / 100, 1);
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('the pulsing core is gone — that was the thing it replaced', async ({page}) => {
    await open(page);
    await atCharge(page, 70);
    expect((await read(page, true)).pulsing, 'the old pulsing glow is still there').toBe(false);
    expect((await read(page, false)).pulsing).toBe(false);
  });

  test('a flat battery is dark but never an empty box', async ({page}) => {
    await open(page);
    await atCharge(page, 0);
    const big = await read(page, true);
    expect(big.has, 'a level is drawn at zero').toBe(false);
    // there is still something in there: an ember, so it reads as asleep not broken
    expect(await page.evaluate(() =>
      document.querySelectorAll('#bigcube .emberglow').length)).toBe(1);
  });

  test('the level never swallows its face, and never turns it into plastic', async ({page}) => {
    await open(page);
    await atCharge(page, 100);
    const s = await page.evaluate(() => {
      const host = document.getElementById('bigcube');
      const kids = [...host.children];
      const lvl = host.querySelector('.lvl');
      const eye = host.querySelector('.eye');
      return {
        eyes: host.querySelectorAll('.eye').length,
        // the eyes must be painted after the fill, or a full battery blinds it
        eyeAfterFill: kids.indexOf(eye) > kids.indexOf(lvl),
        // and the fill has to stay see-through, or the buddy goes back to being the
        // pale plastic blob that v1.5 got rid of
        bg: getComputedStyle(lvl).backgroundImage
      };
    });
    expect(s.eyes).toBe(2);
    expect(s.eyeAfterFill, 'the fill is painted over the eyes').toBe(true);
    expect(s.bg, 'the fill is opaque — the buddy is plastic again')
      // Chromium serialises color-mix as `color(srgb r g b / a)`, older syntax as rgba()
      .toMatch(/\/\s*0?\.\d+\)|rgba\([^)]*,\s*0?\.\d+\)|transparent/);
  });

  test('it moves when she plays', async ({page}) => {
    await open(page);
    await atCharge(page, 30);
    const before = (await read(page, true)).fill;
    await page.evaluate(() => {
      const a = window.__144;
      a.state.power.charge += 20; a.render(); a.go('power');
    });
    await page.waitForTimeout(700);                 // it eases, so give it the transition
    expect((await read(page, true)).fill, 'the level did not move').toBeGreaterThan(before + .1);
  });

});

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
