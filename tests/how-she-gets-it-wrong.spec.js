// The shapes a dyslexic nine-year-old's spelling actually takes.
//
// Not random junk: transpositions, b/d and p/q reversals, doubled letters, spelling it the
// way it sounds, and dropped syllables. Twenty-eight of those against the real engine, and
// one verdict of the six pointed at nothing.
//
// "So close — there's an extra bit in there." was shown over a word with no mark on it
// anywhere, because the marking marks letters of the word that are missing and in this case
// none are — every letter was in her answer, and the surplus is in her answer, which is the
// one thing this app never puts back in front of her. So she was told there was an extra bit
// and given no clue where. Two of the three cases that reach it are doubled letters, which is
// about the commonest slip there is.
const {test, expect} = require('@playwright/test');
const {open, errorsOf, write} = require('./helpers');

// [target, what she typed, what kind of slip, what she should be pointed at]
const SLIPS = [
  ['because',   'beacuse',   'transposition',     'c'],
  ['friend',    'freind',    'transposition',     'i'],
  ['their',     'thier',     'transposition',     'e'],
  ['beautiful', 'deautiful', 'b/d reversal',      'b'],
  ['plain',     'qlain',     'p/q reversal',      'p'],
  ['tomorrow',  'tommorow',  'missed a double',   'r'],
  ['different', 'diferent',  'missed a double',   'f'],
  ['really',    'realy',     'missed a double',   'l'],
  ['happened',  'happenned', 'doubled too many',  'n'],
  ['said',      'saidd',     'one letter too many', 'd'],
  ['together',  'togeather', 'a letter squeezed in', 'e'],
  ['remember',  'remeber',   'dropped a letter',  'm'],
  ['beautiful', 'beutiful',  'dropped a vowel',   'a'],
];

async function ask(page, target, typed){
  await page.evaluate(t => {
    const a = window.__acorn;
    const id = 'sl' + (++window.__nth || (window.__nth = 1));
    a.state.words.lists = [{id: id, name: 'T', words: [t, 'went']}];
    a.state.words.activeId = id;
    a.state.words.mastery = {}; a.state.words.sessions = [];
    a.save(); a.go('day'); if(!a.session()) a.start();
    if(a.session().stage === 'look') a.cover();
  }, target);
  await write(page, typed);
  await page.evaluate(() => window.__acorn.check());
  return page.evaluate(() => {
    const scr = document.querySelector('#screen');
    // A miss re-traces now (WIN-1): the correct word back in its box, the slipped letter marked
    // in orange (.slip) until she copies past it — instead of the old marked word with <u> under
    // the letter to fix. The letter pointed at is the same one, drawn a different way.
    const traced = scr.querySelector('.tracew');
    const v = scr.querySelector('.verdict');
    return {
      verdict: v ? v.textContent.replace(/\s+/g, ' ').trim() : '',
      look: traced ? [...traced.querySelectorAll('.slip')].map(s => s.textContent).join('') : '',
      shown: (traced || scr.querySelector('.word') || {}).textContent || '',
      screen: (scr.innerText || '').replace(/\s+/g, ' '),
      // The syllable chunks the seams are drawn under (they come from the correct word's split,
      // never from what she typed — the same guarantee the old chips had to meet).
      chunks: [...scr.querySelectorAll('.sylseg')].map(c => c.textContent),
    };
  });
}

test.describe('the mistakes she actually makes', () => {

  test('each one points her at the letter that matters', async ({page}) => {
    await open(page, '2026-08-01');
    for(const [target, typed, kind, want] of SLIPS){
      const r = await ask(page, target, typed);
      expect(r.look, `${kind}: "${typed}" for "${target}" pointed at ${JSON.stringify(r.look)}`)
        .toContain(want);
      expect(r.look.length, `${kind}: "${typed}" marks more than half of "${target}"`)
        .toBeLessThanOrEqual(Math.ceil(target.length / 2));
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('a surplus letter is pointed at too, not just named', async ({page}) => {
    /* The defect. These three are the ones where nothing is missing from the word, so the
       ordinary marking has nothing to catch — and the reply was a sentence with no mark
       under it. What gets marked is the letter of the word her extra one was added next to:
       walk the two together and the first character of hers the word cannot account for
       sits just after the letter to look at. */
    await open(page, '2026-08-01');
    for(const [target, typed, want] of [['said', 'saidd', 'd'],
                                        ['happened', 'happenned', 'n'],
                                        ['together', 'togeather', 'e'],
                                        ['went', 'wentt', 't'],
                                        ['rain', 'rrain', 'r']]){
      const r = await ask(page, target, typed);
      expect(r.verdict, `"${typed}" did not get the extra-bit verdict`).toMatch(/extra bit/);
      expect(r.look, `"${typed}" for "${target}" marked ${JSON.stringify(r.look)}`).toBe(want);
      expect(r.verdict, 'the verdict points at a mark that is not there').toMatch(/here/);
    }
  });

  test('and it is exactly one letter, never a smear across the word', async ({page}) => {
    await open(page, '2026-08-01');
    for(const [target, typed] of [['said', 'saidd'], ['happened', 'happenned'],
                                  ['together', 'togeather'], ['beautiful', 'beautifull']]){
      const r = await ask(page, target, typed);
      expect(r.look.length, `"${typed}" marked ${r.look.length} letters`).toBe(1);
    }
  });

  test('the word on the screen is always the right spelling', async ({page}) => {
    // The one thing that measurably sets spelling back. Every slip above, checked.
    await open(page, '2026-08-01');
    for(const [target, typed, kind] of SLIPS){
      const r = await ask(page, target, typed);
      expect(r.shown.replace(/\s/g, ''), `${kind}: the word shown was not "${target}"`)
        .toBe(target);
      expect(r.screen, `${kind}: her own spelling "${typed}" was on the screen`)
        .not.toContain(typed);
      for(const c of r.chunks)
        expect(typed.includes(c) && !target.includes(c), 'a syllable chunk came from her spelling')
          .toBe(false);
    }
  });

  test('a word barely recognisable is shown plainly rather than covered in marks',
    async ({page}) => {
    /* Below half matched, marking every letter says only "all of this is wrong", which
       helps nobody. These have to stay on the plain path — the fix above widened which
       verdicts get marked up, and this is the boundary it must not cross. */
    await open(page, '2026-08-01');
    for(const [target, typed] of [['was', 'saw'], ['because', 'becoz'],
                                  ['thought', 'fort'], ['said', 'zqx']]){
      const r = await ask(page, target, typed);
      expect(r.verdict, `"${typed}" for "${target}" was marked up instead of shown plainly`)
        .toMatch(/Here it is/);
      expect(r.look, `"${typed}" got marks anyway`).toBe('');
    }
  });

  test('none of it costs her more than one miss', async ({page}) => {
    // Whatever the shape of the slip, the bookkeeping is the same: one go, one miss,
    // seen again in a moment.
    await open(page, '2026-08-01');
    for(const [target, typed, kind] of SLIPS){
      await ask(page, target, typed);
      const r = await page.evaluate(t => {
        const a = window.__acorn;
        return {box: (a.state.words.mastery[t] || {}).box,
                wrong: (a.state.words.mastery[t] || {}).wrong,
                tries: a.session().tries,
                again: a.session().requeue.indexOf(t) >= 0
                       || a.session().failed.indexOf(t) >= 0};
      }, target);
      expect(r.box, `${kind}: "${target}" did not stay in the first box`).toBe(1);
      expect(r.wrong, `${kind}: recorded ${r.wrong} misses for one go`).toBe(1);
      expect(r.again, `${kind}: "${target}" was not queued to come back`).toBe(true);
    }
  });

  test('getting it right after a slip still counts, and reads kindly', async ({page}) => {
    await open(page, '2026-08-01');
    const r = await ask(page, 'because', 'beacuse');
    expect(r.verdict).toMatch(/So close/);
    /* The requeue puts it later in the sitting, not immediately — so walk forward to
       wherever it comes back rather than assuming the next screen is it. My first version
       assumed, typed "because" at the word "went", and read the resulting verdict as a
       failure of the thing it was testing. */
    for(let g = 0; g < 12; g++){
      await page.evaluate(() => window.__acorn.next());
      const at = await page.evaluate(() => {
        const a = window.__acorn, W = a.session();
        if(!W) return null;
        if(W.stage === 'look') a.cover();
        return W.words[W.i];
      });
      if(at === 'because') break;
      if(at === null) throw new Error('the sitting ended before it came back');
      await write(page, at);                    // get the filler words right
      await page.evaluate(() => window.__acorn.check());
    }
    expect(await page.evaluate(() =>
      window.__acorn.session().words[window.__acorn.session().i])).toBe('because');
    await write(page, 'because');
    await page.evaluate(() => window.__acorn.check());
    const after = await page.evaluate(() => ({
      verdict: document.querySelector('#screen .verdict').textContent.trim(),
      // Her record for this word, not the sitting's running total — which counts the
      // filler words got right on the way back round, as my first assertion forgot.
      mastery: window.__acorn.state.words.mastery.because,
      done: window.__acorn.session().done.indexOf('because') >= 0,
    }));
    expect(after.verdict, 'a word she came back and got is not acknowledged as such')
      .toBe('You got there.');
    expect(after.mastery.right, 'coming back and getting it did not count').toBe(1);
    expect(after.done, 'the word was not marked as finished').toBe(true);
  });

});
