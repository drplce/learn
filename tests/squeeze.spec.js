// Making it smaller before taking it away.
//
// fitScreen only knew how to delete. The design already had a "make the caption small"
// step, but it hung off data-tight, which is a height threshold — and the case that
// needed it is a width. On a 320px phone at her largest text the three chips of
// "beau·ti·ful" wrap onto a second row and cost about a hundred pixels of height on a
// screen that is not short enough to count as tight, so the shed list ran all the way to
// the end: no dots, no note, and no verdict. She got a rust-coloured letter in the
// middle of her word and not one word anywhere on the screen telling her why.
//
// Found by screenshotting the real screens at 320px and 1.5x and looking at them, which
// is the only way this shows up — nothing overflowed, nothing was clipped, and every
// existing test passed, because a screen that fits by deleting its own contents still
// fits.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

// Drive to the verdict after a near miss, and report what survived on the screen.
async function checkAt(page, w, h, scale, word){
  await page.setViewportSize({width: w, height: h});
  return page.evaluate(({s, word}) => {
    const a = window.__acorn;
    const id = 'sq' + (++window.__nth || (window.__nth = 1));
    a.state.settings.textScale = s;
    a.state.words.lists = [{id: id, name: 'T', words: [word, 'said', 'rain']}];
    a.state.words.activeId = id;
    a.state.words.mastery = {}; a.state.words.sessions = [];
    a.save(); a.go('day'); if(!a.session()) a.start();
    if(a.session().stage === 'look') a.cover();
    a.type(word.slice(0, -1) + 'z'); a.check();
    const m = document.querySelector('#screen');
    const on = sel => {
      const n = m.querySelector(sel);
      return !!n && getComputedStyle(n).display !== 'none';
    };
    /* Rendered, not merely display:block. A chip inside a hidden .syls row — hidden by
       data-cramped, or by the shed list — still reports its own display as inline-flex
       while measuring 0x0, which reads as a tap target under 44px when it is not on the
       screen at all. */
    const chips = [...m.querySelectorAll('.syl')].filter(c => c.getClientRects().length > 0)
      .map(c => {
        const b = c.getBoundingClientRect();
        return {t: c.textContent, w: b.width, h: b.height, y: Math.round(b.top)};
      });
    const v = m.querySelector('.verdict');
    return {
      verdict: on('.verdict'),
      verdictText: v && getComputedStyle(v).display !== 'none' ? v.textContent.trim() : '',
      dots: on('.dots'),
      syls: on('.syls'),
      squeezed: document.documentElement.getAttribute('data-squeezed'),
      cramped: document.documentElement.hasAttribute('data-cramped'),
      chips: chips,
      rows: new Set(chips.map(c => c.y)).size,
      clipped: m.scrollHeight > m.clientHeight + 1,
      sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      wordShown: on('.marked') || on('.word'),
    };
  }, {s: scale, word: word});
}

test.describe('shrinking before shedding', () => {

  test('she is never left with a marked letter and no words at all', async ({page}) => {
    /* The whole point. Three chunks is the common case — most of the corpus splits into
       two or three — and at every screen and text size she can be on, the sentence that
       names the letter has to still be there. */
    await open(page, '2026-08-01');
    for(const [w, h] of [[320, 568], [360, 640], [390, 844], [412, 915]]){
      for(const scale of [0.9, 1, 1.2, 1.3, 1.4, 1.5]){
        for(const word of ['beautiful', 'remember', 'different']){
          const r = await checkAt(page, w, h, scale, word);
          expect(r.wordShown, `${w}x${h} @${scale} lost the word itself`).toBe(true);
          expect(r.verdict,
            `${w}x${h} @${scale} "${word}": no verdict — she got a marked letter and nothing else`)
            .toBe(true);
          expect(r.verdictText.length,
            `${w}x${h} @${scale} "${word}": the verdict was empty`).toBeGreaterThan(4);
          expect(r.clipped, `${w}x${h} @${scale} "${word}" is cut off`).toBe(false);
          expect(r.sideways, `${w}x${h} @${scale} "${word}" scrolls sideways`).toBe(false);
        }
      }
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('and the chips she is left with are still real tap targets', async ({page}) => {
    // The squeeze may take their size down but never below the target every other
    // tappable thing in here clears, because she taps them to hear the piece.
    await open(page, '2026-08-01');
    for(const [w, h] of [[320, 568], [360, 640], [390, 844]]){
      for(const scale of [0.9, 1, 1.2, 1.5]){
        for(const word of ['beautiful', 'interesting', 'because', 'remember']){
          const r = await checkAt(page, w, h, scale, word);
          for(const c of r.chips){
            expect(c.w, `${w}x${h} @${scale} chip "${c.t}" is ${c.w.toFixed(1)}px wide`)
              .toBeGreaterThanOrEqual(43.5);
            expect(c.h, `${w}x${h} @${scale} chip "${c.t}" is ${c.h.toFixed(1)}px tall`)
              .toBeGreaterThanOrEqual(43.5);
          }
        }
      }
    }
  });

  test('nothing is shrunk on a screen with room to spare', async ({page}) => {
    // A rung that fires when it is not needed would make every screen worse to save
    // the one that is short, so the attribute has to be absent on a roomy one.
    await open(page, '2026-08-01');
    for(const [w, h] of [[390, 844], [412, 915]]){
      for(const scale of [0.9, 1]){
        const r = await checkAt(page, w, h, scale, 'beautiful');
        expect(r.squeezed, `${w}x${h} @${scale} was squeezed with room to spare`).toBeNull();
        expect(r.dots, `${w}x${h} @${scale} lost the dots`).toBe(true);
      }
    }
  });

  test('it goes one rung at a time, not straight to the bottom', async ({page}) => {
    /* Two rungs exist so she loses only as much as the screen needs. If the first one
       were skipped the chips would come down a size on screens that only needed the
       caption smaller. Somewhere between roomy and desperate there has to be a screen
       sitting on rung one. */
    await open(page, '2026-08-01');
    const seen = new Set();
    for(const [w, h] of [[320, 568], [360, 640], [390, 844], [412, 915]]){
      for(const scale of [0.9, 1, 1.2, 1.3, 1.4, 1.5]){
        const r = await checkAt(page, w, h, scale, 'beautiful');
        seen.add(String(r.squeezed));
      }
    }
    expect([...seen].sort(), 'the rungs are not all reachable').toEqual(['1', '2', 'null']);
  });

  test('the squeeze is let out again when she moves to a screen with room', async ({page}) => {
    // A sticky attribute would shrink the next screen for no reason at all.
    await open(page, '2026-08-01');
    await checkAt(page, 320, 568, 1.5, 'beautiful');
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-squeezed')))
      .not.toBeNull();
    await page.setViewportSize({width: 412, height: 915});
    const r = await checkAt(page, 412, 915, 0.9, 'said');
    expect(r.squeezed, 'the squeeze stayed on after the screen got room back').toBeNull();
  });

  test('the look stage keeps its instruction too', async ({page}) => {
    /* The same mechanism was costing her the line that tells her what to do with the
       word before she has covered it up. The button still says "Cover it up", so this
       was never as bad as the silent verdict — but a shrink recovers it for free. */
    await open(page, '2026-08-01');
    await page.setViewportSize({width: 320, height: 568});
    const r = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.settings.textScale = 1.3;
      a.state.words.lists = [{id: 'lk', name: 'T', words: ['beautiful', 'said']}];
      a.state.words.activeId = 'lk';
      a.state.words.mastery = {}; a.state.words.sessions = [];
      a.save(); a.go('day'); if(!a.session()) a.start();
      const m = document.querySelector('#screen');
      const note = m.querySelector('.note');
      return {stage: a.session().stage,
              note: !!note && getComputedStyle(note).display !== 'none',
              clipped: m.scrollHeight > m.clientHeight + 1};
    });
    expect(r.stage).toBe('look');
    expect(r.note, 'the instruction on the look stage was shed rather than shrunk').toBe(true);
    expect(r.clipped).toBe(false);
  });

  test('landscape at her largest text is not simply cut off', async ({page}) => {
    /* The other end of the same problem. Turned sideways with the text right up, dropping
       the note, the dots and the caption still left the panel a few pixels too tall and
       the screen was cut off — which is worse than losing any caption, because what gets
       cut is part of the word. The chips are the last thing on the list now: they hold on
       one step longer than the caption, not forever, and data-cramped already drops them
       when the keyboard is up. */
    await open(page, '2026-08-01');
    for(const [w, h] of [[568, 320], [667, 375], [740, 360], [844, 390], [896, 414]]){
      for(const scale of [1, 1.2, 1.3, 1.5, 1.6]){
        const r = await checkAt(page, w, h, scale, 'beautiful');
        expect(r.clipped, `${w}x${h} @${scale} sideways: the screen is cut off`).toBe(false);
        expect(r.wordShown, `${w}x${h} @${scale} sideways: lost the word itself`).toBe(true);
      }
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('the chips only go after the caption has already gone', async ({page}) => {
    // Their place at the end of the shed list is the whole point of them being there.
    await open(page, '2026-08-01');
    const order = await page.evaluate(() => window.__acorn.shedOrder().word);
    expect(order.indexOf('.syls'), '.syls is not on the shed list').toBeGreaterThan(-1);
    expect(order.indexOf('.syls'), '.syls would go before the caption')
      .toBeGreaterThan(order.indexOf('.verdict'));
    expect(order[order.length - 1], '.syls is not the last thing to go').toBe('.syls');
    /* And the shed list never reaches them while the caption is still up. data-cramped
       does hide the chips with the caption still showing, and that is the same judgement
       running the other way: with a keyboard up in landscape there is no room for a
       picture of the word, and a caption is cheap. So the claim here is about the shed
       list only, which is why the cramped screens are stepped over rather than asserted
       on — an earlier version of this test asserted on them too and was simply wrong. */
    for(const [w, h] of [[568, 320], [740, 360], [320, 568], [390, 844]]){
      for(const scale of [1, 1.3, 1.5, 1.6]){
        const r = await checkAt(page, w, h, scale, 'beautiful');
        if(r.cramped) continue;
        if(!r.syls)
          expect(r.verdict, `${w}x${h} @${scale}: the chips went while the caption was still up`)
            .toBe(false);
      }
    }
  });

  test('every selector the squeeze names can still match something', async ({page}) => {
    /* The same trap the shed list fell into for four versions: a rule that describes a
       screen that no longer exists goes on passing quietly. So render the screens these
       rules are for and check each one has the element it claims to size. */
    await open(page, '2026-08-01');
    await page.setViewportSize({width: 320, height: 568});
    const r = await checkAt(page, 320, 568, 1.5, 'beautiful');
    expect(r.chips.length, '.syl matched nothing on the verdict screen').toBeGreaterThan(0);
    const has = await page.evaluate(() => {
      // The verdict element exists in the markup even when the shed list hides it.
      return !!document.querySelector('#screen .verdict');
    });
    expect(has, '.verdict matched nothing on the verdict screen').toBe(true);
    expect(errorsOf(page)).toEqual([]);
  });

});
