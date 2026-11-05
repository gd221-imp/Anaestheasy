// ---- 60% tax check (imported from the Pathway 60% Tax Check artifact; entries saved on this device only) ----
const TAX_CSS = "/*@@text tax-tracker.css@@*/";
const TAX_HTML = "/*@@text tax-tracker.html@@*/";
function mountTaxTracker(host) {
  if (host.shadowRoot) return;
  const root = host.attachShadow({mode: "open"});
  const dt = document.documentElement.getAttribute("data-theme");
  if (dt === "dark") host.setAttribute("data-dark", "");
  if (dt === "light") host.setAttribute("data-light", "");
  root.innerHTML = `<style>${TAX_CSS}</style>` + TAX_HTML;
  const TA = 1000,
    LOW = 100000,
    HIGH = 125140,
    GMIN = 80000,
    GMAX = 130000;
  const YEARS = ["2026-27", "2027-28"];
  const MONTHS = [
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
    "January",
    "February",
    "March"
  ];
  const gbp = new Intl.NumberFormat("en-GB", {style: "currency", currency: "GBP", maximumFractionDigits: 0});
  const gbp2 = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const $ = id => root.getElementById(id);
  const n = v => {
    const x = parseFloat(String(v ?? "").replace(/[£,\s]/g, ""));
    return isFinite(x) ? x : 0;
  };
  const blank = () => ({
    expectedMonthly: "",
    payslips: [],
    extras: [],
    fees: "",
    interest: "",
    sippNet: "",
    giftAidNet: "",
    seExpenses: "",
    rental: "",
    dividends: "",
    benefits: "",
    otherInc: "",
    slUG: "",
    slPG: ""
  });

  const state = {};
  YEARS.forEach(y => (state[y] = blank()));
  let year = "2026-27",
    saveTimers = {};

  // ---------- storage ----------
  function lsGet(y) {
    try {
      const s = localStorage.getItem("pathway-band-" + y);
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  }
  function lsSet(y) {
    try {
      localStorage.setItem("pathway-band-" + y, JSON.stringify(state[y]));
    } catch (e) {}
  }
  function scheduleSave(y) {
    clearTimeout(saveTimers[y]);
    saveTimers[y] = setTimeout(() => persist(y), 700);
  }
  function persist(y) {
    lsSet(y);
    $("status").textContent = "Saved on this device.";
  }

  // ---------- calculation ----------
  function calc(s) {
    const slips = [...s.payslips].sort((a, b) => a.m - b.m);
    const latest = slips[slips.length - 1];
    const exp = n(s.expectedMonthly);
    const monthsDone = latest ? latest.m : 0;
    const ytd = latest ? n(latest.taxable) : 0;
    const projectedRest = (12 - monthsDone) * exp;
    const main = ytd + projectedRest;
    const sep = s.extras.filter(e => e.kind === "separate").reduce((t, e) => t + n(e.amount), 0);
    const inc = s.extras.filter(e => e.kind === "included").reduce((t, e) => t + n(e.amount), 0);
    const seGross = s.extras.filter(e => e.kind === "self").reduce((t, e) => t + n(e.amount), 0);
    const seDeduct = seGross <= TA ? seGross : Math.max(TA, n(s.seExpenses));
    const seTaxable = Math.max(0, seGross - seDeduct);
    const interest = n(s.interest),
      fees = n(s.fees);
    const sippGross = n(s.sippNet) * 1.25,
      giftGross = n(s.giftAidNet) * 1.25;
    const rental = n(s.rental),
      dividends = n(s.dividends),
      benefits = n(s.benefits),
      otherInc = n(s.otherInc);
    const ani =
      main + sep + seTaxable + interest + rental + dividends + benefits + otherInc - fees - sippGross - giftGross;
    const slRate = (s.slUG ? 0.09 : 0) + (s.slPG ? 0.06 : 0);
    return {
      latest,
      monthsDone,
      ytd,
      exp,
      projectedRest,
      main,
      sep,
      inc,
      seGross,
      seTaxable,
      interest,
      rental,
      dividends,
      benefits,
      otherInc,
      fees,
      sippGross,
      giftGross,
      ani,
      slRate
    };
  }
  // income tax + 2% NI on extra employment pay, starting at ani
  function costOfExtra(ani, extra, slRate) {
    let tax = extra * (slRate || 0),
      a = ani,
      left = extra;
    const bands = [
      [LOW, 0.42],
      [HIGH, 0.62],
      [Infinity, 0.47]
    ];
    for (const [top, rate] of bands) {
      if (left <= 0) break;
      if (a >= top) continue;
      const chunk = Math.min(left, top - a);
      tax += chunk * rate;
      a += chunk;
      left -= chunk;
    }
    return tax;
  }

  // ---------- render ----------
  function pct(v) {
    return Math.max(0, Math.min(100, ((v - GMIN) / (GMAX - GMIN)) * 100));
  }
  function renderGauge(ani) {
    $("z1").style.width = pct(LOW) + "%";
    $("z2").style.width = pct(HIGH) - pct(LOW) + "%";
    $("z3").style.width = 100 - pct(HIGH) + "%";
    const p = pct(ani);
    $("marker").style.left = Math.max(6, Math.min(94, p)) + "%";
    $("marker").querySelector("i").style.marginLeft = "0";
    $("markerLabel").textContent = gbp.format(ani);
    const ticks = [80000, 90000, 100000, 110000, 125140, 130000].filter(t => t !== 130000);
    $("ticks").innerHTML = ticks
      .map(t => `<span style="left:${pct(t)}%">${t === 125140 ? "£125k" : "£" + t / 1000 + "k"}</span>`)
      .join("");
  }

  function row(label, value, note, cls) {
    return `<tr${cls ? ` class="${cls}"` : ""}><td>${label}${note ? `<small>${note}</small>` : ""}</td><td class="r">${value}</td></tr>`;
  }
  const signed = v => (v < 0 ? "− " : "+ ") + gbp.format(Math.abs(v));

  function render() {
    const s = state[year],
      c = calc(s);
    const headroom = LOW - c.ani;
    $("ani").textContent = gbp.format(c.ani);
    const chip = $("chip");
    if (c.ani > LOW) {
      chip.className = "chip danger";
      chip.textContent = "In the 60% band";
    } else if (headroom < 2000) {
      chip.className = "chip warn";
      chip.textContent = "Close to £100k";
    } else {
      chip.className = "chip safe";
      chip.textContent = "Under £100k";
    }

    const basis = c.latest
      ? `${MONTHS[c.latest.m - 1]} payslip plus ${12 - c.monthsDone} month${12 - c.monthsDone === 1 ? "" : "s"} projected`
      : "expected monthly pay for all 12 months";
    $("verdictText").innerHTML =
      c.ani > LOW
        ? `<strong>${gbp.format(c.ani - LOW)} over</strong> the threshold, based on your ${basis}.`
        : `<strong>${gbp.format(headroom)} of headroom</strong> before the 60% band, based on your ${basis}.`;
    renderGauge(c.ani);

    const box = $("sippBox");
    if (c.ani > LOW) {
      const over = Math.min(c.ani, HIGH) - LOW;
      box.hidden = false;
      box.className = "callout danger";
      box.innerHTML = `To bring this back to £100,000, pay about <strong class="num">${gbp.format(over * 0.8)}</strong> into a SIPP before 5 April (${gbp.format(over)} once the 25% top-up is added). After reclaiming higher-rate relief, it costs you roughly ${gbp.format(over * 0.4)}.`;
    } else box.hidden = true;

    let b = "";
    b += row(
      "Main job, taxable pay to date",
      gbp.format(c.ytd),
      c.latest ? `${MONTHS[c.latest.m - 1]} payslip` : "No payslip yet"
    );
    b += row(
      "Rest of year, projected",
      "+ " + gbp.format(c.projectedRest),
      `${12 - c.monthsDone} × ${gbp.format(c.exp)}`
    );
    if (c.sep) b += row("Separate-payroll work", "+ " + gbp.format(c.sep));
    if (c.inc) b += row("Same-payroll work", gbp.format(0), `${gbp.format(c.inc)} already counted in your payslip`);
    if (c.seGross)
      b += row(
        "Self-employed work",
        "+ " + gbp.format(c.seTaxable),
        c.seGross <= TA
          ? `${gbp.format(c.seGross)} covered by the £1,000 trading allowance`
          : `${gbp.format(c.seGross)} gross, less ${gbp.format(c.seGross - c.seTaxable)}`
      );
    if (c.interest) b += row("Savings interest", "+ " + gbp.format(c.interest));
    if (c.rental) b += row("Rental profit", "+ " + gbp.format(c.rental));
    if (c.dividends) b += row("Dividends", "+ " + gbp.format(c.dividends));
    if (c.benefits) b += row("Taxable benefits", "+ " + gbp.format(c.benefits));
    if (c.otherInc) b += row("Other taxable income", "+ " + gbp.format(c.otherInc));
    if (c.fees) b += row("Professional fees relief", signed(-c.fees));
    if (c.sippGross) b += row("SIPP contributions (grossed up)", signed(-c.sippGross));
    if (c.giftGross) b += row("Gift Aid (grossed up)", signed(-c.giftGross));
    b += row("Adjusted net income", gbp.format(c.ani), "", "total");
    $("breakdown").innerHTML = b;

    const slips = [...s.payslips].sort((a, b) => a.m - b.m);
    $("slips").innerHTML = slips
      .map(
        p =>
          `<tr><td>${MONTHS[p.m - 1]}</td><td class="r">${gbp2.format(n(p.taxable))}</td><td class="r">${p.pension !== "" && p.pension != null ? gbp2.format(n(p.pension)) : "—"}</td><td class="r"><button class="x" type="button" data-del-slip="${p.m}" aria-label="Remove ${MONTHS[p.m - 1]} payslip">×</button></td></tr>`
      )
      .join("");
    $("slipsEmpty").hidden = slips.length > 0;

    const kindName = {separate: "Separate payroll", included: "Same payroll", self: "Self-employed"};
    $("extras").innerHTML = s.extras
      .map(
        e =>
          `<tr><td>${escapeHTML(e.label)}<small>${kindName[e.kind]}</small></td><td class="r">${gbp.format(n(e.amount))}</td><td class="r"><button class="x" type="button" data-del-extra="${escapeHTML(e.id)}" aria-label="Remove ${escapeHTML(e.label)}">×</button></td></tr>`
      )
      .join("");
    $("extrasEmpty").hidden = s.extras.length > 0;

    renderWhatIf(c);
  }

  function renderWhatIf(c) {
    const x = n($("whatif").value);
    if (!x) {
      $("whatifOut").innerHTML = "Enter an amount to see where it lands.";
      return;
    }
    const cost = costOfExtra(c.ani, x, c.slRate),
      keep = x - cost,
      after = c.ani + x;
    const crosses = c.ani <= LOW && after > LOW;
    $("whatifOut").className = "callout" + (after > LOW ? " danger" : "");
    $("whatifOut").innerHTML =
      `${gbp.format(x)} more takes you to <strong class="num">${gbp.format(after)}</strong>. You'd keep about <strong class="num">${gbp.format(keep)}</strong> after tax, NI${c.slRate ? " and student loan" : ""}${crosses ? `, because ${gbp.format(after - LOW)} of it falls in the 60% band` : after > LOW ? ", with it taxed at an effective 62%" : ""}.`;
  }

  function fillInputs() {
    const s = state[year];
    $("expected").value = s.expectedMonthly ?? "";
    $("fees").value = s.fees ?? "";
    $("interest").value = s.interest ?? "";
    $("sipp").value = s.sippNet ?? "";
    $("giftaid").value = s.giftAidNet ?? "";
    $("seExp").value = s.seExpenses ?? "";
    ["rental", "dividends", "benefits", "otherInc", "slUG", "slPG"].forEach(k => ($(k).value = s[k] ?? ""));
  }

  // ---------- events ----------
  $("slipMonth").innerHTML = MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("");
  root.querySelectorAll(".tabs button").forEach(btn =>
    btn.addEventListener("click", () => {
      year = btn.dataset.year;
      root.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-pressed", String(b === btn)));
      fillInputs();
      render();
    })
  );
  const bind = (id, key) =>
    $(id).addEventListener("input", e => {
      state[year][key] = e.target.value;
      render();
      scheduleSave(year);
    });
  bind("expected", "expectedMonthly");
  bind("fees", "fees");
  bind("interest", "interest");
  bind("sipp", "sippNet");
  bind("giftaid", "giftAidNet");
  bind("seExp", "seExpenses");
  ["rental", "dividends", "benefits", "otherInc"].forEach(k => bind(k, k));
  ["slUG", "slPG"].forEach(k =>
    $(k).addEventListener("change", e => {
      state[year][k] = e.target.value;
      render();
      scheduleSave(year);
    })
  );
  $("whatif").addEventListener("input", () => renderWhatIf(calc(state[year])));

  $("slipForm").addEventListener("submit", e => {
    e.preventDefault();
    const m = +$("slipMonth").value,
      taxable = $("slipTaxable").value.trim();
    if (!taxable) return;
    const s = state[year];
    s.payslips = s.payslips
      .filter(p => p.m !== m)
      .concat({
        m,
        taxable: String(n(taxable)),
        pension: $("slipPension").value.trim() ? String(n($("slipPension").value)) : ""
      });
    $("slipTaxable").value = "";
    $("slipPension").value = "";
    if (m < 12) $("slipMonth").value = String(m + 1);
    render();
    scheduleSave(year);
  });
  $("extraForm").addEventListener("submit", e => {
    e.preventDefault();
    const label = $("exLabel").value.trim(),
      amount = $("exAmount").value.trim();
    if (!label || !amount) return;
    state[year].extras.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      label,
      amount: String(n(amount)),
      kind: $("exKind").value
    });
    $("exLabel").value = "";
    $("exAmount").value = "";
    render();
    scheduleSave(year);
  });
  root.addEventListener("click", e => {
    const ds = e.target.closest("[data-del-slip]"),
      de = e.target.closest("[data-del-extra]");
    if (ds) {
      state[year].payslips = state[year].payslips.filter(p => p.m !== +ds.dataset.delSlip);
      render();
      scheduleSave(year);
    }
    if (de) {
      state[year].extras = state[year].extras.filter(x => x.id !== de.dataset.delExtra);
      render();
      scheduleSave(year);
    }
  });

  // ---------- boot ----------
  YEARS.forEach(y => {
    const l = lsGet(y);
    if (l) state[y] = Object.assign(blank(), l);
  });
  fillInputs();
  render();

  $("status").textContent = "Your entries are saved on this device only.";
}
new MutationObserver(() => {
  document.querySelectorAll(".taxmount").forEach(el => {
    if (!el.shadowRoot) mountTaxTracker(el);
  });
}).observe(document.body, {childList: true, subtree: true});
