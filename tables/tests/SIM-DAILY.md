# Does the one-fact-a-day plan work?

**Run it yourself:** `node tables/tests/sim-daily.js` (about 3½ minutes).
Read it next to `node tables/tests/sim.js`, which simulates the ladder that is in the app today.

Both simulations drive the **real** app: the real Leitner boxes, the real `record`, the real
`pickFact`, the real clock, inside the real page. Neither reimplements the engine. What this new file
adds is a different **scheduler** — one new fact a day, hammered, with old facts woven in — because
the ladder in the app cannot express that.

---

## The short answer

**The daily-target plan is not what decides this, and neither is the dose. Who picks the review
questions decides it.**

At your nominal dose — 12 goes at today's new fact plus 12 old facts woven in, split over two
sittings, ~12 answers a sitting — here is the whole story on one line each:

| | known by day 45 | known by day 142 | slowest child | could she actually recall it? |
|---|---|---|---|---|
| the ladder before v1.8 — what ROUTINE §7 records (`sim.js`, 5 runs) | ~35 / 78 | ~38 / 78 | ~21 / 78 | not measured |
| the ladder as of v1.8, fill-the-gap levels added (`sim.js`, 15 runs) | ~54 / 78 | ~55 / 78 | ~43 / 78 | not measured |
| **your daily plan, app unchanged** | **56 / 78** | **56 / 78** | 53 / 78 | **40 / 78** |
| your daily plan + review one table at a time | 77 / 78 | 77 / 78 | 75 / 78 | 49 / 78 |
| your daily plan + a fixed review picker | **78 / 78** | **78 / 78** | 78 / 78 | **69 / 78** |

Your two targets were ≥60 by day 45 and ≥74 by day 142.

- **As the app stands: no — and the plan buys you almost nothing over v1.8.** 56/78 by day 45, then
  flat for the next 97 days. That is barely above what the ladder already gets since v1.8 (~55), *and
  the daily plan starts 42 facts ahead*, because your point (c) hands it ×1 ×2 ×5 ×10 for free. No
  amount of extra practice fixes it: the sensitivity tables stop dead at 56 whatever you do.
- **With one small scheduling change — review one table at a time instead of everything at once:
  yes, both targets, on every modelled child.** 77/78 by day 45, worst child 75.
- **With the review picker actually repaired: yes, comfortably, and she would genuinely know it** —
  78/78 by day 45 and a real recall of 69/78 rather than 49/78.

Two things to hold on to before the detail:

1. **The last column is the one I would look at first.** It is new, and it is the only one that is
   about her rather than about the app's filing. See "two honest numbers" below.
2. **The baseline moved while I was working, and it is good news.** ROUTINE §7 records ~38/78 for the
   current ladder. Mid-afternoon on 12 August, v1.8 added the fill-the-gap levels; `sim.js` then
   started reporting ~55/78. I checked this properly rather than assuming noise — I ran the *old*
   `index.html` and the *new* one side by side, five and fifteen runs each: **~38 before v1.8, ~55
   after.** Run-to-run spread within each version is only 2–3 facts. So the recorded finding was
   accurate when written, and **v1.8 has already closed about half the gap the daily plan was meant
   to close.** That is worth knowing before you spend anything on a new scheduler.

---

## The bug this turned up, which matters more than the plan

Your part (b) — *"previously-learned facts interleaved among the target reps so they do not decay"* —
**is the part the app cannot currently do.** The simulation prints this first, and it is worth
seeing:

> Given a mid-year child and asked to choose from all 78 facts, **`pickFact` returns 6 different
> facts out of 78** across 1000 picks. Over a simulated year at your nominal dose, **42 of her 78
> facts are never asked once.**

The cause is one line. `pickFact` scores each fact and adds `wrong * 2.4`, where `wrong` is a
**lifetime** count of misses that never decays or resets. Every other term in that score is bounded
(box at most 4.9, "it's due" 1.8, random jitter 1.2). So once a fact has been missed about three
times more than its neighbours, it becomes the pick **permanently**, and the handful of facts she is
worst at swallow the entire review budget for the rest of the year. Everything she has half-learned
sits untouched while she grinds 6×7 and 12×12 forever.

This is live in the app today, not only under the new plan: after level 48 (about three weeks in) the
review levels draw on all 78 facts, which is exactly the pool where the picker collapses. **v1.8 made
that more important, not less** — the new phase-2 fill-the-gap levels also draw on every fact she has
met, so the best new level type in the app is fed by the picker that will only ever offer it six
questions.

Two ways out, both small:

1. **Scheduling only, no engine change:** keep review batches table-sized, the way the existing
   `mix`/`boss` levels already do, and rotate the table each sitting. `pickFact` behaves fine over
   12 facts. That alone takes the plan from 0/3 targets to 3/3.
2. **Fix the picker:** cap or decay the `wrong` term (recent misses, not lifetime), and let "it is
   due by its own box interval" lead. In the simulation this is the `due` chooser, and it is the only
   variant where what she *actually knows* gets anywhere near the target.

---

## Two honest numbers, because "known" turned out to be cheap

While building this I found that the app's own definition of "known well" (box ≥ 5) is much weaker
than it looks, for two compounding reasons:

- **A miss keeps the question up until it lands** — which is right, and kind, and stays. But
  `record` moves the box on *every* attempt, so one presentation is +1 box if she gets it first go
  and net *zero* if she misses once and then gets it. Boxes drift upward for anything asked
  regularly, and can only fall on a fact she is shown and misses twice in a row.
- **`pickFact` steps aside from facts in high boxes.** So a fact that reaches box 5 tends never to
  be asked again — and can therefore never fall back. The counter is a ratchet: it goes up and stops.

Consequence: hammer a brand-new fact 12 times in one sitting and it is at box 7 — "known well" —
that same evening, having never once been recalled on a *different day*. That is why the daily plan
scores so well on the app's own measure while the honest measures lag.

So the simulation reports two extra bars alongside your targets. **Neither is a relaxation — both are
harder than what you asked for:**

- **durable** — the real engine's own records, recounted strictly: box ≥ 5 **and** answered right on
  at least 5 *different days*.
- **unaided recall** — how many of the 78 she could produce today with no bubbles to choose from,
  taken from the learner model's memory rather than the app's bookkeeping. The app cannot measure
  this, which is the point.

At the nominal dose, honest model: app-unchanged gives durable **1.5**/78 and recall 40/78;
table-at-a-time gives durable **21**/78 and recall 49/78; the repaired picker gives durable **78**/78
and recall **69**/78. The gap between "known 77" and "durable 21" in the middle row is the whole
warning: **a schedule can satisfy the app while leaving her memory largely unbuilt.**

This also explains the 56 ceiling in the second row of the table above, and it is worth spelling out
because it is not a learning result at all. 42 facts are handed over at box 4–5; 36 are then hammered
one a day and every one of them reaches box 7 on its own day. 36 + the ~20 that happened to start at
box 5 = 56. The other ~22 — facts she demonstrably knows, sitting at box 4, one right answer short of
"known well" — are **never asked again for the rest of the year**, because the picker will not choose
them. The plan is not failing to teach her; the app is failing to ever check.

---

## Sensitivity: what actually moves the numbers

### (i) How many times the new fact is practised that day

Sharply useful up to about 12 reps, then completely flat:

| reps on today's target | 4 | 6 | 8 | 12 | 16 | 20 |
|---|---|---|---|---|---|---|
| known @142, app unchanged | 34 | 47 | 50 | **56** | 56 | 56 |
| known @142, one table at a time | 63 | 71 | 73 | **77** | 78 | 78 |

The flat part is not her hitting a limit — it is the *bookkeeping* hitting its ceiling: the box tops
out at 7, and ~12 correct goes gets there in one sitting. Past 12 reps a day you are buying nothing
the app can even record. **12 reps of the target, split across two sittings (6 and 6), is the right
number, and going higher is waste.**

### (ii) How many old facts are woven in

Almost invisible in the app's measure, clearly visible in what she can recall:

| old facts woven in per day | 0 | 4 | 8 | 12 | 24 |
|---|---|---|---|---|---|
| known @142 (app's measure, repaired picker) | 78 | 78 | 78 | 78 | 78 |
| **unaided recall @45** | **46** | 55 | 60 | 63 | **66** |
| unaided recall @142 | 65 | 67 | 68 | 68 | 68 |

Interleaving is worth about **20 extra facts of real recall during the sprint** — and the app's own
scoreboard cannot see any of it. Note also that the ceiling in the last row is soft: after day 29
every fact has been introduced, so the whole daily dose becomes review anyway, which is why the
year-end figure barely moves. Interleaving is what makes the *sprint* honest.

### (iii) The one that embarrassed me: where a fact she already knows starts

Your point (c) — she is solid on ×1, ×2, ×5, ×10 — is 42 of the 78 facts, leaving only 36 to acquire.
That arithmetic is what makes one-a-day feasible: the last new fact lands on **day 29**, comfortably
inside 45 days. But *where those 42 facts start* swings the day-45 result more than the entire
practice schedule does:

| the ×1 ×2 ×5 ×10 facts start at | known @45, app unchanged |
|---|---|
| box 4 (what the placement check actually does) | 36 / 78 |
| box 5 | **~78 / 78** |

One right answer in the placement check currently seeds box 4, one short of "known well" — and with
the broken picker those facts are then never asked again, so they sit at box 4 for the whole year.
Half of your sprint target is therefore a **filing decision**, not a teaching one. I would not "fix"
it by seeding box 5; I would take it as proof that the day-45 target, measured this way, is not
measuring teaching at all. Unaided recall is unmoved by the seeding choice (39 vs 40) — as you would
expect, since she either knows her ×2s or she doesn't.

### Minimum daily dose that hits your targets

- **App unchanged:** no dose works. Not 20 reps, not 24 interleaved, nothing — the number stops at 56.
- **Review one table at a time:** 12 reps of the target and 0 extra old facts — about **6½ answers a
  sitting** — already clears both targets (known 77@45). But that same dose leaves durable at 20 and
  recall at 46. Cheap by the letter, poor by the spirit.
- **Repaired picker:** 6 reps + 4 old facts, ~6 answers a sitting, clears both targets *and* reaches
  recall 66/78. Your nominal 12+12 gets recall 69/78. **The plan does not need a big dose; it needs
  the right questions.**

A caution on those small doses: a sitting of 6 answers is barely half a minute. `sim.js`'s health
band calls a session 6–26 answers, and your nominal 12+12 (~12 a sitting, ~25 answers a day) sits
comfortably mid-band. First-go accuracy across the modelled children comes out 79–90% with the app
unchanged, 73–91% reviewing one table at a time, and 72–95% with the picker repaired — so the middle
of the range sits inside your 80–85% guardrail, and the weakest child sits at 72–73%, the low edge of
workable. **I would keep 12+12.** It is not needed for the boxes; it is needed for her memory.

---

## What would have to be true for the plan to work

1. **Review has to reach the facts she has already met.** Today it does not: 42 of 78 never asked in
   a year. Either batch review by table (a scheduling change, no engine risk) or repair the `wrong`
   term in `pickFact` (better, and small). Without this, nothing else in the plan matters.
2. **The first meeting has to teach, not test.** This is the open finding from ROUTINE §7 and it
   survives intact. The model gives a brand-new fact a modest "here it is" credit; a fact hammered
   12 times with the answer never shown would land lower. Massed practice *with* the answer visible
   is a teaching move; massed guessing between three bubbles is not.
3. **Massed practice must not be mistaken for mastery.** It buys today's accuracy — the model shows
   her at 95%+ on all taps while durable memory is near zero. The plan's real engine is (b), the
   interleaving, and the app currently gives it no way to work and no way to show up in the score.
4. **The scoreboard needs to count days, not attempts.** "Right on five different days" would make
   the existing `KNOWN_BOX` mean what you think it means, and would stop a single evening of drilling
   from marking a fact done. This is a product decision, not mine — but it is the cheapest way to
   make the app's own number trustworthy.
5. **Two sittings a day, actually done.** The model assumes she plays every day for 142 days. Every
   number above is an upper bound on a real August-to-December.

---

## What I did not do, and what to distrust

- **Nothing in the app was changed.** `index.html`, `ROUTINE.md`, `sim.js` and Acorn are untouched.
  The `due` chooser is a proposal that lives only in the simulation, and it is labelled as such
  everywhere it appears.
- **No target was lowered anywhere.** Your three targets are printed verbatim; `durable` and
  `unaided recall` are additions and both are stricter.
- **The learner is a model, not your child.** It is reported two ways on purpose: `box` (the model
  `sim.js` uses, so the two files can be read side by side, though it flatters massed practice by
  construction) and `spaced` (which makes the 2nd–nth rep of a fact on the same day worth 1/2, 1/3,
  1/4 as much, and lets memory fade between days toward a floor set by how many *separate* days she
  has practised it). Every headline above is the stricter one. The direction of the findings is
  robust across both; the exact counts are not predictions.
- **The comparison is not perfectly apples-to-apples.** The daily plan is given your point (c) — 42
  facts banked at box 4–5 on day 0 — while `sim.js` assumes nothing except the placement check. So
  the daily plan starts well ahead and still only reaches 56. If anything that makes the
  app-unchanged row *more* damning, not less.
- **Every question here is still multiple choice.** The learner model gives each question a guessing
  floor of 1-in-3 or 1-in-4, because that is what Blast is. v1.8's fill-the-gap levels have no options
  to guess between, and this file does not model them — the daily plan is simulated as bubbles
  throughout. That is the biggest single gap between these numbers and the app you now have, and it
  cuts both ways: no floor makes right answers harder to come by, and also makes each one mean more.
  Worth a follow-up run once the number line settles.
- **Two flaws in the shared technique, both found here.** (1) `__144.reset()` does not clear the test
  clock, so the second and later simulated children stamp their day-0 records with the date the
  previous child *finished* on — a date in the future — after which those facts look "not due" all
  year and are never chosen. This file sets the clock before seeding; `sim.js` has the same hole for
  its 14 placement facts and I left it alone as instructed, but it is a one-line fix next time that
  file is opened. (2) The eight learners share one page and therefore one `Math.random` stream, so
  they are correlated samples rather than eight independent children. It is not what caused the ~38 →
  ~55 jump (that was v1.8), but it does mean the eight rows are not eight opinions — giving each
  learner its own page would make the spread mean what it looks like it means.
- **Two sessions were editing this repo at once.** The engine my findings rest on — `pickFact`,
  `record`, `BOX_DAYS`, `KNOWN_BOX` — is byte-identical to where it was when I started, which I
  checked; the ladder and the input mode are not. All numbers here were measured against
  `tables/index.html` as at v1.8, 2026-08-12 16:31Z.
