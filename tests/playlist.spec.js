// The playlist — one editable pool a grown-up curates as they go.
//
// The weekly-list model meant a one-off word became its own tiny named list. This is the
// model that fits how a parent actually works: add a word she is on, drop one she is done
// with, and move one up to be the next she meets. The order is the queue of words she has
// not met yet; the pacing still drips them in a couple at a time.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

const pool = page => page.evaluate(() => {
  const l = (window.__acorn.state.words.lists || []).find(x => x.id === 'own');
  return l ? l.words.slice() : null;
});
const rows = page => page.evaluate(() =>
  [...document.querySelectorAll('.pw-word')].map(n => n.textContent));

async function onParent(page){
  await open(page, '2026-08-01');
  await page.evaluate(() => window.__acorn.go('parent'));
}
async function add(page, text){
  await page.locator('#addword').fill(text);
  await page.locator('#addwordGo').click();
}

test.describe('the playlist', () => {

  test('adding a word or a few builds one pool and makes it hers', async ({page}) => {
    await onParent(page);
    await add(page, 'banana, orchard giraffe');       // commas or spaces
    expect(await pool(page)).toEqual(['banana', 'orchard', 'giraffe']);
    expect(await rows(page)).toEqual(['banana', 'orchard', 'giraffe']);
    // Her new words come from the pool she is curating.
    expect(await page.evaluate(() => window.__acorn.state.words.activeId)).toBe('own');
    expect(errorsOf(page)).toEqual([]);
  });

  test('the box is cleared and Enter adds too', async ({page}) => {
    await onParent(page);
    await page.locator('#addword').fill('banana');
    await page.keyboard.press('Enter');
    expect(await pool(page)).toEqual(['banana']);
    expect(await page.locator('#addword').inputValue(), 'the box kept the word').toBe('');
  });

  test('a word already on the list is not added twice', async ({page}) => {
    await onParent(page);
    await add(page, 'banana, orchard');
    await add(page, 'Banana, ORCHARD, plum');         // case-insensitive dedup
    expect(await pool(page)).toEqual(['banana', 'orchard', 'plum']);
  });

  test('nothing usable is refused, not added blank', async ({page}) => {
    await onParent(page);
    for(const junk of ['', '   ', ',,,', '...', '1. 2.']){
      await add(page, junk);
      expect(await pool(page), `${JSON.stringify(junk)} made a pool`).toBeNull();
      await expect(page.locator('#toast')).toContainText(/Type a word/);
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('moving a word up makes it the next new word she meets', async ({page}) => {
    /* The whole point of reordering — "she has a test on giraffe, put it next". Up and down
       shuffle the queue; the first word she has not met yet is the next new one introduced. */
    await onParent(page);
    await add(page, 'banana, orchard, giraffe');
    await page.locator('[data-wordup="2"]').click();   // giraffe up
    await page.locator('[data-wordup="1"]').click();    // giraffe to top
    expect(await pool(page)).toEqual(['giraffe', 'banana', 'orchard']);
    const first = await page.evaluate(() => {
      const a = window.__acorn;
      a.go('day'); if(!a.session()) a.start();
      // The new (never-met) words she is being introduced to, in order.
      return a.session().words.filter(w => !a.state.words.mastery[w]);
    });
    expect(first[0], 'the word moved to the top was not the next new one').toBe('giraffe');
  });

  test('down moves it later, and the ends are fixed', async ({page}) => {
    await onParent(page);
    await add(page, 'a-word, b-word, c-word');
    await page.locator('[data-worddown="0"]').click();  // a-word down
    expect(await pool(page)).toEqual(['b-word', 'a-word', 'c-word']);
    // The top row cannot go up, the bottom row cannot go down.
    await expect(page.locator('[data-wordup="0"]')).toBeDisabled();
    await expect(page.locator('[data-worddown="2"]')).toBeDisabled();
  });

  test('removing a word keeps her progress for when it comes back', async ({page}) => {
    /* Mastery is keyed by word, so taking a word off the list does not wipe what she knows —
       adding it back later resumes. This is what the hint promises her grown-up. */
    await open(page, '2026-08-01');
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id: 'own', name: 'My list', words: ['banana', 'orchard']}];
      a.state.words.activeId = 'own';
      a.state.words.mastery = {banana: {box: 4, right: 4, wrong: 0, lastSeen: '2026-07-28'}};
      a.save(); a.go('parent');
    });
    await page.locator('[data-wordrm="0"]').click();     // remove banana
    expect(await pool(page)).toEqual(['orchard']);
    expect(await page.evaluate(() => window.__acorn.state.words.mastery.banana),
      'her progress on the removed word was wiped').toBeTruthy();
    await add(page, 'banana');
    expect(await page.evaluate(() => window.__acorn.state.words.mastery.banana.box),
      'her progress did not resume when it came back').toBe(4);
  });

  test('emptying the pool tidies it away and moves her onto a real list', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id: 'own', name: 'My list', words: ['banana']}];
      a.state.words.activeId = 'own';
      a.state.words.mastery = {}; a.save(); a.go('parent');
    });
    await page.locator('[data-wordrm="0"]').click();
    expect(await pool(page), 'an empty pool was left behind').toBeNull();
    const active = await page.evaluate(() => window.__acorn.state.words.activeId);
    expect(active, 'she was left on a list that no longer exists').not.toBe('own');
    // And the app still works — a session builds.
    const ok = await page.evaluate(() => { window.__acorn.go('day'); return !!window.__acorn.start(); });
    expect(ok).toBe(true);
    expect(errorsOf(page)).toEqual([]);
  });

  test('every control is a real tap target', async ({page}) => {
    await onParent(page);
    await add(page, 'banana, orchard, giraffe');
    const small = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll('#addwordGo, .pw-btn:not([disabled])').forEach(el => {
        const r = el.getBoundingClientRect();
        if(r.width < 44 || r.height < 44) bad.push((el.className || el.id) + ' ' +
          Math.round(r.width) + 'x' + Math.round(r.height));
      });
      return bad;
    });
    expect(small).toEqual([]);
  });

  test('markup in an added word is text, not markup', async ({page}) => {
    await onParent(page);
    await add(page, '<img src=x onerror=alert(1)>');
    // Whatever survived the parse is shown as text; no element is built from it.
    const built = await page.evaluate(() => document.querySelectorAll('.playlist img').length);
    expect(built).toBe(0);
    expect(errorsOf(page)).toEqual([]);
  });

  test('the pool survives a reload', async ({page}) => {
    await onParent(page);
    await add(page, 'banana, orchard');
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    expect(await pool(page)).toEqual(['banana', 'orchard']);
  });

});
