const APP_VERSION="3.3.75";
const KEY="seblak_story_v314";
const TELEGRAM_SETTINGS_KEY="seblak_story_telegram_v1";
let telegramTimer=null, telegramBusy=false;
const GITHUB_SETTINGS_KEY="seblak_story_github_backup_v1";
let githubBackupTimer=null;
let githubBackupBusy=false;
const STOCK_KEY="seblak_story_stock_v318";
const PRINTER_SETTINGS_KEY="seblak_story_printer_ble_v1";
let blePrinterDevice=null, blePrinterCharacteristic=null;
let store=JSON.parse(localStorage.getItem(KEY)||"null")||{tx:[]};
let stocks=JSON.parse(localStorage.getItem(STOCK_KEY)||"null");
if(!Array.isArray(stocks)){
  let legacy=null;
  for(const k of ["seblak_story_stock_v317","seblak_story_stock_v314","seblak_story_stock_v313","seblak_story_stock_v312"]){
    try{const z=JSON.parse(localStorage.getItem(k)||"null");if(Array.isArray(z)){legacy=z;break}}catch(e){}
  }
  stocks=Array.isArray(legacy)?legacy:[];
}
let stockFilter="all";
let stockSort="name";
let stockQtyFilter="all";
let stockStatusFilter="all";
function migrateStockToPack(){
  let changed=false;
  stocks=stocks.map(x=>{
    if(!x||typeof x!=="object") return x;
    const pack=Math.max(1,Number(x.pack)||1);
    // Data versions before v3.3.18 stored qty/min in the base unit (usually pcs).
    // Convert to whole packs once, preserving existing data as closely as possible.
    const wasPack=x.stockUnit==="pack" || x.unit==="pack";
    const qty=wasPack?Math.max(0,Number(x.qty)||0):Math.ceil(Math.max(0,Number(x.qty)||0)/pack);
    const min=wasPack?Math.max(0,Number(x.min)||0):Math.ceil(Math.max(0,Number(x.min)||0)/pack);
    const lastSO=wasPack?Math.max(0,Number(x.lastSO??qty)||0):Math.ceil(Math.max(0,Number(x.lastSO??qty)||0)/pack);
    if(x.qty!==qty||x.min!==min||x.lastSO!==lastSO||x.stockUnit!=="pack"){changed=true;}
    return {...x,unit:"pack",stockUnit:"pack",pack,min,qty,lastSO};
  });
  if(changed)localStorage.setItem(STOCK_KEY,JSON.stringify(stocks));
}
migrateStockToPack();
function normalizeTxData(){
  if(!Array.isArray(store.tx))store.tx=[];
  let changed=false;
  store.tx=store.tx.map(x=>{
    if(!x||typeof x!=="object")return x;
    const y={...x};
    const rawType=String(y.type??y.jenis??y.kind??"").trim().toLowerCase();
    if(["pemasukan","income","masuk","in","credit"].includes(rawType)) y.type="in";
    else if(["pengeluaran","expense","keluar","out","debit"].includes(rawType)) y.type="out";
    else if(y.type!=="in"&&y.type!=="out") y.type=String(y.name||"").toLowerCase().includes("pengeluaran")?"out":"in";
    const n=typeof y.amount==="number"?y.amount:Number(String(y.amount??y.jumlah??0).replace(/[^0-9-]/g,""))||0;
    if(y.amount!==n){y.amount=n;changed=true}
    if(!y.source){y.source="MANUAL";changed=true}
    const pmRaw=String(y.paymentMethod||"").trim().toLowerCase();
    const nameRaw=String(y.name||"").trim().toLowerCase();
    const inferred=pmRaw.includes("non")||nameRaw.includes("non tunai")||nameRaw.includes("nontunai")||Number(y.nonCash||0)>0?"Non Tunai":"Tunai";
    if(y.paymentMethod!==inferred){y.paymentMethod=inferred;changed=true}
    return y;
  });
  if(changed)persist();
}
normalizeTxData();
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n)||0);
const printerMoney=n=>"Rp "+Math.round(Number(n)||0).toLocaleString("en-US").replace(/,/g,".");
function sanitizePrinterText(text){return String(text).replace(/\u00a0/g," ").replace(/[\u2000-\u200B\u202F]/g," ").normalize("NFKC").replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"').replace(/\u2013|\u2014/g,"-").replace(/\u2026/g,"...");}
const today=()=>{
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const localDT=()=>{let d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)};
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

let dialogResolve = null;

function showDialog(message, options={}){
  const modal=$("dialogModal");
  $("dialogTitle").textContent=options.title||"Pesan";
  $("dialogMessage").textContent=message;
  const actions=$("dialogActions");
  actions.innerHTML="";
  const buttons=options.buttons||[{label:"Oke",value:true,primary:true}];
  buttons.forEach(b=>{
    const btn=document.createElement("button");
    btn.textContent=b.label;
    btn.className=b.primary?"primary":"";
    btn.onclick=()=>{
      modal.classList.remove("show");
      const r=dialogResolve; dialogResolve=null;
      if(r) r(b.value);
    };
    actions.appendChild(btn);
  });
  modal.classList.add("show");
}
function appAlert(message,title="Pesan"){
  showDialog(message,{title,buttons:[{label:"Oke",value:true,primary:true}]});
}
function appConfirm(message,title="Konfirmasi"){
  return new Promise(resolve=>{
    dialogResolve=resolve;
    showDialog(message,{title,buttons:[
      {label:"Batal",value:false},
      {label:"Oke",value:true,primary:true}
    ]});
  });
}
function appChoice(message,choices,title="Pilih Aksi"){
  return new Promise(resolve=>{
    dialogResolve=resolve;
    showDialog(message,{title,buttons:choices.map(c=>({label:c.label,value:c.value,primary:c.primary}))});
  });
}
function persist(){
  localStorage.setItem(KEY,JSON.stringify(store));
  localStorage.setItem(STOCK_KEY,JSON.stringify(stocks));
  scheduleGitHubBackup();
}

function readGitHubSettings(){
  try{
    const x=JSON.parse(localStorage.getItem(GITHUB_SETTINGS_KEY)||"null");
    return x&&typeof x==="object"?x:{owner:"",repo:"",branch:"main",folder:"backup",token:"",auto:false,lastBackup:"",lastStatus:""};
  }catch(e){return {owner:"",repo:"",branch:"main",folder:"backup",token:"",auto:false,lastBackup:"",lastStatus:""}}
}
function saveGitHubSettingsLocal(x){localStorage.setItem(GITHUB_SETTINGS_KEY,JSON.stringify(x))}
async function updateBackupCryptoStatus(){const el=$("ghCryptoStatus");if(!el)return;try{el.textContent=await hasBackupEncryption()?"🔐 Enkripsi aktif di perangkat ini.":"⚠️ Enkripsi backup belum diaktifkan."}catch(e){el.textContent="Status enkripsi tidak tersedia."}}
async function setupBackupEncryptionFromUI(){const input=$("ghBackupPassword");const pass=input?.value||"";if(!pass){appAlert("Masukkan password backup minimal 8 karakter.","Password backup");return}try{await prepareBackupEncryption(pass);if(input)input.value="";await updateBackupCryptoStatus();appAlert("Enkripsi backup aktif. Password tidak disimpan di file backup. Simpan password Anda karena diperlukan saat restore di HP lain.","Enkripsi aktif")}catch(e){appAlert(e.message||"Gagal mengaktifkan enkripsi.","Enkripsi gagal")}}
function openGitHubSettings(){
  const s=readGitHubSettings();
  $("ghOwner").value=s.owner||""; $("ghRepo").value=s.repo||""; $("ghBranch").value=s.branch||"main";
  $("ghFolder").value=s.folder||"backup"; $("ghToken").value=s.token||""; $("ghAuto").checked=!!s.auto;
  const status=s.lastStatus ? `${s.lastStatus}${s.lastBackup?" • "+s.lastBackup:""}` : (s.auto?"Backup otomatis aktif.":"Belum terhubung.");
  $("ghStatus").textContent=status;
  $("githubModal").classList.add("show"); updateBackupCryptoStatus();
}
function closeGitHubSettings(){$("githubModal").classList.remove("show")}
function getGitHubForm(){
  return {
    owner:$("ghOwner").value.trim(), repo:$("ghRepo").value.trim(), branch:$("ghBranch").value.trim()||"main",
    folder:$("ghFolder").value.trim().replace(/^\/+|\/+$/g,"")||"backup", token:$("ghToken").value.trim(), auto:$("ghAuto").checked
  };
}
function saveGitHubSettings(){
  const old=readGitHubSettings(), s=getGitHubForm();
  s.lastBackup=old.lastBackup||""; s.lastStatus=old.lastStatus||"";
  saveGitHubSettingsLocal(s);
  $("ghStatus").textContent=s.auto?"Pengaturan tersimpan • Backup otomatis aktif.":"Pengaturan tersimpan • Backup otomatis nonaktif.";
  if(s.auto) scheduleGitHubBackup();
  appAlert(s.auto?"Backup otomatis GitHub sudah diaktifkan. Backup akan dijalankan setelah data berubah.":"Pengaturan GitHub tersimpan. Backup otomatis saat ini nonaktif.","Pengaturan GitHub");
}
function base64Unicode(text){
  const bytes=new TextEncoder().encode(text); let binary="";
  const chunk=0x8000; for(let i=0;i<bytes.length;i+=chunk) binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
  return btoa(binary);
}

const BACKUP_CRYPTO_DB="seblak_story_backup_crypto_v1";
const BACKUP_CRYPTO_STORE="keys";
function b64FromBytes(bytes){let bin="";const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)bin+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(bin)}
function bytesFromB64(s){const bin=atob(s);const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
function openCryptoDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(BACKUP_CRYPTO_DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(BACKUP_CRYPTO_STORE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function putLocalCryptoKey(key){const db=await openCryptoDB();return new Promise((resolve,reject)=>{const tx=db.transaction(BACKUP_CRYPTO_STORE,"readwrite");tx.objectStore(BACKUP_CRYPTO_STORE).put(key,"deviceKey");tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}
async function getLocalCryptoKey(){const db=await openCryptoDB();return new Promise((resolve,reject)=>{const tx=db.transaction(BACKUP_CRYPTO_STORE,"readonly");const r=tx.objectStore(BACKUP_CRYPTO_STORE).get("deviceKey");r.onsuccess=()=>{db.close();resolve(r.result||null)};r.onerror=()=>{db.close();reject(r.error)}})}
async function deriveWrapKey(password,salt){const base=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveKey"]);return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:250000,hash:"SHA-256"},base,{name:"AES-KW",length:256},false,["wrapKey","unwrapKey"])}
async function prepareBackupEncryption(password){
  if(!password||password.length<8)throw new Error("Password backup minimal 8 karakter.");
  const key=await crypto.subtle.generateKey({name:"AES-GCM",length:256},true,["encrypt","decrypt"]);
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const wrapKey=await deriveWrapKey(password,salt);
  const wrapped=await crypto.subtle.wrapKey("raw",key,wrapKey,{name:"AES-KW"});
  await putLocalCryptoKey(key);
  localStorage.setItem("seblak_story_backup_crypto_meta_v1",JSON.stringify({salt:b64FromBytes(salt),wrappedKey:b64FromBytes(new Uint8Array(wrapped)),updatedAt:new Date().toISOString()}));
  return true;
}
async function hasBackupEncryption(){return !!(await getLocalCryptoKey())}
async function encryptedBackupObject(){
  const key=await getLocalCryptoKey();
  if(!key)throw new Error("Enkripsi backup belum diaktifkan. Masukkan password backup terlebih dahulu.");
  const plain=JSON.stringify(backupPlainPayload());
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(plain));
  const meta=JSON.parse(localStorage.getItem("seblak_story_backup_crypto_meta_v1")||"null");
  if(!meta?.salt||!meta?.wrappedKey)throw new Error("Konfigurasi enkripsi backup tidak lengkap. Aktifkan kembali enkripsi backup.");
  return {format:"SSB-ENC-1",app:"Seblak Story Pembukuan",appVersion:APP_VERSION,encryptedAt:new Date().toISOString(),kdf:"PBKDF2-SHA256-250000",cipher:"AES-256-GCM",salt:meta.salt,wrappedKey:meta.wrappedKey,iv:b64FromBytes(iv),ciphertext:b64FromBytes(new Uint8Array(cipher))};
}
async function decryptBackupObject(root,password){
  if(root?.format!=="SSB-ENC-1")throw new Error("File backup terenkripsi tidak dikenali.");
  if(!password||password.length<8)throw new Error("Password backup minimal 8 karakter.");
  const salt=bytesFromB64(root.salt), wrapped=bytesFromB64(root.wrappedKey);
  const wrapKey=await deriveWrapKey(password,salt);
  let key; try{key=await crypto.subtle.unwrapKey("raw",wrapped,wrapKey,{name:"AES-KW"},{name:"AES-GCM",length:256},false,["decrypt"])}catch(e){throw new Error("Password backup salah atau backup rusak.")}
  const iv=bytesFromB64(root.iv), cipher=bytesFromB64(root.ciphertext);
  let plain; try{plain=await crypto.subtle.decrypt({name:"AES-GCM",iv},key,cipher)}catch(e){throw new Error("Backup tidak dapat didekripsi. Password salah atau file rusak.")}
  const payload=JSON.parse(new TextDecoder().decode(plain));
  await putLocalCryptoKey(key);
  localStorage.setItem("seblak_story_backup_crypto_meta_v1",JSON.stringify({salt:root.salt,wrappedKey:root.wrappedKey,updatedAt:new Date().toISOString()}));
  return payload;
}
function backupPlainPayload(){
  const all={};
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k)all[k]=localStorage.getItem(k)}
  return {app:"Seblak Story Pembukuan",appVersion:APP_VERSION,exportedAt:new Date().toISOString(),data:all};
}
async function ensureBackupEncryption(){
  if(await hasBackupEncryption())return true;
  const pass=prompt("Buat password backup terenkripsi (minimal 8 karakter). Password ini diperlukan saat restore di HP lain:");
  if(!pass)return false;
  await prepareBackupEncryption(pass);
  return true;
}

function githubConfigReady(s){return !!(s.owner&&s.repo&&s.branch&&s.folder&&s.token)}
function githubApiHeaders(token){return {"Accept":"application/vnd.github+json","Authorization":"Bearer "+token,"X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"}}
async function backupPayload(){return await encryptedBackupObject()}
function githubFileUrl(s,path){return `https://api.github.com/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`}
async function githubPutJson(s,path,payload,message){
  const url=githubFileUrl(s,path), headers=githubApiHeaders(s.token);
  const jsonContent=JSON.stringify(payload,null,2);

  // GitHub requires the current file SHA when replacing an existing file.
  // The SHA can change between GET and PUT (for example after another backup
  // or a commit from another device), so retry with a freshly-read SHA.
  let lastError="";
  for(let attempt=0; attempt<4; attempt++){
    let sha=null;
    const get=await fetch(url+`?ref=${encodeURIComponent(s.branch)}`,{headers,cache:"no-store"});
    if(get.ok){
      const current=await get.json();
      if(current.type && current.type!=="file") throw new Error("Path backup bukan file di GitHub.");
      sha=current.sha||null;
    }else if(get.status!==404){
      let detail=""; try{detail=(await get.json()).message||""}catch(e){}
      throw new Error(detail||`GitHub GET gagal (${get.status})`);
    }

    const body={message,content:base64Unicode(jsonContent),branch:s.branch};
    if(sha) body.sha=sha;

    const put=await fetch(url,{method:"PUT",headers,body:JSON.stringify(body),cache:"no-store"});
    if(put.ok) return put.json();

    let detail="";
    try{detail=(await put.json()).message||""}catch(e){}
    lastError=detail||`GitHub upload gagal (${put.status})`;

    // SHA mismatch means the file changed after our GET. Re-read and retry.
    if(put.status===409 || /sha.*(does not match|mismatch|wasn't supplied|required)/i.test(lastError)){
      await new Promise(r=>setTimeout(r,300*(attempt+1)));
      continue;
    }
    throw new Error(lastError);
  }
  throw new Error(lastError||"GitHub upload gagal setelah beberapa percobaan. Silakan coba lagi.");
}
async function githubBackupNow(showMessage=true){
  if(githubBackupBusy)return;
  const s=readGitHubSettings();
  if(!githubConfigReady(s)){if(showMessage)appAlert("Lengkapi Owner, Repository, Branch, Folder Backup, dan token GitHub terlebih dahulu.","Pengaturan GitHub belum lengkap");return}
  githubBackupBusy=true;
  const status=$("ghStatus"); if(status)status.textContent="Mengunggah backup ke GitHub…";
  try{
    const payload=await backupPayload();
    const day=today();
    const path=`${s.folder}/backup-${day}.json`;
    await githubPutJson(s,path,payload,`Backup Pembukuan Seblak Story ${day}`);
    const now=new Date().toLocaleString("id-ID");
    const next={...s,lastBackup:now,lastStatus:"Backup GitHub berhasil"}; saveGitHubSettingsLocal(next);
    if(status)status.textContent=`Backup GitHub berhasil • ${now} • ${path}`;
    if(showMessage)appAlert(`Backup berhasil diunggah ke GitHub.\n\nFile: ${path}\nWaktu: ${now}`,"Backup GitHub berhasil");
  }catch(err){
    const msg=err?.message||"Gagal mengunggah backup ke GitHub.";
    const next={...s,lastStatus:"Backup GitHub gagal: "+msg}; saveGitHubSettingsLocal(next);
    if(status)status.textContent="Gagal: "+msg;
    if(showMessage)appAlert(msg+"\n\nData lokal tetap aman dan tidak dihapus.","Backup GitHub gagal");
  }finally{githubBackupBusy=false}
}
function scheduleGitHubBackup(){
  const s=readGitHubSettings();
  if(!s.auto||!githubConfigReady(s))return;
  clearTimeout(githubBackupTimer);
  githubBackupTimer=setTimeout(()=>githubBackupNow(false),1800);
}

function refresh(){
  const active=document.querySelector('.page.active');
  if(!active)return;
  const id=active.id;
  if(id==="dashboard")renderDashboard();
  else if(id==="transaksi")renderTransactions();
  else if(id==="stok")renderStock();
  else if(id==="laporan")renderReport();
  else if(id==="backup")renderInfo();
  else if(id==="syncpos")renderSyncHistory();
}
let restoringHistory=false;
function showPage(id,btn){
  const target=$(id); if(!target)return false;
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  target.classList.add('active');
  document.querySelectorAll('[data-page]').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll(`[data-page="${id}"]`).forEach(x=>x.classList.add('active'));
  if(btn&&btn.dataset)btn.classList.add('active');
  if(id==='dashboard')renderDashboard();
  if(id==='transaksi')renderTransactions();
  if(id==='stok')renderStock();
  if(id==='laporan')renderReport();
  if(id==='backup')renderInfo();
  if(id==='syncpos')renderSyncHistory();
  window.scrollTo({top:0,behavior:'smooth'});
  return true;
}
function page(id,btn){
  if(!$(id))return;
  showPage(id,btn);
  if(!restoringHistory){
    const current=history.state?.page;
    if(current!==id)history.pushState({page:id},'',window.location.href.split('#')[0]+'#'+id);
  }
}
function closeAnyOpenModal(){
  const ids=['modal','stockModal','soModal','buyModal','githubModal','telegramModal','printerModal','dialogModal'];
  let closed=false;
  ids.forEach(id=>{const el=$(id);if(el?.classList.contains('show')){el.classList.remove('show');closed=true}});
  return closed;
}
function initBackNavigation(){
  const initial=location.hash.replace(/^#/,'')||'dashboard';
  history.replaceState({page:initial,root:true},'',window.location.href.split('#')[0]+'#'+initial);
  if(initial!=='dashboard')showPage(initial,document.querySelector(`[data-page="${initial}"]`));
  window.addEventListener('popstate',()=>{
    if(closeAnyOpenModal())return;
    const id=history.state?.page||'dashboard';
    restoringHistory=true;
    showPage(id,document.querySelector(`[data-page="${id}"]`));
    restoringHistory=false;
  });
}
function toggleMenu(){ page('lainnya',document.querySelector('[data-page="lainnya"]')); }
let txTab='in';
function setTxTab(tab){ txTab=tab||'in'; document.querySelectorAll('.tabs button').forEach(b=>b.classList.remove('active')); const id=txTab==='out'?'tabOut':txTab==='all'?'tabAll':'tabIn'; $(id)?.classList.add('active'); const ft=$('filterType'); if(ft)ft.value=txTab==='all'?'':txTab; const add=$('txAddBtn'); if(add)add.textContent=txTab==='out'?'＋ Tambah Pengeluaran':'＋ Tambah Pemasukan'; renderTransactions(); }

function updateTxNameField(){
  const isIncome=$("tType").value==="in";
  $("incomeNameWrap").style.display=isIncome?"block":"none";
  $("expenseNameWrap").style.display=isIncome?"none":"block";
  $("expensePaymentWrap").style.display=isIncome?"none":"block";
}
function openTx(id=null, forcedType=null){
  $("modal").classList.add("show");
  $("modalTitle").textContent=id?"Edit Transaksi":"Tambah Transaksi";
  $("editId").value=id||"";
  $("tDate").value=localDT();
  $("tIncomeName").value="Tunai";
  $("tName").value="";
  $("tAmount").value="";
  $("tNote").value="";
  $("tExpensePayment").value="Tunai";
  $("tType").value=forcedType||"in";
  if(id){
    let x=store.tx.find(a=>a.id==id);
    if(x){
      $("tType").value=x.type;
      $("tDate").value=x.date;
      if(x.type==="in"){
        $("tIncomeName").value=(x.name==="Non Tunai"||x.name==="Nontunai")?"Non Tunai":"Tunai";
      }else{
        $("tName").value=x.name||"";
        $("tExpensePayment").value=txPaymentMethod(x);
      }
      $("tAmount").value=x.amount;
      $("tNote").value=x.note||"";
    }
  }
  updateTxNameField();
}
function closeModal(){$("modal").classList.remove("show")}
function saveTx(){
  const isIncome=$("tType").value==="in";
  let name=isIncome ? $("tIncomeName").value : $("tName").value.trim();
  const paymentMethod=isIncome ? name : ($("tExpensePayment").value||"Tunai");
  let amount=Number($("tAmount").value),id=$("editId").value;
  if(!name||amount<=0)return appAlert("Nama transaksi dan jumlah wajib diisi.","Data belum lengkap");
  const date=$("tDate").value||localDT();
  const old=id?store.tx.find(a=>a.id==id):null;
  let x={id:id?Number(id):Date.now(),type:$("tType").value,date,name,amount,paymentMethod,note:$("tNote").value.trim(),source:old?.source||"MANUAL",sourceId:old?.sourceId||null};
  if(id)store.tx=store.tx.map(a=>a.id==id?x:a);else store.tx.push(x);
  persist(); closeModal(); refresh();
  if(document.getElementById("laporan")?.classList.contains("active")) renderReport();
}

function txPaymentMethod(x){
  const raw=String(x?.paymentMethod||"").trim().toLowerCase();
  if(raw.includes("non"))return "Non Tunai";
  if(x?.type==="in"){const n=String(x?.name||"").toLowerCase();if(n.includes("non tunai")||n.includes("nontunai")||Number(x?.nonCash||0)>0)return "Non Tunai";}
  return "Tunai";
}
function balanceTotals(){
  let tunai=0,nonTunai=0;
  (store.tx||[]).forEach(x=>{const amount=Number(x?.amount||0)||0; if(txPaymentMethod(x)==="Non Tunai") nonTunai += x?.type==="out" ? -amount : amount; else tunai += x?.type==="out" ? -amount : amount;});
  return {tunai,nonTunai,total:tunai+nonTunai};
}

function sum(a,t){return a.filter(x=>x.type===t).reduce((s,x)=>s+Number(x.amount||0),0)}

let dashboardSelectedDate = today();

function formatDashboardDate(iso){
  const d = new Date(String(iso).slice(0,10) + "T00:00:00");
  return d.toLocaleDateString("id-ID",{weekday:"long",day:"2-digit",month:"long",year:"numeric"});
}

function openDashboardDate(){
  const input = $("dashboardDateInput");
  if(!input) return;
  input.value = dashboardSelectedDate || today();
  try{
    if(typeof input.showPicker === "function") input.showPicker();
    else input.click();
  }catch(e){ input.click(); }
}

function setDashboardDate(value){
  if(!value) return;
  dashboardSelectedDate = value;
  renderDashboard();
}

function renderDashboard(){
  const d=dashboardSelectedDate||today(), m=d.slice(0,7);
  const td=store.tx.filter(x=>txDay(x)===d);
  const mo=store.tx.filter(x=>txDay(x).slice(0,7)===m);
  const bal=balanceTotals();
  $('dSaldo').textContent=money(bal.total);
  if($('dCashBalance'))$('dCashBalance').textContent=money(bal.tunai);
  if($('dNonCashBalance'))$('dNonCashBalance').textContent=money(bal.nonTunai);
  $('dIn').textContent=money(sum(td,'in'));
  $('dOut').textContent=money(sum(td,'out'));
  if($('dCount')) $('dCount').textContent=mo.length;

  const dateLabel=$('dashDate'); if(dateLabel) dateLabel.textContent=formatDashboardDate(d);
  const input=$('dashboardDateInput');
  if(input) input.value=d;

  const chart=$('weekChart'); if(!chart) return; let html='';
  const base=new Date(d+"T00:00:00");
  for(let i=6;i>=0;i--){
    const x=new Date(base); x.setDate(base.getDate()-i);
    const k=`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
    const ins=sum(store.tx.filter(t=>txDay(t)===k),'in');
    const outs=sum(store.tx.filter(t=>txDay(t)===k),'out');
    const mx=Math.max(ins,outs,1);
    html+=`<div class="barDay"><div class="bars"><i class="bar inBar" style="height:${Math.max(6,ins/mx*70)}px"></i><i class="bar outBar" style="height:${Math.max(6,outs/mx*70)}px"></i></div><small>${x.getDate()}</small></div>`;
  }
  chart.innerHTML=html;
}

function renderTransactions(){
  const q=($('search')?.value||'').toLowerCase(), from=$('from')?.value||'', to=$('to')?.value||'', month=$('kasMonth')?.value||today().slice(0,7); if($('kasMonth')&&!$('kasMonth').value)$('kasMonth').value=month;
  let r=store.tx.filter(x=>(txTab==='all'||x.type===txTab)&&(!q||(x.name+' '+(x.note||'')).toLowerCase().includes(q))&&txDay(x).slice(0,7)===month&&(!from||txDay(x)>=from)&&(!to||txDay(x)<=to)).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const total=sum(r,txTab==='out'?'out':'in'); $('kasTotal').innerHTML=`Total ${txTab==='out'?'Pengeluaran':'Pemasukan'} <b>${money(total)}</b>`;
  $('txCards').innerHTML=r.map(x=>{const xid=esc(String(x.id));return `<div class="txWrap" data-tx-id="${xid}"><div class="txCard ${x.type==='in'?'incomeCard':'expenseCard'}"><div class="txIcon">${x.type==='in'?'▣':'■'}</div><div class="txMain"><b>${esc(x.name)}</b><small>${esc(String(x.date||'').replace('T',' '))}</small>${x.note?`<small>${esc(x.note)}</small>`:''}</div><div class="txAmount ${x.type==='in'?'green':'red'}">${money(x.amount)}<span>${txPaymentMethod(x)}</span></div><button type="button" class="moreBtn txActionBtn" data-tx-id="${xid}" aria-label="Aksi transaksi">⋮</button></div><div class="inlineTxActions" hidden><button type="button" class="txEditBtn" data-tx-id="${xid}">✎ Edit</button><button type="button" class="danger txDeleteBtn" data-tx-id="${xid}">🗑 Hapus</button></div></div>`}).join('')||'<div class="empty">Belum ada transaksi.</div>';
}

function removeTx(id){appConfirm("Hapus transaksi ini?","Hapus transaksi").then(ok=>{if(ok){store.tx=store.tx.filter(x=>x.id!=id);persist();refresh()}})}
function openStock(id=null){$("stockModal").classList.add("show");$("stockTitle").textContent=id?"Edit Stok":"Tambah Stok";$("stockId").value=id||"";$("sName").value="";$("sPack").value="";$("sMin").value="";$("sQty").value="0";if(id){let x=stocks.find(a=>a.id==id);if(x){$("sName").value=x.name;$("sPack").value=x.pack;$("sMin").value=x.min;$("sQty").value=x.qty}}}
function closeStock(){$("stockModal").classList.remove("show")}
function saveStock(){let id=$("stockId").value,name=$("sName").value.trim(),pack=Number($("sPack").value)||1,min=Number($("sMin").value),qty=Number($("sQty").value);if(!name||pack<=0||min<0||qty<0)return appAlert("Lengkapi nama, isi/pack, minimum pack, dan stok pack.","Data belum lengkap");let old=id?stocks.find(a=>a.id==id):null;let initialQty=old?.initialQty??qty;let x={id:id?Number(id):Date.now(),name,unit:"pack",stockUnit:"pack",pack,min,qty,initialQty,lastSO:old?.lastSO??qty};if(id)stocks=stocks.map(a=>a.id==id?x:a);else stocks.push(x);persist();closeStock();renderStock()}
function stockStatus(x){return x.qty===0?'<span class="status low">Kurang</span>':x.qty<=x.min?'<span class="status low">Sisa Sedikit</span>':'<span class="status safe">Aman</span>'}
function soCondition(qty,min){return qty<=0?"kurang":qty<=min?"sedikit":"aman"}
function updateSOCondition(){const qty=Math.max(0,Number($("soQty").value)||0),x=stocks.find(a=>a.id===Number($("soId").value));if(!x)return;const st=soCondition(qty,x.min);document.querySelectorAll('input[name="soCondition"]').forEach(r=>r.checked=r.value===st);$("soConditionHint").textContent=st==="aman"?"Aman":st==="sedikit"?"Sisa Sedikit":"Kurang"}
function openSO(id){let x=stocks.find(a=>a.id==id);if(!x)return;$("soModal").classList.add("show");$("soId").value=id;$("soLabel").textContent=`Stok ${x.name} • Sistem ${x.qty} pack • Minimum ${x.min} pack`;$("soQty").value=x.qty;updateSOCondition()}
function closeSO(){$("soModal").classList.remove("show")}
function saveSO(){let id=Number($("soId").value),qty=Number($("soQty").value),x=stocks.find(a=>a.id===id);if(!x||qty<0)return appAlert("Stok fisik tidak boleh negatif.","Data tidak valid");const condition=soCondition(qty,x.min);stocks=stocks.map(a=>a.id===id?{...a,qty,lastSO:qty,lastSOCondition:condition}:a);persist();closeSO();renderStock()}
function getLastBuyPrice(x){
  if(x&&Number(x.lastBuyPrice)>0)return Number(x.lastBuyPrice);
  const prefix=`Pembelian stok - ${String(x?.name||"")}`;
  for(const t of (store.tx||[]).slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")))){
    if(String(t?.name||"")!==prefix)continue;
    const m=String(t?.note||"").match(/×\s*Rp\s*([\d.,]+)\s*per pack/i);
    if(m){const n=Number(m[1].replace(/[^\d]/g,""));if(n>0)return n;}
    const packs=Number(String(t?.note||"").match(/([\d.,]+)\s*pack/i)?.[1]?.replace(/[^\d]/g,""))||0;
    if(packs>0&&Number(t.amount)>0)return Number(t.amount)/packs;
  }
  return 0;
}
function formatPriceDiff(current,last){
  if(!last||!current)return "—";
  const d=current-last;
  if(d===0)return "Rp 0";
  return `${d>0?"+":"-"}${money(Math.abs(d))}`;
}
function updateBuyPriceInfo(){
  const id=Number($("buyId").value),x=stocks.find(a=>a.id===id);if(!x)return;
  const last=getLastBuyPrice(x),current=Number($("buyPrice").value)||0;
  $("buyLastPrice").textContent=last?money(last):"Belum ada pembelian sebelumnya";
  $("buyPriceDiff").textContent=formatPriceDiff(current,last);
  $("buyPriceDiff").className=`priceDiff ${last&&current?(current>last?"up":current<last?"down":"same"):""}`;
}
function openBuy(id){let x=stocks.find(a=>a.id==id);if(!x)return;$("buyModal").classList.add("show");$("buyId").value=id;$("buyPack").value=1;const last=getLastBuyPrice(x);$("buyPrice").value=last||0;$("buyLabel").textContent=`Beli ${x.name}`;$("buyInfo").textContent=`Stok sekarang: ${x.qty} pack`;updateBuyTotal();updateBuyPriceInfo()}
function closeBuy(){$("buyModal").classList.remove("show")}
function updateBuyTotal(){let packs=Number($("buyPack").value)||0,price=Number($("buyPrice").value)||0;$("buyTotal").textContent=money(packs*price);updateBuyPriceInfo()}
function saveBuy(){let id=Number($("buyId").value),packs=Number($("buyPack").value),price=Number($("buyPrice").value),x=stocks.find(a=>a.id===id);if(!x||packs<=0)return appAlert("Jumlah pack harus lebih dari 0.","Data tidak valid");if(price<=0)return appAlert("Harga per pack wajib diisi.","Data belum lengkap");let total=packs*price;x.qty+=packs;x.lastBuyPrice=price;store.tx.push({id:Date.now(),type:"out",date:localDT(),name:`Pembelian stok - ${x.name}`,amount:total,paymentMethod:"Tunai",note:`${packs} pack × ${money(price)} per pack`});persist();closeBuy();renderStock();renderDashboard();renderTransactions();renderReport();appAlert(`Pembelian tersimpan. Total ${money(total)} masuk ke Pengeluaran Hari Ini.`,"Pembelian tersimpan")}
function openEditDelete(id){
  let x=stocks.find(a=>a.id==id); if(!x)return;
  appChoice(`Pilih aksi untuk ${x.name}.`,[
    {label:"Batal",value:"cancel"},
    {label:"Edit",value:"edit",primary:true},
    {label:"Hapus",value:"delete"}
  ],"Edit / Hapus").then(choice=>{
    if(choice==="edit") openStock(id);
    if(choice==="delete") deleteStock(id);
  });
}
function deleteStock(id){let x=stocks.find(a=>a.id==id);if(x){
  appConfirm(`Hapus stok "${x.name}"?`,"Hapus stok").then(ok=>{
    if(ok){stocks=stocks.filter(a=>a.id!==id);persist();renderStock();}
  });
}}
function setStockFilter(filter){
  stockFilter=filter||"all";
  document.querySelectorAll('.stockFilters button').forEach(b=>b.classList.toggle('active',b.dataset.filter===stockFilter));
  renderStock();
}
function setStockSort(sort){
  stockSort=sort||"name";
  renderStock();
}
function setStockStatusFilter(value){
  stockStatusFilter=value||"all";
  renderStock();
}


function stockStatusValue(x){
  return x.qty===0?'kurang':x.qty<=x.min?'sedikit':'aman';
}
if(Array.isArray(stocks)) stocks.forEach(x=>{if(x.initialQty==null) x.initialQty=x.qty;});
function getBuyListItems(){
  return stocks.filter(x=>x.qty<=x.min).map(x=>{
    const target=Math.max(x.initialQty??x.qty,x.min);
    const buy=Math.max(0,target-x.qty);
    return {name:x.name,buy};
  }).filter(x=>x.buy>0);
}

let bulkBuySelection=[];
const BULK_PENDING_KEY="seblak_story_pending_bulk_purchase_v1";
function savePendingBulkSelection(){try{const a=bulkBuySelection.filter(x=>x.checked).map(x=>({id:x.id,name:x.name,buy:x.buy}));if(a.length)localStorage.setItem(BULK_PENDING_KEY,JSON.stringify(a));else localStorage.removeItem(BULK_PENDING_KEY);}catch(e){}}
function readPendingBulkSelection(){try{const a=JSON.parse(localStorage.getItem(BULK_PENDING_KEY)||"[]");return Array.isArray(a)?a:[]}catch(e){return[]}}
function clearPendingBulkSelection(){try{localStorage.removeItem(BULK_PENDING_KEY)}catch(e){}}
function openBulkBuy(){
  const items=getBuyListItems();
  if(!items.length)return appAlert("Tidak ada barang yang perlu dibeli.","Belanja");
  bulkBuySelection=items.map(x=>{const st=stocks.find(s=>s.name===x.name);return {...x,id:st?.id||0,checked:true};});
  savePendingBulkSelection();renderBulkBuySelect();$("bulkBuyModal").classList.add("show");
}
function closeBulkBuy(){$("bulkBuyModal").classList.remove("show")}
function finishBulkPurchaseFromDashboard(){
  let selected=readPendingBulkSelection();
  if(!selected.length){return appAlert("Belum ada daftar belanja yang sedang diproses. Tekan Belanja terlebih dahulu.","Selesai Belanja")}
  selected=selected.map(x=>({...x,checked:true})).filter(x=>x.name);
  bulkBuySelection=selected;openBulkPurchaseForItems(selected);
}
function renderBulkBuySelect(){const el=$("bulkBuySelectList");if(!el)return;el.innerHTML=bulkBuySelection.map((x,i)=>`<label class="bulkBuyCheck"><input type="checkbox" data-bulk-index="${i}" ${x.checked?"checked":""} onchange="toggleBulkBuy(${i},this.checked)"><span><b>${esc(x.name)}</b><small>${x.buy} pack</small></span></label>`).join("");$("bulkBuySelectCount").textContent=`${bulkBuySelection.filter(x=>x.checked).length} barang dipilih`}
function toggleBulkBuy(i,checked){if(bulkBuySelection[i])bulkBuySelection[i].checked=checked;savePendingBulkSelection();$("bulkBuySelectCount").textContent=`${bulkBuySelection.filter(x=>x.checked).length} barang dipilih`}
function bulkBuySelectAll(v){bulkBuySelection.forEach(x=>x.checked=v);savePendingBulkSelection();renderBulkBuySelect()}
async function printSelectedBulkBuy(){const items=bulkBuySelection.filter(x=>x.checked);if(!items.length)return appAlert("Centang minimal satu barang.","Cetak Daftar Belanja");let text="SEBLAK STORY\nDAFTAR BELANJA\n================================\n";items.forEach((x,i)=>{text+=`${String(i+1).padStart(2," ")}. ${String(x.name||"").slice(0,27)}  ${x.buy} pack\n`});text+="================================\nTotal item: "+items.length+"\n\nTerima kasih\nSeblak Story\n\n\n";try{await sendReceiptTextBLE(text,"Daftar belanja berhasil dicetak")}catch(e){appAlert(e?.message||"Cetak BLE gagal. Hubungkan printer BLE terlebih dahulu.","Cetak gagal")}}
function startBulkPurchase(){const selected=bulkBuySelection.filter(x=>x.checked);if(!selected.length)return appAlert("Centang minimal satu barang yang dibeli.","Selesai Belanja");localStorage.setItem(BULK_PENDING_KEY,JSON.stringify(selected.map(x=>({id:x.id,name:x.name,buy:x.buy}))));openBulkPurchaseForItems(selected)}
function openBulkPurchaseForItems(selected){
  $("bulkBuyModal").classList.remove("show");const list=$("bulkPurchaseList");
  list.innerHTML=selected.map(x=>{const st=stocks.find(s=>s.id===x.id||s.name===x.name);const last=getLastBuyPrice(st);return `<div class="bulkPurchaseRow" data-bulk-id="${x.id||0}" data-bulk-name="${esc(x.name)}"><div class="bulkPurchaseTop"><label><input class="bulkBought" type="checkbox" checked> <b>${esc(x.name)}</b></label><span>Rencana ${x.buy} pack</span></div><div class="bulkPurchaseFields"><label>Jumlah dibeli<input class="bulkPack" type="number" min="0" value="${x.buy}" oninput="updateBulkPurchaseTotal()"></label><label>Harga/pack (Rp)<input class="bulkPrice" type="number" min="0" value="${last||0}" oninput="updateBulkPurchaseTotal()"></label></div><small class="bulkLastPrice">Harga terakhir: ${last?money(last):"Belum ada"}</small></div>`}).join("");
  $("bulkPayment").value="Tunai";$("bulkPurchaseModal").classList.add("show");updateBulkPurchaseTotal();
}
function openManualPurchaseModal(){$("manualPurchaseName").value="";$("manualPurchasePack").value="1";$("manualPurchasePrice").value="";$("manualPurchaseModal").classList.add("show");setTimeout(()=>$("manualPurchaseName")?.focus(),100)}
function closeManualPurchaseModal(){$("manualPurchaseModal").classList.remove("show")}
function addManualPurchaseItem(){
  const name=$("manualPurchaseName").value.trim(),packs=Number($("manualPurchasePack").value)||0,price=Number($("manualPurchasePrice").value)||0;
  if(!name)return appAlert("Nama barang wajib diisi.","Barang baru");if(packs<=0)return appAlert("Jumlah pack harus lebih dari 0.","Barang baru");if(price<=0)return appAlert("Harga per pack wajib diisi.","Barang baru");
  if(stocks.some(x=>String(x.name).trim().toLowerCase()===name.toLowerCase()))return appAlert("Barang dengan nama tersebut sudah ada. Gunakan barang yang sudah terdaftar.","Barang sudah ada");
  const row=document.createElement("div");row.className="bulkPurchaseRow manualPurchaseRow";row.dataset.bulkId="manual-"+Date.now();row.dataset.bulkName=name;row.innerHTML=`<div class="bulkPurchaseTop"><label><input class="bulkBought" type="checkbox" checked> <b>${esc(name)}</b> <em class="newItemBadge">BARU</em></label><button type="button" class="manualRemoveBtn" onclick="this.closest('.bulkPurchaseRow').remove();updateBulkPurchaseTotal()">Hapus</button></div><div class="bulkPurchaseFields"><label>Jumlah dibeli<input class="bulkPack" type="number" min="0" value="${packs}" oninput="updateBulkPurchaseTotal()"></label><label>Harga/pack (Rp)<input class="bulkPrice" type="number" min="0" value="${price}" oninput="updateBulkPurchaseTotal()"></label></div><small class="bulkLastPrice">Barang baru — akan dibuat saat Simpan Semua</small>`;$("bulkPurchaseList").appendChild(row);closeManualPurchaseModal();updateBulkPurchaseTotal();}
function closeBulkPurchase(){$("bulkPurchaseModal").classList.remove("show")}
function updateBulkPurchaseTotal(){let total=0;document.querySelectorAll(".bulkPurchaseRow").forEach(r=>{if(!r.querySelector(".bulkBought")?.checked)return;total+=(Number(r.querySelector(".bulkPack")?.value)||0)*(Number(r.querySelector(".bulkPrice")?.value)||0)});$("bulkPurchaseTotal").textContent=money(total)}
function saveBulkPurchase(){
  const rows=[...document.querySelectorAll(".bulkPurchaseRow")];let saved=0,total=0;const payment=$("bulkPayment").value;
  for(const r of rows){if(!r.querySelector(".bulkBought")?.checked)continue;const rawId=String(r.dataset.bulkId||""),name=String(r.dataset.bulkName||"").trim(),packs=Number(r.querySelector(".bulkPack")?.value)||0,price=Number(r.querySelector(".bulkPrice")?.value)||0;if(packs<=0)return appAlert(`Jumlah beli untuk ${name||"barang"} harus lebih dari 0 atau hilangkan centangnya.`,"Data belum lengkap");if(price<=0)return appAlert(`Harga per pack ${name||"barang"} wajib diisi.`,"Data belum lengkap");let x=rawId.startsWith("manual-")?null:stocks.find(a=>String(a.id)===rawId);if(!x)x=stocks.find(a=>String(a.name).trim().toLowerCase()===name.toLowerCase());if(!x){x={id:Date.now()+saved+Math.floor(Math.random()*1000),name,unit:"pack",stockUnit:"pack",pack:1,min:0,qty:0,initialQty:0,lastSO:0,lastBuyPrice:0};stocks.push(x)}x.qty=(Number(x.qty)||0)+packs;x.lastBuyPrice=price;const amount=packs*price;total+=amount;saved++;store.tx.push({id:Date.now()+saved,type:"out",date:localDT(),name:`Pembelian stok - ${x.name}`,amount,paymentMethod:payment,note:`${packs} pack × ${money(price)} per pack`})}
  if(!saved)return appAlert("Belum ada barang yang dibeli. Centang barang yang benar-benar dibeli atau tambahkan barang baru.","Pembelian");persist();clearPendingBulkSelection();closeBulkPurchase();closeManualPurchaseModal();renderStock();renderDashboard();renderTransactions();renderReport();appAlert(`${saved} barang berhasil diperbarui.\nTotal pembelian: ${money(total)}`,"Pembelian tersimpan")
}

async function printBuyListBLE(){
  const items=getBuyListItems();
  if(!items.length){return appAlert("Tidak ada barang yang perlu dibeli.","Cetak Daftar Belanja");}
  let text="SEBLAK STORY\nDAFTAR BARANG YANG HARUS DIBELI\n================================\n";
  items.forEach((x,i)=>{
    const name=String(x.name||"").slice(0,27);
    text+=`${String(i+1).padStart(2," ")}. ${name}  ${x.buy} pack\n`;
  });
  text+="================================\nTotal item: "+items.length+"\n\nTerima kasih\nSeblak Story\n\n\n";
  try{await sendReceiptTextBLE(text,"Cetak daftar belanja berhasil");}
  catch(e){appAlert(e?.message||"Cetak daftar belanja BLE gagal. Hubungkan printer BLE terlebih dahulu.","Cetak daftar belanja gagal");}
}

async function shareBuyListWhatsApp(){
  const items=getBuyListItems();
  if(!items.length){return appAlert("Tidak ada barang yang perlu dibeli.","Daftar Belanja");}
  const lines=["🛒 DAFTAR BELANJA","SEBLAK STORY","",...items.map((x,i)=>`${i+1}. ${x.name} — ${x.buy} pack`)];
  const text=lines.join("\n");
  try{
    if(navigator.share){
      await navigator.share({title:"Daftar Belanja Seblak Story",text});
      appAlert("Pilih WhatsApp lalu pilih Status Saya untuk membagikan daftar ini ke Status WhatsApp.","Bagikan ke WhatsApp");
      return;
    }
  }catch(e){
    if(e?.name==='AbortError') return;
  }
  const url='https://wa.me/?text='+encodeURIComponent(text);
  window.open(url,'_blank');
}

function saveInlineSO(){
  const inputs=[...document.querySelectorAll('.soInlineInput')];
  if(!inputs.length)return;
  let changed=0;
  for(const input of inputs){
    const id=Number(input.dataset.soId);
    const qty=Number(input.value);
    const x=stocks.find(a=>a.id===id);
    if(!x || !Number.isFinite(qty) || qty<0) continue;
    const condition=soCondition(qty,x.min);
    if(x.qty!==qty || x.lastSO!==qty || x.lastSOCondition!==condition){
      x.qty=qty; x.lastSO=qty; x.lastSOCondition=condition; changed++;
    }
  }
  persist(); renderStock(); renderDashboard();
  appAlert(changed?`${changed} stok berhasil diperbarui.`:'Tidak ada perubahan stok.','Stock Opname');
}

async function printSOList(){
  try{
    await ensureBLEPrinter();
    const rows=[...document.querySelectorAll('.soRow')].map(row=>({
      name:(row.querySelector('.soName b')?.textContent||'').trim(),
      qty:(row.querySelector('.soInlineInput')?.value||'0').trim()
    })).filter(x=>x.name);
    if(!rows.length){appAlert('Tidak ada data SO untuk dicetak.','Cetak SO');return;}

    // Cetak langsung ESC/POS 80mm. Dibuat sama dengan gaya cetak laporan lain:
    // font standar, tidak bold untuk isi, tanpa double-size.
    const enc=new TextEncoder();
    const bytes=[];
    const push=(...a)=>bytes.push(...a);
    const text=t=>push(...enc.encode(t));
    const cmd=(...a)=>push(...a);
    const cleanName=x=>x.replace(/[\r\n\t]+/g,' ').replace(/[^\x20-\x7E]/g,' ').trim();
    const maxName=30, qtyWidth=10;

    cmd(0x1b,0x40);       // initialize
    cmd(0x1b,0x45,0x00);  // bold OFF
    cmd(0x1b,0x21,0x00);  // standard font/style
    cmd(0x1d,0x21,0x00);  // normal character size
    cmd(0x1b,0x61,0x01);  // center
    text('STOK OPNAME\n');
    text('Seblak Story\n');
    cmd(0x1b,0x61,0x00);  // left
    text('------------------------------------------\n');
    text('Nama Barang'.padEnd(maxName)+'Stok'.padStart(qtyWidth)+'\n');
    text('------------------------------------------\n');

    for(const r of rows){
      let name=cleanName(r.name);
      if(name.length>maxName) name=name.slice(0,maxName-1)+' ';
      const qty=cleanName(`${r.qty} pack`);
      text(name.padEnd(maxName)+qty.padStart(qtyWidth)+'\n');
    }
    text('------------------------------------------\n');
    cmd(0x1b,0x61,0x01);
    text(`Total: ${rows.length} item\n`);
    text('Terima Kasih\nSeblak Story\n\n\n');
    cmd(0x1b,0x61,0x00);
    cmd(0x1d,0x56,0x00); // cut if supported

    await bleWrite(new Uint8Array(bytes));
    appAlert(`Cetak SO berhasil dikirim langsung ke printer BLE.\n\n${rows.length} item`,'Cetak berhasil');
  }catch(e){
    appAlert(e?.message||'Cetak SO BLE gagal. Hubungkan printer BLE terlebih dahulu.','Cetak SO gagal');
  }
}
function renderStock(){
  const q=($('stockSearch')?.value||'').toLowerCase();
  const r=stocks.filter(x=>{
    if(!x.name.toLowerCase().includes(q)) return false;
    if(stockStatusFilter==='sedikit' && !(Number(x.qty)>0 && Number(x.qty)<=Number(x.min))) return false;
    if(stockStatusFilter==='kurang' && Number(x.qty)!==0) return false;
    if(stockFilter==='so') return true;
    if(stockFilter==='beli') return x.qty<=x.min && getBuyListItems().some(b=>b.name===x.name);
    return true;
  }).sort((a,b)=>{
    if(stockSort==='stockAsc') return Number(a.qty)-Number(b.qty) || String(a.name).localeCompare(String(b.name),'id');
    if(stockSort==='stockDesc') return Number(b.qty)-Number(a.qty) || String(a.name).localeCompare(String(b.name),'id');
    return String(a.name).localeCompare(String(b.name),'id',{sensitivity:'base'});
  });
  const isBuyTab=stockFilter==='beli';
  const isSOTab=stockFilter==='so';
  $('stockCards').style.display=isBuyTab?'none':'';
  $('buyListPanel').style.display=isBuyTab?'block':'none';
  if(isSOTab){
    $('stockCards').innerHTML=r.map(x=>`<div class="soRow"><div class="soName"><div class="foodIcon">${x.name.toLowerCase().includes('mie')?'🍜':x.name.toLowerCase().includes('telur')?'🥚':x.name.toLowerCase().includes('bakso')?'🟤':x.name.toLowerCase().includes('kerupuk')?'🟠':x.name.toLowerCase().includes('sosis')?'🌭':'📦'}</div><div><b>${esc(x.name)}</b><small>Stok sistem: ${x.qty} pack</small></div></div><div class="soInputWrap"><input class="soInlineInput" type="number" min="0" value="${x.qty}" data-so-id="${x.id}" aria-label="Stok fisik ${esc(x.name)}"><span>pack</span></div></div>`).join('')||'<div class="empty">Belum ada bahan.</div>';
    const oldPrint=document.getElementById('soPrintButton'); if(oldPrint) oldPrint.remove(); $('stockCards').insertAdjacentHTML('beforebegin','<button id="soPrintButton" type="button" class="so-print-btn" onclick="printSOList()">🖨️ Cetak SO 80mm</button>');
    $('stockCards').insertAdjacentHTML('afterend','<button type="button" class="primary big full soSaveBtn" onclick="saveInlineSO()">✓ Simpan SO</button>');
    const old=document.querySelector('.soSaveBtn');
    document.querySelectorAll('.soSaveBtn').forEach((b,i)=>{if(i>0)b.remove()});
    return;
  }
  document.querySelectorAll('.soSaveBtn').forEach(b=>b.remove());
  const oldPrint=document.getElementById('soPrintButton'); if(oldPrint) oldPrint.remove();
  $('stockCards').innerHTML=r.map(x=>{
    const status=stockStatusValue(x)==='kurang'?'Kurang':stockStatusValue(x)==='sedikit'?'Sisa Sedikit':'Aman';
    const cls=status==='Kurang'?'stockBad':status==='Sisa Sedikit'?'stockWarn':'stockGood';
    return `<div class="stockCard"><div class="foodIcon">${x.name.toLowerCase().includes('mie')?'🍜':x.name.toLowerCase().includes('telur')?'🥚':x.name.toLowerCase().includes('bakso')?'🟤':x.name.toLowerCase().includes('kerupuk')?'🟠':x.name.toLowerCase().includes('sosis')?'🌭':'📦'}</div><div class="stockMain"><b>${esc(x.name)}</b><small>Isi ${x.pack} per pack</small><span class="${cls}">Stok: ${x.qty} pack</span><small>Min. ${x.min} pack</small></div><div class="stockActions"><button type="button" onclick="openEditDelete(${x.id})">⋮</button><button type="button" class="buyMini" onclick="openBuy(${x.id})">Beli</button></div></div>`;
  }).join('')||'<div class="empty">Belum ada bahan pada filter ini.</div>';
  const needs=getBuyListItems(); $('buyList').innerHTML=needs.map(x=>`<div class="buyrow"><span><b>${esc(x.name)}</b></span><span class="buyqty">${x.buy} pack</span></div>`).join('')||'<div class="empty">Tidak ada barang yang perlu dibeli.</div>';
}


let reportApplied={period:"month",month:today().slice(0,7),from:"",to:""};
let reportMode="finance";
function ensureReportControls(){
  const p=$("period"),m=$("reportMonth"),f=$("reportFrom"),t=$("reportTo");
  if(!p)return;
  if(!m.value)m.value=today().slice(0,7);
  if(!reportApplied.month)reportApplied.month=m.value||today().slice(0,7);
}
function setReportMode(mode){
  reportMode=mode==='stock'?'stock':'finance';
  $("reportFinanceTab")?.classList.toggle('active',reportMode==='finance');
  $("reportStockTab")?.classList.toggle('active',reportMode==='stock');
  $("reportFinanceView")?.toggleAttribute('hidden',reportMode!=='finance');
  $("reportStockView")?.toggleAttribute('hidden',reportMode!=='stock');
  if(reportMode==='stock')renderStockReport(); else renderReport();
}
function shareReport(){
  const text=reportMode==='stock'?buildStockShareText():`Laporan keuangan Seblak Story\n${$("reportFrom")?.value||'-'} s/d ${$("reportTo")?.value||'-'}\nPemasukan: ${$("reportInTop")?.textContent||'-'}\nPengeluaran: ${$("reportOutTop")?.textContent||'-'}\nSaldo/Laba: ${$("reportNetTop")?.textContent||'-'}`;
  if(navigator.share) navigator.share({title:'Laporan Seblak Story',text}).catch(()=>{}); else appAlert(text,'Share laporan');
}
function applyReportFilter(){
  const fromValue=$("reportFrom").value||"",toValue=$("reportTo").value||"";
  reportApplied={
    period:(fromValue||toValue)?"custom":($("period").value||"month"),
    month:$("reportMonth").value||today().slice(0,7),
    from:fromValue,
    to:toValue
  };
  if(reportMode==='stock')renderStockReport(); else renderReport();
  appAlert("Filter laporan berhasil diterapkan.","Laporan diperbarui");
}
function txDay(x){
  const v=String(x?.date||"");
  return v.length>=10 ? v.slice(0,10) : "";
}
function reportRows(){
  const p=reportApplied.period||"month",d=today();
  const all=Array.isArray(store.tx)?store.tx:[];
  const typeOf=x=>{const t=String(x?.type??x?.jenis??"").trim().toLowerCase();return ["in","pemasukan","income","masuk","credit"].includes(t)?"in":(["out","pengeluaran","expense","keluar","debit"].includes(t)?"out":(String(x?.name||"").toLowerCase().includes("pengeluaran")?"out":"in"));};
  const dayOf=x=>{const raw=String(x?.date??x?.tanggal??x?.createdAt??"");if(/^\d{4}-\d{2}-\d{2}/.test(raw))return raw.slice(0,10);const dt=new Date(raw);return Number.isNaN(dt.getTime())?"":`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;};
  const normalized=all.map(x=>({...x,type:typeOf(x),_day:dayOf(x),amount:Number(x?.amount??x?.jumlah??0)||0})).filter(x=>x._day);
  if(p==="today")return normalized.filter(x=>x._day===d);
  if(p==="week"){const cut=new Date();cut.setHours(0,0,0,0);cut.setDate(cut.getDate()-13);const s=`${cut.getFullYear()}-${String(cut.getMonth()+1).padStart(2,"0")}-${String(cut.getDate()).padStart(2,"0")}`;return normalized.filter(x=>x._day>=s&&x._day<=d);}
  if(p==="month"){const m=reportApplied.month||d.slice(0,7);return normalized.filter(x=>x._day.slice(0,7)===m);}
  const f=reportApplied.from||"",t=reportApplied.to||"";const from=f&&t&&f>t?t:f,to=f&&t&&f>t?f:t;return normalized.filter(x=>(!from||x._day>=from)&&(!to||x._day<=to));
}
function renderReport(){
  ensureReportControls(); let r=reportRows(),i=sum(r,'in'),o=sum(r,'out'); $('reportInTop').textContent=money(i); $('reportOutTop').textContent=money(o); $('reportNetTop').textContent=money(i-o);
  $('reportSummary').innerHTML=`<div class="report"><b>Pemasukan</b><b class="green">${money(i)}</b></div><div class="report"><b>Pengeluaran</b><b class="red">${money(o)}</b></div><div class="report"><b>Bersih</b><b>${money(i-o)}</b></div>`;
  const chart=$('reportChart'); let html=''; const base=new Date(); for(let i=6;i>=0;i--){const x=new Date();x.setDate(base.getDate()-i);const k=`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;const ins=sum(r.filter(t=>txDay(t)===k),'in'),outs=sum(r.filter(t=>txDay(t)===k),'out'),mx=Math.max(ins,outs,1);html+=`<div class="barDay"><div class="bars"><i class="bar inBar" style="height:${Math.max(6,ins/mx*90)}px"></i><i class="bar outBar" style="height:${Math.max(6,outs/mx*90)}px"></i></div><small>${x.getDate()}/${x.getMonth()+1}</small></div>`} chart.innerHTML=html;
  $('reportTable').innerHTML=r.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).map(x=>`<tr><td>${esc(String(x.date||'').replace('T',' '))}</td><td>${x.type==='in'?'<span class="green"><b>Pemasukan</b></span>':'<span class="red"><b>Pengeluaran</b></span>'}</td><td>${esc(x.name)}</td><td>${esc(txPaymentMethod(x))}</td><td>${money(x.amount)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">Tidak ada data pada periode ini.</td></tr>';
}
function reportDateBounds(){
  const d=today(), p=reportApplied.period||'month';
  if(p==='today')return {from:d,to:d};
  if(p==='week'){const x=new Date();x.setHours(0,0,0,0);x.setDate(x.getDate()-13);return {from:x.toISOString().slice(0,10),to:d};}
  if(p==='month'){const m=reportApplied.month||d.slice(0,7);return {from:`${m}-01`,to:`${m}-${new Date(Number(m.slice(0,4)),Number(m.slice(5,7)),0).getDate()}`};}
  let from=reportApplied.from||'',to=reportApplied.to||'';if(from&&to&&from>to)[from,to]=[to,from];return {from,to};
}
function purchaseRowsForReport(){
  const {from,to}=reportDateBounds();
  const all=(store.tx||[]).filter(t=>String(t?.type)==='out'&&/^Pembelian stok - /i.test(String(t?.name||'')));
  return all.map(t=>{
    const day=txDay(t),note=String(t.note||'');
    const packs=Number(note.match(/([\d.,]+)\s*pack/i)?.[1]?.replace(/[^\d]/g,''))||0;
    const price=Number(note.match(/×\s*Rp\s*([\d.,]+)\s*per pack/i)?.[1]?.replace(/[^\d]/g,''))||((packs&&Number(t.amount))?Number(t.amount)/packs:0);
    return {...t,day,packs,price};
  }).filter(t=>(!from||t.day>=from)&&(!to||t.day<=to)&&t.packs>0);
}
function purchaseStatusGroups(rows){
  const map=new Map(stocks.map(x=>[String(x.id),{id:x.id,name:x.name,packs:0}]));
  stocks.forEach(x=>{ if(!map.has(String(x.id)))map.set(String(x.id),{id:x.id,name:x.name,packs:0}); });
  rows.forEach(t=>{const name=String(t.name).replace(/^Pembelian stok - /i,'').trim();const found=stocks.find(x=>x.name===name);const key=found?String(found.id):`name:${name}`;if(!map.has(key))map.set(key,{id:found?.id||0,name,packs:0});map.get(key).packs+=t.packs;});
  const arr=[...map.values()];arr.sort((a,b)=>b.packs-a.packs||a.name.localeCompare(b.name,'id'));
  const n=arr.length, hot=Math.ceil(n/3), standard=Math.ceil(2*n/3);
  return arr.map((x,i)=>({...x,status:n===0?'Kurang Laku':i<hot?'Laku Keras':i<standard?'Standart':'Kurang Laku'}));
}
function purchaseGauge(status,mini=false){
  const cls=status==='Laku Keras'?'fast':status==='Kurang Laku'?'slow':'standard';
  const label=status==='Laku Keras'?'FAST':status==='Kurang Laku'?'SLOW':'STANDART';
  return `<span class="purchaseGauge ${cls}${mini?' mini':''}" title="${status}" aria-label="${status}"><span class="gaugeArc"></span><span class="gaugeNeedle"></span>${mini?'':`<b class="gaugeLabel">${label}</b>`}</span>`;
}
function renderStockReport(){
  ensureReportControls();const rows=purchaseRowsForReport(), groups=purchaseStatusGroups(rows);
  const counts={"Laku Keras":0,"Standart":0,"Kurang Laku":0};groups.forEach(x=>counts[x.status]++);
  $('purchaseGroupSummary').innerHTML=`<div class="groupBox hot">${purchaseGauge('Laku Keras')}<b>${counts['Laku Keras']}</b><span>Laku Keras</span></div><div class="groupBox standard">${purchaseGauge('Standart')}<b>${counts['Standart']}</b><span>Standart</span></div><div class="groupBox slow">${purchaseGauge('Kurang Laku')}<b>${counts['Kurang Laku']}</b><span>Kurang Laku</span></div>`;
  $('stockPurchaseTable').innerHTML=groups.map((x,i)=>{const st=stocks.find(s=>String(s.id)===String(x.id)||s.name===x.name);const opening=Math.max(0,Number(st?.qty||0)-Number(x.packs||0));return `<tr><td>${i+1}</td><td><b>${esc(x.name)}</b></td><td>${opening}</td><td>${x.packs}</td><td>${Number(st?.qty||0)}</td><td><span class="purchaseBadge ${x.status.replace(/\s/g,'').toLowerCase()}" title="${x.status}" aria-label="${x.status}">${purchaseGauge(x.status,true)}</span></td></tr>`}).join('')||'<tr><td colspan="6" class="empty">Belum ada data stok pada periode ini.</td></tr>';
  const priceMap=new Map();
  const {to}=reportDateBounds();
  const allPurchases=(store.tx||[]).filter(t=>String(t?.type)==='out'&&/^Pembelian stok - /i.test(String(t?.name||''))).map(t=>{const packs=Number(String(t.note||'').match(/([\d.,]+)\s*pack/i)?.[1]?.replace(/[^\d]/g,''))||0;const price=Number(String(t.note||'').match(/×\s*Rp\s*([\d.,]+)\s*per pack/i)?.[1]?.replace(/[^\d]/g,''))||((packs&&Number(t.amount))?Number(t.amount)/packs:0);return {...t,day:txDay(t),packs,price,nameClean:String(t.name).replace(/^Pembelian stok - /i,'').trim()};}).filter(t=>t.packs>0&&t.price>0&&(!to||t.day<=to));
  rows.forEach(t=>{const n=String(t.name).replace(/^Pembelian stok - /i,'').trim();if(!priceMap.has(n))priceMap.set(n,[]);});
  for(const t of allPurchases){if(priceMap.has(t.nameClean))priceMap.get(t.nameClean).push(t);}
  const priceRows=[];for(const [name,list] of priceMap){list.sort((a,b)=>String(a.day).localeCompare(String(b.day))||Number(a.id)-Number(b.id));const latest=list[list.length-1],previous=list.length>1?list[list.length-2]:null;if(latest)priceRows.push({name,previous:previous?.price||0,latest:latest.price,diff:previous?latest.price-previous.price:0,status:previous?(latest.price>previous.price?'Naik':latest.price<previous.price?'Turun':'Tetap'):'Baru'});}
  const order={Naik:0,Turun:1,Tetap:2,Baru:3};priceRows.sort((a,b)=>order[a.status]-order[b.status]||(a.status==='Naik'?b.diff-a.diff:a.status==='Turun'?a.diff-b.diff:0)||a.name.localeCompare(b.name,'id'));
  $('stockPriceTable').innerHTML=priceRows.map((x,i)=>{const cls=x.status.toLowerCase();const diff=x.status==='Baru'?'—':(x.diff>0?`+${money(x.diff)}`:x.diff<0?`-${money(Math.abs(x.diff))}`:'Rp 0');return `<tr><td>${i+1}</td><td><b>${esc(x.name)}</b></td><td>${x.previous?money(x.previous):'—'}</td><td>${money(x.latest)}</td><td class="priceDiff ${cls}">${diff}</td><td><span class="priceBadge ${cls}">${x.status==='Naik'?'↑':x.status==='Turun'?'↓':x.status==='Tetap'?'—':'•'} ${x.status}</span></td></tr>`}).join('')||'<tr><td colspan="6" class="empty">Belum ada perubahan harga pada periode ini.</td></tr>';
}
function buildStockShareText(){
  const groups=purchaseStatusGroups(purchaseRowsForReport());const {from,to}=reportDateBounds();const rows=groups.filter(x=>x.packs>0);let s=`📦 LAPORAN STOK\nSEBLAK STORY\n${from||'-'} s/d ${to||'-'}\n\n`;s+=rows.map((x,i)=>`${i+1}. ${x.name} — ${x.packs} pack (${x.status})`).join('\n');return s;
}
function exportStockReport(){
  const rows=purchaseStatusGroups(purchaseRowsForReport()),head=[['No','Nama Bahan','Stok Awal (pack)','Pembelian (pack)','Stok Akhir (pack)','Status Pembelian']];rows.forEach((x,i)=>{const st=stocks.find(s=>String(s.id)===String(x.id)||s.name===x.name);head.push([i+1,x.name,Math.max(0,Number(st?.qty||0)-x.packs),x.packs,Number(st?.qty||0),x.status])});head.push([]);head.push(['No','Nama Bahan','Harga Sebelumnya','Harga Terakhir','Selisih','Status']);const {to}=reportDateBounds();const all=(store.tx||[]).filter(t=>String(t?.type)==='out'&&/^Pembelian stok - /i.test(String(t?.name||''))).map(t=>{const packs=Number(String(t.note||'').match(/([\d.,]+)\s*pack/i)?.[1]?.replace(/[^\d]/g,''))||0;const price=Number(String(t.note||'').match(/×\s*Rp\s*([\d.,]+)\s*per pack/i)?.[1]?.replace(/[^\d]/g,''))||((packs&&Number(t.amount))?Number(t.amount)/packs:0);return {...t,day:txDay(t),packs,price,nameClean:String(t.name).replace(/^Pembelian stok - /i,'').trim()};}).filter(t=>t.packs>0&&t.price>0&&(!to||t.day<=to));const pm={};all.forEach(t=>(pm[t.nameClean]??=[]).push(t));Object.entries(pm).forEach(([name,list],i)=>{list.sort((a,b)=>a.day.localeCompare(b.day)||Number(a.id)-Number(b.id));const l=list.at(-1),p=list.at(-2),d=p?l.price-p.price:0;head.push([i+1,name,p?.price||'',l.price,p?d:'',p?(d>0?'Naik':d<0?'Turun':'Tetap'):'Baru'])});const csv=head.map(a=>a.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download='laporan-stok-seblak-story.csv';a.click();
}


function readTelegramSettings(){
  try{const x=JSON.parse(localStorage.getItem(TELEGRAM_SETTINGS_KEY)||"null");return x&&typeof x==="object"?{token:x.token||"",chatId:x.chatId||"",offset:Number(x.offset||0),lastSync:x.lastSync||"",lastStatus:x.lastStatus||"",pending:x.pending||null}:{token:"",chatId:"",offset:0,lastSync:"",lastStatus:"",pending:null}}
  catch(e){return {token:"",chatId:"",offset:0,lastSync:"",lastStatus:"",pending:null}}
}
function saveTelegramSettingsLocal(x){localStorage.setItem(TELEGRAM_SETTINGS_KEY,JSON.stringify(x))}
function openTelegramDashboard(){
  const modal=$("telegramModal");
  if(!modal)return;
  modal.classList.add("show","telegramDashboardMode");
  const s=readTelegramSettings();
  $("tgStatus").textContent=s.lastStatus||"Tekan Cek Telegram untuk mengambil laporan terbaru.";
  renderTelegramPreview(s.pending);
}

function openTelegramSettings(){
  const s=readTelegramSettings(); $("tgToken").value=s.token; $("tgChatId").value=s.chatId;
  $("tgStatus").textContent=s.lastStatus||(s.lastSync?`Pengecekan terakhir: ${s.lastSync}`:"Belum mengecek Telegram.");
  renderTelegramPreview(s.pending); $("telegramModal").classList.add("show")
}
function closeTelegramSettings(){$("telegramModal").classList.remove("show","telegramDashboardMode")}
function saveTelegramSettings(){
  const old=readTelegramSettings(); const token=$("tgToken").value.trim()||old.token; const chatId=$("tgChatId").value.trim();
  const s={...old,token,chatId}; saveTelegramSettingsLocal(s);
  $("tgStatus").textContent="Pengaturan Telegram tersimpan. Gunakan tombol Cek Telegram untuk melihat data sebelum diterapkan.";
  appAlert("Pengaturan Telegram tersimpan. Tidak ada sinkronisasi otomatis.","Input Telegram");
}
function telegramApiUrl(token,method){return `https://api.telegram.org/bot${encodeURIComponent(token)}/${method}`}
async function telegramApi(token,method,body){
  const res=await fetch(telegramApiUrl(token,method),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body||{}),cache:"no-store"});
  let data; try{data=await res.json()}catch(e){throw new Error("Telegram tidak mengembalikan JSON. Periksa koneksi atau izin jaringan browser.")}
  if(!res.ok||!data.ok)throw new Error(data?.description||`Telegram API gagal (${res.status})`); return data.result;
}
function telegramMessageText(m){return m?.text||m?.caption||m?.message?.text||m?.message?.caption||m?.channel_post?.text||m?.channel_post?.caption||""}
function telegramMessageInfo(m){
  const x=m?.message||m?.channel_post||m; return {id:x?.message_id||m?.update_id||null,chatId:x?.chat?.id??null,text:telegramMessageText(m)}
}
function parseTelegramShift(text){
  if(!text||!/LAPORAN\s+SHIFT/i.test(text))return null;
  const val=(re)=>{const m=text.match(re);return m?m[1].trim():null};
  const date=val(/Tanggal\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i); const shift=val(/Shift\s*:\s*([^\r\n]+)/i);
  const cashier=val(/Kasir\s*:\s*([^\r\n]+)/i); const time=val(/Waktu\s*:\s*(\d{1,2}[:.]\d{2})/i);
  // Ambil angka uang hanya dari bagian nominal sebelum keterangan dalam kurung.
  // Contoh: "Nontunai: Rp 119.000 (5 transaksi)" harus menjadi 119000, bukan 1190005.
  const num=v=>{
    if(v==null)return 0;
    const m=String(v).match(/(?:Rp\s*)?([0-9][0-9.]*)/i);
    return m?Number(m[1].replace(/\./g,""))||0:0;
  };
  const transactions=0; const sales=num(val(/Penjualan\s*:\s*([^\r\n]+)/i));
  const cash=num(val(/Cash\s*:\s*([^\r\n]+)/i));
  // Hanya baca nominal Nontunai. Angka jumlah transaksi dalam kurung diabaikan.
  const nonCashMatch=text.match(/Nontunai\s*:\s*Rp\s*([0-9][0-9.]*)/i);
  const nonCash=nonCashMatch?Number(nonCashMatch[1].replace(/\./g,""))||0:0;
  const expense=num(val(/Pengeluaran\s*:\s*([^\r\n]+)/i)); const balance=num(val(/Saldo\s*:\s*([^\r\n]+)/i));
  if(!date||!shift||(!cash&&!nonCash&&!sales))return null;
  const [d,mo,y]=date.split('/'); return {day:`${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`,date,time:time?.replace('.',':')||"00:00",shift,cashier,transactions,sales,cash,nonCash,expense,balance};
}
function telegramSourceId(p){return `TG-SHIFT-${p.shift}-${p.day}`}
function applyTelegramShift(p,sourceMessageId){
  const sid=telegramSourceId(p), stamp=`${p.day}T${p.time||"00:00"}`; const rows=[];
  if(p.cash>0)rows.push({type:"in",name:"Tunai",amount:p.cash,paymentMethod:"Tunai",note:`Telegram • Shift ${p.shift}${p.cashier?` • Kasir ${p.cashier}`:""}`,sourceId:`${sid}-CASH`,cash:p.cash,nonCash:0});
  if(p.nonCash>0)rows.push({type:"in",name:"Non Tunai",amount:p.nonCash,paymentMethod:"Non Tunai",note:`Telegram • Shift ${p.shift}${p.cashier?` • Kasir ${p.cashier}`:""}`,sourceId:`${sid}-NONCASH`,cash:0,nonCash:p.nonCash});
  if(p.expense>0)rows.push({type:"out",name:`Pengeluaran Shift ${p.shift}`,amount:p.expense,note:`Telegram • Shift ${p.shift}${p.cashier?` • Kasir ${p.cashier}`:""}`,sourceId:`${sid}-EXP`,cash:0,nonCash:0,paymentMethod:"Tunai"});
  let created=0,updated=0;
  for(const r of rows){const existing=store.tx.find(x=>x.sourceId===r.sourceId);const rec={id:existing?.id||r.sourceId,source:"TELEGRAM_SHIFT",sourceId:r.sourceId,type:r.type,date:stamp,name:r.name,amount:r.amount,paymentMethod:r.paymentMethod||txPaymentMethod(r),note:r.note,cash:r.cash,nonCash:r.nonCash,telegramMessageId:sourceMessageId||null,shiftId:p.shift}; if(existing)Object.assign(existing,rec),updated++;else store.tx.push(rec),created++}
  return {created,updated};
}
function renderTelegramPreview(pending){
  const box=$("tgPreview"); if(!box)return;
  if(!pending||!Array.isArray(pending.items)||!pending.items.length){box.innerHTML='<div class="empty">Belum ada data Telegram yang menunggu diterapkan.</div>'; if($("tgApplyBtn"))$("tgApplyBtn").disabled=true; return;}
  const rows=pending.items.map((x,i)=>`<div class="tgPreviewRow"><div><b>${esc(x.parsed.shift)}</b> • ${esc(x.parsed.date)}${x.parsed.cashier?` • ${esc(x.parsed.cashier)}`:""}</div><div class="tgAmounts"><span>Tunai ${money(x.parsed.cash)}</span><span>Non Tunai ${money(x.parsed.nonCash)}</span>${x.parsed.expense?`<span>Pengeluaran ${money(x.parsed.expense)}</span>`:""}</div></div>`).join('');
  box.innerHTML=`<div class="tgPreviewHead"><b>${pending.items.length} laporan siap diperiksa</b><span>Belum masuk Buku Kas</span></div>${rows}`;
  if($("tgApplyBtn"))$("tgApplyBtn").disabled=false;
}
async function checkTelegramNow(showMessage=true){
  if(telegramBusy)return; telegramBusy=true;
  try{
    const tg=readTelegramSettings(); if(!tg.token)throw new Error("Token Telegram Bot belum diisi.");
    await telegramApi(tg.token,"deleteWebhook",{drop_pending_updates:false});
    const updates=await telegramApi(tg.token,"getUpdates",{offset:(tg.offset||0),timeout:0,allowed_updates:["message","edited_message","channel_post"]});
    const items=[]; let ignored=0,maxOffset=tg.offset||0;
    const seen=new Set();
    const pendingKeys=new Set();
    for(const u of updates){
      maxOffset=Math.max(maxOffset,(u.update_id||0)+1);
      const info=telegramMessageInfo(u);
      if(tg.chatId&&String(info.chatId)!==String(tg.chatId))continue;
      const parsed=parseTelegramShift(info.text);
      if(!parsed){ignored++;continue}
      const key=telegramSourceId(parsed);
      if(seen.has(key)||pendingKeys.has(key))continue;
      // Laporan yang sudah pernah diterapkan hanya ditampilkan lagi bila nominalnya
      // berbeda, sehingga kesalahan pembacaan lama dapat diperbaiki dengan Terapkan.
      const rows=(store.tx||[]).filter(x=>x.source==='TELEGRAM_SHIFT' && x.shiftId===parsed.shift && String(x.date||'').slice(0,10)===parsed.day);
      const existingCash=rows.find(x=>x.sourceId===`${key}-CASH`);
      const existingNon=rows.find(x=>x.sourceId===`${key}-NONCASH`);
      const existingExp=rows.find(x=>x.sourceId===`${key}-EXP`);
      const mismatch=Number(existingCash?.amount||0)!==parsed.cash || Number(existingNon?.amount||0)!==parsed.nonCash || Number(existingExp?.amount||0)!==parsed.expense;
      if(rows.length && !mismatch)continue;
      seen.add(key);pendingKeys.add(key);items.push({updateId:u.update_id,sourceMessageId:info.id,parsed});
    }
    const pending={items,maxOffset,ignored,checkedAt:new Date().toLocaleString("id-ID")};
    saveTelegramSettingsLocal({...tg,pending,lastSync:pending.checkedAt,lastStatus:`${items.length} laporan siap diperiksa • ${ignored} diabaikan`});
    renderTelegramPreview(pending); $("tgStatus").textContent=`${items.length} laporan siap diperiksa • belum diterapkan`;
    if(showMessage)appAlert(`Pengecekan Telegram selesai.\n\nLaporan siap diperiksa: ${items.length}\nDiabaikan: ${ignored}\n\nData belum masuk Buku Kas. Tekan Terapkan ke Pembukuan jika sudah sesuai.`,"Cek Telegram");
  }catch(e){const tg=readTelegramSettings();const msg=e?.message||"Cek Telegram gagal.";saveTelegramSettingsLocal({...tg,lastStatus:"Gagal: "+msg});if($("tgStatus"))$("tgStatus").textContent="Gagal: "+msg;if(showMessage)appAlert(msg,"Cek Telegram gagal");}
  finally{telegramBusy=false}
}
async function updateTelegramNow(){ return checkTelegramNow(true); } async function applyTelegramPending(){
  const tg=readTelegramSettings(), pending=tg.pending; if(!pending||!pending.items?.length){appAlert("Belum ada data Telegram yang siap diterapkan.","Telegram");return;}
  if(telegramBusy)return; telegramBusy=true;
  try{
    let created=0,updated=0; for(const x of pending.items){const r=applyTelegramShift(x.parsed,x.sourceMessageId);created+=r.created;updated+=r.updated;}
    const now=new Date().toLocaleString("id-ID"); saveTelegramSettingsLocal({...tg,offset:pending.maxOffset,pending:null,lastSync:now,lastStatus:`Diterapkan: ${pending.items.length} laporan • ${created} transaksi baru • ${updated} diperbarui`});
    persist(); refresh(); renderTelegramPreview(null); $("tgStatus").textContent=`Diterapkan: ${pending.items.length} laporan • ${now}`;
    appAlert(`Data Telegram berhasil diterapkan.\n\nLaporan: ${pending.items.length}\nTransaksi baru: ${created}\nDiperbarui: ${updated}`,"Telegram");
  }catch(e){appAlert(e?.message||"Gagal menerapkan data Telegram.","Telegram");}
  finally{telegramBusy=false}
}
function scheduleTelegramSync(){return;}

function printReport(){
  const job=reportMode==='stock'?printStockReportBLE:printReportBLE;
  job().catch(e=>appAlert(e?.message||"Cetak BLE gagal. Hubungkan printer BLE terlebih dahulu.","Cetak gagal"));
}

function readPrinterSettings(){
  try{const x=JSON.parse(localStorage.getItem(PRINTER_SETTINGS_KEY)||"null");return x&&typeof x==="object"?{name:x.name||"",deviceId:x.deviceId||"",paper:x.paper||"80",auto:!!x.auto}: {name:"",deviceId:"",paper:"80",auto:false};}
  catch(e){return {name:"",deviceId:"",paper:"80",auto:false}}
}
function savePrinterSettingsLocal(x){localStorage.setItem(PRINTER_SETTINGS_KEY,JSON.stringify(x))}
function openPrinterSettings(){
  const s=readPrinterSettings();
  $("printerName").value=s.name||"Belum dipilih"; $("printerPaper").value=s.paper||"80"; $("printerAuto").checked=!!s.auto;
  $("printerStatus").textContent=s.name?`Tersimpan: ${s.name}`:"Printer belum terhubung.";
  $("printerModal").classList.add("show");
}
function closePrinterSettings(){$("printerModal").classList.remove("show")}
function savePrinterSettings(){
  const old=readPrinterSettings(), s={...old,name:$("printerName").value==="Belum dipilih"?old.name:$("printerName").value,deviceId:old.deviceId,paper:$("printerPaper").value,auto:$("printerAuto").checked};
  savePrinterSettingsLocal(s); $("printerStatus").textContent=s.name?`Pengaturan tersimpan: ${s.name}`:"Pengaturan printer tersimpan."; appAlert("Pengaturan printer tersimpan. Printer akan dipakai untuk cetak langsung jika terhubung dan opsi tersebut aktif.","Printer");
}
const BLE_UUIDS={services:["0000ffe0-0000-1000-8000-00805f9b34fb","000018f0-0000-1000-8000-00805f9b34fb","0000ae30-0000-1000-8000-00805f9b34fb","0000ff00-0000-1000-8000-00805f9b34fb"],chars:["0000ffe1-0000-1000-8000-00805f9b34fb","00002af1-0000-1000-8000-00805f9b34fb","0000ae01-0000-1000-8000-00805f9b34fb","0000ff02-0000-1000-8000-00805f9b34fb"]};
async function findWritableCharacteristic(server){
  if(!server || typeof server.getPrimaryServices!=="function") throw new Error("Koneksi BLE tidak menyediakan GATT Service.");
  const services=await server.getPrimaryServices();
  for(const service of services){
    const chars=await service.getCharacteristics();
    const writable=chars.find(c=>c.properties.write||c.properties.writeWithoutResponse);
    if(writable)return writable;
  }
  throw new Error("Karakteristik printer yang bisa ditulis tidak ditemukan.");
}
async function connectBLEPrinter(){
  if(!navigator.bluetooth){appAlert("Browser ini tidak mendukung Bluetooth BLE Web Bluetooth. Gunakan Chrome/Edge Android versi terbaru melalui HTTPS.","Bluetooth BLE tidak tersedia");return}
  try{
    const device=await navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:BLE_UUIDS.services});
    if(!device.gatt)throw new Error("Printer tidak menyediakan koneksi GATT BLE.");
    device.addEventListener("gattserverdisconnected",()=>{blePrinterCharacteristic=null;const el=$("printerStatus");if(el)el.textContent="Printer terputus.";});
    const server=await device.gatt.connect();
    blePrinterCharacteristic=await findWritableCharacteristic(server); blePrinterDevice=device;
    const old=readPrinterSettings(); savePrinterSettingsLocal({...old,name:device.name||"Printer BLE",deviceId:device.id||"",paper:$("printerPaper").value||old.paper});
    $("printerName").value=device.name||"Printer BLE"; $("printerStatus").textContent=`Terhubung: ${device.name||"Printer BLE"}`;
    appAlert(`Printer berhasil terhubung.\n\n${device.name||"Printer BLE"}\nSiap untuk test printer.`,"Printer terhubung");
  }catch(e){appAlert(e?.message||"Gagal menghubungkan printer BLE.","Koneksi printer gagal")}
}
async function getSavedBLEPrinter(){
  const s=readPrinterSettings();
  if(!s.name || !navigator.bluetooth?.getDevices) return null;
  const devices=await navigator.bluetooth.getDevices();
  // Prefer the saved device id, but also fall back to the saved name. Some
  // Android/Chrome versions can expose a different transient id after reload.
  const d=devices.find(x=>s.deviceId && x.id===s.deviceId) ||
          devices.find(x=>s.name && x.name===s.name);
  if(!d)return null;
  if(!d.gatt)throw new Error("Printer BLE tidak menyediakan GATT.");
  d.addEventListener?.("gattserverdisconnected",()=>{
    blePrinterCharacteristic=null;
    if(blePrinterDevice===d) blePrinterDevice=null;
    const el=$("printerStatus");
    if(el)el.textContent="Printer tersimpan, tetapi sedang terputus.";
  });
  const server=d.gatt.connected?d.gatt:await d.gatt.connect();
  blePrinterDevice=d;
  blePrinterCharacteristic=await findWritableCharacteristic(server);
  return d;
}
async function reconnectSavedBLEPrinter(silent=true){
  try{
    const d=await getSavedBLEPrinter();
    if(d){
      const el=$("printerStatus");
      if(el)el.textContent=`Terhubung: ${d.name||"Printer BLE"}`;
      const input=$("printerName");
      if(input)input.value=d.name||"Printer BLE";
      return d;
    }
  }catch(e){
    const el=$("printerStatus");
    if(el)el.textContent="Printer tersimpan, belum tersambung.";
    if(!silent) throw e;
  }
  return null;
}
async function ensureBLEPrinter(){
  if(blePrinterCharacteristic&&blePrinterDevice?.gatt?.connected)return blePrinterDevice;
  const saved=await reconnectSavedBLEPrinter(false); if(saved)return saved;
  throw new Error("Printer BLE belum terhubung. Pilih Printer BLE terlebih dahulu.");
}
function escBytes(){return new Uint8Array([...arguments])}
async function bleWrite(data){
  const c=blePrinterCharacteristic; if(!c)throw new Error("Printer BLE belum siap.");
  const max=180; for(let i=0;i<data.length;i+=max){const chunk=data.slice(i,i+max); if(c.properties.writeWithoutResponse&&c.writeValueWithoutResponse)await c.writeValueWithoutResponse(chunk); else await c.writeValue(chunk); await new Promise(r=>setTimeout(r,15));}
}
function receiptText(){
  const d=new Date();
  const balance=store.tx.reduce((a,x)=>a+(x.type==="in"?(Number(x.amount)||0):-(Number(x.amount)||0)),0);
  return ["SEBLAK STORY PEMBUKUAN","==============================",`Tanggal: ${d.toLocaleString("id-ID")}`,"",`Saldo Kas: ${printerMoney(balance)}`,"","Terima kasih","","",""].join("\n");
}
async function testBLEPrinter(){
  try{await ensureBLEPrinter(); const bytes=new TextEncoder().encode(sanitizePrinterText(receiptText())); await bleWrite(new Uint8Array([0x1b,0x40])); await bleWrite(bytes); await bleWrite(new Uint8Array([0x1d,0x56,0x00])); appAlert("Test print berhasil dikirim ke printer BLE.","Test Printer");}
  catch(e){appAlert(e?.message||"Test printer gagal.","Test Printer gagal")}
}
async function disconnectBLEPrinter(){try{if(blePrinterDevice?.gatt?.connected)blePrinterDevice.gatt.disconnect();}catch(e){} blePrinterCharacteristic=null; blePrinterDevice=null; const el=$("printerStatus");if(el)el.textContent="Printer terputus.";}
async function sendReceiptTextBLE(text,title="Cetak berhasil"){
  await ensureBLEPrinter();
  const encoder=new TextEncoder();
  await bleWrite(new Uint8Array([0x1b,0x40]));
  await bleWrite(encoder.encode(sanitizePrinterText(text)));
  await bleWrite(new Uint8Array([0x1d,0x56,0x00]));
  appAlert("Data berhasil dikirim langsung ke printer BLE.",title);
}
async function printReportBLE(){
  const from=$("reportFrom")?.value||"", to=$("reportTo")?.value||"";
  const ins=store.tx.filter(x=>x.type==="in"&&(!from||x.date.slice(0,10)>=from)&&(!to||x.date.slice(0,10)<=to));
  const outs=store.tx.filter(x=>x.type==="out"&&(!from||x.date.slice(0,10)>=from)&&(!to||x.date.slice(0,10)<=to));
  const ti=ins.reduce((a,x)=>a+(Number(x.amount)||0),0), toT=outs.reduce((a,x)=>a+(Number(x.amount)||0),0);
  let text="SEBLAK STORY PEMBUKUAN\n==============================\nLAPORAN KEUANGAN\n"+(from||"-")+" s/d "+(to||"-")+"\n\nTotal Pemasukan: "+printerMoney(ti)+"\nTotal Pengeluaran: "+printerMoney(toT)+"\nSaldo / Laba: "+printerMoney(ti-toT)+"\n\nTRANSAKSI\n";
  for(const x of [...ins,...outs].sort((a,b)=>String(b.date).localeCompare(String(a.date)))) text+=`${String(x.date||'').replace("T"," ")} ${x.type==="in"?"+":"-"} ${x.name}\n${printerMoney(x.amount)}\n`;
  text+="\nTerima kasih\nSeblak Story\n\n\n";
  await sendReceiptTextBLE(text,"Cetak laporan berhasil");
}
async function printStockReportBLE(){
  const groups=purchaseStatusGroups(purchaseRowsForReport()).filter(x=>Number(x.packs)>0);
  const {from,to}=reportDateBounds();
  let text="SEBLAK STORY PEMBUKUAN\n==============================\nLAPORAN STOK\n"+(from||"-")+" s/d "+(to||"-")+"\n\n";
  text+="Nama Barang                 Beli\n";
  text+="------------------------------\n";
  for(const x of groups) text+=`${String(x.name).slice(0,25).padEnd(25,' ')} ${String(x.packs).padStart(4,' ')} pack\n`;
  text+="\nTotal item: "+groups.length+"\n\nTerima kasih\nSeblak Story\n\n\n";
  await sendReceiptTextBLE(text,"Cetak laporan stok berhasil");
}

function exportCSV(){let r=reportRows(),rows=[["Tanggal","Jenis","Nama","Metode","Jumlah","Keterangan"],...r.map(x=>[x.date,x.type==="in"?"Pemasukan":"Pengeluaran",x.name,txPaymentMethod(x),x.amount,x.note||""])];let csv=rows.map(a=>a.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");let a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));a.download="laporan-pembukuan-seblak-story.csv";a.click()}



let selectedTxId=null;
function toggleTxActions(btn,id){
  const wrap=btn?.closest?.('.txWrap');
  if(!wrap)return;
  const menu=wrap.querySelector('.inlineTxActions');
  document.querySelectorAll('#txCards .inlineTxActions').forEach(m=>{if(m!==menu)m.hidden=true;});
  if(menu) menu.hidden = !menu.hidden;
  selectedTxId=String(id);
}
function editTxFromInline(id){
  const x=store.tx.find(a=>String(a.id)===String(id));
  if(!x)return appAlert('Transaksi tidak ditemukan.','Edit Transaksi');
  openTx(id);
}
function deleteTxFromInline(id){
  const x=store.tx.find(a=>String(a.id)===String(id));
  if(!x)return appAlert('Transaksi tidak ditemukan.','Hapus Transaksi');
  removeTx(id);
}
function openTxActions(id){
  const btn=document.querySelector(`.txActionBtn[data-tx-id="${CSS.escape(String(id))}"]`);
  if(btn)toggleTxActions(btn,id);
}
function closeTxActions(){document.querySelectorAll('#txCards .inlineTxActions').forEach(m=>m.hidden=true);selectedTxId=null;}
function editSelectedTx(){if(selectedTxId!==null)editTxFromInline(selectedTxId);}
function deleteSelectedTx(){if(selectedTxId!==null)deleteTxFromInline(selectedTxId);}

// Delegated touch/click handling: works reliably on mobile PWA and for every rendered transaction.
(function initTransactionActions(){
  const root=$('txCards');
  if(!root || root.dataset.actionsReady==='1') return;
  root.dataset.actionsReady='1';
  root.addEventListener('click',e=>{
    const action=e.target.closest('.txActionBtn,.txEditBtn,.txDeleteBtn');
    if(!action || !root.contains(action)) return;
    e.preventDefault();
    e.stopPropagation();
    const id=action.dataset.txId;
    if(action.classList.contains('txActionBtn')) toggleTxActions(action,id);
    else if(action.classList.contains('txEditBtn')) editTxFromInline(id);
    else if(action.classList.contains('txDeleteBtn')) deleteTxFromInline(id);
  });
})();

async function backup(){
  try{
    if(!(await ensureBackupEncryption()))return;
    const payload=await encryptedBackupObject();
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`SeblakStory-Backup-Encrypted-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    appAlert("Backup terenkripsi berhasil dibuat. Semua data dan pengaturan lokal ikut disimpan, termasuk token dalam bentuk terenkripsi.","Backup berhasil");
  }catch(err){appAlert(err.message||"Backup gagal.","Backup gagal")}
}
function restore(e){
  const file=e.target.files?.[0];if(!file)return;
  const reader=new FileReader();reader.onload=async()=>{try{
    const root=JSON.parse(reader.result);let payload;
    if(root?.format==="SSB-ENC-1"){
      const pass=prompt("Masukkan password backup untuk memulihkan data:");if(!pass)throw new Error("Restore dibatalkan.");
      payload=await decryptBackupObject(root,pass);
    }else throw new Error("Backup lama tidak terenkripsi. Untuk keamanan, gunakan backup terenkripsi v3.3.42.");
    if(!payload?.data||typeof payload.data!=="object")throw new Error("Isi backup tidak valid.");
    Object.keys(payload.data).forEach(k=>localStorage.setItem(k,payload.data[k]));
    store=JSON.parse(localStorage.getItem(KEY)||'{"tx":[]}');
    stocks=JSON.parse(localStorage.getItem(STOCK_KEY)||"[]");if(!Array.isArray(stocks))stocks=[];
    migrateStockToPack();normalizeTxData();persist();refresh();appAlert("Semua data dan pengaturan berhasil dipulihkan, termasuk konfigurasi token yang tersimpan terenkripsi di backup.","Restore berhasil");
  }catch(err){appAlert(err.message||"File backup tidak valid.","Restore gagal")}finally{e.target.value=""}};reader.readAsText(file);
}

function clearAll(){appConfirm("Hapus semua transaksi dan stok dari perangkat? Data yang sudah dihapus tidak dapat dikembalikan tanpa backup.","Hapus Semua Data").then(ok=>{if(!ok)return;store={tx:[]};stocks=[];persist();refresh();appAlert("Semua data telah dihapus.","Data dihapus")})}
function renderInfo(){const el=$("dataInfo");if(el)el.innerHTML=`<div class="report"><span>Transaksi</span><b>${store.tx.length}</b></div><div class="report"><span>Stok bahan</span><b>${stocks.length}</b></div><div class="report"><span>Versi</span><b>${APP_VERSION}</b></div>`}

const POS_SYNC_KEY="seblak_story_pos_sync_v3";

// Migrasi otomatis dari V3.2.2: rekap POS gabungan dipecah menjadi Tunai dan Non Tunai.
function migrateLegacyPOSDaily(){
  const rows=store.tx.filter(x=>x.source==="POS_DAILY" && /^POS-DAY-\d{4}-\d{2}-\d{2}$/.test(String(x.sourceId||"")));
  if(!rows.length)return false;
  let changed=false;
  rows.forEach(old=>{
    const day=String(old.sourceId).replace("POS-DAY-","");
    const label=dayLabel(day);
    const cash=Number(old.cash||0);
    const nonCash=Number(old.nonCash||0);
    if(cash>0){
      const key=`POS-DAY-${day}-CASH`;
      const rec={id:key,source:"POS_DAILY",sourceId:key,type:"in",date:`${day}T12:00`,name:`Pemasukan POS (Tunai)`,amount:cash,note:`Tunai • Rekap POS ${label}`,cash,nonCash:0};
      const existing=store.tx.find(x=>x.sourceId===key);
      if(existing)Object.assign(existing,rec); else store.tx.push(rec);
    }
    if(nonCash>0){
      const key=`POS-DAY-${day}-NONCASH`;
      const rec={id:key,source:"POS_DAILY",sourceId:key,type:"in",date:`${day}T12:00`,name:`Pemasukan POS (Non Tunai)`,amount:nonCash,note:`Non Tunai • Rekap POS ${label}`,cash:0,nonCash};
      const existing=store.tx.find(x=>x.sourceId===key);
      if(existing)Object.assign(existing,rec); else store.tx.push(rec);
    }
    const idx=store.tx.indexOf(old);
    if(idx>=0)store.tx.splice(idx,1);
    changed=true;
  });
  if(changed)persist();
  return changed;
}

migrateLegacyPOSDaily();

function readSyncHistory(){
  try{const x=JSON.parse(localStorage.getItem(POS_SYNC_KEY)||"[]");return Array.isArray(x)?x:[]}
  catch(e){return[]}
}
function saveSyncHistory(h){localStorage.setItem(POS_SYNC_KEY,JSON.stringify(h))}
function renderSyncHistory(){
  const el=$("syncHistory"); if(!el)return;
  const h=readSyncHistory();
  el.innerHTML=h.length?h.slice().reverse().slice(0,1).map(x=>`
    <div class="buyrow">
      <span><b>${esc(x.file||"Backup POS")}</b><div class="buyinfo">${esc(x.date||"")}</div></span>
      <span>💵 Tunai Rp ${Math.round(x.cash||0).toLocaleString("id-ID")}<br>💳 Non Tunai Rp ${Math.round(x.nonCash||0).toLocaleString("id-ID")}<br>💰 Total Rp ${Math.round((x.cash||0)+(x.nonCash||0)).toLocaleString("id-ID")}</span>
    </div>`).join(""):'<div class="empty">Belum ada riwayat.</div>';
}
function posBackupPayload(root){
  if(!root || root.app!=="Seblak Story POS" || !root.data) throw new Error("File bukan Backup JSON Seblak Story POS.");
  const decode=(key)=>{
    const v=root.data[key];
    if(v==null)return [];
    if(Array.isArray(v))return v;
    if(typeof v==="string"){try{const x=JSON.parse(v);return Array.isArray(x)?x:[]}catch(e){throw new Error("Data "+key+" pada backup POS tidak valid.")}}
    return [];
  };
  return {
    transactions:decode("ss_tx"),
    expenses:decode("expenses"),
    shifts:decode("SS_POS_SHIFT_HISTORY_V313"),
    exportedAt:root.exportedAt||null,
    appVersion:root.appVersion||null
  };
}
function posDateObj(x){
  const v=x?.createdAt||x?.date||x?.tanggal||x?.time;
  const d=new Date(v);
  return Number.isNaN(d.getTime())?null:d;
}
function posMethod(x){
  return String(x?.method||x?.paymentMethod||"").trim().toLowerCase();
}
function isCashMethod(m){
  return ["cash","tunai","cash/tunai"].includes(m);
}
function isNonCashMethod(m){
  return !!m && !isCashMethod(m);
}
function shiftClosedForDate(d, shifts){
  // A transaction is eligible only when it falls inside a closed shift.
  // If shift timestamps are unavailable, do not assume it is closed.
  if(!Array.isArray(shifts)||!shifts.length)return false;
  const t=d.getTime();
  return shifts.some(s=>{
    const open=new Date(s?.openedAt);
    const close=new Date(s?.closedAt);
    return !Number.isNaN(open.getTime()) && !Number.isNaN(close.getTime()) &&
           close.getTime()>open.getTime() && t>=open.getTime() && t<=close.getTime();
  });
}
function dayKey(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function dayLabel(key){
  const [y,m,d]=key.split("-").map(Number);
  return new Date(y,m-1,d).toLocaleDateString("id-ID",{day:"2-digit",month:"2-digit",year:"numeric"});
}
function importPOSBackup(e){
  const file=e.target.files?.[0]; if(!file)return;
  const status=$("syncStatus");
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const p=posBackupPayload(JSON.parse(reader.result));
      const byDay={};
      let eligible=0, ignored=0;

      // Pemasukan: hanya transaksi yang berada di dalam shift yang sudah ditutup.
      (p.transactions||[]).forEach(x=>{
        const d=posDateObj(x);
        const amount=Number(x?.total??x?.amount??x?.nominal??0)||0;
        if(!d||amount<=0){ignored++;return}
        if(!shiftClosedForDate(d,p.shifts)){ignored++;return}
        const k=dayKey(d);
        if(!byDay[k])byDay[k]={cash:0,nonCash:0};
        const method=posMethod(x);
        if(isCashMethod(method))byDay[k].cash+=amount;
        else if(isNonCashMethod(method))byDay[k].nonCash+=amount;
        else {ignored++;return}
        eligible++;
      });

      // Simpan rekap pemasukan harian terpisah: Tunai dan Non Tunai.
      const existing = store.tx.filter(x=>x.source==="POS_DAILY");
      const existingById = new Map(existing.map(x=>[String(x.sourceId),x]));
      let created=0, updated=0, expenseCreated=0, expenseUpdated=0;

      Object.entries(byDay).forEach(([day,v])=>{
        const dayName=dayLabel(day);
        const rows=[
          {key:`POS-DAY-${day}-CASH`, label:"Tunai", amount:v.cash, note:`Tunai • Rekap POS ${dayName}`},
          {key:`POS-DAY-${day}-NONCASH`, label:"Non Tunai", amount:v.nonCash, note:`Non Tunai • Rekap POS ${dayName}`}
        ];
        rows.forEach(r=>{
          if(r.amount<=0)return;
          const record={
            id:existingById.get(r.key)?.id || r.key,
            source:"POS_DAILY",
            sourceId:r.key,
            type:"in",
            date:`${day}T12:00`,
            name:`Pemasukan POS (${r.label})`,
            amount:r.amount,
            note:r.note,
            cash:r.label==="Tunai"?r.amount:0,
            nonCash:r.label==="Non Tunai"?r.amount:0
          };
          if(existingById.has(r.key)){Object.assign(existingById.get(r.key),record);updated++}
          else{store.tx.push(record);created++}
        });
        const legacy=existingById.get(`POS-DAY-${day}`);
        if(legacy){const idx=store.tx.indexOf(legacy);if(idx>=0)store.tx.splice(idx,1)}
      });

      // Pengeluaran POS: simpan satu per satu agar nama/keterangan dan nominal tidak hilang.
      // Hanya pengeluaran dari shift yang sudah ditutup yang diambil, sama prinsipnya
      // dengan pemasukan. sourceId menggunakan ID pengeluaran POS agar sinkron ulang
      // tidak membuat transaksi pengeluaran ganda.
      const expenses=Array.isArray(p.expenses)?p.expenses:[];
      const existingExpenses=new Map(
        store.tx.filter(x=>x.source==="POS_EXPENSE").map(x=>[String(x.sourceId),x])
      );
      expenses.forEach(x=>{
        const d=posDateObj(x);
        const amount=Number(x?.amount??x?.total??x?.nominal??0)||0;
        if(!d||amount<=0){ignored++;return}
        let closed=false;
        if(x?.shiftId && Array.isArray(p.shifts)){
          const sh=p.shifts.find(s=>String(s?.id)===String(x.shiftId));
          closed=!!sh && !!sh.closedAt;
        }
        if(!closed) closed=shiftClosedForDate(d,p.shifts);
        if(!closed){ignored++;return}
        const sourceId=String(x.id||`EXP-${d.getTime()}-${amount}-${String(x.note||"")}`);
        const record={
          id:existingExpenses.get(sourceId)?.id || `POS-EXP-${sourceId}`,
          source:"POS_EXPENSE",
          sourceId,
          type:"out",
          date:d.toISOString(),
          name:`Pengeluaran POS - ${String(x.note||"Pengeluaran POS").trim()}`,
          amount,
          note:String(x.note||"Pengeluaran dari POS"),
          paymentMethod:txPaymentMethod({type:"out",paymentMethod:x?.paymentMethod||x?.method||"Tunai"}),
          shiftId:x.shiftId||null
        };
        if(existingExpenses.has(sourceId)){
          Object.assign(existingExpenses.get(sourceId),record);
          expenseUpdated++;
        }else{
          store.tx.push(record);
          expenseCreated++;
        }
      });

      // Simpan transaksi pembukuan dan riwayat sinkronisasi setelah pemasukan + pengeluaran berhasil diproses.
      persist();

      const h=readSyncHistory();
      h.push({
        file:file.name,
        date:new Date().toLocaleString("id-ID"),
        days:Object.keys(byDay).length,
        cash:Object.values(byDay).reduce((a,v)=>a+v.cash,0),
        nonCash:Object.values(byDay).reduce((a,v)=>a+v.nonCash,0),
        created,updated,
        expenseCreated,expenseUpdated,
        ignored
      });
      saveSyncHistory(h); renderSyncHistory();

      const cashTotal=Object.values(byDay).reduce((a,v)=>a+v.cash,0);
      const nonCashTotal=Object.values(byDay).reduce((a,v)=>a+v.nonCash,0);
      const expenseTotal=expenses.reduce((a,x)=>a+(Number(x?.amount??x?.total??x?.nominal??0)||0),0);
      const msg=`Sinkronisasi POS selesai.\n\nPemasukan Tunai: Rp ${Math.round(cashTotal).toLocaleString("id-ID")}\nPemasukan Non Tunai: Rp ${Math.round(nonCashTotal).toLocaleString("id-ID")}\nPengeluaran POS: Rp ${Math.round(expenseTotal).toLocaleString("id-ID")}\n\n${created} pemasukan baru, ${updated} pemasukan diperbarui.\n${expenseCreated} pengeluaran baru, ${expenseUpdated} pengeluaran diperbarui.`;
      if(status)status.textContent=msg.replaceAll("\n"," • ");
      appAlert(msg,"Sinkronisasi POS");
      refresh();
    }catch(err){
      if(status)status.textContent="Gagal: "+err.message;
      appAlert(err.message,"Sinkronisasi gagal");
    }finally{e.target.value=""}
  };
  reader.readAsText(file);
}

document.addEventListener("DOMContentLoaded",()=>{
  const gs=readGitHubSettings();
  if(gs.auto && githubConfigReady(gs)) setTimeout(()=>githubBackupNow(false),1200);

  const di=$("dashboardDateInput");
  if(di) di.addEventListener("change",e=>setDashboardDate(e.target.value));

  // Reconnect the previously authorised BLE printer automatically after a
  // PWA refresh/reopen. No chooser is shown when the browser has retained
  // the Web Bluetooth permission.
  setTimeout(()=>reconnectSavedBLEPrinter(true),500);
});
window.addEventListener("pageshow",()=>setTimeout(()=>reconnectSavedBLEPrinter(true),250));
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible") setTimeout(()=>reconnectSavedBLEPrinter(true),250);
});
window.addEventListener("online",()=>setTimeout(()=>reconnectSavedBLEPrinter(true),250));
