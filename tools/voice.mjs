/* Records every phrase the app speaks, using a cloud voice with a real
 * Australian accent, and writes them into audio/ alongside the inline index the
 * app reads. Run it on your own machine: the key never enters this repo, only
 * the mp3 files do.
 *
 *   node tools/phrases.mjs                 # what needs recording (run first)
 *
 *   # macOS, no account and no card. This is the one to try first: it can use
 *   # the Premium voices you have downloaded, which Safari cannot touch, so it
 *   # is a real upgrade on what her phone can manage by itself.
 *   ACORN_TTS=say ACORN_VOICE=Matilda node tools/voice.mjs
 *   ACORN_TTS=say node tools/voice.mjs --voices     # what is installed
 *
 *   # Google Cloud — the recommendation. en-AU Neural2 voices, and the whole job
 *   # is about 1,500 characters against a free 1,000,000 a month.
 *   GOOGLE_TTS_KEY=...  node tools/voice.mjs
 *
 *   # Azure — also free at this size (500,000 characters a month).
 *   ACORN_TTS=azure AZURE_TTS_KEY=... AZURE_TTS_REGION=australiaeast node tools/voice.mjs
 *
 *   # ElevenLabs — needs a paid plan; the free tier has no API access at all.
 *   ACORN_TTS=elevenlabs ELEVENLABS_KEY=... ELEVENLABS_VOICE=<id> node tools/voice.mjs
 *
 * Options:
 *   ACORN_VOICE=en-AU-Neural2-C   which voice (provider-specific name)
 *   ACORN_ONLY=because,friend     just these, for auditioning
 *   ACORN_FORCE=1                 re-record phrases that already exist
 */
import {readFileSync, writeFileSync, mkdirSync, existsSync, statSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const AUDIO = resolve(here, '..', 'audio');
const INDEX = resolve(here, '..', 'index.html');

// Must match clipSlug() in index.html.
const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const provider = process.env.ACORN_TTS || 'google';
const only = (process.env.ACORN_ONLY || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const force = !!process.env.ACORN_FORCE;

const PROVIDERS = {
  // macOS built-in speech. Free, offline, no account, and — the point — it can
  // reach voices downloaded under Accessibility, which Safari's speechSynthesis
  // cannot. Writes AAC in an m4a, which every iPhone plays natively.
  ext: {say: '.m4a'},
  async say(text, voice) {
    const {execFileSync} = await import('node:child_process');
    const name = voice || 'Karen';
    const tmp = resolve(AUDIO, '.say.m4a');
    try {
      execFileSync('say', ['-v', name, '-r', String(process.env.ACORN_WPM || 165),
                           '--file-format=mp4f', '--data-format=aac', '-o', tmp, '--', text],
                   {stdio: ['ignore', 'ignore', 'pipe']});
    } catch (e) {
      if (e.code === 'ENOENT') { console.error('\nno "say" on this machine — ACORN_TTS=say is macOS only'); process.exit(2); }
      throw new Error((e.stderr ? String(e.stderr).trim().slice(0, 200) : e.message) +
                      ` — is "${name}" installed? try: ACORN_TTS=say node tools/voice.mjs --voices`);
    }
    const buf = readFileSync(tmp);
    try { (await import('node:fs')).unlinkSync(tmp); } catch {}
    return buf;
  },

  async google(text, voice) {
    const key = need('GOOGLE_TTS_KEY');
    const name = voice || 'en-AU-Neural2-C';
    const r = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize?key=' + key, {
      method: 'POST', headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        input: {text},
        voice: {languageCode: 'en-AU', name},
        // A single word gets clipped short by some voices; the effect volume and
        // a little padding keep the first consonant intact.
        audioConfig: {audioEncoding: 'MP3', speakingRate: 0.92, pitch: 0,
                      sampleRateHertz: 24000},
      }),
    });
    if (!r.ok) throw new Error(`google ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return Buffer.from((await r.json()).audioContent, 'base64');
  },

  async azure(text, voice) {
    const key = need('AZURE_TTS_KEY'), region = need('AZURE_TTS_REGION');
    const name = voice || 'en-AU-NatashaNeural';
    const ssml = `<speak version="1.0" xml:lang="en-AU"><voice name="${name}">` +
                 `<prosody rate="-8%">${escapeXml(text)}</prosody></voice></speak>`;
    const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml',
                'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3'},
      body: ssml,
    });
    if (!r.ok) throw new Error(`azure ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return Buffer.from(await r.arrayBuffer());
  },

  async elevenlabs(text, voice) {
    const key = need('ELEVENLABS_KEY');
    const id = voice || need('ELEVENLABS_VOICE');
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}?output_format=mp3_22050_32`, {
      method: 'POST', headers: {'xi-api-key': key, 'content-type': 'application/json'},
      body: JSON.stringify({text, model_id: 'eleven_multilingual_v2',
                            voice_settings: {stability: 0.5, similarity_boost: 0.75}}),
    });
    if (!r.ok) throw new Error(`elevenlabs ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return Buffer.from(await r.arrayBuffer());
  },
};

function need(name) {
  const v = process.env[name];
  if (!v) { console.error(`\n${name} is not set. See the header of this file.`); process.exit(2); }
  return v;
}
const escapeXml = s => s.replace(/[<>&'"]/g, c =>
  ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));

const speak = PROVIDERS[provider];
if (typeof speak !== 'function') {
  console.error(`unknown ACORN_TTS "${provider}" — say, google, azure or elevenlabs`);
  process.exit(2);
}
const EXT = (PROVIDERS.ext && PROVIDERS.ext[provider]) || '.mp3';

// What voices this machine actually has, so a name can be picked rather than guessed.
if (process.argv.includes('--voices')) {
  if (provider !== 'say') { console.error('--voices only applies to ACORN_TTS=say'); process.exit(2); }
  const {execFileSync} = await import('node:child_process');
  let out;
  try { out = execFileSync('say', ['-v', '?'], {encoding: 'utf8'}); }
  catch { console.error('no "say" on this machine — ACORN_TTS=say is macOS only'); process.exit(2); }
  const rows = out.split('\n').map(l => l.match(/^(.+?)\s{2,}([a-z]{2}[_-][A-Z]{2})/)).filter(Boolean)
                  .map(m => ({name: m[1].trim(), lang: m[2]}));
  const au = rows.filter(r => /en[_-]AU/.test(r.lang));
  console.log(`${rows.length} voices enumerated, ${au.length} Australian:\n`);
  au.forEach(r => console.log('  ' + r.name));
  console.log('\nThis list is not the whole story. Apple\'s newer voices — Matilda among');
  console.log('them — work with say but are not enumerated by it, so try the name even if');
  console.log('it is absent here: say fails loudly on a voice it cannot find, so a run that');
  console.log('records without complaint used the voice you asked for.');
  console.log('\n  ACORN_TTS=say ACORN_VOICE=Matilda node tools/voice.mjs');
  console.log('\nTo add a downloaded voice: System Settings > Accessibility >');
  console.log('Spoken Content > System Voice > Manage Voices.');
  process.exit(0);
}

const phrasesPath = resolve(here, 'phrases.json');
if (!existsSync(phrasesPath)) {
  console.error('tools/phrases.json is missing — run: node tools/phrases.mjs');
  process.exit(2);
}
const {all} = JSON.parse(readFileSync(phrasesPath, 'utf8'));
const wanted = only.length ? all.filter(t => only.includes(t)) : all;

mkdirSync(AUDIO, {recursive: true});
console.log(`${provider}${process.env.ACORN_VOICE ? ' / ' + process.env.ACORN_VOICE : ''}` +
            ` — ${wanted.length} phrase${wanted.length === 1 ? '' : 's'}\n`);

const done = [], failed = [];
for (const text of wanted) {
  const file = slug(text) + EXT, path = resolve(AUDIO, file);
  if (!force && existsSync(path) && statSync(path).size > 512) { done.push(text); continue; }
  try {
    const buf = await speak(text, process.env.ACORN_VOICE);
    if (buf.length < 512) throw new Error(`suspiciously small (${buf.length} bytes)`);
    writeFileSync(path, buf);
    done.push(text);
    process.stdout.write(`  ${text.padEnd(24)} ${String(buf.length).padStart(6)} bytes\n`);
    await new Promise(r => setTimeout(r, 60));          // be gentle with the API
  } catch (e) {
    failed.push(`${text}: ${e.message}`);
    process.stdout.write(`  ${text.padEnd(24)} FAILED\n`);
  }
}

// Every phrase with a file on disk, whether or not this run made it.
const present = all.filter(t => {
  const p = resolve(AUDIO, slug(t) + EXT);
  return existsSync(p) && statSync(p).size > 512;
});

// Rewrite the one generated line in index.html. The index is inline so the app
// costs no request, cannot 404 on a half-finished deploy, and works offline.
const html = readFileSync(INDEX, 'utf8');
const line = 'var CLIP_EXT = ' + JSON.stringify(EXT) + ', CLIPS = ' + JSON.stringify(present) +
             ';   /* GENERATED */';
const next = html.replace(/^var CLIP_EXT = .*\/\* GENERATED \*\/$/m, line);
if (next === html && !html.includes(line)) {
  console.error('\ncould not find the generated CLIPS line in index.html');
  process.exit(1);
}
writeFileSync(INDEX, next);

const bytes = present.reduce((n, t) => n + statSync(resolve(AUDIO, slug(t) + EXT)).size, 0);
console.log(`\n${present.length} of ${all.length} phrases recorded, ${(bytes/1024).toFixed(0)}KB total`);
if (failed.length) {
  console.log(`\n${failed.length} failed:`);
  failed.slice(0, 10).forEach(f => console.log('  ' + f));
}
console.log('\nindex.html updated. Anything not recorded falls back to the phone voice.');
console.log('Check it locally with:  npx playwright test tests/speech.spec.js');
