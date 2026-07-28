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
import {chromium} from '@playwright/test';
import {writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const {findChromium} = createRequire(import.meta.url)('../playwright.config.js');

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
const browser = await chromium.launch({executablePath: findChromium()});
const page = await browser.newPage();

const jobs = [
  ['icons/icon-180.png', 180, 0.68],      // apple-touch-icon
  ['icons/icon-192.png', 192, 0.68],
  ['icons/icon-512.png', 512, 0.68],
  // Android may crop a maskable icon to a circle, so keep it well inside.
  ['icons/icon-maskable-512.png', 512, 0.52],
];
const written = [];
for (const [out, size, inset] of jobs) {
  await page.setViewportSize({width: size, height: size});
  await page.setContent(page$(size, inset));
  const buf = await page.screenshot();
  writeFileSync(resolve(root, out), buf);
  written.push(`${out}  ${size}x${size}  ${(buf.length / 1024).toFixed(1)}KB`);
}

// How it reads at the sizes that actually matter.
await page.setViewportSize({width: 460, height: 150});
await page.setContent(`<style>html,body{margin:0;background:#8a8a8a;height:150px;display:flex;
  gap:18px;align-items:center;justify-content:center}
  div{background:${CREAM};border-radius:22%;display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 8px #0004;font-family:"Apple Color Emoji","Noto Color Emoji",sans-serif}
</style>` + [120, 80, 60, 40, 28].map(s =>
  `<div style="width:${s}px;height:${s}px;font-size:${Math.round(s*0.68)}px;line-height:1">${EMOJI}</div>`).join(''));
writeFileSync(resolve(root, 'icons/_preview.png'), await page.screenshot());

await browser.close();
console.log(written.join('\n'));
console.log(`\nemoji ${EMOJI} on ${CREAM}. icons/_preview.png shows it small.`);
console.log('On a Mac this is Apple’s acorn; elsewhere it is the local emoji font.');
