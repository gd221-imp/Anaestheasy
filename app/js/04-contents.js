// contents page
const strip=h=>h.replace(/<[^>]+>/g," ").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").replace(/\s+/g," ");
let CIDX=null;
function contentsIndex(){
  if(CIDX)return CIDX;
  CIDX=[];
  ALL.forEach(st=>{st._tabs=subsOf(st).map(x=>({id:x.id,name:x.name,text:(x.name+" "+(x.c?strip(x.c.b||""):"")).toLowerCase()}));
    st._key=(st.title+" "+(st.group||"")+" "+st.stage.name).toLowerCase()});
  NOTES.forEach(st=>{st._tabs=st.cards.map((c,i)=>({id:String(i),name:c.h,text:(c.h+" "+strip(c.b||"")).toLowerCase()}));st._key=(st.title+" "+(st.group||"")+" note").toLowerCase()});
  return CIDX;
}
function openContents(){
  contentsIndex();
  L=null;sheet.className="sheet";sheet.style.cssText=col("c3");showPage();
  const d=doneSet(),cur=currentIndex();
  let h=`<div class="sh-head"><button class="close" aria-label="Back to path">← Path</button><div class="csearch"><input id="cq" type="search" placeholder="Search stops, tabs and notes" aria-label="Search stops, tabs and notes" autocomplete="off"></div></div><div class="sh-body"><div class="page contents"><h3>Contents</h3><p class="tl-intro" id="cinfo">${ALL.length} stops and ${Object.keys(PRIMARY.topics).length} Primary FRCA topics. Tap one to go straight to it.</p>`;
  STAGES.forEach(sg=>{
    h+=`<section class="cstage" style="${col(sg.c)}"><h4 class="cst${sg.c==="c5"?" c5":""}"><span>${sg.grades}</span>${sg.name}</h4>`;
    let g=undefined;
    sg.stops.forEach(st=>{
      const grp=st.group||null;
      if(grp!==g){if(g!==undefined)h+=`</div>`;h+=`<div class="cgrp">${grp?`<h5>${grp}</h5>`:""}`;g=grp}
      const idx=ALL.indexOf(st),status=d.has(st.id)?"done":idx===cur?"current":idx>cur?"locked":"done";
      h+=`<button class="crow ${status}" data-gostop="${st.id}"><i aria-hidden="true">${status==="done"?"✓":status==="current"?"●":""}</i><span>${st.title}<small class="chit"></small></span></button>`;
    });
    h+=`</div></section>`;
    if(sg.id==="st2"&&NOTES.length){
      h+=`<section class="cstage" style="${col("c3")}"><h4 class="cst"><span>Behind the operations</span>Final FRCA notes</h4>`;
      let g2=undefined;
      NOTES.forEach((n,i)=>{const grp=n.group||null;if(grp!==g2){if(g2!==undefined)h+=`</div>`;h+=`<div class="cgrp">${grp?`<h5>${grp}</h5>`:""}`;g2=grp}
        h+=`<button class="crow" data-gonote="${i}"><i aria-hidden="true"></i><span>${n.title}<small class="chit"></small></span></button>`});
      h+=`</div></section>`;
    }
    if(sg.id==="core"){
  h+=`<section class="cstage" style="${col("c2")}"><h4 class="cst"><span>Exam Aid notes</span>Primary FRCA topics</h4>`;
    Object.entries(PRIMARY.syllabus).forEach(([ch,keys])=>{
      h+=`<div class="cgrp"><h5>${ch}</h5>${keys.map(k=>`<button class="crow" data-gotopic="${k}"><i aria-hidden="true"></i><span>${PRIMARY.topics[k].n}<small class="chit"></small></span></button>`).join("")}</div>`;
    });
    h+=`</section>`;
    }
  });
  h+=`<p class="cnone" id="cnone" hidden>No matches. Try a shorter word.</p></div></div>`;
  sheet.innerHTML=h;
  const q=sheet.querySelector("#cq");
  try{q.value=sessionStorage.getItem("cq")||""}catch(e){}
  q.addEventListener("input",()=>filterContents(q.value));
  filterContents(q.value);
  sheet.querySelector(".close").onclick=close;
}
function filterContents(raw){
  try{sessionStorage.setItem("cq",raw)}catch(e){}
  const q=raw.trim().toLowerCase();let shown=0;
  const re=q?new RegExp("(^|[^a-z0-9])"+q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")):null,m=t=>re.test(t);
  sheet.querySelectorAll(".crow:not(.rv)").forEach(r=>{
    let hit=!q,tab=null;
    if(q){
      if(r.dataset.gostop){const st=ALL.find(x=>x.id===r.dataset.gostop);
        if(m(st._key))hit=true;else{tab=st._tabs.find(t=>m(t.text));hit=!!tab}}
      else if(r.dataset.gonote!=null){const st=NOTES[+r.dataset.gonote];
        if(m(st._key))hit=true;else{tab=st._tabs.find(t=>m(t.text));hit=!!tab}}
      else{const t=PRIMARY.topics[r.dataset.gotopic];hit=m((t.n+" "+t.c).toLowerCase())||m(t._t||(t._t=strip(t.h).toLowerCase()))}
    }
    r.hidden=!hit;r.dataset.tab=tab?tab.id:"";
    r.querySelector(".chit").textContent=tab?`in “${tab.name}”`:"";
    if(hit)shown++;
  });
  sheet.querySelectorAll(".cgrp").forEach(g=>g.hidden=![...g.querySelectorAll(".crow")].some(r=>!r.hidden));
  sheet.querySelectorAll(".cstage").forEach(g=>g.hidden=![...g.querySelectorAll(".crow")].some(r=>!r.hidden));
  sheet.querySelector("#cnone").hidden=shown>0;
  sheet.querySelector("#cinfo").textContent=q?`${shown} match${shown===1?"":"es"}`:`${ALL.length} stops, ${NOTES.length} Final FRCA notes and ${Object.keys(PRIMARY.topics).length} Primary FRCA topics. Tap one to go straight to it.`;
}
function goStop(id,tabId){
  const st=ALL.find(x=>x.id===id),subs=subsOf(st);
  sheet.hidden=true;
  const el=document.getElementById("stop-"+id);
  if(el){el.scrollIntoView({block:"center"});el.classList.remove("flash");void el.offsetWidth;el.classList.add("flash")}
  openSub(id,tabId||(subs.find(x=>!subDone(st,x.id))||subs[0]).id);
}
function goTopic(k){
  const w=ALL.find(x=>x.title==="Primary FRCA: written"),ch=PRIMARY.topics[k].c,sub=subsOf(w).find(x=>x.name===ch);
  sheet.hidden=true;openSub(w.id,sub.id);L.topic=k;draw();
}
document.getElementById("contentsBtn").addEventListener("click",openContents);

