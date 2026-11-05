// ---- Paediatric drug sheet (weight-based) ----
// d:[lo,hi] dose per kg; u: unit; max: max single dose (same unit); c: concentration per mL (same unit) with prep label cl
// neo: per-kg dose for neonates; fn(w,ageM) returns {per,label,fixed} for age-dependent doses; src: "R" = RCUK 2026, otherwise APA 2023 guide
/*@@PAED_RCUK_WT@@*/
/*@@PAED_SECS@@*/
// Age-dependent paediatric dose rules; a row in PAED_SECS.json names its rule in "fn". fn(w,ageM) returns {per,label,fixed}.
const PAED_RULES={
 adenosine:(w,m)=>m==null?{per:[100,150],label:"100 µg/kg (1–11 years); 150 µg/kg (under 1 year)"}:m<12?{per:[150],label:"150 µg/kg under 1 year"}:m<144?{per:[100],label:"100 µg/kg, 1–11 years"}:{fixed:3000,label:"3 mg, 12–17 years"},
 salbutamolNeb:(w,m)=>m==null?{label:"2.5 mg under 5 years; 5 mg over 5"}:{fixed:m<60?2.5:5,label:m<60?"Under 5 years":"5 years and over"},
 salbutamolIV:(w,m)=>m==null?{per:[5,15],label:"5 µg/kg under 2 years; 15 µg/kg over 2"}:{per:[m<24?5:15],label:(m<24?"5":"15")+" µg/kg"+(m<24?", under 2 years":", 2 years and over")}
};
PAED_SECS.forEach(s=>s.rows.forEach(r=>{if(typeof r.fn==="string")r.fn=PAED_RULES[r.fn]}));
function paedWeightFromAge(m){const T=PAED_RCUK_WT;if(m<=0)return T[0][1];for(let i=1;i<T.length;i++)if(m<=T[i][0]){const[a,wa]=T[i-1],[b,wb]=T[i];return wa+(wb-wa)*(m-a)/(b-a)}return 70}
function paedFmt(x){if(x>=100)return String(Math.round(x));if(x>=10)return String(Math.round(x*10)/10);if(x>=1)return String(Math.round(x*100)/100);return String(Math.round(x*1000)/1000)}
function paedUnit(v,u){if(u==="µg"&&v>=1000)return[v/1000,"mg"];if(u==="mg"&&v>=1000)return[v/1000,"g"];return[v,u]}
function paedRow(r,w,ageM){
  let per=r.d,label="",fixed=null;
  const mx=r.max?` (max ${paedFmt(paedUnit(r.max,r.u)[0])} ${paedUnit(r.max,r.u)[1]})`:"";
  const unitkg=r.u.replace("/min","")+"/kg"+(r.u.endsWith("/min")?"/min":"");
  if(r.par){per=w<=10?[10]:w<=50?[15]:null;fixed=w>50?1000:null;label=w<=10?"10 mg/kg (max 30 mg/kg/day)":w<=50?"15 mg/kg (max 60 mg/kg/day)":"1 g (max 4 g/day)"}
  else if(r.fn){const o=r.fn(w,ageM);per=o.per||null;fixed=o.fixed??null;label=o.label+(per?mx:"")}
  else{if(r.neo&&ageM!=null&&ageM<1)per=[r.neo];label=per.join("–")+" "+unitkg+mx}
  if(!per&&fixed==null)return `<tr><th scope="row">${r.n}<small>${label}</small></th><td></td><td></td><td>${r.g||""}</td></tr>`;
  const vals=per?per.map(p=>Math.min(p*w,r.max||Infinity)):[fixed];
  const capped=per&&r.max&&per.some(p=>p*w>r.max);
  const dose=vals.map(v=>paedUnit(v,r.u)).map(([v,u])=>paedFmt(v)+" "+u);
  const doseTxt=dose.length>1&&dose[0].split(" ")[1]===dose[1].split(" ")[1]?dose[0].split(" ")[0]+"–"+dose[1]:dose.join("–");
  const vf=x=>x>=10?String(Math.round(x)):x>=1?String(Math.round(x*10)/10):String(Math.round(x*100)/100);
  const vol=r.c?vals.map(v=>vf(v/r.c)).join("–")+" mL":"";
  return `<tr><th scope="row">${r.n}<small>${label}${r.src==="R"?" · RCUK":""}</small></th><td><b>${doseTxt}</b>${capped?' <em class="pcap">max</em>':""}</td><td>${vol?`${vol}<small>of ${r.cl}</small>`:""}</td><td>${r.g||""}</td></tr>`;
}
function paedEquip(w,ageM){
  const y=ageM==null?null:ageM/12,out=[];
  if(y!=null){
    if(y>=1){const cuf=Math.floor((y/4+3.5)*2)/2,unc=Math.floor((y/4+4)*2)/2;out.push(["Tracheal tube (ID)",`Cuffed ${cuf.toFixed(1)} mm · uncuffed ${unc.toFixed(1)} mm`,"Cuffed age/4 + 3.5; uncuffed age/4 + 4. Have half a size either side ready. Cuff pressure under 20 cmH₂O"]);
      out.push(["Tube length",`Oral ${Math.round(y/2+12)} cm · nasal ${Math.round(y/2+15)} cm`,"At the lips or nostril: age/2 + 12 (oral) or + 15 (nasal)"]);}
    else{const unc=w<2?"2.5":w<4?"3.0":ageM<3?"3.5":"4.0";
      out.push(["Tracheal tube (ID)",`Uncuffed ${unc} mm${w>=3?` · cuffed ${ageM<3?"3.0":"3.0–3.5"} mm`:""}`,"Uncuffed: 2.5 under 2 kg, 3.0 for 2–4 kg, 3.5 term neonate, 4.0 from 3 months to 1 year. Aim for a small leak"]);
      out.push(["Tube length",w<=4.5?`Oral about ${Math.round(6+w)} cm at the lips`:"Oral about 11–12 cm at the lips",w<=4.5?"Neonates: 6 + weight (kg)":"Check by auscultation, and a chest X-ray if staying intubated"]);}
    out.push(["Laryngoscope blade",y<1?"Straight":"Curved (Macintosh)","Straight blade under 1 year, curved over 1 year"]);
  }
  const lma=w<5?"1":w<10?"1.5":w<20?"2":w<30?"2.5":w<50?"3":w<=90?"4":"5";
  const ig=w<5?"1":w<12?"1.5":w<25?"2":w<35?"2.5":w<60?"3":"4";
  out.push(["Laryngeal mask",`LMA ${lma} · i-gel ${ig}`,"LMA: 1 under 5 kg, 1.5 5–10, 2 10–20, 2.5 20–30, 3 30 kg to small adult, 4 average adult, 5 over 90 kg. i-gel: 1 2–5 kg, 1.5 5–12, 2 10–25, 2.5 25–35, 3 30–60, 4 50–90"]);
  out.push(["Tidal volume",`${Math.round(7*w)}–${Math.round(8*w)} mL`,"7–8 mL/kg at all ages"]);
  const mt=w<=10?4*w:w<=20?40+2*(w-10):Math.min(60+(w-20),100);
  out.push(["Maintenance fluid",`${Math.round(mt)} mL/h`,"4-2-1 rule: 4 mL/kg/h for the first 10 kg, 2 for the next 10, 1 for each kg above 20. Fasting deficit = hourly rate × hours fasted"]);
  const ebvk=ageM==null?null:ageM<1?90:ageM<36?80:70;
  if(ebvk)out.push(["Circulating blood volume",`About ${Math.round(ebvk*w)} mL`,`${ebvk} mL/kg (premature 100, neonate 90, toddler 80, school age and older 70)`]);
  out.push(["Red cells",`${Math.round(4*w)} mL per 10 g/L rise`,"4 mL/kg raises Hb by about 10 g/L"]);
  out.push(["Fasting","Clear 1 h · breast milk 3 h · formula 4 h · food 6 h","Minimum times; encourage clear fluids up to 1 h before"]);
  return out;
}
function paedAnaph(ageM){
  const rows=[["Under 6 months","100–150 µg (0.1–0.15 mL)","5 µg (0.5 mL)"],["6 months to 6 years","150 µg (0.15 mL)","10 µg (1 mL)"],["6 to 12 years","300 µg (0.3 mL)","25 µg (2.5 mL)"],["Over 12 years","500 µg (0.5 mL)","50 µg (5 mL)"]];
  const k=ageM==null?-1:ageM<6?0:ageM<72?1:ageM<144?2:3;
  return `<table class="ptab"><thead><tr><th>Age</th><th>IM, 1 in 1,000</th><th>IV under anaesthesia, 1 in 100,000 (10 µg/mL)</th></tr></thead><tbody>${rows.map((r,i)=>`<tr${i===k?' class="phit"':""}><th scope="row">${r[0]}</th><td><b>${r[1]}</b></td><td>${r[2]}</td></tr>`).join("")}</tbody></table><p class="note">Repeat IM after 5 min if needed. Give IV boluses by response (about 1 µg/kg); start an infusion after 3 boluses. Fluid bolus 10 mL/kg, repeated as needed.</p>`;
}
function openPaedDrugs(){
  L=null;sheet.className="sheet";sheet.style.cssText=col("c4");showPage();
  let saved={};try{saved=JSON.parse(localStorage.getItem("pw-paedwt")||"{}")}catch(e){}
  sheet.innerHTML=`<div class="sh-head"><button class="close" aria-label="Back to path">← Path</button><div class="sh-title">Drugs</div></div><div class="sh-body"><div class="page drugs paeds">
  <div class="dtabs" role="tablist"><button role="tab" aria-selected="false" data-dtab="adult">Adult drugs</button><button role="tab" aria-selected="true" data-dtab="paeds">Paeds drugs</button></div><h3>Paediatric drug sheet</h3>
  <p class="note dwarn">For education only. Check every dose against the BNFC, your hospital's paediatric drug chart and local protocols before giving it. Never exceed the adult dose. Neonates (up to 44 weeks post-conceptual age) and ex-premature infants often need different doses, so use neonatal guidance for them.</p>
  <div class="pform">
   <label>Age<span><input id="pa" type="number" min="0" max="18" step="any" inputmode="decimal" placeholder="e.g. 4"><select id="pu"><option value="y">years</option><option value="m">months</option></select></span></label>
   <label>Weight (kg)<span><input id="pw" type="number" min="0.5" max="80" step="any" inputmode="decimal" placeholder="kg"></span></label>
  </div>
  <p class="tl-intro" id="pinfo"></p>
  <div id="pout"></div></div></div>`;
  const a=sheet.querySelector("#pa"),u=sheet.querySelector("#pu"),wi=sheet.querySelector("#pw"),out=sheet.querySelector("#pout"),info=sheet.querySelector("#pinfo");
  if(saved.a!=null)a.value=saved.a;if(saved.u)u.value=saved.u;if(saved.w!=null)wi.value=saved.w;
  const render=()=>{
    const av=parseFloat(a.value),wv=parseFloat(wi.value);
    const ageM=isNaN(av)?null:(u.value==="y"?av*12:av);
    let w=wv>0?wv:(ageM!=null?paedWeightFromAge(ageM):null);
    try{localStorage.setItem("pw-paedwt",JSON.stringify({a:isNaN(av)?null:av,u:u.value,w:isNaN(wv)?null:wv}))}catch(e){}
    if(!w){info.textContent="Enter an age, a weight, or both. A measured weight is always better than an estimate.";out.innerHTML="";return}
    w=Math.round(w*10)/10;
    info.innerHTML=wv>0?`Doses for <b>${w} kg</b>.`:`Estimated weight <b>${w} kg</b> from age (RCUK table). Weigh the child if you can.`;
    if(w>50)info.innerHTML+=" Over 50 kg, adult doses usually apply.";
    let h=`<section class="psec"><h4>Equipment, ventilation and fluids</h4><table class="ptab"><tbody>${paedEquip(w,ageM).map(r=>`<tr><th scope="row">${r[0]}</th><td><b>${r[1]}</b></td><td colspan="2">${r[2]}</td></tr>`).join("")}</tbody></table>${ageM==null?'<p class="note">Add an age for tube size and length, laryngoscope blade and blood volume.</p>':""}</section>`;
    PAED_SECS.forEach((S,i)=>{h+=`<section class="psec"><h4>${S.s}</h4><table class="ptab"><thead><tr><th>Drug</th><th>Dose</th><th>Volume</th><th>Notes</th></tr></thead><tbody>${S.rows.map(r=>paedRow(r,w,ageM)).join("")}</tbody></table>${S.note?`<p class="note">${S.note}</p>`:""}`;
      if(i===0)h+=`<p class="subh">Anaphylaxis: adrenaline by age</p>${paedAnaph(ageM)}`;
      h+=`</section>`});
    const ON=new Set(["Adrenaline", "Amiodarone", "Atropine", "Adenosine", "Glucose", "Calcium chloride", "Calcium gluconate", "Magnesium", "Lipid emulsion", "Hydrocortisone", "Propofol", "Ketamine", "Thiopental", "Fentanyl", "Alfentanil", "Suxamethonium", "Rocuronium", "Atracurium", "Glycopyrronium", "Paracetamol", "Ibuprofen", "Diclofenac", "Morphine", "Clonidine", "Ondansetron", "Dexamethasone", "Cyclizine", "Neostigmine", "Sugammadex", "Naloxone", "Flumazenil", "Bupivacaine", "Levobupivacaine", "Lidocaine", "Ropivacaine", "Midazolam", "Lorazepam", "Levetiracetam", "Phenytoin", "Salbutamol", "Aminophylline", "Dexmedetomidine", "Noradrenaline", "Remifentanil", "Tranexamic acid"]);
    const extra=DRUGS.filter(d=>!ON.has(d.n.split(" (")[0].replace(/ \d+(\.\d+)?%$/,"").replace(" sulphate",""))&&d.p&&d.p!=="—");
    h+=`<details class="psec pmore"><summary><h4>More drugs, A to Z</h4><span>${extra.length} drugs not on the sheet above, as per-kg or age-banded doses</span></summary>${extra.map(d=>`<div class="pmrow"><b>${d.n}</b><span>${d.p}</span></div>`).join("")}</details>`;
    h+=`<p class="note">Sources: Association of Paediatric Anaesthetists of Great Britain and Ireland, <i>Anaesthesia for beginners</i> (APA guide, 2023), for most doses, equipment and fluids. Premedication doses are from your own notes. Doses marked RCUK, and the age-based weight estimate, follow Resuscitation Council UK paediatric emergency resources (2026). Lipid emulsion follows the Association of Anaesthetists local anaesthetic toxicity guideline. The A to Z list follows the BNFc. Summarised in our own words.</p>`;
    out.innerHTML=h;
  };
  [a,u,wi].forEach(x=>x.addEventListener("input",render));render();
  sheet.querySelector(".close").addEventListener("click",close);
  sheet.querySelector('[data-dtab="adult"]').addEventListener("click",openDrugs);
}
document.getElementById("drugsBtn").addEventListener("click",openDrugs);
document.getElementById("forumBtn").addEventListener("click",openForum);
