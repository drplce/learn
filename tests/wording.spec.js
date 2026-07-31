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
      head: (document.querySelector('#screen .headline') || {}).textContent || '',
      cheer: (document.querySelector('#screen .cheer') || {}).textContent || '',
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
    expect(r.head, `claimed roots on a nothing-right evening: "${r.head}"`)
      .not.toMatch(/took root/);
    expect(r.said).not.toMatch(/took root/);
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
    expect(r.head).toMatch(/^One took root tonight\.$/);
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
      return (document.querySelector('#screen .headline') || {}).textContent || '';
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
    // Every state she can reach, harvested and swept. The engine records "wrong" and
    // that is fine; she must never read it.
    await open(page, '2026-08-01');
    const BANNED = /\b(wrong|incorrect|failed|fail|error|mistake|bad|oops|no good|try harder|should have)\b/i;
    const seen = [];
    const STATES = [
      'if(!a.session()) a.start();',
      'if(!a.session()) a.start(); a.cover();',
      'if(!a.session()) a.start(); a.cover(); a.check();',
      'if(!a.session()) a.start(); a.cover(); a.type("zzz"); a.check();',
      'if(!a.session()) a.start(); a.cover(); a.type("siad"); a.check();',
      'if(!a.session()) a.start(); a.cover(); a.type(a.session().words[a.session().i]); a.check();',
      'if(!a.session()) a.start(); for(let g=0;g<90&&a.session();g++){const W=a.session();' +
        'if(W.stage==="look"){a.cover();continue;}' +
        'if(W.stage==="write"){a.type("zzz");a.check();a.next();continue;} a.next();}',
      'if(!a.session()) a.start(); for(let g=0;g<90&&a.session();g++){const W=a.session();' +
        'if(W.stage==="look"){a.cover();continue;}' +
        'if(W.stage==="write"){a.type(W.words[W.i]);a.check();a.next();continue;} a.next();}',
    ];
    for(const src of STATES){
      const txt = await page.evaluate(s => {
        const a = window.__acorn;
        a.state.words.lists = [{id: 'x', name: 'T', words: ['said', 'thought', 'rain']}];
        a.state.words.activeId = 'x';
        a.state.words.mastery = {}; a.state.words.sessions = [];
        a.save(); a.go('parent'); a.go('day');
        new Function('a', s)(a);
        return [(document.querySelector('#screen') || {}).innerText || '',
                (document.querySelector('#act') || {}).innerText || '',
                (document.querySelector('#say') || {}).textContent || '',
                (document.querySelector('#toast') || {}).textContent || ''].join(' — ');
      }, src);
      if(BANNED.test(txt)) seen.push(txt.match(BANNED)[0] + '  in: ' + txt.slice(0, 90));
    }
    expect(seen).toEqual([]);
  });

  test('her own spelling is never on the screen or in the announcement', async ({page}) => {
    await open(page, '2026-08-01');
    for(const typed of ['siad', 'thort', 'togeather', 'zzz', 'SAID', 'sa id']){
      const txt = await page.evaluate(t => {
        const a = window.__acorn;
        a.state.words.lists = [{id: 'x', name: 'T', words: ['said']}];
        a.state.words.activeId = 'x';
        a.state.words.mastery = {}; a.state.words.sessions = [];
        a.save(); a.go('parent'); a.go('day');
        if(!a.session()) a.start();
        if(a.session().stage === 'look') a.cover();
        a.type(t); a.check();
        return [(document.querySelector('#screen') || {}).innerText || '',
                (document.querySelector('#say') || {}).textContent || ''].join(' ');
      }, typed);
      // "said" itself is on screen, correctly, so only look for the misspelling.
      if(typed.toLowerCase() !== 'said')
        expect(txt.toLowerCase(), `her own "${typed}" came back at her`)
          .not.toContain(typed.toLowerCase());
    }
    expect(errorsOf(page)).toEqual([]);
  });

});
