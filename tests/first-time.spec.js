// The one number the whole pace rests on.
//
// firstTime is how many words she got right on their first ask of a sitting. It decides
// the cheer at the end of the evening, and recentAccuracy() divides it by the sitting's
// distinct-word count to steer everything: how long the next sitting is, how many new
// words come in, whether any come in at all. It is also the 87% in every pacing report.
// Overcount it by one and the app both praises her for a word she never got and
// accelerates on the strength of it.
//
// Nothing asserted what it meant until now. Written after a probe of mine appeared to
// show "Every one, first go." on an evening a word was never got — which turned out to
// be the probe evaluating its own test cases with null arguments, not the app. The
// instrumented run was correct. This holds it that way.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

// Plays a whole sitting, deciding each answer from the word and how many times it has
// already come up, and reports the record the app wrote down.
async function sit(page, words, decide){
  return page.evaluate(({ws, src}) => {
    const a = window.__acorn;
    const answer = new Function('w', 'seen', 'return (' + src + ')(w, seen)');
    a.state.words.lists = [{id: 'x', name: 'T', words: ws}];
    a.state.words.activeId = 'x';
    a.state.words.mastery = {}; a.state.words.sessions = [];
    a.save(); a.go('day');
    if(!a.session()) a.start();
    const seen = {}, asks = [];
    for(let g = 0; g < 60 && a.session(); g++){
      const W = a.session(), w = W.words[W.i];
      if(W.stage === 'look'){ a.cover(); continue; }
      if(W.stage === 'write'){
        const nth = (seen[w] = (seen[w] || 0) + 1);
        const typed = answer(w, nth);
        a.type(typed);
        a.check();
        asks.push({w, nth, right: typed === w});
        a.next();
        continue;
      }
      a.next();
    }
    const s = a.state.words.sessions[a.state.words.sessions.length - 1];
    return {
      asks,
      record: s && {asked: s.asked, words: s.words, right: s.right, firstTime: s.firstTime},
      // The finished map is wordless now (David); the line and the praise are spoken, off #say.
      said: (document.querySelector('#say') || {}).textContent || '',
      accuracy: a.recentAccuracy(),
    };
  }, {ws: words, src: decide});
}

test.describe('right first time', () => {

  test('it counts the words she got on their first ask, and no others', async ({page}) => {
    await open(page, '2026-08-01');
    const r = await sit(page, ['said', 'went', 'rain'], '(w, nth) => w');
    const firsts = r.asks.filter(a => a.nth === 1 && a.right).length;
    expect(r.record.firstTime).toBe(firsts);
    expect(r.record.firstTime).toBe(r.record.words);
    // One praise now, whatever the evening held (David): "Great effort.", not a line that varies
    // with how clean it was. The record still knows firstTime; the spoken line no longer reports it.
    expect(r.said).toContain('Great effort.');
  });

  test('a word missed and never got does not count', async ({page}) => {
    await open(page, '2026-08-01');
    const r = await sit(page, ['said', 'went', 'rain'],
                        '(w, nth) => w === "said" ? "zzz" : w');
    expect(r.record.firstTime).toBe(r.record.words - 1);
    expect(r.said, 'praised for an evening with a word she never got').not.toMatch(/first go/);
    expect(r.said).toMatch(/Two took root tonight\./);
  });

  test('getting there on the second go is right, but not right first time',
    async ({page}) => {
      // The distinction the pace depends on. She has learned the word — it counts as
      // right and it takes root — but the evening was not a clean one, and the pace
      // must see that.
      await open(page, '2026-08-01');
      const r = await sit(page, ['said', 'went', 'rain'],
                          '(w, nth) => (w === "said" && nth === 1) ? "zzz" : w');
      expect(r.record.firstTime).toBe(r.record.words - 1);
      expect(r.record.right, 'getting there later was not counted as right at all')
        .toBeGreaterThan(r.record.firstTime);
      expect(r.said).not.toMatch(/first go/);
      // She did get it in the end, so it took root.
      expect(r.said).toMatch(/Three took root tonight\./);
    });

  test('an evening with nothing right counts nothing', async ({page}) => {
    await open(page, '2026-08-01');
    const r = await sit(page, ['said', 'went', 'rain'], '(w, nth) => "zzz"');
    expect(r.record.firstTime).toBe(0);
    expect(r.record.right).toBe(0);
    expect(r.said).not.toMatch(/first go/);
    expect(r.said).not.toMatch(/took root/);
  });

  test('a fumbled tap on an empty box is not an ask', async ({page}) => {
    // check() bails before anything is recorded, so an empty box must not appear in
    // the count of what she was asked — it would deflate the accuracy the pace reads.
    await open(page, '2026-08-01');
    const before = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id: 'x', name: 'T', words: ['said', 'rain']}];
      a.state.words.activeId = 'x';
      a.state.words.mastery = {}; a.state.words.sessions = [];
      a.save(); a.go('day');
      if(!a.session()) a.start();
      if(a.session().stage === 'look') a.cover();
      const s = a.session();
      return {tries: s.tries, right: s.right, firstTime: s.firstTime};
    });
    for(const junk of ['', '   ', '\t']){
      await page.evaluate(j => {
        const inp = document.querySelector('#type');
        if(inp){ inp.value = j; inp.dispatchEvent(new Event('input', {bubbles: true})); }
        window.__acorn.check();
      }, junk);
    }
    const after = await page.evaluate(() => {
      const s = window.__acorn.session();
      return {tries: s.tries, right: s.right, firstTime: s.firstTime, stage: s.stage};
    });
    expect(after.firstTime).toBe(before.firstTime);
    expect(after.right).toBe(before.right);
    expect(after.stage, 'an empty box moved her on').toBe('write');
    expect(errorsOf(page)).toEqual([]);
  });

  test('no stored sitting can make the pace read above one', async ({page}) => {
    /* recentAccuracy() is sum(firstTime) / sum(words) over the last five sittings.
       words is the distinct-word count, so firstTime can never legitimately exceed it
       — and if it ever did, the pace controller would read an accuracy above 100%,
       sail past PACE_HIGH for ever and keep adding new words on a lie. */
    await open(page, '2026-08-01');
    const rows = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.mastery = {}; a.state.words.sessions = []; a.state.words.lists = [];
      a.state.words.activeId = 'easy'; a.save();
      const t0 = new Date('2026-07-01');
      let n = 0;
      for(let d = 0; d < 30; d++){
        a.setToday(new Date(t0.getTime() + d * 86400000).toISOString().slice(0, 10));
        a.go('parent'); a.go('day');
        if(!a.session()) a.start();
        for(let g = 0; g < 90 && a.session(); g++){
          const W = a.session();
          if(W.stage === 'look'){ a.cover(); continue; }
          if(W.stage === 'write'){
            const w = W.words[W.i];
            // A mix, so requeues and second goes are all in play.
            a.type(n++ % 3 === 0 ? w.slice(0, -1) : w);
            a.check(); a.next(); continue;
          }
          a.next();
        }
      }
      return {sessions: a.state.words.sessions.map(s => ({
                asked: s.asked, words: s.words, right: s.right, firstTime: s.firstTime})),
              accuracy: a.recentAccuracy()};
    });
    expect(rows.sessions.length).toBeGreaterThan(20);
    for(const s of rows.sessions){
      expect(s.firstTime, `firstTime ${s.firstTime} over ${s.words} distinct words`)
        .toBeLessThanOrEqual(s.words);
      expect(s.words, `${s.words} distinct out of ${s.asked} asked`)
        .toBeLessThanOrEqual(s.asked);
      expect(s.right, `right ${s.right} below firstTime ${s.firstTime}`)
        .toBeGreaterThanOrEqual(s.firstTime);
    }
    expect(rows.accuracy).toBeGreaterThan(0);
    expect(rows.accuracy, 'the pace can read above 100% right').toBeLessThanOrEqual(1);
  });

  test('the count she is told never exceeds the words she met, whatever the evening', async ({page}) => {
    // The praise no longer varies with the evening — it is "Great effort." every time now (David),
    // so there is nothing there to disagree with the record. What must still hold is the count in
    // the live region: it counts words that took root, and that is never more than she met.
    await open(page, '2026-08-01');
    for(const [decide, label] of [
      ['(w, nth) => w', 'all right'],
      ['(w, nth) => w === "said" ? "zzz" : w', 'one never got'],
      ['(w, nth) => (nth === 1 ? "zzz" : w)', 'all missed once then got'],
      ['(w, nth) => "zzz"', 'nothing right'],
    ]){
      const r = await sit(page, ['said', 'went', 'rain'], decide);
      expect(r.said, `${label}: no praise heard`).toContain('Great effort');
      // What she is told counts words that took root, which is never more than she met.
      const m = r.said.match(/^(\w+) took root/);
      if(m){
        const WORDS = {One: 1, Two: 2, Three: 3, Four: 4, Five: 5};
        expect(WORDS[m[1]] || Number(m[1])).toBeLessThanOrEqual(r.record.words);
      }
    }
  });

});
