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

  await page.goto(APP);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => !!window.__acorn);
  if(today) await page.evaluate(d => window.__acorn.setToday(d), today);
  return page;
}

function errorsOf(page){ return page.__errors || []; }

module.exports = {APP, open, errorsOf};
