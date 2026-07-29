// The audio path for real: a static server, decodable files on disk, and the
// browser's own Audio element. Every other audio test stubs Audio, which proves
// the app asks for the right thing but not that a sound ever comes out.
const {test, expect} = require('@playwright/test');
const http = require('node:http');
const {readFileSync, writeFileSync, mkdirSync, rmSync} = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// A short silent WAV, built by hand. WAV because it needs no encoder to exist,
// and the app takes its extension from the generated line either way.
function silentWav(ms = 80, rate = 8000) {
  const samples = Math.round(rate * ms / 1000);
  const buf = Buffer.alloc(44 + samples);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);        // PCM, mono
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate, 28);
  buf.writeUInt16LE(1, 32); buf.writeUInt16LE(8, 34);        // 8-bit
  buf.write('data', 36); buf.writeUInt32LE(samples, 40);
  buf.fill(128, 44);                                          // silence
  return buf;
}

const TYPES = {'.html':'text/html', '.wav':'audio/wav', '.json':'application/json',
               '.png':'image/png', '.webmanifest':'application/manifest+json'};

let server, base, root;

test.beforeAll(async () => {
  // Served from a subdirectory, the way GitHub Pages serves this repo, so a
  // relative audio path that only works at the root would be caught.
  root = path.join(os.tmpdir(), 'acorn-live-' + process.pid);
  mkdirSync(path.join(root, 'learn', 'audio'), {recursive: true});
  writeFileSync(path.join(root, 'learn', 'index.html'),
                readFileSync(path.join(__dirname, '..', 'index.html')));
  for(const name of ['because', 'be', 'cause', 'said'])
    writeFileSync(path.join(root, 'learn', 'audio', name + '.wav'), silentWav());

  server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if(!file.startsWith(root)) { res.writeHead(403).end(); return; }
    try {
      const body = readFileSync(file);
      res.writeHead(200, {'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
                          'content-length': body.length});
      res.end(body);
    } catch { res.writeHead(404).end('no'); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/learn/`;
});

test.afterAll(async () => {
  await new Promise(r => server.close(r));
  rmSync(root, {recursive: true, force: true});
});

async function boot(page, clips){
  const asked = [];
  page.on('request', r => { if(/\.wav$/.test(r.url())) asked.push(r.url()); });
  await page.goto(base + 'index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => !!window.__acorn);
  await page.evaluate(o => {
    const a = window.__acorn;
    a.setToday('2026-08-01');
    a.setClips(o.clips, '.wav');
    a.state.words.lists = [{id:'w1', name:'T', words:['because','said','rain']}];
    a.state.words.activeId = 'w1'; a.state.words.mastery = {}; a.state.words.sessions = [];
    a.save();
    // Track what the real element actually does, without replacing it.
    window.__ev = [];
    const realPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function(){
      window.__ev.push({play: this.src.replace(/^.*\//, ''),
                        rate: Math.round(this.playbackRate * 100) / 100});
      this.addEventListener('ended', () => window.__ev.push({ended: this.src.replace(/^.*\//, '')}),
                            {once: true});
      this.addEventListener('error', () => window.__ev.push({error: this.src.replace(/^.*\//, '')}),
                            {once: true});
      return realPlay.call(this);
    };
    a.go('parent'); a.go('day');
  }, {clips});
  return asked;
}
const events = page => page.evaluate(() => window.__ev.slice());

test.describe('the audio path for real', () => {

  test('a recorded word is fetched from the right place and plays to the end',
    async ({page}) => {
      const asked = await boot(page, ['because','be','cause','said']);
      await page.waitForFunction(() => window.__ev.some(e => e.ended), null, {timeout:5000});
      const ev = await events(page);
      expect(ev[0].play).toBe('because.wav');
      expect(ev.some(e => e.ended === 'because.wav'), 'it never finished playing').toBe(true);
      expect(ev.some(e => e.error)).toBe(false);
      // Served from /learn/, so the path must be relative to the app, not the root.
      expect(asked.some(u => u.endsWith('/learn/audio/because.wav'))).toBe(true);
    });

  test('the pieces follow the word, in order, without a gap in the chain',
    async ({page}) => {
      await boot(page, ['because','be','cause','said']);
      await page.locator('#cover').click();
      await page.locator('#type').fill('becuase');
      await page.evaluate(() => { window.__ev = []; });
      await page.locator('#check').click();
      await page.waitForFunction(() => window.__ev.filter(e => e.play).length >= 3,
                                 null, {timeout:5000});
      const played = (await events(page)).filter(e => e.play).map(e => e.play);
      expect(played).toEqual(['because.wav','be.wav','cause.wav']);
      // Each one really ended before the next began.
      const ev = await events(page);
      const order = ev.map(e => e.play ? 'play:' + e.play : e.ended ? 'end:' + e.ended : 'err');
      expect(order.indexOf('end:because.wav')).toBeLessThan(order.indexOf('play:be.wav'));
    });

  test('a missing file falls through to the phone voice rather than silence',
    async ({page}) => {
      // "rain" is in the index but has no file on the server.
      const asked = await boot(page, ['because','be','cause','said','rain']);
      await page.evaluate(() => {
        window.__spoken = [];
        const real = window.speechSynthesis.speak.bind(window.speechSynthesis);
        window.speechSynthesis.speak = u => { window.__spoken.push(u.text); };
        const a = window.__acorn;
        a.state.words.lists = [{id:'w2', name:'T', words:['rain']}];
        a.state.words.activeId = 'w2'; a.save(); a.go('parent'); a.go('day');
      });
      await page.waitForFunction(() => window.__spoken.length > 0, null, {timeout:5000});
      expect(await page.evaluate(() => window.__spoken)).toEqual(['rain']);
      expect(asked.some(u => u.endsWith('/learn/audio/rain.wav'))).toBe(true);
      await expect(page.locator('.word')).toBeVisible();
    });

  test('her speed setting reaches the real element', async ({page}) => {
    await boot(page, ['because','be','cause','said']);
    for(const [rate, cmp] of [[0.7, 'slower'], [1.1, 'faster']]){
      await page.evaluate(r => {
        window.__acorn.state.settings.speechRate = r;
        window.__acorn.save(); window.__ev = [];
        window.__acorn.go('parent'); window.__acorn.go('day');
      }, rate);
      await page.waitForFunction(() => window.__ev.some(e => e.play), null, {timeout:5000});
      const first = (await events(page)).find(e => e.play);
      if(cmp === 'slower') expect(first.rate).toBeLessThan(1);
      else expect(first.rate).toBeGreaterThan(1);
    }
  });

});
