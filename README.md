# learn

**Acorn** — a calm, dyslexia-friendly spelling app for a Year 4/5 learner.
One file, no build step, works offline, installs to the iPhone home screen.

Live at `https://drplce.github.io/learn/`. See **PLAN.md** for the wider plan.

---

## What it does

She opens it and she is on a word. There is no home screen, no menu, no score.

- **A word she has never met** — the word is shown with its syllables. She says
  it, traces it, taps **Cover it up**, and writes it from memory.
- **A word she has met** — straight to writing it. Showing it first would make
  it a copying exercise, which is what undoes the benefit of practising.
- **A miss** — she sees the *correct* spelling, never her own attempt, with the
  letters to look at underlined. If she was nowhere near, the word is simply
  shown plainly rather than marked all wrong. It comes back later in the same
  session, from memory.
- **A new word comes back once more the same session**, so its first cold
  retrieval happens while it is still fresh instead of arriving cold the next
  morning.
- **Finishing** — a tick, and how much of the list she knows well.

Nothing is ever lost, nothing is timed, and there is no way to fail a day.

### Grown-ups area

Press and hold the **ACORN** wordmark for 700ms. Her name, which list she is on,
paste in a list from school, the words she is finding hard, read-aloud and sound,
voice and speaking speed, five text sizes, five background tints, copy progress,
two-tap erase. The build stamp is only here — never on her screens.

## How it paces itself

Leitner boxes in elapsed days (`0, 1, 2, 4, 8, 21, 60`). A correct first go
moves a word up one box, once per calendar day. A miss steps it back two boxes
rather than resetting it, so a word she has known for two months becomes a
one-day retry, not a stranger.

The pace follows her, over her last five sessions:

| First-go accuracy | Sitting | New words | Pool |
|---|---|---|---|
| 85%+ | 9 words | up to 3 | 3 |
| 70–85% | 8 words | 1 | 2 |
| under 70% | 6 words | none | 2 |

New material never exceeds a third of a sitting; the rest is words she can
already spell. That ratio is what holds the success rate where practice sticks
(~80–85%). Her very first night is the one exception: three new words, nothing
else.

## Her name and privacy

Her name is entered in the grown-ups area and stored **only in that device's
`localStorage`**. It is not in this repository and never will be. All progress
is local to the phone; backup to a private repo is still to do (PLAN §3a).

## Testing

Three harnesses, all dev-only — the app itself needs no toolchain.

```
npm install
npx playwright test      # 65 tests: the app as a child and a parent use it
node tests/sim.js        # pacing simulation: real engine, modelled learners
node tests/break.js      # adversarial pass: try to break it
```

**`tests/sim.js`** runs the shipped engine in a real browser against a cohort of
twelve learners of differing ability and luck, because reading the code and unit
testing it both missed real defects that simulation caught. Latest, 60 days over
an 86-word list: **87.0% right first time** (worst learner 85.4%), **82% of each
sitting words she already knows**, 8.3 words a sitting, 56 of 86 words known
well, and half a day per learner below 50% right.

**`tests/break.js`** hammers buttons, double-taps Check, submits empty and junk
answers, corrupts stored state, goes offline, reloads mid-word, rolls midnight
over mid-session, and runs a hundred days unattended. It exits non-zero on any
finding. It has already caught two real defects — blind tapping used to record
an empty box as a miss on every word.

The Playwright config auto-detects a pre-installed Chromium via
`PLAYWRIGHT_BROWSERS_PATH` (or `ACORN_CHROMIUM`), otherwise falls back to
Playwright's own download.

## Reading and the book chat

An earlier build had a daily reading streak with a growing plant, and an AI chat
about what she'd read. Both are preserved verbatim in
**`reference/reading-and-chat.html`**, with a banner naming exactly which
functions to lift if they come back. `worker/` is the Cloudflare Worker that
held the chat's API key; it is not used by the current app.

## Install on her phone

Open the hosted URL in Safari, then **Share → Add to Home Screen**. It launches
fullscreen with no browser chrome.

iOS caches home-screen web apps hard. After a push, if the old build is still
showing, remove it from the home screen and re-add it.

**On offline:** the whole app is one file with no network requests, so once it's
loaded it keeps working without a connection. That's not a guaranteed-offline
PWA — there's no service worker or web manifest, so a cold launch with no
network isn't promised, and Android/desktop won't offer a proper install prompt.
Both are two small files to add if we want them.

## Host it on GitHub Pages

`index.html` is at the repository root, so Pages needs no configuration beyond
being switched on: **Settings → Pages → Source: Deploy from a branch**, pick
`main`, folder `/ (root)`, Save.

Pages on a **private** repo needs a paid plan. There are no secrets in this app,
so public is safe — and her name is not in the code.

## Recorded audio

Safari only exposes the handful of voices built into iOS. Voices downloaded under
Accessibility → Spoken Content are not available to a web page, so the phone
voice cannot be improved from inside the app. Studio clips are recorded once,
committed, and used in preference; anything without a clip — a list a grown-up
pastes in — falls back to the phone voice, so she never meets silence.

    node tools/phrases.mjs                       # what needs recording, from the app itself
    GOOGLE_TTS_KEY=... node tools/voice.mjs      # record it, write audio/, update index.html

Google Cloud is the recommendation: it has real en-AU Neural2 voices, and the
whole job is about 1,500 characters against a free allowance of a million a
month. To get a key: console.cloud.google.com → create or pick a project →
enable "Cloud Text-to-Speech API" → APIs & Services → Credentials → Create
credentials → API key. Restrict it to that one API.

Azure works too and is also free at this size. ElevenLabs needs a paid plan —
its free tier has no API access.

Audition before committing to 181 clips:

    GOOGLE_TTS_KEY=... ACORN_ONLY=because,friend,said node tools/voice.mjs
    ACORN_VOICE=en-AU-Neural2-A GOOGLE_TTS_KEY=... ACORN_ONLY=because ACORN_FORCE=1 node tools/voice.mjs

en-AU-Neural2-A and -C are female, -B and -D male. The key is only ever read
from the environment on the machine doing the recording — this repo is public
and must never contain one. Only the mp3 files and the inline index are
committed.

The index of what is recorded lives inline in `index.html`, so playback costs no
request, cannot 404 on a half-finished deploy, and works with no network.
