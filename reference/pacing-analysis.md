# PACE-1 pacing analysis — `aussie` (too easy) and `tionsion` (under-learned)

**For owner sign-off. Nothing here is shipped.** All numbers are from `node tests/sim.js`
(the real engine, 12 modelled learners) run in the isolated worktree. Engine and band edits
were applied, measured, and reverted; the tree is back to baseline.

Diagnostics used a copy, `tests/sim-diag.js`, that adds three read-only measures to each run:
- **learned(matured)** — of the words met early enough to have had time to climb to `KNOWN_BOX`
  (met on/before day = end − 14), how many are known-well at the end.
- **first-go acquisition / revision-tail** — first-go split at the last day that learner still
  met a new word.
- **stillArriving** — the last-third average new-word count the exemption already keys on.

---

## Baseline (30 days, engine unchanged) — the two failures

```
list       first-go  learned(all)  learned(matured>14d)  first-go-acq  words/sess  met/100  stillArriving  verdict
easy         87.6%       83.5%            100.0%             87.6%         7.9        34.3       26.9        pass
tricky       86.2%       84.3%            100.0%             86.3%         7.6        29.7       26.9        pass
longvowel    86.2%       85.6%            100.0%             86.3%         7.8        30.8       26.3        pass
silent       84.5%       82.8%             99.5%             84.6%         7.4        25.3       24.7        pass
tionsion     84.2%    →  77.9% ✗          97.9%             84.3%         7.1        24.8       26.9        FAIL learned<80
aussie    →  92.5% ✗     100.0%          100.0%             87.0%         7.7        14.0        1.67        FAIL first-go>92
```

Two bands breached, matching PACE-1: `tionsion` learned 77.9% (floor 80%), `aussie` first-go
92.5% (ceiling 92%).

---

## 1. Why `aussie` runs too easy

### Root cause A — the words are "regular" in the difficulty model
The learner model scores irregularity off a phonics regex
(`/ough|augh|tion|sion|eigh|ei|ie|ph|silent|kn|wr|mb$|que/`, `+0.3` difficulty). The
Australian list's tricky bit is *orthographic convention* (-our, -ise, -re, -ce), which that
regex does not see. Measured per-word mean difficulty:

```
aussie     mean 0.662   irregular 1/14   (only "neighbour", via "eigh")
silent     mean 0.692   irregular 9/14
tionsion   mean 0.968   irregular 12/12
```

So the model treats 13 of the 14 aussie words as ordinary medium-length words. Its
**acquisition-phase first-go is 87.0%** — about 2 points above the other lists (84–86%) and
above the 80–85% target, but still *inside* the 78–92% hard band. During real learning aussie
is mildly easy, not out of band.

### Root cause B — the band failure is the revision tail on a finished 14-word list
aussie is the last list; nothing follows it, so once all 14 are met every sitting is pure
revision. **Revision-tail first-go = 100.0%**, which drags the whole-run mean to 92.5% and
over the ceiling. The code already has an exemption for exactly this ("a finished list is pure
revision, the difficulty band does not apply") — and it fires at 60 and 90 days:

```
aussie 30d:  first-go 92.5%  → NOT exempted (fails)   stillArriving 1.67
aussie 60d:  first-go 96.6%  → exempted ("nothing new arrived in the last third")
aussie 90d:  first-go 97.8%  → exempted
```

The exemption misfires at 30 days because its proxy, `stillArriving < 0.5`, counts box-1
churn as "arriving": the weakest learners keep one hard word (e.g. `neighbour`, difficulty
1.0) bouncing in box 1, and a box-1 word re-counts as a `look`/new word each day. aussie's
1.67 is nowhere near the healthy lists' ~25 (genuine intake from following lists) — it is a
nearly-finished list whose threshold is simply set too tight.

**Verdict:** aussie is only marginally easy during acquisition (a model blind spot on
orthographic conventions, not a pacing fault). The 92.5% breach is a finished-list revision
artifact that the existing exemption should have caught.

---

## 2. Why `tionsion` reads under-learned — real, or a measurement window?

### It is a measurement-window effect, not a learning deficit
`tionsion` is the hardest list (mean difficulty 0.968, all 12 words irregular), so it has the
most first-go misses early (days 0–1: 55.6%, 47.2%). Each miss resets the Leitner box, and
`KNOWN_BOX = 5` needs 4 clean retrievals on 4 different days — a **minimum of 7 elapsed days**
from first meeting even with no misses, realistically ~14 with them. On a 12-word list where
intake runs into the third week, the last-met words *cannot* have reached box 5 by day 30.

The evidence that they are being learned, only slower than the window:

```
learned(all)      30d 77.9% ✗   60d 98.9% ✓   90d 100.0%
learned(matured, met >14d ago)      97.9%   (words that had time to climb ARE known-well)
first-go acquisition                84.3%   (top of the hard band — genuinely hard, not mis-paced)
```

The 30-day snapshot is measuring "has every word, including those met last week, reached box 5
yet" — which for the hardest, smallest list is "not quite," at 77.9% versus an 80% floor. The
words met early enough to mature are learned at 97.9%.

**Verdict: `tionsion`'s 77.9% is a band-calibration artifact of the fixed 30-day window, not a
real problem.** The pattern is genuinely harder (correctly, ~84% first-go during acquisition),
but it is learned — 98.9% by 60 days.

---

## 3. PACE-1 options, each measured

### Option E1 (engine) — raise intake: `NEW_SHARE` 1/3 → 0.45
```
                 first-go   learned   note
tionsion          82.5%     78.1% ✗   still fails — window artifact untouched
tricky            85.8%     79.3% ✗   REGRESSION: was 84.3% pass → now fails
aussie            93.8%    100.0%     first-go higher, but now exempted (faster consolidation)
```
**Reject.** Does not fix `tionsion` (proof it is not an intake problem) and regresses `tricky`
below the learned floor.

### Option E2 (engine) — slow intake: `newMax` 3 → 2
```
                 first-go   learned   words/sess  met/100
tionsion          86.8%     78.4% ✗    7.1         18.9   still fails
aussie            93.2% ✗  100.0%      7.7         14.0   WORSE
easy              90.9%     86.5%       8.0        26.6   (was 87.6% / 34.3)
tricky            89.1%     84.0%       7.6        24.0
longvowel         90.0%     85.1%       7.8        24.7
silent            88.1%     84.1%       7.5        21.0
```
**Reject.** Every list drifts to 88–93% first-go (further above target — *easier*, not harder,
because a smaller intake means more revision) and throughput falls (easy: 34→27 words met);
`tionsion` still fails and `aussie` gets worse. Confirms neither breach is an intake problem.

### Option B1 (band) — window-aware "matured" learned metric
Replace learned% = known-well / all-met with known-well / (words met >14 days ago). Measured
values already show `tionsion` would read **97.9%** and every other list **≥99.5%** — all pass,
no regression. **But it fails the safety test.** Flattening every Leitner interval to 0
(deleting spaced repetition — the mutation the learned band exists to catch):

```
mutation: BOX_DAYS all → 0
                 learned(all)   learned(matured>14d)
tionsion            53.7% ✗         92.9%   ← would PASS
easy                58.6% ✗         92.3%   ← would PASS
```
The matured metric **loses the band's only teeth**: with zero intervals everything is due
daily, boxes still climb one-per-day, so words met >14 days ago have had 14 daily reps and
reach box 5 regardless of spacing. **Reject** — the teeth come precisely from spaced words
*not* all maturing inside the window.

### Option B2 (band, RECOMMENDED for `tionsion`) — lower the `LEARNED` floor 0.80 → 0.75
`tionsion` healthy = 77.9%; the interval-deletion mutation = 53.7% (my run) / 60% & 65% (the
two mutations RESEARCH cites). A 0.75 floor passes healthy `tionsion` with 2.9 pts of headroom
while both mutations still fail by 10–15 pts. Teeth preserved (thinner: mutation margin
15→10 pts on the tighter mutation), no engine change, no throughput cost, no effect on any
other list. Pairs with the horizon evidence (60d = 98.9%) as the justification.
- *Tradeoff:* reduces learned-band sensitivity by ~5 pts. Mitigate by keeping the printed
  distance-to-target line so drift stays visible.

### Option B3 (band, RECOMMENDED for `aussie`) — fix the finished-list first-go exemption
The exemption for finished lists already exists and fires at 60/90 days; only its 30-day
trigger is mis-tuned. Two equivalent fixes:
- raise the `stillArriving` cutoff from 0.5 to ~3 (aussie 1.67 exempts; healthy lists ~25
  untouched — the gap is enormous, so the threshold is not sensitive), or
- base the exemption on "all reachable words met and known-well" rather than a new-word proxy,
  which also stops box-1 churn from masquerading as new arrivals.

Either exempts aussie at 30 days as it already is at 60/90, with **no risk to healthy lists**
(none has stillArriving below ~24). aussie's genuine acquisition first-go (87.0%) stays inside
the hard band; only the pure-revision tail is excused.
- *Tradeoff:* a truly-too-easy *ongoing* list would still be caught, because the exemption only
  applies once intake has essentially stopped. The mild model easiness (87% acq) is a separate,
  smaller open question about the difficulty model, not a pacing fault, and has no
  accuracy-driven engine lever (aussie's acquisition accuracy is not high enough to trip
  different pacing than the other lists).

---

## Recommendation

**Do not ramp the engine. Recalibrate the two bands (B2 + B3).** The evidence is that the
pacing engine is behaving correctly on both lists — the breaches are measurement artifacts of a
fixed 30-day window on small, specialised lists:

- `tionsion` 77.9% → the words are learned (matured 97.9%, 60d 98.9%, 90d 100%); acquisition
  first-go 84.3% is correct for the hardest list. Fix: lower learned floor to 0.75 (teeth
  preserved: mutation 53.7% still fails).
- `aussie` 92.5% → a finished 14-word list's revision tail; acquisition first-go 87.0% is in
  band. Fix: mend the finished-list exemption so it fires at 30 days as it does at 60/90.

Both engine levers (E1, E2) were tested and **regress other lists while fixing neither**. The
window-aware learned metric (B1) was tested and **destroys the band's mutation-test teeth**.

**Is `tionsion`'s 77.9% a real problem?** No — it is a band-calibration artifact. The
`-tion/-sion` pattern is genuinely harder (that part is real and correctly paced at ~84%
first-go), but the words are being learned; the 30-day window just cannot see the last-met ones
reach `KNOWN_BOX`.
