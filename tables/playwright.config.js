// 144's own harness, kept apart from Acorn's (which runs ./tests from the repo
// root). Run it with:  npx playwright test -c tables/playwright.config.js
const fs = require('fs');
const path = require('path');
const {defineConfig, devices} = require('@playwright/test');

// Prefer a Chromium the sandbox already ships (its revision rarely matches the
// one this Playwright would download). Same detection Acorn uses.
function findChromium(){
  if(process.env.ACORN_CHROMIUM) return process.env.ACORN_CHROMIUM;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if(!root || !fs.existsSync(root)) return undefined;
  for(const dir of fs.readdirSync(root)){
    if(!/^chromium(-\d+)?$/.test(dir)) continue;              // skip headless_shell builds
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
      ...devices['iPhone 13'],
      browserName: 'chromium',
      defaultBrowserType: 'chromium',
      isMobile: false,
      launchOptions: executablePath ? {executablePath} : {},
    },
  }],
});
module.exports.findChromium = findChromium;
