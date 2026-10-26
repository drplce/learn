// Acorn test harness. The app is a single file with no build step, so the
// tests just open index.html straight from disk in Chromium.
const fs = require('fs');
const path = require('path');
const {defineConfig, devices} = require('@playwright/test');

// Use a pre-installed Chromium when the environment provides one (CI images and
// sandboxes often ship a build that doesn't match this Playwright's pinned
// revision). Falls back to Playwright's own download when there isn't one.
/* The image's layout is not ours and it moves. On 2026-10-26 a container came back with
   `chromium-1243/chrome-linux64/chrome` and a convenience symlink at `chromium`, where it
   had been `chromium-<rev>/chrome-linux/chrome`; this function found neither, returned
   undefined, and Playwright fell back to its own pinned revision — which the image does
   not carry. The whole suite then failed to launch a browser, on a build nobody had
   touched. So: try both layouts, and accept the entry itself when it is the binary. */
function findChromium(){
  if(process.env.ACORN_CHROMIUM) return process.env.ACORN_CHROMIUM;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if(!root || !fs.existsSync(root)) return undefined;
  const runnable = p => { try { fs.accessSync(p, fs.constants.X_OK);
                                return fs.statSync(p).isFile(); } catch(e){ return false; } };
  for(const dir of fs.readdirSync(root)){
    if(!/^chromium(-\d+)?$/.test(dir)) continue;                 // skip headless_shell builds
    const here = path.join(root, dir);
    for(const exe of [path.join(here, 'chrome-linux', 'chrome'),
                      path.join(here, 'chrome-linux64', 'chrome'),
                      here])                                    // a symlink straight to it
      if(runnable(exe)) return exe;
  }
  return undefined;
}
const executablePath = findChromium();

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list']],
  projects: [{
    name: 'chromium-phone',
    use: {
      ...devices['iPhone 13'],        // the target device shape
      browserName: 'chromium',        // the iPhone descriptor implies WebKit; keep the viewport, use Chromium
      defaultBrowserType: 'chromium',
      isMobile: false,                // Chromium's mobile emulation needs this off to accept the descriptor
      launchOptions: executablePath ? {executablePath} : {},
    },
  }],
});

// tests/sim.js reuses the same detection to launch its own browser.
module.exports.findChromium = findChromium;
