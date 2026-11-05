(async()=>{try{
  if(!(window.claude&&window.claude.use)){F.state="none";F.v++;fillForum();return}
  const [db,user]=await Promise.all([window.claude.use("db"),window.claude.use("user")]);
  F.db=db;F.user=user;
  if(!db){F.state="none";F.v++;fillForum();return}
  if(user){try{F.me=await user.id();F.owner=!!(await user.isOwner())}catch(e){}}
  db.collection("forum").onSnapshot(snap=>{const all=[];snap.docs.forEach(d=>{const b=d.data()||{};(Array.isArray(b.posts)?b.posts:[]).forEach(p=>{if(p&&p.id&&typeof p.text==="string")all.push({...p,author:d.id,key:d.id+":"+p.id})})});
    F.posts=all;F.state="ok";F.v++;fillForum();fNames()},()=>{F.state="none";F.v++;fillForum()});
}catch(e){F.state="none";F.v++;fillForum()}})();
