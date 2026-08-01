// What the app drops when the screen runs out of room, and how things move.
//
// fitScreen() sheds elements least-useful-first when content will not fit. Its list
// named ".pbar" and ".tally" at the head for four versions after the progress bar and
// the running total came off the finished screen in 9.7 — two selectors that could no
// longer match anything, in a list whose entire purpose is to say what goes first.
// Nothing misbehaved. It just described a screen that no longer existed, and it read as
// though a bar were still there every time anyone looked at that function.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

// Everything the app can put on her screen, so a selector can be checked against it.
const STATES = {
  look:  'if(!a.session()) a.start();',
  write: 'if(!a.session()) a.start(); if(a.session().stage==="look") a.cover();',
  check: 'if(!a.session()) a.start(); if(a.session().stage==="look") a.cover();' +
         ' a.type("zzz"); a.check();',
  near:  'if(!a.session()) a.start(); if(a.session().stage==="look") a.cover();' +
         ' const w=a.session().words[a.session().i];' +
         ' a.type(w.slice(0,-1)+"z"); a.check();',
  done:  'if(!a.session()) a.start();' +
         ' for(let g=0;g<90&&a.session();g++){const W=a.session();' +
         ' if(W.stage==="look"){a.cover();continue;}' +
         ' if(W.stage==="write"){a.type(W.words[W.i]);a.check();a.next();continue;} a.next();}',
  dead:  'a.state.words.lists=[{id:"e",name:"E",words:[]}]; a.state.words.activeId="e";' +
         ' a.state.words.mastery={}; a.save(); a.go("day");',
};

async function classesEverRendered(page){
  const seen = new Set();
  /* Every word here has more than one syllable, and every state gets its own list id.
     Both matter. The list used to lead with "said", and since 10.6 keeps a sitting alive
     across a look at the grown-ups screen, every state re-rendered that same one-syllable
     word — so the chip row was never on any of these screens and ".syls" read as a
     selector that could not match anything. A fixture that cannot render the thing it is
     checking for reports a ghost, and would have reported one for any new name on the
     list that only appears on a word of more than one piece. */
  let nth = 0;
  for(const src of Object.values(STATES)){
    const got = await page.evaluate(({s, id}) => {
      const a = window.__acorn;
      a.state.words.lists = [{id: id, name: 'T', words: ['beautiful', 'remember', 'rain']}];
      a.state.words.activeId = id;
      a.state.words.mastery = {}; a.state.words.sessions = [];
      a.save(); a.go('parent'); a.go('day');
      new Function('a', s)(a);
      const out = [];
      document.querySelectorAll('#screen *, #act *').forEach(e =>
        (e.classList || []).forEach(c => out.push(c)));
      return out;
    }, {s: src, id: 'sh' + (++nth)});
    got.forEach(c => seen.add(c));
  }
  return seen;
}

test.describe('what gets dropped when it will not fit', () => {

  test('every selector in the shed list can actually be rendered', async ({page}) => {
    await open(page, '2026-08-01');
    const order = await page.evaluate(() => window.__acorn.shedOrder());
    const seen = await classesEverRendered(page);
    const ghosts = [];
    for(const [which, list] of Object.entries(order)){
      expect(list.length, `the ${which} shed list is empty`).toBeGreaterThan(0);
      for(const sel of list){
        expect(sel, `"${sel}" is not a plain class selector`).toMatch(/^\.[a-z][\w-]*$/);
        if(!seen.has(sel.slice(1))) ghosts.push(`${which}: ${sel}`);
      }
    }
    expect(ghosts,
      'these are shed first but nothing can ever match them, so the list describes\n' +
      'a screen that no longer exists').toEqual([]);
  });

  test('the word itself is never shed', async ({page}) => {
    /* The lesson itself. Whatever else has to go, not these.

       .syls used to be the last name on this list — the syllable chips, shed only once
       everything above them had gone. The chips are gone now: the word's split is a seam
       drawn under the word itself (a .seams overlay measured onto it), so there is no
       separate row to shed and nothing to place on this list — the pieces cannot be shed
       out from under the word because they ARE the word. The caption slot .supra is the
       last thing to go, after the note and the dots. */
    await open(page, '2026-08-01');
    const order = await page.evaluate(() => window.__acorn.shedOrder());
    const all = [...order.word, ...order.done];
    for(const keep of ['.word', '.marked', '.spellin', '.cue', '.seams', '.sylseg'])
      expect(all, `${keep} is in the shed list`).not.toContain(keep);
    expect(order.word[order.word.length - 1],
      'the caption slot is not the last thing to go').toBe('.supra');
  });

  test('the cue outlives the instruction, and both outlive nothing else', async ({page}) => {
    // Ordering, not just membership: .note goes before .verdict, and the meaning cue
    // is not in the list at all — it is the one thing she cannot work out herself.
    await open(page, '2026-08-01');
    const order = await page.evaluate(() => window.__acorn.shedOrder());
    expect(order.word.indexOf('.note')).toBe(0);
    expect(order.word).not.toContain('.cue');
    // The caption slot (.supra — the meaning cue on write, the verdict on check) goes after the
    // note. It replaced the bare .verdict on the list when both moved into the reserved slot.
    expect(order.word.indexOf('.supra')).toBeGreaterThan(order.word.indexOf('.note'));
  });

  test('nothing styled is left over from a screen that has gone', async ({page}) => {
    /* The wider version of the same rot: every class the stylesheet styles should be
       one the app can put on a page. Six looked dead the first time and four were not
       — .lit and .net-link are the filaments, .seeded lives for two frames inside
       growTonight, .well is a word at box five or more.

       This drives the states directly rather than simulating months of use. A run
       through the real engine only reaches whatever the pace controller happens to
       pick, so the set of unreached classes moved every time the corpus changed —
       which couples a stylesheet test to pacing and is why three attempts at it
       disagreed with each other. Seeding the state is deterministic. */
    await open(page, '2026-08-01');
    const r = await page.evaluate(() => {
      const a = window.__acorn;
      const seen = new Set();
      const sweep = () => document.querySelectorAll('*').forEach(e =>
        (e.classList || []).forEach(c => seen.add(c)));

      /* A new list id every time. Reusing one id let 10.6's session-preservation hand
         back the PREVIOUS state's sitting — the words had changed but the list id and
         the day had not, so it looked valid — and three screens below never rendered.
         Caught by this test failing on the fix that caused it. */
      let nth = 0;
      const on = words => {
        const id = 'x' + (++nth);
        a.state.words.lists = [{id: id, name: 'T', words: words}];
        a.state.words.activeId = id;
        a.save(); a.go('parent'); a.go('day');
        if(!a.session()) a.start();
      };
      const fresh = () => { a.state.words.mastery = {}; a.state.words.sessions = []; };

      // A long word: the look stage, then writing it, then a near miss on it.
      fresh(); on(['beautiful', 'rain']);
      sweep();                                            // look, with the syllable row
      if(a.session().stage === 'look') a.cover();
      sweep();                                            // writing it
      a.type('beatiful'); a.check(); sweep();             // the marked word and a verdict
      a.next();
      // Missed once, then got it on the way back round: the earned "You got there."
      // verdict (.verdict.ok) and the winning word going green (.word.won). Since WIN-5 a
      // plain first-go win shows no verdict line at all, so the earned path is the only one
      // that renders .ok — a right-first-go here would leave it dead.
      fresh(); on(['said', 'rain']);
      if(a.session().stage === 'look') a.cover();
      a.type('sed'); a.check(); sweep();                  // a miss: the marked word + 'again'
      for(let g = 0; g < 8 && a.session(); g++){
        const W = a.session();
        if(W.words[W.i] === 'said' && W.stage !== 'look'){ a.type('said'); a.check(); break; }
        if(W.stage === 'look'){ a.cover(); continue; }
        if(W.stage === 'write'){ a.type(W.words[W.i]); a.check(); a.next(); continue; }
        a.next();
      }
      sweep();                                            // earned win: .verdict.ok + .word.won
      // A word done a SECOND time in the same sitting (WIN-3, David): its pebble roots — the
      // deep rim and the lit dome (.rooted on the dot, .pb-dome shown), which a once-collected
      // pebble does not have. It is earned within the sitting (corr >= 2), so drive the word's
      // first go and then its from-memory requeue to completion. Without this .rooted is dead.
      fresh(); on(['because', 'rain']);
      if(a.session().stage === 'look') a.cover();
      a.type('because'); a.check(); a.next();             // first go -> requeues from memory
      for(let g = 0; g < 10 && a.session(); g++){
        const W = a.session();
        if(W.words[W.i] === 'because' && W.stage !== 'look'){ a.type('because'); a.check(); break; }
        if(W.stage === 'look'){ a.cover(); continue; }
        if(W.stage === 'write'){ a.type(W.words[W.i]); a.check(); a.next(); continue; }
        a.next();
      }
      sweep();                                            // rooted pebble: .rooted + lit dome
      // A word with a twin, so the meaning cue is on the writing screen.
      fresh(); on(['licence', 'practise']);
      if(a.session().stage === 'look') a.cover();
      sweep();
      // An empty answer, which is the only thing that raises a toast.
      fresh(); on(['said', 'rain']);
      if(a.session().stage === 'look') a.cover();
      a.check(); sweep();
      // The finished screen, and the dead end that draws the tick instead of a map.
      fresh(); on(['said', 'rain']);
      for(let g = 0; g < 20 && a.session(); g++){
        const W = a.session();
        if(W.stage === 'look'){ a.cover(); continue; }
        if(W.stage === 'write'){ a.type(W.words[W.i]); a.check(); a.next(); continue; }
        a.next();
      }
      sweep();
      a.state.words.lists = [{id: 'empty', name: 'E', words: []}];
      a.state.words.activeId = 'empty'; fresh();
      a.save(); a.go('day'); sweep();

      /* The grown-ups screen with a map that has everything on it: words known well
         for .well, words she has missed for the tricky-word chips, and enough met for
         the filaments, which the code says need about thirty before the first is
         drawn. Seeded rather than practised for, so it does not depend on the pace. */
      const every = {};
      a.allLists().forEach(l => a.wordsOf(l).forEach(w => {
        every[w] = (l.words && !Array.isArray(l.words) && l.words[w]) || w; }));
      // A populated playlist too, so its rows (.playlist/.pw-word/.pw-btn/.rm) render and
      // are not read as styled-but-dead — two words, so both button ends show.
      a.state.words.lists = [{id: 'all', name: 'T', words: every},
                             {id: 'own', name: 'My list', words: ['banana', 'orchard']}];
      a.state.words.activeId = 'all';
      a.state.words.mastery = {};
      Object.keys(every).forEach((w, i) => {
        // Two thirds met, so the last third is still ahead of her and drawn as an
        // outline — .net-sketch is the second line an unmet word carries, and seeding
        // every word met left nothing for it to be on.
        if(i % 3 === 2) return;
        // A third known well, so .well and its stronger outline render. A third met
        // but shaky — missed at least once and short of known well — because that and
        // only that is what the tricky-word chips on this screen list.
        a.state.words.mastery[w] = i % 3 === 0
          ? {right: 5, wrong: 0, box: 6, lastSeen: '2026-07-30'}
          : {right: 2, wrong: 3, box: 2, lastSeen: '2026-07-30'};
      });
      a.state.words.sessions = [{date: '2026-07-31', asked: 8, right: 6, words: 8,
                                 firstTime: 6, fresh: [], grew: [], slipped: []}];
      a.save(); a.go('parent'); sweep();

      const decl = new Set();
      const sheet = [...document.styleSheets].find(s => !s.href);
      const walk = rules => { for(const x of rules){
        if(x.selectorText) (x.selectorText.match(/\.[A-Za-z][\w-]*/g) || [])
          .forEach(c => decl.add(c.slice(1)));
        if(x.cssRules && x.cssRules.length) walk(x.cssRules);
      }};
      walk(sheet.cssRules);
      return {dead: [...decl].filter(c => !seen.has(c)).sort(), styled: decl.size,
              links: document.querySelectorAll('.net-link').length,
              sketches: document.querySelectorAll('.net-sketch').length,
              chips: document.querySelectorAll('.chip').length};
    });
    expect(r.styled).toBeGreaterThan(40);
    expect(r.links, 'the seeded map drew no filaments, so .net-link proves nothing')
      .toBeGreaterThan(0);
    expect(r.sketches, 'the seeded map had no unmet words left to outline')
      .toBeGreaterThan(0);
    expect(r.chips, 'no word was shaky enough to be listed as one to watch')
      .toBeGreaterThan(0);
    // .seeded is added and removed inside two animation frames, so no sweep between
    // renders can catch it however the states are driven.
    expect(r.dead.filter(c => c !== 'seeded'),
      'styled but never rendered in any state the app can reach').toEqual([]);
    expect(errorsOf(page)).toEqual([]);
  });

});

test.describe('how things move', () => {

  test('every duration comes off the motion ladder', async ({page}) => {
    // One easing and three durations. Written as literals in six places they were
    // already consistent by luck; a seventh would not have been.
    await open(page, '2026-08-01');
    const loose = await page.evaluate(() => {
      const sheet = [...document.styleSheets].find(s => !s.href);
      const out = [];
      const walk = rules => {
        for(const r of rules){
          if(r.style && r.selectorText){
            for(const prop of ['transition', 'transition-duration', 'transition-timing-function',
                               'animation', 'animation-duration']){
              const v = r.style.getPropertyValue(prop);
              if(!v) continue;
              // The reduced-motion override is meant to be a literal: it exists to
              // beat everything else.
              if(/!important|0\.001ms|1e-06s/.test(r.cssText)) continue;
              if(/(?<![\w.-])\d*\.?\d+m?s\b/.test(v)) out.push(`${r.selectorText} { ${prop}: ${v} }`);
            }
          }
          if(r.cssRules && r.cssRules.length) walk(r.cssRules);
        }
      };
      walk(sheet.cssRules);
      return out;
    });
    expect(loose, 'a duration written out instead of taken from --m-*').toEqual([]);
  });

  test('the flourish is over in under two seconds for a full evening', async ({page}) => {
    // Nine words is the longest sitting the pace controller will build. A lead-in plus
    // a step each, and the cells themselves move at --m-slow on top.
    await open(page, '2026-08-01');
    const t = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const secs = n => parseFloat(cs.getPropertyValue(n));
      return {slow: secs('--m-slow'), quick: secs('--m-quick'), press: secs('--m-press')};
    });
    expect(t.press).toBeLessThan(t.quick);
    expect(t.quick).toBeLessThan(t.slow);
    const worst = 0.18 + 8 * 0.2 + t.slow;             // ARRIVE_LEAD + 8 steps + the move
    expect(worst, 'a nine-word evening takes too long to finish arriving').toBeLessThan(2.5);
  });

});
