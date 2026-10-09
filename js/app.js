/* ==========================================================================
   Build Planner v2 · app
   Data lives in data/*.js (window.BP). No build step, no dependencies.
   ========================================================================== */
(function(){
"use strict";

const APP_VERSION="2.0";
const BP=window.BP||{};
const TREES=BP.TREES||[];
const KEYWORDS=BP.KEYWORDS||[];
const PREMADES=BP.PREMADES||[];
const APPLIES=BP.APPLIES||[];
const ALIASES=BP.TREE_ALIASES||{};

/* ================= helpers ================= */
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const escT=s=>String(s??"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));   /* text nodes only */
const rxEsc=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
const plural=(n,w)=>n+" "+w+(n===1?"":"s");
const cssEsc=s=>window.CSS&&CSS.escape?CSS.escape(s):String(s).replace(/["\\]/g,"\\$&");
function fnv(str){let h=0x811c9dc5;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193);}return (h>>>0).toString(36);}
function debounce(fn,ms){
  let t=null,args=null;
  const run=()=>{t=null;const a=args;args=null;fn(...(a||[]));};
  const d=(...a)=>{args=a;clearTimeout(t);t=setTimeout(run,ms);};
  d.flush=()=>{if(t!==null){clearTimeout(t);run();}};
  d.cancel=()=>{clearTimeout(t);t=null;args=null;};
  return d;
}
/* only touch the DOM when the markup actually changed (keeps focus and clicks intact) */
function patch(el,html){if(el&&el._h!==html){el.innerHTML=html;el._h=html;}}
const fmtDate=ts=>{try{return new Date(ts).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});}catch(e){return "";}};
const slug=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"build";
function download(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),8000);}

/* ================= storage ================= */
const KEY={saves:"bp2:saves",hist:"bp2:history",prefs:"bp2:prefs",migrated:"bp2:migrated"};
const store={
  get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}},
  raw(k){try{return localStorage.getItem(k);}catch(e){return null;}},
  setRaw(k,v){try{localStorage.setItem(k,v);return true;}catch(e){return false;}},
  del(k){try{localStorage.removeItem(k);}catch(e){}}
};
/* Portraits live in IndexedDB (no 5 MB limit, shared by every project on the same github.io
   domain); a memory cache keeps rendering synchronous. Falls back to localStorage. */
const imgStore=(()=>{
  const mem=new Map();let dbp=null;
  const db=()=>dbp||(dbp=new Promise((res,rej)=>{try{const r=indexedDB.open("build-planner",1);r.onupgradeneeded=()=>r.result.createObjectStore("img");r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}catch(e){rej(e);}}));
  const tx=(mode,fn)=>db().then(d=>new Promise((res,rej)=>{const t=d.transaction("img",mode),q=fn(t.objectStore("img"));t.oncomplete=()=>res(q?q.result:undefined);t.onerror=t.onabort=()=>rej(t.error);}));
  const lk=k=>"bp2:img:"+k;
  return{
    peek:k=>mem.get(k),
    async put(k,v){mem.set(k,v);try{await tx("readwrite",s=>s.put(v,k));return true;}catch(e){return store.setRaw(lk(k),v);}},
    async get(k){if(mem.has(k))return mem.get(k);let v=null;try{v=await tx("readonly",s=>s.get(k));}catch(e){}if(v==null)v=store.raw(lk(k));if(v)mem.set(k,v);return v||null;},
    async keys(){try{return await tx("readonly",s=>s.getAllKeys());}catch(e){return [];}},
    async del(k){mem.delete(k);try{await tx("readwrite",s=>s.delete(k));}catch(e){}store.del(lk(k));}
  };
})();
const imgKeyOf=data=>fnv(data)+data.length.toString(36);

/* ================= data ================= */
const MAIN="Main Class Tree";
const CATS=["melee","ranged","magic","support","auxiliary","cursed"];
const CATN={melee:"Melee",ranged:"Ranged",magic:"Magic",support:"Support",auxiliary:"Auxiliary",cursed:"Cursed"};
const CATI={melee:"⚔",ranged:"🏹",magic:"✦",support:"✚",auxiliary:"◈",cursed:"☠"};
const RARC={Common:"#9aa5b1",Uncommon:"#6cc069",Rare:"#5aa7ff",Legendary:"#ffcf4d",Cursed:"#c07be0"};
const RARITIES=["Common","Uncommon","Rare","Legendary"];
const RANKS=["U","E","D","C","B","A"];
const RANKC={U:"#8b94ab",E:"#b58b6b",D:"#9aa5b1",C:"#6cc069",B:"#5aa7ff",A:"#ffcf4d"};
const SLOTN=["Birth tree","Sub tree 1","Sub tree 2"];
const TREE_BY_ID=Object.create(null);TREES.forEach(t=>{TREE_BY_ID[t.id]=t;});
const tree=id=>TREE_BY_ID[id];
const resolveId=id=>typeof id!=="string"?null:TREE_BY_ID[id]?id:(TREE_BY_ID[ALIASES[id]]?ALIASES[id]:null);
const TIERS=Object.create(null);
const tiersOf=t=>TIERS[t.id]||(TIERS[t.id]=[...new Set(t.sk.map(s=>s.t))].sort((a,b)=>a-b));
const maxTier=t=>{const a=tiersOf(t);return a[a.length-1]||0;};
const nextTier=(t,cur)=>tiersOf(t).find(T=>T>cur);
const tierSig=t=>fnv(tiersOf(t).join(",")).slice(0,4);
const SORTED=TREES.slice().sort((a,b)=>CATS.indexOf(a.c)-CATS.indexOf(b.c)||RARITIES.indexOf(a.r)-RARITIES.indexOf(b.r)||TREES.indexOf(a)-TREES.indexOf(b));
const skillAt=ref=>{const p=String(ref).split(":"),t=tree(p[0]);return t&&t.sk[+p[1]]?{t,sk:t.sk[+p[1]],i:+p[1]}:null;};

/* ---- icons: icons/<tree id>/01.webp = tree, 02…09.webp = skills in order ---- */
const iconSrc=(t,n)=>"icons/"+t.id+"/"+String(n).padStart(2,"0")+".webp";
const skIconSrc=(sk,t)=>sk.img||iconSrc(t,t.sk.indexOf(sk)+2);
const PH=new Map();
function ph(letter,color){const k=letter+color;if(!PH.has(k))PH.set(k,"data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="10" fill="'+color+'"/><text x="32" y="44" font-size="32" font-family="sans-serif" fill="#0f1115" text-anchor="middle" font-weight="bold">'+esc(letter)+'</text></svg>'));return PH.get(k);}
function skImg(sk,t){return '<span class="skimg" style="background-image:url(\''+ph(sk.n[0],RARC[t.r])+'\')"><img src="'+esc(skIconSrc(sk,t))+'" loading="lazy" decoding="async" alt=""></span>';}
function treeIco(t){return '<span class="tico" title="'+esc(t.n)+'"><span class="tglyph" aria-hidden="true">'+CATI[t.c]+'</span><img src="'+iconSrc(t,1)+'" loading="lazy" decoding="async" alt=""></span>';}
const badge=t=>'<span class="badge" style="background:'+RARC[t.r]+'">'+t.r+'</span>';
const rankBadge=st=>'<span class="badge" style="background:'+(RANKC[st.rank]||RANKC.D)+'">'+(st.rank==="U"?"Unranked":"Rank "+esc(st.rank))+'</span>';
/* missing icon files fall back to the letter tile / category glyph underneath */
document.addEventListener("error",e=>{const t=e.target;if(t&&t.tagName==="IMG"&&t.closest&&t.closest(".skimg,.tico"))t.remove();},true);

/* ================= state ================= */
function blank(){return{name:"",epithet:"",flavor:"",rank:"D",level:1,trees:[null,null,null],spent:{},image:null,imageKey:null};}
let S=blank();
let LOCK=[false,false,false];          /* slots Random keeps (with their points); UI state, not saved */
const TREE_OPEN=new Set();             /* tree panels showing their skill list */
const OPEN=new Set();                  /* expanded skill rows ("treeId:index") */
let MOVE=null;                         /* slot being moved, or null */
let RANK_PINNED=false;                 /* rank picked by hand: Random keeps it */
let CURRENT_SAVE=null;                 /* id of the save the build was loaded from */
let CB=null;                           /* build shown in Compare */
const PREFS=Object.assign({onlyUnlocked:false,pvOpen:true,shImg:true,shFull:false},store.get(KEY.prefs,{})||{});
const savePrefs=()=>store.set(KEY.prefs,PREFS);
const sumSpent=st=>Object.values(st.spent).reduce((a,b)=>a+b,0);
const equipped=(st=S)=>st.trees.filter(Boolean);
const isBlank=st=>!st.name&&!st.epithet&&!(st.flavor||"").trim()&&!st.image&&!st.imageKey&&st.level===1&&st.rank==="D"&&!st.trees.some(Boolean);

/* ================= build codes =================
   v4: [4, name, title, rank, level, [[treeId, points, tierSig] | 0 ×3], flavor, image]
   tierSig is a short hash of the tree's tiers, so a link made before a tier change can say so.
   Older codes still load: v1 arrays [name, title, rank, level, trees, path, image, flavor]
   and the original object format. */
const CODE_V=4;
function b64u(s){return btoa(unescape(encodeURIComponent(s))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
function unb64u(s){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";return decodeURIComponent(escape(atob(s)));}
function packState(st,img){
  const t=st.trees.map(id=>id?[id,st.spent[id]||0,tierSig(tree(id))]:0);
  const a=[CODE_V,st.name||"",st.epithet||"",st.rank,st.level,t,(st.flavor||"").trim(),img||0];
  while(a.length>6&&!a[a.length-1])a.pop();
  return a;
}
const urlImage=st=>st.image&&st.image.startsWith("https://")?st.image:0;
const code=(st=S)=>b64u(JSON.stringify(packState(st,urlImage(st))));
function cleanCode(c){
  c=String(c||"").trim();const i=c.lastIndexOf("#");if(i>=0)c=c.slice(i+1);
  c=c.replace(/\s+/g,"");
  if(/%[0-9a-f]{2}/i.test(c)){try{c=decodeURIComponent(c);}catch(e){}}
  return c;
}
/* portraits: an uploaded image (data URL) or a direct https link */
function safeImg(u){
  if(typeof u!=="string")return null;
  if(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(u)&&u.length<800000)return u;
  if(/^https:\/\/[^\s"'()\\<>]+$/.test(u)&&u.length<2000)return u;
  return null;
}
function parseRaw(raw){
  let o;
  if(Array.isArray(raw)&&typeof raw[0]==="number")o={name:raw[1],epithet:raw[2],rank:raw[3],level:raw[4],tl:raw[5],flavor:raw[6],image:raw[7]};
  else if(Array.isArray(raw))o={name:raw[0],epithet:raw[1],rank:raw[2],level:raw[3],tl:raw[4],image:raw[6],flavor:raw[7]};
  else if(raw&&typeof raw==="object"){
    const ids=Array.isArray(raw.trees)?raw.trees:[raw.birth,(raw.subs||[])[0],(raw.subs||[])[1]];
    o={name:raw.name,epithet:raw.epithet,rank:raw.rank,level:raw.level,flavor:raw.flavor,image:null,tl:ids.map(id=>id?[id,(raw.spent||{})[id]||0]:0)};
  }else return null;
  const tl=(Array.isArray(o.tl)?o.tl:[]).slice(0,3);
  let ids=[0,1,2].map(i=>Array.isArray(tl[i])?resolveId(tl[i][0]):null);
  ids=ids.map((id,i)=>id&&ids.indexOf(id)===i?id:null);                              /* no duplicates */
  let cursed=false;
  ids=ids.map(id=>{if(id&&tree(id).c==="cursed"){if(cursed)return null;cursed=true;}return id;});   /* max one cursed */
  if(ids[0]&&tree(ids[0]).ty!==MAIN){const id=ids[0];ids[0]=null;const f=ids.indexOf(null,1);if(f>0)ids[f]=id;}   /* birth = main class */
  const spent={},changed=[];
  tl.forEach(e=>{
    if(!Array.isArray(e))return;const id=resolveId(e[0]);if(!id||!ids.includes(id))return;
    const t=tree(id),v=Math.max(0,parseInt(e[1],10)||0),T=tiersOf(t).filter(x=>x<=v).pop()||0;
    if(T)spent[id]=T;
    if((e[2]&&e[2]!==tierSig(t))||T!==v)changed.push(t.n);
  });
  const st={...blank(),name:String(o.name??"").slice(0,60),epithet:String(o.epithet??"").slice(0,80),flavor:String(o.flavor||"").slice(0,300),
    rank:RANKS.includes(o.rank)?o.rank:"D",level:Math.max(1,Math.min(100,parseInt(o.level,10)||1)),trees:ids,spent,image:safeImg(o.image)};
  return{st,changed:[...new Set(changed)]};
}
function parseCode(c){try{c=cleanCode(c);if(!c||c.startsWith("z."))return null;return parseRaw(JSON.parse(unb64u(c)));}catch(e){return null;}}
/* links: "z." + deflate-compressed JSON (shorter, can hold a portrait); plain codes also accepted */
const CAN_ZIP=typeof CompressionStream==="function"&&typeof DecompressionStream==="function";
function bytesToB64u(buf){let bin="";for(let i=0;i<buf.length;i+=0x8000)bin+=String.fromCharCode.apply(null,buf.subarray(i,i+0x8000));return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
async function zip(str){const st=new Blob([str]).stream().pipeThrough(new CompressionStream("deflate-raw"));return bytesToB64u(new Uint8Array(await new Response(st).arrayBuffer()));}
async function unzip(b){
  b=b.replace(/-/g,"+").replace(/_/g,"/");while(b.length%4)b+="=";
  const bin=atob(b),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
  const txt=await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  if(txt.length>2e6)throw new Error("too large");
  return txt;
}
async function parseAny(c){
  c=cleanCode(c);
  if(c.startsWith("z.")){if(!CAN_ZIP||c.length>3e6)return null;try{return parseRaw(JSON.parse(await unzip(c.slice(2))));}catch(e){return null;}}
  return parseCode(c);
}
function premadeState(p){
  if(!p)return null;
  const r=parseRaw([CODE_V,"","","D",p.level,(p.trees||[]).map(x=>x&&x[0]?[x[0],x[1]||0]:0)]);
  return r?r.st:null;
}

/* ================= history: undo / redo / autosave ================= */
const H={list:[],i:-1};
const HIST_MAX=80;
function imgRef(st){
  if(st.imageKey)return "idb:"+st.imageKey;
  if(!st.image)return null;
  if(st.image.startsWith("https://"))return st.image;
  st.imageKey=imgKeyOf(st.image);
  if(!imgStore.peek(st.imageKey))imgStore.put(st.imageKey,st.image);
  return "idb:"+st.imageKey;
}
function applyImgRef(st,ref){
  st.image=null;st.imageKey=null;
  if(!ref||typeof ref!=="string")return;
  if(ref.startsWith("https://")){st.image=safeImg(ref);return;}
  if(!ref.startsWith("idb:"))return;
  const k=ref.slice(4);st.imageKey=k;st.image=imgStore.peek(k)||null;
  if(!st.image)imgStore.get(k).then(v=>{
    if(!v||st.imageKey!==k||st.image)return;
    st.image=v;
    if(st===S){renderIdentity();renderSummary();if($("#card").open)patch($("#cardBody"),charCard(S,true));}
    if(st===CB&&$("#cmp").open)renderCompare();
  });
}
const snapOf=st=>JSON.stringify([st.name,st.epithet,st.flavor,st.rank,st.level,st.trees,st.spent,imgRef(st)]);
function fromSnap(s){
  const a=JSON.parse(s);
  const st={...blank(),name:a[0]||"",epithet:a[1]||"",flavor:a[2]||"",rank:RANKS.includes(a[3])?a[3]:"D",level:a[4]||1,
    trees:Array.isArray(a[5])?a[5].slice(0,3).map(id=>tree(id)?id:null):[null,null,null],spent:{}};
  while(st.trees.length<3)st.trees.push(null);
  Object.keys(a[6]||{}).forEach(id=>{if(st.trees.includes(id))st.spent[id]=a[6][id];});
  applyImgRef(st,a[7]);
  return st;
}
const saveHist=debounce(()=>{
  if(store.set(KEY.hist,{i:H.i,list:H.list}))return;
  const cut=Math.max(0,H.list.length-15);                               /* storage full: keep the newest steps */
  if(!store.set(KEY.hist,{i:Math.max(0,H.i-cut),list:H.list.slice(cut)}))store.del(KEY.hist);
},400);
function loadHist(){
  const h=store.get(KEY.hist,null);
  if(h&&Array.isArray(h.list)&&h.list.length){H.list=h.list.filter(s=>typeof s==="string");H.i=Math.min(Math.max(0,h.i|0),H.list.length-1);}
}
function commit(){
  commitSoon.cancel();
  const s=snapOf(S);
  if(H.i>=0&&H.list[H.i]===s)return;
  H.list=H.list.slice(0,H.i+1);H.list.push(s);
  if(H.list.length>HIST_MAX)H.list.splice(0,H.list.length-HIST_MAX);
  H.i=H.list.length-1;
  saveHist();updateUndo();syncHash();
}
const commitSoon=debounce(commit,700);   /* typing: one undo step per pause */
function undo(){commitSoon.flush();if(H.i<=0)return;H.i--;restore(H.list[H.i]);}
function redo(){commitSoon.flush();if(H.i>=H.list.length-1)return;H.i++;restore(H.list[H.i]);}
function restore(s){S=fromSnap(s);MOVE=null;renderAll();saveHist();updateUndo();syncHash();}
function updateUndo(){$("#btnUndo").disabled=H.i<=0;$("#btnRedo").disabled=H.i>=H.list.length-1;}

/* the URL always carries the current build (debounced: Safari allows ~100 URL updates per 30 s) */
let LAST_HASH="";
const syncHash=debounce(()=>{
  LAST_HASH=isBlank(S)?"":code();
  try{history.replaceState(null,"",LAST_HASH?"#"+LAST_HASH:location.pathname+location.search);}catch(e){}
},350);

/* ================= portraits ================= */
/* Square-crop (cover) and resize with good quality: big reductions go in halving steps.
   The first canvas is capped at 2048 px so large phone photos stay under Safari's canvas limit. */
function squareImg(img,size,q){
  const sw=img.naturalWidth||img.width,sh=img.naturalHeight||img.height,side=Math.min(sw,sh);
  if(!side)throw new Error("empty image");
  let cur=Math.min(side,2048);
  let src=document.createElement("canvas");src.width=src.height=cur;
  const c0=src.getContext("2d");c0.imageSmoothingEnabled=true;c0.imageSmoothingQuality="high";
  c0.drawImage(img,(sw-side)/2,(sh-side)/2,side,side,0,0,cur,cur);
  while(cur/2>=size){
    const n=document.createElement("canvas");n.width=n.height=Math.round(cur/2);
    const x=n.getContext("2d");x.imageSmoothingEnabled=true;x.imageSmoothingQuality="high";
    x.drawImage(src,0,0,n.width,n.height);src=n;cur=n.width;
  }
  const out=document.createElement("canvas"),o=Math.min(size,cur);out.width=out.height=o;
  const c=out.getContext("2d");c.imageSmoothingEnabled=true;c.imageSmoothingQuality="high";
  c.fillStyle="#151823";c.fillRect(0,0,o,o);
  c.drawImage(src,0,0,o,o);
  for(let qq=q;qq>=0.5;qq-=0.1){
    let d=out.toDataURL("image/webp",qq);if(!d.startsWith("data:image/webp"))d=out.toDataURL("image/jpeg",qq);
    if(d.length<580000)return d;
  }
  return out.toDataURL("image/jpeg",0.5);
}
function loadImage(src,cors){return new Promise((res,rej)=>{const i=new Image();if(cors)i.crossOrigin="anonymous";i.onload=()=>res(i);i.onerror=()=>rej(new Error("image"));i.src=src;});}
function setImage(v){
  S.image=v||null;S.imageKey=null;
  if(S.image&&S.image.startsWith("data:"))imgRef(S);
  renderIdentity();renderSummary();commit();
}
async function portraitFromFile(f,msg){
  if(!f)return;
  if(f.type&&!/^image\//.test(f.type)){toast("That file isn't an image");return;}
  const url=URL.createObjectURL(f);
  try{const img=await loadImage(url);setImage(squareImg(img,512,0.9));if(msg)toast(msg);}
  catch(e){toast("That file couldn't be read as an image");}
  finally{URL.revokeObjectURL(url);}
}
async function portraitFromUrl(v){
  v=String(v||"").trim();
  if(!v){if(urlImage(S))setImage(null);return;}
  const u=safeImg(v);
  if(!u||!u.startsWith("https://")){toast("Use a direct https:// link to an image");$("#inpImg").value=urlImage(S)||"";return;}
  if(u===S.image)return;
  try{await Promise.race([loadImage(u),new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),10000))]);}
  catch(e){toast("Couldn't load that image. The link has to open the image itself.",{ms:5000});return;}
  setImage(u);
  if(/discordapp\.(com|net)|discord\.com/i.test(u))toast("Heads up: Discord image links expire after about a day. Imgur or catbox links last.",{ms:7000});
}
function thumb(src,size){return new Promise(res=>{if(!src||!src.startsWith("data:"))return res(src||null);const img=new Image();img.onload=()=>{try{res(squareImg(img,size||128,0.72));}catch(e){res(null);}};img.onerror=()=>res(null);img.src=src;});}

/* ================= keyword hovers =================
   data/keywords.js lists the mechanics; skill names inside their own tree link automatically.
   Longest match wins at each position; only the first occurrence per skill is underlined. */
const KW=KEYWORDS.map(k=>({...k,m:k.m||rxEsc(k.k),cs:k.cs===undefined?1:k.cs}));
const KW_BY_K=Object.create(null);KW.forEach(k=>{KW_BY_K[k.k]=k;});
function srcRef(src){
  if(!src)return null;const p=src.indexOf("/"),t=tree(src.slice(0,p)),rest=src.slice(p+1);
  if(!t)return null;if(rest==="curse"||rest==="note")return{t,kind:rest};
  const i=t.sk.findIndex(s=>s.n===rest);return i<0?null:{t,kind:"skill",i};
}
KW.forEach(k=>{k.ref=srcRef(k.src);});
const skillPat=n=>{const b=rxEsc(n);return /s$/.test(n)?b.slice(0,-1)+"s?":b+"s?";};
const MATCHERS=Object.create(null);
function matcher(t){
  if(MATCHERS[t.id])return MATCHERS[t.id];
  const list=[];
  KW.forEach(k=>{if(k.link===0||(k.tree&&k.tree!==t.id))return;list.push({type:"k",key:k.k,re:k.m,cs:k.cs,nb:k.nb,ref:k.ref,pri:k.tree?3:1});});
  t.sk.forEach((s,i)=>list.push({type:"s",key:t.id+":"+i,re:skillPat(s.n),cs:1,idx:i,pri:2}));
  list.forEach(e=>{e.y=new RegExp("(?:"+e.re+")\\b","iy");});
  return(MATCHERS[t.id]={any:new RegExp("\\b(?:"+list.map(e=>e.re).join("|")+")\\b","gi"),list});
}
/* c = {t: tree, self: {kind:"skill"|"curse"|"note", i}, seen: Set} → HTML */
function linkify(text,c){
  text=escT(text);
  const M=matcher(c.t);let out="",last=0,m;M.any.lastIndex=0;
  while((m=M.any.exec(text))){
    const pos=m.index;let best=null,bl=0;
    for(const e of M.list){e.y.lastIndex=pos;const r=e.y.exec(text);if(r&&(r[0].length>bl||(r[0].length===bl&&best&&e.pri>best.pri))){best=e;bl=r[0].length;}}
    if(!best||!bl){M.any.lastIndex=pos+1;continue;}
    M.any.lastIndex=pos+bl;
    const w=text.substr(pos,bl);
    if(best.cs&&w[0]!==w[0].toUpperCase())continue;
    if(best.nb&&text.slice(Math.max(0,pos-best.nb.length),pos)===best.nb)continue;
    if(best.type==="s"&&c.self.kind==="skill"&&best.idx===c.self.i)continue;
    if(best.type==="k"&&best.ref&&best.ref.t===c.t&&best.ref.kind===c.self.kind&&(best.ref.kind!=="skill"||best.ref.i===c.self.i))continue;
    if(c.seen.has(best.key))continue;
    c.seen.add(best.key);
    out+=text.slice(last,pos)+(best.type==="s"
      ?'<span class="gl sk" tabindex="0" data-s="'+best.key+'">'+w+'</span>'
      :'<span class="gl" tabindex="0" data-k="'+esc(best.key)+'">'+w+'</span>');
    last=pos+bl;
  }
  return out+text.slice(last);
}
const subList=(s,fmt)=>s&&s.length?'<ul>'+s.map(x=>'<li>'+(x[0]?'<i>'+escT(x[0])+':</i> ':'')+fmt(x[1])+'</li>').join("")+'</ul>':"";
const SRC_CACHE=Object.create(null);
function srcInfo(k){
  const r=k.ref;if(!r)return null;
  if(SRC_CACHE[k.src])return SRC_CACHE[k.src];
  let label,html;
  if(r.kind==="skill"){
    const sk=r.t.sk[r.i];label=r.t.n+" › "+sk.n+" ("+plural(sk.t,"pt")+")";
    html=(sk.x?'<div>'+escT(sk.x)+'</div>':'')+subList(sk.s,escT)+(sk.h||[]).map(h=>'<div class="thalf"><i>'+escT(h[0]+" · "+h[1])+'</i><div>'+escT(h[3])+'</div></div>').join("");
  }else if(r.kind==="curse"){
    const cu=r.t.cu;label=r.t.n+" · Curse: "+cu[0];html='<div>'+escT(cu[1])+'</div>'+subList(cu[2],escT);
  }else{
    const n=(r.t.no||[])[0]||["",""];label=r.t.n+(n[0]?" · "+n[0]:"");html='<div>'+escT(n[1])+'</div>';
  }
  return(SRC_CACHE[k.src]={label,html});
}
function kwTip(key){
  const k=KW_BY_K[key];if(!k)return "";
  let h='<b>'+esc(k.k)+'</b>';const s=srcInfo(k);
  if(k.d){h+='<div>'+escT(k.d)+'</div>';if(s)h+='<div class="tdef">Defined in '+esc(s.label)+'</div>';}
  else if(s)h+='<div class="tmeta">'+esc(s.label)+'</div>'+s.html;
  return h;
}
/* full skill card for tooltips (plain text: a tooltip can't be hovered into) */
function skillTip(ref,lk){
  const r=skillAt(ref);if(!r)return "";const{t,sk}=r;
  const locked=lk!==undefined?lk==="1":(S.spent[t.id]||0)<sk.t;
  let h='<div class="thead">'+skImg(sk,t)+'<div><b>'+esc(sk.n)+(sk.c?" ★":"")+'</b><div class="tmeta">'+esc(t.n)+' · '+plural(sk.t,"pt")+' · '+sk.g.map(esc).join(" · ")+'</div>'+(locked?'<div class="tlock">Locked · unlocks at '+plural(sk.t,"pt")+'</div>':'')+'</div></div>';
  if(sk.x)h+='<div>'+escT(sk.x)+'</div>';
  h+=subList(sk.s,escT);
  if(sk.f)h+='<ul>'+sk.f.map(f=>'<li><i>Circle '+escT(f[0])+', '+escT(f[1])+':</i> '+escT(f[2])+(f[3]?' <span class="tmeta">Passive: '+escT(f[3])+'</span>':'')+'</li>').join("")+'</ul>';
  if(sk.h)h+=sk.h.map(x=>'<div class="thalf"><i>'+escT(x[0])+' · '+escT(x[1])+'</i> <span class="tmeta">'+x[2].map(escT).join(" · ")+'</span><div>'+escT(x[3])+'</div></div>').join("");
  return h;
}

/* ================= "Applies" (what the build puts on targets) ================= */
function appliesOf(st){
  const out=Object.create(null);
  st.trees.forEach(id=>{if(!id)return;const t=tree(id),cur=st.spent[id]||0;t.sk.forEach(s=>{if(cur>=s.t&&s.ap)s.ap.forEach(a=>{(out[a]=out[a]||[]).push(s.n);});});});
  return out;
}
const AP_GROUPS=[["dot","Damage over time"],["debuff","Debuffs"],["control","Control"],["mark","Marks"]];
function appliesHTML(st){
  if(!APPLIES.length||!equipped(st).length)return "";
  const a=appliesOf(st);
  const rows=AP_GROUPS.map(([g,lab])=>{
    const items=APPLIES.filter(x=>x.g===g&&a[x.k]);if(!items.length)return "";
    return '<div class="apgrp"><span class="glab">'+lab+'</span>'+items.map(x=>'<span class="apchip" tabindex="0" data-ap="'+esc(x.k)+'">'+esc(x.k)+(a[x.k].length>1?'<small>×'+a[x.k].length+'</small>':'')+'</span>').join("")+'</div>';
  }).join("");
  return '<div class="applies"><h4>Applies</h4>'+(rows||'<div class="apempty">Nothing yet: the unlocked skills don\'t put statuses on targets.</div>')+'</div>';
}
function applyTip(k){
  const ap=APPLIES.find(x=>x.k===k),kw=KW_BY_K[(ap&&ap.kw)||k],from=appliesOf(S)[k]||[];
  let h='<b>'+esc(k)+'</b>';
  if(ap&&ap.d)h+='<div>'+escT(ap.d)+'</div>';
  else if(kw){if(kw.d)h+='<div>'+escT(kw.d)+'</div>';else{const s=srcInfo(kw);if(s)h+=s.html;}}
  if(from.length)h+='<div class="tdef">From '+from.map(esc).join(", ")+'</div>';
  return h;
}

/* ================= render ================= */
function renderAll(){renderIdentity();renderSlots();renderPoints();renderTrees();renderSummary();}

function renderIdentity(){
  const a=document.activeElement;
  const setV=(sel,v)=>{const el=$(sel);if(el!==a&&el.value!==String(v))el.value=v;};
  setV("#inpName",S.name);setV("#inpEpithet",S.epithet);setV("#inpFlavor",S.flavor||"");setV("#inpLevel",S.level);
  setV("#inpImg",urlImage(S)||"");
  $("#selRank").value=S.rank;
  const p=$("#portrait"),has=!!S.image;
  p.style.backgroundImage=has?'url("'+S.image+'")':"";
  p.classList.toggle("has",has);
  p.innerHTML=has?'<span class="vh">Change portrait</span>':'add<br>portrait';
  p.setAttribute("aria-label",has?"Change portrait":"Upload a portrait");
  $("#portraitDel").hidden=!has&&!S.imageKey;
}

/* ---- slots ---- */
function canMove(src,dst){
  if(src===dst)return false;
  const birth=dst===0?S.trees[src]:src===0?S.trees[dst]:S.trees[0];   /* what would sit in the birth slot */
  return !birth||tree(birth).ty===MAIN;
}
function slotHTML(idx){
  const id=S.trees[idx],t=id?tree(id):null,label=SLOTN[idx];
  let cls="slot"+(t?" filled":"");
  let hint="";
  if(MOVE!==null){
    cls+=MOVE===idx?" moving":canMove(MOVE,idx)?" target":" nodrop";
    hint=MOVE===idx?'<span class="mvhint">Moving · pick a slot, or this one to cancel</span>'
      :canMove(MOVE,idx)?'<span class="mvhint ok">'+(t?"Swap here":"Move here")+'</span>':'<span class="mvhint">Birth tree must be a Main Class tree</span>';
  }
  if(!t)return '<div class="'+cls+'" data-slot="'+idx+'"><button class="slotmain" data-act="slot" data-slot="'+idx+'" aria-label="'+label+': empty, choose a tree"><span class="slotlab">'+label+'</span><span class="plus">+ choose a tree</span>'+hint+'</button></div>';
  const inv=S.spent[t.id]||0,mx=maxTier(t),pct=Math.min(100,inv/mx*100);
  const tools='<div class="slottools">'
    +'<button class="lock mv'+(MOVE===idx?" on":"")+'" data-act="move" data-slot="'+idx+'" title="Move or swap this tree (points are kept)" aria-label="Move '+esc(t.n)+'" aria-pressed="'+(MOVE===idx)+'">⇄</button>'
    +'<button class="lock'+(LOCK[idx]?" on":"")+'" data-act="lock" data-slot="'+idx+'" title="'+(LOCK[idx]?"Locked: Random keeps this tree and its points":"Lock this tree for Random")+'" aria-label="Lock '+esc(t.n)+' for Random" aria-pressed="'+LOCK[idx]+'">'+(LOCK[idx]?"🔒":"🔓")+'</button></div>';
  return '<div class="'+cls+'" data-slot="'+idx+'" draggable="true" style="border-color:'+RARC[t.r]+'">'
    +'<button class="slotmain" data-act="slot" data-slot="'+idx+'" aria-label="'+label+': '+esc(t.n)+', '+inv+' of '+mx+' points, change tree">'
    +'<span class="slotlab">'+label+(idx===0?' ♛':'')+'</span><span class="tname">'+treeIco(t)+esc(t.n)+'</span>'+badge(t)+' <span class="pts">'+inv+'/'+mx+' pts</span>'
    +'<span class="pbar"><i style="width:'+pct+'%;background:'+RARC[t.r]+'"></i></span>'+hint+'</button>'+tools+'</div>';
}
function renderSlots(){LOCK=LOCK.map((l,i)=>l&&!!S.trees[i]);patch($("#slots"),[0,1,2].map(slotHTML).join(""));}
/* during a drag, only toggle classes: replacing the dragged element would cancel its dragend */
function markMoveTargets(){
  $$("#slots .slot").forEach(el=>{const i=+el.dataset.slot;el.classList.toggle("moving",MOVE===i);el.classList.toggle("target",MOVE!==null&&MOVE!==i&&canMove(MOVE,i));el.classList.toggle("nodrop",MOVE!==null&&MOVE!==i&&!canMove(MOVE,i));});
}

/* ---- points bar ---- */
function renderPoints(){
  const sp=sumSpent(S),left=S.level-sp;
  const seg=equipped().map(id=>{const t=tree(id),v=S.spent[id]||0;return '<i title="'+esc(t.n)+': '+plural(v,"pt")+'" style="flex:'+v+';background:'+RARC[t.r]+'"></i>';}).join("")+(left>0?'<i class="free" style="flex:'+left+'"></i>':'');
  patch($("#pointsInfo"),'<span class="left'+(left<0?" over":"")+'">'+(left<0?(-left)+" over budget":left+" left")+'</span>'
    +(left<0?'<button class="btn-trim" data-act="trim" title="Keeps the birth tree first, then Sub tree 1, then Sub tree 2, and removes only the tiers that no longer fit">Trim to level</button>':'')
    +'<span class="ptsdet">Level '+S.level+' · '+sp+'/'+S.level+' spent</span><span class="ptsseg" aria-hidden="true">'+seg+'</span>');
}

/* ---- tree panels ---- */
const curseText=t=>[t.cu?t.cu[0]:"",t.cu?t.cu[1]:"",...((t.cu&&t.cu[2])||[]).flat(),...(t.no||[]).flat()].join(" ").toLowerCase();
function curseBox(t){
  if(!t.cu&&!t.no)return "";
  const seen=new Set();
  const notes=(t.no||[]).map(x=>'<div style="margin-top:6px"><b>'+escT(x[0])+':</b> '+linkify(x[1],{t,self:{kind:"note"},seen})+'</div>').join("");
  if(!t.cu)return '<div class="curse">'+notes+'</div>';
  const c={t,self:{kind:"curse"},seen};
  return '<div class="curse"><b>Curse · '+escT(t.cu[0])+':</b> '+linkify(t.cu[1],c)+subList(t.cu[2],x=>linkify(x,c))+notes+'</div>';
}
function formTable(f,c){return '<table class="ftab"><tr><th>Circle</th><th>Form</th><th>Effect</th></tr>'+f.map(r=>'<tr><td>'+escT(r[0])+'</td><td><b>'+escT(r[1])+'</b></td><td>'+linkify(r[2],c)+(r[3]?'<br><i class="muted">Passive: '+linkify(r[3],c)+'</i>':'')+'</td></tr>').join("")+'</table>';}
function halves(h,c){return '<div class="halves">'+h.map(x=>'<div class="half"><div class="hside">'+escT(x[0])+'</div><b>'+escT(x[1])+'</b> <span class="tags">'+x[2].map(escT).join(" · ")+'</span><div>'+linkify(x[3],c)+'</div></div>').join("")+'</div>';}
function skillBody(sk,t,i){
  const c={t,self:{kind:"skill",i},seen:new Set()};
  return '<div>'+linkify(sk.x||"",c)+subList(sk.s,x=>linkify(x,c))+(sk.f?formTable(sk.f,c):'')+(sk.h?halves(sk.h,c):'')+'</div>';
}
function skillRow(sk,t,i,unlocked,open,key){
  return '<details class="sk '+(unlocked?"on":"off")+'"'+(key?' data-sk="'+key+'"':'')+(open?' open':'')+'><summary><span class="chip">'+sk.t+'</span>'+skImg(sk,t)+'<b>'+esc(sk.n)+'</b>'+(sk.c?' <span class="star" title="Capstone">★</span>':'')+' <span class="tags">'+sk.g.map(esc).join(" · ")+'</span></summary><div class="body">'+skillBody(sk,t,i)+'</div></details>';
}
/* Investing: click a skill to put points up to its tier. Clicking the highest unlocked skill again
   steps back down to the tier before it. Hovering previews what would unlock or be removed. */
function prevTier(t,T){return tiersOf(t).filter(x=>x<T).pop()||0;}
function tierTarget(t,i){const T=t.sk[i].t,cur=S.spent[t.id]||0;return cur===T?prevTier(t,T):T;}
function tierStrip(t){
  const cur=S.spent[t.id]||0,total=sumSpent(S);
  return '<div class="tstrip" data-id="'+t.id+'" role="group" aria-label="'+esc(t.n)+' skills: click one to invest up to it">'+t.sk.map((s,i)=>{
    const on=cur>=s.t,afford=on||(total-cur+s.t)<=S.level,top=cur===s.t;
    const lab=top?s.n+": unlocked, click to go back to "+plural(prevTier(t,s.t),"pt"):on?s.n+": unlocked, click to set "+plural(s.t,"pt"):s.n+": "+plural(s.t,"pt")+" to unlock"+(afford?"":" (not enough points)");
    return '<button type="button" class="cskill tskill'+(on?"":" locked")+(s.c?" cap":"")+(top?" top":"")+(afford?"":" no")+'" data-act="tier-sk" data-id="'+t.id+'" data-i="'+i+'" data-s="'+t.id+':'+i+'" aria-label="'+esc(lab)+'" aria-pressed="'+on+'">'
      +'<span class="tsimg">'+skImg(s,t)+'<span class="tpt">'+s.t+'</span></span><span class="cname">'+esc(s.n)+'</span></button>';
  }).join("")+'</div>';
}
function tierHint(t,cur){
  const nx=nextTier(t,cur);
  return nx?"Next at "+plural(nx,"pt")+": "+t.sk.filter(s=>s.t===nx).map(s=>esc(s.n)).join(", "):"Tree fully unlocked";
}
function treeBox(t){
  const cur=S.spent[t.id]||0,mx=maxTier(t);
  const open=TREE_OPEN.has(t.id),got=t.sk.filter(s=>cur>=s.t).length;
  let body="";
  if(open){
    const all=t.sk.map((sk,i)=>[sk,i]).sort((a,b)=>a[0].t-b[0].t);
    const shown=PREFS.onlyUnlocked?all.filter(([sk])=>cur>=sk.t):all;
    const hidden=all.length-shown.length;
    const keys=shown.map(([,i])=>t.id+":"+i),allOpen=keys.length>0&&keys.every(k=>OPEN.has(k));
    body='<div class="sklist">'+curseBox(t)+'<div class="sktools">'
      +(keys.length?'<button class="lnk" data-act="tree-skills" data-id="'+t.id+'" data-v="'+(allOpen?0:1)+'">'+(allOpen?"Collapse skills":"Expand skills")+'</button>':'')
      +(hidden?'<span>'+plural(hidden,"locked skill")+' hidden</span>':'')+'</div>'
      +(shown.length?shown.map(([sk,i])=>skillRow(sk,t,i,cur>=sk.t,OPEN.has(t.id+":"+i),t.id+":"+i)).join(""):'<div class="skempty">No skills unlocked yet. Click a skill above to invest.</div>')+'</div>';
  }
  return '<div class="treebox"><button class="treehead" data-act="tree-toggle" data-id="'+t.id+'" aria-expanded="'+open+'" title="'+(open?"Hide skill details":"Show skill details")+'">'+treeIco(t)+'<span class="thinfo"><span class="tname">'+esc(t.n)+'</span>'+badge(t)+'<span class="pts">'+cur+'/'+mx+' pts · '+got+'/'+t.sk.length+' skills</span></span><span class="chev'+(open?" up":"")+'" aria-hidden="true">▾</span></button>'
    +'<div class="tbar"><i style="width:'+(cur/mx*100)+'%;background:'+RARC[t.r]+'"></i></div>'
    +tierStrip(t)
    +'<div class="thint"><span class="nhint" data-hint="'+t.id+'">'+tierHint(t,cur)+'</span>'
    +(cur?'<button class="lnk" data-act="tier" data-id="'+t.id+'" data-t="0">Clear points</button>':'')+'</div>'+body+'</div>';
}
/* hover / focus preview on the skill strip */
function tierPreview(btn){
  const strip=btn&&btn.closest(".tstrip");if(!strip)return;
  const t=tree(strip.dataset.id),cur=S.spent[t.id]||0,T=tierTarget(t,+btn.dataset.i),total=sumSpent(S);
  strip.querySelectorAll(".tskill").forEach(b=>{const k=t.sk[+b.dataset.i].t;b.classList.toggle("pv-add",k>cur&&k<=T);b.classList.toggle("pv-rem",k<=cur&&k>T);});
  const h=strip.parentNode.querySelector("[data-hint]");if(!h)return;
  const d=T-cur,left=S.level-(total-cur+T);
  h.innerHTML=d===0?tierHint(t,cur):(d>0?"+":"−")+plural(Math.abs(d),"pt")+" → "+T+"/"+maxTier(t)+" in this tree"+(left<0?' <span class="over">('+(-left)+" over your level)</span>":" · "+plural(left,"pt")+" left after");
}
function tierPreviewEnd(strip){
  if(!strip)return;strip.querySelectorAll(".pv-add,.pv-rem").forEach(b=>b.classList.remove("pv-add","pv-rem"));
  const t=tree(strip.dataset.id),h=strip.parentNode.querySelector("[data-hint]");if(t&&h)h.innerHTML=tierHint(t,S.spent[t.id]||0);
}
function renderTrees(){
  const eq=equipped().map(tree);
  patch($("#trees"),eq.length?eq.map(treeBox).join(""):'<div class="treebox empty">Pick your trees above to start spending points.</div>');
  patch($("#treeTools"),eq.length?'<button class="lnk" data-act="all-skills" data-v="1">Expand all</button><button class="lnk" data-act="all-skills" data-v="0">Collapse all</button><label class="tgl-only"><input type="checkbox" id="onlyUnlocked"'+(PREFS.onlyUnlocked?" checked":"")+'> Unlocked skills only</label>':"");
}

/* ---- character card: summary panel, pop-out, PNG ---- */
function portraitHTML(st){
  return st.image?'<div class="cport" style="background-image:url(\''+esc(st.image).replace(/'/g,"%27")+'\')"></div>'
    :'<div class="cport empty">'+esc(((st.name||"?").trim()[0]||"?").toUpperCase())+'</div>';
}
function cardHead(st,o){
  const nm=st.name||"Unnamed",ep=(st.epithet||"").trim();
  const showEp=ep&&ep.toLowerCase()!==(st.name||"").trim().toLowerCase();
  return '<div class="chead">'+portraitHTML(st)+'<div class="cid">'+(o.label?'<div class="slotlab">'+esc(o.label)+'</div>':'')+'<h3>'+esc(nm)+'</h3>'+(showEp?'<div class="ep">'+esc(ep)+'</div>':'')
    +'<div class="row">'+rankBadge(st)+'<span class="chip">Lv '+st.level+'</span>'+(o.pts?'<span class="chip">'+plural(sumSpent(st),"pt")+'</span>':'')+'</div>'
    +(!o.noFlavor&&(st.flavor||"").trim()?'<p class="cflav">'+esc(st.flavor.trim())+'</p>':'')+'</div></div>';
}
function charCard(st,big){
  let h=cardHead(st,{});
  if(!equipped(st).length)return h+'<p class="cempty">No skill trees chosen yet.</p>';
  h+=st.trees.map((id,idx)=>{
    if(!id)return "";
    const t=tree(id),cur=st.spent[id]||0,mx=maxTier(t),got=t.sk.filter(s=>cur>=s.t).length;
    return '<div class="ctree"><div class="cth">'+treeIco(t)+'<div class="ctn">'+(big?'<span class="clab">'+(idx===0?"Birth tree":"Sub tree")+'</span>':'')+'<b>'+esc(t.n)+'</b></div><span class="ccount">'+got+'/'+t.sk.length+'</span></div>'
      +'<div class="cbar"><i style="width:'+(cur/mx*100)+'%;background:'+RARC[t.r]+'"></i></div>'
      +'<div class="cicons">'+t.sk.map((s,i)=>{const on=cur>=s.t;return '<button type="button" class="cskill'+(on?"":" locked")+(s.c?" cap":"")+'" data-s="'+t.id+':'+i+'" aria-label="'+esc(s.n)+(on?"":" (locked)")+'">'+skImg(s,t)+(big?'<span class="cname">'+esc(s.n)+'</span>':'')+'</button>';}).join("")+'</div></div>';
  }).join("");
  return h+appliesHTML(st);
}
function renderSummary(){
  patch($("#summary"),'<button class="cpop" data-act="card" title="Open as a character card" aria-label="Open as a character card">⤢</button><div class="ccard cclick" data-act="card" title="Open as a character card">'+charCard(S,false)+'</div>');
  if($("#card").open)patch($("#cardBody"),charCard(S,true));
}

/* ================= actions ================= */
function setSpent(id,T){
  const cur=S.spent[id]||0;if(T===cur)return;
  if(T>cur&&(sumSpent(S)-cur+T)>S.level){toast("Not enough points: level "+S.level+" gives "+plural(S.level,"point"));return;}
  if(T<=0)delete S.spent[id];else S.spent[id]=T;
  renderSlots();renderPoints();renderTrees();renderSummary();commit();
}
/* Keep the birth tree first, then Sub tree 1, then Sub tree 2: each keeps its highest tier that
   still fits the points left, so only the tiers that don't fit are removed and none are wasted. */
function trimToLevel(){
  if(sumSpent(S)<=S.level)return;
  let budget=S.level;
  S.trees.forEach(id=>{
    if(!id)return;
    const keep=tiersOf(tree(id)).filter(T=>T<=Math.min(S.spent[id]||0,budget)).pop()||0;
    if(keep)S.spent[id]=keep;else delete S.spent[id];
    budget-=keep;
  });
  renderAll();commit();toast("Trimmed to fit level "+S.level,{action:"Undo",fn:undo});
}
function setLevel(v,typing){
  const n=parseInt(v,10);
  if(typing&&!(n>=1))return;                          /* empty or partial input: wait */
  const L=Math.max(1,Math.min(100,n||1));
  if(L===S.level){if(!typing&&$("#inpLevel").value!==String(L))$("#inpLevel").value=L;return;}
  S.level=L;renderSlots();renderPoints();renderTrees();renderSummary();
  if(typing)commitSoon();else commit();
}
/* Rank is cosmetic. Until a rank is picked by hand, a support birth tree defaults to Unranked
   and leaving support moves it to E; a hand-picked rank is never changed. */
function applyBirthRank(id){
  if(RANK_PINNED)return;
  const sup=tree(id).c==="support";if(sup&&S.rank!=="U")S.rank="U";else if(!sup&&S.rank==="U")S.rank="E";
}
/* after loading a build: a rank that the defaults wouldn't give must have been picked by hand */
function inferRankPin(){const b=S.trees[0]&&tree(S.trees[0]);RANK_PINNED=!!b&&(b.c==="support")!==(S.rank==="U");}

function startMove(idx){MOVE=MOVE===idx?null:idx;renderSlots();}
function slotActivate(idx){
  if(MOVE===null){openPicker(idx);return;}
  if(MOVE===idx){MOVE=null;renderSlots();return;}
  if(canMove(MOVE,idx))doMove(MOVE,idx);
}
function doMove(src,dst){
  const a=S.trees[src],b=S.trees[dst];
  S.trees[src]=b;S.trees[dst]=a;
  [LOCK[src],LOCK[dst]]=[LOCK[dst],LOCK[src]];
  if((src===0||dst===0)&&S.trees[0])applyBirthRank(S.trees[0]);
  MOVE=null;renderAll();commit();
  toast(b?"Swapped "+tree(a).n+" and "+tree(b).n:"Moved "+tree(a).n+" to "+SLOTN[dst]);
}

/* ---- random: birth tree is always a main class tree; at most one cursed tree (~30%, sub slots);
   Legendary trees can land in any slot; locked slots keep their tree and points;
   a hand-picked rank is kept (rank is cosmetic, so it never limits which trees roll) ---- */
function randomBuild(){
  commitSoon.flush();
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const trees=[null,null,null],spent={};
  LOCK.forEach((l,i)=>{if(l&&S.trees[i])trees[i]=S.trees[i];else LOCK[i]=false;});
  trees.forEach(id=>{if(id&&S.spent[id])spent[id]=S.spent[id];});
  const used=()=>trees.filter(Boolean);
  if(!trees[0])trees[0]=pick(TREES.filter(t=>t.ty===MAIN&&!used().includes(t.id))).id;
  const free=[1,2].filter(i=>!trees[i]);
  if(free.length&&!used().some(id=>tree(id).c==="cursed")&&Math.random()<0.3)trees[pick(free)]=pick(TREES.filter(t=>t.c==="cursed")).id;
  [1,2].forEach(i=>{if(!trees[i])trees[i]=pick(TREES.filter(t=>t.c!=="cursed"&&!used().includes(t.id))).id;});
  const lockedPts=Object.values(spent).reduce((a,b)=>a+b,0),floor=Math.max(1,lockedPts);
  const level=floor+Math.floor(Math.random()*(101-floor));
  const open=trees.filter((id,i)=>!LOCK[i]);
  let rem=level-lockedPts,guard=0;
  while(guard++<400){
    const cands=open.filter(id=>tiersOf(tree(id)).some(T=>T>(spent[id]||0)&&T-(spent[id]||0)<=rem));
    if(!cands.length)break;
    const id=pick(cands),cur=spent[id]||0,T=pick(tiersOf(tree(id)).filter(T=>T>cur&&T-cur<=rem));
    rem-=T-cur;spent[id]=T;
  }
  const rank=RANK_PINNED?S.rank:tree(trees[0]).c==="support"?"U":pick(RANKS.slice(1));
  /* name, title, flavor and portrait are the character, not the build: Random never touches them */
  S={...blank(),name:S.name,epithet:S.epithet,flavor:S.flavor,image:S.image,imageKey:S.imageKey,rank,level,trees,spent};
  MOVE=null;CURRENT_SAVE=null;renderAll();commit();
  toast("Random build: Lv "+level+" · "+tree(trees[0]).n,{action:"Undo",fn:undo});
}
function resetAll(){
  commitSoon.flush();
  const had=!isBlank(S);
  S=blank();LOCK=[false,false,false];RANK_PINNED=false;OPEN.clear();TREE_OPEN.clear();MOVE=null;CURRENT_SAVE=null;
  renderAll();commit();
  if(had)toast("Everything reset",{action:"Undo",fn:undo});
}
function toggleTree(id){TREE_OPEN.has(id)?TREE_OPEN.delete(id):TREE_OPEN.add(id);renderTrees();}
function setTreeSkills(id,open){tree(id).sk.forEach((s,i)=>{const k=id+":"+i;open?OPEN.add(k):OPEN.delete(k);});renderTrees();}
function setAllSkills(open){equipped().forEach(id=>{open?TREE_OPEN.add(id):TREE_OPEN.delete(id);tree(id).sk.forEach((s,i)=>{const k=id+":"+i;open?OPEN.add(k):OPEN.delete(k);});});renderTrees();}
/* keep the build's identity, swap in another build's trees/points/level */
function loadBuildOnly(st){S={...S,level:st.level,trees:st.trees.slice(),spent:{...st.spent}};S.trees.forEach((id,i)=>{if(!id)LOCK[i]=false;});}

/* ================= dialogs ================= */
const DLG_RETURN=new Map();
const topLayer=()=>{const d=$$("dialog[open]");return d.length?d[d.length-1]:document.body;};
function selFor(b){
  const d=(b&&b.dataset)||{};if(!d.act)return null;
  let s='[data-act="'+d.act+'"]';
  ["id","t","i","slot","cat","p","tab"].forEach(k=>{if(d[k]!=null)s+='[data-'+k+'="'+cssEsc(d[k])+'"]';});
  if(d.act==="all-skills")s+='[data-v="'+d.v+'"]';
  return s;
}
function openDlg(id,focusEl){
  const d=$("#"+id);if(d.open)return;
  const a=document.activeElement;DLG_RETURN.set(id,{el:a,sel:selFor(a)});glHide();
  if(typeof d.showModal==="function")d.showModal();else d.setAttribute("open","");
  const t=$("#toast");if(t.classList.contains("show"))d.appendChild(t);
  const f=focusEl||d.querySelector(".xbtn");if(f)f.focus({preventScroll:true});
}
function closeDlg(id){const d=$("#"+id);if(!d.open)return;if(typeof d.close==="function")d.close();else{d.removeAttribute("open");onDlgClose(d);}}
function onDlgClose(d){
  glHide();
  ["#toast","#gtip"].forEach(s=>{const el=$(s);if(d.contains(el))document.body.appendChild(el);});
  const r=DLG_RETURN.get(d.id);DLG_RETURN.delete(d.id);
  if(!r||$("dialog[open]"))return;
  const el=r.el&&r.el.isConnected?r.el:(r.sel&&document.querySelector(r.sel));   /* re-rendered: focus its replacement */
  if(el&&typeof el.focus==="function")el.focus({preventScroll:true});
}
$$("dialog.modal").forEach(d=>{
  d.addEventListener("close",()=>onDlgClose(d));
  d.addEventListener("mousedown",e=>{d._down=e.target===d;});
  d.addEventListener("click",e=>{if(e.target===d&&d._down)closeDlg(d.id);d._down=false;});
});

/* ================= toast ================= */
let TOAST_T=null;
function toast(msg,o){
  o=o||{};const el=$("#toast"),host=topLayer();if(el.parentNode!==host)host.appendChild(el);
  el.innerHTML='<span>'+esc(msg)+'</span>'+(o.action?'<button type="button">'+esc(o.action)+'</button>':'');
  el.classList.toggle("act",!!o.action);
  if(o.action)el.querySelector("button").onclick=()=>{hideToast();if(o.fn)o.fn();};
  el.classList.add("show");clearTimeout(TOAST_T);TOAST_T=setTimeout(hideToast,o.ms||(o.action?5000:2200));
}
function hideToast(){$("#toast").classList.remove("show");}

/* ================= picker ================= */
let pk={ctx:0,cat:"all",q:"",sel:null,page:0};
const PK_PER=15;
const skText=s=>(s.n+" "+s.x+" "+(s.s||[]).map(x=>x.join(" ")).join(" ")+" "+(s.f||[]).map(x=>x.join(" ")).join(" ")+" "+(s.h||[]).map(x=>x[1]+" "+x[2].join(" ")+" "+x[3]).join(" ")+" "+s.g.join(" ")).toLowerCase();
const treeMeta=t=>(t.n+" "+CATN[t.c]+" "+t.r+" "+t.ty+" "+(t.cu||t.no?curseText(t):"")).toLowerCase();
const TREE_TEXT=Object.create(null);
const treeText=t=>TREE_TEXT[t.id]||(TREE_TEXT[t.id]=treeMeta(t)+" "+t.sk.map(skText).join(" "));
/* why a tree can't go in the slot being picked (null = it can) */
function pickBlock(t){
  const dup=S.trees.findIndex((id,i)=>id===t.id&&i!==pk.ctx);
  if(dup>=0)return{why:"Already equipped as "+SLOTN[dup].toLowerCase()+".",short:"already equipped"};
  if(t.c==="cursed"&&S.trees.some((id,i)=>id&&i!==pk.ctx&&tree(id).c==="cursed"))return{why:"Only one cursed tree per build.",short:"only one cursed tree"};
  if(pk.ctx===0&&t.ty!==MAIN)return{why:"The birth tree must be a Main Class tree.",short:"sub tree only"};
  return null;
}
function openPicker(idx){
  MOVE=null;renderSlots();
  pk={ctx:idx,cat:"all",q:"",sel:S.trees[idx],page:0};
  if(pk.sel)pk.page=Math.floor(SORTED.findIndex(t=>t.id===pk.sel)/PK_PER);
  $("#pkTitle").textContent=idx===0?"Choose your birth tree":"Choose "+SLOTN[idx].toLowerCase();
  $("#pkSearch").value="";
  renderPicker();
  openDlg("picker",matchMedia("(pointer:fine)").matches?$("#pkSearch"):null);
}
function renderPicker(){
  $("#pkTabs").innerHTML=[["all","All"],...CATS.map(c=>[c,CATN[c]])].map(c=>'<button class="tab'+(pk.cat===c[0]?" on":"")+'" data-act="pk-cat" data-cat="'+c[0]+'" aria-pressed="'+(pk.cat===c[0])+'">'+(c[0]==="all"?"":'<span class="tglyph2" aria-hidden="true">'+CATI[c[0]]+'</span>')+c[1]+'</button>').join("");
  renderCards();renderPrev();
}
function renderCards(){
  const words=pk.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const cards=SORTED.filter(t=>pk.cat==="all"||t.c===pk.cat).map(t=>{
    let hits=[];
    if(words.length){
      if(!words.every(w=>treeText(t).includes(w)))return "";
      const meta=treeMeta(t),rest=words.filter(w=>!meta.includes(w));
      if(rest.length){
        let hs=t.sk.filter(s=>rest.every(w=>skText(s).includes(w)));
        if(!hs.length)hs=t.sk.filter(s=>rest.some(w=>skText(s).includes(w)));
        hits=hs.slice(0,3).map(s=>s.n);
      }
    }
    const bl=pickBlock(t);
    return '<button class="pcard'+(pk.sel===t.id?" sel":"")+(bl?" dis":"")+'" data-act="pk-card" data-id="'+t.id+'" data-cat="'+t.c+'" aria-pressed="'+(pk.sel===t.id)+'">'+treeIco(t)+'<b>'+esc(t.n)+'</b><br>'+badge(t)+' <span class="pty">'+esc(t.ty)+'</span>'
      +(hits.length?'<span class="hint" style="display:block">→ '+hits.map(esc).join(", ")+'</span>':'')
      +(bl?'<span class="hint" style="display:block">'+bl.short+'</span>':'')+'</button>';
  }).filter(Boolean);
  const pages=Math.max(1,Math.ceil(cards.length/PK_PER));
  pk.page=Math.max(0,Math.min(pk.page,pages-1));
  $("#pkCards").innerHTML=cards.slice(pk.page*PK_PER,(pk.page+1)*PK_PER).join("")||'<div class="pvempty">No matches.</div>';
  $("#pkPager").innerHTML=pages<2?"":
    '<button data-act="pk-page" data-p="'+(pk.page-1)+'"'+(pk.page?"":" disabled")+'>‹ Back</button><span class="pnums">'
    +Array.from({length:pages},(_,i)=>'<button class="pnum'+(i===pk.page?" on":"")+'" data-act="pk-page" data-p="'+i+'" aria-label="Page '+(i+1)+'"'+(i===pk.page?' aria-current="page"':'')+'>'+(i+1)+'</button>').join("")
    +'</span><button data-act="pk-page" data-p="'+(pk.page+1)+'"'+(pk.page<pages-1?"":" disabled")+'>Next ›</button>';
}
function renderPrev(){
  const el=$("#pkPrev");
  if(!pk.sel){el.innerHTML='<span class="pvempty">Pick a tree to preview it.</span>';return;}
  const t=tree(pk.sel),same=pk.sel===S.trees[pk.ctx],bl=same?null:pickBlock(t);
  el.innerHTML='<div class="pvhead"><b>'+treeIco(t)+esc(t.n)+'</b> '+badge(t)+'<span class="pty muted" style="font-size:12px">'+esc(t.ty)+'</span></div>'
    +'<div class="pvtools"><button class="lnk pvback" data-act="pk-back">← All trees</button><button class="lnk" data-act="pk-expand">'+(PREFS.pvOpen?"Collapse skills":"Expand skills")+'</button></div>'
    +curseBox(t)
    +t.sk.map((sk,i)=>[sk,i]).sort((a,b)=>a[0].t-b[0].t).map(([sk,i])=>skillRow(sk,t,i,true,PREFS.pvOpen,null)).join("")
    +'<div class="row pkact">'+(bl?'<span class="pkwhy">'+esc(bl.why)+'</span>':'')
    +'<button class="btn-keep" data-act="pk-set"'+(bl?" disabled":"")+'>'+(same?"Keep this tree":"Set as "+(pk.ctx===0?"birth tree":SLOTN[pk.ctx].toLowerCase()))+'</button>'
    +(S.trees[pk.ctx]?'<button class="btn-clear" data-act="pk-clear" title="Remove '+esc(tree(S.trees[pk.ctx]).n)+' and its points from this slot">Clear this slot</button>':'')+'</div>';
  el.scrollTop=0;
}
function pickCard(id){
  pk.sel=id;renderCards();renderPrev();
  const btn=$('#pkCards [data-id="'+cssEsc(id)+'"]');if(btn)btn.focus({preventScroll:true});
  if(matchMedia("(max-width:800px)").matches)$("#pkPrev").scrollIntoView({behavior:"smooth",block:"start"});
}
function commitPick(){
  const id=pk.sel;if(!id)return;
  if(id===S.trees[pk.ctx]){closeDlg("picker");return;}
  if(pickBlock(tree(id)))return;
  const old=S.trees[pk.ctx];if(old)delete S.spent[old];
  S.trees[pk.ctx]=id;LOCK[pk.ctx]=false;
  if(pk.ctx===0)applyBirthRank(id);
  renderAll();commit();closeDlg("picker");   /* render first so focus can return to the new slot button */
}
function clearSlot(){
  const old=S.trees[pk.ctx];
  if(old){delete S.spent[old];S.trees[pk.ctx]=null;}
  LOCK[pk.ctx]=false;renderAll();commit();closeDlg("picker");
  if(old)toast("Cleared "+tree(old).n,{action:"Undo",fn:undo});
}

/* ================= saves, premades, import, backup ================= */
const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
function getSaves(){const a=store.get(KEY.saves,[]);return Array.isArray(a)?a.filter(s=>s&&typeof s.code==="string"&&s.id):[];}
function putSaves(a){if(store.set(KEY.saves,a))return true;toast("Couldn't save: browser storage is full or blocked");return false;}
let SV_TAB="mine",SV_RENAME=null;
function openSaves(tab){commitSoon.flush();SV_TAB=tab||"mine";SV_RENAME=null;renderSaves();openDlg("saves");}
function openPremades(){commitSoon.flush();$("#pmBody").innerHTML=premadesHTML();openDlg("premades");}
function saveMeta(st){
  const ids=st.trees.filter(Boolean);
  return '<span class="svtrees">'+ids.map(id=>treeIco(tree(id))).join("")+'</span><span>'+(ids.map(id=>esc(tree(id).n)).join(" · ")||"no trees")+'</span><span>Lv '+st.level+' · '+plural(sumSpent(st),"pt")+'</span>';
}
function renderSaves(){
  $("#svTabs").innerHTML=[["mine","My builds"],["import","Import & backup"]].map(([k,l])=>'<button class="tab'+(SV_TAB===k?" on":"")+'" data-act="sv-tab" data-tab="'+k+'" aria-pressed="'+(SV_TAB===k)+'">'+l+'</button>').join("");
  const b=$("#svBody");
  b.innerHTML=SV_TAB==="mine"?savesMineHTML():importHTML();
  $$("#svBody .svthumb[data-img]").forEach(el=>{
    const ref=el.dataset.img;if(!ref)return;
    const set=v=>{if(v){el.style.backgroundImage='url("'+v+'")';el.textContent="";}};
    if(ref.startsWith("https://"))set(safeImg(ref));else if(ref.startsWith("idb:")){const k=ref.slice(4),v=imgStore.peek(k);if(v)set(v);else imgStore.get(k).then(set);}
  });
  const ren=$("#svRename");if(ren){ren.focus();ren.select();}
}
function savesMineHTML(){
  const sv=getSaves().sort((a,b)=>(b.updated||0)-(a.updated||0)),cur=CURRENT_SAVE&&sv.find(s=>s.id===CURRENT_SAVE);
  let h='<div class="svsave"><input id="svName" placeholder="Name this build" maxlength="60" aria-label="Name for the new save"><button class="primary" data-act="sv-new">Save as new</button>'
    +(cur?'<button data-act="sv-over" data-id="'+cur.id+'" title="Replace the saved copy with the current build">Update “'+esc(cur.name)+'”</button>':'')+'</div>'
    +'<p class="svnote">Saved in this browser. Use Import &amp; backup to move them to another device.</p>';
  if(!sv.length)return h+'<div class="svempty">No saved builds yet.</div>';
  return h+'<div class="svlist">'+sv.map(s=>{
    const r=parseCode(s.code),st=r?r.st:blank();
    const ini=esc(((s.name||"?").trim()[0]||"?").toUpperCase());
    return '<div class="svrow'+(s.id===CURRENT_SAVE?" cur":"")+'"><div class="svthumb" data-img="'+esc(s.img||"")+'">'+ini+'</div><div class="svinfo">'
      +(SV_RENAME===s.id?'<input class="svrename" id="svRename" data-id="'+s.id+'" value="'+esc(s.name)+'" maxlength="60" aria-label="New name for '+esc(s.name)+'">':'<div class="svname">'+esc(s.name)+'</div>')
      +'<div class="svmeta">'+saveMeta(st)+'<span>'+fmtDate(s.updated||s.created)+'</span></div></div>'
      +'<div class="svacts"><button data-act="sv-load" data-id="'+s.id+'">Load</button><button data-act="sv-ren" data-id="'+s.id+'" title="Rename" aria-label="Rename '+esc(s.name)+'">✎</button><button data-act="sv-over" data-id="'+s.id+'" title="Replace with the current build" aria-label="Replace '+esc(s.name)+' with the current build">⤓</button><button data-act="sv-del" data-id="'+s.id+'" title="Delete" aria-label="Delete '+esc(s.name)+'">🗑</button></div></div>';
  }).join("")+'</div>';
}
function premadesHTML(){
  let h=PREMADES.length?'<div class="svlist">'+PREMADES.map(p=>{
    const st=premadeState(p);if(!st)return "";
    return '<div class="svrow"><div class="svthumb">'+(st.trees[0]?treeIco(tree(st.trees[0])):"")+'</div><div class="svinfo"><div class="svname">'+esc(p.name)+'</div><div class="svmeta">'+saveMeta(st)+'</div>'+(p.desc?'<p class="pmdesc">'+esc(p.desc)+'</p>':'')+'</div>'
      +'<div class="svacts"><button data-act="pm-load" data-id="'+esc(p.id)+'">Load</button><button data-act="pm-cmp" data-id="'+esc(p.id)+'">Compare</button></div></div>';
  }).join("")+'</div>':'<div class="svempty">No premades yet.</div>';
  return '<p class="svnote" style="margin-top:0">Loading a premade swaps in its trees, points and level. Name, title, rank and portrait stay.</p>'+h
    +'<h3>Add a premade</h3><p class="svnote">Set up a build, copy its entry, paste it into <code>data/premades.js</code> and write a description.</p><div class="row"><button data-act="pm-copy">Copy current build as a premade entry</button></div>';
}
function importHTML(){
  return '<h3 style="margin-top:0">Paste a build code or link</h3><textarea id="impText" placeholder="Paste a build code or share link" aria-label="Build code or link"></textarea>'
    +'<div class="row"><button class="primary" data-act="imp-load">Load build</button><button data-act="imp-cmp">Compare with current</button></div>'
    +'<h3>Backup</h3><p class="svnote">Download every saved build (with portraits) as one file, or bring a backup back in. Importing adds to your saves and never overwrites them.</p>'
    +'<div class="row"><button data-act="bk-export">Download backup (.json)</button><button data-act="bk-import">Import backup…</button></div>';
}
function saveNew(){
  const sv=getSaves(),name=($("#svName").value.trim()||(S.name||"Untitled")+" (Lv "+S.level+")").slice(0,60),now=Date.now();
  const s={id:newId(),name,code:code(),img:imgRef(S),created:now,updated:now};
  sv.push(s);if(!putSaves(sv))return;
  CURRENT_SAVE=s.id;renderSaves();toast("Saved “"+name+"”");
}
function saveOver(id){
  const sv=getSaves(),i=sv.findIndex(s=>s.id===id);if(i<0)return;
  const prev={...sv[i]};sv[i]={...sv[i],code:code(),img:imgRef(S),updated:Date.now()};
  if(!putSaves(sv))return;
  CURRENT_SAVE=id;renderSaves();
  toast("Updated “"+prev.name+"”",{action:"Undo",fn:()=>{const a=getSaves(),j=a.findIndex(s=>s.id===id);if(j>=0){a[j]=prev;putSaves(a);if($("#saves").open)renderSaves();}}});
}
function loadSave(id){
  const s=getSaves().find(x=>x.id===id),r=s&&parseCode(s.code);
  if(!r){toast("That save couldn't be read");return;}
  commitSoon.flush();
  const hadWork=!isBlank(S);
  S=r.st;applyImgRef(S,s.img||urlImage(r.st)||null);CURRENT_SAVE=id;MOVE=null;inferRankPin();
  closeDlg("saves");renderAll();commit();
  toast("Loaded “"+s.name+"”",hadWork?{action:"Undo",fn:undo}:null);
}
function deleteSave(id){
  const sv=getSaves(),i=sv.findIndex(s=>s.id===id);if(i<0)return;
  const [gone]=sv.splice(i,1);if(!putSaves(sv))return;
  if(CURRENT_SAVE===id)CURRENT_SAVE=null;renderSaves();
  toast("Deleted “"+gone.name+"”",{action:"Undo",fn:()=>{const a=getSaves();a.splice(Math.min(i,a.length),0,gone);putSaves(a);if($("#saves").open)renderSaves();}});
}
function finishRename(save){
  const el=$("#svRename");if(!el)return;
  const id=el.dataset.id,name=el.value.trim().slice(0,60);SV_RENAME=null;
  if(save&&name){const sv=getSaves(),s=sv.find(x=>x.id===id);if(s&&s.name!==name){s.name=name;putSaves(sv);}}
  renderSaves();
  const b=$('#svBody [data-act="sv-ren"][data-id="'+cssEsc(id)+'"]');if(b)b.focus({preventScroll:true});
}
function loadPremade(id){
  const p=PREMADES.find(x=>x.id===id),st=premadeState(p);if(!st)return;
  commitSoon.flush();
  const hadWork=equipped().length>0;
  loadBuildOnly(st);CURRENT_SAVE=null;MOVE=null;
  closeDlg("premades");renderAll();commit();
  toast("Loaded premade: "+p.name,hadWork?{action:"Undo",fn:undo}:null);
}
function premadeEntry(){
  const id=slug(S.name||"my-build");
  const trees=S.trees.map(t=>t?'["'+t+'",'+(S.spent[t]||0)+']':"null").join(",");
  return '{id:"'+id+'", name:'+JSON.stringify(S.name||"My build")+', level:'+S.level+',\n desc:"",\n trees:['+trees+']},';
}
async function importText(compare){
  const r=await parseAny($("#impText").value);
  if(!r){toast("That doesn't look like a build code or link");return;}
  if(compare){CB=r.st;closeDlg("saves");openCompare(true);return;}
  commitSoon.flush();const hadWork=!isBlank(S);
  S=r.st;if(S.image&&S.image.startsWith("data:"))imgRef(S);CURRENT_SAVE=null;MOVE=null;inferRankPin();
  closeDlg("saves");renderAll();commit();
  toast("Build loaded"+(r.changed.length?" · "+r.changed.join(", ")+" changed since it was made":""),hadWork?{action:"Undo",fn:undo,ms:6000}:null);
}
async function exportBackup(){
  const out=[];
  for(const s of getSaves()){let img=null;if(s.img)img=s.img.startsWith("idb:")?await imgStore.get(s.img.slice(4)):s.img;out.push({name:s.name,code:s.code,img,created:s.created,updated:s.updated});}
  if(!out.length){toast("No saved builds to back up yet");return;}
  download(new Blob([JSON.stringify({app:"Build Planner",version:2,exported:new Date().toISOString(),saves:out},null,1)],{type:"application/json"}),"build-planner-saves-"+new Date().toISOString().slice(0,10)+".json");
  toast("Backup downloaded ("+plural(out.length,"build")+")");
}
async function storeImgRef(raw){
  const u=safeImg(raw);if(!u)return null;
  if(u.startsWith("https://"))return u;
  const k=imgKeyOf(u);await imgStore.put(k,u);return "idb:"+k;
}
async function importBackup(f){
  if(!f)return;let data;
  try{data=JSON.parse(await f.text());}catch(e){toast("That file isn't a Build Planner backup");return;}
  const list=Array.isArray(data)?data:(data&&Array.isArray(data.saves)?data.saves:null);
  if(!list){toast("That file isn't a Build Planner backup");return;}
  const sv=getSaves(),have=new Set(sv.map(s=>s.name+"\n"+s.code));let added=0;
  for(const x of list){
    const r=x&&parseCode(x.code||x.c);if(!r)continue;
    const c=code(r.st),name=String(x.name||"Imported build").slice(0,60);
    if(have.has(name+"\n"+c))continue;have.add(name+"\n"+c);
    sv.push({id:newId(),name,code:c,img:await storeImgRef(x.img),created:+x.created||Date.now(),updated:+x.updated||Date.now()});added++;
  }
  if(!putSaves(sv))return;
  SV_TAB="mine";renderSaves();
  toast(added?"Imported "+plural(added,"build"):"Nothing new in that backup");
}

/* ================= compare ================= */
function openCompare(keep){
  commitSoon.flush();
  const sv=getSaves().sort((a,b)=>(b.updated||0)-(a.updated||0));
  $("#cmpSel").innerHTML='<option value="">Pick a saved build or premade…</option>'
    +(sv.length?'<optgroup label="Saved builds">'+sv.map(s=>'<option value="s:'+s.id+'">'+esc(s.name)+'</option>').join("")+'</optgroup>':'')
    +(PREMADES.length?'<optgroup label="Premades">'+PREMADES.map(p=>'<option value="p:'+esc(p.id)+'">'+esc(p.name)+'</option>').join("")+'</optgroup>':'');
  if(!keep)$("#cmpIn").value="";
  renderCompare();openDlg("cmp");
}
function cmpFromSelect(v){
  if(!v)return;
  if(v.startsWith("s:")){
    const s=getSaves().find(x=>x.id===v.slice(2)),r=s&&parseCode(s.code);
    if(!r){toast("That save couldn't be read");return;}
    CB=r.st;if(!CB.name)CB.name=s.name;applyImgRef(CB,s.img||urlImage(r.st)||null);
  }else{const p=PREMADES.find(x=>x.id===v.slice(2));CB=premadeState(p);if(CB)CB.name=p.name;}
  renderCompare();
}
async function cmpFromCode(){
  const r=await parseAny($("#cmpIn").value);
  if(!r){toast("Invalid code or link");return;}
  CB=r.st;$("#cmpSel").value="";renderCompare();
}
function unlockedSet(st){const s=new Set();st.trees.forEach(id=>{if(!id)return;const cur=st.spent[id]||0;tree(id).sk.forEach(k=>{if(cur>=k.t)s.add(id+"|"+k.n);});});return s;}
function cmpCol(st,other,label){
  const theirs=unlockedSet(other);
  let h='<div class="ccol">'+cardHead(st,{label,pts:true,noFlavor:true});
  st.trees.forEach((id,i)=>{
    const lab=i?"Sub tree "+i:"Birth tree";
    if(!id){h+='<div class="ctree"><span class="clab">'+lab+'</span><span class="cempty2">empty slot</span></div>';return;}
    const t=tree(id),cur=st.spent[id]||0,mx=maxTier(t),shared=other.trees.includes(id);
    const oc=shared?(other.spent[id]||0):null,diff=shared&&oc!==cur?" ("+(cur>oc?"+":"")+(cur-oc)+")":"";
    h+='<div class="ctree"><div class="cth">'+treeIco(t)+'<div class="ctn"><span class="clab">'+lab+'</span><b>'+esc(t.n)+'</b></div><span class="ccount">'+cur+'/'+mx+(shared?' · <span class="cshared">shared'+diff+'</span>':'')+'</span></div>'
      +'<div class="cbar"><i style="width:'+(cur/mx*100)+'%;background:'+RARC[t.r]+'"></i></div>'
      +'<div class="cicons">'+t.sk.map((k,j)=>{const on=cur>=k.t,uniq=on&&!theirs.has(id+"|"+k.n);
        return '<button type="button" class="cskill'+(on?"":" locked")+(k.c?" cap":"")+(uniq?" uniq":"")+'" data-s="'+id+':'+j+'" data-l="'+(on?0:1)+'" aria-label="'+esc(k.n)+(on?"":" (locked)")+(uniq?", only in this build":"")+'">'+skImg(k,t)+'<span class="cname">'+esc(k.n)+'</span></button>';}).join("")+'</div></div>';
  });
  return h+'</div>';
}
function renderCompare(){
  if(!CB){$("#cmpOut").innerHTML='<p class="nhint">Choose a saved build or premade, or paste a code or link, to compare it with your current build.</p>';return;}
  const a=unlockedSet(S),b=unlockedSet(CB),both=[...a].filter(x=>b.has(x)).length;
  $("#cmpOut").innerHTML='<div class="cmpbar"><p class="nhint"><span class="ukey"></span>Outlined skills are only in that build · '+plural(both,"skill")+' shared</p><button data-act="cmp-swap">Swap: edit the compared build</button></div>'
    +'<div class="cgrid ccard cmpcard">'+cmpCol(S,CB,"Current")+cmpCol(CB,S,"Compared")+'</div>';
}
function swapCompare(){
  if(!CB)return;commitSoon.flush();
  const old=S;S=CB;CB=old;CURRENT_SAVE=null;MOVE=null;inferRankPin();
  renderAll();renderCompare();commit();toast("Swapped: you're now editing the other build",{action:"Undo",fn:()=>{const o=S;S=CB;CB=o;renderAll();renderCompare();commit();}});
}

/* ================= share and export ================= */
const baseUrl=()=>location.href.split("#")[0];
let LINK_N=0;
function openShare(){
  commitSoon.flush();
  $("#shCode").value=code();
  const si=$("#shImg");si.checked=!!S.image&&PREFS.shImg;si.disabled=!S.image;si.parentElement.title=S.image?"":"Add a portrait first";
  $("#shFull").checked=!!PREFS.shFull;
  openDlg("share");makeLink();
}
async function buildLink(withImg){
  let img=null;
  if(withImg&&S.image)img=S.image.startsWith("https://")?S.image:await thumb(S.image,128);
  const json=JSON.stringify(packState(S,img));
  let c=null;
  if(CAN_ZIP){try{c="z."+await zip(json);}catch(e){c=null;}}   /* older browsers without deflate-raw get a plain code */
  return baseUrl()+"#"+(c||b64u(json));
}
async function makeLink(){
  const n=++LINK_N;$("#shUrl").value="Making link…";
  const u=await buildLink($("#shImg").checked);if(n!==LINK_N)return;
  $("#shUrl").value=u;
  const w=$("#shLen"),long=u.length>2000;w.hidden=!long;
  w.textContent=long?"This link is "+u.length+" characters. Discord allows 2000 per message: untick “Include portrait”, or use a portrait link (https://) instead of an upload.":"";
}
function oldCopy(u,msg){
  const i=document.createElement("textarea");i.value=u;i.setAttribute("readonly","");i.style.cssText="position:fixed;top:0;left:0;opacity:0";
  topLayer().appendChild(i);i.select();let ok=false;try{ok=document.execCommand("copy");}catch(e){}i.remove();
  toast(ok?msg:"Copy failed: select the text and copy it manually");
}
function copyText(u,msg){
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(u).then(()=>toast(msg)).catch(()=>oldCopy(u,msg));
  else oldCopy(u,msg);
}
/* Markdown summary for Rentry / Discord */
function buildText(full){
  const st=S,L=[],nm=st.name||"Unnamed build",ep=(st.epithet||"").trim();
  L.push("## "+nm+(ep&&ep.toLowerCase()!==nm.toLowerCase()?" · *"+ep+"*":""));
  L.push((st.rank==="U"?"Unranked":"Rank "+st.rank)+" · Level "+st.level+" · "+sumSpent(st)+"/"+st.level+" points");
  if((st.flavor||"").trim()){L.push("");st.flavor.trim().split(/\n/).forEach(l=>L.push("> "+l));}
  st.trees.forEach((id,idx)=>{
    L.push("");
    if(!id){L.push("**"+SLOTN[idx]+":** empty");return;}
    const t=tree(id),cur=st.spent[id]||0;
    L.push("**"+SLOTN[idx]+": "+t.n+"** ("+t.r+") · "+cur+"/"+maxTier(t)+" pts");
    const got=t.sk.filter(s=>cur>=s.t);
    if(!got.length)L.push("- no skills unlocked yet");
    got.forEach(s=>{
      L.push("- **"+s.n+"**"+(s.c?" ★":"")+" · "+plural(s.t,"pt")+" · "+s.g.join(" · "));
      if(!full)return;
      if(s.x)L.push("  "+s.x);
      (s.s||[]).forEach(x=>L.push("  - "+(x[0]?"*"+x[0]+":* ":"")+x[1]));
      (s.f||[]).forEach(f=>L.push("  - *Circle "+f[0]+", "+f[1]+":* "+f[2]+(f[3]?" (Passive: "+f[3]+")":"")));
      (s.h||[]).forEach(h=>L.push("  - *"+h[0]+" · "+h[1]+":* "+h[3]));
    });
    const nx=nextTier(t,cur);
    if(nx)L.push("- *next: "+t.sk.filter(s=>s.t===nx).map(s=>s.n).join(", ")+" at "+plural(nx,"pt")+"*");
  });
  const ap=appliesOf(st),keys=APPLIES.filter(x=>ap[x.k]).map(x=>x.k);
  if(keys.length){L.push("");L.push("**Applies:** "+keys.join(", "));}
  L.push("");L.push("[Open in Build Planner]("+baseUrl()+"#"+code()+")");
  return L.join("\n");
}

/* ---- card image (drawn on a canvas, no libraries) ---- */
function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
const loadOrNull=(src,cors)=>loadImage(src,cors).catch(()=>null);
async function drawCard(st){
  const FONT='system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
  const W=1200,P=40,LW=270,GAP=40,RX=P+LW+GAP,RW=W-RX-P,IG=10,ICON=Math.floor((RW-7*IG)/8);
  const meas=document.createElement("canvas").getContext("2d");
  const wrap=(text,font,maxW)=>{meas.font=font;const out=[];String(text).split(/\n/).forEach(par=>{let line="";par.split(/\s+/).filter(Boolean).forEach(w=>{const t=line?line+" "+w:w;if(!line||meas.measureText(t).width<=maxW)line=t;else{out.push(line);line=w;}});out.push(line);});return out;};
  const nm=st.name||"Unnamed",ep=(st.epithet||"").trim(),showEp=ep&&ep.toLowerCase()!==(st.name||"").trim().toLowerCase();
  const nameL=wrap(nm,"700 30px "+FONT,LW),epL=showEp?wrap(ep,"italic 18px "+FONT,LW):[];
  const flav=(st.flavor||"").trim(),flavL=flav?wrap(flav,"15px "+FONT,LW-14).slice(0,16):[];
  const leftH=LW+22+nameL.length*36+epL.length*25+12+30+(flavL.length?18+flavL.length*22:0);
  const eq=st.trees.map((id,i)=>id?{t:tree(id),i}:null).filter(Boolean);
  const TREE_H=50+14+ICON+8+34;
  const ap=appliesOf(st),apK=APPLIES.filter(x=>ap[x.k]).map(x=>x.k);
  const apL=apK.length?wrap("Applies: "+apK.join(" · "),"600 14px "+FONT,RW):[];
  const rightH=(eq.length?eq.length*TREE_H+(eq.length-1)*24:40)+(apL.length?16+apL.length*20:0);
  const H=P+Math.max(leftH,rightH)+44+P/2;
  const SC=2,cv=document.createElement("canvas");cv.width=W*SC;cv.height=Math.ceil(H)*SC;
  const g=cv.getContext("2d");g.scale(SC,SC);
  /* images first */
  const portrait=st.image?await loadOrNull(st.image,st.image.startsWith("https://")):null;
  const icons=await Promise.all(eq.map(async({t})=>({tree:await loadOrNull(iconSrc(t,1)),sk:await Promise.all(t.sk.map(s=>loadOrNull(skIconSrc(s,t))))})));
  /* background */
  g.fillStyle="#0f1115";g.fillRect(0,0,W,H);
  rr(g,12,12,W-24,H-24,22);g.fillStyle="#151823";g.fill();g.strokeStyle="#232838";g.lineWidth=1.5;g.stroke();
  /* left column */
  let y=P;
  g.save();rr(g,P,y,LW,LW,18);g.clip();
  if(portrait){const s=Math.min(portrait.naturalWidth,portrait.naturalHeight);g.drawImage(portrait,(portrait.naturalWidth-s)/2,(portrait.naturalHeight-s)/2,s,s,P,y,LW,LW);}
  else{g.fillStyle="#232838";g.fillRect(P,y,LW,LW);g.fillStyle="#8b94ab";g.font="700 120px "+FONT;g.textAlign="center";g.textBaseline="middle";g.fillText(((st.name||"?").trim()[0]||"?").toUpperCase(),P+LW/2,y+LW/2+6);}
  g.restore();
  rr(g,P,y,LW,LW,18);g.strokeStyle="#333a4f";g.lineWidth=1.5;g.stroke();
  y+=LW+22;g.textAlign="left";g.textBaseline="alphabetic";
  g.fillStyle="#dfe3ea";g.font="700 30px "+FONT;nameL.forEach(l=>{y+=30;g.fillText(l,P,y);y+=6;});
  g.fillStyle="#8b94ab";g.font="italic 18px "+FONT;epL.forEach(l=>{y+=20;g.fillText(l,P,y);y+=5;});
  y+=12;
  const pill=(text,x,bg,fg)=>{g.font="700 13px "+FONT;const w=g.measureText(text).width+20;rr(g,x,y,w,26,13);g.fillStyle=bg;g.fill();g.fillStyle=fg;g.fillText(text,x+10,y+18);return x+w+8;};
  let px=pill(st.rank==="U"?"Unranked":"Rank "+st.rank,P,RANKC[st.rank]||RANKC.D,"#0f1115");
  px=pill("Lv "+st.level,px,"#232838","#dfe3ea");pill(plural(sumSpent(st),"pt"),px,"#232838","#dfe3ea");
  y+=30;
  if(flavL.length){y+=18;g.fillStyle="#333a4f";g.fillRect(P,y,2,flavL.length*22);g.fillStyle="#aab1c2";g.font="15px "+FONT;flavL.forEach((l,i)=>g.fillText(l,P+14,y+16+i*22));}
  /* right column: the trees */
  y=P;
  if(!eq.length){g.fillStyle="#8b94ab";g.font="16px "+FONT;g.fillText("No skill trees chosen yet.",RX,y+24);y+=40;}
  eq.forEach(({t,i},n)=>{
    const cur=st.spent[t.id]||0,mx=maxTier(t),got=t.sk.filter(s=>cur>=s.t).length,img=icons[n];
    g.save();rr(g,RX,y,40,40,8);g.clip();
    if(img.tree)g.drawImage(img.tree,RX,y,40,40);else{g.fillStyle="#232838";g.fillRect(RX,y,40,40);g.fillStyle="#dfe3ea";g.font="20px "+FONT;g.textAlign="center";g.fillText(CATI[t.c],RX+20,y+27);g.textAlign="left";}
    g.restore();
    g.fillStyle="#8b94ab";g.font="600 11px "+FONT;g.fillText((i===0?"BIRTH TREE":"SUB TREE")+"  ·  "+t.r.toUpperCase(),RX+52,y+14);
    g.fillStyle="#dfe3ea";g.font="700 21px "+FONT;g.fillText(t.n,RX+52,y+37);
    g.fillStyle="#8b94ab";g.font="14px "+FONT;g.textAlign="right";g.fillText(got+"/"+t.sk.length+" skills · "+cur+"/"+mx+" pts",RX+RW,y+37);g.textAlign="left";
    y+=50;rr(g,RX,y,RW,5,2.5);g.fillStyle="#232838";g.fill();
    if(cur){rr(g,RX,y,Math.max(5,RW*cur/mx),5,2.5);g.fillStyle=RARC[t.r];g.fill();}
    y+=14;
    t.sk.forEach((s,j)=>{
      const x=RX+j*(ICON+IG),on=cur>=s.t,im=img.sk[j];
      g.save();rr(g,x,y,ICON,ICON,10);g.clip();
      if(im)g.drawImage(im,x,y,ICON,ICON);else{g.fillStyle=RARC[t.r];g.fillRect(x,y,ICON,ICON);g.fillStyle="#0f1115";g.font="700 40px "+FONT;g.textAlign="center";g.fillText(s.n[0],x+ICON/2,y+ICON/2+14);g.textAlign="left";}
      if(!on){g.globalCompositeOperation="saturation";g.fillStyle="#808080";g.fillRect(x,y,ICON,ICON);g.globalCompositeOperation="source-over";g.fillStyle="rgba(15,17,21,.58)";g.fillRect(x,y,ICON,ICON);}
      g.restore();
      if(s.c){rr(g,x+1,y+1,ICON-2,ICON-2,9);g.strokeStyle="#ffcf4d";g.lineWidth=2;g.stroke();}
      g.fillStyle=on?"#c4cad6":"#6b7286";g.font="600 12px "+FONT;g.textAlign="center";
      wrap(s.n,"600 12px "+FONT,ICON+6).slice(0,2).forEach((l,k)=>g.fillText(l,x+ICON/2,y+ICON+18+k*15));
      g.textAlign="left";
    });
    y+=ICON+8+34+(n<eq.length-1?24:0);
  });
  if(apL.length){y+=16;g.fillStyle="#8b94ab";g.font="600 14px "+FONT;apL.forEach((l,k)=>g.fillText(l,RX,y+14+k*20));}
  /* footer */
  g.fillStyle="#7d869c";g.font="13px "+FONT;g.fillText("Build Planner",P,H-28);
  if(/^https?:/.test(location.protocol)){g.textAlign="right";g.fillText((location.host+location.pathname).replace(/\/index\.html$/,"").replace(/\/$/,""),W-P,H-28);g.textAlign="left";}
  if(st.image&&!portrait)toast("The portrait's host doesn't allow it to be drawn, so the card uses the initial instead",{ms:6000});
  return new Promise((res,rej)=>cv.toBlob(b=>b?res(b):rej(new Error("toBlob")),"image/png"));
}
async function exportPNG(){
  commitSoon.flush();
  toast("Drawing the card…",{ms:10000});
  try{const b=await drawCard(S);download(b,slug(S.name||"build")+".png");toast("Card image downloaded");}
  catch(e){toast(location.protocol==="file:"?"Card images need the page to be served (GitHub Pages, or python -m http.server locally)":"Couldn't draw the card image",{ms:6000});}
}
function openCard(){commitSoon.flush();patch($("#cardBody"),charCard(S,true));openDlg("card");}

/* ================= tooltips: hover on desktop, tap on touch, focus with keyboard ================= */
let GL_PIN=null;
const TIP_SEL=".gl,.cskill,.apchip";
function tipFor(el){
  if(el.dataset.s)return{h:skillTip(el.dataset.s,el.dataset.l),wide:true};
  if(el.dataset.k)return{h:kwTip(el.dataset.k),wide:false};
  if(el.dataset.ap)return{h:applyTip(el.dataset.ap),wide:false};
  return null;
}
function glShow(el){
  const tip=$("#gtip"),c=tipFor(el);if(!c||!c.h)return;
  const host=topLayer();if(tip.parentNode!==host)host.appendChild(tip);
  tip.innerHTML=c.h;tip.classList.toggle("wide",c.wide);tip.scrollTop=0;tip.classList.add("show");tip.classList.toggle("pinned",!!GL_PIN);
  const r=el.getBoundingClientRect(),tw=tip.offsetWidth,th=tip.offsetHeight;
  const x=Math.min(Math.max(8,r.left+r.width/2-tw/2),innerWidth-tw-8);
  let y=r.bottom+6;if(y+th>innerHeight-8)y=r.top-th-6;
  tip.style.left=x+"px";tip.style.top=Math.max(8,y)+"px";
}
function glHide(){const tip=$("#gtip");tip.classList.remove("show","pinned");if(GL_PIN){GL_PIN.classList.remove("on");GL_PIN=null;}}
document.addEventListener("mouseover",e=>{const el=e.target.closest&&e.target.closest(TIP_SEL);if(el&&!GL_PIN)glShow(el);});
document.addEventListener("mouseout",e=>{const el=e.target.closest&&e.target.closest(TIP_SEL);if(el&&!GL_PIN&&!(e.relatedTarget&&el.contains(e.relatedTarget)))glHide();});
document.addEventListener("focusin",e=>{if(e.target.matches&&e.target.matches(TIP_SEL))glShow(e.target);});
document.addEventListener("focusout",e=>{if(e.target.matches&&e.target.matches(TIP_SEL)&&!GL_PIN)glHide();});
addEventListener("scroll",e=>{const t=e.target;if(!(t&&t.id==="gtip"))glHide();},true);
addEventListener("resize",glHide);

/* ================= events ================= */
const REFOCUS=["tier","tier-sk","lock","move","slot","tree-toggle","tree-skills","all-skills","pk-cat","pk-card","pk-page","pk-expand","sv-tab","sv-ren"];
const focusKey=b=>REFOCUS.includes(b.dataset.act)?selFor(b):null;
document.addEventListener("click",e=>{
  /* tooltip pin / unpin */
  const wasPinned=!!GL_PIN;
  if(!(e.target.closest&&e.target.closest("#gtip"))){
    const tip=e.target.closest&&e.target.closest(TIP_SEL);
    if(tip&&!tip.dataset.act){e.preventDefault();if(GL_PIN===tip)glHide();else{glHide();GL_PIN=tip;tip.classList.add("on");glShow(tip);}return;}
    if(GL_PIN)glHide();
  }
  const b=e.target.closest&&e.target.closest("[data-act]");if(!b||b.disabled)return;
  const act=b.dataset.act,id=b.dataset.id,key=focusKey(b),hadFocus=document.activeElement===b;
  switch(act){
    case "undo":undo();break;
    case "redo":redo();break;
    case "random":randomBuild();break;
    case "saves":openSaves();break;
    case "premades":openPremades();break;
    case "compare":openCompare();break;
    case "share":openShare();break;
    case "card":if(wasPinned&&b.classList.contains("cclick"))break;openCard();break;
    case "reset":resetAll();break;
    case "portrait":$("#file").click();break;
    case "portrait-remove":setImage(null);$("#portrait").focus({preventScroll:true});toast("Portrait removed",{action:"Undo",fn:undo});break;
    case "slot":slotActivate(+b.dataset.slot);break;
    case "move":startMove(+b.dataset.slot);break;
    case "lock":{const i=+b.dataset.slot;LOCK[i]=!LOCK[i];renderSlots();break;}
    case "tier":setSpent(id,+b.dataset.t);break;
    case "tier-sk":{const t=tree(id);if(!t)break;glHide();setSpent(id,tierTarget(t,+b.dataset.i));const n=$('.tstrip [data-act="tier-sk"][data-id="'+cssEsc(id)+'"][data-i="'+b.dataset.i+'"]');if(n&&n.matches(":hover"))tierPreview(n);break;}
    case "trim":trimToLevel();break;
    case "tree-toggle":toggleTree(id);break;
    case "tree-skills":setTreeSkills(id,b.dataset.v==="1");break;
    case "all-skills":setAllSkills(b.dataset.v==="1");break;
    case "close":closeDlg(b.closest("dialog").id);break;
    case "pk-cat":pk.cat=b.dataset.cat;pk.page=0;renderPicker();break;
    case "pk-card":pickCard(id);break;
    case "pk-page":pk.page=+b.dataset.p;renderCards();break;
    case "pk-set":commitPick();break;
    case "pk-clear":clearSlot();break;
    case "pk-expand":PREFS.pvOpen=!PREFS.pvOpen;savePrefs();renderPrev();break;
    case "pk-back":$("#pkCards").scrollIntoView({behavior:"smooth",block:"start"});break;
    case "sv-tab":SV_TAB=b.dataset.tab;SV_RENAME=null;renderSaves();break;
    case "sv-new":saveNew();break;
    case "sv-over":saveOver(id);break;
    case "sv-load":loadSave(id);break;
    case "sv-del":deleteSave(id);break;
    case "sv-ren":SV_RENAME=id;renderSaves();return;
    case "pm-load":loadPremade(id);break;
    case "pm-cmp":{const p=PREMADES.find(x=>x.id===id);CB=premadeState(p);if(CB)CB.name=p.name;closeDlg("premades");openCompare(true);break;}
    case "pm-copy":copyText(premadeEntry(),"Premade entry copied: paste it into data/premades.js");break;
    case "imp-load":importText(false);break;
    case "imp-cmp":importText(true);break;
    case "bk-export":exportBackup();break;
    case "bk-import":$("#backupFile").click();break;
    case "cmp-code":cmpFromCode();break;
    case "cmp-swap":swapCompare();break;
    case "copy-link":{const u=$("#shUrl").value;if(u.includes("#"))copyText(u,"Link copied");else toast("The link is still being made");break;}
    case "copy-code":copyText($("#shCode").value,"Code copied");break;
    case "copy-text":copyText(buildText($("#shFull").checked),"Build copied as text");break;
    case "png":exportPNG();break;
  }
  if(key&&hadFocus&&!b.isConnected){const n=document.querySelector(key);if(n)n.focus({preventScroll:true});}
});
document.addEventListener("input",e=>{
  const t=e.target;
  switch(t.id){
    case "inpName":S.name=t.value;renderSummary();commitSoon();break;
    case "inpEpithet":S.epithet=t.value;renderSummary();commitSoon();break;
    case "inpFlavor":S.flavor=t.value;renderSummary();commitSoon();break;
    case "inpLevel":setLevel(t.value,true);break;
    case "pkSearch":pk.q=t.value;pk.page=0;renderCards();break;
  }
});
document.addEventListener("change",e=>{
  const t=e.target;
  switch(t.id){
    case "inpLevel":setLevel(t.value,false);break;
    case "selRank":S.rank=t.value;RANK_PINNED=true;renderSummary();commit();break;
    case "inpImg":portraitFromUrl(t.value);break;
    case "file":portraitFromFile(t.files[0]);t.value="";break;
    case "onlyUnlocked":PREFS.onlyUnlocked=t.checked;savePrefs();renderTrees();break;
    case "shImg":PREFS.shImg=t.checked;savePrefs();makeLink();break;
    case "shFull":PREFS.shFull=t.checked;savePrefs();break;
    case "cmpSel":cmpFromSelect(t.value);break;
    case "backupFile":importBackup(t.files[0]);t.value="";break;
  }
});
document.addEventListener("focusout",e=>{
  const id=e.target.id;
  if(id==="inpName"||id==="inpEpithet"||id==="inpFlavor")commitSoon.flush();
  if(id==="svRename")finishRename(true);
});
document.addEventListener("keydown",e=>{
  const t=e.target;
  if(t.id==="svRename"&&(e.key==="Enter"||e.key==="Escape")){e.preventDefault();e.stopPropagation();finishRename(e.key==="Enter");return;}
  if(t.id==="svName"&&e.key==="Enter"){e.preventDefault();saveNew();return;}
  if(t.id==="cmpIn"&&e.key==="Enter"){e.preventDefault();cmpFromCode();return;}
  if(e.key==="Escape"){glHide();if(MOVE!==null){MOVE=null;renderSlots();}return;}
  const mod=e.ctrlKey||e.metaKey;if(!mod||e.altKey)return;
  if(t.closest&&t.closest("input,textarea,select,[contenteditable]"))return;   /* fields keep their own undo */
  if($("dialog[open]"))return;
  const k=e.key.toLowerCase();
  if(k==="z"&&!e.shiftKey){e.preventDefault();undo();}
  else if((k==="z"&&e.shiftKey)||k==="y"){e.preventDefault();redo();}
});
/* skill strip: preview on hover and keyboard focus */
document.addEventListener("mouseover",e=>{const b=e.target.closest&&e.target.closest(".tskill");if(b)tierPreview(b);});
document.addEventListener("mouseout",e=>{const s=e.target.closest&&e.target.closest(".tstrip");if(s&&!(e.relatedTarget&&s.contains(e.relatedTarget)))tierPreviewEnd(s);});
document.addEventListener("focusin",e=>{if(e.target.classList&&e.target.classList.contains("tskill"))tierPreview(e.target);});
document.addEventListener("focusout",e=>{const s=e.target.closest&&e.target.closest(".tstrip");if(s&&!(e.relatedTarget&&s.contains(e.relatedTarget)))tierPreviewEnd(s);});
/* expanded skill rows survive re-renders */
document.addEventListener("toggle",e=>{const k=e.target.dataset&&e.target.dataset.sk;if(!k)return;e.target.open?OPEN.add(k):OPEN.delete(k);},true);

/* drag a slot onto another to move or swap it */
const slotsEl=$("#slots");
slotsEl.addEventListener("dragstart",e=>{
  const s=e.target.closest&&e.target.closest(".slot[draggable=true]");if(!s)return;
  MOVE=+s.dataset.slot;try{e.dataTransfer.setData("text/plain",String(MOVE));e.dataTransfer.effectAllowed="move";}catch(x){}
  requestAnimationFrame(markMoveTargets);
});
slotsEl.addEventListener("dragover",e=>{const s=e.target.closest(".slot");if(s&&MOVE!==null&&canMove(MOVE,+s.dataset.slot)){e.preventDefault();try{e.dataTransfer.dropEffect="move";}catch(x){}}});
slotsEl.addEventListener("drop",e=>{const s=e.target.closest(".slot");if(!s||MOVE===null)return;e.preventDefault();const i=+s.dataset.slot;if(canMove(MOVE,i))doMove(MOVE,i);});
slotsEl.addEventListener("dragend",()=>{if(MOVE!==null){MOVE=null;renderSlots();markMoveTargets();}});

/* portrait: drop or paste an image */
const hasFiles=e=>!!(e.dataTransfer&&Array.from(e.dataTransfer.types||[]).includes("Files"));
const por=$("#portrait");
["dragenter","dragover"].forEach(ev=>por.addEventListener(ev,e=>{if(hasFiles(e)){e.preventDefault();por.classList.add("drop");}}));
["dragleave","drop"].forEach(ev=>por.addEventListener(ev,()=>por.classList.remove("drop")));
por.addEventListener("drop",e=>{if(!hasFiles(e))return;e.preventDefault();e.stopPropagation();const f=e.dataTransfer.files[0];if(f)portraitFromFile(f,"Portrait updated");});
document.addEventListener("dragover",e=>{if(hasFiles(e))e.preventDefault();});
document.addEventListener("drop",e=>{if(hasFiles(e))e.preventDefault();});   /* a stray drop shouldn't navigate away */
document.addEventListener("paste",e=>{
  if((e.target.closest&&e.target.closest("input,textarea"))||$("dialog[open]"))return;
  const it=Array.from((e.clipboardData&&e.clipboardData.items)||[]).find(i=>i.kind==="file"&&/^image\//.test(i.type));
  if(it){e.preventDefault();portraitFromFile(it.getAsFile(),"Portrait pasted");}
});

/* keep the sticky points bar just under the (sticky) header */
(function(){const hd=$("header"),set=()=>document.documentElement.style.setProperty("--hh",hd.offsetHeight+"px");set();if(window.ResizeObserver)new ResizeObserver(set).observe(hd);else addEventListener("resize",set);})();

/* ================= boot ================= */
async function migrateV1(){
  if(store.raw(KEY.migrated))return;
  const oldPref=store.raw("sk_onlyUnlocked");
  if(oldPref!==null&&store.raw(KEY.prefs)===null){PREFS.onlyUnlocked=oldPref==="1";savePrefs();}
  const old=store.get("stp_saves",null);
  if(Array.isArray(old)&&old.length&&!store.raw(KEY.saves)){
    const sv=[],now=Date.now();
    for(const s of old){
      const r=s&&parseCode(s.c);if(!r)continue;
      sv.push({id:newId(),name:String(s.name||"Saved build").slice(0,60),code:code(r.st),img:await storeImgRef(s.img),created:now,updated:now});
    }
    if(sv.length&&!store.set(KEY.saves,sv))return;   /* try again next time */
  }
  store.setRaw(KEY.migrated,"1");
}
async function loadFromHash(h,boot){
  const r=await parseAny(h);
  if(!r){toast("That link doesn't contain a valid build");return false;}
  commitSoon.flush();
  const prev=H.i>=0?fromSnap(H.list[H.i]):null;
  /* the link is the build already open here: keep the local copy (it has the full-size portrait) */
  if(prev&&code(prev)===code(r.st)&&(!r.st.image||prev.imageKey||prev.image===r.st.image)){
    if(boot){S=prev;MOVE=null;inferRankPin();renderAll();updateUndo();syncHash();}
    return true;
  }
  const hadWork=prev&&!isBlank(prev);
  S=r.st;CURRENT_SAVE=null;MOVE=null;inferRankPin();
  if(S.image&&S.image.startsWith("data:"))imgRef(S);
  renderAll();commit();
  const note=r.changed.length?" · "+r.changed.join(", ")+" changed since this link was made, so points were snapped to the current tiers":"";
  if(!isBlank(S)||note)toast((S.name?"Loaded build: "+S.name:"Loaded build from link")+note,hadWork?{action:"Undo",fn:undo,ms:note?9000:6000}:{ms:note?9000:2500});
  return true;
}
async function gcImages(){
  try{
    const keep=new Set();
    getSaves().forEach(s=>{if(s.img&&s.img.startsWith("idb:"))keep.add(s.img.slice(4));});
    H.list.forEach(s=>{try{const r=JSON.parse(s)[7];if(r&&r.startsWith("idb:"))keep.add(r.slice(4));}catch(e){}});
    if(S.imageKey)keep.add(S.imageKey);
    if(CB&&CB.imageKey)keep.add(CB.imageKey);
    for(const k of await imgStore.keys())if(!keep.has(k))await imgStore.del(k);
  }catch(e){}
}
async function boot(){
  $("#verLabel").textContent="v"+APP_VERSION.split(".")[0];
  try{await migrateV1();}catch(e){}
  loadHist();
  const h=location.hash.slice(1);
  let ok=false;
  if(h.length>1)ok=await loadFromHash(h,true);
  if(!ok){if(H.i>=0){restore(H.list[H.i]);inferRankPin();}else{S=blank();renderAll();commit();}}
  updateUndo();
  setTimeout(gcImages,5000);
}
addEventListener("hashchange",()=>{const h=location.hash.slice(1);if(h&&h!==LAST_HASH)loadFromHash(h,false);});
addEventListener("pagehide",()=>{commitSoon.flush();syncHash.flush();saveHist.flush();});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"){commitSoon.flush();syncHash.flush();saveHist.flush();}});

/* small debug handle (also used by the tests) */
window.BuildPlanner={version:APP_VERSION,get state(){return S;},get history(){return H;},code:()=>code(),parseAny,undo,redo,appliesOf:()=>appliesOf(S)};

boot();
})();
