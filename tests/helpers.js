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

/* Come back to the app the way she does, WITHOUT reloading the same renderer.
   `page.reload()` on a file:// page can come back to a COMPLETELY EMPTY localStorage
   under parallel load — not our key missing, the whole store: measured at about 3% on
   2026-11-01 (6 failures in 200 trials) and again in the tonight.spec.js hunt on
   2026-10-27, on two unrelated tests with the identical signature. The app had written
   correctly both times; the bytes were on disk before the reload and gone after it.

   It is an environment behaviour, not a defect in the app — her phone runs over https
   with an ordinary origin, where this does not arise. But in here it produces a false
   red every so often, and a false red is expensive: ROUTINE.md §5 says a red is a red,
   and that rule is only worth having while every red is real.

   So where a test's claim is "her work is still there when she comes back", open a
   fresh page in the same context instead. It reads the same storage, it is closer to
   what her phone actually does when iOS drops the tab, and it does not race a renderer
   restart. Where the claim really is about reloading THIS page, keep page.reload() and
   expect the occasional empty store. */
async function reopen(page){
  const next = await page.context().newPage();
  await next.goto(APP);
  await next.waitForFunction(() => !!window.__acorn);
  return next;
}

module.exports = {APP, open, errorsOf, write, reopen};
