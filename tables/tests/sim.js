/* 144 — does the plan actually work?
 *
 * The suite proves the app behaves. It cannot tell us whether the PLAN is right:
 * 144 facts, a 45-day acquisition sprint, ~2 short sessions a day. That is a
 * question about pacing over months, and the only way to ask it is to play the
 * thing for months.
 *
 * So this drives the REAL engine — the real weak-first picker, the real Leitner
 * boxes, the real level ladder — against modelled learners, and reports what
 * comes out. The level accounting (each new fact right twice / 12 right / 15
 * right) is re-stated here rather than reached through the animated UI; that is
 * the only copied part and it is five lines.
 *
 * The learner model is a MODEL, not the truth. It is deliberately conservative:
 * a fact starts hard, gets easier with each successful retrieval, and the
 * multiple-choice format gives a floor from guessing. Treat the numbers as
 * "does the shape of the plan hold", not as a prediction about one real child.
 *
 *   node tables/tests/sim.js
 *
 * Exits non-zero if a band breaches, so the routine can trust it.
 */
const path = require('path');
const {chromium} = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const {findChromium} = require('../playwright.config.js');

const APP = 'file://' + path.join(__dirname, '..', 'index.html');
const DAYS_SPRINT = 45;          // David's acquisition sprint
const DAYS_TOTAL  = 142;         // to the end of the year
const SESSIONS    = 2;           // his target: two short sittings a day
const LEARNERS    = 8;

// ---- the learner model, in the page (page.evaluate ships the source) ----
function runLearner({ability, days, sessions, seed}){
  const a144 = window.__144;
  // a small deterministic PRNG so a run is repeatable
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  const facts = () => a144.state.facts;
  const isEasy = (x, y) => x <= 2 || y <= 2 || x === 5 || y === 5 || x === 10 || y === 10
                        || x === 11 || y === 11 || x === y;
  const isHard = (x, y) => (x >= 6 && x <= 8 && y >= 6 && y <= 8) || x === 12 || y === 12;

  // Probability she gets this fact right, given how often she has retrieved it.
  function pRight(k, nOptions){
    const p = k.split('x').map(Number), f = facts()[k];
    const box = f ? f.box : 0;
    let base = isEasy(p[0], p[1]) ? 0.60 : isHard(p[0], p[1]) ? 0.16 : 0.34;
    let known = Math.min(1, box / 6);
    let raw = (base + known * 0.78) * ability;
    const guess = 1 / nOptions;                       // multiple choice has a floor
    return Math.max(0.05, Math.min(0.985, guess + (1 - guess) * Math.max(0, Math.min(1, raw))));
  }

  let asked = 0, firstGoRight = 0, answers = 0, sessionsPlayed = 0, at45 = null;
  const perDay = [];

  // the first-open check: one look at each, seeding what she already owns
  (function placement(){
    const lv = a144.placementLevel();
    lv.facts.forEach(k => {
      const right = rnd() < pRight(k, 3);
      a144.record(k, right, true);
      answers++; asked++; if(right) firstGoRight++;
    });
    a144.state.prog.placed = true;
  })();

  for(let day = 1; day <= days; day++){
    const iso = new Date(2026, 7, 11 + day).toISOString().slice(0, 10);
    a144.setToday(iso);
    let dayAnswers = 0, dayAsked = 0, dayRight = 0;

    for(let sess = 0; sess < sessions; sess++){
      const idx = Math.min(a144.state.prog.cleared, a144.LEVELS.length - 1);
      const lv = a144.LEVELS[idx];
      const goal = a144.goalOf(lv);
      const per = Object.create(null);
      let done = 0, guard = 0, round = 1, sessionAnswers = 0;

      while(done < goal && guard++ < 400){
        // the real picker, over the same pool the app would use
        const pool = lv.kind === 'learn' ? lv.facts.filter(k => (per[k] || 0) < 2) : lv.facts;
        const k = a144.pickFact(pool.length ? pool : lv.facts);
        const nOptions = round < 2 ? 3 : 4;
        const first = !(per[k + ':seen']);
        per[k + ':seen'] = 1;

        let right = rnd() < pRight(k, nOptions);
        answers++; sessionAnswers++; dayAnswers++;
        if(first){ asked++; dayAsked++; if(right){ firstGoRight++; dayRight++; } }
        a144.record(k, right, false);

        if(right){ per[k] = (per[k] || 0) + 1; done++; }
        // a miss keeps the question up: she gets it eventually, which is the app's
        // real behaviour, so keep answering this one until it lands
        else {
          let tries = 0;
          while(!right && tries++ < 6){
            right = rnd() < pRight(k, nOptions);
            answers++; sessionAnswers++; dayAnswers++;
            a144.record(k, right, false);
          }
          if(right){ per[k] = (per[k] || 0) + 1; done++; }
        }
        if(sessionAnswers % 4 === 0) round++;
      }
      a144.state.prog.cleared++;
      sessionsPlayed++;
    }
    perDay.push({day, answers: dayAnswers, firstGo: dayAsked ? dayRight / dayAsked : 1});

    if(day === 45) at45 = snapshot();
  }

  function snapshot(){
    const f = facts(), keys = Object.keys(f);
    let known = 0, met = 0, firm = 0, box = 0;
    keys.forEach(k => { if(f[k].seen) met++; box += f[k].box;
      if(f[k].box >= 3) firm++;
      if(f[k].box >= a144.KNOWN_BOX) known++; });
    return {met, known, firm, avgBox: keys.length ? box/keys.length : 0,
            cleared: a144.state.prog.cleared};
  }

  const end = snapshot();
  return {
    ability,
    firstGo: asked ? firstGoRight / asked : 0,
    answers, sessionsPlayed,
    answersPerSession: answers / sessionsPlayed,
    at45: at45 || end,
    end,
    worstDay: perDay.reduce((m, d) => Math.min(m, d.firstGo), 1),
    levels: a144.state.prog.cleared,
    totalLevels: a144.LEVELS.length
  };
}

(async () => {
  const exe = findChromium();
  const browser = await chromium.launch(exe ? {executablePath: exe} : {});
  const page = await (await browser.newContext()).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(APP);
  await page.waitForFunction(() => !!window.__144);

  const abilities = [0.72, 0.80, 0.86, 0.92, 0.98, 1.04, 1.12, 1.20];
  const runs = [];
  for(let i = 0; i < LEARNERS; i++){
    await page.evaluate(() => window.__144.reset());
    runs.push(await page.evaluate(runLearner,
      {ability: abilities[i % abilities.length], days: DAYS_TOTAL, sessions: SESSIONS, seed: 7919 * (i + 1)}));
  }
  await browser.close();

  const FACTS = 78;                       // 144 cells, 78 different facts
  const avg = f => runs.reduce((s, r) => s + f(r), 0) / runs.length;
  const pct = x => (x * 100).toFixed(1) + '%';

  console.log('\n144 — ' + LEARNERS + ' modelled learners, ' + SESSIONS + ' sessions a day, '
              + DAYS_TOTAL + ' days (sprint = ' + DAYS_SPRINT + ')\n');
  console.log('  ability   first-go   known@45   known@end   levels   ans/session');
  runs.forEach(r => {
    console.log('   ' + r.ability.toFixed(2)
      + '      ' + pct(r.firstGo).padStart(6)
      + '     ' + String(r.at45.known + '/' + FACTS).padStart(7)
      + '     ' + String(r.end.known + '/' + FACTS).padStart(7)
      + '   ' + String(r.levels + '/' + r.totalLevels).padStart(7)
      + '     ' + r.answersPerSession.toFixed(1).padStart(5));
  });

  const firstGo   = avg(r => r.firstGo);
  const known45   = avg(r => r.at45.known);
  const knownEnd  = avg(r => r.end.known);
  const perSess   = avg(r => r.answersPerSession);
  const worstAt45 = Math.min(...runs.map(r => r.at45.known));
  const worstEnd  = Math.min(...runs.map(r => r.end.known));

  console.log('\n  first-go ' + pct(firstGo) + ' | known by day 45: ' + known45.toFixed(1) + '/' + FACTS
            + ' (worst learner ' + worstAt45 + ') | by day ' + DAYS_TOTAL + ': ' + knownEnd.toFixed(1)
            + '/' + FACTS + ' (worst ' + worstEnd + ') | ' + perSess.toFixed(1) + ' answers a session\n');

  const firm = avg(r => r.end.firm), avgBox = avg(r => r.end.avgBox);
  console.log('  where it sits at the end: ' + firm.toFixed(1) + '/' + FACTS
            + ' facts at box 3+, average box ' + avgBox.toFixed(1) + ' of 7\n');

  /* ---- HEALTH bands: things the CODE must not break. Enforced. ---- */
  const health = [
    ['nobody is stuck: every learner keeps clearing levels', () => runs.every(r => r.levels > 20)],
    ['the path never runs out (levels available > played)',   () => runs.every(r => r.totalLevels > r.levels)],
    ['a session stays short (6–26 answers)',                  () => perSess >= 6 && perSess <= 26],
    ['first-go sits in a workable band (70–95%)',             () => firstGo >= 0.70 && firstGo <= 0.95],
    ['progress keeps moving after the sprint',                () => knownEnd >= known45],
    ['no page errors while simulating',                       () => errors.length === 0],
  ];
  let bad = 0;
  health.forEach(([name, ok]) => {
    const pass = ok(); if(!pass) bad++;
    console.log('    ' + (pass ? '✓' : '✗') + ' ' + name);
  });

  /* ---- PLAN targets: David's claims. REPORTED, never silently relaxed.
     These are his to change, not this script's, so a miss does not fail the run —
     it prints loudly and belongs in ROUTINE §9 and the open-with-David list. ---- */
  const plan = [
    ['sprint: ≥60/78 known by day 45',        known45 >= 60, known45.toFixed(1) + '/78'],
    ['year:   ≥74/78 known by day ' + DAYS_TOTAL, knownEnd >= 74, knownEnd.toFixed(1) + '/78'],
    ['slowest learner ≥70/78 by day ' + DAYS_TOTAL, worstEnd >= 70, worstEnd + '/78'],
  ];
  const missed = plan.filter(p => !p[1]);
  console.log('\n  the plan\'s own targets:');
  plan.forEach(([name, ok, got]) =>
    console.log('    ' + (ok ? '✓' : '✗') + ' ' + name + '  — got ' + got));

  if(errors.length) console.log('\n  page errors: ' + errors.join(' | '));
  if(missed.length){
    console.log('\n  ⚠  PLAN NOT MET on this model (' + missed.length + ' of ' + plan.length
      + ' targets). The code is healthy; the PLAN is the thing to look at.');
    console.log('     Most likely cause: 144 only ever TESTS a fact, it never teaches one — a fact');
    console.log('     she has never met is a guess between bubbles, and "known well" needs five');
    console.log('     clean retrievals. Changing that changes what she is taught, so it is David\'s');
    console.log('     call, not this script\'s. Do not fix it by lowering these numbers.');
  }
  console.log('');
  if(bad){
    console.log('  ' + bad + ' HEALTH band(s) breached — that is a code defect. Fix it.\n');
    process.exit(1);
  }
  console.log('  health bands all hold.\n');
})();
