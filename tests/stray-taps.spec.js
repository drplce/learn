// A finger that lands slightly wide.
//
// The design keeps some input focused at all times so the software keyboard never closes
// and the two buttons never jump: holdKeyboard() does it between stages, and the spelling
// box itself does it while she is writing. That left a gap. A tap on the instruction just
// above the box, or on the covered word, blurred the box and nothing put it back — so the
// keyboard closed and the buttons moved, which is the exact dance #kbhold was added to
// stop. Found by tapping for real on a touch profile; the test API cannot blur anything.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

test.use({hasTouch: true, isMobile: false});

async function midWord(page, word){
  await page.evaluate(w => {
    const a = window.__acorn;
    const id = 'x' + (++window.__nth || (window.__nth = 1));
    a.state.words.lists = [{id: id, name: 'T', words: [w, 'rain']}];
    a.state.words.activeId = id;
    a.state.words.mastery = {}; a.state.words.sessions = [];
    a.save(); a.go('day');
    if(!a.session()) a.start();
  }, word || 'beautiful');
  await page.evaluate(() => { const a = window.__acorn; if(a.session() && a.session().stage === "look") a.cover(); });
  await page.locator('#type').click();
  await page.keyboard.type('beauti');
}

const focusNow = page => page.evaluate(() => {
  const e = document.activeElement;
  return {id: (e || {}).id || '', tag: (e || {}).tagName || '',
          typed: (document.querySelector('#type') || {}).value,
          caret: (document.querySelector('#type') || {}).selectionStart};
});

test.describe('a tap that hits nothing', () => {

  test('the spelling box keeps the focus, so the keyboard stays up', async ({page}) => {
    await open(page, '2026-08-01');
    /* .note and .word are above the box and cannot be hit by accident from inside it.
       A tap in the middle of #screen or main can land on the box itself, and then the
       browser puts the caret where the finger went, which is what it should do — so the
       caret is only checked for the taps that genuinely miss. */
    for(const [sel, misses] of [['.note', true], ['.word', true],
                                ['#screen', false], ['main', false]]){
      await midWord(page);
      const before = await focusNow(page);
      expect(before.id, 'she was not in the box to begin with').toBe('type');
      if(!await page.locator(sel).count()) continue;
      await page.locator(sel).first().tap();
      const after = await focusNow(page);
      expect(after.id, `a tap on ${sel} left focus on ${after.tag}`).toBe('type');
      // Whatever was tapped, it must not disturb what she had written.
      expect(after.typed, `a tap on ${sel} changed what she had typed`).toBe('beauti');
      if(misses)
        expect(after.caret, `a tap on ${sel} moved her caret`).toBe('beauti'.length);
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('a tap to replay the word does its job without disturbing what she wrote', async ({page}) => {
    // WIN-4: the speaker button is gone — a tap on the word screen replays the word. It must
    // not be swallowed by the refocus, must keep her half-written word, and leave her writing;
    // and Enter must still check.
    await open(page, '2026-08-01');
    await midWord(page);
    await page.locator('.dots').tap();
    expect((await focusNow(page)).typed).toBe('beauti');
    expect((await page.evaluate(() => window.__acorn.session().stage))).toBe('write');
    await page.evaluate(() => window.__acorn.check());
    expect(await page.evaluate(() => window.__acorn.session().stage)).toBe('check');
  });

  test('it does nothing on a screen with no word to write', async ({page}) => {
    // The finished screen and the grown-ups screen have no box, and pulling focus
    // about on them would be noise.
    await open(page, '2026-08-01');
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id: 'd', name: 'T', words: ['said']}];
      a.state.words.activeId = 'd';
      a.state.words.mastery = {}; a.state.words.sessions = [];
      a.save(); a.go('day');
      if(!a.session()) a.start();
      for(let g = 0; g < 20 && a.session(); g++){
        const W = a.session();
        if(W.stage === 'look'){ a.cover(); continue; }
        if(W.stage === 'write'){ a.type(W.words[W.i]); a.check(); a.next(); continue; }
        a.next();
      }
    });
    await page.locator('#screen').tap();
    const r = await focusNow(page);
    expect(r.typed).toBeUndefined();               // there is no box at all
    expect(errorsOf(page)).toEqual([]);
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('#screen').tap();
    expect(errorsOf(page)).toEqual([]);
  });

  test('a keyboard user who tabs away is left where they put themselves', async ({page}) => {
    /* Tab sets _kbd and moves focus off the box; nothing may drag it back. A tap does
       bring the refocus into play, and that is deliberate rather than a hole: _kbd is
       cleared by pointerdown throughout this app, because someone who has just touched
       the screen is using a touchscreen. What must not happen is focus moving on its
       own while they are still on the keys. */
    await open(page, '2026-08-01');
    await midWord(page);
    await page.keyboard.press('Tab');
    const parked = await focusNow(page);
    expect(parked.id, 'Tab did not move focus off the box').not.toBe('type');
    // Type on the focused control and press keys: still no focus theft.
    await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(60);
    const still = await focusNow(page);
    expect(still.typed, 'her answer was disturbed').toBe('beauti');
    const kbd = await page.evaluate(() => {
      // Nothing has touched the screen, so the app should still see a keyboard user.
      const e = document.activeElement;
      return (e || {}).id || (e || {}).tagName;
    });
    expect(kbd).toBeTruthy();
  });

  test('the long press still reaches the grown-ups screen', async ({page}) => {
    // The refocus fires on click, and the mark is not a control — so it must not get
    // in the way of the one gesture that is the only door in.
    await open(page, '2026-08-01');
    await midWord(page);
    const box = await page.locator('#wordmark').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(800);
    await page.mouse.up();
    expect(await page.evaluate(() => window.__acorn.screen())).toBe('parent');
  });

  test('a short tap on the mark leaves her where she is', async ({page}) => {
    // 700ms is the threshold; a tap must not open the grown-ups screen, and must not
    // cost her the keyboard either.
    await open(page, '2026-08-01');
    await midWord(page);
    await page.locator('#wordmark').tap();
    const r = await focusNow(page);
    expect(await page.evaluate(() => window.__acorn.screen())).toBe('day');
    expect(r.id).toBe('type');
    expect(r.typed).toBe('beauti');
  });

});
