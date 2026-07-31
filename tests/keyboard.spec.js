// The software keyboard closing between stages made the two buttons drop to the
// bottom of the screen and jump back up on the next word — twice per word. A
// focused input is kept on the page so the keyboard never closes mid-session.
const {test, expect} = require('@playwright/test');
const {open, errorsOf, write} = require('./helpers');

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

/* A faithful software keyboard: it shrinks visualViewport and leaves
   window.innerHeight alone, which is what iOS does and what makes this hard.
   Resizing the whole viewport, as an earlier version of this test did, is not
   the same thing and hides the bug. */
async function fakeKeyboard(page){
  await page.evaluate(() => {
    let kb = 0;
    const listeners = [];
    Object.defineProperty(window, 'visualViewport', {configurable: true, value: {
      get height(){ return window.innerHeight - kb; },
      get width(){ return window.innerWidth; },
      addEventListener(t, fn){ listeners.push(fn); }, removeEventListener(){},
    }});
    window.__kb = n => { kb = n; listeners.forEach(fn => fn());
                         window.dispatchEvent(new Event('resize')); };
  });
}
const kb = (page, n) => page.evaluate(v => window.__kb(v), n);
// WIN-4 removed the speaker button, so the writing box is the thing she looks at and it is
// what must not jump as the keyboard comes and goes.
const boxTop = page => page.evaluate(() =>
  Math.round(document.querySelector('.spellinwrap').getBoundingClientRect().top));

test.describe('the box holds still', () => {

  test('nothing moves once the keyboard height is known', async ({page}) => {
    await open(page, '2026-08-01');
    await pretendTouch(page, true);
    await fakeKeyboard(page);
    await page.evaluate(() => {
      // As remembered from a previous sitting.
      window.__acorn.state.settings.kbInset = 320;
      window.__acorn.save();
    });
    await startOn(page, ['because','friend','thought']);
    await page.evaluate(() => window.__acorn.cover());   // the writing box
    const seen = [];
    seen.push(await boxTop(page));                       // keyboard space reserved
    await kb(page, 320);                                 // it opens
    seen.push(await boxTop(page));
    await page.locator('.spellinwrap').click();          // a tap to replay must not shift it
    await kb(page, 0);                                   // iOS drops it anyway
    seen.push(await boxTop(page));
    await kb(page, 320);
    seen.push(await boxTop(page));
    await write(page, 'becuase');
    await kb(page, 0);
    seen.push(await boxTop(page));
    // The whole point: the box she is writing in never moves under her.
    expect(Math.max(...seen) - Math.min(...seen),
           'the box moved as the keyboard came and went: ' + seen.join(', ')).toBe(0);
  });

  /* The header is the last thing that was allowed to move. It is the first item
     in #app, which is a flex column the height of the visual viewport, so it can
     only stay put if the algorithm is not entitled to take height out of it: it
     is flex:none, and everything the keyboard changes comes out of main. Measured
     at every text size, with the keyboard opening and closing, because the header
     is hidden outright on a short screen and a test that only looked at the tall
     one would prove nothing. */
  test('and so does the header, at every text size', async ({page}) => {
    await open(page, '2026-08-01');
    await page.setViewportSize({width:375, height:667});
    await pretendTouch(page, true);
    await fakeKeyboard(page);
    await page.evaluate(() => {
      window.__acorn.state.settings.kbInset = 320;         // as remembered from before
      window.__acorn.save();
    });
    const bar = () => page.evaluate(() => {
      const n = document.querySelector('.bar'), r = n.getBoundingClientRect();
      const app = document.querySelector('#app'), ar = app.getBoundingClientRect();
      return {shown: getComputedStyle(n).display !== 'none',
              top: Math.round(r.top),
              // Pinned to the top of the app, not floated over it: still in flow,
              // still flush against the padding.
              flush: Math.round(r.top - ar.top - parseFloat(getComputedStyle(app).paddingTop)),
              inFlow: getComputedStyle(n).position === 'static'};
    });
    const moved = [];
    for(const scale of [0.9, 1, 1.15, 1.3, 1.5]){
      await page.evaluate(s => {
        const a = window.__acorn;
        a.state.settings.textScale = s;
        a.state.words.lists = [{id:'w1', name:'T', words:['because','friend','thought']}];
        a.state.words.activeId = 'w1'; a.state.words.mastery = {}; a.state.words.sessions = [];
        a.save(); a.go('parent'); a.go('day'); a.cover();
      }, scale);
      await kb(page, 0);
      const down = await bar();
      await kb(page, 320);
      const up = await bar();
      await kb(page, 0);
      const again = await bar();
      const say = s => (s.shown ? 'top ' + s.top : 'hidden');
      if(JSON.stringify(up) !== JSON.stringify(down) || JSON.stringify(again) !== JSON.stringify(down))
        moved.push(scale + 'x: ' + say(down) + ' -> ' + say(up) + ' -> ' + say(again));
      if(down.shown && (!down.inFlow || down.flush !== 0))
        moved.push(scale + 'x: the header is not pinned to the top of the app');
    }
    expect(moved).toEqual([]);
  });

  test('the keyboard height is remembered, so only a new phone ever moves',
    async ({page}) => {
      await open(page, '2026-08-01');
      await pretendTouch(page, true);
      await fakeKeyboard(page);
      await startOn(page, ['because','friend']);
      await page.evaluate(() => window.__acorn.cover());
      await kb(page, 300);                               // measured for the first time
      await page.waitForFunction(() => window.__acorn.state.settings.kbInset > 0,
                                 null, {timeout:3000});
      expect(await page.evaluate(() => window.__acorn.state.settings.kbInset)).toBe(300);

      // It survives a reload, so the next sitting starts stable.
      await page.reload();
      await page.waitForFunction(() => !!window.__acorn);
      expect(await page.evaluate(() => window.__acorn.state.settings.kbInset)).toBe(300);
    });

  test('a tap on the screen to replay does not take focus off the box', async ({page}) => {
    await open(page, '2026-08-01');
    await pretendTouch(page, true);
    await startOn(page, ['because','friend']);
    await page.evaluate(() => window.__acorn.cover());
    expect(await focused(page)).toBe('type');
    // WIN-4: a tap anywhere on the word screen replays the word. A tap that lands off the box
    // (here, the progress dots) must not blur the box she is typing into.
    await page.locator('.dots').click();
    expect(await focused(page)).toBe('type');
  });

  test('but a tap on a box she needs to type in still works', async ({page}) => {
    await open(page, '2026-08-01');
    await pretendTouch(page, true);
    await page.evaluate(() => window.__acorn.go('parent'));
    const prevented = await page.evaluate(() => {
      document.querySelector('#pname').focus();
      const ev = new MouseEvent('mousedown', {bubbles:true, cancelable:true});
      document.querySelector('#paste').dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    expect(prevented).toBe(false);
  });

  test('the grown-ups screen is not given a dead band', async ({page}) => {
    await open(page, '2026-08-01');
    await pretendTouch(page, true);
    await fakeKeyboard(page);
    await page.evaluate(() => {
      window.__acorn.state.settings.kbInset = 320; window.__acorn.save();
      window.__acorn.go('parent');
    });
    const used = await page.evaluate(() => {
      const app = document.querySelector('#app').getBoundingClientRect();
      return Math.round(app.height / window.innerHeight * 100);
    });
    // A long page needs its whole screen; reserving keyboard space there would
    // just get in the way.
    expect(used).toBeGreaterThan(90);
  });
});

test.describe('keeping the keyboard open', () => {

  test('a focused input is held through every stage of a word', async ({page}) => {
    await open(page, '2026-08-01');
    await pretendTouch(page, true);
    await startOn(page, ['because','friend','thought']);
    // Since 13.0 the look stage is a trace box she types into, so the real input
    // takes focus from the very first screen — the held placeholder is only needed on
    // the verdict, where there is no box.
    expect(await focused(page), 'trace stage').toBe('type');

    await page.evaluate(() => window.__acorn.cover());
    expect(await focused(page), 'write stage').toBe('type');

    await write(page, 'becuase');
    await page.keyboard.press('Enter');                        // return submits -> miss -> re-trace
    // WIN-1: a miss re-traces into a box she copies, so the real input keeps focus here too —
    // the held placeholder (#kbhold) is only needed on a win, the one word screen with no box.
    expect(await focused(page), 're-trace stage').toBe('type');

    // Copying the re-trace to its end carries her to the next word, another trace, box focused.
    for(const c of 'because') await page.keyboard.press(c);
    await page.waitForFunction(() => { const W = window.__acorn.session();
      return W && !W.retrace && W.stage === 'look'; }, null, {timeout: 2500});
    expect(await focused(page), 'next word').toBe('type');     // the next word traces, box focused
    expect(errorsOf(page)).toEqual([]);
  });

  test('tapping to hear the word again does not let the keyboard go', async ({page}) => {
    await open(page, '2026-08-01');
    await pretendTouch(page, true);
    await startOn(page, ['because','friend']);
    expect(await focused(page)).toBe('type');                 // the trace box holds focus
    // WIN-4: the speaker button is gone; a tap on the screen replays the word. It must not pull
    // focus off the box she is typing into. (This word is at the trace stage — .dots is on
    // every word stage, so it is the stable thing to tap.)
    await page.locator('.dots').click();
    expect(await focused(page)).toBe('type');
  });

  test('it lets go when the sitting ends', async ({page}) => {
    await open(page, '2026-08-01');
    await pretendTouch(page, true);
    await startOn(page, ['rain']);
    // A word she has never met is asked twice, so the sitting is not over after
    // one answer — walk it to the end rather than assuming.
    for(let i = 0; i < 12; i++){
      const stage = await page.evaluate(() => {
        const W = window.__acorn.session(); return W ? W.stage : 'done'; });
      if(stage === 'done') break;
      if(stage === 'look'){ await page.evaluate(() => window.__acorn.cover()); continue; }
      if(stage === 'write'){ await write(page, 'rain'); await page.keyboard.press('Enter'); continue; }
      await page.evaluate(() => window.__acorn.next());
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
    await page.evaluate(() => window.__acorn.cover());
    // The box she actually types into starts empty whatever she pressed before.
    expect(await page.locator('#type').inputValue()).toBe('');
    await write(page, 'because');
    await page.keyboard.press("Enter");
    await expect(page.locator('.word.won')).toBeVisible();   // WIN-5: the win is the green word
  });
});
