// The stylesheet is built on three scales and stays on them.
//
// --t-* for type, --s* for space, --r-* for corners. A literal length in a
// declaration is either a deliberate exception with a reason, or it is drift: a value
// that happens to match a token today and silently stops matching the moment the
// token moves. Four of them were exactly that — the floor of the word's clamp was
// ".75rem" where --t-xs is .75rem, the dot and speaker icons were sized off ".875rem"
// and "1.375rem" where --t-sm and --t-xl hold those values.
//
// This test reads the stylesheet out of the page rather than parsing the file, so it
// measures what the browser actually applies.
const {test, expect} = require('@playwright/test');
const {open} = require('./helpers');

/* cssText re-serialises what it was given: ".75rem" comes back as "0.75rem", and
   "0.5REM" as "0.5rem". Comparing the authored token against the serialised literal
   as strings matched nothing at all and the test passed while catching zero drift —
   so both sides go through here first. */
function norm(len){
  const m = String(len).trim().match(/^(\d*\.?\d+)(px|rem|em)$/i);
  if(!m) return null;
  // Zero is zero on every scale, and the browser writes plenty of it into
  // longhands nobody authored ("padding: 0" becomes four 0px declarations).
  return parseFloat(m[1]) === 0 ? null : parseFloat(m[1]) + m[2].toLowerCase();
}

/* Lengths that are not on any scale and should not be. Each needs its reason.
   Written against the LONGHANDS, because the browser expands what was authored:
   "border: 1px solid" arrives here as four border-*-width declarations, "outline"
   as outline-width and outline-offset, "flex" as flex-basis. */
const ALLOWED = [
  // Hairlines and strokes. A 1px rule is 1px at every text size on purpose — scaling
  // borders with type makes a focus ring look like a frame at 1.5x.
  /^(border|outline|box-shadow|text-decoration)(-[a-z]+)*$/,
  // Tracking and word spacing are a share of the font size, which is what em is for.
  /^(letter-spacing|word-spacing)$/,
];
const ALLOWED_EXACT = new Set([
  // The root font size. The whole --t-* scale is relative to it, so it cannot be on
  // it. 1.0625rem of the browser's own base keeps the OS text-size setting counting.
  'font-size:1.0625rem',
  // #kbhold. Below 16px iOS zooms the page when an input takes focus, and this one
  // takes focus on every stage to hold the keyboard open.
  'font-size:16px',
  // The app's own width, and the same constant inside the word's clamp so the two
  // cannot disagree. A page width is not a spacing step.
  'max-width:34rem', 'font-size:34rem',
  // One line box tall, in the heading's own em, so the mark is square whatever the
  // text size — see the comment above .mark svg.
  'width:1.3em', 'height:1.3em',
  // Visually-hidden clipping box, and the textarea's opening height.
  'width:1px', 'height:1px', 'min-height:5.5rem',
  // Flex basis for the settings label column.
  'flex-basis:7rem',
  /* Flex basis for a stat card on the grown-ups screen. A card width is not a spacing
     step, and it is measured rather than chosen: three across on a 320px phone get 90px
     each and "215 recorded" wants 88 of them at her middle text size, so the basis has
     to sit under that to keep three across there and over a third of the row once her
     text grows, at which point they wrap instead of clipping their own labels. */
  'flex-basis:5rem',
  // Underline offset on a marked letter, a share of its own size.
  'padding-bottom:0.08em',
]);

test.describe('the three scales', () => {

  test('no declaration restates a scale value as a literal', async ({page}) => {
    await open(page, '2026-08-01');
    const found = await page.evaluate(() => {
      // The token values as authored: a custom property is not resolved to px, so
      // getComputedStyle hands back the ".75rem" the scale actually declares.
      const cs = getComputedStyle(document.documentElement);
      // --tap* is a scale too: every tappable thing in the app is held to it, and a
      // literal 3rem somewhere would drift away from it just the same.
      const names = ['--t-xs','--t-sm','--t-md','--t-lg','--t-xl','--t-2xl','--t-3xl','--t-4xl',
                     '--s1','--s2','--s3','--s4','--s5','--s6','--s7',
                     '--r-sm','--r-md','--r-lg','--r-pill',
                     '--tap','--tap-lg','--tap-xl',
                     '--m-press','--m-quick','--m-slow'];
      const tokens = {};
      names.forEach(n => { const v = cs.getPropertyValue(n).trim(); if(v) tokens[n] = v; });
      const sheet = [...document.styleSheets].find(s => !s.href);
      const out = [];
      const walk = rules => {
        /* A plain CSSStyleRule in Chromium carries an EMPTY BUT TRUTHY cssRules,
           because of CSS nesting. Recursing on `if(r.cssRules)` and then skipping
           the rule treated every rule as a container and visited none of them —
           both tests in this file passed while reading nothing at all. Collect
           first, then descend only into a list that has something in it. */
        for(const r of rules){
          if(r.cssText && r.style){
            const body = r.cssText.slice(r.cssText.indexOf('{') + 1, r.cssText.lastIndexOf('}'));
            body.split(';').forEach(chunk => {
              const i = chunk.indexOf(':');
              if(i < 1) return;
              const prop = chunk.slice(0, i).trim();
              if(prop.startsWith('--')) return;
              out.push({sel: r.selectorText || '', prop, val: chunk.slice(i + 1).trim()});
            });
          }
          if(r.cssRules && r.cssRules.length) walk(r.cssRules);
        }
      };
      walk(sheet.cssRules);
      return {tokens, decls: out};
    });
    /* Every value the three scales hold, as written. Fewer entries than there are
       tokens, and that is the scales agreeing with each other: --t-xs and --s3 are
       both .75rem, --t-md and --s4 and --r-md are all 1rem. 25 tokens; durations are their own units so they add three more values. */
    const scaleValues = new Map();
    for(const [k, v] of Object.entries(found.tokens)){
      const n = norm(v);
      if(n) scaleValues.set(n, k);
    }
    expect(Object.keys(found.tokens).length, 'the scales did not parse out of the page')
      .toBe(25);
    expect(scaleValues.size).toBeGreaterThan(10);

    const drift = [];
    for(const d of found.decls){
      if(ALLOWED.some(re => re.test(d.prop))) continue;
      // Every length literal in the value, including inside calc/clamp/min.
      for(const m of d.val.matchAll(/(?<![\w.$-])(\d*\.?\d+)(px|rem|em)\b/g)){
        const lit = norm(m[1] + m[2]);
        if(!lit || ALLOWED_EXACT.has(`${d.prop}:${lit}`)) continue;
        const tok = scaleValues.get(lit);
        if(tok) drift.push(`${d.sel} { ${d.prop}: ...${lit}... }  is ${tok}`);
      }
    }
    expect([...new Set(drift)],
      'these spell out a scale value instead of using its token, so they stop\n' +
      'matching the moment the scale moves').toEqual([]);
  });

  test('every length that is not on a scale has a recorded reason', async ({page}) => {
    // The list above is the reason. Anything new turns up here and has to be either
    // put on a scale or written down as an exception — which is the point.
    await open(page, '2026-08-01');
    const decls = await page.evaluate(() => {
      const sheet = [...document.styleSheets].find(s => !s.href);
      const out = [];
      const walk = rules => {
        for(const r of rules){
          if(r.style) for(const prop of r.style){
            if(prop.startsWith('--')) continue;
            out.push({sel: r.selectorText || '', prop,
                      val: r.style.getPropertyValue(prop).trim()});
          }
          if(r.cssRules && r.cssRules.length) walk(r.cssRules);   // see above
        }
      };
      walk(sheet.cssRules);
      return out;
    });
    const loose = [];
    for(const d of decls){
      if(ALLOWED.some(re => re.test(d.prop))) continue;
      for(const m of d.val.matchAll(/(?<![\w.$-])(\d*\.?\d+)(px|rem|em)\b/g)){
        const lit = norm(m[1] + m[2]);
        if(!lit || ALLOWED_EXACT.has(`${d.prop}:${lit}`)) continue;
        loose.push(`${d.prop}: ${lit}   in  ${d.sel}`);
      }
    }
    expect([...new Set(loose)],
      'off every scale and not in the allowed list — put it on a scale, or add it\n' +
      'to ALLOWED_EXACT with the reason').toEqual([]);
  });

  test('the type scale is what the type actually uses', async ({page}) => {
    // A rendered font size that is on no step of the scale means something is being
    // sized by hand. Measured live, so calc() and clamp() are resolved.
    await open(page, '2026-08-01');
    const r = await page.evaluate(() => {
      const a = window.__acorn;
      a.state.words.lists = [{id:'w', name:'T', words:['licence', 'because']}];
      a.state.words.activeId = 'w'; a.save(); a.go('parent'); a.go('day');
      if(!a.session()) a.start();
      const cs = getComputedStyle(document.documentElement);
      const root = parseFloat(cs.fontSize);
      const steps = ['--t-xs','--t-sm','--t-md','--t-lg','--t-xl','--t-2xl','--t-3xl','--t-4xl']
        .map(t => parseFloat(cs.getPropertyValue(t)) * root);
      const odd = [];
      document.querySelectorAll('#app *').forEach(el => {
        const s = getComputedStyle(el);
        if (s.display === 'none' || !el.getBoundingClientRect().height) return;
        const txt = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
        if (!txt) return;
        const px = parseFloat(s.fontSize);
        // The word itself is deliberately fluid between two steps of the scale, so
        // it is bounded by them rather than equal to one. The traced word (and its
        // per-letter spans) carries the same fluid clamp, for the same reason.
        if (el.classList.contains('word') || el.classList.contains('marked')
            || el.closest('.trace')) return;
        if (!steps.some(v => Math.abs(v - px) < 0.6))
          odd.push(`${el.className || el.tagName}: ${px.toFixed(1)}px`);
      });
      return {steps: steps.map(v => +v.toFixed(1)), odd: [...new Set(odd)]};
    });
    expect(r.odd, `sized off the scale; the steps are ${r.steps.join(', ')}px`).toEqual([]);
  });

});
