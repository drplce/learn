// How good the syllable split is for a word nobody checked by hand.
//
// The hundred built-in words carry hand-checked splits, so syllables() only ever
// runs on what a grown-up pastes in — this week's list from school. The chunks are
// buttons that speak, so a wrong cut does not just look odd: the "an" of "animal"
// gets said as "ay".
//
// Scored against seventy Year 3-5 spelling words with the split from Macquarie and
// Oxford Learner's, none of them on a built-in list. This is a floor, not a target:
// it exists so a change to syllables() cannot quietly make her chunks worse.
const {test, expect} = require('@playwright/test');
const {open} = require('./helpers');

const REF = {
  animal:'an·i·mal', another:'an·oth·er', answer:'an·swer', autumn:'au·tumn',
  breakfast:'break·fast', calendar:'cal·en·dar', century:'cen·tu·ry',
  certain:'cer·tain', circle:'cir·cle', complete:'com·plete', continue:'con·tin·ue',
  describe:'de·scribe', develop:'de·vel·op', dinosaur:'di·no·saur',
  earth:'earth', eighth:'eighth', either:'ei·ther', enough:'e·nough',
  exercise:'ex·er·cise', experiment:'ex·per·i·ment', famous:'fa·mous',
  forward:'for·ward', fruit:'fruit', grammar:'gram·mar', guard:'guard',
  guide:'guide', history:'his·to·ry', imagine:'im·ag·ine', important:'im·por·tant',
  increase:'in·crease', island:'is·land', knowledge:'knowl·edge',
  learn:'learn', library:'li·brar·y', material:'ma·te·ri·al', medicine:'med·i·cine',
  mention:'men·tion', minute:'min·ute', natural:'nat·u·ral', naughty:'naugh·ty',
  notice:'no·tice', occasion:'oc·ca·sion', often:'of·ten', opposite:'op·po·site',
  ordinary:'or·di·nar·y', particular:'par·tic·u·lar', peculiar:'pe·cu·liar',
  popular:'pop·u·lar', position:'po·si·tion', possess:'pos·sess',
  potatoes:'po·ta·toes', pressure:'pres·sure', probably:'prob·a·bly',
  promise:'prom·ise', purpose:'pur·pose', quarter:'quar·ter', question:'ques·tion',
  reign:'reign', remember:'re·mem·ber', sentence:'sen·tence', special:'spe·cial',
  strength:'strength', suppose:'sup·pose', surprise:'sur·prise', therefore:'there·fore',
  though:'though', thumb:'thumb', various:'var·i·ous', weight:'weight', woman:'wom·an',
};

async function score(page){
  return page.evaluate(ref => {
    const rows = Object.keys(ref).map(w => ({
      w, want: ref[w], got: window.__acorn.syllables(w).join('·')}));
    return {
      n: rows.length,
      exact: rows.filter(r => r.got === r.want).length,
      sameCount: rows.filter(r =>
        r.got.split('·').length === r.want.split('·').length).length,
      wrongCount: rows.filter(r =>
        r.got.split('·').length !== r.want.split('·').length)
        .map(r => `${r.w}: ${r.got} not ${r.want}`),
      lost: rows.filter(r => r.got.replace(/·/g, '') !== r.w).map(r => r.w),
    };
  }, REF);
}

test.describe('splitting a word nobody checked by hand', () => {

  test('the pieces always spell the word back', async ({page}) => {
    // Whatever else it gets wrong, the chunks she is shown must be the word. A
    // dropped or duplicated letter here is a misspelling on her screen.
    await open(page, '2026-08-01');
    const r = await score(page);
    expect(r.lost, 'these chunks do not spell their word').toEqual([]);
  });

  test('the number of pieces is right for at least 95 of every 100', async ({page}) => {
    // Measured 69 of 70 (99%). The row of buttons and the count come from this,
    // so it is the number that shows.
    await open(page, '2026-08-01');
    const r = await score(page);
    const pct = 100 * r.sameCount / r.n;
    expect(pct, `only ${r.sameCount}/${r.n} had the right number: ${r.wrongCount.join(', ')}`)
      .toBeGreaterThanOrEqual(95);
  });

  test('the exact split is right for at least two thirds', async ({page}) => {
    /* Measured 48 of 70 (69%). The residual is one ambiguity and it cannot be
       resolved from spelling: a single consonant between two vowels closes the
       first syllable when its vowel is short ("an·i·mal", "pop·u·lar", "med·i·cine",
       "wom·an") and opens it when the vowel is long ("fa·mous", "no·tice",
       "li·brar·y", "po·ta·toes"). Nothing in the letters says which. The one rule
       that would fix the closed cases — never leave a lone vowel as the first
       chunk — breaks "a·bout", "a·gain", "e·ven", "o·pen" and "e·nough", which are
       commoner still, so it is not an improvement. A lexicon or a stress model is
       what this needs; a cleverer regex is not. */
    await open(page, '2026-08-01');
    const r = await score(page);
    const pct = 100 * r.exact / r.n;
    expect(pct, `only ${r.exact}/${r.n} split exactly`).toBeGreaterThanOrEqual(66);
  });

  test('every chunk is something a person could say', async ({page}) => {
    // A chunk with no vowel is a consonant cluster read out as a spelling, which is
    // the opposite of what the row is for.
    await open(page, '2026-08-01');
    const bad = await page.evaluate(ref => {
      const out = [];
      for(const w of Object.keys(ref)){
        const parts = window.__acorn.syllables(w);
        if(parts.length < 2) continue;              // a one-piece word is the word
        for(const p of parts) if(!/[aeiouy]/.test(p)) out.push(`${w} -> ${parts.join('·')}`);
      }
      return out;
    }, REF);
    expect(bad, 'chunks with no vowel in them').toEqual([]);
  });

  test('a hand-checked list is used as given, never re-derived', async ({page}) => {
    // The built-in splits are the authority for those words: "e·nough" is right and
    // syllables() would not get there on its own.
    await open(page, '2026-08-01');
    const r = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.activeId = 'tricky'; a.save();
      return {hand: a.splitOf('enough').join('·'), derived: a.syllables('enough').join('·')};
    });
    expect(r.hand).toBe('e·nough');
  });

});
