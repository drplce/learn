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

async function startOn(page, words){
  await page.evaluate(ws => {
    const a = window.__acorn;
    a.state.words.lists = [{id:'w1', name:'T', words:ws}];
    a.state.words.activeId = 'w1'; a.state.words.mastery = {}; a.state.words.sessions = [];
    a.save(); a.start();
  }, words);
}

test.describe('what she hears', () => {

  test('the word is spoken when it comes up', async ({page}) => {
    await open(page, '2026-08-01');
    await listen(page, AU);
    await startOn(page, ['because','rain','boat']);
    expect((await spoken(page)).map(u => u.text)).toEqual(['because']);
  });

  test('a piece of a word is never spoken faster than the whole word', async ({page}) => {
    await open(page, '2026-08-01');
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
    await open(page, '2026-08-01');
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
    await open(page, '2026-08-01');
    await listen(page, AU);
    await startOn(page, ['said','rain','boat']);
    await page.locator('#cover').click();
    await page.locator('#type').fill('sed');
    await clear(page);
    await page.locator('#check').click();
    expect((await spoken(page)).map(u => u.text.trim())).toEqual(['said']);
  });

  test('getting it right does not lecture her with the syllables', async ({page}) => {
    await open(page, '2026-08-01');
    await listen(page, AU);
    await startOn(page, ['because','rain','boat']);
    await page.locator('#cover').click();
    await page.locator('#type').fill('because');
    await clear(page);
    await page.locator('#check').click();
    expect(await spoken(page)).toEqual([]);
  });

  test('her own accent is chosen, and novelty voices are not', async ({page}) => {
    await open(page, '2026-08-01');
    await listen(page, AU);
    await startOn(page, ['because','rain','boat']);
    const [first] = await spoken(page);
    expect(first.voice).toBe('Matilda (Premium)');       // en-AU and downloadable
    const offered = await page.evaluate(() => window.__acorn.offerVoices().map(v => v.name));
    expect(offered).not.toContain('Zarvox');
    expect(offered).not.toContain('Eloquence Reed');
    expect(offered[0]).toBe('Matilda (Premium)');
  });

  test('read-aloud off silences the app but not the Hear it button', async ({page}) => {
    await open(page, '2026-08-01');
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
    await open(page, '2026-08-01');
    await listen(page, []);
    await startOn(page, ['because','rain','boat']);
    const said = await spoken(page);
    expect(said.length).toBe(1);
    expect(said[0].voice).toBeFalsy();
    expect(said[0].lang).toBe('en-AU');
    await expect(page.locator('.word')).toBeVisible();
  });

  test('each new utterance cancels the last, so taps do not pile up', async ({page}) => {
    await open(page, '2026-08-01');
    await listen(page, AU);
    await startOn(page, ['because','rain','boat']);
    const before = await page.evaluate(() => window.__cancels);
    for(let i = 0; i < 5; i++) await page.locator('#hear').click();
    const after = await page.evaluate(() => window.__cancels);
    expect(after - before).toBe(5);
  });
});
