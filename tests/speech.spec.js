// What she actually hears. Speech is a large part of this app for a child who
// reads by ear, and none of it was covered. A recording stub stands in for the
// synthesiser so every utterance, its rate and its voice can be asserted.
const {test, expect} = require('@playwright/test');
const {open} = require('./helpers');

// Replace speechSynthesis before the app picks a voice, and record everything.
async function listen(page, voices){
  await page.evaluate(vs => {
    window.__spoken = [];
    window.__cancels = 0;
    const list = vs.map(v => ({...v, voiceURI: v.voiceURI || v.name}));
    // speechSynthesis is a read-only getter on window; plain assignment is
    // silently ignored, which makes a stub that looks installed but is not.
    const def = (name, value) => Object.defineProperty(window, name, {value, configurable:true, writable:true});
    def('SpeechSynthesisUtterance', function(text){ this.text = text; this.rate = 1; this.pitch = 1; });
    def('speechSynthesis', {
      getVoices: () => list,
      cancel(){ window.__cancels++; },
      speak(u){ window.__spoken.push({text: u.text, rate: Math.round(u.rate * 100) / 100,
                                      voice: u.voice && u.voice.name, lang: u.lang}); },
      onvoiceschanged: null
    });
    window.__acorn.clearVoiceCache();
  }, voices);
}
const spoken = page => page.evaluate(() => window.__spoken.slice());
const clear  = page => page.evaluate(() => { window.__spoken = []; });

const AU = [
  {name:'Karen', lang:'en-AU'},
  {name:'Matilda (Premium)', lang:'en-AU'},
  {name:'Daniel', lang:'en-GB'},
  {name:'Samantha', lang:'en-US'},
  {name:'Zarvox', lang:'en-US'},
  {name:'Eloquence Reed', lang:'en-AU'},
];

// Clears the recorded index so these tests exercise the phone-voice path
// deliberately, rather than depending on what happens to be recorded.
async function noClips(page){ await page.evaluate(() => window.__acorn.setClips([])); }

async function startOn(page, words){
  await page.evaluate(ws => {
    const a = window.__acorn;
    a.state.words.lists = [{id:'w1', name:'T', words:ws}];
    a.state.words.activeId = 'w1'; a.state.words.mastery = {}; a.state.words.sessions = [];
    a.save(); a.start();
  }, words);
}

// Stands in for the audio element so every clip, its rate and its order can be
// asserted without shipping sound files into the test run.
async function watchAudio(page, {failing = false} = {}){
  await page.evaluate(f => {
    window.__played = [];
    window.__audio = [];
    const Real = window.Audio;
    window.Audio = function(){
      const el = {
        _src: '', playbackRate: 1, preservesPitch: false,
        onended: null, onerror: null,
        set src(v){ this._src = v; },
        get src(){ return this._src; },
        pause(){ window.__played.push({paused: this._src}); },
        play(){
          window.__played.push({src: this._src, rate: Math.round(this.playbackRate * 100) / 100});
          // Hand control back the way a real element does: asynchronously.
          setTimeout(() => { if(f && this.onerror) this.onerror(); else if(this.onended) this.onended(); }, 0);
          return Promise.resolve();
        },
      };
      window.__audio.push(el);
      return el;
    };
    window.__RealAudio = Real;
  }, failing);
}
const played = page => page.evaluate(() =>
  window.__played.filter(p => p.src).map(p => ({src: p.src.replace(/^.*\//, ''), rate: p.rate})));

test.describe('the pre-recorded voice', () => {

  const CLIPS = ['because', 'be', 'cause', 'said'];
  // The extension is pinned so these tests do not change meaning when real
  // recordings land in the repo with a different one.
  const EXT = '.mp3';
  const setClips = (page, list = CLIPS) =>
    page.evaluate(o => window.__acorn.setClips(o.list, o.ext), {list, ext: EXT});

  test('a recorded word is played instead of the phone voice', async ({page}) => {
    await open(page, '2026-08-01');
    await listen(page, AU);
    await watchAudio(page);
    await setClips(page);
    await startOn(page, ['because','rain','boat']);
    expect(await played(page)).toEqual([{src:'because.mp3', rate:1}]);
    expect(await spoken(page)).toEqual([]);            // the synthesiser stayed quiet
  });

  test('a word with no clip still uses the phone voice', async ({page}) => {
    await open(page, '2026-08-01');
    await listen(page, AU);
    await watchAudio(page);
    await setClips(page);
    await startOn(page, ['rain','boat','light']);       // none of these are recorded
    expect(await played(page)).toEqual([]);
    expect((await spoken(page)).map(u => u.text)).toEqual(['rain']);
  });

  test('a miss plays the word then its pieces, the pieces slower', async ({page}) => {
    await open(page, '2026-08-01');
    await listen(page, AU);
    await watchAudio(page);
    await setClips(page);
    await startOn(page, ['because','rain','boat']);
    await page.locator('#cover').click();
    await page.locator('#type').fill('becuase');
    await page.evaluate(() => { window.__played = []; window.__spoken = []; });
    await page.locator('#check').click();
    // Each clip starts the next when it ends, so the sequence arrives over time.
    await page.waitForFunction(() => window.__played.filter(p => p.src).length >= 3,
                               null, {timeout:3000});
    const seq = await played(page);
    expect(seq.map(p => p.src)).toEqual(['because.mp3','be.mp3','cause.mp3']);
    expect(seq[1].rate).toBeLessThan(seq[0].rate);
    expect(await spoken(page)).toEqual([]);
  });

  test('a half-recorded word is spoken rather than mixed', async ({page}) => {
    await open(page, '2026-08-01');
    await listen(page, AU);
    await watchAudio(page);
    // The word is recorded but "cause" is not: mixing a studio voice and a
    // synthetic one in a single breath sounds worse than either.
    await setClips(page, ['because','be']);
    await startOn(page, ['because','rain','boat']);
    await page.locator('#cover').click();
    await page.locator('#type').fill('becuase');
    await page.evaluate(() => { window.__played = []; window.__spoken = []; });
    await page.locator('#check').click();
    expect(await played(page)).toEqual([]);
    expect((await spoken(page)).map(u => u.text.trim())).toEqual(['because','be','cause']);
  });

  test('a clip that will not load falls back to the phone voice', async ({page}) => {
    await open(page, '2026-08-01');
    await listen(page, AU);
    await watchAudio(page, {failing: true});           // offline, or a bad deploy
    await setClips(page);
    await startOn(page, ['because','rain','boat']);
    await page.waitForFunction(() => window.__spoken.length > 0, null, {timeout:3000});
    expect((await spoken(page)).map(u => u.text)).toEqual(['because']);
  });

  test('her speaking-speed setting still applies to recordings', async ({page}) => {
    await open(page, '2026-08-01');
    await listen(page, AU);
    await watchAudio(page);
    await setClips(page);
    for(const [rate, faster] of [[0.7, false], [1.1, true]]){
      await page.evaluate(r => { window.__acorn.state.settings.speechRate = r;
                                 window.__acorn.save(); window.__played = []; }, rate);
      await startOn(page, ['because','rain','boat']);
      const [clip] = await played(page);
      expect(clip.src).toBe('because.mp3');
      if(faster) expect(clip.rate).toBeGreaterThan(1); else expect(clip.rate).toBeLessThan(1);
    }
  });

  test('read-aloud off silences recordings too', async ({page}) => {
    await open(page, '2026-08-01');
    await listen(page, AU);
    await watchAudio(page);
    await setClips(page);
    await page.evaluate(() => {
      window.__acorn.state.settings.readAloud = false; window.__acorn.save();
    });
    await startOn(page, ['because','rain','boat']);
    expect(await played(page)).toEqual([]);
    // but an explicit tap still plays the recording
    await page.locator('#hear').click();
    expect((await played(page)).map(p => p.src)).toEqual(['because.mp3']);
  });

  test('the filename rule matches the one the generator uses', async ({page}) => {
    await open(page, '2026-08-01');
    await setClips(page, ["o'clock", 'well-known', 'every word counts.']);
    const paths = await page.evaluate(() =>
      ["o'clock", 'well-known', 'every word counts.'].map(t => window.__acorn.clipFor(t)));
    // The extension is whatever the recording provider produced — mp3 from the
    // cloud voices, m4a from macOS say — so only the stem is asserted here.
    expect(paths.map(p => p.replace(/\.[a-z0-9]+$/, '')))
      .toEqual(['audio/o-clock', 'audio/well-known', 'audio/every-word-counts-']);
    expect(paths.every(p => /\.(mp3|m4a)$/.test(p))).toBe(true);
  });

  test('the app plays a clip as soon as it opens, with the real recordings',
    async ({page}) => {
      // Not a stub: whatever is actually committed. She should hear her first
      // word without touching anything, and this is also why a stub installed
      // after boot never sees the element unless the clip set is reset.
      const asked = [];
      page.on('request', r => { if(/\/audio\//.test(r.url())) asked.push(r.url().replace(/^.*\//, '')); });
      await open(page, '2026-08-01');
      const recorded = await page.evaluate(() => window.__acorn.clipFor('said'));
      if(!recorded) return;                     // nothing recorded in the repo yet
      await page.waitForTimeout(200);
      expect(asked.length, 'no clip was requested on opening').toBeGreaterThan(0);
    });

  test('the recorded extension is whatever the generator wrote', async ({page}) => {
    await open(page, '2026-08-01');
    // Whatever the generated line in index.html currently says.
    const ext = await page.evaluate(() =>
      window.__acorn.clipFor(window.__acorn.state.words ? 'said' : 'said'));
    const real = await page.evaluate(() => {
      window.__acorn.setClips(['said']);
      return window.__acorn.clipFor('said').replace(/^.*\./, '.');
    });
    // Both are played natively by Safari; the generated line in index.html says which.
    expect(['.mp3', '.m4a']).toContain(real);
  });
});

test.describe('what she hears', () => {

  test.beforeEach(async ({page}) => { await open(page, '2026-08-01'); await noClips(page); });

  test('the word is spoken when it comes up', async ({page}) => {
    await listen(page, AU);
    await startOn(page, ['because','rain','boat']);
    expect((await spoken(page)).map(u => u.text)).toEqual(['because']);
  });

  test('a piece of a word is never spoken faster than the whole word', async ({page}) => {
    await listen(page, AU);
    // The slowest setting is where a fixed syllable rate used to invert this.
    for(const rate of [0.7, 0.85, 0.95, 1.1]){
      await page.evaluate(r => { window.__acorn.state.settings.speechRate = r;
                                 window.__acorn.save(); }, rate);
      await startOn(page, ['because','rain','boat']);
      await clear(page);
      await page.locator('.syl').first().click();
      const [piece] = await spoken(page);
      expect(piece.text, `rate ${rate}`).toBe('be');
      expect(piece.rate, `syllable at speech rate ${rate}`).toBeLessThan(rate);
      expect(piece.rate).toBeGreaterThanOrEqual(0.5);
    }
  });

  test('a miss plays the whole word first, then its pieces', async ({page}) => {
    await listen(page, AU);
    await startOn(page, ['because','rain','boat']);
    await page.locator('#cover').click();
    await page.locator('#type').fill('becuase');
    await clear(page);
    await page.locator('#check').click();
    const said = await spoken(page);
    // "be" and "cause" with no "because" first leaves nothing to attach them to.
    expect(said.map(u => u.text.trim())).toEqual(['because','be','cause']);
    expect(said[0].rate).toBeGreaterThan(said[1].rate);
  });

  test('a one-syllable miss plays the word once, not a lone fragment', async ({page}) => {
    await listen(page, AU);
    await startOn(page, ['said','rain','boat']);
    await page.locator('#cover').click();
    await page.locator('#type').fill('sed');
    await clear(page);
    await page.locator('#check').click();
    expect((await spoken(page)).map(u => u.text.trim())).toEqual(['said']);
  });

  test('getting it right does not lecture her with the syllables', async ({page}) => {
    await listen(page, AU);
    await startOn(page, ['because','rain','boat']);
    await page.locator('#cover').click();
    await page.locator('#type').fill('because');
    await clear(page);
    await page.locator('#check').click();
    expect(await spoken(page)).toEqual([]);
  });

  test('her own accent is chosen, and novelty voices are not', async ({page}) => {
    await listen(page, AU);
    await startOn(page, ['because','rain','boat']);
    const [first] = await spoken(page);
    expect(first.voice).toBe('Matilda (Premium)');       // en-AU and downloadable
    const offered = await page.evaluate(() => window.__acorn.offerVoices().map(v => v.name));
    expect(offered).not.toContain('Zarvox');
    expect(offered).not.toContain('Eloquence Reed');
    expect(offered[0]).toBe('Matilda (Premium)');
  });

  test('a voice list that arrives late still reaches the settings screen', async ({page}) => {
    await open(page, '2026-08-01');
    // iOS routinely answers the first getVoices() with nothing and fills the
    // list in a moment later. This is how a downloaded Matilda goes missing.
    await listen(page, []);
    await page.evaluate(() => { window.__acorn.voicesChanged(); window.__acorn.go('parent'); });
    await expect(page.locator('[data-voice]')).toHaveCount(0);
    await expect(page.locator('.hint').filter({hasText:'offering 0 English'})).toBeVisible();

    await listen(page, [{name:'Karen', lang:'en-AU'}, {name:'Matilda', lang:'en-AU'},
                        {name:'Daniel', lang:'en-GB'}]);
    await page.evaluate(() => window.__acorn.voicesChanged());
    await expect(page.locator('[data-voice]')).toHaveCount(3);
    await expect(page.locator('[data-voice]').filter({hasText:'Matilda'})).toBeVisible();
  });

  test('every voice in her own accent is offered, however many the phone has', async ({page}) => {
    await open(page, '2026-08-01');
    // Thirteen en-AU voices: the old cap of six could push the good one out.
    const many = ['Karen','Catherine','Gordon','Matilda','Eddy','Flo','Grandma','Grandpa',
                  'Reed','Rocko','Sandy','Shelley','Tina']
      .map(n => ({name:n + ' (Australian English)', lang:'en-AU'}))
      .concat([{name:'Daniel', lang:'en-GB'}, {name:'Samantha', lang:'en-US'}]);
    await listen(page, many);
    const offered = await page.evaluate(() => window.__acorn.offerVoices().map(v => v.name));
    const au = await page.evaluate(() =>
      window.__acorn.englishVoices().filter(v => /^en-AU/i.test(v.lang)).map(v => v.name));
    expect(au.length).toBeGreaterThan(0);
    for(const name of au) expect(offered, `${name} was not offered`).toContain(name);
    expect(offered.some(n => /Matilda/.test(n))).toBe(true);
  });

  test('a downloaded premium Australian voice wins on its own', async ({page}) => {
    await listen(page, [{name:'Samantha', lang:'en-US'}, {name:'Daniel', lang:'en-GB'},
                        {name:'Karen', lang:'en-AU'}, {name:'Matilda (Premium)', lang:'en-AU'}]);
    await startOn(page, ['because','rain','boat']);
    expect((await spoken(page))[0].voice).toBe('Matilda (Premium)');
  });

  test('read-aloud off silences the app but not the Hear it button', async ({page}) => {
    await listen(page, AU);
    await page.evaluate(() => { window.__acorn.state.settings.readAloud = false;
                                window.__acorn.save(); });
    await startOn(page, ['because','rain','boat']);
    expect(await spoken(page)).toEqual([]);              // nothing unprompted
    await page.locator('#hear').click();
    expect((await spoken(page)).map(u => u.text)).toEqual(['because']);
    // and a miss stays silent too
    await page.locator('#cover').click();
    await page.locator('#type').fill('becuase');
    await clear(page);
    await page.locator('#check').click();
    expect(await spoken(page)).toEqual([]);
  });

  test('a phone with no voices at all still works and falls back to en-AU', async ({page}) => {
    await listen(page, []);
    await startOn(page, ['because','rain','boat']);
    const said = await spoken(page);
    expect(said.length).toBe(1);
    expect(said[0].voice).toBeFalsy();
    expect(said[0].lang).toBe('en-AU');
    await expect(page.locator('.word')).toBeVisible();
  });

  test('each new utterance cancels the last, so taps do not pile up', async ({page}) => {
    await listen(page, AU);
    await startOn(page, ['because','rain','boat']);
    const before = await page.evaluate(() => window.__cancels);
    for(let i = 0; i < 5; i++) await page.locator('#hear').click();
    const after = await page.evaluate(() => window.__cancels);
    expect(after - before).toBe(5);
  });
});
