// ---- upcoming conferences (checked against organisers' sites, 20 Oct 2026; past events hide themselves) ----
/*@@EVENTS@@*/
/*@@EVENTS_TBC@@*/
/*@@EVENT_CALS@@*/
let EVF="all";
function openEvents(){
  L=null;sheet.className="sheet";sheet.style.cssText=col("c1");showPage();
  const today=new Date().toISOString().slice(0,10);
  const M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const fd=d=>{const[y,m,dd]=d.split("-");return `${+dd} ${M[m-1]} ${y}`};
  const range=(a,b)=>{if(a===b)return fd(a);const[ya,ma,da]=a.split("-"),[yb,mb,db]=b.split("-");
    if(ya===yb&&ma===mb)return `${+da}–${+db} ${M[mb-1]} ${yb}`;if(ya===yb)return `${+da} ${M[ma-1]} – ${+db} ${M[mb-1]} ${yb}`;return fd(a)+" – "+fd(b)};
  const ok=x=>EVF==="all"||(EVF==="uk"?x.uk:!x.uk);
  const ev=EVENTS.filter(x=>x.e>=today&&ok(x)).sort((a,b)=>a.s.localeCompare(b.s));
  let html="",last="";
  ev.forEach(x=>{const mk=x.s.slice(0,7);if(mk!==last){last=mk;const[y,m]=mk.split("-");html+=`<h4>${M[m-1]} ${y}</h4>`}
    const live=x.s<=today;
    html+=`<a class="evrow" href="${x.u}" target="_blank" rel="noopener"><span class="evd">${range(x.s,x.e)}${live?' <b class="evlive">On now</b>':""}</span><span class="evn">${nesc(x.n)} ↗</span><span class="evm">${nesc(x.o)} · ${nesc(x.p)}</span><span class="evt">${x.uk?"UK":"International"} · ${x.t}</span></a>`});
  const tbc=EVENTS_TBC.filter(ok);
  const chip=(k,l)=>`<button class="fchip${EVF===k?" on":""}" data-evf="${k}">${l}</button>`;
  sheet.innerHTML=`<div class="sh-head"><button class="close" aria-label="Back to path">← Path</button><div class="sh-title">Upcoming events</div></div><div class="sh-body"><div class="page news events"><h3>Upcoming events</h3><p class="tl-intro">Anaesthetic conferences in the UK and around the world. Tap one to open the organiser’s page. Always check dates there before booking.</p><div class="evchips">${chip("all","All")}${chip("uk","UK")}${chip("int","International")}</div>${html||'<p class="muted">No dated events in this view.</p>'}${tbc.length?`<h4>Dates to be confirmed</h4>${tbc.map(x=>`<a class="evrow" href="${x.u}" target="_blank" rel="noopener"><span class="evn">${nesc(x.n)} ↗</span><span class="evm">${nesc(x.o)}</span><span class="evt">${x.uk?"UK":"International"} · ${x.t}</span></a>`).join("")}`:""}<h4>Find more</h4><ul class="srclist">${EVENT_CALS.map(([l,u])=>`<li><a href="${u}" target="_blank" rel="noopener">${l} ↗</a></li>`).join("")}</ul><p class="note">Study leave: most of these count towards CPD. Ask early, as popular meetings sell out.</p></div></div>`;
  sheet.querySelector(".close").addEventListener("click",close);
  sheet.querySelectorAll("[data-evf]").forEach(b=>b.addEventListener("click",()=>{EVF=b.dataset.evf;openEvents()}));
}
async function openNewsArchive(){
  L=null;sheet.className="sheet";sheet.style.cssText=col("c4");showPage();
  const shell=b=>`<div class="sh-head"><button class="close" aria-label="Back to path">← Path</button><div class="sh-title">News archive</div></div><div class="sh-body"><div class="page news"><h3>Past editions</h3>${b}</div></div>`;
  sheet.innerHTML=shell(`<p class="tl-intro">Loading…</p>`);sheet.querySelector(".close").addEventListener("click",close);
  let list=[];
  try{if(NEWSDB){const s=await NEWSDB.collection("news").orderBy("issued","desc").limit(500).get();list=s.docs.filter(d=>d.id!=="latest").map(d=>d.data()).filter(d=>d&&Array.isArray(d.items))}}catch(e){}
  const day=x=>String(x&&x.issued||"").slice(0,10);
  if(NEWS&&!list.some(x=>day(x)===day(NEWS)))list.unshift(NEWS);
  if(NEWS&&Array.isArray(NEWS.past))NEWS.past.forEach(p=>{if(p&&!list.some(x=>day(x)===day(p)))list.push(p)});
  list.sort((a,b)=>day(b).localeCompare(day(a)));
  sheet.innerHTML=shell(list.length?`<p class="tl-intro">${list.length} edition${list.length===1?"":"s"}. Tap one to read it.</p>${list.map((n,i)=>`<button class="crow narow" data-ni="${i}"><span>${nesc(n.title||"Latest news")}<small class="chit">${nesc(ndate(n.issued))} · ${(n.items||[]).length} stories</small></span></button>`).join("")}`:`<p class="tl-intro">No editions yet.</p>`);
  sheet.querySelector(".close").addEventListener("click",close);
  sheet.querySelectorAll("[data-ni]").forEach(b=>b.addEventListener("click",()=>{NEWSF="all";openNews(list[+b.dataset.ni],true)}));
}
document.getElementById("newsBtn").addEventListener("click",()=>{NEWSF="all";openNews()});
(async()=>{try{
  const db=window.claude&&window.claude.use?await window.claude.use("db"):null;if(!db)return;NEWSDB=db;
  db.doc("news/latest").onSnapshot(snap=>{NEWS=snap.exists?snap.data():null;const b=document.getElementById("newsBtn");
    if(NEWS&&Array.isArray(NEWS.items)&&NEWS.items.length){document.getElementById("newsTitle").textContent=(NEWS.title||"Latest news")+" · "+ndate(NEWS.issued);b.hidden=false}else b.hidden=true},()=>{});
}catch(e){}})();
