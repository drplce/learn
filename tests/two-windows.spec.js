// Two windows on the same phone.
//
// Not exotic: a bookmark and a home-screen icon are two ways into the same origin, and a
// grown-up looking at the settings while she is on a word is the obvious way to have both
// open at once. iOS keeps tabs alive for weeks.
//
// save() wrote the whole of one window's state over whatever was there, so whichever window
// wrote last erased the other's work. Driven with two real pages: she answered a word and a
// grown-up changed the tint next door, and her answer was gone. A grown-up pasted this
// week's list and she answered next door, and the list was gone. Silently, both times.
const {test, expect} = require('@playwright/test');
const {APP} = require('./helpers');

/* These flaked at roughly one full run in nine from August to 2026-10-22, always under the
   parallel suite and never in isolation, and ROUTINE.md §5 told readers to re-run the file
   before believing a red — a standing exception to this project's rule that an intermittent
   failure is a defect in the test until proven otherwise.

   It was a defect in the test. See the pair below `a sitting finished in each window` for
   what it was and what replaced it. Two things from the hunt are worth keeping here:

     - 240 trials of the scenario in isolation did not reproduce it once, and running the
       FULL SUITE in a loop produced it on the first run. The load is not incidental to this
       failure; it IS the failure. Do not try to reproduce a parallel-suite red in isolation.
     - The sibling app diagnosed an identical-looking flake in ITS two-window test as
       parallel tests sharing one `file://` localStorage, and fixed it with `workers: 1`.
       That does NOT apply here: measured on this harness, two workers cannot see each
       other's `file://` localStorage, and neither can two sequential tests in one worker.
       Ruled out, not inherited — and the real cause was in neither app's workers.

   Every window records what `save()` actually did — whether a merge ran, what was on disk,
   what the lists were before and after — plus the `storage` events it received and when.
   That log is what made the cause readable in one red after two months of guessing, so it
   stays whether or not anything is currently flaking. */
/* Wrapped at localStorage.setItem, NOT at `__acorn.save`. The first version of this
   wrapped the test hook, and the hook is not the path that matters: the app's own code
   calls the module-scope save() directly, so the write inside check() — the one this
   test is actually about — never went through the wrapper. It logged the seed and
   nothing else, which would have looked like evidence while being none.
   Every write to storage goes through setItem, whoever calls it. */
const MERGE_LOG = () => {
  window.__saves = [];
  const names = v => { try { return (JSON.parse(v).words.lists || []).map(l => l.name); }
                       catch(e){ return 'unreadable'; } };
  /* The merge turns on one comparison — `JSON.stringify(S.words.lists) === _listsSeen` —
     and until 2026-10-22 nothing could see either side of it, so a red could only report
     the outcome. Both sides are recorded on every write now, along with the storage
     events this window received, because the question the flake asks is WHEN each window
     heard about the other's work. */
  const seen = () => { try { return (JSON.parse(window.__acorn.listsSeen()) || [])
                               .map(l => l.name); } catch(e){ return 'unreadable'; } };
  const mine = () => { try { return window.__acorn.state.words.lists.map(l => l.name); }
                       catch(e){ return 'unreadable'; } };
  const t0 = Date.now();
  /* A deaf window (see `win(..., deaf)`) suppresses only the listeners registered while the
     app loads — this one, added afterwards, still has to work, or a deaf window's failure
     would print nothing. */
  window.__deaf = false;
  window.addEventListener('storage', e => {
    if(e.key === 'acorn.v1') window.__saves.push({at: Date.now() - t0, heard: names(e.newValue)});
  });
  const real = Storage.prototype.setItem;
  Storage.prototype.setItem = function(k, v){
    if(k === 'acorn.v1'){
      const raw = localStorage.getItem(k);
      window.__saves.push({at: Date.now() - t0, wrote: names(v),
                           foundOnDisk: raw ? names(raw) : 'absent',
                           held: mine(), listsSeen: seen(),
                           untouched: JSON.stringify(mine()) === JSON.stringify(seen())});
    }
    return real.apply(this, arguments);
  };
};
/* WHY EVERY TWO-WINDOW TEST HERE WAITS, measured 2026-11-04.
   `localStorage` is not shared between two pages the instant one of them writes. Each
   renderer holds its own cached copy of the storage area and the browser process pushes
   changes across; `getItem` reads the cache. So a page can write, read its own write back,
   and a second page still sees the old value for a few milliseconds.

   Measured directly, two pages in one context, forty writes on an idle machine: the second
   page's first read was stale **1 time in 40, by about 2ms**. Under the parallel suite the
   window is wide enough to swallow a whole test — which is exactly what happened to
   `and her answering does not erase the list he just saved` on 2026-11-04, after 609 green:
   her window read the device at her save and found the list she had seeded, not the one a
   grown-up had pasted 10ms earlier, and heard about his 69ms later. Its log said so in one
   red, which is what that log is for.

   Two consequences for any test in this file:
     - **Asking the writer whether its write landed proves nothing.** It is reading its own
       cache. The only proof that a value is on the device is ANOTHER window reading it.
     - **A test where two real windows write in turn must wait in between**, or it is a
       stopwatch. `and the same thing with two real windows` already waited, having been
       rebuilt on 2026-10-22; the three older tests around it did not, and now do.

   The app cannot close this, and that is not a dodge: `getItem` is the only view a page has
   of the store, and there is no API that forces a fresh read. On her phone it would need a
   grown-up's paste and her answer to land within the same few milliseconds. Recorded rather
   than papered over. */
/* The budget is deliberately generous: `expect.poll` returns the moment the predicate holds, so
   a long one is only ever spent on a run that is already failing. It was raised from 3000ms on
   2026-11-04 after a wait ran out once in 40 trials under six workers — and **raising it was not
   what that failure needed**, which is worth saying rather than quietly keeping the credit. With
   the diagnostic below attached, the next run showed what the waiting window could actually see:

     {"visibility":"visible","deaf":false,"onDiskFromHere":"unreadable","log":[]}

   An empty `file://` store and not one storage event in fifteen seconds. That is the class
   ROUTINE.md §5 already carries — a `file://` page coming up on a store that is not the shared
   one — and no budget cures it. Measured against the version of this file from before today's
   repair, under the identical hammer: **4 failures in 520 trials before, 2 in 560 after**, so the
   waits roughly halved it and the residue is the environment. The budget stays generous anyway,
   because it costs nothing on a green run. */
const HEARD_MS = 15000;
const WHAT_IT_SAW = () => {
  let disk = 'unreadable';
  try{ const o = JSON.parse(localStorage.getItem('acorn.v1') || '{}');
       disk = {lists: (o.words.lists || []).map(l => l.name),
               mastery: Object.keys(o.words.mastery || {}),
               sessions: (o.words.sessions || []).length,
               tint: (o.settings || {}).tint, name: (o.profile || {}).name}; }catch(e){}
  return {visibility: document.visibilityState, deaf: !!window.__deaf,
          onDiskFromHere: disk, log: window.__saves || []};
};
const heard = async (p, read, ok, what) => {
  const t0 = Date.now();
  try{
    await expect.poll(() => p.evaluate(read).then(ok),
      {timeout: HEARD_MS, message: 'the other window never heard about ' + what}).toBe(true);
  }catch(e){
    // A wait that times out has to say what the window it was watching could actually see,
    // or it reports "never heard" for a page that was looking at the right thing all along.
    const saw = await p.evaluate(WHAT_IT_SAW).catch(() => 'the page would not answer');
    throw new Error(e.message + '\n  what that window saw: ' + JSON.stringify(saw));
  }
  const ms = Date.now() - t0;
  if(ms > 500) console.log('[heard] ' + what + ': ' + ms + 'ms');   // the tail, when there is one
};
const LISTS = () => window.__acorn.state.words.lists.map(l => l.name);
const MASTERY = () => Object.keys(window.__acorn.state.words.mastery || {});
const SESSIONS = () => (window.__acorn.state.words.sessions || []).length;

const savesOf = p => p.evaluate(() => window.__saves || []).catch(() => []);
// Both windows' save logs, for a failure message that says what happened rather than
// only what is missing.
async function story(...pages){
  const out = [];
  for(const p of pages) out.push(`${p.__tag}: ${JSON.stringify(await savesOf(p))}`);
  return '\n  ' + out.join('\n  ');
}

async function win(context, today, tag, deaf){
  const p = await context.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.__errs = errs;
  p.__tag = tag || 'window';
  /* `deaf` gives a window that genuinely has not heard — the state the racing tests used to
     reach by accident, now reached on purpose. The app registers its `storage` listener as
     it loads, so suppressing registrations until the page has booted leaves a window that
     reads and writes storage normally and is simply never told. break.js §31 does the same
     thing for her answers, and for the same reason: the guard on a grown-up's work is the
     merge in save(), not the listener, and only a window that cannot hear can prove it. */
  if(deaf) await p.addInitScript(() => {
    window.__deaf = true;
    const real = window.addEventListener;
    window.addEventListener = function(t, f, o){
      if(t === 'storage' && window.__deaf) return;
      return real.call(this, t, f, o);
    };
  });
  await p.goto(APP);
  await p.waitForFunction(() => !!window.__acorn);
  await p.evaluate(MERGE_LOG);
  await p.evaluate(d => window.__acorn.setToday(d), today || '2026-08-01');
  return p;
}
// What is actually on the device, not what a window believes.
const onDevice = p => p.evaluate(() => {
  const o = JSON.parse(localStorage.getItem('acorn.v1'));
  return {mastery: Object.keys(o.words.mastery || {}).sort(),
          lists: (o.words.lists || []).map(l => l.name).sort(),
          sessions: (o.words.sessions || []).length,
          tint: o.settings.tint, name: o.profile.name, activeId: o.words.activeId};
});
const answerOne = p => p.evaluate(() => {
  const a = window.__acorn;
  a.go('day'); if(!a.session()) a.start();
  if(a.session().stage === 'look') a.cover();
  a.type(a.session().words[a.session().i]); a.check();
});
const seed = (p, words, listName) => p.evaluate(({ws, n}) => {
  const a = window.__acorn;
  a.state.words.lists = [{id: 'w', name: n, words: ws}];
  a.state.words.activeId = 'w';
  a.state.words.mastery = {}; a.state.words.sessions = [];
  a.save();
}, {ws: words, n: listName || 'Week 9'});

test.describe('two windows on the same device', () => {

  test('a grown-up changing a setting does not erase the word she just got',
    async ({context}) => {
    const her = await win(context, null, 'her');
    await seed(her, ['said', 'rain', 'beautiful']);
    const dad = await win(context, null, 'dad');   // opens holding the state as it is now
    await answerOne(her);
    expect((await onDevice(her)).mastery, 'her answer was not recorded').toEqual(['said']);
    // His window has to have heard her answer before he writes over it, or this is a race
    // against the browser rather than a test of the merge — see HEARD at the top.
    await heard(dad, MASTERY, ws => ws.includes('said'), 'her answer');
    await dad.evaluate(() => { window.__acorn.go('parent'); });
    await dad.locator('[data-tn="mint"]').click();
    const after = await onDevice(dad);
    expect(after.mastery,
      'her answer was erased by a tap next door. What each window\'s save() did:'
      + await story(her, dad))
      .toEqual(['said']);
    expect(after.tint, 'his tap did not take').toBe('mint');
  });

  test('and her answering does not erase the list he just saved', async ({context}) => {
    const her = await win(context, null, 'her');
    const dad = await win(context, null, 'dad');
    await seed(her, ['said', 'rain']);
    await dad.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id: 'new', name: 'Week 10', words: ['through', 'thought']}];
      a.state.words.activeId = 'new';
      a.save();
    });
    // NOT `onDevice(dad)`: a page reads its own renderer's cached copy, so asking the
    // writer whether the write landed can only ever say yes. See HEARD at the top.
    await heard(her, LISTS, ls => ls.includes('Week 10'), 'the list he pasted');
    await answerOne(her);
    const after = await onDevice(her);
    expect(after.lists,
      'the list a grown-up had just pasted in was erased. What each window\'s save() did:'
      + await story(her, dad))
      .toContain('Week 10');
    expect(after.mastery.length, 'her answer was not recorded').toBeGreaterThan(0);
  });

  test('and not even when her window has not been told', async ({context}) => {
    /* The twin of the test above, and the one with teeth on the merge rather than on the
       listener. Measured 2026-11-04, by injecting regressions and reading which tests red:
       take the merge out of save() altogether and every LIVE two-window test in this file
       stays green, because by then each one has waited for her window to hear and her
       window is carrying the right state anyway. What reds them is killing the `storage`
       listener. That is worth having — but it is the view, not the data, and their titles
       are about the data.

       So this one makes her window deaf instead of waiting: it reads his write off the
       device when it saves, exactly as `save()` does, and has never been told. Deterministic
       — the deafness is built, not timed. Taking the merge out of save() reds it, and
       disabling the `untouched` branch alone reds it: it is the only test driving two real
       windows that notices either. Killing the listener leaves it green, correctly, because
       it was never listening. */
    const her = await win(context, null, 'her', true);
    const dad = await win(context, null, 'dad');
    await seed(her, ['said', 'rain']);
    await dad.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id: 'new', name: 'Week 10', words: ['through', 'thought']}];
      a.state.words.activeId = 'new';
      a.save();
    });
    // His write has reached HER renderer — read from her page, which is the only reading
    // that is evidence about the device — while her window's own state has not moved.
    await heard(her, () => (JSON.parse(localStorage.getItem('acorn.v1') || '{}')
        .words.lists || []).map(l => l.name),
      ls => ls.includes('Week 10'), 'his write reaching her renderer');
    expect(await her.evaluate(LISTS), 'her window was told after all — it is not deaf')
      .toEqual(['Week 9']);
    await answerOne(her);
    const after = await onDevice(her);
    expect(after.lists,
      'a window that had not heard wrote the pasted list away. What each window\'s save() did:'
      + await story(her, dad))
      .toContain('Week 10');
    expect(after.mastery.length, 'her answer was not recorded').toBeGreaterThan(0);
  });

  test('a sitting finished in each window leaves two sittings, not one',
    async ({context}) => {
    const a = await win(context, null, 'first');
    const b = await win(context, null, 'second');
    await seed(a, ['said', 'rain']);
    const finish = p => p.evaluate(() => {
      const x = window.__acorn;
      x.go('day'); if(!x.session()) x.start();
      for(let g = 0; g < 40 && x.session(); g++){
        const W = x.session();
        if(W.stage === 'look'){ x.cover(); continue; }
        if(W.stage === 'write'){ x.type(W.words[W.i]); x.check(); x.next(); continue; }
        x.next();
      }
    });
    // The second window was opened before the list existed, so it only has one by hearing
    // about it; and it must have heard the first sitting before it writes its own, or the
    // merge it is being asked about never sees the record it is supposed to keep.
    await heard(b, LISTS, ls => ls.length > 0, 'the list');
    await finish(a);
    await heard(b, SESSIONS, n => n === 1, "the first window's sitting");
    const beforeB = (await savesOf(a)).length;
    await finish(b);
    /* And read it back from the window that did NOT write last — by the note at the top,
       that is the only reading which is evidence about the device rather than about a
       cache. The wait is on a's storage events ARRIVING, deliberately, not on them saying
       the right thing: a wait that already asserts the answer turns a real defect into a
       three-second timeout with a misleading message. */
    await heard(a, () => (window.__saves || []).length, n => n > beforeB,
      'the second window writing at all');
    expect((await onDevice(a)).sessions,
      'one of the two sittings was lost. What each window\'s save() did:' + await story(a, b))
      .toBe(2);
  });

  test('two sittings on the same day are two sittings', async ({context}) => {
    /* "Practise a bit more" makes a second sitting on the same day for the same list, so a
       merge keyed on the day and the list collapsed them and a grown-up's count went down.
       Found by the adversarial pass driving the two windows interleaved rather than turn by
       turn; a sitting carries an id of its own now. */
    const p = await win(context);
    await seed(p, ['said', 'rain']);
    const finish = () => p.evaluate(() => {
      const x = window.__acorn;
      x.go('day'); if(!x.session()) x.start();
      for(let g = 0; g < 40 && x.session(); g++){
        const W = x.session();
        if(W.stage === 'look'){ x.cover(); continue; }
        if(W.stage === 'write'){ x.type(W.words[W.i]); x.check(); x.next(); continue; }
        x.next();
      }
    });
    await finish();
    await finish();
    const r = await p.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('acorn.v1')).words.sessions;
      return {n: s.length, ids: s.map(x => x.id).filter(Boolean).length,
              unique: new Set(s.map(x => x.id)).size};
    });
    expect(r.n, 'the second sitting of the evening was collapsed into the first').toBe(2);
    expect(r.ids, 'a sitting was recorded with no identity of its own').toBe(2);
    expect(r.unique, 'two sittings share an id').toBe(2);
  });

  test('the record with more answers behind it is the one that survives',
    async ({context}) => {
    /* The merge rule for a word. Evidence only ever accumulates, so taking whichever record
       has been through more answers cannot move her backwards — and a stale window carrying
       an older record for the same word cannot undo a later one. */
    const p = await win(context);
    await seed(p, ['said']);
    const r = await p.evaluate(() => {
      const a = window.__acorn;
      // What is on the device: four answers in.
      localStorage.setItem('acorn.v1', JSON.stringify({
        profile: {name: '', createdAt: '2026-07-01'},
        words: {lists: [{id: 'w', name: 'W', words: ['said']}], activeId: 'w', sessions: [],
                mastery: {said: {box: 4, right: 4, wrong: 0, lastSeen: '2026-07-30'}}},
        settings: {},
      }));
      // What this window believes: one answer in, and about to save.
      a.state.words.mastery = {said: {box: 2, right: 1, wrong: 0, lastSeen: '2026-07-20'}};
      a.save();
      return JSON.parse(localStorage.getItem('acorn.v1')).words.mastery.said;
    });
    expect(r.box, 'a stale window put her back to an older record').toBe(4);
    expect(r.right).toBe(4);
  });

  /* This pair replaces one test that flaked about one full run in nine from August to
     2026-10-22, and that ROUTINE.md §5 excused as parallel load for two months.

     It was a stopwatch in disguise. It opened two real windows, had him edit the list, and
     then had her answer "while her window still holds the old name" — without waiting for
     anything. The log it was given on 2026-09-30 finally printed on 2026-10-22 and showed
     the margin: on an idle machine his edit reaches her window at 167ms and she answers at
     175ms. Eight milliseconds. Under the parallel suite that margin goes, and worse, on
     every ordinary run her window has ALREADY updated by the time she answers — so the test
     usually exercised the opposite of the case its own comment described.

     So the case is now built where it can be built exactly, in one window, and the live
     two-window path waits for the thing it depends on instead of racing it. Neither can
     flake. They are not two views of one thing: stubbing the merge's `untouched` branch
     reds the one-window test and leaves the two-window one green, because by then her
     window has heard and has nothing stale to merge. The first holds the merge rule; the
     second holds the live path end to end. The old test was trying to be both and was
     reliably neither. */

  test('a list this window has not touched is not reverted by it', async ({context}) => {
    /* If a window has not changed the lists since it read them, it has nothing to say about
       them, and storage's copy — a grown-up's edit next door — wins outright. Built in one
       window so the stale state is the state under test, not a state the clock has to
       cooperate to produce. */
    const her = await win(context, null, 'her');
    await seed(her, ['said', 'rain'], 'Week 9');
    const r = await her.evaluate(() => {
      const a = window.__acorn;
      // Next door, a grown-up fixes the list. This window has not heard yet: its own copy
      // and its record of what it last saw are both still the old one.
      const raw = JSON.parse(localStorage.getItem('acorn.v1'));
      raw.words.lists = [{id: 'w', name: 'Week 9 fixed', words: ['said', 'rain', 'plain']}];
      localStorage.setItem('acorn.v1', JSON.stringify(raw));
      const before = {held: a.state.words.lists.map(l => l.name),
                      seen: JSON.parse(a.listsSeen()).map(l => l.name)};
      a.save();                                  // her next write, carrying the old copy
      return {before: before,
              after: JSON.parse(localStorage.getItem('acorn.v1')).words.lists.map(l => l.name)};
    });
    // The premise: this really is a window holding a list it has not changed.
    expect(r.before.held, 'the window was not holding the old list').toEqual(['Week 9']);
    expect(r.before.seen, 'the window had already been told').toEqual(['Week 9']);
    expect(r.after, 'his edit to the list was reverted').toEqual(['Week 9 fixed']);
  });

  test('and the same thing with two real windows, once hers has heard', async ({context}) => {
    const her = await win(context, null, 'her');
    const dad = await win(context, null, 'dad');
    await seed(her, ['said', 'rain'], 'Week 9');
    await dad.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id: 'w', name: 'Week 9 fixed', words: ['said', 'rain', 'plain']}];
      a.save();
    });
    // Wait for the thing the old test raced: her window hearing about it.
    await heard(her, LISTS, ls => ls.length === 1 && ls[0] === 'Week 9 fixed', 'his edit');
    await answerOne(her);
    const after = await onDevice(her);
    expect(after.lists,
      'his edit to the list was reverted. What each window\'s save() did:'
      + await story(her, dad))
      .toEqual(['Week 9 fixed']);
    expect(after.mastery.length, 'her answer was not recorded').toBeGreaterThan(0);
  });

  test('but a list this window did change is kept', async ({context}) => {
    const p = await win(context);
    await seed(p, ['said']);
    const r = await p.evaluate(() => {
      const a = window.__acorn;
      // Something else wrote a list this window has never heard of.
      const raw = JSON.parse(localStorage.getItem('acorn.v1'));
      raw.words.lists = [{id: 'other', name: 'Theirs', words: ['one']}];
      localStorage.setItem('acorn.v1', JSON.stringify(raw));
      // And this window makes its own change.
      a.state.words.lists.push({id: 'mine', name: 'Mine', words: ['two']});
      a.save();
      return JSON.parse(localStorage.getItem('acorn.v1')).words.lists.map(l => l.name).sort();
    });
    expect(r, 'a list was dropped when both windows had changed something')
      .toEqual(['Mine', 'Theirs', 'Week 9']);
  });

  test('a window notices work done next door', async ({context}) => {
    const one = await win(context);
    const two = await win(context);
    await one.evaluate(() => {
      window.__acorn.state.profile.name = 'Ivy';
      window.__acorn.save();
    });
    await heard(two, () => window.__acorn.state.profile.name, n => n === 'Ivy',
      'the name set next door');
  });

  test('and noticing does not take the word out from under her', async ({context}) => {
    /* The risk of refreshing at all. Her half-typed answer lives on W.attempt and is written
       back into the box by the render, so a word in progress has to survive a change made
       next door — my first guard tried to duck this by skipping the refresh while she was on
       a word, which never ran, because she is always on a word on that screen. */
    const her = await win(context);
    await seed(her, ['beautiful', 'said']);
    await her.evaluate(() => {
      const a = window.__acorn;
      a.go('day'); if(!a.session()) a.start();
      if(a.session().stage === 'look') a.cover();
    });
    await her.locator('#type').click();
    await her.keyboard.type('beauti', {delay: 10});
    const dad = await win(context);
    await dad.evaluate(() => {
      window.__acorn.state.settings.tint = 'mint';
      window.__acorn.save();
    });
    await heard(her, () => window.__acorn.state.settings.tint, t => t === 'mint',
      'the tint he changed');
    const r = await her.evaluate(() => ({
      typed: (document.querySelector('#type') || {}).value,
      word: window.__acorn.session().words[window.__acorn.session().i],
      stage: window.__acorn.session().stage,
      focus: (document.activeElement || {}).id,
    }));
    expect(r.typed, 'what she had written was thrown away').toBe('beauti');
    expect(r.word, 'she was moved to a different word').toBe('beautiful');
    expect(r.stage).toBe('write');
    expect(r.focus, 'she was left outside the box she was typing in').toBe('type');
    expect(her.__errs).toEqual([]);
  });

  test('a window writing its own state twice does not merge with itself',
    async ({context}) => {
    // The skip that keeps an ordinary single-window save cheap and exact.
    const p = await win(context);
    await seed(p, ['said', 'rain']);
    const r = await p.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id: 'w', name: 'W', words: ['said']}];   // dropped a word
      a.save();
      a.state.words.mastery = {};                                       // and cleared her record
      a.save();
      const o = JSON.parse(localStorage.getItem('acorn.v1'));
      return {lists: o.words.lists.map(l => l.words.length), mastery: Object.keys(o.words.mastery)};
    });
    expect(r.lists, 'its own edit was undone by the merge').toEqual([1]);
    expect(r.mastery, 'its own clear was undone by the merge').toEqual([]);
  });

  test('a full disk does not resurrect a list she deleted', async ({context}) => {
    /* The merge and a failed write, together. save() marks "what we last wrote" so the next
       save can tell its own writes from another window's. That marker was set before the
       write, so a write that failed on a full disk left it claiming a value that never
       landed — and the following save then read the still-stored copy as another window's
       work and merged it back. Driven: with the disk full she deletes a list and carries on,
       and when space frees up the deleted list came back. The marker only advances on a
       write that actually succeeds now, so storage and the marker stay in step through any
       run of failed writes. */
    const p = await win(context);
    const r = await p.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id: 'keep', name: 'Keep', words: ['said']},
                             {id: 'del', name: 'Delete me', words: ['rain']}];
      a.state.words.activeId = 'keep';
      a.state.words.mastery = {}; a.state.words.sessions = [];
      a.save();                                                  // lands: both lists stored
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function(){ throw new DOMException('q', 'QuotaExceededError'); };
      a.state.words.lists = a.state.words.lists.filter(l => l.id !== 'del');   // she deletes one
      a.save();                                                  // fails, disk full
      a.state.words.mastery.said = {box: 2, right: 1, wrong: 0, lastSeen: '2026-08-01'};
      a.save();                                                  // fails; would trigger the stale merge
      Storage.prototype.setItem = orig;                          // space frees up
      a.save();                                                  // lands
      return {inMemory: a.state.words.lists.map(l => l.name),
              stored: JSON.parse(localStorage.getItem('acorn.v1')).words.lists.map(l => l.name)};
    });
    expect(r.inMemory, 'the deleted list came back in memory').toEqual(['Keep']);
    expect(r.stored, 'the deleted list was written back to the device').toEqual(['Keep']);
  });

  test('and a full disk never costs her a word once space frees up', async ({context}) => {
    // The other half: everything she does while the disk is full is still in memory, so the
    // first save that lands writes all of it. Her evening is not lost to a full disk.
    const p = await win(context);
    await seed(p, ['said', 'rain', 'they', 'went']);
    const r = await p.evaluate(() => {
      const a = window.__acorn;
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function(){ throw new DOMException('q', 'QuotaExceededError'); };
      a.go('day'); if(!a.session()) a.start();
      for(let g = 0; g < 20 && a.session(); g++){
        const W = a.session();
        if(W.stage === 'look'){ a.cover(); continue; }
        if(W.stage === 'write'){ a.type(W.words[W.i]); a.check(); a.next(); continue; }
        a.next();
      }
      const metWhileBroken = Object.keys(a.state.words.mastery).length;
      Storage.prototype.setItem = orig;
      a.save();
      return {metWhileBroken,
              stored: Object.keys(JSON.parse(localStorage.getItem('acorn.v1')).words.mastery).length};
    });
    expect(r.metWhileBroken, 'she practised nothing while the disk was full').toBeGreaterThan(0);
    expect(r.stored, 'her practice was not written once space came back')
      .toBe(r.metWhileBroken);
    expect(p.__errs).toEqual([]);
  });

});
