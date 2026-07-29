// Copying her progress out was only half a backup: there was no way to put it
// back, so a wiped phone meant starting again from nothing.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

async function seedProgress(page){
  await page.evaluate(() => {
    const a = window.__acorn;
    a.state.profile.name = 'X';
    a.state.words.lists = [{id:'w1', name:'Week 5', words:['because','friend','thought']}];
    a.state.words.activeId = 'w1';
    a.state.words.mastery = {
      because:{right:4, wrong:1, box:4, lastSeen:'2026-07-20'},
      friend:{right:2, wrong:3, box:2, lastSeen:'2026-07-28'},
      said:{right:6, wrong:0, box:6, lastSeen:'2026-07-15'},
    };
    a.state.words.sessions = [{date:'2026-07-28', list:'w1', asked:9, words:8, right:7, firstTime:6}];
    a.state.settings.textScale = 1.25;
    a.state.settings.tint = 'mint';
    a.save();
  });
  return page.evaluate(() => JSON.stringify(window.__acorn.state));
}
const stateOf = page => page.evaluate(() => ({
  mastery: window.__acorn.state.words.mastery,
  lists: window.__acorn.state.words.lists,
  sessions: window.__acorn.state.words.sessions,
  scale: window.__acorn.state.settings.textScale,
  tint: window.__acorn.state.settings.tint,
}));

async function pasteAndRestore(page, text){
  await page.evaluate(() => window.__acorn.go('parent'));
  await page.locator('#restore').fill(text);
  await page.locator('#restoreGo').click();          // arms
  await page.locator('#restoreGo').click();          // confirms
}

const {existsSync, readdirSync, statSync} = require('node:fs');
const nodePath = require('node:path');

test.describe('recordings cover what she can meet', () => {

  test('every word and every syllable piece has a file', async ({page}) => {
    await open(page, '2026-08-01');
    const wanted = await page.evaluate(() => {
      const a = window.__acorn, out = new Set();
      a.allLists().forEach(l => {
        a.state.words.activeId = l.id;
        a.wordsOf(l).forEach(w => {
          out.add(w);
          const parts = a.splitOf(w);
          if(parts.length > 1) parts.forEach(p => out.add(p));
        });
      });
      return [...out];
    });
    const paths = await page.evaluate(ws => {
      const o = {}; ws.forEach(w => o[w] = window.__acorn.clipFor(w)); return o;
    }, wanted);

    // Nothing recorded yet is a fine state to be in; a partial set is not,
    // because the gaps fall back silently to the phone voice.
    const recorded = wanted.filter(w => paths[w]);
    if(!recorded.length) test.skip(true, 'no recordings in the repo');

    const missing = [];
    for(const w of wanted){
      const p = paths[w];
      if(!p){ missing.push(`${w}: not in the index`); continue; }
      const file = nodePath.resolve(__dirname, '..', p);
      if(!existsSync(file)) missing.push(`${w}: no file at ${p}`);
      else if(statSync(file).size < 400) missing.push(`${w}: only ${statSync(file).size} bytes`);
    }
    expect(missing).toEqual([]);
  });

  test('nothing on disk is a file the app will never ask for', async ({page}) => {
    await open(page, '2026-08-01');
    const dir = nodePath.resolve(__dirname, '..', 'audio');
    if(!existsSync(dir)) test.skip(true, 'no recordings in the repo');
    const onDisk = readdirSync(dir).filter(f => /\.(m4a|mp3|wav)$/.test(f));
    const used = await page.evaluate(() => {
      const a = window.__acorn, out = new Set();
      // Everything the app can speak: list words, their pieces, and its own lines.
      a.allLists().forEach(l => {
        a.state.words.activeId = l.id;
        a.wordsOf(l).forEach(w => {
          out.add(w);
          a.splitOf(w).forEach(p => out.add(p));
        });
      });
      ['Every word counts.'].forEach(t => out.add(t));
      return [...out].map(t => window.__acorn.clipFor(t)).filter(Boolean)
                     .map(p => p.replace(/^.*\//, ''));
    });
    const orphans = onDisk.filter(f => !used.includes(f));
    expect(orphans).toEqual([]);
  });
});

test.describe('putting a backup back', () => {

  test('everything comes back after the phone has been wiped', async ({page}) => {
    await open(page, '2026-08-01');
    const backup = await seedProgress(page);
    const before = await stateOf(page);

    // The phone is wiped, or she opens it on a new one.
    await page.evaluate(() => { localStorage.clear(); window.__acorn.reset(); });
    expect(Object.keys((await stateOf(page)).mastery)).toEqual([]);

    await pasteAndRestore(page, backup);
    const after = await stateOf(page);
    expect(after.mastery).toEqual(before.mastery);
    expect(after.lists).toEqual(before.lists);
    expect(after.sessions).toEqual(before.sessions);
    expect(after.scale).toBe(before.scale);
    expect(after.tint).toBe(before.tint);
    expect(errorsOf(page)).toEqual([]);
  });

  test('it survives a reload, so it really was written down', async ({page}) => {
    await open(page, '2026-08-01');
    const backup = await seedProgress(page);
    await page.evaluate(() => { localStorage.clear(); window.__acorn.reset(); });
    await pasteAndRestore(page, backup);
    await page.reload();
    await page.waitForFunction(() => !!window.__acorn);
    expect(Object.keys((await stateOf(page)).mastery).sort())
      .toEqual(['because','friend','said']);
  });

  test('it asks twice, and one tap changes nothing', async ({page}) => {
    await open(page, '2026-08-01');
    const backup = await seedProgress(page);
    await page.evaluate(() => { localStorage.clear(); window.__acorn.reset(); });
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('#restore').fill(backup);
    await page.locator('#restoreGo').click();
    // The first tap only warns, and says what it is about to do.
    await expect(page.locator('#restoreGo')).toContainText(/3 words, 1 saved list, 1 sitting/);
    // Armed, it is about to replace everything, and should look like it.
    await expect(page.locator('#restoreGo')).toHaveClass(/danger/);
    expect(Object.keys((await stateOf(page)).mastery)).toEqual([]);
  });

  test('rubbish in the box changes nothing', async ({page}) => {
    await open(page, '2026-08-01');
    await seedProgress(page);
    const before = await stateOf(page);
    for(const junk of ['', '   ', 'hello', '{', '[]', 'null', '{"nope":1}',
                       '{"words":"not an object"}', '<html>']){
      await pasteAndRestore(page, junk);
      expect(await stateOf(page), `after pasting ${JSON.stringify(junk)}`).toEqual(before);
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('a truncated backup is refused rather than half-applied', async ({page}) => {
    await open(page, '2026-08-01');
    const backup = await seedProgress(page);
    const before = await stateOf(page);
    await pasteAndRestore(page, backup.slice(0, Math.floor(backup.length * 0.6)));
    expect(await stateOf(page)).toEqual(before);
    await expect(page.locator('#toast')).toContainText(/does not look like a backup/);
  });

  test('a backup pasted into the word box is not turned into a word list',
    async ({page}) => {
      await open(page, '2026-08-01');
      const backup = await seedProgress(page);
      const listsBefore = (await stateOf(page)).lists.length;
      await page.evaluate(() => window.__acorn.go('parent'));
      await page.locator('#paste').fill(backup);
      await page.locator('#pasteSave').click();
      await expect(page.locator('#toast')).toContainText(/that is a backup/i);
      expect((await stateOf(page)).lists.length).toBe(listsBefore);
    });

  test('what Copy produces is what Restore accepts', async ({page}) => {
    await open(page, '2026-08-01');
    await seedProgress(page);
    // Read the exported text through the same path the button uses.
    const exported = await page.evaluate(() => JSON.stringify(window.__acorn.state, null, 2));
    await page.evaluate(() => { localStorage.clear(); window.__acorn.reset(); });
    await pasteAndRestore(page, exported);
    expect(Object.keys((await stateOf(page)).mastery).sort())
      .toEqual(['because','friend','said']);
  });

  test('none of it is on her screens', async ({page}) => {
    await open(page, '2026-08-01');
    await expect(page.locator('#restore')).toHaveCount(0);
    await expect(page.locator('#restoreGo')).toHaveCount(0);
  });
});
