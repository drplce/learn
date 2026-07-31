const {test, expect} = require('@playwright/test');
const {open} = require('./helpers');
/* WIN-5 / decision D-c: the success moment is the WORD itself — it turns accent green
   (.word.won) and breathes once. The every-time "Yes — that's it." caption is gone; the
   only verdict line that survives on a win is the EARNED "You got there." after she fought
   back from a miss. The spoken announcement is untouched (a screen reader still hears the
   verdict), and the winning word carries id="advance" so a tap still skips the wait. */

function startOne(page, word){
  return page.evaluate(w => {
    const a = window.__acorn;
    a.state.words.lists = [{id:'w', name:'T', words:[w, 'rain']}];
    a.state.words.activeId = 'w';
    a.state.words.mastery = {}; a.state.words.sessions = [];
    a.save(); a.go('day'); a.start();
    if(a.session() && a.session().stage === 'look') a.cover();
  }, word);
}

test('a plain first-go win is the green word, with no verdict caption', async ({page}) => {
  await open(page, '2026-08-01');
  await startOne(page, 'because');
  await page.locator('#type').click();
  for(const c of 'because') await page.keyboard.press(c);
  await page.keyboard.press('Enter');
  await page.locator('.word.won').waitFor();
  // Let the settle finish before reading the colour — mid-animation it is part-way from ink
  // to green. The settle is ~300ms, well inside the ~1.4s before the word auto-advances.
  await page.evaluate(() => Promise.all(
    document.querySelector('.word.won').getAnimations().map(a => a.finished.catch(() => {}))));
  // Snapshot the win atomically, before the next word can replace this screen.
  const snap = await page.evaluate(() => {
    const w = document.querySelector('.word.won');
    const probe = document.createElement('span');
    probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim();
    document.body.appendChild(probe);
    const acc = getComputedStyle(probe).color; probe.remove();
    return {
      won: !!w,
      text: w ? w.textContent : null,
      green: w ? getComputedStyle(w).color === acc : false,   // actually accent, not just classed
      isAdvance: !!document.querySelector('.word#advance'),    // tap target moved onto the word
      verdicts: document.querySelectorAll('.verdict').length,  // no caption at all
    };
  });
  expect(snap.won, 'the word did not green on a win').toBe(true);
  expect(snap.text).toBe('because');
  expect(snap.green, 'the winning word did not turn accent green').toBe(true);
  expect(snap.isAdvance, 'the winning word is not the tap-to-advance target').toBe(true);
  expect(snap.verdicts, 'a plain win still showed a verdict caption').toBe(0);
});

test('the spoken announcement still says the verdict, though nothing shows it', async ({page}) => {
  await open(page, '2026-08-01');
  await startOne(page, 'because');
  await page.locator('#type').click();
  for(const c of 'because') await page.keyboard.press(c);
  await page.keyboard.press('Enter');
  // Snapshot both together, before auto-advance overwrites the live region or clears the
  // screen: the spoken verdict is preserved (a11y) AND no caption is shown (WIN-5). Read
  // separately, the caption count would race the ~1.4s advance and pass for the wrong reason.
  const snap = await page.evaluate(() => ({
    said: (document.querySelector('#say') || {}).textContent || '',
    verdicts: document.querySelectorAll('.verdict').length,
    won: !!document.querySelector('.word.won'),
  }));
  expect(snap.won, 'not on the win screen').toBe(true);
  expect(snap.said, 'the spoken verdict was lost').toMatch(/that’s it/);
  expect(snap.verdicts, 'a caption was shown on a plain win').toBe(0);
});

test('an earned win keeps "You got there." beside the green word', async ({page}) => {
  await open(page, '2026-08-01');
  await startOne(page, 'because');
  // Miss it first, so coming back and getting it is the earned win.
  await page.locator('#type').click();
  for(const c of 'becoz') await page.keyboard.press(c);
  await page.keyboard.press('Enter');
  await expect(page.locator('.verdict.again')).toBeVisible();   // a miss, held
  // Loop back round to the requeued word and get it.
  const got = await page.evaluate(() => {
    const a = window.__acorn;
    for(let g = 0; g < 10 && a.session(); g++){
      const W = a.session();
      if(W.words[W.i] === 'because' && W.stage !== 'look'){ a.type('because'); a.check(); return true; }
      if(W.stage === 'look'){ a.cover(); continue; }
      if(W.stage === 'write'){ a.type(W.words[W.i]); a.check(); a.next(); continue; }
      a.next();
    }
    return false;
  });
  expect(got, 'never came back round to the missed word').toBe(true);
  await expect(page.locator('.word.won')).toHaveText('because');   // still greens
  await expect(page.locator('.verdict.ok')).toHaveText('You got there.');   // earned line stays
});

test('under reduced motion the win is green with no animation', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await open(page, '2026-08-01');
  await startOne(page, 'because');
  await page.locator('#type').click();
  for(const c of 'because') await page.keyboard.press(c);
  await page.keyboard.press('Enter');
  await expect(page.locator('.word.won')).toHaveText('because');
  // The end state is present; the global reduced-motion rule collapses the duration.
  const dur = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.word.won')).animationDuration);
  expect(parseFloat(dur)).toBeLessThan(0.01);   // ~0.001ms — effectively none
});
