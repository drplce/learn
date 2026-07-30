/* Adversarial pass: use Acorn the way a nine-year-old with a phone actually
 * does — double taps, hammering buttons, empty answers, wandering off, going
 * offline, midnight arriving mid-word — and check nothing breaks.
 *
 *   node tests/break.js
 *   ACORN_SHOTS=/some/dir node tests/break.js     # keep the screenshots
 *
 * Not part of the Playwright suite: it is a single long adversarial run
 * rather than a set of assertions, and it exits non-zero on any finding.
 */
const {chromium, devices} = require('@playwright/test');
const {findChromium} = require('../playwright.config.js');

const OUT = process.env.ACORN_SHOTS || require('os').tmpdir();
const fails = [];
function bad(what, detail){ fails.push(what + ' — ' + detail); console.log('  ✗ ' + what + ': ' + detail); }
function ok(what){ console.log('  ✓ ' + what); }
function bad2(what, detail){ bad('pasted "' + what + '"', detail); }

async function fresh(browser, today){
  const ctx = await browser.newContext({...devices['iPhone 13'], isMobile:false,
                                        defaultBrowserType:'chromium'});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if(m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'));
  await page.waitForFunction(() => !!window.__acorn);
  if(today) await page.evaluate(d => window.__acorn.setToday(d), today);
  return {page, ctx, errs};
}
const alive = page => page.evaluate(() =>
  !!document.querySelector('#screen') && document.querySelector('#screen').children.length > 0);

async function main(){
  const browser = await chromium.launch({executablePath: findChromium()});

  // ---- 1. hammering the primary button
  {
    console.log('\n1. hammering the buttons');
    const {page, ctx, errs} = await fresh(browser, '2026-07-28');
    for(let i = 0; i < 40; i++){
      const b = page.locator('.primary');
      if(await b.count()) await b.click({force:true, timeout:2000}).catch(() => {});
    }
    if(!await alive(page)) bad('40 blind taps on the primary button', 'screen is empty');
    else ok('40 blind taps leave a rendered screen');
    if(errs.length) bad('40 blind taps', errs.join(' | ')); else ok('no page errors');
    const st = await page.evaluate(() => ({s:window.__acorn.screen(), sess:!!window.__acorn.session(),
                                           sessions:window.__acorn.state.words.sessions.length,
                                           wrong:Object.values(window.__acorn.state.words.mastery)
                                                       .reduce((n, m) => n + m.wrong, 0)}));
    console.log('    ' + JSON.stringify(st));
    // Blind tapping must not be able to mark her words wrong.
    if(st.wrong) bad('40 blind taps', 'recorded ' + st.wrong + ' misses without a single answer typed');
    else ok('blind tapping costs her nothing');
    await page.screenshot({path: OUT + '/break-1-hammer.png'});
    await ctx.close();
  }

  // ---- 2. double-tap check (the classic double-submit)
  {
    console.log('\n2. double-tapping Check');
    const {page, ctx, errs} = await fresh(browser, '2026-07-28');
    await page.locator('#cover').click();
    const w = await page.evaluate(() => window.__acorn.session().words[0]);
    await page.locator('#type').fill(w);
    const before = await page.evaluate(w => window.__acorn.mastery(w).right, w);
    await Promise.all([
      page.locator('#check').click({force:true}),
      page.locator('#check').click({force:true}).catch(() => {})
    ]);
    const after = await page.evaluate(w => window.__acorn.mastery(w), w);
    if(after.right > before + 1) bad('double-tap Check', 'counted ' + (after.right - before) + ' rights for one answer');
    else ok('double-tap Check counts once (' + JSON.stringify(after) + ')');
    if(errs.length) bad('double-tap Check', errs.join(' | '));
    await ctx.close();
  }

  // ---- 3. empty and whitespace answers
  {
    console.log('\n3. empty, whitespace and giant answers');
    const {page, ctx, errs} = await fresh(browser, '2026-07-28');
    await page.locator('#cover').click();
    for(const v of ['', '   ', 'x'.repeat(500), '😀😀😀', '<script>window.__pwned=1</script>', '\t\n ']){
      if(!await page.locator('#type').count()){
        // a check screen — move on first
        if(await page.locator('#next').count()) await page.locator('#next').click();
        if(await page.locator('#cover').count()) await page.locator('#cover').click();
      }
      if(!await page.locator('#type').count()) continue;
      const before = await page.evaluate(() => window.__acorn.session().i);
      await page.locator('#type').fill(v);
      await page.locator('#check').click();
      if(!await alive(page)){ bad('answer ' + JSON.stringify(v.slice(0, 20)), 'blank screen'); break; }
      /* Either she gets a verdict and moves on, or the answer had no letters in it at
         all and is treated as the fumble it is: the toast asks her to have a go, the
         box keeps what she typed so she can fix it, and the word costs her nothing.
         Emoji land here, which is right — three smileys are not a spelling attempt,
         and marking them a miss would drop her box for playing. */
      const letters = /[a-zA-Z]/.test(v);
      if(await page.locator('#next').count()){
        if(!letters) bad('answer ' + JSON.stringify(v.slice(0, 20)),
                         'no letters in it, but it was marked as an attempt');
        await page.locator('#next').click();
        if(await page.locator('#cover').count()) await page.locator('#cover').click();
      }else if(letters){
        bad('answer ' + JSON.stringify(v.slice(0, 20)), 'was accepted but offered no way on');
      }else{
        // No letters: same word, untouched, and told what to do.
        const after = await page.evaluate(() => window.__acorn.session().i);
        if(after !== before) bad('answer ' + JSON.stringify(v.slice(0, 20)), 'moved her on anyway');
        const said = await page.evaluate(() => (document.querySelector('#toast')||{}).textContent || '');
        if(!/Have a go/.test(said))
          bad('answer ' + JSON.stringify(v.slice(0, 20)), 'nothing told her to try again');
        await page.locator('#type').fill('');
      }
    }
    if(await page.evaluate(() => window.__pwned)) bad('script in the answer box', 'executed');
    else ok('junk answers handled, nothing injected');
    if(errs.length) bad('junk answers', errs.join(' | ')); else ok('no page errors');
    await page.screenshot({path: OUT + '/break-3-junk.png'});
    await ctx.close();
  }

  // ---- 4. corrupt and hostile stored state
  {
    console.log('\n4. corrupt stored state');
    for(const raw of ['{', 'null', '[]', '"a string"', '{"words":null}',
                      '{"words":{"lists":"nope","mastery":5,"activeId":{},"sessions":"x"}}',
                      '{"words":{"lists":[{"id":"x","name":"X","words":[]}],"activeId":"x"}}',
                      '{"settings":{"textScale":"huge","tint":123}}']){
      const {page, ctx, errs} = await fresh(browser);
      await page.evaluate(r => { localStorage.setItem('acorn.v1', r); }, raw);
      await page.reload();
      const up = await page.waitForFunction(() => !!window.__acorn, {timeout:5000}).then(() => true, () => false);
      if(!up){ bad('stored ' + raw.slice(0, 30), 'app did not boot'); await ctx.close(); continue; }
      if(!await alive(page)) bad('stored ' + raw.slice(0, 30), 'booted to an empty screen');
      if(errs.length) bad('stored ' + raw.slice(0, 30), errs.join(' | '));
      await ctx.close();
    }
    ok('every corrupt payload boots to something usable');
  }

  // ---- 5. an empty list, and a list of one word
  {
    console.log('\n5. degenerate lists');
    for(const words of [[], ['a'], ['i'], ['antidisestablishmentarianism']]){
      const {page, ctx, errs} = await fresh(browser, '2026-07-28');
      await page.evaluate(ws => {
        const a = window.__acorn;
        a.state.words.lists = [{id:'x', name:'X', words:ws}];
        a.state.words.activeId = 'x'; a.state.words.mastery = {}; a.state.words.sessions = [];
        a.save(); a.go('day'); a.start();
      }, words);
      if(!await alive(page)) bad('list ' + JSON.stringify(words), 'blank screen');
      // walk it to the end
      for(let i = 0; i < 12; i++){
        if(await page.locator('#cover').count()) await page.locator('#cover').click();
        else if(await page.locator('#type').count()){
          const cur = await page.evaluate(() => { const s = window.__acorn.session(); return s && s.words[s.i]; });
          await page.locator('#type').fill(cur || 'x');
          await page.locator('#check').click();
        }
        else if(await page.locator('#next').count()) await page.locator('#next').click();
        else break;
      }
      if(!await alive(page)) bad('list ' + JSON.stringify(words) + ' walked', 'blank screen');
      if(errs.length) bad('list ' + JSON.stringify(words), errs.join(' | '));
      await ctx.close();
    }
    ok('empty, single-letter and 28-letter lists all survive a full walk');
  }

  // ---- 6. offline, and reload mid-session
  {
    console.log('\n6. offline and reload mid-session');
    const {page, ctx, errs} = await fresh(browser, '2026-07-28');
    await ctx.setOffline(true);
    await page.locator('#cover').click();
    const w = await page.evaluate(() => window.__acorn.session().words[0]);
    await page.locator('#type').fill(w);
    await page.locator('#check').click();
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    const kept = await page.evaluate(w => window.__acorn.mastery(w), w);
    if(!kept.right) bad('reload mid-session', 'the answer she got right was lost');
    else ok('offline works and the answer survives a reload (' + JSON.stringify(kept) + ')');
    if(!await alive(page)) bad('reload mid-session', 'blank screen');
    if(errs.length) bad('offline', errs.join(' | '));
    await ctx.close();
  }

  // ---- 7. midnight rollover mid-session
  {
    console.log('\n7. midnight rolls over mid-session');
    const {page, ctx, errs} = await fresh(browser, '2026-07-28');
    await page.locator('#cover').click();
    await page.evaluate(() => window.__acorn.setToday('2026-07-29'));
    if(!await alive(page)) bad('midnight mid-session', 'blank screen');
    const cur = await page.evaluate(() => window.__acorn.session());
    // whatever it decides, it must be coherent: either a live session or the done screen
    if(cur){
      const w = cur.words[cur.i];
      if(await page.locator('#cover').count()) await page.locator('#cover').click();
      await page.locator('#type').fill(w);
      await page.locator('#check').click();
      if(!await alive(page)) bad('midnight then answer', 'blank screen');
      const m = await page.evaluate(w => window.__acorn.mastery(w), w);
      if(m.lastSeen !== '2026-07-29') bad('midnight then answer', 'recorded against ' + m.lastSeen);
      else ok('the answer is recorded against the new day (' + JSON.stringify(m) + ')');
    }else ok('rollover ended the session cleanly');
    if(errs.length) bad('midnight rollover', errs.join(' | '));
    await ctx.close();
  }

  // ---- 8. leaving to the grown-ups area mid-word and coming back
  {
    console.log('\n8. wandering off mid-word');
    const {page, ctx, errs} = await fresh(browser, '2026-07-28');
    await page.locator('#cover').click();
    await page.locator('#type').fill('half-typed');
    await page.evaluate(() => window.__acorn.go('parent'));
    if(!await alive(page)) bad('into the grown-ups area', 'blank screen');
    await page.evaluate(() => window.__acorn.go('day'));
    if(!await alive(page)) bad('back out of the grown-ups area', 'blank screen');
    // Coming back must hand her a word, not a screen saying there is nothing to
    // do — but it must be a fresh sitting, carrying none of the half-typed
    // attempt and nothing from a list that may have changed while he was in there.
    const s = await page.evaluate(() => {
      const S = window.__acorn.session();
      return S && {attempt:S.attempt, i:S.i, stage:S.stage,
                   fromList: S.words.every(w =>
                     window.__acorn.wordsOf(window.__acorn.activeList()).indexOf(w) >= 0)};
    });
    if(!s) bad('back out of the grown-ups area', 'she is left with no sitting at all');
    else if(s.attempt) bad('back out of the grown-ups area', 'the half-typed attempt survived: ' + s.attempt);
    else if(!s.fromList) bad('back out of the grown-ups area', 'the sitting holds words from another list');
    else ok('coming back hands her a fresh sitting (' + JSON.stringify(s) + ')');
    // and she can start again
    await page.evaluate(() => window.__acorn.start());
    if(!await alive(page)) bad('restart after wandering', 'blank screen');
    else ok('she can start again');
    if(errs.length) bad('wandering off', errs.join(' | '));
    await page.screenshot({path: OUT + '/break-8-return.png'});
    await ctx.close();
  }

  // ---- 9. the grown-ups paste box, hostile input
  {
    console.log('\n9. hostile paste');
    const {page, ctx, errs} = await fresh(browser, '2026-07-28');
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('#paste').fill('<img src=x onerror="window.__pwned=1">, ok, ' + 'z'.repeat(300) + ', 1, a, ok');
    await page.locator('#pasteSave').click();
    if(await page.evaluate(() => window.__pwned)) bad('hostile paste', 'executed');
    const list = await page.evaluate(() => window.__acorn.wordsOf(window.__acorn.activeList()));
    console.log('    saved: ' + JSON.stringify(list));
    await page.evaluate(() => { window.__acorn.go('day'); window.__acorn.start(); });
    if(!await alive(page)) bad('hostile paste then practise', 'blank screen');
    else ok('hostile paste is escaped and still practisable');
    await page.screenshot({path: OUT + '/break-9-paste.png'});
    if(errs.length) bad('hostile paste', errs.join(' | '));
    await ctx.close();
  }

  // ---- 10. a hundred days straight, no supervision
  {
    console.log('\n10. a hundred days without a break');
    const {page, ctx, errs} = await fresh(browser);
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      const start = new Date('2026-08-01T00:00:00Z');
      let noSession = 0, longest = 0;
      for(let d = 0; d < 100; d++){
        a.setToday(new Date(start.getTime() + d * 864e5).toISOString().slice(0, 10));
        if(!a.start()){ noSession++; continue; }
        let n = 0;
        while(a.session() && n++ < 200){
          const s = a.session(), w = s.words[s.i];
          if(s.stage === 'look') a.cover();
          a.type(w); a.check(); a.next();
        }
        longest = Math.max(longest, n);
      }
      return {noSession, longest, sessions:a.state.words.sessions.length,
              mastery:Object.keys(a.state.words.mastery).length,
              bytes:JSON.stringify(a.state).length};
    });
    console.log('    ' + JSON.stringify(out));
    if(out.longest > 40) bad('100 days', 'a session ran to ' + out.longest + ' answers');
    if(out.sessions > 60) bad('100 days', 'session history grew to ' + out.sessions + ' entries');
    else ok('session history stays capped at ' + out.sessions);
    if(!await alive(page)) bad('100 days', 'blank screen');
    if(errs.length) bad('100 days', errs.join(' | ')); else ok('no page errors in 100 days');
    await ctx.close();
  }

  // ---- 11. the clock moves — travel, or she changes it herself
  {
    console.log('\n11. the clock moves under her');
    const {page, ctx, errs} = await fresh(browser, '2026-08-20');
    const out = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'x', name:'X', words:['rain','boat','light','said','went']}];
      a.state.words.activeId = 'x';
      // every word seen "today", then the clock jumps back three weeks
      const m = {};
      ['rain','boat','light','said','went'].forEach(w => {
        m[w] = {right:4, wrong:0, box:6, lastSeen:'2026-08-20'}; });
      a.state.words.mastery = m; a.save();
      const back = [], fwd = [];
      a.setToday('2026-08-01');
      back.push(a.buildSession(a.activeList(), '2026-08-01').length, !!a.start());
      a.setToday('2027-08-01');                       // and a year forward
      fwd.push(a.buildSession(a.activeList(), '2027-08-01').length, !!a.start());
      return {back, fwd, screen: document.querySelector('#screen').children.length};
    });
    console.log('    ' + JSON.stringify(out));
    if(!out.back[1]) bad('clock moved back', 'no session could start at all');
    else ok('a clock moved back still gives her a session (' + out.back[0] + ' words)');
    if(!out.fwd[1]) bad('clock moved forward a year', 'no session');
    else if(out.fwd[0] > 12) bad('clock moved forward a year', out.fwd[0] + ' words in one sitting');
    else ok('a year forward is still a normal sitting (' + out.fwd[0] + ' words)');
    if(errs.length) bad('clock moved', errs.join(' | '));
    await ctx.close();
  }

  // ---- 12. the device refuses to store anything
  {
    console.log('\n12. storage refuses every write');
    const {page, ctx, errs} = await fresh(browser, '2026-08-01');
    await page.evaluate(() => { Storage.prototype.setItem = function(){ throw new Error('quota'); }; });
    for(let i = 0; i < 6; i++){
      if(await page.locator('#cover').count()) await page.locator('#cover').click();
      else if(await page.locator('#type').count()){
        const w = await page.evaluate(() => { const s = window.__acorn.session(); return s && s.words[s.i]; });
        await page.locator('#type').fill(w || 'x');
        await page.locator('#check').click();
      }
      else if(await page.locator('#next').count()) await page.locator('#next').click();
      else break;
    }
    if(!await alive(page)) bad('storage refuses writes', 'blank screen');
    else ok('she can still practise with no storage at all');
    await page.evaluate(() => window.__acorn.go('parent'));
    if(!await page.locator('#nosave').count()) bad('storage refuses writes', 'a grown-up is never told');
    else ok('the grown-ups screen says progress is not being saved');
    if(errs.length) bad('storage refuses writes', errs.join(' | '));
    await ctx.close();
  }

  // ---- 13. a list pasted from a real school newsletter
  {
    console.log('\n13. a messy pasted list');
    const {page, ctx, errs} = await fresh(browser, '2026-08-01');
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('#paste').fill(
      'Week 5 spelling:\n1. because\n2) friend\n- thought\n\u2022 well-known\n' +
      "  o'clock  \n-lead\ntrail-\n'quoted'\nBECAUSE\nbecause\n\u00a0\ttogether\n" +
      '3. self-esteem\nmother-in-law\n');
    await page.locator('#pasteSave').click();
    const list = await page.evaluate(() => window.__acorn.wordsOf(window.__acorn.activeList()));
    console.log('    ' + JSON.stringify(list));
    const broken = await page.evaluate(ws => ws.filter(w => window.__acorn.syllables(w).join('') !== w), list);
    if(broken.length) bad('messy pasted list', 'these do not survive splitting: ' + broken.join(', '));
    else ok('every word from a messy paste splits back to itself');
    // and it is practisable end to end
    await page.evaluate(() => { window.__acorn.go('day'); window.__acorn.start(); });
    for(let i = 0; i < 30; i++){
      if(await page.locator('#cover').count()) await page.locator('#cover').click();
      else if(await page.locator('#type').count()){
        const w = await page.evaluate(() => { const s = window.__acorn.session(); return s && s.words[s.i]; });
        await page.locator('#type').fill(w || 'x');
        await page.locator('#check').click();
      }
      else if(await page.locator('#next').count()) await page.locator('#next').click();
      else break;
    }
    if(!await alive(page)) bad('messy pasted list walked', 'blank screen');
    else ok('and the whole sitting walks through cleanly');
    if(errs.length) bad('messy pasted list', errs.join(' | '));
    await ctx.close();
  }

  // ---- 14. a second tab open on the same phone
  {
    console.log('\n14. a second tab');
    const ctx = await browser.newContext({...devices['iPhone 13'], isMobile:false,
                                          defaultBrowserType:'chromium'});
    const [p1, p2] = [await ctx.newPage(), await ctx.newPage()];
    for(const p of [p1, p2]){
      await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'));
      await p.waitForFunction(() => !!window.__acorn);
      await p.evaluate(() => window.__acorn.setToday('2026-08-01'));
    }
    await p1.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'x', name:'X', words:['rain','boat','light']}];
      a.state.words.activeId = 'x'; a.state.words.mastery = {}; a.save();
      a.start(); const s = a.session(); a.cover(); a.type(s.words[s.i]); a.check();
    });
    // The second tab reloads, so it sees the first tab's work rather than
    // overwriting it from a stale copy.
    await p2.reload();
    await p2.waitForFunction(() => !!window.__acorn);
    const sees = await p2.evaluate(() => Object.keys(window.__acorn.state.words.mastery));
    await p2.evaluate(() => window.__acorn.save());
    const after = await p1.evaluate(() =>
      Object.keys(JSON.parse(localStorage.getItem('acorn.v1')).words.mastery));
    console.log('    tab 2 sees ' + JSON.stringify(sees) + ', stored after its save ' + JSON.stringify(after));
    if(!after.length) bad('a second tab', 'wiped the first tab’s progress');
    else ok('a second tab that reloads does not wipe the first');
    await ctx.close();
  }

  // ---- 15. a whole session with no touchscreen at all
  {
    console.log('\n15. keyboard only, no taps');
    const {page, ctx, errs} = await fresh(browser, '2026-08-01');
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'w1', name:'T', words:['rain','boat','light']}];
      a.state.words.activeId = 'w1'; a.state.words.mastery = {}; a.state.words.sessions = [];
      a.save(); a.go('day'); a.start();
    });
    let stuck = null, steps = 0;
    for(; steps < 40; steps++){
      const st = await page.evaluate(() => {
        const s = window.__acorn.session();
        return {stage: s && s.stage, focus: document.activeElement.id || document.activeElement.className};
      });
      if(!st.stage) break;
      if(st.stage === 'write'){
        if(!await page.evaluate(() => document.activeElement.id === 'type')){
          stuck = 'the spelling box does not take focus (focus was ' + st.focus + ')'; break;
        }
        const w = await page.evaluate(() => { const s = window.__acorn.session(); return s.words[s.i]; });
        await page.keyboard.type(w);
        await page.keyboard.press('Enter');
        continue;
      }
      let reached = false;
      for(let t = 0; t < 8 && !reached; t++){
        if(/primary/.test(await page.evaluate(() => document.activeElement.className || ''))) reached = true;
        else await page.keyboard.press('Tab');
      }
      if(!reached){ stuck = 'could not reach the action by Tab at the ' + st.stage + ' stage'; break; }
      await page.keyboard.press('Enter');
    }
    if(stuck) bad('keyboard only', stuck);
    else ok('a whole session finishes with no taps at all (' + steps + ' steps)');
    const done = await page.evaluate(() => ({
      sessions: window.__acorn.state.words.sessions.length,
      boxes: Object.values(window.__acorn.state.words.mastery).map(m => m.box)}));
    if(done.sessions !== 1 || done.boxes.length !== 3)
      bad('keyboard only', 'the session did not record: ' + JSON.stringify(done));
    else ok('and it records exactly as a tapped one does');
    // The finished screen must not drop her back to the top of the document.
    const landed = await page.evaluate(() => document.activeElement.tagName);
    if(landed === 'BODY') bad('keyboard only', 'focus is lost on the finished screen');
    else ok('focus lands on a control when the session ends (' + landed + ')');
    if(errs.length) bad('keyboard only', errs.join(' | '));
    await ctx.close();
  }

  // ---- 16. every control reachable, and labelled, on every screen
  {
    console.log('\n16. nothing unreachable or unlabelled');
    const {page, ctx, errs} = await fresh(browser, '2026-08-01');
    for(const [where, stage] of [['day','look'], ['day','write'], ['day','check'], ['parent','-']]){
      await page.evaluate(o => {
        const a = window.__acorn;
        a.state.words.lists = [{id:'w1', name:'T', words:['because','rain','boat']}];
        a.state.words.activeId = 'w1';
        a.state.words.mastery = {said:{right:1, wrong:4, box:1, lastSeen:'2026-07-31'}};
        a.save();
        if(o.where === 'parent'){ a.go('parent'); return; }
        a.go('day'); a.start();
        if(o.stage === 'write') a.cover();
        if(o.stage === 'check'){ a.cover(); a.type('becuase'); a.check(); }
      }, {where, stage});
      const problems = await page.evaluate(() => {
        // A placeholder is not a name: it is grey hint text that disappears the
        // moment anything is typed, and screen readers are not required to use
        // it. Only a real label, aria-label or the control's own text counts.
        const labelled = el => !!(el.id && document.querySelector('#app label[for="' + el.id + '"]'));
        const out = [...document.querySelectorAll('#app button, #app input, #app textarea')].map(el => {
          const name = (el.getAttribute('aria-label') || el.textContent || '').trim();
          const r = el.getBoundingClientRect();
          if(!r.width || !r.height) return null;
          if(!name && !labelled(el)) return (el.id || el.className || el.tagName) + ' has no accessible name';
          if(el.tabIndex < 0) return (name || el.id) + ' cannot be reached by Tab';
          return null;
        }).filter(Boolean);
        // And a heading that looks like a label but labels nothing leaves the
        // controls under it anonymous — five On/Off pairs in a row with no way
        // to tell which setting each belongs to.
        [...document.querySelectorAll('#app label')].forEach(l => {
          const to = l.getAttribute('for');
          if(to && document.getElementById(to)) return;
          if(l.querySelector('input, textarea, select, button')) return;
          out.push('the label “' + l.textContent.trim() + '” labels nothing');
        });
        return out;
      });
      if(problems.length) bad('screen ' + where + '/' + stage, problems.join('; '));
    }
    if(!fails.length) ok('every control on every screen is named and tabbable');
    if(errs.length) bad('control audit', errs.join(' | '));
    await ctx.close();
  }

  // ---- 17. typing with the software keyboard up
  {
    console.log('\n17. the keyboard eating the screen');
    const ctx = await browser.newContext({viewport:{width:375, height:667}, deviceScaleFactor:2});
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'));
    await page.waitForFunction(() => !!window.__acorn);
    await page.evaluate(() => {
      const a = window.__acorn;
      a.setToday('2026-08-01'); a.state.settings.textScale = 1.5;
      a.state.words.lists = [{id:'w1', name:'T', words:['because','friend','thought']}];
      a.state.words.activeId = 'w1'; a.state.words.mastery = {}; a.state.words.sessions = [];
      a.save(); a.go('parent'); a.go('day'); a.cover();
    });
    // The keyboard sliding up and down, repeatedly, mid-word.
    let worst = null;
    for(const h of [360, 300, 240, 200, 300, 667, 240, 667]){
      await page.setViewportSize({width:375, height:h});
      await page.waitForTimeout(60);
      await page.locator('#type').fill('becau');
      const m = await page.evaluate(() => {
        const vh = window.innerHeight, main = document.querySelector('main');
        const acts = [...document.querySelectorAll('#act button')];
        const box = document.querySelector('#type');
        const br = box && box.getBoundingClientRect(), mr = main.getBoundingClientRect();
        return {box: !!br && br.top >= mr.top - 1 && br.bottom <= mr.bottom + 1,
                below: acts.filter(x => x.getBoundingClientRect().bottom > vh + 1).length,
                small: acts.filter(x => { const r = x.getBoundingClientRect();
                                          return r.width < 44 || r.height < 44; }).length,
                typed: box && box.value};
      });
      if(!m.box) worst = worst || ('at ' + h + 'px the box she types into is off screen');
      if(m.below) worst = worst || ('at ' + h + 'px an action is below the fold');
      if(m.small) worst = worst || ('at ' + h + 'px an action is under 44px');
      if(m.typed !== 'becau') worst = worst || ('at ' + h + 'px her half-typed word was lost');
    }
    if(worst) bad('the keyboard eating the screen', worst);
    else ok('the box and the action survive the keyboard sliding up and down');
    // and she can still finish the word
    await page.locator('#type').fill('because');
    await page.locator('#check').click();
    if(!await page.locator('.verdict.ok').count()) bad('keyboard', 'could not finish the word');
    else ok('and she can still finish it');
    if(errs.length) bad('keyboard', errs.join(' | '));
    await page.screenshot({path: OUT + '/break-17-keyboard.png'});
    await ctx.close();
  }

  // ---- 18. hostile and broken backups pasted into Restore
  {
    console.log('\n18. rubbish pasted into Restore');
    const {page, ctx, errs} = await fresh(browser, '2026-08-01');
    const seed = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'w1', name:'W', words:['because','friend']}];
      a.state.words.activeId = 'w1';
      a.state.words.mastery = {because:{right:3, wrong:1, box:3, lastSeen:'2026-07-20'}};
      a.state.words.sessions = [{date:'2026-07-30', list:'w1', asked:8, words:7, right:6, firstTime:5}];
      a.save();
      return JSON.stringify(a.state);
    });
    const PAYLOADS = [
      '', '   ', 'hello', '{', '[]', 'null', 'true', '"a string"',
      '{"words":null}', '{"words":"nope"}', '{"words":{}}',
      '{"words":{"mastery":"not an object","lists":"nope","sessions":5}}',
      '{"words":{"lists":[],"mastery":{},"sessions":[]},"settings":{"textScale":"huge"}}',
      '{"words":{"mastery":{"a":{"box":"nine","lastSeen":{}}},"lists":[]}}',
      '{"__proto__":{"polluted":true},"words":{"lists":[],"mastery":{}}}',
      '<script>window.__pwned=1</script>',
      seed.slice(0, Math.floor(seed.length * 0.5)),                 // truncated
      seed.replace(/\}$/, ''),                                      // one brace short
      '{"words":{"lists":[{"id":"x","name":"<img src=x onerror=window.__pwned=1>","words":["a"]}],' +
        '"activeId":"x","mastery":{}}}',
      JSON.stringify({words:{lists:[], mastery:{}, sessions:new Array(500).fill(0)
        .map((_, i) => ({date:'2026-01-01', asked:1, words:1, right:1, firstTime:1}))}}),
    ];
    let broke = null;
    for(const raw of PAYLOADS){
      await page.evaluate(() => window.__acorn.go('parent'));
      await page.locator('#restore').fill(raw);
      await page.locator('#restoreGo').click();
      await page.locator('#restoreGo').click().catch(() => {});
      if(!await alive(page)){ broke = 'blank screen after ' + JSON.stringify(raw.slice(0, 40)); break; }
      const st = await page.evaluate(() => {
        const a = window.__acorn;
        return {mastery: typeof a.state.words.mastery, lists: Array.isArray(a.state.words.lists),
                sessions: Array.isArray(a.state.words.sessions),
                pwned: !!window.__pwned, polluted: !!({}).polluted,
                usable: !!document.querySelector('#screen').children.length};
      });
      if(st.mastery !== 'object' || !st.lists || !st.sessions)
        { broke = 'state left malformed by ' + JSON.stringify(raw.slice(0, 40)); break; }
      if(st.pwned) { broke = 'script executed from ' + JSON.stringify(raw.slice(0, 40)); break; }
      if(st.polluted) { broke = 'prototype polluted by ' + JSON.stringify(raw.slice(0, 40)); break; }
      if(!st.usable) { broke = 'unusable screen after ' + JSON.stringify(raw.slice(0, 40)); break; }
    }
    if(broke) bad('rubbish pasted into Restore', broke);
    else ok(PAYLOADS.length + ' broken and hostile backups all refused safely');

    // And a real one still works after all that.
    await page.evaluate(() => { localStorage.clear(); window.__acorn.reset();
                                window.__acorn.go('parent'); });
    await page.locator('#restore').fill(seed);
    await page.locator('#restoreGo').click();
    await page.locator('#restoreGo').click();
    const back = await page.evaluate(() => Object.keys(window.__acorn.state.words.mastery));
    if(!back.includes('because')) bad('restore after rubbish', 'a good backup no longer restores');
    else ok('a good backup still restores afterwards');
    if(errs.length) bad('Restore', errs.join(' | '));
    await ctx.close();
  }

  // ---- 19. settings that no button could have produced
  {
    console.log('\n19. impossible settings in storage');
    const {page, ctx, errs} = await fresh(browser, '2026-08-01');
    // A hand-edited backup, a truncated write, another app's key. Every setting is
    // chosen by tapping a button that offers a fixed handful of values, so anything
    // else is corruption — and two of them brick the app rather than degrading it:
    // a stored textScale of 99 makes the root font 1683px, and the way back is a
    // long press on a mark that is now off the side of the screen.
    const CASES = {
      'textScale 99':      s => { s.settings.textScale = 99; },
      'textScale -4':      s => { s.settings.textScale = -4; },
      'textScale "big"':   s => { s.settings.textScale = 'big'; },
      'textScale 1.0001':  s => { s.settings.textScale = 1.0001; },
      'speechRate 100':    s => { s.settings.speechRate = 100; },
      'speechRate -1':     s => { s.settings.speechRate = -1; },
      'tint is markup':    s => { s.settings.tint = '"><script>window.__pwned=1</script>'; },
      'kbInset 100000':    s => { s.settings.kbInset = 100000; },
      'voice is rubbish':  s => { s.settings.voice = {nope:1}; },
      'settings is array': s => { s.settings = [1, 2, 3]; },
      'profile is null':   s => { s.profile = null; },
      'name is markup':    s => { s.profile.name = '<img src=x onerror="window.__pwned=1">'; },
      'name 300 chars':    s => { s.profile.name = 'A'.repeat(300); },
      'activeId nowhere':  s => { s.words.activeId = 'does-not-exist'; },
      'two lists one id':  s => { s.words.lists = [{id:'w1', name:'A', words:['said']},
                                                   {id:'w1', name:'B', words:['they']}];
                                  s.words.activeId = 'w1'; },
      'a list of dupes':   s => { s.words.lists = [{id:'w1', name:'A',
                                    words:['said','said','said','they']}];
                                  s.words.activeId = 'w1'; },
      'box 999':           s => { s.words.mastery = {said:{right:3, wrong:0, box:999,
                                                           lastSeen:'2026-07-01'}}; },
      'box -5':            s => { s.words.mastery = {said:{right:3, wrong:0, box:-5,
                                                           lastSeen:'2026-07-01'}}; },
      '5000 sessions':     s => { s.words.sessions = Array.from({length:5000}, () =>
                                    ({date:'2026-07-01', list:'easy', asked:9, words:8,
                                      firstTime:6})); },
      '400 lists':         s => { s.words.lists = Array.from({length:400}, (_, i) =>
                                    ({id:'w' + i, name:'L' + i, words:['said','they','went']}));
                                  s.words.activeId = 'w0'; },
    };
    let broke = 0;
    for(const name in CASES){
      await page.evaluate(() => { localStorage.clear(); });
      await page.reload();
      await page.waitForFunction(() => !!window.__acorn);
      await page.evaluate(src => {
        window.__acorn.save();
        const o = JSON.parse(localStorage.getItem('acorn.v1'));
        eval('(' + src + ')')(o);
        localStorage.setItem('acorn.v1', JSON.stringify(o));
      }, CASES[name].toString());
      await page.reload();
      let r = null;
      try{
        await page.waitForFunction(() => !!window.__acorn, null, {timeout:4000});
        r = await page.evaluate(() => {
          const a = window.__acorn;
          a.setToday('2026-08-01'); a.go('day'); a.go('parent'); a.go('day');
          const root = getComputedStyle(document.documentElement);
          const vw = document.documentElement.clientWidth;
          return {font: Math.round(parseFloat(root.fontSize)),
                  wide: document.documentElement.scrollWidth > vw + 1,
                  pwned: !!window.__pwned,
                  // Can a grown-up still get in and put it right?
                  wayIn: !!document.querySelector('#wordmark, .wordmark')};
        });
      }catch(e){ r = {threw: e.message}; }
      const why = !r ? 'nothing came back'
        : r.threw ? 'threw: ' + r.threw
        : r.pwned ? 'markup from storage ran'
        : (r.font > 40 || r.font < 10) ? 'root font became ' + r.font + 'px'
        : r.wide ? 'the screen scrolls sideways'
        : !r.wayIn ? 'the way in to the grown-ups screen is gone'
        : null;
      if(why){ bad('settings: ' + name, why); broke++; }
    }
    if(!broke) ok(Object.keys(CASES).length + ' impossible stored states all survived, readable and usable');
    if(errs.length) bad('impossible settings', errs.slice(0, 3).join(' | '));
    await ctx.close();
  }

  /* ---------------------------------------------------------------
     20. words that are also the names of things every object has
     --------------------------------------------------------------- */
  {
    console.log('\n20. words that are also property names');
    const {page, ctx, errs} = await fresh(browser, '2026-08-01');
    // Every object in JavaScript already answers to these, so a map keyed by her
    // words said "already met" for all of them before she had seen one. The word
    // was then dropped from every sitting and never asked. "__proto__" is worse:
    // assigning it moves an object's prototype instead of storing a value.
    const NAMES = ['constructor', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf',
                   'toLocaleString', 'propertyIsEnumerable', '__proto__', 'prototype'];
    let broke = 0;
    for(const name of NAMES){
      let r = null;
      try{
        // Through storage and a reload, which is the path a word really takes:
        // reaching in and replacing the map with a plain {} would be the test
        // creating the hole it then reports.
        await page.evaluate(w => {
          localStorage.setItem('acorn.v1', JSON.stringify({
            profile: {name:'', createdAt:'2026-07-01'},
            words: {lists:[{id:'p', name:'T', words:[w, 'rain']}], mastery:{},
                    activeId:'p', sessions:[]},
            settings: {textScale:1, tint:'cream', readAloud:true, sound:true, voice:null}
          }));
        }, name);
        await page.reload();
        await page.waitForFunction(() => !!window.__acorn);
        await page.evaluate(() => window.__acorn.setToday('2026-08-01'));
        r = await page.evaluate(w => {
          const a = window.__acorn;
          a.go('parent'); a.go('day');
          a.start();
          const W = a.session();
          if(!W) return {no: 'no sitting at all'};
          if(W.words.indexOf(w) < 0) return {no: 'the word was never asked: ' + JSON.stringify(W.words)};
          // Walk it right through to the end, and make sure it is recorded.
          for(let g = 0; g < 40 && a.session(); g++){
            const s = a.session();
            if(s.stage === 'look'){ a.cover(); continue; }
            if(s.stage === 'write'){ a.type(s.words[s.i]); a.check(); a.next(); continue; }
            a.next();
          }
          // And the cue, the syllable row and the progress numbers all survived it.
          const txt = document.querySelector('#screen').innerText;
          return {
            met: Object.prototype.hasOwnProperty.call(a.state.words.mastery, w),
            native: /native code|\[object /.test(txt),
            proto: Object.getPrototypeOf(a.state.words.mastery) !== null
          };
        }, name);
      }catch(e){ r = {threw: e.message}; }
      const why = !r ? 'nothing came back'
        : r.threw ? 'threw: ' + r.threw
        : r.no ? r.no
        : !r.met ? 'she answered it but it was never recorded'
        : r.native ? 'a native function was printed on her screen'
        : r.proto ? 'storing the word moved the prototype of what she knows'
        : null;
      if(why){ bad('property name: ' + name, why); broke++; }
    }
    if(!broke) ok(NAMES.length + ' words that collide with object internals were all asked and recorded');
    if(errs.length) bad('property names', errs.slice(0, 3).join(' | '));
    await ctx.close();
  }

  /* ---------------------------------------------------------------
     21. the smallest screen at the biggest text, with the longest words
     --------------------------------------------------------------- */
  {
    console.log('\n21. squeezed to the limit');
    // The corners of the space she can actually get into: the narrowest phone still
    // sold, every text size the buttons offer plus the smallest a restored backup can
    // carry, and words long enough to fill any line. The action that moves her on has
    // to stay on screen, stay tappable, and stay the thing Enter presses — this is
    // where --tap fell to 41px and a syllable chunk to 43px.
    const LONG = ['jewellery', 'television', 'experiment', 'straight', 'a'];
    let broke = 0;
    for(const width of [320, 360]){
      for(const scale of [0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.6]){
        const ctx = await browser.newContext({viewport: {width, height: 480},
                                              deviceScaleFactor: 1});
        const page = await ctx.newPage();
        const errs = [];
        page.on('pageerror', e => errs.push(String(e)));
        let r = null;
        try{
          await page.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'));
          await page.waitForFunction(() => !!window.__acorn);
          r = await page.evaluate(({s, ws}) => {
            const a = window.__acorn;
            a.setToday('2026-08-01');
            a.state.settings.textScale = s;
            a.state.words.lists = [{id: 'q', name: 'T', words: ws}];
            a.state.words.activeId = 'q';
            a.save(); a.go('parent'); a.go('day');
            if(!a.session()) a.start();
            const out = [];
            // Every stage of one word, at this size.
            for(let step = 0; step < 4; step++){
              const W = a.session();
              if(!W) break;
              const de = document.documentElement;
              const vh = de.clientHeight, vw = de.clientWidth;
              const act = document.querySelector('#act .primary')
                       || document.querySelector('#act button');
              const box = act && act.getBoundingClientRect();
              out.push({
                stage: W.stage,
                // Off the bottom, or off the side, and she cannot go on.
                offscreen: !box || box.bottom > vh + 1 || box.top < -1
                                || box.right > vw + 1 || box.left < -1,
                small: !box || box.width < 44 || box.height < 44,
                sideways: de.scrollWidth > vw + 1,
                // Anything tappable that has ended up under 44px.
                tiny: [...document.querySelectorAll('button')].filter(e => {
                  if(e.id === 'kbhold') return false;
                  const b = e.getBoundingClientRect();
                  return b.width && (b.width < 44 || b.height < 44);
                }).map(e => (e.id || e.className) + ' '
                          + Math.round(e.getBoundingClientRect().width) + 'x'
                          + Math.round(e.getBoundingClientRect().height)),
              });
              if(W.stage === 'look'){ a.cover(); continue; }
              if(W.stage === 'write'){ a.type('zz'); a.check(); continue; }
              a.next();
            }
            return out;
          }, {s: scale, ws: LONG});
        }catch(e){ r = [{threw: e.message}]; }
        const why = !r || !r.length ? 'no stage rendered at all'
          : r.find(x => x.threw) ? 'threw: ' + r.find(x => x.threw).threw
          : r.find(x => x.offscreen) ? 'the button that moves her on is off the screen at '
                                       + r.find(x => x.offscreen).stage
          : r.find(x => x.small) ? 'that button is under 44px at ' + r.find(x => x.small).stage
          : r.find(x => x.sideways) ? 'the screen scrolls sideways at ' + r.find(x => x.sideways).stage
          : r.find(x => x.tiny.length) ? 'too small to tap: '
                                         + r.find(x => x.tiny.length).tiny.join(', ')
          : null;
        if(why){ bad(`squeezed ${width}px at ${scale}x`, why); broke++; }
        if(errs.length){ bad(`squeezed ${width}px at ${scale}x`, errs[0]); broke++; }
        await ctx.close();
      }
    }
    if(!broke) ok('14 corners of screen size and text size all stayed usable');
  }

  /* ---------------------------------------------------------------
     22. no box is starved when the review queue is over-subscribed
     --------------------------------------------------------------- */
  {
    console.log('\n22. the review queue under overload');
    /* Measured over 120 days: the box intervals ask for about 21 reviews a day and a
       sitting is nine words, so the queue runs roughly 2x over-subscribed — and that
       is an equilibrium, not an accident. The pace controller adds new words until
       she is at her target accuracy, and the backlog is what that costs. Something
       has to be dropped every evening, so the question is not whether words run late
       but whether the lateness is shared out.

       overdueRatio() is what shares it: gap divided by the box's interval, highest
       first. Measured, every box comes out between 2.2x and 3.0x its interval — a
       word she knows well waits 60 days instead of 21, and a shaky one waits 6 days
       instead of 2, in the same proportion. Order by absolute days overdue instead
       and the long-interval words swallow every sitting; drop the ratio and they
       never come back at all. Both are one edit away, and neither shows up as a
       failure anywhere else, which is why this is here. */
    const {page, ctx, errs} = await fresh(browser, '2026-08-01');
    let r = null;
    try{
      r = await page.evaluate(days => {
        const a = window.__acorn;
        function hash(s){ let h = 2166136261;
          for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
          return (h >>> 0) / 4294967296; }
        const mem = {};
        const diff = w => Math.min(1, .25 + .45 * Math.min(1, Math.max(0, (w.length - 3) / 7))
                                       + .2 * hash(w));
        const recall = (w, d) => { const m = mem[w]; if(!m) return 0;
          return m.s * Math.exp(-(d - m.day) / (1.6 + 2.4 * m.s)); };
        const learn = (w, d, got) => { const m = mem[w] || (mem[w] = {s: 0, day: d});
          m.s = got ? Math.min(1, m.s + (1 - m.s) * (0.55 * (1 - diff(w)) + 0.35))
                    : Math.max(0, m.s * 0.94 + 0.10);
          m.day = d; };
        let seed = 20260801;
        const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

        localStorage.clear();
        a.state.words.mastery = {}; a.state.words.sessions = []; a.state.words.lists = [];
        a.state.words.activeId = 'easy'; a.save();
        const t0 = new Date('2026-08-01');
        const asks = [];                       // {word, day, boxWas}
        for(let d = 0; d < days; d++){
          a.setToday(new Date(t0.getTime() + d * 86400000).toISOString().slice(0, 10));
          a.go('parent'); a.go('day');
          if(!a.session()) a.start();
          for(let g = 0; g < 120 && a.session(); g++){
            const W = a.session(), w = W.words[W.i];
            if(W.stage === 'look'){ learn(w, d, true); a.cover(); continue; }
            if(W.stage === 'write'){
              asks.push({w: w, day: d, boxWas: a.mastery(w).box || 1});
              const got = rnd() < Math.min(0.99, recall(w, d) * 1.15 + 0.15);
              learn(w, d, got);
              a.type(got ? w : 'zzz'); a.check(); a.next(); continue;
            }
            a.next();
          }
        }
        // The gap before each ask, grouped by the box the word was sitting in.
        const lastAt = {}, byBox = {};
        asks.forEach(x => {
          if(lastAt[x.w] !== undefined) (byBox[x.boxWas] = byBox[x.boxWas] || []).push(x.day - lastAt[x.w]);
          lastAt[x.w] = x.day;
        });
        const med = xs => { const s = xs.slice().sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
        const rows = Object.keys(byBox).map(Number).sort((p, q) => p - q).map(b => ({
          box: b, n: byBox[b].length, interval: a.BOX_DAYS[b],
          lateness: a.BOX_DAYS[b] > 0 ? med(byBox[b]) / a.BOX_DAYS[b] : null,
        }));
        const met = Object.keys(a.state.words.mastery);
        return {
          rows: rows,
          met: met.length,
          asked: asks.length,
          // Every met word has to come back sometime. Nothing may be dropped for good.
          neverAgain: met.filter(w => (byBox[a.mastery(w).box || 1] || []).length === 0
                                     && asks.filter(x => x.w === w).length < 2).length,
          demand: met.reduce((n, w) => n + 1 / Math.max(1, a.BOX_DAYS[a.mastery(w).box || 1] || 1), 0),
        };
      }, 120);
    }catch(e){ r = {threw: e.message}; }

    /* Boxes 1 and 2 are the requeue's ground, not the review queue's: a word she has
       just missed comes back inside the same sitting, so its gap is 0 and its
       "lateness" is 0.0x however you measure it. That is the requeue working, so they
       are held to the opposite test below — that they are served fast — and the
       share-out is judged on the boxes whose intervals are actually days long. */
    const scored = r && r.rows ? r.rows.filter(x => x.lateness !== null && x.n >= 5
                                                   && x.interval >= 2) : [];
    const quick = r && r.rows ? r.rows.filter(x => x.interval <= 1 && x.n >= 5) : [];
    const late = scored.map(x => x.lateness);
    const why = !r ? 'nothing came back'
      : r.threw ? 'threw: ' + r.threw
      : r.met < 20 ? 'only ' + r.met + ' words were ever met, so nothing was over-subscribed'
      : r.demand < r.asked / 120 ? 'the queue was not over-subscribed (' + r.demand.toFixed(1)
                                   + ' a day wanted, ' + (r.asked / 120).toFixed(1) + ' asked)'
      : scored.length < 3 ? 'too few boxes saw real traffic to compare them'
      // A word she has just missed must come back quickly, not join the queue.
      : quick.some(x => x.lateness > 1) ? 'a word she just missed is being made to wait: '
          + quick.map(x => 'box ' + x.box + ' ' + x.lateness.toFixed(1) + 'x').join(', ')
      : r.neverAgain > 0 ? r.neverAgain + ' met words were asked once and then dropped for good'
      // The share-out. Every box between 1.5x and 5x, and no box more than three
      // times as late as another.
      : late.some(x => x < 1.5 || x > 5) ? 'a box is off on its own: '
          + scored.map(x => 'box ' + x.box + ' ' + x.lateness.toFixed(1) + 'x').join(', ')
      : Math.max(...late) / Math.min(...late) > 3 ? 'the lateness is not shared out: '
          + scored.map(x => 'box ' + x.box + ' ' + x.lateness.toFixed(1) + 'x').join(', ')
      : null;
    if(why) bad('review queue', why);
    else ok(r.met + ' words met, ' + r.demand.toFixed(0) + ' reviews a day wanted against '
            + (r.asked / 120).toFixed(0) + ' asked, and boxes '
            + scored.map(x => x.box).join('/') + ' all ran '
            + scored.map(x => x.lateness.toFixed(1) + 'x').join('/')
            + ' their interval — the lateness is shared, not dumped on one of them');
    if(errs.length) bad('review queue', errs.slice(0, 2).join(' | '));
    await ctx.close();
  }

  /* ---------------------------------------------------------------
     23. a grown-up meddling while she has a word on screen
     --------------------------------------------------------------- */
  {
    console.log('\n23. a grown-up meddling mid-word');
    /* Scenario 8 walks to the grown-ups screen and back without touching anything.
       This one uses it: the destructive buttons are all on that screen and she may
       well have a word up when someone goes looking. Whatever is done, she has to
       come back to a word she can actually be asked — and a change that is only
       cosmetic must not cost her the one she was on, because going back to the look
       stage shows her a spelling she had covered up and was writing from memory. */
    const MEDDLE = {
      'looks and leaves':      async () => {},
      'changes her text size': async page => { await page.locator('[data-sc="1.5"]').click(); },
      'changes the tint':      async page => { await page.locator('[data-tn="mint"]').click(); },
      'turns sound off':       async page => { await page.locator('[data-ra="0"]').click(); },
      'switches list':         async page => { await page.locator('[data-list="tricky"]').click(); },
      'saves a new list':      async page => {
        await page.locator('#paste').fill('zebra, kangaroo, wombat');
        await page.locator('#pname2').fill('New');
        await page.locator('#pasteSave').click(); },
      'deletes her list':      async page => {
        const d = page.locator('[data-del]').first();
        if(await d.count()){ await d.click(); await d.click(); } },
      'erases everything':     async page => {
        const b = page.locator('#reset');
        if(await b.count()){ await b.click(); await b.click(); } },
    };
    // A cosmetic change must leave her exactly where she was; the rest may rebuild.
    const COSMETIC = ['looks and leaves', 'changes her text size', 'changes the tint',
                      'turns sound off'];
    let broke = 0;
    for(const [name, fn] of Object.entries(MEDDLE)){
      const {page, ctx, errs} = await fresh(browser, '2026-08-01');
      let r = null;
      try{
        await page.evaluate(() => {
          const a = window.__acorn;
          a.state.words.lists = [{id:'w1', name:'Week 5', words:['said','went','rain']}];
          a.state.words.activeId = 'w1';
          a.state.words.mastery = {}; a.state.words.sessions = [];
          a.save(); a.go('day');
          if(!a.session()) a.start();
          if(a.session().stage === 'look') a.cover();      // covered up, writing from memory
        });
        await page.locator('#type').fill('sai');
        const before = await page.evaluate(() => {
          const s = window.__acorn.session();
          return {stage:s.stage, word:s.words[s.i], i:s.i, plan:s.plan};
        });
        await page.evaluate(() => window.__acorn.go('parent'));
        await fn(page);
        await page.evaluate(() => window.__acorn.go('day'));
        r = await page.evaluate(b => {
          const a = window.__acorn, s = a.session();
          return {
            before: b,
            after: s ? {stage:s.stage, word:s.words[s.i], i:s.i, plan:s.plan} : null,
            typed: (document.querySelector('#type') || {}).value || '',
            // Whatever she is looking at, it has to be a real word she can be asked.
            askable: s ? a.allWords().indexOf(s.words[s.i]) >= 0 : false,
            alive: !!document.querySelector('#screen')
                   && document.querySelector('#screen').children.length > 0,
            wayIn: !!document.querySelector('#wordmark, .wordmark'),
          };
        }, before);
      }catch(e){ r = {threw: e.message}; }
      const cosmetic = COSMETIC.indexOf(name) >= 0;
      const why = !r ? 'nothing came back'
        : r.threw ? 'threw: ' + r.threw
        : !r.alive ? 'she came back to an empty screen'
        : !r.after ? 'she came back to no word at all'
        : !r.askable ? 'she came back to "' + r.after.word + '", which is on no list'
        : !r.wayIn ? 'the way back to the grown-ups screen is gone'
        : cosmetic && r.after.stage !== r.before.stage
            ? 'a cosmetic change rewound her from ' + r.before.stage + ' to ' + r.after.stage
              + ', which shows her the spelling she was writing from memory'
        : cosmetic && r.after.word !== r.before.word
            ? 'a cosmetic change moved her from "' + r.before.word + '" to "' + r.after.word + '"'
        : cosmetic && r.typed !== 'sai'
            ? 'a cosmetic change threw away what she had typed (' + JSON.stringify(r.typed) + ')'
        : null;
      if(why){ bad('mid-word, a grown-up ' + name, why); broke++; }
      if(errs.length){ bad('mid-word, a grown-up ' + name, errs[0]); broke++; }
      await ctx.close();
    }
    if(!broke) ok(Object.keys(MEDDLE).length + ' things done to the app mid-word all handed'
                  + ' her back a word she can be asked, and the four harmless ones left'
                  + ' her exactly where she was');
  }

  /* ---------------------------------------------------------------
     24. every kind of text a clipboard can hand over
     --------------------------------------------------------------- */
  {
    console.log('\n24. hostile and exotic pasted lists');
    /* The list is the one thing a grown-up types into this app, and it arrives by paste
       from a school email, a PDF or a Word table. Whatever survives the parse becomes a
       word she is asked to spell every evening until she gets it right — so the bar is
       not "does not crash", it is "every saved word is a word she could actually write
       from hearing it". Two real defects came out of this path: zero-width characters
       merged a whole list into one twelve-letter non-word, and a precomposed accent was
       dropped entire, turning "cafe" into "caf". */
    /* Where the right answer is knowable, say what it is. "Every word is spellable" is
       not enough on its own: "saidtheywent" is twelve lowercase letters and "caf" is
       three, so both of the defects that sent me down this path passed that check. */
    const WANT = {
      'zero-width separated':  ['said', 'they', 'went'],
      'word joiners':          ['said', 'they', 'went'],
      'byte-order marks':      ['said', 'they'],
      'precomposed accents':   ['cafe', 'naive', 'facade'],
      'combining accents':     ['cafe', 'naive'],
      'full-width letters':    ['they'],          // full-width Latin is not typeable here
      'only punctuation':      [],
      'only invisibles':       [],
      'newlines only':         [],
    };
    const PASTES = {
      'zero-width separated':  'said\u200bthey\u200bwent',
      'word joiners':          'said\u2060they\u2060went',
      'byte-order marks':      '\ufeffsaid\ufeffthey',
      'precomposed accents':   'caf\u00e9, na\u00efve, fa\u00e7ade',
      'combining accents':     'cafe\u0301, nai\u0308ve',
      'right-to-left marks':   '\u200esaid\u200f, they',
      'combining overload':    'a\u0301\u0302\u0303\u0304said, rain',
      'emoji in the list':     'said 😀, they 🎉, went',
      'CJK and Cyrillic':      'said, \u4f60\u597d, \u043f\u0440\u0438, they',
      'full-width letters':    '\uff53\uff41\uff49\uff44, they',
      'a whole paragraph':     'This week we are learning said, they and went. Please '
                               + 'practise every night. Thank you!',
      'one very long token':   'a'.repeat(400) + ', said',
      'thousands of words':    Array.from({length: 900}, (_, i) => 'w' + i).join(', '),
      'only punctuation':      '.,;:!?-()[]{}',
      'only invisibles':       '\u200b\u200c\u200d\u2060\ufeff',
      'nul and controls':      'said\u0000they\u0001, went',
      'surrogate half':        'said\ud83d, they',
      'newlines only':         '\n\n\n\n',
    };
    let broke = 0;
    const {page, ctx, errs} = await fresh(browser, '2026-08-01');
    for(const [why, text] of Object.entries(PASTES)){
      let r = null;
      try{
        r = await page.evaluate(t => {
          const a = window.__acorn;
          a.state.words.lists = []; a.state.words.mastery = {}; a.state.words.sessions = [];
          a.state.words.activeId = 'easy'; a.save(); a.go('parent');
          const words = a.parseWordList(t);
          if(!words.length) return {words: words, saved: false};
          a.state.words.lists = [{id: 'p', name: 'Pasted', words: words}];
          a.state.words.activeId = 'p'; a.save();
          a.go('day');
          if(!a.session()) a.start();
          const s = a.session();
          // Walk the whole sitting: every word has to be askable and spellable.
          const shown = [];
          for(let g = 0; g < 60 && a.session(); g++){
            const W = a.session();
            shown.push(W.words[W.i]);
            if(W.stage === 'look'){ a.cover(); continue; }
            if(W.stage === 'write'){ a.type(W.words[W.i]); a.check(); a.next(); continue; }
            a.next();
          }
          return {words: words, saved: true, shown: [...new Set(shown)],
                  alive: !!document.querySelector('#screen')
                         && document.querySelector('#screen').children.length > 0,
                  screenText: (document.querySelector('#screen') || {}).innerText || ''};
        }, text);
      }catch(e){ r = {threw: e.message}; }

      // Every word saved must be spellable from hearing it: letters, and at most one
      // apostrophe or hyphen inside. Nothing invisible, nothing from another script.
      const bad = !r || r.threw ? [] : r.words.filter(w =>
        !/^[a-z]+(?:['-][a-z]+)*$/.test(w) || w.length < 2 || w.length > 24);
      const want = WANT[why];
      const why2 = !r ? 'nothing came back'
        : r.threw ? 'threw: ' + r.threw
        : bad.length ? 'saved ' + JSON.stringify(bad.slice(0, 3))
                       + ', which she cannot be asked to spell'
        : want && JSON.stringify(r.words) !== JSON.stringify(want)
            ? 'came out as ' + JSON.stringify(r.words) + ' rather than ' + JSON.stringify(want)
        : r.saved && !r.alive ? 'the sitting rendered an empty screen'
        : r.saved && /undefined|NaN|\[object/.test(r.screenText) ? 'printed rubbish on her screen'
        : null;
      if(why2){ bad2(why, why2); broke++; }
    }
    if(errs.length){ bad2('pasted lists', errs.slice(0, 2).join(' | ')); broke++; }
    if(!broke) ok(Object.keys(PASTES).length + ' kinds of pasted text all became words she'
                  + ' could be asked, or nothing at all');
    await ctx.close();
  }

  /* ---------------------------------------------------------------
     25. fitting the screen by emptying it
     --------------------------------------------------------------- */
  {
    console.log('\n25. a screen that fits because nothing is left on it');
    /* "It fits" and "there is something on it to read" are different claims, and the app
       only ever checked the first. fitScreen deletes until the panel fits, so a screen
       with every sentence taken off it passes every measurement in here — no overflow,
       no clipping, nothing off the edge. That is exactly what happened at 320px and her
       largest text: three syllable chips wrapped onto a second row, the shed list ran to
       the end, and she was left looking at a rust-coloured letter in the middle of her
       word with not one word anywhere telling her why.

       So the invariant is about order rather than outcome. Deleting the caption is
       allowed when there is genuinely no room for it — a four-chunk word at 320px and
       1.5x does not fit however it is squeezed. What is not allowed is deleting it
       before trying to make it smaller. If the verdict is gone, both shrink rungs must
       have been used first. */
    const WORDS = ['beautiful', 'because', 'remember', 'different', 'interesting', 'said'];
    let broke = 0, shedAnyway = 0, cases = 0;
    for(const [width, height] of [[320, 568], [360, 640], [390, 844], [320, 480],
                                  [568, 320], [740, 360]]){
      for(const scale of [0.8, 1, 1.3, 1.5, 1.6]){
        const ctx = await browser.newContext({viewport: {width, height}, deviceScaleFactor: 1});
        const page = await ctx.newPage();
        const errs = [];
        page.on('pageerror', e => errs.push(String(e)));
        try{
          await page.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'));
          await page.waitForFunction(() => !!window.__acorn);
          for(const word of WORDS){
            cases++;
            const r = await page.evaluate(({s, word}) => {
              const a = window.__acorn;
              const id = 'e' + (++window.__nth || (window.__nth = 1));
              a.state.settings.textScale = s;
              a.state.words.lists = [{id: id, name: 'T', words: [word, 'said', 'rain']}];
              a.state.words.activeId = id;
              a.state.words.mastery = {}; a.state.words.sessions = [];
              a.save(); a.go('day'); if(!a.session()) a.start();
              if(a.session().stage === 'look') a.cover();
              a.type(word.slice(0, -1) + 'z'); a.check();
              const m = document.querySelector('#screen');
              const on = sel => {
                const n = m.querySelector(sel);
                return !!n && getComputedStyle(n).display !== 'none';
              };
              /* Rendered, not merely display:block. In landscape at her largest text
                 data-cramped hides the whole .syls row, and a chip inside it still
                 reports display:inline-flex while measuring 0x0 — which read as five
                 tap targets under 44px until I looked at what they actually were. */
              const chips = [...m.querySelectorAll('.syl')]
                .filter(c => c.getClientRects().length > 0)
                .map(c => { const b = c.getBoundingClientRect();
                            return {t: c.textContent, w: b.width, h: b.height}; });
              return {
                verdict: on('.verdict'),
                word: on('.marked') || on('.word'),
                rung: document.documentElement.getAttribute('data-squeezed'),
                cramped: document.documentElement.hasAttribute('data-cramped'),
                chips: chips,
                small: chips.filter(c => c.w < 43.5 || c.h < 43.5).map(c => c.t),
                clipped: m.scrollHeight > m.clientHeight + 1,
                // Anything at all she can read, ignoring the buttons.
                words: (m.innerText || '').replace(/\s+/g, ' ').trim(),
              };
            }, {s: scale, word});
            const at = width + 'x' + height + ' @' + scale + ' "' + word + '"';
            const why = !r.word ? 'the word itself came off the screen'
              : r.clipped ? 'the screen is cut off'
              : r.small.length ? 'chip "' + r.small[0] + '" fell under the 44px target'
              : (!r.verdict && r.rung !== '2' && !r.cramped)
                  ? 'the verdict was deleted at rung ' + JSON.stringify(r.rung)
                    + ' — shrinking was still available and was not tried'
              : !r.words ? 'nothing readable is left on the screen at all'
              : null;
            if(why){ bad('screen emptied, ' + at, why); broke++; }
            if(!r.verdict) shedAnyway++;
          }
        }catch(e){ bad('screen emptied, ' + width + 'x' + height + ' @' + scale, 'threw: ' + e.message); broke++; }
        if(errs.length){ bad('screen emptied, ' + width + 'x' + height, errs[0]); broke++; }
        await ctx.close();
      }
    }
    if(!broke) ok(cases + ' verdict screens across six shapes and five text sizes each kept'
                  + ' her word, her chips and something to read — the ' + shedAnyway
                  + ' that still lost the caption had both shrink rungs used on them first');
  }

  /* ---------------------------------------------------------------
     26. a backup that has been round the houses
     --------------------------------------------------------------- */
  {
    console.log('\n26. restoring a backup that has been somewhere and come back');
    /* Scenario 18 pastes rubbish into Restore and checks the app survives it. This is the
       other half: text that IS hers, after a mail client has had it. The button beside
       Restore tells a grown-up to email it to themselves, so that journey is part of the
       feature, and it is the only route by which a year of her work comes home from a lost
       phone.

       The invariant is all-or-nothing. Whatever is pasted, exactly one of two things may
       happen: her state comes back byte for byte, or nothing on the device changes and she
       is told it could not be read. A third outcome — "Restored" over the top of her
       history with most of the history missing — is the worst of the three and is what a
       soft hyphen inside the text actually did, because a soft hyphen is legal inside a
       JSON string and turns "mastery" into a key nothing looks for. */
    const ROUNDS = {
      'untouched':            t => t,
      'quoted reply':         t => t.split('\n').map(l => '> ' + l).join('\n'),
      'quoted twice':         t => t.split('\n').map(l => '>> ' + l).join('\n'),
      'signature after it':   t => t + '\n\n--\nSent from my phone\n',
      'preamble before it':   t => 'here you go\n\n' + t,
      'smart quotes':         t => t.replace(/"/g, '“'),
      'non-breaking spaces':  t => t.replace(/ /g, ' '),
      'soft hyphens':         t => t.replace(/a/g, 'a­'),
      'zero-width spaces':    t => t.replace(/,/g, ',​'),
      'byte-order marks':     t => '﻿' + t.replace(/:/g, ':﻿'),
      'a whole forward':      t => 'Hi!\n\n' + t.replace(/"/g, '“').replace(/ /g, ' ')
                                     .split('\n').map(l => '> ' + l).join('\n')
                                     + '\n\n--\nSent from my iPhone\n',
      'wrapped tight':        t => t.replace(/(.{20})/g, '$1\n'),
      'truncated halfway':    t => t.slice(0, Math.floor(t.length / 2)),
      'doubled':              t => t + t,
      'an array of it':       t => '[' + t + ']',
      'array, smart-quoted':  t => ('[' + t + ']').replace(/"/g, '“'),
      'the closing brace off': t => t.replace(/\}\s*$/, ''),
      'nothing but braces':   () => '{ }',
      'someone else’s json':  () => '{"user":{"id":7},"items":[1,2,3]}',
      'a css file':           () => 'body { margin: 0 } .a { color: red }',
    };
    let broke = 0, cameBack = 0, refused = 0;
    const ctx = await browser.newContext({viewport: {width: 390, height: 844},
      permissions: ['clipboard-read', 'clipboard-write']});
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'));
    await page.waitForFunction(() => !!window.__acorn);
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.profile.name = 'Ivy';
      a.state.words.lists = [{id: 'r9', name: 'Week 9', words: ['said', 'they', 'beautiful']},
                             {id: 'r8', name: 'Week 8', words: ['rain', 'plain']}];
      a.state.words.activeId = 'r9';
      a.state.words.mastery = {said: {box: 5, right: 6, wrong: 1, last: '2026-07-30'},
                               they: {box: 3, right: 3, wrong: 2, last: '2026-07-30'},
                               rain: {box: 7, right: 9, wrong: 0, last: '2026-07-28'}};
      a.state.words.sessions = [{date: '2026-07-30', asked: 9, right: 8, words: 5,
                                 firstTime: 7, fresh: ['they'], grew: ['said'], slipped: []}];
      a.state.settings.textScale = 1.2;
      a.state.settings.tint = 'mint';
      a.save(); a.go('parent');
    });
    await page.click('#copy');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const mine = await page.evaluate(() => JSON.stringify(window.__acorn.state));
    if(!copied){
      bad('backup round trip', 'the Copy button put nothing on the clipboard'); broke++;
    }
    for(const [why, fn] of Object.entries(ROUNDS)){
      if(!copied) break;
      const text = fn(copied);
      // Something of hers on the device already, so a partial restore is visible.
      const held = await page.evaluate(m => {
        localStorage.setItem('acorn.v1', m);
        location.reload();
        return m;
      }, mine).catch(() => mine);
      await page.waitForFunction(() => !!window.__acorn);
      await page.evaluate(() => window.__acorn.go('parent'));
      const was = await page.evaluate(() => JSON.stringify(window.__acorn.state));
      await page.fill('#restore', text);
      await page.click('#restoreGo');
      if(await page.evaluate(() => !!document.querySelector('#restoreGo').dataset.armed))
        await page.click('#restoreGo');
      const r = await page.evaluate(() => ({
        state: JSON.stringify(window.__acorn.state),
        toast: (document.querySelector('#toast') || {}).textContent || '',
        alive: !!document.querySelector('#screen')
               && document.querySelector('#screen').children.length > 0,
      }));
      const said = /Restored/.test(r.toast);
      const why2 = !r.alive ? 'left an empty screen'
        : said && r.state !== mine
            ? 'said "Restored" but put back something else — '
              + Object.keys(JSON.parse(r.state).words.mastery).length + ' words instead of 3'
        : !said && r.state !== was
            ? 'refused it and changed the device anyway'
        : !said && !/does not look like|could not be restored|Paste the backup/.test(r.toast)
            ? 'neither restored nor said why not: ' + JSON.stringify(r.toast.slice(0, 60))
        : null;
      if(why2){ bad('backup, ' + why, why2); broke++; }
      if(said) cameBack++; else refused++;
      void held;
    }
    if(errs.length){ bad('backup round trip', errs[0]); broke++; }
    await ctx.close();
    if(!broke) ok(Object.keys(ROUNDS).length + ' journeys home: ' + cameBack + ' came back byte'
                  + ' for byte and ' + refused + ' were refused without touching the device —'
                  + ' none of them reported success over the top of her history');
  }

  await browser.close();
  console.log('\n' + (fails.length ? 'FAILURES (' + fails.length + '):\n  ' + fails.join('\n  ')
                                   : 'nothing broke'));
  process.exit(fails.length ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(2); });
