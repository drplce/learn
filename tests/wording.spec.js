// What the words claim, and whether it is true.
//
// A wording pass, driven rather than read: every state she or a grown-up can reach,
// with the real strings harvested out of the rendered page. Three things it caught —
// a line that told her words had taken root on an evening she got everything wrong,
// a promise that she would see a word again when the sitting was about to end, and
// "1 words met".
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

// Plays a whole sitting, answering by a function of the word.
async function sitAnswering(page, words, answer){
  return page.evaluate(({ws, ans}) => {
    const a = window.__acorn;
    const f = new Function('w', 'i', ans);
    a.state.words.lists = [{id: 'x', name: 'T', words: ws}];
    a.state.words.activeId = 'x';
    a.state.words.mastery = {}; a.state.words.sessions = [];
    a.save(); a.go('parent'); a.go('day');
    if(!a.session()) a.start();
    let i = 0;
    for(let g = 0; g < 90 && a.session(); g++){
      const W = a.session();
      if(W.stage === 'look'){ a.cover(); continue; }
      if(W.stage === 'write'){ a.type(f(W.words[W.i], i++)); a.check(); a.next(); continue; }
      a.next();
    }
    return {
      // The finished map screen is wordless now (David) — the line that used to head it and the
      // praise beneath it are spoken, not drawn, so what tonight claimed is read off #say.
      said: (document.querySelector('#say') || {}).textContent || '',
      flourishing: document.querySelectorAll('#screen .net-cell.arriving').length,
      cells: document.querySelectorAll('#screen .net-cell').length,
    };
  }, {ws: words, ans: answer});
}

test.describe('what the words claim', () => {

  test('nothing took root on an evening she got everything wrong', async ({page}) => {
    await open(page, '2026-08-01');
    // She met three words and never got one of them. "Three took root tonight" was
    // the line, on the one evening a false claim does the most harm.
    const r = await sitAnswering(page, ['said', 'went', 'rain'], 'return "zzz";');
    expect(r.said, `claimed roots on a nothing-right evening: "${r.said}"`)
      .not.toMatch(/took root/);
    // And nothing flourishes, because nothing was earned.
    expect(r.flourishing).toBe(0);
    // The shapes are still there — she did meet the words, and the map says so.
    expect(r.cells).toBeGreaterThan(0);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a word she got right does take root, and only it', async ({page}) => {
    await open(page, '2026-08-01');
    // First word right, the rest wrong. One took root, not three.
    const r = await sitAnswering(page, ['said', 'went', 'rain'],
                                 'return w === "said" ? "said" : "zzz";');
    expect(r.said).toMatch(/One took root tonight\./);
    expect(r.flourishing, 'the number and the shapes that flourish disagree').toBe(1);
  });

  test('and getting there after a miss still counts', async ({page}) => {
    // A brand-new word missed once and got on the second go has been learned, even
    // though it does not climb a box that evening.
    await open(page, '2026-08-01');
    const r = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id: 'x', name: 'T', words: ['said']}];
      a.state.words.activeId = 'x';
      a.state.words.mastery = {}; a.state.words.sessions = [];
      a.save(); a.go('parent'); a.go('day');
      if(!a.session()) a.start();
      let missed = false;
      for(let g = 0; g < 30 && a.session(); g++){
        const W = a.session();
        if(W.stage === 'look'){ a.cover(); continue; }
        if(W.stage === 'write'){
          if(!missed){ a.type('zzz'); missed = true; } else a.type(W.words[W.i]);
          a.check(); a.next(); continue;
        }
        a.next();
      }
      return (document.querySelector('#say') || {}).textContent || '';
    });
    expect(r).toMatch(/One took root tonight\./);
  });

  test('a missed word comes back only when it really will', async ({page}) => {
    /* The re-trace (WIN-1) replaced the old "You'll see this one again in a moment / soon" note —
       the trace page carries no such line — so the honesty this protected now lives in the model,
       not a caption: a non-final miss is requeued for a real from-memory go later this sitting;
       the last attempt at the last word is not requeued (nothing false is promised), and it still
       comes back next sitting because a miss drops the word to box 1 (recorded wrong). */
    await open(page, '2026-08-01');
    const rows = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id: 'x', name: 'T', words: ['said', 'went', 'rain']}];
      a.state.words.activeId = 'x';
      a.state.words.mastery = {}; a.state.words.sessions = [];
      a.save(); a.go('parent'); a.go('day');
      if(!a.session()) a.start();
      const out = [];
      for(let g = 0; g < 40 && a.session(); g++){
        const W = a.session();
        const isLast = (W.i + 1 >= W.words.length) && !W.requeue.length;
        const alreadyFailed = (W.failed || []).indexOf(W.words[W.i]) >= 0;
        if(W.stage === 'look'){ a.cover(); continue; }
        if(W.stage === 'write'){
          const word = W.words[W.i];
          a.type(word.slice(0, -1) + 'z');            // always a miss
          a.check();
          const s = a.session() || {};
          out.push({word: word, isLast: isLast, alreadyFailed: alreadyFailed,
                    comingBack: (s.requeue || []).indexOf(word) >= 0,
                    wrongRecorded: (a.mastery(word).wrong || 0) > 0});
          a.next();                                    // past the re-trace, via the API
          continue;
        }
        a.next();
      }
      return out;
    });
    // The first miss of a word that is not the very last thing left is requeued for a real go
    // later this sitting. (A second miss of a word already down is not re-requeued — it is
    // already coming back — so only first misses carry the promise.)
    const brought = rows.filter(r => !r.isLast && !r.alreadyFailed);
    expect(brought.length, 'no first, non-final miss to check').toBeGreaterThan(0);
    for(const r of brought)
      expect(r.comingBack, `a first non-final miss of "${r.word}" was not requeued`).toBe(true);
    // The last attempt at the last word is not requeued — nothing false is promised — but a miss
    // still drops the word to box 1, so it comes back next sitting.
    const finals = rows.filter(r => r.isLast);
    expect(finals.length, 'no final miss to check').toBeGreaterThan(0);
    for(const r of finals){
      expect(r.comingBack, `the last attempt at "${r.word}" falsely requeued`).toBe(false);
      expect(r.wrongRecorded,
        `the last miss of "${r.word}" was not recorded to bring it back next sitting`).toBe(true);
    }
  });

  test('every count on the grown-ups screen agrees with its noun', async ({page}) => {
    await open(page, '2026-08-01');
    for(const n of [0, 1, 2]){
      const stats = await page.evaluate(k => {
        const a = window.__acorn;
        const words = ['said', 'went', 'rain'].slice(0, Math.max(k, 1));
        a.state.words.lists = [{id: 'x', name: 'T', words: words}];
        a.state.words.activeId = 'x';
        a.state.words.mastery = {}; a.state.words.sessions = [];
        for(let i = 0; i < k; i++){
          a.state.words.mastery[words[i]] = {right: 5, wrong: 0, box: 5, lastSeen: '2026-07-30'};
          a.state.words.sessions.push({date: '2026-07-2' + i, asked: 4, right: 4, words: 4,
                                       firstTime: 4, fresh: [], grew: [], slipped: []});
        }
        a.save(); a.go('parent');
        return [...document.querySelectorAll('.stat')].map(s => s.innerText.replace(/\n/g, ' '));
      }, n);
      for(const s of stats){
        const m = s.match(/^(\d+) (.+)$/);
        if(!m) continue;
        const [, num, label] = m;
        // A label with no noun ("known well", "played") has nothing to agree with.
        if(!/\b(word|words|sitting|sittings|session|sessions|list|lists)\b/.test(label)) continue;
        if(Number(num) === 1)
          expect(label, `"${s}" is plural for one`).not.toMatch(/\b(words|sittings|sessions|lists)\b/);
        else
          expect(label, `"${s}" is singular for ${num}`).not.toMatch(/\b(word|sitting|session|list) /);
      }
    }
  });

  test('nothing she reads calls it wrong, failed, or her fault', async ({page}) => {
    /* The engine records "wrong" and that is fine; she must never read it.

       The state list used to be eight strings of one shape — one list, one fresh sitting,
       the word screen. That is the same gap `contrast.spec.js` had on 2026-10-27: a
       hand-picked set of states, thorough within itself, silent about everything outside
       it. Widened 2026-11-06 to the states she can actually land in, including the three
       that only exist when something has gone sideways for her: a fumbled submit, a phone
       that spelled the word for her, and a grown-up who has left her an empty list.

       Each state proves it reached the state it names before its words are read. Twice in
       the last fortnight this routine has read a screen without checking which screen it
       was — once nearly reporting a correct one as a defect, once accusing the app of a
       rollover bug that was the fixture's. A sweep over states that silently failed to
       build would be a green that means nothing. */
    await open(page, '2026-08-01');
    const BANNED = /\b(wrong|incorrect|failed|fail|error|mistake|bad|oops|no good|try harder|should have)\b/i;
    const W3 = ['said', 'thought', 'rain'];
    const ALL = 'for(let g=0;g<90&&a.session();g++){const W=a.session();'
              + 'if(W.stage==="look"){a.cover();continue;}'
              + 'if(W.stage==="write"){a.type(ANS);a.check();a.next();continue;} a.next();}';
    const STATES = [
      {name: 'the trace', words: W3, drive: 'if(!a.session()) a.start();',
       want: r => r.stage === 'look'},
      {name: 'the write box', words: W3, drive: 'if(!a.session()) a.start(); a.cover();',
       want: r => r.stage === 'write' && r.toast === '' && r.tries === 0},
      {name: 'a fumbled submit with nothing in the box', words: W3,
       drive: 'if(!a.session()) a.start(); a.cover(); a.check();',
       want: r => r.stage === 'write' && r.tries === 0 && r.toast !== ''},
      {name: 'a submit of a single stray full stop', words: W3,
       drive: 'if(!a.session()) a.start(); a.cover(); a.type("."); a.check();',
       want: r => r.stage === 'write' && r.tries === 0 && r.toast !== ''},
      {name: 'a miss nothing like the word', words: W3,
       drive: 'if(!a.session()) a.start(); a.cover(); a.type("zzz"); a.check();',
       want: r => r.stage === 'check' && r.tries > 0 && r.right === 0},
      {name: 'a near miss', words: ['said'],
       drive: 'if(!a.session()) a.start(); a.cover(); a.type("siad"); a.check();',
       want: r => r.stage === 'check' && r.tries > 0 && r.right === 0},
      {name: 'the mark left off a contraction', words: ["don't"],
       drive: 'if(!a.session()) a.start(); a.cover(); a.type("dont"); a.check();',
       want: r => r.stage === 'check' && r.tries > 0 && r.right === 0},
      {name: 'right first go', words: W3,
       drive: 'if(!a.session()) a.start(); a.cover(); a.type(a.session().words[a.session().i]); a.check();',
       want: r => r.stage === 'check' && r.right > 0},
      {name: 'the word a miss sends back to her', words: ['said'],
       /* A miss does not advance: the word is requeued and she copies it. `retrace` is
          true on the verdict itself, and the next step is the same word again at i+1 —
          measured, not assumed; the first version of this state looked for `retrace`
          after `next()` and found a plain write box. */
       drive: 'if(!a.session()) a.start(); a.cover(); a.type("zzz"); a.check(); a.next();',
       want: r => r.stage === 'write' && r.i === 1 && r.words === 2},
      {name: 'getting there after a miss', words: ['said'],
       drive: 'if(!a.session()) a.start(); a.cover(); a.type("zzz"); a.check(); a.next();'
            + ' a.cover(); a.type("said"); a.check();',
       want: r => r.stage === 'check' && r.right > 0 && r.i === 1},
      {name: 'the word her phone spelled for her', words: ['said'],
       /* The hand-back clears `notWritten` on its way out and says the word through the
          phone's voice, not through the live region — "nothing on the screen" is the whole
          design of it. So the marker is the box: full when she submitted, empty after,
          with nothing counted. A fumbled submit leaves the box alone and raises a toast,
          and an ordinary write box was never filled, so no other state looks like this. */
       drive: 'a.state.settings.sawKeys = true; a.save();'
            + ' if(!a.session()) a.start(); a.cover(); a.type("said");'
            + ' window.__box0 = document.querySelector("#type").value; a.check();',
       want: r => r.stage === 'write' && r.tries === 0 && r.toast === ''
                  && r.box0 === 'said' && r.box === ''},
      {name: 'the garden at the end of a perfect evening', words: W3,
       /* Wordless since 13.37: the map case renders only the garden, and the line and the
          praise go to the spoken channel. So the premise is the picture, not any text. */
       drive: 'if(!a.session()) a.start(); ' + ALL.replace('ANS', 'W.words[W.i]'),
       want: r => r.stage === null && r.svg > 0},
      {name: 'the garden at the end of an evening she missed everything', words: W3,
       drive: 'if(!a.session()) a.start(); ' + ALL.replace('ANS', '"zzz"'),
       want: r => r.stage === null && r.svg > 0},
      {name: 'the dead end a grown-up left her on', words: [],
       /* An empty list of her own, not no list: the app ships seven built-in lists and
          clearing `state.words.lists` just falls back to those. */
       drive: '', want: r => r.stage === null && /no words/i.test(r.screenText)},
      {name: 'her birthday', words: W3, today: '2026-08-05',
       /* showBirthday() is a no-op off the day, so the fixture has to BE the day. */
       drive: 'if(!a.session()) a.start(); a.showBirthday();',
       want: r => /happy birthday/i.test(r.bodyText)},
    ];
    const wrong = [], unbuilt = [];
    for(const st of STATES){
      const r = await page.evaluate(({ws, src, day}) => {
        const a = window.__acorn;
        a.clearBirthday();
        a.setToday(day);
        // An empty list of her OWN is the dead end; `lists: []` falls back to the built-ins.
        a.state.words.lists = [{id: 'x', name: 'T', words: ws}];
        a.state.words.activeId = 'x';
        a.state.words.mastery = {}; a.state.words.sessions = [];
        a.state.settings.sawKeys = false;
        a.clearSession(); a.save(); a.go('parent'); a.go('day');
        // Both of these keep their text after they have had their moment, so a stale one
        // would be read as this state's and a state would be judged on last state's words.
        const el = id => document.querySelector(id) || {};
        el('#toast').textContent = ''; el('#say').textContent = '';
        window.__box0 = null;
        if(src) new Function('a', src)(a);
        const S = a.session();
        return {stage: S ? S.stage : null, tries: S ? S.tries : 0, right: S ? S.right : 0,
                i: S ? S.i : -1, words: S ? S.words.length : 0,
                box: el('#type').value === undefined ? null : el('#type').value,
                box0: window.__box0, svg: document.querySelectorAll('#screen svg').length,
                screenText: (el('#screen').innerText || '').trim(),
                /* Harvest the whole rendered body, not four chosen ids: the birthday
                   overlay is a fixed-position child of the body and nothing in the old
                   list would have seen a word of it. innerText skips what is not
                   rendered, so a hidden screen cannot contribute. */
                bodyText: (document.body.innerText || ''),
                toast: (el('#toast').textContent || '').trim(),
                say: (el('#say').textContent || '').trim()};
      }, {ws: st.words, src: st.drive, day: st.today || '2026-08-01'});
      if(!st.want(r)) unbuilt.push(st.name + ' — ' + JSON.stringify(r).slice(0, 180));
      const txt = [r.bodyText, r.toast, r.say].join(' — ');
      if(BANNED.test(txt)) wrong.push(st.name + ': "' + txt.match(BANNED)[0] + '" in: '
                                      + txt.replace(/\s+/g, ' ').slice(0, 120));
    }
    expect(unbuilt, 'a state did not build, so its words were never really read').toEqual([]);
    expect(wrong).toEqual([]);
    expect(errorsOf(page)).toEqual([]);
  });

  test('her own spelling is never on the screen or in the announcement', async ({page}) => {
    /* Widened 2026-11-06 past the verdict. The verdict is the obvious place for her
       attempt to come back at her, and it was the only place this looked — but a miss does
       not end there: she is handed the word again to copy, and then the evening ends. Both
       of those render after the attempt was taken, and neither was being read.

       The typos are deliberately not substrings of "said": the check is `not.toContain`,
       and the correct word is on the screen on purpose, so "sai" would fail against a
       perfectly good screen. Said here rather than left as a trap for whoever adds the
       next one. */
    await open(page, '2026-08-01');
    for(const typed of ['siad', 'thort', 'togeather', 'zzz', 'sa id', 'saiiid']){
      const seen = await page.evaluate(t => {
        const a = window.__acorn;
        const read = () => [(document.querySelector('#screen') || {}).innerText || '',
                            (document.querySelector('#say') || {}).textContent || '',
                            (document.querySelector('#toast') || {}).textContent || '',
                            (document.querySelector('#type') || {}).value || ''].join(' ');
        a.state.words.lists = [{id: 'x', name: 'T', words: ['said']}];
        a.state.words.activeId = 'x';
        a.state.words.mastery = {}; a.state.words.sessions = [];
        a.clearSession(); a.save(); a.go('parent'); a.go('day');
        if(!a.session()) a.start();
        if(a.session().stage === 'look') a.cover();
        a.type(t); a.check();
        const out = {verdict: read()};
        a.next();                              // the word handed back to her to copy
        out.again = read();
        for(let g = 0; g < 20 && a.session(); g++){     // and on to the end of the evening
          const W = a.session();
          if(W.stage === 'look'){ a.cover(); continue; }
          if(W.stage === 'write'){ a.type(W.words[W.i]); a.check(); a.next(); continue; }
          a.next();
        }
        out.finished = read();
        out.stillGoing = !!a.session();
        return out;
      }, typed);
      // The premise: these really are three different screens, not one screen read thrice.
      expect(seen.stillGoing, 'the evening never ended, so the last read was not the garden')
        .toBe(false);
      for(const where of ['verdict', 'again', 'finished'])
        expect(seen[where].toLowerCase(), `her own "${typed}" came back at her on ${where}`)
          .not.toContain(typed.toLowerCase());
    }
    expect(errorsOf(page)).toEqual([]);
  });

});
