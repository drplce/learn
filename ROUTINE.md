# Acorn — autonomous routine

This file is the standing instruction for the daily trigger. The trigger fires **once a day at
17:00 UTC (1:00am AWST, Perth)** with one line ("Read ROUTINE.md and follow it"). David changed it
from hourly to daily on 2026-08-09. Everything about *what* to do and *how often* lives here,
version-controlled and editable as a normal file. David can retune the work or the cadence by
editing this file; he alone changes the trigger's schedule itself (the routine never touches it).

---

## 1. CADENCE GATE — do this FIRST, every single firing

<!-- STATE — the routine reads these two values, and rewrites them at the end of a real pass.
     Keep them on these exact lines in this exact format; nothing else parses them. -->
```
interval: daily
last-run: 2026-08-10T17:13Z
```

The trigger fires once a day, but you only do a **full pass** as often as `interval` says — so on a
`weekly` interval most daily firings are skipped. On each firing:

1. Read `interval` and `last-run` above. Run `date -u +"%Y-%m-%dT%H:%MZ"` for now.
2. Hours per interval: `daily`=24, `weekly`=168. (`hourly`/`2h` are retired — see the ladder.)
3. **If less than that many hours have passed since `last-run`:** you are firing early (an
   off-day). Say one line — `not due (interval=X, Nh since last run)` — and **end the turn**. Do
   not run the harnesses, do not read the app, do not touch the repo or the trigger.
4. **Otherwise you are due:** do a full pass (sections 3–7 below). At the **end** of the pass,
   set `last-run` to the current time, re-decide `interval` per the ladder (section 2), rewrite
   both STATE lines, and commit ROUTINE.md together with whatever else the pass changed.

Never call `update_trigger` yourself. The cadence lives here now, and the trigger is a fixed daily
pointer — only David changes its schedule (he set it to daily at 17:00 UTC on 2026-08-09).

---

## 2. CADENCE LADDER — how to set `interval` at the end of a pass

- **Baseline → `daily`.** The trigger fires daily, so `daily` means "check on every firing". Keep
  it `daily` whenever there is an open thread with David (a new feature, new words, a reported bug,
  a prototype awaiting his reaction) OR a pass found/fixed a defect — i.e. whenever a daily health
  check still earns its keep.
- **COOLING → `weekly`.** When a pass is clean — all three harnesses green, nothing found, nothing
  open — and the code has been frozen a while, step to `weekly` (skip ~6 daily firings between
  passes). Step back to `daily` the moment something opens.
- **FLOOR.** `daily` is the working baseline; `weekly` is the calm floor. (The old sub-daily rungs
  `hourly`/`2h` are retired — they needed the hourly trigger; active iteration with David now
  happens live, in real time, not through the cron.)
- **SELF-UPDATE.** When you cool to `weekly` (the calm steady state), before saving, revise THIS
  FILE: correct anything stale (pacing numbers, scope, the NOT-NOW list, dates), fold in what has
  been learned, keep it tight. This file is the living document now — not the trigger prompt.

**NEW PROJECT (live, 2026-08-11) — a times-tables app, sibling to Acorn.** David wants a SECOND app
for his daughter: multiplication tables, deliberately GAMIFIED / arcade-reward (the opposite of
Acorn's calm — different subject, different needs). Agreed architecture: **same repo, its own
subfolder + own URL + own home-screen icon** (e.g. `tables/`), Acorn's `index.html`/`ROUTINE.md`
untouched; reuse Acorn's proven bones by COPYING (TTS, data-survival, tokens, blob art, test
harness) — there's no runtime backend to share (all on-device). Two rules carry over: never her name
in code, never an API key. **This times-tables app is OUT of the daily Acorn harness pass** (the cron
reviews Acorn's index.html only); it's built live with David for now.
  - **Pace LOCKED (David, harder option):** 144 facts, ~142 days left in 2026. **45-day acquisition
    sprint, aiming ≥2 short sessions/day**, then ~97 days reinforcement. Guardrail = ~80–85% success
    (engine eases if she dips; frequency > duration is the accelerator). Reuse the Leitner engine
    (per-fact `{seen,right,wrong,lastSeen,box}` keyed `"7x8"`, commutative pairs shared). Phase 1
    (acquisition, compressed spacing, easy anchors ×2/×5/×10 first → hard core ×6/×7/×8 last); Phase 2
    (fluency: expanding `BOX_DAYS` intervals + a speed goal + interleaving). Dashboard shows the race:
    a real days-left-to-Dec-31 COUNTDOWN + a count-UP to 144 known (David's ask).
  - **Game direction:** "more games than casinoy". Five game ideas floated (Streak, Blast, Dash,
    Table Bosses, Vault); five names (Nugget, Bolt, Comet, Zap, Pip). David picked **Blast** first
    (easiest to build + juicy; I flagged Dash *feels* easy but is costly — running character + scroll).
  - **Blast PROTOTYPE BUILT + PUBLISHED** (`scratchpad/blast.html`, artifact
    82f248dc-8ca5-4b4e-8bc4-22328aac19aa): prompt `11 × 12`, answer-orbs rise, tap the right one →
    coin burst + combo multiplier + jackpot every 5; wrong is kind ("not that one"); distractors are
    real near-misses (144=12², 121=11², off-by-a-table). Coin/round/best-streak HUD. Verified: logic
    works (coins scale with combo), no errors, dual-theme. Placeholder name "Nugget".
  - **Also on the table:** a Duolingo-style **path of stones** (each stone = a lesson/cluster of
    facts = the acquisition schedule made visible) AND a meta where **the games upgrade as she
    progresses** (clear stones/tables → unlock faster waves, new modes, skins, the Prize Spin, boss
    fights). Iterate the games around her as she plays.
  - **Name chosen: "144"** (David, 2026-08-11 — the number of facts / 12²). Blast iteration: David
    liked the energy but wanted a gentler start ramping faster; done — early rounds now have fewer
    choices (3 orbs) and a slow rise, speed climbs each round (`0.16 + (round-1)·0.06`, capped),
    round-up cue "Round N — faster!". Republished (same artifact URL).
  - **Dashboard MOCK BUILT** (`scratchpad/grid.html`, artifact f4c30baf): the 12×12 grid (all 144
    cells) filling as she masters facts, with a **Treasure ↔ Heatmap toggle** to answer David's "does
    a heatmap work or is it not fun" — Treasure (dim→green→gold collection, never red) reads as a
    reward; Heatmap (cold→warm two-colour) is clearer-for-a-grownup but muddy/report-like. Mock data
    paints a believable mid-journey (easy tables gold, hard core 6/7/8/12 dim). Per-table % bars
    below for the grown-up read. Progress "72 mastered · 102 known · 144".
  - **Still open with David (design):** how many rounds close out a level/session (proposed: goal-
    filled path-stones, ~2–3 min each, not a fixed count); and
    "how hard can the pace go" (answer: acquisition can be pushed to ~4–6 weeks, but durability is
    calendar-bound by spacing — front-load acquisition, extend reinforcement; ~80–85% success is the
    guardrail; frequency > duration).
  - **GUI STYLE — 4-look board BUILT** (`scratchpad/styles.html`, artifact 22295bad). David's refs:
    a chunky-tactile clay puzzle game + a neon low-poly runner; his instinct "pastel shapes / neon
    colour". He asked for **four completely different** looks, **NOT like Acorn or Duolingo**, and
    everything (visual/gameplay/sound) must **leave room to upgrade as she levels** (visual locks &
    opens at Lv X). Built: **1 Pastel Clay** (soft, extruded clay tiles), **2 Neon Night** (dark,
    glowing gem orbs, particles), **3 Neon Pop** (his hybrid — clay shapes + electric colour; my
    lean), **4 Retro Pixel** (8-bit, scanlines, chiptune). Each panel shows prompt + 3 answer tiles +
    coin + palette + a "🔓 grows: Lv1→Lv15→Lv30→Lv45" unlock path. Awaiting his pick (or a mix).
  - **GUI STYLE CHOSEN: Neon Pop** (David, 2026-08-11) — clay/tactile chunky shapes with electric
    colour on dark slate; starts near-flat and unlocks glow/shimmer/arcs/pulse as she levels.
  - **MASCOT concept BUILT** (`scratchpad/buddy.html`, artifact 87367345): David wants a little
    character, "for now an egg/pebble (like Acorn) that hatches/grows/gets booted up in future."
    Through-line: Acorn grows a seed; 144 boots a bot. Lv1 = a dormant glowing pebble-pod (sleepy
    eye, gold charging core, idle bob) → Lv15 Spark (wakes) → Lv30 Booted (little bot w/ eyes+arms+
    feet) → Lv45 Champ (gold + crown). She can name it. Neon Pop skin. **Iterated (David):** body is
    now a real Acorn seeded-blob pebble (ported `seeded`/`cellPoints`/`blobPath`) with 3-D dome +
    extruded side + gloss + glow; added **daily accessory unlocks** (hat/specs/bow ready, crown/cap/
    phones locked "tomorrow/Day 4/5" — tap to dress her; the daily reason to come back, habit hook).
    **REVISED AGAIN (David, refs: a white pod-robot):** organic blob "doesn't work" — went back to a
    clean SMOOTH white pod (like the robot ref) with a dark glossy face-SCREEN that is **BLANK at the
    start — no eyes/face, just the shape charging**; the screen boots on (Waking→Awake→Buddy face) as
    she levels. **CURRENCY = watts/⚡ (electric), not coins** (David): right answers make power; a
    charge/battery bar depletes over ~12h and she plays to top it up (Tamagotchi-style care loop that
    naturally drives ~2×/day). KINDNESS caution to hold: low charge = peacefully asleep/dim, never
    sad/dying/guilt-tripping. buddy.html rebuilt to this (artifact 87367345).
  - **Open for David:** react to the buddy + Blast feel; then I scaffold
    the real `tables/` app (fact-engine + Blast playable + a first path). Do NOT scaffold into the app
    without his go-ahead beyond the prototype.

**HOT (hourly) — the "sheep" idea; David chose #2, prototype built 2026-08-08.** His concept: on the
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
     interaction; safe, high-delight, reuses the physics.
  2. **herding game she plays** — tapping/gathering a stray IS the way into practising it; bigger,
     changes how she starts words, and the engine must still decide which strays are "loose" so she
     can't dodge the hard ones.
  **David chose #2 (2026-08-08), "but wanting to iterate to get there."** So the destination is the
  game; the road there starts from the living herd. **PROTOTYPE BUILT + PUBLISHED** (2026-08-08):
  `scratchpad/sheep.html`, artifact `744f2325-c7c7-406d-b23e-501757f0bfff`. It's the finished-screen
  flock as a full-screen SVG: deep pebbles = the herd (known well) ambling loosely around the middle;
  pale, outlined pebbles = strays (low box) wandering the edges, held there by a soft outward drift;
  a slow per-sheep heading gives the amble. **The #2 taste:** tap a stray → it locks in (pale→deep),
  trots into the herd, "strays out" counter ticks down. In the real game that tap is where she'd
  spell the word; here it stands in for getting it right. Built on the pool prototype's ported blob
  code + physics (`seeded`/`cellPoints`/`blobPath`, edge-repel, cohesion, collisions, 1:1 px
  viewBox). Reduced-motion: no wander forces, it settles to a near-still arrangement. NOT in the app.
  **Open for David:** feel the amble/weight on his phone; does the herd-vs-stray split read; is
  tapping-to-gather the right verb.
  **Iteration 2 (2026-08-08): "move more sheeply rather than wobble" (David).** Replaced the
  per-frame heading noise (the wobble) with a graze/walk rhythm: each sheep stands and grazes a good
  while, then picks ONE heading and ambles a few steps, turning smoothly, then grazes again — so at
  any moment most of the flock is still and only a few are moving. Longer graze, rarer/slower walks,
  looser herd (grazing room, less collision jostle), a fence-turn so they veer off the edge rather
  than push into it, and the gather sets a brief trot to the middle. Verified gentle (avg ~4px/s, no
  darting), collect works, no errors; republished to the same artifact URL.
  **Iteration 3 (2026-08-08): strays weren't reading as "out", + "is the physics engine right for a
  herd?" (David).** He was right — the pool/collision engine is wrong for a herd. Rebuilt on BOIDS:
  the herd flocks (cohesion toward the flock's centre of mass + alignment to its average heading +
  personal-space de-overlap); a STRAY is a sheep NOT in the flock — no cohesion/alignment, a soft
  outward push keeps it out in the open field around the herd. Gathering a stray flips it to herd, so
  it gains cohesion and flows in. Also halved the pebble size (r 10+len·1.0) for a bigger canvas.
  Measured: compact herd (~56px spread), strays clearly out (nearest ~145px from the herd), motion
  gentle (~4.7px/s), gather works, no errors. Republished to the same artifact URL.
  **Iteration 4 (2026-08-08): roaming herd + levels of stray (David).** Two asks: (1) the herd
  shouldn't be anchored to the centre — "out of the HERD" is the meaning, not "out of the centre"; so
  the flock now ROAMS as a body (a shared slowly-drifting `flockHead`, turned back from the walls),
  and strays sit relative to the moving herd centroid, not the screen. (2) LEVELS of stray, from the
  real word mechanic. Mapped to the Leitner boxes (confirmed KNOWN_BOX=5, MAX_BOX=7, acquiring=box<=1):
  herd = box>=5 (deep), near-stray = box 3-4 (mid, hugs the flock at ~0.24·min), far-stray = box<=2
  (pale+outline, out at the edge ~0.44·min). Two visible tiers, as he asked. Tap now promotes ONE
  tier (far→near→herd), i.e. one Leitner box's worth of "got it right", so a far stray takes two taps
  to come home — the levels made tangible. Verified: herd roams (~40px/4s), tiers distinct (near ~96px
  / far ~170px from herd), motion calm (~8px/s), tiered gather works, no errors. Republished (same URL).
  Awaiting reaction. Tuning knobs offered: roam pace, herd tightness, how far the far ring sits.
  Iteration notes — next real step toward #2 is wiring the tap to open that word to
  spell (an APP change — needs his explicit approval, do NOT build in without it). (c) which
  network.spec invariant to relax still applies if any of this lands in the real finished screen.

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

**Cadence note (17:13Z, 2026-08-10):** second clean pass on the daily cron. App frozen at 13.44;
all three green — Playwright 589 (no flakes), break clean across 37 cases, sim in band (learned
83.5%, all 8 bands held). Still HOLDING `daily`: the sheep prototype (iterations 1–4, artifact
744f2325) is an open thread awaiting David — quiet ~2 days but genuinely his to react to. If he is
still quiet at the next daily firing, COOL to `weekly` (the thread will be clearly dormant, and the
app is stable/green). A live message snaps it back and is handled in real time regardless. (Prior
note 17:10Z 2026-08-09: first daily-cron pass — superseded.)

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
