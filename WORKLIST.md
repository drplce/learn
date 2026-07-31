# Acorn — work list

Living checklist. Codes are stable references.
Status: ⬜ todo · 🔨 in progress · ✅ done · ⏸ gated · 🔬 research running.

## Decisions (locked)
- **D-a** (→LAY-1): text-size cap sized to **12 letters**; words 14+ shrink as a fallback. Favour bigger text for the majority.
- **D-b** (→LAY-2): on the verdict screen at biggest text, **shed harder — the continue button is sacred**; review presentation after.
- **D-c** (→WIN-5): success = **word turns green + a very subtle size pulse**.

## NOW — fix reported + protect data
- ✅ **SCR-1 / scroll drag** — **fixed on device (13.9).** Three tries first: 13.6 body-pin, 13.8 lock `main` (both failed on device). Root cause: **iOS pans the VISUAL viewport with the keyboard up** — not a DOM scroll, unstoppable by overflow/position (David's tell: the map screen, no keyboard, never moved). **13.9 (LAY-2b)** gated `touchmove` preventDefault blocks any drag not inside a scrollable region. **David confirmed: "The no scroll is working!"** Guarded by `touch-drag-gate.spec.js`.
- ✅ **SCR-2 / stuck pan alignment (13.11, LAY-2c)** — the scroll-lock leftover David then saw: on first keyboard-up iOS pans the visual viewport to the caret before the reserved band settles, and with the body pinned the pan sticks (box shoved off the top until a keyboard hide/show). `fitViewport` now cancels it — reads `visualViewport.offsetTop`, and only on a word flags `[data-panned]`/`--vvtop` and translates `#app` back down onto the visible region. Gated so non-word screens never move. Guarded by `viewport-pan.spec.js`. **→ verify on phone: does the box hold its place now, first keyboard-up and after hide/show?**
- ✅ **DAT-1** — `navigator.storage.persist()` on first tap (shipped 13.6).
- ✅ **RES-1** — Measured. On the SE a 12-letter word maxes at **~34px** (width-limited; the `--t-3xl` ceiling is never reached), 14-letter ~29px. Corrects my earlier ~44px guess. Short words currently render 51–64px, so a locked size is a real reduction — **needs D-a refined** (see below) before LAY-1.

## NEXT — deterministic layout
- ✅ **LAY-1** — **Option A shipped (13.7).** One locked ~34px word across trace/write/check; all ≤12-letter words identical (cat = presentation = 33.8px), 13+ shrink uniformly. Write box now on the same clamp (was fixed --t-2xl) and matched to .06em spacing. **Review on phone** — short words are smaller than before (the trade you accepted).
- ✅ **LAY-2** — **Locked `main` on the word screen (13.8).** Measured 0px overflow at 1.5× on the SE with the keyboard up (look/write/check), and the button lives in #act below main, so nothing clips — iOS simply can't rubber-band a `hidden` region. Grown-ups/finished keep their scroll. Guarded by `tests/word-screen-lock.spec.js`. **→ verify the drag is gone on your phone.** (The 13.3 anchor already pins the word across stages, so no separate hard-pin was needed.)
- ⬜ **DAT-2** — Surface export/import backup prominently on the grown-ups screen.

## THEN — UX batch
- ⬜ **WIN-1** — Miss → re-trace the word, letter-slip emphasised, instead of "Look at this letter." [batch 8]
- ✅ **WIN-2** — Pebble-echo box shipped. 13.10: write box (seeded hand-drawn accent-green hairline via `boxHairPath()`+`blobPath`, non-scaling stroke, behind a transparent input). 13.12: **the same box now frames the trace too** (decision: box = "where you write"; the trace is a writing moment). Same seed 'box' so trace→write is one box; centre holds 338–340px across trace/write/check; the lit-green letter rides on top (David: the two greens read clean). Vertical padding only (the letters keep full width so long words don't wrap), shed on `data-tight`. Guarded by `tests/trace-box.spec.js`. (Syllable-underline variant on the read word is a separate, still-open idea.) [batch 4]
- 🔨 **WIN-3** — Per-word pebbles done (each word its own blob, current one enlarged). **13.15: blobs centred by bbox** (removed a magnified drop when a dot filled green). **13.16–13.17: single word-screen skeleton** (David's call — stop aligning stages one at a time). The word screen is now ONE fixed layout: dots, a reserved caption slot (cue/verdict, constant height), the word in a constant-footprint slot (the checked word shares the box's line-box + padding), and a reserved footer (so the miss "next" button can't resize `main`). Measured: dots AND word hold one position (224.5 / 333.5px) across trace/write/win/miss — was ~80px of drift. Guarded by `word-screen-pin.spec.js` + `pebble-align.spec.js`. (Two-pass green depth still open.) [batch 1]
- ✅ **WIN-4** — **Shipped (13.14).** Speaker button and the "Listen, then write it." line gone from every word screen. She hears the word on arrival; a **tap anywhere** on the word screen (not the keyboard) replays it (`say(word,{force})`, touch-only). If she stalls ~8s on the writing stage, a **bare speaker glyph** (no box) fades in centred below the box (David's B choice), and fades out the moment she types/taps. AT preserved: the live-region announcements are unchanged, and the winning word is now focusable so keyboard focus is never dropped. Guarded by `tests/declutter.spec.js` (fails on 13.13). ~20 harness assertions that keyed off the old speaker/instruction migrated to the tap-to-hear model. [batch 2+3]
- ✅ **WIN-5** — **Shipped (13.12, Option A "Settle").** The every-time "Yes — that's it." caption is gone; a correct word turns accent green and breathes once (`@keyframes acorn-settle`, `--m-quick`, folded colour so it fires on insert, reduced-motion safe). The earned "You got there." stays after a fought-back miss. `id="advance"` moved onto the winning word (tap still skips the wait); the spoken verdict is untouched (a11y). Guarded by `tests/win-cue.spec.js`. [D-c, RES-2]

## LATER — infra + gated pacing
- ✅ **RES-2** — Success-moment design ready (feeds WIN-5): Option A "Settle" — word greens 300ms + one-shot 1.0→1.04→1.0 pulse (420ms, settle-ease), reduced-motion safe. Build note: move `id="advance"` onto the word. `reference/success-moment-design.md`.
- ⬜ **INF-1** — Service worker for guaranteed offline launch (skipWaiting + network-first HTML + bumped VERSION).
- ⬜ **INF-2** — Manifest + icons (192/512) + `format-detection` meta.
- ✅ **RES-3** — Pacing analysis done: both breaches are **30-day-window measurement artifacts; the engine is correct.** tionsion is learned (98.9% by 60d), aussie's 92.5% is a finished-list revision tail. `reference/pacing-analysis.md`.
- ✅ **PACE-1** — **B2 + B3 shipped (owner-approved).** sim.js bands recalibrated (learned floor 0.80→0.75; finished-list exemption 0.5→3), engine untouched. **sim now green.**

## Done / closed
- ✅ 13.1 trace letter green · 13.2 scroll-lock v1 · 13.3 anchor · 13.4 drop write-instruction · 13.5 mic-on-trace fix
- ✅ CLOSED: iOS keyboard accessory bar — impossible to remove from any web app (research-confirmed); accepted.
- ✅ `reference/home-screen-webapp.md` — Apple home-screen web-app research.
