// What tonight actually did.
//
// A sitting knew how many words she got right and not which of them moved, and the
// sitting was thrown away at the end of it. So the screen at the end could only
// describe her evening in the abstract. These three lists are the honest basis for
// a picture of it: met for the first time, climbed a box, slipped back.
const {test, expect} = require('@playwright/test');
const {open, errorsOf, APP} = require('./helpers');

async function sitting(page, words, answer){
  return page.evaluate(o => {
    const a = window.__acorn;
    a.state.words.lists = [{id:'w1', name:'T', words:o.words}];
    a.state.words.activeId = 'w1'; a.save();
    a.start();
    let guard = 0;
    while(a.session() && guard++ < 60){
      const W = a.session(), w = W.words[W.i];
      if(W.stage === 'look'){ a.cover(); continue; }
      if(W.stage === 'write'){
        a.type(o.wrong.indexOf(w) >= 0 ? 'zzz' : w);
        a.check(); a.next(); continue;
      }
      a.next();
    }
    return a.tonight();
  }, {words, wrong: answer});
}

test.describe('what tonight did', () => {

  test('a word met for the first time is recorded as met tonight', async ({page}) => {
    await open(page, '2026-08-01');
    const t = await sitting(page, ['rain', 'boat'], []);
    expect(t.fresh.sort()).toEqual(['boat', 'rain']);
    expect(t.slipped).toEqual([]);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a word she already had, got right after a gap, is recorded as climbed', async ({page}) => {
    await open(page, '2026-08-05');
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.mastery = {rain: {right:2, wrong:0, box:2, lastSeen:'2026-08-01'},
                               boat: {right:2, wrong:0, box:2, lastSeen:'2026-08-01'}};
      a.save();
    });
    const t = await sitting(page, ['rain', 'boat'], []);
    expect(t.grew.sort()).toEqual(['boat', 'rain']);
    expect(t.fresh, 'words she already had are not new').toEqual([]);
  });

  test('a word she lost is recorded as slipped, not as grown', async ({page}) => {
    await open(page, '2026-08-05');
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.mastery = {rain: {right:6, wrong:0, box:6, lastSeen:'2026-08-01'},
                               boat: {right:6, wrong:0, box:6, lastSeen:'2026-08-01'}};
      a.save();
    });
    const t = await sitting(page, ['rain', 'boat'], ['rain']);
    expect(t.slipped).toEqual(['rain']);
    expect(t.grew, 'a word she lost must not be shown as growth').not.toContain('rain');
    // She got it right on the retry, which is not a day's progress either.
    expect(t.grew).not.toContain('rain');
  });

  /* A brand-new word is the only one that gets asked twice in an evening: shown,
     covered, written, and then requeued so its first cold retrieval happens today.
     So it is the only word that can climb and then slip in one sitting — a review
     word she gets right is asked once and that is that. */
  test('a word that climbs and then slips in one sitting counts as slipped', async ({page}) => {
    await open(page, '2026-08-05');
    const t = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'w1', name:'T', words:['rain', 'boat']}];
      a.state.words.activeId = 'w1'; a.save();
      a.start();
      const seen = {};
      let guard = 0;
      while(a.session() && guard++ < 40){
        const W = a.session(), w = W.words[W.i];
        if(W.stage === 'look'){ a.cover(); continue; }
        if(W.stage === 'write'){
          // Right the first time it is asked, wrong when it comes back.
          const again = seen[w];
          seen[w] = 1;
          a.type(again ? 'zzz' : w);
          a.check(); a.next(); continue;
        }
        a.next();
      }
      return {t: a.tonight(), box: a.state.words.mastery.rain.box};
    });
    // It went up and then came back down, so the evening did not grow it.
    expect(t.t.slipped, 'the slip was not recorded').toContain('rain');
    expect(t.t.grew, 'a word she lost is not growth').not.toContain('rain');
    // It is still a word she met tonight — that much did happen.
    expect(t.t.fresh).toContain('rain');
  });

  /* Went red under the parallel suite on 2026-10-27 — "lost on reload", fresh empty — and
     passed in isolation. The instrumentation below answered it, and the answer was not what
     the name suggested.

     MEASURED, with `--repeat-each=30 --workers=6` on this file, which reproduces in about
     three and a half minutes where fifteen full suite runs caught it once:
       before the reload: ["2026-08-01/4/rain+boat"], 632 bytes — her evening IS on the device
       after:             keys [], localStorage.length 0 — the WHOLE store, not just our key

     So nothing deleted her record. The entire file:// store came up empty on the reloaded
     page, which is the browser's storage not having been committed before the renderer went
     away under load. Ruled out by measurement rather than reasoning: another context cannot
     see this one's file:// storage, its `clear()` does not reach it, and closing it does not
     either — so the sibling app's `workers: 1` diagnosis still does not transfer. And
     `context.storageState()` reports no file:// origins at all, so it cannot be used to check
     whether a write has landed.

     The test now makes the app's own contract an assertion instead of instrumentation — her
     evening must be ON THE DEVICE the moment the sitting ends — and reads it back in a fresh
     page rather than an immediate reload of the same renderer. That is strictly more coverage
     than before, not less: the write is now checked deterministically, and the read-back is
     what her phone really does after iOS drops the tab. 180/180 under the load recipe above,
     against 179/180 twice with the reload. One in a hundred and eighty is not proof of a
     cause, and is not claimed as one. */
  test('it survives a reload, and does not leak into tomorrow', async ({page}) => {
    await open(page, '2026-08-01');
    await sitting(page, ['rain', 'boat'], []);
    const before = await page.evaluate(() => {
      const raw = localStorage.getItem('acorn.v1');
      let stored = 'unreadable';
      try { stored = (JSON.parse(raw).words.sessions || [])
                       .map(s => `${s.date}/${s.asked}/${(s.fresh||[]).join('+')}`); } catch(e){}
      return {stored, bytes: raw ? raw.length : 0,
              live: !!window.__acorn.session(), today: window.__acorn.todayISO()};
    });
    /* The app's own contract, asserted rather than merely logged: when the sitting ends,
       her evening is on the device. This is the half that is entirely ours, and it is
       deterministic — no reload, no second page, nothing to race. */
    expect(before.stored, 'her evening was never written to the device')
      .toEqual(['2026-08-01/4/rain+boat']);
    expect(before.live, 'the sitting had not finished, so nothing was recorded yet').toBe(false);

    const page2 = await page.context().newPage();
    await page2.goto(APP);
    await page2.waitForFunction(() => !!window.__acorn);
    const after = await page2.evaluate(() => {
      const raw = localStorage.getItem('acorn.v1');
      let stored = 'unreadable';
      try { stored = (JSON.parse(raw).words.sessions || [])
                       .map(s => `${s.date}/${s.asked}/${(s.fresh||[]).join('+')}`); } catch(e){}
      window.__acorn.setToday('2026-08-01');
      return Object.assign({}, window.__acorn.tonight(), {
        storedAfter: stored, bytesAfter: raw ? raw.length : 0,
        // Is only OUR key gone, or is the whole store empty? Those are different
        // faults and the first version of this could not tell them apart.
        keys: Object.keys(localStorage), storeSize: localStorage.length,
        inState: (window.__acorn.state.words.sessions || []).map(s => s.date)});
    });
    const story = `\n  on the device: ${JSON.stringify(before)}\n  read back: ${JSON.stringify(after)}`;
    expect(after.fresh.sort(), 'her evening did not come back' + story).toEqual(['boat', 'rain']);
    const tomorrow = await page2.evaluate(() => {
      window.__acorn.setToday('2026-08-02');
      return window.__acorn.tonight();
    });
    expect(tomorrow.fresh, "yesterday's evening is not tonight's").toEqual([]);
  });

  test('the record is small enough to keep sixty of', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => {
      const a = window.__acorn;
      const ws = [];
      for(let i = 0; i < 40; i++) ws.push('word' + i);
      a.state.words.lists = [{id:'w1', name:'T', words:ws}];
      a.state.words.activeId = 'w1'; a.save();
      for(let d = 0; d < 70; d++){
        a.setToday(new Date(Date.UTC(2026, 7, 1 + d)).toISOString().slice(0, 10));
        if(!a.start()) continue;
        let g = 0;
        while(a.session() && g++ < 60){
          const W = a.session();
          if(W.stage === 'look'){ a.cover(); continue; }
          if(W.stage === 'write'){ a.type(W.words[W.i]); a.check(); a.next(); continue; }
          a.next();
        }
      }
    });
    const size = await page.evaluate(() => (localStorage.getItem('acorn.v1') || '').length);
    expect(await page.evaluate(() => window.__acorn.state.words.sessions.length))
      .toBeLessThanOrEqual(60);
    // Well inside any browser's quota, so remembering this cannot cost her progress.
    expect(size, 'stored state grew too much').toBeLessThan(120 * 1024);
  });
});
