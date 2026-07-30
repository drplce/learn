// The first Tab of a sitting, and the explanations a screen reader was not given.
//
// restoreFocus() learned to prefer the action that moves her on rather than "Hear it", and
// that fixed every screen except the first one. The flag that says "she is on a keyboard"
// goes up during the Tab keydown, and the browser then moves focus by document order
// regardless — which lands on "Hear it", where Enter reads the word out again. There is
// nothing on the screen to say that a second Tab is needed, so a keyboard-only sitting
// opened with the word being read out over and over. The existing budget test in
// a11y-motion.spec.js stepped around this by re-rendering after its Tab.
//
// Driven with real keys, because that is the only way the ordering shows up: the test API
// moves stages without the browser ever choosing where focus goes.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

async function sittingOf(page, words){
  await page.evaluate(ws => {
    const a = window.__acorn;
    const id = 'ka' + (++window.__nth || (window.__nth = 1));
    a.state.words.lists = [{id: id, name: 'T', words: ws}];
    a.state.words.activeId = id;
    a.state.words.mastery = {}; a.state.words.sessions = [];
    a.save(); a.go('day'); if(!a.session()) a.start();
  }, words);
}
/* Record what the app decided about each key, rather than racing it.
   The first version of this installed a one-shot listener and pressed the key without
   awaiting the install — which passed on its own and failed once in a full parallel run,
   because the listener sometimes went on after the keypress had already been and gone. So
   the listener is installed once, awaited, and writes to a variable that is read afterwards.
   It listens in the capture phase after the app's own handler, so what it records is the
   app's decision and not the browser's. */
async function watchKeys(page){
  await page.evaluate(() => {
    window.__lastKey = null;
    document.addEventListener('keydown', e => {
      window.__lastKey = {key: e.key, shift: e.shiftKey, prevented: e.defaultPrevented};
    }, true);
  });
}
const lastKey = page => page.evaluate(() => window.__lastKey);

const here = page => page.evaluate(() => {
  const a = window.__acorn, W = a.session(), e = document.activeElement || {};
  return {stage: W ? W.stage : 'done', focus: e.id || e.className || e.tagName,
          isPrimary: !!e.classList && e.classList.contains('primary'),
          label: (e.textContent || '').trim().slice(0, 20)};
});

test.describe('arriving on a screen with a keyboard', () => {

  test('she arrives on the trace box, ready to type', async ({page}) => {
    /* Since 13.0 the first screen is a trace she copies into a box, not a "Cover it up"
       button. The box is focused on arrival, so a keyboard user starts typing straight
       away — no hunt for a button, no first Tab landing on the speaker dead-end. */
    await open(page, '2026-08-01');
    await sittingOf(page, ['said', 'rain']);
    expect((await here(page)).stage).toBe('look');
    expect((await here(page)).focus, 'she did not arrive on the box').toBe('type');
  });

  test('typing the word on arrival traces it and moves her to writing', async ({page}) => {
    /* The obvious action moves her forward: copying the word finishes the trace and takes
       her to writing it from memory, rather than leaving her on a screen that only reads
       the word out again. */
    await open(page, '2026-08-01');
    await sittingOf(page, ['said', 'rain']);
    await page.keyboard.type('said');
    await page.waitForFunction(() => window.__acorn.session()
      && window.__acorn.session().stage !== 'look', null, {timeout: 2000});
    expect((await here(page)).stage, 'the trace did not move her on').toBe('write');
  });

  test('a whole sitting is possible with keys alone', async ({page}) => {
    /* End to end, counting the presses. Before this it never finished at all: forty presses
       in and still on the first word with the word being read out each time. */
    await open(page, '2026-08-01');
    await sittingOf(page, ['said', 'rain']);
    let keys = 0, guard = 0;
    const seen = [];
    while(guard++ < 40){
      const st = await here(page);
      if(st.stage === 'done'){ seen.push('done'); break; }
      seen.push(st.stage + '/' + st.focus);
      const w = await page.evaluate(() =>
        window.__acorn.session().words[window.__acorn.session().i]);
      if(st.stage === 'look'){                             // the trace box, focused on arrival
        expect(st.focus, 'she had to hunt for the trace box').toBe('type');
        await page.keyboard.type(w); keys += w.length;     // copying it finishes the trace
        await page.waitForFunction(() => window.__acorn.session()
          && window.__acorn.session().stage !== 'look', null, {timeout: 2000});
      }else if(st.stage === 'write'){
        expect(st.focus, 'she had to hunt for the box to type in').toBe('type');
        await page.keyboard.type(w); keys += w.length;
        await page.keyboard.press('Enter'); keys++;        // return submits
      }else{                                               // the verdict: return carries her on
        await page.keyboard.press('Enter'); keys++;
      }
    }
    expect(seen[seen.length - 1], 'the sitting never finished').toBe('done');
    expect(keys, `${keys} presses for a two-word sitting`).toBeLessThan(40);
    // No stage was ever visited twice in a row on the same focus, which is what a dead end
    // looks like from out here.
    for(let i = 1; i < seen.length; i++)
      expect(seen[i] === seen[i - 1] && /look|check/.test(seen[i]),
        `stuck on ${seen[i]}`).toBe(false);
    expect(errorsOf(page)).toEqual([]);
  });

  test('on the writing stage Tab still just moves off the box', async ({page}) => {
    /* The exception, and the reason the correction is scoped to screens with no box: focus
       is already where she needs it there, and hijacking Tab would trap her in the box. */
    await open(page, '2026-08-01');
    await sittingOf(page, ['said']);
    await page.evaluate(() => {
      if(window.__acorn.session().stage === 'look') window.__acorn.cover();
    });
    await page.locator('#type').focus();
    await page.keyboard.press('Tab');
    const r = await here(page);
    expect(r.focus, 'Tab did not move off the box').not.toBe('type');
  });

  test('Shift+Tab is left alone', async ({page}) => {
    /* Someone going backwards is not asking to be sent to the primary action.
       Asserted on the mechanism rather than on where focus ends up, because backwards tab
       order from the body wraps to the last focusable thing on the screen — which on the
       look stage is the primary. My first version of this checked the destination and
       failed on a coincidence, unable to tell the app hijacking the key from the browser
       arriving there by itself. Whether the default was prevented says exactly which. */
    await open(page, '2026-08-01');
    await sittingOf(page, ['said', 'rain']);
    await watchKeys(page);
    await page.keyboard.press('Shift+Tab');
    expect(await lastKey(page), 'the app took over Shift+Tab')
      .toMatchObject({key: 'Tab', shift: true, prevented: false});
  });

  test('and plain Tab really is the app taking over, once', async ({page}) => {
    // The other side of the same guard: it fires on the first Tab and never again. The
    // redirect is for a screen with no box — since 13.0 that is the verdict, not the
    // first screen (which is a trace box), so drive to a miss verdict to test it.
    await open(page, '2026-08-01');
    await sittingOf(page, ['said', 'rain']);
    await page.evaluate(() => { const a = window.__acorn; a.cover(); a.type('zzz'); a.check(); });
    await watchKeys(page);
    await page.keyboard.press('Tab');
    expect((await lastKey(page)).prevented, 'the first Tab was not redirected').toBe(true);
    await page.keyboard.press('Tab');
    expect((await lastKey(page)).prevented,
      'Tab is still being taken over after the first one').toBe(false);
  });

  test('a touch user gets no focus ring on a button out of nowhere', async ({page}) => {
    /* The trace box may hold focus — she types into it, as on the write screen, and the
       keyboard opening there is wanted. What must never happen on a touchscreen is a focus
       ring landing on an action button she has not tapped. */
    await open(page, '2026-08-01');
    await sittingOf(page, ['said', 'rain']);
    const r = await here(page);
    expect(r.isPrimary, `focus jumped to the primary "${r.focus}" with no key pressed`).toBe(false);
    expect(['BODY', 'HTML', 'kbhold', 'type'], `focus jumped to ${r.focus} with no key pressed`)
      .toContain(r.focus);
  });

  test('and a pointer press afterwards puts it back to touch behaviour', async ({page}) => {
    await open(page, '2026-08-01');
    await sittingOf(page, ['said', 'rain']);
    // A miss verdict — the screen with the continue button a keyboard user's ring lands on.
    await page.evaluate(() => { const a = window.__acorn; a.cover(); a.type('zzz'); a.check(); });
    await page.keyboard.press('Tab');
    expect((await here(page)).isPrimary).toBe(true);
    await page.mouse.click(5, 5);                 // she touched the screen
    await page.evaluate(() => window.__acorn.go('day'));
    const r = await here(page);
    expect(r.isPrimary, 'a focus ring was still being moved about for a touch user').toBe(false);
  });

});

test.describe('what a screen reader is told about the settings', () => {

  test('a setting whose name does not explain it carries its explanation', async ({page}) => {
    /* Read by ear, this pair announced itself as "Written answers only, On, pressed" and
       nothing else — the one setting in here whose behaviour is not obvious from its name
       was the one with an explanation sitting underneath it, unattached. */
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    const group = page.locator('[aria-labelledby="l-wr"]');
    const id = await group.getAttribute('aria-describedby');
    expect(id, 'the toggle has no description').toBeTruthy();
    const hint = page.locator('#' + id);
    await expect(hint).toHaveCount(1);
    await expect(hint).toContainText(/microphone/i);
    await expect(hint).toContainText(/nothing is recorded against her/i);
  });

  test('and so do the two buttons that can lose her work', async ({page}) => {
    // Restore replaces everything on the device. That belongs to the button, not to the
    // paragraph after it.
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    for(const [sel, must] of [['#restoreGo', /replaces everything/i],
                              ['#copy', /paste somewhere safe/i]]){
      const id = await page.locator(sel).getAttribute('aria-describedby');
      expect(id, `${sel} has no description`).toBeTruthy();
      await expect(page.locator('#' + id)).toContainText(must);
    }
  });

  test('every aria-describedby on the grown-ups screen points at something real',
    async ({page}) => {
    // A dangling reference is silence, and silence is indistinguishable from a hint that
    // was never wired up in the first place.
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    const bad = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('[aria-describedby], [aria-labelledby]').forEach(el => {
        for(const attr of ['aria-describedby', 'aria-labelledby']){
          const v = el.getAttribute(attr);
          if(!v) continue;
          v.split(/\s+/).forEach(id => {
            const t = document.getElementById(id);
            if(!t) out.push(attr + '="' + id + '" on ' + (el.id || el.className) + ' — no such id');
            else if(!t.textContent.trim())
              out.push(attr + '="' + id + '" points at something empty');
          });
        }
      });
      return out;
    });
    expect(bad).toEqual([]);
  });

  test('the description is read, not duplicated into the name', async ({page}) => {
    // The mark announced "Acorn" twice once; a describedby that also lands in the
    // accessible name is the same fault in a different place.
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    const r = await page.evaluate(() => {
      const g = document.querySelector('[aria-labelledby="l-wr"]');
      const lbl = document.getElementById(g.getAttribute('aria-labelledby'));
      const dsc = document.getElementById(g.getAttribute('aria-describedby'));
      return {label: lbl.textContent.trim(), desc: dsc.textContent.trim()};
    });
    expect(r.label).toBe('Written answers only');
    expect(r.desc.startsWith(r.label), 'the description repeats the label').toBe(false);
  });

});
