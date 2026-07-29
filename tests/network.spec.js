// The shape of what she knows: every word she has met, plus a few days of what is
// coming as faint outlines, filling in and darkening as she learns them.
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

/* The five states a grown-up actually sees, in order: the evening before she has
   started, five and then eight words in on her first list — which is the state the
   owner was looking at when they asked for a tighter crop — a month or so in with a
   second list open, and the whole thing known. Several checks below have to hold at
   all of them, and it matters that they are the real states and not convenient
   ones, so they are written once here. */
async function stageOf(page, stage){
  await page.evaluate(s => {
    const a = window.__acorn, m = {}, seen = [];
    a.allLists().forEach(l => a.wordsOf(l).forEach(w => { if(seen.indexOf(w) < 0) seen.push(w); }));
    if(s === 'all') seen.forEach(w => m[w] = {right:5, wrong:0, box:6, lastSeen:'2026-07-20'});
    else if(s === 'met30'){
      seen.slice(0, 30).forEach((w, i) => m[w] = {right:3, wrong:0, box:1 + (i % 6), lastSeen:'2026-07-20'});
      a.state.words.activeId = a.allLists()[1].id;
    }else if(s !== 'none'){
      a.wordsOf(a.allLists()[0]).slice(0, s === 'met5' ? 5 : 8).forEach((w, i) =>
        m[w] = {right:3, wrong:0, box:1 + (i % 5), lastSeen:'2026-07-20'});
    }
    a.state.words.mastery = m; a.save(); a.go('parent');
  }, stage);
}

async function master(page, pairs){
  await page.evaluate(p => {
    const a = window.__acorn, m = {};
    Object.keys(p).forEach(w => { m[w] = {right:3, wrong:0, box:p[w], lastSeen:'2026-07-20'}; });
    a.state.words.mastery = m; a.save(); a.go('parent');
  }, pairs);
}

test.describe('the shape of what she knows', () => {

  // Every word on every list used to be drawn from day one: a hundred faint
  // outlines, which said more about how far there is to go than about her. Then a
  // fixed dozen, which still starts big and blank. The outlines now start at two
  // sittings' worth of new words and reach further as she meets more.
  test('only the next few words are outlined, not the whole hundred', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    const all = await cells(page);
    const facts = await page.evaluate(() => {
      const a = window.__acorn;
      return {horizon: a.ghostWords(), ahead: a.ghostAhead(),
              corpus: a.allLists().reduce((n, l) => n + a.wordsOf(l).length, 0),
              // What the engine will hand her today that she has not met before.
              next: a.buildSession(a.activeList(), a.todayISO())
                     .filter(w => !a.state.words.mastery[w])};
    });
    // Her first sitting introduces three words: tonight's three and three behind.
    expect(facts.ahead).toBe(6);
    expect(all.map(c => c.word).sort()).toEqual(facts.horizon.slice().sort());
    expect(all.length, 'the ghost is no longer the whole corpus')
      .toBeLessThan(facts.corpus / 4);
    // And it is the near horizon, not an arbitrary dozen: the words she is about
    // to meet are all on it.
    expect(facts.next.length).toBeGreaterThan(0);
    facts.next.forEach(w => expect(facts.horizon).toContain(w));
    // Nothing met yet, so nothing filled — the form waiting.
    expect(all.every(c => !c.met)).toBe(true);
    expect(all.every(c => c.fill === 0)).toBe(true);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a word she has met is never hidden, however far behind the horizon', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => {
      const a = window.__acorn, m = {};
      // Three words on a list she is not on, and the last word of the open one —
      // all of them well past the few days the outlines reach.
      const other = a.allLists().filter(l => l.id !== a.activeList().id)[0];
      a.wordsOf(other).slice(0, 3).forEach(w => m[w] = {right:2, wrong:0, box:3, lastSeen:'2026-07-20'});
      m[a.wordsOf(a.activeList()).slice(-1)[0]] = {right:1, wrong:1, box:2, lastSeen:'2026-07-20'};
      a.state.words.mastery = m; a.save(); a.go('parent');
    });
    const drawn = (await cells(page)).filter(c => c.met).map(c => c.word).sort();
    const met = await page.evaluate(() => Object.keys(window.__acorn.state.words.mastery).sort());
    expect(drawn).toEqual(met);
  });

  // The horizon must never retract. Following her pace looked clever and made the
  // picture go backwards: newWordsToday() answers 3 before her first sitting and 1
  // after it, so one evening of practice took the shape from twelve outlines to
  // four. A hard week earns no new words at all, and must still not shrink it.
  // It is off words met, which is the one measure of how far she has come that
  // cannot go down.
  test('the shape only ever grows', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    const day1 = (await cells(page)).length;
    expect(day1, 'it starts at a handful').toBe(6);

    // One good sitting behind her.
    const after = await page.evaluate(() => {
      const a = window.__acorn;
      a.wordsOf(a.activeList()).slice(0, 3).forEach(w => {
        a.state.words.mastery[w] = {right:3, wrong:0, box:3, lastSeen:'2026-07-31'}; });
      a.state.words.sessions = [{date:'2026-07-31', list:'easy', words:8, firstTime:7}];
      a.save(); a.go('parent');
      return document.querySelectorAll('.net-cell').length;
    });
    expect(after, 'a sitting must not shrink her map').toBeGreaterThan(day1);

    // And a bad run after that.
    const hard = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.sessions = [1, 2, 3, 4, 5].map(i =>
        ({date:'2026-07-2' + i, list:'easy', words:8, firstTime:3}));
      a.save(); a.go('parent');
      return {n: a.newWordsToday(), ahead: a.ghostAhead(),
              cells: document.querySelectorAll('.net-cell').length};
    });
    expect(hard.n, 'nothing new is introduced on a bad run').toBe(0);
    expect(hard.ahead, 'but the horizon holds').toBe(6);
    expect(hard.cells).toBe(after);

    // And it does widen: a term's worth of words met looks further ahead than
    // her first evening did.
    const later = await page.evaluate(() => {
      const a = window.__acorn, m = {};
      const seen = [];
      a.allLists().forEach(l => a.wordsOf(l).forEach(w => { if(seen.indexOf(w) < 0) seen.push(w); }));
      seen.slice(0, 25).forEach(w => m[w] = {right:3, wrong:0, box:3, lastSeen:'2026-07-31'});
      a.state.words.mastery = m; a.save(); a.go('parent');
      return {ahead: a.ghostAhead(), cells: document.querySelectorAll('.net-cell').length};
    });
    expect(later.ahead, 'the horizon widens as she meets more').toBeGreaterThan(6);
    expect(later.cells).toBeGreaterThan(hard.cells);
  });

  /* The camera is fitted to a stable set — every list she has started plus the open
     one — because one fitted to what happens to be drawn re-frames every time she
     meets a word, and then the whole colony slides and rescales under her. Measured
     before that was fixed: all seven shared cells moved and grew.
     The picture is deliberately not the same size any more: it is small on her
     first evening and grows with the words she has met, so the on-screen
     coordinates legitimately change. What must still hold is that only the size
     changes — the same frame, and every cell in the same place relative to the
     others. So positions are read off getBoundingClientRect, as they must be (this
     defect got in because the old test read the coordinates the code had chosen),
     and then normalised by the picture's own box before they are compared. */
  test('the picture holds still on screen as she learns', async ({page}) => {
    await open(page, '2026-08-01');
    const onScreen = () => page.evaluate(() => {
      const svg = document.querySelector('.net'), box = svg.getBoundingClientRect();
      const out = {view: svg.getAttribute('viewBox'), width: box.width, pos: {}};
      document.querySelectorAll('.net-cell').forEach(c => {
        const r = c.getBoundingClientRect();
        // In fractions of the picture, not in pixels of the page.
        out.pos[c.querySelector('title').textContent] =
          [(r.left - box.left) / box.width, (r.top - box.top) / box.height,
           r.width / box.width];
      });
      return out;
    });
    await page.evaluate(() => window.__acorn.go('parent'));
    const before = await onScreen();
    await page.evaluate(() => {
      const a = window.__acorn;
      a.wordsOf(a.activeList()).slice(0, 3).forEach(w => {
        a.state.words.mastery[w] = {right:3, wrong:0, box:4, lastSeen:'2026-08-01'}; });
      a.state.words.sessions.push({date:'2026-07-31', list:'easy', words:8, firstTime:7});
      a.save(); a.go('day'); a.go('parent');
    });
    const after = await onScreen();
    expect(after.view, 'the frame moved').toBe(before.view);
    expect(after.width, 'the picture should have grown').toBeGreaterThan(before.width);
    // Within a pixel of the bigger picture: the arrangement is identical, only
    // the scale is not.
    const tol = 1 / after.width;
    const moved = Object.keys(before.pos).filter(w => after.pos[w] &&
      after.pos[w].some((v, i) => Math.abs(v - before.pos[w][i]) > tol));
    expect(moved, 'cells moved relative to the picture').toEqual([]);
  });

  // The frame is a camera: it crops to what is drawn so a dozen outlines fill the
  // picture, and the colony keeps the coordinates it was laid out with whatever is
  // being shown.
  test('the frame crops to what is drawn, and the colony never moves', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    const frame = () => page.evaluate(() => ({
      side: Math.round(document.querySelector('.net').viewBox.baseVal.width),
      cells: document.querySelectorAll('.net-cell').length}));
    const tight = await frame();
    const before = (await cells(page)).map(c => `${c.word}:${c.x},${c.y},${c.r}`);
    await page.evaluate(() => {
      const a = window.__acorn, m = {};
      a.allLists().forEach(l => a.wordsOf(l).forEach(w => m[w] = {right:3, wrong:0, box:4, lastSeen:'2026-07-20'}));
      a.state.words.mastery = m; a.save(); a.go('parent');
    });
    const wide = await frame();
    expect(wide.cells).toBeGreaterThan(tight.cells * 5);
    // Four times over. It was half again as wide before the hairs were brought in
    // out of the middle of the layout square: they used to drag the first evening's
    // frame down to the core, and the frame started nearly half as wide as the
    // whole colony ends up.
    expect(wide.side, 'the frame pulled back as the colony grew')
      .toBeGreaterThan(tight.side * 3);
    const after = (await cells(page)).map(c => `${c.word}:${c.x},${c.y},${c.r}`);
    before.forEach(b => expect(after).toContain(b));
  });

  /* The picture is meant to start small — a handful of outlines on a sprout rather
     than a full-width square — but small is not the same as a speck, and on her
     first evening this is all a grown-up has to look at.
     The share it fills is measured against the picture itself and taken over
     everything drawn, not over the cells alone: on the day she has one list going
     the cells she has reached sit in the middle of the family and the hairs are
     what reach the rim. What the check is for is that the camera is cropped to the
     drawing rather than leaving it in the corner of an empty square. */
  test('the waiting shape is a reasonable size, not a speck', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    const m = await page.evaluate(() => {
      const svg = document.querySelector('.net').getBoundingClientRect();
      const app = document.querySelector('#app').getBoundingClientRect();
      const cs = [...document.querySelectorAll('.net-cell')].map(c => c.getBoundingClientRect());
      const ink = [...document.querySelectorAll('.net path')].map(p => p.getBoundingClientRect());
      const span = rs => [Math.max(...rs.map(r => r.right)) - Math.min(...rs.map(r => r.left)),
                          Math.max(...rs.map(r => r.bottom)) - Math.min(...rs.map(r => r.top))];
      const drawn = span(ink), cell = span(cs);
      return {fillsFrame: Math.max(drawn[0], drawn[1]) / svg.width,
              squareish: cell[0] / cell[1],
              cellPx: Math.min(...cs.map(r => r.width)),
              svgPx: svg.width, roomLeftToGrow: svg.width / app.width};
    });
    // Small, but a real picture: a good part of the column wide, and not yet the
    // whole of it, because there is a lot of growing left to do.
    expect(m.svgPx, 'the picture is a speck').toBeGreaterThan(200);
    expect(m.roomLeftToGrow).toBeLessThan(0.75);
    expect(m.fillsFrame, 'the drawing does not fill its frame').toBeGreaterThan(0.9);
    expect(m.squareish).toBeGreaterThan(0.6);
    expect(m.squareish).toBeLessThan(1.6);
    expect(m.cellPx, 'the cells are too small to read as cells').toBeGreaterThan(6);
  });

  /* Both complaints in one: the picture starts small on the page and grows, and
     the growing is the whole picture getting bigger rather than the cells
     spreading out. Measured on the phone she uses. */
  test('the picture grows on the page as she learns', async ({page}) => {
    await open(page, '2026-08-01');
    await page.setViewportSize({width:375, height:667});
    const size = () => page.evaluate(() => {
      const svg = document.querySelector('.net');
      return {px: Math.round(svg.getBoundingClientRect().width),
              view: svg.getAttribute('viewBox')};
    });
    await page.evaluate(() => window.__acorn.go('parent'));
    const first = await size();
    // Everything met and known well: the far end of the growth.
    const full = await page.evaluate(() => {
      const a = window.__acorn, m = {};
      a.allLists().forEach(l => a.wordsOf(l).forEach(w =>
        m[w] = {right:5, wrong:0, box:6, lastSeen:'2026-07-20'}));
      a.state.words.mastery = m; a.save(); a.go('parent');
      const svg = document.querySelector('.net');
      return {px: Math.round(svg.getBoundingClientRect().width),
              cells: document.querySelectorAll('.net-cell').length};
    });
    expect(full.px, 'the picture did not grow').toBeGreaterThan(first.px * 1.4);
    expect(full.cells).toBe(100);
    // The frame it grew into is her own list of lists, not the page: at every
    // stage the picture sits inside the column. It is no longer square — the frame
    // is the shape of the drawing — so this is about its width.
    expect(first.px).toBeLessThan(await page.evaluate(() =>
      document.querySelector('#app').clientWidth));
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

  /* Every line of it, not the cells alone: the hairs are a walk with a random-ish
     wander at every step and the filaments have random-ish control points, and if
     either came out differently on a second look the picture would be decoration
     rather than her map. Taken at the state where all three kinds are on screen. */
  test('it is the same shape every time, or it is decoration', async ({page}) => {
    await open(page, '2026-08-01');
    const drawn = () => page.evaluate(() =>
      [...document.querySelectorAll('.net path')]
        .map(p => p.getAttribute('class') + ' ' + p.getAttribute('d')));
    await stageOf(page, 'all');
    const first = await drawn();
    expect(first.length).toBeGreaterThan(100);
    await page.evaluate(() => { window.__acorn.go('day'); window.__acorn.go('parent'); });
    expect(await drawn()).toEqual(first);
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    await page.evaluate(() => { window.__acorn.setToday('2026-08-01'); window.__acorn.go('parent'); });
    expect(await drawn()).toEqual(first);
    // And on her first evening, where the hairs are the solo family's own.
    await stageOf(page, 'met8');
    const early = await drawn();
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    await page.evaluate(() => { window.__acorn.setToday('2026-08-01'); window.__acorn.go('parent'); });
    expect(await drawn()).toEqual(early);
  });

  test('learning a word moves nothing else', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    const before = (await cells(page)).map(c => `${c.word}:${c.x},${c.y}`);
    await master(page, {said: 5, they: 3});
    const after = (await cells(page)).map(c => `${c.word}:${c.x},${c.y}`);
    // Meeting two words slides the horizon on by two, so the picture can gain an
    // outline — but everything already on it keeps the exact place it had.
    before.forEach(b => expect(after).toContain(b));
    expect(after.length).toBeGreaterThanOrEqual(before.length);
  });

  test('a longer word is a bigger cell, but only a little', async ({page}) => {
    await open(page, '2026-08-01');
    // Only what she has met and the near horizon is drawn, and the open list is
    // all four-letter words — so the spread of lengths has to be met, not assumed.
    await master(page, {said:2, they:2, went:2,
                        beautiful:3, different:3, favourite:3, government:3});
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
    const drawn = () => page.evaluate(() =>
      [...document.querySelectorAll('.net path, .net line')].map(p => ({
        tag: p.tagName.toLowerCase(), d: p.getAttribute('d') || ''})));
    await page.evaluate(() => window.__acorn.go('parent'));
    // Her first evening, and then the whole colony — the filaments only appear
    // once there are words on the map that share a chunk, and they are held inside
    // the frame, which must not straighten them.
    for(const paths of [await drawn(), await page.evaluate(() => {
      const a = window.__acorn, m = {};
      a.allLists().forEach(l => a.wordsOf(l).forEach(w =>
        m[w] = {right:5, wrong:0, box:5, lastSeen:'2026-07-20'}));
      a.state.words.mastery = m; a.save(); a.go('parent');
      return [...document.querySelectorAll('.net path, .net line')].map(p => ({
        tag: p.tagName.toLowerCase(), d: p.getAttribute('d') || ''}));
    })]){
      expect(paths.length).toBeGreaterThan(10);
      // A ruled line is what gives a drawing like this away as a diagram.
      expect(paths.filter(p => p.tag === 'line')).toEqual([]);
      const straight = paths.filter(p => !/[QCTS]/.test(p.d));
      expect(straight.map(p => p.d.slice(0, 30))).toEqual([]);
    }
    // And the hairs wander rather than bending once: several segments each.
    const hairs = await page.evaluate(() =>
      [...document.querySelectorAll('.net-hair')].map(p => (p.getAttribute('d').match(/Q/g) || []).length));
    expect(Math.min(...hairs), 'the hairs are too simple to wander').toBeGreaterThan(3);
  });

  /* All of the drawing has to be inside the picture — not just the cells. The
     hairs start at the core and end past the outermost word, and the filaments
     bulge sideways between two cells; either can leave a frame drawn round the
     cells alone, and .net{overflow:hidden} would crop them where they left. On a
     phone that came out as five hairlines running off the bottom edge towards
     something you cannot see.
     "Show the entire network" was asked for twice, so this walks every stage she
     will actually see rather than a couple of them. Read off getBoundingClientRect,
     so this is where the lines are on her screen and not where the code meant to
     put them. */
  test('nothing is clipped by the edge of the frame, at any stage', async ({page}) => {
    await open(page, '2026-08-01');
    await page.setViewportSize({width:375, height:667});
    const spilling = () => page.evaluate(() => {
      const box = document.querySelector('.net').getBoundingClientRect();
      return [...document.querySelectorAll('.net path')].map(p => {
        const b = p.getBoundingClientRect();
        return (b.left < box.left - 1 || b.top < box.top - 1 ||
                b.right > box.right + 1 || b.bottom > box.bottom + 1)
          ? p.getAttribute('class') + ' ' + [Math.round(b.left - box.left),
              Math.round(b.top - box.top), Math.round(b.right - box.right),
              Math.round(b.bottom - box.bottom)].join(',')
          : null;
      }).filter(Boolean);
    });
    for(const stage of ['none', 'met5', 'met8', 'met30', 'all']){
      await stageOf(page, stage);
      expect(await spilling(), `${stage} spills`).toEqual([]);
    }
    // And the last of those is where the filaments are, so they were covered too.
    expect(await page.evaluate(() => document.querySelectorAll('.net-link').length))
      .toBeGreaterThan(0);
  });

  /* "Much better — it does look more like a bunch of balloons... but thinking that
     we crop it more tightly." The frame padded and squared up around a set that
     covers more than is drawn, and on top of that the hairs ran from every head
     down to the middle of the layout square — so the drawing came out long and thin
     inside a square frame and better than half of the picture was empty. Measured
     at the state the owner was looking at: the drawing was 44% of the frame's width.
     It is now fitted to the shape of the drawing rather than to a square, and this
     is the whole complaint in one number, taken over every path on the screen at
     every stage she will see. */
  test('the drawing fills its frame at every stage', async ({page}) => {
    await open(page, '2026-08-01');
    await page.setViewportSize({width:375, height:667});
    for(const stage of ['none', 'met5', 'met8', 'met30', 'all']){
      await stageOf(page, stage);
      const m = await page.evaluate(() => {
        const box = document.querySelector('.net').getBoundingClientRect();
        const b = [...document.querySelectorAll('.net path')].map(p => p.getBoundingClientRect());
        return {w: (Math.max(...b.map(r => r.right)) - Math.min(...b.map(r => r.left))) / box.width,
                h: (Math.max(...b.map(r => r.bottom)) - Math.min(...b.map(r => r.top))) / box.height};
      });
      expect(m.w, `${stage} leaves dead margin across`).toBeGreaterThan(0.9);
      expect(m.h, `${stage} leaves dead margin down`).toBeGreaterThan(0.9);
    }
  });

  /* "If there is no other wordlist or group then maybe links are self contained?"
     They were not. Every hair ran from its family's head back to the middle of the
     layout square, which is a point the cells are laid out around and not anywhere
     in her map — so with one list going, five long threads left the cluster of
     words and met at a spot well below the last of them. Balloons on strings.
     The core is now the middle of the picture, so with one family it is inside the
     family, and the hairs run out of it to her words rather than away from them. */
  test('one list on its own is a shape, not balloons on strings', async ({page}) => {
    await open(page, '2026-08-01');
    await stageOf(page, 'met8');
    const m = await page.evaluate(() => {
      const svg = document.querySelector('.net');
      // Where the threads all start, on screen: the first coordinate of each path.
      const root = [...document.querySelectorAll('.net-hair')].map(p => {
        const s = p.getPointAtLength(0), pt = svg.createSVGPoint();
        pt.x = s.x; pt.y = s.y;
        const q = pt.matrixTransform(p.getScreenCTM());
        return [q.x, q.y];
      });
      const cs = [...document.querySelectorAll('.net-cell')].map(c => c.getBoundingClientRect());
      const cell = {l: Math.min(...cs.map(r => r.left)), t: Math.min(...cs.map(r => r.top)),
                    r: Math.max(...cs.map(r => r.right)), b: Math.max(...cs.map(r => r.bottom))};
      const longest = Math.max(...[...document.querySelectorAll('.net-hair')]
        .map(p => p.getTotalLength()));
      return {root: root, cell: cell, longest: longest,
              span: Math.max(cell.r - cell.l, cell.b - cell.t)};
    });
    expect(m.root.length).toBeGreaterThan(3);
    // Every thread starts among her words, not off in the empty part of the
    // picture. Before this, the one shared start was 100px below the cluster.
    m.root.forEach(([x, y], i) => {
      expect(x, `hair ${i} starts left of her words`).toBeGreaterThan(m.cell.l);
      expect(x, `hair ${i} starts right of her words`).toBeLessThan(m.cell.r);
      expect(y, `hair ${i} starts above her words`).toBeGreaterThan(m.cell.t);
      expect(y, `hair ${i} starts below her words`).toBeLessThan(m.cell.b);
    });
    // And they all share it: it is one core, not a thread each.
    m.root.forEach(([x, y]) => {
      expect(Math.hypot(x - m.root[0][0], y - m.root[0][1])).toBeLessThan(1);
    });
    // No thread is longer than the cluster is wide — a hair reaching half again as
    // far as the drawing is what reads as a string.
    expect(m.longest).toBeLessThan(m.span);
  });

  /* And every one of them lands on a word. A thread that stops in the open is the
     same complaint one step smaller, so a solo family's hairs go out to the word
     that is farthest from the middle in each direction round it and finish inside
     its shape. Her whole first list met, so every word of it is on the screen and
     there is nowhere for a thread to hide. */
  test('a solo family’s hairs end on her words', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => {
      const a = window.__acorn, m = {};
      a.wordsOf(a.allLists()[0]).forEach(w =>
        m[w] = {right:4, wrong:0, box:4, lastSeen:'2026-07-25'});
      a.state.words.mastery = m; a.save(); a.go('parent');
    });
    const off = await page.evaluate(() => {
      const svg = document.querySelector('.net');
      const cs = [...document.querySelectorAll('.net-cell')].map(c => c.getBoundingClientRect());
      return [...document.querySelectorAll('.net-hair')].map((p, i) => {
        const e = p.getPointAtLength(p.getTotalLength()), pt = svg.createSVGPoint();
        pt.x = e.x; pt.y = e.y;
        const q = pt.matrixTransform(p.getScreenCTM());
        // Inside the box of some cell, which is the shape that hides the end.
        return cs.some(r => q.x >= r.left - 1 && q.x <= r.right + 1 &&
                            q.y >= r.top - 1 && q.y <= r.bottom + 1)
          ? null : i + ' ends in the open';
      }).filter(Boolean);
    });
    expect(off).toEqual([]);
  });

  /* The caption promised "a hairline joins words that share a spelling chunk — or
     is what morning, sorted and report have in common" from her first evening, and
     there are none on the screen until she is thirty or so words in: two words that
     share a chunk are usually far apart in the list, so both ends are rarely inside
     the near horizon. A caption describing a picture you are not looking at is
     worse than no caption. */
  test('the caption never promises a hairline that is not drawn', async ({page}) => {
    await open(page, '2026-08-01');
    const said = async () => {
      const sect = page.locator('.sect:has(h2:text-is("What she knows"))');
      return {copy: await sect.innerText(),
              links: await page.locator('.net-link').count()};
    };
    for(const stage of ['none', 'met5', 'met8', 'met30']){
      await stageOf(page, stage);
      const s = await said();
      expect(s.links, `${stage} has filaments after all`).toBe(0);
      expect(s.copy, `${stage} promises a hairline`).not.toMatch(/hairline/i);
      expect(s.copy).not.toMatch(/morning/);
      // The rest of the caption is still there.
      expect(s.copy).toMatch(/Each frond is one spelling pattern\./);
      expect(s.copy).toMatch(/in all on her lists/);
    }
    await stageOf(page, 'all');
    const s = await said();
    expect(s.links).toBeGreaterThan(0);
    expect(s.copy, 'the filaments are on screen and unexplained').toMatch(/hairlines join words/);
    expect(s.copy).toMatch(/morning, sorted and report/);
  });

  test('the filaments join words that share a chunk', async ({page}) => {
    await open(page, '2026-08-01');
    /* Only what she has met and a short horizon ahead of it is drawn, so the
       shared chunks have to be among them. Her first list finished and the "or"
       sound list opened, which is the real order of things: the horizon has
       widened to nine by then, and among those nine are morning, warming and
       talking, and awful and thoughtful. The words of the easy list are all one
       syllable, so none of them shares a chunk with anything — the filaments here
       are the "or" list's own. */
    await page.evaluate(() => {
      const a = window.__acorn, m = {};
      a.wordsOf(a.allLists()[0]).forEach(w => {
        m[w] = {right:4, wrong:0, box:5, lastSeen:'2026-07-25'}; });
      a.state.words.mastery = m;
      a.state.words.activeId = 'orsound'; a.save(); a.go('parent');
    });
    const links = await page.evaluate(() => document.querySelectorAll('.net-link').length);
    expect(links).toBeGreaterThan(3);
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
      a.state.words.activeId = 'w1';          // the list she is on is the one outlined
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
    // "In all" is her whole corpus — every word on her lists, counted once —
    // rather than the part of it that is drawn today.
    const inAll = async () => Number((await page.locator('.sect:has(h2:text-is("What she knows"))')
      .innerText()).match(/(\d+) in all/)[1]);
    await page.evaluate(() => window.__acorn.go('parent'));
    const before = await inAll();
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists.push({id:'w1', name:'Week 4', words:['said','they','went','zebra']});
      a.state.words.activeId = 'w1'; a.save(); a.go('parent');
    });
    const drawn = (await cells(page)).map(c => c.word);
    expect(new Set(drawn).size, 'no word is drawn twice').toBe(drawn.length);
    ['said', 'they', 'went', 'zebra'].forEach(w => expect(drawn).toContain(w));
    // Three of the four were already hers, so the count goes up by one.
    expect(await inAll()).toBe(before + 1);
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

  // A word she has only got coming up is sketched rather than drawn: a second line
  // round it at a different jitter, so the pair opens and closes like a pen going
  // round twice. A word she has met is one confident shape. The difference between
  // "not yet" and "known" should be visible across the room.
  test('a word she has not met is sketched, not drawn', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => {
      const a = window.__acorn;
      a.wordsOf(a.activeList()).slice(0, 8).forEach((w, i) => {
        a.state.words.mastery[w] = {right:4, wrong:0, box: i < 3 ? 6 : 3, lastSeen:'2026-08-01'}; });
      a.save(); a.go('parent');
    });
    const r = await page.evaluate(() => {
      const svg = document.querySelector('.net');
      const cells = [...svg.querySelectorAll('.net-cell')];
      const sketches = [...svg.querySelectorAll('.net-sketch')];
      const unmet = cells.filter(c => !c.classList.contains('met'));
      const ds = cells.map(c => c.getAttribute('d'));
      return {
        sketches: sketches.length, unmet: unmet.length, met: cells.length - unmet.length,
        // A different jitter, not the same outline scaled up.
        distinct: sketches.every(s => ds.indexOf(s.getAttribute('d')) < 0),
        unique: new Set(sketches.map(s => s.getAttribute('d'))).size,
        stroke: getComputedStyle(sketches[0]).fill,
      };
    });
    expect(r.met, 'this state should have met words too').toBeGreaterThan(2);
    expect(r.sketches, 'one sketch line per word she has not met').toBe(r.unmet);
    expect(r.distinct, 'the sketch is a different jitter, not the same shape again').toBe(true);
    expect(r.unique).toBe(r.unmet);          // and each word sketches its own
    expect(r.stroke).toBe('none');           // a line, never a second fill
    // Filled words stay single: no sketch anywhere near a met cell's own shape.
    const same = await page.evaluate(() => {
      const met = [...document.querySelectorAll('.net-cell.met')].map(c => c.getAttribute('d'));
      return [...document.querySelectorAll('.net-sketch')]
        .filter(s => met.indexOf(s.getAttribute('d')) >= 0).length;
    });
    expect(same).toBe(0);
    expect(errorsOf(page)).toEqual([]);
  });

  // A word she has not met is a hollow outline, and the threads run under the cells
  // to reach the words they land on — so a thread showed straight through the empty
  // ones, and a faint outline with a line through it reads as crossed out. Which is
  // the opposite of what an outline means here: a word she is coming to, not one she
  // has lost. The paper is painted in behind every cell.
  test('a thread never reads as a line struck through a word', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => {
      const a = window.__acorn;
      a.wordsOf(a.activeList()).slice(0, 8).forEach((w, i) => {
        a.state.words.mastery[w] = {right:4, wrong:0, box: i < 3 ? 6 : 3, lastSeen:'2026-08-01'}; });
      a.save(); a.go('parent');
    });
    const r = await page.evaluate(() => {
      const svg = document.querySelector('.net');
      const kids = [...svg.children].map(n => n.getAttribute('class') || '');
      const plates = [...svg.querySelectorAll('.net-plate')];
      const cells = [...svg.querySelectorAll('.net-cell')];
      // What is actually on top in the middle of each hollow outline.
      const over = [];
      cells.forEach(c => {
        if(c.classList.contains('met')) return;
        const b = c.getBoundingClientRect();
        const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        over.push(hit ? (hit.getAttribute('class') || hit.tagName) : 'nothing');
      });
      return {
        plates: plates.length, cells: cells.length,
        sameShape: plates.every((p, i) => p.getAttribute('d') === cells[i].getAttribute('d')),
        // Order: threads, then the paper, then the words.
        lastThread: kids.reduce((n, c, i) => /net-(hair|link)/.test(c) ? i : n, -1),
        firstPlate: kids.findIndex(c => /net-plate/.test(c)),
        firstCell: kids.findIndex(c => /net-cell/.test(c)),
        plateFill: getComputedStyle(plates[0]).fill,
        surface: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim(),
        over: [...new Set(over)],
        hollow: over.length,
      };
    });
    expect(r.hollow, 'this state should have hollow outlines to test').toBeGreaterThan(2);
    expect(r.plates).toBe(r.cells);
    expect(r.sameShape, 'the paper is the same shape as the word').toBe(true);
    expect(r.lastThread).toBeLessThan(r.firstPlate);
    expect(r.firstPlate).toBeLessThan(r.firstCell);
    // Nothing but the word or its paper is on top in the middle of a hollow outline.
    expect(r.over.filter(c => /net-(hair|link)/.test(c)), 'a thread shows through').toEqual([]);
    expect(errorsOf(page)).toEqual([]);
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

  // At both ends of the growth: the smallest picture on her first evening and the
  // largest one, with a hundred words behind her, both have to sit on the phone.
  test('it fits the phone at every text size', async ({page}) => {
    await open(page, '2026-08-01');
    await page.setViewportSize({width:375, height:667});
    for(const grown of [false, true]){
      if(grown) await page.evaluate(() => {
        const a = window.__acorn, m = {};
        a.allLists().forEach(l => a.wordsOf(l).forEach(w =>
          m[w] = {right:5, wrong:0, box:6, lastSeen:'2026-07-20'}));
        a.state.words.mastery = m; a.save();
      });
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
        expect(past, `at ${scale}x, ${grown ? 'grown' : 'new'}`).toBeLessThanOrEqual(1);
      }
    }
  });
});
