// Watts, and the promise underneath them.
//
// The economy has never had a test. It was measured by hand on 2026-08-20 — 67.5
// watts a level over 14 real levels — and that measurement is in §7 of the routine
// as the figure David needs to price the battery packs he has planned. But nothing
// guarded it, so a change to CHARGE_PER_*, the combo multiplier or the clear bonus
// could silently double or halve what a level is worth and no test would notice.
//
// These are not tests of the constants. They are tests of the two things the house
// rules actually promise about the currency:
//
//   NOTHING SHE DOES CAN TAKE A WATT BACK. "A miss never costs her anything she had
//   earned" is the first line of §3. A currency that can go down is a currency she
//   can be punished with, and this app does not do that.
//
//   A HARD-WON LEVEL IS STILL WORTH WINNING. §6's economy warning is about a reward
//   that stops meaning anything — in both directions. Fluency should pay more, but
//   an evening she fought through must not pay so little that finishing feels
//   pointless.
const {test, expect} = require('@playwright/test');
const {open, errorsOf, answer} = require('./helpers');

const watts = page => page.evaluate(() => window.__144.state.power.watts);

// Play the level on screen, sampling the total after every single action.
async function playSampling(page, {missEvery = 0} = {}){
  const seen = [await watts(page)];
  await page.click('#nowlevel');
  await page.waitForTimeout(240);
  seen.push(await watts(page));
  let n = 0;
  for(let g = 0; g < 120; g++){
    const st = await page.evaluate(() => ({
      cleared: !!document.querySelector('#clear.on'), meeting: window.__144.meeting()}));
    if(st.cleared) break;
    if(st.meeting){
      await page.evaluate(() => window.__144.skipMeet());
      await page.waitForTimeout(250); seen.push(await watts(page)); continue;
    }
    const right = !(missEvery && n % missEvery === 0);
    if(!await answer(page, right)){ await page.waitForTimeout(200); continue; }
    n++;
    await page.waitForTimeout(right ? 320 : 840);
    seen.push(await watts(page));
  }
  await page.waitForTimeout(500);
  const earned = await page.evaluate(() => window.__144.sitting().watts);
  seen.push(await watts(page));
  await page.click('#clearOn');
  await page.waitForTimeout(300);
  seen.push(await watts(page));
  return {seen, earned, answers: n};
}

/* The battery, which is the half of the economy she actually feels.
   `buddy.spec.js` covers the drain RATE and what a level puts back; `clearcard.spec.js`
   covers the card never claiming a charge it did not get. What nothing covered is the
   reason `wakingHoursBetween` exists at all: the battery must not drain while she is
   asleep. It matters more than it sounds. A full charge is gone in four WAKING hours,
   so if the night counted it would be flat before breakfast every single day — she
   would never once open the app to a buddy that was awake, and "flat" would stop
   meaning "it has been a while" and start meaning "it is always like this", which is
   the manipulation §3 forbids. */
test.describe('the battery sleeps when she does', () => {

  // The app's own clock arithmetic, over real timestamps, in local time — which is
  // what the implementation uses.
  const waking = (page, from, to) => page.evaluate(([f, t]) => {
    const at = a => new Date(a[0], a[1] - 1, a[2], a[3], 0, 0).getTime();
    return window.__144.wakingHoursBetween(at(f), at(t));
  }, [from, to]);

  test('a night on the shelf costs it nothing', async ({page}) => {
    await open(page);
    // 8pm to 7am — the whole of the night, by the app's own definition
    expect(await waking(page, [2026, 9, 1, 20], [2026, 9, 2, 7]),
      'the battery drained while she was asleep').toBeCloseTo(0, 5);
    // and a long weekend away is only the waking part of it
    const twoDays = await waking(page, [2026, 9, 4, 20], [2026, 9, 6, 20]);
    expect(twoDays, 'two nights and two days did not count two days').toBeCloseTo(26, 1);
    expect(await waking(page, [2026, 9, 1, 12], [2026, 9, 1, 16]),
      'four hours of an afternoon should be four hours').toBeCloseTo(4, 5);
  });

  test('she can wake up to a buddy that is still awake', async ({page}) => {
    /* The end-to-end version, and the one she would notice. Last thing at night the
       battery is full; by morning it has lost only the hour before bed and the hour
       since getting up — not the eleven in between. If this ever regresses she meets a
       flat buddy every morning of the year. */
    await open(page);
    const morning = await page.evaluate(() => {
      const a = window.__144;
      const bedtime = new Date(2026, 8, 1, 19, 0, 0).getTime();     // 7pm, charged up
      const wakeUp  = new Date(2026, 8, 2, 8, 0, 0).getTime();      // 8am next day
      a.state.power.charge = 100;
      a.state.power.at = bedtime;
      const realNow = Date.now;
      Date.now = () => wakeUp;
      try { a.settleCharge(); } finally { Date.now = realNow; }
      return a.state.power.charge;
    });
    // 1h before bed + 1h after waking = 2 waking hours of a 4-hour battery
    expect(morning, 'the buddy was flat by morning — the night was charged for')
      .toBeCloseTo(50, 0);
    expect(morning).toBeGreaterThan(0);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a long absence empties it and stops there', async ({page}) => {
    /* Only the FLOOR is asserted here. An earlier version also claimed to check the
       ceiling, by setting `charge = 100` and reading it straight back — which tests
       assignment, not the app, and duly passed with the `Math.min(100, ...)` in
       `addCharge` deleted. The ceiling that matters is the one the clear card reports,
       and `clearcard.spec.js` already covers it end to end ("a full battery is never
       promised a charge it cannot take"). Better one assertion that bites than two
       that read well. */
    await open(page);
    const under = await page.evaluate(() => {
      const a = window.__144;
      a.state.power.charge = 1;
      a.state.power.at = Date.now() - 40 * 3600 * 1000;             // days of waking hours
      a.settleCharge();
      return a.state.power.charge;
    });
    expect(under, 'the battery went below empty').toBeGreaterThanOrEqual(0);
    expect(under, 'a long absence did not flatten it').toBe(0);
  });

});

test.describe('the currency', () => {

  test('nothing she does can take a watt back', async ({page}) => {
    test.setTimeout(180000);
    await open(page);
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });

    // a level with plenty of misses in it, sampled after every action
    const r = await playSampling(page, {missEvery: 3});
    for(let i = 1; i < r.seen.length; i++)
      expect(r.seen[i], `the total fell from ${r.seen[i - 1]} to ${r.seen[i]} at step ${i}`)
        .toBeGreaterThanOrEqual(r.seen[i - 1]);
    expect(r.seen[r.seen.length - 1], 'a whole level earned nothing')
      .toBeGreaterThan(r.seen[0]);

    // a dial entry she backs out of costs nothing either
    const before = await watts(page);
    await page.click('#nowlevel');
    await page.waitForTimeout(300);
    await page.evaluate(() => { if(window.__144.meeting()) window.__144.skipMeet(); });
    await page.waitForTimeout(300);
    const box = await page.locator('#dialtrack').boundingBox();
    if(box){                                    // only a gap level has the line
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y - 80, {steps: 5});
      await page.mouse.up();
      await page.waitForTimeout(300);
      expect(await watts(page), 'backing out of the number line cost her watts')
        .toBeGreaterThanOrEqual(before);
    }

    // and a reload does not lose what she banked
    const banked = await watts(page);
    await page.reload();
    await page.waitForFunction(() => !!window.__144);
    await page.waitForTimeout(200);
    expect(await watts(page), 'a reload lost watts she had earned')
      .toBeGreaterThanOrEqual(banked);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a level she fought through is still worth winning', async ({page}) => {
    /* Measured 2026-08-25: a clean learn level pays 47 and a clean gap level 85; the
       same levels with a miss every other answer pay 33 and 45 — 70% and 53%. The
       combo multiplier is what makes the difference, which is the point: fluency pays
       more. The threshold below is well clear of both, so it fails on a real change to
       the economy rather than on which level the ladder happens to offer first. */
    await open(page);
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });
    const clean = await playSampling(page);

    // the very same level again, fought for: reset so it is a like-for-like comparison
    await page.evaluate(() => {
      const a = window.__144;
      a.reset(); a.state.prog.placed = true; a.save(); a.render();
    });
    await page.waitForTimeout(200);
    const fought = await playSampling(page, {missEvery: 2});

    expect(fought.answers, 'the fought level did not actually miss anything')
      .toBeGreaterThan(clean.answers);
    expect(fought.earned, 'a level she fought through paid nothing').toBeGreaterThan(0);
    expect(fought.earned / clean.earned,
      `fluent ${clean.earned} vs fought ${fought.earned} — finishing the hard way barely pays`)
      .toBeGreaterThan(0.4);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a streak pays better than no streak, answer for answer', async ({page}) => {
    /* The other half of "worth winning": fluency has to pay MORE. Comparing two whole
       levels cannot show this — a level she fought through has more answers in it, so
       the totals do not isolate the multiplier, and an earlier version of the test
       above asserted `fought < clean` and passed with the multiplier deleted. The
       claim is per ANSWER, so measure per answer. */
    await open(page);
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });
    await page.click('#nowlevel');
    await page.waitForTimeout(300);
    const step = async right => {
      if(await page.evaluate(() => window.__144.meeting())){
        await page.evaluate(() => window.__144.skipMeet());
        await page.waitForTimeout(260);
      }
      const before = await watts(page);
      if(!await answer(page, right)) return null;
      await page.waitForTimeout(right ? 340 : 860);
      return (await watts(page)) - before;
    };
    // build a streak long enough for the multiplier to have climbed
    let onStreak = 0;
    for(let i = 0; i < 7; i++){
      const got = await step(true);
      if(got !== null) onStreak = got;
    }
    const combo = await page.evaluate(() => window.__144.sitting().combo);
    expect(combo, 'she never actually got on a streak').toBeGreaterThan(4);

    await step(false);                       // a miss resets it
    expect(await page.evaluate(() => window.__144.sitting().combo)).toBe(0);
    const coldValue = await step(true);      // the first one back

    expect(coldValue, 'the answer after a miss earned nothing at all').toBeGreaterThan(0);
    expect(onStreak, `on a streak an answer paid ${onStreak}, cold it paid ${coldValue} — the streak buys nothing`)
      .toBeGreaterThan(coldValue);
    expect(errorsOf(page)).toEqual([]);
  });

});
