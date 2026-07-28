const path = require('path');

const APP = 'file://' + path.join(__dirname, '..', 'index.html');

// Open the app on a known day with clean storage, and fail the test on any
// page error or console error — "no page errors" is a shipping requirement.
async function open(page, today){
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if(m.type() === 'error') errors.push('console: ' + m.text()); });
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
