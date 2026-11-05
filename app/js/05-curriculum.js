// FRCA curriculum page (RCoA 2021 Curriculum for a CCT in Anaesthetics)
/*@@CURRIC_STAGES@@*/
/*@@CURRIC_DOMAINS@@*/
/*@@CURRIC_SIAS@@*/
/*@@CURRIC_KC@@*/
function openCurriculum(){
  L=null;sheet.className="sheet";sheet.style.cssText=col("c4");showPage();
  let h=`<div class="sh-head"><button class="close" aria-label="Back to path">← Path</button><div class="sh-title">FRCA curriculum</div></div><div class="sh-body"><div class="page curric">
  <div class="kind">RCoA 2021 Curriculum for a CCT in Anaesthetics</div><h3>The curriculum</h3>
  <p>Training runs in three stages. Fourteen domains of learning run through every stage: the high-level outcome for each stays the same, while the key capabilities expected at each stage become more advanced.</p>
  <div class="cstages">${CURRIC_STAGES.map(c=>{const sg=STAGES.find(x=>x.id===c.stage);return `<div class="cstagecard" style="${col(sg.c)}"><b>${c.n}</b><span>${c.g}</span><p>${c.d}</p></div>`}).join("")}</div>`;
  ["Generic professional","Clinical"].forEach(k=>{
    h+=`<h4>${k} domains</h4>`;
    CURRIC_DOMAINS.filter(d=>d.k===k).forEach(d=>{
      h+=`<details class="cdom" id="cdom-${d.n}"><summary><span class="cnum">${d.n}</span><span class="ctit">${d.t}</span></summary><div class="cdbody"><p><b>High-level outcome:</b> ${d.o}</p>${["1","2","3"].map(sn=>{const L=(CURRIC_KC[d.n]||{})[sn];return L?`<h5 class="ckch">Stage ${sn} key capabilities</h5><ul class="ckc">${L.map(([k,t])=>`<li><b>${k}</b> ${t}</li>`).join("")}</ul>`:""}).join("")}</div></details>`;
    });
  });
  h+=`<h4>Stage 3 special interest areas</h4><p class="tl-intro">In Stage 3 you choose special interest areas (SIAs) alongside your general training.</p>`;
  [["Clinical",CURRIC_SIAS.clinical],["Non-clinical",CURRIC_SIAS.nonclinical]].forEach(([k,list])=>{
    h+=`<h5>${k}</h5><div class="csia">${list.map(([n])=>`<div class="csiarow"><span>${n}</span></div>`).join("")}</div>`;
  });
  h+=`<p class="note">Domain outcomes and key capabilities are summarised in plain English; the letters match the RCoA syllabus. For the full key capabilities and stage syllabuses, see the <a href="https://rcoa.ac.uk/training-careers/training-hub/2021-curriculum/2021-curriculum-structure" target="_blank" rel="noopener">RCoA 2021 curriculum pages</a>.</p></div></div>`;
  sheet.innerHTML=h;
  sheet.querySelector(".close").onclick=close;
}
function goGroup(g){
  sheet.hidden=true;close();
  const el=document.querySelector(`.gsec[data-group="${CSS.escape(g)}"]`);
  if(el){el.scrollIntoView({block:"start",behavior:"smooth"});const f=el.querySelector(".stop");if(f){f.classList.remove("flash");void f.offsetWidth;f.classList.add("flash")}}
}
document.getElementById("curricBtn").addEventListener("click",openCurriculum);
