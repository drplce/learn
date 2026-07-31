# Home-Screen Web Apps on iPhone — an Apple-first reference

**Scope:** iOS/iPadOS Safari + WebKit, a web page **added to the Home Screen and launched from the icon** ("standalone" web app). Target device: recent iPhone, iOS 17/18 era (Acorn's phone is on iOS 18.7). Android/Chrome/desktop appear only as a one-line contrast where it clarifies an iOS limitation.

**About Acorn:** a single-file `index.html` spelling app for one dyslexic nine-year-old, served from GitHub Pages, added to the Home Screen, used entirely by touch. It is keyboard-heavy (she types spellings into a text box), must feel native, must work offline, must keep her progress durably, and leans on `speechSynthesis`. It currently ships the Apple meta tags below but **no manifest and no service worker**.

Current `<head>` (verified in `/home/user/learn/index.html`, lines 4–23):

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Acorn">
<meta name="theme-color" content="#FBF6EC" media="(prefers-color-scheme:light)">
<meta name="theme-color" content="#22242A" media="(prefers-color-scheme:dark)">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
```

It already tracks `visualViewport` and reserves a keyboard inset band (lines 2169–2223). So the head is close to right; the two real gaps are **a manifest** and **durable storage / offline**.

---

## 1. Add-to-Home-Screen and "install"

**iOS has no install prompt and no install API.** There is no `beforeinstallprompt` event (that is Chromium-only), no `navigator.install`, and no way for a page to trigger, request, or programmatically open the install flow. Installing is a manual, Apple-controlled gesture:

> Safari → **Share** sheet → **Add to Home Screen** → Add.

- The user must be in **Safari itself** — not an in-app browser (the WebView inside Instagram, Gmail, etc. does *not* show "Add to Home Screen"), and historically not Chrome/Firefox for iOS either (third-party iOS browsers gained the ability to add Home Screen web apps only in iOS 16.4, and only Safari's shortcut launches in true standalone).
- iOS does **not** gate "Add to Home Screen" on any installability criteria. Unlike Android/Chrome (which requires a manifest + service worker + HTTPS before it will offer install), **any** web page can be added to the iOS Home Screen. A manifest and service worker change *how the installed app behaves*, not *whether* it can be installed.
- The most you can do is **teach** the user: detect that you are in Safari and not yet standalone (`!navigator.standalone`) and draw an on-screen hint pointing at the Share icon. You cannot detect whether the app is already installed, cannot open the Share sheet, and cannot confirm the add succeeded.

Contrast (one line): on Android/Chrome a manifest + service worker earns an automatable install prompt; **none of that machinery exists on iOS.** Sources: [web.dev PWA manifest](https://web.dev/learn/pwa/web-app-manifest), [firt.dev iOS PWA notes](https://firt.dev/notes/pwa-ios/).

---

## 2. The Web App Manifest — what iOS actually reads

iOS Safari has supported a **partial, undocumented** subset of the manifest since ~2018 (iOS 11.3), expanded around iOS 15.4. It is genuinely worth adding a manifest, but **Apple meta tags still win** where the two overlap, and several manifest fields are silently ignored on iOS. Sources: [firt.dev iOS PWA](https://firt.dev/notes/pwa-ios/), [MDN theme_color](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/theme_color), Apple Developer Forums.

| Manifest field | iOS Home-Screen behaviour |
|---|---|
| `name` / `short_name` | **Partial.** Read for the icon label, but `apple-mobile-web-app-title` overrides and is the reliable source of the Home Screen label. |
| `icons` | **Partial.** iOS prefers `apple-touch-icon`. Manifest icons are used as a fallback and for the app-switcher in newer versions; do not rely on them alone. |
| `display` | **Partial.** `standalone`, `fullscreen`, and `minimal-ui` all render the same as `standalone` on iPhone; only `browser` opts out of standalone. See §4. |
| `display_override` | **Ignored.** |
| `start_url` | **Respected.** Sets the URL launched from the icon. Relative to manifest location. |
| `scope` | **Partial / weak.** iOS uses it loosely to decide when to stay in standalone vs. hand a link to Safari; do not depend on strict scope enforcement. |
| `id` | **Ignored** on iOS (matters for Chromium install identity only). Harmless to include. |
| `orientation` | **Ignored on iPhone.** You cannot lock orientation from a Home Screen web app (see §8). |
| `theme_color` | **Ignored** for the installed app. Status-bar colour comes from `apple-mobile-web-app-status-bar-style` + the page's own background. |
| `background_color` | **Ignored** for splash. iOS splash comes from `apple-touch-startup-image`, not this field. |
| `shortcuts` | **Ignored.** No long-press Home Screen shortcut menu for web apps. |
| `categories` | **Ignored** (store metadata only; no iOS effect). |
| `launch_handler` | **Ignored.** |
| `lang` / `dir` | Cosmetic; no meaningful standalone effect. |

**Bottom line:** put a manifest in for correctness, forward-compat, and non-Safari browsers, but understand that on *this iPhone* the Apple meta tags in §3 are doing the real work. The one manifest field that reliably earns its keep on iOS is `start_url`.

Minimal manifest that is safe and sufficient for Acorn (see §11 for the recommended file):

```json
{
  "name": "Acorn",
  "short_name": "Acorn",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#FBF6EC",
  "theme_color": "#FBF6EC",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Note the **relative** `start_url`/`scope` — essential on GitHub Pages project sites, which serve from a subpath like `/repo/` (see §9, §11).

---

## 3. Apple-specific meta tags (still required on iOS)

Because iOS under-implements the manifest, these tags remain load-bearing. Sources: [Apple: Configuring Web Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html), [firt.dev](https://firt.dev/notes/pwa-ios/), [web.dev enhancements](https://web.dev/learn/pwa/enhancements).

- **`apple-mobile-web-app-capable` = yes** — the switch that makes launching from the icon run in **standalone** (no Safari chrome). Without it the icon opens an ordinary Safari tab. `mobile-web-app-capable` is the standardised equivalent that Chromium reads; **keep both** — iOS reads the `apple-` one. (Some tooling now warns that the `apple-` tag is "deprecated" in favour of the manifest `display`; on real iPhones it is still the reliable trigger. Treat that warning as premature.)
- **`apple-mobile-web-app-title` = Acorn** — the Home Screen label. Overrides `<title>` and manifest `name`.
- **`apple-mobile-web-app-status-bar-style`** — only has any effect when `apple-mobile-web-app-capable=yes`. Three values:
  - `default` — opaque status bar, dark text on a light bar; the web content starts **below** the status bar. Simplest; the bar's tint follows the top of your page.
  - `black` — opaque black status bar; content starts below it.
  - `black-translucent` — the status bar becomes **transparent**, content is drawn **full-height behind it** (you get the whole screen), and the clock/battery are drawn in **white**. This is the only value that gives you the full viewport under the notch — but it means you **must** pad your top UI with `env(safe-area-inset-top)` or the clock overlaps your header. See §5.
  - Reality check for Acorn's cream UI: `black-translucent` would paint white system text over a cream bar (unreadable). `default` is correct for a light app.
- **`apple-touch-icon`** — the Home Screen tile. Requirements/quirks:
  - Provide a **180×180 PNG** (2×/3× iPhone). iOS accepts a single 180×180 and downscales.
  - Must be **fully opaque** — iOS composites alpha to **black**, then applies its **own** rounded-corner mask and shine. Ship a square, opaque PNG; do not pre-round it.
  - iOS **snapshots the icon when the shortcut is created and never re-fetches it.** Changing the file does nothing to a phone that already has the app installed — the user must delete and re-add. (Acorn's own head comment already documents this, lines 13–21.)
  - `data:` URIs are **not reliably honoured** for `apple-touch-icon`; it must be a real file next to the page. (Acorn already does this.)
- **`apple-touch-startup-image`** — the launch splash (see §3a).
- **`theme-color`** — read by Safari's *browser* UI (address-bar tint), and honoured per `prefers-color-scheme` via the `media` attribute (which Acorn already does). For the *installed standalone* app its effect is minimal/ignored; harmless to keep. Note a 2024 WebKit change: recent Safari leans on the page's actual background (and `position:fixed` top elements) for bar colour rather than the `theme-color` meta.
- **`format-detection` = telephone=no** — stops iOS auto-linking number strings as phone links. Worth adding for a spelling app so digit runs in content don't turn blue/tappable.

### 3a. Splash screens (`apple-touch-startup-image`)

iOS does **not** generate a splash from the manifest `background_color`/`icons` the way Android does. If you want anything other than a blank launch screen you must supply **`<link rel="apple-touch-startup-image">` images, one per device resolution**, gated by `media` queries on `device-width`/`device-height`/`-webkit-device-pixel-ratio`/orientation. This is tedious (a dozen+ images) and generators exist ([Progressier's generator](https://progressier.com/pwa-icons-and-ios-splash-screen-generator)). Without them, launch shows a blank screen tinted by your page/background — which for Acorn (cream, instant-loading single file) is perfectly acceptable. **Recommendation: skip per-device splash images; not worth the maintenance for one child's app.** Source: [Apple Developer Forums 733490](https://developer.apple.com/forums/thread/733490), [firt.dev](https://firt.dev/notes/pwa-ios/).

---

## 4. Chrome removal / native feel — how far it goes

With `apple-mobile-web-app-capable=yes` and launched from the icon, **standalone** mode removes:
- the address/URL bar,
- the Safari toolbar (back/forward/share/tabs at the bottom),
- the tab UI entirely.

What **remains and cannot be removed**:
- the **system status bar** (clock, battery, signal). You can style it (§3) or draw behind it (`black-translucent`) but never hide it in a web app.
- the **Home indicator** (the bar at the bottom on Face ID iPhones). Always present; reserve space with `env(safe-area-inset-bottom)`.
- there are **no back/forward controls** in standalone — you own navigation. A dead-end with no in-app "back" traps the user (fine for Acorn, which is a single screen-flow app).

Detection:
- **`navigator.standalone`** — iOS-only boolean; `true` when launched from the Home Screen icon in standalone. This is the reliable iOS signal. (Non-standard, iOS-only, but still shipping.)
- **`window.matchMedia('(display-mode: standalone)').matches`** — the standards way; **works on iOS** in standalone and is the cross-browser check. Use both: `navigator.standalone || matchMedia('(display-mode: standalone)').matches`.

**Display modes on iPhone:** `standalone`, `fullscreen`, and `minimal-ui` all render identically to `standalone` (you do *not* get an extra-immersive fullscreen that hides the status bar). Only `browser` opts back into Safari chrome. There is no way to a get a truly chromeless, status-bar-hidden view from a web app.

**Fullscreen API:** historically **unsupported on iPhone** for arbitrary elements — only `<video>` could go fullscreen (`webkitEnterFullscreen`). Element `requestFullscreen()` began landing on iPhone only in **Safari 17.4+** and is still not something to rely on. On iPadOS it has worked longer. For a standalone Home Screen app it is largely moot — you already have the whole screen minus the status bar. **Do not build Acorn around the Fullscreen API.** Sources: [caniuse fullscreen](https://caniuse.com/fullscreen), [WebKit bug 212934](https://bugs.webkit.org/show_bug.cgi?id=212934).

---

## 5. Viewport and safe areas

- **`viewport-fit=cover`** (already set) is what lets your content extend into the notch/Home-indicator regions; without it iOS letterboxes the page inside the safe area. Once you set `cover`, **you** are responsible for insets.
- **`env(safe-area-inset-top/right/bottom/left)`** — use these for padding so nothing hides under the notch, the (translucent) status bar, or the Home indicator. In `default` status-bar mode the top inset is small; in `black-translucent` the top inset equals the status-bar height and is essential.
- **Viewport height units:**
  - `100vh` = the **largest** possible viewport (ignores browser UI). In *standalone* there is no address bar to collapse, so `100vh` is stable — unlike in-Safari where `100vh` overshoots because it assumes the toolbar is hidden.
  - `100dvh` = **dynamic** viewport; tracks the currently visible area. Widely the right default.
  - `svh`/`lvh` = small/large viewport extremes.
  - **Crucial keyboard caveat:** on iOS **none of `vh`/`dvh`/`svh`/`lvh` shrink when the software keyboard appears.** The keyboard does **not** change the layout viewport in a standalone web app; it overlays. So `100dvh` stays full-height with the keyboard up. This is exactly why Acorn drives layout from `visualViewport` instead of CSS height units (see §6). Source: [gist claus/iOSViewport](https://gist.github.com/claus/622a938d21d80f367251dc2eaaa1b2a9).
  - `-webkit-fill-available` is an old workaround for the in-Safari `100vh` problem; it is **not** a keyboard fix and behaves inconsistently in standalone. Prefer `dvh` + `visualViewport`.
- **`visualViewport` API** — supported on iOS and the single most useful tool here. `visualViewport.height` shrinks by the keyboard's height; `visualViewport.offsetTop`/`pageTop` tell you how far the visual viewport has been pushed. This is the correct signal for "how much room is left above the keyboard" — which is exactly what Acorn's `fitViewport()` already uses.

---

## 6. The software keyboard (the live pain point)

### How it behaves in standalone

On iOS, when the on-screen keyboard opens in a **standalone** Home Screen web app:
- It **overlays** the content. The **layout viewport does not resize**, `window.innerHeight` does not change, and CSS `100dvh`/`100vh` stay full-height. Only the **visual viewport** shrinks (`visualViewport.height` drops by roughly the keyboard height). This is different from many people's mental model and different from some Android behaviour. Source: [claus/iOSViewport gist](https://gist.github.com/claus/622a938d21d80f367251dc2eaaa1b2a9), [dev.to visualViewport](https://dev.to/franciscomoretti/fix-mobile-keyboard-overlap-with-visualviewport-3a4a).
- Because the layout viewport is unchanged, a fixed footer at `bottom:0` ends up **behind** the keyboard unless you translate it up by the keyboard inset — which you compute from `visualViewport`. (Acorn already reserves this band.)
- `visualViewport.offsetTop` reflects any scroll iOS applied to bring the focused field into view. **Known bug (iOS 26 betas):** `offsetTop` may not reset to 0 when the keyboard dismisses, leaving fixed headers/footers misaligned — worth guarding against by re-measuring on `blur`/`focusout`.

### The input accessory bar (‹ › + Done / QuickType strip) — definitive answer

**You cannot remove or alter the input accessory bar from web content. Full stop.** The bar above the keyboard — the previous/next chevrons and **Done** button, plus the QuickType suggestion strip — is drawn by UIKit, not by the page. There is **no web API, meta tag, CSS property, or `inputmode` value** that removes it from Safari or from a standalone Home Screen web app.

- The only way to suppress it is in a **native wrapper** (a Cordova/Capacitor/WKWebView app overriding `inputAccessoryView`), which Acorn is not and should not become.
- Occasionally-cited "hacks" (toggling `inputmode`, focus tricks) are unreliable, version-fragile, and break real typing. Do not ship them.
- The QuickType suggestions row *can* be dismissed by the **user** (drag it down), but not by the page, and it returns on next focus.

Sources: [Apple Developer Forums 4664 "Disable Keyboard Shortcut Bar?"](https://developer.apple.com/forums/thread/4664), [Ionic Keyboard guide](https://ionicframework.com/docs/developing/keyboard) (states the accessory bar can only be hidden via the native plugin, not from web/PWA), [technetexperts](https://www.technetexperts.com/hide-ios-input-bar/), [codestudy](https://www.codestudy.net/blog/remove-form-assistant-from-keyboard-in-iphone-standalone-web-app/). **For Acorn: design the writing screen assuming ~44px of Done/QuickType bar plus the keyboard are always eating the bottom of the screen. Do not try to remove it.**

### Why the page still drags/rubber-bands while the keyboard is up — and the real fix

The frustrating part: even with `html, body { overflow: hidden; overscroll-behavior: none; }`, in **standalone** with the keyboard up you can still drag the whole page around and rubber-band it. Reasons:
1. iOS scrolls the **document** to bring the focused input into view; that scroll offset is real and draggable.
2. `overflow:hidden` on `html`/`body` does **not** fully disable the document pan gesture on iOS the way it does elsewhere; WebKit still lets the user drag the layout viewport (this is a long-standing iOS behaviour, and it *returns* specifically in standalone even when it seemed fixed in Safari). Source: [amolk rubberband gist](https://gist.github.com/amolk/1599412), [pqina: prevent scrolling iOS Safari](https://pqina.nl/blog/how-to-prevent-scrolling-the-page-on-ios-safari/), [iNoBounce](https://github.com/asos-dominicjomaa/iNoBounce).
3. `overscroll-behavior:none` only governs scroll **chaining**; it does not stop the top-level rubber-band on iOS (Safari's support for it as a bounce-suppressor is weak/absent).

**Techniques, ranked by what actually works on current iOS:**

1. **Lock the document to a fixed shell (most reliable).** Make the app's root a non-scrolling fixed container and never let the document itself scroll:
   ```css
   html, body { height: 100%; overflow: hidden; overscroll-behavior: none; }
   body { position: fixed; inset: 0; width: 100%; }  /* pins the layout viewport */
   ```
   Put any scrollable region in an **inner** element with `overflow-y:auto`. If the document has nothing to scroll, iOS has nothing to drag. For a **single-screen** app like Acorn where everything fits (no long scroll), this is the clean answer: the writing screen never needs to scroll, so lock it.
2. **`touchmove` `preventDefault()` gated to non-scrollable targets.** Add a non-passive listener; call `preventDefault()` when the touch is on the body/an element that has no scrollable overflow, and allow it inside genuinely scrollable inner containers (checking scrollTop bounds to avoid trapping):
   ```js
   document.addEventListener('touchmove', function (e) {
     if (!e.target.closest('.scrollable')) e.preventDefault();
   }, { passive: false });
   ```
   Caveat: **`{passive:false}` is required** or `preventDefault` is ignored, and behaviour around iOS 15 changed (some `touchmove` prevention that worked pre-15 was weakened), so combine with technique 1 rather than relying on it alone. Source: [pqina](https://pqina.nl/blog/how-to-prevent-scrolling-the-page-on-ios-safari/).
3. **Keep the focused input inside the visible band yourself** (drive position from `visualViewport`) so iOS never feels the need to scroll the document to reveal it. If the input is already above the keyboard, iOS won't pan. This is Acorn's existing strategy and it is the right one — pairing it with technique 1 removes the residual drag.
4. **`interactive-widget` viewport value — does NOT help on iOS** (see §10; unsupported in WebKit).
5. `-webkit-fill-available` — **not** a scroll fix; skip.

**For Acorn specifically:** the writing screen is a single non-scrolling panel. Apply technique 1 (fixed body / no document scroll) plus keep the input above the keyboard via `visualViewport` (already done). That eliminates the drag. Reserve the scrollable-inner pattern only for the long "grown-ups" settings screen.

---

## 7. Offline and storage durability (critical for her data)

### The engines
- **`localStorage`** — supported, synchronous, ~5 MB/origin. Fine for Acorn's small JSON progress blob (which is what it already uses).
- **`IndexedDB`** — supported; larger, async. Overkill for Acorn unless the audio clips grow large.
- **Cache API + service worker** — supported since iOS 11.3; used for offline asset caching (see §9).
- **`sessionStorage`** — per-tab, wiped on close; not for durable data.

### The 7-day eviction rule — and the Home-Screen exemption
Since **iOS/iPadOS 13.4 / Safari 13.1**, WebKit caps **all script-writable storage** (localStorage, IndexedDB, Cache API, service-worker registrations, etc.) at **7 days of Safari use without interaction with the site** — after which it is deleted. This is the rule that terrifies PWA authors.

**The exemption that matters for Acorn:** WebKit's own storage-policy post states that **Home-Screen web apps are not part of Safari and keep their own separate "days of use" counter**, which only advances when the *web app itself* is used. In practice a Home-Screen-installed app is **not subject to the 7-day Safari-inactivity eviction** the way an ordinary Safari tab is — her data survives as long as she keeps using the installed app, and the counter doesn't tick while she isn't. Sources: [WebKit: Updates to Storage Policy (Sept 2023)](https://webkit.org/blog/14403/updates-to-storage-policy/), [WebKit: original ITP storage cap](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/), [web.dev storage-for-the-web](https://web.dev/articles/storage-for-the-web).

> **Caveat / honest uncertainty:** the "installed apps are exempt" language is what Apple published, but Apple's wording is loose ("these apps still run in WebKit") and there are scattered field reports of installed-app data loss on older iOS. The robust move is to *also* request persistent storage (below) **and** keep an export/backup path (below). Belt and braces.

### `navigator.storage.persist()` / `.persisted()` / `.estimate()`
- On iOS Safari, `navigator.storage.persist()` **only grants persistence when the app is a Home-Screen web app.** In a normal Safari tab it returns `false`. Installed, it returns `true`. Source: [Schickling/TIL](https://x.com/schickling/status/1753417758518173947), [WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/), [MDN persist()](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist).
- Once an origin is in **persistent** mode, it is **exempt from time-based eviction** (it can still be dropped under genuine device storage pressure, but not by the 7-day timer). This is the strongest durable-storage guarantee iOS offers a web app.
- `navigator.storage.estimate()` works and reports usage/quota (approximate on WebKit).
- **Do call `persist()`** — for an installed app it flips durability on, and it's a one-liner. Call it early, after first user interaction.

### What actually keeps her spelling progress alive for weeks
1. **Be installed to the Home Screen** (she already is) → off Safari's 7-day timer.
2. **Call `navigator.storage.persist()`** on load → persistent mode → exempt from timed eviction.
3. **Keep writing to `localStorage`** (small, synchronous, reliable) — she already does.
4. **Provide an export/import** (a "save a copy" that produces a text/JSON file, or a copy-to-clipboard of the progress blob) so a wipe is recoverable. Acorn already has import/export plumbing around the storage key (lines 3150–3170).

### The unavoidable risks (not fixable by any web API)
- **Settings → Safari → "Clear History and Website Data"** wipes web-app storage too. A parent tapping this loses her progress. No web app can prevent it.
- **Deleting the Home-Screen icon** deletes the app's data.
- **Reinstalling iOS / erasing the phone** — web-app storage is **not** included in iCloud/iTunes device backups in a restorable way. Treat her progress as *not backed up by the OS*. → the export path in (4) is the only real backup.

---

## 8. Web APIs in iOS standalone — availability table

Legend: ✅ works · ⚠️ partial/quirky · ❌ not available on iPhone.

| API / capability | iPhone standalone status | Notes |
|---|---|---|
| **Service Worker** | ✅ (iOS 11.3+) | Works in standalone. Aggressive caching of the SW file; scope = its folder. §9. |
| **Cache API** | ✅ | Subject to storage eviction rules (§7). |
| **localStorage / IndexedDB** | ✅ | Durability per §7. |
| **`navigator.storage.persist()`** | ⚠️ | Grants only when Home-Screen-installed; then durable. §7. |
| **SpeechSynthesis (TTS)** | ⚠️ | Works, but: `getVoices()` is async/often empty until `voiceschanged`; **first `speak()` must be in a user gesture**; **speech breaks if the app is backgrounded mid-utterance** (needs a re-tap/relaunch). §8a. |
| **Web Audio / `<audio>` playback** | ⚠️ | AudioContext starts **suspended**; must `resume()` inside a user gesture (tap). Autoplay with sound is blocked. |
| **Web Push / Notifications** | ⚠️ | **Only** in Home-Screen-installed apps, **iOS 16.4+**; permission must come from a user gesture. §8b. |
| **Badging API** | ⚠️ | iOS 16.4+, installed apps only. |
| **Screen Wake Lock** | ⚠️ | iOS 16.4+ in **Safari**, but reported **not** to work in **installed** web apps in early 16.4 — do not rely on it keeping Acorn's screen awake. |
| **Vibration API** | ❌ | `navigator.vibrate` is **not supported** on iOS at all (Safari or standalone). No haptics from web. |
| **Fullscreen API (elements)** | ❌→⚠️ | Not on iPhone until Safari 17.4+; irrelevant in standalone anyway. §4. |
| **Screen Orientation lock** | ❌ | `screen.orientation.lock()` and manifest `orientation` are **ignored on iPhone**. Cannot force portrait. |
| **Web Share (`navigator.share`)** | ✅ | Share sheet works, incl. sharing files (from a user gesture). |
| **Web Share Target** (receiving shares) | ❌ | Manifest `share_target` not supported. |
| **File System Access API** | ❌ | `showOpenFilePicker`/`showSaveFilePicker` unsupported. Use `<input type=file>` (read) + download links / Web Share (write). |
| **Clipboard write (`navigator.clipboard.writeText`)** | ⚠️ | Works from a user gesture; good enough for a "copy progress" backup button. |
| **Geolocation / Camera / Mic** | ✅ (with prompt) | Not relevant to Acorn. |
| **`beforeinstallprompt` / install API** | ❌ | Chromium-only; never on iOS. §1. |
| **Background Sync / Periodic Sync** | ❌ | Not supported on iOS. |
| **`interactive-widget` viewport** | ❌ | Not supported in WebKit. §10. |

### 8a. SpeechSynthesis (Acorn relies on this)
- **`getVoices()` returns `[]` on first call** and populates asynchronously — you must listen for `speechSynthesis.onvoiceschanged` and re-query. (Acorn already wires `onvoiceschanged`, line 1164, and calls `getVoices()`, line 1142.) Good.
- **The first `speak()` must occur inside a user gesture** (tap/keypress). After one gesture-initiated utterance, later `speak()` calls from timers work. Make sure the very first word she hears is triggered by her tap, not by page load.
- **Voice availability is limited and not selectable in the way desktop is;** on iOS you often get the system default. Filtering by language (Acorn does, line 865) is the right approach; don't assume a specific named voice exists.
- **Backgrounding kills in-progress speech.** If she switches apps or the screen locks mid-utterance, the synth can get stuck; guard with `speechSynthesis.cancel()` on `visibilitychange`/before each new utterance (Acorn already calls `cancel()` before speaking, lines 1088/1096/1114/1125).
- Sources: [weboutloud: Speech Synthesis in Safari](https://weboutloud.io/bulletin/speech_synthesis_in_safari/), [talkrapp: Lessons learned with speechSynthesis](https://talkrapp.com/speechSynthesis.html).

### 8b. Web Push detail (iOS 16.4+)
Even though Acorn doesn't need push, the rule is instructive: on iOS, Web Push/Notifications work **only** when the site has been **added to the Home Screen** and launched as a web app, on **iOS/iPadOS 16.4 or later**, and the permission request must be made **in direct response to a user tap**. A regular Safari tab cannot receive web push on iPhone. Source: [WebKit: Web Push for Web Apps on iOS and iPadOS (May 2023)](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

---

## 9. Service-worker strategy for a single-file app on GitHub Pages

A service worker is **not required** for Acorn to be installed or to run — but it is the only way to make the app open reliably **offline** and to guarantee she gets the file without a network round-trip. For one HTML file it's a small, well-contained add.

### The GitHub Pages subpath trap
A GitHub Pages **project** site serves from `https://USER.github.io/REPO/`. Therefore:
- Register with an explicit path and **let scope default to the SW's folder**:
  ```js
  navigator.serviceWorker.register('sw.js');   // scope = the folder sw.js sits in
  ```
- Put `sw.js` **at the same directory level as `index.html`** (repo root that Pages serves), so its scope covers the app. A worker can only control pages at or below its own path — you cannot widen scope above the SW's folder without the `Service-Worker-Allowed` header, which **GitHub Pages does not let you set.** So: SW next to `index.html`, use **relative** URLs everywhere.
- Use **relative** `start_url`/`scope` in the manifest (`./index.html`, `./`) so the same file works at `/REPO/` without hard-coding the repo name.

### Minimal offline cache for one file
```js
// sw.js
const VERSION = 'acorn-v1';                    // bump this to ship an update
const ASSETS = ['./', './index.html', './apple-touch-icon.png',
                './icon-192.png', './icon-512.png', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();                           // activate the new SW immediately
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  // network-first for the HTML so updates land; cache fallback for offline
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
```
```js
// in index.html, after first paint:
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}
```

### The "stuck old version" problem (the #1 SW pitfall on iOS)
- Safari caches the **SW script itself** aggressively. The browser only adopts a new worker when the **byte content of `sw.js` changes** — so you **must bump `VERSION`** (or any byte) on every deploy, or the update never installs.
- Without `skipWaiting()` + `clients.claim()`, a new SW waits until **all** tabs of the app close before activating — on a single-window standalone app that can mean she's stuck on the old cached HTML for a long time. The snippet above forces immediate takeover.
- Use **network-first for the navigation/HTML** (as above) so a live update is fetched when online and only falls back to cache offline. This avoids the classic "I deployed but she still sees last week's app" trap.
- Because Acorn is essentially one self-contained file, the caching surface is tiny and low-risk. **A service worker is worth adding** purely for guaranteed offline launch.

Sources: [MDN Using Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers), [C. Heilmann: GitHub Page → PWA](https://christianheilmann.com/2022/01/13/turning-a-github-page-into-a-progressive-web-app/), [web.dev service workers](https://web.dev/learn/pwa/service-workers).

---

## 10. `interactive-widget` in the viewport meta

`interactive-widget` is a viewport-meta value controlling how on-screen widgets (the keyboard) affect the viewports:
- `resizes-visual` (default) — keyboard shrinks the **visual** viewport only.
- `resizes-content` — keyboard shrinks **both** visual and **layout** viewports (this is the value people want, so `100dvh`/fixed footers "just work" with the keyboard).
- `overlays-content` — keyboard resizes **nothing**.

**iOS/WebKit does not support `interactive-widget` at all.** It ships in Chrome 108+ and Firefox 132+; WebKit has only a standards-position issue open ([WebKit/standards-positions#65](https://github.com/WebKit/standards-positions/issues/65)). So `interactive-widget=resizes-content` **will not help Acorn on the iPhone** — it is silently ignored. Include it harmlessly for non-iOS if you like, but do not expect it to fix the keyboard/scroll behaviour on her phone; the `visualViewport` + fixed-body approach in §6 is the iOS answer. Sources: [HTMHell: interactive-widget](https://www.htmhell.dev/adventcalendar/2024/4/), [bramus explainer](https://github.com/bramus/viewport-resize-behavior/blob/main/explainer.md), [W3C CSS Viewport Module](https://www.w3.org/TR/css-viewport-1/).

---

## (A) What Acorn should do — concrete, minimal

**1. Keep the head as-is, add three small things.** The current Apple tags are correct for a light app. Add `format-detection`, a manifest link, and (optionally) the manifest's non-iOS twins:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Acorn">
<meta name="format-detection" content="telephone=no">
<meta name="theme-color" content="#FBF6EC" media="(prefers-color-scheme:light)">
<meta name="theme-color" content="#22242A" media="(prefers-color-scheme:dark)">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">
```

**2. Add a tiny manifest** (`manifest.webmanifest`, relative URLs for GitHub Pages) — the §2 JSON above. On iOS it mainly gives you a clean `start_url`; it costs nothing and future-proofs. Provide `icon-192.png` and `icon-512.png` (opaque) alongside the existing `apple-touch-icon.png`.

**3. Make storage durable — two lines, high value.** After first user interaction:
```js
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
```
Being Home-Screen-installed already takes her off Safari's 7-day timer; `persist()` puts the origin in persistent mode (exempt from timed eviction). Combined with the existing `localStorage` writes, this is what makes her progress survive weeks.

**4. Keep/《strengthen the export backup.** The `localStorage` blob is her only copy and the OS does not back it up. Ensure the "grown-ups" screen has a one-tap **export** (download or copy-to-clipboard of the JSON) and an **import**, so a `Clear Website Data`, an OS wipe, or a new phone is recoverable. (Plumbing already exists near lines 3150–3170; surface it as an obvious button.)

**5. Add a small service worker** (`sw.js` next to `index.html`, §9) for guaranteed **offline launch**, with `skipWaiting()`/`clients.claim()`, a bumped `VERSION` per deploy, and **network-first for the HTML** so updates aren't stuck. Worth it: she uses it offline and you avoid the "old version" trap.

**6. Kill the keyboard-up page drag** with the §6 technique 1 on the writing screen: lock the document (`body { position: fixed; inset: 0 }`, `html,body{overflow:hidden;overscroll-behavior:none}`) so there is nothing to pan, and keep the input above the keyboard via the existing `visualViewport` logic. Add a gated `touchmove` `preventDefault` (`{passive:false}`) as belt-and-braces. Do **not** add `interactive-widget` expecting it to help on iOS.

**7. Speech: ensure the first utterance is tap-triggered**, keep the `voiceschanged` re-query and the `cancel()`-before-`speak()` pattern (already present), and re-`cancel()` on `visibilitychange` so backgrounding doesn't leave the synth stuck.

Splash images: **skip** (not worth per-device maintenance). Orientation lock, vibration, wake lock, fullscreen: **don't build on them** (see below).

## (B) Impossible on iOS — stop chasing

- **Removing the keyboard's input accessory bar** (‹ › / **Done** / QuickType strip) from a web app. Cannot be done from Safari or a standalone Home-Screen app — UIKit draws it. Only a native wrapper can. Design around it.
- **A programmatic install prompt or install detection.** No `beforeinstallprompt`, no install API. You can only *show a hint* to use Share → Add to Home Screen. You can't detect whether it's already installed.
- **Hiding the system status bar or the Home indicator.** They are always present in a web app; you can only style/inset around them. `fullscreen`/`minimal-ui` display modes give you nothing extra beyond `standalone` on iPhone.
- **Locking orientation** (`screen.orientation.lock()` and manifest `orientation`) — ignored on iPhone.
- **Vibration / haptics** — `navigator.vibrate` is unsupported on iOS entirely.
- **Reliable Screen Wake Lock in an installed web app** — flaky/absent; don't depend on the screen staying awake.
- **Making `100vh`/`100dvh` shrink for the keyboard**, or fixing the keyboard layout with `interactive-widget=resizes-content` — WebKit ignores `interactive-widget`, and the height units don't react to the keyboard. `visualViewport` is the only lever.
- **OS-level backup of her data.** Web-app `localStorage`/IndexedDB is **not** in iCloud/iTunes device backups in any restorable way, and "Clear History and Website Data" or deleting the icon wipes it. An in-app export is the *only* backup — build it.
- **Manifest fields that do nothing on iPhone:** `theme_color`, `background_color`, `shortcuts`, `categories`, `display_override`, `launch_handler`, `share_target`, `id`, `orientation`. Include them if you want cross-platform correctness, but expect zero iOS effect.
- **Trusting the manifest for the icon/name/splash.** iOS wants `apple-touch-icon`, `apple-mobile-web-app-title`, and (if you insist on custom splash) `apple-touch-startup-image`. And the icon is **snapshotted at install** — changing it later requires delete + re-add.

---

*Primary sources: WebKit blog (storage policy, web push, Safari release notes), Apple Developer documentation & forums, MDN, web.dev, caniuse, and Maximiliano Firtman's iOS-PWA notes. Behaviour verified against the iOS 17/18 era; iPhone on iOS 18.7. Flag anything here against the running Safari version before relying on a single-version detail (e.g. the iOS 26 `visualViewport.offsetTop` reset bug).*
