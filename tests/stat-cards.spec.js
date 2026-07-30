// The numbers a grown-up came to read.
//
// The six cards on the grown-ups screen were flex:1 1 0 with no wrap, so they were
// squeezed to whatever a third of the row happened to be. At 320px and the largest text
// that is 81px, and the contents simply painted over the edges: "215" crossed the border
// into the gap and "recorded" was cut to "recorde" by the next card sitting on top of it.
// Nothing overflowed the page and nothing was clipped by the app's own measuring, so the
// suite was quiet about it — it only shows up in a screenshot, or by asking each card
// whether its own contents fit inside it.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');

// A history with two-digit and three-digit numbers in it, so the widest label and the
// widest number are both on the screen at once.
async function statsAt(page, w, scale){
  await page.setViewportSize({width: w, height: 900});
  return page.evaluate(s => {
    const a = window.__acorn;
    a.state.settings.textScale = s;
    a.state.words.lists = [{id: 'st', name: 'Week 9', words: ['beautiful', 'said', 'rain']}];
    a.state.words.activeId = 'st';
    const m = {};
    ['beautiful', 'said', 'rain', 'through', 'because', 'plain', 'sail', 'light', 'night',
     'right', 'thought', 'friend', 'people', 'water', 'other'].forEach((w, i) => {
      m[w] = {box: 1 + (i % 7), right: i, wrong: i % 3, last: '2026-07-28'};
    });
    a.state.words.mastery = m;
    a.state.words.sessions = Array.from({length: 123}, (_, i) =>
      ({day: 'd' + i, asked: 11, right: 9}));
    a.save(); a.go('parent');
    const cards = [...document.querySelectorAll('.stat')].map(el => {
      const eb = el.getBoundingClientRect();
      const spill = [...el.children].filter(k => {
        const kb = k.getBoundingClientRect();
        return kb.right > eb.right + 0.5 || kb.left < eb.left - 0.5;
      }).map(k => k.textContent.trim());
      return {
        text: el.textContent.replace(/\s+/g, ' ').trim(),
        label: (el.querySelector('span') || {}).textContent || '',
        number: (el.querySelector('b') || {}).textContent || '',
        width: Math.round(eb.width),
        over: el.scrollWidth - el.clientWidth,
        spill: spill,
        top: Math.round(eb.top),
      };
    });
    return {cards,
            sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1};
  }, scale);
}

test.describe('the numbers on the grown-ups screen', () => {

  test('no card paints its contents outside itself', async ({page}) => {
    await open(page, '2026-08-01');
    for(const w of [280, 320, 360, 390, 412, 768]){
      for(const scale of [0.8, 0.9, 1, 1.2, 1.5]){
        const r = await statsAt(page, w, scale);
        expect(r.cards.length, `${w}@${scale}: no cards rendered at all`).toBeGreaterThan(0);
        for(const c of r.cards){
          expect(c.over, `${w}@${scale}: "${c.text}" wants ${c.over}px more than its card`)
            .toBeLessThanOrEqual(1);
          expect(c.spill, `${w}@${scale}: "${c.text}" painted outside its card`).toEqual([]);
        }
        expect(r.sideways, `${w}@${scale} scrolls sideways`).toBe(false);
      }
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('and the labels read as whole words, not cut ones', async ({page}) => {
    /* The visible failure was "recorde". Comparing each label against the width its own
       text needs catches the clip whether the next card covers it or not. */
    await open(page, '2026-08-01');
    for(const w of [320, 390]){
      for(const scale of [1, 1.2, 1.5]){
        const r = await statsAt(page, w, scale);
        const measured = await page.evaluate(() => [...document.querySelectorAll('.stat')]
          .map(el => {
            const s = el.querySelector('span'), b = el.querySelector('b');
            const need = n => {
              if(!n) return 0;
              const rg = document.createRange();
              rg.selectNodeContents(n);
              return Math.max(...[...rg.getClientRects()].map(x => x.width), 0);
            };
            const inner = el.clientWidth
              - parseFloat(getComputedStyle(el).paddingLeft)
              - parseFloat(getComputedStyle(el).paddingRight);
            return {label: s ? s.textContent : '', num: b ? b.textContent : '',
                    labelNeeds: Math.ceil(need(s)), numNeeds: Math.ceil(need(b)),
                    room: Math.floor(inner)};
          }));
        for(const c of measured){
          expect(c.labelNeeds, `${w}@${scale}: "${c.label}" needs ${c.labelNeeds}px in ${c.room}px`)
            .toBeLessThanOrEqual(c.room);
          expect(c.numNeeds, `${w}@${scale}: the number "${c.num}" needs ${c.numNeeds}px in ${c.room}px`)
            .toBeLessThanOrEqual(c.room);
        }
      }
    }
  });

  test('three across is kept on a real phone at her middle text size', async ({page}) => {
    /* Wrapping is the fix, but wrapping a screen that used to fit would be a different
       kind of worse — the three numbers in a row are how a group reads. The basis is set
       just under what three cards get on a 320px phone for exactly this reason. */
    await open(page, '2026-08-01');
    for(const w of [320, 360, 390, 412]){
      for(const scale of [0.8, 0.9, 1]){
        const r = await statsAt(page, w, scale);
        const rows = new Set(r.cards.map(c => c.top)).size;
        expect(rows, `${w}@${scale}: the six cards took ${rows} rows instead of two`).toBe(2);
      }
    }
  });

  test('a number long enough to need the room gets it', async ({page}) => {
    // Four digits is 27 sittings a week for three years, so this is a guard rather than
    // a case she will reach — but a card that cannot hold its number is the whole defect.
    await open(page, '2026-08-01');
    await page.setViewportSize({width: 320, height: 900});
    const r = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.settings.textScale = 1.5;
      a.state.words.lists = [{id: 'big', name: 'W', words: ['said']}];
      a.state.words.activeId = 'big';
      a.state.words.mastery = {};
      a.state.words.sessions = Array.from({length: 4321}, (_, i) =>
        ({day: 'd' + i, asked: 11, right: 9}));
      a.save(); a.go('parent');
      return [...document.querySelectorAll('.stat')].map(el => ({
        text: el.textContent.replace(/\s+/g, ' ').trim(),
        over: el.scrollWidth - el.clientWidth,
      }));
    });
    for(const c of r)
      expect(c.over, `"${c.text}" wants ${c.over}px more than its card`).toBeLessThanOrEqual(1);
    expect(errorsOf(page)).toEqual([]);
  });

});
