// The audio path for real: a static server, decodable files on disk, and the
// browser's own Audio element. Every other audio test stubs Audio, which proves
// the app asks for the right thing but not that a sound ever comes out.
const {test, expect} = require('@playwright/test');
const {write} = require('./helpers');
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
    // The src may be a blob URL now, which carries no name — the element says
    // which phrase it is playing instead.
    const name = el => el.getAttribute('data-phrase') || el.src.replace(/^.*\//, '');
    HTMLMediaElement.prototype.play = function(){
      window.__ev.push({play: name(this), rate: Math.round(this.playbackRate * 100) / 100});
      this.addEventListener('ended', () => window.__ev.push({ended: name(this)}), {once: true});
      this.addEventListener('error', () => window.__ev.push({error: name(this)}), {once: true});
      return realPlay.call(this);
    };
    a.go('parent'); a.go('day');
  }, {clips});
  return asked;
}
const events = page => page.evaluate(() => window.__ev.slice());

test.describe('kept on the device rather than fetched when she needs it', () => {

  /* "Plays with no wait" is a claim about the network, so it is tested as one: the
     clip is a blob off the device, and playing it asks the server for nothing. It used
     to be a stopwatch — under 60ms — which failed about one run in three when the whole
     suite is going at once, because a busy machine is slow at everything. A test that
     fails on a coin toss is worse than no test, and the request count proves the actual
     property rather than standing in for it. */
  test('the sitting is fetched ahead, and playing it asks the server for nothing',
    async ({page}) => {
      await boot(page, ['because','be','cause','said']);
      await page.waitForFunction(() => window.__acorn.warmed() > 0, null, {timeout:10000});
      const asked = [];
      page.on('request', r => { if(/\.wav$/.test(r.url())) asked.push(r.url()); });
      const t = await page.evaluate(async () => {
        const warm = window.__acorn.sittingPhrases()
          .find(p => (window.__acorn.clipFor(p) || '').startsWith('blob:'));
        const url = window.__acorn.clipFor(warm);
        const el = new Audio(url);
        const how = await new Promise(r => {
          el.addEventListener('loadeddata', () => r('loaded'), {once:true});
          el.addEventListener('error', () => r('failed'), {once:true});
          el.load(); setTimeout(() => r('timed out'), 5000);
        });
        return {phrase: warm, how: how, fromDevice: url.startsWith('blob:'),
                file: window.__acorn.clipUrl(warm).replace(/^.*\//, '')};
      });
      expect(t.fromDevice, 'it did not come off the device').toBe(true);
      expect(t.how, `${t.phrase} ${t.how}`).toBe('loaded');
      expect(asked.filter(u => u.endsWith(t.file)),
             'playing a stored clip went to the network').toEqual([]);
    });

  test('nothing is fetched twice, and nothing is fetched again after a reload',
    async ({page}) => {
      const asked = await boot(page, ['because','be','cause','said']);
      // Wait for the phrases of this sitting specifically — the blob count also
      // includes whatever is committed in the repo, warmed at boot.
      const allWarm = () => page.waitForFunction(() =>
        window.__acorn.sittingPhrases()
          .filter(p => window.__acorn.clipUrl(p))
          .every(p => (window.__acorn.clipFor(p) || '').startsWith('blob:')),
        null, {timeout:15000});
      await allWarm();
      await page.waitForTimeout(200);
      const first = asked.length;
      expect(first).toBeGreaterThan(0);
      // The word spoken as the sitting opens is fetched by the element and then
      // stored by the prefetcher, so it can be asked for twice where the server
      // sends no cache headers. Everything else must be fetched exactly once.
      const twice = asked.filter((u, i) => asked.indexOf(u) !== i);
      expect(twice.length, 'more than one file was fetched twice: ' + twice).toBeLessThanOrEqual(1);

      const firstRun = asked.length;
      asked.length = 0;
      await page.reload();
      await page.waitForFunction(() => !!window.__acorn);
      await page.evaluate(() => {
        const a = window.__acorn;
        a.setToday('2026-08-01'); a.setClips(['because','be','cause','said'], '.wav');
        a.state.words.lists = [{id:'w1', name:'T', words:['because','said','rain']}];
        a.state.words.activeId = 'w1'; a.state.words.mastery = {}; a.save();
        a.go('parent'); a.go('day');
      });
      await allWarm();
      await page.waitForTimeout(300);
      // Stored on the device, so the second sitting costs less than the first.
      // (Measured against the committed recordings it costs nothing at all; this
      // test's own files go through a server with no cache headers.)
      expect(asked.length, 'the cache did not help after a reload')
        .toBeLessThan(firstRun);
    });

  test('a stored clip plays with the network gone', async ({page}) => {
    await boot(page, ['because','be','cause','said']);
    // Store them explicitly rather than waiting on whatever the sitting picked,
    // so this tests the claim and nothing else.
    await page.evaluate(() => window.__acorn.warmClips(['because','be','cause','said']));
    await page.waitForFunction(() =>
      (window.__acorn.clipFor('because') || '').startsWith('blob:'), null, {timeout:15000});

    await page.context().setOffline(true);
    try {
      const outcome = await page.evaluate(async () => {
        const url = window.__acorn.clipFor('because');
        const el = new Audio(url);
        return await new Promise(res => {
          el.addEventListener('ended', () => res('played'), {once:true});
          el.addEventListener('error', () => res('failed'), {once:true});
          el.play().catch(() => res('refused'));
          setTimeout(() => res('timed out'), 4000);
        });
      });
      expect(outcome).toBe('played');
    } finally { await page.context().setOffline(false); }
  });

  test('saving them all puts the whole set on the device', async ({page}) => {
    await boot(page, ['because','be','cause','said']);
    await page.evaluate(() => window.__acorn.go('parent'));
    await page.locator('#clipsave').click();
    await page.waitForFunction(() => window.__acorn.warmed() >= 4, null, {timeout:15000});
    await expect(page.locator('#clipreport')).toContainText(/4 of 4 are on the device/);
    await expect(page.locator('#clipreport')).toContainText(/All 4 saved on this device/);
  });

  // A phone with no room left rejects cache.put — and it rejects a promise
  // rather than throwing, so wrapping the call in try/catch left one unhandled
  // rejection per clip. The audio must still play; it just gets fetched again.
  test('a phone with no room left still plays, and says so quietly', async ({page}) => {
    const rejections = [];
    page.on('pageerror', e => rejections.push('pageerror: ' + e.message));
    page.on('console', m => { if(m.type() === 'error' && !/Failed to load resource/i.test(m.text()))
                                rejections.push('console: ' + m.text()); });
    await boot(page, ['because','be','cause','said']);
    await page.evaluate(() => {
      const open = caches.open.bind(caches);
      caches.open = name => open(name).then(c => ({
        match: c.match.bind(c),
        put: () => Promise.reject(new DOMException('quota', 'QuotaExceededError'))
      }));
      // Forget what is already stored so every clip has to be put again.
      window.__acorn.setClips(['because','be','cause','said'], '.wav');
      window.__acorn.go('parent');
    });
    await page.locator('#clipsave').click();
    // Nothing is stored, but every clip is still fetched and playable now.
    await page.waitForFunction(() => window.__acorn.warmed() >= 4, null, {timeout:15000});
    await expect(page.locator('#clipreport')).toContainText(/All 4 saved on this device/);
    expect(rejections, 'a full device must not spray errors').toEqual([]);
  });
});

test.describe('the audio path for real', () => {

  test('a recorded word is fetched from the right place and plays to the end',
    async ({page}) => {
      const asked = await boot(page, ['because','be','cause','said']);
      await page.waitForFunction(() => window.__ev.some(e => e.ended), null, {timeout:5000});
      const ev = await events(page);
      expect(ev[0].play).toBe('because');
      expect(ev.some(e => e.ended === 'because'), 'it never finished playing').toBe(true);
      expect(ev.some(e => e.error)).toBe(false);
      // Served from /learn/, so the path must be relative to the app, not the root.
      expect(asked.some(u => u.endsWith('/learn/audio/because.wav'))).toBe(true);
    });

  test('the pieces follow the word, in order, without a gap in the chain',
    async ({page}) => {
      await boot(page, ['because','be','cause','said']);
      await page.locator('#cover').click();
      await write(page, 'becuase');
      await page.evaluate(() => { window.__ev = []; });
      await page.locator('#check').click();
      await page.waitForFunction(() => window.__ev.filter(e => e.play).length >= 3,
                                 null, {timeout:5000});
      const played = (await events(page)).filter(e => e.play).map(e => e.play);
      expect(played).toEqual(['because','be','cause']);
      // Each one really ended before the next began.
      const ev = await events(page);
      const order = ev.map(e => e.play ? 'play:' + e.play : e.ended ? 'end:' + e.ended : 'err');
      expect(order.indexOf('end:because')).toBeLessThan(order.indexOf('play:be'));
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
      /* Tap Hear it, rather than bouncing through the grown-ups screen to make the
         word announce itself again. That worked only because leaving her screen used
         to throw the sitting away and coming back started it over — which is the
         thing 10.6 stopped doing, because it also showed her a word she was writing
         from memory. Hear it is the path she actually uses. */
      await page.evaluate(r => {
        window.__acorn.state.settings.speechRate = r;
        window.__acorn.save(); window.__ev = [];
      }, rate);
      await page.locator('#hear').click();
      await page.waitForFunction(() => window.__ev.some(e => e.play), null, {timeout:5000});
      const first = (await events(page)).find(e => e.play);
      if(cmp === 'slower') expect(first.rate).toBeLessThan(1);
      else expect(first.rate).toBeGreaterThan(1);
    }
  });

});
