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
interval: 30m
last-run: 2026-08-11T17:39Z
```

On each firing:

1. Read `interval` and `last-run`. Run `date -u +"%Y-%m-%dT%H:%MZ"` for now.
2. Hours per interval: `30m`=0.5, `hourly`=1, `daily`=24, `weekly`=168.
3. **If less than that has passed:** say one line — `not due (interval=X, Nh since last run)` — and
   **end the turn**. Do not run the harness, do not touch the repo.
4. **Otherwise:** do a full pass (sections 4–7). At the end, set `last-run` to now, re-decide
   `interval` per the ladder, rewrite both STATE lines, and commit this file with the work.

Never change the trigger schedules on your own initiative — only David does that. The one exception
is the sprint clean-up below, which he asked for explicitly.

### ⏱ SPRINT WINDOW — a 30-minute cadence for the night of 2026-08-11 → 12

David set this before going to sleep: *"Setup the cron for auto test improve overnight… every 30min
for tonight."* The scheduler will not go below hourly, so it is **two hourly triggers offset by half
an hour**:

- `trig_01LXB8qHcSRnnSTWnp8TPvY4` — the main 144 trigger, at **:05** past each hour
- `trig_01HefKdLo17wPJx3S21fN94N` — the temporary offset twin, at **:35** past each hour

**Sprint rules (they matter — nobody is watching):**
- **Tests, robustness, and the VISUAL BRIEF below.** David added the brief at 17:45Z and said
  *"Happy for you to take the lead… Continue, don't stop and I'll review in the morning"* — so the
  neon restyle IS authorised work this sprint, alongside section 5's queue. Everything else still
  needs him: no new game modes, no new features, no changes to the engine's pace or the reward
  economy, nothing that changes what she is being taught.

**🎨 VISUAL BRIEF (David, 2026-08-11 17:45Z) — "push a little more neon, KPop Demon Hunters":**
- Hard neon stage look: near-black violet ground, saturated magenta / cyan / violet / lime / gold,
  everything glowing. Confident and loud, never muddy.
- **Bubbles are round** (not rounded squares), **dark inside with a neon outline** — a lit ring, not
  a filled tile.
- **All bubbles in a round share ONE colour** so no answer looks different from another (that
  difference would be a tell). The colour changes between rounds.
- **The path has NO TEXT at all** — purely graphic nodes — and it **meanders** rather than running
  straight.
- The word is **"levels"**, not "stones", everywhere: UI, code and tests.

**Brief DELIVERED in v1.1** (17:45–18:05Z): neon palette + stage blooms, round dark-inside bubbles
ringed in light with one colour per round (rotating `ROUND_COLOURS` → `--rc`, which the prompt, goal
bar, sparks and flash all follow), a pixel-drawn meandering wire with wordless nodes (gold bead /
breathing cyan play ring / unlit ring / magenta boss star, all aria-labelled), the lit level tappable,
and the full stones→levels rename. Four tests now hold the brief. **Still worth doing on this:**
the play field's middle is still emptyish while bubbles rise (they now start at 60% instead of 72%,
but consider whether the prompt should sit lower or the field be shorter); the buddy cube's
"lit from within" read is weak at HUD size; and the power room + clear card could take more of the
neon treatment than they got.
- **Every pass must end green and pushed.** Run the harness, add a test for anything fixed, and
  teeth-check it (inject the regression, watch it fail, revert). One small verified increment per
  pass beats a big unverified one.
- **If a defect is found in the app, fix it** — that is the point of the night. Note it clearly so
  David can read what changed over breakfast.
- **If nothing safe is left to do, say so and stop.** Do not invent work to look busy, and do not
  start refactoring a working app at 3am.

**Closing the sprint — the first pass at or after `2026-08-11T23:00Z` (7am AWST) MUST:**
1. set `interval` back to `daily`;
2. delete the twin trigger `trig_01HefKdLo17wPJx3S21fN94N` (it is temporary — use `CronDelete` /
   `delete_trigger`);
3. set the main trigger `trig_01LXB8qHcSRnnSTWnp8TPvY4` back to `0 18 * * *`;
4. write a short summary of the night's work in the cadence note, and delete this SPRINT WINDOW
   block so the file stops describing a night that has passed.

Do the same clean-up early if section 5's queue is finished and the app is green — a spinning loop
with nothing to do is worse than a quiet one.

## 2. CADENCE LADDER

- **`30m` / `hourly`** only when David has explicitly asked for a sprint (see the SPRINT WINDOW
  above). Never set these on your own initiative; hand back to `daily` when the sprint closes.
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
- Legibility is in scope (big type, tap targets ≥48px, reduced motion honoured). Screen-reader
  support is out of scope, same as Acorn.

## 4. STATE OF THE APP

`tables/index.html` is a single file with no build step, live on GitHub Pages at
`/learn/tables/` with its own home-screen icon (`tables/apple-touch-icon.png` — opaque PNG, iOS
composites transparency to black). Storage key `144.v1`.

**The design decisions, so they are not re-litigated:**
- **Name:** 144 (12×12 = the whole job).
- **Skin:** "Neon Pop" — chunky tactile shapes (the `0 5px 0` clay extrude) in electric colour on
  dark slate, `ui-rounded` numerals. Everything starts deliberately under-dressed and unlocks
  richness with her level, so *the game visibly gets better as she does*.
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

23 tests at v1.0. **Add a test for every defect fixed, and verify it fails on the broken version**
(inject the regression, watch it fail, revert). Extend the suite each pass with new adversarial
cases — the tests are what make an autonomous loop safe.

Acorn's suite (`npx playwright test` from the root) must stay green too, and should be untouched by
anything done here. Run it if a change could plausibly reach it; otherwise trust the separation.

Gaps worth closing when there is time — **this is the queue for the first few passes**, most
valuable first:

1. **A simulation of the 45-day plan** (`tables/tests/sim.js`, modelled on Acorn's). Drive the real
   engine with modelled learners: does she reach all 144 inside the sprint at ~80–85% first-go, at
   ~2 sessions a day? This is the one check that can tell us the *plan* is wrong rather than the
   code, and nothing currently covers it. Report the real numbers.
2. **Two windows open at once** (Acorn's hardest-won lesson): a second tab must not clobber the
   first's watts/charge/progress.
3. **A full disk / quota failure mid-answer** — `save()` swallows it, but prove the sitting survives
   and nothing is silently lost.
4. **A clock jumped forwards and backwards mid-session** — the charge maths is guarded, but prove a
   day-boundary jump mid-stone cannot double-count or wipe progress.
5. **The software keyboard over the naming field** in the power room (Acorn had real trouble here).
6. **Screenshot the real screens** at iPhone SE and 13, and LOOK — the field's empty middle while
   tiles rise, and whether the ramp reads as exciting rather than stressful.

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

## 7. METHOD

Screenshots and driving it for real catch what the suite misses; simulation catches what reading
the code misses. Distrust your own probes as much as the app. Commit and push to `main` after
every meaningful change — Pages deploys automatically. Bump `VERSION` when she would notice.

**NOT NOW, unless asked:** division (a later mode), other games from the shortlist (Streak, Dash,
Table Bosses, Vault), multiplayer, accounts, anything that needs a server.

**Open with David (do not invent answers):**
- His deeper play-test of Blast (feel, pace, reward).
- Whether the daily accessory idea returns now that the buddy is a cube (currently colour only).
- Which unlock lands at Lv15 beyond the buddy's filament.

Check `git log` first, then continue.
