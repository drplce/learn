// Every question is said out loud.
//
// Two rules hold this together, and both are easy to break by accident:
//
//   WHOLE PHRASES. "five times seven" is one recording, never "five" + "times" +
//   "seven" stitched. A word recorded alone carries phrase-final prosody, so
//   stitching gives three separate objects — and the whole point is that she
//   stores the fact as ONE chunk.
//
//   NOTHING THE APP CAN SAY MAY BE MISSING from the recorded list. A phrase the
//   generator never records is a phrase she hears in the phone's voice instead,
//   mid-level, for the rest of the year.
const {test, expect} = require('@playwright/test');
const {open, errorsOf, answer} = require('./helpers');

// Watch what the app tries to say, whichever route it takes.
async function listen(page){
  await page.evaluate(() => {
    window.__said = [];
    const real = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = u => { window.__said.push(u.text.replace(/,$/, '')); };
    window.__realSpeak = real;
  });
}
const heard = page => page.evaluate(() => window.__said.slice());

// Put her on a level of a given kind, everything met.
async function onKind(page, kind){
  return page.evaluate(k => {
    const a = window.__144;
    const i = a.LEVELS.findIndex(l => l.kind === k);
    a.state.prog.placed = true; a.state.prog.cleared = i;
    a.LEVELS[i].facts.forEach(f => {
      a.state.facts[f] = {box:3, right:3, wrong:0, seen:3, last:a.todayISO()};
    });
    a.save();
    window.__said = [];
    a.start(a.LEVELS[i]);
    return i;
  }, kind);
}

test.describe('the words it says', () => {

  test('numbers are spelled the way a person says them, all the way to 144', async ({page}) => {
    await open(page);
    const got = await page.evaluate(() =>
      [0,1,7,11,12,13,15,20,21,25,30,35,42,50,56,60,70,72,80,81,90,99,100,108,110,120,121,132,144]
        .map(n => window.__144.numWords(n)));
    expect(got).toEqual(['zero','one','seven','eleven','twelve','thirteen','fifteen','twenty',
      'twenty-one','twenty-five','thirty','thirty-five','forty-two','fifty','fifty-six','sixty',
      'seventy','seventy-two','eighty','eighty-one','ninety','ninety-nine','one hundred',
      'one hundred and eight','one hundred and ten','one hundred and twenty',
      'one hundred and twenty-one','one hundred and thirty-two','one hundred and forty-four']);
  });

  test('a question is ONE phrase, not words stitched together', async ({page}) => {
    await open(page);
    await listen(page);
    await onKind(page, 'learn');
    await page.waitForTimeout(200);
    const said = await heard(page);
    expect(said.length, 'the question was assembled from more than one recording').toBe(1);
    expect(said[0]).toMatch(/^[a-z-]+ times [a-z-]+$/);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a fill-the-gap level asks for the missing factor, and never gives it away',
    async ({page}) => {
    await open(page);
    await listen(page);
    await onKind(page, 'recall');
    await page.waitForTimeout(200);
    const said = await heard(page);
    const cur = await page.evaluate(() => {
      const c = window.__144.sitting().cur;
      return {a:c.a, b:c.b, want:c.want, gapFirst:c.gapFirst};
    });
    expect(said.length).toBe(1);
    expect(said[0]).toContain('times what is');
    expect(said[0], 'the spoken question contains the answer')
      .not.toContain(' ' + await page.evaluate(n => window.__144.numWords(n), cur.want) + ' ');
    // the known factor is the one that is NOT the answer
    const known = cur.gapFirst ? cur.b : cur.a;
    expect(said[0].startsWith(await page.evaluate(n => window.__144.numWords(n), known))).toBe(true);
  });

});

/* What she HEARS against what she is LOOKING AT — for every question in a level,
   not just the first one.

   The tests above compare the spoken phrase to `sitting().cur`, which is the app's
   own idea of the question. That cannot catch the failure that would actually reach
   her: the SCREEN saying one thing while the VOICE says another. It also only ever
   looks at the opening question of a level, so an off-by-one that starts on the
   second — a stale utterance surviving `next()`, a prompt repainted after the speech
   was queued — would go straight past it.

   She is dyslexic and this app is deliberately spoken-first. A question she hears
   that does not match the one in front of her is not a cosmetic bug; it is the app
   telling her two different things at once. */
test.describe('the voice and the screen agree', () => {

  // Everything the screen is claiming, read off the DOM rather than the app's state.
  const onScreen = page => page.evaluate(() => {
    const t = (document.getElementById('prompt').innerText || '').replace(/\s+/g, ' ').trim();
    const nums = (t.match(/\d+/g) || []).map(Number);
    return {text: t, nums: nums, gap: t.indexOf('?') >= 0};
  });

  async function sweep(page, kind, questions){
    await listen(page);
    await onKind(page, kind);
    await page.waitForTimeout(250);
    const rows = [];
    for(let q = 0; q < questions; q++){
      if(await page.evaluate(() => window.__144.meeting())){
        await page.evaluate(() => window.__144.skipMeet());
        await page.waitForTimeout(260);
      }
      const said = await heard(page);
      const seen = await onScreen(page);
      rows.push({said: said[said.length - 1] || null, spokenCount: said.length, seen: seen});
      if(await page.evaluate(() => !!document.querySelector('#clear.on'))) break;
      if(!await answer(page, true)) break;
      await page.waitForTimeout(kind === 'recall' ? 460 : 340);
    }
    return rows;
  }
  const words = (page, n) => page.evaluate(v => window.__144.numWords(v), n);

  test('on a bubble level, every question spoken is the question shown', async ({page}) => {
    await open(page);
    const rows = await sweep(page, 'learn', 7);
    expect(rows.length, 'the level never got going').toBeGreaterThan(3);
    for(const [i, r] of rows.entries()){
      expect(r.said, `question ${i + 1} was never spoken at all`).toBeTruthy();
      expect(r.seen.nums.length, `question ${i + 1} has no numbers on screen`).toBe(2);
      const [x, y] = r.seen.nums;
      const want = (await words(page, x)) + ' times ' + (await words(page, y));
      expect(r.said, `question ${i + 1}: the screen says "${r.seen.text}" and the voice says "${r.said}"`)
        .toBe(want);
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('on a gap level, the voice reads the same gap the screen shows', async ({page}) => {
    await open(page);
    const rows = await sweep(page, 'recall', 6);
    expect(rows.length, 'the level never got going').toBeGreaterThan(3);
    for(const [i, r] of rows.entries()){
      expect(r.said, `question ${i + 1} was never spoken at all`).toBeTruthy();
      expect(r.seen.gap, `question ${i + 1} is not showing a gap`).toBe(true);
      // the screen shows the known factor and the product; the answer is the "?"
      expect(r.seen.nums.length, `question ${i + 1}: expected a factor and a product`).toBe(2);
      const [known, product] = r.seen.nums;
      const kw = await words(page, known), pw = await words(page, product);
      expect(r.said, `question ${i + 1}: screen "${r.seen.text}" vs voice "${r.said}"`)
        .toBe(kw + ' times what is ' + pw);
      // and it still never says the answer out loud
      const missing = product / known;
      if(Number.isInteger(missing) && missing !== known && missing !== product){
        expect(' ' + r.said + ' ',
          `question ${i + 1} spoke the answer she is meant to work out`)
          .not.toContain(' ' + (await words(page, missing)) + ' ');
      }
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('every question gets exactly one utterance — none silent, none doubled',
    async ({page}) => {
      // A question asked in silence is the app failing at the one thing it promises a
      // child who finds reading hard. Two utterances is the older one talking over the
      // newer, which is worse than either.
      await open(page);
      const rows = await sweep(page, 'learn', 7);
      let prev = 0;
      rows.forEach((r, i) => {
        const added = r.spokenCount - prev;
        expect(added, `question ${i + 1} was spoken ${added} times, not once`).toBe(1);
        prev = r.spokenCount;
      });
    });

});

test.describe('what it says back', () => {

  test('nothing is said back during play, on any level', async ({page}) => {
    // David, 2026-08-13, after playing it: "trying to say the full question equals
    // answer is not working — real game play doesn't allow it. So scratch that
    // step." The reply landed on top of the next question. The teaching version of
    // it moved to the slow lane, where there is room for it.
    await open(page);
    for(const kind of ['learn', 'recall', 'mix', 'boss']){
      await onKind(page, kind);
      await page.waitForTimeout(150);
      await listen(page);
      await answer(page, true);          // skips the slow lane if it is showing
      await page.waitForTimeout(300);
      const said = await heard(page);
      // the only thing allowed is the NEXT question, never a reply to this answer
      expect(said.filter(t => /equals/.test(t)), `${kind} said the answer back`).toEqual([]);
      expect(said.length, `${kind} said too much after she answered`).toBeLessThan(2);
    }
  });

  test('the slow lane says the whole fact, the way a person says it', async ({page}) => {
    // The one place a restatement fits: nothing else is happening.
    await open(page);
    await listen(page);
    await page.evaluate(() => {
      const a = window.__144;
      const i = a.LEVELS.findIndex(l => l.kind === 'learn');
      a.state.prog.placed = true; a.state.prog.cleared = i;
      a.state.facts = {};                             // nothing met: it has to teach
      a.save();
      window.__said = [];
      a.start(a.LEVELS[i]);
    });
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.__144.meeting()),
      'a brand-new fact was asked before it was ever shown').toBe(true);
    const said = await heard(page);
    // three phrases with beats between them — phrase-level assembly, which is how a
    // teacher says it, not words stitched inside a phrase
    expect(said.length).toBe(3);
    expect(said[0]).toMatch(/ times /);
    expect(said[1]).toBe('equals');
    expect(said[2]).toMatch(/^[a-z- ]+$/);
  });

  test('answering stops it talking over her', async ({page}) => {
    // On a boss it says nothing back, so the ONLY thing that can stop the question
    // mid-word is the interrupt itself — on any other level the reply's own cancel
    // would mask a missing one, and this test would pass for the wrong reason.
    await open(page);
    await onKind(page, 'boss');
    await page.waitForTimeout(200);
    const cancels = await page.evaluate(() => {
      window.__cancels = 0;
      const real = window.speechSynthesis.cancel.bind(window.speechSynthesis);
      window.speechSynthesis.cancel = () => { window.__cancels++; real(); };
      return true;
    });
    await answer(page, true);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__cancels),
      'the question kept playing after she answered').toBeGreaterThan(0);
  });

  test('muted means silent', async ({page}) => {
    await open(page);
    await page.evaluate(() => { window.__144.state.set.sound = false; window.__144.save(); });
    await listen(page);
    await onKind(page, 'learn');
    await page.waitForTimeout(200);
    expect(await heard(page), 'it spoke with the sound off').toEqual([]);
    await answer(page, true);
    await page.waitForTimeout(250);
    expect(await heard(page), 'it spoke the answer with the sound off').toEqual([]);
  });

  test('it works with no recordings at all', async ({page}) => {
    // Which is where it starts: the files are recorded on David's machine, so the
    // app has to be complete without them and simply get better when they land.
    await open(page);
    expect(await page.evaluate(() => window.__144.CLIPS().length)).toBe(0);
    await onKind(page, 'learn');
    await page.waitForTimeout(200);
    await answer(page, true);
    await page.waitForTimeout(300);
    expect(errorsOf(page)).toEqual([]);
  });

});

test.describe('which voice it borrows', () => {

  // The phone's own voice is the fallback until the recordings land, and iOS ships a
  // shelf of joke voices — Bells, Bubbles, Trinoids, Zarvox — all tagged `en`.
  // David, 2026-08-13: "back the fall back it on the weird sounding voice - we
  // actually had the same problem on Acorn with the first voice defaulting back to
  // the iOS special voices."
  const IOS_VOICES = [
    {name:'Bells',    lang:'en-US', voiceURI:'bells'},
    {name:'Bubbles',  lang:'en-US', voiceURI:'bubbles'},
    {name:'Trinoids', lang:'en-US', voiceURI:'trinoids'},
    {name:'Zarvox',   lang:'en-US', voiceURI:'zarvox'},
    {name:'Albert',   lang:'en-US', voiceURI:'albert'},
    {name:'Samantha', lang:'en-US', voiceURI:'samantha'},
    {name:'Karen',    lang:'en-AU', voiceURI:'karen'},
    {name:'Karen (Premium)', lang:'en-AU', voiceURI:'karen-premium'}
  ];

  test('when a joke voice is all there is, it uses none at all', async ({page}) => {
    // The scoring already ranks Karen above Bells when both exist. The filter is for
    // the phone where the joke voices are the ONLY thing on offer: better to hand the
    // browser its own default than to explicitly ask for Zarvox.
    await open(page);
    const picked = await page.evaluate(() => {
      window.speechSynthesis.getVoices = () => [
        {name:'Bells',    lang:'en-US', voiceURI:'bells'},
        {name:'Bubbles',  lang:'en-US', voiceURI:'bubbles'},
        {name:'Zarvox',   lang:'en-AU', voiceURI:'zarvox'}   // even in her own accent
      ];
      const v = window.__144.bestVoice();
      return v && v.name;
    });
    expect(picked, 'it chose a novelty voice').toBe(null);
  });

  test('a voice chosen before the good ones loaded is upgraded, not kept', async ({page}) => {
    // getVoices() is async. The first call returns a partial list — often just the
    // US default — and if that choice is cached, the en-AU premium voice that arrives
    // a moment later never gets used. This is the Acorn bug.
    await open(page);
    const out = await page.evaluate(() => {
      const sy = window.speechSynthesis;
      const early = [{name:'Samantha', lang:'en-US', voiceURI:'samantha'}];
      const full  = early.concat([
        {name:'Karen (Premium)', lang:'en-AU', voiceURI:'karen-premium'},
        {name:'Bells', lang:'en-US', voiceURI:'bells'}
      ]);
      sy.getVoices = () => early;
      const first = window.__144.bestVoice();
      sy.getVoices = () => full;
      const second = window.__144.bestVoice();
      return {first: first && first.name, second: second && second.name};
    });
    expect(out.first).toBe('Samantha');               // all there was at the time
    expect(out.second, 'it kept the voice it picked while the list was still loading')
      .toBe('Karen (Premium)');
  });

  test('her own accent wins over a better-sounding foreign one', async ({page}) => {
    await open(page);
    const picked = await page.evaluate(() => {
      window.speechSynthesis.getVoices = () => [
        {name:'Siri Voice 1 (Enhanced)', lang:'en-US', voiceURI:'siri-us'},
        {name:'Karen (Enhanced)',        lang:'en-AU', voiceURI:'karen-au'}
      ];
      return window.__144.bestVoice().name;
    });
    expect(picked).toBe('Karen (Enhanced)');
  });

});

test.describe('the recording list', () => {

  test('covers every phrase the app can possibly say', async ({page}) => {
    const {phrases} = await import('../tools/voice.mjs');
    const recorded = new Set(phrases().keys());
    await open(page);
    // everything the app could ask for, over the whole table, both ways round,
    // both sides of the gap, plus every answer
    const wanted = await page.evaluate(() => {
      const a = window.__144, out = new Set();
      for(let x = 1; x <= 12; x++) for(let y = 1; y <= 12; y++){
        out.add(a.qPhrase(x, y));
        out.add(a.gapPhrase(x, x * y));
        out.add(a.gapPhrase(y, x * y));
        out.add(a.numWords(x * y));
      }
      out.add('equals');
      return [...out];
    });
    const missing = wanted.filter(p => !recorded.has(p));
    expect(missing, 'the app can say phrases the generator never records').toEqual([]);
    expect(wanted.length).toBeGreaterThan(340);
  });

  test('the app and the generator spell numbers identically', async ({page}) => {
    const {numWords} = await import('../tools/voice.mjs');
    await open(page);
    const mine = await page.evaluate(() => {
      const out = [];
      for(let n = 0; n <= 144; n++) out.push(window.__144.numWords(n));
      return out;
    });
    const theirs = [];
    for(let n = 0; n <= 144; n++) theirs.push(numWords(n));
    expect(mine).toEqual(theirs);
  });

});
