// Acorn — spelling practice. The whole app, as a child and a parent use it.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

// Put a specific list in front of her, unseen, and start a session.
async function startOn(page, words, mastery){
  await page.evaluate(o => {
    const a = window.__acorn;
    a.state.words.lists = [{id:'w1', name:'Test', words:o.words}];
    a.state.words.activeId = 'w1';
    a.state.words.mastery = o.mastery || {};
    a.state.words.sessions = [];
    a.save();
    a.start();
  }, {words, mastery});
}
// Answer the current word correctly and move on.
async function correct(page){
  const w = await page.evaluate(() => window.__acorn.session().words[window.__acorn.session().i]);
  if(await page.locator('#cover').count()) await page.locator('#cover').click();
  await page.locator('#type').fill(w);
  await page.locator('#check').click();
  await page.locator('#next').click();
  return w;
}
// Answer correctly until the session ends. A session is not a fixed number of
// taps — a new word comes back for a second go, and so does a miss — so tests
// that want the end of a session ask for it rather than counting.
async function finishSession(page, limit = 40){
  const seen = [];
  for(let i = 0; i < limit; i++){
    if(!await page.evaluate(() => !!window.__acorn.session())) return seen;
    seen.push(await correct(page));
  }
  throw new Error('session did not finish in ' + limit + ' answers');
}

test.describe('opening the app', () => {

  test('opens straight onto a word — nothing to choose first', async ({page}) => {
    await open(page, '2026-07-28');
    await expect(page.locator('.word')).toBeVisible();
    expect(await page.evaluate(() => window.__acorn.screen())).toBe('day');
    await expect(page.locator('#stamp')).toHaveCount(0);      // no build stamp on her screens
    expect(errorsOf(page)).toEqual([]);
  });

  test('the easy list is where she starts', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => ({
      id: window.__acorn.activeList().id,
      name: window.__acorn.activeList().name,
      words: window.__acorn.wordsOf(window.__acorn.activeList())
    }));
    expect(out.id).toBe('easy');
    expect(out.name).toBe('Easy start');
    // Every starter word is short and single-syllable, so day one is winnable.
    expect(out.words.length).toBe(16);
    const long = await page.evaluate(ws => ws.filter(w => window.__acorn.syllables(w).length > 1), out.words);
    expect(long).toEqual([]);
  });

  test('her first session is three words', async ({page}) => {
    await open(page, '2026-07-28');
    const s = await page.evaluate(() => window.__acorn.session());
    expect(s.words.length).toBe(3);
    expect(s.stage).toBe('look');                              // all new, so all get shown first
  });

  test('lists are offered easiest first', async ({page}) => {
    await open(page, '2026-07-28');
    const ids = await page.evaluate(() => window.__acorn.allLists().map(l => l.id));
    expect(ids[0]).toBe('easy');
    expect(ids).toContain('tricky');
    expect(ids).toContain('aussie');
  });
});

test.describe('a word she has never met', () => {

  test('look, cover, write, check — the whole way through', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['friend']);
    await expect(page.locator('.word')).toHaveText('friend');
    await expect(page.locator('.note')).toContainText('Say it out loud');
    await page.locator('#cover').click();
    await expect(page.locator('#type')).toBeVisible();
    await expect(page.locator('.word')).toHaveCount(0);        // genuinely hidden
    await page.locator('#type').fill('friend');
    await page.locator('#check').click();
    await expect(page.locator('.verdict.ok')).toHaveText(/that’s it/);
    expect(await page.evaluate(() => window.__acorn.mastery('friend').box)).toBe(2);
    expect(errorsOf(page)).toEqual([]);
  });

  test('the spelling box never autocorrects her', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['friend']);
    await page.locator('#cover').click();
    const attrs = await page.locator('#type').evaluate(n => ({
      correct: n.getAttribute('autocorrect'), cap: n.getAttribute('autocapitalize'),
      spell: n.getAttribute('spellcheck'), complete: n.getAttribute('autocomplete')
    }));
    expect(attrs).toEqual({correct:'off', cap:'off', spell:'false', complete:'off'});
  });

  test('a one-syllable word is not given a syllable row repeating itself', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['said']);
    await expect(page.locator('.word')).toHaveText('said');
    await expect(page.locator('.syls')).toHaveCount(0);
  });

  test('a multi-syllable word shows its parts, each speakable', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['because']);
    await expect(page.locator('.syl')).toHaveCount(2);
    await expect(page.locator('.syl').first()).toHaveText('be');
  });
});

test.describe('a word she already knows', () => {

  test('is never shown before she spells it', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['friend'], {friend:{right:3, wrong:0, box:3, lastSeen:'2026-07-20'}});
    await expect(page.locator('#type')).toBeVisible();          // straight to writing
    await expect(page.locator('.word')).toHaveCount(0);
    await expect(page.locator('#cover')).toHaveCount(0);
    await expect(page.locator('.note')).toContainText('Listen, then write it');
  });

  test('pressing Enter checks it', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['rain']);
    await page.locator('#cover').click();
    await page.locator('#type').fill('rain');
    await page.locator('#type').press('Enter');
    await expect(page.locator('.verdict.ok')).toBeVisible();
  });
});

test.describe('getting it wrong', () => {

  test('shows only the correct spelling — never her own', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['because','rain','boat']);
    await page.locator('#cover').click();
    await page.locator('#type').fill('becuase');
    await page.locator('#check').click();
    // one letter out of place, so the wording is singular
    await expect(page.locator('.verdict.again')).toHaveText('So close. Look at this letter.');
    await expect(page.locator('.marked u')).toHaveCount(1);       // the letter to look at
    const body = await page.locator('#screen').innerText();
    expect(body).not.toContain('becuase');
    expect(body).not.toMatch(/wrong|incorrect|failed|bad/i);
    await expect(page.locator('#next')).toBeVisible();            // no immediate re-copy
  });

  test('several letters out of place reads as plural', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['together','rain','boat']);
    await page.locator('#cover').click();
    await page.locator('#type').fill('togthr');        // drops the e and an e, so two unmatched
    await page.locator('#check').click();
    await expect(page.locator('.verdict.again')).toHaveText(/Look at these letters/);
    expect(await page.locator('.marked u').count()).toBeGreaterThan(1);
  });

  test('an empty box is not an attempt and costs her nothing', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['because','rain','boat']);
    await page.locator('#cover').click();
    await page.locator('#check').click();
    // still on the same word, nothing recorded against it
    await expect(page.locator('#type')).toBeVisible();
    await expect(page.locator('.verdict')).toHaveCount(0);
    expect(await page.evaluate(() => window.__acorn.mastery('because')))
      .toMatchObject({right:0, wrong:0, box:1});
    // and blank-tapping through cannot walk the session at all
    for(let i = 0; i < 10; i++) await page.locator('#check').click();
    expect(await page.evaluate(() => window.__acorn.session().i)).toBe(0);
    expect(errorsOf(page)).toEqual([]);
  });

  test('spaces alone are not an attempt either', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['rain']);
    await page.locator('#cover').click();
    await page.locator('#type').fill('   ');
    await page.locator('#check').click();
    await expect(page.locator('.verdict')).toHaveCount(0);
    expect(await page.evaluate(() => window.__acorn.mastery('rain').wrong)).toBe(0);
  });

  test('a wild guess shows the word plainly rather than marking it all wrong', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['because','rain','boat']);
    await page.locator('#cover').click();
    await page.locator('#type').fill('zzqq');
    await page.locator('#check').click();
    await expect(page.locator('.verdict.again')).toHaveText(/Here it is/);
    await expect(page.locator('.marked')).toHaveCount(0);
    await expect(page.locator('.word')).toHaveText('because');
  });

  test('the word comes back later in the same session, from memory', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['because','rain','boat']);
    await page.locator('#cover').click();
    await page.locator('#type').fill('becuase');
    await page.locator('#check').click();
    await page.locator('#next').click();
    await correct(page);
    await correct(page);
    // requeued — and this time with no look step
    expect(await page.evaluate(() => window.__acorn.session().words[window.__acorn.session().i])).toBe('because');
    await expect(page.locator('#cover')).toHaveCount(0);
    await expect(page.locator('#type')).toBeVisible();
    await page.locator('#type').fill('because');
    await page.locator('#check').click();
    await expect(page.locator('.verdict.ok')).toHaveText(/got there/);
    const m = await page.evaluate(() => window.__acorn.mastery('because'));
    expect(m.box).toBe(1);                                        // no penalty, no advance
  });

});

test.describe('progress on screen', () => {

  test('one dot per word the sitting set out to cover', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['rain','boat','light'],
      {rain:{right:3,wrong:0,box:3,lastSeen:'2026-07-20'},
       boat:{right:3,wrong:0,box:3,lastSeen:'2026-07-20'},
       light:{right:3,wrong:0,box:3,lastSeen:'2026-07-20'}});
    const plan = await page.evaluate(() => window.__acorn.session().words.length);
    expect(await page.locator('.dots i').count()).toBe(plan);
  });

  test('a requeued word does not add a dot or move progress backwards', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['because','rain','boat','light']);
    const dots = await page.locator('.dots i').count();
    const width = () => page.locator('.daybar i').evaluate(n => parseFloat(n.style.width));
    const before = await width();
    // miss the first word: it comes back later, so W.words grows
    await page.locator('#cover').click();
    await page.locator('#type').fill('zzzz');
    await page.locator('#check').click();
    await page.locator('#next').click();
    expect(await page.locator('.dots i').count()).toBe(dots);   // row did not grow
    expect(await width()).toBeGreaterThanOrEqual(before);       // bar did not retreat
  });

  test('progress counts words finished, not attempts made', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['rain','boat','light'],
      {rain:{right:3,wrong:0,box:3,lastSeen:'2026-07-20'},
       boat:{right:3,wrong:0,box:3,lastSeen:'2026-07-20'},
       light:{right:3,wrong:0,box:3,lastSeen:'2026-07-20'}});
    expect(await page.locator('.dots i.on').count()).toBe(0);
    await correct(page);
    expect(await page.locator('.dots i.on').count()).toBe(1);
    await correct(page);
    expect(await page.locator('.dots i.on').count()).toBe(2);
  });

  test('the bar never exceeds full, even with requeues', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['because','rain','boat']);
    for(let i = 0; i < 30; i++){
      if(!await page.evaluate(() => !!window.__acorn.session())) break;
      const w = await page.evaluate(() => { const s = window.__acorn.session(); return s.words[s.i]; });
      if(await page.locator('#cover').count()) await page.locator('#cover').click();
      await page.locator('#type').fill(w);
      await page.locator('#check').click();
      const bar = await page.locator('.daybar i').count()
        ? await page.locator('.daybar i').evaluate(n => parseFloat(n.style.width)) : 0;
      expect(bar).toBeLessThanOrEqual(100);
      await page.locator('#next').click();
    }
    expect(errorsOf(page)).toEqual([]);
  });
});

test.describe('finishing', () => {

  test('walks every word then lands on the done screen', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['rain','boat','light']);
    const asked = await finishSession(page);
    expect(await page.evaluate(() => window.__acorn.session())).toBeNull();
    // Three words, each shown once and then asked again from memory.
    expect(asked.length).toBe(6);
    expect([...new Set(asked)].sort()).toEqual(['boat','light','rain']);
    await expect(page.locator('.tick')).toBeVisible();
    await expect(page.locator('.headline')).toHaveText(/first go|All done/);
    const s = await page.evaluate(() => window.__acorn.state.words.sessions);
    expect(s.length).toBe(1);
    expect(s[0]).toMatchObject({words:3, firstTime:3});
    expect(errorsOf(page)).toEqual([]);
  });

  test('the done screen shows how much of the list she knows', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['rain','boat']);
    await finishSession(page);
    await expect(page.locator('.note')).toContainText(/of \d+ words known well/);
    await expect(page.locator('.pbar')).toBeVisible();
  });

  test('she can choose to practise more', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['rain','boat']);
    await finishSession(page);
    await page.locator('#again').click();
    expect(await page.evaluate(() => !!window.__acorn.session())).toBe(true);
  });

  test('walking away mid-session keeps the progress already earned', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['rain','boat']);
    await page.locator('#cover').click();
    await page.locator('#type').fill('rain');
    await page.locator('#check').click();
    await page.evaluate(() => window.__acorn.go('parent'));
    expect(await page.evaluate(() => window.__acorn.mastery('rain').box)).toBe(2);
    expect(await page.evaluate(() => window.__acorn.session())).toBeNull();
  });
});

test.describe('spaced repetition', () => {

  // One box per day, so raising a word means moving through days.
  async function raise(page, word, times){
    await page.evaluate(o => {
      const a = window.__acorn;
      for(let i = 0; i < o.times; i++){
        a.setToday('2026-07-' + String(10 + i).padStart(2, '0'));
        a.recordWord(o.word, 'first');
      }
    }, {word, times});
  }

  test('the ramp reaches long intervals so known words stop coming back weekly', async ({page}) => {
    await open(page, '2026-07-28');
    expect(await page.evaluate(() => window.__acorn.BOX_DAYS)).toEqual({1:0, 2:1, 3:2, 4:4, 5:8, 6:21, 7:60});
  });

  test('one box per day — a second session cannot fast-track a word', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      a.recordWord('friend', 'first');  const first = a.mastery('friend').box;
      a.recordWord('friend', 'first');  const same = a.mastery('friend').box;
      a.setToday('2026-07-29');
      a.recordWord('friend', 'first');  const next = a.mastery('friend').box;
      return {first, same, next};
    });
    expect(out).toEqual({first:2, same:2, next:3});
  });

  test('a miss drops two boxes, never below two', async ({page}) => {
    await open(page, '2026-07-28');
    await raise(page, 'castle', 6);
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      const before = a.mastery('castle').box;
      a.recordWord('castle', 'wrong');
      const after = a.mastery('castle').box;
      a.recordWord('lamb', 'first');       // box 2
      a.recordWord('lamb', 'wrong');
      a.recordWord('brandnew', 'wrong');   // never seen
      return {before, after, low: a.mastery('lamb').box, fresh: a.mastery('brandnew').box};
    });
    expect(out.before).toBe(7);
    expect(out.after).toBe(5);             // large but partial, not a reset
    expect(out.low).toBe(1);
    expect(out.fresh).toBe(1);
  });

  test('the top box is capped', async ({page}) => {
    await open(page, '2026-07-28');
    await raise(page, 'rain', 12);
    const out = await page.evaluate(() => ({box: window.__acorn.mastery('rain').box, max: window.__acorn.MAX_BOX}));
    expect(out.box).toBe(out.max);
  });

  test('a word is due again only after its interval', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      a.recordWord('metre','first');                      // box 2 -> due after a day
      return {same: a.isDue('metre','2026-07-28'), next: a.isDue('metre','2026-07-29'),
              unseen: a.isDue('neverseen','2026-07-28')};
    });
    expect(out).toEqual({same:false, next:true, unseen:true});
  });

  test('the most overdue word comes back first', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'w1', name:'Mix', words:['ages','recent','filler']}];
      a.state.words.activeId = 'w1';
      a.state.words.mastery = {
        ages:   {right:3, wrong:0, box:3, lastSeen:'2026-07-01'},
        recent: {right:3, wrong:0, box:3, lastSeen:'2026-07-25'},
        filler: {right:5, wrong:0, box:5, lastSeen:'2026-07-27'}
      };
      return {ages: a.overdueRatio('ages','2026-07-28'), recent: a.overdueRatio('recent','2026-07-28'),
              session: a.buildSession(a.activeList(), '2026-07-28')};
    });
    expect(out.ages).toBeGreaterThan(out.recent);
    expect(out.session[0]).toBe('ages');
  });
});

test.describe('the self-adapting pace', () => {

  async function withSessions(page, list, accuracy){
    return page.evaluate(o => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'w1', name:'Mix', words:o.list}];
      a.state.words.activeId = 'w1';
      a.state.words.mastery = {};
      // five sessions of four words at the given first-time accuracy
      a.state.words.sessions = [1,2,3,4,5].map(() => ({date:'2026-07-20', asked:4, words:4,
                                                        right:0, firstTime:Math.round(4 * o.acc)}));
      return {acc: a.recentAccuracy(), newToday: a.newWordsToday(),
              pool: a.poolCap(), size: a.sessionWords()};
    }, {list, acc:accuracy});
  }

  test('flying — a longer sitting, up to three new words', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await withSessions(page, ['a1','a2','a3','a4','a5','a6'], 1);
    expect(out.acc).toBe(1);
    expect(out.newToday).toBe(3);
    expect(out.size).toBe(9);
    expect(out.pool).toBe(3);
  });

  test('in the sweet spot — one new word', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await withSessions(page, ['a1','a2','a3','a4','a5','a6'], .75);
    expect(out.newToday).toBe(1);
    expect(out.size).toBe(8);
    expect(out.pool).toBe(2);
  });

  test('struggling — a shorter sitting and nothing new', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await withSessions(page, ['a1','a2','a3','a4','a5','a6'], .5);
    expect(out.newToday).toBe(0);
    expect(out.size).toBe(6);
    expect(out.pool).toBe(2);
  });

  test('new material never takes more than a third of a sitting', async ({page}) => {
    await open(page, '2026-07-28');
    for(const acc of [1, .8, .75, .5, .2]){
      const out = await withSessions(page, ['a1','a2','a3','a4','a5','a6'], acc);
      expect(out.pool / out.size).toBeLessThanOrEqual(1/3);
    }
  });

  test('too early to judge — one at a time', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.sessions = [{date:'2026-07-27', asked:3, words:3, right:3, firstTime:3}];
      return {acc: a.recentAccuracy(), newToday: a.newWordsToday()};
    });
    expect(out.acc).toBeNull();            // one small session proves nothing
    expect(out.newToday).toBe(1);
  });

  test('her very first session seeds three', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => ({n: window.__acorn.newWordsToday(), seed: window.__acorn.SEED_NEW}));
    expect(out.n).toBe(out.seed);
    expect(out.seed).toBe(3);
  });
});

test.describe('building a session', () => {

  test('a long list is dripped, never dumped', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      const words = 'aa bb cc dd ee ff gg hh ii jj kk ll mm nn oo pp qq rr ss tt'.split(' ');
      a.state.words.lists = [{id:'w1', name:'Week 1', words}];
      a.state.words.activeId = 'w1'; a.state.words.mastery = {}; a.state.words.sessions = [];
      return a.buildSession(a.activeList(), '2026-07-28').length;
    });
    expect(out).toBe(3);                   // 20 words available, 3 introduced
  });

  test('words already started come back before anything new', async ({page}) => {
    await open(page, '2026-07-28');
    const s = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'w1', name:'Mix', words:['alpha','bravo','charlie','delta','echo']}];
      a.state.words.activeId = 'w1'; a.state.words.mastery = {}; a.state.words.sessions = [];
      ['alpha','bravo','charlie'].forEach(w => a.recordWord(w, 'wrong'));
      return a.buildSession(a.activeList(), '2026-07-29');
    });
    expect(s.slice().sort()).toEqual(['alpha','bravo','charlie']);
    expect(s).not.toContain('delta');      // nothing new until one graduates
  });

  test('it opens with a word she is likely to get right', async ({page}) => {
    await open(page, '2026-07-28');
    const s = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'w1', name:'Mix', words:['safe','shaky','fresh']}];
      a.state.words.activeId = 'w1'; a.state.words.sessions = [];
      a.state.words.mastery = {
        safe:  {right:5, wrong:0, box:5, lastSeen:'2026-07-10'},
        shaky: {right:1, wrong:3, box:1, lastSeen:'2026-07-27'}
      };
      return a.buildSession(a.activeList(), '2026-07-28');
    });
    expect(s[0]).toBe('safe');
  });

  test('most of a session is words she can already spell', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      const words = 'w1 w2 w3 w4 w5 w6 w7 w8 w9 w10 w11 w12'.split(' ');
      a.state.words.lists = [{id:'L', name:'Mix', words}];
      a.state.words.activeId = 'L';
      // a fortnight in and holding steady, so the pace is past its first night
      a.state.words.sessions = [1,2,3,4,5].map(() => ({date:'2026-07-27', asked:8, words:8,
                                                       right:6, firstTime:6}));
      // nine words solidly known and due, three not yet met
      const m = {};
      words.slice(0, 9).forEach(w => { m[w] = {right:4, wrong:0, box:4, lastSeen:'2026-07-01'}; });
      a.state.words.mastery = m;
      const s = a.buildSession(a.activeList(), '2026-07-28');
      const acq = s.filter(w => a.acquiring(w)).length;
      return {len: s.length, acq, known: Math.round(100 * (s.length - acq) / s.length)};
    });
    expect(out.known).toBeGreaterThanOrEqual(70);
  });

  test('her very first night is short and all new — the one exception', async ({page}) => {
    await open(page, '2026-07-28');
    const s = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'L', name:'New', words:['w1','w2','w3','w4','w5','w6']}];
      a.state.words.activeId = 'L'; a.state.words.sessions = []; a.state.words.mastery = {};
      return a.buildSession(a.activeList(), '2026-07-28');
    });
    expect(s.length).toBe(3);
  });

  test('a session is never a single word when there is more to do', async ({page}) => {
    await open(page, '2026-07-28');
    const n = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'w1', name:'Mix', words:['one','two','three','four','five','six']}];
      a.state.words.activeId = 'w1'; a.state.words.sessions = [];
      // struggling, so the pace would add nothing new — the floor must still fire
      a.state.words.sessions = [1,2,3,4,5].map(() => ({date:'2026-07-20', asked:4, words:4, right:0, firstTime:1}));
      a.state.words.mastery = {one:{right:1, wrong:2, box:1, lastSeen:'2026-07-27'}};
      return a.buildSession(a.activeList(), '2026-07-28').length;
    });
    expect(n).toBeGreaterThanOrEqual(2);
  });
});

test.describe('syllables', () => {

  // Checked against Longman LDOCE4 and Oxford Advanced Learner's 7th.
  const MUST = {
    happen:'hap·pen', water:'wa·ter', robot:'ro·bot', open:'o·pen',
    mother:'moth·er', teacher:'teach·er', singer:'sing·er', brother:'broth·er',
    neighbour:'neigh·bour', pocket:'pock·et',
    table:'ta·ble', little:'lit·tle', apple:'ap·ple', castle:'cas·tle', summer:'sum·mer',
    centre:'cen·tre', metre:'me·tre',
    afraid:'a·fraid', between:'be·tween', display:'dis·play',
    basket:'bas·ket', listen:'lis·ten', island:'is·land', question:'ques·tion',
    lion:'li·on', station:'sta·tion', division:'di·vi·sion', beautiful:'beau·ti·ful',
    winter:'win·ter', rabbit:'rab·bit', magnet:'mag·net', tomorrow:'to·mor·row'
  };

  test('splits the words it must get right', async ({page}) => {
    await open(page, '2026-07-28');
    const got = await page.evaluate(ws => {
      const o = {};
      ws.forEach(w => o[w] = window.__acorn.syllables(w).join('·'));
      return o;
    }, Object.keys(MUST));
    expect(got).toEqual(MUST);
  });

  test('the pieces always rejoin to the word', async ({page}) => {
    await open(page, '2026-07-28');
    const bad = await page.evaluate(() => {
      const ws = ['because','friend','beautiful','government','separate','february','jewellery',
                  'recognise','television','permission','strength','through','rhythm','queue',
                  'antidisestablishmentarianism','aaa','xyz','o',''];
      return ws.filter(w => window.__acorn.syllables(w).join('') !== w.toLowerCase().replace(/[^a-z']/g,''));
    });
    expect(bad).toEqual([]);
  });

  test('built-in lists use their hand-checked splits', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.activeId = 'tricky';
      return {feb: a.splitOf('february').join('·'), sep: a.splitOf('separate').join('·')};
    });
    // No dictionary splits off a lone final y; "sep·a·rate" keeps the forgotten a.
    expect(out.feb).toBe('Feb·ru·ary');
    expect(out.sep).toBe('sep·a·rate');
  });

  // Known limitation, kept visible: after a SHORT vowel dictionaries break after
  // the consonant (hon·est, cit·y), after a long one before it (o·pen, wa·ter).
  // Spelling alone cannot tell them apart, so the splitter picks the long form.
  test('the short-vowel split is the documented known miss', async ({page}) => {
    await open(page, '2026-07-28');
    const got = await page.evaluate(() => ['honest','seven','lemon','city']
      .map(w => window.__acorn.syllables(w).join('·')));
    expect(got).toEqual(['ho·nest','se·ven','le·mon','ci·ty']);
  });
});

test.describe('comparing her attempt', () => {

  test('a dropped letter does not mark the whole word wrong', async ({page}) => {
    await open(page, '2026-07-28');
    const m = await page.evaluate(() => window.__acorn.matched('becuse', 'because'));
    expect(m.count).toBe(6);
  });

  test('an exact match marks every letter', async ({page}) => {
    await open(page, '2026-07-28');
    const m = await page.evaluate(() => window.__acorn.matched('friend', 'friend'));
    expect(m.hit).toEqual([0,1,2,3,4,5]);
  });

  test('an empty attempt matches nothing and does not throw', async ({page}) => {
    await open(page, '2026-07-28');
    const m = await page.evaluate(() => window.__acorn.matched('', 'friend'));
    expect(m).toEqual({count:0, hit:[]});
  });
});

test.describe('her own list', () => {

  test('accepts commas, new lines, numbering and bullets', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => window.__acorn.parseWordList(
      '1. because\n2) friend\n- thought,  through\n\nENOUGH  together'));
    expect(out).toEqual(['because','friend','thought','through','enough','together']);
  });

  test('drops anything too long to be a spelling word', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() =>
      window.__acorn.parseWordList('because, ' + 'z'.repeat(300) + ', rain'));
    expect(out).toEqual(['because','rain']);
  });

  test('drops duplicates and single letters', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => window.__acorn.parseWordList('cat, cat, CAT, a, dog, 5'));
    expect(out).toEqual(['cat','dog']);
  });

  test('a pasted list saves, becomes active, and drives the session', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('#paste').fill('sunshine, playground, October');
    await page.locator('#pname2').fill('Week 4');
    await page.locator('#pasteSave').click();
    const st = await page.evaluate(() => ({
      name: window.__acorn.activeList().name,
      words: window.__acorn.wordsOf(window.__acorn.activeList())
    }));
    expect(st).toEqual({name:'Week 4', words:['sunshine','playground','october']});
  });

  test('a saved list can be deleted, and needs two taps', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => {
      window.__acorn.state.words.lists = [{id:'w1', name:'Week 4', words:['cat','dog']}];
      window.__acorn.save(); window.__acorn.go('parent');
    });
    await page.locator('[data-del="w1"]').click();
    expect(await page.evaluate(() => window.__acorn.state.words.lists.length)).toBe(1);
    await page.locator('[data-del="w1"]').click();
    expect(await page.evaluate(() => window.__acorn.state.words.lists.length)).toBe(0);
    expect(await page.evaluate(() => !!window.__acorn.activeList())).toBe(true);
  });
});

test.describe('the grown-ups area', () => {

  test('press and hold the wordmark; a short tap does not open it', async ({page}) => {
    await open(page, '2026-07-28');
    await page.locator('#wordmark').click();
    expect(await page.evaluate(() => window.__acorn.screen())).toBe('day');

    const box = await page.locator('#wordmark').boundingBox();
    await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
    await page.mouse.down();
    await page.waitForTimeout(900);
    await page.mouse.up();
    expect(await page.evaluate(() => window.__acorn.screen())).toBe('parent');
    await expect(page.locator('#stamp')).toHaveText(/Build/);
  });

  test('the pace is visible to a grown-up', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.go('parent'));
    await expect(page.locator('#screen')).toContainText(/Finding her level|right first time/);
  });

  test('her name saves, persists, and is used in encouragement', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('#pname').fill('Harriet');
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    await page.evaluate(() => window.__acorn.setToday('2026-07-28'));
    expect(await page.evaluate(() => window.__acorn.state.profile.name)).toBe('Harriet');
    await startOn(page, ['rain']);
    await finishSession(page);
    await expect(page.locator('.headline')).toHaveText(/Harriet/);
  });

  test('changing the list changes what she practises', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('[data-list="silent"]').click();
    expect(await page.evaluate(() => window.__acorn.activeList().name)).toBe('Silent letters');
  });

  test('text size and tint apply and stick', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('[data-sc="1.3"]').click();
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--scale').trim())).toBe('1.3');
    await page.locator('[data-tn="mint"]').click();
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-tint'))).toBe('mint');
  });

  test('erase needs two taps and leaves a working app', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => { window.__acorn.recordWord('rain','first'); window.__acorn.go('parent'); });
    await page.locator('#reset').click();
    expect(await page.evaluate(() => Object.keys(window.__acorn.state.words.mastery).length)).toBe(1);
    await page.locator('#reset').click();
    expect(await page.evaluate(() => Object.keys(window.__acorn.state.words.mastery).length)).toBe(0);
    await expect(page.locator('.word')).toBeVisible();
  });
});

test.describe('voices', () => {

  test('novelty and robotic voices are filtered out', async ({page}) => {
    await open(page, '2026-07-28');
    const kept = await page.evaluate(() => {
      speechSynthesis.getVoices = () => [
        {name:'Albert', lang:'en-US', voiceURI:'1'}, {name:'Bad News', lang:'en-US', voiceURI:'2'},
        {name:'Bells', lang:'en-US', voiceURI:'3'}, {name:'Bubbles', lang:'en-US', voiceURI:'4'},
        {name:'Bahh', lang:'en-US', voiceURI:'5'}, {name:'Zarvox', lang:'en-US', voiceURI:'6'},
        {name:'Matilda (Premium)', lang:'en-AU', voiceURI:'7'},
        {name:'Karen', lang:'en-AU', voiceURI:'8'}, {name:'Daniel', lang:'en-GB', voiceURI:'9'}
      ];
      return window.__acorn.englishVoices().map(v => v.name);
    });
    expect(kept).toEqual(['Matilda (Premium)', 'Karen', 'Daniel']);
  });

  test('a downloaded Premium Australian voice is chosen automatically', async ({page}) => {
    await open(page, '2026-07-28');
    const best = await page.evaluate(() => {
      speechSynthesis.getVoices = () => [
        {name:'Albert', lang:'en-US', voiceURI:'1'}, {name:'Daniel', lang:'en-GB', voiceURI:'2'},
        {name:'Karen', lang:'en-AU', voiceURI:'3'}, {name:'Matilda (Premium)', lang:'en-AU', voiceURI:'4'}
      ];
      window.__acorn.state.settings.voice = null;
      return window.__acorn.offerVoices().map(v => v.name);
    });
    expect(best[0]).toBe('Matilda (Premium)');
  });

  test('speaking speed saves', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('[data-rate="0.7"]').click();
    expect(await page.evaluate(() => window.__acorn.state.settings.speechRate)).toBe(0.7);
  });
});

test.describe('robustness', () => {

  test('corrupt stored data does not stop the app loading', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => localStorage.setItem('acorn.v1', '{not json at all'));
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    await expect(page.locator('.word')).toBeVisible();
  });

  test('state from an older shape is merged, not fatal', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => localStorage.setItem('acorn.v1',
      JSON.stringify({reading:{log:[{date:'2026-07-28'}]}, words:{mastery:{rain:{box:3, lastSeen:'2026-07-20'}}}})));
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    await page.evaluate(() => window.__acorn.setToday('2026-07-28'));
    expect(await page.evaluate(() => window.__acorn.mastery('rain').box)).toBe(3);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a pasted word list of junk does not create a broken session', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('#paste').fill('!!! 123 @@ ,,, 4');
    await page.locator('#pasteSave').click();
    await expect(page.locator('#toast')).toHaveText(/No words found/);
    expect(await page.evaluate(() => window.__acorn.state.words.lists.length)).toBe(0);
  });

  test('a very long word does not break the layout', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['antidisestablishmentarianism']);
    await expect(page.locator('.word')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a word list entry with markup is escaped, not injected', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['<img src=x onerror="window.__pwned=1">']);
    await expect(page.locator('.word')).toContainText('<img');
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  });

  test('the day rolling over starts a fresh session', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['rain','boat']);
    await finishSession(page);
    expect(await page.evaluate(() => window.__acorn.session())).toBeNull();
    await page.evaluate(() => window.__acorn.setToday('2026-07-29'));
    await page.evaluate(() => { window.__acorn.start(); });
    expect(await page.evaluate(() => !!window.__acorn.session())).toBe(true);
  });

  test('no page errors across the whole flow', async ({page}) => {
    await open(page, '2026-07-28');
    await correct(page);
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('[data-sc="1.15"]').click();
    await page.locator('[data-list="tricky"]').click();
    await page.locator('[data-go="day"]').click();
    expect(errorsOf(page)).toEqual([]);
  });
});
