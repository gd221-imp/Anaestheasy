const ICONS={
 tip:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z"/>',
 interview:'<path d="M4 4h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-6l-4 3.5V14H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M20 9a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v3l-3.5-3H12"/>',
 recipe:'<path d="M17 3l4 4M19 5l-3 3M16 8l-9 9-3.5.5L4 14l9-9zM10 8l2 2M7.5 10.5l2 2M3 21l1.5-3.5"/>',
 exam:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
 crown:'<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/><path d="M5 19h14"/>',
 money:'<circle cx="12" cy="12" r="9.5"/><path d="M14.6 8.6a2.6 2.6 0 0 0-5.1.6c0 3 1.2 3.8 0 6.8h5.9M8.4 12.6h4.6"/>',
 ecg:'<path d="M2 12h5l2-5 3 10 2.5-7 1.5 2h6"/>'
};
const KIND={tip:"Tips of the trade",interview:"Recruitment",recipe:"Anaesthetic recipe",exam:"Exam",crown:"Milestone",money:"Finances"};
const XP={tip:1,interview:1,recipe:1,exam:3,crown:1,money:1};const STAGE_BONUS=5;
const stageBonus=st=>{const d=doneSet();return !d.has(st.id)&&st.stage.stops.every(x=>x===st||d.has(x.id))?STAGE_BONUS:0};

// Primary FRCA topics imported from the UK Specialty Exam Aid app
/*@@PRIMARY@@*/
// Stage 2 stops imported from the UK Specialty Exam Aid app (Final FRCA chapters)
/*@@IMPORTED@@*/
/*@@SBA_BANK@@*/
/*@@PSBA_BANK@@*/
const PSBA_TP={};PSBA_BANK.forEach(q=>(PSBA_TP[q.tp]=PSBA_TP[q.tp]||[]).push(q));
const SBA_BY={};SBA_BANK.forEach(q=>{const k=q.st;if(k&&!/^(core|found)-/.test(k))(SBA_BY[k]=SBA_BY[k]||[]).push(q)});
/*@@COMP_CARD@@*/
/*@@EXP_CARD_B@@*/
const expCard=st=>({h:"Professional expenses",b:EXP_CARD_B.replace('<div class="expmount"></div>',`<div class="expmount" data-exams="${st}"></div>`)});
const EXP_CARD=expCard("");
/*@@LOCUM_CARD@@*/
/*@@TAX_CARD@@*/
/*@@FELLOW_CARD@@*/
/*@@JOBS_CARD@@*/
/*@@STAGES@@*/

const SHAPES={
 heart:{done:"heart",d:"M40 76C20 62 3 48 3 29 3 15 13 6 24 6c8 0 13 5 16 11 3-6 8-11 16-11 11 0 21 9 21 23 0 19-17 33-37 47z",
  icon:()=>`<path d="M14 36h13l4-9 6 19 5-13 3 5h21"/>`},
 brain:{done:"brain",d:"M40 14C35 6 22 6 18 14 9 14 4 22 7 30 2 36 3 46 10 50 9 60 18 68 28 65 31 72 37 72 40 68 43 72 49 72 52 65 62 68 71 60 70 50 77 46 78 36 73 30 76 22 71 14 62 14 58 6 45 6 40 14Z",
  icon:()=>`<path d="M40 16v50M26 26c6 2 8 8 5 14M54 26c-6 2-8 8-5 14M20 48c7-2 12 2 12 9M60 48c-7-2-12 2-12 9"/>`},
 lung:{done:"lung",d:"M36.5 4h7v22h-7zM35 28c0-7-6-9-12-5C11 31 5 48 5 63c0 9 6 13 14 11 10-2 16-8 16-18zM45 28c0-7 6-9 12-5 12 8 18 25 18 40 0 9-6 13-14 11-10-2-16-8-16-18z",
  icon:()=>`<path d="M40 22v10M40 32l-9 9M40 32l9 9"/>`},
 mon:{done:"mon",d:"M10 8h60a7 7 0 0 1 7 7v42a7 7 0 0 1-7 7H10a7 7 0 0 1-7-7V15a7 7 0 0 1 7-7zM32 64h16l4 12H28z",
  icon:()=>`<path d="M10 38h12l4-10 6 20 5-14 3 4h30"/><path d="M58 18h8" stroke-width="2.5"/>`},
 uss:{done:"uss",d:"M15 4h50a6 6 0 0 1 6 6v32a6 6 0 0 1-6 6H15a6 6 0 0 1-6-6V10a6 6 0 0 1 6-6zM25 48h30v20H25zM16 68h48a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3H16a3 3 0 0 1-3-3v-3a3 3 0 0 1 3-3z",
  icon:()=>`<path d="M40 12L27 36a20 20 0 0 0 26 0z"/><path d="M33 56h14" stroke-width="2.5"/>`},
 face:{done:"face",d:"M40 4a37 37 0 1 1 0 74a37 37 0 1 1 0-74z",
  icon:st=>`<circle cx="28" cy="32" r="2.5" fill="currentColor"/><circle cx="52" cy="32" r="2.5" fill="currentColor"/>${st==="done"?`<path d="M26 48c8 9 20 9 28 0"/>`:`<path d="M26 56c8-9 20-9 28 0"/>`}`},
 belly:{done:"belly",d:"M50 2a10 10 0 1 1 0 20a10 10 0 1 1 0-20zM43 24H59c4 0 7 3 7 7V80H36V70C21 68 12 60 12 49 12 39 22 33 33 33 38 32 41 29 43 24Z",
  icon:()=>`<path d="M30 50c0-3 4-4 5-1 1-3 5-2 5 1 0 3-5 6-5 6s-5-3-5-6z" fill="currentColor" stroke="none"/><circle cx="20" cy="54" r="2" fill="currentColor" stroke="none"/>`},
 drop:{done:"drop",d:"M40 4C30 20 10 40 10 56a30 30 0 0 0 60 0C70 40 50 20 40 4z",
  icon:()=>`<path d="M22 60h10l4-9 6 16 5-11 3 4h8"/>`},
 clip:{done:"clip",rule:"nonzero",d:"M14 12h52a6 6 0 0 1 6 6v58a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6zM28 4h24a4 4 0 0 1 4 4v10H24V8a4 4 0 0 1 4-4z",
  icon:()=>`<path d="M20 36l4 4 7-7M20 54l4 4 7-7M38 37h20M38 55h20"/>`},
 scalpel:{done:"scalpel",rule:"nonzero",d:"M4 74L42 36l10 10L14 84a7 7 0 0 1-10-10zM42 36C52 20 64 10 77 4c-3 14-11 28-25 42z",
  icon:()=>`<path d="M14 72l20-20"/>`},
 kidney:{done:"kidney",d:"M42 6C22 6 8 22 8 44s14 38 34 38c12 0 18-9 14-18-3-7-10-11-10-20s7-13 10-20C60 15 54 6 42 6z",
  icon:()=>`<path d="M48 40c8 0 12 6 12 14v24"/>`},
 bone:{done:"bone",rule:"nonzero",d:"M18 6a10 10 0 0 1 13 6 10 10 0 1 1 6 16L56 52a10 10 0 1 1 12 14 10 10 0 1 1-14 12 10 10 0 0 1-6-12L28 40A10 10 0 1 1 18 6z",
  icon:()=>``},
 cross:{done:"cross",d:"M30 6h20a4 4 0 0 1 4 4v18h18a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H54v18a4 4 0 0 1-4 4H30a4 4 0 0 1-4-4V56H8a4 4 0 0 1-4-4V32a4 4 0 0 1 4-4h18V10a4 4 0 0 1 4-4z",
  icon:()=>``},
 headn:{done:"headn",d:"M44 4C24 4 12 18 12 36c0 8 2 13 5 18l-7 12h9v8c0 4 3 7 7 7h9v5h30V64c7-6 11-16 11-28C76 18 62 4 44 4z",
  icon:()=>`<path d="M46 30c7 0 10 5 9 10-1 4-5 5-5 9"/>`},
 plaster:{done:"plaster",d:"M8 56L52 12a14 14 0 0 1 20 20L28 76A14 14 0 0 1 8 56z",
  icon:()=>`<rect x="30" y="30" width="20" height="20" rx="3" transform="rotate(45 40 40)"/><circle cx="22" cy="58" r="1.5" fill="currentColor"/><circle cx="58" cy="22" r="1.5" fill="currentColor"/>`},
 eye:{done:"eye",d:"M2 44C14 22 28 14 40 14s26 8 38 30C66 66 52 74 40 74S14 66 2 44z",
  icon:()=>`<circle cx="40" cy="44" r="13"/><circle cx="40" cy="44" r="5" fill="currentColor"/>`},
 warn:{done:"warn",d:"M33 10a8 8 0 0 1 14 0l30 56a8 8 0 0 1-7 12H10a8 8 0 0 1-7-12z",
  icon:()=>`<path d="M40 34v20"/><circle cx="40" cy="64" r="2.5" fill="currentColor"/>`},
 star:{done:"star",d:"M40 4l11 23 25 3-18 18 5 25-23-12-23 12 5-25L4 30l25-3z",
  icon:()=>``},
 dummy:{done:"dummy",d:"M8 36C8 23 25 19 40 25 55 19 72 23 72 36 72 49 55 53 40 47 25 53 8 49 8 36zM40 52a14 14 0 1 1 0 28a14 14 0 1 1 0-28zM40 58a8 8 0 1 0 0 16a8 8 0 1 0 0-16z",
  icon:()=>`<circle cx="40" cy="36" r="5" fill="currentColor" stroke="none"/>`}
};
// sample workplace-based assessments
/*@@WPBA@@*/
// anaesthetic recipe tab for operation stops
/*@@RECIPES@@*/
// A note with the same title as an operation stop shows that stop's own recipe and WPBA cards (one source each,
// in the stop's cards/ folder). content/recipes and content/wpba hold only those with no operation stop.
const OP_BY_TITLE={};STAGES.forEach(sg=>sg.stops.forEach(st=>{if(!st.note&&st.cards.some(c=>c.recipe))OP_BY_TITLE[st.title]=st}));
STAGES.forEach(sg=>sg.stops.forEach(st=>{if(st.cards.some(c=>c.recipe))return;
  const op=st.note&&OP_BY_TITLE[st.title],r=RECIPES[st.title];
  const card=op?op.cards.find(c=>c.recipe):r?{h:"Anaesthetic recipe",b:r,recipe:true}:null;if(!card)return;
  const i=st.cards.findIndex(c=>c.h==="Further reading");
  if(i>=0)st.cards.splice(i,0,card);else st.cards.push(card);
  const w=op?op.cards.find(c=>c.wpba):WPBA[st.title]?{h:"Sample WPBA",b:WPBA[st.title],wpba:true}:null;if(w){const j=st.cards.indexOf(card);st.cards.splice(j+1,0,w)}}));
// link Primary FRCA topics into core training stops
(()=>{const core=STAGES.find(x=>x.id==="core");
  for(const [title,keys] of Object.entries(PRIMARY.map)){const st=core.stops.find(x=>x.title===title);if(st)st.cards.push({h:"Revise for the Primary",links:keys})}
  const w=core.stops.find(x=>x.title==="Primary FRCA: written");
  if(w)for(const [ch,keys] of Object.entries(PRIMARY.syllabus))w.cards.push({h:ch,links:keys});
})();
function linksHTML(keys){
  const anyStop=keys.some(k=>k.startsWith("stop:")),anyCur=keys.some(k=>k.startsWith("curric:"));
  return `<p class="tl-intro">${anyCur?"RCoA curriculum domains for this operation. Tap one to open it.":anyStop?"Notes from your Exam Aid app. Tap one to read it.":"Primary FRCA notes from your Exam Aid app. Tap a topic to read it."}</p><div class="tlinks">${keys.map(k=>{
    if(k.startsWith("curric:")){const n=+k.slice(7),dm=CURRIC_DOMAINS.find(x=>x.n===n);if(!dm)return "";return `<button class="tlink" data-opencurric="${n}"><span>Domain ${n}: ${dm.t}</span><em>RCoA 2021 curriculum</em></button>`}
    if(k.startsWith("stop:")){const t=k.slice(5),st=STAGES.flatMap(x=>x.stops).find(x=>x.title===t)||findNote(t);if(!st)return "";
      return `<button class="tlink" data-openstop="${encodeURIComponent(t)}"><span>${t}</span><em>${st.note?"Final FRCA note":st.op?"Operation":"Final FRCA"} · ${st.group||st.stage.name}</em></button>`}
    const [key,hint]=k.split("|"),t=PRIMARY.topics[key];return `<button class="tlink" data-topic="${key}"><span>${t.n}${hint?`<small class="thint">${hint}</small>`:""}</span><em>Primary · ${t.c}</em></button>`}).join("")}</div>`;
}
// notes: topic stops that sit behind operation stops instead of on the path
const NOTES=[];
STAGES.forEach(sg=>{sg.stops=sg.stops.filter(st=>{if(st.note){st.stage=sg;NOTES.push(st);return false}return true})});
NOTES.forEach((n,i)=>n.id="note-"+i);
const findNote=t=>NOTES.find(x=>x.title===t);
const findTopic=t=>findNote(t)||STAGES.flatMap(x=>x.stops).find(x=>x.title===t&&!x.op);
const topicSections=n=>n.cards.map(c=>`<section class="nsec"><h4 class="nh">${c.h}</h4>${c.wpba?"":c.b||""}${c.links?linksHTML(c.links):""}${c.after||""}</section>`).join("");
// flatten
const ALL=[];
// every stop has a fixed id in its source (stop.json or the stage file); saved progress and SBA links depend on it
const STOP_ID_MISSING=[];
STAGES.forEach(s=>s.stops.forEach((st,i)=>{st.stage=s;if(!st.id){st.id="tmp-"+s.id+"-"+i;STOP_ID_MISSING.push(st.title)}}));
/*@@PREOP_STOP@@*/
STAGES.forEach(s=>{if(s.id!=="core")return;const k=s.stops.findIndex(st=>st.title==="The IAC");if(k<0||s.stops.some(st=>st.title===PREOP_STOP.title))return;
  PREOP_STOP.stage=s;PREOP_STOP.id="core-preop";s.stops.splice(k+1,0,PREOP_STOP)});
/*@@NEW_STOPS@@*/
NEW_STOPS.forEach(n=>{const s=STAGES.find(x=>x.id===n.stage);if(!s||s.stops.some(st=>st.title===n.stop.title))return;
  const k=s.stops.findIndex(st=>st.title===n.after);const st=n.stop;st.stage=s;st.id=n.id;s.stops.splice(k<0?s.stops.length:k+1,0,st)});
STAGES.forEach(s=>s.stops.forEach(st=>ALL.push(st)));
const subsOf=st=>[...st.cards.map((c,i)=>({id:String(i),name:c.h,type:"card",c})),...(sbaSet(st).length?[{id:"q",name:`SBAs (${sbaSet(st).length})`,type:"quiz"}]:[]),...(st.title==="Final FRCA: written"?[{id:"sbabank",name:`SBA bank (${SBA_BANK.length})`,type:"quiz",opt:true}]:[]),...(st.title==="Primary FRCA: written"?[{id:"psbabank",name:`Primary SBA bank (${PSBA_BANK.length})`,type:"quiz",opt:true}]:[])];
const reqSubs=subs=>subs.filter(x=>!x.opt);
const PSBA_BY={};ALL.forEach(st=>{if(st.title==="Primary FRCA: written")return;const ks=new Set();st.cards.forEach(c=>{if(c.primaryRef)ks.add(c.primaryRef);(c.links||[]).forEach(x=>{if(!x.startsWith("stop:")&&!x.startsWith("curric:"))ks.add(x.split("|")[0])})});const qs=[...ks].flatMap(k=>PSBA_TP[k]||[]);if(qs.length)PSBA_BY[st.id]=qs});
const sbaSet=st=>{if(st._sba)return st._sba;const early=st.stage.id==="found"||st.stage.id==="core";
  const qc=st.q.map((q,i)=>({...q,g:early?"p":"f",qc:1})),p=(PSBA_BY[st.id]||[]).map(q=>({...q,g:"p"})),f=(SBA_BY[st.id]||[]).map(q=>({...q,g:"f"}));
  return st._sba=[...qc.filter(q=>q.g==="p"),...p,...qc.filter(q=>q.g==="f"),...f]};
const sbaSteps=(st,flt)=>[...sbaSet(st).filter(q=>!flt||flt==="all"||q.g===flt).map(q=>({type:"q",q})),{type:"res"}];
const BANKS={sbabank:{list:SBA_BANK,title:"Final FRCA SBA bank",kind:"SBA bank · Final FRCA written",chap:"Topic",note:"Questions linked to an operation or topic also appear in that stop's \"SBAs\" tab."},psbabank:{list:PSBA_BANK,title:"Primary FRCA SBA bank",kind:"SBA bank · Primary FRCA written",chap:"Chapter",note:"Two questions per Primary topic. They also appear in the \"SBAs\" tab of linked stops, and each topic page has its own practice button."}};

