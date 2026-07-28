// Words: look, cover, write, check.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

test.describe('syllable splitting', () => {

  // Splits the built-in lists use are hand-checked in the app; this splitter
  // only has to serve pasted school words. These are the cases it must get right.
  // Checked against Longman LDOCE4 and Oxford Advanced Learner's 7th.
  const MUST = {
    happen:'hap·pen', water:'wa·ter', robot:'ro·bot', open:'o·pen',
    mother:'moth·er', teacher:'teach·er', singer:'sing·er', brother:'broth·er', // suffix after a digraph
    neighbour:'neigh·bour', pocket:'pock·et',                   // coda digraph closes the syllable
    table:'ta·ble', little:'lit·tle', apple:'ap·ple', castle:'cas·tle',
    summer:'sum·mer',                                           // doubled consonant is not a suffix boundary
    centre:'cen·tre', metre:'me·tre',                           // consonant + re is a syllable
    afraid:'a·fraid', between:'be·tween', display:'dis·play',   // onset blends lead
    basket:'bas·ket', listen:'lis·ten', island:'is·land', question:'ques·tion',  // s closes it
    lion:'li·on',                                               // two vowels, two sounds
    station:'sta·tion', division:'di·vi·sion', beautiful:'beau·ti·ful',
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

  test('short words and junk are returned whole, never empty', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => ({
      cat: window.__acorn.syllables('cat'),
      a:   window.__acorn.syllables('a'),
      none:window.__acorn.syllables(''),
      num: window.__acorn.syllables('12'),
      caps:window.__acorn.syllables('HAPPEN')
    }));
    expect(out.cat).toEqual(['cat']);
    expect(out.a).toEqual(['a']);
    expect(out.none).toEqual([]);
    expect(out.num).toEqual([]);
    expect(out.caps).toEqual(['hap','pen']);
  });

  test('the pieces always rejoin to the original word', async ({page}) => {
    await open(page, '2026-07-28');
    const bad = await page.evaluate(() => {
      const ws = ['because','friend','beautiful','government','separate','february','jewellery',
                  'recognise','television','permission','strength','through','rhythm','queue',
                  'antidisestablishmentarianism','aaa','xyz','o'];
      return ws.filter(w => window.__acorn.syllables(w).join('') !== w.toLowerCase().replace(/[^a-z']/g,''));
    });
    expect(bad).toEqual([]);
  });

  test('built-in lists use their hand-checked splits, not the splitter', async ({page}) => {
    await open(page, '2026-07-28');
    const parts = await page.evaluate(() => {
      window.__acorn.state.words.activeId = 'tricky';
      return window.__acorn.activeList().words['february'];
    });
    // Longman and Oxford both keep "-ary" whole; no dictionary splits off a lone final y
    expect(parts).toBe('Feb·ru·ary');
  });

  // Known limitation, kept visible rather than hidden: after a SHORT vowel the
  // dictionaries break after the consonant (hon·est, sev·en, cit·y); after a
  // long one they break before it (o·pen, ro·bot, wa·ter). Spelling alone can't
  // tell the two apart, so the splitter always chooses the long-vowel form.
  // The built-in lists are hand-checked, so this only affects pasted words.
  test('the short-vowel split is the documented known miss', async ({page}) => {
    await open(page, '2026-07-28');
    const got = await page.evaluate(() => ['honest','seven','lemon','city']
      .map(w => window.__acorn.syllables(w).join('·')));
    expect(got).toEqual(['ho·nest','se·ven','le·mon','ci·ty']);   // dictionary: hon·est, sev·en, lem·on, cit·y
  });
});

test.describe('pasting her school list', () => {

  test('accepts commas, new lines, numbering and bullets', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => window.__acorn.parseWordList(
      '1. because\n2) friend\n- thought,  through\n\nENOUGH  together'));
    expect(out).toEqual(['because','friend','thought','through','enough','together']);
  });

  test('drops duplicates and single letters', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => window.__acorn.parseWordList('cat, cat, CAT, a, dog, 5'));
    expect(out).toEqual(['cat','dog']);
  });

  test('a pasted list saves, becomes active, and drives the session', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('#pastebox').fill('sunshine, playground, October');
    await page.locator('#pastename').fill('Week 4');
    await page.locator('#pasteSave').click();
    const st = await page.evaluate(() => ({
      name: window.__acorn.activeList().name,
      words: window.__acorn.wordsOf(window.__acorn.activeList())
    }));
    expect(st.name).toBe('Week 4');
    expect(st.words).toEqual(['sunshine','playground','october']);
  });
});

test.describe('comparing her attempt', () => {

  test('marks which letters of the word she got', async ({page}) => {
    await open(page, '2026-07-28');
    const hit = await page.evaluate(() => window.__acorn.matchedTargetIndices('freind', 'friend'));
    // f-r-i-e-n-d vs f-r-e-i-n-d: f,r,-,-,n,d plus one of the transposed pair
    expect(hit).toContain(0);
    expect(hit).toContain(1);
    expect(hit).toContain(4);
    expect(hit).toContain(5);
  });

  test('a missing letter does not mark the whole word wrong', async ({page}) => {
    await open(page, '2026-07-28');
    const hit = await page.evaluate(() => window.__acorn.matchedTargetIndices('becuse', 'because'));
    expect(hit.length).toBe(6);          // only the dropped 'a' is unmatched
  });

  test('an exact match marks every letter', async ({page}) => {
    await open(page, '2026-07-28');
    const hit = await page.evaluate(() => window.__acorn.matchedTargetIndices('friend', 'friend'));
    expect(hit).toEqual([0,1,2,3,4,5]);
  });

  test('an empty attempt marks nothing, and does not throw', async ({page}) => {
    await open(page, '2026-07-28');
    const hit = await page.evaluate(() => window.__acorn.matchedTargetIndices('', 'friend'));
    expect(hit).toEqual([]);
  });
});

test.describe('spaced repetition', () => {

  // Raise a word up the boxes on consecutive days, since only one box per day
  // is allowed — that cap is itself part of the design.
  async function raise(page, word, times){
    await page.evaluate(o => {
      const a = window.__acorn;
      for(let i = 0; i < o.times; i++){
        a.setToday('2026-07-' + String(10 + i).padStart(2, '0'));
        a.recordWord(o.word, 'first');
      }
    }, {word: word, times: times});
  }

  test('one box per day — a second session cannot fast-track a word', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      a.recordWord('friend', 'first');  const first = a.mastery('friend').box;
      a.recordWord('friend', 'first');  const sameDay = a.mastery('friend').box;
      a.setToday('2026-07-29');
      a.recordWord('friend', 'first');  const nextDay = a.mastery('friend').box;
      return {first, sameDay, nextDay};
    });
    // Intervals are measured in days, so two goes in one evening is still one step.
    expect(out).toEqual({first:2, sameDay:2, nextDay:3});
  });

  test('a wrong answer drops two boxes, never below two', async ({page}) => {
    await open(page, '2026-07-28');
    await raise(page, 'castle', 6);                      // box 7
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      const before = a.mastery('castle').box;
      a.recordWord('castle', 'wrong');
      const after = a.mastery('castle').box;
      a.recordWord('lamb', 'first');                     // box 2
      a.recordWord('lamb', 'wrong');
      return {before, after, low: a.mastery('lamb').box};
    });
    expect(out.before).toBe(7);
    expect(out.after).toBe(5);                           // large but partial, not a reset
    expect(out.low).toBe(1);                             // a barely-known word does go back to 1
  });

  test('a word she has just met stays in box 1 when she gets it wrong', async ({page}) => {
    await open(page, '2026-07-28');
    const box = await page.evaluate(() => {
      window.__acorn.recordWord('brandnew', 'wrong');
      return window.__acorn.mastery('brandnew').box;
    });
    expect(box).toBe(1);
  });

  test('getting there on the retry costs nothing and gains nothing', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      a.recordWord('island', 'first');
      const before = a.mastery('island').box;
      a.recordWord('island', 'retry');
      return {before, after: a.mastery('island').box, right: a.mastery('island').right};
    });
    expect(out.after).toBe(out.before);
    expect(out.right).toBe(2);
  });

  test('the ramp reaches long intervals so known words stop coming back weekly', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => window.__acorn.BOX_DAYS);
    expect(out).toEqual({1:0, 2:1, 3:2, 4:4, 5:8, 6:21, 7:60});
  });

  test('the top box is capped — mastery does not run away', async ({page}) => {
    await open(page, '2026-07-28');
    await raise(page, 'rain', 12);
    const out = await page.evaluate(() => ({box: window.__acorn.mastery('rain').box, max: window.__acorn.MAX_BOX}));
    expect(out.box).toBe(out.max);
    expect(out.max).toBe(7);
  });

  test('a word is due again only after its box interval', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      a.recordWord('metre','first');                       // box 2 -> due after 1 day
      return {
        sameDay:  a.isDue('metre','2026-07-28'),
        nextDay:  a.isDue('metre','2026-07-29'),
        unseen:   a.isDue('neverseen','2026-07-28')
      };
    });
    expect(out.sameDay).toBe(false);
    expect(out.nextDay).toBe(true);
    expect(out.unseen).toBe(true);
  });

  test('no more than three words she is still learning appear in a session', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      // a full weekly list, none of it seen before
      a.state.words.lists = [{id:'w1', name:'Week 1',
        words:['aa','bb','cc','dd','ee','ff','gg','hh','ii','jj','kk','ll','mm','nn','oo','pp','qq','rr','ss','tt']}];
      a.state.words.activeId = 'w1';
      a.state.words.mastery = {};
      const s = a.buildSession(a.activeList(), '2026-07-28');
      return {len: s.length, cap: a.ACQUIRING_CAP};
    });
    // A 20-word list is dripped, not dumped: three at a time.
    expect(out.len).toBe(3);
    expect(out.cap).toBe(3);
  });

  test('words already started come back before any new one is introduced', async ({page}) => {
    await open(page, '2026-07-28');
    const session = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'w1', name:'Mix', words:['alpha','bravo','charlie','delta','echo']}];
      a.state.words.activeId = 'w1';
      a.state.words.mastery = {};
      a.recordWord('alpha','wrong');       // met, still box 1
      a.recordWord('bravo','wrong');
      a.recordWord('charlie','wrong');
      return a.buildSession(a.activeList(), '2026-07-29');
    });
    expect(session.slice().sort()).toEqual(['alpha','bravo','charlie']);
    expect(session).not.toContain('delta');      // nothing new until one graduates
  });

  test('a session opens with a word she is likely to get right', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'w1', name:'Mix', words:['safe','shaky','fresh']}];
      a.state.words.activeId = 'w1';
      a.state.words.mastery = {};
      // "safe" is well known and due; "shaky" is barely known
      a.state.words.mastery['safe']  = {right:5, wrong:0, box:5, lastSeen:'2026-07-10'};
      a.state.words.mastery['shaky'] = {right:1, wrong:3, box:1, lastSeen:'2026-07-27'};
      return a.buildSession(a.activeList(), '2026-07-28');
    });
    expect(out[0]).toBe('safe');                 // not the hardest word first
  });

  test('the most overdue word comes back before a merely due one', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'w1', name:'Mix', words:['ages','recent','filler']}];
      a.state.words.activeId = 'w1';
      a.state.words.mastery = {
        ages:   {right:3, wrong:0, box:3, lastSeen:'2026-07-01'},   // 27 days, wanted 2
        recent: {right:3, wrong:0, box:3, lastSeen:'2026-07-25'},   // 3 days, wanted 2
        filler: {right:5, wrong:0, box:5, lastSeen:'2026-07-27'}
      };
      return {
        ages: a.overdueRatio('ages', '2026-07-28'),
        recent: a.overdueRatio('recent', '2026-07-28'),
        session: a.buildSession(a.activeList(), '2026-07-28')
      };
    });
    expect(out.ages).toBeGreaterThan(out.recent);
    expect(out.session[0]).toBe('ages');
  });
});

test.describe('a practice session', () => {

  async function startOn(page, words){
    await page.evaluate(ws => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'w1', name:'Test', words:ws}];
      a.state.words.activeId = 'w1';
      a.state.words.mastery = {};
      a.save();
      a.go('words');
    }, words);
    await page.locator('#wstart').click();
  }

  test('look, cover, write, check — the whole way through', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['friend']);
    await expect(page.locator('.bigword')).toHaveText('friend');
    await expect(page.locator('.syl')).toHaveCount(1);
    await page.locator('#wcover').click();
    await expect(page.locator('#wtype')).toBeVisible();
    await expect(page.locator('.bigword')).toHaveCount(0);          // the word is genuinely hidden
    await page.locator('#wtype').fill('friend');
    await page.locator('#wcheck').click();
    await expect(page.locator('.verdict.ok')).toHaveText(/that’s it/);
    expect(await page.evaluate(() => window.__acorn.mastery('friend').box)).toBe(2);
    expect(errorsOf(page)).toEqual([]);
  });

  test('the spelling box never autocorrects her spelling', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['friend']);
    await page.locator('#wcover').click();
    const attrs = await page.locator('#wtype').evaluate(n => ({
      correct: n.getAttribute('autocorrect'), cap: n.getAttribute('autocapitalize'),
      spell: n.getAttribute('spellcheck'), complete: n.getAttribute('autocomplete')
    }));
    expect(attrs).toEqual({correct:'off', cap:'off', spell:'false', complete:'off'});
  });

  test('a miss shows only the correct spelling — never her own', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['because','rain','boat']);
    await page.locator('#wcover').click();
    await page.locator('#wtype').fill('becuase');
    await page.locator('#wcheck').click();
    await expect(page.locator('.verdict.again')).toBeVisible();
    await expect(page.locator('.marked u')).not.toHaveCount(0);     // letters to look at
    // Seeing wrong orthography is what sets spelling back, so it is never shown.
    const body = await page.locator('#screen').innerText();
    expect(body).not.toContain('becuase');
    expect(body).not.toMatch(/wrong|incorrect|failed|bad/i);
    await expect(page.locator('#wretry')).toHaveCount(0);           // no immediate re-copy
    await expect(page.locator('#wnext')).toBeVisible();
    expect(await page.evaluate(() => window.__acorn.mastery('because').box)).toBe(1);
  });

  test('a missed word comes back later in the same session, from memory', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['because','rain','boat']);
    // miss the first word
    await page.locator('#wcover').click();
    await page.locator('#wtype').fill('becuase');
    await page.locator('#wcheck').click();
    await page.locator('#wnext').click();
    // work through the rest correctly
    for(let i = 0; i < 2; i++){
      const word = await page.evaluate(() => window.__acorn.session().words[window.__acorn.session().i]);
      if(await page.locator('#wcover').count()) await page.locator('#wcover').click();
      await page.locator('#wtype').fill(word);
      await page.locator('#wcheck').click();
      await page.locator('#wnext').click();
    }
    // the missed word is re-asked — and this time with no look step
    expect(await page.evaluate(() => window.__acorn.session().words[window.__acorn.session().i])).toBe('because');
    await expect(page.locator('#wcover')).toHaveCount(0);
    await expect(page.locator('#wtype')).toBeVisible();
    await page.locator('#wtype').fill('because');
    await page.locator('#wcheck').click();
    await expect(page.locator('.verdict.ok')).toHaveText(/got there/);
    const m = await page.evaluate(() => window.__acorn.mastery('because'));
    expect(m.box).toBe(1);                                          // no penalty, no advance
  });

  test('a word she already knows is never shown before she spells it', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'w1', name:'Test', words:['friend']}];
      a.state.words.activeId = 'w1';
      a.state.words.mastery = {friend:{right:3, wrong:0, box:3, lastSeen:'2026-07-20'}};
      a.save(); a.go('words');
    });
    await page.locator('#wstart').click();
    await expect(page.locator('#wtype')).toBeVisible();              // straight to writing
    await expect(page.locator('.bigword')).toHaveCount(0);           // the word is not on screen
    await expect(page.locator('#wcover')).toHaveCount(0);
  });

  test('pressing Enter checks the word', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['rain']);
    await page.locator('#wcover').click();
    await page.locator('#wtype').fill('rain');
    await page.locator('#wtype').press('Enter');
    await expect(page.locator('.verdict.ok')).toBeVisible();
  });

  test('it walks every word then finishes back on the words screen', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['rain','boat','light']);
    for(let i=0; i<3; i++){
      const word = await page.evaluate(() => window.__acorn.session().words[window.__acorn.session().i]);
      await page.locator('#wcover').click();
      await page.locator('#wtype').fill(word);
      await page.locator('#wcheck').click();
      await page.locator('#wnext').click();
    }
    expect(await page.evaluate(() => window.__acorn.screen())).toBe('words');
    await expect(page.locator('.say')).toHaveText(/first go|All done/);
    const s = await page.evaluate(() => window.__acorn.state.words.sessions);
    expect(s.length).toBe(1);
    expect(s[0]).toMatchObject({asked:3, right:3, firstTime:3});
    expect(errorsOf(page)).toEqual([]);
  });

  test('leaving early keeps the progress already earned', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['rain','boat']);
    await page.locator('#wcover').click();
    await page.locator('#wtype').fill('rain');
    await page.locator('#wcheck').click();
    await page.locator('[data-go="words"]').click();
    expect(await page.evaluate(() => window.__acorn.mastery('rain').box)).toBe(2);
    expect(await page.evaluate(() => window.__acorn.session())).toBeNull();
  });

  test('progress dots track the position', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['rain','boat','light']);
    await expect(page.locator('.dots i')).toHaveCount(3);   // 3 acquiring words is the cap
    await expect(page.locator('.dots i.now')).toHaveCount(1);
  });
});

test.describe('words screen and home', () => {

  test('home is words and nothing else for now', async ({page}) => {
    await open(page, '2026-07-28');
    await expect(page.locator('.card')).toHaveCount(1);
    await expect(page.locator('.card.soon')).toHaveCount(0);
    await page.locator('[data-go="words"]').click();
    expect(await page.evaluate(() => window.__acorn.screen())).toBe('words');
  });

  test('the words screen shows the list and how much is known', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.go('words'));
    await expect(page.locator('.wlistname')).toHaveText('Tricky words');
    await expect(page.locator('.wmeta').first()).toHaveText(/0 of 16 words known well/);
  });

  test('changing the list in the grown-ups area changes what she practises', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('[data-list="silent"]').click();
    await page.evaluate(() => window.__acorn.go('words'));
    await expect(page.locator('.wlistname')).toHaveText('Silent letters');
  });

  test('a saved list can be deleted, and needs two taps', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => {
      window.__acorn.state.words.lists = [{id:'w1', name:'Week 4', words:['cat','dog']}];
      window.__acorn.save(); window.__acorn.go('parent');
    });
    await page.locator('[data-dellist="w1"]').click();
    expect(await page.evaluate(() => window.__acorn.state.words.lists.length)).toBe(1);
    await page.locator('[data-dellist="w1"]').click();
    expect(await page.evaluate(() => window.__acorn.state.words.lists.length)).toBe(0);
    // and the active list falls back to something real
    expect(await page.evaluate(() => !!window.__acorn.activeList())).toBe(true);
  });
});

test.describe('voice choice', () => {

  test('high-quality and Australian voices score above robotic ones', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => {
      const s = window.__acorn.voiceScore;
      return {
        enhancedAU: s({name:'Karen (Enhanced)', lang:'en-AU', voiceURI:'a'}),
        plainAU:    s({name:'Karen',            lang:'en-AU', voiceURI:'b'}),
        gb:         s({name:'Daniel',           lang:'en-GB', voiceURI:'c'}),
        us:         s({name:'Alex',             lang:'en-US', voiceURI:'d'}),
        compact:    s({name:'Karen (Compact)',  lang:'en-AU', voiceURI:'e'})
      };
    });
    expect(out.enhancedAU).toBeGreaterThan(out.plainAU);
    expect(out.plainAU).toBeGreaterThan(out.gb);
    expect(out.gb).toBeGreaterThan(out.us);
    expect(out.compact).toBeLessThan(out.plainAU);
  });

  test('novelty and robotic voices are filtered out of the list', async ({page}) => {
    await open(page, '2026-07-28');
    const kept = await page.evaluate(() => {
      // stand in for what macOS actually hands back
      const fake = [
        {name:'Albert',            lang:'en-US', voiceURI:'1'},
        {name:'Bad News',          lang:'en-US', voiceURI:'2'},
        {name:'Bells',             lang:'en-US', voiceURI:'3'},
        {name:'Bubbles',           lang:'en-US', voiceURI:'4'},
        {name:'Bahh',              lang:'en-US', voiceURI:'5'},
        {name:'Zarvox',            lang:'en-US', voiceURI:'6'},
        {name:'Matilda (Premium)', lang:'en-AU', voiceURI:'7'},
        {name:'Karen',             lang:'en-AU', voiceURI:'8'},
        {name:'Daniel',            lang:'en-GB', voiceURI:'9'}
      ];
      speechSynthesis.getVoices = () => fake;
      return window.__acorn.englishVoices().map(v => v.name);
    });
    expect(kept).toEqual(['Matilda (Premium)', 'Karen', 'Daniel']);
  });

  test('a downloaded Premium Australian voice is chosen automatically', async ({page}) => {
    await open(page, '2026-07-28');
    const best = await page.evaluate(() => {
      speechSynthesis.getVoices = () => [
        {name:'Albert',            lang:'en-US', voiceURI:'1'},
        {name:'Daniel',            lang:'en-GB', voiceURI:'2'},
        {name:'Karen',             lang:'en-AU', voiceURI:'3'},
        {name:'Matilda (Premium)', lang:'en-AU', voiceURI:'4'}
      ];
      window.__acorn.state.settings.voice = null;
      return window.__acorn.offerVoices().map(v => v.name);
    });
    expect(best[0]).toBe('Matilda (Premium)');
  });

  test('a chosen voice is remembered across a reload', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => { window.__acorn.state.settings.voice = 'urn:test:voice'; window.__acorn.save(); });
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    expect(await page.evaluate(() => window.__acorn.state.settings.voice)).toBe('urn:test:voice');
  });

  test('speaking speed saves', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('[data-rate="0.7"]').click();
    expect(await page.evaluate(() => window.__acorn.state.settings.speechRate)).toBe(0.7);
  });
});
