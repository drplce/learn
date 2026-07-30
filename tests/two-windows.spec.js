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

async function win(context, today){
  const p = await context.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.__errs = errs;
  await p.goto(APP);
  await p.waitForFunction(() => !!window.__acorn);
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
    const her = await win(context);
    await seed(her, ['said', 'rain', 'beautiful']);
    const dad = await win(context);           // opens holding the state as it is now
    await answerOne(her);
    expect((await onDevice(her)).mastery, 'her answer was not recorded').toEqual(['said']);
    // His window still holds the state from before she answered.
    await dad.evaluate(() => { window.__acorn.go('parent'); });
    await dad.locator('[data-tn="mint"]').click();
    const after = await onDevice(dad);
    expect(after.mastery, 'her answer was erased by a tap next door').toEqual(['said']);
    expect(after.tint, 'his tap did not take').toBe('mint');
  });

  test('and her answering does not erase the list he just saved', async ({context}) => {
    const her = await win(context);
    const dad = await win(context);
    await seed(her, ['said', 'rain']);
    await dad.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id: 'new', name: 'Week 10', words: ['through', 'thought']}];
      a.state.words.activeId = 'new';
      a.save();
    });
    expect((await onDevice(dad)).lists).toContain('Week 10');
    await answerOne(her);
    const after = await onDevice(her);
    expect(after.lists, 'the list a grown-up had just pasted in was erased')
      .toContain('Week 10');
    expect(after.mastery.length, 'her answer was not recorded').toBeGreaterThan(0);
  });

  test('a sitting finished in each window leaves two sittings, not one',
    async ({context}) => {
    const a = await win(context);
    const b = await win(context);
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
    await finish(a);
    await finish(b);
    expect((await onDevice(a)).sessions, 'one of the two sittings was lost').toBe(2);
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

  test('a list this window has not touched is not reverted by it', async ({context}) => {
    /* If a window has not changed the lists since it read them, it has nothing to say about
       them, and storage's copy — a grown-up's edit next door — wins outright. */
    const her = await win(context);
    const dad = await win(context);
    await seed(her, ['said', 'rain'], 'Week 9');
    await dad.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id: 'w', name: 'Week 9 fixed', words: ['said', 'rain', 'plain']}];
      a.save();
    });
    await answerOne(her);                       // her window still holds the old name
    const after = await onDevice(her);
    expect(after.lists, 'his edit to the list was reverted').toEqual(['Week 9 fixed']);
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
    await expect.poll(() => two.evaluate(() => window.__acorn.state.profile.name),
      {timeout: 3000, message: 'the other window never noticed'}).toBe('Ivy');
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
    await expect.poll(() => her.evaluate(() => window.__acorn.state.settings.tint),
      {timeout: 3000}).toBe('mint');
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

});
