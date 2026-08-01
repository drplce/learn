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
last-run: 2026-08-01T22:41Z
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

**Currently open (keeps it HOT):** awaiting David's look at the pebble refinements. This pass
acted on two of his notes: **13.28** the enlarged pebble now follows the word she is on (it fell
behind after a miss), and **13.29** the lit dome now completes on the second time through a word
*in the same sitting* (his clarification), not on a second separate day — replacing the
mastery-box gate that made review words arrive pre-domed. Both shipped, teeth-checked, harnesses
green. **13.30** greened the pebble on success (not arrival). **13.31** ditched the syllable underlining
altogether (David, on device: the splits were still wrong — `to·ge·ther` — and a wrong break drawn
under the word is worse than none). The word is shown whole now; the seam machinery is gone;
`splitOf` survives only to SPEAK the pieces on a miss (offered to remove that too, awaiting his
call). **13.32** made the on-success fill a proper reward animation (David: "one of the main reward
features"): size and fill are now orthogonal states, so a won pebble greens WHILE still large,
then hands the size off to the next word as it grows into focus — driven by `syncPebbles()` via
the Web Animations API (the row is HTML-rebuilt each render, so CSS transitions can't cross it).
The adversarial pass caught a real bug in it (a plain-object word→element map collided with
`__proto__`/`toLocaleString`); fixed with a Map. Open: (a) David to confirm the pebble set, the
reward animation, and the clean word on his phone. **13.33** dropped the spoken word-in-parts on
a miss too (David: "Drop it too") — a miss now re-says the whole word, never its pieces. The
syllabifier (`splitOf`/`SYLLABLES`/`syllables()`) is now VESTIGIAL: nothing the child sees or
hears uses it; it survives only in the clip prefetch (warming part-clips never played) and the
model-level research tests. A future tidy pass could tear it out entirely — flagged, not urgent,
don't do it without a reason. Open: David to confirm the pebble reward, the clean word, and the
word-only miss on his phone. **13.34** reviewed and tightened the win→next timing (all durations
now in one `REWARD` object; fill/swell/hold/handoff trimmed, plus a new gentle word-rise on
advance) and shipped an interactive timing PLAYGROUND artifact so David can dial the exact feel and
report the numbers. **13.35** fixed a David-reported gap: after tracing a new word, the blind-write
screen came up silent — now it announces the word again (`say(word())` on the trace→write
transition), the same as landing on any word. (Also bumped the VERSION stamp, which had lagged at
13.33 since the 13.34 commit didn't touch it.) Open: David to try the playground / feel the new
timing on his phone and say whether the fill, the hold, the word-rise want nudging. HOT until he
confirms the timing.

**BIG OPEN THREAD — the end-of-session (DONE) map screen, reimagined wordless (David, live
10:40–12:30Z).** A run of interactive prototype Artifacts (all in the session scratchpad, NOTHING
built into the app yet): wordless concepts (bloom/harvest/quiet) → a physics "map you can touch"
(drag pebbles, spring home) → a MERGE idea → THREADING to merge.
  - **Settled model (David chose "reading 2"):** she MANUALLY threads rooted (well-known) pebbles
    together with a hand-drawn ORGANIC thread into a persistent group ("stays linked", nothing
    auto-sorts); at **ten** the group settles, draws tight, and RIPENS into one larger banked pebble
    (extra corner + lit facet). Latest prototype: `scratchpad/grow.html` (artifact 942a45eb).
  - **Awaiting David before ANY build:** (1) ladder? banks thread into a 9-cornered giant, or one
    level; (2) undo? pull a pebble back out before ripen (ripen is permanent); (3) pace? one
    necklace per evening or many — plus explicit go-ahead. **Do NOT build this into the app without
    his approval** (asked, not answered — a cron firing is not approval).
  - Build notes for when approved: turns the done-screen map from a fixed camera into a live physics
    surface (a real engine change — do it BEHIND the existing map so nothing breaks); needs real
    mastery data to pick which words are "deep enough"; reuse the coord fix (screen→viewBox via
    getScreenCTM, not a naive rect ratio, or a letterboxed square viewBox makes every touch miss).
  - **BATCH SHIPPED (13.37–13.40), the wordless-finish + pebble refinements.** David gave a batch of
    requests (with a screenshot) and said "ship tonight"; worked top-down, pushed each increment:
    - **13.37 wordless finished screen** ("clear all the text"): the map case renders only the
      garden; the line and praise are gone from the screen. Dead end keeps its one sentence + tick.
      Big test re-point: every visible-headline/praise assertion moved to #say (spoken/announced
      channel, unchanged); the "announced == on screen" principle gained a conscious exception (the
      picture is the visible counterpart on the wordless screen).
    - **13.38 no on-device selection** (user-select:none + -webkit-touch-callout:none app-wide,
      inputs keep it — fixes the blue highlight / press-hold callout on pebbles, mark, back) +
      **progress pebbles 1.4× larger**. New tests/no-select.spec.js.
    - **13.39 praise → "Great effort.", SPOKEN** (David: "just say great effort"). One line whatever
      the evening; and it is now spoken via say() — a deliberate reversal of the old shown-not-spoken
      call, because the wordless screen left nowhere to show it and "great effort" is two warm words
      that don't carry the synthetic-sarcasm risk the old "Every one, first go." did. Count stays in
      the live region only (never spoken to her, never drawn). Praise-varies tests retired.
    - **13.40 the way on is a breathing pebble**, not a worded button — a --tap-xl blob pulsing at
      --m-breath (a 4th ladder value); pulse rides the svg not the button so the hit box is stable.
      Auto-open to the finished screen when the day's sitting is done already worked (go('day')).
    - **TWO THINGS FLAGGED FOR DAVID, not built** (both need his product call, wrong to invent
      overnight): (a) **bigger map / more ghosts** — runs straight into network.spec's deliberate
      composition invariants (horizon fixed at 6+floor(met/5), cells fill ¼–⅓ of the frame, camera
      stays close, one organism); a portrait frame and a deeper horizon both broke them. Which
      invariant to relax is his. Only a small map-margin trim shipped. (b) **"pulse only until the
      daily max, else hide"** — there is no daily-max concept, and her real save shows she does
      several new-word sittings a day (4 on Jul 30), so hiding once reviews are caught up would cut
      her off. Needs his definition. The pebble shows whenever there's anything to practise for now.
    - **Step 3 (pool-physics map) — PROTOTYPE BUILT (18:46Z pass), awaiting David.** David: "Great
      plan. Ship 1 to 6. Go. I'll check tomorrow." 1–6 shipped (13.37–13.40); item 5's bigger/fuller
      map was the one blocked, and it is the SAME job as Step 3, so I built the Step 3 prototype he
      was expecting for his check-in. `scratchpad/pool.html`, published artifact
      f0a92335-3c27-4b0f-966f-523f0c6aa21d. It is the end-of-session map as a full-SCREEN pebble
      pool: her word-pebbles (deep = known well) fill the whole screen (answers item 5's "bigger,
      more ghosts"), she can drag any pebble and it bumps the others (pool physics — collisions
      resolved over a few passes), they settle (damping), and a soft inward force makes them creep
      back from the edges so none stick at the rim (his exact ask). Acorn's own blob code
      (seeded/cellPoints/blobPath) ported verbatim; coord bug avoided by a 1:1 pixel viewBox
      (pointer coords map straight, no getScreenCTM letterboxing). NOT in the app — prototype only,
      per the standing "don't build the physics surface into the app without approval". Open for
      David: does the feel/weight/settle work; should the pool be the whole finished screen (folding
      in the wordless garden + the breathing "more" pebble), or a mode she enters; and the two
      still-open batch decisions (which map invariant to relax if we DON'T go full-physics; the
      "daily max" definition for the pebble).

  - **STEP 1 SHIPPED (13.36).** David said "Yes prototype step 1" — the gentle whole-map arrival,
    the safe no-rewrite first step. On a session end the whole garden she already has now settles in
    from the middle out (.settling) while tonight's words swell in last (.arriving), so the map feels
    alive as it forms — no interaction, nothing new to learn. Built into the REAL map's arrival.
    Notable: had to move the arrival off a CSS transition onto the **Web Animations API** — a
    transition on freshly-built DOM is suppressed on first paint (transition-property lands in the
    same recalc as the value change), so on a fast compositor the flourish silently jumped to the end
    (this was latent in the ORIGINAL .arriving too — it only "worked" on real vsync hardware and was
    invisible/untestable in headless). WAAPI plays reliably everywhere, is capturable, honours
    reduced-motion by creating no animation at all, and let the tests assert real animation objects
    (not just that the classes exist, which a frozen end state can't be told apart from). Filmstrip
    captured (scratchpad/arrive-film.png). **Open: David to feel the gentle arrival on his phone and
    say if the pace/feel is right before Steps 2+** (touch, thread, ripen — which need the physics
    rewrite and his build approval per the three awaiting decisions above).

**Cadence note (22:41Z):** clean full pass, app code unchanged since 13.40 — Playwright 580 +
known audio-live:126 flake, break clean across 36 cases, sim in band. The whole 1–6 batch is
shipped and solid; the Step 3 pebble-pool prototype and the flagged decisions (map invariant,
"daily max") are all waiting on David, who said he'd check tomorrow. Nothing is open FOR ME to
build — the work is blocked on his reaction, and re-running clean harnesses hourly on unchanged
code is waste. So COOLING one step: hourly → 2h. This only paces the autonomous passes; a live
message from David is answered immediately regardless. If he reacts and wants iteration, back to
hourly. (Earlier note, 12:38Z: clean pass on HEAD a075861, David mid-decision — superseded.)

(History of the pebble/word-screen work 13.28–13.35 above is settled and shipped; David's phone
confirmation of that set is still nominally open but superseded by the active DONE-screen thread.)

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
