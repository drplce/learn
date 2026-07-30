// The backup, after it has been through an email.
//
// The button beside Restore says "Copies everything as text you can paste somewhere safe
// — an email to yourself does the job", and the comment above looksLikeBackup says "A
// backup nobody can put back is not a backup". Driven for real — out through the app's own
// Copy button, onto the clipboard, mangled the way a mail client mangles plain text, and
// back in as a paste event — five of the eleven ways it comes home made the restore refuse
// it outright: a quoted reply puts "> " on every line, a phone appends a signature after
// the closing brace, autocorrect turns " into a curly pair, a copy through a web page
// hands over non-breaking spaces or zero-width characters. Not one of them changes a
// character of her data. This is the only route by which a year of her work comes home
// after a lost phone.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

const MANGLE = {
  'untouched':           t => t,
  'wrapped at 78':       t => t.replace(/(.{78})/g, '$1\n'),
  'wrapped at 40':       t => t.replace(/(.{40})/g, '$1\n'),
  'crlf line ends':      t => t.replace(/(.{78})/g, '$1\r\n'),
  'quoted reply':        t => t.split('\n').map(l => '> ' + l).join('\n'),
  'twice-quoted reply':  t => t.split('\n').map(l => '>> ' + l).join('\n'),
  'wrapped and quoted':  t => t.replace(/(.{78})/g, '$1\n')
                               .split('\n').map(l => '> ' + l).join('\n'),
  'blank lines round it': t => '\n\n   ' + t + '  \n\n',
  'curly quotes':        t => t.replace(/"/g, '“'),
  'non-breaking spaces': t => t.replace(/ /g, ' '),
  'zero-width joiners':  t => t.replace(/,/g, ',​'),
  'soft hyphens':        t => t.replace(/a/g, 'a­'),
  'signature appended':  t => t + '\n\n--\nSent from my phone\n',
  'preamble above':      t => 'Here it is, hope this works!\n\n' + t,
  // How a forwarded email really turns up: all of it at once.
  'a real forward':      t => 'Hi Mum!\n\n'
                              + t.replace(/"/g, '“').replace(/ /g, ' ')
                                 .split('\n').map(l => '> ' + l).join('\n')
                              + '\n\n--\nSent from my phone\n',
};

// Everything worth losing.
const HISTORY = {
  profile: {name: 'Ivy'},
  lists: [{id: 'w9', name: 'Week 9', words: ['said', 'they', 'beautiful']},
          {id: 'w8', name: 'Week 8', words: ['rain', 'plain']}],
  mastery: {said: {box: 5, right: 6, wrong: 1, last: '2026-07-30'},
            they: {box: 3, right: 3, wrong: 2, last: '2026-07-30'},
            rain: {box: 7, right: 9, wrong: 0, last: '2026-07-28'}},
};

async function seed(page){
  await page.evaluate(h => {
    const a = window.__acorn;
    a.state.profile.name = h.profile.name;
    a.state.words.lists = h.lists;
    a.state.words.activeId = 'w9';
    a.state.words.mastery = h.mastery;
    a.state.words.sessions = [{date: '2026-07-30', asked: 9, right: 8, words: 5,
                               firstTime: 7, fresh: ['they'], grew: ['said'], slipped: []}];
    a.state.settings.textScale = 1.2;
    a.state.settings.tint = 'mint';
    a.save(); a.go('parent');
  }, HISTORY);
}

// Paste text into Restore for real and press the button through its two-tap arming.
async function putBack(page, text){
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.waitForFunction(() => !!window.__acorn);
  await page.evaluate(d => window.__acorn.setToday(d), '2026-08-01');
  await page.evaluate(() => window.__acorn.go('parent'));
  await page.locator('#restore').click();
  await page.evaluate(t => {
    const el = document.querySelector('#restore');
    const dt = new DataTransfer();
    dt.setData('text/plain', t);
    el.dispatchEvent(new ClipboardEvent('paste',
      {clipboardData: dt, bubbles: true, cancelable: true}));
    if(!el.value) el.value = t;            // headless does not run the default action
    el.dispatchEvent(new Event('input', {bubbles: true}));
  }, text);
  await page.locator('#restoreGo').click();
  if(await page.evaluate(() => !!document.querySelector('#restoreGo').dataset.armed))
    await page.locator('#restoreGo').click();
  return page.evaluate(() => ({
    state: JSON.stringify(window.__acorn.state),
    lists: window.__acorn.state.words.lists.length,
    mastery: Object.keys(window.__acorn.state.words.mastery).length,
    name: window.__acorn.state.profile.name,
    toast: (document.querySelector('#toast') || {}).textContent || '',
  }));
}

test.use({permissions: ['clipboard-read', 'clipboard-write']});

test.describe('a backup that has been through an email', () => {

  test('comes back exactly, however the mail client mangled it', async ({page}) => {
    await open(page, '2026-08-01');
    await seed(page);
    await page.locator('#copy').click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.length, 'the Copy button put nothing on the clipboard').toBeGreaterThan(100);
    const want = await page.evaluate(() => JSON.stringify(window.__acorn.state));

    for(const [why, fn] of Object.entries(MANGLE)){
      const r = await putBack(page, fn(copied));
      expect(r.toast, `${why}: ${r.toast}`).toContain('Restored');
      expect(r.state, `${why}: came back as something else`).toBe(want);
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('an invisible character in it never costs her a year quietly', async ({page}) => {
    /* The worst of the lot, and it was there before any of this. A soft hyphen is legal
       inside a JSON string, so a backup that has been through Word parses perfectly well
       — into an object whose keys are "na-me" and "ma-stery" with an invisible character
       in the middle of each. The shape check passes on the strength of the one key that
       survived intact, and the restore reports success while putting back an empty mastery
       and a list she is not on. Refusing would have been far better than that. */
    await open(page, '2026-08-01');
    await seed(page);
    await page.locator('#copy').click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const want = await page.evaluate(() => JSON.stringify(window.__acorn.state));
    for(const [why, ch] of [['soft hyphen', '­'], ['zero-width space', '​'],
                            ['byte-order mark', '﻿'], ['word joiner', '⁠']]){
      const r = await putBack(page, copied.replace(/a/g, 'a' + ch));
      // Either it comes back whole, or it is refused — never "Restored" over the top of
      // her history with the history missing.
      if(/Restored/.test(r.toast)){
        expect(r.mastery, `${why}: restored and lost her mastery`).toBe(3);
        expect(r.name, `${why}: restored and lost her name`).toBe('Ivy');
        expect(r.state, `${why}: restored something that was not the backup`).toBe(want);
      }else{
        expect(r.toast, `${why}: neither restored nor refused`).toContain('does not look like');
      }
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('and the summary it reads out matches what is in it', async ({page}) => {
    // The arming message is a grown-up's only chance to notice they are about to
    // replace a year of work with the wrong file.
    await open(page, '2026-08-01');
    await seed(page);
    await page.locator('#copy').click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    await page.evaluate(() => { localStorage.clear(); });
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('#restore').fill(MANGLE['a real forward'](copied));
    await page.locator('#restoreGo').click();
    const label = await page.locator('#restoreGo').textContent();
    expect(label).toContain('3 words');
    expect(label).toContain('2 saved lists');
    expect(label).toContain('1 sitting');
  });

  test('taking the wrapping off does not let anything else in', async ({page}) => {
    /* The whole risk of being generous about the packaging. The shape check has to stay
       the only thing that decides whether what is inside is hers, so none of these may
       restore — and each one has a brace in it somewhere, which is exactly what the
       slice looks for. */
    await open(page, '2026-08-01');
    await seed(page);
    const before = await page.evaluate(() => JSON.stringify(window.__acorn.state));
    const JUNK = {
      'someone else’s json':   '{"user":{"id":7},"cart":[1,2]}',
      'an empty object':       '{}',
      'a css rule':            'body { color: red; margin: 0 }',
      'a js snippet':          'function f(){ return {a:1}; }',
      'words with braces':     'said, they, went { and a brace }',
      'the right shape, empty':'{"words":null}',
      'an array':              '[{"words":{"lists":[]}}]',
      'a quoted non-backup':   '> {"hello":"world"}',
      'braces and nothing else': '{ }',
      'a truncated backup':    '{"profile":{"name":"Ivy"},"words":{"lists":[',
      'html from a web page':  '<div style="a{b}">said</div>',
      'a shopping list':       'milk, bread, { eggs }',
    };
    for(const [why, text] of Object.entries(JUNK)){
      const r = await putBack(page, text);
      expect(r.toast, `${why} was accepted as a backup`).not.toContain('Restored');
      // And nothing of hers was touched on the way to refusing it.
      expect(r.lists, `${why} left lists behind`).toBe(0);
    }
    // Her real backup still goes back in afterwards, so the gate is a gate and not a wall.
    await page.evaluate(() => { localStorage.clear(); });
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    await seed(page);
    await page.locator('#copy').click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const ok = await putBack(page, MANGLE['a real forward'](copied));
    expect(ok.toast).toContain('Restored');
    expect(ok.name).toBe('Ivy');
    expect(before.length).toBeGreaterThan(0);
  });

  test('a stray angle bracket in her data is not treated as a wrapper', async ({page}) => {
    /* The reply-prefix strip only fires when essentially every line carries one. A list
       name is the one field a grown-up types freely, so it is the one that can hold a
       ">" — and taking a character off the front of one line of real JSON would break
       the parse and lose the lot. */
    await open(page, '2026-08-01');
    await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id: 'g', name: '> Week 9 >', words: ['said', 'they']}];
      a.state.words.activeId = 'g';
      a.state.words.mastery = {said: {box: 4, right: 4, wrong: 0, last: '2026-07-30'}};
      a.save(); a.go('parent');
    });
    await page.locator('#copy').click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const want = await page.evaluate(() => JSON.stringify(window.__acorn.state));
    for(const why of ['untouched', 'quoted reply', 'a real forward']){
      const r = await putBack(page, MANGLE[why](copied));
      expect(r.toast, `${why}: ${r.toast}`).toContain('Restored');
      expect(r.state, `${why}: her list name did not survive`).toBe(want);
    }
    const back = await page.evaluate(() => window.__acorn.state.words.lists[0].name);
    expect(back).toBe('> Week 9 >');
  });

  test('the one thing that cannot be repaired says so rather than half-doing it',
    async ({page}) => {
    /* A wrap tight enough to fall inside a value puts a raw newline in a JSON string,
       and there is no way back from that without guessing where the break was. No mail
       client wraps at twenty characters, so this is the measured edge of what is
       recoverable, not a case to handle — and what matters is that it refuses cleanly
       and leaves what was already on the device alone. */
    await open(page, '2026-08-01');
    await seed(page);
    await page.locator('#copy').click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const mine = await page.evaluate(() => JSON.stringify(window.__acorn.state));
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('#restore').fill(copied.replace(/(.{20})/g, '$1\n'));
    await page.locator('#restoreGo').click();
    await expect(page.locator('#toast')).toContainText('does not look like a backup');
    expect(await page.evaluate(() => JSON.stringify(window.__acorn.state)),
      'a backup it could not read still changed what was on the device').toBe(mine);
    expect(errorsOf(page)).toEqual([]);
  });

});
