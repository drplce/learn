// The shape of what she knows: every word on her lists present from the first
// day as a faint outline, filling in and darkening as she learns them.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

const cells = page => page.evaluate(() =>
  [...document.querySelectorAll('.net-cell')].map(c => ({
    word: c.querySelector('title').textContent,
    met: c.classList.contains('met'),
    well: c.classList.contains('well'),
    fill: Number(getComputedStyle(c).fillOpacity.toString()),
    // Each cell is its own irregular shape now, so position and size are stated
    // rather than read off a circle.
    x: Number(c.getAttribute('data-x')), y: Number(c.getAttribute('data-y')),
    r: Number(c.getAttribute('data-r')),
  })));

async function master(page, pairs){
  await page.evaluate(p => {
    const a = window.__acorn, m = {};
    Object.keys(p).forEach(w => { m[w] = {right:3, wrong:0, box:p[w], lastSeen:'2026-07-20'}; });
    a.state.words.mastery = m; a.save(); a.go('parent');
  }, pairs);
}

test.describe('the shape of what she knows', () => {

  test('every word is there on the first day, as an outline', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    const all = await cells(page);
    const expected = await page.evaluate(() => {
      const a = window.__acorn, out = [];
      a.allLists().forEach(l => a.wordsOf(l).forEach(w => out.push(w)));
      return out;
    });
    expect(all.length).toBe(expected.length);
    expect(all.map(c => c.word).sort()).toEqual(expected.sort());
    // Nothing met yet, so nothing filled — the whole form waiting.
    expect(all.every(c => !c.met)).toBe(true);
    expect(all.every(c => c.fill === 0)).toBe(true);
    expect(errorsOf(page)).toEqual([]);
  });

  test('the waiting shape is a reasonable size, not a speck', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    const m = await page.evaluate(() => {
      const svg = document.querySelector('.net').getBoundingClientRect();
      const app = document.querySelector('#app').getBoundingClientRect();
      const cs = [...document.querySelectorAll('.net-cell')].map(c => c.getBoundingClientRect());
      const left = Math.min(...cs.map(r => r.left)), right = Math.max(...cs.map(r => r.right));
      const top = Math.min(...cs.map(r => r.top)), bottom = Math.max(...cs.map(r => r.bottom));
      return {widthShare: (right - left) / app.width,
              squareish: (right - left) / (bottom - top),
              cellPx: Math.min(...cs.map(r => r.width)), svgWide: svg.width > 200};
    });
    expect(m.svgWide).toBe(true);
    expect(m.widthShare, 'the shape does not fill its space').toBeGreaterThan(0.7);
    expect(m.squareish).toBeGreaterThan(0.6);
    expect(m.squareish).toBeLessThan(1.6);
    expect(m.cellPx, 'the cells are too small to read as cells').toBeGreaterThan(6);
  });

  test('a word darkens as it climbs, and never darkens backwards', async ({page}) => {
    await open(page, '2026-08-01');
    const fills = [];
    for(const box of [1, 2, 3, 4, 5, 6, 7]){
      await master(page, {said: box});
      const said = (await cells(page)).find(c => c.word === 'said');
      expect(said.met, `box ${box}`).toBe(true);
      fills.push(said.fill);
    }
    // Monotonic: more known is never lighter.
    for(let i = 1; i < fills.length; i++)
      expect(fills[i], `box ${i + 1} vs ${i}`).toBeGreaterThanOrEqual(fills[i - 1]);
    expect(fills[0]).toBeGreaterThan(0);
    expect(fills[fills.length - 1]).toBeCloseTo(1, 1);
  });

  test('a word she is losing dims rather than disappearing', async ({page}) => {
    await open(page, '2026-08-01');
    await master(page, {said: 6});
    const strong = (await cells(page)).find(c => c.word === 'said');
    await master(page, {said: 1});
    const faded = (await cells(page)).find(c => c.word === 'said');
    expect(faded).toBeTruthy();                       // still on the map
    expect(faded.fill).toBeLessThan(strong.fill);
    expect(faded.fill).toBeGreaterThan(0);            // still met, not a ghost again
  });

  test('known well is marked out from merely met', async ({page}) => {
    await open(page, '2026-08-01');
    await master(page, {said: 2, they: 5, went: 7});
    const c = await cells(page);
    expect(c.find(x => x.word === 'said').well).toBe(false);
    expect(c.find(x => x.word === 'they').well).toBe(true);
    expect(c.find(x => x.word === 'went').well).toBe(true);
  });

  test('it is the same shape every time, or it is decoration', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    const first = (await cells(page)).map(c => `${c.word}:${c.x},${c.y},${c.r}`);
    await page.evaluate(() => { window.__acorn.go('day'); window.__acorn.go('parent'); });
    expect((await cells(page)).map(c => `${c.word}:${c.x},${c.y},${c.r}`)).toEqual(first);
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    await page.evaluate(() => { window.__acorn.setToday('2026-08-01'); window.__acorn.go('parent'); });
    expect((await cells(page)).map(c => `${c.word}:${c.x},${c.y},${c.r}`)).toEqual(first);
  });

  test('learning a word moves nothing else', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    const before = (await cells(page)).map(c => `${c.word}:${c.x},${c.y}`);
    await master(page, {said: 5, they: 3});
    expect((await cells(page)).map(c => `${c.word}:${c.x},${c.y}`)).toEqual(before);
  });

  test('a longer word is a bigger cell, but only a little', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    const all = await cells(page);
    const bySize = {};
    all.forEach(c => { bySize[c.word.length] = bySize[c.word.length] || c.r; });
    const short = all.filter(c => c.word.length <= 4).map(c => c.r);
    const long = all.filter(c => c.word.length >= 9).map(c => c.r);
    const avg = a => a.reduce((n, x) => n + x, 0) / a.length;
    expect(avg(long), 'a long word should be bigger').toBeGreaterThan(avg(short));
    // Subtle: texture, not a ranking. Nothing more than about twice the size.
    expect(Math.max(...all.map(c => c.r)) / Math.min(...all.map(c => c.r)))
      .toBeLessThan(2.2);
  });

  test('no two words are the same shape, and none is a circle', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    const shapes = await page.evaluate(() =>
      [...document.querySelectorAll('.net-cell')].map(c => c.getAttribute('d')));
    expect(shapes.every(d => d && d.startsWith('M'))).toBe(true);
    expect(await page.evaluate(() => document.querySelectorAll('.net-cell circle').length)).toBe(0);
    // Deterministically distinct: each word carries its own outline.
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  test('nothing in it is a straight line', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    const paths = await page.evaluate(() =>
      [...document.querySelectorAll('.net path, .net line')].map(p => ({
        tag: p.tagName.toLowerCase(), d: p.getAttribute('d') || ''})));
    expect(paths.length).toBeGreaterThan(10);
    // A ruled line is what gives a drawing like this away as a diagram.
    expect(paths.filter(p => p.tag === 'line')).toEqual([]);
    const straight = paths.filter(p => !/[QCTS]/.test(p.d));
    expect(straight.map(p => p.d.slice(0, 30))).toEqual([]);
    // And the hairs wander rather than bending once: several segments each.
    const hairs = await page.evaluate(() =>
      [...document.querySelectorAll('.net-hair')].map(p => (p.getAttribute('d').match(/Q/g) || []).length));
    expect(Math.min(...hairs), 'the hairs are too simple to wander').toBeGreaterThan(3);
  });

  test('nothing is clipped by the edge of the frame', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    const outside = await page.evaluate(() => {
      const svg = document.querySelector('.net');
      const box = svg.viewBox.baseVal;
      return [...document.querySelectorAll('.net-cell')].map(c => {
        const b = c.getBBox();
        return (b.x < box.x - 0.5 || b.y < box.y - 0.5 ||
                b.x + b.width > box.x + box.width + 0.5 ||
                b.y + b.height > box.y + box.height + 0.5)
          ? c.querySelector('title').textContent : null;
      }).filter(Boolean);
    });
    expect(outside).toEqual([]);
  });

  test('the filaments join words that share a chunk', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    const links = await page.evaluate(() => document.querySelectorAll('.net-link').length);
    expect(links).toBeGreaterThan(4);
    // And they light up only once both ends have been met.
    const litBefore = await page.evaluate(() => document.querySelectorAll('.net-link.lit').length);
    expect(litBefore).toBe(0);
    await page.evaluate(() => {
      const a = window.__acorn, m = {};
      a.allLists().forEach(l => a.wordsOf(l).forEach(w => m[w] = {right:3, wrong:0, box:5, lastSeen:'2026-07-20'}));
      a.state.words.mastery = m; a.save(); a.go('parent');
    });
    expect(await page.evaluate(() => document.querySelectorAll('.net-link.lit').length))
      .toBeGreaterThan(0);
  });

  test('a word she added herself is on the map too', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'w1', name:'Week 6', words:['zebra','xylophone']}];
      a.save(); a.go('parent');
    });
    const words = (await cells(page)).map(c => c.word);
    expect(words).toContain('zebra');
    expect(words).toContain('xylophone');
  });

  test('it stays on the grown-ups side', async ({page}) => {
    await open(page, '2026-08-01');
    await expect(page.locator('.net')).toHaveCount(0);
    expect(await page.locator('#app').innerText()).not.toMatch(/what she knows/i);
  });

  // "said" and "they" are on half the sight-word lists anyone would paste in.
  // Counting them once per list drew the same word twice — two unconnected cells,
  // only one of them joined to anything — and inflated the total.
  test('a word on two lists is on the map once', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    const before = (await cells(page)).map(c => c.word);
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists.push({id:'w1', name:'Week 4', words:['said','they','went','zebra']});
      a.save(); a.go('parent');
    });
    const after = (await cells(page)).map(c => c.word);
    expect(new Set(after).size, 'no word is drawn twice').toBe(after.length);
    // Only the genuinely new word is added.
    expect(after.length).toBe(before.length + 1);
    expect(after).toContain('zebra');
    const hint = await page.locator('.sect:has(h2:text-is("What she knows"))').innerText();
    expect(hint).toContain(after.length + ' in all');
  });

  // Two counts of the same thing, worked out separately, drifted: the picture
  // counted every list, the card counted the open one, and both said
  // "known well".
  test('the picture and the Progress card give the same numbers', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => {
      const a = window.__acorn;
      // Words known well on a list that is not the open one.
      const other = a.allLists().filter(l => l.id !== a.activeList().id)[0];
      const m = {};
      a.wordsOf(other).slice(0, 4).forEach(w => { m[w] = {right:5, wrong:0, box:6, lastSeen:'2026-07-20'}; });
      a.wordsOf(a.activeList()).slice(0, 2).forEach(w => { m[w] = {right:1, wrong:1, box:2, lastSeen:'2026-07-20'}; });
      a.state.words.mastery = m; a.save(); a.go('parent');
    });
    const all = await cells(page);
    const known = all.filter(c => c.well).length, met = all.filter(c => c.met).length;
    expect(known).toBe(4);
    expect(met).toBe(6);
    const card = await page.locator('.sect:has(h2:text-is("Progress"))').innerText();
    expect(card).toMatch(new RegExp('\\b' + known + '\\s*\\n?\\s*known well', 'i'));
    expect(card).toMatch(new RegExp('\\b' + met + '\\s*\\n?\\s*words met', 'i'));
    const pic = await page.locator('.sect:has(h2:text-is("What she knows"))').innerText();
    expect(pic).toContain(met + ' met, ' + known + ' known well');
    expect(await page.locator('.net').getAttribute('aria-label'))
      .toContain(met + ' met, ' + known + ' known well');
  });

  // role="img" is meant to make an image's children presentational, but no
  // browser prunes SVG shapes that carry a <title> — so a hundred cells became a
  // hundred nodes, and a screen reader read the whole word list out in layout
  // order with nothing to say which ones she knew. It has to be one picture that
  // states its numbers once.
  test('it is one picture to a screen reader, not a hundred words', async ({page}) => {
    await open(page, '2026-08-01');
    await master(page, {said:6, they:3, went:1});
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Accessibility.enable');
    const {nodes} = await cdp.send('Accessibility.getFullAXTree');
    const name = n => (n.name && n.name.value) || '';
    const pic = nodes.filter(n => /growing picture of her words/.test(name(n)));
    expect(pic.length, 'the picture is announced exactly once').toBe(1);
    expect(name(pic[0])).toMatch(/3 met, 1 known well, \d+ in all/);
    expect((pic[0].childIds || []).length, 'the shapes are not walkable').toBe(0);

    const words = (await cells(page)).map(c => c.word);
    const leaked = nodes.filter(n => !n.ignored && words.indexOf(name(n)) >= 0);
    expect(leaked.map(name), 'no cell reaches the accessibility tree').toEqual([]);
    // The tooltip is the only thing the titles are for, so they stay.
    expect(await page.locator('.net-cell title').count()).toBe(words.length);
    expect(errorsOf(page)).toEqual([]);
  });

  test('it fits the phone at every text size', async ({page}) => {
    await open(page, '2026-08-01');
    await page.setViewportSize({width:375, height:667});
    for(const scale of [0.9, 1, 1.25, 1.5]){
      await page.evaluate(s => {
        window.__acorn.state.settings.textScale = s;
        window.__acorn.save(); window.__acorn.go('parent');
      }, scale);
      const past = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const r = document.querySelector('.net').getBoundingClientRect();
        return Math.round(Math.max(r.right - vw, -r.left));
      });
      expect(past, `at ${scale}x`).toBeLessThanOrEqual(1);
    }
  });
});
