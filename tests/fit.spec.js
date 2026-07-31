// Nothing she is shown is ever half shown.
//
// main scrolls internally, so content that does not fit is silently cut rather
// than pushed off the page — and a nine-year-old does not know to scroll a
// screen that looks finished. On a small phone at large text this was cutting
// "You'll see this one again in a moment." after "again", and on a 320px phone
// it was cutting the syllable chips, which are the most useful thing on the
// screen she was looking at.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

// Every phone the app is likely to meet, including the small old one.
const PHONES = {
  'iPhone SE': {width: 375, height: 667},
  'iPhone 13': {width: 390, height: 844},
  'iPhone 5s': {width: 320, height: 568},
};
const SCALES = [0.9, 1, 1.15, 1.3, 1.5];

// Drive to a stage and report anything inside main that the box cuts off.
async function clippedAt(page, scale, stage){
  return page.evaluate(o => {
    const a = window.__acorn;
    a.state.settings.textScale = o.scale;
    a.state.words.lists = [{id:'w1', name:'T', words:['because','thought','friend','beautiful']}];
    a.state.words.activeId = 'w1'; a.state.words.mastery = {}; a.state.words.sessions = [];
    a.save(); a.go('day'); a.start();
    if(o.stage !== 'look') a.cover();
    if(o.stage === 'near'){ a.type('becuase'); a.check(); }
    if(o.stage === 'far'){ a.type('zzz'); a.check(); }
    if(o.stage === 'right'){ a.type('because'); a.check(); }
    if(o.stage === 'done'){
      for(let i = 0; i < 30 && a.session(); i++){
        if(a.session().stage === 'look') a.cover();
        const W = a.session();
        if(W && W.stage === 'write'){ a.type(W.words[W.i]); a.check(); }
        if(a.session()) a.next();
      }
    }
    const m = document.querySelector('main');
    const box = m.getBoundingClientRect();
    const cut = new Set();
    m.querySelectorAll('*').forEach(n => {
      const r = n.getBoundingClientRect();
      if(!r.height) return;
      if(r.bottom > box.bottom + 1 || r.top < box.top - 1)
        cut.add(n.tagName.toLowerCase()
          + (typeof n.className === 'string' && n.className ? '.' + n.className.split(' ')[0] : '')
          + ' “' + (n.textContent || '').trim().slice(0, 30) + '”');
    });
    return {cut: [...cut], over: m.scrollHeight - m.clientHeight};
  }, {scale, stage});
}

test.describe('nothing is ever half shown', () => {

  for(const [phone, viewport] of Object.entries(PHONES)){
    test(`${phone}: every stage fits at every text size`, async ({page}) => {
      await page.setViewportSize(viewport);
      await open(page, '2026-08-01');
      for(const scale of SCALES){
        for(const stage of ['look', 'write', 'near', 'far', 'right', 'done']){
          const r = await clippedAt(page, scale, stage);
          expect(r.cut, `${phone} at ${scale}x, ${stage}`).toEqual([]);
        }
      }
      expect(errorsOf(page)).toEqual([]);
    });
  }

  // Shedding is only worth doing in the right order. The word and its pieces are
  // the lesson; the encouragement and the dots are decoration.
  test('what goes first is the least useful thing on the screen', async ({page}) => {
    await page.setViewportSize({width: 320, height: 568});
    await open(page, '2026-08-01');
    await clippedAt(page, 1.5, 'near');
    const seen = await page.evaluate(() => {
      const vis = s => { const n = document.querySelector(s);
                         return !!n && !!n.getBoundingClientRect().height; };
      // A near miss re-traces now (WIN-1): the word is back in its box (.tracew), the pieces are
      // the seams drawn under it, and the way on is copying the word (the #type box) rather than
      // a chevron. The seams ride on the word itself, so they cannot be shed out from under it.
      return {word: vis('.marked') || vis('.word') || vis('.tracew'),
              seams: !!document.querySelector('.tracew .seams, .word .seams'),
              wayon: !!document.querySelector('#act button') || !!document.querySelector('#type')};
    });
    // Whatever had to go, these did not.
    expect(seen.word, 'the word itself').toBe(true);
    expect(seen.seams, 'the syllable pieces, drawn under the word').toBe(true);
    expect(seen.wayon, 'the way on').toBe(true);
  });

  // She is still told how she did, whatever the screen had room to draw.
  test('the verdict is still said even if it is not shown', async ({page}) => {
    await page.setViewportSize({width: 320, height: 568});
    await open(page, '2026-08-01');
    await clippedAt(page, 1.5, 'near');
    const said = await page.locator('#say').textContent();
    expect(said).toMatch(/\S/);
    expect(said).not.toMatch(/wrong|incorrect|failed|error|mistake/i);
  });
});
