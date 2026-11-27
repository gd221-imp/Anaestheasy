// Checks the obese patient dose calculator on the Drugs pages: the weight formulas and a few doses.
// Run: node tools/obese_dosing_test.js (after python3 tools/build.py)
const {openApp} = require('./lib/chrome');
(async () => {
  const app = await openApp();
  const r = await app.evaluate(() => {
    const out = [];
    const near = (a, b, tol, what) => { if (Math.abs(a - b) > tol) out.push(`${what}: got ${a}, expected ${b}`); };
    // Adult man 180 cm, 150 kg: IBW 80, BMI 46.3, LBW (Janmahasatian) about 81.4, AdjBW 80 + 0.4 × 70 = 108
    let a = obWeights('adult', {sex: 'm', h: 180, w: 150});
    near(a.W.IBW, 80, 0.01, 'adult IBW');
    near(a.W.AdjBW, 108, 0.01, 'adult AdjBW');
    near(a.W.LBW, 9270 * 150 / (6680 + 216 * (150 / 3.24)), 0.01, 'adult LBW');
    // Adult woman 165 cm, 55 kg: under IBW (60), so every weight is 55
    a = obWeights('adult', {sex: 'f', h: 165, w: 55});
    ['IBW', 'AdjBW', 'LBW'].forEach(k => { if (a.W[k] > 55) out.push('adult under IBW: ' + k + ' exceeds actual weight'); });
    // Girl aged 10, 140 cm, 60 kg: BMI50 16.9, IBW 16.9 × 1.96 = 33.1, AdjBW 33.1 + 0.35 × 26.9 = 42.5
    const p = obWeights('paeds', {sex: 'f', h: 140, w: 60, age: 10});
    near(p.W.IBW, 33.124, 0.01, 'paeds IBW');
    near(p.W.AdjBW, 33.124 + 0.35 * (60 - 33.124), 0.01, 'paeds AdjBW');
    near(obBMI50(10.25, 'm'), 16.5, 0.001, 'BMI50 interpolation');
    // Paracetamol 15 mg/kg AdjBW, max 1 g
    const par = OBESE_DOSING.paeds.drugs.find(d => d.n === 'Paracetamol');
    if (obDose(par, p.W.AdjBW).txt !== '638 mg') out.push('paeds paracetamol: ' + obDose(par, p.W.AdjBW).txt);
    if (obDose(par, 80).txt !== '1 g' || !obDose(par, 80).capped) out.push('paeds paracetamol cap: ' + obDose(par, 80).txt);
    const apar = OBESE_DOSING.adult.drugs.find(d => d.par);
    if (obDose(apar, 60).txt !== '1 g' || obDose(apar, 40).txt !== '600 mg') out.push('adult paracetamol rule');
    // Every drug's weight type is one the calculator works out
    for (const k of ['adult', 'paeds']) for (const d of OBESE_DOSING[k].drugs)
      if (!(d.w in obWeights(k, {sex: 'm', h: 170, w: 100, age: 12}).W)) out.push(`${k} ${d.n}: unknown weight ${d.w}`);
    // The boxes render on both tabs
    openDrugs();
    const box = document.querySelector('#ob-adult');
    if (!box) out.push('no box on the Adult drugs tab');
    else {
      box.open = true;
      box.querySelector('[data-ob="sex"]').value = 'm';
      box.querySelector('[data-ob="h"]').value = '180';
      box.querySelector('[data-ob="w"]').value = '150';
      box.dispatchEvent(new Event('input'));
      if (!/108 kg/.test(box.textContent)) out.push('adult box does not show AdjBW 108 kg');
    }
    openPaedDrugs();
    if (!document.querySelector('#ob-paeds')) out.push('no box on the Paeds drugs tab');
    return out;
  });
  app.close();
  const all = [...app.errors, ...r];
  all.forEach(x => console.log('ERROR   ' + x));
  console.log(`\nObese dosing test: ${all.length} problem(s)`);
  process.exit(all.length ? 1 : 0);
})().catch(e => { console.log('ERROR   ' + e.message); process.exit(1); });
