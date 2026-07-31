// A word she cannot get right by listening.
//
// The app says the word and shows nothing else. For "week" that is an unanswerable
// question: "weak" is a correctly spelled English word that sounds identical, and
// she is marked wrong for spelling it. 14 of the 100 built-in words are like this,
// and three of them — metre, licence, practise — are the noun/verb pairs adults get
// wrong. So the ones she could plausibly reach the wrong way get a short meaning cue
// on screen. These tests hold the cue to its rules: it appears when it is needed, it
// never leaks the spelling, it reaches a screen reader, and it survives a small
// screen even when the instruction above it does not.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

// Puts her in front of one named word, from memory — the case where she has no
// context at all, because a review word skips the look stage.
async function askedFor(page, word){
  return page.evaluate(w => {
    const a = window.__acorn;
    a.state.words.lists = [{id:'h1', name:'T', words:{[w]: w}}];
    a.state.words.activeId = 'h1';
    a.save(); a.go('parent'); a.go('day');
    if(!a.session()) a.start();
    const W = a.session();
    if(W.stage === 'look') a.cover();
    const cue = document.querySelector('#screen .cue');
    return {
      stage: a.session().stage,
      cue: cue ? cue.textContent : null,
      note: (document.querySelector('#screen .note') || {}).textContent || null,
      live: (document.querySelector('[aria-live]') || {}).textContent || ''
    };
  }, word);
}

test.describe('words that sound like other words', () => {

  test('the ones she could get wrong by listening are cued', async ({page}) => {
    await open(page, '2026-08-01');
    // Each of these has a homophone she plausibly knows: sum, maid, weak, threw,
    // mite, no, right, mourning, meter, license, practice.
    for(const w of ['some', 'made', 'week', 'through', 'might',
                    'know', 'write', 'morning', 'metre', 'licence', 'practise']){
      const r = await askedFor(page, w);
      expect(r.cue, `"${w}" is unanswerable from sound alone and got no cue`).toBeTruthy();
      // Brevity is measured on the meaning itself further down; here it is only
      // that the rendered line is a cue and not a sentence about spelling.
      expect(r.cue, `the cue for "${w}" reads like prose: ${r.cue}`).toMatch(/^means: /);
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('a word with no twin is left alone', async ({page}) => {
    await open(page, '2026-08-01');
    // Nothing sounds like these, so a cue would be one more line to read for
    // nothing. "rain" is deliberately in here: rein and reign exist, but no
    // nine-year-old reaches for them, and the cue would be noise.
    for(const w of ['friend', 'because', 'boat', 'thumb', 'colour', 'rain', 'time', 'knee']){
      const r = await askedFor(page, w);
      expect(r.cue, `"${w}" needs no cue but got one: ${r.cue}`).toBeNull();
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('the cue never gives the spelling away', async ({page}) => {
    await open(page, '2026-08-01');
    const {cues, twins} = await page.evaluate(() => ({
      cues: window.__acorn.meanings(), twins: window.__acorn.twins()
    }));
    /* Sets, not pairs. "their" is one of three, and while this held a single twin per word
       a third member could only be recorded as somebody's twin — so the check tested one of
       the two words the cue must not name and skipped the other without saying so.
       Apostrophes stripped on both sides for the same reason: splitting a cue on
       non-letters can never produce the string "it's", so a cue that named it would have
       passed silently. */
    const flat = w => w.toLowerCase().replace(/[^a-z]/g, '');
    const others = {};
    for(const set of twins)
      for(const w of set) others[w] = set.filter(x => x !== w);
    for(const [word, cue] of Object.entries(cues)){
      const c = cue.toLowerCase();
      // Not the word, and not a longer word containing it — "metre" was being
      // handed over inside "a hundred centimetres" the first time round.
      expect(c, `the cue for "${word}" contains the word`).not.toContain(word.toLowerCase());
      expect(c.split(/[^a-z]+/).map(flat),
        `the cue for "${word}" spells it out`).not.toContain(flat(word));
      // And not any other spelling in its set either. A wrong spelling on screen is the
      // one thing this app never shows her, in her own writing or anyone else's.
      const set = others[word];
      expect(set, `"${word}" has a cue but is in no recorded set`).toBeTruthy();
      expect(set.length, `"${word}" is in a set on its own`).toBeGreaterThan(0);
      for(const twin of set)
        expect(c.split(/[^a-z]+/).map(flat), `the cue for "${word}" names "${twin}"`)
          .not.toContain(flat(twin));
    }
  });

  test('a list with both halves of a pair on it cues both', async ({page}) => {
    // Homophones are a spelling topic in their own right, so this week's list
    // could hold both. Cue one and the other becomes the unanswerable question.
    await open(page, '2026-08-01');
    const {cues, twins} = await page.evaluate(() => ({
      cues: window.__acorn.meanings(), twins: window.__acorn.twins()
    }));
    for(const [a, b] of twins){
      if(!cues[a] || !cues[b]) continue;                 // deliberately unpaired
      expect(cues[a], `"${a}" and "${b}" share a cue, which tells her nothing`)
        .not.toBe(cues[b]);
    }
    // End to end: the pair pasted into a list, each word cued differently.
    const seen = await page.evaluate(() => {
      const a = window.__acorn, out = {};
      a.state.words.lists = [{id:'p1', name:'T', words:{week:'week', weak:'weak'}}];
      a.state.words.activeId = 'p1';
      a.save(); a.go('parent'); a.go('day');
      if(!a.session()) a.start();
      for(let g = 0; g < 12 && a.session(); g++){
        const W = a.session();
        if(W.stage === 'look'){ a.cover(); continue; }
        if(W.stage === 'write'){
          const c = document.querySelector('#screen .cue');
          out[W.words[W.i]] = c ? c.textContent : null;
          a.type(W.words[W.i]); a.check(); a.next(); continue;
        }
        a.next();
      }
      return out;
    });
    expect(seen.week, 'week went uncued').toBeTruthy();
    expect(seen.weak, 'weak went uncued').toBeTruthy();
    expect(seen.week).not.toBe(seen.weak);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a screen reader hears the cue, not just the sighted child', async ({page}) => {
    await open(page, '2026-08-01');
    const r = await askedFor(page, 'week');
    expect(r.live).toMatch(/seven days/);
    // The instruction is still there — the cue is added to it, not swapped in.
    expect(r.live).toMatch(/write it/i);
  });

  test('the cue outlives the instruction when the screen runs out of room', async ({page}) => {
    // 320px at the largest text is the worst case she has. The instruction is
    // something she knows by the third evening; which of two words is wanted is
    // not, so shedding must take the note and leave the cue.
    await page.setViewportSize({width: 320, height: 400});
    await open(page, '2026-08-01');
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.settings.textScale = 1.6;
      a.state.words.lists = [{id:'h1', name:'T', words:{practise:'prac·tise'}}];
      a.state.words.activeId = 'h1';
      a.save(); a.go('parent'); a.go('day');
      if(!a.session()) a.start();
      if(a.session().stage === 'look') a.cover();
    });
    const shown = n => page.evaluate(s => {
      const e = document.querySelector('#screen ' + s);
      return !!e && getComputedStyle(e).display !== 'none';
    }, n);
    // Whatever had to go, the cue is not it.
    expect(await shown('.cue'), 'the cue was shed on a small screen').toBe(true);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a word she has just been shown is cued too', async ({page}) => {
    // The look stage shows her the word, so a fresh word is not ambiguous in the
    // moment — but she is typing from a covered word seconds later, and the cue
    // costs nothing. Consistency matters more here than saving a line: a cue that
    // comes and goes between the first and second time she meets a word reads as
    // a glitch.
    await open(page, '2026-08-01');
    const r = await askedFor(page, 'know');
    expect(r.stage).toBe('write');
    expect(r.cue).toBeTruthy();
  });

  test('a list a grown-up typed in still works with no cues at all', async ({page}) => {
    await open(page, '2026-08-01');
    const r = await askedFor(page, 'zqxj');
    expect(r.cue).toBeNull();
    // A just-traced word shows no on-screen instruction line now (13.4); the
    // instruction is spoken instead, so a screen reader still gets it.
    expect(r.note).toBeNull();
    expect(r.live).toMatch(/write it/i);
    expect(errorsOf(page)).toEqual([]);
  });

  test('every cue is short enough to read at a glance', async ({page}) => {
    await open(page, '2026-08-01');
    const cues = await page.evaluate(() => window.__acorn.meanings());
    for(const [word, cue] of Object.entries(cues)){
      const words = cue.split(/\s+/).length;
      expect(words, `the cue for "${word}" is ${words} words: ${cue}`).toBeLessThanOrEqual(6);
      expect(cue, `the cue for "${word}" is capitalised or punctuated like a sentence`)
        .toMatch(/^[a-z][a-z ,]*$/);
    }
  });

  test('the cue is one line on her phone at every text size', async ({page}) => {
    for(const vp of [{width: 320, height: 568}, {width: 375, height: 667}]){
      await page.setViewportSize(vp);
      await open(page, '2026-08-01');
      for(const scale of [1, 1.3, 1.6]){
        const r = await page.evaluate(s => {
          const a = window.__acorn;
          a.state.settings.textScale = s;
          a.state.words.lists = [{id:'h1', name:'T', words:{licence:'li·cence'}}];
          a.state.words.activeId = 'h1';
          a.save(); a.go('parent'); a.go('day');
          if(!a.session()) a.start();
          if(a.session().stage === 'look') a.cover();
          const c = document.querySelector('#screen .cue');
          if(!c || getComputedStyle(c).display === 'none') return {lines: 0, text: ''};
          const range = document.createRange();
          range.selectNodeContents(c);
          const tops = new Set([...range.getClientRects()].map(x => Math.round(x.top)));
          return {lines: tops.size, text: c.textContent};
        }, scale);
        // The longest cue in the set. Two lines is acceptable at the largest
        // text; three would be a paragraph over her spelling box.
        expect(r.lines, `${vp.width}px at ${scale}x: "${r.text}"`).toBeLessThanOrEqual(2);
      }
    }
  });

});
