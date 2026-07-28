# learn

A calm, dyslexia-friendly practice app for a Year 4/5 learner — daily reading
streak, adaptive maths drills, and spelling/words practice. Single-file HTML/JS,
offline, installs to the iPhone home screen (same build approach as Goal Girls).

See **PLAN.md** for the full project plan.

_Working title: Acorn._

---

## What's built (Phase 1)

Everything lives in **`index.html`** — inline CSS and one script, no build step.
Open the file in any browser and it works.

- **Home** — three cards: Read · Maths · Words. Maths and Words are marked
  *Soon* and explain themselves when tapped; only Read is live.
- **Reading streak** — one tap, "I read today". A plant grows with the streak
  (seed → sprout → leaves → acorns at 30/60/100 days). Gentle milestone moments
  at 7, 30 and 100 days, each firing once.
- **Forgiveness** — a single missed day never breaks the streak; it's counted as
  a rest day and described kindly. Two missed days in a row starts a fresh run,
  and even then the screen invites a restart rather than reporting a loss.
- **Notes** — optional book title and a one-line "what happened", attached to a
  day that's already been marked.
- **Grown-ups area** — press and hold the build stamp at the bottom (700ms).
  Set her name, read-aloud and sound toggles, five text sizes, five background
  tints, "copy my progress", and a two-tap erase.
- Dark mode, `prefers-reduced-motion`, and iOS safe-area insets are all handled.

### Design rules it follows
Cream surface, dark-slate (never black) ink, one calm accent. Large well-spaced
type, short lines, always left-aligned. One task per screen, big tap targets.
No timers, no points, no leaderboards, nothing to lose.

## Her name and privacy

Her name is entered in the grown-ups area and stored **only in that device's
`localStorage`**. It is not in this repository and never will be. All progress
is local to the phone; automatic backup to a private repo is Phase 4 (PLAN §3a).

## Testing

A Playwright harness (Chromium) covers the streak maths, the UI flows, and
robustness. The app itself needs no toolchain — this is dev-only.

```
npm install
npx playwright test
```

37 tests: streak counting and forgiveness (including a daylight-saving day),
milestones firing exactly once, day rollover, note gating, corrupt/legacy stored
state, text escaping, and "no page errors" across the whole flow.

The config auto-detects a pre-installed Chromium via `PLAYWRIGHT_BROWSERS_PATH`
(or `ACORN_CHROMIUM`) and otherwise falls back to Playwright's own download.

## Install on her phone

Open the hosted URL in Safari, then **Share → Add to Home Screen**. It launches
fullscreen with no browser chrome.

**On offline:** the whole app is one file with no network requests, so once it's
loaded it keeps working without a connection. That's not the same as a
guaranteed-offline PWA — there's no service worker or web manifest yet, so a
cold launch with no network isn't promised, and Android/desktop won't offer a
proper install prompt. Both are two small files to add later if we want them.

## Host it on GitHub Pages

`index.html` is at the repository root, so Pages needs no configuration beyond
being switched on: **Settings → Pages → Source: Deploy from a branch**, pick the
branch, folder `/ (root)`, Save. The app is then live at
`https://<user>.github.io/learn/`.

Note that Pages on a **private** repo needs a paid plan. There are no secrets in
this app, so public is safe — and her name is not in the code.
