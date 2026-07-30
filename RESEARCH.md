# What this app believes, and what holds it to it

Every design decision in Acorn that came from evidence rather than taste, what the app
actually does about it, and the thing that fails if the app stops doing it.

This file exists because the evidence was only ever in scattered code comments and one line
of `PLAN.md`. That is fine for remembering why something was built and useless for noticing
when it quietly stops being true. Six months of refinement passes move a lot of levers.

**Cadence.** The claims below barely change from year to year; the app changes several times
a day. So the checking is continuous — it runs in the three harnesses on every commit — and
the reading is occasional. A daily job that searches for new evidence would find nothing
almost every day, and a check that reports nothing almost every day is a check nobody reads.

---

## 1. Retrieval, not exposure

**Claim.** Being tested on something you are trying to learn beats being shown it again, and
the gap widens over time. Spelling especially: producing the letters is the skill, and
recognising a correct spelling is a different and easier one.

**What the app does.** Look-cover-write-check applies only to a word she has *not* met.
Every word she has met goes straight to writing from memory. This reversed §5C of the
original plan, which had look-cover-write-check throughout.

She also never picks from options — the answer is always typed. As of 11.6 it has to be
*written*: dictation, glide typing, a tap on the suggestion bar and a paste are all handed
back, because each of them supplies the letters she was meant to produce.

**What holds it.** `tests/spelling.spec.js` (a met word skips the look stage);
`tests/written-answers.spec.js` (11 tests); `tests/break.js` scenario 27.

**Not covered.** Whether a real iOS software keyboard fires `keydown` for its letters. The
written-answers check deliberately does not depend on it — see the comment in `index.html`.

## 2. Expanding intervals, not massed practice

**Claim.** Revisiting a word at growing gaps beats revisiting it at fixed ones, and both
beat cramming it.

**What the app does.** Leitner boxes 1–7, `BOX_DAYS = {1:0, 2:1, 3:2, 4:4, 5:8, 6:21, 7:60}`.
A right answer moves a word up a box, a wrong one moves it down.

**What holds it.** `tests/sim.js` bands the share of met words she has actually learned at
80% or better. Mutation-tested: flattening every interval to one day, or removing spacing
altogether, drops it from 91% to 60% and fails the run.

**This is the only band with teeth, and finding that out was the point.** Deleting spaced
repetition outright moves first-go accuracy by a tenth of a point and every difficulty band
holds — when everything is due daily she reviews more and gets more of it right. The evening
feels identical. She just learns 33 words in sixty days instead of 56. Difficulty and
learning are not the same measurement, and for four versions this file's harness only had
the first one.

**Not covered.** `KNOWN_BOX` itself. It defines what "learned" means, so the learning band
cannot police it — lowering it to 2 raises the ratio to 96.6% and passes.

## 3. Desirable difficulty — around 80–85% right

**Claim.** Practice is most productive somewhere short of easy. Too high and she is being
asked what she already knows; too low and the evening is a slog she will avoid.

**What the app does.** The pace controller moves session length, new-word intake and pool
size together off her recent accuracy: `PACE_HIGH = .85`, `PACE_LOW = .70`.

**Where it actually runs.** 86–89% first go across the five lists with material ahead —
**one to four points above target**, measured over 60 days and 12 modelled learners. That is
a live open question, not a settled decision: moving `NEW_SHARE` from 1/3 to 0.45 would give
85.2% and 58.7 words learned instead of 56.3, at the cost of the worst evening in ten
falling from 75.0% to 66.7%. It is a judgement about one particular child and has been put
to her father.

**What holds it.** `tests/sim.js` bands first-go at 78–92%, worst learner at 75%+, and prints
the distance from the 80–85% target on every run so the gap cannot widen unnoticed.

**Weak.** The band is wide because the app currently sits outside the target. Raising both
pool levers at once drops first-go seven points and is only just caught.

## 4. Cognitive load — new material capped

**Claim.** A working memory already busy decoding cannot also absorb an unlimited amount of
new material. Dyslexia makes the decoding part more expensive, not the learning part.

**What the app does.** `poolCap()` = `max(1, min(ACQUIRING_CAP, floor(sessionWords() × NEW_SHARE)))`
— new material capped at a third of a sitting and at three words absolute.

**What holds it.** `tests/pace-levers.spec.js`.

**Worth knowing.** The two limits clamp each other, so raising either alone changes nothing
at all. `ACQUIRING_CAP` was reported "inert" earlier for exactly this reason; it is not
inert, it is the binding one of a pair. Any future test of either must move both.

## 5. Nothing that reinforces the wrong spelling

**Claim.** Seeing an incorrect form can strengthen it. Feedback should show the correct
spelling, not the error.

**What the app does.** Her own attempt is never shown back to her. The verdict screen shows
the *target* with the letters she missed marked on it. Nothing in the app says "wrong" or
"failed", and nothing attributes fault.

**What holds it.** `tests/wording.spec.js` (her own spelling never on the screen or in the
announcement; nothing reads as blame); `tests/homophones.spec.js`.

## 6. Structured literacy — the word in sayable pieces

**Claim.** Explicit, systematic attention to the sound-to-letter structure of words is the
best-supported approach for dyslexia. Segmenting a word into syllables makes it decodable
rather than a shape to be memorised whole.

**What the app does.** Every multi-syllable word is broken into tappable chunks, each of
which speaks when tapped. `syllables()` splits on suffixes, compounds and onset clusters.

**Where it actually runs.** 99% right chunk count, 69% exactly right. The residual is the
open/closed VCV ambiguity, which spelling alone cannot resolve.

**What holds it.** `tests/syllables-quality.spec.js`; `tests/squeeze.spec.js` keeps the chips
on the screen and above the 44px target when room runs out.

## 7. Hearing it and writing it

**Claim.** Linking sound to letters through more than one channel at once supports spelling
for dyslexic learners.

**What the app does.** Every word is spoken, on arrival and on demand, with a recorded human
voice where one exists and the phone's voice otherwise. Speaking speed is adjustable. The
word is spelled out letter by letter to a screen reader.

**What holds it.** `tests/speech.spec.js`, `tests/audio-live.spec.js`, `tests/a11y-motion.spec.js`.

## 8. Same-day second look

**Claim.** A first cold retrieval should happen while the material is still fresh, rather
than arriving as a surprise a day later.

**What the app does.** A word she has just met gets one more go later in the same sitting,
from memory.

**What holds it.** `tests/spelling.spec.js`, `tests/first-time.spec.js`.

---

## Where this is thin

Stated plainly, because a document like this is worth less than nothing if it reads as
reassurance.

- **The learning band is one number.** 80% of met words learned, on a modelled learner. The
  learner model is a guess about how a child behaves, and every claim above is checked
  through it.
- **`KNOWN_BOX` is unpoliced** — see §2.
- **The difficulty band is wider than the target** — see §3.
- **Nothing here is checked against her.** Every number is a simulation or a browser
  measurement. The one real signal — whether she opens it — is not something this repo can
  see, and the pacing question in §3 is exactly the kind that only she can answer.
- **No claim here has a citation.** They are stated as the working beliefs behind specific
  decisions, which is what they are; treat any of them as worth re-checking rather than as
  settled.
