// She does not run out of app.
//
// New words used to come from the open list and nowhere else, so the app quietly
// stopped teaching her the moment she finished it. Measured on the sixteen-word
// starter list: every word known by day nine, then the same nine-word review for a
// hundred and eleven days at 100% right first time, while the pace controller asked
// for three new words every single day and got none. The other eighty-four built-in
// words were reachable only by a grown-up knowing to switch lists by hand.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

// Drive real sittings through the real engine, answering everything correctly.
async function practise(page, days){
  return page.evaluate(n => {
    const a = window.__acorn;
    const rows = [];
    for(let d = 0; d < n; d++){
      a.setToday(new Date(Date.UTC(2026, 7, 1 + d)).toISOString().slice(0, 10));
      const wanted = a.newWordsToday();
      if(!a.start()){ rows.push({d, none: true, wanted, got: 0}); continue; }
      const W = a.session();
      const got = W.words.filter(w => !a.state.words.mastery[w]).length;
      let guard = 0;
      while(a.session() && guard++ < 300){
        const S = a.session();
        if(S.stage === 'look'){ a.cover(); continue; }
        if(S.stage === 'write'){ a.type(S.words[S.i]); a.check(); a.next(); continue; }
        a.next();
      }
      rows.push({d, wanted, got, list: a.activeList().id,
                 met: Object.keys(a.state.words.mastery).length});
    }
    const corpus = [];
    a.allLists().forEach(l => a.wordsOf(l).forEach(w => { if(corpus.indexOf(w) < 0) corpus.push(w); }));
    return {rows, corpus: corpus.length, list: a.activeList().id};
  }, days);
}

test.describe('she does not run out of app', () => {

  test('new words keep coming after she finishes the list she is on', async ({page}) => {
    await open(page, '2026-08-01');
    const r = await practise(page, 45);
    const live = r.rows.filter(x => !x.none);
    // The old behaviour: starved from day 7 onwards, 113 sittings out of 120.
    const starved = live.filter(x => x.wanted > 0 && x.got === 0);
    const firstStarved = starved.length ? starved[0].d : Infinity;
    expect(firstStarved, 'she stopped being given new words too early')
      .toBeGreaterThan(25);
    // She works through the whole corpus rather than one list of it.
    const met = live[live.length - 1].met;
    expect(met, 'she never got past one list').toBeGreaterThan(60);
    expect(met).toBeLessThanOrEqual(r.corpus);
    // And she was moved on rather than left there.
    expect(r.list, 'the open list never changed').not.toBe('easy');
    expect(errorsOf(page)).toEqual([]);
  });

  test('a list she has mastered still comes round again', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => {
      const a = window.__acorn;
      // The starter list finished a fortnight ago, so it is due; she is now on the
      // next list. Review has to reach back for it or a term's work goes quietly.
      const easy = a.wordsOf(a.allLists().find(l => l.id === 'easy'));
      easy.forEach(w => a.state.words.mastery[w] =
        {right:5, wrong:0, box:5, lastSeen:'2026-07-18'});
      a.state.words.activeId = 'tricky'; a.save();
    });
    const words = await page.evaluate(() => {
      const a = window.__acorn;
      a.setToday('2026-08-01'); a.start();
      return a.session().words.slice();
    });
    const easy = await page.evaluate(() =>
      window.__acorn.wordsOf(window.__acorn.allLists().find(l => l.id === 'easy')));
    const revisited = words.filter(w => easy.indexOf(w) >= 0);
    expect(revisited.length, 'the mastered list was abandoned').toBeGreaterThan(0);
  });

  test('she is not moved on until the list is actually known well', async ({page}) => {
    await open(page, '2026-08-01');
    const stayed = await page.evaluate(() => {
      const a = window.__acorn;
      // Every word met, none of them known well: there is still work here.
      a.wordsOf(a.activeList()).forEach(w => a.state.words.mastery[w] =
        {right:1, wrong:1, box:2, lastSeen:'2026-07-31'});
      a.save(); a.setToday('2026-08-01'); a.start();
      return a.activeList().id;
    });
    expect(stayed).toBe('easy');
  });

  test('the last list is the end of it, and that is not a fault', async ({page}) => {
    await open(page, '2026-08-01');
    const r = await page.evaluate(() => {
      const a = window.__acorn;
      const corpus = [];
      a.allLists().forEach(l => a.wordsOf(l).forEach(w => { if(corpus.indexOf(w) < 0) corpus.push(w); }));
      corpus.forEach(w => a.state.words.mastery[w] =
        {right:5, wrong:0, box:6, lastSeen:'2026-07-25'});
      a.save(); a.setToday('2026-08-01');
      const ok = a.start();
      return {ok, words: ok ? a.session().words.length : 0, list: a.activeList().id};
    });
    // Everything known: she still gets a sitting, it is all review, nothing breaks.
    expect(r.ok).toBe(true);
    expect(r.words).toBeGreaterThan(3);
  });
});
