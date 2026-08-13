const path = require('path');
const APP = 'file://' + path.join(__dirname, '..', 'index.html');

// Open 144 with clean storage, and fail on any page or console error — "no
// errors on her phone" is a shipping requirement, not a nice-to-have.
async function open(page, today){
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if(m.type() !== 'error') return;
    if(/Failed to load resource/i.test(m.text())) return;      // the icon is not fetched in tests
    errors.push('console: ' + m.text());
  });
  page.__errors = errors;
  await page.goto(APP);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => !!window.__144);
  await page.evaluate(() => window.__144.reset());
  if(today) await page.evaluate(d => window.__144.setToday(d), today);
  return page;
}
function errorsOf(page){ return page.__errors || []; }

// Answer the question on screen the way she does — a real tap on a real orb.
// `right:false` taps a genuinely wrong answer, so a miss is exercised for real.
async function answer(page, right){
  return page.evaluate(r => window.__144.answer(r), right !== false);
}
// Mark the current level's facts as already met, so play starts on a question
// rather than on the slow lane's "have a look at this one" — for tests that are
// about something other than the teaching step.
async function alreadyMet(page){
  await page.evaluate(() => {
    const a = window.__144, st = a.LEVELS[a.levelIndex()];
    (st.facts || []).forEach(k => {
      a.state.facts[k] = a.state.facts[k] ||
        {box:2, right:1, wrong:0, seen:2, last:a.todayISO()};
    });
    a.save(); a.render();
  });
}
// Start the level she is on and get to a question. A learn level SHOWS her a new
// fact before asking it (the slow lane), so "start playing" means past that.
async function play(page){
  await page.click('#go');
  await page.waitForTimeout(200);
  const skipped = await page.evaluate(() => {
    const a = window.__144;
    if(a.meeting && a.meeting()){ a.skipMeet(); return true; }
    return false;
  });
  await page.waitForTimeout(skipped ? 250 : 100);
  return skipped;
}
// Play the current level to its goal. Returns how many answers it took.
async function playLevel(page, {wrongEvery = 0} = {}){
  let n = 0;
  for(let guard = 0; guard < 120; guard++){
    const st = await page.evaluate(() => {
      const W = window.__144.sitting();
      return W ? {done: W.done, goal: W.goal, cleared: !!document.querySelector('#clear.on')} : null;
    });
    if(!st || st.cleared || st.done >= st.goal) break;
    const right = !(wrongEvery && n % wrongEvery === 0);
    if(!await answer(page, right)) break;
    n++;
    await page.waitForTimeout(right ? 300 : 820);
  }
  await page.waitForTimeout(700);
  return n;
}
// Seed mastery directly, for tests about a state that would take weeks to reach.
async function seed(page, facts){
  await page.evaluate(f => {
    const a = window.__144;
    Object.keys(f).forEach(k => { a.state.facts[k] = Object.assign(
      {box:1, right:0, wrong:0, seen:1, last:a.todayISO()}, f[k]); });
    a.save(); a.render();
  }, facts);
}
// Open WITHOUT clearing storage — for the two-windows tests, where the second
// window must find the first one's data exactly as she left it.
async function openRaw(page){
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if(m.type() === 'error' && !/Failed to load resource/i.test(m.text()))
    errors.push('console: ' + m.text()); });
  page.__errors = errors;
  await page.goto(APP);
  await page.waitForFunction(() => !!window.__144);
  return page;
}
module.exports = {APP, open, openRaw, errorsOf, answer, playLevel, seed, play, alreadyMet};
