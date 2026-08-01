// The word and the way she is told how she did survive a tight screen.
//
// History: fitScreen once had a "shrink before shedding" step — two rungs (data-squeezed)
// that took the syllable chips down a size, and then a padding, before the shed list started
// deleting rows. It existed for one reason: at 320px and her largest text the three chips of
// "beau·ti·ful" wrapped onto a second row and cost ~100px of height on a screen not short
// enough to count as tight, so the shed list ran to the end and took the sentence naming the
// letter with it — a rust-coloured letter and no words anywhere on the screen.
//
// 13.20 removed the chips. Their split is a faint seam drawn under the word itself now (a
// .seams overlay measured onto the word), which does not wrap and costs no row — so the whole
// squeeze machinery went with them. What still has to hold is the thing the squeeze was
// protecting: whatever the screen's size, she is never left with a marked letter and no words,
// the word is never clipped, and the screen never scrolls sideways. fitScreen still sheds
// (note, then dots, then the caption slot) least-useful-first when a screen genuinely will not
// fit; these tests hold the floor under that.
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
    // The verdict lives inside the reserved caption slot .supra, and the shed logic hides the
    // SLOT — so ask whether the verdict actually has a box on screen (getClientRects is empty
    // when it or any ancestor is display:none), not whether its own display is set.
    const v = m.querySelector('.verdict');
    const shown = sel => { const n = m.querySelector(sel); return !!n && n.getClientRects().length > 0; };
    return {
      verdict: shown('.verdict'),
      verdictText: shown('.verdict') ? v.textContent.trim() : '',
      dots: on('.dots'),
      cramped: document.documentElement.hasAttribute('data-cramped'),
      // The seam overlay drawn over the word, when the word has more than one syllable.
      seams: !!m.querySelector('.tracew .seams, .word .seams'),
      clipped: m.scrollHeight > m.clientHeight + 1,
      sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      // A miss re-traces now (WIN-1), so the word she is shown is in the trace box (.tracew), not
      // a marked word — either way she must never be left with no word on the screen.
      wordShown: on('.marked') || on('.word') || on('.tracew'),
    };
  }, {s: scale, word: word});
}

test.describe('the word and the verdict survive a tight screen', () => {

  test('she is never left with a marked letter and no words at all', async ({page}) => {
    /* The whole point. At every screen and text size she can be on, the sentence that names
       the letter — and the word it belongs to — has to still be there. */
    await open(page, '2026-08-01');
    for(const [w, h] of [[320, 568], [360, 640], [390, 844], [412, 915]]){
      for(const scale of [0.9, 1, 1.2, 1.3, 1.4, 1.5]){
        for(const word of ['beautiful', 'remember', 'different']){
          const r = await checkAt(page, w, h, scale, word);
          // A miss re-traces now (WIN-1) and carries no visible verdict (David: "ditch the
          // re-trace caption"), so the thing that must survive a tight screen is the WORD in its
          // box — the whole point of the re-trace is that she copies it — never cut off.
          expect(r.wordShown, `${w}x${h} @${scale} lost the word itself`).toBe(true);
          expect(r.clipped, `${w}x${h} @${scale} "${word}" is cut off`).toBe(false);
          expect(r.sideways, `${w}x${h} @${scale} "${word}" scrolls sideways`).toBe(false);
        }
      }
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('a roomy screen keeps its dots and its seams', async ({page}) => {
    // Nothing is shed on a screen with room to spare — the pebbles and the syllable seam are
    // both there, because shedding only fires when a screen genuinely will not fit.
    await open(page, '2026-08-01');
    for(const [w, h] of [[390, 844], [412, 915]]){
      for(const scale of [0.9, 1]){
        const r = await checkAt(page, w, h, scale, 'beautiful');
        expect(r.dots, `${w}x${h} @${scale} lost the dots with room to spare`).toBe(true);
        expect(r.seams, `${w}x${h} @${scale} lost the syllable seam with room to spare`).toBe(true);
        expect(r.clipped, `${w}x${h} @${scale} was cut off with room to spare`).toBe(false);
      }
    }
  });

  test('the look stage fits without being cut off', async ({page}) => {
    /* The trace carries no instruction line any more (WIN-4: "no other text" — the spoken
       announcement still says "Trace this word"). What must still hold at her large text on the
       narrowest phone is that the trace itself — the word and its box — is never cut off. */
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
      return {stage: a.session().stage,
              note: !!m.querySelector('.note'),
              traceShown: !!m.querySelector('.trace'),
              clipped: m.scrollHeight > m.clientHeight + 1};
    });
    expect(r.stage).toBe('look');
    expect(r.note, 'the trace should carry no instruction line now').toBe(false);
    expect(r.traceShown).toBe(true);
    expect(r.clipped).toBe(false);
  });

  test('landscape at her largest text is not simply cut off', async ({page}) => {
    /* The other end of the same problem. Turned sideways with the text right up, dropping the
       note, the dots and the caption still left the panel a few pixels too tall and the screen
       was cut off — which is worse than losing any caption, because what gets cut is part of
       the word. */
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

});
