/* Tests for the app's calculators, run against the real built app (dist/index.html) in headless Chrome.
   Each test checks a calculator against the rule the app itself states on screen, so a failure means
   the numbers and the stated rule disagree. Clinical rules are David's to change, not the tests'.

   Usage: python3 tools/build.py && node --test tests/   (Node 22+ and Chrome; no npm packages) */
'use strict';
const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const {openApp} = require('../tools/lib/chrome');

let app;
before(async () => {
  app = await openApp();
});
after(() => app && app.close());

/* ---------- helpers that run inside the page ---------- */

// One paeds dose row as {dose, volume, label, capped}, found by its drug name
function paedDose(name, w, ageM) {
  const row = PAED_SECS.flatMap(s => s.rows).find(r => r.n === name);
  if (!row) throw new Error('no paeds row called ' + name);
  const html = paedRow(row, w, ageM);
  const cell = n => {
    const t = document.createElement('table');
    t.innerHTML = html;
    return t.querySelectorAll('th,td')[n];
  };
  const small = cell(0).querySelector('small');
  return {
    dose: (cell(1).querySelector('b') || {}).textContent || '',
    volume: cell(2).childNodes[0] ? cell(2).childNodes[0].textContent : '',
    label: small ? small.textContent : '',
    capped: !!cell(1).querySelector('.pcap')
  };
}
const equip = (w, ageM) => Object.fromEntries(paedEquip(w, ageM).map(([k, v]) => [k, v]));

/* ---------- weight from age (RCUK table) ---------- */

test('weight from age: matches the RCUK table at each listed age, rises steadily between them', async () => {
  const r = await app.evaluate(() => ({
    table: PAED_RCUK_WT,
    atKnots: PAED_RCUK_WT.map(([m]) => paedWeightFromAge(m)),
    curve: Array.from({length: 217}, (_, m) => paedWeightFromAge(m)),
    newborn: paedWeightFromAge(0),
    adult: paedWeightFromAge(300)
  }));
  assert.deepEqual(r.atKnots, r.table.map(([, w]) => w));
  for (let m = 1; m < r.curve.length; m++) assert.ok(r.curve[m] >= r.curve[m - 1], `weight falls at ${m} months`);
  assert.equal(r.newborn, r.table[0][1]);
  assert.equal(r.adult, 70);
});

/* ---------- paediatric drug doses ---------- */

test('paracetamol IV: 10 mg/kg up to 10 kg, 15 mg/kg up to 50 kg, then 1 g', async () => {
  const name = await app.evaluate(() => PAED_SECS.flatMap(s => s.rows).find(r => r.par).n);
  const at = w => app.evaluate(paedDose, name, w, 60);
  const cases = [
    [8, '80 mg', '10 mg/kg'],
    [10, '100 mg', '10 mg/kg'],
    [20, '300 mg', '15 mg/kg'],
    [50, '750 mg', '15 mg/kg'],
    [55, '1 g', '1 g']
  ];
  for (const [w, dose, rule] of cases) {
    const r = await at(w);
    assert.equal(r.dose, dose, `${w} kg`);
    assert.ok(r.label.startsWith(rule), `${w} kg label "${r.label}"`);
  }
});

test('every dose with a maximum is capped at it, and marked "max" only when capped', async () => {
  const rows = await app.evaluate(() =>
    PAED_SECS.flatMap(s => s.rows).filter(r => r.max && !r.fn && !r.par).map(r => ({n: r.n, d: r.d, max: r.max, u: r.u}))
  );
  assert.ok(rows.length > 10, 'expected many capped rows');
  const toUnit = (text, u) => {
    // "1.5 mg" -> amount in the row's unit
    const [v, unit] = text.split('–').pop().split(' ');
    const scale = {µg: {'µg': 1, mg: 1000}, mg: {mg: 1, g: 1000, 'µg': 0.001}}[u.replace('/min', '')] || {};
    return Number(v) * (scale[unit] ?? 1);
  };
  for (const row of rows) {
    const heavy = await app.evaluate(paedDose, row.n, 90, null);
    assert.ok(toUnit(heavy.dose, row.u) <= row.max * 1.0001, `${row.n}: ${heavy.dose} is over the max ${row.max} ${row.u}`);
    const lightKg = row.max / Math.max(...row.d) / 2; // well under the cap
    const light = await app.evaluate(paedDose, row.n, lightKg, null);
    assert.equal(light.capped, false, `${row.n}: marked max at ${lightKg.toFixed(1)} kg`);
    if (Math.max(...row.d) * 90 > row.max) assert.equal(heavy.capped, true, `${row.n}: not marked max at 90 kg`);
  }
});

test('neonatal doses apply under 1 month only', async () => {
  const rows = await app.evaluate(() => PAED_SECS.flatMap(s => s.rows).filter(r => r.neo).map(r => ({n: r.n, neo: r.neo})));
  for (const row of rows) {
    const newborn = await app.evaluate(paedDose, row.n, 3.5, 0);
    const older = await app.evaluate(paedDose, row.n, 3.5, 2);
    assert.ok(newborn.label.startsWith(String(row.neo)), `${row.n} newborn label "${newborn.label}"`);
    assert.ok(!older.label.startsWith(String(row.neo) + ' '), `${row.n} at 2 months still uses the neonatal dose`);
  }
});

test('age-dependent rules: adenosine and salbutamol switch at the stated ages', async () => {
  const d = (name, w, m) => app.evaluate(paedDose, name, w, m);
  assert.match((await d('Adenosine, first dose', 6, 6)).label, /^150 µg\/kg under 1 year/);
  assert.match((await d('Adenosine, first dose', 12, 24)).label, /^100 µg\/kg, 1–11 years/);
  assert.equal((await d('Adenosine, first dose', 45, 150)).dose, '3 mg');
  assert.equal((await d('Salbutamol nebulised', 14, 30)).dose, '2.5 mg');
  assert.equal((await d('Salbutamol nebulised', 20, 72)).dose, '5 mg');
  assert.match((await d('Salbutamol IV bolus', 9, 12)).label, /^5 µg\/kg, under 2 years/);
  assert.match((await d('Salbutamol IV bolus', 14, 36)).label, /^15 µg\/kg, 2 years and over/);
});

test('no paeds dose ever shows NaN, undefined or Infinity', async () => {
  const bad = await app.evaluate(() => {
    const out = [];
    for (const w of [0.8, 2.5, 3.5, 5, 8, 12, 16, 20, 30, 45, 60, 80, 120])
      for (const m of [null, 0, 1, 6, 11, 12, 24, 60, 143, 144, 216]) {
        const html = PAED_SECS.flatMap(s => s.rows).map(r => paedRow(r, w, m)).join('') +
          JSON.stringify(paedEquip(w, m)) + paedAnaph(m);
        if (/NaN|undefined|Infinity/.test(html)) out.push(`${w} kg, ${m} months`);
      }
    return out;
  });
  assert.deepEqual(bad, []);
});

/* ---------- airway, fluids and blood ---------- */

test('tracheal tube: cuffed age/4 + 3.5, uncuffed age/4 + 4, rounded down to a half size', async () => {
  for (const [years, cuffed, uncuffed, oral, nasal] of [
    [1, '3.5', '4.0', 13, 16],
    [2, '4.0', '4.5', 13, 16],
    [4, '4.5', '5.0', 14, 17],
    [8, '5.5', '6.0', 16, 19],
    [12, '6.5', '7.0', 18, 21]
  ]) {
    const e = await app.evaluate(equip, 20, years * 12);
    assert.equal(e['Tracheal tube (ID)'], `Cuffed ${cuffed} mm · uncuffed ${uncuffed} mm`, `${years} years`);
    assert.equal(e['Tube length'], `Oral ${oral} cm · nasal ${nasal} cm`, `${years} years`);
  }
});

test('laryngeal masks follow the stated weight bands', async () => {
  for (const [w, lma, igel] of [
    [4, '1', '1'],
    [7, '1.5', '1.5'],
    [15, '2', '2'],
    [25, '2.5', '2.5'],
    [40, '3', '3'],
    [70, '4', '4'],
    [95, '5', '4']
  ]) {
    const e = await app.evaluate(equip, w, null);
    assert.equal(e['Laryngeal mask'], `LMA ${lma} · i-gel ${igel}`, `${w} kg`);
  }
});

test('maintenance fluid: 4-2-1 rule (capped at 100 mL/h); tidal volume 7–8 mL/kg', async () => {
  for (const [w, rate] of [
    [5, 20],
    [10, 40],
    [15, 50],
    [20, 60],
    [30, 70],
    [60, 100],
    [80, 100]
  ]) {
    const e = await app.evaluate(equip, w, null);
    assert.equal(e['Maintenance fluid'], `${rate} mL/h`, `${w} kg`);
  }
  assert.equal((await app.evaluate(equip, 20, null))['Tidal volume'], '140–160 mL');
  const label = await app.evaluate(() => paedEquip(70, null).find(([k]) => k === 'Maintenance fluid')[2]);
  assert.match(label, /maximum of 100 mL\/h/, 'the on-screen rule should state the cap');
});

test('circulating blood volume: 90 mL/kg neonate, 80 toddler, 70 school age', async () => {
  assert.equal((await app.evaluate(equip, 3.5, 0))['Circulating blood volume'], 'About 315 mL');
  assert.equal((await app.evaluate(equip, 12, 18))['Circulating blood volume'], 'About 960 mL');
  assert.equal((await app.evaluate(equip, 20, 72))['Circulating blood volume'], 'About 1400 mL');
});

test('anaphylaxis table highlights the row for the child\'s age', async () => {
  const hit = m =>
    app.evaluate(age => {
      const t = document.createElement('div');
      t.innerHTML = paedAnaph(age);
      const row = t.querySelector('tr.phit th');
      return row ? row.textContent : null;
    }, m);
  assert.equal(await hit(3), 'Under 6 months');
  assert.equal(await hit(24), '6 months to 6 years');
  assert.equal(await hit(96), '6 to 12 years');
  assert.equal(await hit(168), 'Over 12 years');
  assert.equal(await hit(null), null);
});

/* ---------- professional expenses ---------- */

test('expenses: every fee has one amount per grade, FY1 to Consultant', async () => {
  const r = await app.evaluate(() => ({grades: EXP_GRADES.length, items: EXP_ITEMS.map(i => ({k: i.k, amt: i.amt}))}));
  for (const item of r.items) {
    assert.equal(item.amt.length, r.grades, `${item.k} amounts`);
    item.amt.forEach(a => assert.ok(typeof a === 'number' && a >= 0, `${item.k}: ${a}`));
  }
  const gmc = r.items.find(i => i.k === 'gmc').amt;
  assert.deepEqual([...new Set(gmc.slice(0, 4))], [184], 'GMC discounted fee for the first four grades');
  assert.deepEqual([...new Set(gmc.slice(4))], [481], 'GMC full fee after');
});

test('expenses: your own amount replaces the estimate; totals add up', async () => {
  const r = await app.evaluate(() => {
    const keep = JSON.stringify(EXP);
    const out = {};
    Object.assign(EXP, {grade: 5, own: {}, custom: [], exams: {}, on: {gmc: true, bma: true, rcoa: false, ficm: false, aoa: false, mdo: false}});
    const gmc = EXP_ITEMS.find(i => i.k === 'gmc'),
      bma = EXP_ITEMS.find(i => i.k === 'bma');
    out.estimate = expAmt(gmc, 5);
    out.total = expTotal('found');
    out.expected = Math.round((gmc.amt[5] + bma.amt[5]) * 100) / 100;
    EXP.own.gmc = '400';
    out.own = expAmt(gmc, 5);
    EXP.custom = [{n: 'Course', amt: '50', on: true}, {n: 'Off', amt: '99', on: false}];
    out.withCustom = expTotal('found');
    Object.assign(EXP, JSON.parse(keep));
    return out;
  });
  assert.equal(r.estimate, 481);
  assert.equal(r.total, r.expected);
  assert.equal(r.own, 400);
  assert.equal(r.withCustom, Math.round((400 + r.expected - 481 + 50) * 100) / 100);
});

test('exam fees: in England the first two attempts are not self-paid; elsewhere every attempt is', async () => {
  const r = await app.evaluate(() => {
    const keep = JSON.stringify(EXP);
    const fee = EXAMS.core.find(e => e.k === 'pmcq').f;
    const run = (england, n) => {
      EXP.england = england;
      EXP.exams = {pmcq: String(n)};
      return examSelfPaid('core');
    };
    const out = {fee, eng1: run(true, 1), eng2: run(true, 2), eng3: run(true, 3), other3: run(false, 3)};
    Object.assign(EXP, JSON.parse(keep));
    return out;
  });
  assert.equal(r.eng1, 0);
  assert.equal(r.eng2, 0);
  assert.equal(r.eng3, r.fee);
  assert.equal(r.other3, 3 * r.fee);
});

/* ---------- starting-point quiz ---------- */

test('starting-point quiz: every possible set of answers lands on a real stop', async () => {
  const results = await app.evaluate(() => {
    const out = [];
    const ids = new Set(ALL.map(s => s.id));
    const walk = answers => {
      const k = nextQ(answers);
      if (!k) {
        const p = placement(answers);
        out.push({
          answers,
          start: p.start && p.start.id,
          stage: p.stage,
          startIsReal: !!p.start && ids.has(p.start.id),
          doneAreReal: p.done.every(id => ids.has(id)),
          startNotDone: !p.done.includes(p.start.id)
        });
        return;
      }
      for (const option of PQ[k].o) walk({...answers, [k]: option});
    };
    walk({});
    return out;
  });
  assert.ok(results.length >= 8, `only ${results.length} paths`);
  for (const r of results) {
    const who = JSON.stringify(r.answers);
    assert.ok(r.startIsReal, `${who} starts at a stop that does not exist`);
    assert.ok(r.doneAreReal, `${who} marks a non-existent stop as done`);
    assert.ok(r.startNotDone, `${who} marks its own starting stop as done`);
  }
  // the furthest path (a trainee who has done everything) starts at the consultant stage
  const furthest = results.find(r => Object.values(r.answers).filter(v => v === 'Yes').length === 4);
  assert.equal(furthest && furthest.stage, 'cons');
});

test('no errors while the tests ran', () => {
  assert.deepEqual(app.errors.filter(e => !/Failed to load resource/.test(e)), []);
});
