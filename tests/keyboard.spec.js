// The software keyboard closing between stages made the two buttons drop to the
// bottom of the screen and jump back up on the next word — twice per word. A
// focused input is kept on the page so the keyboard never closes mid-session.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

// Chromium's pointer media depends on device emulation, so the touch case is
// made explicit rather than inferred.
async function pretendTouch(page, coarse){
  await page.evaluate(c => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = q => /pointer: coarse|hover: none/.test(q)
      ? {matches: c, media: q, addListener(){}, removeListener(){},
         addEventListener(){}, removeEventListener(){}}
      : real(q);
  }, coarse);
}

async function startOn(page, words){
  await page.evaluate(ws => {
    const a = window.__acorn;
    a.state.words.lists = [{id:'w1', name:'T', words:ws}];
    a.state.words.activeId = 'w1'; a.state.words.mastery = {}; a.state.words.sessions = [];
    a.save(); a.go('parent'); a.go('day');
  }, words);
}
const focused = page => page.evaluate(() =>
  document.activeElement.id || document.activeElement.className || document.activeElement.tagName);

test.describe('keeping the keyboard open', () => {

  test('a focused input is held through every stage of a word', async ({page}) => {
    await open(page, '2026-08-01');
    await pretendTouch(page, true);
    await startOn(page, ['because','friend','thought']);
    await page.evaluate(() => window.__acorn.holdKeyboard());
    expect(await focused(page), 'look stage').toBe('kbhold');

    await page.locator('#cover').click();
    expect(await focused(page), 'write stage').toBe('type');   // the real box takes over

    await page.locator('#type').fill('becuase');
    await page.locator('#check').click();
    expect(await focused(page), 'check stage').toBe('kbhold');

    await page.locator('#next').click();
    expect(await focused(page), 'next word').toBe('kbhold');
    expect(errorsOf(page)).toEqual([]);
  });

  test('tapping Hear it does not let the keyboard go', async ({page}) => {
    await open(page, '2026-08-01');
    await pretendTouch(page, true);
    await startOn(page, ['because','friend']);
    await page.locator('#hear').click();
    // The tap moved focus to the button; it must come back.
    expect(await focused(page)).toBe('kbhold');
  });

  test('it lets go when the sitting ends', async ({page}) => {
    await open(page, '2026-08-01');
    await pretendTouch(page, true);
    await startOn(page, ['rain']);
    // A word she has never met is asked twice, so the sitting is not over after
    // one answer — walk it to the end rather than assuming.
    for(let i = 0; i < 12; i++){
      if(!await page.evaluate(() => !!window.__acorn.session())) break;
      if(await page.locator('#cover').count()) await page.locator('#cover').click();
      else if(await page.locator('#type').count()){
        await page.locator('#type').fill('rain');
        await page.locator('#check').click();
      }
      else if(await page.locator('#next').count()) await page.locator('#next').click();
    }
    expect(await page.evaluate(() => !!window.__acorn.session())).toBe(false);
    expect(await focused(page)).not.toBe('kbhold');
  });

  test('and on the grown-ups screen, where there is nothing to type', async ({page}) => {
    await open(page, '2026-08-01');
    await pretendTouch(page, true);
    await startOn(page, ['because']);
    await page.evaluate(() => window.__acorn.go('parent'));
    expect(await focused(page)).not.toBe('kbhold');
  });

  test('never for someone driving by keyboard', async ({page}) => {
    await open(page, '2026-08-01');
    await pretendTouch(page, true);
    await startOn(page, ['because','friend']);
    await page.keyboard.press('Tab');                 // now a keyboard user
    await page.evaluate(() => window.__acorn.holdKeyboard());
    expect(await focused(page)).not.toBe('kbhold');
  });

  test('never on a machine with a mouse', async ({page}) => {
    await open(page, '2026-08-01');
    await pretendTouch(page, false);                  // fine pointer, real keyboard
    await startOn(page, ['because','friend']);
    await page.evaluate(() => window.__acorn.holdKeyboard());
    expect(await focused(page)).not.toBe('kbhold');
  });

  test('it is out of the tab order and not announced', async ({page}) => {
    await open(page, '2026-08-01');
    const h = await page.evaluate(() => {
      const n = document.querySelector('#kbhold');
      const cs = getComputedStyle(n);
      return {tabIndex: n.tabIndex, hidden: n.getAttribute('aria-hidden'),
              display: cs.display, visibility: cs.visibility,
              inApp: !!document.querySelector('#app #kbhold')};
    });
    expect(h.tabIndex).toBe(-1);
    expect(h.hidden).toBe('true');
    // Neither of these may be used: both would drop the focus and let the
    // keyboard close, which is the whole point of the element.
    expect(h.display).not.toBe('none');
    expect(h.visibility).not.toBe('hidden');
    expect(h.inApp).toBe(false);                      // outside the app's content
  });

  test('stray typing while it holds focus never reaches her answer', async ({page}) => {
    await open(page, '2026-08-01');
    await pretendTouch(page, true);
    await startOn(page, ['because','friend']);
    await page.evaluate(() => window.__acorn.holdKeyboard());
    await page.keyboard.type('zzz');                  // taps a key on the look screen
    await page.locator('#cover').click();
    // The box she actually types into starts empty whatever she pressed before.
    expect(await page.locator('#type').inputValue()).toBe('');
    await page.locator('#type').fill('because');
    await page.locator('#check').click();
    await expect(page.locator('.verdict.ok')).toBeVisible();
  });
});
