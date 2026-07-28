// The app as a child and a parent actually use it.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

test.describe('shell', () => {

  test('home shows words only — reading and maths are hidden for now', async ({page}) => {
    await open(page, '2026-07-28');
    await expect(page.locator('.card')).toHaveCount(1);
    await expect(page.locator('.card', {hasText:'Words'}).first()).toBeVisible();
    await expect(page.locator('.card.soon')).toHaveCount(0);
    expect(await page.evaluate(() => window.__acorn.SHOW)).toEqual({read:false, maths:false});
    expect(errorsOf(page)).toEqual([]);
  });

  // Reading and the book chat are built and tested; they are only hidden.
  test('the hidden modules come straight back when switched on', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => { window.__acorn.SHOW.read = true; window.__acorn.SHOW.maths = true; });
    await page.evaluate(() => window.__acorn.go('home'));
    await expect(page.locator('.card')).toHaveCount(3);
    await page.locator('[data-soon="Maths"]').click();
    await expect(page.locator('#toast')).toHaveText(/on its way/);
  });

  test('the build stamp is visible', async ({page}) => {
    await open(page, '2026-07-28');
    await expect(page.locator('#stamp')).toHaveText(/Build/);
  });
});

test.describe('reading streak', () => {

  test('marking today starts the streak and says something kind', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.go('read'));
    await expect(page.locator('.count .lbl')).toHaveText(/Ready when you are/);
    await page.locator('#mark').click();
    await expect(page.locator('.count .n')).toHaveText('1');
    await expect(page.locator('.primary.done')).toBeVisible();
    await expect(page.locator('.say')).not.toHaveText('');
    expect(errorsOf(page)).toEqual([]);
  });

  test('marking twice on the same day cannot double-count', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => { window.__acorn.markRead(); window.__acorn.markRead(); window.__acorn.markRead(); });
    const n = await page.evaluate(() => window.__acorn.streakInfo(window.__acorn.state.reading.log, '2026-07-28').current);
    expect(n).toBe(1);
  });

  test('progress survives a reload', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.go('read'));
    await page.locator('#mark').click();
    await expect(page.locator('.count .n')).toHaveText('1');
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    await page.evaluate(() => window.__acorn.setToday('2026-07-28'));
    const n = await page.evaluate(() => window.__acorn.streakInfo(window.__acorn.state.reading.log, '2026-07-28').current);
    expect(n).toBe(1);
  });

  test('the day rolls over: yesterday read, today offers the button again', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.markRead());
    await page.evaluate(() => window.__acorn.setToday('2026-07-29'));
    await page.evaluate(() => window.__acorn.go('read'));
    await expect(page.locator('#mark')).toBeVisible();
    await expect(page.locator('.count .n')).toHaveText('1');
    await page.locator('#mark').click();
    await expect(page.locator('.count .n')).toHaveText('2');
  });

  test('a missed day is described kindly, not as a failure', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.seed(['2026-07-25','2026-07-27','2026-07-28']));
    await page.evaluate(() => window.__acorn.go('read'));
    await expect(page.locator('.count .sub')).toHaveText(/rest day.*that’s fine/);
  });

  test('a broken streak invites a fresh start instead of showing a loss', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.seed(['2026-07-01','2026-07-02','2026-07-03']));
    await page.evaluate(() => window.__acorn.go('read'));
    await expect(page.locator('.count .lbl')).toHaveText(/Ready when you are/);
    await expect(page.locator('.count .sub')).toHaveText(/fresh start is fine/);
    // and no scolding language anywhere on the screen
    const body = await page.locator('#screen').innerText();
    expect(body).not.toMatch(/lost|broke|failed|missed out/i);
  });

  test('a note saves against today and shows in the log', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.markRead());
    await page.evaluate(() => window.__acorn.go('read'));
    await page.locator('#nopen').click();
    await page.locator('#bt').fill('The Wild Robot');
    await page.locator('#bn').fill('Roz met the otters.');
    await page.locator('#nsave').click();
    await expect(page.locator('.entry .t').first()).toHaveText('The Wild Robot');
    await expect(page.locator('.entry .n').first()).toHaveText('Roz met the otters.');
    const e = await page.evaluate(() => window.__acorn.state.reading.log.find(x => x.date === '2026-07-28'));
    expect(e.title).toBe('The Wild Robot');
  });

  test('the plant grows as the streak grows', async ({page}) => {
    await open(page, '2026-07-28');
    const heightFor = async days => {
      await page.evaluate(n => {
        const out = [];
        for(let i=n-1; i>=0; i--){
          const d = new Date(2026, 6, 28); d.setDate(d.getDate() - i);
          out.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'));
        }
        window.__acorn.seed(out);
      }, days);
      await page.evaluate(() => window.__acorn.go('read'));
      return page.locator('#plantGrow path').first().boundingBox().then(b => b ? b.height : 0);
    };
    const h1 = await heightFor(1);
    const h5 = await heightFor(5);
    const h30 = await heightFor(30);
    expect(h5).toBeGreaterThan(h1);
    expect(h30).toBeGreaterThan(h5);
  });

  test('acorns appear only once the streak is long', async ({page}) => {
    await open(page, '2026-07-28');
    const svgAt = async days => {
      await page.evaluate(n => {
        const out = [];
        for(let i=n-1; i>=0; i--){
          const d = new Date(2026, 6, 28); d.setDate(d.getDate() - i);
          out.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'));
        }
        window.__acorn.seed(out);
      }, days);
      await page.evaluate(() => window.__acorn.go('read'));
      return page.locator('#plantGrow').innerHTML();
    };
    expect(await svgAt(10)).not.toContain('--acorn');
    expect(await svgAt(35)).toContain('--acorn');
  });

  test('adding a note is only offered once the day is marked', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.go('read'));
    await expect(page.locator('#nopen')).toHaveCount(0);      // nothing to attach a note to yet
    await page.locator('#mark').click();
    await expect(page.locator('#nopen')).toBeVisible();
  });

  test('a note can never be what silently creates a read day', async ({page}) => {
    await open(page, '2026-07-28');
    const created = await page.evaluate(() => window.__acorn.setNote('Sneaky', 'should not count'));
    expect(created).toBe(false);
    expect(await page.evaluate(() => window.__acorn.state.reading.log.length)).toBe(0);
    const info = await page.evaluate(() => window.__acorn.streakInfo(window.__acorn.state.reading.log, '2026-07-28'));
    expect(info.current).toBe(0);
  });

  test('the plant animates on the day it grows, and only that once', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.go('read'));
    await page.locator('#mark').click();
    await expect(page.locator('#plantGrow')).toHaveClass(/grow/);
    await page.evaluate(() => window.__acorn.go('home'));
    await page.evaluate(() => window.__acorn.go('read'));
    await expect(page.locator('#plantGrow')).not.toHaveClass(/grow/);
  });
});

test.describe('milestones', () => {

  test('the 7-day moment fires once and not again', async ({page}) => {
    await open(page, '2026-07-28');
    // six days read up to yesterday, so today's tap is the seventh
    await page.evaluate(() => window.__acorn.seed(
      ['2026-07-22','2026-07-23','2026-07-24','2026-07-25','2026-07-26','2026-07-27']));
    await page.evaluate(() => window.__acorn.go('read'));
    await page.locator('#mark').click();
    await expect(page.locator('#moment')).toBeVisible();
    await expect(page.locator('.moment h2')).toHaveText('A whole week');
    await page.locator('#momentOk').click();
    await expect(page.locator('#moment')).toHaveCount(0);

    // leaving and returning must not replay it
    await page.evaluate(() => window.__acorn.go('home'));
    await page.evaluate(() => window.__acorn.go('read'));
    await expect(page.locator('#moment')).toHaveCount(0);
    const seen = await page.evaluate(() => window.__acorn.state.reading.milestones);
    expect(seen).toContain(7);
  });

  test('a milestone already passed does not fire retrospectively', async ({page}) => {
    await open(page, '2026-07-28');
    // seed 10 days including today, then tap is impossible (already read today)
    await page.evaluate(() => {
      const out = [];
      for(let i=9; i>=0; i--){ const d = new Date(2026,6,28); d.setDate(d.getDate()-i);
        out.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')); }
      window.__acorn.seed(out);
    });
    await page.evaluate(() => window.__acorn.go('read'));
    await expect(page.locator('#moment')).toHaveCount(0);
  });
});

test.describe('grown-ups area', () => {

  test('press and hold the stamp to open it; a short tap does not', async ({page}) => {
    await open(page, '2026-07-28');
    await page.locator('#stamp').click();
    expect(await page.evaluate(() => window.__acorn.screen())).toBe('home');

    const box = await page.locator('#stamp').boundingBox();
    await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
    await page.mouse.down();
    await page.waitForTimeout(900);
    await page.mouse.up();
    expect(await page.evaluate(() => window.__acorn.screen())).toBe('parent');
  });

  test('her name saves, persists, and is used in encouragement', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('#pname').fill('Harriet');
    expect(await page.evaluate(() => window.__acorn.state.profile.name)).toBe('Harriet');
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    await page.evaluate(() => window.__acorn.setToday('2026-07-28'));
    await expect(page.locator('.greet h1')).toHaveText(/Harriet/);
    await page.evaluate(() => window.__acorn.go('read'));
    await page.locator('#mark').click();
    await expect(page.locator('.say')).toHaveText(/Harriet/);
  });

  test('text size and tint apply and stick', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('[data-sc="1.3"]').click();
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--scale').trim())).toBe('1.3');
    await page.locator('[data-tn="mint"]').click();
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-tint'))).toBe('mint');
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-tint'))).toBe('mint');
  });

  test('progress figures reflect the log', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.seed(['2026-07-26','2026-07-27','2026-07-28']));
    await page.evaluate(() => window.__acorn.go('parent'));
    await expect(page.locator('.stat b').nth(0)).toHaveText('3');
    await expect(page.locator('.stat b').nth(2)).toHaveText('3');
  });

  test('erase needs two taps', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.markRead());
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('#resetBtn').click();
    expect(await page.evaluate(() => window.__acorn.state.reading.log.length)).toBe(1);
    await expect(page.locator('#resetBtn')).toHaveText(/Tap again/);
    await page.locator('#resetBtn').click();
    expect(await page.evaluate(() => window.__acorn.state.reading.log.length)).toBe(0);
  });
});

test.describe('robustness', () => {

  test('corrupt stored data does not stop the app loading', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => localStorage.setItem('acorn.v1', '{not json at all'));
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    await expect(page.locator('.card')).toHaveCount(1);
  });

  test('state from an older shape is merged, not fatal', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => localStorage.setItem('acorn.v1', JSON.stringify({reading:{log:[{date:'2026-07-28'}]}})));
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    await page.evaluate(() => window.__acorn.setToday('2026-07-28'));
    await page.evaluate(() => window.__acorn.go('read'));
    await expect(page.locator('.count .n')).toHaveText('1');
    expect(errorsOf(page)).toEqual([]);
  });

  test('note text is escaped, not injected', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => { window.__acorn.markRead(); window.__acorn.setNote('<img src=x onerror="window.__pwned=1">', 'ok'); });
    await page.evaluate(() => window.__acorn.go('read'));
    await expect(page.locator('.entry .t').first()).toContainText('<img');
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  });

  test('no page errors across the whole flow', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.go('read'));
    await page.locator('#mark').click();
    await page.locator('#nopen').click();
    await page.locator('#nsave').click();
    await page.locator('[data-go="home"]').click();
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('[data-sc="1.15"]').click();
    await page.locator('[data-go="home"]').click();
    expect(errorsOf(page)).toEqual([]);
  });
});
