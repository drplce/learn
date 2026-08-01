// Aspect 2, done by collecting every string she can be shown rather than by spot check.
//
// Driving all thirteen states a child-facing screen can be in, across three shapes of list,
// turns up 56 distinct strings. No blame in any of them, every number agrees with its noun,
// and the reading level is fine. Two things were not.
//
// The finished screen announced a running total that was deliberately taken off the screen
// in 9.7 — so the child who listens heard "Three took root tonight. Every one, first go,
// Ivy. 0 of 100 words known well." on a perfect evening, and the child who looks did not.
// And the cues that stop a word being unanswerable from sound alone covered the built-in
// corpus but not "their", which is the one every Year 4 list has.
const {test, expect} = require('@playwright/test');
const {open, errorsOf, write} = require('./helpers');

async function finish(page, words, how){
  await page.evaluate(({ws, h}) => {
    const a = window.__acorn;
    const id = 'wh' + (++window.__nth || (window.__nth = 1));
    a.state.profile.name = 'Ivy';
    a.state.words.lists = [{id: id, name: 'W', words: ws}];
    a.state.words.activeId = id;
    a.state.words.mastery = {}; a.state.words.sessions = [];
    a.save(); a.go('day'); if(!a.session()) a.start();
    let i = 0;
    for(let g = 0; g < 80 && a.session(); g++){
      const W = a.session();
      if(W.stage === 'look'){ a.cover(); continue; }
      if(W.stage === 'write'){
        const w = W.words[W.i];
        const right = h === 'all' || (h === 'some' && (i++ % 2 === 0));
        a.type(right ? w : 'zqx'); a.check(); a.next(); continue;
      }
      a.next();
    }
  }, {ws: words, h: how});
  return page.evaluate(() => ({
    said: (document.querySelector('#say') || {}).textContent.trim(),
    seen: (document.querySelector('#screen').innerText || '').replace(/\s+/g, ' ').trim(),
  }));
}

test.describe('what she hears matches what is there', () => {

  test('a perfect evening is not followed by a nought', async ({page}) => {
    /* "0 of 100 words known well" is true and it is the reason the progress bar came off
       this screen: it reads as a target she has not reached rather than as work she has
       done. Appending it to the announcement handed it to the one child who cannot see
       that it was removed. */
    await open(page, '2026-08-01');
    const r = await finish(page, ['said', 'they', 'rain'], 'all');
    expect(r.said).toContain('took root tonight');
    expect(r.said).toContain('first go');
    expect(r.said, `she was told "${r.said}"`).not.toMatch(/\bwords known well\b/);
    expect(r.said, 'a bare count came through anyway').not.toMatch(/\b0 of \d+/);
  });

  test('and no evening is, whatever happened in it', async ({page}) => {
    await open(page, '2026-08-01');
    for(const how of ['all', 'some', 'none']){
      const r = await finish(page, ['said', 'they', 'rain'], how);
      expect(r.said, `on a "${how}" evening she heard "${r.said}"`)
        .not.toMatch(/\bwords known well\b/);
      expect(r.said.length, 'nothing was announced at all').toBeGreaterThan(4);
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('what is announced has a counterpart on the screen — the picture, now it is wordless',
    async ({page}) => {
    /* The rule this comes down to: nothing announced should be a second, invisible version of the
       screen that nobody is reviewing. The finished screen went wordless (David) — the reward line
       is spoken but no longer written — so its visible counterpart is the PICTURE, not text: the
       same words swelling in, and the numbers on the picture's own label. The rule still holds; the
       counterpart is a drawing rather than a sentence. (The dead end, which is words not a picture,
       still shows its one line — checked below.) */
    await open(page, '2026-08-01');
    for(const how of ['all', 'some']){
      const r = await finish(page, ['said', 'they', 'rain'], how);
      expect(r.said.length, 'the finished screen announced nothing').toBeGreaterThan(4);
      // The visible counterpart of the spoken reward is the map, present and labelled.
      const pic = await page.evaluate(() => {
        const n = document.querySelector('#screen .net');
        return {there: !!n, label: n ? (n.getAttribute('aria-label') || '') : ''};
      });
      expect(pic.there, 'the reward was spoken with no picture to carry it').toBe(true);
      expect(pic.label.trim().length, 'the picture has no accessible name').toBeGreaterThan(0);
      // And nothing false is written: the wordless screen carries no text at all.
      expect(r.seen, 'the finished screen is meant to be wordless').toBe('');
    }
  });

  test('the dead end still says its one thing', async ({page}) => {
    // There the count is the message, so it must survive.
    await open(page, '2026-08-01');
    const r = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id: 'de', name: 'E', words: []}];
      a.state.words.activeId = 'de';
      a.state.words.mastery = {}; a.state.words.sessions = [];
      a.save(); a.go('day');
      return {said: (document.querySelector('#say') || {}).textContent.trim(),
              seen: (document.querySelector('#screen').innerText || '').trim()};
    });
    expect(r.said).toMatch(/Ask a grown-up/);
    expect(r.seen).toMatch(/Ask a grown-up/);
  });

});

test.describe('the words a school list really holds', () => {

  const SETS = [['their', 'there', "they're"], ['your', "you're"], ['its', "it's"],
                ['hear', 'here'], ['one', 'won'], ['new', 'knew'], ['see', 'sea'],
                ['where', 'wear'], ['blue', 'blew']];

  async function askedFor(page, word){
    return page.evaluate(w => {
      const a = window.__acorn;
      const id = 'q' + (++window.__nth || (window.__nth = 1));
      a.state.words.lists = [{id: id, name: 'T', words: [w, 'said']}];
      a.state.words.activeId = id;
      a.state.words.mastery = {}; a.state.words.sessions = [];
      a.save(); a.go('day'); if(!a.session()) a.start();
      if(a.session().stage === 'look') a.cover();
      const c = document.querySelector('#screen .cue');
      return {cue: c ? c.textContent.trim() : null,
              said: (document.querySelector('#say') || {}).textContent || ''};
    }, word);
  }

  test('every one of them is cued, because heard aloud they are the same word',
    async ({page}) => {
    await open(page, '2026-08-01');
    for(const set of SETS)
      for(const w of set){
        const r = await askedFor(page, w);
        expect(r.cue, `"${w}" is unanswerable from sound alone and got no cue`).toBeTruthy();
        expect(r.cue).toMatch(/^means: /);
      }
    expect(errorsOf(page)).toEqual([]);
  });

  test('a whole set is cued or none of it is', async ({page}) => {
    /* The trap the existing table already names: cue one of a pair and the uncued one
       becomes the unanswerable question instead. "to", "too" and "two" are left out
       entirely for this reason — two can be cued honestly and to cannot. */
    await open(page, '2026-08-01');
    const cues = await page.evaluate(() => window.__acorn.meanings());
    for(const set of SETS){
      const has = set.filter(w => cues[w]);
      expect(has.length, `only ${has.join(', ')} of ${set.join('/')} is cued`).toBe(set.length);
    }
    for(const w of ['to', 'too', 'two', 'for', 'four'])
      expect(cues[w], `"${w}" is cued, which leaves the rest of its set unanswerable`)
        .toBeFalsy();
  });

  test('she can be asked one and be marked right for it', async ({page}) => {
    // Including the ones with an apostrophe, which nothing had asked her to spell before.
    await open(page, '2026-08-01');
    for(const set of SETS)
      for(const w of set){
        await page.evaluate(word => {
          const a = window.__acorn;
          const id = 'm' + (++window.__nth || (window.__nth = 1));
          a.state.words.lists = [{id: id, name: 'T', words: [word, 'said']}];
          a.state.words.activeId = id;
          a.state.words.mastery = {}; a.state.words.sessions = [];
          a.save(); a.go('day'); if(!a.session()) a.start();
          if(a.session().stage === 'look') a.cover();
        }, w);
        await write(page, w);
        await page.keyboard.press('Enter');            // return submits — no Check button
        const r = await page.evaluate(() => ({
          right: window.__acorn.session().right,
          stage: window.__acorn.session().stage,
        }));
        expect(r.stage, `"${w}" did not reach a verdict`).toBe('check');
        expect(r.right, `"${w}" spelled correctly and not counted`).toBe(1);
      }
  });

  test('and the apostrophe is part of the spelling', async ({page}) => {
    // "its" and "it's" are the whole point of cueing them; if one matched the other the
    // cue would be pointing at a distinction the app does not make.
    await open(page, '2026-08-01');
    const r = await page.evaluate(() => {
      const a = window.__acorn;
      return {
        same: a.sameWord("it's", 'its'),
        curly: a.sameWord('it’s', "it's"),
        exact: a.sameWord("it's", "it's"),
        theyre: a.sameWord('theyre', "they're"),
        youre: a.sameWord('you’re', "you're"),
      };
    });
    expect(r.same, '"its" was accepted for "it\'s"').toBe(false);
    expect(r.theyre, '"theyre" was accepted for "they\'re"').toBe(false);
    expect(r.exact).toBe(true);
    expect(r.curly, 'the apostrophe her keyboard types was not accepted').toBe(true);
    expect(r.youre).toBe(true);
  });

  test('no chunk of a word ends on an apostrophe', async ({page}) => {
    /* The vowel rule knows nothing about an apostrophe, so it put a boundary straight
       after one and left "they're" as they' + re — two chips, both tappable, both of which
       speak aloud, and neither of which is a piece of the word. Contractions have been
       paste-able since the beginning; what changed is that the cues now cover they're and
       you're, so it is no longer a word she has to be unlucky to meet. */
    await open(page, '2026-08-01');
    const r = await page.evaluate(() => ["they're", "you're", "we're", "it's", "don't",
      "isn't", "can't", "shouldn't", "didn't", "haven't", "we've", "i'm", "o'clock",
      "everybody's", "children's", "let's", "that's", "who's", "she'll", "they'll"]
      .map(w => ({w, pieces: window.__acorn.syllables(w)})));
    for(const x of r){
      expect(x.pieces.join(''), `the pieces of "${x.w}" do not spell it`).toBe(x.w.toLowerCase());
      for(const p of x.pieces){
        expect(p.slice(-1), `"${x.w}" was split as ${JSON.stringify(x.pieces)}`).not.toBe("'");
        expect(p.replace(/'/g, '').length, `"${x.w}" has a chunk that is only punctuation`)
          .toBeGreaterThan(0);
      }
    }
    // And the ones that were already right are untouched.
    const by = {};
    r.forEach(x => { by[x.w] = x.pieces; });
    expect(by["haven't"]).toEqual(['ha', "ven't"]);
    expect(by["children's"]).toEqual(['chil', "dren's"]);
    expect(by["everybody's"]).toEqual(['e', 've', 'ry', 'bo', "dy's"]);
  });

  test('the spoken pieces of a contraction are all real, none an orphaned apostrophe', async ({page}) => {
    // The split keeps the apostrophe with its letters ("they" + "'re", not "they" + "re" + "'"),
    // which is what made the orphaned "re" worth fixing. The pieces are spoken only now (the
    // visual seams under the word are gone, 13.31) but the same thing has to hold for the voice:
    // the split tiles the word and every piece carries a letter.
    await open(page, '2026-08-01');
    for(const w of ["they're", "haven't", "everybody's"]){
      const r = await page.evaluate(word => {
        const a = window.__acorn;
        const id = 'sy' + (++window.__nth || (window.__nth = 1));
        a.state.words.lists = [{id: id, name: 'T', words: [word, 'said']}];
        a.state.words.activeId = id;
        a.state.words.mastery = {}; a.state.words.sessions = [];
        a.save(); a.go('day'); if(!a.session()) a.start();
        const wordEl = document.querySelector('.tracew');
        // The word is shown whole, with no visual split drawn under it.
        return {chunks: wordEl.querySelectorAll('.sylseg').length,
                seams: wordEl.querySelectorAll('.seams').length,
                whole: wordEl.textContent,
                says: a.splitOf(wordEl.textContent)};
      }, w);
      // The split is the source of truth for the spoken pieces: it tiles the word and no piece
      // is a lone apostrophe — the orphaned "re" this guards.
      expect(r.says.join(''), `the split of "${w}" does not spell it`).toBe(w);
      for(const p of r.says)
        expect(p, `a piece of "${w}" is just an apostrophe`).toMatch(/[a-z]/);
      // Nothing is drawn under the word any more — it is shown whole.
      expect(r.chunks, `"${w}" still draws syllable chunks under the word`).toBe(0);
      expect(r.seams, `"${w}" still draws a seam under the word`).toBe(0);
    }
    expect(errorsOf(page)).toEqual([]);
  });

});
