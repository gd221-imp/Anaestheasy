// ---- Obese patient dose calculator: a box on the Adult drugs and Paeds drugs tabs ----
// OBESE_DOSING.json holds, for adults and children, the adjustment factor, the drugs (n name, w weight type,
// d dose per kg [lo, hi], u unit, max single dose in that unit, par paracetamol rule, g note) and the sources.
/*@@OBESE_DOSING@@*/
const OB_NAMES = {
  TBW: "Total body weight",
  IBW: "Ideal body weight",
  LBW: "Lean body weight",
  AdjBW: "Adjusted body weight"
};
function obBMI50(age, sex) {
  const T = OBESE_DOSING.paeds.bmi50[sex];
  if (age <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++)
    if (age <= T[i][0]) {
      const [a, ba] = T[i - 1],
        [b, bb] = T[i];
      return ba + ((bb - ba) * (age - a)) / (b - a);
    }
  return T[T.length - 1][1];
}
// The dosing weights for one patient. kind: "adult" or "paeds"; p: {sex: "m"|"f", h: cm, w: kg, age: years}
function obWeights(kind, p) {
  const m = p.h / 100,
    bmi = p.w / (m * m);
  let ibw, lbw;
  if (kind === "adult") {
    ibw = p.h - (p.sex === "m" ? 100 : 105);
    lbw = p.sex === "m" ? (9270 * p.w) / (6680 + 216 * bmi) : (9270 * p.w) / (8780 + 244 * bmi);
  } else ibw = obBMI50(p.age, p.sex) * m * m;
  const adj = OBESE_DOSING[kind].adj,
    over = p.w > ibw;
  const W = {TBW: p.w, IBW: Math.min(ibw, p.w), AdjBW: over ? ibw + adj * (p.w - ibw) : p.w};
  if (lbw != null) W.LBW = Math.min(lbw, p.w);
  return {W, bmi, ibw, over};
}
function obDose(r, wt) {
  if (r.par) {
    if (wt >= 50) return {txt: "1 g", capped: false};
    return {txt: paedFmt(15 * wt) + " mg", capped: false};
  }
  const vals = r.d.map(x => Math.min(x * wt, r.max || Infinity)),
    capped = r.max && r.d.some(x => x * wt > r.max);
  const parts = vals.map(v => (r.u.endsWith("/h") ? [v, r.u] : paedUnit(v, r.u))).map(([v, u]) => [paedFmt(v), u]);
  const txt =
    parts.length > 1 && parts[0][1] === parts[1][1]
      ? `${parts[0][0]}–${parts[1][0]} ${parts[1][1]}`
      : parts.map(x => x.join(" ")).join("–");
  return {txt, capped};
}
function obPerKg(r) {
  if (r.par) return "";
  const u = r.u.endsWith("/h") ? r.u.replace("/h", "/kg/h") : r.u + "/kg";
  return r.d.join("–") + " " + u;
}
function obBox(kind) {
  const P = kind === "paeds";
  return `<details class="obcalc" id="ob-${kind}"><summary><b>Obese patient?</b> Work out doses on the right weight</summary>
  <div class="pform">
   ${P ? `<label>Age (years)<span><input data-ob="age" type="number" min="2" max="16" step="any" inputmode="decimal" placeholder="2–16"></span></label>` : ""}
   <label>Sex<span><select data-ob="sex"><option value="f">Female</option><option value="m">Male</option></select></span></label>
   <label>Height (cm)<span><input data-ob="h" type="number" min="${P ? 70 : 120}" max="230" step="any" inputmode="decimal" placeholder="cm"></span></label>
   <label>Weight (kg)<span><input data-ob="w" type="number" min="8" max="350" step="any" inputmode="decimal" placeholder="kg"></span></label>
   <label>Drug<span><select data-ob="drug"><option value="">All drugs</option>${OBESE_DOSING[kind].drugs.map((r, i) => `<option value="${i}">${r.n}</option>`).join("")}</select></span></label>
  </div>
  <div class="obout"></div>
  <p class="note">${OBESE_DOSING[kind].src}</p></details>`;
}
function obWire(root, kind) {
  const box = root.querySelector("#ob-" + kind);
  if (!box) return;
  const P = kind === "paeds",
    key = "aa-ob-" + kind,
    get = k => box.querySelector(`[data-ob="${k}"]`),
    out = box.querySelector(".obout");
  try {
    const s = JSON.parse(localStorage.getItem(key) || "{}");
    ["age", "sex", "h", "w", "drug"].forEach(k => {
      if (get(k) && s[k] != null) get(k).value = s[k];
    });
    if (s.open) box.open = true;
  } catch (e) {}
  const render = () => {
    const v = {};
    ["age", "sex", "h", "w", "drug"].forEach(k => get(k) && (v[k] = get(k).value));
    try {
      localStorage.setItem(key, JSON.stringify({...v, open: box.open}));
    } catch (e) {}
    const age = parseFloat(v.age),
      h = parseFloat(v.h),
      w = parseFloat(v.w);
    if (!(h > 0) || !(w > 0) || (P && isNaN(age))) {
      out.innerHTML = `<p class="tl-intro">Enter ${P ? "age, sex, height and weight" : "sex, height and weight"} to see the dosing weights.</p>`;
      return;
    }
    if (P && (age < 2 || age > 16)) {
      out.innerHTML = `<p class="tl-intro">This calculator covers children aged 2 to 16. ${age > 16 ? "Use the Adult drugs tab." : "Under 2, use total body weight and the Paeds drug sheet."}</p>`;
      return;
    }
    const {W, bmi, ibw, over} = obWeights(kind, {sex: v.sex, h, w, age});
    const fk = x => paedFmt(Math.round(x * 10) / 10) + " kg";
    let h1 = `<table class="ptab obw"><tbody><tr><th scope="row">BMI</th><td><b>${(Math.round(bmi * 10) / 10).toFixed(1)}</b>${P ? `<small>50th centile for age and sex: ${obBMI50(age, v.sex).toFixed(1)}</small>` : ""}</td></tr>${Object.keys(W)
      .map(k => `<tr><th scope="row">${OB_NAMES[k]} (${k})</th><td><b>${fk(W[k])}</b></td></tr>`)
      .join("")}</tbody></table>`;
    if (!over)
      h1 += `<p class="note">Actual weight is at or below ideal body weight (${fk(ibw)}), so every drug uses actual weight.</p>`;
    const rows = OBESE_DOSING[kind].drugs
      .map((r, i) => [r, i])
      .filter(([, i]) => v.drug === "" || String(i) === v.drug);
    h1 += `<table class="ptab"><thead><tr><th>Drug</th><th>Dose</th><th>Weight used</th><th>Notes</th></tr></thead><tbody>${rows
      .map(([r]) => {
        const d = obDose(r, W[r.w]);
        return `<tr><th scope="row">${r.n}<small>${obPerKg(r)}${r.max ? ` (max ${paedFmt(paedUnit(r.max, r.u)[0])} ${paedUnit(r.max, r.u)[1]})` : ""}</small></th><td><b>${d.txt}</b>${d.capped ? ' <em class="pcap">max</em>' : ""}</td><td>${r.w}<small>${fk(W[r.w])}</small></td><td>${r.g || ""}</td></tr>`;
      })
      .join("")}</tbody></table>`;
    out.innerHTML = h1;
  };
  box.addEventListener("input", render);
  box.addEventListener("change", render);
  box.addEventListener("toggle", render);
  render();
}
