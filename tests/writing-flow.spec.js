// The 13.0 writing flow: a never-met word is TRACED (she copies it letter by letter,
// a wrong key discarded before it can show), a met word is written blind; the return
// key submits, a win advances on its own and a miss holds on the corrected word.
const {test, expect} = require('@playwright/test');
const {open, errorsOf, write} = require('./helpers');

// Put a specific list in front of her, unseen, and start a session.
async function startOn(page, words, mastery){
  await page.evaluate(o => {
    const a = window.__acorn;
    a.state.words.lists = [{id:'w1', name:'Test', words:o.words}];
    a.state.words.activeId = 'w1';
    a.state.words.mastery = o.mastery || {};
    a.state.words.sessions = [];
    a.save();
    a.start();
  }, {words, mastery});
}

test.describe('tracing a new word', () => {

  test('a new word shows a trace; its letters fill left to right', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['said']);
    // A never-met word arrives to be traced, not passively looked at.
    await expect(page.locator('.trace')).toBeVisible();
    const box = page.locator('#type');
    await expect(box).toBeVisible();
    expect(await page.evaluate(() => window.__acorn.session().stage)).toBe('look');

    await box.click();
    await page.keyboard.press('s');
    await expect(box).toHaveValue('s');
    await expect(page.locator('.tracew .on')).toHaveCount(1);   // one letter landed
    await page.keyboard.press('a');
    await page.keyboard.press('i');
    await expect(box).toHaveValue('sai');
    await expect(page.locator('.tracew .on')).toHaveCount(3);
  });

  test('a wrong key is ignored and never appears', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['said']);
    const box = page.locator('#type');
    await box.click();
    await page.keyboard.press('s');
    // Every wrong key is discarded: the box and the trace stay the copied prefix, so
    // her error is never drawn on screen (§5).
    for(const wrong of ['x', 'z', 'q', 'i', 'd']){       // none is the next letter (a)
      await page.keyboard.press(wrong);
      await expect(box).toHaveValue('s');
      await expect(page.locator('.tracew .on')).toHaveCount(1);
    }
    const body = await page.locator('#screen').innerText();
    expect(body.toLowerCase()).not.toContain('x');
    expect(body.toLowerCase()).not.toContain('z');
    expect(body.toLowerCase()).not.toContain('q');
    expect(errorsOf(page)).toEqual([]);
  });

  test('completing the trace moves to a blind write of the same word', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['said']);
    const box = page.locator('#type');
    await box.click();
    for(const c of 'said') await page.keyboard.press(c);
    // The finished trace is the cover: the box clears and she writes it from memory.
    await expect(page.locator('.spellin')).toBeVisible();      // the blind write box
    await expect(page.locator('.trace')).toHaveCount(0);
    await expect(page.locator('.tracew')).toHaveCount(0);
    // A just-traced word carries no instruction line now (13.4).
    await expect(page.locator('.note')).toHaveCount(0);
    expect(await page.evaluate(() => window.__acorn.session().stage)).toBe('write');
    expect(await page.evaluate(() => window.__acorn.session().words[window.__acorn.session().i]))
      .toBe('said');                                           // still the same word
    // The write-stage guard counts only what she types from memory.
    expect(await page.evaluate(() => window.__acorn.session().keys)).toBe(0);
    expect(errorsOf(page)).toEqual([]);
  });
});

test.describe('a met word is written blind', () => {

  test('a review word starts at the write box — no trace, never shown', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['friend'], {friend:{right:3, wrong:0, box:3, lastSeen:'2026-07-20'}});
    await expect(page.locator('.spellin')).toBeVisible();      // straight to writing
    await expect(page.locator('.trace')).toHaveCount(0);
    await expect(page.locator('.tracew')).toHaveCount(0);
    await expect(page.locator('.word')).toHaveCount(0);        // the word is never shown (§1)
    expect(await page.evaluate(() => window.__acorn.session().stage)).toBe('write');
  });
});

test.describe('submitting and advancing', () => {

  test('the return key checks the word — there is no Check button', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['rain']);
    await page.evaluate(() => window.__acorn.cover());
    await expect(page.locator('#check')).toHaveCount(0);        // no visible Check button
    await write(page, 'rain');
    await page.keyboard.press('Enter');
    await expect(page.locator('.word.won')).toBeVisible();   // WIN-5: the win is the green word
  });

  test('a correct answer auto-advances within ~1.6s, no tap', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['rain', 'boat', 'tree']);
    await page.evaluate(() => window.__acorn.cover());
    await write(page, 'rain');
    await page.keyboard.press('Enter');
    await expect(page.locator('.word.won')).toBeVisible();   // WIN-5: the win is the green word
    const i0 = await page.evaluate(() => window.__acorn.session().i);
    // No tap: the app carries her on by itself.
    await page.waitForFunction(i => window.__acorn.session() && window.__acorn.session().i > i,
                               i0, {timeout: 1600});
    expect(errorsOf(page)).toEqual([]);
  });

  test('a miss does NOT auto-advance — it re-traces, and copying it carries her on', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['because', 'rain', 'boat']);
    await page.evaluate(() => window.__acorn.cover());
    await write(page, 'becuase');
    await page.keyboard.press('Enter');
    await expect(page.locator('.verdict.again')).toBeVisible();
    const i0 = await page.evaluate(() => window.__acorn.session().i);
    // No timer takes her off it: a miss re-traces (WIN-1), and she stays on it until she copies it.
    await page.waitForTimeout(1600);
    expect(await page.evaluate(() => window.__acorn.session().stage)).toBe('check');
    expect(await page.evaluate(() => window.__acorn.session().retrace)).toBe(true);
    expect(await page.evaluate(() => window.__acorn.session().i)).toBe(i0);
    // No chevron — the way on is the box she copies into.
    await expect(page.locator('#next')).toHaveCount(0);
    await expect(page.locator('#type')).toBeVisible();
    // Copying the word to its end advances her.
    for(const c of 'because') await page.keyboard.press(c);
    await page.waitForFunction(i => window.__acorn.session() && window.__acorn.session().i > i,
                               i0, {timeout: 2000});
  });

  test('copying a re-traced word corrects the shape but does NOT re-score it', async ({page}) => {
    /* WIN-1, David's call: the re-trace is corrective, not a second chance to win. The miss is
       already recorded (dropped to box 1, requeued for a real from-memory go later); copying the
       word back must add nothing — not a right, not a box bump — or a child who fails a word and
       then copies it would look like she had recovered it, which she has not. */
    await open(page, '2026-07-28');
    await startOn(page, ['boat', 'rain', 'said']);
    await page.evaluate(() => window.__acorn.cover());          // boat is new: traced, then written
    await write(page, 'boot');
    await page.keyboard.press('Enter');                         // miss -> re-trace
    const afterMiss = await page.evaluate(() => ({
      mastery: window.__acorn.state.words.mastery.boat,
      right: window.__acorn.session().right,
      requeued: window.__acorn.session().requeue.indexOf('boat') >= 0}));
    expect(afterMiss.mastery).toEqual({right: 0, wrong: 1, box: 1, lastSeen: '2026-07-28'});
    expect(afterMiss.requeued, 'a missed word comes back for a real go').toBe(true);
    // Copy the word to its end — the re-trace completes and carries her on.
    for(const c of 'boat') await page.keyboard.press(c);
    await page.waitForFunction(() => window.__acorn.session() && !window.__acorn.session().retrace,
                               null, {timeout: 2000});
    const afterCopy = await page.evaluate(() => ({
      mastery: window.__acorn.state.words.mastery.boat,
      right: window.__acorn.session().right,
      stillRequeued: window.__acorn.session().requeue.indexOf('boat') >= 0
                     || window.__acorn.session().words.slice(window.__acorn.session().i).indexOf('boat') >= 0}));
    expect(afterCopy.mastery, 'the copy re-scored the word').toEqual(afterMiss.mastery);
    expect(afterCopy.right, 'the copy counted as a right').toBe(afterMiss.right);
    expect(afterCopy.stillRequeued, 'the word must still come back for a real retrieval').toBe(true);
  });

  test('return skips the wait on a win, but a re-trace has to be copied', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['rain', 'boat', 'because']);
    // A win: return skips the settle and carries her on (the winning word is the Enter target).
    await page.evaluate(() => window.__acorn.cover());
    await write(page, 'rain');
    await page.keyboard.press('Enter');                        // check -> win
    await expect(page.locator('.word.won')).toBeVisible();
    const w0 = await page.evaluate(() => window.__acorn.session().i);
    await page.keyboard.press('Enter');                        // return skips the wait
    await page.waitForFunction(i => window.__acorn.session() && window.__acorn.session().i > i,
                               w0, {timeout: 2000});
    // A miss re-traces: return is swallowed by the copy handler, so it does NOT skip past it.
    await page.evaluate(() => { const a = window.__acorn;
      if(a.session().stage === 'look') a.cover(); });
    await write(page, 'boot');                                 // wrong -> re-trace of 'boat'
    await page.keyboard.press('Enter');
    await expect(page.locator('.verdict.again')).toBeVisible();
    const i0 = await page.evaluate(() => window.__acorn.session().i);
    await page.keyboard.press('Enter');                        // swallowed
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => window.__acorn.session().i),
      'return skipped past the re-trace instead of making her copy it').toBe(i0);
  });
});

test.describe('hearing the word again', () => {

  test('the speaker button is gone; a tap on the screen replays the word', async ({page}) => {
    await open(page, '2026-07-28');
    // Stub the synthesiser and drop the clip index so a replay takes the phone-voice
    // path we can observe.
    await page.evaluate(() => {
      window.__spoke = 0;
      Object.defineProperty(window, 'SpeechSynthesisUtterance',
        {value: function(t){ this.text = t; this.rate = 1; this.pitch = 1; }, configurable:true});
      Object.defineProperty(window, 'speechSynthesis', {configurable:true, value:{
        getVoices: () => [{name:'Karen', lang:'en-AU', voiceURI:'Karen'}],
        cancel(){}, speak(){ window.__spoke++; }, onvoiceschanged: null
      }});
      window.__acorn.clearVoiceCache();
      window.__acorn.setClips([]);
    });
    await startOn(page, ['rain']);
    // WIN-4: no speaker button anywhere, and the words "Hear it" appear nowhere.
    await expect(page.locator('#hear')).toHaveCount(0);
    expect(await page.locator('#app').innerText()).not.toContain('Hear it');
    // The whole screen is the replay now — a tap speaks the word again. (This word is at the
    // trace stage; .dots is present on every word stage, so it is the stable thing to tap.)
    await page.evaluate(() => { window.__spoke = 0; });
    await page.locator('.dots').click();
    await page.waitForFunction(() => window.__spoke > 0, null, {timeout: 2000});
  });
});
