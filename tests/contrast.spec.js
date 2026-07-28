// Contrast, measured rather than eyeballed. Every rendered text node on every
// screen, in light and dark, on cream and all four tints, must clear WCAG AA
// (4.5:1, or 3:1 for large text). Placeholders too — left to the browser they
// are a fixed grey that ignores the colour scheme.
const {test, expect} = require('@playwright/test');
const {open} = require('./helpers');

const TINTS = ['cream', 'pink', 'mint', 'sky', 'grey'];

// Runs in the page: walks the DOM, resolves each text node's effective
// background through transparent ancestors, and returns measured ratios.
const AUDIT = () => {
  const lum = c => { const f = c.map(v => { v /= 255;
    return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); });
    return .2126*f[0] + .7152*f[1] + .0722*f[2]; };
  const parse = s => { const m = String(s).match(/[\d.]+/g);
    return m ? m.slice(0,3).map(Number).concat([m[3] === undefined ? 1 : Number(m[3])]) : null; };
  const over = (fg, bg) => [0,1,2].map(i => fg[i]*fg[3] + bg[i]*(1-fg[3]));
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p,q) => q-p); return (x+.05)/(y+.05); };
  const bgOf = el => {
    let n = el, acc = null;
    while (n) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c[3] > 0) { acc = acc ? over(acc.concat([1]), c) : c.slice(0,3); if (c[3] === 1) return acc; }
      n = n.parentElement;
    }
    return acc || [255,255,255];
  };
  const out = [];
  const record = (el, fg, bg, px, bold, what) => {
    const large = px >= 24 || (px >= 18.66 && bold);
    out.push({what, ratio: Math.round(ratio(over(fg, bg), bg) * 100) / 100,
              need: large ? 3 : 4.5, px: Math.round(px)});
  };
  document.querySelectorAll('#app *').forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < .99) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const px = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700, bg = bgOf(el);
    const txt = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim())
                                  .map(n => n.textContent.trim()).join(' ');
    if (txt) record(el, parse(cs.color), bg, px, bold,
                    (el.className || el.tagName.toLowerCase()) + ': ' + txt.slice(0, 30));
    if (el.placeholder) {
      const p = getComputedStyle(el, '::placeholder');
      record(el, parse(p.color), bgOf(el), parseFloat(p.fontSize) || px, false,
             'placeholder: ' + el.placeholder);
    }
  });
  return out;
};

// Put something on every screen worth measuring.
async function seed(page, tint, screen, stage){
  await page.evaluate(o => {
    const a = window.__acorn;
    a.state.settings.tint = o.tint;
    a.state.profile.name = 'X';
    a.state.words.lists = [{id:'w1', name:'Week 5', words:['because','friend','thought']}];
    a.state.words.activeId = 'w1';
    a.state.words.mastery = {said:{right:1, wrong:4, box:1, lastSeen:'2026-07-31'}};
    a.state.words.sessions = [{date:'2026-07-31', asked:8, right:6}];
    a.save();
    if(o.screen === 'parent'){ a.go('parent'); return; }
    a.go('day'); a.start();
    if(o.stage === 'write') a.cover();
    if(o.stage === 'nearly'){ a.cover(); a.type('becuase'); a.check(); }
    if(o.stage === 'right'){ a.cover(); a.type('because'); a.check(); }
  }, {tint, screen, stage});
}

for (const scheme of ['light', 'dark']) {
  test.describe(`contrast in ${scheme}`, () => {
    test.use({colorScheme: scheme});

    for (const tint of TINTS) {
      test(`${tint}: every text node clears AA`, async ({page}) => {
        await open(page, '2026-08-01');
        const fails = [];
        for (const [screen, stage] of [['day','look'], ['day','write'], ['day','nearly'],
                                       ['day','right'], ['parent','-']]) {
          await seed(page, tint, screen, stage);
          const rows = await page.evaluate(AUDIT);
          expect(rows.length, `${screen}/${stage} rendered nothing`).toBeGreaterThan(2);
          rows.filter(r => r.ratio < r.need)
              .forEach(r => fails.push(`${screen}/${stage} ${r.ratio}:1 (need ${r.need}) ${r.px}px — ${r.what}`));
        }
        expect(fails).toEqual([]);
      });
    }
  });
}
