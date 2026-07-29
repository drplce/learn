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
      if(await page.locator('#next').count()){
        await page.locator('#next').click();
        if(await page.locator('#cover').count()) await page.locator('#cover').click();
      }else if(v.trim()){
        bad('answer ' + JSON.stringify(v.slice(0, 20)), 'was accepted but offered no way on');
      }else{
        // blank: she should still be on the same word, untouched
        const after = await page.evaluate(() => window.__acorn.session().i);
        if(after !== before) bad('blank answer', 'moved her on anyway');
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
      const problems = await page.evaluate(() =>
        [...document.querySelectorAll('#app button, #app input, #app textarea')].map(el => {
          const name = (el.getAttribute('aria-label') || el.textContent || el.placeholder || '').trim();
          const r = el.getBoundingClientRect();
          if(!r.width || !r.height) return null;
          if(!name) return (el.id || el.className || el.tagName) + ' has no accessible name';
          if(el.tabIndex < 0) return name + ' cannot be reached by Tab';
          return null;
        }).filter(Boolean));
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

  await browser.close();
  console.log('\n' + (fails.length ? 'FAILURES (' + fails.length + '):\n  ' + fails.join('\n  ')
                                   : 'nothing broke'));
  process.exit(fails.length ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(2); });
