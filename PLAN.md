# Learning app — project plan

A calm, dyslexia-friendly practice app for a 9-turning-10 year old (Australian
Curriculum Year 4/5). Three things: a daily **reading streak**, **maths** drills,
and **spelling/words** practice. Built the same way as Goal Girls — one HTML file,
offline, installs to the iPhone home screen, free hosting — but its own repo.

_Working title:_ **Acorn** (grows a little every day — fits the calm, garden-style
rewards). Alternatives to consider: Sprout, Meadow, Daybook, StepStones. Or let her
name it.

---

## 1. Who it's for & the guiding intent
- One child, one iPhone (single profile — no multi-user complexity).
- **Local-first, privately synced.** localStorage is the fast source of truth and
  the app works fully offline; progress also syncs to a **private** GitHub repo so it
  survives a wiped phone and the parent can see it off-device. No secret ships in the
  app code — see §3a.
- Dyslexia support: the app is a **confidence-and-fluency supplement** to the
  structured phonics she does at school, not a replacement.
- **Calm over gamey.** Progress-based rewards (a growing plant, a filling ring, a
  quiet "nice work"), never points, leaderboards, timers-under-pressure, or
  streak-shaming.

## 2. Principles (non-negotiables)
- **One task on screen at a time.** Minimal chrome.
- **Dyslexia-friendly by default:** off-white/cream background, dark-grey (not black)
  text, large friendly sans-serif, generous letter/word/line spacing, short lines,
  left-aligned (never justified).
- **Multisensory:** everything can be **read aloud** (browser speech synthesis,
  en-AU voice) — see + hear + do.
- **Low pressure:** no anxiety timers; "have another go", not a red cross. Slower
  processing is normal — never punish it.
- **She stays in the sweet spot:** difficulty auto-tunes to ~80% success.

## 3. Tech & hosting (reused from Goal Girls)
_Reference app: `drplce/crush` (single `index.html`; the app is titled "Goal Girls").
Patterns to lift directly: the PWA meta shell (`viewport-fit=cover`, `user-scalable=no`,
`apple-mobile-web-app-capable`, status-bar style, `theme-color`); the iOS audio-unlock
trick (`audioCtx()`/`unlockAudio()` on first user tap — Acorn adds a matching
`speechSynthesis` unlock); the Web Audio tone engine for chimes; the `try/catch`
localStorage save/load; the deploy-bumped build-version stamp in the menu; and the
paste-in JSON import pattern (used there for "Copy game", here for the weekly spelling
list). Note: crush has **no test harness** — Acorn's Playwright rig is fresh work._

- Single `index.html`, inline CSS/JS, no build step.
- State in `localStorage`; installable PWA (add to home screen), works offline.
- Hosted on GitHub Pages, own repo.
- **Speech:** Web Speech API (`speechSynthesis`) — free, no assets; unlock on first
  tap (iOS requirement, same trick as Goal Girls' audio).
- **Sound:** reuse the Web Audio tone engine for soft chimes (no sound files).
- **Testing:** Playwright harness (Chromium) — verify the maths generator's
  correctness AND its difficulty curve, and the spaced-repetition logic, before
  shipping. Build-test-ship rhythm, build stamp in a settings screen.

## 4. Data model (localStorage, one profile)
```
profile:  { name, mathsLevel, createdAt }
maths:    { facts: { "7x8": {seen, right, wrong, lastSeen, box} , ... },  // box = spaced-rep bucket
            sessions: [ {date, asked, right} ] }
words:    { lists: [ {name, words:[...] } ],                              // built-in + pasted school lists
            mastery: { "friend": {right, wrong, box, lastSeen}, ... } }
reading:  { streak, longest, freezes, log: [ {date, title?, note?} ] }
settings: { textScale, tint, readAloud, sound, voice }
```
Everything survives offline. localStorage is authoritative; a small `progress.json`
mirrors this state to a private GitHub repo (see §3a) so nothing is lost with the phone.

---

## 3a. Off-device progress sync (Option A — chosen)
The goal: her progress is durable **off her device** and the parent can see it,
without standing up a backend and without any secret in the public app code.

- **Store:** a small `progress.json` (a few KB) in a **separate private repo** (e.g.
  `learn-data`). This file is the "small db" — JSON, not SQLite, because the data is
  tiny and a queryable engine buys nothing at this scale. The app (public repo `learn`,
  GitHub Pages) carries **no credential**.
- **Write path:** GitHub Contents API. GitHub Pages is static and cannot run a database,
  so the only way to persist off-device is an authenticated API call from the browser.
- **Credential:** a **fine-grained personal access token**, scoped to *only* the private
  data-repo with `contents: read/write`. The parent pastes it into the parent area
  **once**; it is stored only in that phone's localStorage — never in the repo/code.
- **Sync model:** local-first. All reads/writes hit localStorage instantly; a debounced
  background push mirrors state to `progress.json`, and a pull-on-open reconciles
  (last-write-wins on a per-record `lastSeen`/timestamp — single user, so conflicts are
  rare). Offline or token-less → app still works fully; sync silently resumes later.
- **Parent visibility:** read the same file in the app's parent view from any device, or
  just open `progress.json` on GitHub.
- **Upgrade path (not now):** if real multi-device or richer reporting is ever wanted,
  swap the JSON-to-repo store for Cloudflare Workers + **D1** (true SQLite, credential
  held server-side). Clean migration; deliberately deferred.

---

## 5. Modules

### A. Reading streak (build first — smallest, instant daily habit)
- One big friendly tap: **"I read today."** Marks the day done.
- **Calm streak visual:** a plant/garden that grows, or a filling month ring — soft
  milestone moments at 7 / 30 / 100 days. No flames, no guilt.
- **Forgiveness:** a missed day doesn't wipe the streak (a small number of "rest
  days"/freezes) — losing a long streak is a confidence-killer, which defeats the point.
- Optional, one-tap-light logging: book title + a one-line "what happened".
- Read-aloud isn't needed here (she reads a real book aloud) — this just tracks it.

### B. Maths (adaptive drills)
- **Scope (Yr 4/5):** times tables 2–12 and related division; +/− fluency (2–3 digit,
  mental); number bonds to 100; simple fractions later.
- **Adaptive:** targets ~80% success; **spaced repetition** quietly resurfaces the
  specific facts she gets wrong (Leitner boxes) instead of random drilling.
- **Multiple representations:** arrays/ten-frames for ×, number lines for +/−, plus
  optional read-aloud of each question.
- **Calm mechanics:** short sessions (~10–15 questions), no countdown; a gentle chime
  and a growing "correct in a row" that never scolds. Wrong → soft "try again", then
  show the answer with its visual.
- **Self-calibrating (deploy then let the data find the level).** Seed the full 2–12
  fact set, but pre-place the easy anchors (×1, ×2, ×5, ×10, squares, commutative twins)
  in higher Leitner boxes so they surface rarely; the ~80%-success targeting discovers
  her real level from her own answers within a session or two. Australian Curriculum
  context: all facts to 10×10 + related division become automatic in **Year 4**, so the
  likely sticking points are the hard middle facts (**6/7/8**, and 11/12 beyond the
  10×10 grid).
- **Parent starting point is an optional nudge, not required setup** (e.g. "working on
  6/7/8×") — handy to skip babyish facts on day one, but the app converges without it.

### C. Words (spelling + read-aloud)
- **Method:** classic **look → cover → write → check**. Hear the word (speech), see it
  split into **syllables**, then rebuild/type it, then self-check.
- **Content:** built-in Aussie Year 4/5 spelling patterns + tricky/sight words, AND a
  **paste-in box for her weekly school list** (same copy/paste pattern as Goal Girls'
  game data) so it tracks exactly what she's set that week.
- **Dyslexia-first presentation:** big spaced text, cream background, tap-to-hear
  everything, no timer. Spaced repetition on the words she finds hard.

## 6. Parent area (you)
- Lightly gated (a tap-hold or simple PIN).
- Set her name, maths starting level/focus, paste the weekly spelling list.
- Glance at progress: streak, facts mastered, words mastered, recent sessions.
- Toggle read-aloud, sound, text size, background tint.

## 7. Design system
- **Colour:** warm off-white/cream surface, dark slate-grey text, one calm accent
  (soft green/teal for growth), gentle success/retry colours (never harsh red).
- **Type:** large, well-spaced sans-serif; adjustable size; short line lengths.
- **Components:** big rounded tap targets, one primary action per screen, a calm
  home screen with three cards (Read · Maths · Words).
- **Motion:** slow, soft (things grow/fill), nothing flashy.
- Theme-aware and respects reduced-motion.

## 8. Rewards (calm)
- Progress you can *see* accumulating: the garden/ring, mastered-facts count.
- Quiet affirmations personalised with her name.
- Milestones are gentle moments, not confetti-spam. No score to chase, nothing to lose.

## 9. Build phases
1. **Shell + Reading streak** — home screen, profile, the streak tracker with
   forgiveness. Shippable on day one as a daily habit.
2. **Maths** — fact generator + adaptivity + spaced repetition + visuals + read-aloud.
3. **Words** — look-cover-write-check, syllables, built-in lists + paste-in school list.
4. **Sync** — private-repo backup (§3a): token entry in parent area, debounced push,
   pull-on-open reconcile, offline-safe. Slots in once the data model is stable (can
   land alongside phase 1 as soon as there's state worth backing up).
5. **Polish** — parent dashboard, tints/text-size, milestone moments.

Each phase shipped and Playwright-tested on its own, same as Goal Girls.

## 10. Testing
- Maths generator: assert every generated problem is correct and within the target
  band; assert the difficulty curve holds ~80% success in simulation; assert
  spaced-repetition resurfaces missed facts.
- Words: syllable splitting + spaced repetition behave; paste-in import parses.
- Reading: streak counts, forgiveness works, milestones fire once.
- Sync (§3a): push serialises correct JSON; pull-on-open reconciles without clobbering
  newer local records; app stays fully functional with no token / while offline; no
  secret is ever written into the app repo.
- No page errors; installs and runs offline.

## 11. Open decisions (need your steer — sensible defaults noted)
1. **App name** (default: working title "Acorn", or let her choose).
2. **Maths starting point** — which tables/skills is she on right now?
3. **Spelling** — happy with built-in Aussie lists + a weekly paste-in box? (default: yes)
4. **Her name** for personalisation.
5. **Repo name / GitHub Pages URL** for the new project.

## 12. Notes & minor risks
- iOS `speechSynthesis` needs a first user tap to activate; en-AU voice quality varies
  a little by device — acceptable, just flagging.
- Backups are now automatic via §3a (private-repo sync); a manual "copy my progress"
  export (like Goal Girls) is still worth keeping as a belt-and-braces fallback for when
  no token is set.
- Keep it a supplement to school's structured literacy; aim = confidence + daily practice.
