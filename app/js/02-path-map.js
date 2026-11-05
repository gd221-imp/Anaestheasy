const store={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
let state=store.get("pathway-v19",null)||{done:[],subs:{},xp:0,streak:0};
state.subs=state.subs||{};
const save=()=>store.set("pathway-v19",state);
const doneSet=()=>new Set(state.done);
const subDone=(st,id)=>(state.subs[st.id]||[]).includes(id);
const currentIndex=()=>{const d=doneSet();const i=ALL.findIndex(s=>!d.has(s.id));return i<0?ALL.length:i};
const isLocked=st=>ALL.indexOf(st)>currentIndex();

const OFFS=[0,62,92,62,0,-62,-92,-62];
const svg=(k)=>`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>`;
const col=(c)=>`--c:var(--${c});--cd:var(--${c}-deep)`;

function segRing(st,S){
  const subs=subsOf(st),n=subs.length,r=S/2-6,c=S/2,gap=n>1?Math.min(16,140/n):0,pt=a=>[c+r*Math.cos(a*Math.PI/180),c+r*Math.sin(a*Math.PI/180)];
  return `<svg class="seg" viewBox="0 0 ${S} ${S}" aria-hidden="true">${subs.map((x,i)=>{
    const on=subDone(st,x.id)?"var(--c)":x.c&&x.c.primaryRef?"#f2c38a":x.c&&x.c.noteRef?"#c9b3f5":"var(--line)";
    const attrs=`data-sub="${st.id}|${x.id}" tabindex="0" role="button" aria-label="${x.name}${subDone(st,x.id)?", done":""}"`;
    let d;
    if(n===1)d=`M${c} ${c-r}a${r} ${r} 0 1 1 0 ${2*r}a${r} ${r} 0 1 1 0 ${-2*r}`;
    else{const a0=-90+i*360/n+gap/2,a1=-90+(i+1)*360/n-gap/2,[x0,y0]=pt(a0),[x1,y1]=pt(a1);d=`M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1-a0>180?1:0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`}
    return `<g class="sg " ${attrs}><title>${x.name}</title><path class="hit" d="${d}"/><path class="vis" d="${d}" stroke="${on}"/></g>`}).join("")}</svg>`;
}

function render(){
  const d=doneSet(),cur=currentIndex();
  document.getElementById("xp").textContent=state.xp;
  document.getElementById("streak").textContent=state.streak;
  document.getElementById("chips").innerHTML=STAGES.map(s=>`<button class="chip" style="${col(s.c)}" data-jump="${s.id}"><i></i>${s.name}</button>`).join("");
  let html="",gi=0,lastGroup=null;
  STAGES.forEach(s=>{
    const n=s.stops.length,dn=s.stops.filter(x=>d.has(x.id)).length,pct=dn/n,C=2*Math.PI*24;
    html+=`<section id="stage-${s.id}" class="stagesec pat-${s.id}" style="${col(s.c)}"><div class="stage ${s.c}" style="${col(s.c)}">
      <div class="eyebrow">${s.grades}</div><h2>${s.name}</h2><p>${s.blurb}</p>
      <svg class="ring" viewBox="0 0 58 58" aria-label="${dn} of ${n} complete"><circle cx="29" cy="29" r="24" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width="6"/><circle cx="29" cy="29" r="24" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C*pct} ${C}" transform="rotate(-90 29 29)"/><text x="29" y="33" text-anchor="middle">${dn}/${n}</text></svg>
</div><div class="path">`;
    s.stops.forEach(st=>{
      const idx=ALL.indexOf(st),status=d.has(st.id)?"done":idx===cur?"current":idx>cur?"locked":"done";
      const big=st.t==="exam"||st.t==="crown",S=big?128:110,x=OFFS[gi%8];
      if((st.group||null)!==lastGroup){
        if(lastGroup)html+=`</div>`;
        if(st.group){const gs=s.stops.filter(z=>z.group===st.group),gd=gs.filter(z=>d.has(z.id)).length,sh=SHAPES[st.shape];
          html+=`<div class="gsec" data-group="${st.group}" style="${col(s.c)}"><div class="ghead"><svg viewBox="0 0 80 88" aria-hidden="true"><path d="${sh.d}" fill="var(--c)" fill-rule="${sh.rule||"evenodd"}"/></svg><span>${st.group}</span><em>${gd}/${gs.length}</em></div>`}
        lastGroup=st.group||null;
      }
      const sh=st.shape&&SHAPES[st.shape],sc=sh&&status==="done"?sh.done:s.c;
      const inner=sh?`<svg class="hs" viewBox="0 0 80 88" aria-hidden="true"><path class="hb" transform="translate(0 7)" fill-rule="${sh.rule||"evenodd"}" d="${sh.d}"/><path class="ht" fill-rule="${sh.rule||"evenodd"}" d="${sh.d}"/><g class="ic">${sh.icon(status)}</g></svg>`:svg(st.t);
      html+=`<div class="stop ${status} ${big?"exam":""}" id="stop-${st.id}" style="--x:${x}px;${col(sc)}">
        ${status==="current"?`<div class="bubble">${d.size?"Next":"Start"}</div>`:""}
        <div class="nw" style="--s:${S}px">${segRing(st,S)}<button class="node ${s.c} ${sh?"shaped "+st.shape:""}" data-open="${st.id}" aria-label="${st.title}, ${status==="locked"?"locked, preview":status}">${inner}</button></div>
        <div class="label">${st.title}</div></div>`;
      gi++;
    });
    if(lastGroup){html+=`</div>`;lastGroup=null}
    html+=`</div></section>`;
  });
  document.getElementById("map").innerHTML=html;
  const nb=document.getElementById("nextbar"),cst=ALL[currentIndex()];
  if(cst){const ns=subsOf(cst).find(x=>!subDone(cst,x.id))||subsOf(cst)[0];
    nb.hidden=false;nb.style.cssText=col(cst.stage.c);
    nb.innerHTML=`<button class="cta ${cst.stage.c==="c5"?"c5":""}" data-sub="${cst.id}|${ns.id}"><small>${cst.title}</small>Next: ${ns.name}</button>`;
  }else nb.hidden=true;
  document.getElementById("legend").innerHTML=["tip","recipe","interview","exam","money"].map(k=>`<span>${svg(k)}${KIND[k]}</span>`).join("");
}

