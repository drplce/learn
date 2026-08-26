const path = require('path');

const APP = 'file://' + path.join(__dirname, '..', 'index.html');

// Open the app on a known day with clean storage, and fail the test on any
// page error or console error — "no page errors" is a shipping requirement.
async function open(page, today){
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if(m.type() !== 'error') return;
    // The app is one file and loads nothing external, so a failed resource can
    // only be a deliberately-stubbed endpoint in a test. That is the scenario,
    // not a defect — what matters is that the app handled it without throwing.
    if(/Failed to load resource/i.test(m.text())) return;
    errors.push('console: ' + m.text());
  });
  page.__errors = errors;

  /* Run the whole suite at a future date:  ACORN_DAYS_AHEAD=400 npx playwright test
     Off by default, so this costs nothing on an ordinary run.

     Why it exists: the sibling app in tables/ had two engine tests seed a fixed
     `last` date and read the REAL clock, and the Leitner intervals meant the thing
     they measured drifted a little every day until they went red on 2026-08-23 — a
     Sunday, on a build nobody had touched. A red that arrives on its own, for a
     reason that is not the app, is the worst kind: the obvious fix is to loosen the
     thresholds, which would have destroyed the test. Acorn was swept the same day
     and is clean — 590 pass at +200 days and at +1100 — but "clean today" is exactly
     what the other suite was, so the check is kept rather than thrown away. Run it
     occasionally; it is two minutes. */
  const ahead = Number(process.env.ACORN_DAYS_AHEAD || 0);
  if(ahead) await page.addInitScript(days => {
    const SHIFT = days * 864e5, RealDate = Date;
    const D = function(...a){ return a.length ? new RealDate(...a) : new RealDate(RealDate.now() + SHIFT); };
    D.now = () => RealDate.now() + SHIFT;
    D.parse = RealDate.parse; D.UTC = RealDate.UTC; D.prototype = RealDate.prototype;
    window.Date = D;
  }, ahead);
  await page.goto(APP);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => !!window.__acorn);
  if(today) await page.evaluate(d => window.__acorn.setToday(d), today);
  return page;
}

function errorsOf(page){ return page.__errors || []; }

/* Put an answer in the spelling box the way she puts it there: with the keys.
   Playwright's fill() sets the whole value with one input event, which is exactly the
   signature of a phone dictating the word — she found the microphone key, and since 11.6
   the app hands a word it did not watch her write straight back to her. Thirty-three
   fixtures across six files were filling the box, and every one of them was testing
   something else: the verdict wording, the keyboard sliding up, a day rolling over. They
   passed for years because fill() was standing in for a child. It never was one.

   Anything that needs the box filled without the keys — proving the refusal itself, or
   driving a stage from the test API — should say so explicitly rather than come through
   here. */
async function write(page, text){
  const box = page.locator('#type');
  if(!await box.count()) return false;
  await box.click();
  await page.keyboard.press('ControlOrMeta+a');
  if(!String(text === undefined || text === null ? '' : text).length){
    await page.keyboard.press('Backspace');
    return true;
  }
  await page.keyboard.type(String(text), {delay: 0});
  return true;
}

module.exports = {APP, open, errorsOf, write};
