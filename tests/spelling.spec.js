// Acorn — spelling practice. The whole app, as a child and a parent use it.
const {test, expect} = require('@playwright/test');
const {open, errorsOf, write} = require('./helpers');

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
  await page.evaluate(() => { const a = window.__acorn; if(a.session() && a.session().stage === "look") a.cover(); });
  await write(page, w);
  await page.evaluate(() => window.__acorn.check());
  await page.evaluate(() => window.__acorn.next());
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
    await expect(page.locator('.tracew')).toBeVisible();
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

  test('the new pattern list is there, hand-split, and every piece rejoins', async ({page}) => {
    await open(page, '2026-08-01');
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      const l = a.allLists().find(x => x.id === 'orsound');
      if(!l) return null;
      a.state.words.activeId = 'orsound'; a.save();
      const words = a.wordsOf(l);
      return {n: words.length, name: l.name,
              handSplit: words.filter(w => l.words[w]).length,
              broken: words.filter(w => a.splitOf(w).join('') !== w),
              lowerCase: words.every(w => a.splitOf(w).join('·') === a.splitOf(w).join('·').toLowerCase()),
              sample: a.splitOf('thoughtful').join('·')};
    });
    expect(out).not.toBeNull();
    expect(out.n).toBe(14);
    expect(out.handSplit).toBe(14);          // every one looked up, none left to the rules
    expect(out.broken).toEqual([]);
    expect(out.lowerCase).toBe(true);
    expect(out.sample).toBe('thought·ful');
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

  test('trace, then write it from memory — the whole way through', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['friend']);
    // A never-met word is traced now, not passively looked at: it is shown to be
    // copied letter by letter.
    await expect(page.locator('.tracew')).toHaveText('friend');
    await expect(page.locator('.note')).toContainText('Type it to trace it');
    await page.locator('#type').click();
    for(const c of 'friend') await page.keyboard.press(c);
    // The finished trace is the cover: the word is hidden and she writes it blind.
    await expect(page.locator('#type')).toBeVisible();
    await expect(page.locator('.tracew')).toHaveCount(0);      // genuinely hidden
    // A word she just traced writes with no instruction line — she watched herself
    // copy it a second ago (13.4). The spoken cue stays in the aria-live region.
    await expect(page.locator('.note')).toHaveCount(0);
    await write(page, 'friend');
    await page.keyboard.press('Enter');
    // WIN-5: a plain win is the word going green (.word.won), not a "that's it" caption —
    // there is no verdict line on a first-try win any more.
    await expect(page.locator('.word.won')).toHaveText('friend');
    await expect(page.locator('.verdict')).toHaveCount(0);
    expect(await page.evaluate(() => window.__acorn.mastery('friend').box)).toBe(2);
    expect(errorsOf(page)).toEqual([]);
  });

  test('the spelling box never autocorrects her', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['friend']);
    await page.evaluate(() => window.__acorn.cover());
    const attrs = await page.locator('#type').evaluate(n => ({
      correct: n.getAttribute('autocorrect'), cap: n.getAttribute('autocapitalize'),
      spell: n.getAttribute('spellcheck'), complete: n.getAttribute('autocomplete')
    }));
    expect(attrs).toEqual({correct:'off', cap:'off', spell:'false', complete:'off'});
  });

  test('a one-syllable word is not given a syllable row repeating itself', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['said']);
    await expect(page.locator('.tracew')).toHaveText('said');
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
    await expect(page.locator('.note')).toHaveCount(0);         // WIN-4: no instruction line
  });

  test('pressing Enter checks it', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['rain']);
    await page.evaluate(() => window.__acorn.cover());
    await write(page, 'rain');
    await page.locator('#type').press('Enter');
    await expect(page.locator('.word.won')).toBeVisible();   // WIN-5: the win is the green word
  });
});

test.describe('getting it wrong', () => {

  test('shows only the correct spelling — never her own', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['because','rain','boat']);
    await page.evaluate(() => window.__acorn.cover());
    await write(page, 'becuase');
    await page.evaluate(() => window.__acorn.check());
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
    await page.evaluate(() => window.__acorn.cover());
    await write(page, 'togthr');        // drops the e and an e, so two unmatched
    await page.evaluate(() => window.__acorn.check());
    await expect(page.locator('.verdict.again')).toHaveText(/Look at these letters/);
    expect(await page.locator('.marked u').count()).toBeGreaterThan(1);
  });

  test('adding letters is pointed at, not just named', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['together','rain','boat']);
    await page.evaluate(() => window.__acorn.cover());
    await write(page, 'togeather');       // every letter present, plus an a
    await page.evaluate(() => window.__acorn.check());
    /* This used to require the opposite — no marking at all — on the reasoning that every
       target letter matched, so there was nothing to underline, and "look at these letters"
       over an unmarked word would be nonsense. The second half of that is right and the
       first half was too quick: the surplus is in her answer, which is never shown, but the
       place it went is a position in the word, and the word is right there. So the letter
       her extra one was added after is marked, and the sentence points at it rather than
       waving at the whole word. Tested against the slips a dyslexic nine-year-old actually
       makes, this was the one verdict of six that pointed at nothing, and two of the three
       ways to reach it are doubled letters. */
    await expect(page.locator('.verdict.again'))
      .toHaveText('So close — there’s an extra bit here.');
    await expect(page.locator('.marked')).toHaveCount(1);
    await expect(page.locator('.marked')).toHaveText('together');
    await expect(page.locator('.marked u')).toHaveText('e');   // the a went in after it
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
      await page.evaluate(() => window.__acorn.cover());
      await write(page, attempt);
      await page.evaluate(() => window.__acorn.check());
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
    await page.evaluate(() => window.__acorn.cover());
    await page.evaluate(() => window.__acorn.check());
    // still on the same word, nothing recorded against it
    await expect(page.locator('#type')).toBeVisible();
    await expect(page.locator('.verdict')).toHaveCount(0);
    expect(await page.evaluate(() => window.__acorn.mastery('because')))
      .toMatchObject({right:0, wrong:0, box:1});
    // and blank-tapping through cannot walk the session at all
    for(let i = 0; i < 10; i++) await page.evaluate(() => window.__acorn.check());
    expect(await page.evaluate(() => window.__acorn.session().i)).toBe(0);
    expect(errorsOf(page)).toEqual([]);
  });

  test('spaces alone are not an attempt either', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['rain']);
    await page.evaluate(() => window.__acorn.cover());
    await write(page, '   ');
    await page.evaluate(() => window.__acorn.check());
    await expect(page.locator('.verdict')).toHaveCount(0);
    expect(await page.evaluate(() => window.__acorn.mastery('rain').wrong)).toBe(0);
  });

  test('a wild guess shows the word plainly rather than marking it all wrong', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['because','rain','boat']);
    await page.evaluate(() => window.__acorn.cover());
    await write(page, 'zzqq');
    await page.evaluate(() => window.__acorn.check());
    await expect(page.locator('.verdict.again')).toHaveText(/Here it is/);
    await expect(page.locator('.marked')).toHaveCount(0);
    await expect(page.locator('.word')).toHaveText('because');
  });

  test('the word comes back later in the same session, from memory', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['because','rain','boat']);
    await page.evaluate(() => window.__acorn.cover());
    await write(page, 'becuase');
    await page.evaluate(() => window.__acorn.check());
    await page.evaluate(() => window.__acorn.next());
    await correct(page);
    await correct(page);
    // requeued — and this time with no look step
    expect(await page.evaluate(() => window.__acorn.session().words[window.__acorn.session().i])).toBe('because');
    await expect(page.locator('#cover')).toHaveCount(0);
    await expect(page.locator('#type')).toBeVisible();
    await write(page, 'because');
    await page.evaluate(() => window.__acorn.check());
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
    const filled = () => page.locator('.dots i.on').count();
    const before = await filled();
    // miss the first word: it comes back later, so W.words grows
    await page.evaluate(() => window.__acorn.cover());
    await write(page, 'zzzz');
    await page.evaluate(() => window.__acorn.check());
    await page.evaluate(() => window.__acorn.next());
    expect(await page.locator('.dots i').count()).toBe(dots);   // row did not grow
    expect(await filled()).toBeGreaterThanOrEqual(before);      // and did not empty
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
      await page.evaluate(() => { const a = window.__acorn; if(a.session() && a.session().stage === "look") a.cover(); });
      await write(page, w);
      await page.evaluate(() => window.__acorn.check());
      const filled = await page.locator('.dots i.on').count();
      const all = await page.locator('.dots i').count();
      expect(filled).toBeLessThanOrEqual(all);

      await page.evaluate(() => window.__acorn.next());
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
    // Her words rather than a tick: the picture is what says the sitting happened,
    // and the praise is the quiet line under it.
    await expect(page.locator('#screen .net')).toBeVisible();
    await expect(page.locator('#screen')).toContainText(/first go|All done/);
    // The headline is what tonight did; the praise is the quiet line beneath her words.
    await expect(page.locator('#screen')).toContainText(/first go|All done/);
    const s = await page.evaluate(() => window.__acorn.state.words.sessions);
    expect(s.length).toBe(1);
    expect(s[0]).toMatchObject({words:3, firstTime:3});
    expect(errorsOf(page)).toEqual([]);
  });

  test('the done screen shows how much of the list she knows', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['rain','boat']);
    await finishSession(page);
    /* The totals are a grown-up's business and live on the grown-ups screen. Hers says
       what tonight did and shows her the words.
       They are not announced either, since 11.9: "Every one, first go. 0 of 100 words known
       well" is the sentence that reasoning produced, and reserving the totals for a grown-up
       has to mean the same thing by ear as it does by eye. The numbers are still reachable —
       the picture's own label carries them — so this checks they are on the picture rather
       than pushed at her. */
    await expect(page.locator('#screen .net')).toBeVisible();
    expect(await page.locator('#screen').innerText()).not.toMatch(/known well/);
    expect(await page.locator('#say').textContent()).not.toMatch(/known well/);
    expect(await page.locator('#screen .net').getAttribute('aria-label'))
      .toMatch(/\d+ known well/);
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
    await page.evaluate(() => window.__acorn.cover());
    await write(page, 'rain');
    await page.evaluate(() => window.__acorn.check());
    await page.evaluate(() => window.__acorn.go('parent'));
    expect(await page.evaluate(() => window.__acorn.mastery('rain').box)).toBe(2);
    /* The sitting used to be thrown away here, and this line asserted that. It kept
       the progress either way — the box above is the progress — but discarding the
       sitting also discarded which words she had been shown, so coming back showed
       her a word she had covered up and was writing from memory. It is kept now and
       validated on the way back; see tests/handback.spec.js. */
    const held = await page.evaluate(() => window.__acorn.session());
    expect(held, 'the sitting she was in was thrown away').not.toBeNull();
    expect(held.shown).toContain('rain');
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
    // Lower case: the word above the chips comes from the key, which is lower
    // case, and a capital in the split made the first chip disagree with it.
    expect(out.feb).toBe('feb·ru·ary');
    expect(out.sep).toBe('sep·a·rate');
  });

  // A chunk she cannot say is worse than no chunk at all. Cutting a
  // three-consonant cluster after the first of them was leaving onsets English
  // does not have: for·tnight, par·tner, frien·dly.
  test('no chunk opens with a cluster nobody can say', async ({page}) => {
    await open(page, '2026-07-28');
    const bad = await page.evaluate(() => {
      // Everything English will actually start a syllable with.
      const OK = ['bl','br','cl','cr','dr','fl','fr','gl','gr','pl','pr','tr','tw','thr','shr',
                  'ch','sh','th','ph','wh','gu','qu','sc','sk','sl','sm','sn','sp','st','sw',
                  'dw','kn','wr','gn','str','spr','scr','spl','squ','chr','phr','rh'];
      // A realistic school corpus: the pattern families, plus the words whose
      // clusters are the awkward ones.
      const ws = `fortnight partner friendly understand instead thirsty sandwich handstand
        children monster hungry answer whistle castle bottle little middle gentle simple
        purple angry England complete surprise strange strength scratch splendid squirrel
        subject absent chimney orphan athlete anthem hardly kindly softly weekly monthly
        firstly costly ghostly wildly boldly friendship partnership craftsman postman
        witness fitness sadness darkness kindness lastly mostly justly exactly`
        .split(/\s+/).filter(Boolean);
      const out = [];
      ws.forEach(w => {
        const parts = window.__acorn.syllables(w);
        parts.forEach((piece, n) => {
          if(n === 0) return;
          const onset = (piece.match(/^[^aeiouy]+/) || [''])[0];
          if(onset.length < 2 || OK.indexOf(onset) >= 0) return;
          // The consonant-le syllable is real and is how it is taught.
          if(/^[^aeiouy]+le$/.test(piece)) return;
          out.push(w + ' → ' + parts.join('·') + ' ("' + onset + '" opens a chunk)');
        });
      });
      return out;
    });
    expect(bad).toEqual([]);
  });

  // The real corpus above only covers the clusters English happens to use. A
  // pasted list can contain anything, so put every consonant triple through it.
  test('no consonant cluster anywhere leaves an unsayable chunk', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => {
      const OK = ['bl','br','cl','cr','dr','fl','fr','gl','gr','pl','pr','tr','tw','thr','shr',
                  'ch','sh','th','ph','wh','gu','qu','sc','sk','sl','sm','sn','sp','st','sw',
                  'dw','kn','wr','gn','str','spr','scr','spl','squ','chr','phr','rh'];
      const C = 'bcdfghjklmnpqrstvwxyz'.split(''), words = [];
      C.forEach(a => C.forEach(b => C.forEach(c => words.push('ba' + a + b + c + 'en'))));
      const bad = {rejoin: [], vowelless: [], unsayable: []};
      words.forEach(w => {
        const parts = window.__acorn.syllables(w);
        if(parts.join('') !== w) bad.rejoin.push(w);
        if(parts.some(x => !/[aeiouy]/.test(x))) bad.vowelless.push(w + ' → ' + parts.join('·'));
        parts.forEach((piece, n) => {
          if(!n) return;
          const on = (piece.match(/^[^aeiouy]+/) || [''])[0];
          if(on.length < 2 || OK.indexOf(on) >= 0 || /^[^aeiouy]+le$/.test(piece)) return;
          bad.unsayable.push(w + ' → ' + parts.join('·') + ' ("' + on + '")');
        });
      });
      return {n: words.length, rejoin: bad.rejoin.slice(0, 5), vowelless: bad.vowelless.slice(0, 5),
              unsayable: bad.unsayable.slice(0, 5), counts:
                [bad.rejoin.length, bad.vowelless.length, bad.unsayable.length]};
    });
    expect(out.n).toBeGreaterThan(9000);
    expect(out.unsayable).toEqual([]);        // was 7320 of these before the fix
    expect(out.rejoin).toEqual([]);
    expect(out.vowelless).toEqual([]);
    expect(out.counts).toEqual([0, 0, 0]);
  });

  test('the awkward clusters land where a person would say them', async ({page}) => {
    await open(page, '2026-07-28');
    const got = await page.evaluate(() => {
      const o = {};
      ['fortnight','partner','friendly','children','monster','bottle','castle','whistle',
       'neighbour','language','table','athlete','mother'].forEach(w => o[w] = window.__acorn.syllables(w).join('·'));
      return o;
    });
    expect(got).toEqual({
      fortnight:'fort·night', partner:'part·ner', friendly:'friend·ly',
      // Moving those cuts must not disturb the ones that were already right.
      children:'chil·dren', monster:'mon·ster', bottle:'bot·tle', castle:'cas·tle',
      whistle:'whis·tle', neighbour:'neigh·bour', language:'lan·guage',
      table:'ta·ble', athlete:'ath·lete', mother:'moth·er'});
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
    await expect(page.locator('#screen')).toContainText(/Harriet/);
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
    await expect(page.locator('.tracew')).toBeVisible();
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

test.describe('how her screens use the room they have', () => {

  const STAGES = ['look','write','nearly','done'];

  async function put(page, scale, stage){
    await page.evaluate(o => {
      const a = window.__acorn;
      a.state.settings.textScale = o.scale;
      a.state.words.lists = [{id:'w1', name:'T', words:['said','because','rain']}];
      a.state.words.activeId = 'w1'; a.state.words.mastery = {}; a.state.words.sessions = [];
      a.save(); a.go('parent'); a.go('day');
      if(o.stage === 'write') a.cover();
      if(o.stage === 'nearly'){ a.cover(); a.type('sed'); a.check(); }
      if(o.stage === 'done'){
        a.state.words.lists = [{id:'w2', name:'E', words:['rain']}];
        a.state.words.activeId = 'w2';
        a.state.words.mastery = {rain:{right:4, wrong:0, box:4, lastSeen:'2026-08-01'}};
        a.state.words.sessions = [{date:'2026-08-01', list:'w2', asked:1, words:1, right:1, firstTime:1}];
        a.save(); a.go('parent'); a.go('day');
      }
    }, {scale, stage});
  }

  const room = page => page.evaluate(() => {
    const main = document.querySelector('main'), mr = main.getBoundingClientRect();
    const kids = [...main.children].filter(n => n.getBoundingClientRect().height);
    const first = kids[0].getBoundingClientRect(), last = kids[kids.length-1].getBoundingClientRect();
    return {overflows: main.scrollHeight > main.clientHeight + 2,
            above: Math.round(first.top - mr.top),
            below: Math.round(mr.bottom - last.bottom),
            firstCut: first.top < mr.top - 1};
  });

  test('the word sits in the middle of the room, not clinging to the top', async ({page}) => {
    await open(page, '2026-08-01');
    await page.setViewportSize({width:393, height:750});     // a tall phone
    // Her finished screen is deliberately not centred — it is three fixed rows, so
    // that nothing moves as her map fills up. It gets its own check below.
    for(const stage of STAGES.filter(x => x !== 'done')){
      await put(page, 1, stage);
      const m = await room(page);
      expect(m.overflows, stage).toBe(false);
      // Three quarters of the panel used to be empty below the word.
      expect(Math.abs(m.above - m.below), `${stage}: ${m.above} above, ${m.below} below`)
        .toBeLessThanOrEqual(12);
    }
  });

  /* And the finished screen uses the room instead of ending two thirds up the phone.
     It did exactly that on hers: the keyboard's space stayed reserved on a screen with
     no keyboard, so her picture was squeezed into the middle of a short app and the way
     on was stranded above an inch of nothing. */
  test('the finished screen uses the whole phone', async ({page}) => {
    await open(page, '2026-08-01');
    await page.setViewportSize({width:393, height:750});
    // A sitting behind her, so the keyboard's height has been measured and stored.
    await page.evaluate(() => {
      window.__acorn.state.settings.kbInset = 336; window.__acorn.save();
    });
    await put(page, 1, 'done');
    const m = await page.evaluate(() => {
      const app = document.querySelector('#app').getBoundingClientRect();
      const act = document.querySelector('#act').getBoundingClientRect();
      const net = document.querySelector('#screen .net');
      return {app: Math.round(app.height), inner: window.innerHeight,
              actBottom: Math.round(app.bottom - act.bottom),
              pic: net ? Math.round(net.getBoundingClientRect().height) : 0};
    });
    expect(m.app, 'the app stopped short of the screen').toBeGreaterThan(m.inner - 40);
    expect(m.actBottom, 'the way on is not at the bottom').toBeLessThan(30);
    // And the picture is worth looking at rather than a thumbnail.
    expect(m.pic, 'her picture is ' + m.pic + 'px tall').toBeGreaterThan(220);
  });

  test('centring never hides the first line when there is too much', async ({page}) => {
    await open(page, '2026-08-01');
    await page.setViewportSize({width:375, height:667});
    // justify-content:center would push the top of an overflowing column out of
    // reach; auto margins collapse to nothing instead.
    for(const scale of [1.25, 1.5]){
      for(const stage of ['look','nearly']){
        await put(page, scale, stage);
        const m = await room(page);
        expect(m.firstCut, `${stage} at ${scale}x`).toBe(false);
        if(m.overflows) expect(m.above, `${stage} at ${scale}x`).toBeLessThanOrEqual(2);
      }
    }
  });

  test('the grown-ups screen is left as a normal page', async ({page}) => {
    await open(page, '2026-08-01');
    await page.setViewportSize({width:393, height:750});
    await page.evaluate(() => window.__acorn.go('parent'));
    const m = await page.evaluate(() => {
      const main = document.querySelector('main');
      const first = main.children[0].getBoundingClientRect();
      return {above: Math.round(first.top - main.getBoundingClientRect().top),
              scrolls: main.scrollHeight > main.clientHeight + 2};
    });
    expect(m.scrolls).toBe(true);
    expect(m.above).toBeLessThanOrEqual(2);      // starts at the top, like a page
  });
});

test.describe('the progress dots', () => {

  test('the current dot is not clipped by the scrolling panel', async ({page}) => {
    await open(page, '2026-08-01');
    await startOn(page, ['because','friend','thought']);
    const m = await page.evaluate(() => {
      const main = document.querySelector('main');
      const now = document.querySelector('.dots i.now');
      const r = now.getBoundingClientRect(), mr = main.getBoundingClientRect();
      return {shavedTop: Math.round(mr.top - r.top), shavedBottom: Math.round(r.bottom - mr.bottom),
              scaled: getComputedStyle(now).transform !== 'none'};
    });
    // It is scaled up to mark where she is, and main clips its overflow.
    expect(m.scaled).toBe(true);
    expect(m.shavedTop, 'the top of the current dot is cut off').toBeLessThanOrEqual(0);
    expect(m.shavedBottom).toBeLessThanOrEqual(0);
  });

  test('nor at any text size', async ({page}) => {
    await open(page, '2026-08-01');
    await page.setViewportSize({width:375, height:667});
    for(const scale of [0.9, 1, 1.25, 1.5]){
      await page.evaluate(s => {
        const a = window.__acorn;
        a.state.settings.textScale = s;
        a.state.words.lists = [{id:'w1', name:'T', words:['because','friend','thought']}];
        a.state.words.activeId = 'w1'; a.state.words.mastery = {};
        a.save(); a.go('parent'); a.go('day');
      }, scale);
      const shaved = await page.evaluate(() => {
        const mr = document.querySelector('main').getBoundingClientRect();
        const r = document.querySelector('.dots i.now').getBoundingClientRect();
        return Math.round(mr.top - r.top);
      });
      expect(shaved, `at ${scale}x`).toBeLessThanOrEqual(0);
    }
  });

  // The row used to be circles. Each dot is now the outline that word carries on
  // the map on the grown-ups screen, so the row is a handful of the things she is
  // collecting rather than a progress bar in pieces.
  test('each dot is the outline of the word it stands for', async ({page}) => {
    await open(page, '2026-08-01');
    await startOn(page, ['because','friend','thought']);
    const m = await page.evaluate(() => {
      const a = window.__acorn, words = a.session().words;
      return [...document.querySelectorAll('.dots i')].map((i, k) => {
        const s = a.dotShape(words[k]);
        return {word: words[k], d: i.querySelector('path').getAttribute('d'),
                want: a.cellPath(words[k], s.x, s.y, s.r)};
      });
    });
    expect(m.length).toBe(3);
    // Dot k is the word at k, out of the same function the map draws with.
    m.forEach(d => expect(d.d, d.word).toBe(d.want));
    expect(new Set(m.map(d => d.d)).size, 'each word its own outline').toBe(m.length);
    expect(await page.locator('.dots circle').count()).toBe(0);
    m.forEach(d => expect(d.d, 'nothing in it is a straight edge').toMatch(/^M[-\d. ]+Q/));
    // Decoration: the real progress is announced elsewhere.
    expect(await page.locator('.dots').getAttribute('aria-hidden')).toBe('true');
  });

  test('the dot for a word is the shape that word has on her map', async ({page}) => {
    await open(page, '2026-08-01');
    await startOn(page, ['because','friend','thought']);
    const dot = await page.evaluate(() => ({
      word: window.__acorn.session().words[0],
      d: document.querySelector('.dots i path').getAttribute('d')}));
    await page.evaluate(() => window.__acorn.go('parent'));
    const cell = await page.evaluate(w => {
      const c = [...document.querySelectorAll('.net-cell')]
        .find(c => c.querySelector('title').textContent === w);
      return c && c.getAttribute('d');
    }, dot.word);
    expect(cell).toBeTruthy();
    // The same outline at a different size and place: normalise both to their own
    // width and they land on each other.
    const norm = d => {
      const n = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
      const xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2 === 1);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const s = Math.max(...xs) - Math.min(...xs);
      return n.map((v, i) => (i % 2 ? v - cy : v - cx) / s);
    };
    const a = norm(dot.d), b = norm(cell);
    expect(a.length).toBe(b.length);
    a.forEach((v, i) => expect(Math.abs(v - b[i]), dot.word + ' point ' + i).toBeLessThan(0.02));
  });

  test('the dots vary a little in size and spacing, the same way every time', async ({page}) => {
    await open(page, '2026-08-01');
    // Nine words of every length the app can serve, all due, so the row is as
    // long and as varied as it will ever be.
    await page.evaluate(() => {
      const a = window.__acorn;
      const words = ['go','said','light','friend','thought','together','beautiful',
                     'government','jewellery'], m = {};
      words.forEach(w => m[w] = {right:3, wrong:0, box:3, lastSeen:'2026-07-20'});
      a.state.words.lists = [{id:'w1', name:'T', words}];
      a.state.words.activeId = 'w1'; a.state.words.mastery = m;
      a.state.words.sessions = [1, 2, 3, 4, 5].map(i =>
        ({date:'2026-07-2' + i, list:'w1', words:8, firstTime:8}));
      a.save(); a.start();
    });
    const read = () => page.evaluate(() => [...document.querySelectorAll('.dots i')].map(i => ({
      r: Number(i.dataset.r), x: Number(i.dataset.x),
      // offsetWidth, so the scaled current dot is measured as it is laid out: the
      // box is the same for every dot and only what is drawn inside it differs.
      box: i.offsetWidth,
      paint: Math.round(i.querySelector('path').getBBox().width * 100) / 100})));
    const first = await read();
    expect(first.length).toBe(9);
    const rs = first.map(d => d.r);
    // Subtle: texture, not a ranking of her words by length.
    expect(Math.max(...rs) / Math.min(...rs), 'the sizes shout').toBeLessThan(1.25);
    expect(new Set(rs).size, 'they are not all the same size either').toBeGreaterThan(2);
    // Drawn, the band is a little wider than that: an outline that wanders is
    // wider than one that does not, whatever radius it was given.
    expect(Math.max(...first.map(d => d.paint)) / Math.min(...first.map(d => d.paint)))
      .toBeLessThan(1.35);
    // Spacing: every dot sits a little off centre in its box, and no two the same.
    const xs = first.map(d => d.x);
    expect(new Set(xs).size).toBe(xs.length);
    xs.forEach(x => expect(Math.abs(x - 10)).toBeLessThan(2.6));
    // The boxes are identical, which is what stops the row reflowing.
    expect(new Set(first.map(d => d.box)).size).toBe(1);
    // And it is the same row on the next render, and after a reload.
    await page.evaluate(() => window.__acorn.cover());
    expect(await read()).toEqual(first);
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    await page.evaluate(() => window.__acorn.setToday('2026-08-01'));
    expect(await read()).toEqual(first);
  });

  test('the row keeps its width through the stages of a word', async ({page}) => {
    await open(page, '2026-08-01');
    await startOn(page, ['because','friend','thought']);
    const width = () => page.evaluate(() => {
      const is = [...document.querySelectorAll('.dots i')], last = is[is.length - 1];
      return {row: Math.round(document.querySelector('.dots').getBoundingClientRect().width),
              // Laid-out positions, so the scaled current dot moving along the row
              // cannot flatter the measurement.
              span: last.offsetLeft + last.offsetWidth - is[0].offsetLeft,
              left: is[0].offsetLeft};
    });
    const look = await width();
    await page.evaluate(() => window.__acorn.cover());
    expect(await width(), 'covering the word moved the row').toEqual(look);
    await write(page, 'because');
    await page.evaluate(() => window.__acorn.check());
    expect(await width(), 'checking it moved the row').toEqual(look);
    await page.evaluate(() => window.__acorn.next());
    expect(await width(), 'the next word moved the row').toEqual(look);
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
    // One line, and the mark is the whole of it: the thin progress bar that used to
    // sit beside it is gone, because the row of shapes above her word says the same
    // thing where she is actually looking.
    const mark = await page.locator('.wordmark').boundingBox();
    const bar = await page.locator('.bar').boundingBox();
    expect(mark.height).toBeLessThanOrEqual(bar.height);
    expect(await page.locator('.bar .daybar').count()).toBe(0);
  });
});

test.describe('the mark on her screens', () => {

  const SCALES = [0.9, 1, 1.15, 1.3, 1.5];

  async function herScreen(page, scale){
    await page.evaluate(s => {
      const a = window.__acorn;
      a.state.settings.textScale = s;
      a.state.words.lists = [{id:'w1', name:'T', words:['because','friend','thought']}];
      a.state.words.activeId = 'w1'; a.state.words.mastery = {}; a.state.words.sessions = [];
      a.save(); a.go('parent'); a.go('day'); a.start();
    }, scale);
  }

  test('it is a drawn mark on her screens and a text crumb on the grown-ups one',
    async ({page}) => {
      await open(page, '2026-08-01');
      await herScreen(page, 1);
      const hers = await page.evaluate(() => {
        const h = document.querySelector('#wordmark');
        const svg = h.querySelector('svg');
        return {first: document.querySelector('#bar').firstElementChild.id,
                heading: h.tagName, paths: h.querySelectorAll('path').length,
                text: h.textContent.trim(),
                label: h.getAttribute('aria-label'),
                svgLabel: svg && svg.getAttribute('aria-label'),
                svgHidden: svg && svg.getAttribute('aria-hidden'),
                fill: getComputedStyle(h.querySelector('path')).fill};
      });
      // It still announces as "Acorn", and it is still the first thing on her
      // screen — nothing has been put in front of it.
      expect(hers.first).toBe('wordmark');
      expect(hers.heading).toBe('H1');
      expect(hers.paths).toBe(1);
      expect(hers.text).toBe('');
      expect(hers.label).toBe('Acorn');
      // Named once: the label used to be on the <svg role="img">, which the
      // heading then borrowed as its own name, so a screen reader read "Acorn,
      // heading" and then "Acorn, image" on every screen she saw.
      expect(hers.svgLabel).toBeNull();
      expect(hers.svgHidden).toBe('true');
      expect(hers.fill).toBe('rgb(53, 112, 90)');           // --acc, unchanged
      // The grown-ups screen keeps its crumb as words: it is a place, not a badge.
      await page.evaluate(() => window.__acorn.go('parent'));
      const theirs = await page.evaluate(() => {
        const n = document.querySelector('.wordmark');
        return {text: n.textContent.trim(), svgs: document.querySelectorAll('#bar svg').length};
      });
      expect(theirs.text).toBe('Grown-ups');
      expect(theirs.svgs).toBe(0);
    });

  /* The header must not shift when the letters become a mark, so the mark is
     measured against the box the letters actually occupied: a clone of the
     heading with "Acorn" back in it, laid out with the same styles and measured
     out of flow so the header itself is not disturbed. */
  for(const scale of SCALES){
    test(`it holds the box the letters had at ${scale}x`, async ({page}) => {
      await open(page, '2026-08-01');
      await page.setViewportSize({width:375, height:667});
      await herScreen(page, scale);
      const m = await page.evaluate(() => {
        const h = document.querySelector('#wordmark');
        const probe = h.cloneNode(false);
        probe.textContent = 'Acorn';
        probe.style.position = 'absolute';
        probe.style.visibility = 'hidden';
        h.parentNode.appendChild(probe);
        const t = probe.getBoundingClientRect();
        probe.remove();
        const r = h.getBoundingClientRect();
        return {mark:[+r.width.toFixed(2), +r.height.toFixed(2)],
                text:[+t.width.toFixed(2), +t.height.toFixed(2)]};
      });
      expect(m.mark[1], 'the same height').toBe(m.text[1]);
      expect(m.mark[0], 'no wider').toBeLessThanOrEqual(m.text[0]);
      expect(m.mark[0], 'square').toBe(m.mark[1]);
    });
  }

  test('the whole header is where it was, at every text size', async ({page}) => {
    await open(page, '2026-08-01');
    await page.setViewportSize({width:375, height:667});
    const seen = [];
    for(const scale of SCALES){
      await herScreen(page, scale);
      seen.push(await page.evaluate(() => {
        const r = s => { const q = document.querySelector(s).getBoundingClientRect();
                         return [Math.round(q.x), Math.round(q.y), Math.round(q.width),
                                 Math.round(q.height)].join(','); };
        return {bar:r('.bar'), mark:r('.wordmark'), dots:r('.dots'), main:r('main')};
      }));
    }
    // The header's own box is decided by the text size and by nothing the mark does:
    // a taller mark would push her word down the screen.
    expect(seen.map(s => s.bar)).toEqual(['15,17,344,46', '17,17,341,51', '20,17,336,59',
                                          '22,17,331,66', '26,17,324,77']);
    // And the mark sits at the top left of it at every size, square.
    seen.forEach(function(x, i){
      const m = x.mark.split(',').map(Number);
      expect(m[0], 'mark x at ' + SCALES[i] + 'x').toBe(Number(x.bar.split(',')[0]));
      expect(m[2], 'mark is square at ' + SCALES[i] + 'x').toBe(m[3]);
    });
  });

  test('the same shape every render and every reload', async ({page}) => {
    await open(page, '2026-08-01');
    const shape = () => page.evaluate(() => {
      const s = document.querySelector('#wordmark svg');
      return s.getAttribute('viewBox') + ' ' + s.querySelector('path').getAttribute('d');
    });
    await herScreen(page, 1);
    const first = await shape();
    expect(first).toMatch(/^[-\d. ]+ M[-\d.QZ ]+$/);        // a real path, not empty
    await page.evaluate(() => window.__acorn.cover());                    // a later stage, redrawn
    expect(await shape()).toBe(first);
    await page.evaluate(() => { window.__acorn.state.settings.textScale = 1.5;
                                window.__acorn.save(); window.__acorn.go('day'); });
    expect(await shape(), 'a different text size is the same shape').toBe(first);
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    await page.evaluate(() => window.__acorn.setToday('2026-08-01'));
    expect(await shape(), 'a reload is the same shape').toBe(first);
  });

  // The way in to the grown-ups screen is a press and hold on the mark, and the
  // mark is the size of a line of small caps. The hit area is bigger than the
  // drawing, at the smallest text size on the narrowest phone.
  test('it is a 44px target at 0.9x, and press-and-hold still opens the way in',
    async ({page}) => {
      await open(page, '2026-08-01');
      await page.setViewportSize({width:375, height:667});
      await herScreen(page, 0.9);
      const hit = await page.evaluate(() => {
        const h = document.querySelector('#wordmark');
        const r = h.getBoundingClientRect();
        const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
        const at = (dx, dy) => {
          const n = document.elementFromPoint(cx + dx, cy + dy);
          return !!(n && n.closest && n.closest('.wordmark'));
        };
        // The corners of a 44x44 box centred on the mark, a hair inside it.
        return {drawn:[Math.round(r.width), Math.round(r.height)],
                corners:[at(-21, -21), at(21, -21), at(-21, 21), at(21, 21)]};
      });
      expect(hit.drawn[0]).toBeLessThan(44);                 // the drawing really is small
      expect(hit.corners).toEqual([true, true, true, true]);

      // And a hold in the top-left of that target — outside the drawing — opens it.
      const r = await page.locator('#wordmark').boundingBox();
      await page.mouse.move(r.x + r.width / 2 - 20, r.y + r.height / 2 - 20);
      await page.mouse.down();
      await page.waitForTimeout(900);
      await page.mouse.up();
      expect(await page.evaluate(() => window.__acorn.screen())).toBe('parent');
    });

  test('nothing about it moves', async ({page}) => {
    await open(page, '2026-08-01');
    await herScreen(page, 1);
    const still = await page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector('#wordmark svg'));
      const h = getComputedStyle(document.querySelector('#wordmark'));
      return [cs.transitionDuration, cs.animationName, h.transitionDuration, h.animationName];
    });
    expect(still).toEqual(['0s', 'none', '0s', 'none']);
  });
});

test.describe('she never has to scroll to answer', () => {

  const STAGES = ['look','write','nearly','wild','right','done'];

  async function put(page, scale, stage){
    await page.evaluate(o => {
      const a = window.__acorn;
      a.state.settings.textScale = o.scale;
      a.state.words.lists = [{id:'w1', name:'T', words:['because','friend','thought','beautiful']}];
      a.state.words.activeId = 'w1'; a.state.words.mastery = {}; a.state.words.sessions = [];
      a.save(); a.go('parent'); a.go('day');
      if(o.stage === 'write') a.cover();
      if(o.stage === 'nearly'){ a.cover(); a.type('becuase'); a.check(); }
      if(o.stage === 'wild'){ a.cover(); a.type('zzz'); a.check(); }
      if(o.stage === 'right'){ a.cover(); a.type('because'); a.check(); }
      if(o.stage === 'done'){
        a.state.words.lists = [{id:'w2', name:'E', words:['rain']}];
        a.state.words.activeId = 'w2';
        a.state.words.mastery = {rain:{right:4, wrong:0, box:4, lastSeen:'2026-08-01'}};
        a.state.words.sessions = [{date:'2026-08-01', list:'w2', asked:1, words:1, right:1, firstTime:1}];
        a.save(); a.go('parent'); a.go('day');
      }
    }, {scale, stage});
  }

  // 375x667 is the smallest phone this will run on; 1.5x is the size a child
  // who needs large text will pick. That combination is the whole test.
  for(const scale of [0.9, 1, 1.25, 1.5]){
    test(`at ${scale}x the action and the word are both on screen`, async ({page}) => {
      await open(page, '2026-08-01');
      await page.setViewportSize({width:375, height:667});
      const problems = [];
      for(const stage of STAGES){
        await put(page, scale, stage);
        const m = await page.evaluate(() => {
          const vh = window.innerHeight, vw = document.documentElement.clientWidth;
          const main = document.querySelector('main');
          const acts = [...document.querySelectorAll('#act button')];
          const key = document.querySelector('.word,.marked,#type');
          const mr = main.getBoundingClientRect();
          const kr = key && key.getBoundingClientRect();
          return {
            actions: acts.length,
            belowFold: acts.filter(b => b.getBoundingClientRect().bottom > vh + 1).length,
            tooNarrow: acts.filter(b => { const r = b.getBoundingClientRect();
                                          return r.width < 44 || r.height < 44; }).length,
            offRight: acts.filter(b => b.getBoundingClientRect().right > vw + 1).length,
            keyCut: kr ? !(kr.top >= mr.top - 1 && kr.bottom <= mr.bottom + 1) : false,
            pageScrolls: document.documentElement.scrollHeight > vh + 2
          };
        });
        // WIN-4: look/write/right carry no #act button any more (the speaker is gone; she
        // types, taps to hear, and a win auto-advances). So no "action at all" is expected on
        // those — the guarantee that survives is that whatever IS on screen is not clipped or
        // off the fold, and the word/box itself is never cut off (keyCut, below).
        if(m.belowFold) problems.push(`${stage}: ${m.belowFold} action(s) below the fold`);
        if(m.tooNarrow) problems.push(`${stage}: an action is under 44px`);
        if(m.offRight) problems.push(`${stage}: an action runs off the right`);
        if(m.keyCut) problems.push(`${stage}: the word or the spelling box is cut off`);
        if(m.pageScrolls) problems.push(`${stage}: the page itself scrolls`);
      }
      expect(problems).toEqual([]);
    });
  }

  test('there is no speaker button — the whole word screen is the way to hear it', async ({page}) => {
    await open(page, '2026-08-01');
    await page.setViewportSize({width:375, height:667});
    // WIN-4 removed the speaker button and its "Hear it" label from every stage and size.
    for(const scale of [1, 1.5]){
      for(const stage of ['look', 'write']){
        await put(page, scale, stage);
        await expect(page.locator('#hear'), `speaker still on ${stage} at ${scale}x`).toHaveCount(0);
        expect(await page.locator('#app').innerText()).not.toContain('Hear it');
      }
    }
  });

  test('the grown-ups screen scrolls to its end with Back still in reach', async ({page}) => {
    await open(page, '2026-08-01');
    await page.setViewportSize({width:375, height:667});
    await page.evaluate(() => { window.__acorn.state.settings.textScale = 1.5;
                                window.__acorn.save(); window.__acorn.go('parent'); });
    const m = await page.evaluate(() => {
      const main = document.querySelector('main');
      main.scrollTop = main.scrollHeight;
      const back = document.querySelector('.back').getBoundingClientRect();
      const stamp = document.querySelector('.stamp').getBoundingClientRect();
      return {reachedEnd: Math.abs(main.scrollTop + main.clientHeight - main.scrollHeight) < 3,
              stampInView: stamp.bottom <= main.getBoundingClientRect().bottom + 2,
              backInView: back.top >= 0 && back.bottom <= window.innerHeight};
    });
    expect(m).toEqual({reachedEnd:true, stampInView:true, backInView:true});
  });
});

test.describe('with the software keyboard up', () => {

  // The keyboard takes half the screen and this is where she spends most of her
  // time. On iOS it does not change the layout viewport at all, so the app
  // follows visualViewport; these tests stand in for that by shrinking the
  // viewport to what is left.
  const LEFTOVER = [
    ['a phone with the keyboard up',       375, 360],
    ['a big accessibility keyboard',       375, 300],
    ['a very big keyboard',                375, 260],
    ['landscape with the keyboard up',     667, 200],
    ['a taller phone, keyboard up',        390, 370],
    ['a taller phone, big keyboard',       390, 310],
  ];

  for(const [name, w, h] of LEFTOVER){
    for(const scale of [0.9, 1, 1.25, 1.5]){
      test(`${name} at ${scale}x still shows the box and the action`, async ({page}) => {
        await open(page, '2026-08-01');
        await page.setViewportSize({width:w, height:h});
        await page.evaluate(s2 => {
          const a = window.__acorn;
          a.state.settings.textScale = s2;
          a.state.words.lists = [{id:'w1', name:'T', words:['because','friend','thought']}];
          a.state.words.activeId = 'w1'; a.state.words.mastery = {}; a.state.words.sessions = [];
          a.save(); a.go('parent'); a.go('day'); a.cover();
        }, scale);
        const m = await page.evaluate(() => {
          const vh = window.innerHeight, main = document.querySelector('main');
          const acts = [...document.querySelectorAll('#act button')];
          const box = document.querySelector('#type');
          const br = box.getBoundingClientRect(), mr = main.getBoundingClientRect();
          return {
            boxVisible: br.top >= mr.top - 1 && br.bottom <= mr.bottom + 1,
            boxHeight: Math.round(br.height),
            below: acts.filter(x => x.getBoundingClientRect().bottom > vh + 1).length,
            tooSmall: acts.filter(x => { const r = x.getBoundingClientRect();
                                         return r.width < 44 || r.height < 44; })
                          .map(x => x.id + ' ' + Math.round(x.getBoundingClientRect().height)),
          };
        });
        // She must be able to see what she is typing.
        expect(m.boxVisible, 'the spelling box is cut off').toBe(true);
        expect(m.boxHeight).toBeGreaterThan(30);
        expect(m.below, 'an action is below the fold').toBe(0);
        // Tap targets hold at 44px even when everything else gives way.
        expect(m.tooSmall).toEqual([]);
      });
    }
  }

  // Holding the keyboard open means it is now up on the look and check screens
  // too, not only while she is typing — so every stage has to survive the
  // reduced height, which the first version of this did not.
  const SHORT = [['keyboard up', 375, 360], ['big keyboard', 375, 300],
                 ['very big keyboard', 375, 260], ['landscape, keyboard up', 667, 200],
                 ['a taller phone', 390, 310], ['a taller phone, landscape', 390, 200]];

  for(const [name, w, h] of SHORT){
    test(`${name}: nothing essential is lost on any stage`, async ({page}) => {
      await open(page, '2026-08-01');
      await page.setViewportSize({width:w, height:h});
      const problems = [];
      for(const scale of [0.9, 1, 1.25, 1.5]){
        for(const stage of ['look','write','nearly','wild','right','done']){
          await page.evaluate(o => {
            const a = window.__acorn;
            a.state.settings.textScale = o.scale;
            a.state.words.lists = [{id:'w1', name:'T', words:['because','friend','thought']}];
            a.state.words.activeId = 'w1'; a.state.words.mastery = {}; a.state.words.sessions = [];
            a.save(); a.go('parent'); a.go('day');
            if(o.stage === 'write') a.cover();
            if(o.stage === 'nearly'){ a.cover(); a.type('becuase'); a.check(); }
            if(o.stage === 'wild'){ a.cover(); a.type('zzz'); a.check(); }
            if(o.stage === 'right'){ a.cover(); a.type('because'); a.check(); }
            if(o.stage === 'done'){
              a.state.words.lists = [{id:'w2', name:'E', words:['rain']}];
              a.state.words.activeId = 'w2';
              a.state.words.mastery = {rain:{right:4, wrong:0, box:4, lastSeen:'2026-08-01'}};
              a.state.words.sessions = [{date:'2026-08-01', list:'w2', asked:1, words:1,
                                         right:1, firstTime:1}];
              a.save(); a.go('parent'); a.go('day');
            }
          }, {scale, stage});
          const m = await page.evaluate(() => {
            const vh = window.innerHeight, vw = document.documentElement.clientWidth;
            const main = document.querySelector('main'), mr = main.getBoundingClientRect();
            const key = document.querySelector('.word,.marked,#type');
            const kr = key && key.getBoundingClientRect();
            const acts = [...document.querySelectorAll('#act button')];
            return {
              cut: kr ? !(kr.top >= mr.top - 1 && kr.bottom <= mr.bottom + 1) : false,
              wide: kr ? kr.right > vw + 1 : false,
              below: acts.filter(x => x.getBoundingClientRect().bottom > vh + 1).length,
              small: acts.filter(x => { const r = x.getBoundingClientRect();
                                        return r.width < 44 || r.height < 44; }).length,
              size: kr ? Math.round(parseFloat(getComputedStyle(key).fontSize)) : null,
            };
          });
          const at = `${stage} at ${scale}x`;
          if(m.cut) problems.push(`${at}: the word or the box is cut off`);
          if(m.wide) problems.push(`${at}: the word runs off the right`);
          if(m.below) problems.push(`${at}: an action is below the fold`);
          if(m.small) problems.push(`${at}: an action is under 44px`);
          if(m.size !== null && m.size < 14) problems.push(`${at}: the word shrank to ${m.size}px`);
        }
      }
      expect(problems).toEqual([]);
    });
  }

  test('what gives way, gives way in the right order', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.settings.textScale = 1.5;
      a.state.words.lists = [{id:'w1', name:'T', words:['because']}];
      a.state.words.activeId = 'w1';
      // A cold review word goes straight to write and keeps its instruction line
      // ("Listen, then write it"), so there is a note here for the squeeze to shed.
      // A just-traced new word has no note at all now (13.4), which is a different case.
      a.state.words.mastery = {because:{right:3,wrong:0,box:2,lastSeen:'2026-06-01'}};
      a.state.words.sessions = [];
      a.save(); a.go('parent'); a.go('day'); a.start();
    });
    // setViewportSize resolves before the resize handler has run, so wait for
    // the mode to settle rather than reading straight away.
    const settle = async want => page.waitForFunction(w => {
      const r = document.documentElement;
      const mode = r.hasAttribute('data-cramped') ? 'cramped'
                 : r.hasAttribute('data-tight') ? 'tight' : 'roomy';
      return mode === w;
    }, want, {timeout:3000});
    // WIN-4 removed the write instruction, so there is no .note to shed here any more; the
    // sheddable things on this cold-review write screen are the header and the progress dots,
    // and the box is what must never give way.
    const seen = async () => page.evaluate(() => ({
      mode: document.documentElement.hasAttribute('data-cramped') ? 'cramped'
          : document.documentElement.hasAttribute('data-tight') ? 'tight' : 'roomy',
      header: !!document.querySelector('.bar')?.getBoundingClientRect().height,
      dots: !!document.querySelector('.dots')?.getBoundingClientRect().height,
      box: !!document.querySelector('#type')?.getBoundingClientRect().height,
    }));
    await page.setViewportSize({width:375, height:667});
    await settle('roomy');
    expect(await seen()).toEqual({mode:'roomy', header:true, dots:true, box:true});
    // Tight: the header steps aside, but the DOTS now stay — they are one small row worth
    // seeing, and the header going makes room. The box stays.
    await page.setViewportSize({width:375, height:360});
    await settle('tight');
    expect(await seen()).toEqual({mode:'tight', header:false, dots:true, box:true});
    // Cramped: the dots still hold on — they fit even here, and seeing the pebbles is worth it.
    // (fitScreen would drop them only if the box itself were about to be cut off.)
    await page.setViewportSize({width:375, height:240});
    await settle('cramped');
    expect(await seen()).toEqual({mode:'cramped', header:false, dots:true, box:true});
  });

  test('a scarce screen never hides the way out of the grown-ups area', async ({page}) => {
    await open(page, '2026-08-01');
    await page.setViewportSize({width:375, height:240});
    await page.evaluate(() => {
      window.__acorn.state.settings.textScale = 1.5;
      window.__acorn.save(); window.__acorn.go('parent');
    });
    // The tight rules are scoped to the writing stage for exactly this reason.
    await expect(page.locator('.back')).toBeVisible();
    const r = await page.locator('.back').boundingBox();
    expect(r.height).toBeGreaterThanOrEqual(44);
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
          const el = document.querySelector('.tracew');       // the traced word, shown to copy
          const rg = document.createRange();
          rg.selectNodeContents(el);
          // The traced word is one span per letter, so a range over it returns a rect per
          // letter, not per line — count distinct vertical positions to get real lines.
          const tops = new Set([...rg.getClientRects()].map(r => Math.round(r.top)));
          return {lines: tops.size,
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
      if(await page.locator('#cover').count()){ await grab(); await page.evaluate(() => window.__acorn.cover()); }
    };
    await startOn(page, ['because','rain','boat']);
    await uncover();  await grab();                        // look, then write
    await write(page, 'becuase');
    await page.evaluate(() => window.__acorn.check());  await grab();   // nearly
    await page.evaluate(() => window.__acorn.next());    await uncover();
    await write(page, 'zzz');
    await page.evaluate(() => window.__acorn.check());  await grab();   // nowhere near
    await page.evaluate(() => window.__acorn.next());
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
    await page.evaluate(() => window.__acorn.cover());
    await page.evaluate(() => window.__acorn.check());                 // empty box
    await expect(page.locator('#toast')).toHaveText('Have a go — type the word.');
    expect(await page.locator('#toast').textContent()).not.toMatch(/hear|listen/i);
  });

  test('her name is used, and nothing breaks without one', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['rain']);
    await finishSession(page);
    // No name set: the greeting must still read as a sentence.
    const bare = (await page.locator('.cheer').count())
      ? await page.locator('.cheer').textContent()
      : await page.locator('.headline').textContent();
    expect(bare).not.toContain('{n}');
    expect(bare).toMatch(/^(Every one, first go|All done)\.$/);
  });
});

test.describe('what a screen reader is told', () => {

  test('the word is spelt out, not read as a word', async ({page}) => {
    await open(page, '2026-08-01');
    await startOn(page, ['because','rain','boat']);
    // Reading "because" aloud conveys nothing about how it is spelt. On the trace the
    // word carries the same spelled-out label as a shown word does elsewhere.
    await expect(page.locator('.tracew')).toHaveAttribute('aria-label', 'b e c a u s e');
    await expect(page.locator('.tracew')).toHaveAttribute('role', 'img');
    // and the element's own text stays clean — the word appears once
    expect(await page.locator('.tracew').textContent()).toBe('because');
  });

  test('the marked word is spelt out too', async ({page}) => {
    await open(page, '2026-08-01');
    await startOn(page, ['because','rain','boat']);
    await page.evaluate(() => window.__acorn.cover());
    await write(page, 'becuase');
    await page.evaluate(() => window.__acorn.check());
    await expect(page.locator('.marked')).toHaveAttribute('aria-label', 'b e c a u s e');
    expect(await page.locator('.marked').textContent()).toBe('because');
  });

  test('the progress bar does not announce over the top of the verdict', async ({page}) => {
    await open(page, '2026-08-01');
    await startOn(page, ['because','rain','boat']);
    // A second live region competes with the one that matters. This is a
    // progress indicator, not a status message.
    // The row of shapes is the only gauge now, and it is decoration to a screen
    // reader: the verdict is what matters and it must not be competed with.
    await expect(page.locator('.dots')).toHaveAttribute('aria-hidden', 'true');
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

  /* The count is across all her words rather than the open list, because moving her on
     when she had mastered one used to empty her bar overnight. It moved off the
     announcement in 11.9 and onto the picture, which is where a screen reader finds it
     now — so the numbers this checks are the picture's, and the singular-plural rule that
     used to live in the announcement went with the sentence that needed it. */
  test('the finished picture agrees with its own numbers', async ({page}) => {
    await open(page, '2026-08-01');
    await startOn(page, ['rain']);
    await finishSession(page);
    const label = await page.locator('#screen .net').getAttribute('aria-label');
    const m = label.match(/(\d+) met, (\d+) known well, (\d+) in all/);
    expect(m, 'unexpected wording: ' + label).not.toBeNull();
    const [, met, known, total] = m.map(Number);
    expect(known, 'she cannot know more than she has met').toBeLessThanOrEqual(met);
    expect(met, 'she cannot have met more than there are').toBeLessThanOrEqual(total);
    // And it is not announced on top of that.
    expect(await page.locator('#say').textContent()).not.toMatch(/known well/);
  });
});

test.describe('reachable without a touchscreen', () => {

  // The heading is a drawn mark rather than the letters, so what has to be true
  // of it is its name, not its text: a screen reader still meets "Acorn" first.
  test('the app has a heading', async ({page}) => {
    await open(page, '2026-07-28');
    await expect(page.locator('h1')).toHaveAccessibleName('Acorn');
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
    await page.evaluate(() => window.__acorn.cover());
    await write(page, 'becuase');
    await page.evaluate(() => window.__acorn.check());
    const said = await page.locator('#say').textContent();
    expect(said).toContain('So close');
    expect(said).toContain('b e c a u s e');
  });

  test('the word is never announced while she is writing it', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['because']);
    await page.evaluate(() => window.__acorn.cover());
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
    // WIN-4: the speaker button is gone, so there is no #hear to tab to any more; the trace
    // box and the syllable chips are the controls on this stage.
    expect([...reachable].join(' ')).toMatch(/type/);   // the trace box she copies into
  });

  test('driven by keyboard, focus is never dropped to the document', async ({page}) => {
    await open(page, '2026-08-01');
    await startOn(page, ['rain','boat']);
    // Keyboard only. A tap deliberately turns this off — a focus ring
    // appearing from nowhere on a touchscreen is only noise — so a test that
    // clicks would be testing the touch path instead.
    await page.keyboard.press('Tab');                         // she is on a keyboard now
    // The speaker used to be the tab stop just after the box; with it gone (WIN-4) a Tab off
    // the trace box lands on nothing, so put her back where the app actually keeps her — in
    // the box, the state restoreFocus establishes on every word. From here she is driven by keys.
    await page.evaluate(() => { const t = document.querySelector('#type'); if(t) t.focus(); });
    const stageOf = () => page.evaluate(() =>
      window.__acorn.session() ? window.__acorn.session().stage : 'done');
    const landed = [];
    for(let i = 0; i < 30; i++){
      const stage = await stageOf();
      if(stage === 'done') break;
      // Whatever the stage, something must hold focus — the trace/write box, the
      // wordless continue on a miss, or the speaker on a win — never the document body.
      landed.push(await page.evaluate(() => document.activeElement.tagName));
      const w = await page.evaluate(() => { const s = window.__acorn.session(); return s.words[s.i]; });
      if(stage === 'look' || stage === 'write'){              // both are a box she types into
        await page.evaluate(() => { const t = document.querySelector('#type'); if(t) t.focus(); });
        await page.keyboard.type(w);
        if(stage === 'write') await page.keyboard.press('Enter');   // return submits
        await page.waitForFunction(s => { const S = window.__acorn.session();
          return S && S.stage !== s; }, stage, {timeout: 2000});    // trace -> write, write -> check
      }else{                                                  // the verdict: return carries her on
        const i0 = await page.evaluate(() => window.__acorn.session().i);
        await page.keyboard.press('Enter');
        await page.waitForFunction(n => { const s = window.__acorn.session();
          return !s || s.i !== n || s.stage !== 'check'; }, i0, {timeout: 2000}).catch(() => {});
      }
    }
    // The finished screen offers only a quiet button; it still takes focus.
    landed.push(await page.evaluate(() => document.activeElement.tagName));
    expect(landed).not.toContain('BODY');
  });

  test('the finished screen says where she is up to', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['rain','boat']);
    await finishSession(page);
    /* On the picture, not shouted on arrival. This used to require the count in the live
       region, and the sentence that produced was "Every one, first go. 0 of 100 words known
       well" — the nought the progress bar was removed for, handed to the one child who
       cannot see that it went. She is still told where she is up to; she finds it on the
       picture, in the place the sighted child finds the picture. */
    await expect(page.locator('#screen .net')).toBeVisible();
    expect(await page.locator('#screen .net').getAttribute('aria-label'))
      .toMatch(/\d+ met, \d+ known well, \d+ in all/);
    expect(await page.locator('#say').textContent()).not.toMatch(/known well/);
  });
});

test.describe('the grown-ups screen hands her back a word', () => {

  test('pasting this week’s list and tapping Back lands her on a word', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('#paste').fill('because friend thought beautiful together');
    await page.locator('#pname2').fill('Week 6');
    await page.locator('#pasteSave').click();
    await page.locator('.back').click();
    // She used to get "All done for today" over a list she had never seen.
    expect(await page.evaluate(() => !!window.__acorn.session())).toBe(true);
    await expect(page.locator('.tracew')).toBeVisible();
    await expect(page.locator('.headline')).toHaveCount(0);
    expect(await page.evaluate(() => window.__acorn.wordsOf(window.__acorn.activeList())))
      .toContain(await page.locator('.tracew').textContent());
  });

  test('switching to another saved list lands her on a word from it', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('[data-list="tricky"]').click();
    await page.locator('.back').click();
    expect(await page.evaluate(() => window.__acorn.activeList().id)).toBe('tricky');
    expect(await page.evaluate(() => !!window.__acorn.session())).toBe(true);
  });

  test('a sitting she already finished is not silently restarted', async ({page}) => {
    await open(page, '2026-08-01');
    await startOn(page, ['rain','boat']);
    await finishSession(page);
    const before = await page.evaluate(() => window.__acorn.state.words.sessions.length);
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('.back').click();
    // "All done for today" is the honest answer here, with a way to ask for more.
    expect(await page.evaluate(() => !!window.__acorn.session())).toBe(false);
    await expect(page.locator('.headline')).toBeVisible();
    await expect(page.locator('#again')).toBeVisible();
    expect(await page.evaluate(() => window.__acorn.state.words.sessions.length)).toBe(before);
  });

  test('a grown-up looking in mid-word hands her back a sitting, not a dead end', async ({page}) => {
    await open(page, '2026-08-01');
    await startOn(page, ['because','friend','thought']);
    await page.evaluate(() => window.__acorn.go('parent'));       // long-press, then a look around
    await page.locator('.back').click();
    expect(await page.evaluate(() => !!window.__acorn.session())).toBe(true);
    await expect(page.locator('.word, #type')).toHaveCount(1);
  });

  test('finishing on one list still offers the next list fresh', async ({page}) => {
    await open(page, '2026-08-01');
    await startOn(page, ['rain','boat']);
    await finishSession(page);
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('[data-list="tricky"]').click();
    await page.locator('.back').click();
    // A different list is a different task, so today's finish does not apply.
    expect(await page.evaluate(() => !!window.__acorn.session())).toBe(true);
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
    await page.evaluate(() => window.__acorn.cover());
    await write(page, 'rain');
    await page.evaluate(() => window.__acorn.check());
    await expect(page.locator('.word.won')).toBeVisible();   // WIN-5: a plain win is the green word
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
    await expect(page.locator('.tracew')).toBeVisible();
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

  test('a long word fits at the smallest phone and the largest text', async ({page}) => {
    /* "What a word does at the largest size" is where the word block earns its clamp: the
       longest words she meets have to stay inside their box, keep the page from scrolling
       sideways, and not clip the screen — at 320px and her biggest text, which is the
       corner that bites. This checked one word at the default size and only the page-level
       scroll; it now checks the real long words at the sizes that matter, and the box and
       the screen, not just the document. */
    await open(page, '2026-08-01');
    const WORDS = ['antidisestablishmentarianism', 'jewellery', 'television', 'temperature',
                   'extraordinary', 'Wednesday', 'disappear', 'accommodate'];
    for(const [w, h] of [[320, 568], [390, 844]]){
      await page.setViewportSize({width: w, height: h});
      for(const scale of [1.5, 1.6]){
        for(const word of WORDS){
          const r = await page.evaluate(({word, scale}) => {
            const a = window.__acorn;
            a.state.settings.textScale = scale;
            const id = 'lw' + (++window.__nth || (window.__nth = 1));
            a.state.words.lists = [{id, name: 'T', words: [word, 'said']}];
            a.state.words.activeId = id;
            a.state.words.mastery = {}; a.state.words.sessions = [];
            a.save(); a.go('day'); if(!a.session()) a.start();
            const el = document.querySelector('.word') || document.querySelector('.tracew')
                    || document.querySelector('.marked');
            const de = document.documentElement, scr = document.querySelector('#screen');
            const rc = el ? el.getBoundingClientRect() : null;
            return {
              shown: !!el,
              overflowsBox: el ? el.scrollWidth > el.clientWidth + 1 : false,
              sideways: de.scrollWidth > de.clientWidth + 1,
              offEdge: rc ? (Math.round(rc.right) > de.clientWidth + 1 || Math.round(rc.left) < -1) : false,
              clipped: scr ? scr.scrollHeight > scr.clientHeight + 1 : false,
            };
          }, {word, scale});
          const at = `${w}x${h} @${scale} "${word}"`;
          expect(r.shown, `${at}: the word did not render`).toBe(true);
          expect(r.overflowsBox, `${at}: overflowed its box`).toBe(false);
          expect(r.sideways, `${at}: the page scrolled sideways`).toBe(false);
          expect(r.offEdge, `${at}: ran off the edge of the screen`).toBe(false);
          expect(r.clipped, `${at}: the screen was cut off`).toBe(false);
        }
      }
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('a word list entry with markup is escaped, not injected', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['<img src=x onerror="window.__pwned=1">']);
    await expect(page.locator('.tracew')).toContainText('<img');
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
