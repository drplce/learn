# Acorn — the success moment (WIN-5 / decision D-c)

**Change:** drop the verdict text "Yes — that's it." and replace it with a purely
visual success cue: **the word turns accent green, plus a very subtle size pulse.**
No code here — this is the spec to build from.

---

## 1. How the current app already moves (the vocabulary to match)

Read from `index.html`:

- **No `@keyframes` exist.** Every motion in the app today is a CSS *transition*
  on a single easing token `--ease: cubic-bezier(.22,.61,.36,1)` — a decelerating,
  "arrive-and-settle" curve — and three durations that form a deliberate ladder:
  `--m-press:.18s` (a press), `--m-quick:.3s` (a small state change),
  `--m-slow:.6s` (the slow ones).
- **Scale is used sparingly and small:** `.primary:active` dips to `scale(.985)`
  (−1.5%); a selected `.swatch` rises to `scale(1.07)` (+7%); the finished-screen
  `.net-cell.arriving` cells "swell and fill" from `scale(.12)` + `fill-opacity:0`
  to full over `--m-slow`. So the app's one existing *positive* flourish is a slow
  grow-and-fill in the accent green — exactly the register we want to echo, quieter.
- **Colour-as-reward is already the app's language:** the lit trace letter, the
  progress pebbles, and the map cells are all `--acc`. A correct word turning `--acc`
  reads as "this has joined the green things you've collected."
- **The word block** (`.word`) inherits `--ink` and its size is a `clamp()` font-size,
  so a `transform: scale()` on it is reflow-free and safe.
- **Auto-advance:** `check()` renders, then `setTimeout(next, 1400)`. A tap on the
  verdict (which carries `id="advance"`) or Return skips the wait.
- **Reduced motion** (existing global rule) forces every animation/transition
  duration *and delay* to `.001ms` — the codebase's stated policy is "show me the
  end state, not the same choreography with zero-length tweens."

**Implementation note that falls out of dropping the verdict:** `id="advance"` (the
tap-to-skip-the-wait target) currently lives on the `.verdict.ok` line. When that
line goes, the skip affordance must move onto the word itself (put `id="advance"` on
the winning `.word`) or the whole word screen — otherwise she loses the ability to
tap on to the next word. Recommend: the word becomes the tap target.

---

## 2. Research grounding (brief)

- **Duration for functional UI motion sits in a narrow band.** Nielsen Norman Group's
  guidance on UX animation puts useful, non-distracting interface animation at roughly
  **200–500 ms** — long enough to be perceived as a smooth change, short enough not to
  make the user wait (NN/g, *"Executing UX Animations: Duration and Motion
  Characteristics"* and *"The Role of Animation and Motion in UX"*). Our `--m-quick`
  (.3s) and a ~400 ms pulse both sit inside this.
- **A "settle" reads as decelerate (ease-out), not bounce.** Material Design's motion
  guidance uses *decelerated* easing for elements arriving/coming to rest, and reserves
  spring/overshoot for playful emphasis (Google, *Material Design — Motion: speed &
  easing*). Acorn's `--ease` is already a decelerate curve, so a pulse that eases out
  into its peak and eases back to rest gives a "breath," whereas any overshoot past the
  peak would give a "bounce." We want the former.
- **Small magnitude, restrained motion, especially for a calm/learning context.**
  Apple's Human Interface Guidelines (*Motion*) advise using motion purposefully and
  avoiding gratuitous movement; the British Dyslexia Association's style guidance
  stresses minimising distraction and animation on reading surfaces. A correct-answer
  cue for a child should be *felt, not performed* — keep the scale delta at or under
  ~5%.
- **Quiet acknowledgement beats loud gamification.** The over-justification / over-
  reward literature (Deci & Ryan's self-determination theory; Lepper et al. on
  extrinsic reward) is the reason to prefer a calm, low-arousal "yes" over confetti or
  a score pop: a loud extrinsic celebration can crowd out the intrinsic satisfaction of
  getting the word right. A colour change plus a single breath is acknowledgement
  without spectacle.
- **Reduced-motion best practice** is to honour `prefers-reduced-motion: reduce` by
  presenting the *end state* with no animated transition (W3C WCAG 2.1 SC 2.3.3
  *Animation from Interactions*; MDN `prefers-reduced-motion`). Acorn already does this
  globally — our cue inherits it for free as long as the green is expressed as the
  animation/transition *end state*.

---

## 3. Options

All three keep the chime (`chime('right')`) and the 1400 ms auto-advance exactly as
they are. All three introduce the app's **first `@keyframes`** for the pulse — the one
thing a colour transition alone can't do (return to its own start). Each is written to
match the existing token ladder, and each degrades to "green word, no motion" under
reduced motion via the existing global rule.

The word turns **`--acc`** (`#35705A` light / `#7CC0A2` dark) — the accent, the same
green as the pebbles, the trace letter and the mark, so the word visibly joins them.
(`--good` is an alternative and is *identical* to `--acc` in dark mode; `--acc` is the
stronger identity tie, and the comment on the trace letter already certifies `--acc` at
this weight as AA — 5.5:1 on cream, 7.4:1 in dark.)

### Option A — "Settle" *(recommended)*

- **Colour:** `.word` transitions `color: --ink → --acc` over **`--m-quick` (300 ms)**,
  `--ease`. Green stays for the rest of the ~1.4 s.
- **Pulse:** one-shot keyframe, **1.0 → 1.04 → 1.0** (peak +4%), **420 ms**, `--ease`,
  `transform-origin: center`. Peak at ~40% of the run so the enlargement leads and the
  return is the longer, gentler half — an out-breath.

  ```css
  @keyframes acorn-settle { 0%{transform:scale(1)} 40%{transform:scale(1.04)} 100%{transform:scale(1)} }
  .word.won{ color:var(--acc);
             transition:color var(--m-quick) var(--ease);
             animation:acorn-settle 420ms var(--ease); }
  ```
- **Pebble:** does **not** get an extra pulse. The progress row already re-flows on a
  win (finished dot `1.5→1.0`, next dot `1.0→1.5`, its own `--m-quick` transition), and
  it's already `--acc`. One deliberate motion (the word) plus the row quietly advancing
  reads as calmer than two things pulsing at once.
- **Timing vs. 1.4 s:** colour lands by ~300 ms, pulse resolves by ~420 ms; the word
  then simply rests green for ~1 s before `next()` fires. Nothing races the advance.
- **Reduced motion:** global rule zeroes both — the word is green instantly at scale 1,
  no pulse. Exactly the intended end state.
- **Why it's calm-and-rewarding, not loud:** +4% is under the app's own +7% swatch
  emphasis and eases back to rest instead of overshooting, so it's a single breath in
  the app's own green — a nod, not a cheer.

### Option B — "Breath" (most restrained)

- **Colour:** identical to A — `--ink → --acc` over `--m-quick`, `--ease`.
- **Pulse:** **1.0 → 1.025 → 1.0** (peak +2.5%), **500 ms**, `--ease`. Smaller and
  slower than A: closer to a swell than a pulse.
  ```css
  @keyframes acorn-breath { 0%{transform:scale(1)} 45%{transform:scale(1.025)} 100%{transform:scale(1)} }
  .word.won{ color:var(--acc); transition:color var(--m-quick) var(--ease); animation:acorn-breath 500ms var(--ease); }
  ```
- **Pebble:** unchanged, as A.
- **Timing vs. 1.4 s:** resolves by 500 ms, ~900 ms of rest before advance.
- **Reduced motion:** green end-state, no motion.
- **Why calm:** at +2.5% the size change is at the threshold of being *felt* rather
  than *seen* — the most conservative choice, best if the pulse ever reads as too much
  for her.

### Option C — "Settle + earned pebble"

- **Word:** identical to Option A (green + 1.04 pulse, 420 ms).
- **Pebble also participates:** the dot that just filled (the one flipping `now → on`)
  gets a matching one-shot on the same curve, layered on top of its existing `1.5 → 1.0`
  landing — a brief emphasis so "that one is yours now" lands with the word.
  ```css
  @keyframes acorn-pebble { 0%{transform:scale(1)} 40%{transform:scale(1.12)} 100%{transform:scale(1)} }
  .dots i.just-on{ animation:acorn-pebble 420ms var(--ease); }
  ```
  (A larger % on the pebble is fine — a dot is `--t-sm`-sized, so +12% is only a couple
  of px of travel; it needs a JS hook to add `.just-on` to the newly-filled dot for one
  render.)
- **Timing / reduced motion:** as A; both pulses zero out under reduce, leaving the
  green word and the advanced row.
- **Why it can still read calm:** the two motions are spatially separated (word centre
  vs. pebble row above) and both settle rather than bounce — but it is **two** events,
  which is the reason it's not the recommendation.

---

## 4. Recommendation

**Option A ("Settle").** It is the most faithful to the owner's steer — *word turns
green, plus a very subtle size pulse* — and to the app's existing motion grammar: one
easing, the `--m-quick` duration already used for small state changes, a scale delta
(+4%) smaller than the app's own strongest emphasis, and the accent green that ties the
word to everything else she's collecting. It's a single, self-contained breath that
finishes in well under half a second and then rests, so the ~1.4 s auto-advance stays
a calm pause on a green word rather than a stage for a performance. Option B is the
fallback if +4% ever reads as too much; Option C only if a later decision wants the
progress pebble to share the moment.

**Two build notes:** (1) move `id="advance"` from the removed verdict line onto the
winning `.word` so tap-to-skip survives; (2) the winning word needs a hook to receive
the `.won` class (e.g. add it in the `ok` branch of `renderWord`, or via `wordBlock`)
so the keyframe fires once per correct answer.
