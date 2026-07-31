const {test, expect} = require('@playwright/test');
const {open} = require('./helpers');
/* WIN-4 — the write-screen declutter. The speaker button and the "Listen, then write it."
   line are gone from every word screen; she hears the word when it appears, a tap anywhere on
   the screen replays it, and if she stalls on the writing stage a bare speaker glyph fades in
   below the box to teach that tap, then fades back the moment she acts. */

function startLook(page, word){
  return page.evaluate(w => {
    const a = window.__acorn;
    a.state.words.lists = [{id:'w', name:'T', words:[w, 'rain']}];
    a.state.words.activeId = 'w';
    a.state.words.mastery = {}; a.state.words.sessions = [];
    a.save(); a.go('day'); a.start();
  }, word);
}
function stubSpeech(page){
  return page.evaluate(() => {
    window.__spoke = 0;
    Object.defineProperty(window, 'SpeechSynthesisUtterance',
      {value: function(t){ this.text = t; this.rate = 1; this.pitch = 1; }, configurable:true});
    Object.defineProperty(window, 'speechSynthesis', {configurable:true, value:{
      getVoices: () => [{name:'Karen', lang:'en-AU', voiceURI:'Karen'}],
      cancel(){}, speak(){ window.__spoke++; }, onvoiceschanged: null
    }});
    window.__acorn.clearVoiceCache(); window.__acorn.setClips([]);
  });
}

test('no speaker button and no instruction line on any word stage', async ({page}) => {
  await open(page, '2026-08-01');
  await startLook(page, 'because');
  // look (trace)
  await expect(page.locator('#hear')).toHaveCount(0);
  await expect(page.locator('.above .note')).toHaveCount(0);
  // write
  await page.evaluate(() => window.__acorn.cover());
  await expect(page.locator('#hear')).toHaveCount(0);
  await expect(page.locator('.above .note')).toHaveCount(0);
  // check (a miss keeps its steer; a win has no caption — covered by win-cue.spec)
  await page.evaluate(() => { window.__acorn.type('becoz'); window.__acorn.check(); });
  await expect(page.locator('#hear')).toHaveCount(0);
  // "Hear it" and "Listen, then write it" appear nowhere in the app text.
  const body = await page.locator('#app').innerText();
  expect(body).not.toContain('Hear it');
  expect(body).not.toContain('Listen, then write it');
});

test('a tap anywhere on the word screen replays the word', async ({page}) => {
  await open(page, '2026-08-01');
  await stubSpeech(page);
  await startLook(page, 'because');
  await page.evaluate(() => window.__acorn.cover());     // write stage
  // A tap on the progress dots — not a control — replays the word.
  await page.evaluate(() => { window.__spoke = 0; });
  await page.locator('.dots').click();
  await page.waitForFunction(() => window.__spoke > 0, null, {timeout: 2000});
});

test('the hear cue fades in after she stalls, and hides again when she types', async ({page}) => {
  await page.clock.install();
  await open(page, '2026-08-01');
  await startLook(page, 'because');
  await page.evaluate(() => window.__acorn.cover());     // write stage — the cue lives here
  const cue = page.locator('.hearcue');
  await expect(cue).toHaveCount(1);
  // Hidden to begin with (no data-show), and it is the bare glyph, not a button.
  await expect(cue).not.toHaveAttribute('data-show', '');
  await expect(page.locator('.hearcue svg')).toHaveCount(1);
  // She stalls ~8s: it fades in.
  await page.clock.fastForward(8200);
  await expect(cue).toHaveAttribute('data-show', '');
  // She types: it hides again.
  await page.evaluate(() => { const t = document.querySelector('#type');
    t.value = 'b'; t.dispatchEvent(new Event('input', {bubbles:true})); });
  await expect(cue).not.toHaveAttribute('data-show', '');
});
