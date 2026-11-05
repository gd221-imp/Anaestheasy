/* Follow-ups: cases saved on this device only, with in-app reminders. No patient identifiers. */
const FU_KEY="pathway-followups";
const FU_REPEAT={once:"Once",w1:"Every week",w2:"Every 2 weeks",m1:"Every month"};
const fuToday=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const fuAdd=(iso,days)=>{const d=new Date(iso+"T12:00:00");d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)};
const fuAddMonth=iso=>{const d=new Date(iso+"T12:00:00");d.setMonth(d.getMonth()+1);return d.toISOString().slice(0,10)};
const fuNice=iso=>{try{return new Date(iso+"T12:00:00").toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}catch(e){return iso}};
const fuLoad=()=>{try{const v=JSON.parse(localStorage.getItem(FU_KEY)||"[]");return Array.isArray(v)?v:[]}catch(e){return []}};
const fuSave=list=>{try{localStorage.setItem(FU_KEY,JSON.stringify(list))}catch(e){}};
const fuDue=list=>list.filter(c=>c.active&&c.next<=fuToday());
/* Block anything that looks like a patient identifier: hospital/NHS numbers or dates of birth. */
function fuLooksIdentifying(t){
  const s=String(t||"");
  if(/\d(?:[\s-]?\d){5,}/.test(s.replace(/\b(19|20)\d\d-\d\d-\d\d\b/g,"")))return "a hospital or NHS number";
  if(/\b[A-Za-z]{1,3}\s?\d{5,}\b/.test(s)||/\b\d{1,2}[\/.]\d{1,2}[\/.](19|20)?\d\d\b/.test(s))return "a hospital number or date of birth";
  if(/\b(dob|d\.o\.b|date of birth|nhs ?no|mrn|hosp(ital)? ?no)\b/i.test(s))return "a patient identifier";
  return "";
}
function fuBadge(){
  const b=document.getElementById("fuBtn");if(!b)return;
  const n=fuDue(fuLoad()).length;let i=b.querySelector(".fubadge");
  if(n){if(!i){i=document.createElement("span");i.className="fubadge";b.appendChild(i)}i.textContent=n;b.setAttribute("aria-label","Follow-ups, "+n+" due")}
  else{if(i)i.remove();b.removeAttribute("aria-label")}
}
function fuNextAfter(c,from){
  if(c.repeat==="w1")return fuAdd(from,7);
  if(c.repeat==="w2")return fuAdd(from,14);
  if(c.repeat==="m1")return fuAddMonth(from);
  return null;
}
function openFollowups(){
  L=null;sheet.className="sheet";sheet.style.cssText=col("c3");showPage();
  sheet.innerHTML=`<div class="sh-head"><button class="close" aria-label="Back to path">← Path</button><div class="sh-title">Follow-ups</div></div><div class="sh-body"><div class="page fu" id="fuPage"></div></div>`;
  sheet.querySelector(".close").onclick=()=>{close();fuBadge()};
  fuRender();
}
function fuRender(msg){
  const el=document.getElementById("fuPage");if(!el)return;
  const list=fuLoad(),today=fuToday();
  const due=list.filter(c=>c.active&&c.next<=today).sort((a,b)=>a.next.localeCompare(b.next));
  const up=list.filter(c=>c.active&&c.next>today).sort((a,b)=>a.next.localeCompare(b.next));
  const done=list.filter(c=>!c.active).sort((a,b)=>(b.stopped||"").localeCompare(a.stopped||""));
  const card=(c,kind)=>`<div class="fucase ${kind}" data-fu="${fesc(c.id)}">
    <div class="fuhead"><b>${fesc(c.label)}</b><span class="fucat">${FU_REPEAT[c.repeat]||"Once"}</span></div>
    <div class="fumeta">Case ${fuNice(c.date)}${c.active?` · ${kind==="due"?(c.next<today?"Overdue since ":"Due ")+fuNice(c.next):"Next "+fuNice(c.next)}`:` · Finished ${fuNice(c.stopped||c.date)}`}</div>
    ${c.notes?`<div class="funotes">${fesc(c.notes)}</div>`:""}
    <div class="fuact">${c.active?`${kind==="due"?`<button class="fbtn" data-fuact="looked">Looked up</button><button class="flink" data-fuact="snooze">Tomorrow</button>`:""}<button class="flink" data-fuact="stop">Stop reminders</button>`:`<button class="flink" data-fuact="restart">Remind me again</button>`}<button class="flink fdel" data-fuact="del">Delete</button></div>
  </div>`;
  el.innerHTML=`<h3>Follow-ups</h3>
  <p class="tl-intro">Save a case you want to find out about later, and choose when to be reminded to look the patient up. Due follow-ups show here and as a number on the Follow-up button whenever you open the app.</p>
  <p class="note fuwarn"><b>No patient identifiers.</b> Don't enter names, hospital or NHS numbers, dates of birth or addresses. Use a description you'll recognise, then look the patient up on your hospital's own system. Cases are kept only on this device and aren't shared or backed up.</p>
  ${msg?`<p class="fumsg">${fesc(msg)}</p>`:""}
  <section class="fusec"><h4>Due now${due.length?` (${due.length})`:""}</h4>${due.length?due.map(c=>card(c,"due")).join(""):`<p class="fnote">Nothing due today.</p>`}</section>
  <form class="fcompose fuform" id="fuForm" autocomplete="off">
    <h4>Add a case</h4>
    <label class="fulbl" for="fuLabel">Description</label>
    <input id="fuLabel" maxlength="80" required placeholder="e.g. Lap chole, Theatre 4, difficult airway">
    <div class="frow">
      <div class="fufield"><label class="fulbl" for="fuDate">Date of case</label><input id="fuDate" type="date" value="${today}" max="${today}"></div>
      <div class="fufield"><label class="fulbl" for="fuFirst">First reminder</label><select id="fuFirst"><option value="1">Tomorrow</option><option value="3">In 3 days</option><option value="7" selected>In 1 week</option><option value="14">In 2 weeks</option><option value="28">In 4 weeks</option></select></div>
      <div class="fufield"><label class="fulbl" for="fuRepeat">Then</label><select id="fuRepeat"><option value="once">Just once</option><option value="w1">Every week until stopped</option><option value="w2">Every 2 weeks until stopped</option><option value="m1">Every month until stopped</option></select></div>
    </div>
    <label class="fulbl" for="fuNotes">What to check (optional)</label>
    <textarea id="fuNotes" rows="2" maxlength="400" placeholder="e.g. Did they need ICU? Any awareness? Histology?"></textarea>
    <p class="ferr" id="fuErr" hidden></p>
    <button class="fbtn" type="submit">Save follow-up</button>
  </form>
  <section class="fusec"><h4>Coming up${up.length?` (${up.length})`:""}</h4>${up.length?up.map(c=>card(c,"up")).join(""):`<p class="fnote">No reminders set.</p>`}</section>
  ${done.length?`<details class="fusec fudone"><summary>Finished (${done.length})</summary>${done.map(c=>card(c,"done")).join("")}</details>`:""}`;
  el.querySelector("#fuForm").onsubmit=e=>{
    e.preventDefault();
    const label=el.querySelector("#fuLabel").value.trim(),notes=el.querySelector("#fuNotes").value.trim();
    const date=el.querySelector("#fuDate").value||today,first=+el.querySelector("#fuFirst").value,repeat=el.querySelector("#fuRepeat").value;
    const err=el.querySelector("#fuErr");
    const bad=fuLooksIdentifying(label)||fuLooksIdentifying(notes);
    if(!label){err.textContent="Add a short description so you'll recognise the case.";err.hidden=false;return}
    if(bad){err.textContent="This looks like it contains "+bad+". Please remove it: follow-ups must not hold patient identifiers.";err.hidden=false;return}
    const l=fuLoad();
    l.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),label,notes,date,repeat,next:fuAdd(today,first),active:true,created:today});
    fuSave(l);fuBadge();fuRender("Saved. You'll be reminded "+fuNice(fuAdd(today,first))+".");
  };
  el.querySelectorAll("[data-fuact]").forEach(b=>b.onclick=()=>{
    const id=b.closest("[data-fu]").dataset.fu,act=b.dataset.fuact;
    let l=fuLoad();const c=l.find(x=>x.id===id);if(!c)return;let m="";
    if(act==="looked"){const n=fuNextAfter(c,today);if(n){c.next=n;m="Next reminder "+fuNice(n)+"."}else{c.active=false;c.stopped=today;m="Done. Moved to Finished."}}
    else if(act==="snooze"){c.next=fuAdd(today,1);m="Snoozed until tomorrow."}
    else if(act==="stop"){c.active=false;c.stopped=today;m="Reminders stopped."}
    else if(act==="restart"){c.active=true;delete c.stopped;c.next=fuAdd(today,7);m="You'll be reminded "+fuNice(c.next)+"."}
    else if(act==="del"){if(!confirm("Delete this follow-up?"))return;l=l.filter(x=>x.id!==id);m="Deleted."}
    fuSave(l);fuBadge();fuRender(m);
  });
}
document.getElementById("fuBtn").addEventListener("click",openFollowups);
fuBadge();document.addEventListener("visibilitychange",()=>{if(!document.hidden)fuBadge()});
