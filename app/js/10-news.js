// ---- weekly newsletter (db doc news/latest, written each Monday by a scheduled task) ----
let NEWS=null;
const nesc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const nurl=u=>/^https:\/\//.test(u||"")?u:null;
const ndate=s=>{const d=new Date(s);return isNaN(d)?"":d.toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})};
let NEWSDB=null,NEWSF="all";
function newsIssueHTML(n,f){
  const items=Array.isArray(n.items)?n.items:[];const cats=[];items.forEach(i=>{const c=i.cat||"News";if(!cats.includes(c))cats.push(c)});
  let h="";
  cats.filter(c=>f==="all"||c===f).forEach(c=>{h+=`<h4>${nesc(c)}</h4>`;items.filter(i=>(i.cat||"News")===c).forEach(i=>{const u=nurl(i.url);h+=`<div class="nitem"><b>${nesc(i.h)}</b><p>${nesc(i.b)}</p>${u?`<a href="${nesc(u)}" target="_blank" rel="noopener">${nesc(i.source||"Read more")} ↗</a>`:""}</div>`})});
  return h;
}
function openNews(issue,fromArchive){
  const n=(issue&&issue.items)?issue:NEWS;if(!n)return;
  L=null;sheet.className="sheet";sheet.style.cssText=col("c4");showPage();
  const items=Array.isArray(n.items)?n.items:[];const cats=[];items.forEach(i=>{const c=i.cat||"News";if(!cats.includes(c))cats.push(c)});
  if(NEWSF!=="all"&&!cats.includes(NEWSF))NEWSF="all";
  const draw=()=>{
    sheet.innerHTML=`<div class="sh-head"><button class="close nwback" aria-label="${fromArchive?"Back to archive":"Back to path"}">← ${fromArchive?"Archive":"Path"}</button><div class="sh-title">${fromArchive?"Past edition":"Latest news"}</div></div><div class="sh-body"><div class="page news"><h3>${nesc(n.title||"This week in anaesthesia")}</h3><p class="nmeta">${nesc(ndate(n.issued))}</p>${n.intro?`<p class="tl-intro">${nesc(n.intro)}</p>`:""}
      <div class="nsecwrap"><button class="nsecbtn" id="nsecbtn" aria-haspopup="true" aria-expanded="false">${NEWSF==="all"?"All sections":nesc(NEWSF)} <em>${NEWSF==="all"?items.length:items.filter(i=>(i.cat||"News")===NEWSF).length}</em> <span aria-hidden="true">▾</span></button>
      <div class="npop" id="npop" role="menu" hidden><button role="menuitem" data-nf="all" class="${NEWSF==="all"?"on":""}">All sections <em>${items.length}</em></button>${cats.map(c=>`<button role="menuitem" data-nf="${nesc(c)}" class="${NEWSF===c?"on":""}">${nesc(c)} <em>${items.filter(i=>(i.cat||"News")===c).length}</em></button>`).join("")}</div></div>
      ${newsIssueHTML(n,NEWSF)}
      <button class="cta2 narch" id="narch">Past editions</button>
      <p class="note">Updated every Monday morning from public sources. Summaries are written for Anaesthetic Ally; follow the links for the full story and check official sources before acting on anything.</p></div></div>`;
    sheet.querySelector(".nwback").addEventListener("click",()=>{fromArchive?openNewsArchive():close()});
    const b=sheet.querySelector("#nsecbtn"),pop=sheet.querySelector("#npop");
    b.addEventListener("click",e=>{e.stopPropagation();pop.hidden=!pop.hidden;b.setAttribute("aria-expanded",String(!pop.hidden))});
    pop.querySelectorAll("[data-nf]").forEach(x=>x.addEventListener("click",()=>{NEWSF=x.dataset.nf;draw()}));
    sheet.querySelector(".sh-body").addEventListener("click",()=>{if(!pop.hidden){pop.hidden=true;b.setAttribute("aria-expanded","false")}});
    sheet.querySelector("#narch").addEventListener("click",openNewsArchive);
  };
  draw();
}

