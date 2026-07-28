// Words: look, cover, write, check.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

test.describe('syllable splitting', () => {

  // Splits the built-in lists use are hand-checked in the app; this splitter
  // only has to serve pasted school words. These are the cases it must get right.
  const MUST = {
    happen:'hap·pen', water:'wa·ter', robot:'ro·bot', open:'o·pen',
    mother:'mo·ther', teacher:'tea·cher',                       // digraph never split
    neighbour:'neigh·bour', pocket:'pock·et',                   // coda digraph closes the syllable
    table:'ta·ble', little:'lit·tle', apple:'ap·ple', castle:'cas·tle',
    centre:'cen·tre', metre:'me·tre',                           // consonant + re is a syllable
    afraid:'a·fraid', between:'be·tween', display:'dis·play',   // onset blends lead
    basket:'bas·ket', listen:'lis·ten', island:'is·land', question:'ques·tion',  // s closes it
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
    // "february" would never come out as Feb·ru·ar·y algorithmically
    const parts = await page.evaluate(() => {
      window.__acorn.state.words.activeId = 'tricky';
      return window.__acorn.activeList().words['february'];
    });
    expect(parts).toBe('Feb·ru·ar·y');
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

  test('right first time moves up a box, wrong moves down one', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      a.recordWord('friend', 'first');  const b1 = a.mastery('friend').box;
      a.recordWord('friend', 'first');  const b2 = a.mastery('friend').box;
      a.recordWord('friend', 'wrong');  const b3 = a.mastery('friend').box;
      return {b1, b2, b3};
    });
    expect(out).toEqual({b1:2, b2:3, b3:2});
  });

  test('a slip never drops her all the way back to the start', async ({page}) => {
    await open(page, '2026-07-28');
    const box = await page.evaluate(() => {
      const a = window.__acorn;
      ['first','first','first','first'].forEach(o => a.recordWord('castle', o));   // box 5
      a.recordWord('castle', 'wrong');
      return a.mastery('castle').box;
    });
    expect(box).toBe(4);
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

  test('box 5 is capped — mastery does not run away', async ({page}) => {
    await open(page, '2026-07-28');
    const box = await page.evaluate(() => {
      const a = window.__acorn;
      for(let i=0;i<10;i++) a.recordWord('rain','first');
      return a.mastery('rain').box;
    });
    expect(box).toBe(5);
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

  test('a session puts due words first and caps its length', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      const list = a.allLists().find(l => l.id === 'tricky');
      // master most of the list so it is not due, leaving two words needing work
      a.wordsOf(list).forEach(w => { for(let i=0;i<4;i++) a.recordWord(w,'first'); });
      a.recordWord('friend','wrong'); a.recordWord('friend','wrong');
      a.recordWord('thought','wrong'); a.recordWord('thought','wrong');
      const s = a.buildSession(list, '2026-07-29');
      return {first: s.slice(0,2).sort(), len: s.length, cap: a.SESSION_LEN};
    });
    expect(out.first).toEqual(['friend','thought']);
    expect(out.len).toBeLessThanOrEqual(out.cap);
  });

  test('unseen words get used before words already known', async ({page}) => {
    await open(page, '2026-07-28');
    const session = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'w1', name:'Mix', words:['alpha','bravo','charlie']}];
      a.state.words.activeId = 'w1';
      for(let i=0;i<4;i++) a.recordWord('alpha','first');       // known, not due
      return a.buildSession(a.activeList(), '2026-07-28');
    });
    expect(session.slice(0,2).sort()).toEqual(['bravo','charlie']);
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

  test('a wrong go offers another, and only marks her down after the second', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['because']);
    await page.locator('#wcover').click();
    await page.locator('#wtype').fill('becuase');
    await page.locator('#wcheck').click();
    await expect(page.locator('.verdict.again')).toBeVisible();
    await expect(page.locator('#wretry')).toBeVisible();
    // nothing recorded yet — she still has a go left
    expect(await page.evaluate(() => window.__acorn.state.words.mastery.because)).toBeUndefined();
    await page.locator('#wretry').click();
    await expect(page.locator('.bigword')).toHaveText('because');   // shown again to look at
    await page.locator('#wcover').click();
    await page.locator('#wtype').fill('because');
    await page.locator('#wcheck').click();
    await expect(page.locator('.verdict.ok')).toHaveText(/got there/);
    const m = await page.evaluate(() => window.__acorn.mastery('because'));
    expect(m.box).toBe(1);                                          // no penalty, no advance
    expect(m.right).toBe(1);
  });

  test('wrong twice shows the word kindly and marks the letters to look at', async ({page}) => {
    await open(page, '2026-07-28');
    await startOn(page, ['because']);
    for(const attempt of ['becuase','becuase']){
      await page.locator('#wcover').click();
      await page.locator('#wtype').fill(attempt);
      await page.locator('#wcheck').click();
      if(await page.locator('#wretry').count()) await page.locator('#wretry').click();
    }
    await expect(page.locator('.marked u')).not.toHaveCount(0);     // the letters to look at
    await expect(page.locator('.attempt')).toContainText('becuase');
    await expect(page.locator('#wnext')).toBeVisible();
    expect(await page.evaluate(() => window.__acorn.mastery('because').box)).toBe(1);
    const body = await page.locator('#screen').innerText();
    expect(body).not.toMatch(/wrong|incorrect|failed|bad/i);
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
    await expect(page.locator('.dots i')).toHaveCount(3);
    await expect(page.locator('.dots i.now')).toHaveCount(1);
  });
});

test.describe('words screen and home', () => {

  test('home offers Words as a live card, not "soon"', async ({page}) => {
    await open(page, '2026-07-28');
    await expect(page.locator('.card.soon')).toHaveCount(1);          // only Maths left
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
