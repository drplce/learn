const {test, expect} = require('@playwright/test');
const {open} = require('./helpers');
/* The word screen is one skeleton: the progress dots, then a RESERVED caption slot (the meaning
   cue on write, the verdict on check — a fixed height whether or not it holds a line), then the
   centred word. So a caption appearing or clearing cannot shove the dots up and down, which is
   what made the pebbles "move about". This guards the reserved slot: the dots and the word hold
   the same position on the writing screen whether or not that word carries a meaning cue. */
function mid(page, sel){
  return page.evaluate(s => {
    const n = document.querySelector(s); if(!n) return null;
    const r = n.getBoundingClientRect(); return (r.top + r.bottom) / 2;
  }, sel);
}
async function toWrite(page, word, mastery){
  await page.evaluate(o => {
    const a = window.__acorn;
    a.state.settings.textScale = 1;
    a.state.words.lists = [{id:'w', name:'T', words:[o.word, 'rain']}];
    a.state.words.activeId = 'w';
    a.state.words.mastery = o.mastery; a.state.words.sessions = [];
    a.save(); a.go('day'); a.start();
    if(a.session().stage === 'look') a.cover();     // cold review -> straight to write
  }, {word, mastery});
}
test('the dots and the word hold position on write, cue or no cue', async ({page}) => {
  await open(page, '2026-08-01');
  await page.setViewportSize({width:375, height:667});
  // 'licence' has a twin ('practise' is on the list too in real use; here its meaning cue fires
  // because the built-in twins table pairs it) -> a meaning cue. 'rain' has none.
  await toWrite(page, 'licence', {licence:{right:3,wrong:0,box:2,lastSeen:'2026-06-01'}});
  const withCue = { dots: await mid(page, '.dots'), word: await mid(page, '.spellinwrap'),
                    cue: await page.locator('.supra .cue').count() };
  await toWrite(page, 'rain', {rain:{right:3,wrong:0,box:2,lastSeen:'2026-06-01'}});
  const noCue = { dots: await mid(page, '.dots'), word: await mid(page, '.spellinwrap'),
                  cue: await page.locator('.supra .cue').count() };
  // The reserved slot exists on both; one has a cue in it, one does not.
  await expect(page.locator('.supra')).toHaveCount(1);
  // The dots and the box are in the SAME place either way — the caption slot holds its height.
  expect(Math.abs(withCue.dots - noCue.dots), `dots moved: ${withCue.dots} vs ${noCue.dots}`).toBeLessThanOrEqual(1);
  expect(Math.abs(withCue.word - noCue.word), `box moved: ${withCue.word} vs ${noCue.word}`).toBeLessThanOrEqual(1);
});

test('the dots and the word hold ONE position across trace, write, win and miss', async ({page}) => {
  await open(page, '2026-08-01');
  await page.setViewportSize({width:375, height:667});
  const wordSel = '.trace, .spellinwrap, .word, .marked';
  const at = async () => ({ dots: await mid(page, '.dots'), word: await mid(page, wordSel) });
  const dots = [], words = [];
  // trace (a new word), then write, then a win — one word carried through its stages.
  await page.evaluate(() => { const a = window.__acorn;
    a.state.words.lists = [{id:'w', name:'T', words:['because','rain']}];
    a.state.words.activeId = 'w'; a.state.words.mastery = {}; a.state.words.sessions = [];
    a.save(); a.go('day'); a.start(); });
  let p = await at(); dots.push(p.dots); words.push(p.word);                 // trace
  await page.evaluate(() => window.__acorn.cover());
  p = await at(); dots.push(p.dots); words.push(p.word);                     // write
  await page.evaluate(() => { window.__acorn.type('because'); window.__acorn.check(); });
  p = await at(); dots.push(p.dots); words.push(p.word);                     // win
  // a miss (its own word, with the "next" button in the footer).
  await page.evaluate(() => { const a = window.__acorn;
    a.state.words.lists = [{id:'m', name:'T', words:['friend','rain']}];
    a.state.words.activeId = 'm';
    a.state.words.mastery = {friend:{right:3,wrong:0,box:2,lastSeen:'2026-06-01'}};
    a.state.words.sessions = []; a.save(); a.go('day'); a.start();
    if(a.session().stage === 'look') a.cover(); a.type('frend'); a.check(); });
  p = await at(); dots.push(p.dots); words.push(p.word);                     // miss
  // Every stage lands on one line for the dots, and one for the word — no jump anywhere.
  const spread = a => Math.max(...a) - Math.min(...a);
  expect(spread(dots), `dots move across stages: ${dots.map(n => n.toFixed(0))}`).toBeLessThanOrEqual(2);
  expect(spread(words), `word moves across stages: ${words.map(n => n.toFixed(0))}`).toBeLessThanOrEqual(2);
});
