// Contrast, measured rather than eyeballed. Every rendered text node on every
// screen, in light and dark, on cream and all four tints, must clear WCAG AA
// (4.5:1, or 3:1 for large text). Placeholders too — left to the browser they
// are a fixed grey that ignores the colour scheme.
const {test, expect} = require('@playwright/test');
const {open} = require('./helpers');

/* The names the app actually has. This read ['cream','pink','mint','sky','grey'] and two of
   those are not tints: data-tint="pink" and data-tint="sky" match no rule, so --surface stayed
   at the cream default and the suite measured cream three times while reporting five. Peach and
   blue had never been measured at all in light mode, and blue turned out to hold the worst
   pair in the app. Taken from index.html's own TINTS, and checked below that the one under
   test really took — a wrong name has to fail loudly rather than quietly become cream. */
const TINTS = ['cream', 'peach', 'mint', 'blue', 'grey'];

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
    if (cs.visibility === 'hidden' || cs.display === 'none') return;
    /* A disabled control is exempt — WCAG carves them out, and dimming one is exactly how a
       greyed-out button says "not available". The only ones here are the playlist's move
       arrows at the top and bottom of the list, which cannot go further that way. */
    if (el.disabled || el.closest('[disabled]')) return;
    /* Faded text used to be skipped here, and that is where every failure in the app was.
       Dimming by opacity moves the text towards whatever is behind it, so the same rule
       measured 2.26:1 on blue and passed on cream — and this audit excluded exactly those
       elements from being measured at all. Cumulative opacity from every ancestor is folded
       into the colour instead, which is what the eye sees. Below 2% is mid-animation rather
       than faded, and there is nothing to read yet. */
    let fade = 1, up = el;
    while (up) { fade *= Number(getComputedStyle(up).opacity); up = up.parentElement; }
    if (fade < .02) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const px = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700, bg = bgOf(el);
    const txt = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim())
                                  .map(n => n.textContent.trim()).join(' ');
    // Opacity multiplies the colour's own alpha, so a faded element composites further
    // towards its background — the whole reason the three that failed were failing.
    const faded = c => c && [c[0], c[1], c[2], c[3] * fade];
    if (txt) record(el, faded(parse(cs.color)), bg, px, bold,
                    (el.className || el.tagName.toLowerCase()) + ': ' + txt.slice(0, 30)
                    + (fade < .99 ? ` [opacity ${fade.toFixed(2)}]` : ''));
    if (el.placeholder) {
      const p = getComputedStyle(el, '::placeholder');
      record(el, faded(parse(p.color)), bgOf(el), parseFloat(p.fontSize) || px, false,
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
    /* The finished screen was never measured here at all, and neither was a word
       carrying a meaning cue — .cue is the one thing on the writing screen she
       cannot work out for herself, so it is the last thing that should be hard to
       read. Nothing failed when they were added; they are here so nothing can. */
    if(o.stage === 'cued'){
      // Both carry a meaning cue, so whichever the session shows first puts .cue on the
      // screen — since 13.0 the write screen has no button text to pad it out otherwise.
      // Clear the review word too, or "said" (due, no cue) takes the first slot and the
      // cue never renders.
      a.state.words.lists = [{id:'h', name:'T', words:['licence', 'practise']}];
      a.state.words.activeId = 'h'; a.state.words.mastery = {}; a.state.words.sessions = [];
      a.save();
    }
    if(o.screen === 'parent'){ a.go('parent'); return; }
    if(o.stage === 'deadend'){
      a.state.words.lists = [{id:'e', name:'Empty', words:[]}];
      a.state.words.activeId = 'e'; a.state.words.mastery = {}; a.save();
      a.go('day'); return;                       // the one grown-up sentence she sees
    }
    a.go('day'); a.start();
    if(o.stage === 'write' || o.stage === 'cued') a.cover();
    if(o.stage === 'nearly'){ a.cover(); a.type('becuase'); a.check(); }
    if(o.stage === 'right'){ a.cover(); a.type('because'); a.check(); }
    if(o.stage === 'lost'){ a.cover(); a.type('zzz'); a.check(); }
    if(o.stage === 'done'){
      for(let g = 0; g < 90 && a.session(); g++){
        const W = a.session();
        if(W.stage === 'look'){ a.cover(); continue; }
        if(W.stage === 'write'){ a.type(W.words[W.i]); a.check(); a.next(); continue; }
        a.next();
      }
    }
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
                                       ['day','right'], ['day','lost'], ['day','cued'],
                                       ['day','done'], ['day','deadend'], ['parent','-']]) {
          await seed(page, tint, screen, stage);
          /* That the seed took and nothing sanitised it away — not that the name is real.
             An unknown name sets the attribute and passes this check while changing no
             colour at all, which is how two of these were cream in disguise for months;
             the test at the bottom of this file is what holds the list to the stylesheet. */
          const took = await page.evaluate(t => {
            const r = document.documentElement;
            if(r.getAttribute('data-tint') !== t) return 'attribute is ' + r.getAttribute('data-tint');
            if(window.__acorn.state.settings.tint !== t) return 'state is '
              + window.__acorn.state.settings.tint;
            return null;
          }, tint);
          expect(took, `the "${tint}" tint did not take: ${took}`).toBeNull();
          const rows = await page.evaluate(AUDIT);
          // A guard against the seed silently doing nothing, not a content check: the
          // dead end really is two lines, the mark and the sentence asking for words.
          // The write stage can legitimately render NO text now — a just-traced new
          // word with no meaning cue is a covered box and dots alone, its instruction
          // dropped (13.4) and its spoken cue living in the aria-live region outside
          // #screen — so write allows zero. The ratio filter below still measures every
          // text node that IS there, on every stage.
          // cued = the meaning cue with no instruction beside it ("means:" + the word,
          // two nodes) now that the write line is gone; the cue is still what matters and
          // is still measured. write = a plain covered box, which can be text-free.
          expect(rows.length, `${screen}/${stage} rendered nothing`)
            .toBeGreaterThanOrEqual(stage === 'deadend' ? 2 : stage === 'write' ? 0
                                  : stage === 'cued' ? 2 : 3);
          rows.filter(r => r.ratio < r.need)
              .forEach(r => fails.push(`${screen}/${stage} ${r.ratio}:1 (need ${r.need}) ${r.px}px — ${r.what}`));
        }
        expect(fails).toEqual([]);
      });
    }
  });
}

/* The audit checking itself, because both of the holes it had were invisible from the
   outside: it reported five tints while measuring three, and it skipped the faded text that
   turned out to hold every failure in the app. A green run means nothing if the thing doing
   the measuring cannot see the case. */
test.describe('the audit can see what it is for', () => {

  test('it reports text dimmed by opacity rather than skipping it', async ({page}) => {
    await open(page, '2026-08-01');
    await page.evaluate(() => {
      const el = document.createElement('p');
      el.id = 'planted';
      el.textContent = 'planted';
      // Ink on its own background, then faded until it cannot be read. Nothing about the
      // colour is wrong; the opacity is what makes it unreadable.
      el.style.cssText = 'color:var(--ink); opacity:.15; font-size:16px';
      document.querySelector('#app').appendChild(el);
    });
    const all = await page.evaluate(AUDIT);
    await page.evaluate(() => document.querySelector('#planted').remove());
    const rows = all.filter(r => /planted/.test(r.what));
    expect(rows.length, 'faded text was not measured at all').toBe(1);
    expect(rows[0].ratio, `planted text measured ${rows[0].ratio}:1, which is not dim`)
      .toBeLessThan(4.5);
    expect(rows[0].what, 'the report does not say the text was faded').toMatch(/opacity/);
  });

  test('and every tint it names is one the app has', async ({page}) => {
    /* The other hole. An unknown name sets data-tint and changes no colour at all, so the
       list is taken from the stylesheet — the rules are what decide whether a tint exists,
       and "cream" is the default with no rule of its own. */
    await open(page, '2026-08-01');
    const real = await page.evaluate(() => {
      const sheet = [...document.styleSheets].find(s => !s.href);
      const names = new Set(['cream']);
      const walk = rules => { for(const r of rules){
        if(r.selectorText)
          for(const m of r.selectorText.matchAll(/\[data-tint="([a-z]+)"\]/g)) names.add(m[1]);
        if(r.cssRules && r.cssRules.length) walk(r.cssRules);
      } };
      walk(sheet.cssRules);
      return [...names];
    });
    expect(TINTS.slice().sort(), 'the tints measured are not the tints the app has')
      .toEqual(real.slice().sort());
  });

});
