// sheet
const sheet=document.getElementById("sheet"),scrim=document.getElementById("scrim");
let L=null;
function openSub(stopId,subId){
  const st=ALL.find(s=>s.id===stopId),subs=subsOf(st);
  L={st,subs,locked:isLocked(st)};
  goSub(subs.findIndex(x=>x.id===subId));
  sheet.style.cssText=col(st.stage.c);sheet.className="sheet pat pat-"+st.stage.id;
  showPage();
  draw();
  sheet.querySelector(".close").focus();
}
function goSub(i){
  const sub=L.subs[i];
  Object.assign(L,{forum:false,i,sub,step:0,correct:0,win:false,tq:null,missed:[],sbf:"all",steps:sub.type==="card"?[{type:"card",c:sub.c}]:BANKS[sub.id]?[{type:"bank"}]:sub.id==="q"?sbaSteps(L.st,"all"):L.st.q.map(q=>({type:"q",q}))});
}
const nextIdx=()=>{const j=L.i+1;return j<L.subs.length?j:-1};
let pushed=false;
function showPage(){
  sheet.hidden=false;document.documentElement.style.overflow="hidden";
  if(!pushed){try{history.pushState({page:1},"");pushed=true}catch(e){}}
}
function close(){
  sheet.hidden=scrim.hidden=true;L=null;document.documentElement.style.overflow="";
  if(pushed){pushed=false;try{history.back()}catch(e){}}
}
addEventListener("popstate",()=>{if(!sheet.hidden){pushed=false;close();render()}});
function completeSub(){
  const {st,sub}=L;
  if(L.locked)return close();
  const arr=state.subs[st.id]=state.subs[st.id]||[];
  if(!arr.includes(sub.id))arr.push(sub.id);
  save();
  if(!state.done.includes(st.id)&&L.subs.every(x=>x.opt||arr.includes(x.id))){L.win=true;draw();render();return}
  close();render();
  const el=document.getElementById("stop-"+st.id);if(el){el.scrollIntoView({block:"center",behavior:"smooth"});el.classList.add("flash")}
}
function navPair(nx){
  const pv=L.i-1,hasP=pv>=0,hasN=nx>=0;
  return `<div class="navpair">${hasP?`<button class="cta2 prev" id="prevTab"><small>← Previous</small><span>${L.subs[pv].name}</span></button>`:"<span></span>"}${hasN?`<button class="cta2 next" id="nextTab"><small>Next →</small><span>${L.subs[nx].name}</span></button>`:`<button class="cta2 next" data-forumtab="1"><small>Next →</small><span>💬 Discussion</span></button>`}</div>`;
}
function noteHTML(){
  const n=L.notes[L.notes.length-1],back=L.notes.length>1?L.notes[L.notes.length-2].title:L.standalone?null:L.sub.name;
  return `<div class="sh-head"><button class="close nback" aria-label="${back?"Back":"Back to path"}">← ${back?"Back":"Path"}</button><div class="sh-title">Final FRCA note${n.group?" · "+n.group:""}</div></div><div class="sh-body"><div class="page note"><div class="kind">Your Exam Aid note${L.standalone?"":" · linked from "+L.st.title}</div><h3>${n.title}</h3>${topicSections(n)}</div></div><div class="sh-foot"><button class="cta ${n.stage.c==="c5"?"c5":""} nback">${back?"Back to "+back:"Back to path"}</button></div>`;
}
function openNote(n){
  L={st:n,subs:[],i:0,sub:{name:n.title},standalone:true,notes:[n],locked:true,steps:[]};
  sheet.style.cssText=col(n.stage.c);sheet.className="sheet pat pat-"+n.stage.id;showPage();draw();
}
function draw(){
  if(L.notes&&L.notes.length&&!L.topic){sheet.innerHTML=noteHTML();return}
  if(L.topic){
    const t=PRIMARY.topics[L.topic];
    sheet.innerHTML=`<div class="sh-head"><button class="close tback" aria-label="Back to ${L.st.title}">← Back</button><div class="sh-title">${L.st.title} · ${L.sub.name}</div></div><div class="sh-body"><div class="page topic"><div class="kind">Primary FRCA · ${t.c}</div><h3>${t.n}</h3>${t.h}</div></div><div class="sh-foot">${(()=>{const ks=((L.sub.c&&L.sub.c.links)||[]).filter(x=>!x.startsWith("stop:")&&!x.startsWith("curric:")).map(x=>x.split("|")[0]),j=ks.indexOf(L.topic);return (PSBA_TP[L.topic]?`<button class="cta2" data-tquiz="${L.topic}">Try the ${PSBA_TP[L.topic].length} Primary SBAs on this topic</button>`:"")+(j>=0&&j<ks.length-1?`<button class="cta2" data-topic="${ks[j+1]}">Next: ${PRIMARY.topics[ks[j+1]].n} <span aria-hidden="true">→</span></button>`:"")})()}<button class="cta ${L.st.stage.c==="c5"?"c5":""} tback">Back to ${L.sub.name}</button></div>`;
    return;
  }
  if(L.forum&&!L.win){
    const st=L.st,last=L.subs.length-1;
    const strip=`<div class="tstrip" role="tablist">${L.subs.map((x,i)=>`<button class="tchip ${x.c&&x.c.primaryRef?"tp":x.c&&x.c.noteRef?"tf":""} ${subDone(st,x.id)?"done":""}" data-goto="${i}" role="tab" aria-selected="false">${x.c&&x.c.primaryRef?`<em class="tk">P</em>`:x.c&&x.c.noteRef?`<em class="tk">F</em>`:""}${x.name}</button>`).join("")}<button class="tchip tdisc on" data-forumtab="1" role="tab" aria-selected="true">💬 Discussion</button></div>`;
    sheet.innerHTML=`<div class="sh-head"><button class="close" aria-label="Back to path">← Path</button><div class="sh-title">${st.title} · Discussion</div></div>${strip}<div class="sh-body"><div class="page"><div class="kind">Discussion · ${st.title}</div><h3>Discussion</h3><div class="forumbox" data-stop="${fesc(st.title)}"></div></div></div><div class="sh-foot"><div class="navpair"><button class="cta2 prev" data-goto="${last}"><small>← Previous</small><span>${L.subs[last].name}</span></button><span></span></div></div>`;
    const on=sheet.querySelector(".tchip.on");if(on)on.scrollIntoView({block:"nearest",inline:"center"});
    fillForum();return;
  }
  const {st,sub,step,steps}=L,s=steps[step];
  let body="",foot="",brewN=0,pct;
  const dk=st.stage.c==="c5"?"c5":"";
  if(L.win){
    pct=100;
    const gain=XP[st.t],bonus=stageBonus(st);
    brewN=gain+bonus;
    body=`<div class="win"><svg class="brew" id="brew" viewBox="0 0 200 140" aria-hidden="true"><defs><clipPath id="cupIn"><path d="M74 88H126L121.5 119Q121 122 117 122H83Q79 122 78.5 119Z"/></clipPath></defs>
<rect x="46" y="4" width="108" height="46" rx="9" fill="var(--fg)"/><rect x="60" y="15" width="34" height="13" rx="3" fill="var(--c)"/><circle cx="132" cy="21" r="7" fill="var(--surface)"/><circle cx="114" cy="21" r="3" fill="var(--muted)"/>
<rect x="86" y="50" width="28" height="8" rx="2" fill="var(--muted)"/><rect x="95" y="58" width="10" height="6" rx="1" fill="var(--muted)"/>
<rect class="stream" x="98" y="64" width="4" height="56" rx="2" fill="var(--coffee)"/>
<path d="M72 86H128L123 120Q122 124 118 124H82Q78 124 77 120Z" fill="var(--surface)"/>
<g clip-path="url(#cupIn)"><g class="liq"><rect x="70" y="90" width="60" height="34" fill="var(--coffee)"/><rect x="70" y="90" width="60" height="3" fill="var(--crema)"/></g></g>
<path d="M72 86H128L123 120Q122 124 118 124H82Q78 124 77 120Z" fill="none" stroke="var(--fg)" stroke-width="2.5" stroke-linejoin="round"/><path d="M126.5 93h5a6.5 6.5 0 0 1 0 13h-7" fill="none" stroke="var(--fg)" stroke-width="2.5"/>
<rect x="56" y="126" width="88" height="7" rx="3.5" fill="var(--muted)"/>
<g class="steam"><path d="M90 80c-4-5 4-8 0-13"/><path d="M100 78c-4-5 4-8 0-13"/><path d="M110 80c-4-5 4-8 0-13"/></g></svg><div class="cups" id="cups"></div><div class="big">+<span id="gotNum">0</span> ☕</div><p>${bonus?`${gain} for this stop + ${bonus} for completing ${st.stage.name}`:(gain===1?"coffee earned":"coffees earned")}</p><h3>${st.title} complete</h3></div>`;
    foot=`<button class="cta ${dk}" id="finish">Continue</button>`;
  }else if(s.type==="card"){
    pct=0;
    if(s.c.primaryRef){const t=PRIMARY.topics[s.c.primaryRef];body=`${L.locked?`<div class="peek">Preview. Finish earlier stops to unlock this stop.</div>`:""}<div class="kind"><span class="ktag tp">Primary FRCA</span> ${t?t.c:""} · linked from ${st.title}</div><h3>${t?t.n:s.c.h}</h3><div class="ntopic">${t?t.h:"<p>Topic not found.</p>"}</div>`}else if(s.c.noteRef){const n=findTopic(s.c.noteRef);body=`${L.locked?`<div class="peek">Preview. Finish earlier stops to unlock this stop.</div>`:""}<div class="kind"><span class="ktag tf">Final FRCA</span> linked from ${st.title}</div><h3>${s.c.noteRef}</h3><div class="ntopic">${n?topicSections(n):"<p>Note not found.</p>"}</div>`}else{body=`${L.locked?`<div class="peek">Preview. Finish earlier stops to unlock this stop.</div>`:""}<div class="kind">${st.title}</div><h3>${s.c.wpba?"Sample WPBA":s.c.h}</h3>${s.c.b||""}${s.c.links?linksHTML(s.c.links):""}${s.c.after||""}${(st.t==="recipe"&&!st.op&&!s.c.links)||s.c.recipe?`<p class="note">Illustrative doses. Follow your department's guidelines.</p>`:""}`;}
    const nx=nextIdx();
    foot=`${navPair(nx)}<button class="cta ${dk}" id="next">${L.locked?"Back to path":"Mark as done"}</button>`;
  }else if(s.type==="bank"){
    pct=0;body=bankHTML();
    foot=`<button class="cta ${dk}" id="bankgo">Start round</button>`;
  }else if(s.type==="res"){
    pct=100;const n=steps.length-1,sc=L.correct,miss=L.missed||[];
    body=`<div class="kind">${L.tq?"Primary SBAs · "+PRIMARY.topics[L.tq].n:(sub.id==="q"?"SBAs"+(L.sbf==="p"?" · Primary":L.sbf==="f"?" · Final":""):sub.name)+" · "+st.title}</div><div class="sbares"><div class="big">${sc} / ${n}</div><p>${n?Math.round(sc/n*100):0}% correct${miss.length?". Go back over the ones you missed while they're fresh.":". Clean sweep."}</p></div>`;
    foot=`${miss.length?`<button class="cta2" id="sbaretry">Retry the ${miss.length} I missed</button>`:""}${BANKS[sub.id]?`<button class="cta2" id="sbanew">New round</button>`:""}${L.tq?`<button class="cta ${dk}" id="tqback">Back to topic</button>`:`<button class="cta ${dk}" id="next">Done</button>`}`;
  }else{
    pct=Math.round(step/steps.length*100);
    const q=s.q;
    body=`<div class="kind">${sub.opt||L.tq?`${BANKS[sub.id]?(sub.id==="psbabank"?"Primary SBA bank · ":"SBA bank · ")+q.ar:"Primary SBA"} · ${step+1} of ${steps.length-1}`:sub.id==="q"?`SBAs${sbaMixed(st)?" · "+(q.g==="p"?"Primary":"Final"):""} · ${st.title} · ${step+1} of ${steps.length-1}`:`Quick check · ${st.title} · ${step+1} of ${steps.length}`}</div>${sub.id==="q"&&!L.tq?sbaFilter(st):""}${q.id?`<div class="sbameta">${q.sb}</div>`:""}<h3 class="${q.q.length>90?"qstem":""}">${q.q}</h3><div class="opts">${shuffle(q.o.map((o,i)=>({o,i}))).map(x=>`<button class="opt" data-i="${x.i}">${x.o}</button>`).join("")}</div><div id="why"></div>`;
    foot=`${step===0&&!sub.opt&&!L.tq?navPair(-1):""}<button class="cta ${dk}" id="next" disabled>Check an answer</button>`;
  }
  const bar=L.win?`<div class="bar"><i style="width:100%"></i></div>`:sub.type==="quiz"?`<div class="bar"><i style="width:${pct}%"></i></div>`:`<div class="sh-title">${st.title} · ${L.i+1} of ${L.subs.length}</div>`;
  const strip=!L.win?`<div class="tstrip" role="tablist">${L.subs.map((x,i)=>`<button class="tchip ${i===L.i&&!L.forum?"on":""} ${x.c&&x.c.primaryRef?"tp":x.c&&x.c.noteRef?"tf":""} ${subDone(st,x.id)?"done":""}" data-goto="${i}" role="tab" aria-selected="${i===L.i}">${x.c&&x.c.primaryRef?`<em class="tk">P</em>`:x.c&&x.c.noteRef?`<em class="tk">F</em>`:""}${x.name}</button>`).join("")}<button class="tchip tdisc ${L.forum?"on":""}" data-forumtab="1" role="tab" aria-selected="${!!L.forum}">💬 Discussion</button></div>`:"";
  sheet.innerHTML=`<div class="sh-head"><button class="close" aria-label="Back to path">← Path</button>${bar}</div>${strip}<div class="sh-body"><div class="page">${body}</div></div><div class="sh-foot">${foot}</div>`;
  const on=sheet.querySelector(".tchip.on");if(on)on.scrollIntoView({block:"nearest",inline:"center"});
  if(brewN)runBrew(brewN);
}

const CUP='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" fill="var(--coffee)"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16" fill="none" stroke="var(--coffee)" stroke-width="2"/></svg>';
async function runBrew(n){
  const svg=document.getElementById("brew");if(!svg)return;
  const liq=svg.querySelector(".liq"),str=svg.querySelector(".stream"),steam=svg.querySelector(".steam"),row=document.getElementById("cups"),num=document.getElementById("gotNum");
  if(matchMedia("(prefers-reduced-motion: reduce)").matches||!liq.animate){liq.style.transform="none";steam.style.opacity=.7;row.innerHTML=CUP.repeat(n);num.textContent=n;return}
  const go=(el,k,o)=>el.animate(k,{fill:"forwards",...o}).finished;
  try{
  for(let i=1;i<=n;i++){
    if(!svg.isConnected)return;
    const sp=i===1?1:.55;
    [liq,str,steam].forEach(e=>e.getAnimations().forEach(a=>a.cancel()));
    await go(str,[{transform:"scaleY(0)",opacity:1},{transform:"scaleY(1)",opacity:1}],{duration:260*sp,easing:"ease-in"});
    await go(liq,[{transform:"scaleY(0)"},{transform:"scaleY(1)"}],{duration:1000*sp,easing:"cubic-bezier(.3,.1,.4,1)"});
    await go(str,[{transform:"scaleY(1)",opacity:1},{transform:"scaleY(1)",opacity:0}],{duration:160*sp});
    go(steam,[{opacity:0,transform:"translateY(4px)"},{opacity:.75,transform:"translateY(0)"}],{duration:450});
    row.insertAdjacentHTML("beforeend",CUP);num.textContent=i;
    if(i<n)await new Promise(r=>setTimeout(r,420*sp));
  }}catch(e){}
}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function sbaMixed(st){const s=sbaSet(st);return s.some(q=>q.g==="p")&&s.some(q=>q.g==="f")}
function sbaFilter(st){if(!sbaMixed(st))return "";const s=sbaSet(st),n=g=>s.filter(q=>q.g===g).length;
  return `<div class="sbaflt" role="group" aria-label="Filter SBAs">${[["all","All",s.length],["p","Primary",n("p")],["f","Final",n("f")]].map(([v,l,c])=>`<button class="fchip ${L.sbf===v?"on":""}" data-sbf="${v}" aria-pressed="${L.sbf===v}">${l} <em>${c}</em></button>`).join("")}</div>`}
function bankHTML(){
  const B=BANKS[L.sub.id],SB=B.list,AR=[...new Set(SB.map(q=>q.ar))].sort();
  const h=state.sba||{},pr=store.get("pathway-pick-"+L.sub.id,{ar:"",mode:"all",n:"20"});
  const seen=SB.filter(q=>q.id in h).length,right=SB.filter(q=>h[q.id]===1).length;
  const cnt=a=>SB.filter(q=>!a||q.ar===a).length;
  const opt=(v,l,cur)=>`<option value="${v}" ${v===cur?"selected":""}>${l}</option>`;
  return `<div class="kind">${B.kind}</div><h3>${B.title}</h3><p class="tl-intro">${SB.length} single best answer questions with explanations, across ${AR.length} ${B.chap.toLowerCase()}s. ${B.note}</p>
  <div class="sbastats"><div><b>${seen}</b><span>answered</span></div><div><b>${seen?Math.round(right/seen*100):0}%</b><span>correct last time</span></div><div><b>${SB.length-seen}</b><span>not seen yet</span></div></div>
  <label class="sbaf">${B.chap}<select id="sbaar">${opt("","All ("+SB.length+")",pr.ar)}${AR.map(a=>opt(a,a+" ("+cnt(a)+")",pr.ar)).join("")}</select></label>
  <label class="sbaf">Questions<select id="sbamode">${opt("all","Any",pr.mode)}${opt("unseen","Not yet answered",pr.mode)}${opt("missed","Ones I got wrong",pr.mode)}</select></label>
  <label class="sbaf">Round length<select id="sban">${opt("10","10",pr.n)}${opt("20","20",pr.n)}${opt("50","50",pr.n)}${opt("all","All matching",pr.n)}</select></label>
  <p class="note" id="sbamsg">Written for Anaesthetic Ally. Explanations reflect UK guidance up to mid-2026; check specific numbers against the current guideline.</p>`;
}
function startBank(){
  const g=id=>sheet.querySelector(id).value,pr={ar:g("#sbaar"),mode:g("#sbamode"),n:g("#sban")};store.set("pathway-pick-"+L.sub.id,pr);
  const h=state.sba||{};let d=BANKS[L.sub.id].list.filter(q=>!pr.ar||q.ar===pr.ar);
  if(pr.mode==="unseen")d=d.filter(q=>!(q.id in h));if(pr.mode==="missed")d=d.filter(q=>h[q.id]===0);
  if(!d.length){sheet.querySelector("#sbamsg").textContent="No questions match that choice yet. Try another topic or Any.";return}
  d=shuffle(d.slice());if(pr.n!=="all")d=d.slice(0,+pr.n);
  L.steps=[...d.map(q=>({type:"q",q})),{type:"res"}];L.step=0;L.correct=0;L.missed=[];draw();sheet.querySelector(".sh-body").scrollTop=0;
}

sheet.addEventListener("click",e=>{
  const cg=e.target.closest("[data-gogroup]");if(cg&&!L){goGroup(cg.dataset.gogroup);return}
  const cs=e.target.closest(".cchip[data-gostop]");if(cs&&!L){goStop(cs.dataset.gostop);return}
  const cn=e.target.closest("[data-gonote]");if(cn&&!L){openNote(NOTES[+cn.dataset.gonote]);return}
  const cr=e.target.closest(".crow:not(.narow)");
  if(cr&&!L){if(cr.dataset.gostop)goStop(cr.dataset.gostop,cr.dataset.tab||null);else if(cr.dataset.gonote!=null)openNote(NOTES[+cr.dataset.gonote]);else goTopic(cr.dataset.gotopic);return}
  if(!L)return;
  const t=e.target.closest("button");if(!t)return;
  if(t.classList.contains("tback")){L.topic=null;draw();sheet.querySelector(".sh-body").scrollTop=L.scrollY||0;return}
  if(t.classList.contains("nback")){if(L.notes.length>1||!L.standalone){L.notes.pop();draw();sheet.querySelector(".sh-body").scrollTop=0}else close();return}
  if(t.dataset.opencurric){const n=t.dataset.opencurric;openCurriculum();const dd=sheet.querySelector("#cdom-"+n);if(dd){dd.open=true;setTimeout(()=>dd.scrollIntoView({block:"start"}),50)}return}
  if(t.dataset.openstop){const tt=decodeURIComponent(t.dataset.openstop),st=ALL.find(x=>x.title===tt);if(st){openSub(st.id,subsOf(st)[0].id);return}
    const n=findNote(tt);if(n){L.notes=L.notes||[];L.notes.push(n);L.topic=null;draw();sheet.querySelector(".sh-body").scrollTop=0}return}
  if(t.dataset.topic){L.scrollY=sheet.querySelector(".sh-body").scrollTop;L.topic=t.dataset.topic;draw();sheet.querySelector(".sh-body").scrollTop=0;return}
  if(t.classList.contains("close"))return close();
  if(t.classList.contains("opt")){
    const q=L.steps[L.step].q,i=+t.dataset.i,ok=i===q.a;
    sheet.querySelectorAll(".opt").forEach(b=>{b.disabled=true;if(+b.dataset.i===q.a)b.classList.add("right")});
    if(!ok)t.classList.add("wrong");else L.correct++;
    if(q.id){state.sba=state.sba||{};state.sba[q.id]=ok?1:0;save()}if(!ok)(L.missed=L.missed||[]).push(q);
    document.getElementById("why").innerHTML=`<div class="why ${ok?"ok":"no"}"><b>${ok?"Correct":"Not quite"}</b>${q.why}</div>`;
    const n=document.getElementById("next");n.disabled=false;n.textContent=L.steps[L.step+1]&&L.steps[L.step+1].type==="res"?"See score":L.step<L.steps.length-1?"Next question":"Finish";
    return;
  }
  if(t.dataset.forumtab){L.forum=true;draw();sheet.querySelector(".sh-body").scrollTop=0;return}
  if(t.closest(".forumbox"))return;
  if(t.dataset.goto!=null){L.forum=false;goSub(+t.dataset.goto);draw();return}
  if(t.id==="prevTab"){if(L.i>0){goSub(L.i-1);draw();sheet.querySelector(".sh-body").scrollTop=0}return}
  if(t.id==="nextTab"){
    const nx=nextIdx();if(nx<0)return;
    if(!L.locked){const arr=state.subs[L.st.id]=state.subs[L.st.id]||[];if(!arr.includes(L.sub.id))arr.push(L.sub.id);save();
      if(!state.done.includes(L.st.id)&&L.subs.every(x=>x.opt||arr.includes(x.id))){L.win=true;draw();render();return}}
    goSub(nx);draw();render();sheet.querySelector(".sh-body").scrollTop=0;return}
  if(t.dataset.tquiz){const k=t.dataset.tquiz;L.tqSteps=L.steps;L.tqStep=L.step;L.tq=k;L.topic=null;L.steps=[...shuffle(PSBA_TP[k].slice()).map(q=>({type:"q",q})),{type:"res"}];L.step=0;L.correct=0;L.missed=[];draw();sheet.querySelector(".sh-body").scrollTop=0;return}
  if(t.id==="tqback"){L.topic=L.tq;L.tq=null;L.steps=L.tqSteps;L.step=L.tqStep;L.correct=0;L.missed=[];draw();sheet.querySelector(".sh-body").scrollTop=0;return}
  if(t.dataset.sbf){L.sbf=t.dataset.sbf;L.steps=sbaSteps(L.st,L.sbf);L.step=0;L.correct=0;L.missed=[];draw();sheet.querySelector(".sh-body").scrollTop=0;return}
  if(t.id==="bankgo"){startBank();return}
  if(t.id==="sbanew"){L.steps=[{type:"bank"}];L.step=0;L.correct=0;L.missed=[];draw();sheet.querySelector(".sh-body").scrollTop=0;return}
  if(t.id==="sbaretry"){const m=L.missed;L.steps=[...shuffle(m.slice()).map(q=>({type:"q",q})),{type:"res"}];L.step=0;L.correct=0;L.missed=[];draw();sheet.querySelector(".sh-body").scrollTop=0;return}
  if(t.id==="next"){
    if(L.step<L.steps.length-1){L.step++;draw();sheet.querySelector(".sh-body").scrollTop=0}else completeSub();
    return;
  }
  if(t.id==="finish"){
    if(!state.done.includes(L.st.id)){const earn=XP[L.st.t]+stageBonus(L.st);state.done.push(L.st.id);state.xp+=earn;
      const today=new Date().toDateString();if(state.last!==today){state.streak+=1;state.last=today}
      save();}
    close();render();scrollToCurrent(true);
  }
});
scrim.addEventListener("click",close);
document.addEventListener("keydown",e=>{
  if((e.key==="Enter"||e.key===" ")&&e.target.matches?.(".sg[data-sub]")){e.preventDefault();const [a,b]=e.target.dataset.sub.split("|");return openSub(a,b)}
  if(e.key==="Escape"){if(L||!sheet.hidden)close()}});

document.addEventListener("click",e=>{
  if(!sheet.hidden||!e.target.isConnected)return;
  const sb=e.target.closest("[data-sub]");if(sb){const [a,b]=sb.dataset.sub.split("|");return openSub(a,b)}
  const o=e.target.closest("[data-open]");
  if(o){const st=ALL.find(x=>x.id===o.dataset.open),subs=subsOf(st);return openSub(st.id,(reqSubs(subs).find(x=>!subDone(st,x.id))||subs[0]).id)}
  const j=e.target.closest("[data-jump]");if(j)return document.getElementById("stage-"+j.dataset.jump).scrollIntoView({behavior:"smooth"});
});



