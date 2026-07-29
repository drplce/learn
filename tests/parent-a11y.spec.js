// The grown-ups screen, to a screen reader.
//
// It is a settings page: eight places where a run of toggle buttons is really one
// choice. Four of them said so — role="group" pointing at their own label — and three
// did not, so "Largest, pressed false" arrived with nothing to say it was about text
// size. The pattern already existed; it had just not been applied to Which list, Text
// size and Background.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

async function onParent(page){
  await page.evaluate(() => {
    const a = window.__acorn;
    a.state.words.lists = [{id: 'w1', name: 'Week 5', words: ['said', 'rain']}];
    a.state.words.activeId = 'w1';
    a.state.profile.name = 'X';
    a.save(); a.go('parent');
  });
}

test.describe('the grown-ups screen, read out', () => {

  test('every run of choice buttons is one labelled group', async ({page}) => {
    await open(page, '2026-08-01');
    await onParent(page);
    const groups = await page.evaluate(() =>
      [...document.querySelectorAll('.seg')].map(g => {
        const by = g.getAttribute('aria-labelledby');
        const target = by ? document.getElementById(by) : null;
        return {
          role: g.getAttribute('role'),
          labelledby: by,
          labelText: target ? target.textContent.trim() : null,
          buttons: g.querySelectorAll('button').length,
        };
      }));
    expect(groups.length, 'no choice groups found at all').toBeGreaterThan(5);
    for(const g of groups){
      // The voice group is empty until the phone has spoken once, and an empty
      // group is nothing to announce.
      if(!g.buttons) continue;
      expect(g.role, `a group of ${g.buttons} buttons with no role`).toBe('group');
      expect(g.labelledby, `a group of ${g.buttons} buttons with no label`).toBeTruthy();
      expect(g.labelText, `aria-labelledby="${g.labelledby}" points at nothing`).toBeTruthy();
    }
  });

  test('every aria-labelledby on the page resolves', async ({page}) => {
    // A label that points at a missing id is worse than none: the control ends up
    // unnamed and nothing warns you.
    await open(page, '2026-08-01');
    for(const where of ['parent', 'day']){
      await onParent(page);
      if(where === 'day') await page.evaluate(() => window.__acorn.go('day'));
      const dangling = await page.evaluate(() =>
        [...document.querySelectorAll('[aria-labelledby]')]
          .flatMap(e => e.getAttribute('aria-labelledby').split(/\s+/)
            .filter(id => id && !document.getElementById(id))
            .map(id => (e.className || e.tagName) + ' -> #' + id)));
      expect(dangling, `on the ${where} screen`).toEqual([]);
    }
  });

  test('every text field has a label, not just a placeholder', async ({page}) => {
    // A placeholder is not a name: it disappears the moment she types, and some
    // screen readers never read it.
    await open(page, '2026-08-01');
    await onParent(page);
    const unnamed = await page.evaluate(() =>
      [...document.querySelectorAll('input, textarea')].filter(e => {
        if(e.id === 'kbhold') return true;              // deliberately hidden, checked below
        const lab = e.id ? document.querySelector(`label[for="${e.id}"]`) : null;
        return !(lab || e.getAttribute('aria-label') || e.getAttribute('aria-labelledby'));
      }).map(e => e.id || e.tagName));
    // Only the keyboard-holder, which is aria-hidden and out of the tab order.
    expect(unnamed).toEqual(['kbhold']);
    const held = await page.evaluate(() => {
      const e = document.querySelector('#kbhold');
      return {hidden: e.getAttribute('aria-hidden'), tab: e.getAttribute('tabindex')};
    });
    expect(held.hidden).toBe('true');
    expect(held.tab).toBe('-1');
  });

  test('each label points at the field under it', async ({page}) => {
    // A for= that names the wrong field reads as a name and moves focus to the wrong
    // place, which is harder to notice than no label at all.
    await open(page, '2026-08-01');
    await onParent(page);
    const wrong = await page.evaluate(() =>
      [...document.querySelectorAll('label[for]')].map(l => {
        const t = document.getElementById(l.getAttribute('for'));
        if(!t) return `${l.textContent.trim()} -> #${l.getAttribute('for')} (missing)`;
        // The field it names should be the next thing in its own part of the page.
        const near = l.parentElement && l.parentElement.contains(t);
        return near ? null : `${l.textContent.trim()} -> #${t.id} (elsewhere on the page)`;
      }).filter(Boolean));
    expect(wrong).toEqual([]);
  });

  test('the choice that is on is the only one marked so', async ({page}) => {
    await open(page, '2026-08-01');
    await onParent(page);
    const groups = await page.evaluate(() =>
      [...document.querySelectorAll('.seg')].map(g => ({
        label: (document.getElementById(g.getAttribute('aria-labelledby') || '') || {}).textContent,
        pressed: [...g.querySelectorAll('button[aria-pressed]')]
          .filter(b => b.getAttribute('aria-pressed') === 'true').length,
        total: g.querySelectorAll('button[aria-pressed]').length,
      })).filter(g => g.total > 1));
    expect(groups.length).toBeGreaterThan(3);
    for(const g of groups)
      expect(g.pressed, `"${(g.label || '').trim()}" has ${g.pressed} of ${g.total} pressed`).toBe(1);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a heading used as a label is still a heading', async ({page}) => {
    // Pointing a group at its own <h2> must not stop it being one: a screen reader
    // user navigating by heading still needs the section to be there.
    await open(page, '2026-08-01');
    await onParent(page);
    const heads = await page.evaluate(() =>
      [...document.querySelectorAll('#screen h2')].map(h => ({
        tag: h.tagName, id: h.id, text: h.textContent.trim(),
        role: h.getAttribute('role'), hidden: h.getAttribute('aria-hidden'),
      })));
    expect(heads.length).toBeGreaterThan(6);
    for(const h of heads){
      expect(h.tag).toBe('H2');
      expect(h.role, `"${h.text}" was given a role that is not a heading`).toBeNull();
      expect(h.hidden, `"${h.text}" is hidden from a screen reader`).toBeNull();
    }
  });

});
