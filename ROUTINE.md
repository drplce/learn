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
last-run: 2026-10-26T17:10Z
```

The trigger fires once a day, but you only do a **full pass** as often as `interval` says — so on a
`weekly` interval most daily firings are skipped. On each firing:

0. **SYNC FIRST — the STATE block above can be stale.** This session runs in a container that gets
   reclaimed and re-provisioned, and a fresh one can come up on an older snapshot of the branch. On
   2026-08-27 the checkout was three commits behind and the sibling routine's STATE still read a
   date eight days old; taken at face value that said a full pass was due and would have redone work
   already pushed. **Nothing is lost when this happens** — the remote has it — but the gate lies
   until you fetch. So before reading anything:

   ```
   git status --short                 # must be clean before the next line
   git fetch origin <branch> && git merge --ff-only origin/<branch>
   ```

   If the working tree is NOT clean, stop and say so rather than merging over it. If `node_modules`
   is missing (a fresh container has none), `npm install` — it is quick, and the browsers are
   already on the image.

   **This really happens, and it happened again on 2026-10-26** — the container restarted
   mid-pass and came back three commits behind with no `node_modules`. Nothing was lost. But
   the image had also changed shape underneath (see §5 on `findChromium`), so **after
   `npm install`, run something small before trusting a red**: a single spec file is enough to
   prove a browser launches at all.

1. Read `interval` and `last-run` above. Run `date -u +"%Y-%m-%dT%H:%MZ"` for now.
2. Hours per interval: `daily`=24, `weekly`=168. (`hourly`/`2h` are retired — see the ladder.)
3. **If less than that many hours have passed since `last-run`:** you are firing early (an
   off-day). Say one line — `not due (interval=X, Nh since last run)` — and **end the turn**. Do
   not run the harnesses, do not read the app, do not touch the repo or the trigger.
4. **Otherwise you are due:** do a full pass (sections 3–7 below). At the **end** of the pass,
   set `last-run` to **the time the trigger FIRED, not the time you finished**, re-decide
   `interval` per the ladder (section 2), rewrite both STATE lines, and commit ROUTINE.md together
   with whatever else the pass changed.
   *Firing time, because the finish time drifts and the drift compounds.* The sibling routine
   stamped 18:09 for an 18:02 firing, and its next weekly firing then read 167.9h against a 168h
   interval — **not due by six minutes**, a whole day lost, and another the week after. Acorn has
   been stamping firing times by habit; this makes it the rule rather than the luck.

Never call `update_trigger` yourself. The cadence lives here now, and the trigger is a fixed daily
pointer — only David changes its schedule (he set it to daily at 17:00 UTC on 2026-08-09).

**This file governs ACORN only** (`/index.html`, `/tests/`). Since 2026-08-11 the repo also holds
**144**, the times-tables app in `tables/` — it has its own `tables/ROUTINE.md`, its own harness
(`npx playwright test -c tables/playwright.config.js`) and its own daily trigger at 18:00 UTC. An
Acorn pass must not touch `tables/`, and 144's pass must not touch Acorn. Two apps, one repo,
strictly separate routines.

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

> **The block below is HISTORY, kept because parts of it live nowhere else.** 144 has had its own
> living document since 2026-08-11 — `tables/ROUTINE.md` — and that file, not this one, is
> authoritative for anything about it: its state, its harness, its cadence, its open questions and
> its per-pass log. What is preserved here is the *design trail* from the days before that file
> existed: the prototypes and artifact IDs, the four-look style board, the pace lock, the mascot
> iterations. **An Acorn pass must not act on any of it, and must not edit `tables/`.** A future 144
> pass is the right place to absorb what is still worth keeping and let this shrink to a pointer.

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
  - **Buddy = ROUNDED CUBE, no feet** (David, ref: a red rounded-cube robot w/ pale face-plate). Start
    state: just the cube + a pulsing glow-LINE where the eyes will go (no face). **Level-1 customisation
    = colour only** (while it charges); face + more unlock as it boots. **3 cube options mocked**
    (`scratchpad/buddy-options.html`, artifact 609a1e79): A Soft Silicone (matte toy, pale plate), B
    Neon Device (glossy, dark screen, neon line), C Glass Bevel (premium). Awaiting his pick.
  - **STRUCTURE agreed: Option 1 "power room"** — Home = the electric stepping-stone path; the 144 grid
    lives behind the buddy as its "power room" (grid = the watts that charge it); path & grid are two
    views of one progress (clearing a stone lights its grid cells).
  - **PLAN: v1 ships tomorrow morning (2026-08-12).** Process David set: he picks a cube → I ask any
    final questions → then BUILD the real `tables/` app + a build/refine/auto-improve loop **like
    Acorn's** (its own tests + its own routine/cron, separate from Acorn's). Neon Pop skin · Blast core
    · watts currency + 12h charge · path home · power-room grid · the cube buddy.
  - **BUDDY FINAL (David, 2026-08-11): option B "Neon Device", with a Level-1 twist — NO dark face
    plate.** Level 1 is a sealed glossy rounded cube (no feet) with the light glowing from INSIDE,
    up *through* the shell: a soft blurred bloom + a dim filament line where the eyes will boot, gloss
    highlight above the glow so it reads as subsurface. Colour is the only Lv1 customisation (5 shells,
    live-switching via CSS vars). Evolution: Asleep(glow) → Lv15 Filament → Lv30 Awake(eyes) → Lv45
    Buddy. Rebuilt + published (artifact 87367345, `scratchpad/buddy.html`).
  - **Session note:** David switched the model to **Opus 5** for the build sprint (my recommendation:
    Opus 5 for build/auto-improve, drop back for calm daily maintenance).
  - **Open for David:** answer final build Qs (starting tables/placement, division y/n, sound default,
    overnight charge drain, confirm `tables/` URL + name handling) → then I build v1 for tomorrow AM.
    the real `tables/` app (fact-engine + Blast playable + a first path). Do NOT scaffold into the app
    without his go-ahead beyond the prototype.

**OPEN (awaiting David, not actionable here) — the "sheep" idea; he chose #2, prototype built
2026-08-08.** (Was "HOT/hourly" when the trigger fired hourly; those rungs are retired — see §2.)
His concept: on the
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
  0. **NEW 2026-10-07 — what should happen when her phone corrects her spelling?** Measured, not
     guessed at: she types `beutiful` by hand (eight real keystrokes), iOS corrects it to
     `beautiful`, and the whole-word arrival trips the written-answers check. On submit the box is
     cleared, the word is spoken again, and she gets no verdict. **She is not locked out** — retyping
     it by hand straight after was accepted (`right: 1`) — so this is a nuisance, not a trap, and the
     hand-back is quiet and blameless exactly as designed.
     **The sharp part is what it does to the engine, not to her evening: her misspelling is thrown
     away.** The attempt is never scored, so the box never hears that she cannot spell that word. A
     word she reliably misspells-and-autocorrects looks untested forever.
     Three ways to go, and the choice is yours:
     (a) leave it — a quiet hand-back and another go, at the cost of the engine never learning;
     (b) accept the corrected word — **do not**; it would credit her for spellings she did not
         produce and poison the mastery data, which is the one thing this app must get right;
     (c) **judge what she actually typed**, not what the phone left behind. Checked and it is
         feasible: at `beforeinput` time the box still reads `beutiful`, so her real attempt is
         there to be scored. It is the honest answer and the bigger change, and it alters what
         counts as an answer — which is why it is yours and not mine.
     **I built (c)'s cheaper cousin and threw it away.** A rule that rescued any whole-word arrival
     she had mostly typed herself did stop the hand-back — and marked a misspelling **right**
     ("Yes — that's it"). That is worse than the thing it fixed. Recorded so nobody rebuilds it.
     **One thing I could not check from here:** that iOS delivers autocorrect as a single whole-word
     event after the letters. The fixture is modelled. This file's own standard is that a guessed
     fixture being caught is not evidence about the real one — worth thirty seconds on the phone.
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

**Cadence note (17:31Z, 2026-08-11):** third clean pass on the daily cron, and the day a SIBLING APP
arrived — David had me build **144** (times tables) in `tables/`, with its own routine, harness and
daily trigger at 18:00Z. Acorn itself is untouched by that work and was re-verified as part of it.
All three green: Playwright 589 (run this evening on the frozen bytes while proving the two apps are
separate), break clean across 37 cases, sim in band (learned 83.5%, all 8 bands held). Acorn's code
has not changed since 13.44 on 2026-08-05.
COOLING `daily → weekly`: nothing here is actionable. The sheep thread is David's to react to (and
he has clearly pivoted to 144 for now), and a daily pass on six-day-frozen code only adds noise on a
night when 144's pass is the one doing real work. A live message snaps this back to `daily` and is
answered in real time regardless. (Prior note 17:13Z 2026-08-10 — superseded.)

**Cadence note (17:07Z, 2026-09-19):** first weekly firing that was actually due (191.8h). Three
captured suite runs green — two on the real clock, one at `ACORN_DAYS_AHEAD=400` — plus break clean
across 39 cases and sim in band (first-go 92.5%, known material 87.1%, learned 100% of the 14 words
the list reaches). The app's code was frozen at 13.44 since 2026-08-05 before this pass.

Reviewed §6.2, the words she sees, since the last pass took §6.5. Built a sweep that reads every
readable phrase on the page — visible text, every `aria-label`, every placeholder, the `#say`
channel — across five count-sensitive states and regexes for `1 <noun>s`. **Its first version was
lying**: it split `body.innerText` on newlines, and a stat tile is `<b>1</b><span>sittings</span>`,
two lines. With the sittings plural guard deliberately deleted it still reported clean. Rebuilt to
collapse each ELEMENT's innerText to one line and sweep those; teeth-checked with the same injected
regression, which it then caught in two places. On the real build: clean. Acorn's numeric agreement
is genuinely good — every count-bearing string already carries its guard.

Found and fixed one thing, in the grown-ups map caption. `ahead === 1` had no form: the sentence
said "the few she is coming to next as faint outlines" over a single pale shape. This is the same
defect the file has already fixed twice (the filament clause, the outline clause) one rung further
down, and the file's own standard is the reason — a caption that describes a picture you are not
looking at is worse than no caption. The clause now has a singular form. The neighbouring "the rest
of her lists are not drawn" clause was left alone deliberately: the horizon walk breaks after one
untouched family, so `ahead === 1` can legitimately coexist with whole lists still undrawn.
Regression test `network.spec.js` "one outline is one outline, not a few" checks BOTH directions, so
it cannot be satisfied by copy that has quietly gone singular for good; teeth-checked both ways
(revert the fix → red; force it always-singular → red, and it takes the older caption test with it).
591 pass now. **No VERSION bump** — she never sees the grown-ups screen, so she would not notice.

Staying `daily` per the ladder: a pass found and fixed a defect, so a daily look still earns its
keep. Tempering that honestly — the find was one clause of copy on a grown-up screen in a state at
the end of every list, on code otherwise frozen for six weeks. If the next pass is clean, cool
straight back to `weekly` rather than spending six firings proving frozen code is still frozen.

**Cadence note (17:07Z, 2026-09-20):** and the very next pass was not clean, which settles the
question the note above left open. All three green first (592 now, sim in band, break clean across
39 cases).

Took §6.1, the visual look, which the rotation had not reached since before 2026-08-18. Screenshot
the real screens the way §6.1 says to — iPhone SE and 13, light and dark, 0.9×/1.0×/1.5× text — and
LOOK at them. The dark map is what the look found: the learned words are the BRIGHT ones, and the
caption underneath says "they fill in and darken as she learns them".

Measured rather than eyeballed, because a look can be wrong about what it is looking at. A cell is
`--acc` at a fill-opacity that climbs with her box; `--acc` is #35705A on cream and #7CC0A2 on the
dark screen. Compositing box 1 against box 7: **light L 0.713 → 0.131 (darkens), dark L 0.047 →
0.446 (lightens)**. The sentence was true on exactly one of the two screens, and it is the third
time this caption has been caught describing a picture the reader is not looking at. Reworded in
the direction that survives both — "fill in and grow stronger", "fades rather than disappearing" —
rather than made conditional on the scheme, since the scheme can change under a live page. The
code comment above the ramp said the same one-scheme thing and was corrected with it.

`network.spec.js` "the caption is true on the dark screen as well as the light one" measures the
direction in each scheme, asserts the premise still holds (the two really do run opposite ways), and
bans any one-scheme direction word in the copy — so it cannot be satisfied by swapping "darken" for
"lighten". Teeth-checked both ways; both go red. **No VERSION bump** — grown-ups screen again.

**Lesson worth carrying: the harnesses could not have found this.** Every one of the 590 ran in the
default scheme, and the defect is a sentence that is true there. §6.1 says to screenshot light AND
dark and look; that instruction is the only thing in the routine that was going to catch it. Two
passes running, the find has been in copy — worth asking next time whether the contrast/scheme
sweeps should cover the *claims* the copy makes and not only its legibility.

Staying `daily`: two consecutive passes found something, so the daily look is plainly still earning
its keep. Drop the "cool if the next one is clean" plan from the note above — reassess on evidence,
not on a schedule set in advance.

**Cadence note (17:07Z, 2026-09-21):** third pass running, third find, and the three of them are the
same defect wearing different clothes. All three harnesses green first and after (593 now, sim
byte-identical, break clean).

Carried on with §6.1 into the screens the last look did not reach — the write stage, the verdict,
the re-trace, her finished garden, light and dark at 1.0× and 1.5× on the SE. Those are all fine.
What the look turned up instead was on the grown-ups screen: the paragraph explaining the pace
spells out **3 / 1 / 0 new words** as if they were laws of the app. They are the DEFAULTS of the two
steppers a few inches below it on the same screen, and the code comment beside `clampN` says so in
as many words — "the tiers that used to be hard-wired at 3 / 1 / 0 now read the two grown-up
levers". The sentence was never updated when the levers landed.

Measured at newMin 2 / newMax 5: the engine hands her **5 / 2 / 2**, and the paragraph still
promised "up to three new words, in the middle eight words and one new, under 70% six words and
nothing new" — three wrong numbers. Worse, the paragraph OPENS with `paceLabel()`, which does read
the lever, so it read "**5 new words a session**. … up to three new words" — self-contradicting
inside one paragraph. The third claim, "new words never take more than a third of a sitting", was
false too: at newMax 5 on a nine-word sitting the pool is 5, over half. The bands now come from the
levers through the same `clampN` the engine uses, and the third-of-a-sitting line says what is
actually always true (the ceiling bounds it) with the third given as what the suggested 3 works out
to.

Checked before assuming the copy was the only thing wrong: at **newMax 0 she really does meet zero
new words** (`poolCap` returns 1 there, but `newWordsToday` gates the intake and returns 0). The
engine is right; only the sentence was wrong. Sim numbers are byte-identical, which is the proof no
behaviour moved.

`pace-settings.spec.js` "the pace paragraph says what the engine will actually do" puts her in each
of the three bands at six lever settings, asks the ENGINE what it will hand her, and requires the
paragraph to contain that number in a readable form — **and to contain no number the engine will
never give**, which is exactly how the old copy failed ("three" survived at every setting). It also
holds the paragraph to opening with `paceLabel()`. Deliberately not pinned to a fixed string, so the
wording stays free to change and still has to be true. Teeth-checked: restore the hard-coded
sentence and it goes red naming the band. **No VERSION bump** — grown-ups screen.

### The pattern, now that there are three of it

2026-09-19 (the caption promising "the few" over one outline), 2026-09-20 (the caption promising
"darken" on a screen where learning brightens), and today are all **one defect: an explanatory
sentence that was true when it was written and was falsified later by a state, a setting or a colour
scheme, with nothing holding it to the app.** None of the three was reachable by the harnesses as
they stood — every one of the 590 ran in the default scheme, at the default settings, in the middle
of a list.

So this is now a standing item in §6.2 rather than something to rediscover: **go through the
explanatory copy asking what makes each sentence true, and what could falsify it — a grown-up
setting, the colour scheme, a count of one, the end of a list.** Where a sentence states a number the
app computes, it must read it from the same place the app does. The tests that come out of this
should compare copy against the ENGINE, never against a fixed string; all three of these did, and
all three have teeth in both directions.

Staying `daily`. Three for three is not a run of luck, and the sweep above is not finished — the
grown-ups screen has several more explanatory hints (the voices paragraph, the saved-lists one, the
backup summary) that have not been put to this question yet.

**Cadence note (17:13Z, 2026-09-22): the §6.2 sweep is now FINISHED.** All three named hints were
put to the question; one was wrong, two were fine, and saying which is the point. All harnesses
green (594, sim in band, break clean).

- **The voices paragraph — wrong, fixed.** It made two claims about a phone it had never looked
  at: the list is "Australian first", and "Karen is usually the best it can do". `offerVoices()`
  does put en-AU first **when there is one**; both sentences were printed unconditionally. Stubbed
  a UK phone and a laptop with a single American voice and got "**offering 1 English voice,
  Australian first**" with Karen recommended and absent. This is not an exotic state — the
  grown-ups screen is the one a parent is most likely to open on a laptop to paste a list. Both
  clauses now read the list. The replacement also had to dodge an agreement slip of its own:
  "none of them Australian" reads plural against "1 English voice", so it is "and none is".
  `speech.spec.js` "the voice paragraph describes the phone it is actually on" drives four stubbed
  phones, checks the fixture really produced the shape it claims, and requires the copy to claim an
  Australian accent only when one is on offer and to name Karen only when she is. Teeth-checked.
- **The saved-lists drip hint — fine, left alone.** "A long list is dripped a couple of words at a
  time, never dumped on her at once." "A couple" is vague prose rather than a computed number, and
  the actual promise — never dumped at once — holds at every lever setting. Changing it would have
  been padding.
- **The backup summary — fine, left alone.** Every count already carries its plural guard, and
  "0 words, 0 saved lists, 0 sittings" reads correctly.

**Correction to yesterday's note.** It says "at newMax 0 she really does meet zero new words". That
is true only when she has review material. With an empty slate `buildSession`'s `MIN_SESSION` floor
still hands her one new word — deliberately, and the comment there says why ("one new word beats a
thirty-second session she has no reason to come back to"), bounded by `poolCap`'s own `max(1, …)`.
The pace gives her none; the floor overrides the pace rather than the pace failing. Yesterday's
conclusion stands — the engine was right and only the copy was wrong — but the claim as written was
broader than what was measured, and a later pass could have leaned on it.

Staying `daily`, but the reason has changed: the sweep that justified the last three passes is done,
so the next pass has no queued work. That is fine and it should be said plainly rather than
back-filled — **if the next pass finds nothing, say so and cool to `weekly`.** Do not go looking for
a replacement item.

**Cadence note (17:13Z, 2026-09-23): nothing found in the app. COOLING `daily → weekly`,** which is
what the note above said to do and is the whole point of having written it down in advance.

Took §6.3, the engine, and carried over the question that had been paying all week — what state
pushes a value to an edge. For an engine measured in days, that state is the CLOCK, so: **ran the
whole suite in a timezone with daylight saving for the first time in its life.** Every run it has
ever had was under UTC, while `parseISO` builds local-midnight dates and `dayDiff` leans on
`Math.round` to absorb 23- and 25-hour days. **594 pass under `TZ=Australia/Sydney`.** The reasoning
in that comment was already sound; it is now measured instead of only argued, and the practice is
written into §5.

The one red of the day was the documented `two-windows` flake, and it is still documented rather
than fixed. Handled it properly rather than waving it through: 12/12 in isolation three times, and
**one failure in nine full runs** today, so ~1 in 9 under parallel load. Then went after it — 40
instrumented trials of the exact scenario, **ten of them with her window's `storage` listener
deliberately removed** so it could not hear the paste at all. Could not reproduce the loss once.

That failure produced something worth keeping anyway, and §5 now carries it: the guard on a
grown-up's pasted list is the **merge in `save()`**, not the listener — the same conclusion
break.js §31 reached for her answers in August, now measured for lists too. The instinct on reading
that listener is that it is what saves a paste. It is not.

**What is NOT established, and the next attempt should start here rather than repeat my forty
trials:** why it fails under full parallel load and never in isolation. The instrumented run shows
her window has already received dad's write before she answers in 30/30 unloaded trials, so the
load is changing the ordering in a way I did not reproduce. The failure's shape says the device
ended holding only her list, which the merge alone should make impossible — so either the merge was
skipped (`raw === _wrote`), or a write landed in an order I have not modelled. Worth an hour with
the merge instrumented in-page, not more guessing from the outside.

Cooling because the app is clean and the sweep is done. **A live message from David, or any defect
a pass actually finds, resets this to `daily`.**

**Cadence note (17:13Z, 2026-10-07, due at 168.0h exactly):** 594 pass, sim in band, break clean
across 39 cases. **Nothing changed in the app.**

§6.5, real input — least recently rotated (2026-09-11). The input handling here is already the most
carefully reasoned code in the file: the IME `keyCode 229` case is handled, keystrokes are trusted
only once the device has proved it reports them, and the jump test is chosen precisely because it
fails permissively. The gap is not in the mechanism, it is in **which hand the keyboard belongs to**:
`HER_OWN_HAND` covers typing, slow typing, an Android IME, a correction rubbed out and starting
over — and not the one thing this app will meet most, a dyslexic child's misspelling being silently
fixed by her phone. Measured it, found the hand-back, and it is now question 0 for David above.

**I shipped nothing, and the reason is worth keeping.** I wrote the fix, ran it, and it turned a
misspelling into "Yes — that's it." The hand-back I set out to remove was protecting something more
important than the annoyance it caused. Verifying a fix means checking what it does to the thing you
were not looking at, not only to the thing you were.

Staying `weekly`: the app is clean, nothing was found wrong with it, and what the pass did turn up
is David's to answer.

**Cadence note (17:13Z, 2026-10-14, due at 168.0h exactly): nothing found.** 594 pass, sim in band,
break clean across 39 cases. No change to the app.

§6.1, the visual look, and the one axis of it nobody had ever LOOKED at: **the four tints.**
`contrast.spec.js` has measured them since August — every text node on every screen on cream and all
four tints, light and dark — but measuring that the text clears AA is not the same as seeing whether
the screen looks right, and every screenshot this routine has ever taken was on cream.

Shot her word screen on all five grounds at 375px and looked. They are fine: each tint is a soft
wash, the word box lifts off it, and the one accent (`--acc` is the same deep green on all five)
reads on every one. The hue clash I went looking for — a green accent on the mint and blue
grounds — is there in principle and invisible in practice.

Then measured the place where tint and accent could actually collide, which is the garden: its cells
are `--acc` over `--surface`, so on mint that is green on green. **It makes no difference** — the
faintest cell sits at 1.27–1.28:1 against the ground on every tint and the strongest at 5.14–5.39:1,
under 5% between the best tint and the worst. Mint and blue are not special cases. (The faintest
cell being low is the design: a box-1 word is meant to be barely there, and the picture's information
lives in its `aria-label`.)

Staying `weekly`.

**Cadence note (17:09Z, 2026-10-21, due at 168.8h): the full suite came back RED, and the red was
real.** `tests/audio-live.spec.js:101` — "the sitting is fetched ahead, and playing it asks the
server for nothing" — failed with `because.wav` in the list of things the network was asked for.

§5 told me what that failure was: one of two known parallel-load flakes, confirm in isolation and
move on. **It was not.** Isolated, the file failed **1 run in 3**; the single test alone failed
**2 of 10**. Acorn's config has `fullyParallel: true` and no `retries`, so every one of those was a
genuine failure. The standing exception in §5 had been covering a real defect in the test for
months, and I walked into it because the exception was there to be walked into.

I also got the first reading of it wrong in a way worth recording. My summary command was
`grep -E 'passed|failed' … | tail -1`, which returned "8 passed" for run 2 and dropped the
"1 failed" line directly above it — so I told David the test passed in isolation when it had not.
§5 has said *capture to a file and grep it properly, never `| grep | tail`* since August. Writing a
lesson down is not the same as following it.

**The defect, measured rather than reasoned at.** The test waited for `warmed() > 0`, opened a count
of network requests, and only then picked which phrase to play. But the sitting warms the word she is
on **last**, deliberately — `index.html` ~2072, "the word just spoken goes last, so the element's own
request finishes first and this one comes off the browser's cache instead of racing it". So
`warmed() > 0` can be true while that word's own fetch is still to come, and the count catches the
fetching-ahead and reads it as the playing. A probe printing the warm set at the instant the count
opened showed the chosen word (`because`) **missing from it in 2 of 12 runs**, while the test went
on to choose it anyway. The fix settles which phrase will be played *before* opening the count, so
its clip is provably already on the device and any later request for it can only be the playing.
Six isolated runs clean, two full suites clean, one of them under `TZ=Australia/Sydney`.

**What the teeth-check then showed, which is not flattering to the test.** Flipping `clipFor` to
`clipUrl(k) || _blob[k]` — a real regression shape, someone "tidying" the fallback order — is caught,
but by the *device* assertion, not by the request count. Once the race is gone the count has no
independent teeth in this test, because the test builds its own `Audio` element instead of going
through the app's hear-again path. So half the test's title is currently carried by the other half.
Said plainly here rather than left as an unearned green; the stronger version is HAR-7 on the
worklist and needs the write screen set up in that file.

The other three harnesses: sim in band, break clean across 39 cases, 594 pass. **No change to the
app, so no VERSION bump** — this was entirely a harness pass.

**Warming `weekly → daily`.** The ladder says daily the moment a pass finds a defect, and this one
found two: the test, and the §5 paragraph that had been excusing it. The second matters more. There
is still one standing exception in §5 (`two-windows`), and it is now the only thing standing between
a real failure and a shrug. A daily health check earns its keep until that one is either explained
or removed.

**Cadence note (17:09Z, 2026-10-22, due at 24.0h): the last standing exception is gone, and it
was the test.** Two finds, one in the harness I was hunting and one in the engine I rotated to.

**`two-windows.spec.js`.** Yesterday's pass warned that this was now the only thing between a real
failure and a shrug, so it got the day. What worked was not more cleverness: **run the full suite
in a loop, capturing each run to its own file.** It came red on the first run — against 240
isolated trials on 2026-09-30 that had produced nothing. The load is not incidental to this
failure; it IS the failure, and trying to reproduce it in isolation was always going to fail.

Then I wasted an hour proving I should have read the log sooner. Three mechanisms deduced from
reading `mergeSaved` — a stale second window in the sitting-count test, the else-branch dropping a
same-id list, a late `storage` event alone — and **all three were wrong; two of them survived a
teeth-check that should have killed them** (I stubbed `untouched` to false and the test passed,
which should have told me immediately that my story was incomplete). The instrumentation settled it
in one red. The lesson is the one this file already carries and I keep relearning: measure first.

And the instrumentation had been **wired into the wrong test** — 2026-09-30 put `story()` on the
test two above the one that actually flaked, so every red for three weeks printed nothing. Worth
checking, when a diagnostic is added for a known red, that it is attached to the thing that reds.

What it was: the test opened two real windows, had a grown-up edit the list next door, then had her
answer *"while her window still holds the old name"* — waiting for nothing in between. The log gave
the margin: **eight milliseconds on an idle machine**, his edit landing at 167ms and her answer at
175ms. Under the parallel suite that margin goes. And the sharper half — on every ordinary run her
window had **already** updated by the time she answered, so the test exercised the stale-window
merge it was written for **only on the runs where it failed**. It was a stopwatch in disguise, the
same shape as yesterday's audio-live defect, found a day apart. Replaced by two tests that cannot
flake and that are not two views of one thing: the merge rule built in one window (where the stale
state is the state under test, not something the clock has to cooperate to produce), and the live
two-window path with a wait for the thing it depends on. Stubbing `untouched` reds the first and
leaves the second green, which is why both are kept. `__acorn.listsSeen()` is new, so the
one-window test can assert its own premise rather than hope for it.

**§6.3, the engine — the syllable splitter, and the question of what its tests are measured over.**
`syllables-quality.spec.js` scores the split against seventy reference words from Macquarie and
Oxford. That is the right way to measure *accuracy*. But the file's own opening line says
`syllables()` only ever runs on **what a grown-up pastes in** — and the invariant checks, the ones
that are not about accuracy at all (the chunks spell the word, every chunk is sayable), were
running over those same seventy. A word she meets next week is not one of them.

So: every word the app already knows — the built-in lists and both researched dictionaries — put
through what a school list does to a word (-s, -ed, -ing, -ly, -ness, -ment, un-, re-, over-, …),
**6,531 words**, held to what must be true of any word whether anyone checked it or not. All four
invariants clean. The splitter is in better shape than its test coverage suggested.

The teeth-check is the part that earns it. A one-letter slip in `suffixSplit`'s stem leaves **all
six existing tests in that file green** and turns `calling` into `cal·ing`, `morning` into
`mor·ing`, `talking` into `tal·ing`, `beautiful` into `beaut·ful` — **2,044 of the 6,531**. Not one
word in the reference set takes that path with a letter to lose. A dropped letter in her chunks is
a misspelling on her screen and a wrong sound in her ear, and nothing would have caught it.

Harnesses on the fixed build: **ten full suites, 596 pass every time, no test named in any of
them** — run the same way that caught the flake red on the first run this morning, and against an
old rate of about one in nine. One more under `TZ=Australia/Sydney`, also 596. Sim in band, break
clean across 39 cases. **No change to the app she uses, so no VERSION bump** — the one edit to
`index.html` is a test hook on `__acorn`.

**Staying `daily`.** Two defects found and fixed. Also worth saying plainly, because it is the
pattern of the last two days: both of this file's standing exceptions turned out to be real, and
each took about an hour once it was treated as real rather than re-excused. §5 now says there are
none left, and says why.

**Cadence note (17:10Z, 2026-10-23, due at 24.0h): §6.4, and the app had a way of going silent
on her.** 13.45 — the first change to what she experiences since 2026-08-05.

Went looking for an adversarial case `break.js` does not already have. Two candidates died cheaply
by reading, which is the point of reading first: the clock running backwards is already guarded in
`isDue`/`overdueRatio`/`recordWord` **and** already driven by §11 (Acorn is ahead of the sibling app
here — 144 had that exact defect on 2026-10-17, and the rule about not inheriting a diagnosis cuts
both ways); and a backup restored under a full disk is covered by §26 plus `restore()`'s own undo.

The gap was the clip path. Nothing hammers it, and it is the surface this routine has been working
on for two days. `playClips` says in its own comment that it "hands the whole thing back to the
phone's voice if any clip fails to arrive — offline, or a bad deploy." It implements **errors**,
not **fails to arrive**. A connection that accepts the request and then stalls fires neither
`error` nor `ended`, so the sequence simply stopped.

Measured before claiming it, with a control, against a server that sends headers and never a body:

| what the server does | does the phone's voice take over |
|---|---|
| serves the clip | n/a, the clip plays |
| 404 — a bad deploy | **yes, inside a second** |
| accepts, then hangs | **no — still silent after ten seconds** |

That is the worst case to be silent in. A bad connection is exactly what stops a clip being warmed
ahead, and the first word of a sitting is said **before** warming finishes, straight off the
network (`index.html` ~2068 — deliberately, so the element's own request wins the race). So the most
exposed word in the app is the one she is looking at when she sits down, and what she got was a word
screen with no word. Nothing in the harness could see it, because every audio test either stubs
`Audio` or serves the file.

Fixed with a stall timer on the element rather than a deadline: any progress re-arms it, so a
slow-but-working clip is never cut short, and a warmed blob — which starts instantly — never reaches
it. Two seconds, because that is about as long as a word screen can sit silent before it reads as
broken, and because firing early costs only that she hears the phone voice instead of the recording,
which is the graceful fallback by design. There is exactly one caller and it passes one clip, so
the timer's scope is one clip at a time.

Three tests, and they are not three views of one thing — removing the arming call reds the stall
test and leaves the 404 control and "a clip that does arrive is not cut short" green. The budgets
are deliberately four times the thing measured: `spokenIn` returns the moment she is spoken to, so
the margin is only ever spent on a failing run. **Two tests in this project have been flaky for
being timed tightly, both found this week; I was not going to write a third.**

**VERSION 13.44 → 13.45.** She would notice this one: a word that used to be silent is spoken.

Harnesses: 599 pass (three new tests), the audio-live file six times over on its own, sim in band,
break clean across 39 cases.

**Staying `daily`.** A defect found and fixed, and it is in the app this time rather than the
harness.

**Cadence note (17:09Z, 2026-10-25, due at 47.98h — a day was lost to the gate itself, see the
end): §6.5, real input.** Nothing wrong with the app; a sentence I had made untrue two days ago,
and a test with teeth nothing else has.

**First, the copy I broke myself.** 13.45 made `_clipFalls` count a recording that never *arrives*,
not only one that will not play. The hint under those counts on the grown-ups screen still read
"A recording that **will not play** falls back to the phone voice" — and it sits directly under
"This phone can play .m4a: yes/no", so it points a grown-up at a codec diagnosis for what may be a
connection. Exactly the §6.2 sweep, applied to my own edit: a sentence that was true when written
and was falsified by something that changed later. It now names both causes and says what a rising
count means when the phone says yes — the recordings are not reaching her, which is the connection
or the deploy rather than the phone. No test pinned the wording, which is the §6.2 design working.

**Then §6.5 proper, and four candidates that died by reading** — worth listing, because reading
first is what made them cheap: a curly apostrophe (folded in `tidyPunct`, and iOS Smart Punctuation
is called out by name in a comment at ~1450), an accented letter (NFD, with the café/caf and
naive/nave incident recorded), a substituted dash, and a trailing full stop from a double-tapped
space (the "said." incident, which cost her a box on a real phone and is why `typedLetters`
exists). This path is in better shape than I expected to find it.

So the question became whether ALL the shapes are covered, which is a measurement rather than a
read. `real-typing.spec.js` drove twelve hand-picked shapes — all ASCII, all on one plain word.
The app's own lists hold words with apostrophes and hyphens in them, which are the two characters
`typedLetters` deliberately keeps and therefore the two most likely to be substituted out from
under her. Added the cross-product: three kinds of word (`said`, `they're`, `mother-in-law`) by
twelve shapes a phone really makes, driven one keystroke at a time. **All 36 correct**, and a
control test of seven genuine misspellings that must still miss — without which the first could
pass by marking everything right.

**What the teeth-check measured, which is the reason to keep it:** widen the keep-list in
`typedLetters` so a zero-width character survives on the end of her answer, and **exactly one test
in 601 goes red — this one.** An invisible character on the end of a correctly spelled word marked
her wrong and nothing else noticed. Also recorded honestly: the hard space (U+00A0) did NOT red,
because `.trim()` removes it anyway, so that shape is belt-and-braces rather than an independent
check. Said in the test's own comment rather than left as an unearned green.

Harnesses: 601 pass, sim in band, break clean across 39 cases. **No VERSION bump** — the only app
change is grown-ups copy.

**Staying `daily`.**

**The gate lost a day, and it is the gate's own trap.** 2026-10-24 fired at 17:09:18 against a
`last-run` of 17:10 — **24 hours minus 72 seconds**, so the pass was skipped. The trigger's fire
minute wanders (17:09:42, 17:10:20, 17:09:18, 17:09:15 over four days) and step 4 stamps the minute
it fired, so at `daily` roughly every other firing lands just short. 144 hit the same thing an hour
later at 167.97h against `weekly`. Step 4 already records this failure once — the sibling routine's
167.9h — and the fix adopted then cured the *finish-time* drift but not jitter in the firing time
itself. It loses days; it does not deadlock, which is why today reads 47.98h and is due. **Reported
to David rather than fixed here: only he changes the cadence rules.** The two repairs offered were
a tolerance on the comparison (treat ≥ interval − 15 min as due) or stamping the trigger's
scheduled time rather than its actual fire time.

**Cadence note (17:10Z, 2026-10-26, due at 24.02h): the harness could not start, and the thing it
could not see.**

**First, the harness was dead and it was not the app.** The container restarted mid-pass and came
back three commits behind with no `node_modules` — the §1 step 0 case, handled. But it had also
come back with `chromium-1243/chrome-linux64/chrome` and a symlink at `chromium`, where the image
had been shipping `chromium-<rev>/chrome-linux/chrome`. `findChromium()` knew only the old layout,
returned undefined, and Playwright fell back to its own pinned revision, which this image does not
carry. **Every test in the suite failed to launch a browser, on a build nobody had touched.** That
is the worst kind of red — it arrives on its own, for a reason that is not the app, and it looks
exactly like the app. The config now tries both layouts and accepts the entry itself when it is the
binary, because the image's layout is not ours and it moves. §1 step 0 now says to prove a browser
launches before trusting a red on a fresh container.

**Then the pass proper: §6.1's rotation gave way to something the sibling app taught yesterday.**
144's routine found that `wakingHoursBetween` read local time while its suite ran under UTC, where
local and UTC are the same thing, so the defect was structurally invisible. §5's standing rule is to
measure a sibling diagnosis here rather than inherit it, so I did both halves.

*Does the defect transfer?* **No.** `iso()` uses local getters and `parseISO` builds local
midnights, consistently; `dayDiff`'s `Math.round` genuinely absorbs 23- and 25-hour days (the error
would need about six years of transitions in one span to reach 0.5, against a 60-day maximum box).
Acorn is correct here. Read, not assumed.

*Does the GAP transfer?* **Yes, completely.** Nothing in this suite pinned a timezone, and the
suite picks 22 distinct dates, nearly all in June–August. So: `her-day.spec.js`, three tests with
`timezoneId` pinned on the context, each asserting its own premise (that the fixture really is a
moment when UTC is a day behind) so it cannot pass for free. **The teeth-check is the argument:
replacing `iso()` with `d.toISOString().slice(0, 10)` reds those three and nothing else out of
604.** 9am on a Sydney Saturday came back as the Friday. On her phone that is every morning
practice filed under yesterday — the sitting on the wrong day, `lastSeen` a day out on every word
she met, and "finished today" answering for a day she has not had.

Harnesses: 604 pass, sim in band, break clean across 39 cases. **No VERSION bump** — no change to
the app.

**144's harness is broken the same way and this pass must not fix it.** `tables/playwright.config.js`
line 15 carries the identical `chrome-linux` assumption, confirmed by reading it. Its own next pass
is due 2026-11-01 and will hit it immediately. Flagged to David rather than crossed into.

**Staying `daily`.**

**Cadence note (17:13Z, 2026-09-30, due at 168.0h exactly):** fresh container, `npm install`, then
594 pass, sim in band, break clean across 39 cases. **Nothing found in the app; no app change.**

Took §6.4, robustness — least recently rotated — and specifically the next step this file recorded
a week ago: instrument the two-window merge in the page rather than guess from outside. Did that,
and the honest result is a **negative plus a correction**, both now in §5 above. The negative: 240
trials could not reproduce the loss. The correction: I found 144's config note describing exactly
this flake in its own suite, traced to parallel tests sharing one `file://` localStorage, **said out
loud that I had found it**, and only then measured — and the measurement says Acorn's workers are
storage-isolated, both across workers and sequentially within one. The leading hypothesis is dead
and the next attempt should not spend a day on it.

What shipped instead is the thing that makes the next occurrence cheap: the test records every
write to storage and prints both windows' logs when it fails. **The first version of that was
decoration** — it wrapped `__acorn.save`, which the app's own code does not go through, so it
captured the seed and missed the write inside `check()`. Verified by forcing the assertion and
reading what actually printed; rewrapped at `Storage.prototype.setItem`, which nothing can bypass.
That is the fifth probe-measures-the-wrong-thing of this stretch, and the second caught only by
deliberately breaking the thing to see whether the instrument noticed.

Staying `weekly`: the app is clean, and a harness improvement is not a defect found.

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

**There are no standing exceptions left. A red is a red.** Both of the ones this file used to
carry turned out to be defects in the tests, found a day apart: the audio-live prefetch test on
2026-10-21, and `two-windows.spec.js` on 2026-10-22. Each had been excused for months, and each
took about an hour to pin once it was treated as real. If a future pass is tempted to write a new
exception into this section, that is the history to weigh it against.

**The audio-live prefetch test was listed here too, for months, and it did not belong.** On
2026-10-21 it came back red in the full run. Re-run in isolation it failed **1 run in 3**, and the
single test alone **2 of 10** — so it was never a parallel-load flake; the standing exception had
been covering a real defect in the test. Two lessons, both already in this file and both ignored:
*treat any intermittent failure as a defect in the test until proven otherwise*, and
**capture to a file and grep it properly** — my first summary ran `grep -E 'passed|failed' | tail -1`,
which returned "8 passed" and silently dropped the "1 failed" line above it, and I reported the
test as passing in isolation when it had not.

The defect: the test waited for `warmed() > 0`, started counting network requests, and only *then*
picked a phrase to play. But the sitting warms the word she is on **last**, on purpose
(`index.html` ~2072 — the element's own request finishes first so the prefetch comes off the
browser cache instead of racing it). So `warmed() > 0` could be true while that word's fetch was
still to come, and the count caught the fetching-ahead and read it as the playing. Measured: a
probe printing the warm set at the moment the counter opened showed `because` missing from it in
2 of 12 runs, while the test went on to choose `because`. Fixed by settling which phrase will be
played **before** opening the count, so its clip is provably already on the device.

Honest limit of that test, now the race is gone: it builds its own `Audio` element rather than
going through the app's own hear-again path, so "playing asks the server for nothing" follows from
"it came off the device" and is belt-and-braces, not an independent check. A teeth-check confirmed
this — flipping `clipFor` to `clipUrl(k) || _blob[k]` is caught, but by the device assertion. The
stronger version (drive the real path) is HAR-7 on the worklist.

**`two-windows` — SOLVED 2026-10-22. It was a stopwatch in disguise, and it was testing the
opposite of what it claimed.** `a list this window has not touched is not reverted by it` opened
two real windows, had a grown-up edit the list next door, then had her answer "while her window
still holds the old name" — waiting for nothing in between. The 2026-09-30 instrumentation finally
printed, and the margin was **eight milliseconds on an idle machine**: his edit reached her window
at 167ms and she answered at 175ms. Under the parallel suite that margin goes. Worse, on every
ordinary run her window had ALREADY updated by the time she answered, so the test was not
exercising the stale-window merge it was written for — it only did so on the runs where it failed.

Replaced by two tests that cannot flake: the stale-window merge built **in one window**, where the
stale state is the state under test rather than something the clock has to cooperate to produce;
and the live two-window path, which **waits** for her window to have heard before she answers. They
are not two views of one thing — stubbing the merge's `untouched` branch reds the first and leaves
the second green — so both are kept. `_listsSeen` is now exposed on `__acorn` (`listsSeen()`) so a
test can assert the premise instead of hoping for it; without it the one-window test could not
prove the window really was holding an untouched list.

**The method that found it, after 240 trials had not:** stop trying to reproduce it in isolation
and run the FULL SUITE in a loop, capturing each run to its own file — it came red on the first
run. Then read the instrumentation rather than reasoning about the code: three separate mechanisms
deduced from reading `mergeSaved` were all wrong, and two of them survived a teeth-check that
should have killed them. The log settled it in one run.

**And the instrumentation had been wired into the wrong test.** 2026-09-30 added `story()` to
`and her answering does not erase the list he just saved`; the test that actually flaked was the
one two below it, which printed nothing. Worth checking, when a diagnostic is added for a known
red, that it is attached to the thing that goes red.

**What the 2026-09-30 hunt RULED OUT (kept — it is still true, and it is why the 240 trials failed
to reproduce something that reproduces on the first full run):**
- **240 trials of the exact scenario did not reproduce it once** — uniform, jittered between every
  step, and ten with her window's `storage` listener removed entirely.
- **The sibling app's diagnosis does not transfer.** 144 traced an identical-looking flake in ITS
  two-window test to parallel tests sharing one `file://` localStorage and fixed it with
  `workers: 1`; Acorn has `fullyParallel: true` and no worker cap, so this looked certain. It is
  not: measured on this harness, **two workers cannot see each other's `file://` localStorage, and
  neither can two sequential tests in one worker.** I asserted I had found it before running that
  check, and the check disagreed. Inherit a diagnosis only after measuring it here.

`two-windows.spec.js` **instruments every write to storage** (wrapped at
`Storage.prototype.setItem`, not at `__acorn.save` — the app's own code calls the module-scope
`save()` directly, so a hook wrapper misses the write inside `check()`, which is the one the test
is about) and prints both windows' write logs in the failure message. Since 2026-10-22 it also
records the `storage` events each window RECEIVED, with timings, and both sides of the comparison
the merge turns on. That is what made the cause readable in a single red, and it is kept.

**CAPTURE THE SUITE'S OUTPUT TO A FILE, AND RUN IT MORE THAN ONCE.**
`npx playwright test --reporter=list > /tmp/run.txt 2>&1`, then grep the file — never
`| grep | tail`, which truncates the ✘ line and loses the name of what failed. The sibling app spent
a fortnight with a known-but-unidentified intermittent failure for exactly that reason; three
captured runs on 2026-09-02 found it was **two** unrelated flaky tests, both harness defects. A
single green run says less than it looks: **treat any intermittent failure as a defect in the test
until proven otherwise** — every one in this project has been.

**AND NOTE WHAT A `TZ=` RUN CANNOT TELL YOU** (added 2026-10-26, learned on the sibling app the
day before and then measured here). A `TZ=` run only exercises the dates the tests happen to pick,
and this suite picks 22 distinct dates, nearly all of them in June–August. Worse: where a function
reads LOCAL time, a UTC host cannot see the defect at all, because local and UTC are then the same
thing. **Pin `timezoneId` on the Playwright context instead of hoping the run was launched with the
right `TZ`.** `her-day.spec.js` does that, and the measurement is the argument for it — replacing
`iso()` with `d.toISOString().slice(0, 10)`, a tempting one-line tidy, reds those three tests and
**nothing else out of 604**. On her phone in Sydney it would file every practice before 10am under
yesterday: the sitting on the wrong day, `lastSeen` a day out on every word, "finished today"
answering for a day she has not had.

**AND RUN IT IN A TIMEZONE WITH DAYLIGHT SAVING** (added 2026-09-23): `TZ=Australia/Sydney npx
playwright test`. Every run this suite has ever had was under UTC, and the engine measures its
intervals in days across LOCAL midnights — `parseISO` builds local-midnight dates and `dayDiff`
leans on `Math.round` to absorb the 23- and 25-hour days. That reasoning is sound, and it is now
measured rather than only argued: 594 pass under Sydney. Cheap, and it covers a dimension nothing
else did.

**RUN THE SUITE AT A FUTURE DATE NOW AND AGAIN:** `ACORN_DAYS_AHEAD=400 npx playwright test`
(off by default; two minutes). The sibling app in `tables/` had two engine tests seed a fixed
`last` date and read the REAL clock, and because the Leitner intervals are measured in days, what
they were testing drifted a little every day until they went red on 2026-08-23 — a Sunday, on a
build nobody had touched. **A red that arrives on its own, for a reason that is not the app, is the
worst kind:** the obvious fix is to loosen the thresholds, which would have destroyed the test.
Acorn was swept the same week and is clean — 590 pass at +200 days and again at +1100 — but "clean
today" is exactly what the other suite was.

**THE TWO-WINDOW DATA GUARD IS THE MERGE IN `save()`, NOT THE `storage` LISTENER (measured
2026-08-26 for her answers, and again 2026-09-23 for a grown-up's lists).**
Worth knowing before anyone simplifies either. With the `storage` handler stubbed out entirely,
`break.js` §31 — the section built specifically to catch two windows losing her work — **still
passes**. The listener keeps an open window's SCREEN fresh; it is the merge on write that keeps her
data. Do not assume the listener is protecting anything but the view.
**Extended 2026-09-23 to the case that matters most to a grown-up:** a list pasted in one window
while she answers in the other. Ran that scenario 40 times, ten of them with her window's `storage`
listener deliberately removed so it could not hear the paste at all. **Not one lost the list** — the
merge's "if this window has not touched the lists since it read them, storage's copy wins outright"
branch does the work. Worth knowing, because the instinct on reading that listener is that it is
what saves a grown-up's paste, and it is not.

*(Attempted this pass and NOT shipped: an adversarial section for a grown-up restoring a backup in
one window while she is mid-word in another. It passes, but it passes with the merge stubbed AND
with the listener stubbed — the invariant is over-determined and no single-line regression makes it
fail. A test that cannot be made to fail is not a test, so it was dropped rather than left standing
as a reassuring green. If it is ever wanted, it needs a build with the whole write path replaced,
not a one-line injection.)*

**The harness itself can lie, and has.** Two traps caught this way, both worth carrying:
- **A field the hook does not expose reads as `undefined`,** and `undefined === undefined` passes
  whatever the app does. `break.js` §37 was written against `session().traced` before it was
  exposed and held no teeth at all until it was. If an assertion compares a value, prove the value
  is a value.
- **A regression that finishes the thing early can hide itself.** The same section pressed sixty
  wrong keys; on a build that accepted any key that *completed* the copy, and `next()` reset the
  counter to 0 on the way out, so "it did not move" came back 0 === 0 and passed. Measure after
  fewer keys than the word has letters.

Both are why the teeth-check is not optional: inject the regression, watch it fail, revert.

Pacing target: ~80–85% right first go, 70–90% known material. Report the actual numbers when you
tune the engine.

## 6. WHAT TO REVIEW — rotate through these, not just the first one

1. **Visual design.** Typography, colour, spacing, alignment, hierarchy, motion. Everything on
   the three scales (`--t-*`, `--s*`, `--r-*`); nothing off-scale. Contrast is measured, not
   eyeballed — every foreground/background pair clears 4.5:1 (3:1 for large text) on cream AND
   all four tints, light and dark (`tests/contrast.spec.js`; keep it honest). Screenshot the real
   screens in Chromium at 0.9×–1.5× text scale, light and dark, iPhone SE and 13, and LOOK.
2. **The words she sees, and the words a grown-up reads.** Never her own misspelling, never
   "wrong"/"failed", singular/plural agreement, nothing that reads as blame.
   **And the standing sweep (added 2026-09-21, after three consecutive passes found the same
   thing): take each explanatory sentence and ask what makes it true, and what could falsify
   it** — a grown-up setting, the colour scheme, a count of one, the end of a list. Three
   sentences have now been caught this way: "the few" over a single outline, "darken" on the
   screen where learning brightens, and a pace paragraph reciting the defaults of two steppers
   sitting inches below it. Where a sentence states a number the app computes, it must read it
   from the same place the app does. Test the copy against the ENGINE, never against a fixed
   string — a string test only pins today's wording, and all four of these needed to survive a
   rewrite. The sweep was completed on 2026-09-22: the voices paragraph was wrong (it announced
   "Australian first" and recommended Karen on phones with no Australian voice) and is fixed; the
   saved-lists drip hint and the backup summary were both checked and are fine. **The named list is
   exhausted — this is a question to ask of NEW copy, not a backlog to work through.**
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
