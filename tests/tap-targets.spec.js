// Everything she taps is big enough to tap.
//
// 44px is the floor Apple and WCAG both land on, and this stylesheet has its own scale
// for it — --tap at 3rem, with --tap-lg and --tap-xl above. Every button in the app is
// held to it except one: the syllable chunks under a word were sized by their padding
// and their letters, so the "ti" of "beau·ti·ful" measured 43px wide at her smallest
// text setting. One pixel, on the buttons a nine-year-old taps to hear a piece of a
// word said slowly.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

// Words chosen for short chunks: beau·ti·ful and te·le·vi·sion both give two-letter
// pieces, which is the narrow case.
const STAGES = {
  look:   a => { if(!a.session()) a.start(); },
  marked: a => { if(!a.session()) a.start();
                 if(a.session().stage === 'look') a.cover();
                 a.type('beatiful'); a.check(); },
  write:  a => { if(!a.session()) a.start();
                 if(a.session().stage === 'look') a.cover(); },
  done:   a => { if(!a.session()) a.start();
                 for(let g = 0; g < 90 && a.session(); g++){
                   const W = a.session();
                   if(W.stage === 'look'){ a.cover(); continue; }
                   if(W.stage === 'write'){ a.type(W.words[W.i]); a.check(); a.next(); continue; }
                   a.next();
                 } },
  parent: a => { a.go('parent'); },
};

test.describe('tap targets', () => {

  test('nothing tappable is under 44px on either side, at any text size', async ({page}) => {
    const tooSmall = [];
    for(const vp of [{width: 320, height: 568}, {width: 390, height: 844}]){
      await page.setViewportSize(vp);
      for(const scale of [0.8, 0.9, 1, 1.15, 1.5, 1.6]){
        for(const [name, fn] of Object.entries(STAGES)){
          await open(page, '2026-08-01');
          await page.evaluate(s => {
            const a = window.__acorn;
            a.state.settings.textScale = s;
            a.state.words.lists = [{id: 'x', name: 'T', words: ['beautiful', 'television', 'rain']}];
            a.state.words.activeId = 'x';
            a.save(); a.go('parent'); a.go('day');
          }, scale);
          await page.evaluate(`(${fn.toString()})(window.__acorn)`);
          const bad = await page.evaluate(() => {
            const out = [];
            document.querySelectorAll('button, input, [role=button], a[href]').forEach(e => {
              // #kbhold is a 1px input that exists to hold the software keyboard open
              // and is deliberately unreachable — tabindex -1, aria-hidden, no pointer
              // events.
              if(e.id === 'kbhold') return;
              const cs = getComputedStyle(e);
              if(cs.display === 'none' || cs.visibility === 'hidden'
                 || cs.pointerEvents === 'none') return;
              const r = e.getBoundingClientRect();
              if(!r.width || !r.height) return;
              // The visible box, or the reach of a ::after pad if it has one — the
              // wordmark is a small drawing with a --tap hit area behind it.
              const pad = getComputedStyle(e, '::after');
              const pw = parseFloat(pad.width) || 0, ph = parseFloat(pad.height) || 0;
              const w = Math.max(r.width, pad.content !== 'none' ? pw : 0);
              const h = Math.max(r.height, pad.content !== 'none' ? ph : 0);
              if(w < 44 || h < 44)
                out.push(`${e.id || e.className || e.tagName}: ${Math.round(w)}x${Math.round(h)}`);
            });
            return [...new Set(out)];
          });
          bad.forEach(b => tooSmall.push(`${vp.width}px ${scale}x ${name}: ${b}`));
        }
      }
    }
    expect([...new Set(tooSmall)]).toEqual([]);
  });

  // (Until 13.20 there was a test here holding a one-letter syllable chip — "e·nough",
  // "a·fraid" — to the 44px floor, the narrowest a tappable chunk could be. The chips became
  // faint drawn seams (13.20), and those are gone too now (13.31 — the splits were still wrong
  // often enough that a wrong break shown under the word was worse than none, David). There is
  // no syllable control of any kind on the word screen; that is asserted in spelling.spec.js
  // ("there is no syllable control on the word screen, and the word keeps its spellout").)

  test('every tappable thing is sized off the tap scale, not by its contents',
    async ({page}) => {
      // The rule that stops this coming back: a button whose height is whatever its
      // padding and font happen to add up to will drift below the floor the next time
      // either changes.
      await open(page, '2026-08-01');
      const held = await page.evaluate(() => {
        const sheet = [...document.styleSheets].find(s => !s.href);
        // The syllable chips are gone (and the seams that replaced them, 13.31), so the tappable
        // things left are these, and each has to name --tap so its size cannot drift below the
        // floor the next time a padding or a font changes.
        const want = /^(\.quiet|\.seg button|\.chip|\.back|\.swatch)/;
        const seen = {};
        const walk = rules => {
          for(const r of rules){
            if(r.style && r.selectorText && want.test(r.selectorText)){
              const mh = r.style.getPropertyValue('min-height');
              const mw = r.style.getPropertyValue('min-width');
              if(mh || mw) seen[r.selectorText] = (mh + ' ' + mw).trim();
            }
            if(r.cssRules && r.cssRules.length) walk(r.cssRules);
          }
        };
        walk(sheet.cssRules);
        return seen;
      });
      for(const sel of ['.quiet', '.chip', '.back', '.swatch']){
        expect(Object.keys(held), `${sel} is no longer held to the tap scale`).toContain(sel);
        expect(held[sel], `${sel} is not held to the tap scale`).toMatch(/var\(--tap\)/);
      }
    });

});
