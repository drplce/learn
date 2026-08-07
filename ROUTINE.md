# Acorn — autonomous routine

This file is the standing instruction for the hourly trigger. The trigger fires **every hour**
with one line ("Read ROUTINE.md and follow it") and never changes. Everything about *what* to do
and *how often* lives here, version-controlled and editable as a normal file — so nobody has to
touch the trigger again. David can retune the work or the cadence by editing this file.

---

## 1. CADENCE GATE — do this FIRST, every single firing

<!-- STATE — the routine reads these two values, and rewrites them at the end of a real pass.
     Keep them on these exact lines in this exact format; nothing else parses them. -->
```
interval: 2h
last-run: 2026-08-07T18:32Z
```

The trigger fires hourly, but you only do a **full pass** as often as `interval` says. On each
firing:

1. Read `interval` and `last-run` above. Run `date -u +"%Y-%m-%dT%H:%MZ"` for now.
2. Hours per interval: `hourly`=1, `2h`=2, `daily`=24, `weekly`=168.
3. **If less than that many hours have passed since `last-run`:** you are firing on an off-hour.
   Say one line — `not due (interval=X, Nh since last run, next due ~HH:MMZ)` — and **end the
   turn**. Do not run the harnesses, do not read the app, do not touch the repo or the trigger.
4. **Otherwise you are due:** do a full pass (sections 3–7 below). At the **end** of the pass,
   set `last-run` to the current time, re-decide `interval` per the ladder (section 2), rewrite
   both STATE lines, and commit ROUTINE.md together with whatever else the pass changed.

Never call `update_trigger` for cadence. The cadence lives here now. (The trigger stays hourly.)

---

## 2. CADENCE LADDER — how to set `interval` at the end of a pass

- **HOT → `hourly`.** Set hourly whenever there is an open request from David (a new feature,
  new words added to a list, a reported bug), OR this pass found or fixed a real defect. Stay
  hourly while anything is open or defects keep turning up.
- **COOLING → one step slower.** When a pass is clean — all three harnesses green, nothing
  found, nothing open — step the interval ONE level slower: `hourly`→`2h`→`daily`→`weekly`.
- **FLOOR.** `daily` is the working baseline; `weekly` is the calm floor. (The 2h
  active-development floor ended 2026-07-31.)
- **SELF-UPDATE.** When you cool to `weekly` (the calm steady state), before saving, revise THIS
  FILE: correct anything stale (pacing numbers, scope, the NOT-NOW list, dates), fold in what has
  been learned, keep it tight. This file is the living document now — not the trigger prompt.

**HOT (hourly) — David live 2026-08-07 with a new idea: pebbles as "sheep".** His concept: on the
finished/garden screen the word-pebbles wander gently like sheep; the ones not yet locked into memory
are strays at the edges, and as a word locks in it folds into the herd that sticks around the centre —
so there's more life/wandering on screen. My read (sent to him): it works AND it's meaningful because
it maps straight onto real mastery data (Leitner box / due / overdue) — herd = high box, strays = low
box or due/slipped, folding-in = a word climbing a box. It's a natural evolution of the pool prototype
(`scratchpad/pool.html`, artifact f0a92335) which already has wander/bump/settle/creep-from-edge.
Cautions I flagged: keep it to the FINISHED screen (never the still one-task word screen), respect
reduced-motion (freeze to a still arrangement), amble slowly, and make a straying sheep feel
*fetchable* not *failed*. I posed the one scope fork and am AWAITING his answer before building:
  1. **living map she watches** — finished screen comes alive (herd centre / strays edge), no new
     interaction; safe, high-delight, reuses the physics. (My recommendation to prototype first.)
  2. **herding game she plays** — tapping/gathering a stray IS the way into practising it; bigger,
     changes how she starts words, and the engine must still decide which strays are "loose" so she
     can't dodge the hard ones.
  **Do NOT build into the app; prototype only, and only on his go-ahead** (a cron firing is not his
  answer). Next: when he replies, build the living-herd prototype (#1) as a standalone artifact.

**Shipped and settled (13.44) — her birthday flower.** David came live on 2026-08-05 (her birthday)
and asked for "a fun birthday message and maybe a little flower — just for the day". Shipped a
once-a-year overlay above whatever screen she lands on: a coral flower (eight petals bloom staggered
from a gold centre, inline SVG on the app's scales/easing) and "Happy birthday!", shown AND spoken
(`say`), cleared by a tap or a ~7s safety timeout. Gated on the calendar day (`BIRTHDAY = '08-05'`,
month-day) so it recurs every birthday and is invisible every other day — no dead date to remove;
David confirmed 5 Aug each year is what he wants. Auto-shown at boot only when `!navigator.webdriver`,
so the Playwright suite is untouched by the real clock being the day; reached in tests through the
exposed `showBirthday()`/`isBirthday()`/`clearBirthday()`. `tests/birthday.spec.js` covers it;
`scales.spec` + `shed-order` guards updated (flower in vw/vh not rem; `.bday*` classes reached via a
birthday sweep). Verified on the 2026-08-06 daily pass that the gate correctly switched the flower
OFF the day after. Nothing open here.

**Still open — all blocked on David, nothing actionable for me.** The whole 13.36–13.43 arc is
shipped, live on `main`, and green. What remains open there is David's reaction, not work waiting to
be done.

**Shipped and live (13.36–13.43), the wordless-finish + pebble batch.** David sent a batch (with a
screenshot) and said "Ship 1 to 6. Go. I'll check tomorrow"; all shipped, teeth-checked, harnesses
green:
  - **13.36 — gentle whole-map arrival (Step 1).** On a session end the garden she already has
    settles in from the middle out (`.settling`) while tonight's words swell in last (`.arriving`).
    Built into the REAL map. Had to move it off a CSS transition onto the **Web Animations API**: a
    transition on freshly-built DOM is suppressed on first paint (transition-property lands in the
    same recalc as the value change), so on a fast compositor the flourish jumped straight to the
    end (latent in the original `.arriving` too — it only "worked" on real vsync hardware, invisible
    in headless). WAAPI plays everywhere, is capturable, honours reduced-motion by creating no
    animation, and lets tests assert real animation objects.
  - **13.37 — wordless finished screen.** The map case renders only the garden; line and praise gone
    from the screen. Dead end keeps its one sentence + tick. Every visible-headline/praise assertion
    moved to `#say` (spoken/announced channel); the "announced == on screen" principle gained a
    conscious exception (the picture is the visible counterpart).
  - **13.38 — no on-device selection** (`user-select:none` + `-webkit-touch-callout:none` app-wide,
    inputs keep it) fixes the blue highlight / press-hold callout on pebbles, mark, back; **progress
    pebbles 1.4× larger**.
  - **13.39 — praise → "Great effort.", SPOKEN** (David: "just say great effort"). One line whatever
    the evening, spoken via `say()` — a deliberate reversal of the old shown-not-spoken call (the
    wordless screen left nowhere to show it; the two warm words don't carry the synthetic-sarcasm
    risk the old count line did). Count stays in the live region only.
  - **13.40 — the way on is a breathing pebble**, not a worded button: a `--tap-xl` blob pulsing at
    `--m-breath` (a 4th motion-ladder value); pulse rides the svg not the button so the hit box is
    stable.
  - **13.41–13.43 — the "practise a bit more" pebble, refined per three follow-ups.** It gives ONE
    word, not a whole fresh sitting (`start(one)`); the daily allowance is a grown-up setting
    (`extraMax`, default 1, 0 turns it off) with its own Settings section; opening the app for a
    second sitting or after finishing lands straight on the finished screen, not a fresh load (boot
    fix: `if(finishedToday() || !start()) render()`); and the pebble simply does not appear when
    there is no next word to give (`canPractiseMore() && nextExtraWord()`). This CLOSED the two
    decisions that were flagged for David at 13.40 — the "daily max" now has a definition (the
    setting), and reopen-to-completed is done.

**STILL genuinely open for David (his product calls — do NOT invent answers):**
  1. **Feel the shipped set on his phone** — the gentle arrival (13.36), the wordless finish, the
     breathing pebble, the reward timing — and say whether pace/feel wants nudging.
  2. **Step 3 — the pool-physics map, PROTOTYPE ONLY** (`scratchpad/pool.html`, published artifact
     `f0a92335-3c27-4b0f-966f-523f0c6aa21d`). The end-of-session map as a full-SCREEN pebble pool:
     her word-pebbles (deep = known well) fill the screen, she drags one and it bumps the others
     (collisions resolved over a few passes), they settle (damping), and a soft inward force makes
     them creep back from the edges so none stick at the rim (his exact ask). Acorn's own blob code
     (`seeded`/`cellPoints`/`blobPath`) ported verbatim; coord bug avoided with a 1:1 pixel viewBox
     (pointer coords map straight, no `getScreenCTM` letterboxing). **NOT in the app — do NOT build
     the physics surface in without his explicit approval** (a cron firing is not approval). Open:
     does the feel/weight/settle work; should the pool BE the whole finished screen (folding in the
     wordless garden + the breathing pebble) or a mode she enters.
  3. **Bigger STATIC map** (only if we DON'T go full-physics) — a bigger/fuller map runs into
     `network.spec`'s deliberate composition invariants (horizon fixed at 6+floor(met/5), cells fill
     ¼–⅓ of the frame, camera stays close, one organism; a portrait frame and a deeper horizon both
     broke them). Which invariant to relax is his call. Only a small map-margin trim shipped.

  Build notes for if/when the physics map is approved: it turns the done-screen map from a fixed
  camera into a live physics surface (a real engine change — do it BEHIND the existing map so
  nothing breaks); needs real mastery data to pick which words are "deep enough".

**Vestigial, flagged not urgent:** the syllabifier (`splitOf`/`SYLLABLES`/`syllables()`) — nothing
the child sees or hears uses it any more (13.31 dropped the underline, 13.33 dropped the spoken
parts on a miss); it survives only in the clip prefetch and the model-level research tests. A future
tidy pass could tear it out — don't, without a reason.

**Cadence note (12:37Z, 2026-08-06):** full daily pass, first since the clock rolled past her
birthday — a real verification the date-gated flower switches off cleanly. Playwright 589 pass (no
flakes); break clean across 37 cases (case 31, the two-windows storage-merge race, flagged red once
then clean on an isolated re-run — the standing two-windows timing flake, and 13.44 touches no
storage); sim in band. Code frozen at 13.44, nothing open (all pending items wait on David). Clean
pass → COOLING to the `weekly` floor and running this SELF-UPDATE (birthday moved from HOT to
settled). A live message is answered at once and snaps the cadence back to `hourly`. (Prior note
12:33Z 2026-08-05: cooled to daily — superseded.)

---

## 3. WHO THIS IS FOR

One child — a nine-year-old with dyslexia — using the app by touch on an iPhone. Not a product,
not general usage. Assistive-technology support (screen readers, keyboard-only navigation, focus
order) is OUT OF SCOPE; the existing aria/live-region wiring stays where it is but no further
effort goes in. Legibility IS in scope and is a different thing: contrast, her five text sizes,
what a long word does at the largest of them, 44px tap targets, reduced motion. See PLAN.md's
opening "Who this is for" and RESEARCH.md.

## 4. STATE OF THE APP

`index.html` is a spelling-only app, pushed to `main` and live on GitHub Pages. She opens it and
is on a word: no home screen, no plant, no streak. Reading and the book chat are preserved in
`reference/reading-and-chat.html` — do not delete it. Do not touch `worker/` or its secrets.
Never put an API key in the repo (it is public). Never put her name in the code.
`tools/mic-check.html` is a phone diagnostic, not part of the app. `WORKLIST.md` is the living
checklist of shipped/open work.

## 5. THREE HARNESSES — run all three first, keep all three green

Read the counts they print; don't trust a number written down anywhere (including here).

```
npx playwright test    # the full suite
node tests/sim.js       # pacing simulation: real engine, modelled learners; non-zero if a band breaches
node tests/break.js     # adversarial pass; non-zero on any finding
```

`two-windows.spec.js` and the audio-live prefetch test are known parallel-load flakes — confirm
by re-running the named file in isolation before treating a failure as real.

Pacing target: ~80–85% right first go, 70–90% known material. Report the actual numbers when you
tune the engine.

## 6. WHAT TO REVIEW — rotate through these, not just the first one

1. **Visual design.** Typography, colour, spacing, alignment, hierarchy, motion. Everything on
   the three scales (`--t-*`, `--s*`, `--r-*`); nothing off-scale. Contrast is measured, not
   eyeballed — every foreground/background pair clears 4.5:1 (3:1 for large text) on cream AND
   all four tints, light and dark (`tests/contrast.spec.js`; keep it honest). Screenshot the real
   screens in Chromium at 0.9×–1.5× text scale, light and dark, iPhone SE and 13, and LOOK.
2. **The words she sees.** Never her own misspelling, never "wrong"/"failed", singular/plural
   agreement, nothing that reads as blame.
3. **The engine.** Scheduling, pacing, session building, the comparison of her attempt against
   the mistakes a dyslexic child actually makes, syllable splitting (`SYLLABLES` dictionary +
   `COMPOUNDS` + the rule; researched splits win over the rule).
4. **Robustness.** Extend `tests/break.js` with new adversarial cases each pass. Data survival is
   part of this: two windows, a lost connection, a full disk, the clock changing, a backup
   coming home.
5. **Real input.** How letters actually get into the box — typing, the microphone key, paste,
   glide/swipe, the suggestion bar, autocorrect. Drive it for real. The written-answers check
   must never lock out a real keyboard and never make a moment of a hand-back. (Note: once real
   keystrokes are seen, `sawKeys` is set, and a value with no keys behind it is treated as
   dictation and handed back — so drive misses with real keys.)

## 7. METHOD

Device screenshots and interactive driving catch defects the suite misses; simulation catches
defects reading the code misses. Use all three. **Distrust your own probes as much as the app** —
a green (or a red) can mean the probe measured the wrong thing (e.g. a 4.5:1 bar applied to
large text that only needs 3:1). Add a regression test for every defect you fix and verify it
fails on the broken version (inject the regression, watch it fail, revert). Commit and push to
`main` after every meaningful change — Pages deploys automatically, no deploy step.

**NOT NOW, unless asked:** PLAN.md §3a private-repo sync, §5B maths. Interleaving spelling
patterns once a pattern is established is legitimate if you run out of higher-value work.

Check `git log` first, then continue.
