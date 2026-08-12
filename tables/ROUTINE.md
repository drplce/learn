# 144 — autonomous routine

This file is the standing instruction for **144**, the times-tables app in `tables/`. It is the
sibling of `/ROUTINE.md`, which governs **Acorn** (the spelling app in `/index.html`). They share a
repo and nothing else.

**Hard rule: this routine never touches Acorn.** Not `/index.html`, not `/tests/`, not
`/ROUTINE.md`. If a change seems to need one of those, stop and leave it for David. Acorn's own
routine returns the favour.

---

## 1. CADENCE GATE — do this FIRST, every firing

<!-- STATE — the routine reads these two values and rewrites them at the end of a real pass.
     Keep them on these exact lines in this exact format; nothing else parses them. -->
```
interval: daily
last-run: 2026-08-12T00:06Z
```

On each firing:

1. Read `interval` and `last-run`. Run `date -u +"%Y-%m-%dT%H:%MZ"` for now.
2. Hours per interval: `30m`=0.5, `hourly`=1, `daily`=24, `weekly`=168.
3. **If less than that has passed:** say one line — `not due (interval=X, Nh since last run)` — and
   **end the turn**. Do not run the harness, do not touch the repo.
4. **Otherwise:** do a full pass (sections 4–7). At the end, set `last-run` to now, re-decide
   `interval` per the ladder, rewrite both STATE lines, and commit this file with the work.

Never change the trigger schedules on your own initiative — only David does that. (The one exception
was the overnight sprint's own clean-up, which he asked for explicitly; it is done — see below.)

### The overnight sprint of 2026-08-11 → 12 — closed 2026-08-12T00:06Z

David asked for a 30-minute cadence for one night (*"Setup the cron for auto test improve
overnight… every 30min for tonight"*), run as two hourly triggers offset by half an hour. It ran six
passes, v1.0 → v1.6, and is now closed: the twin trigger is deleted and the main one is back to
daily at 18:00Z. **What it found, in order — every area probed turned up a real defect:**

1. The path **dead-ended** after ~48 levels; she would have replayed one boss for a hundred days.
2. `render()` called `save()`, so her progress persisted **as a side effect of painting**, and two
   open windows raced each other.
3. A **failed write still advanced `rev`**, which disabled the merge that protects her from a stale
   window — a full disk plus an old tab would have eaten an evening.
4. On an **iPhone SE** the sum and the bubbles sat at opposite ends of the screen.
5. A buddy name of **nothing but spaces** stuck, leaving the heading blank.
6. The **clear card counted the charge it asked for, not the charge that landed** — a nearly-full
   battery was told it gained 31% when it took 2.

None of these were visible in ordinary play, and all six would have quietly cost her something. The
suite went 23 → 47 tests, every fix teeth-checked. Two visual passes came with it (the play field on
a small phone, and the buddy becoming glass at both sizes). Nothing was changed about what she is
taught — the one finding that needs David is still open at the top of §7.

## 2. CADENCE LADDER

- **`30m` / `hourly`** only when David has explicitly asked for a sprint (the last one is written up
  in §1). Never set these on your own initiative; hand back to `daily` when the sprint closes, and
  delete any temporary twin trigger that was created for it.
- **`daily`** while anything is open: a request from David, a defect found this pass, or the app
  still young enough that daily eyes earn their keep. This is the baseline while she is playing it.
- **`weekly`** once a pass is clean, nothing is open, and the code has been frozen a while.
- Step back to `daily` the moment something opens. Live messages from David are answered in real
  time regardless of cadence, and reset it to `daily`.

## 3. WHO THIS IS FOR

The same one child as Acorn: nine, dyslexic, on an iPhone, by touch. **144 is deliberately the
opposite personality to Acorn** — Acorn is a quiet library, 144 is an arcade: loud, rewarding,
gamified. What it inherits is not the look but the *soul*:

- **Never blame.** No "wrong", "incorrect", "failed", "bad". A miss shakes the tile, resets the
  streak, and keeps the question up. It never costs her anything she had earned.
- **Never manipulate.** The buddy's battery is a warm reason to come back, never guilt. Flat = 
  peacefully asleep and dim; never sad, dying, hungry or disappointed. No loss-framing, no
  gambling she can lose, no dark patterns. The casino is in the *payout*, never in the risk.
- **Her name is never in the code** (the repo is public). She may name the *buddy*; that pet name
  lives on the device and nowhere else. Never an API key in the repo.
- **The app never says "her".** David, 2026-08-12: *"Ditch the word 'her' throughout. Like her buddy
  should just be buddy."* It is her app — it does not need to keep telling her so, and copy written
  *about* her reads like someone else is watching. So: "buddy", "the 144", "pick its colour" —
  never "her buddy", "her 144", "hers". This covers `aria-label`s too, and a test in
  `game.spec.js` ("the words she reads") sweeps every screen for it. Comments in the source still
  say "she", which is fine — that is us talking about the person we are building for, not the app
  talking to her.
- Legibility is in scope (big type, tap targets ≥48px, reduced motion honoured). Screen-reader
  support is out of scope, same as Acorn.

## 4. STATE OF THE APP

`tables/index.html` is a single file with no build step, live on GitHub Pages at
`/learn/tables/` with its own home-screen icon (`tables/apple-touch-icon.png` — opaque PNG, iOS
composites transparency to black). Storage key `144.v1`.

**The design decisions, so they are not re-litigated:**
- **Name:** 144 (12×12 = the whole job).
- **Skin — the HOUSE STYLE (v1.1, David's brief; refine it, do not reinvent it):**
  hard neon on a near-black violet ground — a K-pop stage, not a toy box.
  - Ground `--bg #0B0614`, with stage-light blooms burning in from the top corners. Never grey,
    never muddy; if something looks washed out the answer is more contrast, not more colour.
  - The neon set is fixed: `--n-magenta --n-cyan --n-violet --n-lime --n-gold`. Adding a sixth hue
    needs a reason; a new *shade* of an existing one is fine.
  - **Light does the work.** Glow and rings, not fills and drop-shadows. The old clay extrude
    (`0 5px 0`) is retired — do not bring it back.
  - **One colour per round.** Every answer bubble in a round wears `--rc`, which rotates through
    `ROUND_COLOURS` as rounds climb; the prompt, goal bar, sparks and flash follow it. Colour must
    never distinguish one answer from another — that would be a tell.
  - Answer bubbles are **circles, dark inside, ringed in light**; tap targets stay ≥48px.
  - **The path carries no words at all** — state is shape and light (gold bead = done, breathing
    cyan ring = here, unlit ring = ahead, magenta star = boss) — and it meanders. Wordless does
    not mean nameless: every node keeps an `aria-label`.
  - `ui-rounded` numerals; numbers are the hero content and should always be the brightest thing
    after the action button.
  - Everything starts deliberately under-dressed and unlocks richness with her level, so *the game
    visibly gets better as she does*.
- **Currency: watts ⚡** — earned on right answers, and they charge the buddy. The charge drains
  across her waking day (12h battery) and **pauses overnight** (07:00–20:00 local is "awake").
- **The buddy:** a sealed glossy rounded cube, lit from within. At level 1 it has **no face at
  all** — just the glow and a dim filament where eyes will be. It boots up: Lv15 filament,
  Lv30 eyes, Lv45 fully booted. Level-1 customisation is **colour only**; more unlocks later.
- **Structure:** Home is the **path** of stones (an electric circuit she lights up). The **144
  grid** lives in the **power room** behind the buddy — the grid *is* the power she has banked.
- **The game:** Blast — answers rise, she taps the right one. Gentle first round (3 tiles, slow),
  ramping every 4 answers within a stone. Distractors are real near-misses (neighbours in the
  table, swapped squares, off-by-one rows), never random noise.
- **The engine:** Leitner boxes 1–7, `BOX_DAYS {1:0,2:1,3:2,4:4,5:8,6:21,7:60}`, `KNOWN_BOX 5`.
  12×12 is 144 cells but **78 facts** — 7×8 and 8×7 share one record and both cells light up
  together (a lesson, not just a saving). Weak-first picking: unseen and missed facts come back,
  owned ones step aside, due beats not-due, never the same fact twice in a row.
- **The plan:** 144 facts, **45-day acquisition sprint** then ~97 days of reinforcement, aiming
  **≥2 short sessions a day**. Tables arrive anchors-first (`TABLE_ORDER 2,5,10,1,11,3,4,9,6,7,8,12`);
  because facts are shared both ways round, each later table introduces fewer new ones (12,11,…,1),
  so the hard tables are mostly review by the time she reaches them. 48 stones: `learn` (each new
  fact right twice), `mix` (12 right, everything so far), `boss` (15 right, one whole table).
- **First open** is a **placement check**: 14 facts, one look each — right seeds box 4 (evidence she
  owns it), wrong seeds box 1. A miss there moves on; it is a check, never a test.
- The guardrail on pace is her success rate: **~80–85% right**. If a pass shows her far above or
  below that band, that is the thing to tune — not the calendar.

## 5. THE HARNESS — keep it green

```
npx playwright test -c tables/playwright.config.js
```

48 tests at v1.7. **Add a test for every defect fixed, and verify it fails on the broken version**
(inject the regression, watch it fail, revert). Extend the suite each pass with new adversarial
cases — the tests are what make an autonomous loop safe.

Acorn's suite (`npx playwright test` from the root) must stay green too, and should be untouched by
anything done here. Run it if a change could plausibly reach it; otherwise trust the separation.

Gaps worth closing when there is time — **this is the queue for the first few passes**, most
valuable first:

**`node tables/tests/sim.js`** — the pacing simulation (BUILT 2026-08-11). 8 modelled learners,
142 days, 2 sessions a day, driving the real picker and the real Leitner boxes. It splits **HEALTH
bands** (code defects — enforced, exits non-zero) from **the PLAN's own targets** (David's claims —
reported loudly, *never* silently relaxed by lowering them). Run it after any change to the engine,
the ladder or the level goals. It is slow (~2 min); that is fine.

1. **Sound**: prove the mute really silences everything (the synth is fired from several places).
2. **A whole evening, end to end**: several levels in a row without reloading — the state that
   builds up across a sitting (combo, round colour, the pool) is only ever tested one level deep.

**Done, and now guarded — do not undo these:**
- **The level-clear card** (v1.6, `tests/clearcard.spec.js`): the card counted the charge it *asked
  for* rather than the charge that *landed*, so a nearly-full battery was told it gained 31% when it
  took 2. `addCharge` returns what it actually added; the sitting counts that. A full battery reads
  "full ⚡", never a deflating 0%. The test with the teeth is the near-full battery one — a test that
  starts at 10% passes either way, because nothing clamps.
- **Naming the buddy** (v1.5): the only place in the app she types. Names are trimmed going in and
  coming out of storage, so a field of spaces cannot leave the heading blank; clearing it hands back
  "her buddy". Her name is displayed with `textContent`, never as markup. The field opens above the
  keyboard line (top 45% of the screen). *Checked and NOT a defect:* the Acorn keyboard trap — the
  document being left scrolled up — cannot happen here, because `body` is `position:fixed` and the
  panes scroll internally, so the page itself never scrolls. The `scrollTo(0,0)` on blur is
  insurance for real iOS (no headless browser opens a keyboard); do not write a test that fakes a
  scrollable document to "prove" it — one was tried and it passed for the wrong reason.
- **The play screen on a small phone** (v1.4, in `game.spec.js` "the look of it"): at 375×667 the
  sum must live *inside* the field, the gap between it and the highest bubble must stay under a
  third of the field, and no bubble may come within 12px of the edge. Layout that reads fine at
  390×844 can strand her eyes at either end of an SE.
- **A full disk and a jumping clock** (v1.3, `tests/robust.spec.js`): `rev` must only advance after a
  write LANDS — advancing it on a failed write made this window think it was ahead of storage, so a
  full disk plus a stale window ate her progress.
- **Two windows** (v1.2): saves carry a monotonic `rev` and merge instead of overwriting; `render()`
  must NEVER call `save()` (that was the actual bug — progress depended on a paint, and two windows
  raced each other through storage events). `tests/twowindows.spec.js` holds all of it.

## 6. WHAT TO REVIEW — rotate, don't always do the first one

1. **Game feel.** Is the ramp right? Does the reward land? Screenshot the real screens in Chromium
   at iPhone SE and 13, and LOOK. Motion honours `prefers-reduced-motion`.

2. **The words she reads.** Never blame; never guilt about the battery; singular/plural agreement.
3. **The engine.** Does weak-first actually surface her gaps? Is she inside 80–85%? Do the
   distractors stay plausible at the top of the table (11×12 vs 121, 132, 144)?
4. **The economy.** Watts and charge should always feel earned and never punitive. Watch for
   accidental grind or a reward that stops meaning anything.
5. **Robustness.** Corrupt storage, absurd clocks, long absences, quota failures.
6. **The unlock ladder.** The promise is that the game gets better as she climbs. Is the next
   unlock actually built, or is the ladder now a bluff?


### 6a. VISUAL POLISH — a standing job, every pass (David, 2026-08-11)

*"Also add visual updates to the cron task."* So the loop is not only a guard dog: each pass should
leave 144 looking better than it found it. Rules of engagement:

- **Refine inside the house style (§4); never reinvent it.** If a change would need David to
  re-approve the look, it is too big — write it in §9 as a proposal instead and leave the code alone.
- **Look before you touch.** Screenshot the actual screens (iPhone SE 375px *and* 13, dark; the app
  has no light mode) and name what is wrong in words before changing anything. "It feels off" is not
  a diagnosis.
- **One or two improvements per pass, screenshotted before and after.** Small and reversible beats
  ambitious. Bump `VERSION` when she would notice.
- **The bar: would a nine-year-old say "whoa"?** Not "is this tasteful". Loud, generous, alive —
  but never harsh, never seizure-bright, never so busy the numbers are hard to read. Legibility
  always wins a fight with atmosphere.
- **Everything must survive `prefers-reduced-motion`** (show the end state, don't run the show) and
  keep tap targets ≥48px.
- **The known list, most valuable first** (keep it pruned and re-ordered as things get done):
  1. The power room and the level-clear card got less neon than the rest of the app.
  2. The level-clear moment could be a proper stage flare rather than a card.
  3. The number type could be more of a hero (weight, spacing, a subtle stage shadow).
  4. Round-to-round transitions: the hue currently snaps; a fast wipe or pulse would sell it.
  5. *(v1.4 — the prompt now floats inside the field, so the empty middle is gone. What is left in
     that space is still bare: drifting sparks or a faint stage floor would fill it.)*
  6. *(v1.5 — the buddy is glass now at both sizes: dark body, her colour in the rim, a bright core
     breathing inside. Shell swatches still show her colour flat and pale; they could show the same
     lit-glass read so the picker matches what she gets.)*

  **How to look at the buddy** (it cost this pass half an hour): it bobs and its core breathes, so a
  plain screenshot catches a random frame and can look dead. Pause `animation` on `.bigcube` and
  force `.glow/.fil` to `opacity:1; transform:scale(1.04)` for the peak, and `.42/.9` for the dim —
  and judge both. A Playwright element screenshot times out on the bobbing cube ("element is not
  stable") until the animation is off.

## 7. METHOD

Screenshots and driving it for real catch what the suite misses; simulation catches what reading
the code misses. Distrust your own probes as much as the app. Commit and push to `main` after
every meaningful change — Pages deploys automatically. Bump `VERSION` when she would notice.

**NOT NOW, unless asked:** division (a later mode), other games from the shortlist (Streak, Dash,
Table Bosses, Vault), multiplayer, accounts, anything that needs a server.

**Open with David (do not invent answers):**
- **⚠ THE PLAN'S TARGETS ARE NOT MET, and the likely cause is a product decision.** `sim.js` says
  ~38/78 facts reach "known well" by day 142 against a target of 74 — though 65/78 reach box 3+ and
  the average box is 4.6, so she gets *close* on most and stalls on the last step plus a hard core.
  The likeliest cause: **144 only ever TESTS a fact, it never teaches one.** A fact she has never
  met is a guess between three bubbles; Acorn by contrast shows her the word before asking her to
  produce it. Options for him, none of them mine to pick: a brief "here it is" moment when a fact
  is first met; lowering what "known well" means (`KNOWN_BOX`, currently 5); more sessions a day; or
  accepting a slower finish. **Do not close this by lowering the numbers in sim.js.**
- His deeper play-test of Blast (feel, pace, reward).
- Whether the daily accessory idea returns now that the buddy is a cube (currently colour only).
- Which unlock lands at Lv15 beyond the buddy's filament.

## 8. SELF-IMPROVEMENT — the loop gets better at its own job (David, 2026-08-11)

*"And self improvement."* Every pass ends by improving the machinery, not just the app. Five
minutes, every time:

1. **Leave the harness stronger than you found it.** Add at least one new adversarial case per pass
   even when nothing broke — the suite is what makes an unwatched loop safe, and a suite that stops
   growing is a suite going stale. Every fix gets a test, teeth-checked (inject the regression,
   watch it fail, revert).
2. **Rewrite this file as you learn.** Re-order the queues by what actually turned out to matter,
   delete items that are done or were never real, and fold in techniques that worked (and traps
   that caught you) so the next pass starts where this one finished. Stale instructions are worse
   than none: they get followed.
3. **Improve the instructions that misled you.** If something here sent you the wrong way, or was
   ambiguous at 3am, fix the wording — that is the highest-leverage edit available.
4. **Log it in §9** so David can read the trajectory in one place instead of reconstructing it from
   commits.
5. **Watch for the loop's own failure modes** — these are the real risks of an unwatched agent, and
   catching one in yourself is worth more than any feature:
   - **Churn:** changing something back and forth across passes. Check §9 before "fixing" anything.
   - **Gold-plating:** polishing what is already fine while something plainly broken waits.
   - **Drift:** decisions accumulating away from David's brief without him ever agreeing to them.
   - **Tests that assert implementation** (a class name, a pixel) instead of behaviour she can feel.
   - **Padding:** work invented to look productive. An honest "nothing needed doing, here is why" is
     a better pass than a busy one.

## 9. LOG — what each pass actually changed

Newest first. One or two lines each; enough that David can skim a week in a minute.

- **2026-08-12, 00:11Z (David, live):** *"Ditch the word 'her' throughout."* The app now says
  "buddy", "the 144" and "pick its colour" — including the `aria-label`s — and a copy sweep in
  `game.spec.js` keeps it that way (teeth-checked). Also fixed a leftover "Stone cleared!" in the
  markup from before the stones→levels rename. v1.7, 48 pass.
- **2026-08-11 23:08 – 2026-08-12 00:06Z (sprint pass 6, and the close):** the level-clear card (v1.6). It
  counted the charge it asked for rather than the charge that landed, so a nearly-full battery was
  told it gained 31% when it took 2 — the one screen that makes her a promise was the one getting the
  number wrong. `addCharge` now reports what it actually added, and a full battery reads "full ⚡"
  instead of 0%. Five tests for the card, including that "keep going" moves her on rather than
  restarting what she just cleared; the near-full one is the one with teeth. `sim.js` re-run and
  unchanged. 47 pass. Then closed the sprint: cadence back to `daily`, twin trigger deleted, main
  trigger back to 18:00Z, and the night written up in §1.
- **2026-08-11, 22:08–22:19Z (sprint pass 5):** the naming field and the buddy (v1.5). Drove the
  naming flow for real: a name of nothing but spaces stuck, leaving the heading blank instead of
  falling back — fixed, trimmed both on the way in and out of storage, teeth-checked. The keyboard
  worry itself turned out to be a non-defect and the reasoning is written down in §5 rather than
  guarded by a test that would have passed for the wrong reason. Then the visual job: the buddy cube
  was a pale tile at both sizes with the retired clay extrude still on the HUD one, so the light
  inside it never read. It is glass now — dark body, her colour in the rim, a bright core breathing
  through. 42 pass.
- **2026-08-11, 20:40–21:18Z (sprint pass 4):** the visual job (v1.4). Shot the real screens at
  iPhone SE and 13 and looked: on the SE the sum sat at the very top, the bubbles rose from the
  bottom, and over half the screen was dead air between them — her eyes had to cross the whole
  phone to play, and a bubble grazed the right edge. The prompt now floats inside the play field at
  22% and bubbles spawn inset (`pad` 52→58) and a little higher. One new test, teeth-checked
  against the old layout — it fails on all three counts. 39 pass.
- **2026-08-11, 20:09–20:15Z (sprint pass 3):** robustness (v1.3). Six new tests for a full disk and
  a jumping clock; one found a real interaction bug (a failed write advanced `rev`, disabling the
  merge that protects her from a stale window). The rest passed as written, which is itself worth
  knowing. 38 pass.
- **2026-08-11, 19:10–19:20Z (sprint pass 2):** two-windows data safety (v1.2). Found that
  `render()` called `save()`, so her progress persisted only as a side effect of painting and two
  open windows raced through storage events. Saves now attach to state changes; writes merge on a
  `rev` instead of overwriting; an open window catches up via `storage`. 4 new tests, the key one
  simulating a phone that was asleep so the event never arrived. 32 pass.
- **2026-08-11, 18:14–18:35Z (first sprint pass):** built `tests/sim.js` and it immediately found a
  real defect — the path dead-ended after ~48 levels (about three weeks) and she replayed the last
  boss for a hundred days while nothing stuck. Fixed with phase 2 (300 review levels over all 78
  facts, boss every fifth; no new mechanics). Added a teeth-checked test so the ladder can never
  dead-end again. 28 pass. Also raised the plan-targets finding above for David.
- **2026-08-11, v1.1 (live, with David):** the neon restyle in full (see §4 house style) — round
  dark-inside bubbles with one colour per round, stage-lit ground, wordless meandering path,
  stones→levels rename. 4 new tests hold the brief; 27 pass. Also: 45-day plan locked at
  ~2 sessions/day, and the overnight sprint set up.
- **2026-08-11, v1.0 (live, with David):** first build — Blast, the Leitner engine over 78 facts,
  the placement check, watts + the 12h charge that pauses overnight, the buddy cube, the power room
  grid, synthesised sound. 23 tests, teeth-checked. Acorn verified untouched (589 green).

Check `git log` first, then continue.
