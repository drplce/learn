// Review mixes the patterns; new words do not.
//
// Two properties of the engine that nobody had written down, both deliberate and
// opposite. What she practises is drawn from every word she has ever met, so a sitting
// mixes spelling patterns as soon as she has words from two of them — measured, 25 of
// 40 simulated sittings did, the first at day 14. What she is *introduced to* comes in
// corpus order, walking forward from the list she is on, so she meets one new pattern
// at a time.
//
// That is the right way round: interleaving helps retrieval and telling patterns apart,
// blocking helps acquisition, and nobody teaches a dyslexic nine-year-old two new
// patterns at once. Neither had anything protecting it. Narrow metWords() to the active
// list and review silently stops interleaving; let newPool() range freely and she meets
// four patterns in her first week. Nothing else in the suite would fail.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

// Which built-in list each word belongs to, by its first appearance.
const familyMap = page => page.evaluate(() => {
  const a = window.__acorn, out = {};
  a.allLists().forEach(l => a.wordsOf(l).forEach(w => { if(!(w in out)) out[w] = l.id; }));
  return out;
});

// Plays `days` sittings on the built-in corpus and reports each sitting's make-up.
async function run(page, days){
  return page.evaluate(n => {
    const a = window.__acorn;
    const fam = {};
    a.allLists().forEach(l => a.wordsOf(l).forEach(w => { if(!(w in fam)) fam[w] = l.id; }));
    a.state.words.mastery = {}; a.state.words.sessions = []; a.state.words.lists = [];
    a.state.words.activeId = 'easy'; a.save();
    const t0 = new Date('2026-07-01');
    const rows = [];
    let k = 0;
    for(let d = 0; d < n; d++){
      a.setToday(new Date(t0.getTime() + d * 86400000).toISOString().slice(0, 10));
      a.go('parent'); a.go('day');
      if(!a.session()) a.start();
      const W = a.session();
      const met = Object.keys(a.state.words.mastery);
      const fresh = W.words.filter(w => met.indexOf(w) < 0);
      /* Review and new have to be counted apart. Counting patterns across the whole
         sitting looked like it proved interleaving and did not: newPool() walks forward
         into the next list, so a sitting spans two patterns from the new words alone.
         Narrowing metWords() to the active list — the exact break this file is here to
         catch — passed every test in it until this line separated the two. */
      const review = W.words.filter(w => fresh.indexOf(w) < 0);
      rows.push({
        day: d,
        active: a.activeList().id,
        patterns: [...new Set(W.words.map(w => fam[w]))],
        reviewFrom: [...new Set(review.map(w => fam[w]))],
        reviewCount: review.length,
        newFrom: [...new Set(fresh.map(w => fam[w]))],
        metPatterns: [...new Set(met.map(w => fam[w]))],
      });
      for(let g = 0; g < 90 && a.session(); g++){
        const S = a.session();
        if(S.stage === 'look'){ a.cover(); continue; }
        if(S.stage === 'write'){
          const w = S.words[S.i];
          a.type(k++ % 5 ? w : w.slice(0, -1));      // mostly right, so she progresses
          a.check(); a.next(); continue;
        }
        a.next();
      }
    }
    return rows;
  }, days);
}

test.describe('interleaving', () => {

  test('a sitting mixes patterns as soon as she has met two', async ({page}) => {
    await open(page, '2026-08-01');
    const rows = await run(page, 40);
    // Nothing to interleave until she has words from two patterns; from then on it
    // should be the normal case, not the exception.
    // Only the words she is revisiting count here: those are the ones metWords() chose.
    const eligible = rows.filter(r => r.metPatterns.length > 1 && r.reviewCount > 2);
    expect(eligible.length, 'she never met words from two patterns, so this proves nothing')
      .toBeGreaterThan(5);
    const mixed = eligible.filter(r => r.reviewFrom.length > 1);
    expect(mixed.length / eligible.length,
      `only ${mixed.length} of ${eligible.length} eligible sittings drew review from\n` +
      'more than one pattern').toBeGreaterThan(0.7);
    expect(errorsOf(page)).toEqual([]);
  });

  test('and it keeps mixing once she has moved on to a new one', async ({page}) => {
    // The failure this guards against is the old pattern fading out entirely: she moves
    // to -tion words and never sees a silent letter again.
    await open(page, '2026-08-01');
    const rows = await run(page, 40);
    const late = rows.slice(-10).filter(r => r.metPatterns.length > 1 && r.reviewCount > 2);
    expect(late.length).toBeGreaterThan(3);
    for(const r of late)
      expect(r.reviewFrom.length,
        `day ${r.day}: on ${r.active}, revisiting only ${r.reviewFrom.join(',')}`)
        .toBeGreaterThan(1);
  });

  test('new words come in corpus order, not scattered across patterns', async ({page}) => {
    await open(page, '2026-08-01');
    const rows = await run(page, 40);
    const introducing = rows.filter(r => r.newFrom.length > 0);
    expect(introducing.length).toBeGreaterThan(10);
    /* One pattern at a time, except at a boundary where the intake spills into the
       next — which is right, because the alternative is stalling her on the last word
       of a list. Never three, which would mean it had stopped walking in order. */
    for(const r of introducing)
      expect(r.newFrom.length,
        `day ${r.day} introduced words from ${r.newFrom.join(', ')}`).toBeLessThanOrEqual(2);
    // And the common case is one.
    const single = introducing.filter(r => r.newFrom.length === 1).length;
    expect(single / introducing.length,
      'new words are usually spread over two patterns, not one').toBeGreaterThan(0.8);
  });

  test('the boundary spills forward rather than stalling her', async ({page}) => {
    // One word short of finishing a list, with a full three-word intake earned: she
    // should get that last word and then the start of the next pattern, not a short
    // sitting.
    await open(page, '2026-08-01');
    const fam = await familyMap(page);
    const r = await page.evaluate(() => {
      const a = window.__acorn;
      const easy = a.wordsOf(a.allLists().find(l => l.id === 'easy'));
      a.state.words.lists = [];
      a.state.words.mastery = {};
      easy.slice(0, -1).forEach(w => {
        a.state.words.mastery[w] = {right: 6, wrong: 0, box: 6, lastSeen: '2026-07-20'};
      });
      a.state.words.sessions = [];
      for(let i = 0; i < 5; i++)
        a.state.words.sessions.push({date: '2026-07-2' + i, asked: 9, words: 9, right: 9,
                                     firstTime: 9, fresh: [], grew: [], slipped: []});
      a.state.words.activeId = 'easy'; a.save();
      a.setToday('2026-08-01'); a.go('parent'); a.go('day');
      if(!a.session()) a.start();
      const W = a.session();
      const met = Object.keys(a.state.words.mastery);
      return {newWords: W.words.filter(w => met.indexOf(w) < 0),
              lastOfEasy: easy[easy.length - 1], poolCap: a.poolCap()};
    });
    expect(r.poolCap, 'she had not earned a full intake, so the boundary is not tested')
      .toBeGreaterThan(1);
    // The last word of the old pattern is taken first...
    expect(r.newWords).toContain(r.lastOfEasy);
    // ...and the rest come from the next one, rather than the sitting running short.
    expect(r.newWords.length).toBe(r.poolCap);
    const families = [...new Set(r.newWords.map(w => fam[w]))];
    expect(families.length, 'the intake did not cross the boundary').toBe(2);
    expect(families[0]).toBe('easy');
  });

  test('every word she practises is one she can be asked', async ({page}) => {
    // The other half of drawing review from everywhere: it must never reach a word
    // that is not in the corpus at all.
    await open(page, '2026-08-01');
    const bad = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.mastery = {}; a.state.words.sessions = []; a.state.words.lists = [];
      a.state.words.activeId = 'easy'; a.save();
      const t0 = new Date('2026-07-01');
      const out = [];
      for(let d = 0; d < 25; d++){
        a.setToday(new Date(t0.getTime() + d * 86400000).toISOString().slice(0, 10));
        a.go('parent'); a.go('day');
        if(!a.session()) a.start();
        const have = a.allWords();
        a.session().words.forEach(w => { if(have.indexOf(w) < 0) out.push(`day ${d}: ${w}`); });
        for(let g = 0; g < 90 && a.session(); g++){
          const S = a.session();
          if(S.stage === 'look'){ a.cover(); continue; }
          if(S.stage === 'write'){ a.type(S.words[S.i]); a.check(); a.next(); continue; }
          a.next();
        }
      }
      return out;
    });
    expect(bad).toEqual([]);
  });

});
