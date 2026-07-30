// The microphone key on the keyboard.
//
// She worked out that the phone's keyboard has a microphone on it, said the word, and the
// phone spelled it for her. That is a clever thing to have noticed and no use at all for
// learning to spell, because the one thing that makes a spelling stick is pulling it out of
// her own head.
//
// A web page cannot reach the software keyboard — there is no API for hiding one of its
// keys — so the mic cannot be taken away and none of this is about blocking it. What the
// app can do is notice that the letters did not arrive from her writing them. Measured
// across six ways of filling the box, the signature is unambiguous: typing puts in one
// character per input event, while dictation, glide typing, a tap on the predictive bar
// and a paste all put the whole word in at once.
//
// The jump in length is the signal, deliberately and not the keystroke count. Counting
// keystrokes would catch one more case — a phone that dictates a letter at a time — but its
// safety depends on iOS software keyboards firing keydown for their letters, which is the
// one thing that cannot be checked without her phone. If that assumption were wrong, every
// word she wrote by hand would be refused and the failure would be total and invisible.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

async function onAWord(page, opts){
  const o = opts || {};
  await page.evaluate(w => {
    const a = window.__acorn;
    const id = 'wr' + (++window.__nth || (window.__nth = 1));
    if(w === false) a.state.settings.written = false;
    a.state.words.lists = [{id: id, name: 'T', words: ['beautiful', 'said']}];
    a.state.words.activeId = id;
    a.state.words.mastery = {}; a.state.words.sessions = [];
    a.save(); a.go('day'); if(!a.session()) a.start();
    if(a.session().stage === 'look') a.cover();
  }, o.written === undefined ? true : o.written);
  await page.evaluate(() => { const t = document.querySelector('#toast'); if(t) t.textContent = ''; });
}

// The ways a phone can fill the box without her writing anything.
const HANDED_TO_HER = {
  'dictation, in one block': async page => page.evaluate(() => {
    const b = document.querySelector('#type');
    b.value = 'beautiful';
    b.dispatchEvent(new InputEvent('input',
      {bubbles: true, inputType: 'insertText', data: 'beautiful'}));
  }),
  /* Captured on her phone — iOS 18.7, Safari — rather than guessed at. This was modelled as
     insertReplacementText with two partials, and the real thing is insertText carrying the
     whole recognised string each time while the field is replaced with it: "Be", "Beaut",
     "Beautifu", "Beautiful", "Beautiful". Jumps of 2, 3, 3, 1, 0, no composition events, no
     keydowns at all, and a capital B nobody asked for. A guessed fixture that happens to be
     caught is not evidence that the real one is. */
  'dictation, as iOS 18.7 really sends it': async page => page.evaluate(async () => {
    const b = document.querySelector('#type');
    for(const data of ['Be', 'Beaut', 'Beautifu', 'Beautiful', 'Beautiful']){
      b.dispatchEvent(new InputEvent('beforeinput',
        {bubbles: true, cancelable: true, inputType: 'insertText', data: data}));
      b.value = data;
      b.dispatchEvent(new InputEvent('input',
        {bubbles: true, inputType: 'insertText', data: data}));
      await new Promise(r => setTimeout(r, 15));
    }
  }),
  'a glide across the keys': async page => page.evaluate(() => {
    const b = document.querySelector('#type');
    b.dispatchEvent(new CompositionEvent('compositionstart', {bubbles: true}));
    b.value = 'beautiful';
    b.dispatchEvent(new InputEvent('input',
      {bubbles: true, inputType: 'insertCompositionText', data: 'beautiful'}));
    b.dispatchEvent(new CompositionEvent('compositionend', {bubbles: true, data: 'beautiful'}));
  }),
  'a tap on the suggestion bar': async page => page.evaluate(() => {
    const b = document.querySelector('#type');
    b.value = 'beau';
    b.dispatchEvent(new InputEvent('input', {bubbles: true, inputType: 'insertText', data: 'u'}));
    b.value = 'beautiful';
    b.dispatchEvent(new InputEvent('input',
      {bubbles: true, inputType: 'insertReplacementText', data: 'beautiful'}));
  }),
};

/* The case the jump test cannot see: dictation handed over one letter at a time, so no jump
   is ever bigger than one. Only "no keystroke behind any of it" catches it, and only once
   the device has been seen to report keystrokes — so it is kept apart from the always-caught
   cases above, which need no such history. */
const LETTER_AT_A_TIME = async page => page.evaluate(async () => {
  const b = document.querySelector('#type');
  for(const ch of 'beautiful'){
    b.value += ch;
    b.dispatchEvent(new InputEvent('input',
      {bubbles: true, inputType: 'insertText', data: ch}));
    await new Promise(r => setTimeout(r, 5));
  }
});

// The ways she really writes it, which must all go straight through.
const HER_OWN_HAND = {
  'the keyboard here': async page => page.keyboard.type('beautiful', {delay: 20}),
  'slowly': async page => page.keyboard.type('beautiful', {delay: 90}),
  'an android ime that names no key': async page => page.evaluate(async () => {
    const b = document.querySelector('#type');
    for(const ch of 'beautiful'){
      b.dispatchEvent(new KeyboardEvent('keydown', {bubbles: true, key: 'Unidentified', keyCode: 229}));
      b.value += ch;
      b.dispatchEvent(new InputEvent('input', {bubbles: true, inputType: 'insertText', data: ch}));
    }
  }),
  'with a mistake rubbed out': async page => {
    await page.keyboard.type('beaut', {delay: 20});
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('utiful', {delay: 20});
  },
  'starting over': async page => {
    await page.keyboard.type('beeoo', {delay: 20});
    await page.keyboard.press('Control+a');
    await page.keyboard.type('beautiful', {delay: 20});
  },
};

const state = page => page.evaluate(() => {
  const W = window.__acorn.session();
  return {stage: W ? W.stage : null, right: W ? W.right : null, tries: W ? W.tries : null,
          box: (document.querySelector('#type') || {}).value,
          toast: (document.querySelector('#toast') || {}).textContent || '',
          said: (document.querySelector('#say') || {}).textContent || '',
          mastery: window.__acorn.state.words.mastery};
});

// A device that has typed at least once, which is what turns the keystroke signal on.
async function hasTyped(page){
  await page.evaluate(() => { window.__acorn.state.settings.sawKeys = true;
                              window.__acorn.save(); });
}

test.describe('the word has to be written, not said', () => {

  test('the keystroke signal only counts once the device has shown it reports keystrokes',
    async ({page}) => {
    /* Measured on her phone: typing gives one keydown per letter on iOS 18.7, dictating gives
       none. That is what makes "no keystroke behind any of it" a real signal, and it is what
       could not be checked from a desktop when the check first went in — if a keyboard
       reported no keystrokes, this would have refused every word she ever wrote. So it stays
       out of the way until the device proves it reports them, and at worst one word slips
       through before she has ever typed anything. */
    await open(page, '2026-08-01');
    // A keyboard that reports nothing but letters, on a device that has never seen a key.
    await onAWord(page);
    await page.evaluate(() => { window.__acorn.state.settings.sawKeys = false;
                                window.__acorn.save(); });
    await LETTER_AT_A_TIME(page);
    await page.locator('#check').click();
    expect((await state(page)).stage,
      'a keyboard that reports no keystrokes was locked out').toBe('check');

    // And once it has, the same input is caught.
    await onAWord(page);
    await hasTyped(page);
    await LETTER_AT_A_TIME(page);
    await page.locator('#check').click();
    const r = await state(page);
    expect(r.stage, 'a letter at a time slipped through on a device that reports keys')
      .toBe('write');
    expect(Object.keys(r.mastery)).toEqual([]);
  });

  test('typing sets the flag, on the first letter she ever writes', async ({page}) => {
    await open(page, '2026-08-01');
    await onAWord(page);
    await page.evaluate(() => { window.__acorn.state.settings.sawKeys = false;
                                window.__acorn.save(); });
    await page.locator('#type').click();
    await page.keyboard.type('b');
    expect(await page.evaluate(() => window.__acorn.state.settings.sawKeys),
      'a real keystroke did not teach the app that this keyboard reports them').toBe(true);
    // Backspace and Enter are not letters and must not count as her writing.
    expect(await page.evaluate(() => window.__acorn.session().keys)).toBe(1);
    await page.keyboard.press('Backspace');
    expect(await page.evaluate(() => window.__acorn.session().keys)).toBe(1);
  });

  test('the count is per word, not per sitting', async ({page}) => {
    // Or the keystrokes from one word would vouch for the next word being dictated.
    await open(page, '2026-08-01');
    await onAWord(page);
    await hasTyped(page);
    const word = await page.evaluate(() =>
      window.__acorn.session().words[window.__acorn.session().i]);
    await page.locator('#type').click();
    await page.keyboard.type(word, {delay: 10});
    await page.locator('#check').click();
    expect((await state(page)).stage).toBe('check');
    await page.locator('#next').click();
    await page.evaluate(() => {
      if(window.__acorn.session().stage === 'look') window.__acorn.cover();
    });
    expect(await page.evaluate(() => window.__acorn.session().keys),
      'the keystrokes from the last word carried over to this one').toBe(0);
    await HANDED_TO_HER['dictation, in one block'](page);
    await page.locator('#check').click();
    expect((await state(page)).stage,
      'a dictated word was vouched for by the keystrokes of the one before it').toBe('write');
  });

  test('a word the phone spelled for her is not taken as her spelling it', async ({page}) => {
    await open(page, '2026-08-01');
    for(const [why, fill] of Object.entries(HANDED_TO_HER)){
      await onAWord(page);
      await page.locator('#type').click();
      await fill(page);
      await page.locator('#check').click();
      const r = await state(page);
      expect(r.stage, `${why}: was marked as her answer`).toBe('write');
      expect(Object.keys(r.mastery), `${why}: went on her record`).toEqual([]);
      expect(r.box, `${why}: the word was left in the box for her to just press again`).toBe('');
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('and every way she really writes it goes straight through', async ({page}) => {
    /* The half that matters more. A check that stops her practising is far worse than the
       thing it is stopping, and the android case is the one to watch: some keyboards fire
       keydown with no key name at all, one per letter, and that is her writing. */
    await open(page, '2026-08-01');
    for(const [why, fill] of Object.entries(HER_OWN_HAND)){
      await onAWord(page);
      await page.locator('#type').click();
      await fill(page);
      await page.locator('#check').click();
      const r = await state(page);
      expect(r.stage, `${why}: her own writing was refused`).toBe('check');
      expect(r.right, `${why}: written correctly and not counted`).toBe(1);
      expect(r.mastery.beautiful, `${why}: nothing went on her record`).toBeTruthy();
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('she keeps the word rather than losing it', async ({page}) => {
    /* This is not her getting a word wrong, so it must not cost her anything: no miss, no
       requeue, no new shape on the map, nothing to notice later. And it has to be
       recoverable in the same breath — she writes it out and it counts as her first go. */
    await open(page, '2026-08-01');
    await onAWord(page);
    const word = await page.evaluate(() => window.__acorn.session().words[window.__acorn.session().i]);
    await page.locator('#type').click();
    await HANDED_TO_HER['dictation, in one block'](page);
    await page.locator('#check').click();
    const held = await state(page);
    expect(held.tries, 'it was counted as a go at the word').toBe(0);
    expect(await page.evaluate(() => window.__acorn.session().requeue)).toEqual([]);
    expect(await page.evaluate(() => window.__acorn.session().failed)).toEqual([]);
    expect(await page.evaluate(() => window.__acorn.session().words[window.__acorn.session().i]))
      .toBe(word);
    // Now she writes it.
    await page.locator('#type').click();
    await page.keyboard.type(word, {delay: 20});
    await page.locator('#check').click();
    const done = await state(page);
    expect(done.stage).toBe('check');
    expect(await page.evaluate(() => window.__acorn.session().firstTime),
      'writing it after being asked to did not count as her first go').toBe(1);
  });

  test('what she is told is not an accusation, and never her own attempt', async ({page}) => {
    // Every other message in this app is careful; this one has more reason to be.
    await open(page, '2026-08-01');
    await onAWord(page);
    await page.locator('#type').click();
    await HANDED_TO_HER['dictation, in one block'](page);
    await page.locator('#check').click();
    const r = await state(page);
    for(const nasty of ['wrong', 'cheat', 'not allowed', 'no ', 'stop', 'must', "don't",
                        'fail', 'invalid', 'error', 'microphone', 'dictat', 'voice'])
      expect(r.toast.toLowerCase(), `she was told "${r.toast}"`).not.toContain(nasty);
    expect(r.toast).toMatch(/writing/i);
    // A screen reader hears it too, or the message only exists for a child who can read it.
    expect(r.said, 'the note was never announced').toMatch(/writing/i);
  });

  test('typing it wrong is still just typing it wrong', async ({page}) => {
    // The check must not swallow an ordinary miss, which is a real part of the practice.
    await open(page, '2026-08-01');
    await onAWord(page);
    await page.locator('#type').click();
    await page.keyboard.type('beutiful', {delay: 20});
    await page.locator('#check').click();
    const r = await state(page);
    expect(r.stage, 'a real miss was treated as though the phone had spelled it').toBe('check');
    expect(r.tries).toBe(1);
    expect(r.mastery.beautiful, 'the miss was not recorded').toBeTruthy();
  });

  test('a character that takes two units to store is still one key', async ({page}) => {
    /* An emoji is one press of one key and two UTF-16 units, so measuring the box's .length
       made three smileys look like six characters arriving from nowhere. Her own typing,
       flagged. The count is in characters now, the way a person counts them. */
    await open(page, '2026-08-01');
    for(const junk of ['😀😀😀', '🙂', 'café', '👍🏽']){
      await onAWord(page);
      await page.locator('#type').click();
      await page.keyboard.type(junk);
      const flagged = await page.evaluate(() => !!window.__acorn.session().notWritten);
      expect(flagged, `typing ${JSON.stringify(junk)} was taken as the phone doing it`).toBe(false);
    }
  });

  test('a fumble does not follow her to the next thing she writes', async ({page}) => {
    /* The check for an answer with no letters in it returns before anything else runs, and
       it used to return without clearing the verdict — so an emoji, or a stray tap on the
       full stop, left a flag sitting there and the next word she wrote properly was handed
       back to her. Two taps to get into a state she could not type her way out of. */
    await open(page, '2026-08-01');
    await onAWord(page);
    const word = await page.evaluate(() =>
      window.__acorn.session().words[window.__acorn.session().i]);
    await page.locator('#type').click();
    await page.keyboard.type('😀😀😀');
    await page.locator('#check').click();
    expect((await state(page)).toast).toMatch(/Have a go/);
    // Now write the word properly. It has to count.
    await page.locator('#type').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(word, {delay: 15});
    await page.locator('#check').click();
    const r = await state(page);
    expect(r.stage, 'the fumble was still hanging over her next answer').toBe('check');
    expect(r.right).toBe(1);
  });

  test('a paste into the spelling box never lands', async ({page}) => {
    /* The same hole with no ambiguity about it at all. Before this, pasting the word in
       was marked right. */
    await open(page, '2026-08-01');
    await onAWord(page);
    await page.locator('#type').click();
    const landed = await page.evaluate(() => {
      const b = document.querySelector('#type');
      const bi = new InputEvent('beforeinput', {bubbles: true, cancelable: true,
        inputType: 'insertFromPaste', data: 'beautiful'});
      const allowed = b.dispatchEvent(bi);
      if(allowed){
        b.value = 'beautiful';
        b.dispatchEvent(new InputEvent('input',
          {bubbles: true, inputType: 'insertFromPaste', data: 'beautiful'}));
      }
      return {allowed, value: b.value};
    });
    expect(landed.allowed, 'the paste was not stopped').toBe(false);
    expect(landed.value, 'the word arrived in the box anyway').toBe('');
    await page.locator('#check').click();
    expect((await state(page)).stage).toBe('write');
    expect(Object.keys((await state(page)).mastery)).toEqual([]);
  });

  test('a grown-up can turn it off, and then dictation counts', async ({page}) => {
    /* Two reasons it has to be switchable. Dictation is a real accommodation in other
       places and this app does not get to decide that for her; and if the check ever
       misfires on her phone it must not be the thing that stops her practising. */
    await open(page, '2026-08-01');
    await onAWord(page, {written: false});
    await page.locator('#type').click();
    await HANDED_TO_HER['dictation, in one block'](page);
    await page.locator('#check').click();
    const r = await state(page);
    expect(r.stage, 'the check ran with the setting off').toBe('check');
    expect(r.right).toBe(1);
  });

  test('the switch is in the grown-ups area and reads as a pair', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    const group = page.locator('[aria-labelledby="l-wr"]');
    await expect(group).toHaveAttribute('role', 'group');
    await expect(page.locator('#l-wr')).toHaveText(/written/i);
    // On by default, and the pair always disagrees.
    expect(await page.locator('[data-wr="1"]').getAttribute('aria-pressed')).toBe('true');
    expect(await page.locator('[data-wr="0"]').getAttribute('aria-pressed')).toBe('false');
    await page.locator('[data-wr="0"]').click();
    expect(await page.evaluate(() => window.__acorn.state.settings.written)).toBe(false);
    expect(await page.locator('[data-wr="0"]').getAttribute('aria-pressed')).toBe('true');
    expect(await page.locator('[data-wr="1"]').getAttribute('aria-pressed')).toBe('false');
    await page.locator('[data-wr="1"]').click();
    expect(await page.evaluate(() => window.__acorn.state.settings.written)).toBe(true);
  });

  test('the setting survives a reload and rubbish in storage', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => {
      window.__acorn.state.settings.written = false;
      window.__acorn.save();
    });
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    expect(await page.evaluate(() => window.__acorn.state.settings.written)).toBe(false);
    for(const junk of ['null', '"yes"', '0', '{}', '[]', '3']){
      await page.evaluate(j => {
        const s = JSON.parse(localStorage.getItem('acorn.v1'));
        s.settings.written = JSON.parse(j);
        localStorage.setItem('acorn.v1', JSON.stringify(s));
      }, junk);
      await page.reload();
      await page.waitForFunction(() => !!window.__acorn);
      const v = await page.evaluate(() => window.__acorn.state.settings.written);
      expect(typeof v, `a stored ${junk} came through as ${typeof v}`).toBe('boolean');
    }
    expect(errorsOf(page)).toEqual([]);
  });

});
