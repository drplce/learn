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
    for(const [n, want] of [[1, 'One'], [3, 'Three'], [9, 'Nine'], [10, '10'], [40, '40']]){
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
        // Wordless screen now (David): what tonight did is spoken, not drawn — read it off #say.
        return (document.querySelector('#say') || {}).textContent;
      }, n);
      // Past nine the digit reads more easily, and it must never fall off the end of
      // the list — a long evening once told her "undefined more took root tonight".
      expect(line, n + ' words moved').toBe(want + ' took root tonight.');
    }
  });

  test('a sitting that moved nothing just says she is done', async ({page}) => {
    await open(page, '2026-08-01');
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      a.reset(); a.setToday('2026-08-01');
      a.state.words.sessions = [{date:'2026-08-01', list:a.activeList().id, asked:8, words:8,
                                 firstTime:8, fresh:[], grew:[], slipped:[]}];
      a.save(); a.go('parent'); a.go('day');
      return {head: (document.querySelector('#say') || {}).textContent,
              screen: document.querySelector('#screen').innerText,
              said: document.querySelector('#say').textContent};
    });
    // No invented growth, and no number she has to parse. The screen is wordless; what she is
    // told (out.head, off #say) is the honest "done", not a count.
    expect(out.head).toMatch(/All done for today|first go/);
    expect(out.screen).not.toMatch(/took root/);
    expect(out.screen).not.toMatch(/known well/);
    /* And not read out either, since 11.9. This line used to require the count in the
       announcement on the reasoning that a screen reader is the one place she can still hear
       it — but it is not: the picture carries the same numbers as its own label, so she finds
       them where the sighted child finds the picture instead of having a nought pushed at her
       as the screen arrives. */
    expect(out.said, 'a count she cannot see is read out to her').not.toMatch(/known well/);
    expect(out.said.length, 'nothing was announced at all').toBeGreaterThan(4);
  });

  /* Met tonight and climbed tonight are the same event for a brand-new word, and it
     is recorded in both lists — so counting them separately told her "10 more took
     root" when five shapes had changed. */
  test('the number matches the shapes that changed', async ({page}) => {
    await open(page, '2026-08-01');
    await sit(page, ['rain', 'boat', 'said', 'went']);
    const out = await page.evaluate(() => {
      const n = document.querySelectorAll('#screen .net-cell.arriving').length;
      // Wordless screen: the count is spoken now, off #say, not drawn in a headline.
      const head = (document.querySelector('#say') || {}).textContent || '';
      const t = window.__acorn.tonight();
      return {marked: n, head: head, fresh: t.fresh.length, grew: t.grew.length};
    });
    const said = out.head.match(/^(\w+) took root/);
    expect(said, 'unexpected wording: ' + out.head).not.toBeNull();
    const WORDS = {One:1, Two:2, Three:3, Four:4, Five:5, Six:6, Seven:7, Eight:8, Nine:9};
    const n = WORDS[said[1]] || Number(said[1]);
    expect(n, 'the number is not the number of shapes that changed').toBe(out.marked);
    // And a brand-new word is in both lists, which is where the double count came from.
    expect(out.fresh + out.grew, 'this case should exercise the overlap')
      .toBeGreaterThan(out.marked);
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

  /* She practised again after tea and watched the same three words swell a second
     time, which says "this is new" about something she had already been shown. Only
     what is new since she last looked arrives. */
  test('a second sitting the same evening only grows what is new', async ({page}) => {
    await open(page, '2026-08-01');
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      const arriving = () => [...document.querySelectorAll('#screen .net-cell.arriving')]
        .map(c => c.querySelector('title').textContent);
      const sit = () => {
        a.start();
        let g = 0;
        while(a.session() && g++ < 80){
          const W = a.session();
          if(W.stage === 'look'){ a.cover(); continue; }
          if(W.stage === 'write'){ a.type(W.words[W.i]); a.check(); a.next(); continue; }
          a.next();
        }
      };
      sit();
      const one = arriving();
      document.querySelector('#again').click();
      sit();
      const two = arriving();
      return {one, two, head: (document.querySelector('#say') || {}).textContent};
    });
    expect(out.one.length, 'nothing arrived the first time').toBeGreaterThan(0);
    expect(out.two.filter(w => out.one.includes(w)),
           'she watched the same words arrive twice').toEqual([]);
    // The count is still the honest total for the evening — "tonight", not "just now". Spoken
    // now, so the praise may follow it; the reward line is there, not anchored to the end.
    expect(out.head).toMatch(/took root tonight\./);
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

  /* Step 1 of the end-of-session reimagining: the WHOLE garden settles in on arrival, not only
     tonight's words. Every other cell eases up gently (.settling) while tonight's swell (.arriving),
     so the map feels alive as it forms — with no interaction and nothing new for her to learn. */
  test('the whole map settles in on arrival, not only tonight’s words', async ({page}) => {
    await open(page, '2026-08-01');
    await sit(page, ['rain', 'boat', 'said', 'went']);
    const r = await page.evaluate(() => ({
      settling: document.querySelectorAll('#screen .net-cell.settling').length,
      arriving: document.querySelectorAll('#screen .net-cell.arriving').length,
      total:    document.querySelectorAll('#screen .net-cell').length,
      // The motion is driven by the Web Animations API, not a CSS transition — a transition on
      // freshly-built DOM is suppressed on its first paint and skipped the flourish silently on a
      // fast compositor. Counting real animation objects proves the arrival actually plays, which
      // a class-only check (present but frozen at the end state) cannot tell apart from nothing.
      moving: document.getAnimations().filter(a => a.effect && a.effect.target &&
              a.effect.target.classList && a.effect.target.classList.contains('net-cell')).length,
    }));
    expect(r.arriving, 'tonight’s words still swell in').toBeGreaterThan(0);
    expect(r.settling, 'the rest of the garden settles in too, not just tonight’s').toBeGreaterThan(0);
    expect(r.settling + r.arriving, 'every cell takes part in the arrival').toBe(r.total);
    expect(r.moving, 'the cells are actually animating in, not frozen at the end state')
      .toBeGreaterThan(0);
  });

  /* The way on from the finished screen is a pebble that breathes, not a worded button (David):
     the same organic blob she collects, larger and gently pulsing — an invitation with no text. It
     must still be a named, tappable control and it must actually pulse when motion is not reduced. */
  test('the way on is a named, breathing pebble, not a worded button', async ({page}) => {
    await page.emulateMedia({reducedMotion: 'no-preference'});
    await open(page, '2026-08-01');
    // A list with words left to meet after the sitting, so the pebble has something to offer and
    // appears — since 13.43 it hides when there is nothing more to give.
    await sit(page, ['rain', 'boat', 'said', 'went', 'rest', 'best', 'nest', 'test']);
    const b = await page.evaluate(() => {
      const el = document.querySelector('#again');
      if(!el) return null;
      return {cls: el.className,
              name: (el.getAttribute('aria-label') || el.textContent || '').trim(),
              text: el.textContent.trim(),
              hasPebble: !!el.querySelector('svg path'),
              anims: el.getAnimations({subtree: true}).length};
    });
    expect(b, 'the way on is gone').not.toBeNull();
    expect(b.cls, 'still the old worded button').toContain('morepeb');
    expect(b.text, 'the pebble carries visible words').toBe('');
    expect(b.name, 'the pebble is unnamed to a screen reader').toMatch(/practise/i);
    expect(b.hasPebble, 'no pebble shape drawn').toBe(true);
    expect(b.anims, 'the pebble does not breathe').toBeGreaterThan(0);
  });

  /* There is no headline on the finished screen to wrap any more — it went wordless (David), so
     the "never more than two lines" guard that protected the "N took root tonight" line retired
     with the line itself. What matters now is that the wordless screen still fits and the way on
     is always there, at every phone and text size — which the next test covers. The one line that
     remains anywhere on a finished screen is the dead end's fixed, short "No words yet. Ask a
     grown-up to add some.", which cannot grow with the count. */

  test('the whole screen still fits, on every phone at every text size', async ({page}) => {
    for(const vp of [{width:320, height:568}, {width:375, height:667}, {width:390, height:844}]){
      await page.setViewportSize(vp);
      await open(page, '2026-08-01');
      for(const scale of [0.9, 1, 1.15, 1.3, 1.5]){
        // Fresh each scale (mastery accumulates across a page otherwise), so every one is a just-
        // finished first sitting with words still to meet — and the pebble is on the screen, its
        // layout measured too.
        await page.evaluate(s => { window.__acorn.state.settings.textScale = s;
                                   window.__acorn.state.words.mastery = {};
                                   window.__acorn.state.words.sessions = [];
                                   window.__acorn.save(); }, scale);
        await sit(page, ['rain', 'boat', 'said', 'went', 'rest', 'best', 'nest', 'test']);
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
        // The way on is there while there is more to practise.
        await expect(page.locator('#again')).toBeVisible();
      }
    }
  });
});
