// Mute has to mean mute.
//
// The synth is fired from six places (right, wrong, tick, jackpot, clear, and the
// sound button's own confirmation chirp) and every one of them goes through `tone()`,
// which checks the setting. That is fine today and is exactly the kind of thing that
// quietly stops being true: someone adds a sound, calls the oscillator directly, and
// nobody notices until she plays in a classroom.
//
// So this does not test `tone()`. It counts OSCILLATORS — and the audio element the
// voice clips use — across a whole level played muted. Anything that makes a noise by
// any route lands in the count.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

// Count every possible way the page can make a sound, at the browser boundary.
async function listen(page){
  await page.evaluate(() => {
    window.__heard = {osc: 0, play: 0, speak: 0};
    const C = window.AudioContext || window.webkitAudioContext;
    if(C){
      const real = C.prototype.createOscillator;
      C.prototype.createOscillator = function(){ window.__heard.osc++; return real.apply(this, arguments); };
    }
    // iOS needs one <audio> play inside her first gesture or the first spoken
    // question of the evening is dropped. That one is deliberately muted and has no
    // source, so it is silent — but "silent" is a claim the test should check rather
    // than a count it should wave through.
    window.__heard.audible = 0;
    const rp = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function(){
      window.__heard.play++;
      if(!this.muted && this.src && this.volume > 0) window.__heard.audible++;
      return rp.apply(this, arguments);
    };
    if(window.speechSynthesis){
      const rs = speechSynthesis.speak.bind(speechSynthesis);
      speechSynthesis.speak = function(u){ window.__heard.speak++; return rs(u); };
    }
  });
}
const heard = page => page.evaluate(() => window.__heard);

// A level, played the way that fires every sound the app owns: a streak long enough
// for the jackpot, a round change, one miss, and the clear.
async function noisyLevel(page){
  await page.click('#nowlevel');
  await page.waitForTimeout(240);
  let missed = false;                            // a miss keeps the question up, so once only
  for(let g = 0; g < 60; g++){
    const st = await page.evaluate(() => ({
      cleared: !!document.querySelector('#clear.on'),
      meeting: window.__144.meeting(),
      done: window.__144.sitting() ? window.__144.sitting().done : -1}));
    if(st.cleared) break;
    if(st.meeting){
      await page.evaluate(() => window.__144.skipMeet());
      await page.waitForTimeout(240);
      continue;
    }
    const right = !(st.done === 6 && !missed);   // one miss, late, after the jackpot
    if(!await page.evaluate(r => window.__144.answer(r), right)){
      await page.waitForTimeout(200); continue;
    }
    if(!right) missed = true;
    await page.waitForTimeout(right ? 320 : 840);
  }
  await page.waitForTimeout(600);
}

test.describe('mute means mute', () => {

  test('a whole level played muted makes no sound by any route', async ({page}) => {
    test.setTimeout(120000);
    await open(page);
    await listen(page);
    await page.evaluate(() => {
      const a = window.__144;
      a.state.prog.placed = true; a.state.set.sound = false; a.save(); a.render();
    });
    await noisyLevel(page);

    const silent = await heard(page);
    expect(silent.osc, 'the synth played with the sound turned off').toBe(0);
    expect(silent.audible, 'a voice clip played with the sound turned off').toBe(0);
    expect(silent.play, 'more than the one silent iOS unlock touched the audio element')
      .toBeLessThanOrEqual(1);
    expect(silent.speak, 'it spoke with the sound turned off').toBe(0);

    // ...and the control, in the same page, so this can never pass because the
    // counter was never wired up: turn it on and the same level is noisy.
    await page.click('#clearOn');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const a = window.__144;
      a.state.set.sound = true; a.save(); a.render();
    });
    await noisyLevel(page);
    const loud = await heard(page);
    expect(loud.osc, 'nothing made a sound even with the sound on — the counter is not wired')
      .toBeGreaterThan(5);
    expect(errorsOf(page)).toEqual([]);
  });

  test('the button silences a level already in full flow', async ({page}) => {
    // She does not mute at the path screen, she mutes mid-level when someone walks
    // in. Anything already scheduled must stop, and nothing new may start.
    test.setTimeout(120000);
    await open(page);
    await page.evaluate(() => {
      const a = window.__144;
      a.state.prog.placed = true; a.state.set.sound = true; a.save(); a.render();
    });
    await page.click('#nowlevel');
    await page.waitForTimeout(240);
    await page.evaluate(() => { if(window.__144.meeting()) window.__144.skipMeet(); });
    await page.waitForTimeout(260);
    await page.evaluate(r => window.__144.answer(r), true);
    await page.waitForTimeout(320);

    await listen(page);                          // start counting only from the mute
    await page.click('#soundbtn');
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.__144.state.set.sound),
      'the button did not turn the sound off').toBe(false);

    for(let i = 0; i < 5; i++){
      const st = await page.evaluate(() => ({
        cleared: !!document.querySelector('#clear.on'), meeting: window.__144.meeting()}));
      if(st.cleared) break;
      if(st.meeting){ await page.evaluate(() => window.__144.skipMeet()); await page.waitForTimeout(240); continue; }
      await page.evaluate(() => window.__144.answer(true));
      await page.waitForTimeout(320);
    }
    const after = await heard(page);
    expect(after.osc, 'it kept playing after she muted it').toBe(0);
    expect(after.speak, 'it kept talking after she muted it').toBe(0);
    expect(errorsOf(page)).toEqual([]);
  });

});
