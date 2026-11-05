/*@@DRUGS@@*/
function openDrugs() {
  L = null;
  sheet.className = "sheet";
  sheet.style.cssText = col("c4");
  showPage();
  const letters = [...new Set(DRUGS.map(d => d.n[0].toUpperCase()))];
  const row = (d, i) =>
    `<details class="drug" data-i="${i}"><summary><b>${d.n}</b><small>${d.c}</small></summary><dl>${d.r ? `<dt>Comes as</dt><dd>${d.r}</dd>` : ""}<dt>Dose</dt><dd>${d.a}</dd><dt>How to give</dt><dd>${d.g}</dd>${d.x ? `<dt>Notes</dt><dd>${d.x}</dd>` : ""}</dl></details>`;
  let h = `<div class="sh-head"><button class="close" aria-label="Back to path">← Path</button><div class="csearch"><input id="dq" type="search" placeholder="Search drugs, classes or uses" aria-label="Search drugs" autocomplete="off"></div></div><div class="sh-body"><div class="page drugs"><div class="dtabs" role="tablist"><button role="tab" aria-selected="true" data-dtab="adult">Adult drugs</button><button role="tab" aria-selected="false" data-dtab="paeds">Paeds drugs</button></div><h3>Drug doses</h3><p class="note dwarn">For education only. Doses are typical adult doses (about 70 kg); children's doses are on the Paeds drugs tab. Always check the BNF, Medusa or your local injectable medicines guide, and local protocols before giving any drug.</p><p class="tl-intro" id="dinfo">${DRUGS.length} drugs. Tap a drug to see its doses.</p><nav class="dletters" aria-label="Jump to letter">${letters.map(l => `<button data-dl="${l}">${l}</button>`).join("")}</nav>`;
  let cur = "";
  DRUGS.forEach((d, i) => {
    const l = d.n[0].toUpperCase();
    if (l !== cur) {
      h += `${cur ? "</div>" : ""}<div class="dgrp" id="dl-${l}"><h4>${l}</h4>`;
      cur = l;
    }
    h += row(d, i);
  });
  h += `</div><p class="note" id="dnone" hidden>No drugs match that search.</p></div></div>`;
  sheet.innerHTML = h;
  const q = sheet.querySelector("#dq"),
    body = sheet.querySelector(".sh-body");
  q.addEventListener("input", () => {
    const s = q.value.trim().toLowerCase();
    let n = 0;
    sheet.querySelectorAll(".drug").forEach(el => {
      const d = DRUGS[+el.dataset.i];
      const hit = !s || (d.n + " " + d.c + " " + (d.k || "")).toLowerCase().includes(s);
      el.hidden = !hit;
      if (hit) n++;
      if (s && hit && d.n.toLowerCase().startsWith(s)) el.open = true;
    });
    sheet.querySelectorAll(".dgrp").forEach(g => (g.hidden = ![...g.querySelectorAll(".drug")].some(x => !x.hidden)));
    sheet.querySelector("#dinfo").textContent = s
      ? `${n} match${n === 1 ? "" : "es"}`
      : `${DRUGS.length} drugs. Tap a drug to see its doses.`;
    sheet.querySelector("#dnone").hidden = n > 0;
  });
  sheet.querySelectorAll("[data-dl]").forEach(b =>
    b.addEventListener("click", () => {
      const g = sheet.querySelector("#dl-" + b.dataset.dl);
      if (g) body.scrollTop = g.offsetTop - body.offsetTop - 8;
    })
  );
  sheet.querySelector('[data-dtab="paeds"]').addEventListener("click", openPaedDrugs);
  sheet.querySelector(".close").addEventListener("click", close);
  q.focus();
}
