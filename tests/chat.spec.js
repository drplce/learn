// Book chat. Every test stubs the endpoint — the suite must never make a real
// network call, and must never need a token to run.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

const URL = 'https://chat.example.test/talk';

// Stub the endpoint. Returns the list of request bodies it received.
async function stubChat(page, replies){
  const seen = [];
  let i = 0;
  await page.route(URL, async route => {
    seen.push(JSON.parse(route.request().postData() || '{}'));
    const reply = replies[Math.min(i++, replies.length - 1)];
    if(reply === null) return route.fulfill({status:502, contentType:'application/json', body:'{"error":"unavailable"}'});
    await route.fulfill({status:200, contentType:'application/json', body:JSON.stringify({reply})});
  });
  return seen;
}

// Configure the endpoint and mark today read, which is what unlocks the chat.
async function ready(page, opts){
  opts = opts || {};
  await page.evaluate(o => {
    const a = window.__acorn;
    a.state.settings.chatUrl = o.url;
    a.state.settings.chatToken = 'test-token';
    a.markRead();
    if(o.title) a.setNote(o.title, '');
    a.save();
    a.go('read');
  }, {url: URL, title: opts.title});
}

test.describe('when it is available at all', () => {

  test('is hidden until a grown-up configures it', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => { window.__acorn.markRead(); window.__acorn.go('read'); });
    await expect(page.locator('#cstart')).toHaveCount(0);
    expect(await page.evaluate(() => window.__acorn.chatReady())).toBe(false);
  });

  test('is hidden until she has marked the day read', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(u => {
      window.__acorn.state.settings.chatUrl = u;
      window.__acorn.state.settings.chatToken = 'test-token';
      window.__acorn.save(); window.__acorn.go('read');
    }, URL);
    await expect(page.locator('#cstart')).toHaveCount(0);      // reading comes first
    expect(await page.evaluate(() => window.__acorn.startChatSession())).toBe(false);
  });

  test('appears once both are true', async ({page}) => {
    await stubChat(page, ['What happened in it?']);
    await open(page, '2026-07-28');
    await ready(page);
    await expect(page.locator('#cstart')).toBeVisible();
  });

  test('a half-filled setup does not count as ready', async ({page}) => {
    await open(page, '2026-07-28');
    const out = await page.evaluate(u => {
      const a = window.__acorn;
      a.state.settings.chatUrl = u; a.state.settings.chatToken = '';
      const urlOnly = a.chatReady();
      a.state.settings.chatUrl = ''; a.state.settings.chatToken = 'x';
      return {urlOnly, tokenOnly: a.chatReady()};
    }, URL);
    expect(out).toEqual({urlOnly:false, tokenOnly:false});
  });
});

test.describe('the conversation', () => {

  test('opens with a question, and she can answer', async ({page}) => {
    const seen = await stubChat(page, ['What happened in your book today?', 'That sounds exciting!']);
    await open(page, '2026-07-28');
    await ready(page);
    await page.locator('#cstart').click();
    await expect(page.locator('.bub.them').first()).toContainText('What happened in your book today?');

    await page.locator('#csay').fill('Roz met the otters');
    await page.locator('#csend').click();
    await expect(page.locator('.bub.me')).toHaveText(/Roz met the otters/);
    await expect(page.locator('.bub.them').nth(1)).toContainText('That sounds exciting!');
    expect(errorsOf(page)).toEqual([]);
  });

  test('sends the token and the book title, never a key', async ({page}) => {
    const seen = await stubChat(page, ['Tell me more.']);
    await open(page, '2026-07-28');
    await ready(page, {title:'The Wild Robot'});
    const header = page.waitForRequest(URL).then(r => r.headers()['x-acorn-token']);
    await page.locator('#cstart').click();
    await expect(page.locator('.bub.them').first()).toBeVisible();
    expect(await header).toBe('test-token');
    expect(seen[0].book).toBe('The Wild Robot');
    expect(JSON.stringify(seen[0])).not.toMatch(/sk-ant/);
  });

  test('the opening turn is not shown to her', async ({page}) => {
    await stubChat(page, ['What was the best bit?']);
    await open(page, '2026-07-28');
    await ready(page);
    await page.locator('#cstart').click();
    await expect(page.locator('.bub.them')).toHaveCount(1);
    await expect(page.locator('.bub.me')).toHaveCount(0);      // the synthetic opener stays hidden
  });

  test('it closes after four answers and stops taking input', async ({page}) => {
    await stubChat(page, ['Q1?','Q2?','Q3?','Q4?','Lovely reading today.']);
    await open(page, '2026-07-28');
    await ready(page);
    await page.locator('#cstart').click();
    for(let i = 0; i < 4; i++){
      await expect(page.locator('#csay')).toBeVisible();
      await page.locator('#csay').fill('answer ' + i);
      await page.locator('#csend').click();
    }
    await expect(page.locator('#csay')).toHaveCount(0);        // no more input
    await expect(page.locator('.bub.them').last()).toContainText('Lovely reading today.');
    expect(await page.evaluate(() => window.__acorn.chat().done)).toBe(true);
    expect(await page.evaluate(() => window.__acorn.MAX_ANSWERS)).toBe(4);
  });

  test('empty answers and double taps are ignored', async ({page}) => {
    const seen = await stubChat(page, ['Q1?','Q2?']);
    await open(page, '2026-07-28');
    await ready(page);
    await page.locator('#cstart').click();
    await expect(page.locator('.bub.them').first()).toBeVisible();
    expect(await page.evaluate(() => window.__acorn.chatAnswer('   '))).toBe(false);
    expect(await page.evaluate(() => window.__acorn.chatAnswer(''))).toBe(false);
    expect(seen.length).toBe(1);
  });

  test('Enter sends, Shift+Enter does not', async ({page}) => {
    const seen = await stubChat(page, ['Q1?','Q2?']);
    await open(page, '2026-07-28');
    await ready(page);
    await page.locator('#cstart').click();
    await expect(page.locator('.bub.them').first()).toBeVisible();
    await page.locator('#csay').fill('it was good');
    await page.locator('#csay').press('Shift+Enter');
    expect(seen.length).toBe(1);
    await page.locator('#csay').press('Enter');
    await expect(page.locator('.bub.me')).toHaveText(/it was good/);
    expect(seen.length).toBe(2);
  });
});

test.describe('when it goes wrong', () => {

  test('a failure is explained kindly, with no status code', async ({page}) => {
    await stubChat(page, [null]);
    await open(page, '2026-07-28');
    await ready(page);
    await page.locator('#cstart').click();
    await expect(page.locator('.chaterr')).toContainText(/can’t chat just now/);
    const body = await page.locator('#screen').innerText();
    expect(body).not.toMatch(/50[0-9]|error|unavailable|token|fetch/i);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a failed chat never loses the reading she already did', async ({page}) => {
    await stubChat(page, [null]);
    await open(page, '2026-07-28');
    await ready(page);
    await page.locator('#cstart').click();
    await expect(page.locator('.chaterr')).toBeVisible();
    const n = await page.evaluate(() => window.__acorn.streakInfo(window.__acorn.state.reading.log, '2026-07-28').current);
    expect(n).toBe(1);
  });

  test('leaving mid-conversation abandons it cleanly', async ({page}) => {
    await stubChat(page, ['Q1?']);
    await open(page, '2026-07-28');
    await ready(page);
    await page.locator('#cstart').click();
    await expect(page.locator('.bub.them').first()).toBeVisible();
    await page.locator('[data-go="read"]').click();
    expect(await page.evaluate(() => window.__acorn.chat())).toBeNull();
    expect(await page.evaluate(() => window.__acorn.screen())).toBe('read');
  });
});

test.describe('what the grown-up can see', () => {

  test('the whole transcript is saved and shown', async ({page}) => {
    await stubChat(page, ['What happened?','Who else was there?']);
    await open(page, '2026-07-28');
    await ready(page, {title:'The Wild Robot'});
    await page.locator('#cstart').click();
    await expect(page.locator('.bub.them').first()).toBeVisible();
    await page.locator('#csay').fill('Roz hid from the bear');
    await page.locator('#csend').click();
    await expect(page.locator('.bub.them').nth(1)).toBeVisible();

    const saved = await page.evaluate(() =>
      window.__acorn.state.reading.log.find(e => e.date === '2026-07-28').chat);
    expect(saved.length).toBe(3);
    expect(saved[0]).toEqual({role:'assistant', text:'What happened?'});
    expect(saved[1]).toEqual({role:'user', text:'Roz hid from the bear'});

    await page.evaluate(() => window.__acorn.go('parent'));
    await expect(page.locator('#screen')).toContainText('Roz hid from the bear');
    await expect(page.locator('#screen')).toContainText('The Wild Robot');
  });

  test('the transcript survives a reload', async ({page}) => {
    await stubChat(page, ['What happened?']);
    await open(page, '2026-07-28');
    await ready(page);
    await page.locator('#cstart').click();
    await expect(page.locator('.bub.them').first()).toBeVisible();
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    const saved = await page.evaluate(() =>
      window.__acorn.state.reading.log.find(e => e.date === '2026-07-28').chat);
    expect(saved[0].text).toBe('What happened?');
  });

  test('the settings persist so it only has to be typed once', async ({page}) => {
    await open(page, '2026-07-28');
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('#curl').fill(URL);
    await page.locator('#ctok').fill('abc123');
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    const s = await page.evaluate(() => window.__acorn.state.settings);
    expect(s.chatUrl).toBe(URL);
    expect(s.chatToken).toBe('abc123');
  });

  test('a reply is escaped, not injected', async ({page}) => {
    await stubChat(page, ['<img src=x onerror="window.__pwned=1">']);
    await open(page, '2026-07-28');
    await ready(page);
    await page.locator('#cstart').click();
    await expect(page.locator('.bub.them').first()).toContainText('<img');
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  });
});
