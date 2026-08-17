// A week, not an evening.
//
// `evening.spec.js` covers one sitting. This covers the thing a Leitner box is FOR:
// what happens when a day passes. `BOX_DAYS` is written in days — {1:0, 2:1, 3:2,
// 4:4, 5:8, 6:21, 7:60} — and until now every test in the suite ran inside a single
// day, so the intervals themselves were never exercised at all. The engine's whole
// promise is that a fact she has solid gets left alone for a while and a fact she is
// shaky on keeps coming back, and that promise is only observable across dates.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

const draws = (page, pool, n) => page.evaluate(([p, count]) => {
  const tally = {};
  for(let i = 0; i < count; i++){
    const k = window.__144.pickFact(p);
    tally[k] = (tally[k] || 0) + 1;
  }
  return tally;
}, [pool, n]);

// Play the level on screen to its end and dismiss the card.
async function clearOne(page){
  await page.click('#nowlevel');
  await page.waitForTimeout(240);
  for(let g = 0; g < 80; g++){
    const st = await page.evaluate(() => ({
      cleared: !!document.querySelector('#clear.on'), meeting: window.__144.meeting()}));
    if(st.cleared) break;
    if(st.meeting){ await page.evaluate(() => window.__144.skipMeet()); await page.waitForTimeout(240); continue; }
    if(!await page.evaluate(() => window.__144.answer(true))){ await page.waitForTimeout(200); continue; }
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(500);
  await page.click('#clearOn');
  await page.waitForTimeout(300);
}

test.describe('what a day passing does', () => {

  test('a fact resting in a high box waits its interval out, then comes back', async ({page}) => {
    // One fact parked in box 6 (a 21-day rest) among five she is still working on.
    // The day after she got it right it should be almost invisible; three weeks later
    // it should be back in circulation. Nothing in the suite has ever checked that a
    // date has any effect on what she is asked.
    await open(page, '2026-09-01');
    const weak = ['3x4', '3x6', '3x7', '3x8', '3x9'];
    const pool = ['7x8'].concat(weak);
    await page.evaluate(w => {
      const a = window.__144;
      a.state.facts['7x8'] = {box: 6, right: 12, wrong: 1, seen: 13, last: '2026-09-01'};
      w.forEach(k => { a.state.facts[k] = {box: 2, right: 2, wrong: 2, seen: 4, last: '2026-09-01'}; });
      a.save();
    }, weak);

    await page.evaluate(() => window.__144.setToday('2026-09-02'));   // the next day
    const soon = await draws(page, pool, 600);
    await page.evaluate(() => window.__144.setToday('2026-09-26'));   // 25 days on
    const later = await draws(page, pool, 600);

    const restingSoon = soon['7x8'] || 0, restingLater = later['7x8'] || 0;
    expect(restingSoon, 'a fact she just got right is being drilled the very next day')
      .toBeLessThan(600 / pool.length);
    expect(restingLater, 'its 21 days came and went and it never came back')
      .toBeGreaterThan(restingSoon * 1.5);
    // and it never disappears entirely — resting is not retiring
    expect(restingSoon).toBeGreaterThan(0);
    expect(errorsOf(page)).toEqual([]);
  });

  test('the one she keeps missing keeps coming back, day after day', async ({page}) => {
    // The other half of the same promise, across dates rather than within a sitting.
    //
    // All four sit in the SAME box on purpose. The first version of this test gave the
    // weak fact a lower box as well, and it passed with the picker's miss-rate term
    // deleted — the box term alone was carrying it, so the test was not testing what
    // its name claimed. Same box, different miss rates: now only her actual record
    // can separate them.
    await open(page, '2026-09-01');
    const pool = ['4x6', '4x7', '4x8', '4x9'];
    await page.evaluate(p => {
      const a = window.__144;
      a.state.facts[p[0]] = {box: 3, right: 1, wrong: 6, seen: 7, last: '2026-09-01'};
      p.slice(1).forEach(k => {
        a.state.facts[k] = {box: 3, right: 14, wrong: 0, seen: 14, last: '2026-09-01'};
      });
      a.save();
    }, pool);
    for(const day of ['2026-09-02', '2026-09-03', '2026-09-04']){
      await page.evaluate(d => window.__144.setToday(d), day);
      const t = await draws(page, pool, 400);
      expect(t[pool[0]] || 0, `on ${day} the fact she keeps missing was not the one asked most`)
        .toBeGreaterThan(Math.max(t[pool[1]] || 0, t[pool[2]] || 0, t[pool[3]] || 0));
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('days count days, not levels', async ({page}) => {
    // Three levels on Tuesday and two on Wednesday is two days and two sittings, not
    // five of either. `prog.days` is what her power room screen counts.
    await open(page, '2026-09-01');
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });
    await clearOne(page);
    await clearOne(page);
    const day1 = await page.evaluate(() => ({
      days: window.__144.state.prog.days, sessions: window.__144.state.prog.sessions}));
    expect(day1.days).toBe(1);
    expect(day1.sessions, 'two levels in one evening counted as two days').toBe(2);

    await page.evaluate(() => { window.__144.setToday('2026-09-02'); });
    await clearOne(page);
    const day2 = await page.evaluate(() => ({
      days: window.__144.state.prog.days, sessions: window.__144.state.prog.sessions,
      rows: Object.keys(window.__144.state.log.days).sort()}));
    expect(day2.days, 'a second day did not count as a second day').toBe(2);
    expect(day2.sessions, 'the new day did not start its sitting count over').toBe(1);
    expect(day2.rows, 'the diary did not keep the two days apart')
      .toEqual(['2026-09-01', '2026-09-02']);
    expect(errorsOf(page)).toEqual([]);
  });

  test('"days playing" in the export means days she played', async ({page}) => {
    // Found 2026-08-17: `prog.days` only moves when she CLEARS a level, because that
    // is the only place `lastDay` is written. An evening where she answered twenty
    // questions and stopped mid-level therefore did not exist as far as the export's
    // headline was concerned, while LAST N DAYS listed it a few lines below. Two
    // numbers on one page disagreeing about how many days she has played is exactly
    // the kind of thing that makes the whole export untrustworthy.
    await open(page, '2026-09-01');
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });
    await clearOne(page);                                   // day one: a finished level

    // day two: she plays, but puts the phone down before the level is done
    await page.evaluate(() => { window.__144.setToday('2026-09-02'); });
    await page.click('#nowlevel');
    await page.waitForTimeout(240);
    for(let i = 0; i < 3; i++){
      if(await page.evaluate(() => window.__144.meeting())){
        await page.evaluate(() => window.__144.skipMeet()); await page.waitForTimeout(240);
      }
      await page.evaluate(() => window.__144.answer(true));
      await page.waitForTimeout(320);
    }
    await page.evaluate(() => window.__144.go('home'));
    await page.waitForTimeout(200);

    const rows = await page.evaluate(() => Object.keys(window.__144.state.log.days).length);
    expect(rows, 'the diary missed the evening she did not finish a level').toBe(2);
    const digest = await page.evaluate(() => window.__144.diagnostics());
    const headline = digest.split('\n').find(l => /days playing/.test(l));
    expect(headline, 'the export lost its days-playing line').toBeTruthy();
    expect(headline, `"${headline && headline.trim()}" disagrees with the ${rows} days in the diary`)
      .toContain(rows + ' days playing');
    expect(errorsOf(page)).toEqual([]);
  });

  test('a reset puts the clock back too', async ({page}) => {
    // This one is about the harness rather than the app, and it was a real trap: a
    // simulation that runs several modelled learners in one page resets between them,
    // and `reset()` used to leave the faked date behind. Learner 2 onwards stamped its
    // very first records months in the future, so every fact it learned looked "not
    // due yet" for the rest of the run — a whole simulation quietly measuring nothing.
    await open(page);
    const real = await page.evaluate(() => window.__144.todayISO());
    await page.evaluate(() => window.__144.setToday('2027-03-14'));
    expect(await page.evaluate(() => window.__144.todayISO())).toBe('2027-03-14');
    await page.evaluate(() => window.__144.reset());
    expect(await page.evaluate(() => window.__144.todayISO()),
      'a reset left the previous run\'s faked date behind').toBe(real);
    // and a fact learned after the reset is stamped today, not next March
    await page.evaluate(() => { window.__144.record('7x8', true, false); });
    expect(await page.evaluate(() => window.__144.state.facts['7x8'].last)).toBe(real);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a week away loses nothing but the charge', async ({page}) => {
    await open(page, '2026-09-01');
    await page.evaluate(() => {
      const a = window.__144;
      a.state.prog.placed = true; a.state.power.charge = 100; a.state.power.at = Date.now();
      a.save(); a.render();
    });
    await clearOne(page);
    const before = await page.evaluate(() => ({
      cleared: window.__144.state.prog.cleared,
      watts: window.__144.state.power.watts,
      known: window.__144.metCount()}));

    // a week goes by, and the phone's clock goes with it
    await page.evaluate(() => {
      const a = window.__144;
      a.setToday('2026-09-08');
      a.state.power.at = Date.now() - 7 * 24 * 3600 * 1000;
      a.settleCharge(); a.save(); a.render();
    });
    const after = await page.evaluate(() => ({
      cleared: window.__144.state.prog.cleared,
      watts: window.__144.state.power.watts,
      known: window.__144.metCount(),
      charge: window.__144.state.power.charge}));

    expect(after.cleared, 'a week away cost her a level').toBe(before.cleared);
    expect(after.watts, 'a week away cost her watts').toBe(before.watts);
    expect(after.known, 'a week away cost her facts').toBe(before.known);
    expect(after.charge, 'a week away left the battery with something in it').toBe(0);
    // and the buddy is asleep, not scolding her for it
    await page.evaluate(() => window.__144.go('power'));
    await page.waitForTimeout(250);
    const words = (await page.locator('#power .scroll').innerText()).toLowerCase();
    for(const w of ['dead', 'dying', 'sad', 'you forgot', 'where were you', 'missed'])
      expect(words, `"${w}" is on her screen after a week off`).not.toContain(w);
    expect(errorsOf(page)).toEqual([]);
  });

});
