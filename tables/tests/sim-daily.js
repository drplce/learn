/* 144 — would the DAILY-TARGET plan work?
 *
 * `sim.js` simulates the ladder that is in the app today: 48 levels, each
 * `learn` level introducing FOUR new facts and asking for two right answers
 * each. It reports ~36/78 facts "known well" by day 142 against a target of 74.
 *
 * This file simulates a DIFFERENT scheduler — David's, 2026-08-12:
 *
 *   (a) ONE new "target" fact a day (occasionally two), hammered that day with
 *       many reps, including its inverse (8 × ? = 56, ? × 8 = 56).
 *   (b) Previously-learned facts interleaved among those reps so they do not
 *       decay while attention is on the new one.
 *   (c) She is already solid on ×1, ×2, ×5 and ×10 — those are seeded at box
 *       4–5 on day 0, so only the remaining facts have to be acquired.
 *   (d) About two short sessions a day.
 *   (e) ~45 days of acquisition, then ~97 days of consolidation.
 *
 * IT DRIVES THE REAL ENGINE, the same way sim.js does: the real `pickFact`
 * (weak-first, due-beats-not-due, never twice in a row), the real `record`
 * and therefore the real Leitner boxes and `KNOWN_BOX`, the real `setToday`,
 * inside the real page. Nothing about the boxes is reimplemented here. What IS
 * new is the SCHEDULER — the thing being evaluated — because the ladder in the
 * app cannot express "one fact a day"; and a second, stricter learner model
 * (below), because the daily plan is precisely the case where sim.js's learner
 * model flatters itself.
 *
 * TWO LEARNER MODELS, both reported. This is the crux, so read it:
 *
 *   'box'    — sim.js's model, character for character: her chance of getting a
 *              fact right is a function of the Leitner BOX. It is the only way
 *              to read the two simulations side by side. But `record()` counts
 *              RETRIEVALS, not DAYS: five right answers in one sitting move a
 *              fact from box 0 to box 5. So under this model massed practice is
 *              *guaranteed* to look like mastery, by construction, on the very
 *              first day the fact is met. That is an artefact, not a finding.
 *
 *   'spaced' — the honest one. The learner keeps her own STRENGTH per fact,
 *              which the app cannot see. A correct retrieval adds strength, but
 *              the 2nd, 3rd, 4th rep of the same fact on the same DAY add
 *              1/2, 1/3, 1/4 as much (the spacing effect — massed practice buys
 *              performance now, not memory later). Strength decays between
 *              days, slowly once it is high. Repeating a fact within the day
 *              also gives a big short-term "it is fresh in mind" bonus, so a
 *              massed day *feels* like it worked — and the app's boxes rise
 *              accordingly, which is exactly the trap worth showing.
 *
 * TWO EXTRA MEASURES, because "known" turned out to be cheap to hit. Neither
 * relaxes anything — both are HARDER bars, reported alongside David's targets:
 *
 *   durable — the real engine's own records, recounted strictly: box ≥ KNOWN_BOX
 *             *and* answered right on at least KNOWN_BOX DIFFERENT DAYS.
 *   recall  — the learner model's own strength, summed over all 78 facts: how
 *             many she could produce today with no bubbles to choose from. The
 *             app cannot measure this, which is the whole point.
 *
 * WHY "known" is cheap: a miss keeps the question up until it lands (the app's
 * real, kind behaviour) and `record` moves the box on every attempt. So one
 * presentation is +1 box if she gets it first go and net 0 if she misses once —
 * boxes drift upward for anything asked regularly and only fall on a fact she is
 * actually shown and misses twice. And `pickFact` stops choosing facts in high
 * boxes, so a box-5 fact tends never to be tested again: the count is a ratchet.
 * `known` therefore means "asked about five times and mostly landed", not "knows
 * it". Read `known` next to `recall`, never on its own.
 *
 * THREE REVIEW CHOOSERS are compared, because the plan's part (b) — interleaved
 * old facts — turns out to be the whole ballgame, and the app cannot currently
 * do it (see the picker diagnostic printed first). They are 'real', 'window' and
 * 'due'; each is documented where it is defined.
 *
 *   node tables/tests/sim-daily.js
 *
 * Exit code: non-zero only for genuine code health (page errors, or the real
 * LEVELS ladder running out of sessions). A dose that is too small or sessions
 * that are too long are findings about the PROPOSAL, not defects in the app, so
 * they print loudly and exit 0. sim.js remains the gate on the shipped ladder.
 */
const path = require('path');
const {chromium} = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const {findChromium} = require('../playwright.config.js');

const APP = 'file://' + path.join(__dirname, '..', 'index.html');
const DAYS_SPRINT = 45;          // David's acquisition sprint
const DAYS_TOTAL  = 142;         // to the end of the year
const SESSIONS    = 2;           // his target: two short sittings a day
const LEARNERS    = 8;
const FACTS       = 78;          // 144 cells, 78 different facts

const ABILITIES   = [0.72, 0.80, 0.86, 0.92, 0.98, 1.04, 1.12, 1.20];  // as sim.js
const GRID_ABIL   = [0.72, 0.86, 1.04, 1.20];   // four of the eight, for the sweeps

// The nominal daily dose: 12 reps of today's target and 12 interleaved old
// facts, split across two sittings; two targets every 4th day.
const NOMINAL = {targetReps: 12, interleave: 12, twoEvery: 4, teach: 0.20};

// ---- one modelled child, in the page (page.evaluate ships the source) ----
function runLearner(cfg){
  const a = window.__144;
  let s = cfg.seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const facts = () => a.state.facts;

  // sim.js's difficulty split, unchanged, so the two files agree about which
  // facts are hard.
  const isEasy = (x, y) => x <= 2 || y <= 2 || x === 5 || y === 5 || x === 10 || y === 10
                        || x === 11 || y === 11 || x === y;
  const isHard = (x, y) => (x >= 6 && x <= 8 && y >= 6 && y <= 8) || x === 12 || y === 12;
  const SOLID = [1, 2, 5, 10];                       // (c) she already owns these
  const seeded = (x, y) => SOLID.indexOf(x) >= 0 || SOLID.indexOf(y) >= 0;

  /* ---- the learner's own memory: what the app cannot see ----
   * s     = how well she can produce this fact right now, 0..1
   * days  = on how many DIFFERENT days she has retrieved it correctly. This sets
   *         a FLOOR under s that never decays: practice spread over days sticks,
   *         practice piled into one day does not. That single line is where the
   *         spacing effect lives, and it is what the daily plan is betting on.  */
  const mem = Object.create(null);
  const floorOf = e => Math.min(0.88, 0.13 * e.days);
  function strength(k, day){
    const e = mem[k];
    if(!e) return 0;
    if(day > e.day){
      const fl = floorOf(e), tau = 2 + 30 * e.s * e.s;   // strong memories fade slower
      if(e.s > fl) e.s = fl + (e.s - fl) * Math.exp(-(day - e.day) / tau);
      e.day = day;
    }
    return e.s;
  }
  function learn(k, day, right, repsToday){
    const e = mem[k] || (mem[k] = {s: 0, day: day, days: 0, rDay: -1});
    strength(k, day);
    const p = k.split('x').map(Number);
    const diff = isEasy(p[0], p[1]) ? 1.25 : isHard(p[0], p[1]) ? 0.72 : 1.0;
    if(right){
      const g = 0.17 * diff / (1 + repsToday);       // massed reps: diminishing returns
      e.s = e.s + g * (1 - e.s);
      if(e.rDay !== day){ e.days++; e.rDay = day; }  // a NEW day of practice: it sticks
    } else {
      e.s = e.s * 0.90 + 0.05 * (1 - e.s) * diff;    // a miss keeps the question up,
    }                                                // and seeing it teaches a little
  }
  function show(k, day){                             // a "here it is" moment
    const e = mem[k] || (mem[k] = {s: 0, day: day, days: 0, rDay: -1});
    strength(k, day);
    if(e.s < cfg.teach) e.s = cfg.teach;
  }

  /* ---- who chooses the interleaved review facts ----
   * 'real'   = the app's own pickFact over everything she has met. What she
   *            would actually get today.
   * 'window' = the app's own pickFact, unchanged, but over a TABLE-SIZED pool
   *            that rotates each sitting — which is what the app's `mix` and
   *            `boss` levels already do. Nothing new has to be invented for
   *            this one; it is a scheduling choice, not a code change.
   * 'due'    = a PROPOSAL that does not exist in the app — the plainest possible
   *            Leitner choice: whatever is furthest past its own box interval,
   *            lowest box breaks ties, never the same fact twice in a row. It
   *            still uses the real boxes and the real BOX_DAYS. It is here only
   *            to answer "would the plan work if review were spread out?".   */
  let lastDue = null, todayIso = '';
  function pickDue(pool){
    let best = null, bestW = -1e9;
    for(let i = 0; i < pool.length; i++){
      const k = pool[i], f = facts()[k];
      const gap = f && f.last ? a.dayDiff(todayIso, f.last) : 99;
      let w = (gap - (a.BOX_DAYS[f ? f.box : 1] || 0)) - (f ? f.box : 1) * 0.35
            + Math.random() * 0.5;
      if(k === lastDue) w -= 50;
      if(w > bestW){ bestW = w; best = k; }
    }
    lastDue = best;
    return best;
  }
  const choose = pool => cfg.chooser === 'due' ? pickDue(pool) : a.pickFact(pool);

  function pRight(k, nOptions, day, repsToday){
    const p = k.split('x').map(Number);
    const guess = 1 / nOptions;                      // multiple choice has a floor
    let raw;
    if(cfg.model === 'box'){
      const f = facts()[k], box = f ? f.box : 0;
      const base = isEasy(p[0], p[1]) ? 0.60 : isHard(p[0], p[1]) ? 0.16 : 0.34;
      raw = (base + Math.min(1, box / 6) * 0.78) * cfg.ability;
    } else {
      raw = strength(k, day) * 1.05 * cfg.ability;
      if(repsToday > 0) raw += Math.min(0.55, 0.22 * repsToday);   // fresh in mind
    }
    return Math.max(0.05, Math.min(0.985, guess + (1 - guess) * Math.max(0, Math.min(1, raw))));
  }

  let answers = 0, taps = 0, tapsRight = 0, asked = 0, firstGoRight = 0;
  let sessionsPlayed = 0, at45 = null, day = 0, lastNewDay = 0, introduced = 0;
  let repsToday = Object.create(null);
  const rightDays = Object.create(null);              // fact -> set of days it landed
  const shown = Object.create(null);                  // fact -> days it was asked at all
  const perDay = [], trace = [];
  const ALLK = [];
  for(let x = 1; x <= 12; x++) for(let y = x; y <= 12; y++) ALLK.push(a.key(x, y));

  // What she could actually produce today, unaided — the app cannot measure this,
  // and it is the number that matters. Expected count, no state touched.
  function recallable(){
    let n = 0;
    ALLK.forEach(k => { n += Math.max(0, Math.min(1, strength(k, day) * 1.05 * cfg.ability)); });
    return n;
  }

  // One question, answered the way she does: a miss keeps it up until it lands.
  function ask(k, nOptions, countFirst){
    let rt = repsToday[k] || 0;
    let right = rnd() < pRight(k, nOptions, day, rt);
    answers++; taps++; if(right) tapsRight++;
    if(countFirst){ asked++; if(right) firstGoRight++; }
    a.record(k, right, false);
    learn(k, day, right, rt);
    repsToday[k] = ++rt;
    (shown[k] || (shown[k] = Object.create(null)))[day] = 1;
    let tries = 0;
    while(!right && tries++ < 6){
      right = rnd() < pRight(k, nOptions, day, rt);
      answers++; taps++; if(right) tapsRight++;
      a.record(k, right, false);
      learn(k, day, right, rt);
      repsToday[k] = ++rt;
    }
    if(right) (rightDays[k] || (rightDays[k] = Object.create(null)))[day] = 1;
    return right;
  }

  /* ---- day 0: the real first-open placement check, then (c)'s seeding ----
   * Set the clock FIRST. `__144.reset()` does not clear `_today`, so without
   * this the second and later learners stamp their day-0 records with the date
   * the PREVIOUS learner finished on — a date in the future — and every one of
   * those facts then looks "not due" for the whole run and is never chosen.
   * (sim.js has the same hole for its 14 placement facts; it is not this file's
   * to fix, but it is worth knowing when the two are read together.)          */
  todayIso = new Date(2026, 7, 11).toISOString().slice(0, 10);
  a.setToday(todayIso);
  (function placement(){
    const lv = a.placementLevel();
    lv.facts.forEach(k => {
      const right = rnd() < pRight(k, 3, 0, 0);
      a.record(k, right, true);                      // the real seeding rule
      learn(k, 0, right, 0);
      answers++; taps++; asked++; if(right){ tapsRight++; firstGoRight++; }
    });
    a.state.prog.placed = true;
  })();

  let nSeeded = 0;
  for(let x = 1; x <= 12; x++) for(let y = x; y <= 12; y++){
    if(!seeded(x, y)) continue;
    const k = a.key(x, y);
    a.record(k, true, true);                          // box 4 — the engine's own rule
    // seedBox: where "she already owns this" should start. 4 is what the app's
    // placement check actually does; 5 would mean a demonstrated fact counts as
    // known immediately. It turns out to matter more than the whole daily dose.
    if(cfg.seedBox === 5 || (cfg.seedBox !== 4 && rnd() < 0.5)) a.record(k, true, false);
    // solid means solid: years of school have given these many separate days of
    // practice, so they sit on a high floor and do not evaporate over the year.
    mem[k] = {s: 0.72 + 0.16 * rnd(), day: 0, days: 6, rDay: 0};
    nSeeded++;
  }

  /* ---- the acquisition queue: anchors-first, minus what she already owns ---- */
  const queue = [], inQ = Object.create(null);
  a.TABLE_ORDER.forEach(t => {
    for(let b = 1; b <= 12; b++){
      const k = a.key(t, b), p = k.split('x').map(Number);
      if(inQ[k] || seeded(p[0], p[1])) continue;
      inQ[k] = 1; queue.push(k);
    }
  });
  const toAcquire = queue.length;

  // spread the review items evenly through the target reps
  function weave(T, R){
    const out = [];
    let ti = 0, ri = 0;
    while(ti < T.length || ri < R.length){
      const takeT = ti < T.length &&
        (ri >= R.length || (ti + 1) / T.length <= (ri + 1) / R.length);
      out.push(takeT ? T[ti++] : R[ri++]);
    }
    return out;
  }

  for(day = 1; day <= cfg.days; day++){
    const iso = new Date(2026, 7, 11 + day).toISOString().slice(0, 10);
    todayIso = iso;
    a.setToday(iso);                                  // the real clock hook
    repsToday = Object.create(null);
    let dayAnswers = 0, dayAsked = 0, dayRight = 0;

    const nT = queue.length ? ((cfg.twoEvery && day % cfg.twoEvery === 0) ? 2 : 1) : 0;
    const targets = queue.splice(0, Math.min(nT, queue.length));
    if(targets.length){ lastNewDay = day; introduced += targets.length; }
    targets.forEach(k => { if(cfg.teach > 0 && cfg.model !== 'box') show(k, day); });

    for(let sess = 0; sess < cfg.sessions; sess++){
      // the pool of old facts: everything she has met, minus today's target
      let pool = Object.keys(facts()).filter(k =>
        facts()[k].seen > 0 && targets.indexOf(k) < 0);
      if(cfg.chooser === 'window'){
        // one table at a time, rotating each sitting — the app's own `mix`/`boss`
        // shape, which is the only thing that keeps pickFact's pool small enough
        // for it to behave.
        const t = a.TABLE_ORDER[(day * cfg.sessions + sess) % a.TABLE_ORDER.length];
        const win = [];
        for(let b = 1; b <= 12; b++){
          const k = a.key(t, b);
          if(pool.indexOf(k) >= 0) win.push(k);
        }
        if(win.length) pool = win;
      }

      // The dose is CONSTANT across the year: during the 45-day sprint it is
      // target reps + interleaved review; once every fact has been introduced
      // there is no target left, so the whole dose becomes review. (Otherwise
      // the consolidation months would silently be half as long a sitting.)
      const share = Math.round(cfg.targetReps / cfg.sessions);
      const T = [], R = [];
      const tReps = targets.length ? share : 0;
      const rReps = Math.round(cfg.interleave / cfg.sessions) + (targets.length ? 0 : share);
      if(targets.length) for(let i = 0; i < tReps; i++) T.push(targets[i % targets.length]);
      if(pool.length)    for(let i = 0; i < rReps; i++) R.push(null);
      const plan = weave(T, R);

      const firstInSession = Object.create(null);
      let sessionAnswers = 0, round = 1;
      for(let i = 0; i < plan.length; i++){
        const k = plan[i] || choose(pool);            // the picker chooses the review reps
        if(!k) continue;
        const nOptions = round < 2 ? 3 : 4;           // as the app ramps
        const first = !firstInSession[k];
        firstInSession[k] = 1;
        const before = answers;
        ask(k, nOptions, first);
        if(first){ dayAsked++; if(answers === before + 1) dayRight++; }
        sessionAnswers += answers - before;
        dayAnswers += answers - before;
        while(sessionAnswers >= round * 4) round++;
      }
      a.state.prog.cleared++;                         // one sitting = one level slot
      sessionsPlayed++;
    }
    perDay.push({day, answers: dayAnswers, firstGo: dayAsked ? dayRight / dayAsked : 1});
    if(day === 45) at45 = snapshot();
    if([1, 15, 30, 45, 60, 75, 90, 105, 120, cfg.days].indexOf(day) >= 0){
      const sn = snapshot();
      trace.push({day, known: sn.known, durable: sn.durable, recall: sn.recall});
    }
  }

  function snapshot(){
    const f = facts(), keys = Object.keys(f);
    let known = 0, met = 0, firm = 0, box = 0, durable = 0;
    keys.forEach(k => {
      if(f[k].seen) met++;
      box += f[k].box;
      if(f[k].box >= 3) firm++;
      if(f[k].box >= a.KNOWN_BOX){
        known++;
        const d = rightDays[k] ? Object.keys(rightDays[k]).length : 0;
        if(d >= a.KNOWN_BOX) durable++;
      }
    });
    return {met, known, firm, durable, recall: recallable(),
            avgBox: keys.length ? box / keys.length : 0,
            cleared: a.state.prog.cleared};
  }

  const end = snapshot();
  // per-fact end state, so the driver can name what she is left stuck on
  const endBox = Object.create(null), endDays = Object.create(null);
  ALLK.forEach(k => {
    endBox[k] = facts()[k] ? facts()[k].box : 0;
    endDays[k] = shown[k] ? Object.keys(shown[k]).length : 0;
  });
  return {
    ability: cfg.ability, model: cfg.model,
    firstGo: asked ? firstGoRight / asked : 0,
    tapAccuracy: taps ? tapsRight / taps : 0,
    answers, sessionsPlayed,
    answersPerSession: answers / sessionsPlayed,
    answersPerDay: answers / cfg.days,
    at45: at45 || end, end, trace, endBox, endDays,
    worstDay: perDay.reduce((m, d) => Math.min(m, d.firstGo), 1),
    nSeeded, toAcquire, introduced, lastNewDay,
    levels: a.state.prog.cleared, totalLevels: a.LEVELS.length
  };
}

// ---------------------------------------------------------------------------
(async () => {
  const exe = findChromium();
  const browser = await chromium.launch(exe ? {executablePath: exe} : {});
  const page = await (await browser.newContext()).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(APP);
  await page.waitForFunction(() => !!window.__144);

  const avg = (rs, f) => rs.reduce((s, r) => s + f(r), 0) / rs.length;
  const pct = x => (x * 100).toFixed(1) + '%';

  async function run(cfg, abilities, days){
    const out = [];
    for(let i = 0; i < abilities.length; i++){
      await page.evaluate(() => window.__144.reset());
      out.push(await page.evaluate(runLearner, Object.assign({}, cfg, {
        ability: abilities[i], days: days || DAYS_TOTAL, sessions: SESSIONS,
        seed: 7919 * (i + 1)
      })));
    }
    return out;
  }

  console.log('\n144 — the DAILY-TARGET plan: one new fact a day, hammered, old facts woven in');
  console.log(LEARNERS + ' modelled learners, ' + SESSIONS + ' sessions a day, '
            + DAYS_TOTAL + ' days (sprint = ' + DAYS_SPRINT + ')');
  console.log('nominal dose: ' + NOMINAL.targetReps + ' reps of today\'s target + '
            + NOMINAL.interleave + ' interleaved old facts, two targets every '
            + NOMINAL.twoEvery + 'th day, split over ' + SESSIONS + ' sittings\n');

  /* ---- FIRST, a diagnostic about the app as it stands, because it decides
     everything below: can the real picker actually spread review over 78 facts?
     Set up a plausible mid-year state and just watch what it chooses. ---- */
  const spread = await page.evaluate(() => {
    const a = window.__144;
    a.reset(); a.setToday('2026-09-20');
    const ALL = [];
    for(let x = 1; x <= 12; x++) for(let y = x; y <= 12; y++) ALL.push(a.key(x, y));
    ALL.forEach((k, i) => {
      const f = a.mastery(k);
      f.seen = 20; f.right = 15; f.wrong = i % 5; f.box = 5; f.last = '2026-09-10';
    });
    ['6x7', '7x8', '8x9', '6x8', '7x9', '12x12'].forEach(k => {
      const f = a.mastery(k); f.box = 3; f.wrong = 6;                 // a mild hard core
    });
    const tally = Object.create(null);
    for(let i = 0; i < 1000; i++){ const k = a.pickFact(ALL); tally[k] = (tally[k] || 0) + 1; }
    const top = Object.keys(tally).sort((x, y) => tally[y] - tally[x]).slice(0, 8);
    return {distinct: Object.keys(tally).length, of: ALL.length,
            top: top.map(k => k + ':' + tally[k])};
  });
  console.log('  THE PICKER, over a whole-table review pool (1000 picks, mid-year state):');
  console.log('    it returns ' + spread.distinct + ' different facts out of ' + spread.of + '  —  '
            + spread.top.join('  '));
  console.log('    `pickFact` adds `wrong * 2.4`, and `wrong` is a LIFETIME miss count that never');
  console.log('    decays, so it outgrows every other term (box ≤ 4.9, due 1.8, jitter 1.2). Three');
  console.log('    extra misses is enough to make a fact permanently the pick. Interleaved review');
  console.log('    over a wide pool is therefore not something the app can currently do.\n');

  /* ---- three choosers, so the plan can be judged apart from that bug ---- */
  const CHOOSERS = [
    ['real picker, whole-table pool (the app as it is today)', 'real'],
    ['real picker, one table at a time (a SCHEDULING change only)', 'window'],
    ['spread-review chooser (a PROPOSAL — does not exist in the app)', 'due'],
  ];

  const avgKnown = rs => avg(rs, r => r.end.known);
  function planOf(runs){
    const k45 = avg(runs, r => r.at45.known), kEnd = avgKnown(runs);
    const wEnd = Math.min(...runs.map(r => r.end.known));
    return [
      ['sprint: ≥60/78 known by day 45',              k45 >= 60,  k45.toFixed(1) + '/78'],
      ['year:   ≥74/78 known by day ' + DAYS_TOTAL,   kEnd >= 74, kEnd.toFixed(1) + '/78'],
      ['slowest learner ≥70/78 by day ' + DAYS_TOTAL, wEnd >= 70, wEnd + '/78'],
    ];
  }
  function table(label, runs){
    console.log('  ' + label);
    console.log('   ability  first-go  all taps  known@45  known@end  durable@end  recall@end  ans/session');
    runs.forEach(r => {
      console.log('    ' + r.ability.toFixed(2)
        + '     ' + pct(r.firstGo).padStart(6)
        + '    ' + pct(r.tapAccuracy).padStart(6)
        + '   ' + String(r.at45.known + '/' + FACTS).padStart(7)
        + '    ' + String(r.end.known + '/' + FACTS).padStart(7)
        + '      ' + String(r.end.durable + '/' + FACTS).padStart(7)
        + '     ' + String(r.end.recall.toFixed(0) + '/' + FACTS).padStart(7)
        + '       ' + r.answersPerSession.toFixed(1).padStart(5));
    });
    const k45 = avg(runs, r => r.at45.known), kEnd = avgKnown(runs);
    console.log('    → known by day 45: ' + k45.toFixed(1) + '/' + FACTS
      + ' (worst ' + Math.min(...runs.map(r => r.at45.known)) + ')'
      + ' | by day ' + DAYS_TOTAL + ': ' + kEnd.toFixed(1) + '/' + FACTS
      + ' (worst ' + Math.min(...runs.map(r => r.end.known)) + ')  [moved '
      + (kEnd - k45 >= 0 ? '+' : '') + (kEnd - k45).toFixed(1) + ' over the 97 consolidation days]');
    console.log('      durable ' + avg(runs, r => r.end.durable).toFixed(1) + '/' + FACTS
      + ' | unaided recall ' + avg(runs, r => r.end.recall).toFixed(1) + '/' + FACTS
      + ' | box 3+ ' + avg(runs, r => r.end.firm).toFixed(1) + '/' + FACTS
      + ' | average box ' + avg(runs, r => r.end.avgBox).toFixed(1) + ' of 7'
      + ' | ' + avg(runs, r => r.answersPerDay).toFixed(1) + ' answers a day');
    const mid = runs[Math.floor(runs.length / 2)];
    console.log('      over time (ability ' + mid.ability.toFixed(2)
      + ', day: known / durable / unaided recall):  '
      + mid.trace.map(t => t.day + ': ' + t.known + '/' + t.durable + '/' + t.recall.toFixed(0))
          .join('   ') + '\n');
  }
  function coverage(runs){
    const tally = Object.create(null), askedDays = Object.create(null);
    runs.forEach(r => Object.keys(r.endBox).forEach(k => {
      if(r.endBox[k] < 5) tally[k] = (tally[k] || 0) + 1;
      askedDays[k] = (askedDays[k] || 0) + r.endDays[k] / runs.length;
    }));
    const worst = Object.keys(tally).sort((x, y) => tally[y] - tally[x]).slice(0, 12);
    if(worst.length) console.log('    left under box 5 at day ' + DAYS_TOTAL + ' (of ' + runs.length
      + ' learners):  ' + worst.map(k => k.replace('x', '×') + ' (' + tally[k] + ')').join('  '));
    const days = Object.keys(askedDays).map(k => askedDays[k]).sort((p, q) => p - q);
    console.log('    days on which a fact is asked at all, over the whole year:'
      + ' median ' + days[Math.floor(days.length / 2)].toFixed(1)
      + ', lowest ' + days[0].toFixed(1) + ', highest ' + days[days.length - 1].toFixed(1)
      + '  (of ' + DAYS_TOTAL + ')');
    const never = days.filter(d => d < 1).length;
    console.log('    facts never asked once in the whole year: ' + never + '/' + FACTS + '\n');
  }

  const primary = {};
  for(const [label, chooser] of CHOOSERS){
    console.log('  ══ ' + label.toUpperCase() + ' ══\n');
    const box = await run(Object.assign({}, NOMINAL, {model: 'box', chooser}), ABILITIES);
    const spaced = await run(Object.assign({}, NOMINAL, {model: 'spaced', chooser}), ABILITIES);
    primary[chooser] = {box, spaced};
    if(chooser === 'real'){
      console.log('  she already owns ' + box[0].nSeeded + '/' + FACTS
        + ' facts on day 0 (×1 ×2 ×5 ×10), so ' + box[0].toAcquire + ' have to be acquired;');
      console.log('  the last new one is introduced on day ' + box[0].lastNewDay + ' ('
        + box[0].introduced + ' targets), leaving day ' + (box[0].lastNewDay + 1) + '–'
        + DAYS_TOTAL + ' for consolidation.\n');
    }
    table('box model    (sim.js\'s learner — comparable, but flatters massed practice)', box);
    table('spaced model (the honest one — massed reps buy today, not next month)', spaced);
    coverage(spaced);
    [['box model', box], ['spaced model', spaced]].forEach(([m, runs]) => {
      console.log('    the plan\'s own targets — ' + m + ':');
      planOf(runs).forEach(([name, ok, got]) =>
        console.log('      ' + (ok ? '✓' : '✗') + ' ' + name + '  — got ' + got));
    });
    const d45 = avg(spaced, r => r.at45.durable), dEnd = avg(spaced, r => r.end.durable);
    console.log('    the harder "durable" bar (box ≥ KNOWN_BOX, earned on ≥5 different days):');
    console.log('      ' + (d45 >= 60 ? '✓' : '✗') + ' ≥60 by day 45 — got ' + d45.toFixed(1) + '/78'
      + '    ' + (dEnd >= 74 ? '✓' : '✗') + ' ≥74 by day ' + DAYS_TOTAL + ' — got '
      + dEnd.toFixed(1) + '/78\n');
  }

  /* ---- HEALTH bands. The same six as sim.js, so the two files read side by
     side. Marked [code] where a breach means the APP is broken (those fail the
     run) and [dose] where it means the PROPOSED DOSE is wrong (exit stays 0:
     this file evaluates a proposal, sim.js is the gate on shipped code). ---- */
  const spaced = primary.real.spaced;
  const perSess = avg(spaced, r => r.answersPerSession);
  const firstGo = avg(spaced, r => r.firstGo);
  const known45 = avg(spaced, r => r.at45.known);
  const knownEnd = avgKnown(spaced);

  console.log('  HEALTH bands (honest model, nominal dose, real picker — as sim.js prints them):');
  const health = [
    ['dose', 'nobody is stuck: every learner keeps clearing levels',
      () => spaced.every(r => r.levels > 20)],
    ['code', 'the path never runs out (levels available > played)',
      () => spaced.every(r => r.totalLevels > r.levels)],
    ['dose', 'a session stays short (6–26 answers)',
      () => perSess >= 6 && perSess <= 26],
    ['dose', 'first-go sits in a workable band (70–95%)',
      () => firstGo >= 0.70 && firstGo <= 0.95],
    ['dose', 'progress keeps moving after the sprint',
      () => knownEnd >= known45],
    ['code', 'no page errors while simulating', () => errors.length === 0],
  ];
  let bad = 0;
  health.forEach(([kind, name, ok]) => {
    const pass = ok(); if(!pass && kind === 'code') bad++;
    console.log('    ' + (pass ? '✓' : '✗') + ' [' + kind + '] ' + name);
  });
  console.log('    (note: "progress keeps moving" holds by ' + (knownEnd - known45).toFixed(1)
    + ' facts — a flat line passes this band, which is worth knowing.)');

  /* ---- SENSITIVITY (iii): where "she already knows this" is seeded.
     Not a dose knob at all — a bookkeeping one — and it moves the day-45
     number more than any amount of practice does. ---- */
  console.log('\n  SEEDING SENSITIVITY — what box the ×1 ×2 ×5 ×10 facts start in:');
  for(const sb of [4, 5]){
    for(const [label, chooser] of CHOOSERS){
      const rs = await run(Object.assign({}, NOMINAL, {model: 'spaced', chooser, seedBox: sb}),
        GRID_ABIL);
      console.log('    box ' + sb + ', ' + label.replace(/ \(.*/, '').padEnd(38)
        + ' known ' + avg(rs, r => r.at45.known).toFixed(1) + '@45  '
        + avgKnown(rs).toFixed(1) + '@142   unaided recall '
        + avg(rs, r => r.end.recall).toFixed(1) + '@142');
    }
  }
  console.log('    (the app\'s placement check seeds box 4. The nominal runs above are half 4,'
    + ' half 5.)');

  /* ---- SENSITIVITY (i) and (ii): reps on the target × old facts interleaved ---- */
  const REPS = [4, 6, 8, 12, 16, 20];
  const INTER = [0, 4, 8, 12, 24];
  console.log('\n  SENSITIVITY — honest model, ' + GRID_ABIL.length
            + ' learners spanning the ability range.');
  console.log('  Each cell: known@45 → known@142 (avg /78) and answers a session.');
  const grids = {};
  for(const [label, chooser] of CHOOSERS){
    console.log('\n  ' + label + ':');
    console.log('   reps↓  old→ ' + INTER.map(i => String(i).padStart(15)).join(''));
    const cells = [];
    for(const reps of REPS){
      const row = [];
      for(const inter of INTER){
        const rs = await run(Object.assign({}, NOMINAL,
          {model: 'spaced', chooser, targetReps: reps, interleave: inter}), GRID_ABIL);
        row.push({reps, inter,
          k45: avg(rs, r => r.at45.known), kEnd: avgKnown(rs),
          durEnd: avg(rs, r => r.end.durable), recEnd: avg(rs, r => r.end.recall),
          rec45: avg(rs, r => r.at45.recall),
          perSess: avg(rs, r => r.answersPerSession), firstGo: avg(rs, r => r.firstGo),
          worstEnd: Math.min(...rs.map(r => r.end.known))});
      }
      cells.push(...row);
      console.log('   ' + String(reps).padStart(4) + '       '
        + row.map(c => (c.k45.toFixed(0) + '→' + c.kEnd.toFixed(0)
          + ' (' + c.perSess.toFixed(0) + '/s)').padStart(15)).join(''));
    }
    grids[chooser] = cells;

    // what each knob is worth, in isolation
    const byR = (f, sel) => REPS.map(r => r + ': ' + avg(cells.filter(c => c.reps === r), sel).toFixed(1)).join('   ');
    const byI = (f, sel) => INTER.map(i => i + ': ' + avg(cells.filter(c => c.inter === i), sel).toFixed(1)).join('   ');
    console.log('   target reps → known@45   ' + byR(0, c => c.k45));
    console.log('   target reps → known@142  ' + byR(0, c => c.kEnd));
    console.log('   old facts   → known@45   ' + byI(0, c => c.k45));
    console.log('   old facts   → known@142  ' + byI(0, c => c.kEnd));
    console.log('   old facts   → recall@45  ' + byI(0, c => c.rec45)
      + '     (unaided, and where interleaving actually shows up)');
    console.log('   old facts   → recall@142 ' + byI(0, c => c.recEnd));

    // A sitting must also be a sitting: the HEALTH band is 6–26 answers, so a
    // dose that produces 4 answers a session does not count as hitting anything.
    const playable = cells.filter(c => c.perSess >= 6 && c.perSess <= 26);
    const cheapest = (sel, label) => {
      const ok = playable.filter(sel).sort((x, y) => x.perSess - y.perSess);
      console.log('   MINIMUM PLAYABLE DOSE ' + label + ':');
      if(!ok.length){
        console.log('     none of the ' + cells.length + ' doses tried.');
        return;
      }
      const c = ok[0];
      console.log('     ' + c.reps + ' reps of the target + ' + c.inter + ' old facts a day → '
        + c.perSess.toFixed(1) + ' answers a session, first-go ' + pct(c.firstGo));
      console.log('     known ' + c.k45.toFixed(1) + '@45, ' + c.kEnd.toFixed(1) + '@142; durable '
        + c.durEnd.toFixed(1) + '@142; unaided recall ' + c.rec45.toFixed(1) + '@45, '
        + c.recEnd.toFixed(1) + '@142; slowest learner ' + c.worstEnd + '/78');
      console.log('     (' + ok.length + ' of ' + playable.length + ' playable doses qualify)');
    };
    // David's targets, exactly as stated — the app's own box measure.
    cheapest(c => c.k45 >= 60 && c.kEnd >= 74, 'hitting ≥60@45 AND ≥74@142 (the stated targets)');
    // The same question asked of what she can actually produce. NOT a relaxation
    // of anything: an extra, harder bar, because the box measure is cheap to hit.
    cheapest(c => c.recEnd >= 60, 'reaching unaided recall ≥60/78 by day 142');
  }

  if(errors.length) console.log('\n  page errors: ' + errors.join(' | '));

  /* ---- the verdict, stated plainly ---- */
  console.log('\n  VERDICT at the nominal dose, on the honest learner model'
    + ' (known@45, known@142, slowest@142, and unaided recall@142):');
  CHOOSERS.forEach(([label, chooser]) => {
    const rs = primary[chooser].spaced, p = planOf(rs);
    console.log('    ' + label.replace(/ \(.*/, '').padEnd(40) + p.map(x => x[2]).join('  ')
      + '   recall ' + avg(rs, r => r.end.recall).toFixed(1) + '/78'
      + '   → ' + p.filter(x => x[1]).length + '/3 targets');
  });
  console.log('    ' + 'sim.js, the ladder shipped today'.padEnd(40)
    + '35.0/78  38.5/78  22/78   recall n/a   → 0/3 targets');
  console.log('\n  Read tables/tests/SIM-DAILY.md before changing anything. Do NOT close any of');
  console.log('  this by lowering the targets, and do not trust the box model on its own.\n');

  await browser.close();
  if(bad){
    console.log('  ' + bad + ' CODE health band(s) breached — that is a defect in the app. Fix it.\n');
    process.exit(1);
  }
})();
