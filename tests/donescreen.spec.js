// Her finished screen shows her words, not a tick.
//
// A tick says only that she stopped. The picture says what tonight did — and it is
// the same drawing a grown-up sees, so it means the same thing in both places.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

async function sit(page, words){
  await page.evaluate(ws => {
    const a = window.__acorn;
    if(ws) { a.state.words.lists = [{id:'w1', name:'T', words:ws}]; a.state.words.activeId = 'w1'; }
    a.save(); a.go('parent'); a.go('day');
    if(!a.session()) a.start();
    let g = 0;
    while(a.session() && g++ < 80){
      const W = a.session();
      if(W.stage === 'look'){ a.cover(); continue; }
      if(W.stage === 'write'){ a.type(W.words[W.i]); a.check(); a.next(); continue; }
      a.next();
    }
  }, words || null);
}

test.describe('the screen at the end of a sitting', () => {

  test('it is her word map, and the same drawing as the grown-ups one', async ({page}) => {
    await open(page, '2026-08-01');
    await sit(page, ['rain', 'boat', 'said']);
    await expect(page.locator('#screen .net')).toHaveCount(1);
    await expect(page.locator('#screen .tick')).toHaveCount(0);
    // Bare: the heading and the paragraph explaining it belong to the grown-ups
    // screen. She does not need telling what her own words are.
    expect(await page.locator('#screen').innerText()).not.toMatch(/What she knows/i);
    expect(await page.locator('#screen .hint').count()).toBe(0);
    // And it is one picture to a screen reader there too.
    await expect(page.locator('#screen .net')).toHaveAttribute('role', 'img');
    expect(await page.locator('#screen .net [aria-hidden="false"]').count()).toBe(0);
    expect(errorsOf(page)).toEqual([]);
  });

  test('it says what tonight did, in words, at any count', async ({page}) => {
    await open(page, '2026-08-01');
    for(const [n, want] of [[1, 'One more'], [3, 'Three more'], [9, 'Nine more'],
                            [10, '10 more'], [40, '40 more']]){
      const line = await page.evaluate(k => {
        const a = window.__acorn;
        a.reset(); a.setToday('2026-08-01');
        const all = [];
        a.allLists().forEach(l => a.wordsOf(l).forEach(w => { if(all.indexOf(w) < 0) all.push(w); }));
        all.slice(0, k).forEach(w => a.state.words.mastery[w] =
          {right:1, wrong:0, box:2, lastSeen:'2026-08-01'});
        a.state.words.sessions = [{date:'2026-08-01', list:a.activeList().id, asked:k, words:k,
                                   firstTime:k, fresh:all.slice(0, k), grew:[], slipped:[]}];
        a.save(); a.go('parent'); a.go('day');
        return (document.querySelector('.note') || {}).textContent;
      }, n);
      // Past nine the digit reads more easily, and it must never fall off the end of
      // the list — a long evening once told her "undefined more took root tonight".
      expect(line, n + ' words moved').toBe(want + ' took root tonight.');
    }
  });

  test('a sitting that moved nothing says where she is up to instead', async ({page}) => {
    await open(page, '2026-08-01');
    const line = await page.evaluate(() => {
      const a = window.__acorn;
      a.reset(); a.setToday('2026-08-01');
      a.state.words.sessions = [{date:'2026-08-01', list:a.activeList().id, asked:8, words:8,
                                 firstTime:8, fresh:[], grew:[], slipped:[]}];
      a.save(); a.go('parent'); a.go('day');
      return (document.querySelector('.note') || {}).textContent;
    });
    expect(line).toMatch(/of \d+ words known well/);
  });

  test('the flourish plays once, not on every render', async ({page}) => {
    await open(page, '2026-08-01');
    await sit(page, ['rain', 'boat', 'said']);
    const first = await page.locator('#screen .net-cell.arriving').count();
    expect(first, 'tonight’s words are not marked').toBeGreaterThan(0);
    // Anything that redraws the screen must not replay it. Changing a setting is the
    // ordinary way that happens: a grown-up nudges the text size and comes back.
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.settings.textScale = 1.15; a.save();
      a.go('parent'); a.go('day');
    });
    const seeded = await page.evaluate(() =>
      document.querySelector('#screen .net').classList.contains('seeded'));
    expect(seeded, 'the flourish replayed on a re-render').toBe(false);
  });

  test('yesterday’s evening does not arrive again today', async ({page}) => {
    await open(page, '2026-08-01');
    await sit(page, ['rain', 'boat', 'said']);
    const marked = await page.evaluate(() => {
      const a = window.__acorn;
      a.setToday('2026-08-02'); a.go('parent'); a.go('day');
      // A new day, nothing done yet: the picture is just her words.
      return document.querySelectorAll('#screen .net-cell.arriving').length;
    });
    expect(marked).toBe(0);
  });

  test('the whole screen still fits, on every phone at every text size', async ({page}) => {
    for(const vp of [{width:320, height:568}, {width:375, height:667}, {width:390, height:844}]){
      await page.setViewportSize(vp);
      await open(page, '2026-08-01');
      for(const scale of [0.9, 1, 1.15, 1.3, 1.5]){
        await page.evaluate(s => { window.__acorn.state.settings.textScale = s;
                                   window.__acorn.save(); }, scale);
        await sit(page, ['rain', 'boat', 'said']);
        const cut = await page.evaluate(() => {
          const m = document.querySelector('main'), box = m.getBoundingClientRect();
          const out = [];
          m.querySelectorAll('*').forEach(n => {
            const r = n.getBoundingClientRect();
            if(!r.height) return;
            if(r.bottom > box.bottom + 1 || r.top < box.top - 1)
              out.add ? out.add(n.className) : out.push(String(n.className || n.tagName));
          });
          return [...new Set(out)];
        });
        expect(cut, `${vp.width}x${vp.height} at ${scale}x`).toEqual([]);
        // The way on is always there.
        await expect(page.locator('#again')).toBeVisible();
      }
    }
  });
});
