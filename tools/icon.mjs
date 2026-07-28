/* The home-screen icon: the acorn emoji on the app's cream, rendered to the PNG
 * sizes iOS and Android ask for. Without an icon iOS puts a letter in a box,
 * which is what she sees on her home screen.
 *
 *   node tools/icon.mjs
 *
 * Run it on a Mac and you get Apple's own acorn — the artwork she already knows
 * from the keyboard. Run it anywhere else and you get whatever emoji font is
 * installed, which will not match. Chromium does the rasterising, so there is no
 * image library to install.
 */
import {writeFileSync, mkdirSync, existsSync, readFileSync, rmSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

/* Two ways to turn a page into a PNG: Playwright if it happens to be installed,
   otherwise whatever Chrome is already on the machine. The second path is what
   matters — it means no install is needed to get Apple's acorn on a Mac. */
const SYSTEM_CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
];

async function makeShooter() {
  try {
    const {chromium} = await import('@playwright/test');
    const {findChromium} = createRequire(import.meta.url)('../playwright.config.js');
    const browser = await chromium.launch({executablePath: findChromium()});
    const page = await browser.newPage();
    return {
      how: 'playwright',
      async shot(html, size) {
        await page.setViewportSize({width: size.w, height: size.h});
        await page.setContent(html);
        return page.screenshot();
      },
      close: () => browser.close(),
    };
  } catch { /* fall through to a browser already on the machine */ }

  const exe = SYSTEM_CHROME.find(p => existsSync(p));
  if (!exe) {
    console.error('Needs a browser to turn the emoji into a PNG. Either:\n');
    console.error('  npm install            # if you want the full toolchain');
    console.error('  or install Google Chrome, which this will find on its own\n');
    console.error('The committed icons still work — they just use the local emoji font,');
    console.error('so on a Mac they are not Apple\'s acorn.');
    process.exit(2);
  }
  const dir = resolve(tmpdir(), 'acorn-icon');
  mkdirSync(dir, {recursive: true});
  return {
    how: exe.replace(/^.*\//, ''),
    async shot(html, size) {
      const page$ = resolve(dir, 'p.html'), out = resolve(dir, 'p.png');
      writeFileSync(page$, html);
      rmSync(out, {force: true});
      execFileSync(exe, ['--headless', '--disable-gpu', '--hide-scrollbars',
                         `--screenshot=${out}`, `--window-size=${size.w},${size.h}`,
                         'file://' + page$], {stdio: ['ignore', 'ignore', 'pipe']});
      if (!existsSync(out)) throw new Error('the browser produced no image');
      return readFileSync(out);
    },
    close: async () => rmSync(dir, {recursive: true, force: true}),
  };
}

const CREAM = '#FBF6EC';
const EMOJI = process.env.ACORN_EMOJI || '\u{1F330}';

// A little smaller than the square, because iOS rounds the corners off.
const page$ = (size, inset) => `<style>
  html,body{margin:0;padding:0;width:${size}px;height:${size}px;background:${CREAM};
            display:flex;align-items:center;justify-content:center;overflow:hidden}
  span{font-size:${Math.round(size * inset)}px; line-height:1;
       font-family:"Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",sans-serif}
</style><span>${EMOJI}</span>`;

mkdirSync(resolve(root, 'icons'), {recursive: true});
const shooter = await makeShooter();

const jobs = [
  ['icons/icon-180.png', 180, 0.68],      // apple-touch-icon
  ['icons/icon-192.png', 192, 0.68],
  ['icons/icon-512.png', 512, 0.68],
  // Android may crop a maskable icon to a circle, so keep it well inside.
  ['icons/icon-maskable-512.png', 512, 0.52],
];
const written = [];
for (const [out, size, inset] of jobs) {
  const buf = await shooter.shot(page$(size, inset), {w: size, h: size});
  writeFileSync(resolve(root, out), buf);
  written.push(`${out}  ${size}x${size}  ${(buf.length / 1024).toFixed(1)}KB`);
}

// How it reads at the sizes that actually matter.
const preview = `<style>html,body{margin:0;background:#8a8a8a;height:150px;display:flex;
  gap:18px;align-items:center;justify-content:center}
  div{background:${CREAM};border-radius:22%;display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 8px #0004;font-family:"Apple Color Emoji","Noto Color Emoji",sans-serif}
</style>` + [120, 80, 60, 40, 28].map(s =>
  `<div style="width:${s}px;height:${s}px;font-size:${Math.round(s*0.68)}px;line-height:1">${EMOJI}</div>`).join('');
writeFileSync(resolve(root, 'icons/_preview.png'),
              await shooter.shot(preview, {w: 460, h: 150}));

await shooter.close();
console.log(written.join('\n'));
console.log(`\nrendered with ${shooter.how}`);
console.log(`\nemoji ${EMOJI} on ${CREAM}. icons/_preview.png shows it small.`);
console.log('On a Mac this is Apple’s acorn; elsewhere it is the local emoji font.');
