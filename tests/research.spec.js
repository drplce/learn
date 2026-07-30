// The claims in RESEARCH.md, as assertions.
//
// Each design decision in this app that came from evidence rather than taste is written down
// in RESEARCH.md with what the app does about it. This file is the half of that which fails
// when the app stops doing it — the rest of the suite pins behaviour, and these pin the
// reasons, so a lever moved in six months' time trips something that says which belief it
// belonged to.
//
// Only the claims not already covered elsewhere are here. The pacing bands live in
// tests/sim.js, because they need sixty modelled days to mean anything.
const {test, expect} = require('@playwright/test');
const {open, errorsOf, write} = require('./helpers');

test.describe('the reasons behind the design, not just the behaviour', () => {

  test('§2 the intervals expand — every box waits longer than the one below it', async ({page}) => {
    /* Pinned elsewhere as an exact literal, which catches a change but says nothing about
       what was broken. The property is what matters: gaps that grow. Flattening them all to
       one day is the mutation that costs 23 of the 56 words she learns in sixty days while
       leaving every difficulty measure untouched. */
    await open(page, '2026-08-01');
    const days = await page.evaluate(() => window.__acorn.BOX_DAYS);
    const boxes = Object.keys(days).map(Number).sort((a, b) => a - b);
    expect(boxes.length, 'there are not seven boxes').toBe(7);
    expect(days[boxes[0]], 'the first box does not come back the same day').toBe(0);
    for(let i = 1; i < boxes.length; i++)
      expect(days[boxes[i]],
        `box ${boxes[i]} waits ${days[boxes[i]]} days, box ${boxes[i - 1]} waits `
        + `${days[boxes[i - 1]]} — the intervals have stopped expanding`)
        .toBeGreaterThan(days[boxes[i - 1]]);
    // And expanding, not merely increasing: each gap at least as big as the last.
    const gaps = boxes.slice(1).map((b, i) => days[b] - days[boxes[i]]);
    for(let i = 1; i < gaps.length; i++)
      expect(gaps[i], `the gap from box ${boxes[i + 1]} shrank`)
        .toBeGreaterThanOrEqual(gaps[i - 1]);
  });

  test('§1 she writes before she is shown anything', async ({page}) => {
    /* Retrieval before feedback, which is the whole shape of the exercise. A word she has
       met opens on the writing stage with nothing to copy from; the verdict only ever comes
       after an attempt. */
    await open(page, '2026-08-01');
    const r = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id: 'r1', name: 'T', words: ['said', 'rain']}];
      a.state.words.activeId = 'r1';
      // Met before, and known reasonably well.
      a.state.words.mastery = {said: {box: 4, right: 4, wrong: 1, last: '2026-07-20'},
                               rain: {box: 3, right: 3, wrong: 1, last: '2026-07-20'}};
      a.state.words.sessions = [{date: '2026-07-20', asked: 6, right: 5}];
      a.save(); a.go('day'); if(!a.session()) a.start();
      const scr = document.querySelector('#screen');
      return {stage: a.session().stage,
              word: a.session().words[a.session().i],
              onScreen: (scr.innerText || '').toLowerCase(),
              hasCover: !!document.querySelector('#cover')};
    });
    expect(r.stage, 'a word she already knows was shown to her first').toBe('write');
    expect(r.hasCover, 'she was offered a look at it').toBe(false);
    expect(r.onScreen, `the word "${r.word}" was on the screen she writes it from`)
      .not.toContain(r.word);
  });

  test('§1 and a word she has never met is shown first, once', async ({page}) => {
    // The other half. A brand-new word cannot be retrieved from nothing.
    await open(page, '2026-08-01');
    const r = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id: 'r2', name: 'T', words: ['xylophone', 'rhythm']}];
      a.state.words.activeId = 'r2';
      a.state.words.mastery = {}; a.state.words.sessions = [];
      a.save(); a.go('day'); if(!a.session()) a.start();
      const w = a.session().words[a.session().i];
      const shown = (document.querySelector('#screen').innerText || '').toLowerCase();
      return {stage: a.session().stage, word: w, shows: shown.includes(w)};
    });
    expect(r.stage, 'a word she has never seen went straight to writing').toBe('look');
    expect(r.shows, 'the look stage did not show her the word').toBe(true);
  });

  test('§4 new material never takes more than a third of a sitting', async ({page}) => {
    /* The cap is a share of the sitting and an absolute ceiling, whichever is smaller. Both
       limits clamp each other, so this checks the outcome rather than either lever — which
       is the thing that actually matters and the thing that stays true if the pair is
       retuned. */
    await open(page, '2026-08-01');
    const r = await page.evaluate(() => {
      const a = window.__acorn;
      const out = [];
      for(const acc of [1, .9, .8, .7, .5, .2]){
        a.state.words.lists = [{id: 'p' + acc, name: 'T',
          words: Array.from({length: 40}, (_, i) => 'wordnum' + i)}];
        a.state.words.activeId = 'p' + acc;
        a.state.words.mastery = {};
        // A history at this accuracy, so the pace controller has something to read.
        a.state.words.sessions = Array.from({length: 6}, () =>
          ({date: '2026-07-25', asked: 10, words: 10, right: Math.round(10 * acc),
            firstTime: Math.round(10 * acc)}));
        a.save();
        out.push({acc: acc, cap: a.poolCap(), session: a.sessionWords()});
      }
      return out;
    });
    for(const x of r){
      expect(x.cap, `at ${Math.round(x.acc * 100)}% right, ${x.cap} new words in a `
        + `${x.session}-word sitting is over a third`)
        .toBeLessThanOrEqual(Math.max(1, Math.floor(x.session / 3)));
      expect(x.cap, 'the pool closed entirely — she would never meet a new word').toBeGreaterThan(0);
    }
    // And it really does move with her accuracy, or the cap is just a constant.
    expect(new Set(r.map(x => x.cap)).size,
      'the new-word cap is the same at 100% right as at 20%').toBeGreaterThan(1);
  });

  test('§5 the verdict shows the right spelling, never hers', async ({page}) => {
    // Covered for wording elsewhere; here as the reason — an incorrect form on the screen
    // is an incorrect form being practised.
    await open(page, '2026-08-01');
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id: 'r5', name: 'T', words: ['beautiful']}];
      a.state.words.activeId = 'r5';
      a.state.words.mastery = {}; a.state.words.sessions = [];
      a.save(); a.go('day'); if(!a.session()) a.start();
      if(a.session().stage === 'look') a.cover();
    });
    await write(page, 'bewtiful');
    await page.evaluate(() => window.__acorn.check());
    const r = await page.evaluate(() => ({
      text: (document.querySelector('#screen').innerText || ''),
      said: (document.querySelector('#say') || {}).textContent || '',
    }));
    expect(r.text, 'her misspelling was put back in front of her').not.toContain('bewtiful');
    expect(r.said, 'her misspelling was read out to her').not.toContain('bewtiful');
    expect(r.text.toLowerCase(), 'the correct spelling was not shown').toContain('beautiful');
  });

  test('§6 every word of more than one syllable is offered in pieces', async ({page}) => {
    /* On the screen, not in the model. My first version of this compared splitOf() against
       syllables() — which return the same array as each other, so it asserted nothing and
       still managed to fail, because I read the array as a count. What the claim is actually
       about is whether she is offered the pieces, so this renders the stage and counts the
       chips she can see and tap. */
    await open(page, '2026-08-01');
    for(const [word, want] of [['beautiful', 3], ['because', 2], ['remember', 3],
                               ['different', 3], ['said', 0], ['rain', 0], ['went', 0]]){
      const r = await page.evaluate(w => {
        const a = window.__acorn;
        const id = 's' + (++window.__nth || (window.__nth = 1));
        a.state.words.lists = [{id: id, name: 'T', words: [w, 'went']}];
        a.state.words.activeId = id;
        a.state.words.mastery = {}; a.state.words.sessions = [];
        a.save(); a.go('day'); if(!a.session()) a.start();
        const chips = [...document.querySelectorAll('.syl')]
          .filter(c => c.getClientRects().length > 0);
        return {pieces: a.syllables(w),
                chips: chips.map(c => c.textContent),
                tappable: chips.filter(c => c.hasAttribute('data-syl')).length};
      }, word);
      expect(r.chips.length, `"${word}" was offered as ${r.chips.length} chips, wanted ${want}`)
        .toBe(want);
      if(want){
        expect(r.chips.join(''), `the chips for "${word}" do not spell it`).toBe(word);
        expect(r.tappable, `the chips for "${word}" cannot be tapped to hear them`).toBe(want);
        expect(r.pieces.length, 'the chips disagree with the split behind them').toBe(want);
      }
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('§7 the word is always available to hear, at every stage she needs it', async ({page}) => {
    await open(page, '2026-08-01');
    for(const stage of ['look', 'write']){
      await page.evaluate(s => {
        const a = window.__acorn;
        const id = 'r7' + s;
        a.state.words.lists = [{id: id, name: 'T', words: ['beautiful', 'said']}];
        a.state.words.activeId = id;
        a.state.words.mastery = {}; a.state.words.sessions = [];
        a.save(); a.go('day'); if(!a.session()) a.start();
        if(s === 'write' && a.session().stage === 'look') a.cover();
      }, stage);
      await expect(page.locator('#hear'), `no way to hear it on the ${stage} stage`)
        .toHaveCount(1);
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('§8 a word met today comes back today, from memory', async ({page}) => {
    /* The first cold retrieval happens while it is still fresh rather than arriving as a
       surprise tomorrow — so a word shown at the look stage and got right is queued again
       inside the same sitting. */
    await open(page, '2026-08-01');
    const r = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id: 'r8', name: 'T', words: ['xylophone', 'rhythm', 'said']}];
      a.state.words.activeId = 'r8';
      a.state.words.mastery = {}; a.state.words.sessions = [];
      a.save(); a.go('day'); if(!a.session()) a.start();
      const W = a.session();
      const first = W.words[W.i];
      if(W.stage === 'look') a.cover();
      a.type(first); a.check();
      return {first, requeue: a.session().requeue.slice(), shown: a.session().shown.slice()};
    });
    expect(r.shown, 'the word was not recorded as one she was shown').toContain(r.first);
    expect(r.requeue, `"${r.first}" was met today and not queued again today`)
      .toContain(r.first);
  });

  test('every claim in RESEARCH.md names a file that exists', async ({page}) => {
    /* The trap this whole file is built to avoid, and one the shed list fell into for four
       versions: a document that describes a state of affairs that has stopped being true,
       reading as reassurance every time anyone opens it. */
    const fs = require('fs');
    const path = require('path');
    const doc = fs.readFileSync(path.join(__dirname, '..', 'RESEARCH.md'), 'utf8');
    const named = [...doc.matchAll(/`(tests\/[\w.-]+\.(?:spec\.js|js))`/g)].map(m => m[1]);
    expect(named.length, 'RESEARCH.md names no tests at all').toBeGreaterThan(6);
    const missing = [...new Set(named)]
      .filter(f => !fs.existsSync(path.join(__dirname, '..', f)));
    expect(missing, 'RESEARCH.md points at tests that are not there').toEqual([]);
    // And every numbered claim in it is asserted somewhere in this file.
    const claims = [...doc.matchAll(/^## (\d+)\. /gm)].map(m => m[1]);
    const here = fs.readFileSync(__filename, 'utf8');
    const unpinned = claims.filter(n =>
      !new RegExp('§' + n + '\\b').test(here) && !/^3$/.test(n));
    expect(unpinned,
      'these claims in RESEARCH.md have nothing in this file holding them — §3 is exempt,\n'
      + 'because its bands need sixty modelled days and live in tests/sim.js').toEqual([]);
  });

});
