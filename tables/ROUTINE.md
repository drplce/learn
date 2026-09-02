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
last-run: 2026-09-02T18:45Z
```

On each firing:

0. **SYNC FIRST — the file you are about to read can be stale.** This session runs in a container
   that is reclaimed and re-provisioned, and a fresh one can come up on an older snapshot of the
   branch. On 2026-08-27 the checkout was three commits behind and this STATE block still read
   `last-run: 2026-08-18`; taken at face value that said 190h had passed and would have sent the
   loop into a full pass redoing work already pushed. **Nothing is lost when this happens** — the
   remote has it — but the gate lies until you fetch. So, before reading anything:

   ```
   git status --short                 # must be clean before the next line
   git fetch origin <branch> && git merge --ff-only origin/<branch>
   ```

   If the working tree is NOT clean, stop and say so rather than merging over it. If `node_modules`
   is missing (a fresh container has none), `npm install` — it is quick, and the browsers are
   already on the image.

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

The same one child as Acorn: **ten** (birthday 5 August), dyslexic, on an iPhone, by touch. **144 is deliberately the
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
  - **The path carries no WORDS** — state is shape and light, and it meanders. Since v1.13 it does
    carry **level numbers** in the negative space beside the meander (David asked twice), and a
    finished level keeps the shape of its kind rather than collapsing into an anonymous bead:
    spark = new facts, hexagon = fill the gap, star = boss, plain bead = mix, breathing cyan ring =
    here, unlit = ahead, gold = done. Wordless does not mean nameless: every node keeps an
    `aria-label`.
  - `ui-rounded` numerals; numbers are the hero content and should always be the brightest thing
    after the action button.
  - Everything starts deliberately under-dressed and unlocks richness with her level, so *the game
    visibly gets better as she does*.
- **THE SLOW LANE (v1.13, David's brief).** *"Possibly look at a slower level type which is focused
  on slow ingestion of question and answer and then we can revert to the faster pace of the other
  levels."* The first time a brand-new fact comes up in a `learn` level it is **shown whole and said
  whole** — `5 × 5 = 25`, "five times five … equals … twenty five" — with no bubbles, no input
  accepted, no timer pressure, and a tap to move on. Then it is asked with the answer taken away.
  - `MEET_MS` 3200 (1200 under reduced motion — **shorter, never skipped**).
  - It fires only for facts she has never met (`!met(k)`), once each, so it never lectures her about
    something she knows.
  - **This is what finally answers the oldest finding on file** — that 144 only ever *tested* a fact
    and never taught one. If you change it, re-read §7 first.
  - Tests that are about something else must seed the level's facts as met (`alreadyMet()` in
    helpers) or they will stall on the slow lane; `answer()` skips it, which is what she does.
- **THE VOICE (v1.12, David's brief).** Every level says the question out loud at the start.
  - **WHOLE PHRASES, never stitched words.** "five times seven" is one recording. A word recorded
    alone carries phrase-final prosody, so stitching gives three separate objects — and the point is
    that she stores the fact as ONE chunk. (Acorn does the opposite deliberately: syllable fragments,
    because there the job is taking a word apart. Do not copy that pattern here.)
  - **Recorded AT the target speed, never sped up afterwards.** Time-stretching preserves pitch but
    scales vowels, consonants and pauses uniformly, which real fast speech does not, and the
    artefacts land in the syllable envelope — the exact cue a dyslexic listener already tracks
    poorly. `SAY_RATE` is a ±15% runtime trim for A/B on her phone, ceiling 1.25; it is not a
    substitute for re-recording. Default 150 wpm ≈ 1s for an average question. The longest
    ("eleven times eleven", 7 syllables) cannot reach 1.2s without ~240 wpm — **aim at the average,
    not the maximum.**
  - **What speaks when (revised v1.13 after David played it):** every level says the QUESTION and
    nothing else. *"Trying to say the full question equals answer is not working — real game play
    doesn't allow it. So scratch that step."* The reply landed on top of the next question. The
    restatement now lives only in **the slow lane** (below), where nothing else is happening.
  - **The fallback voice must never be a joke voice.** iOS ships Bells, Bubbles, Trinoids, Zarvox —
    all tagged `en` — and `getVoices()` is async, so the first call returns a partial list and
    whatever is picked then gets cached before the good voices arrive. That is how the joke voice
    wins, and it bit Acorn first. `NOVELTY` excludes them; the choice is remade whenever the list
    changes. **Warning for whoever tests this next:** the first two tests written for it passed on
    the broken build, protected by the scoring rather than by the filter. Test the case where a joke
    voice is the ONLY option (must yield `null`, i.e. the system default), and the case where a
    worse-but-legitimate voice loads first (must be upgraded).
  - 348 clips: 144 questions, 144 gap forms (**the known factor always first**, whichever side the
    blank is on screen — that halves the recording), 59 answers, and "equals". Recorded by
    `tables/tools/voice.mjs` on David's machine; **the key never enters the repo**. A test checks the
    app's phrase rules and the generator's cannot drift apart.
- **Currency: watts ⚡** — earned on right answers, and they charge the buddy. The charge drains
  across her waking day and **pauses overnight** (07:00–20:00 local is "awake"), so she never wakes
  to a flat buddy she did nothing to cause.
  - **v1.15 (David):** `BATTERY_HOURS` **4**, not 12 — a waking hour costs a quarter of the charge.
    `CHARGE_PER_ANSWER` 1, `CHARGE_PER_LEVEL` 8 (were 2 and 15), so a 12-answer level puts back 20%.
    *"We'll add battery packs as Addons later"* — these three constants are the dial that economy
    gets balanced against, which is why they are named rather than inline. **Consequence to watch:
    she will now meet a flat buddy often.** That must stay peacefully asleep and never a reproach;
    `buddy.spec.js` guards the words.
  - **Watts are not balanced yet** and look inflated (2,606 banked by level ~20, at 1–4 a right
    answer plus 25 a level). Price the add-ons against what she actually has rather than re-rating
    watts underneath her — taking away a number she watched go up is the one move to avoid.
- **The buddy:** a sealed glossy rounded cube, lit from within. At level 1 it has **no face at
  all** — just the glow and a dim filament where eyes will be. It boots up: Lv15 filament,
  Lv30 eyes, Lv45 fully booted. Level-1 customisation is **colour only**; more unlocks later.
- **Structure:** Home is the **path** of stones (an electric circuit she lights up). The **144
  grid** lives in the **power room** behind the buddy — the grid *is* the power she has banked.
- **Two kinds of question, and the difference is the point:**
  - **Blast (bubbles)** carries the volume and the fun. But with four rising answers the wrong
    ones are near-misses she can reason against, so it quietly trains *elimination* — a 25% guess
    is always on the table.
  - **Fill the gap (v1.8, David's brief)** removes the options: it shows the product and hides a
    factor (`8 × ? = 56` / `? × 7 = 56`), so the answer is **always 1–12** and she answers on a pad
    of **the same twelve keys, in the same places, on every question**. That constancy is the whole
    design — a pad carries no information, so there is nothing to eliminate against. It is a
    keyboard, not a multiple choice. **Never shuffle the pad, never hide keys, never grey one out.**
    Ten answers a level, paying **double** (harder ask, and the payout says "this one matters"),
    lime hexagon on the path, and it only ever asks for facts she has **already met** — a missing
    factor she has never seen is counting practice, not recall.
  - **Every set of new facts is followed by a gap level over exactly those facts** (David: *"ensure
    that we're hammering the same numbers as the other level for the day"*). Do not decouple them.
  - Answers 1–12 are also the easiest possible target for speech recognition, which is why voice
    lands here first when it lands.
- **The game:** Blast — answers rise, she taps the right one. Gentle first round (3 tiles, slow),
  ramping every 4 answers within a stone. Distractors are real near-misses (neighbours in the
  table, swapped squares, off-by-one rows), never random noise.
- **The engine:** Leitner boxes 1–7, `BOX_DAYS {1:0,2:1,3:2,4:4,5:8,6:21,7:60}`, `KNOWN_BOX 5`.
  12×12 is 144 cells but **78 facts** — 7×8 and 8×7 share one record and both cells light up
  together (a lesson, not just a saving). Weak-first picking: unseen and missed facts come back,
  owned ones step aside, due beats not-due, never the same fact twice in a row.
- **The ladder now** (v1.8): 72 acquisition levels — 24 learn, 24 fill-the-gap, 12 mix, 12 boss —
  which is ~36 days at two sittings a day, then 300 phase-2 levels (60 of them gaps). 372 total.
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

**⚠⚠ BOTH SIMULATIONS NOW EXIT ZERO. THAT IS NOT THE GOOD NEWS IT LOOKS LIKE — READ THIS
BEFORE QUOTING THEM (v1.20).**
`node tables/tests/sim.js` and `node tables/tests/sim-daily.js` both pass every band and every one
of David's targets. Two rounds of fixes to the *simulation* — not to the app's learning model — got
it there, and both are worth knowing:

- **v1.20:** `__144.reset()` left the faked clock behind, so learners 2–8 stamped their day-0
  records months in the future and looked "never due" all year.
- **2026-08-21:** `sim.js` treated a fill-the-gap answer as no harder than a bubble tap. Every
  answer got the 1-in-3 or 1-in-4 guess floor the bubbles give, when the number line has twelve
  stops and asks the fact backwards ("? × 7 = 56" is a division). Fixed with the stop count read
  off the app (`DIAL_STOPS`) plus a named, arguable `GAP_PENALTY = 0.8` on the retrieval term.
  **Also seeded `Math.random`**, because `pickFact` calls it directly and only the learner's
  answers had been seeded — two runs of an identical model came back 93.2% and 92.8%, which is
  small and is exactly enough wobble to make "did my change do that?" unanswerable. Runs repeat
  exactly now.

**The A/B, everything else held constant** (this is the size of the old optimism):

| | first-go, all | weakest learner | answers/session |
|---|---|---|---|
| gap treated as a bubble tap | 95.1% | 89.5% | 12.5 |
| gap modelled honestly | **93.1%** | **85.6%** | **13.2** |

Note what that does to the old red band: 95.1% sat at the very top of the 70–95% window, and the
breach recorded here for a fortnight was **partly an artefact of the model, not the app**. And note
what it does NOT touch — `known@45` moves 77.9 → 77.8 and `known@142` is still 78/78.

**The saturation it was flagging is completely unchanged.** `sim.js` still ends with *average box
7.0 of 7* and 78/78 known for every learner by day 45. The reason is still that **"known well" is
too cheap**: a miss keeps the question up until it lands, and `record` moves the box on the attempt
that lands, so a presentation is net +1 or 0. Hammer a new fact a dozen times tonight and it is
"known well" tonight, having never once been recalled on a second day. That is a **product decision
about what counts as knowing it** (candidates: promote a box at most once per day per fact; only
promote when the FIRST attempt is right; separate "met" from "retained"), it is David's, and it is
open at the top of §7 with his real data behind it.

**So do not read "health bands all hold" as "the model is fine."** If you want the honest number,
`sim-daily.js` already reports one the boxes cannot flatter: **unaided recall, 69–70/78 at day 142**
(and 53–66 along the way; quoted as a range because it is a stochastic model — three runs on
2026-08-29 gave 70.3 / 70.2 / 70.3, and a single decimal overstates what it knows) against `known` pinned at 78/78 everywhere. That gap between 69 and 78 is
the whole of the open question, stated as a number. Do **not** widen a band, lower a target, or tune
the picker to make any of this look tidier.

**⚠ What `sim.js` does NOT model (v1.8):** it treats a fill-the-gap answer as no harder than a
bubble tap, because the modelled learner has one ability number. A missing-factor question is
plainly harder, so the improvement it reports for the gap levels is the OPTIMISTIC end. Teaching it
a lower first-go rate on `recall` levels is the most valuable next change to it — and do not quote
its gap-level numbers to David without this caveat attached.

**`node tables/tests/sim.js`** — the pacing simulation (BUILT 2026-08-11). 8 modelled learners,
142 days, 2 sessions a day, driving the real picker and the real Leitner boxes. It splits **HEALTH
bands** (code defects — enforced, exits non-zero) from **the PLAN's own targets** (David's claims —
reported loudly, *never* silently relaxed by lowering them). Run it after any change to the engine,
the ladder or the level goals. It is slow (~2 min); that is fine.

*(Both of the original queue items are now done — see `evening.spec.js` and `sound.spec.js` under
"Done, and now guarded". What is left here is what the next pass should reach for.)*

1. ~~`sim-daily.js` has not had the gap treatment.~~ **CLOSED 2026-08-29 — the premise was wrong,
   twice.** (a) `sim-daily.js` simulates David's *proposed* one-fact-a-day scheduler, which has no
   fill-the-gap questions in it at all — every question there is a bubble question, so there is no
   gap difficulty to model. (b) The figure actually quoted from it, unaided recall, comes from
   `recallable()`, which is computed from the learner's memory strength and never touches
   `nOptions` or the guess floor — it is already a production measure and was never inflated by the
   multiple-choice floor. Also measured while checking: its run-to-run spread on that figure is
   **0.1 facts over three runs**, so the file's own "under half a fact" warning is accurate and
   seeding it would be tidying, not fixing. Left alone deliberately.
2. ~~Nothing tests the spoken side against what is on screen.~~ **Done 2026-08-25.**
3. ~~The watts/charge economy has no test at all.~~ **Done 2026-08-25** (`economy.spec.js`).
6. ~~The charge half of the economy is unguarded.~~ **Done 2026-08-27** — see the guarded list.
8. ~~One unidentified full-suite failure, 2026-08-31.~~ **CAUGHT AND FIXED 2026-09-02** — and it
   was **two** flaky tests, not one; see the guarded list. Capturing to a file found both inside
   three runs. **Keep doing that**: run the suite as
   `npx playwright test -c tables/playwright.config.js --reporter=list > /tmp/run.txt 2>&1` and grep
   the file, never through a truncating pipe — a `| grep | tail` is what cost a fortnight here.
9. **`sim.js` is blind to distractor quality.** Its learner model takes a flat `1/nOptions` guess
   floor and never sees WHICH wrong answers are offered, so the 2026-08-31 distractor work moved
   nothing in the simulation (93.1% before and after). That is not evidence the change was harmless —
   it is evidence sim cannot see it. If distractors are ever changed again, do not cite sim.
7. **The trigger's own drift, for David.** The daily trigger fires at a fixed 18:02Z but `last-run`
   is stamped when a pass FINISHES — so a pass that runs past 18:02 pushes the stamp beyond the next
   day's firing and that firing is skipped. Observed on 2026-08-22 and 2026-08-24; 144 is really
   running every other day, and Acorn's weekly slipped a day on 2026-08-25 the same way. **Only
   David changes schedules**, so this is recorded rather than fixed. The fix, when he wants it, is
   to stamp `last-run` at the START of a pass, or give step 3 of the gate a small grace margin
   (e.g. treat ≥ 95% of the interval as due).
4. ~~The slow lane across days.~~ **Done 2026-08-20** — see the guarded list below.
5. ~~The dial, at the sizes her thumb actually is.~~ **Done (v1.21), and it found a real one** —
   see "the way out of the dial" below. The 27.6px stops turned out to be a non-issue (she drags
   and reads the number above her thumb; she never has to hit a stop blind) and the track clears
   the home-indicator inset. What was broken was the escape gesture.

**Done, and now guarded — do not undo these:**
- **⚠ THE SUITE WAS CRYING WOLF TWICE IN THREE RUNS** (2026-09-02). Two independent flaky tests,
  both harness defects, both found by capturing output to a file:
  - `game.spec.js` "on the smallest phone…" missed its threshold by **0.7%** (200.17 vs 198.71).
    Measured rather than widened: bubbles spawn at randomised positions, so the gap runs **133–210**
    across openings against a 199 threshold and then shrinks as they rise, and 30px of climb is not
    enough margin when the spawn gap is 210. It waits for the claim now, with the timeout as the
    failure. **Which branch guards what was checked, not assumed:** the `reduce` pass is the real
    layout guard (nothing moves there, so the spawn band must be right); the wait succeeds
    immediately about half the time and carries no weight, so the moving pass now asserts the one
    thing only it can — the bubbles travel TOWARD her, which sinking bubbles fail and every static
    measurement misses.
  - `twowindows.spec.js` read `localStorage` from window **b** for a write made in window **a**.
    Two Playwright pages share an origin but not necessarily a renderer process, so one page's view
    can lag. Read from the writer. **Fixing it exposed a weaker test underneath:** an assertion for
    the precondition its own NAME claimed found the second window holding **260, not 100** — it had
    never been stale, the `storage` event reaches it and it merges. Renamed to what it does, and the
    genuinely-stale case is the sibling test that writes from inside the page so no event fires.
  **A suite that goes red for reasons that are not the app trains you to ignore reds.** Treat any
  intermittent failure as a defect in the test until proven otherwise; every one here has been.
- **The squares get real near-misses** (v1.25, `tests/game.spec.js`): the wrong answers ARE the
  difficulty on a bubble level, and a number that appears nowhere in the times table can be ruled
  out without knowing the fact. Audited all 78 facts and the **squares were the weak set** — 2.75
  of 4 options were real table products against 3.82 for every other fact, worsening with size:
  12 × 12 offered 156, 132, 146, 142, of which only 132 is a product of anything. Structural cause:
  when `a === b` the four adjacent-multiple candidates collapse onto `p±a`, the pool halves, and the
  `p±2` fallbacks get used. A square now also offers the squares either side of it and its two
  adjacent products, capped at 144 (13² is a number from outside a 12×12 table, which is the same
  fault as `p±2`). Squares now average 3.92; eleven of twelve are 4/4; 7 × 7 offers 36 and 64.
  *Two things checked rather than assumed:* the old test looked at **6 × 7 only**, which is why it
  never saw this; and of the assertions in the new one, the numeric-closeness sweep does **not**
  catch the original defect (146 is two away from 144, so it passes) — the neighbouring-square rule
  is what fails on the old build. Both are noted in the test itself.
- **The battery sleeps when she does** (2026-08-27, `tests/economy.spec.js`): the reason
  `wakingHoursBetween` exists, and nothing had ever tested it. A full charge is gone in four WAKING
  hours, so if the night counted the buddy would be flat before breakfast **every day of the year** —
  she would never once open the app to something awake, and "flat" would stop meaning "it has been a
  while" and start meaning "it is always like this", which is the manipulation §3 forbids. Guarded
  end to end (7pm full → 8am next day still ~50%) and at the arithmetic. *Trap:* a third assertion
  in the same test claimed to check the ceiling by setting `charge = 100` and reading it straight
  back — that tests assignment, not the app, and passed with `Math.min(100, …)` deleted. Dropped;
  `clearcard.spec.js` already covers the ceiling that matters. **One assertion that bites beats two
  that read well.**
- **The voice and the screen agree, every question, not just the first** (v1.24, `tests/voice.spec.js`):
  the older tests compare the spoken phrase to `sitting().cur`, which is the app's own idea of the
  question and so cannot catch the failure that would actually reach her — the SCREEN saying one
  thing while the VOICE says another. These read the numbers off `#prompt` and sweep a whole level.
  Three claims: the bubble question spoken is the one shown; the gap question reads the same gap the
  screen shows and still never says the answer; and **every question gets exactly one utterance —
  none silent, none doubled**. Teeth-checked by swapping the factors, by reading the wrong factor as
  known, and by silencing every third question — which surfaces as the STALE utterance from the
  previous question, which is exactly the confusion it would cause her.
- **The currency cannot punish her** (v1.24, `tests/economy.spec.js`): watts sampled after every
  action across a level full of misses, a dial entry she backs out of, and a reload — the total
  never falls. Plus the two halves of "worth winning": a level she fought through still pays (53–70%
  of a clean one, measured), and a streak pays better than no streak. *Trap:* the fluency claim was
  first asserted as `fought.earned < clean.earned` and **passed with the combo multiplier deleted**,
  because a fought level has more answers in it so the totals never isolate the multiplier. The
  claim is per ANSWER, so it is measured per answer now.
- **⚠ THE CLOCK MUST BE PINNED IN ANY TEST WHOSE FIXTURE SEEDS A DATE** (v1.23, `tests/picker.spec.js`).
  The picker adds +2 to a fact whose gap has reached `BOX_DAYS[box]` — 1, 2, 4, 8, 21 days for boxes
  2 to 6. `picker.spec.js` seeded `last:'2026-08-01'` and did **not** pin `_today`, so as the real
  clock advanced, more of those intervals elapsed, the "due" bonus spread across the whole pool, and
  the box signal the thresholds measure flattened on its own. Two tests went red on 2026-08-23 — the
  day the gap reached 22 days and box 6 became due — with nothing about the app changed.
  **This is the worst failure mode a suite has:** a red arriving on a day nobody is watching, for a
  reason that is not the app, whose obvious "fix" is to loosen the thresholds — which would have
  destroyed the one test that would catch v1.9's argmax picker. Fixed with `PIN_TODAY`/`PIN_SEEN`
  and a `pinned()` helper that fails loudly if the pin ever comes off. Swept the rest of the suite:
  `slowlane`, `week` and `robust` already pin; `diagnostics` seeds dates the digest never reads
  relative to today. **If you add a fixture with a `last:` date, pin the clock.**
- **Every number in the export agrees with its noun** (v1.23, `tests/diagnostics.spec.js`): a
  `plural()` helper at all five count-meets-noun sites, and a sweep over two one-of-everything
  states (a single right answer, and a single miss — one brings up "how long she takes", the other
  "missed most — recently"). Five real slips: `1 days playing`, `LAST 1 DAYS`, `last 1 answers`,
  `last 1 right answers`, `1 right answers logged today`. *Trap:* the first version of the sweep used
  `1 [a-z]+s` on the right-answer state alone and **passed with three of the five slips reinstated**
  — it could not see a multi-word noun or an upper-case heading, and never reached the RECENTLY
  section at all. Teeth-checked against each of the five separately, which is the only reason that
  was found. Her own screens were checked too and are clean: the counts there are bare numbers under
  fixed labels.
- **The round colour wipes, and never splits the bubbles** (v1.22, `tests/game.spec.js`): `--rc` is
  a registered `@property` colour now, so the hue tweens across the whole stage instead of snapping
  on one frame (§6a item 4). The test is not really about the wipe — it is about the house rule
  underneath it: colour may **never** distinguish one answer from another, and a tween is exactly
  where that could break. It samples six frames mid-flight and asserts every ring is the same
  colour at every instant. On an iOS too old for `@property` it snaps as it always did.
- **The slow lane follows her record, days later** (2026-08-20, `tests/slowlane.spec.js`): a fact she has
  started losing is taught again even though she met it weeks ago; a fact she has pulled back is let
  go of; and a week where EVERY fact is tricky still yields two teaching moments, not one per fact.
  *Two traps caught here, both the same shape — a test that names one thing and measures another:*
  the "pulled back" case first used a fact with 4 misses in 24, and passed with the box check
  deleted, because the low rate was carrying it (it now uses 4 in 10, above the 0.34 line, so only
  the box can); and the "started losing" case read `meeting` once right after the level opened,
  which quietly depended on the picker drawing that fact FIRST — about two chances in five. It
  passed four runs then failed in the full suite. It now plays forward and waits for the fact to be
  taught, which is what the claim always was.
- **The way out of the dial is somewhere her thumb can reach** (v1.21, `tests/recall.spec.js`):
  backing out of a gap answer meant dragging 64px BELOW the track, and the track ends 38px above
  the edge of an iPhone SE and 45px above a 13 — so the threshold sat at y=693 on a 667px screen.
  **The escape hatch was unreachable on both phones she might hold**: a thumb put down by accident,
  or a freeze on a fact she does not know, had no way out but to enter a number and lose the streak.
  Cancel is now "off the line in either direction" — up, where the room is, at 56px, and down at
  whatever the phone actually leaves. *Trap this caught:* the old test dragged to 120px below the
  track and asserted the cancel state engaged. It did — at a coordinate off the bottom of the glass.
  **Playwright will move the mouse outside the viewport without complaint**, so a gesture test is
  worth nothing unless it asserts its own targets are on screen. The new tests clamp and assert.
- **The picker tests are seeded, not sampled** (v1.21): `week.spec.js` drew 600 times from
  `Math.random` and compared counts, and the comparison it needed sat **1.77 standard deviations**
  clear of the noise — a ~4% chance of a red per full run, which duly happened on 2026-08-18 and
  passed on the re-run. **A red that goes away is worse than no test**: it teaches you to ignore
  reds. `draws()` now installs a seeded PRNG and samples 4000. If you add a test that counts random
  draws, do the arithmetic on its margin before you commit it.
- **A week, not an evening** (v1.20, `tests/week.spec.js`): the first tests in the suite where a
  DATE changes. `BOX_DAYS` is written in days and until now every test ran inside one day, so the
  intervals were never exercised at all. Now: a fact parked in box 6 is nearly invisible the next
  day and back in circulation 25 days later; the fact she keeps missing is the one asked most, three
  days running; three levels on Tuesday and two on Wednesday is two days and two sittings, not five
  of either; a week away costs the charge and nothing else, with no reproach on the screen when she
  comes back. *Trap this caught:* the miss-rate test first passed with the picker's miss-rate term
  deleted — the *box* term was carrying it, because the weak fact had a lower box too. All four
  facts now sit in the same box so only her record can separate them. **When a picker test seeds
  two signals, it is testing the stronger one.**
- **A reset puts the clock back too** (v1.20): `__144.reset()` now clears `_today`. It used to leave
  the faked date behind, which silently poisoned any simulation running several learners in one page
  — learner 2 onwards stamped day-0 records months in the future, so everything it learned looked
  "not due yet" for the rest of the run. This is why both simulations' per-learner spreads are only
  trustworthy from v1.20 on.
- **The export does not contradict itself about days** (v1.20): `prog.days` only moves when she
  CLEARS a level, so an evening she spent answering and then put down mid-level did not exist as far
  as the headline was concerned, while `LAST N DAYS` listed it four lines below. The headline now
  takes the larger of `prog.days` and the diary's row count (the diary is exact for what it covers;
  `prog.days` reaches back before the diary existed, so the larger understates neither) and says
  which it means in NOTES. It also said "1 days playing" — that is fixed too.
- **A whole evening in one sitting** (v1.19, `tests/evening.spec.js`): six levels back to back with
  no reload — the path really moves six, a level only ever asks its OWN facts, the streak does not
  survive a level boundary, the DOM does not grow across the sitting, and the evening is one day in
  the diary. Her diagnostics say she plays ~19 levels a sitting; before this every spec played one
  and reloaded. *Trap this caught:* `__144.answer()` used to return `true` on a gap level even when
  `W.cur.done` made it a no-op, so a test loop counted twice the answers the app had judged — and
  the natural conclusion was "the diary is dropping answers". The hook now returns whether an answer
  was actually SCORED. **A test hook that overstates what happened is worse than no hook.**
- **Mute means mute** (v1.19, `tests/sound.spec.js`): a whole level played muted, counted at the
  browser boundary — `createOscillator`, `HTMLMediaElement.play`, `speechSynthesis.speak` — so a
  future sound that bypasses `tone()` is caught rather than trusted. The same page then plays the
  same level unmuted as its own control, so it can never pass because the counter was not wired.
  The ONE allowed `play()` with sound off is the iOS gesture unlock, which is `muted` with no `src`;
  the test asserts that rather than waving the count through.
- **The charge line is a surface, not a bar** (v1.19, `tests/buddy.spec.js`): the crest at the top of
  the fill used to be a near-white band running wider than the shell itself, and at ~60% charge it
  lands level with the eyes — the buddy looked like it had a rule struck through its face. It now
  fades at both ends, is tinted toward the shell rather than white, and is dimmer than the eyes; the
  fill body's own top edge ramps up over its first 7% instead of starting at full strength. The
  level is still plainly readable at 20% and at 88% — that was checked by looking, not assumed.
- **The diary and the diagnostics export** (v1.17, `tests/diagnostics.spec.js`): a per-day rollup and
  a rolling 400-answer window with per-answer latency, plus "copy diagnostics" at the foot of the
  power room. Rules that must hold: **bounded on the way in** (180 days / 400 answers — a corrupt or
  enormous log must never slow her phone), **minutes played ignore gaps over a minute** (otherwise it
  measures time since she opened it), and **nothing identifying goes in the export** — not her name,
  which is nowhere in the app, and not the buddy's, which stays on the device. The digest also states
  its own blind spot in the NOTES section; keep that honest as the engine changes.
- **The charge is a LEVEL, not a pulse** (v1.16, `tests/buddy.spec.js`): the light fills the glass in
  proportion to `power.charge`, translucent (opaque = the pale plastic blob v1.5 removed), with the
  eyes painted after it so a full battery cannot blind the face, and an ember behind it so flat reads
  as asleep rather than broken. Works at 52px, which is the size that matters. *Trap:* the first
  version of the face test passed with the z-index removed — DOM order was doing the work — so it
  now asserts paint order and translucency, the two things that actually hold it up.
- **The buddy settles when it wakes** (v1.15, `tests/buddy.spec.js`): at stage 2 (eyes, level 30)
  the colour and the name are fixed. `locked()` is enforced in the click and naming handlers, not
  just by a `disabled` attribute. **She is warned before it happens** — "it locks in when it wakes
  up" — because losing a choice she did not know was closing is exactly the small heartbreak this
  app does not hand out. The copy after the lock must never read as a refusal.
- **The current node is the only way into a level** (v1.15): the big Play button is gone. The node
  carries a gold arc for a part-finished level and the margin number says which level. **The node's
  breath is in the LIGHT, never a transform** — it used to scale, which makes a tap target that
  moves under a finger, and no automated tap can hit it ("element is not stable" — the suite went
  from 2 minutes to over 10 the day the button was removed). One `--pulse` colour per level type.
- **The clear card has exactly one button, "OK", and it returns to the path** (v1.15).
- **The slow lane and reading the path** (v1.13, `tests/slowlane.spec.js`): a brand-new fact is shown
  before it is asked and nothing she taps during it can score; a finished level keeps the SHAPE of
  its kind (they were all collapsing into one gold bead, so a month of path told her nothing); the
  level numbers live in the negative space beside the meander and must never be drawn over a node.
  **The wordless-path rule from v1.1 is deliberately reversed for numbers** — David asked twice. Words
  are still out, and `game.spec.js` enforces exactly that: digits yes, letters no.
- **The voice** (v1.12, `tests/voice.spec.js`): a question is spoken as ONE phrase; a gap question
  never contains its own answer; mute means silent; answering stops it mid-word (the interrupt test
  runs on a BOSS level on purpose — anywhere else the reply's own `cancel()` masks a missing
  interrupt and the test passes for the wrong reason); it all works with **no recordings at all**,
  which is the state it ships in.
- **She plays in BURSTS** (v1.11, `tests/progress.spec.js`). This is the most important thing on this
  list about how she actually uses it. A level used to restart from zero whenever she left it, so a
  12-answer mix or a 15-answer boss could never be finished in the six-answer sittings she really
  does — she had 983 watts banked against 14 levels cleared. `S.sit` now remembers the part-finished
  level and `start()` resumes it, keyed to what the level IS (`sitKey`: kind + table + fact count),
  not merely its index, because the ladder has already been renumbered under her once (v1.8). A
  stored count is clamped below the goal so corrupt storage can never finish a level for her; the
  further-along sitting wins a merge; the combo is deliberately NOT restored.
  **If you ever change level goals or the ladder's shape, re-read this first.**
- **The path has to visibly grow** (v1.11): it drew only three finished nodes above the current one,
  so the level she was on sat fourth from the top every session and David reported it as "stuck as
  level 4" while on level 15. It now draws the whole lit chain (40 back, 8 ahead). The path stays
  wordless — the LEVEL NUMBER lives on the Play button instead, with how much of the level is done.
- **What she actually gets asked** (v1.10, `tests/picker.spec.js`): `pickFact` must be a weighted
  choice, never an argmax. It was scoring every fact and taking the single highest, with
  `f.wrong` (a lifetime tally, no ceiling) multiplied by 2.4 — so over a realistic 78-fact pool it
  returned **five** distinct facts in a thousand picks and never asked the other **seventy-three**,
  all year, invisibly. Weak-first is a BIAS, NOT A MONOPOLY: every fact keeps a floor of 1, a miss
  *rate* and a low box raise the odds, unmet facts are heavily favoured, and no fact repeats
  back-to-back. If a future change makes the picker sharper, check the spread before shipping — the
  tests carry the measured ratios and the thresholds sit clear of them on purpose.
- **Fill the gap** (v1.8, `tests/recall.spec.js`): the pad is constant, a gap level drills the same
  facts as the learn level before it, both sides of the gap get asked, a right key pays double, a
  wrong key costs nothing and leaves the question up, unmet facts are never asked, the pad goes away
  when the clear card comes up (it has a higher z-index than `#field`, so it would paint over it),
  and on a 375px screen the sum sits just above the pad rather than at the top of the phone.
  Scoring for every input goes through one `score()` function — bubbles, pad, and voice later —
  so the reward, the Leitner move and the words she reads cannot drift apart per input.
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
  1. ~~The power room's three stat tiles are flat dark rectangles.~~ **Done (v1.20):** each tile now
     takes its own number's colour (`--sc`) for a thin rim and a bloom rising from its base — three
     lit panels instead of three grey slabs. Uses `:has()`; on an iOS too old for it all three rims
     fall back to neutral, which is a graceful loss rather than a broken screen.
  2. The level-clear moment could be a proper stage flare rather than a card. *(v1.19 added the
     stage light behind it; a real flare — rays, a burst, the number counting up — is still the
     bigger idea and is a PROPOSAL, not a licence: it changes the look enough to need David.)*
  3. The number type could be more of a hero (weight, spacing, a subtle stage shadow).
  4. ~~Round-to-round transitions: the hue currently snaps.~~ **Done (v1.22)** — `--rc` is a
     registered `@property`, so it tweens over `--m-quick` (briefer than the gap between questions,
     deliberately). Reduced motion already forces every transition to ~0ms, so it snaps there.
  5. ~~The space between the prompt and the rising bubbles is bare.~~ **CLOSED 2026-09-02, decided
     against.** It has sat on this list since v1.4 and been passed over every time, so here is the
     reasoning rather than a fourth deferral. Looking at the actual screen: that dark band is what
     the lit rings pop against, and the ground already carries three blooms (two stage lights from
     the top corners plus one rising from the bottom at 108%). The two ideas on offer both cost more
     than they give — **drifting sparks put MOTION in the field she is tracking rising targets
     through**, which is the one place this app must not add competing movement; and a brighter
     floor spends the contrast the bubbles rely on. §6a's own rule settles it: *legibility always
     wins a fight with atmosphere.* Reopen only if David says the play field looks empty to him.)*
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
- **⚠ THE UNLOCK LADDER HAS RUN OUT, AND SHE IS PAST THE END OF IT (measured 2026-08-20).**
  The house style promises *"everything starts deliberately under-dressed and unlocks richness with
  her level, so the game visibly gets better as she does."* Audited every read of her level in the
  source: `buddyStage()` is the **only** level gate in the whole app, and it fires at **15, 30 and
  45**. Everything else that reads `prog.cleared` either displays it or indexes the ladder. She was
  at level 50 on 2026-08-14, so **she has already collected every unlock 144 has**, and levels 46 to
  372 — 327 of them, the whole rest of the year — hold nothing new. The path still changes shape by
  level *kind*, and the round colour and speed still climb *within* a level, but nothing arrives any
  more. This is the promise going quiet exactly when the novelty of a new app wears off, which is
  the worst possible timing. **Not mine to fix** — what unlocks and when is a design decision, and
  §6's "is the ladder now a bluff?" is answered: yes, from 46 on. Candidates for him, none chosen:
  a fourth buddy stage; accessories (the daily-accessory idea he floated on 2026-08-11 and never
  closed); new level kinds in phase 2; the battery packs below as the first thing watts buy.
- **⚠ WATTS HAVE NO SINK — 25,000 of them by December (measured 2026-08-20).**
  `addWatts` is the only function that touches the total and it only ever adds; nothing in the app
  spends a watt. Measured by playing 14 real levels end to end: **67.5 watts a level on average**
  (learn 47, mix 69, recall 85, boss 90), which projects to **~25,100 by the end of the 372-level
  ladder**. She had 2,370 at level 50. §6's economy warning — *"a reward that stops meaning
  anything"* — is now literal: the number on her HUD is a score that only climbs and buys nothing.
  David already named the intended sink on 2026-08-13 (*"We'll add battery packs as Addons later"*)
  and asked what they should cost. **The number he needs is above**: price against ~67 watts a
  level and ~25k over the year, so a pack at 250–500 watts is "a few levels' work" and one at 2,000+
  is a week's. Nothing built, nothing priced — his call.

- **HOW THIS GETS ANSWERED — David's call, 2026-08-13, and it changes the shape of the question.**
  He is not looking for the box rule to be fixed now: *"we could introduce further levels of
  knowledge beyond known in the future, treat the first run as familiarisation, gameplay and
  routine… at the end of the day I just want her to improve."* So the first run through the ladder is
  **familiarisation** and the tiers above "known" come later. Do not quietly tighten the boxes in the
  meantime — the plan is to build the better measure, not to shrink the number she watches.
  **The measure those tiers need is now being collected** (v1.17): how long she takes to answer.
  Under ~2.5s reads as retrieval; six seconds is her working it out. When the tiers arrive, "fluent"
  should mean *right AND fast on a later day* — which is a thing the app can now see and the Leitner
  box never could.
- **⚠ SHE IS PLAYING ~20× FASTER THAN THE PLAN ASSUMES, AND THE BOXES CANNOT TELL (2026-08-13).**
  David: *"She's already at level 40 I think"* — two days in, against a ladder built for two levels
  a day. Measured directly: **eight right answers in one sitting take a fact from box 1 to box 7**,
  the top box, nominally a 60-day interval, without a single night in between. `BOX_DAYS` is written
  in DAYS and nothing enforces days, so at her pace the spacing schedule is bypassed entirely and
  she is doing massed practice while the app records durable mastery. This is the saturation
  question below, no longer hypothetical.
  **The one-line fix is to let a fact's box rise at most once per day**, which changes nothing about
  how much she may play and everything about what the number means. It is David's call because the
  "of 144 known" figure on her power room screen would climb more slowly — raised 2026-08-13, not
  shipped.
  **CONFIRMED ON HER REAL DATA, 2026-08-14.** His pasted digest: `7×9   32 missed of 59   box 7`.
  Reproduced in the app — the box steps down one on a miss and up one on a right, so it only ever
  remembers the recent run, and a bad session followed by ~7 clean answers lands in the top box with
  a 54% lifetime miss rate. This is no longer a projection from `sim.js`; it is on her phone. The
  digest now *says so* (v1.18, WORTH A LOOK) rather than printing the box and letting it stand, but
  the rule itself is untouched and still David's to call.
- **⚠ WHAT COUNTS AS KNOWING IT (new, 2026-08-12, and now the only thing in the way).** With the
  picker repaired (v1.10) and fill-the-gap shipped (v1.8), every one of the plan's targets passes in
  simulation — 78/78 by day 45. That is not the good news it looks like: the model saturates because
  a fact can reach "known well" inside one sitting. `record` moves the box on the attempt that
  lands, and a miss simply keeps the question up until it does, so twelve reps tonight can carry a
  brand-new fact to box 7 tonight without it ever being recalled on a second day. Nothing measures
  whether she still has it tomorrow. Candidates, none of them mine to pick: promote a box at most
  once per day per fact; only promote when the FIRST attempt is right; or keep the boxes and add a
  separate "retained" measure (recalled cleanly on a later day) as the real scoreboard. This is also
  why a health band in `sim.js` is red — see §5.
- **(CLOSED 2026-08-12) The plan's targets were not being met, and the cause was a code defect after
  all, not a product decision:** the picker was asking five facts and ignoring seventy-three (§5).
  The old diagnosis on file — that 144 only ever *tests* a fact and never *teaches* one — was
  half right, and David's fill-the-gap level answered that half. Kept here because the reasoning
  matters: the finding was raised for David rather than fixed unilaterally, and the fix turned out
  to be five lines of arithmetic underneath it.
- **~~THE PLAN'S TARGETS ARE NOT MET~~ (superseded, see above).** `sim.js` says
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

- **2026-09-02, 18:02–18:50Z (cron pass, due at 47.2h):** **the suite was crying wolf twice in
  three runs.** Queue item 8 had one lost failure from 2026-08-31; capturing to a file caught it
  twice over — **two** unrelated flaky tests, both harness defects, now fixed and teeth-checked
  four ways. One of them was hiding a weaker test than its name: `twowindows`' "a window left open"
  has never had a stale window in it. Also closed §6a item 5 (the bare band beside the prompt)
  **against**, with the reasoning, rather than deferring it a fourth time — sparks would put motion
  into the field she tracks rising targets through, and a brighter floor spends the contrast the
  bubbles rely on. 153 pass, three consecutive clean runs after the fixes. sim green.
  Acorn untouched. **Still waiting on David: the box rule, the ladder, and the watt sink (all §7).**
- **2026-08-31, 18:02–18:55Z (cron pass, due at 47.7h):** **v1.25 — the squares were offering
  answers she could rule out without knowing them.** §6 item 3 asks whether the distractors stay
  plausible at the top of the table. For 11 × 12 they do (it offers 121 and 144, exactly David's
  brief). For the SQUARES they did not, and the old test could not have seen it because it checked
  one fact. Measured across all 78, fixed, re-measured. Also found and recorded two limits rather
  than papering over them: `sim.js` cannot see distractor quality at all (queue item 9), so its
  unchanged 93.1% is not a validation; and **one full-suite failure went unidentified** because I
  piped the output through `grep | tail` and cut the line — four later runs were green, and the
  practice of capturing to a file is now written into queue item 8. 1 test rewritten from 1 fact to
  78, teeth-checked. 153 pass, four times. sim green. Acorn untouched.
  **Still waiting on David: the box rule, the ladder, and the watt sink (all §7).**
- **2026-08-29, 18:02–18:35Z (cron pass, due at 47.7h):** **a queue item closed for being wrong, and
  a visual look that found nothing.** The last substantive §5 item was "give `sim-daily.js` the gap
  treatment" — and reading it properly, the premise was wrong twice over: that file simulates a
  scheduler with no gap questions in it, and the figure quoted from it never went through the guess
  floor anyway. Closed with the reasoning rather than executed, and its run-to-run spread measured
  (0.1 facts) so the decision not to seed it is on the record. Softened the §5 quote of that figure
  from `69.3` to `69–70`, because a single decimal overstates a stochastic model and David reads it.
  Then §6's game-feel rotation: shot the play field across four rounds at 375px. Nothing wrong —
  the prompt is the hero, the targets are generous, the hue wipe reads. **One thing that looked
  like a defect was my own fixture:** the HUD buddy appeared to follow the round colour, because
  `applyShell()` runs in `renderPower()` and at boot but not in the general `render()`, so a fixture
  that sets the shell afterwards never applies it. Checked before concluding — `--shell` holds
  violet across all three rounds while `--rc` rotates. 153 pass. Acorn untouched.
  **Still waiting on David: the box rule, the ladder, and the watt sink (all §7).**
- **2026-08-27, 18:02–18:20Z (cron pass, due at 47.6h):** **the gate can be lied to, and the battery
  sleeps when she does.** The container had been reclaimed and came up on a snapshot three commits
  old, with `node_modules` gone: this file still read `last-run: 2026-08-18`, which at face value
  said 190h and would have sent the loop into a full pass redoing work already pushed. Nothing was
  lost — the remote had it — but **the gate lies until you fetch**, so step 0 now says to sync first
  and how. Then §5 item 6: the charge half of the economy, which is the half she actually feels.
  A trap in my own test caught by teeth-checking: an assertion that set `charge = 100` and read it
  back, which tests assignment rather than the app. 3 tests, 3 teeth-checks, 153 pass, sim green.
  Acorn untouched. **Still waiting on David: the box rule, the ladder, and the watt sink (all §7).**
- **2026-08-25, 18:04–18:40Z (cron pass, due at 47.6h):** **v1.24 — what she hears against what she
  sees, and a currency that cannot punish her.** Cleared two more §5 queue items. The voice tests
  all compared speech to the app's own state and only ever looked at the opening question of a
  level; these read the numbers off the DOM and sweep the whole level, which is the only way to
  catch the screen and the voice disagreeing. The economy had no test at all despite the hand
  measurement in §7 being the number David needs for battery-pack pricing. Two traps, both the same
  shape as ever — an assertion that cannot see the thing it names: the fluency claim passed with the
  combo multiplier deleted (totals do not isolate a per-answer effect), and the earlier plural sweep
  taught the same lesson two days ago. Also recorded the trigger drift for David (queue item 7) —
  144 is really running every other day. 6 tests added, 5 teeth-checks, 150 pass, sim green.
  Acorn untouched. **Still waiting on David: the box rule, the ladder, and the watt sink (all §7).**
- **2026-08-23, 18:03–18:30Z (cron pass, due at 47.7h):** **v1.23 — a suite that was rotting on the
  calendar, and five numbers that could not count to one.** The harness opened red on two picker
  tests that had passed for a fortnight: they seeded `last:'2026-08-01'` and never pinned the clock,
  so 2026-08-23 was simply the day the gap crossed box 6's 21-day interval and the box signal they
  measure flattened. Nothing about the app had changed. Pinned, with a helper that fails loudly if
  the pin comes off, and the rest of the suite swept for the same trap. Then §6's "the words she
  reads": her screens are clean, but the export had **five** plural slips, only one of which had
  been found before (by eye, six days ago). Routed every count through a `plural()` helper and swept
  it — and the sweep's first version passed with three of the five reinstated, because it could not
  see a multi-word noun or an upper-case heading. Teeth-checking each slip separately is the only
  reason that came out. Also repopulated the §5 queue, which was empty. 2 tests reworked, 1 added,
  6 teeth-checks, 144 pass, sim green. Acorn untouched.
  **Still waiting on David: the box rule, the ladder, and the watt sink (all §7).**
- **2026-08-21, 18:04–18:25Z (cron pass, due at 24.3h):** **v1.22 — the simulation stops flattering
  the gap levels, and the hue stops snapping.** Cleared the last item on the §5 queue: `sim.js`
  gave every answer the bubbles' 1-in-3 guess floor, including on the number line, which has twelve
  stops and asks the fact backwards. Fixed, with the stop count read off the app so the model cannot
  drift from it, and a named `GAP_PENALTY` so the assumption can be argued with rather than buried.
  On the way in, found that `sim.js` was **never reproducible** — `pickFact` calls `Math.random`
  directly and only the learner's answers were seeded, so two runs of the same model differed by
  0.4 points; seeded now, and the A/B above is clean as a result. The old model overstated first-go
  by 2.0 points overall and 3.9 for the weakest learner, and the red band recorded here for a
  fortnight was partly its fault. Visual: `--rc` is a registered colour, so the round hue wipes
  instead of snapping — with the test aimed at the house rule underneath it rather than the pretty
  part. 1 test, teeth-checked, 143 pass. Acorn untouched.
  **Still waiting on David: the box rule, the ladder, and the watt sink (all §7).**
- **2026-08-20, 17:10–17:50Z (cron pass, due at 45.5h):** **the slow lane over a week, and two findings
  that are David's.** No `VERSION` bump: nothing in this pass is visible to her (§7's rule). Rotated to the two §6 items recent passes had skipped: the economy
  and the unlock ladder. Both turned up something, and both are written up at the top of §7 with
  numbers rather than impressions — **`buddyStage()` is the only level gate in the app and it ends at
  45, so levels 46–372 hold nothing new**, and **watts have no sink at all: 67.5 a level measured
  over 14 real levels, ~25,100 by December**. Neither is mine to fix; the watt figure is the one he
  asked for to price battery packs. Then the harness item I could act on: `tricky()` had only ever
  been tested inside a single sitting, so three tests now drive it across days. Both of the traps
  they caught were the same shape — a test that names one thing and measures another — and one of
  them was a 2-in-5 draw-order dependency that passed four runs before failing in the full suite.
  3 tests, all teeth-checked, 142 pass over two clean full runs. Acorn untouched.
  **Still waiting on David: the box rule, the ladder, and the watt sink (all §7).**
- **2026-08-18, 19:10–19:45Z (cron pass, due at 24.8h):** **v1.21 — she could not back out of the
  number line.** The suite opened red on a test written the day before, so the first job was that:
  not a re-run until green, but the arithmetic — 1.77σ of margin on a 600-draw sample, ~4% failure
  per run, my own construction. Seeded and widened to 4000. Then the queue item that said "worth a
  look": the dial at 375px. The stops and the home-indicator clearance were both fine; **the escape
  gesture was not.** Backing out required dragging 64px below a track that ends 38px above the edge
  of an SE — off the glass on both phone sizes, so a thumb put down by accident had no way out but
  to enter a number and lose the streak. The test that should have caught it dragged to a point past
  the bottom of the screen and passed for a year. Cancel now works upward, where the room is.
  4 tests reworked or added, all teeth-checked, 139 pass, two clean full runs. Acorn untouched.
  **Still waiting on David: the box rule (§7).**
- **2026-08-17, 18:02–18:25Z (cron pass, due at 47.4h):** **v1.20 — the first tests where a date
  changes, and the number the export was contradicting itself about.** `BOX_DAYS` is written in days
  and every test in the suite ran inside a single day, so the Leitner intervals — the engine's whole
  reason to exist — had never been exercised. `week.spec.js` fixes that. Fixed the `reset()` clock
  bug that had been on this list since v1.10, which unblocked both simulations' per-learner spreads;
  **both now exit zero, and §5 explains at length why that is not the good news it looks like** —
  the saturation is unchanged, average box still 7.0 of 7, and `sim-daily.js`'s unaided-recall
  measure (69.3/78 at day 142 against `known` pinned at 78/78) is the honest version of the same
  gap. Found and fixed a real inconsistency in the export: the headline said "1 days playing" — both
  the plural and the count wrong, because `prog.days` only moves when she clears a level, while the
  diary four lines below listed the evening she stopped mid-level. Visual: the power room's three
  stat tiles now wear their own number's colour. 6 tests, 6 teeth-checked, 138 pass. Acorn untouched.
  **Still waiting on David: the box rule (§7).**
- **2026-08-15, 18:02–18:40Z (cron pass, due at 42.9h):** **v1.19 — the sitting she actually plays,
  and the bar across the buddy's face.** Cleared BOTH standing items from the §5 queue rather than
  adding features: `evening.spec.js` (six levels back to back, no reload) and `sound.spec.js` (mute
  counted at the browser boundary, with an unmuted control in the same page). The evening tests
  immediately found that `__144.answer()` reported success on gap levels when nothing had been
  scored — 56 answers driven, 36 judged — which would have read as the diary losing her work; the
  hook is honest now. Then the visual job, by looking at her real screens: the charge crest was a
  near-white band wider than the shell, and at ~60% it sits exactly at eye level, so the buddy
  appeared to have a line struck through its face. Softened to a fading, shell-tinted meniscus,
  checked at four charges. The level-clear card — the one screen with no stage light on it — now
  blooms in the colour of the round she just finished. 8 tests, 6 teeth-checked, 132 pass.
  Acorn untouched. **Still waiting on David: the box rule (§7), which this pass did not touch.**
- **2026-08-14, early (David, live):** **v1.18 — the export stops repeating a number it cannot
  stand behind.** He pasted the real digest off her phone and the standout line was `7×9   32 missed
  of 59   box 7`: the worst record of any fact, sitting in the top box. Reproduced it exactly in the
  app (32 misses then 27 rights → box 7, 54% lifetime miss rate; and 7 clean answers from nothing →
  box 7 too), so the line is not a bug in the digest, it is the box rule showing through. The digest
  now splits **ALL TIME** from **RECENTLY** (the last 400 answers, which is the only honest "what is
  she missing *now*") and adds **WORTH A LOOK** for facts the app calls known while she misses ≥30%
  of them, with the reason stated on screen. The all-time list also carries the caveat that big
  attempt counts predate the picker fix. Note her 59 attempts on one fact are almost certainly
  residue of the pre-v1.10 argmax picker. 2 tests, both teeth-checked, 123 pass.
- **2026-08-13, night (David, live):** **v1.17 — the diary.** He asked for an export he could paste
  back into the chat: days, minutes, time between answers, misses. Built, with per-answer latency as
  the headline, because that is the measure the "levels beyond known" he wants later will be built
  from. He also settled the box question for now: the first run is **familiarisation**, extra tiers
  come later, do not tighten the boxes underneath her. 10 tests, 4 teeth-checked, 121 pass.
- **2026-08-13, evening (David, live):** **v1.16** — the charge indicator he picked, wired in at both
  sizes. Then a refinement pass driven at HER ACTUAL STATE (level 40, buddy awake and locked, violet,
  named): path, play, clear card and power room shot at both phone sizes, no errors, everything
  reads. The pass's real finding is the pacing one now at the top of §7 — she is ~20× ahead of the
  plan and eight answers in one sitting take a fact to box 7. 111 pass, sim green.
- **2026-08-13, later (David, live):** **v1.14 + v1.15.** The slow lane now stops only for facts she
  is stuck on (plus one new fact a level, max two) instead of every new one. The big Play button is
  gone — which exposed that the current node breathed by *scaling* and so could not reliably be
  tapped. The buddy's colour and name settle when it wakes, warned in advance. Battery down to four
  hours with a smaller top-up, ahead of add-on battery packs. Clear card down to one button, "OK",
  which returns to the path. Plus `tables/mock-charge.html`: five charge-indicator ideas to pick
  from, not wired in. 9 new tests, 6 teeth-checked, 106 pass.
- **2026-08-13 (David, live, after playing it):** **v1.13.** The fallback voice was landing on iOS's
  joke voices (same bug Acorn had) — fixed and guarded, after two of my own tests passed on the
  broken build for the wrong reason. The spoken restatement is **out of gameplay** and into a new
  **slow lane**: a brand-new fact is shown and said whole before it is ever asked, which is the
  teaching step the simulation has been asking for since day one. The path now keeps each finished
  level's shape and carries level numbers in the margin. 12 tests, 6 teeth-checked, 97 pass, and
  `sim.js` came back green on every band — **which does not mean the saturation question in §7 is
  answered; it is still open.**
- **2026-08-12, late (David, live):** **v1.12, the voice.** Every level now says the question aloud,
  whole-phrase, with the restatement on the teaching levels. Built the layer and the recording
  pipeline; the 348 files themselves need David's machine and his key. His question — record slow
  and speed up, or record at target? — answered in `tools/voice.mjs`: record at target, and why.
  10 tests, 5 teeth-checked, 85 pass.
- **2026-08-12, evening (David, live — "the path appears to be stuck as level 4"):** he was on level
  15. Two real defects (v1.11): the path only ever drew three beads of history, so his position never
  appeared to move; and **a level restarted from zero every time he left it**, which is why 983 watts
  had bought only 14 cleared levels. Levels now resume, the chain grows, and the Play button names
  the level. Diagnosis worth keeping: his screenshot was matched against rendered states until one
  agreed exactly (cleared=14) — that is how "stuck at 4" turned out to be "always drawn fourth".
  8 tests, 5 teeth-checked. 75 pass.
- **2026-08-12, later (David, live):** **v1.9 the number line** — David replaced the twelve-key pad
  with a bare slider ("loads with nothing showing, touch it and shows what is selected, drag to the
  right spot and then release to enter"), which is the anti-elimination idea taken all the way. Also
  fixed a real Reduce-Motion layout defect the tests exposed (bubbles never rise, so they sat in the
  bottom third). **The suite now runs on one worker** — every `file://` page shares one
  localStorage, so parallel tests were clearing each other's storage and the two-windows
  data-safety test failed about one run in eight looking exactly like a real defect. Then **v1.10
  the picker repair** (see §5): five facts in a thousand picks, seventy-three never asked. 67 tests.
- **2026-08-12, 16:30Z (David, live — the voice brief):** voice mode is **parked** for now. What came
  out of it instead: a diagnostic (`tables/voice-check.html`) run on her real phone, which found that
  iOS streams a number as it hears it ("fifty six" → 50 → 56) and would have scored five right
  answers out of ten as wrong; and then **v1.8, fill the gap** — David's own idea and the best one in
  the brief, because a 1–12 answer space kills elimination without needing a microphone at all. Six
  new tests plus the layout guard; `sim.js` known-well jumps 36 → 57 of 78 (caveat in §5). The voice
  findings worth keeping: continuous recognition survived a whole round from one tap with no
  restarts, `Karen / en-AU` is the voice, and `speechSynthesis` does not reliably fire `onend` on
  iOS — never gate a flow on it.
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
