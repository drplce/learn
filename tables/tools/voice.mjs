/* Records every phrase 144 ever says, and writes them into tables/audio/ with the
 * inline index the app reads. Run it on your own machine: the key never enters
 * this repo, only the audio does.
 *
 *   node tables/tools/voice.mjs --list          # what would be recorded, and why
 *   node tables/tools/voice.mjs --report        # durations of what is already there
 *
 *   # Google Cloud — the recommendation. en-AU Neural2, and the whole job is about
 *   # 6,000 characters against a free 1,000,000 a month.
 *   GOOGLE_TTS_KEY=...  node tables/tools/voice.mjs
 *
 *   # macOS, no account and no card. Uses the Premium voices you have downloaded,
 *   # which Safari itself cannot reach.
 *   V144_TTS=say V144_VOICE=Matilda node tables/tools/voice.mjs
 *   V144_TTS=say node tables/tools/voice.mjs --voices
 *
 *   # Azure — also free at this size.
 *   V144_TTS=azure AZURE_TTS_KEY=... AZURE_TTS_REGION=australiaeast node tables/tools/voice.mjs
 *
 * Options:
 *   V144_VOICE=en-AU-Neural2-C    which voice (provider-specific name)
 *   V144_WPM=150                  SPEED. Read the note below before changing it.
 *   V144_ONLY=five-times-seven    just these slugs, for auditioning
 *   V144_FORCE=1                  re-record phrases that already exist
 *
 * ON SPEED — the thing to get right, because it is expensive to redo:
 *
 * Record AT the speed you want to hear. Do not record slow and speed up in the
 * app. Speeding up afterwards (playbackRate with preservesPitch, or any WSOLA
 * time-stretch) keeps the pitch but scales vowels, consonants and pauses by the
 * same factor — which is not what people do when they talk faster. We shorten
 * vowels and pauses hard and keep the consonants crisp. A stretched recording is
 * measurably less intelligible than a natively-recorded take of the same length,
 * and the artefacts land in the syllable envelope, which is the exact cue a
 * dyslexic listener already tracks poorly.
 *
 * Every provider here re-synthesises natively at the requested rate, so there is
 * no reason to stretch. The app keeps a small runtime trim (SAY_RATE) for A/B
 * testing on the real phone without re-recording 348 files; treat 1.25 as the
 * ceiling before artefacts show.
 *
 * Comprehension research puts the optimum around 150-160 wpm for adults, lower
 * for children, with a steep drop above ~200. 150 is the default here: it puts
 * the average question ("five times seven") at about a second, which is the
 * number that matters for rapid fire. The longest ("eleven times eleven", seven
 * syllables) lands near 1.8s and CANNOT be squeezed to 1.2 without going to
 * ~240 wpm — which would compress precisely the phrases she most needs to hear
 * clearly. Aim the target at the average, not the maximum.
 */
import {readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync} from 'node:fs';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const AUDIO = resolve(here, '..', 'audio');
const INDEX = resolve(here, '..', 'index.html');

const WPM      = Number(process.env.V144_WPM || 150);
const PROVIDER = process.env.V144_TTS || (process.env.GOOGLE_TTS_KEY ? 'google' : 'say');
const ONLY     = (process.env.V144_ONLY || '').split(',').map(s => s.trim()).filter(Boolean);
const FORCE    = process.env.V144_FORCE === '1';

// Must match clipSlug() in tables/index.html.
const slug = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-');

/* ---------- the phrases, derived exactly as the app derives them ---------- */
function numWords(n){
  const ONES = ['zero','one','two','three','four','five','six','seven','eight','nine','ten',
                'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen',
                'eighteen','nineteen'];
  const TENS = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
  n = Math.round(n);
  if(n < 20) return ONES[n];
  if(n < 100){ const t = TENS[Math.floor(n/10)], o = n % 10; return o ? `${t}-${ONES[o]}` : t; }
  const h = Math.floor(n/100), r = n % 100;
  return ONES[h] + ' hundred' + (r ? ' and ' + numWords(r) : '');
}
const qPhrase   = (a, b)          => `${numWords(a)} times ${numWords(b)}`;
const gapPhrase = (known, product) => `${numWords(known)} times what is ${numWords(product)}`;

function phrases(){
  const out = new Map();                       // phrase -> why, for --list
  const add = (p, why) => { if(!out.has(p)) out.set(p, why); };
  for(let a = 1; a <= 12; a++){
    for(let b = 1; b <= 12; b++){
      add(qPhrase(a, b), 'question');           // both ways round: she meets both faces
      add(gapPhrase(a, a * b), 'gap');          // always the known factor first
      add(numWords(a * b), 'answer');
    }
  }
  add('equals', 'joins the restatement');
  return out;
}

/* ---------- providers ---------- */
// Google speaks at a multiple of its own ~150 wpm baseline.
async function google(text, file){
  const key = process.env.GOOGLE_TTS_KEY;
  if(!key) throw new Error('GOOGLE_TTS_KEY is not set');
  const voice = process.env.V144_VOICE || 'en-AU-Neural2-C';
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`, {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({
      input: {text},
      voice: {languageCode: 'en-AU', name: voice},
      audioConfig: {audioEncoding: 'MP3', speakingRate: WPM / 150, sampleRateHertz: 24000}
    })
  });
  if(!res.ok) throw new Error(`google ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  writeFileSync(file, Buffer.from(j.audioContent, 'base64'));
}
// macOS `say` takes words per minute directly, which is the honest knob.
async function macSay(text, file){
  const voice = process.env.V144_VOICE || 'Karen';
  const aiff = file.replace(/\.mp3$/, '.aiff');
  execFileSync('say', ['-v', voice, '-r', String(WPM), '-o', aiff, '--data-format=LEF32@24000', text]);
  try{
    execFileSync('ffmpeg', ['-y', '-i', aiff, '-codec:a', 'libmp3lame', '-b:a', '64k', '-ac', '1', file],
                 {stdio: 'ignore'});
    execFileSync('rm', [aiff]);
  }catch(e){
    throw new Error('ffmpeg is needed to convert `say` output to mp3 (brew install ffmpeg)');
  }
}
async function azure(text, file){
  const key = process.env.AZURE_TTS_KEY, region = process.env.AZURE_TTS_REGION;
  if(!key || !region) throw new Error('AZURE_TTS_KEY and AZURE_TTS_REGION are needed');
  const voice = process.env.V144_VOICE || 'en-AU-NatashaNeural';
  // Azure's rate is a percentage off its own baseline, same idea as Google's.
  const pct = Math.round((WPM / 150 - 1) * 100);
  const ssml = `<speak version='1.0' xml:lang='en-AU'><voice name='${voice}'>` +
               `<prosody rate='${pct >= 0 ? '+' : ''}${pct}%'>${text}</prosody></voice></speak>`;
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml',
              'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3'},
    body: ssml
  });
  if(!res.ok) throw new Error(`azure ${res.status}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}
const RECORD = {google, say: macSay, azure};

/* ---------- the index the app reads ---------- */
function writeIndex(list){
  const kb = Math.round(list.reduce((s, p) => {
    const f = join(AUDIO, slug(p) + '.mp3');
    return s + (existsSync(f) ? statSync(f).size : 0);
  }, 0) / 1024);
  const src = readFileSync(INDEX, 'utf8');
  const line = `var CLIP_KB = ${kb}, CLIP_EXT = ".mp3", CLIPS = ${JSON.stringify(list.sort())};   /* GENERATED */`;
  const next = src.replace(/^var CLIP_KB = .*\/\* GENERATED \*\/$/m, line);
  if(next === src) throw new Error('could not find the GENERATED line in tables/index.html');
  writeFileSync(INDEX, next);
  console.log(`\nindex rewritten: ${list.length} clips, ${kb} KB`);
}

/* ---------- duration report: the only way to know if the speed is right ---------- */
function report(){
  if(!existsSync(AUDIO)) return console.log('nothing recorded yet');
  const files = readdirSync(AUDIO).filter(f => f.endsWith('.mp3'));
  if(!files.length) return console.log('nothing recorded yet');
  const rows = [];
  for(const f of files){
    let secs = null;
    try{
      secs = Number(execFileSync('ffprobe',
        ['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1', join(AUDIO, f)])
        .toString().trim());
    }catch(e){ /* no ffprobe: fall back to size */ }
    rows.push({f, secs, kb: statSync(join(AUDIO, f)).size / 1024});
  }
  const withSecs = rows.filter(r => r.secs);
  if(!withSecs.length){
    console.log(`${rows.length} clips, ${Math.round(rows.reduce((s,r)=>s+r.kb,0))} KB total ` +
                `(install ffprobe for durations)`);
    return;
  }
  withSecs.sort((a, b) => a.secs - b.secs);
  const mean = withSecs.reduce((s, r) => s + r.secs, 0) / withSecs.length;
  console.log(`${withSecs.length} clips at V144_WPM=${WPM}`);
  console.log(`  average ${mean.toFixed(2)}s   median ${withSecs[Math.floor(withSecs.length/2)].secs.toFixed(2)}s`);
  console.log(`  shortest ${withSecs[0].secs.toFixed(2)}s  ${withSecs[0].f}`);
  console.log(`  longest  ${withSecs.at(-1).secs.toFixed(2)}s  ${withSecs.at(-1).f}`);
  console.log(`  over 1.5s: ${withSecs.filter(r => r.secs > 1.5).length}`);
  console.log(`  total ${Math.round(rows.reduce((s, r) => s + r.kb, 0))} KB`);
}

/* The app derives its phrases from the same rules in tables/index.html. A test
   imports these and checks the two implementations have not drifted — a phrase
   the app can say but this file never records is a phrase she hears in the
   phone's voice instead, mid-level, for the rest of the year. */
export {numWords, qPhrase, gapPhrase, phrases, slug};

/* ---------- run ---------- */
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if(!isMain){ /* imported for its rules only */ }
else await main();

async function main(){
const all = phrases();
const list = [...all.keys()];

if(process.argv.includes('--list')){
  const by = {};
  for(const [p, why] of all) (by[why] = by[why] || []).push(p);
  for(const why of Object.keys(by)) console.log(`${by[why].length.toString().padStart(4)}  ${why}`);
  console.log(`${list.length.toString().padStart(4)}  TOTAL`);
  console.log('\nfirst few of each:');
  for(const why of Object.keys(by)) console.log(`  ${why}: ${by[why].slice(0, 3).join(' / ')}`);
  process.exit(0);
}
if(process.argv.includes('--report')){ report(); process.exit(0); }
if(process.argv.includes('--voices')){
  execFileSync('say', ['-v', '?'], {stdio: 'inherit'});
  process.exit(0);
}
if(process.argv.includes('--index-only')){ writeIndex(list); process.exit(0); }

const record = RECORD[PROVIDER];
if(!record){ console.error(`unknown provider ${PROVIDER}`); process.exit(1); }
mkdirSync(AUDIO, {recursive: true});

let done = 0, skipped = 0, failed = 0;
for(const p of list){
  const name = slug(p) + '.mp3';
  if(ONLY.length && !ONLY.includes(slug(p))) continue;
  const file = join(AUDIO, name);
  if(existsSync(file) && !FORCE){ skipped++; continue; }
  try{
    await record(p, file);
    done++;
    if(done % 25 === 0) console.log(`  ${done} recorded…`);
  }catch(e){
    failed++;
    console.error(`  FAILED "${p}": ${e.message}`);
    if(failed > 3){ console.error('giving up — fix the above and run again'); break; }
  }
}
console.log(`recorded ${done}, already had ${skipped}, failed ${failed}`);
writeIndex(list);
report();
}
