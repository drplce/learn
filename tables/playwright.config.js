// 144's own harness, kept apart from Acorn's (which runs ./tests from the repo
// root). Run it with:  npx playwright test -c tables/playwright.config.js
const fs = require('fs');
const path = require('path');
const {defineConfig, devices} = require('@playwright/test');

// Prefer a Chromium the sandbox already ships (its revision rarely matches the
// one this Playwright would download). Same detection Acorn uses.
/* The image's layout is not ours and it moves. On 2026-10-26 a container came back with
   `chromium-1243/chrome-linux64/chrome` and a convenience symlink at `chromium`, where it had
   been `chromium-<rev>/chrome-linux/chrome`; this found neither, returned undefined, and
   Playwright fell back to its own pinned revision, which the image does not carry. Acorn's
   harness broke the same way on the same day and was fixed then; this one could not be, because
   an Acorn pass must not touch tables/ — so 144's harness could not launch a browser at all for
   four days. Try both layouts, and accept the entry itself when it is the binary. */
function findChromium(){
  if(process.env.ACORN_CHROMIUM) return process.env.ACORN_CHROMIUM;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if(!root || !fs.existsSync(root)) return undefined;
  const runnable = p => { try { fs.accessSync(p, fs.constants.X_OK);
                                return fs.statSync(p).isFile(); } catch(e){ return false; } };
  for(const dir of fs.readdirSync(root)){
    if(!/^chromium(-\d+)?$/.test(dir)) continue;              // skip headless_shell builds
    const here = path.join(root, dir);
    for(const exe of [path.join(here, 'chrome-linux', 'chrome'),
                      path.join(here, 'chrome-linux64', 'chrome'),
                      here])                                   // a symlink straight to it
      if(runnable(exe)) return exe;
  }
  return undefined;
}
const executablePath = findChromium();

module.exports = defineConfig({
  testDir: './tests',
  // ONE worker, deliberately. The app is opened from file://, and every file://
  // page shares one localStorage — so two tests running at once clear and write
  // each other's storage. That showed up as the two-windows data-safety test
  // failing about one run in eight with "the stale window ate her watts", which
  // reads like a real defect in the merge and is not one. A flaky red in an
  // unwatched loop is worse than a slower suite: the whole point of these tests is
  // that a failure means something. Costs ~50 seconds.
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  projects: [{
    name: 'chromium-phone',
    use: {
      ...devices['iPhone 13'],
      browserName: 'chromium',
      defaultBrowserType: 'chromium',
      isMobile: false,
      launchOptions: executablePath ? {executablePath} : {},
    },
  }],
});
module.exports.findChromium = findChromium;
