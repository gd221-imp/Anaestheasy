// ---- 60% tax check (imported from the Pathway 60% Tax Check artifact; entries saved on this device only) ----
const TAX_CSS=":host{display:block;margin:4px 0 0}\n\n/* Layout: one narrow working column \u2014 verdict and band gauge first, then the inputs that drive it */\n:host{\n  --bg:#f5f7f8; --surface:#ffffff; --ink:#18242b; --muted:#5b6b74; --line:#d9e1e5;\n  --accent:#0f6b67; --accent-soft:#dcefed;\n  --safe:#2c7a4b; --warn:#a86a07; --danger:#b3322b; --danger-soft:#f6dedb; --over:#7b8790;\n  --f-display:\"Bricolage Grotesque\",ui-sans-serif,system-ui,sans-serif;\n  --f-body:\"Atkinson Hyperlegible\",ui-sans-serif,system-ui,sans-serif;\n  --f-num:\"IBM Plex Mono\",ui-monospace,\"SFMono-Regular\",Menlo,monospace;\n}\n@media (prefers-color-scheme: dark){:host(:not([data-light])){\n  --bg:#0f1619; --surface:#172126; --ink:#e3eaed; --muted:#93a3ab; --line:#2a3940;\n  --accent:#4fbdb5; --accent-soft:#163a38;\n  --safe:#5cc488; --warn:#e3a43a; --danger:#ef7a70; --danger-soft:#3d1e1b; --over:#7f8d95; color-scheme:dark}}\n:host([data-dark]){\n  --bg:#0f1619; --surface:#172126; --ink:#e3eaed; --muted:#93a3ab; --line:#2a3940;\n  --accent:#4fbdb5; --accent-soft:#163a38;\n  --safe:#5cc488; --warn:#e3a43a; --danger:#ef7a70; --danger-soft:#3d1e1b; --over:#7f8d95; color-scheme:dark}\n*{box-sizing:border-box}\nbody{background:var(--bg);color:var(--ink);font-family:var(--f-body);font-size:15px;line-height:1.5}\n.wrap{max-width:760px;margin:0 auto;padding-block:28px 56px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:flex;flex-direction:column;gap:22px}\nh1,h2{font-family:var(--f-display);text-wrap:balance;margin:0}\nh1{font-size:1.9rem;font-weight:700;letter-spacing:-.01em}\nh2{font-size:1.15rem;font-weight:700}\n.sub{color:var(--muted);margin:4px 0 0}\n.num{font-family:var(--f-num);font-variant-numeric:tabular-nums}\nheader{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:14px}\n.tabs{display:flex;gap:4px;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:4px}\n.tabs button{border:0;background:transparent;color:var(--muted);font:inherit;font-weight:700;padding:7px 14px;border-radius:7px;cursor:pointer}\n.tabs button[aria-pressed=\"true\"]{background:var(--accent);color:var(--bg)}\n.panel{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:14px;min-width:0}\n.verdict{display:grid;grid-template-columns:1fr auto;gap:6px 16px;align-items:end}\n.label{font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:700}\n.big{font-family:var(--f-num);font-size:2.3rem;font-weight:500;line-height:1.1}\n.chip{display:inline-block;padding:4px 10px;border-radius:999px;font-weight:700;font-size:.85rem;white-space:nowrap}\n.chip.safe{background:var(--accent-soft);color:var(--safe)}\n.chip.warn{background:var(--accent-soft);color:var(--warn)}\n.chip.danger{background:var(--danger-soft);color:var(--danger)}\n.verdict p{grid-column:1/-1;margin:2px 0 0;color:var(--muted)}\n.verdict p strong{color:var(--ink)}\n/* band gauge */\n.gauge{position:relative;padding-top:30px}\n.track{position:relative;height:16px;border-radius:4px;overflow:hidden;display:flex;border:1px solid var(--line)}\n.track span{height:100%}\n.z1{background:var(--accent-soft)}\n.z2{background:repeating-linear-gradient(135deg,var(--danger-soft) 0 6px,transparent 6px 11px),var(--danger-soft)}\n.z3{background:var(--line)}\n.marker{position:absolute;top:0;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;transition:left .4s ease}\n.marker b{font-family:var(--f-num);font-size:.78rem;font-weight:500;background:var(--ink);color:var(--bg);padding:1px 6px;border-radius:4px;white-space:nowrap}\n.marker i{width:2px;height:28px;background:var(--ink);margin-top:2px}\n.ticks{position:relative;height:18px;font-family:var(--f-num);font-size:.72rem;color:var(--muted);margin-top:4px}\n.ticks span{position:absolute;transform:translateX(-50%);white-space:nowrap}\n.legend{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:.82rem;color:var(--muted)}\n.legend span::before{content:\"\";display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px;background:var(--sw)}\n@media (prefers-reduced-motion:reduce){.marker{transition:none}}\n/* breakdown */\ntable{width:100%;border-collapse:collapse}\ntd,th{padding:7px 0;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}\ntd.r,th.r{text-align:right;font-family:var(--f-num);font-variant-numeric:tabular-nums;white-space:nowrap;padding-left:12px}\ntr.total td{border-bottom:0;font-weight:700;padding-top:10px}\ntd small{display:block;color:var(--muted);font-size:.8rem}\n.tablewrap{overflow-x:auto}\n/* forms */\n.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}\n.field{display:flex;flex-direction:column;gap:4px;min-width:0}\n.field label{font-size:.85rem;font-weight:700}\n.field .hint{font-size:.78rem;color:var(--muted)}\ninput,select{font:inherit;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px 10px;width:100%;min-width:0}\ninput.num{font-family:var(--f-num)}\ninput:focus-visible,select:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}\n.row{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}\n.row .field{flex:1 1 140px}\n.btn{font:inherit;font-weight:700;border-radius:8px;padding:9px 14px;cursor:pointer;border:1px solid var(--accent);background:var(--accent);color:var(--bg)}\n.btn.ghost{background:transparent;color:var(--accent)}\n.x{border:0;background:transparent;color:var(--muted);cursor:pointer;font-size:1.1rem;padding:0 4px}\n.x:hover{color:var(--danger)}\n.empty{color:var(--muted);font-size:.9rem;margin:0}\n.callout{background:var(--accent-soft);border-radius:8px;padding:12px 14px;font-size:.92rem}\n.callout.danger{background:var(--danger-soft)}\n.foot{color:var(--muted);font-size:.8rem}\n.foot p{margin:0 0 6px}\n.status{font-size:.8rem;color:var(--muted);min-height:1.2em}\n@media (max-width:480px){.big{font-size:1.9rem}.verdict{grid-template-columns:1fr}}\n\n.wrap{padding:0!important;max-width:none;background:var(--bg);color:var(--ink);font-family:var(--f-body);font-size:15px;line-height:1.5}\nh1{font-size:1.4rem}\n";
const TAX_HTML="<div class=\"wrap\">\n  <header>\n    <div>\n      <h1>60% Tax Check<\/h1>\n      <p class=\"sub\">Adjusted net income against the \u00a3100,000 personal allowance taper<\/p>\n    <\/div>\n    <div class=\"tabs\" role=\"group\" aria-label=\"Tax year\">\n      <button type=\"button\" data-year=\"2026-27\" aria-pressed=\"true\">2026/27<\/button>\n      <button type=\"button\" data-year=\"2027-28\" aria-pressed=\"false\">2027/28<\/button>\n    <\/div>\n  <\/header>\n\n  <section class=\"panel\" aria-live=\"polite\">\n    <div class=\"verdict\">\n      <div>\n        <div class=\"label\">Projected adjusted net income<\/div>\n        <div class=\"big\" id=\"ani\">\u2014<\/div>\n      <\/div>\n      <span class=\"chip safe\" id=\"chip\">\u2014<\/span>\n      <p id=\"verdictText\"><\/p>\n    <\/div>\n    <div class=\"gauge\" id=\"gauge\">\n      <div class=\"marker\" id=\"marker\"><b id=\"markerLabel\">\u2014<\/b><i><\/i><\/div>\n      <div class=\"track\"><span class=\"z1\" id=\"z1\"><\/span><span class=\"z2\" id=\"z2\"><\/span><span class=\"z3\" id=\"z3\"><\/span><\/div>\n      <div class=\"ticks\" id=\"ticks\"><\/div>\n    <\/div>\n    <div class=\"legend\">\n      <span style=\"--sw:var(--accent-soft)\">40% band<\/span>\n      <span style=\"--sw:var(--danger)\">60% effective band (\u00a3100,000\u2013\u00a3125,140)<\/span>\n      <span style=\"--sw:var(--line)\">45% band<\/span>\n    <\/div>\n    <div class=\"callout\" id=\"sippBox\" hidden><\/div>\n  <\/section>\n\n  <section class=\"panel\">\n    <h2>How it adds up<\/h2>\n    <div class=\"tablewrap\"><table><tbody id=\"breakdown\"><\/tbody><\/table><\/div>\n  <\/section>\n\n  <section class=\"panel\">\n    <div>\n      <h2>Payslips<\/h2>\n      <p class=\"sub\">Enter the year-to-date figures from each payslip. The latest one drives the projection.<\/p>\n    <\/div>\n    <div class=\"tablewrap\"><table>\n      <thead><tr><th>Month<\/th><th class=\"r\">Taxable pay YTD<\/th><th class=\"r\">Pension YTD<\/th><th><\/th><\/tr><\/thead>\n      <tbody id=\"slips\"><\/tbody>\n    <\/table><\/div>\n    <p class=\"empty\" id=\"slipsEmpty\">No payslips yet. Until you add one, the year is projected from the expected monthly pay below.<\/p>\n    <form class=\"row\" id=\"slipForm\">\n      <div class=\"field\"><label for=\"slipMonth\">Payslip month<\/label><select id=\"slipMonth\"><\/select><\/div>\n      <div class=\"field\"><label for=\"slipTaxable\">Taxable pay YTD (\u00a3)<\/label><input id=\"slipTaxable\" class=\"num\" inputmode=\"decimal\" required><\/div>\n      <div class=\"field\"><label for=\"slipPension\">Pension YTD (\u00a3)<\/label><input id=\"slipPension\" class=\"num\" inputmode=\"decimal\"><\/div>\n      <button class=\"btn\" type=\"submit\">Add payslip<\/button>\n    <\/form>\n    <div class=\"field\">\n      <label for=\"expected\">Expected taxable pay per month for the months left (\u00a3)<\/label>\n      <input id=\"expected\" class=\"num\" inputmode=\"decimal\">\n      <span class=\"hint\">Gross monthly pay minus NHS pension<\/span>\n    <\/div>\n  <\/section>\n\n  <section class=\"panel\">\n    <div>\n      <h2>Other work<\/h2>\n      <p class=\"sub\">Locums, bank shifts, WLIs, teaching and any other earnings.<\/p>\n    <\/div>\n    <div class=\"tablewrap\"><table>\n      <tbody id=\"extras\"><\/tbody>\n    <\/table><\/div>\n    <p class=\"empty\" id=\"extrasEmpty\">Nothing added yet.<\/p>\n    <form class=\"row\" id=\"extraForm\">\n      <div class=\"field\"><label for=\"exLabel\">What<\/label><input id=\"exLabel\" required><\/div>\n      <div class=\"field\"><label for=\"exAmount\">Gross (\u00a3)<\/label><input id=\"exAmount\" class=\"num\" inputmode=\"decimal\" required><\/div>\n      <div class=\"field\"><label for=\"exKind\">Paid how<\/label>\n        <select id=\"exKind\">\n          <option value=\"separate\">Separate payroll (adds on)<\/option>\n          <option value=\"included\">Same payroll (already in payslip YTD)<\/option>\n          <option value=\"self\">Self-employed<\/option>\n        <\/select><\/div>\n      <button class=\"btn\" type=\"submit\">Add<\/button>\n    <\/form>\n  <\/section>\n\n  <section class=\"panel\">\n    <h2>Reliefs and other income<\/h2>\n    <div class=\"grid\">\n      <div class=\"field\"><label for=\"fees\">Professional fees relief (\u00a3)<\/label><input id=\"fees\" class=\"num\" inputmode=\"decimal\"><span class=\"hint\">GMC, RCoA, AAGBI, defence union<\/span><\/div>\n      <div class=\"field\"><label for=\"interest\">Savings interest (\u00a3)<\/label><input id=\"interest\" class=\"num\" inputmode=\"decimal\"><span class=\"hint\">Not ISAs or Premium Bonds<\/span><\/div>\n      <div class=\"field\"><label for=\"sipp\">SIPP paid in, net (\u00a3)<\/label><input id=\"sipp\" class=\"num\" inputmode=\"decimal\"><span class=\"hint\">What you paid; 25% is added on top<\/span><\/div>\n      <div class=\"field\"><label for=\"giftaid\">Gift Aid donations (\u00a3)<\/label><input id=\"giftaid\" class=\"num\" inputmode=\"decimal\"><span class=\"hint\">What you gave; grossed up by 25%<\/span><\/div>\n      <div class=\"field\"><label for=\"seExp\">Self-employed expenses (\u00a3)<\/label><input id=\"seExp\" class=\"num\" inputmode=\"decimal\"><span class=\"hint\">Used instead of the \u00a31,000 allowance if larger<\/span><\/div>\n    <\/div>\n    <h2>Other income<\/h2>\n    <div class=\"grid\">\n      <div class=\"field\"><label for=\"rental\">Rental profit (\u00a3)<\/label><input id=\"rental\" class=\"num\" inputmode=\"decimal\"><span class=\"hint\">After allowable expenses<\/span><\/div>\n      <div class=\"field\"><label for=\"dividends\">Dividends (\u00a3)<\/label><input id=\"dividends\" class=\"num\" inputmode=\"decimal\"><span class=\"hint\">From your own company or shares outside an ISA<\/span><\/div>\n      <div class=\"field\"><label for=\"benefits\">Taxable benefits (\u00a3)<\/label><input id=\"benefits\" class=\"num\" inputmode=\"decimal\"><span class=\"hint\">P11D value, e.g. a company car<\/span><\/div>\n      <div class=\"field\"><label for=\"otherInc\">Anything else taxable (\u00a3)<\/label><input id=\"otherInc\" class=\"num\" inputmode=\"decimal\"><span class=\"hint\">Royalties, app income, other one-offs<\/span><\/div>\n    <\/div>\n    <h2>Student loan<\/h2>\n    <div class=\"grid\">\n      <div class=\"field\"><label for=\"slUG\">Undergraduate loan<\/label>\n        <select id=\"slUG\"><option value=\"\">None<\/option><option value=\"1\">Plan 1<\/option><option value=\"2\">Plan 2<\/option><option value=\"4\">Plan 4 (Scotland)<\/option><option value=\"5\">Plan 5<\/option><\/select>\n        <span class=\"hint\">9% of earnings over the threshold<\/span><\/div>\n      <div class=\"field\"><label for=\"slPG\">Postgraduate loan<\/label>\n        <select id=\"slPG\"><option value=\"\">None<\/option><option value=\"pg\">Postgraduate Loan<\/option><\/select>\n        <span class=\"hint\">6% of earnings over the threshold<\/span><\/div>\n    <\/div>\n    <p class=\"foot\" style=\"margin:0\">Student loan repayments don't change your adjusted net income, but they reduce what you keep from extra work.<\/p>\n  <\/section>\n\n  <section class=\"panel\">\n    <h2>Before you take a shift<\/h2>\n    <div class=\"row\">\n      <div class=\"field\"><label for=\"whatif\">Extra gross pay (\u00a3)<\/label><input id=\"whatif\" class=\"num\" inputmode=\"decimal\" value=\"1000\"><\/div>\n    <\/div>\n    <div class=\"callout\" id=\"whatifOut\"><\/div>\n  <\/section>\n\n  <div class=\"status\" id=\"status\"><\/div>\n\n  <footer class=\"foot\">\n    <p>Projection = latest payslip's taxable pay to date + expected pay \u00d7 months left. Taxable pay on NHS payslips is already after pension contributions.<\/p>\n    <p>Self-employed income up to \u00a31,000 is covered by the trading allowance. Take-home figures assume 40% / 60% / 45% income tax plus 2% NI, and any student loan you select. Thresholds are frozen at \u00a3100,000 and \u00a3125,140. This is an estimate, not tax advice.<\/p>\n  <\/footer>\n<\/div>";
function mountTaxTracker(host){
  if(host.shadowRoot)return;
  const root=host.attachShadow({mode:"open"});
  const dt=document.documentElement.getAttribute("data-theme");if(dt==="dark")host.setAttribute("data-dark","");if(dt==="light")host.setAttribute("data-light","");
  root.innerHTML=`<style>${TAX_CSS}</style>`+TAX_HTML;
  const TA = 1000, LOW = 100000, HIGH = 125140, GMIN = 80000, GMAX = 130000;
  const YEARS = ["2026-27","2027-28"];
  const MONTHS = ["April","May","June","July","August","September","October","November","December","January","February","March"];
  const gbp = new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP",maximumFractionDigits:0});
  const gbp2 = new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP",minimumFractionDigits:2,maximumFractionDigits:2});
  const $ = id => root.getElementById(id);
  const n = v => { const x = parseFloat(String(v ?? "").replace(/[£,\s]/g,"")); return isFinite(x) ? x : 0; };
  const blank = () => ({expectedMonthly:"",payslips:[],extras:[],fees:"",interest:"",sippNet:"",giftAidNet:"",seExpenses:"",rental:"",dividends:"",benefits:"",otherInc:"",slUG:"",slPG:""});

  const state = {}; YEARS.forEach(y => state[y] = blank());
  let year = "2026-27", saveTimers = {};

  // ---------- storage ----------
  function lsGet(y){ try { const s = localStorage.getItem("pathway-band-"+y); return s ? JSON.parse(s) : null; } catch(e){ return null; } }
  function lsSet(y){ try { localStorage.setItem("pathway-band-"+y, JSON.stringify(state[y])); } catch(e){} }
  function scheduleSave(y){
    clearTimeout(saveTimers[y]);
    saveTimers[y] = setTimeout(() => persist(y), 700);
  }
  function persist(y){
    lsSet(y);
    $("status").textContent = "Saved on this device.";
  }

  // ---------- calculation ----------
  function calc(s){
    const slips = [...s.payslips].sort((a,b)=>a.m-b.m);
    const latest = slips[slips.length-1];
    const exp = n(s.expectedMonthly);
    const monthsDone = latest ? latest.m : 0;
    const ytd = latest ? n(latest.taxable) : 0;
    const projectedRest = (12 - monthsDone) * exp;
    const main = ytd + projectedRest;
    const sep = s.extras.filter(e=>e.kind==="separate").reduce((t,e)=>t+n(e.amount),0);
    const inc = s.extras.filter(e=>e.kind==="included").reduce((t,e)=>t+n(e.amount),0);
    const seGross = s.extras.filter(e=>e.kind==="self").reduce((t,e)=>t+n(e.amount),0);
    const seDeduct = seGross <= TA ? seGross : Math.max(TA, n(s.seExpenses));
    const seTaxable = Math.max(0, seGross - seDeduct);
    const interest = n(s.interest), fees = n(s.fees);
    const sippGross = n(s.sippNet) * 1.25, giftGross = n(s.giftAidNet) * 1.25;
    const rental = n(s.rental), dividends = n(s.dividends), benefits = n(s.benefits), otherInc = n(s.otherInc);
    const ani = main + sep + seTaxable + interest + rental + dividends + benefits + otherInc - fees - sippGross - giftGross;
    const slRate = (s.slUG ? 0.09 : 0) + (s.slPG ? 0.06 : 0);
    return {latest, monthsDone, ytd, exp, projectedRest, main, sep, inc, seGross, seTaxable, interest, rental, dividends, benefits, otherInc, fees, sippGross, giftGross, ani, slRate};
  }
  // income tax + 2% NI on extra employment pay, starting at ani
  function costOfExtra(ani, extra, slRate){
    let tax = extra * (slRate||0), a = ani, left = extra;
    const bands = [[LOW,0.42],[HIGH,0.62],[Infinity,0.47]];
    for (const [top,rate] of bands){
      if (left <= 0) break;
      if (a >= top) continue;
      const chunk = Math.min(left, top - a);
      tax += chunk * rate; a += chunk; left -= chunk;
    }
    return tax;
  }

  // ---------- render ----------
  function pct(v){ return Math.max(0, Math.min(100, (v - GMIN) / (GMAX - GMIN) * 100)); }
  function renderGauge(ani){
    $("z1").style.width = pct(LOW)+"%";
    $("z2").style.width = (pct(HIGH)-pct(LOW))+"%";
    $("z3").style.width = (100-pct(HIGH))+"%";
    const p = pct(ani);
    $("marker").style.left = Math.max(6, Math.min(94, p))+"%";
    $("marker").querySelector("i").style.marginLeft = "0";
    $("markerLabel").textContent = gbp.format(ani);
    const ticks = [80000,90000,100000,110000,125140,130000].filter(t=>t!==130000);
    $("ticks").innerHTML = ticks.map(t => `<span style="left:${pct(t)}%">${t===125140?"£125k":"£"+(t/1000)+"k"}</span>`).join("");
  }

  function row(label, value, note, cls){
    return `<tr${cls?` class="${cls}"`:""}><td>${label}${note?`<small>${note}</small>`:""}</td><td class="r">${value}</td></tr>`;
  }
  function esc(s){ return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  const signed = v => (v<0?"− ":"+ ") + gbp.format(Math.abs(v));

  function render(){
    const s = state[year], c = calc(s);
    const headroom = LOW - c.ani;
    $("ani").textContent = gbp.format(c.ani);
    const chip = $("chip");
    if (c.ani > LOW){ chip.className = "chip danger"; chip.textContent = "In the 60% band"; }
    else if (headroom < 2000){ chip.className = "chip warn"; chip.textContent = "Close to £100k"; }
    else { chip.className = "chip safe"; chip.textContent = "Under £100k"; }

    const basis = c.latest ? `${MONTHS[c.latest.m-1]} payslip plus ${12-c.monthsDone} month${12-c.monthsDone===1?"":"s"} projected` : "expected monthly pay for all 12 months";
    $("verdictText").innerHTML = c.ani > LOW
      ? `<strong>${gbp.format(c.ani-LOW)} over</strong> the threshold, based on your ${basis}.`
      : `<strong>${gbp.format(headroom)} of headroom</strong> before the 60% band, based on your ${basis}.`;
    renderGauge(c.ani);

    const box = $("sippBox");
    if (c.ani > LOW){
      const over = Math.min(c.ani, HIGH) - LOW;
      box.hidden = false; box.className = "callout danger";
      box.innerHTML = `To bring this back to £100,000, pay about <strong class="num">${gbp.format(over*0.8)}</strong> into a SIPP before 5 April (${gbp.format(over)} once the 25% top-up is added). After reclaiming higher-rate relief, it costs you roughly ${gbp.format(over*0.4)}.`;
    } else box.hidden = true;

    let b = "";
    b += row("Main job, taxable pay to date", gbp.format(c.ytd), c.latest ? `${MONTHS[c.latest.m-1]} payslip` : "No payslip yet");
    b += row("Rest of year, projected", "+ "+gbp.format(c.projectedRest), `${12-c.monthsDone} × ${gbp.format(c.exp)}`);
    if (c.sep) b += row("Separate-payroll work", "+ "+gbp.format(c.sep));
    if (c.inc) b += row("Same-payroll work", gbp.format(0), `${gbp.format(c.inc)} already counted in your payslip`);
    if (c.seGross) b += row("Self-employed work", "+ "+gbp.format(c.seTaxable), c.seGross <= TA ? `${gbp.format(c.seGross)} covered by the £1,000 trading allowance` : `${gbp.format(c.seGross)} gross, less ${gbp.format(c.seGross-c.seTaxable)}`);
    if (c.interest) b += row("Savings interest", "+ "+gbp.format(c.interest));
    if (c.rental) b += row("Rental profit", "+ "+gbp.format(c.rental));
    if (c.dividends) b += row("Dividends", "+ "+gbp.format(c.dividends));
    if (c.benefits) b += row("Taxable benefits", "+ "+gbp.format(c.benefits));
    if (c.otherInc) b += row("Other taxable income", "+ "+gbp.format(c.otherInc));
    if (c.fees) b += row("Professional fees relief", signed(-c.fees));
    if (c.sippGross) b += row("SIPP contributions (grossed up)", signed(-c.sippGross));
    if (c.giftGross) b += row("Gift Aid (grossed up)", signed(-c.giftGross));
    b += row("Adjusted net income", gbp.format(c.ani), "", "total");
    $("breakdown").innerHTML = b;

    const slips = [...s.payslips].sort((a,b)=>a.m-b.m);
    $("slips").innerHTML = slips.map(p => `<tr><td>${MONTHS[p.m-1]}</td><td class="r">${gbp2.format(n(p.taxable))}</td><td class="r">${p.pension!==""&&p.pension!=null?gbp2.format(n(p.pension)):"—"}</td><td class="r"><button class="x" type="button" data-del-slip="${p.m}" aria-label="Remove ${MONTHS[p.m-1]} payslip">×</button></td></tr>`).join("");
    $("slipsEmpty").hidden = slips.length > 0;

    const kindName = {separate:"Separate payroll", included:"Same payroll", self:"Self-employed"};
    $("extras").innerHTML = s.extras.map(e => `<tr><td>${esc(e.label)}<small>${kindName[e.kind]}</small></td><td class="r">${gbp.format(n(e.amount))}</td><td class="r"><button class="x" type="button" data-del-extra="${esc(e.id)}" aria-label="Remove ${esc(e.label)}">×</button></td></tr>`).join("");
    $("extrasEmpty").hidden = s.extras.length > 0;

    renderWhatIf(c);
  }

  function renderWhatIf(c){
    const x = n($("whatif").value);
    if (!x){ $("whatifOut").innerHTML = "Enter an amount to see where it lands."; return; }
    const cost = costOfExtra(c.ani, x, c.slRate), keep = x - cost, after = c.ani + x;
    const crosses = c.ani <= LOW && after > LOW;
    $("whatifOut").className = "callout" + (after > LOW ? " danger" : "");
    $("whatifOut").innerHTML = `${gbp.format(x)} more takes you to <strong class="num">${gbp.format(after)}</strong>. You'd keep about <strong class="num">${gbp.format(keep)}</strong> after tax, NI${c.slRate?" and student loan":""}${crosses?`, because ${gbp.format(after-LOW)} of it falls in the 60% band`:after>LOW?", with it taxed at an effective 62%":""}.`;
  }

  function fillInputs(){
    const s = state[year];
    $("expected").value = s.expectedMonthly ?? "";
    $("fees").value = s.fees ?? ""; $("interest").value = s.interest ?? "";
    $("sipp").value = s.sippNet ?? ""; $("giftaid").value = s.giftAidNet ?? ""; $("seExp").value = s.seExpenses ?? "";
    ["rental","dividends","benefits","otherInc","slUG","slPG"].forEach(k => $(k).value = s[k] ?? "");
  }

  // ---------- events ----------
  $("slipMonth").innerHTML = MONTHS.map((m,i)=>`<option value="${i+1}">${m}</option>`).join("");
  root.querySelectorAll(".tabs button").forEach(btn => btn.addEventListener("click", () => {
    year = btn.dataset.year;
    root.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-pressed", String(b===btn)));
    fillInputs(); render();
  }));
  const bind = (id, key) => $(id).addEventListener("input", e => { state[year][key] = e.target.value; render(); scheduleSave(year); });
  bind("expected","expectedMonthly"); bind("fees","fees"); bind("interest","interest");
  bind("sipp","sippNet"); bind("giftaid","giftAidNet"); bind("seExp","seExpenses");
  ["rental","dividends","benefits","otherInc"].forEach(k => bind(k,k));
  ["slUG","slPG"].forEach(k => $(k).addEventListener("change", e => { state[year][k] = e.target.value; render(); scheduleSave(year); }));
  $("whatif").addEventListener("input", () => renderWhatIf(calc(state[year])));

  $("slipForm").addEventListener("submit", e => {
    e.preventDefault();
    const m = +$("slipMonth").value, taxable = $("slipTaxable").value.trim();
    if (!taxable) return;
    const s = state[year];
    s.payslips = s.payslips.filter(p => p.m !== m).concat({m, taxable: String(n(taxable)), pension: $("slipPension").value.trim() ? String(n($("slipPension").value)) : ""});
    $("slipTaxable").value = ""; $("slipPension").value = "";
    if (m < 12) $("slipMonth").value = String(m+1);
    render(); scheduleSave(year);
  });
  $("extraForm").addEventListener("submit", e => {
    e.preventDefault();
    const label = $("exLabel").value.trim(), amount = $("exAmount").value.trim();
    if (!label || !amount) return;
    state[year].extras.push({id: Date.now().toString(36)+Math.random().toString(36).slice(2,6), label, amount: String(n(amount)), kind: $("exKind").value});
    $("exLabel").value = ""; $("exAmount").value = "";
    render(); scheduleSave(year);
  });
  root.addEventListener("click", e => {
    const ds = e.target.closest("[data-del-slip]"), de = e.target.closest("[data-del-extra]");
    if (ds){ state[year].payslips = state[year].payslips.filter(p => p.m !== +ds.dataset.delSlip); render(); scheduleSave(year); }
    if (de){ state[year].extras = state[year].extras.filter(x => x.id !== de.dataset.delExtra); render(); scheduleSave(year); }
  });

  // ---------- boot ----------
  YEARS.forEach(y => { const l = lsGet(y); if (l) state[y] = Object.assign(blank(), l); });
  fillInputs(); render();

  $("status").textContent = "Your entries are saved on this device only.";
}
new MutationObserver(()=>{document.querySelectorAll(".taxmount").forEach(el=>{if(!el.shadowRoot)mountTaxTracker(el)})}).observe(document.body,{childList:true,subtree:true});

