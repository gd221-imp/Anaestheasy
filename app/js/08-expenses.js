// ---- professional expenses: shared across every Finances stop; total feeds the 60% tax check ----
const EXP_GRADES=["FY1","FY2","CT1","CT2","CT3","ST4","ST5","ST6","ST7","Consultant"];
// BMA bands are by years since qualification (rates from 1 Oct 2026, monthly x 12); GMC from 1 Apr 2026
/*@@EXP_ITEMS@@*/
const EXP_DEF=()=>({grade:null,rate:null,on:{gmc:true,bma:false,rcoa:false,ficm:false,aoa:false,mdo:false},own:{},custom:[]});
let EXP=Object.assign(EXP_DEF(),store.get("pathway-expenses",{}));
const expGradeGuess=()=>{const cur=ALL[Math.min(currentIndex(),ALL.length-1)];const st=cur?cur.stage.id:"found";return {found:0,core:2,st2:5,st3:7,cons:9}[st]??0};
const expGrade=()=>EXP.grade!=null?EXP.grade:expGradeGuess();
const expRate=()=>EXP.rate!=null?EXP.rate:(expGrade()<=1?0.2:0.4);
const expAmt=(it,g)=>EXP.own[it.k]!=null?Number(EXP.own[it.k]):Math.round(it.amt[g]*100)/100;
function examSelfPaid(stage){const ex=EXP.exams||{},eng=EXP.england!==false;let t=0;(EXAMS[stage]||[]).forEach(e=>{const n=Math.max(0,parseInt(ex[e.k])||0);t+=(eng?Math.max(0,n-2):n)*e.f});return t}
function expTotal(stage){const g=expGrade();let t=examSelfPaid(stage);EXP_ITEMS.forEach(it=>{if(EXP.on[it.k])t+=expAmt(it,g)||0});EXP.custom.forEach(c=>{if(c.on)t+=Number(c.amt)||0});return Math.round(t*100)/100}
function expSave(){store.set("pathway-expenses",EXP);
  // feed the 60% tax check: professional fees relief for each tax year
  const curStage=(ALL[Math.min(currentIndex(),ALL.length-1)]||ALL[0]).stage.id;const tot=String(expTotal(curStage));["2026-27","2027-28"].forEach(y=>{const k="pathway-band-"+y;const cur=store.get(k,null)||{};cur.fees=tot;store.set(k,cur)});
  setTimeout(()=>document.querySelectorAll(".expmount").forEach(drawExp),0)}
const expGBP=v=>"£"+Number(v||0).toLocaleString("en-GB",{minimumFractionDigits:v%1?2:0,maximumFractionDigits:2});
/*@@EXAMS@@*/
function examHTML(stage){
  const L=EXAMS[stage];if(!L)return "";
  const ex=EXP.exams||{},eng=EXP.england!==false;
  let spent=0,back=0;
  const rows=L.map(e=>{const n=Math.max(0,parseInt(ex[e.k])||0);const fee=EXP.examFee&&EXP.examFee[e.k]!=null?Number(EXP.examFee[e.k]):e.f;spent+=n*fee;if(eng)back+=Math.min(n,2)*fee;
    return `<div class="exrow"><span></span><div class="exname"><b>${e.n}</b><small>£${fee} per sitting (RCoA)</small></div><div class="examt"><label style="font-size:12px;font-weight:700">Attempts <input type="number" min="0" max="9" inputmode="numeric" data-exatt="${e.k}" value="${n||""}" style="width:56px"></label></div></div>`}).join("");
  return `<h4>Exam costs</h4><p class="note">Royal College exam fees, including resits, are allowable if you're on a training programme leading to a CCT, as long as you pay them yourself. Any you pay yourself in this stage are added to the total above; they aren't carried into later stages.</p>${rows}
   <label class="exeng" style="display:flex;gap:8px;align-items:center;margin:6px 0;font-size:14px"><input type="checkbox" data-exeng ${eng?"checked":""} style="width:18px;height:18px;accent-color:var(--c)"> I'm a resident doctor in England (first 2 attempts of each exam reimbursed by your employer for exams from April 2026)</label>
   <div class="extot"><span>Exam fees paid</span><div class="big">${expGBP(spent)}</div>${eng?`<span>Reclaimable from your employer: <b>${expGBP(back)}</b>. Paid yourself and added to your tax relief: <b>${expGBP(spent-back)}</b>.</span>`:`<span>All of this is added to your tax relief total above.</span>`}</div>
   <p class="note">Booking the Primary OSCE and SOE together costs £775. Fees from the <a href="https://www.rcoa.ac.uk/examinations/primary-frca-examination/frca-primary-mcq-examination" target="_blank" rel="noopener">RCoA examination pages</a> for 2026/27 sittings; check before you apply.</p>`;
}
function drawExp(el){
  const stg=el.dataset.exams,g=expGrade(),r=expRate(),tot=expTotal(stg);
  const row=(id,on,name,desc,amt,custom)=>`<div class="exrow ${on?"":"off"}"><input type="checkbox" data-exon="${id}" ${on?"checked":""} aria-label="Include ${name}"><div class="exname"><b>${name}</b>${desc?`<small>${desc}</small>`:""}</div><div class="examt">£<input inputmode="decimal" data-examt="${id}" value="${amt||amt===0?amt:""}" aria-label="${name} amount">${custom?`<button class="exdel" data-exdel="${id}" aria-label="Remove ${name}">×</button>`:""}</div></div>`;
  const esc=t=>String(t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  el.innerHTML=`<div class="expw">
   <div class="exctl"><label>Your grade<select data-exgrade>${EXP_GRADES.map((x,i)=>`<option value="${i}" ${i===g?"selected":""}>${x}</option>`).join("")}</select></label>
   <label>Your top tax rate<select data-exrate>${[[0.2,"20% basic"],[0.4,"40% higher"],[0.6,"60% (£100k–£125k)"],[0.45,"45% additional"]].map(([v,t])=>`<option value="${v}" ${v===r?"selected":""}>${t}</option>`).join("")}</select></label></div>
   ${EXP_ITEMS.map(it=>row(it.k,!!EXP.on[it.k],it.n,it.d,expAmt(it,g))).join("")}
   ${EXP.custom.map((c,i)=>row("c"+i,!!c.on,esc(c.n),"",c.amt,true)).join("")}
   <div class="exadd"><input placeholder="Add another fee" data-exnew aria-label="Name of another fee"><button data-exaddbtn>Add</button></div>
   <div class="extot"><span>Total allowable fees this year${examSelfPaid(stg)?" (including this stage's exam fees you paid yourself)":""}</span><div class="big">${expGBP(tot)}</div><span>Tax relief worth about <b>${expGBP(Math.round(tot*r))}</b> a year at ${Math.round(r*100)}%.</span></div>
   <p class="note">Tick what you pay. Amounts update with your grade as you move along the path; type over any amount to use your own figure. The total is added to the 60% tax check as professional fees relief. Saved on this device only.</p>
   <button class="exreset" data-exreset>Reset amounts to defaults</button>${examHTML(el.dataset.exams)}</div>`;
  el.querySelector("[data-exgrade]").onchange=e=>{EXP.grade=+e.target.value;expSave()};
  el.querySelector("[data-exrate]").onchange=e=>{EXP.rate=+e.target.value;expSave()};
  el.querySelectorAll("[data-exon]").forEach(c=>c.onchange=()=>{const id=c.dataset.exon;if(id[0]==="c"&&/^c\d+$/.test(id))EXP.custom[+id.slice(1)].on=c.checked;else EXP.on[id]=c.checked;expSave()});
  el.querySelectorAll("[data-examt]").forEach(inp=>inp.onchange=()=>{const id=inp.dataset.examt,v=inp.value.replace(/[£,\s]/g,"");if(/^c\d+$/.test(id))EXP.custom[+id.slice(1)].amt=v;else{if(v==="")delete EXP.own[id];else EXP.own[id]=v}expSave()});
  el.querySelectorAll("[data-exdel]").forEach(b=>b.onclick=()=>{EXP.custom.splice(+b.dataset.exdel.slice(1),1);expSave()});
  const nw=el.querySelector("[data-exnew]");el.querySelector("[data-exaddbtn]").onclick=()=>{const n=nw.value.trim();if(!n)return;EXP.custom.push({n,amt:"",on:true});expSave()};
  el.querySelector("[data-exreset]").onclick=()=>{EXP.own={};expSave()};
  el.querySelectorAll("[data-exatt]").forEach(i=>i.onchange=()=>{EXP.exams=EXP.exams||{};EXP.exams[i.dataset.exatt]=i.value;expSave()});
  const en=el.querySelector("[data-exeng]");if(en)en.onchange=()=>{EXP.england=en.checked;expSave()};
}
new MutationObserver(()=>{document.querySelectorAll(".expmount:not([data-done])").forEach(el=>{el.dataset.done="1";drawExp(el)})}).observe(document.body,{childList:true,subtree:true});
