// Nothing she taps is text to select.
//
// On the phone a press-and-hold on a pebble, the acorn mark or the back button raised the blue
// selection highlight and the iOS callout — which on a screen that is all pictures and buttons
// reads as "did I break it?". Everything is user-select:none now; the two boxes she types into
// keep it, so a grown-up can still edit a name or a pasted list.
const {test, expect} = require('@playwright/test');
const {open} = require('./helpers');

const sel = (page, s) => page.evaluate(q => {
  const el = document.querySelector(q);
  if(!el) return null;
  const cs = getComputedStyle(el);
  return cs.webkitUserSelect || cs.userSelect;
}, s);

test.describe('nothing she taps is selectable', () => {

  test('the mark, the pebbles and the way back cannot be selected or held', async ({page}) => {
    await open(page, '2026-08-01');
    // On a word: the mark and the current-word pebble.
    await page.evaluate(() => { const a = window.__acorn; if(!a.session()) a.start(); });
    expect(await sel(page, '#wordmark'), 'the acorn mark is selectable').toBe('none');
    expect(await sel(page, '.dots i'), 'a progress pebble is selectable').toBe('none');
    // The whole app is none by default, so a press-hold callout has nothing to grab.
    expect(await sel(page, 'body'), 'the page is selectable').toBe('none');

    // The finished screen: its garden.
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'w1', name:'T', words:['rain','boat','said']}];
      a.state.words.activeId = 'w1'; a.save(); a.go('parent'); a.go('day');
      if(!a.session()) a.start();
      for(let g = 0; g < 40 && a.session(); g++){
        const W = a.session();
        if(W.stage === 'look'){ a.cover(); continue; }
        if(W.stage === 'write'){ a.type(W.words[W.i]); a.check(); a.next(); continue; }
        a.next();
      }
    });
    expect(await sel(page, '#screen .net'), 'the garden is selectable').toBe('none');

    // The grown-ups screen: the way back.
    await page.evaluate(() => window.__acorn.go('parent'));
    expect(await sel(page, '.back'), 'the back button is selectable').toBe('none');
  });

  test('the boxes she types into keep selection, so a grown-up can edit', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    // The name field and the paste box are real text she may want to correct.
    expect(await sel(page, '#pname'), 'the name field lost selection').toBe('text');
    expect(await sel(page, '#paste'), 'the paste box lost selection').toBe('text');
  });
});
