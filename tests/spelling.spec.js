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

  test('adding letters is named, not marked with nothing marked', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['together','rain','boat']);
    await page.locator('#cover').click();
    await page.locator('#type').fill('togeather');       // every letter present, plus an a
    await page.locator('#check').click();
    // Every target letter matched, so there is nothing to underline — saying
    // "look at these letters" over an unmarked word would be nonsense.
    await expect(page.locator('.verdict.again')).toHaveText('So close — there’s an extra bit in there.');
    await expect(page.locator('.marked')).toHaveCount(0);
    await expect(page.locator('.word')).toHaveText('together');
    const body = await page.locator('#screen').innerText();
    expect(body).not.toContain('togeather');
  });

  test('whenever it says look at the letters, some are marked', async ({page}) => {
    await open(page, '2026-07-28');
    // Real misspellings a child makes, plus supersets and near-misses.
    const attempts = [['because','becuase'],['because','bcause'],['friend','freind'],
                      ['friend','frend'],['beautiful','beutiful'],['beautiful','butiful'],
                      ['thought','thougt'],['thought','thort'],['said','sed'],['said','siad'],
                      ['they','thay'],['they','dey'],['together','togeather'],
                      ['question','queston'],['island','iland'],['knee','nee'],
                      ['February','Febuary'],['enough','enuf'],['because','becoz']];
    for(const [word, attempt] of attempts){
      await startOn(page, [word, 'rain', 'boat']);
      await page.locator('#cover').click();
      await page.locator('#type').fill(attempt);
      await page.locator('#check').click();
      const verdict = await page.locator('.verdict').innerText();
      const marked = await page.locator('.marked u').count();
      if(/Look at (this letter|these letters)/.test(verdict))
        expect(marked, `${attempt} -> ${word}`).toBeGreaterThan(0);
      if(/this letter\.$/.test(verdict)) expect(marked, `${attempt} -> ${word}`).toBe(1);
      if(/these letters/.test(verdict)) expect(marked, `${attempt} -> ${word}`).toBeGreaterThan(1);
      // Her own spelling is never on the screen, whatever the verdict — except
      // where dropping letters leaves a substring of the real word ("nee" in
      // "knee"), which is the correct word being shown, not her attempt.
      const body = await page.locator('#screen').innerText();
      if(attempt.toLowerCase() !== word.toLowerCase() && !word.toLowerCase().includes(attempt.toLowerCase()))
        expect(body.toLowerCase(), `${attempt} -> ${word}`).not.toContain(attempt.toLowerCase());
    }
    expect(errorsOf(page)).toEqual([]);
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

  test('a last-seen date in the future does not park a word out of reach', async ({page}) => {
    await open(page, '2026-07-28');
    // She changes the phone clock, or the family travels — the stored date is
    // now ahead of today. Left alone the word would never come due again.
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.mastery = {rain:{right:3, wrong:0, box:6, lastSeen:'2026-09-10'}};
      a.save();
      return {gap: a.dayDiff('2026-07-28','2026-09-10'),
              due: a.isDue('rain','2026-07-28'),
              ratio: a.overdueRatio('rain','2026-07-28')};
    });
    expect(out.gap).toBeLessThan(0);
    expect(out.due).toBe(true);
    expect(out.ratio).toBe(1);
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

  test('gu and qu are one sound, not a syllable break', async ({page}) => {
    await open(page, '2026-07-28');
    const got = await page.evaluate(() => {
      const o = {};
      ['guard','guess','guide','language','penguin','tongue','league','plague','banquet',
       'anguish','question','quarter','regular','guitar'].forEach(w => o[w] = window.__acorn.syllables(w).join('·'));
      return o;
    });
    expect(got).toEqual({guard:'guard', guess:'guess', guide:'guide', language:'lan·guage',
      penguin:'pen·guin', tongue:'tongue', league:'league', plague:'plague', banquet:'ban·quet',
      anguish:'an·guish', question:'ques·tion', quarter:'quar·ter', regular:'re·gu·lar',
      guitar:'gui·tar'});
  });

  test('x closes the syllable before it', async ({page}) => {
    await open(page, '2026-07-28');
    const got = await page.evaluate(() => {
      const o = {};
      ['exam','taxi','sixty','oxygen','exercise','next'].forEach(w => o[w] = window.__acorn.syllables(w).join('·'));
      return o;
    });
    expect(got).toEqual({exam:'ex·am', taxi:'tax·i', sixty:'six·ty', oxygen:'ox·y·gen',
                         exercise:'ex·er·cise', next:'next'});
  });

  test('compounds break on the word boundary, not by rule', async ({page}) => {
    await open(page, '2026-07-28');
    const got = await page.evaluate(() => {
      const o = {};
      ['anything','everything','something','somewhere','therefore','without','myself',
       'birthday','playground','football','outside','upstairs','tomorrow','today',
       'grandmother','cannot'].forEach(w => o[w] = window.__acorn.syllables(w).join('·'));
      return o;
    });
    expect(got).toEqual({anything:'any·thing', everything:'every·thing', something:'some·thing',
      somewhere:'some·where', therefore:'there·fore', without:'with·out', myself:'my·self',
      birthday:'birth·day', playground:'play·ground', football:'foot·ball', outside:'out·side',
      upstairs:'up·stairs', tomorrow:'to·mor·row', today:'to·day', grandmother:'grand·mother',
      cannot:'can·not'});
  });

  test('every compound entry rejoins to its word', async ({page}) => {
    await open(page, '2026-07-28');
    const bad = await page.evaluate(() => {
      const out = [];
      for(const w in window.__acorn.COMPOUNDS){
        const parts = window.__acorn.syllables(w);
        if(parts.join('') !== w) out.push(w + ' -> ' + parts.join('·'));
        if(parts.some(p => !/[aeiouy]/.test(p))) out.push(w + ' has a piece with no vowel');
      }
      return out;
    });
    expect(bad).toEqual([]);
  });

  test('a hyphen is a boundary, and the pieces still spell the word', async ({page}) => {
    await open(page, '2026-07-28');
    const got = await page.evaluate(() => {
      const o = {};
      ['well-known','self-esteem','up-to-date',"o'clock","don't"].forEach(w => {
        const p = window.__acorn.syllables(w);
        o[w] = {parts: p.join('·'), rejoins: p.join('') === w};
      });
      return o;
    });
    // Stripping the hyphen used to leave "wel·lknown" under the word "well-known".
    expect(got['well-known']).toEqual({parts:'well-·known', rejoins:true});
    expect(got['up-to-date']).toEqual({parts:'up-·to-·date', rejoins:true});
    for(const w in got) expect(got[w].rejoins, w).toBe(true);
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

  test('strips bullets and stray quotes clinging to a word', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() =>
      window.__acorn.parseWordList("-lead, trail-, 'quoted', well-known, --, ''"));
    expect(out).toEqual(['lead','trail','quoted','well-known']);
  });

  test('every parsed word survives being split', async ({page}) => {
    await open(page, '2026-07-28');
    const bad = await page.evaluate(() => {
      const a = window.__acorn;
      const words = a.parseWordList(`-lead trail- 'quoted' well-known up-to-date o'clock don't
        1. because 2) friend - thought because's mother-in-law`);
      return words.filter(w => a.syllables(w).join('') !== w);
    });
    expect(bad).toEqual([]);
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

test.describe('the header at every text size', () => {

  // Counts real line boxes of the text itself — the button's 44px tap target
  // makes its height a useless proxy for how many lines the label takes.
  const lineBoxes = (page, sel) => page.evaluate(s => {
    const el = document.querySelector(s);
    if(!el) return 0;
    const r = document.createRange(); r.selectNodeContents(el);
    return r.getClientRects().length;
  }, sel);

  for(const scale of [0.9, 1, 1.25, 1.5]){
    test(`no label breaks mid-word at ${scale}x`, async ({page}) => {
      await open(page, '2026-08-01');
      await page.setViewportSize({width:375, height:667});          // iPhone SE, the narrowest
      await page.evaluate(s => {
        window.__acorn.state.settings.textScale = s;
        window.__acorn.save(); window.__acorn.go('parent');
      }, scale);
      // "GROWN-UPS" used to break to "GROWN-" / "UPS", and "← Back" to two lines.
      expect(await lineBoxes(page, '.back')).toBe(1);
      expect(await lineBoxes(page, '.wordmark')).toBe(1);
      const past = await page.evaluate(() => {
        const w = document.documentElement.clientWidth;
        return [...document.querySelectorAll('#bar *')]
          .map(n => Math.round(n.getBoundingClientRect().right - w)).filter(x => x > 1);
      });
      expect(past).toEqual([]);
    });
  }

  test('her own header keeps the wordmark and bar on one line', async ({page}) => {
    await open(page, '2026-08-01');
    await page.setViewportSize({width:375, height:667});
    await page.evaluate(() => {
      window.__acorn.state.settings.textScale = 1.5;
      window.__acorn.save(); window.__acorn.go('day'); window.__acorn.start();
    });
    expect(await lineBoxes(page, '.wordmark')).toBe(1);
    const bar = await page.locator('.daybar').boundingBox();
    const mark = await page.locator('.wordmark').boundingBox();
    expect(bar.y).toBeLessThan(mark.y + mark.height);      // side by side, not stacked
  });
});

test.describe('a long word stays whole', () => {

  // Half a word on each line teaches the wrong shape, so it shrinks instead.
  // The words below run past anything a Year 4/5 list holds.
  const LONG = ['because','beautiful','disappear','grandmother','onomatopoeia',
                'mother-in-law','responsibility','antidisestablishment'];

  for(const scale of [0.9, 1, 1.25, 1.5]){
    test(`no word breaks mid-word at ${scale}x on the narrowest phone`, async ({page}) => {
      await open(page, '2026-08-01');
      await page.setViewportSize({width:375, height:667});
      const broken = [];
      for(const w of LONG){
        await page.evaluate(o => {
          const a = window.__acorn;
          a.state.settings.textScale = o.scale;
          a.state.words.lists = [{id:'w1', name:'T', words:[o.w]}];
          a.state.words.activeId = 'w1'; a.state.words.mastery = {};
          a.save(); a.go('parent'); a.go('day'); a.start();
        }, {scale, w});
        const m = await page.evaluate(() => {
          const el = document.querySelector('.word');
          const rg = document.createRange();
          rg.selectNodeContents(el);
          return {lines: rg.getClientRects().length,
                  px: Math.round(parseFloat(getComputedStyle(el).fontSize)),
                  past: Math.round(el.getBoundingClientRect().right - document.documentElement.clientWidth)};
        });
        if(m.lines > 1) broken.push(`${w} (${w.length} letters) wrapped at ${m.px}px`);
        if(m.past > 1) broken.push(`${w} overflows by ${m.past}px`);
        expect(m.px, w).toBeGreaterThan(11);          // never shrunk to unreadable
      }
      expect(broken).toEqual([]);
    });
  }
});

test.describe('tap targets', () => {

  // Anything tappable must be at least 44px in both directions, at the smallest
  // text size on the narrowest phone — the worst case, not the comfortable one.
  for(const scale of [0.9, 1]){
    test(`nothing tappable is under 44px at ${scale}x`, async ({page}) => {
      await open(page, '2026-08-01');
      await page.setViewportSize({width:375, height:667});
      const small = [];
      for(const where of ['day', 'parent']){
        await page.evaluate(o => {
          const a = window.__acorn;
          a.state.settings.textScale = o.scale;
          a.state.words.lists = [{id:'w1', name:'Week 5', words:['because','friend','thought']}];
          a.state.words.activeId = 'w1';
          a.state.words.mastery = {said:{right:1, wrong:4, box:1, lastSeen:'2026-07-31'}};
          a.save();
          if(o.where === 'parent') a.go('parent');
          else { a.go('day'); a.start(); }
        }, {scale, where});
        small.push(...await page.evaluate(() =>
          [...document.querySelectorAll('#app button, #app input, #app textarea, #app [data-syl], #app [data-hear]')]
            .map(el => ({what: (el.id || el.className) + ' "' + (el.textContent||'').trim().slice(0,12) + '"',
                         r: el.getBoundingClientRect()}))
            .filter(x => x.r.width && x.r.height && (x.r.width < 44 || x.r.height < 44))
            .map(x => `${x.what} is ${Math.round(x.r.width)}x${Math.round(x.r.height)}`)));
      }
      expect(small).toEqual([]);
    });
  }

  test('the tab order runs down the screen, never back up', async ({page}) => {
    await open(page, '2026-08-01');
    for(const where of ['day', 'parent']){
      await page.evaluate(w => {
        const a = window.__acorn;
        a.state.words.mastery = {said:{right:1, wrong:4, box:1, lastSeen:'2026-07-31'}};
        a.save();
        if(w === 'parent') a.go('parent'); else { a.go('day'); a.start(); }
      }, where);
      const jumps = await page.evaluate(() => {
        const tops = [...document.querySelectorAll('#app button, #app input, #app textarea')]
          .map(el => el.getBoundingClientRect())
          .filter(r => r.width && r.height).map(r => Math.round(r.top));
        let n = 0;
        for(let i = 1; i < tops.length; i++) if(tops[i] < tops[i-1] - 4) n++;
        return n;
      });
      expect(jumps, where).toBe(0);
    }
  });
});

test.describe('the words she reads', () => {

  // Every string on her screens, gathered by walking the app rather than by
  // reading the source, so a new one cannot slip past this.
  async function copyOnHerScreens(page){
    const seen = [];
    const grab = async () => { seen.push(await page.locator('#app').innerText()); };
    // A new word opens on the look stage, a known one on the write stage, so
    // uncover only when there is something to uncover.
    const uncover = async () => {
      if(await page.locator('#cover').count()){ await grab(); await page.locator('#cover').click(); }
    };
    await startOn(page, ['because','rain','boat']);
    await uncover();  await grab();                        // look, then write
    await page.locator('#type').fill('becuase');
    await page.locator('#check').click();  await grab();   // nearly
    await page.locator('#next').click();    await uncover();
    await page.locator('#type').fill('zzz');
    await page.locator('#check').click();  await grab();   // nowhere near
    await page.locator('#next').click();
    await finishSession(page);             await grab();   // done
    return seen.join('\n');
  }

  test('never blames her', async ({page}) => {
    await open(page, '2026-07-28');
    const copy = await copyOnHerScreens(page);
    expect(copy).not.toMatch(/wrong|incorrect|failed|fail|error|mistake|bad|oops|sorry|try harder/i);
  });

  test('never talks about her in the third person', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'w1', name:'Empty', words:[]}];
      a.state.words.activeId = 'w1'; a.save();
      a.go('parent'); a.go('day');       // clears the session the app booted with
    });
    const copy = await page.locator('#app').innerText();
    expect(copy).not.toMatch(/\bher\b|\bshe\b/i);
    expect(copy).toMatch(/Ask a grown-up/);
  });

  test('does not promise sound when read-aloud is off', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => {
      window.__acorn.state.settings.readAloud = false; window.__acorn.save();
    });
    await startOn(page, ['because','rain']);
    await page.locator('#cover').click();
    await page.locator('#check').click();                 // empty box
    await expect(page.locator('#toast')).toHaveText('Have a go — type the word.');
    expect(await page.locator('#toast').textContent()).not.toMatch(/hear|listen/i);
  });

  test('her name is used, and nothing breaks without one', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['rain']);
    await finishSession(page);
    // No name set: the greeting must still read as a sentence.
    const bare = await page.locator('.headline').textContent();
    expect(bare).not.toContain('{n}');
    expect(bare).toMatch(/^(Every one, first go|All done)\.$/);
  });
});

test.describe('what a screen reader is told', () => {

  test('the word is spelt out, not read as a word', async ({page}) => {
    await open(page, '2026-08-01');
    await startOn(page, ['because','rain','boat']);
    // Reading "because" aloud conveys nothing about how it is spelt.
    await expect(page.locator('.word')).toHaveAttribute('aria-label', 'b e c a u s e');
    await expect(page.locator('.word')).toHaveAttribute('role', 'img');
    // and the element's own text stays clean — the word appears once
    expect(await page.locator('.word').textContent()).toBe('because');
  });

  test('the marked word is spelt out too', async ({page}) => {
    await open(page, '2026-08-01');
    await startOn(page, ['because','rain','boat']);
    await page.locator('#cover').click();
    await page.locator('#type').fill('becuase');
    await page.locator('#check').click();
    await expect(page.locator('.marked')).toHaveAttribute('aria-label', 'b e c a u s e');
    expect(await page.locator('.marked').textContent()).toBe('because');
  });

  test('the progress bar does not announce over the top of the verdict', async ({page}) => {
    await open(page, '2026-08-01');
    await startOn(page, ['because','rain','boat']);
    // A second live region competes with the one that matters. This is a
    // progress indicator, not a status message.
    await expect(page.locator('.daybar')).toHaveAttribute('role', 'img');
    const live = await page.evaluate(() =>
      [...document.querySelectorAll('#app [aria-live], #app [role=status], #app [role=alert]')]
        .map(n => n.id || n.className));
    expect(live).toEqual([]);                       // the only one lives outside #app
    await expect(page.locator('#say')).toHaveAttribute('role', 'status');
  });

  test('the finished screen is a real heading', async ({page}) => {
    await open(page, '2026-08-01');
    await startOn(page, ['rain','boat']);
    await finishSession(page);
    await expect(page.locator('h2.headline')).toBeVisible();
  });

  test('a one-word list reads as one word, not one words', async ({page}) => {
    await open(page, '2026-08-01');
    await startOn(page, ['rain']);
    await finishSession(page);
    const note = await page.locator('.note').textContent();
    expect(note).toMatch(/of 1 word known well/);
    expect(note).not.toContain('1 words');
  });
});

test.describe('reachable without a touchscreen', () => {

  test('the app has a heading', async ({page}) => {
    await open(page, '2026-07-28');
    await expect(page.locator('h1')).toHaveText('Acorn');
  });

  test('the syllables are buttons, labelled and focusable', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['because']);
    const syls = page.locator('.syl');
    await expect(syls).toHaveCount(2);
    expect(await syls.first().evaluate(n => n.tagName)).toBe('BUTTON');
    await expect(syls.first()).toHaveAttribute('aria-label', 'Hear be');
    await syls.first().focus();
    expect(await page.evaluate(() => document.activeElement.className)).toContain('syl');
  });

  test('the tricky-word chips are buttons too', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.mastery = {said:{right:1, wrong:4, box:2, lastSeen:'2026-07-27'}};
      a.save(); a.go('parent');
    });
    const chip = page.locator('.chip').first();
    expect(await chip.evaluate(n => n.tagName)).toBe('BUTTON');
    await expect(chip).toHaveAttribute('aria-label', 'Hear said');
  });

  test('the verdict is announced, spelt out letter by letter', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['because','rain','boat']);
    await page.locator('#cover').click();
    await page.locator('#type').fill('becuase');
    await page.locator('#check').click();
    const said = await page.locator('#say').textContent();
    expect(said).toContain('So close');
    expect(said).toContain('b e c a u s e');
  });

  test('the word is never announced while she is writing it', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['because']);
    await page.locator('#cover').click();
    const said = await page.locator('#say').textContent();
    expect(said).not.toContain('because');
    expect(said).not.toContain('b e c a u s e');
    expect(said).toMatch(/write it/);
  });

  test('the live region exists before anything renders into it', async ({page}) => {
    await open(page, '2026-07-28');
    const live = await page.locator('#say').evaluate(n => ({
      role: n.getAttribute('role'), live: n.getAttribute('aria-live'),
      inScreen: !!n.closest('#screen')}));
    // Inside #screen it would be destroyed on every render and never announce.
    expect(live).toEqual({role:'status', live:'polite', inScreen:false});
  });

  test('a repeated announcement is still re-read', async ({page}) => {
    await open(page, '2026-07-28');
    const seen = await page.evaluate(() => {
      const a = window.__acorn, n = document.querySelector('#say');
      a.announce('Same thing'); const first = n.textContent;
      a.announce('Same thing'); const second = n.textContent;
      return [first, second];
    });
    expect(seen[0].trim()).toBe('Same thing');
    expect(seen[1]).not.toBe(seen[0]);
  });

  test('tabbing reaches every control on the word screen', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['because']);
    const reachable = new Set();
    for(let i = 0; i < 8; i++){
      await page.keyboard.press('Tab');
      reachable.add(await page.evaluate(() =>
        document.activeElement.id || document.activeElement.className || document.activeElement.tagName));
    }
    expect([...reachable].join(' ')).toMatch(/syl/);
    expect([...reachable].join(' ')).toMatch(/hear/);
    expect([...reachable].join(' ')).toMatch(/cover/);
  });

  test('driven by keyboard, focus is never dropped to the document', async ({page}) => {
    await open(page, '2026-08-01');
    await startOn(page, ['rain','boat']);
    // Keyboard only. A tap deliberately turns this off — a focus ring
    // appearing from nowhere on a touchscreen is only noise — so a test that
    // clicks would be testing the touch path instead.
    const landed = [];
    for(let i = 0; i < 14; i++){
      const stage = await page.evaluate(() =>
        window.__acorn.session() ? window.__acorn.session().stage : 'done');
      if(stage === 'done') break;
      if(stage === 'write'){
        const w = await page.evaluate(() => { const s = window.__acorn.session(); return s.words[s.i]; });
        await page.keyboard.type(w);
        await page.keyboard.press('Enter');
      }else{
        for(let t = 0; t < 8; t++){
          if(/primary/.test(await page.evaluate(() => document.activeElement.className || ''))) break;
          await page.keyboard.press('Tab');
        }
        await page.keyboard.press('Enter');
      }
      landed.push(await page.evaluate(() => document.activeElement.tagName));
    }
    // The finished screen offers only a quiet button; it still takes focus.
    landed.push(await page.evaluate(() => document.activeElement.tagName));
    expect(landed).not.toContain('BODY');
  });

  test('the finished screen says where she is up to', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['rain','boat']);
    await finishSession(page);
    expect(await page.locator('#say').textContent()).toMatch(/words known well/);
    await expect(page.locator('.pbar')).toHaveAttribute('aria-label', /per cent of this list/);
  });
});

test.describe('coming back after a break', () => {

  test('a month away does not turn into a punishing catch-up session', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      const words = [];
      for(let i = 0; i < 40; i++) words.push('word' + i);
      a.state.words.lists = [{id:'big', name:'Big', words:words}];
      a.state.words.activeId = 'big';
      // every word learned, then a month passes with no practice at all
      const m = {};
      words.forEach(w => { m[w] = {right:3, wrong:0, box:3, lastSeen:'2026-06-20'}; });
      a.state.words.mastery = m;
      a.state.words.sessions = [];
      a.save();
      const due = words.filter(w => a.isDue(w, '2026-07-28')).length;
      const s = a.buildSession(a.activeList(), '2026-07-28');
      return {due, session: s.length};
    });
    // Everything is overdue at once; she must still get a normal sitting.
    expect(out.due).toBe(40);
    expect(out.session).toBeGreaterThan(3);
    expect(out.session).toBeLessThanOrEqual(9);
  });

  test('the pace does not introduce new words on a rusty return', async ({page}) => {
    await open(page, '2026-07-28');
    const newWords = await page.evaluate(() => {
      const a = window.__acorn;
      const words = [];
      for(let i = 0; i < 30; i++) words.push('word' + i);
      a.state.words.lists = [{id:'big', name:'Big', words:words}];
      a.state.words.activeId = 'big';
      const m = {};
      words.slice(0, 20).forEach(w => { m[w] = {right:3, wrong:0, box:3, lastSeen:'2026-06-20'}; });
      a.state.words.mastery = m;
      // Her last five sittings went badly. These are the fields the pace
      // controller actually reads — distinct words, and how many she got
      // right first time.
      a.state.words.sessions = [1,2,3,4,5].map(i =>
        ({date:'2026-07-2' + i, asked:10, words:8, right:6, firstTime:4}));
      a.save();
      return {acc: a.recentAccuracy(), newToday: a.newWordsToday(),
              fresh: a.buildSession(a.activeList(), '2026-07-28')
                      .filter(w => !a.state.words.mastery[w]).length};
    });
    // Under 70% right first time, nothing new goes in on top.
    expect(newWords.acc).toBeLessThan(0.7);
    expect(newWords.newToday).toBe(0);
    expect(newWords.fresh).toBe(0);
  });
});

test.describe('robustness', () => {

  test('a device that cannot save keeps working, and says so to a grown-up', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => {
      Storage.prototype.setItem = function(){ throw new Error('QuotaExceededError'); };
    });
    await startOn(page, ['rain','boat']).catch(() => {});
    // She can still practise; nothing crashes.
    await page.locator('#cover').click();
    await page.locator('#type').fill('rain');
    await page.locator('#check').click();
    await expect(page.locator('.verdict')).toBeVisible();
    // And a grown-up is told, on the grown-ups screen only.
    await page.evaluate(() => window.__acorn.go('parent'));
    await expect(page.locator('#nosave')).toContainText(/isn’t saving/);
    expect(errorsOf(page)).toEqual([]);
  });

  test('the save warning is never shown to her', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => {
      Storage.prototype.setItem = function(){ throw new Error('QuotaExceededError'); };
      window.__acorn.save();
    });
    await page.evaluate(() => { window.__acorn.go('day'); window.__acorn.start(); });
    await expect(page.locator('#nosave')).toHaveCount(0);
    expect(await page.locator('#app').innerText()).not.toMatch(/saving|space|private brows/i);
  });

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
