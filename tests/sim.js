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
    return {rows, total: a.wordsOf(a.activeList()).length};
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
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  for(const listId of lists){
    const runs = [];
    const n = one ? 1 : COHORT;
    for(let i = 0; i < n; i++){
      const r = await run(page, {days, listId, learnerSrc: LEARNER, attend,
                                 seed: 10007 + i * 7919, ability: one ? 1 : abilityOf(i)});
      runs.push({...r, stats: stats(r.rows)});
    }
    const total = runs[0].total;
    console.log('\n=== ' + listId + ' — ' + total + ' words, ' + days + ' days, ' +
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
  }
  await browser.close();
  if(errors.length){ console.log('\nPAGE ERRORS:'); errors.forEach(e => console.log('  ' + e)); }
}

if(require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = {run, stats, LEARNER};
