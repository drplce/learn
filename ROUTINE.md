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
interval: hourly
last-run: 2026-08-01T08:00Z
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
