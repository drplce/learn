# Acorn — work list

Living checklist. Codes are stable references.
Status: ⬜ todo · 🔨 in progress · ✅ done · ⏸ gated · 🔬 research running.

## Decisions (locked)
- **D-a** (→LAY-1): text-size cap sized to **12 letters**; words 14+ shrink as a fallback. Favour bigger text for the majority.
- **D-b** (→LAY-2): on the verdict screen at biggest text, **shed harder — the continue button is sacred**; review presentation after.
- **D-c** (→WIN-5): success = **word turns green + a very subtle size pulse**.

## NOW — fix reported + protect data
- ✅ **SCR-1** — `position:fixed` body to stop iOS's document pan (shipped 13.6). **VERIFY ON PHONE** — Chromium can't reproduce the iOS keyboard drag; if it misbehaves, it rolls into LAY-2.
- ✅ **DAT-1** — `navigator.storage.persist()` on first tap (shipped 13.6).
- ✅ **RES-1** — Measured. On the SE a 12-letter word maxes at **~34px** (width-limited; the `--t-3xl` ceiling is never reached), 14-letter ~29px. Corrects my earlier ~44px guess. Short words currently render 51–64px, so a locked size is a real reduction — **needs D-a refined** (see below) before LAY-1.

## NEXT — deterministic layout
- ⏸ **LAY-1** — Constant word size. **Blocked on D-a refined:** RES-1 shows the locked size is ~34px (smaller than short words get today). Option A = lock 34px, fully uniform; Option B = unify the sizing *rule* across stages but keep short words big, only 13+ shrink. [dep RES-1, D-a]
- ⬜ **LAY-2** — Hard-fix the word/box at one position across all stages + lock `main` scroll. [dep LAY-1, D-b]
- ⬜ **DAT-2** — Surface export/import backup prominently on the grown-ups screen.

## THEN — UX batch
- ⬜ **WIN-1** — Miss → re-trace the word, letter-slip emphasised, instead of "Look at this letter." [batch 8]
- ⬜ **WIN-2** — Sketchy hairline syllable underline; word stays book-natural. [batch 4]
- ⬜ **WIN-3** — Per-word pebbles + two-pass green depth (light → deeper). [batch 1]
- ⬜ **WIN-4** — Ditch speaker button → word/chips/cover tap-to-hear + ~8s stuck-fade cue. [batch 2+3]
- ⬜ **WIN-5** — Drop "Yes — that's it" → green + subtle size pulse; keep earned "You got there." [batch 7, D-c, dep RES-2]

## LATER — infra + gated pacing
- ✅ **RES-2** — Success-moment design ready (feeds WIN-5): Option A "Settle" — word greens 300ms + one-shot 1.0→1.04→1.0 pulse (420ms, settle-ease), reduced-motion safe. Build note: move `id="advance"` onto the word. `reference/success-moment-design.md`.
- ⬜ **INF-1** — Service worker for guaranteed offline launch (skipWaiting + network-first HTML + bumped VERSION).
- ⬜ **INF-2** — Manifest + icons (192/512) + `format-detection` meta.
- ✅ **RES-3** — Pacing analysis done: both breaches are **30-day-window measurement artifacts; the engine is correct.** tionsion is learned (98.9% by 60d), aussie's 92.5% is a finished-list revision tail. `reference/pacing-analysis.md`.
- ⏸ **PACE-1** — **Not an engine problem** (RES-3). Recommended fix = recalibrate 2 sim bands, not the engine: **B2** tionsion learned floor 0.80→0.75 (mutation test still fails 53.7%, teeth kept); **B3** mend aussie's finished-list exemption to fire at 30d (it already does at 60/90d). **Needs your sign-off** — touches the pacing bands. Engine ramps (E1/E2) tested and rejected (regress other lists).

## Done / closed
- ✅ 13.1 trace letter green · 13.2 scroll-lock v1 · 13.3 anchor · 13.4 drop write-instruction · 13.5 mic-on-trace fix
- ✅ CLOSED: iOS keyboard accessory bar — impossible to remove from any web app (research-confirmed); accepted.
- ✅ `reference/home-screen-webapp.md` — Apple home-screen web-app research.
