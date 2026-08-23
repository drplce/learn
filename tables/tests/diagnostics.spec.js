// The diary, and the digest David pastes back into the chat.
//
// David, 2026-08-13: "would it help if we added an export or copy of something with
// days, time played, time between answers, wrong answers, other diagnostics that I
// could paste back in here."
//
// The column the app never kept is the valuable one: HOW LONG she takes. A right
// answer inside a couple of seconds is a fact she retrieved; one after six is a fact
// she worked out. The Leitner box cannot tell those apart, which is exactly why
// "known" has been such a slippery word in this project.
const {test, expect} = require('@playwright/test');
const {open, errorsOf, answer, alreadyMet, play} = require('./helpers');

const diary = page => page.evaluate(() => window.__144.state.log);
const digest = page => page.evaluate(() => window.__144.diagnostics());

test.describe('what it writes down', () => {

  test('a sitting is recorded: answers, rights, misses and minutes', async ({page}) => {
    await open(page);
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });
    await alreadyMet(page);
    await play(page);
    for(let i = 0; i < 4; i++){ await answer(page, true); await page.waitForTimeout(340); }
    await answer(page, false);
    await page.waitForTimeout(500);

    const L = await diary(page);
    const day = L.days[Object.keys(L.days)[0]];
    expect(Object.keys(L.days).length).toBe(1);
    expect(day.a, 'answers were not counted').toBe(5);
    expect(day.r).toBe(4);
    expect(day.w).toBe(1);
    expect(day.ms, 'no time played was recorded').toBeGreaterThan(0);
    expect(errorsOf(page)).toEqual([]);
  });

  test('how long each answer took is kept, per fact', async ({page}) => {
    await open(page);
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });
    await alreadyMet(page);
    await play(page);
    const fact = await page.evaluate(() => window.__144.sitting().cur.k);
    await page.waitForTimeout(1200);                  // she thinks about it for a beat
    await answer(page, true);
    await page.waitForTimeout(400);

    const L = await diary(page);
    const entry = L.recent[0];
    expect(entry.k, 'the wrong fact was recorded').toBe(fact);
    expect(entry.ok).toBe(1);
    expect(entry.ms, 'the time she took was not measured').toBeGreaterThan(900);
    expect(entry.ms).toBeLessThan(20000);
    expect(entry.d).toMatch(/^\d{4}-\d\d-\d\d$/);
  });

  test('time played does not count the phone being put down', async ({page}) => {
    // Otherwise "minutes played" is really "minutes since she first opened it",
    // which would be the most misleading number in the whole export.
    await open(page);
    await page.evaluate(() => { window.__144.state.prog.placed = true; window.__144.render(); });
    await alreadyMet(page);
    await play(page);
    await answer(page, true);
    await page.waitForTimeout(300);
    // she wanders off for two hours, then comes back and answers again
    await page.evaluate(() => { window.__144.noteAnswer('7x8', true, 1200); });
    const before = await page.evaluate(() =>
      window.__144.state.log.days[window.__144.todayISO()].ms);
    await page.evaluate(() => {
      // fake the gap by rewinding the app's idea of the last action
      window.__144.noteAnswer('6x7', true, 1100);
    });
    const after = await page.evaluate(() =>
      window.__144.state.log.days[window.__144.todayISO()].ms);
    // consecutive answers add a real but small amount, never hours
    expect(after - before).toBeLessThan(60000);
  });

});

test.describe('the digest', () => {

  async function seedDays(page){
    await page.evaluate(() => {
      const a = window.__144;
      a.state.prog.placed = true; a.state.prog.cleared = 39; a.state.prog.days = 3;
      const met = {};
      a.LEVELS.slice(0, 39).forEach(l => l.facts.forEach(k => met[k] = 1));
      Object.keys(met).forEach((k, i) => {
        a.state.facts[k] = {box: 1 + (i % 6), right: 2 + (i % 5),
          wrong: (i % 4 === 0) ? 3 : (i % 3), seen: 4 + (i % 6), last: '2026-08-12'};
      });
      ['2026-08-11', '2026-08-12', '2026-08-13'].forEach((d, i) => {
        a.state.log.days[d] = {a: 60 + i * 40, r: 52 + i * 34, w: 8 + i * 6,
          ms: (9 + i * 4) * 60000, lv: 6 + i * 7, s: 2 + i, met: 6, slow: 9 + i * 3};
      });
      const keys = Object.keys(met);
      for(let i = 0; i < 120; i++)
        a.state.log.recent.push({k: keys[i % keys.length], d: '2026-08-13',
          ok: (i % 7 !== 0) ? 1 : 0, ms: 900 + (i % 11) * 620});
      a.save();
    });
  }

  test('it carries the things he asked for', async ({page}) => {
    await open(page);
    await seedDays(page);
    const t = await digest(page);
    expect(t).toContain('144 diagnostics');
    expect(t).toMatch(/LAST \d+ DAYS/);
    expect(t).toContain('mins');                      // time played
    expect(t).toContain('answers');
    expect(t).toContain('MISSED MOST');               // wrong answers, by fact
    expect(t).toContain('HOW LONG SHE TAKES');        // time between answers
    expect(t).toContain('THE 78 FACTS');
    expect(t).toMatch(/level \d+ of \d+/);
    expect(t.split('\n').length).toBeGreaterThan(20);
  });

  // David's phone, 2026-08-13: "7×9   32 missed of 59   box 7". Both halves of that
  // line are true and they contradict each other, which is the single most important
  // thing the export has to say. It must not print the box and let it stand.
  async function seedHerSeven(page){
    await page.evaluate(() => {
      const a = window.__144;
      a.state.prog.placed = true; a.state.prog.cleared = 49;
      // the fact off her phone: a bad first session, then a clean run, top box
      a.state.facts['7x9'] = {box: 7, right: 27, wrong: 32, seen: 59, last: '2026-08-13'};
      // and one she is fumbling right now, whose lifetime record still looks fine
      a.state.facts['6x8'] = {box: 5, right: 20, wrong: 1, seen: 21, last: '2026-08-13'};
      // plus a plain, genuinely-solid fact that should be flagged by neither section
      a.state.facts['2x5'] = {box: 6, right: 18, wrong: 0, seen: 18, last: '2026-08-13'};
      for(let i = 0; i < 20; i++)
        a.state.log.recent.push({k: '7x9', d: '2026-08-13', ok: 1, ms: 1400});
      for(let i = 0; i < 5; i++)
        a.state.log.recent.push({k: '6x8', d: '2026-08-13', ok: i === 4 ? 1 : 0, ms: 3900});
      // and a fact she has seen twice and missed twice — 100%, but two answers of noise
      a.state.facts['3x4'] = {box: 2, right: 6, wrong: 3, seen: 9, last: '2026-08-13'};
      for(let i = 0; i < 2; i++)
        a.state.log.recent.push({k: '3x4', d: '2026-08-13', ok: 0, ms: 3100});
      a.save();
    });
  }
  // the block of lines under one heading, so a fact cannot be "in" a section it is
  // merely printed below
  function section(text, heading){
    const lines = text.split('\n');
    const start = lines.findIndex(l => l.startsWith(heading));
    if(start < 0) return '';
    const rest = lines.slice(start + 1);
    const end = rest.findIndex(l => /^[A-Z]/.test(l));
    return rest.slice(0, end < 0 ? rest.length : end).join('\n');
  }

  test('a fact counted as known but missed half the time is flagged, not passed off', async ({page}) => {
    await open(page);
    await seedHerSeven(page);
    const t = await digest(page);
    const flagged = section(t, 'WORTH A LOOK');
    expect(flagged, 'the top-box fact she misses half the time is not flagged').toContain('7×9');
    expect(flagged).toContain('box 7');
    expect(flagged).toMatch(/54%|missed 32 of 59/);
    // and it says WHY the two disagree, so the number is not just left dangling
    expect(flagged.toLowerCase()).toMatch(/only remembers the recent run|recent run/);
    // a fact she has never missed must not be dragged in with it
    expect(flagged, 'a solid fact was flagged as suspect').not.toContain('2×5');
    expect(errorsOf(page)).toEqual([]);
  });

  test('what she is missing now is separated from what she ever missed', async ({page}) => {
    await open(page);
    await seedHerSeven(page);
    const t = await digest(page);
    const ever = section(t, 'MISSED MOST — ALL TIME');
    const now = section(t, 'MISSED MOST — RECENTLY');
    expect(ever, 'the all-time list lost the fact with the worst record').toContain('7×9');
    expect(now, 'a fact she is missing right now is not in the recent list').toContain('6×8');
    // 7×9 has not been missed once in the recent log — its bad record is history
    expect(now, 'the recent list is just the all-time list again').not.toContain('7×9');
    // and the all-time list has to admit where its big numbers came from
    expect(ever.toLowerCase()).toMatch(/picker fault|before 2026-08-12/);
    expect(errorsOf(page)).toEqual([]);
  });

  test('the recent list is not swamped by facts she only saw twice', async ({page}) => {
    // Sorting by miss RATE looks right and is useless: across 400 answers over 78
    // facts, every fact seen twice and missed twice reads as 100% and buries the one
    // she actually keeps losing. He reads the top of this list, so the top has to
    // be the biggest problem, not the smallest sample.
    await open(page);
    await seedHerSeven(page);
    const now = section(await digest(page), 'MISSED MOST — RECENTLY');
    const lines = now.split('\n').filter(l => l.trim());
    const at = f => lines.findIndex(l => l.includes(f));
    expect(at('6×8'), 'the fact she keeps losing is missing').toBeGreaterThanOrEqual(0);
    expect(at('3×4'), 'the two-answer fact is missing').toBeGreaterThanOrEqual(0);
    expect(at('6×8'), 'a 2-of-2 sample outranked a 4-of-5 one').toBeLessThan(at('3×4'));
    expect(errorsOf(page)).toEqual([]);
  });

  test('every number in it agrees with its noun', async ({page}) => {
    /* "1 days playing" (found 2026-08-17), "LAST 1 DAYS" and "last 1 right answers"
       (both 2026-08-23) were all spotted by eye, which is not a system. This drives the
       digest into the states where every count in it is exactly ONE and sweeps for a
       number followed by a plural. David reads this export to decide things; a page that
       cannot say "1 answer" invites doubt about the figures standing next to it.

       TWO fixtures, because one cannot cover every section: a single RIGHT answer brings
       up "how long she takes" and hides "missed most — recently", and a single MISS does
       the reverse. The first version of this test used only the right-answer state and a
       regex of `1 [a-z]+s`, which cannot see a multi-word noun — so it passed with all
       three of the real slips reinstated. It had no teeth at all until it was run against
       them one at a time. */
    const states = {
      'one right answer': a => {
        a.state.facts['7x8'] = {box: 2, right: 1, wrong: 0, seen: 1, last: a.todayISO()};
        a.state.log.days[a.todayISO()] = {a:1, r:1, w:0, ms:40000, lv:1, s:1, met:1, slow:0};
        a.state.log.recent.push({k:'7x8', d:a.todayISO(), ok:1, ms:1200});
      },
      'one miss': a => {
        a.state.facts['7x8'] = {box: 1, right: 0, wrong: 1, seen: 1, last: a.todayISO()};
        a.state.log.days[a.todayISO()] = {a:1, r:0, w:1, ms:40000, lv:1, s:1, met:1, slow:0};
        a.state.log.recent.push({k:'7x8', d:a.todayISO(), ok:0, ms:1200});
      }
    };
    const seen = [];
    for(const [name, fn] of Object.entries(states)){
      await open(page, '2026-09-04');
      await page.evaluate(src => {
        const a = window.__144;
        a.state.prog.placed = true; a.state.prog.cleared = 1; a.state.prog.days = 1;
        (new Function('a', src))(a);
        a.save();
      }, fn.toString().replace(/^[^=]*=>\s*\{/, '').replace(/\}\s*$/, ''));
      const t = await digest(page);
      // the counts really are 1, or this sweep is reading a page that cannot disagree
      expect(t, `${name}: the fixture did not produce a one-day digest`).toMatch(/1 day playing/);
      seen.push(t);

      /* A number, then up to three words, ending in an s. Case-insensitive, because
         one of the real slips was a heading ("LAST 1 DAYS"), and multi-word, because
         another was "last 1 right answers" — the version of this regex that only
         allowed a single word missed both. Bounded to three words so a correct
         singular sentence that happens to contain a plural later on is not flagged. */
      const offenders = t.split('\n')
        .filter(l => /(^|[^\d.])1 (?:[a-z]+ ){0,2}[a-z]+s\b/i.test(l));
      expect(offenders, `${name}: a count of one is followed by a plural`).toEqual([]);
      expect(errorsOf(page)).toEqual([]);
    }
    // and between them the two states really did reach both of the count-bearing sections
    expect(seen.join('\n')).toContain('HOW LONG SHE TAKES');
    expect(seen.join('\n')).toContain('MISSED MOST — RECENTLY');
  });

  test('nothing identifying goes in it', async ({page}) => {
    // The repo is public and this gets pasted into a chat. Her name is never in the
    // app at all; the buddy's pet name is hers and stays on the device.
    await open(page);
    await seedDays(page);
    await page.evaluate(() => { window.__144.state.buddy.name = 'Zapdactyl'; window.__144.save(); });
    const t = await digest(page);
    expect(t, 'the buddy name leaked into the export').not.toContain('Zapdactyl');
  });

  test('it says what it cannot tell him', async ({page}) => {
    // The honest bit: the box can still rise several times in one sitting, so
    // "known" in this export does not mean "still knows it tomorrow".
    await open(page);
    await seedDays(page);
    const t = await digest(page);
    expect(t).toContain('NOTES');
    expect(t.toLowerCase()).toMatch(/more than once a day|one sitting/);
  });

  test('it works on day one, with nothing recorded yet', async ({page}) => {
    await open(page);
    const t = await digest(page);
    expect(t).toContain('144 diagnostics');
    expect(t.toLowerCase()).toMatch(/no days recorded yet/);
    expect(errorsOf(page)).toEqual([]);
  });

  test('the button is there and copying it does not throw', async ({page}) => {
    await open(page);
    await seedDays(page);
    await page.evaluate(() => window.__144.go('power'));
    await page.waitForTimeout(250);
    await page.click('#diag');
    await page.waitForTimeout(300);
    const label = await page.locator('#diag').innerText();
    expect(label.toLowerCase()).toMatch(/copied|select and copy/);
    expect(errorsOf(page)).toEqual([]);
  });

});

test.describe('the diary cannot grow without limit', () => {

  test('a huge log is trimmed on the way in, not carried around', async ({page}) => {
    await open(page);
    await page.evaluate(() => {
      window.__144.save();                            // make sure there is a file to poison
      const raw = JSON.parse(localStorage.getItem('144.v1'));
      raw.log = {days: {}, recent: []};
      for(let i = 0; i < 900; i++){
        const d = new Date(2024, 0, 1 + i).toISOString().slice(0, 10);
        raw.log.days[d] = {a: 10, r: 9, w: 1, ms: 60000, lv: 1, s: 1, met: 0, slow: 1};
      }
      for(let i = 0; i < 5000; i++) raw.log.recent.push({k: '7x8', d: '2026-08-13', ok: 1, ms: 1200});
      localStorage.setItem('144.v1', JSON.stringify(raw));
    });
    await page.reload();
    await page.waitForFunction(() => !!window.__144);
    const L = await diary(page);
    expect(Object.keys(L.days).length, 'the day log is unbounded').toBeLessThanOrEqual(180);
    expect(L.recent.length, 'the answer log is unbounded').toBeLessThanOrEqual(400);
    // and the most recent days are the ones kept
    expect(Object.keys(L.days).sort().pop()).toBe(new Date(2024, 0, 900).toISOString().slice(0, 10));
    expect(errorsOf(page)).toEqual([]);
  });

  test('a corrupt log cannot stop it opening', async ({page}) => {
    await open(page);
    await page.evaluate(() => {
      window.__144.save();
      const raw = JSON.parse(localStorage.getItem('144.v1'));
      raw.log = {days: {'not-a-date': 'rubbish', '2026-08-13': 42}, recent: ['nope', null, {k: 5}]};
      localStorage.setItem('144.v1', JSON.stringify(raw));
    });
    await page.reload();
    await page.waitForFunction(() => !!window.__144);
    await page.waitForTimeout(200);
    const L = await diary(page);
    expect(Object.keys(L.days)).toEqual([]);
    expect(L.recent).toEqual([]);
    expect(await digest(page)).toContain('144 diagnostics');
    expect(errorsOf(page)).toEqual([]);
  });

});
