// Acorn test harness. The app is a single file with no build step, so the
// tests just open index.html straight from disk in Chromium.
const fs = require('fs');
const path = require('path');
const {defineConfig, devices} = require('@playwright/test');

// Use a pre-installed Chromium when the environment provides one (CI images and
// sandboxes often ship a build that doesn't match this Playwright's pinned
// revision). Falls back to Playwright's own download when there isn't one.
function findChromium(){
  if(process.env.ACORN_CHROMIUM) return process.env.ACORN_CHROMIUM;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if(!root || !fs.existsSync(root)) return undefined;
  for(const dir of fs.readdirSync(root)){
    if(!/^chromium(-\d+)?$/.test(dir)) continue;                 // skip headless_shell builds
    const exe = path.join(root, dir, 'chrome-linux', 'chrome');
    if(fs.existsSync(exe)) return exe;
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
