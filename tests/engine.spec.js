// Properties of the session builder, over random states rather than realistic
// trajectories. The simulation covers the paths a learner actually walks; this
// covers the corners — tiny lists, lopsided mastery, a bad run with nothing to
// consolidate — and asserts the promises the engine makes in all of them.
const {test, expect} = require('@playwright/test');
const {open} = require('./helpers');

const PROBE = trials => {
  const a = window.__acorn;
  let seed = 424242;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const found = {};
  const note = (k, d) => { if(!found[k]) found[k] = d; };

  for(let t = 0; t < trials; t++){
    const n = 1 + Math.floor(rnd() * 60);
    const words = []; for(let i = 0; i < n; i++) words.push('w' + i);
    a.state.words.lists = [{id:'p', name:'P', words}];
    a.state.words.activeId = 'p';

    const m = {};
    words.forEach(w => {
      if(rnd() < rnd()){                       // varied, sometimes sparse, coverage
        const box = 1 + Math.floor(rnd() * 7), daysAgo = Math.floor(rnd() * 60);
        m[w] = {right: Math.floor(rnd()*8), wrong: Math.floor(rnd()*5), box,
                lastSeen: new Date(Date.UTC(2026,7,1) - daysAgo*864e5).toISOString().slice(0,10)};
      }
    });
    a.state.words.mastery = m;

    const nh = Math.floor(rnd() * 8), hist = [];
    for(let i = 0; i < nh; i++){
      const wd = 3 + Math.floor(rnd() * 7);
      hist.push({date:'2026-07-2' + (i % 10), list:'p', asked: wd + 2, words: wd,
                 right: Math.floor(rnd()*(wd+3)), firstTime: Math.floor(rnd()*(wd+1))});
    }
    a.state.words.sessions = hist;
    a.save();

    const s = a.buildSession(a.activeList(), '2026-08-01');
    const where = ` (list ${n}, ${nh} sittings behind her)`;
    const unseen = s.filter(w => !m[w]).length;
    const acq = s.filter(w => m[w] && (m[w].box || 1) <= 1).length;

    if(s.length !== new Set(s).size)         note('duplicate', 'the same word twice' + where);
    if(s.some(w => words.indexOf(w) < 0))    note('foreign', 'a word not on her list' + where);
    if(words.length && !s.length)            note('empty', 'no sitting at all' + where);
    if(s.length > 9)                         note('long', s.length + ' words in one sitting' + where);
    if(acq + unseen > 3)                     note('cap', (acq+unseen) + ' words being learned at once' + where);
    // The share only means anything once she has material to consolidate; on a
    // brand-new list there is nothing else a sitting could be made of.
    const reviewablePool = words.filter(w => m[w] && (m[w].box || 1) > 1).length;
    if(nh && reviewablePool >= 6 && (unseen + acq) / s.length > 1/3 + 0.01)
      note('share', Math.round(100*(unseen+acq)/s.length) + '% of the sitting is new' + where);
    if(words.some(w => m[w] && (m[w].box||1) > 1) && s.length > 1 && !m[s[0]])
      note('opens', 'opens on a word she has never met' + where);
    // New material must not dry up while the pace still allows it.
    if(a.newWordsToday() > 0 && unseen === 0 && acq === 0 &&
       words.some(w => !m[w]) && s.length < 9)
      note('starved', 'the pace allowed a new word and none was offered' + where);
  }
  return found;
};

test.describe('the session builder, over random states', () => {

  test('every promise holds across 1500 states', async ({page}) => {
    await open(page, '2026-08-01');
    const found = await page.evaluate(PROBE, 1500);
    expect(Object.entries(found).map(([k, v]) => `${k}: ${v}`)).toEqual([]);
  });

  test('the cap on words being learned at once outranks the session floor',
    async ({page}) => {
      await open(page, '2026-08-01');
      const out = await page.evaluate(() => {
        const a = window.__acorn;
        const words = []; for(let i = 0; i < 20; i++) words.push('w' + i);
        a.state.words.lists = [{id:'p', name:'P', words}];
        a.state.words.activeId = 'p';
        // One word in hand, nineteen never met, and a bad run behind her.
        a.state.words.mastery = {w0:{right:3, wrong:0, box:4, lastSeen:'2026-07-01'}};
        a.state.words.sessions = [1,2,3,4,5].map(i =>
          ({date:'2026-07-2' + i, list:'p', asked:10, words:8, right:5, firstTime:4}));
        a.save();
        const s = a.buildSession(a.activeList(), '2026-08-01');
        return {len: s.length, newToday: a.newWordsToday(),
                unseen: s.filter(w => !a.state.words.mastery[w]).length};
      });
      // Under 70% the pace adds nothing new, and the floor may not override the
      // cap to reach four — three words beats three new words at once.
      expect(out.newToday).toBe(0);
      expect(out.len).toBeLessThan(4);
      expect(out.unseen).toBeLessThanOrEqual(3);
    });

  // How the intake behaves as her reviewable pool grows, at three standards of
  // week. The high shares belong to the first days on a brand-new list, when
  // there is nothing else to practise; what matters is where it settles.
  async function sweep(page, firstTime){
    return page.evaluate(ft => {
      const a = window.__acorn, out = [];
      for(const seen of [0,1,2,3,4,5,6,8,10,15,20]){
        const words = []; for(let i = 0; i < 40; i++) words.push('w' + i);
        a.state.words.lists = [{id:'p', name:'P', words}];
        a.state.words.activeId = 'p';
        const m = {};
        for(let i = 0; i < seen; i++) m['w' + i] = {right:3, wrong:0, box:4, lastSeen:'2026-07-10'};
        a.state.words.mastery = m;
        a.state.words.sessions = [1,2,3,4,5].map(i =>
          ({date:'2026-07-2' + i, list:'p', asked:10, words:8, right:ft, firstTime:ft}));
        a.save();
        const s = a.buildSession(a.activeList(), '2026-08-01');
        const fresh = s.filter(w => !m[w]).length;
        out.push({seen, len: s.length, fresh, share: s.length ? fresh / s.length : 0});
      }
      return out;
    }, firstTime);
  }

  test('a bad week stops new words once she has anything to consolidate', async ({page}) => {
    await open(page, '2026-08-01');
    const rows = await sweep(page, 4);                    // 4 of 8 right first time
    // Below four reviewable words the floor still offers a couple, because the
    // alternative is a fifteen-second sitting with nothing in it.
    rows.filter(r => r.seen >= 4).forEach(r =>
      expect(r.fresh, `${r.seen} reviewable`).toBe(0));
    expect(rows.every(r => r.fresh <= 3)).toBe(true);
  });

  test('a middling week settles at one new word', async ({page}) => {
    await open(page, '2026-08-01');
    const rows = await sweep(page, 6);
    rows.filter(r => r.seen >= 4).forEach(r =>
      expect(r.fresh, `${r.seen} reviewable`).toBe(1));
  });

  test('a good week settles at three new words and a third of the sitting', async ({page}) => {
    await open(page, '2026-08-01');
    const rows = await sweep(page, 8);
    rows.filter(r => r.seen >= 6).forEach(r => {
      expect(r.fresh, `${r.seen} reviewable`).toBe(3);
      expect(r.share, `${r.seen} reviewable`).toBeLessThanOrEqual(1/3 + 0.01);
    });
    // Never more than three at once, however well she is doing.
    expect(Math.max(...rows.map(r => r.fresh))).toBe(3);
  });
});

/* The test API's own contract. Not the app she uses, but the thing every simulation
   and every adversarial run in this repo stands on — and a harness that lies quietly
   is worse than one that fails loudly. */
test.describe('the reset the harness relies on', () => {

  test('a reset puts the faked clock back too', async ({page}) => {
    // `reset()` used to leave `_today` wherever the last caller left it. Harmless while
    // every caller sets the date again before recording anything — which is exactly what
    // tests/sim.js happens to do, so nothing here was ever wrong — and a quiet disaster
    // for any caller that does not. The sibling app in tables/ ran eight learners in one
    // page this way and learners 2 through 8 stamped their day-0 records months into the
    // future, so every word they learned read as "not due yet" for the whole run and the
    // spread it reported was measuring nothing. Cheap to guard, so guard it.
    await open(page);
    const real = await page.evaluate(() => window.__acorn.todayISO());
    await page.evaluate(() => window.__acorn.setToday('2027-03-14'));
    expect(await page.evaluate(() => window.__acorn.todayISO())).toBe('2027-03-14');

    await page.evaluate(() => window.__acorn.reset());
    expect(await page.evaluate(() => window.__acorn.todayISO()),
      "a reset left the previous run's faked date behind").toBe(real);

    // and a word recorded after the reset is stamped today, not next March — the
    // consequence the date actually has
    await page.evaluate(() => window.__acorn.recordWord('because', true));
    expect(await page.evaluate(() => window.__acorn.mastery('because').lastSeen),
      'a word learned after the reset was dated by the stale clock').toBe(real);
  });

});
