/* Simulation harness.
 *
 * Drives the real engine in a real browser — buildSession, recordWord,
 * check(), next(), finish() — against a modelled learner, so the numbers
 * come out of the shipped code rather than a re-implementation of it.
 *
 *   node tests/sim.js                  # 30 days x 12 learners, every built-in list
 *   node tests/sim.js 60 tricky        # days, list id
 *   node tests/sim.js 30 easy 1        # one learner, printed day by day
 *
 * One run is mostly noise — a single unlucky morning swings a small session
 * by 25 points. So every list is run as a cohort of learners with different
 * luck, and the numbers below are the cohort's.
 *
 * The learner: each word has a difficulty from its length and spelling
 * irregularity, and a memory strength that grows with retrieval and decays
 * with elapsed days. Seeing a word (the look stage) helps less than
 * retrieving it. A correction after a miss still teaches something.
 */
const {chromium} = require('@playwright/test');
const {findChromium} = require('../playwright.config.js');
const path = require('path');

const LEARNER = `(function(ability){
  function hash(s){ var h = 2166136261; for(var i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
  var IRREG = /ough|augh|tion|sion|eigh|ei|ie|ph|silent|kn|wr|mb$|que/;
  function difficulty(w){
    var len = Math.min(1, Math.max(0, (w.length - 3) / 7));
    var irreg = IRREG.test(w) ? .3 : 0;
    return Math.min(1, .25 + .45 * len + irreg + .2 * hash(w));   // ~.25 .. 1
  }
  var mem = {};
  function slot(w){ return mem[w] || (mem[w] = {s:0, day:null, d:difficulty(w)}); }
  function retrievability(w, day){
    var m = slot(w);
    if(m.day === null) return 0;
    var gap = day - m.day;
    return m.s * Math.exp(-gap / (1.6 + 2.4 * m.s));      // stronger memories decay slower
  }
  return {
    // Probability she writes it correctly, given the stage she is asked at.
    chance: function(w, day, stage){
      var m = slot(w);
      if(stage === 'look') return .52 + .36 * (1 - m.d);   // just saw it, then covered
      var r = retrievability(w, day);
      return 1 / (1 + Math.exp(-3.2 * (r - 1.15 * m.d)));
    },
    // What the attempt teaches her.
    learn: function(w, day, stage, ok){
      var m = slot(w);
      m.s += ability * (ok ? (stage === 'look' ? .55 : 1.05) : .4);   // a correction still teaches
      m.day = day;
    },
    difficulty: difficulty
  };
})`;

async function run(page, opts){
  const report = await page.evaluate(async ({days, listId, learnerSrc, seed, ability, attend}) => {
    const a = window.__acorn, L = eval(learnerSrc)(ability);
    let rngState = seed;
    const rnd = () => { rngState = (rngState * 1103515245 + 12345) & 0x7fffffff; return rngState / 0x7fffffff; };

    localStorage.clear();
    a.reset();
    if(listId === 'all'){
      // Every built-in word in one list. A 16-word list is finished inside a
      // fortnight, which leaves the pace controller nothing to steer — this is
      // the case that actually tests it.
      const words = {};
      a.allLists().forEach(l => a.wordsOf(l).forEach(w => {
        words[w] = (l.words && !Array.isArray(l.words) && l.words[w]) || w;   // keep the hand-checked splits
      }));
      a.state.words.lists.push({id:'all', name:'Everything', words:words});
      a.state.words.activeId = 'all';
    }else{
      a.state.words.activeId = listId;
    }
    a.save();
    // Before the first sitting: she is moved on when a list is done, so reading
    // this at the end gave the size of wherever she had got to, not where she began.
    const startSize = a.wordsOf(a.activeList()).length;

    const start = new Date('2026-08-01T00:00:00Z');
    const iso = d => new Date(start.getTime() + d * 864e5).toISOString().slice(0, 10);
    const rows = [];

    // Real practice is not daily. attend describes when she actually sits down:
    //   'daily'    every day
    //   'school'   Monday to Friday
    //   'twice'    two evenings a week
    //   'holiday'  daily, with a fortnight away in the middle
    const attends = d => {
      const dow = (new Date(start.getTime() + d * 864e5)).getUTCDay();
      if(attend === 'school')  return dow >= 1 && dow <= 5;
      if(attend === 'twice')   return dow === 2 || dow === 5;
      if(attend === 'holiday') return !(d >= Math.floor(days/2) && d < Math.floor(days/2) + 14);
      return true;
    };

    for(let day = 0; day < days; day++){
      a.setToday(iso(day));
      if(!attends(day)){ rows.push({day, away:true, skipped:true}); continue; }
      if(!a.start()){ rows.push({day, skipped:true}); continue; }
      const S = a.session();
      const opened = S.words.slice();
      const stages = {};
      let guard = 0;
      while(a.session() && guard++ < 200){
        const W = a.session(), w = W.words[W.i], stage = W.stage;
        if(stage === 'look'){ if(!(w in stages)) stages[w] = 'look'; a.cover(); }
        const st = a.session().stage;
        if(st === 'write'){
          if(!(w in stages)) stages[w] = 'write';
          const asked = W.failed.indexOf(w) >= 0 ? 'write' : stages[w];
          const p = L.chance(w, day, asked);
          const ok = rnd() < p;
          a.type(ok ? w : w.slice(0, Math.max(1, w.length - 2)) + 'x');
          a.check();
          L.learn(w, day, asked, ok);
          a.next();
        }else if(st === 'check'){ a.next(); }
      }
      const last = a.state.words.sessions[a.state.words.sessions.length - 1];
      const known = a.state.words.mastery;
      rows.push({
        day,
        asked: last.asked, words: last.words, firstTime: last.firstTime,
        acc: last.words ? last.firstTime / last.words : 0,
        // Words in the session she had already got onto a real interval — the
        // "known material" proportion the drill-ratio research cares about.
        reviewShare: opened.length
          ? opened.filter(w => (a.state.words.mastery[w] || {}).box > 1 ||
                               stages[w] === 'write').length / opened.length : 0,
        newWords: opened.filter(w => stages[w] === 'look').length,
        knownWell: Object.keys(known).filter(w => (known[w].box || 1) >= a.KNOWN_BOX).length,
        touched: Object.keys(known).length,
        pace: a.paceLabel()
      });
    }
    /* Two totals, because she does not stop at the end of a list. knownWell and
       touched count every word she has met anywhere, so measuring them against the
       size of the list she started on read as "known well 56.3/14" — four times her
       own list. "start" is what she was set; "corpus" is what there is to learn. */
    return {rows, start: startSize, total: a.allWords().length};
  }, opts);
  return report;
}

function stats(rows){
  const live = rows.filter(r => !r.skipped);
  const sum = (k) => live.reduce((n, r) => n + r[k], 0);
  const mean = (k) => live.length ? sum(k) / live.length : 0;
  return {
    days: rows.length, sessions: live.length, skipped: rows.length - live.length,
    accuracy: sum('words') ? sum('firstTime') / sum('words') : 0,
    reviewShare: mean('reviewShare'),
    wordsPerSession: mean('words'),
    askedPerSession: mean('asked'),
    newTotal: sum('newWords'),
    knownWell: live.length ? live[live.length - 1].knownWell : 0,
    touched: live.length ? live[live.length - 1].touched : 0,
    worstAcc: Math.min.apply(null, live.map(r => r.acc)),
    stalls: live.filter(r => r.words <= 2).length
  };
}

function pct(x){ return (x * 100).toFixed(1) + '%'; }
function avg(xs){ return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function quant(xs, q){
  const s = xs.slice().sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0;
}

// A cohort of learners with different luck and different ability.
const COHORT = 12;
function abilityOf(i){ return .75 + .55 * (i / Math.max(1, COHORT - 1)); }

/* The pacing this app is trying to produce, as pass or fail rather than as a number for
   somebody to read.

   For a long time this file printed its figures and asserted nothing — it only exited
   non-zero when the browser threw. Every one of these numbers comes from a decision about
   how hard her evenings should be, and a change to NEW_SHARE or ACQUIRING_CAP or the box
   intervals could have moved first-go accuracy to 92% or to 74% with all three harnesses
   still green and nothing but a printout to notice it in. The whole reason the simulation
   exists is that reading the code did not catch pacing faults; printing numbers nobody has
   to act on is the same failure one step later.

   These are guard bands, not the target. The target is 80–85% first time, from the
   desirable-difficulty finding that practice is most productive somewhere short of easy —
   too high and she is being asked things she already knows, too low and the evening is a
   slog. Today the app runs 86–89%, one to four points above it, which is a deliberate
   open question about her difficulty level and not a fault. So the bands are set to catch
   drift, and the distance from target is printed underneath so it stays visible rather
   than becoming the new normal by accident. */
const BANDS = {
  // Desirable difficulty. Wide enough to hold today's 86–89%, tight enough that a lever
  // pushed hard in either direction fails here.
  'first-go':          {get: s => s.firstGo,      lo: .78, hi: .92, pct: true,
                        why: 'she is being asked things at about the right difficulty'},
  // The band has to hold for the child having the worst time of it, not just the mean.
  'worst learner':     {get: s => s.worst,        lo: .75, hi: .95, pct: true,
                        why: 'the weakest learner in the cohort is not being drowned'},
  // Spaced retrieval only works if most of a sitting is material she has met before.
  'known material':    {get: s => s.known,        lo: .70, hi: .90, pct: true,
                        why: 'most of a sitting is revision, not new words'},
  // Short enough to finish, long enough to be worth opening. Nine is the modelled ceiling.
  'words a sitting':   {get: s => s.words,        lo: 6,   hi: 12,
                        why: 'a sitting she can finish in one go'},
  // The tail, not the mean: one evening in ten is the one that decides if she comes back.
  'tenth-pct day':     {get: s => s.tenth,        lo: .60, hi: 1,   pct: true,
                        why: 'her worst evening in ten is still mostly right'},
  'hard days each':    {get: s => s.hard,         lo: 0,   hi: 3,
                        why: 'few evenings below half right'},
  'short sittings':    {get: s => s.stalls,       lo: 0,   hi: 2,
                        why: 'she is rarely handed a sitting of two words'},
  'skipped':           {get: s => s.skipped,      lo: 0,   hi: 0,
                        why: 'a day never passes with nothing to practise'},
};
const TARGET = {lo: .80, hi: .85};

/* The one band that is about learning rather than about how her evening felt, and the only
   one with any real teeth.

   Mutation-tested, and the difficulty bands above failed the test. Setting every Leitner
   interval to zero — deleting spaced repetition from the app outright — moves first-go
   accuracy by one tenth of a point and every difficulty band holds, because when everything
   is due every day she reviews more and gets more of it right. The evening feels the same.
   She just learns far less: 33.4 words in sixty days against 56.3. Raising both pool levers
   at once hides the same way, 47.9 words for an accuracy drop the bands are wide enough to
   allow.

   Expressed as a share of the words she has met rather than a count, so it means the same
   thing on a twelve-word list as on a hundred-word one, and so it still applies to a list
   she has finished. Shipped, it runs 89–100% across all six lists; the two mutations above
   put it at 60% and 65%. That gap is the spacing schedule doing its job, which is the whole
   claim the box intervals rest on. */
/* 0.75, not 0.80 (worklist PACE-1 / B2, owner-approved): the hardest small lists — tionsion is
   twelve all-irregular words — cannot get their last-met words to KNOWN_BOX inside a fixed
   30-day window. tionsion reads 77.9% at 30 days but 98.9% by 60 and 100% by 90, and the words
   met early enough to mature (>14d ago) are known-well at 97.9%. That is the window, not the
   pacing. The interval-deletion mutations still read 53–65% here, well under 0.75, so the band
   keeps its teeth. */
const LEARNED = {lo: .75, why: 'the words she has met are being learned, only slower than a'
                             + ' 30-day window can see — the hardest patterns need longer to mature'};

async function main(){
  const days = Number(process.argv[2]) || 30;
  const only = process.argv[3];
  const attend = (process.argv.find(x => /^--attend=/.test(x)) || '').split('=')[1] || 'daily';
  const one  = process.argv[4] ? Number(process.argv[4]) : null;
  const lists = only ? [only] : ['easy', 'tricky', 'longvowel', 'silent', 'tionsion', 'aussie'];

  const browser = await chromium.launch({executablePath: findChromium()});
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForFunction(() => !!window.__acorn);
  const errors = [], bands = [];
  page.on('pageerror', e => errors.push(String(e)));

  for(const listId of lists){
    const runs = [];
    const n = one ? 1 : COHORT;
    for(let i = 0; i < n; i++){
      const r = await run(page, {days, listId, learnerSrc: LEARNER, attend,
                                 seed: 10007 + i * 7919, ability: one ? 1 : abilityOf(i)});
      runs.push({...r, stats: stats(r.rows)});
    }
    const total = runs[0].total, start = runs[0].start;
    console.log('\n=== ' + listId + ' — ' + start + ' words to start, ' + total
              + ' in all, ' + days + ' days, ' +
                n + (n === 1 ? ' learner' : ' learners') +
                (attend === 'daily' ? '' : ', practising ' + attend) + ' ===');

    if(one){
      console.log('day  asked words 1st-go  review%  new  known-well  pace');
      runs[0].rows.forEach(r => {
        if(r.skipped) return console.log(String(r.day).padStart(3) + '  (no session)');
        console.log(
          String(r.day).padStart(3) +
          String(r.asked).padStart(7) + String(r.words).padStart(6) +
          pct(r.acc).padStart(8) + pct(r.reviewShare).padStart(9) +
          String(r.newWords).padStart(5) + String(r.knownWell).padStart(12) +
          '  ' + r.pace);
      });
    }else{
      // The first fortnight, averaged across the cohort — the part that decides
      // whether she keeps opening the app.
      console.log('day  1st-go  review%  new  known-well   (cohort mean)');
      for(let d = 0; d < Math.min(14, days); d++){
        const rs = runs.map(r => r.rows[d]).filter(r => r && !r.skipped);
        if(!rs.length) continue;
        console.log(String(d).padStart(3) +
          pct(avg(rs.map(r => r.acc))).padStart(8) +
          pct(avg(rs.map(r => r.reviewShare))).padStart(9) +
          avg(rs.map(r => r.newWords)).toFixed(1).padStart(5) +
          avg(rs.map(r => r.knownWell)).toFixed(1).padStart(12));
      }
    }

    const S = runs.map(r => r.stats);
    const accs = S.map(s => s.accuracy);
    console.log('--- first-go ' + pct(avg(accs)) +
                ' (worst learner ' + pct(Math.min(...accs)) +
                ', best ' + pct(Math.max(...accs)) + ')' +
                ' | known material ' + pct(avg(S.map(s => s.reviewShare))));
    console.log('    words/session ' + avg(S.map(s => s.wordsPerSession)).toFixed(1) +
                ' | asked/session ' + avg(S.map(s => s.askedPerSession)).toFixed(1) +
                ' | known well ' + avg(S.map(s => s.knownWell)).toFixed(1) + '/' + total +
                ' | met ' + avg(S.map(s => s.touched)).toFixed(1) + '/' + total);
    // A day below half right is a day she is likely to feel bad about.
    const bad = runs.flatMap(r => r.rows.filter(x => !x.skipped && x.acc < .5).length);
    console.log('    hard days (<50% right) ' + avg(bad).toFixed(1) + ' per learner' +
                ' | 10th-pct day ' + pct(quant(runs.flatMap(r => r.rows.filter(x => !x.skipped).map(x => x.acc)), .1)) +
                ' | short sessions ' + avg(S.map(s => s.stalls)).toFixed(1) +
                ' | skipped ' + avg(S.map(s => s.skipped)).toFixed(1));

    /* Held to the bands — except on a list she has finished. "aussie" is fourteen words
       long with nothing set to follow it, so she meets all fourteen and from then on every
       sitting is pure revision and runs at 96%. That is the list running out, not the
       pacing going wrong, and holding it to a difficulty band would only teach us to widen
       the band until it meant nothing.

       The test for that is whether new material is still arriving, not a count of words
       met: "met 14 of 100" looks like she has barely started, because the 100 is the whole
       corpus and not what this list can reach. My first attempt compared the two and let
       the outlier straight through the exemption it was written for. */
    const lastThird = runs.map(r => r.rows.slice(Math.floor(r.rows.length * 2 / 3))
      .reduce((n, x) => n + (x.skipped ? 0 : x.newWords), 0));
    const stillArriving = avg(lastThird);
    const met = avg(S.map(s => s.touched));
    const measured = {
      firstGo: avg(accs), worst: Math.min(...accs),
      known: avg(S.map(s => s.reviewShare)),
      words: avg(S.map(s => s.wordsPerSession)),
      tenth: quant(runs.flatMap(r => r.rows.filter(x => !x.skipped).map(x => x.acc)), .1),
      hard: avg(bad), stalls: avg(S.map(s => s.stalls)), skipped: avg(S.map(s => s.skipped)),
    };
    /* Checked on every list, finished or not — a list she has met all of is exactly where
       "did she learn them" is the only question left worth asking. */
    const known = avg(S.map(s => s.knownWell));
    const learned = met ? known / met : 1;
    if(learned < LEARNED.lo - 1e-9){
      const o = 'learned ' + pct(learned) + ' of the ' + met.toFixed(0)
              + ' words she met, under ' + pct(LEARNED.lo) + ' — ' + LEARNED.why;
      bands.push(listId + ': ' + o);
      console.log('    ✗ ' + o);
    }else{
      console.log('    ✓ learned ' + pct(learned) + ' of the ' + met.toFixed(0)
                  + ' words she met');
    }
    /* < 3, not < 0.5 (worklist PACE-1 / B3, owner-approved): a box-1 word she keeps missing
       re-counts as a "new" arrival each day, so a nearly-finished list like aussie reads
       stillArriving 1.67 while lists with real intake from the lists that follow them sit near
       25. The gap is enormous, so a cutoff of 3 exempts aussie's pure-revision tail — its
       acquisition first-go, 87%, is inside the band — with no risk to any healthy list. This
       is the fix for its 92.5%: the exemption already fired at 60 and 90 days, only its 30-day
       trigger was set too tight. */
    if(stillArriving < 3){
      console.log('    (nothing new arrived in the last third of the run — she has met all '
                  + met.toFixed(0) + ' words this list can reach, so every sitting is pure'
                  + ' revision and the difficulty bands do not apply)');
    }else{
      const off = [];
      for(const [name, b] of Object.entries(BANDS)){
        const v = b.get(measured);
        if(v < b.lo - 1e-9 || v > b.hi + 1e-9){
          const f = b.pct ? pct : (x => x.toFixed(1));
          off.push(name + ' ' + f(v) + ' is outside ' + f(b.lo) + '–' + f(b.hi)
                   + ' — ' + b.why);
        }
      }
      off.forEach(o => { bands.push(listId + ': ' + o); console.log('    ✗ ' + o); });
      if(!off.length) console.log('    ✓ all ' + Object.keys(BANDS).length
                                  + ' pacing bands held');
      // Printed whether or not it passed, so the gap to the target cannot quietly widen.
      const d = measured.firstGo > TARGET.hi ? '+' + pct(measured.firstGo - TARGET.hi)
              : measured.firstGo < TARGET.lo ? '-' + pct(TARGET.lo - measured.firstGo)
              : 'inside it';
      console.log('      first-go against the 80–85% target: ' + d);
    }
  }
  await browser.close();
  if(errors.length){
    console.log('\nPAGE ERRORS:'); errors.forEach(e => console.log('  ' + e));
  }
  if(bands.length){
    console.log('\nPACING OUT OF BAND (' + bands.length + '):');
    bands.forEach(b => console.log('  ' + b));
  }else{
    console.log('\npacing within every band');
  }
  if(bands.length || errors.length) process.exitCode = 1;
}

if(require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = {run, stats, LEARNER, BANDS};
