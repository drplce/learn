// Which day the app thinks it is.
//
// `iso()` reads LOCAL getters and `parseISO` builds LOCAL midnights, so everything
// dated — her sittings, every `lastSeen`, "finished today" — is keyed to the day she
// is actually having. That is correct, and it is also completely unguarded: this suite
// runs under UTC, where local and UTC are the same thing, so the one-line "tidy" that
// would break it (`d.toISOString().slice(0, 10)`) passes every other test in the file.
//
// Her phone is in Sydney, ten or eleven hours ahead. Under that tidy, every practice
// before 10 or 11 in the morning would be filed under YESTERDAY: the sitting counted
// against the wrong day, `lastSeen` a day out on every word she met, and "finished
// today" answering for a day she has not had yet.
//
// So the timezone is pinned on the context rather than left to however the suite was
// launched — the same lesson the sibling app's routine learned on 2026-10-25, measured
// here rather than inherited.
//
// Teeth-checked 2026-10-26, and the number is the point: replacing `iso()` with
// `d.toISOString().slice(0, 10)` reds these three tests and NOTHING ELSE out of 604.
// 9am on a Sydney Saturday came back as the Friday. Every one of the other 601 stayed
// green, which is exactly the trap — a UTC host cannot see this defect at all.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

test.describe('her day is the day she is having', () => {
  test.use({timezoneId: 'Australia/Sydney'});

  // Both halves of the year: Sydney is UTC+10 in winter and UTC+11 over summer, and
  // each of these is a moment when UTC is still on the day before.
  const moments = [
    ['a winter morning', '2026-08-01T23:00:00Z', '2026-08-02', '2026-08-01'],
    ['a summer midnight', '2026-12-01T13:30:00Z', '2026-12-02', '2026-12-01'],
  ];

  for(const [what, instant, hers, utcs] of moments){
    test(`${what}: the app's today is hers, not the one UTC is having`, async ({page}) => {
      await page.clock.install({time: new Date(instant)});
      await open(page, null);                     // no faked date — read the real clock
      const r = await page.evaluate(() => ({
        today: window.__acorn.todayISO(),
        utc: new Date().toISOString().slice(0, 10),
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }));
      // The premise: this really is a moment where the two disagree. Without it the
      // test passes for free on any machine whose clock happens to agree with UTC.
      expect(r.tz, 'the context did not take the timezone').toBe('Australia/Sydney');
      expect(r.utc, 'the fixture did not land on a moment where UTC is a day behind')
        .toBe(utcs);
      expect(r.today, 'the app filed her under the wrong day').toBe(hers);
      expect(errorsOf(page)).toEqual([]);
    });
  }

  test('and a sitting she does that morning is counted against that morning',
    async ({page}) => {
      // The consequence she would actually meet: her evening's work on the wrong date.
      await page.clock.install({time: new Date('2026-08-01T23:00:00Z')});   // 9am in Sydney
      await open(page, null);
      const r = await page.evaluate(() => {
        const a = window.__acorn;
        a.state.words.lists = [{id: 'w', name: 'T', words: ['said', 'rain']}];
        a.state.words.activeId = 'w'; a.state.words.mastery = {}; a.state.words.sessions = [];
        a.save(); a.go('day');
        if(!a.session()) a.start();
        for(let g = 0; g < 40 && a.session(); g++){
          const W = a.session();
          if(W.stage === 'look'){ a.cover(); continue; }
          if(W.stage === 'write'){ a.type(W.words[W.i]); a.check(); a.next(); continue; }
          a.next();
        }
        return {dates: a.state.words.sessions.map(s => s.date),
                seen: Object.keys(a.state.words.mastery)
                        .map(k => a.state.words.mastery[k].lastSeen)};
      });
      expect(r.dates, 'her sitting was filed under a day she did not have')
        .toEqual(['2026-08-02']);
      expect([...new Set(r.seen)], 'a word she met today was stamped with another day')
        .toEqual(['2026-08-02']);
    });
});
