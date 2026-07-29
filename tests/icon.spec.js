// The Home Screen tile. It is the only file this app cannot inline: iOS does not
// reliably honour a data: URI for apple-touch-icon, so it has to be a real PNG
// beside the page — and iOS composites transparency to black and applies its own
// rounded mask, so it must be a fully opaque square with square corners.
const {test, expect} = require('@playwright/test');
const {open, errorsOf} = require('./helpers');
const fs = require('node:fs');
const path = require('node:path');

const ICON = path.join(__dirname, '..', 'apple-touch-icon.png');

test.describe('the icon on her Home Screen', () => {

  test('the page asks for it, by a path that resolves beside the page', async ({page}) => {
    await open(page, '2026-08-01');
    const href = await page.evaluate(() =>
      (document.querySelector('link[rel="apple-touch-icon"]') || {}).getAttribute
        ? document.querySelector('link[rel="apple-touch-icon"]').getAttribute('href') : null);
    expect(href, 'no apple-touch-icon link').toBe('apple-touch-icon.png');
    // Relative, so it works from a subdirectory — GitHub Pages serves this repo
    // from /learn/, and a root-absolute path would 404 there.
    expect(href.startsWith('/'), 'a root-absolute path breaks under /learn/').toBe(false);
    expect(errorsOf(page)).toEqual([]);
  });

  test('the file is a real, opaque, square PNG at the size iOS uses', () => {
    const b = fs.readFileSync(ICON);
    expect(b.slice(0, 8).toString('hex'), 'not a PNG').toBe('89504e470d0a1a0a');
    // IHDR: width, height, bit depth, colour type.
    expect(b.readUInt32BE(16)).toBe(180);
    expect(b.readUInt32BE(20)).toBe(180);
    expect(b[24]).toBe(8);
    // 2 is RGB. 6 (RGBA) or 4 would mean an alpha channel, which iOS turns black.
    expect(b[25], 'the icon has an alpha channel — iOS would make it black').toBe(2);
    expect(b.length).toBeGreaterThan(1000);          // not a stub
    expect(b.length).toBeLessThan(80 * 1024);        // not a photograph
  });

  test('it is the only binary the page depends on', async ({page}) => {
    await open(page, '2026-08-01');
    // Everything else is inline. A second external reference would be a regression
    // in the one property that makes this app easy to keep alive.
    const external = await page.evaluate(() =>
      [...document.querySelectorAll('link[href], script[src], img[src]')]
        .map(n => n.getAttribute('href') || n.getAttribute('src'))
        .filter(u => u && !/^data:/.test(u)));
    expect(external).toEqual(['apple-touch-icon.png']);
  });
});
