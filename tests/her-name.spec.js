// Her name, which is the one piece of her the app holds.
//
// A grown-up types a first name and it is rendered into the praise she reads at the end
// of an evening. Nothing bounded it. Typed for real at 320px and her largest text, forty
// unbroken characters ran straight out of the 269px praise box, and past about that
// length the whole line was shed off the finished screen — so she got no praise at all.
// "Bartholomew-Wilhelmina" was always fine, because the hyphen is somewhere to break;
// it takes something pasted or hammered into the field, which is precisely the case
// nothing was checking.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

async function praiseWith(page, name, opts){
  const o = opts || {};
  return page.evaluate(({n, w, s}) => {
    const a = window.__acorn;
    a.state.profile.name = n;
    a.state.settings.textScale = s;
    a.state.words.lists = [{id: 'n' + (++window.__nth || (window.__nth = 1)),
                            name: 'T', words: ['said', 'rain']}];
    a.state.words.activeId = a.state.words.lists[0].id;
    a.state.words.mastery = {}; a.state.words.sessions = [];
    a.save(); a.go('parent'); a.go('day');
    if(!a.session()) a.start();
    for(let g = 0; g < 20 && a.session(); g++){
      const W = a.session();
      if(W.stage === 'look'){ a.cover(); continue; }
      if(W.stage === 'write'){ a.type(W.words[W.i]); a.check(); a.next(); continue; }
      a.next();
    }
    // The praise she reads went wordless (David) — it is spoken now, not drawn — so her name in
    // it is read off the live region (#say). The finished screen itself carries no praise box.
    const de = document.documentElement;
    const scr = document.querySelector('#screen');
    return {
      said: (document.querySelector('#say') || {}).textContent || '',
      sideways: de.scrollWidth > de.clientWidth + 1,
      clipped: scr.scrollHeight > scr.clientHeight + 1,
      html: scr.innerHTML,
    };
  }, {n: name, w: o.word, s: o.scale || 1});
}

test.describe('her name in the praise', () => {

  test('a name of any length never breaks the finished screen', async ({page}) => {
    // The praise carrying her name is spoken now, not drawn, so a long name can no longer run out
    // of a visible box — but it still must not break the layout by any other path, at her largest
    // text on the smallest phone.
    await open(page, '2026-08-01');
    await page.setViewportSize({width: 320, height: 568});
    for(const name of ['Ivy', 'Charlotte', 'Bartholomew-Wilhelmina', 'Mary Elizabeth Anne',
                       "O'Sullivan-Fitzgerald", 'A'.repeat(32)]){
      const r = await praiseWith(page, name, {scale: 1.5});
      expect(r.sideways, `"${name.slice(0, 20)}" made the page scroll sideways`).toBe(false);
      expect(r.clipped, `"${name.slice(0, 20)}" cut the screen off`).toBe(false);
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('and she still gets her praise, spoken, however long her name', async ({page}) => {
    // The failure past forty characters was a disappearance: the visible line grew until fitScreen
    // dropped it, and the evening ended with nothing said. Spoken through the live region it cannot
    // be shed — the praise, with her name, is there whatever the name.
    await open(page, '2026-08-01');
    await page.setViewportSize({width: 320, height: 568});
    for(const name of ['Ivy', 'Bartholomew-Wilhelmina', 'A'.repeat(32)]){
      const r = await praiseWith(page, name, {scale: 1.5});
      expect(r.said, `"${name.slice(0, 20)}" cost her the praise entirely`).toContain('Great effort');
    }
  });

  test('the field will not take more than a first name', async ({page}) => {
    // The typed path writes straight to state; only load() bounded it, so a name typed
    // in today stayed however long it was until the next reload.
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('#pname').click();
    await page.keyboard.type('A'.repeat(80));
    const stored = await page.evaluate(() => window.__acorn.state.profile.name);
    expect(stored.length, 'the field took a name of any length').toBeLessThanOrEqual(32);
    expect(await page.locator('#pname').getAttribute('maxlength')).toBe('32');
  });

  test('a restored backup cannot smuggle a longer one in', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => {
      localStorage.setItem('acorn.v1', JSON.stringify({
        profile: {name: '  ' + 'B'.repeat(500) + '  ', createdAt: '2026-07-01'},
        words: {lists: [], mastery: {}, activeId: 'easy', sessions: []},
        settings: {textScale: 1, tint: 'cream', readAloud: true, sound: true, voice: null},
      }));
    });
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    const n = await page.evaluate(() => window.__acorn.state.profile.name);
    expect(n.length).toBeLessThanOrEqual(32);
    // And trimmed: " Ivy " is not a name with spaces round it.
    expect(n).toBe(n.trim());
    expect(errorsOf(page)).toEqual([]);
  });

  test('a name that is not a string at all does not stop the app', async ({page}) => {
    await open(page, '2026-08-01');
    for(const junk of ['null', '123', '{"a":1}', '["Ivy"]', 'true']){
      await page.evaluate(j => {
        localStorage.setItem('acorn.v1', JSON.stringify({
          profile: {name: JSON.parse(j), createdAt: '2026-07-01'},
          words: {lists: [], mastery: {}, activeId: 'easy', sessions: []},
          settings: {textScale: 1, tint: 'cream', readAloud: true, sound: true, voice: null},
        }));
      }, junk);
      await page.reload();
      await page.waitForFunction(() => !!window.__acorn);
      const r = await page.evaluate(() => ({
        name: window.__acorn.state.profile.name,
        alive: !!document.querySelector('#screen')
               && document.querySelector('#screen').children.length > 0,
      }));
      expect(typeof r.name, `a stored name of ${junk} came through as ${typeof r.name}`)
        .toBe('string');
      expect(r.alive, `a stored name of ${junk} left an empty screen`).toBe(true);
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('markup in the name is text, not markup', async ({page}) => {
    // It is spoken into the announcement (the live region) and written back into the field she was
    // typed in. Both have to escape her — no element built from her name, wherever it lands.
    await open(page, '2026-08-01');
    const r = await praiseWith(page, '<b>bold</b><img src=x onerror=alert(1)>');
    expect(r.said, 'the name did not reach the spoken praise at all').toContain('bold');
    /* announce() sets #say by textContent, so the literal characters "<b>bold</b>" ARE present as
       text — that is her name rendered as text and is the correct outcome, not a leak. What matters
       is that no element was built from it, so the check is on the tree, not on the characters. */
    const built = await page.evaluate(() => ({
      b: document.querySelectorAll('#say b, #screen b').length,
      img: document.querySelectorAll('#say img, #screen img').length,
    }));
    expect(built.b, 'a <b> element was built from her name').toBe(0);
    expect(built.img, 'an <img> element was built from her name').toBe(0);
    await page.evaluate(() => window.__acorn.go('parent'));
    const inField = await page.locator('#pname').inputValue();
    expect(inField).toContain('<b>');           // the literal characters, in the box
    expect(errorsOf(page)).toEqual([]);
  });

  test('an empty or blank name leaves the praise reading properly', async ({page}) => {
    await open(page, '2026-08-01');
    for(const name of ['', '   ', '\t']){
      const r = await praiseWith(page, name);
      // Spoken now: a clean "Great effort." with no dangling comma where the empty name slot was
      // ("Great effort, ." or "Great effort,").
      expect(r.said, `${JSON.stringify(name)} left a dangling comma`)
        .toContain('Great effort.');
      expect(r.said, `${JSON.stringify(name)} left a dangling comma`).not.toMatch(/,\s*,|,\s*\./);
    }
  });

});
