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
function openGitHubSettings(){
  const s=readGitHubSettings();
  $("ghOwner").value=s.owner||""; $("ghRepo").value=s.repo||""; $("ghBranch").value=s.branch||"main";
  $("ghFolder").value=s.folder||"backup"; $("ghToken").value=s.token||""; $("ghAuto").checked=!!s.auto;
  const status=s.lastStatus ? `${s.lastStatus}${s.lastBackup?" • "+s.lastBackup:""}` : (s.auto?"Backup otomatis aktif.":"Belum terhubung.");
  $("ghStatus").textContent=status;
  $("githubModal").classList.add("show");
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
function githubConfigReady(s){return !!(s.owner&&s.repo&&s.branch&&s.folder&&s.token)}
function githubApiHeaders(token){return {"Accept":"application/vnd.github+json","Authorization":"Bearer "+token,"X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"}}
function backupPayload(){
  return {app:"Seblak Story Pembukuan",appVersion:"3.3.17",exportedAt:new Date().toISOString(),data:{[KEY]:JSON.stringify(store),[STOCK_KEY]:JSON.stringify(stocks)}};
}
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
    const payload=backupPayload();
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
function openTx(id=null){
  $("modal").classList.add("show");
  $("modalTitle").textContent=id?"Edit Transaksi":"Tambah Transaksi";
  $("editId").value=id||"";
  $("tDate").value=localDT();
  $("tIncomeName").value="Tunai";
  $("tName").value="";
  $("tAmount").value="";
  $("tNote").value="";
  $("tExpensePayment").value="Tunai";
  $("tType").value="in";
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
  $('txCards').innerHTML=r.map(x=>`<div class="txCard ${x.type==='in'?'incomeCard':'expenseCard'}"><div class="txIcon">${x.type==='in'?'▣':'■'}</div><div class="txMain"><b>${esc(x.name)}</b><small>${esc(String(x.date||'').replace('T',' '))}</small>${x.note?`<small>${esc(x.note)}</small>`:''}</div><div class="txAmount ${x.type==='in'?'green':'red'}">${money(x.amount)}<span>${txPaymentMethod(x)}</span></div><button class="moreBtn" onclick="openTxActions(${x.id})">⋮</button></div>`).join('')||'<div class="empty">Belum ada transaksi.</div>';
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
function openBuy(id){let x=stocks.find(a=>a.id==id);if(!x)return;$("buyModal").classList.add("show");$("buyId").value=id;$("buyPack").value=1;$("buyPrice").value=0;$("buyLabel").textContent=`Beli ${x.name}`;$("buyInfo").textContent=`Stok sekarang: ${x.qty} pack • Minimum: ${x.min} pack • Isi per pack: ${x.pack}`;updateBuyTotal()}
function closeBuy(){$("buyModal").classList.remove("show")}
function updateBuyTotal(){let packs=Number($("buyPack").value)||0,price=Number($("buyPrice").value)||0;$("buyTotal").textContent=money(packs*price)}
function saveBuy(){let id=Number($("buyId").value),packs=Number($("buyPack").value),price=Number($("buyPrice").value),x=stocks.find(a=>a.id===id);if(!x||packs<=0)return appAlert("Jumlah pack harus lebih dari 0.","Data tidak valid");if(price<=0)return appAlert("Harga per pack wajib diisi.","Data belum lengkap");let total=packs*price;x.qty+=packs;store.tx.push({id:Date.now(),type:"out",date:localDT(),name:`Pembelian stok - ${x.name}`,amount:total,note:`${packs} pack × ${money(price)} per pack`});persist();closeBuy();renderStock();renderDashboard();renderTransactions();renderReport();appAlert(`Pembelian tersimpan. Total ${money(total)} masuk ke Pengeluaran Hari Ini.`,"Pembelian tersimpan")}
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

function renderStock(){
  const q=($('stockSearch')?.value||'').toLowerCase();
  const r=stocks.filter(x=>{
    if(!x.name.toLowerCase().includes(q)) return false;
    const st=stockStatusValue(x);
    if(stockFilter==='kurang') return st==='kurang';
    if(stockFilter==='sedikit') return st==='sedikit';
    return true;
  });
  $('stockCards').innerHTML=r.map(x=>{
    const status=stockStatusValue(x)==='kurang'?'Kurang':stockStatusValue(x)==='sedikit'?'Sisa Sedikit':'Aman';
    const cls=status==='Kurang'?'stockBad':status==='Sisa Sedikit'?'stockWarn':'stockGood';
    return `<div class="stockCard"><div class="foodIcon">${x.name.toLowerCase().includes('mie')?'🍜':x.name.toLowerCase().includes('telur')?'🥚':x.name.toLowerCase().includes('bakso')?'🟤':x.name.toLowerCase().includes('kerupuk')?'🟠':x.name.toLowerCase().includes('sosis')?'🌭':'📦'}</div><div class="stockMain"><b>${esc(x.name)}</b><small>Isi ${x.pack} per pack</small><span class="${cls}">Stok: ${x.qty} pack</span><small>Min. ${x.min} pack</small></div><div class="stockActions"><button type="button" onclick="openEditDelete(${x.id})">⋮</button><button type="button" class="buyMini" onclick="openBuy(${x.id})">Beli</button><button type="button" onclick="openSO(${x.id})">SO</button></div></div>`;
  }).join('')||'<div class="empty">Belum ada bahan pada filter ini.</div>';
  const needs=getBuyListItems(); $('buyList').innerHTML=needs.map(x=>`<div class="buyrow"><span><b>${esc(x.name)}</b></span><span class="buyqty">${x.buy} pack</span></div>`).join('')||'<div class="empty">Tidak ada barang yang perlu dibeli.</div>';
}


let reportApplied={period:"month",month:today().slice(0,7),from:"",to:""};
function ensureReportControls(){
  const p=$("period"),m=$("reportMonth"),f=$("reportFrom"),t=$("reportTo");
  if(!p)return;
  if(!m.value)m.value=today().slice(0,7);
  if(!reportApplied.month)reportApplied.month=m.value||today().slice(0,7);
}
function applyReportFilter(){
  reportApplied={
    period:$("period").value||"month",
    month:$("reportMonth").value||today().slice(0,7),
    from:$("reportFrom").value||"",
    to:$("reportTo").value||""
  };
  renderReport();
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


function readTelegramSettings(){
  try{const x=JSON.parse(localStorage.getItem(TELEGRAM_SETTINGS_KEY)||"null");return x&&typeof x==="object"?{folder:x.folder||"telegram",file:x.file||"inbox.json",auto:!!x.auto,lastSync:x.lastSync||"",lastStatus:x.lastStatus||""}:{folder:"telegram",file:"inbox.json",auto:false,lastSync:"",lastStatus:""}}
  catch(e){return {folder:"telegram",file:"inbox.json",auto:false,lastSync:"",lastStatus:""}}
}
function saveTelegramSettingsLocal(x){localStorage.setItem(TELEGRAM_SETTINGS_KEY,JSON.stringify(x))}
function openTelegramSettings(){
  const s=readTelegramSettings(); $("tgFolder").value=s.folder; $("tgFile").value=s.file; $("tgAuto").checked=s.auto;
  $("tgStatus").textContent=s.lastStatus||(s.lastSync?`Sinkron terakhir: ${s.lastSync}`:"Belum sinkron."); $("telegramModal").classList.add("show");
}
function closeTelegramSettings(){$("telegramModal").classList.remove("show")}
function saveTelegramSettings(){
  const old=readTelegramSettings(); const s={...old,folder:( $("tgFolder").value.trim().replace(/^\/+|\/+$/g,"")||"telegram"),file:($("tgFile").value.trim().replace(/^\/+/,"")||"inbox.json"),auto:$('tgAuto').checked};
  saveTelegramSettingsLocal(s); $("tgStatus").textContent=s.auto?"Pengaturan tersimpan • input Telegram otomatis aktif.":"Pengaturan tersimpan • input otomatis nonaktif.";
  if(s.auto)scheduleTelegramSync();
  appAlert(s.auto?"Input otomatis Telegram diaktifkan. Saat aplikasi dibuka, laporan baru akan disinkronkan.":"Pengaturan Telegram tersimpan.","Input Telegram");
}
function telegramInboxUrl(s){
  const gh=readGitHubSettings(); return githubFileUrl(gh,`${s.folder}/${s.file}`);
}
function parseMoneyText(v){
  if(v==null)return 0; const m=String(v).replace(/\s/g,"").replace(/Rp/gi,"").replace(/\./g,"").replace(/,/g,"").match(/-?\d+/); return m?Number(m[0]):0;
}
function parseTelegramShift(text){
  const t=String(text||"").replace(/\r/g,"");
  const pick=(re)=>{const m=t.match(re);return m?m[1].trim():""};
  const date=pick(/(?:Tanggal|Tgl)\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const time=pick(/(?:Waktu|Jam)\s*:\s*([0-2]?\d[.:]\d{2})/i);
  const cashier=pick(/(?:Kasir)\s*:\s*(.+)/i);
  const shift=pick(/(?:Shift)\s*:\s*([^\n]+)/i);
  const trx=pick(/(?:Transaksi|Jumlah Transaksi)\s*:\s*([\d.]+)/i);
  const sales=pick(/(?:Penjualan|Penjualan Total|Total Penjualan)\s*:\s*([^\n]+)/i);
  const cash=pick(/(?:Cash|Tunai)\s*:\s*([^\n]+)/i);
  const noncash=pick(/(?:Nontunai|Non Tunai|Non-tunai|NonTunai)\s*:\s*([^\n]+)/i);
  const expense=pick(/(?:Pengeluaran|Total Pengeluaran)\s*:\s*([^\n]+)/i);
  if(!date||!shift)return null;
  const dm=date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if(!dm)return null;
  const day=`${dm[3]}-${String(dm[2]).padStart(2,"0")}-${String(dm[1]).padStart(2,"0")}`;
  const tm=(time||"00.00").replace(".",":");
  return {day,time:tm,cashier,shift:shift.replace(/\s+/g," "),transactions:parseMoneyText(trx),sales:parseMoneyText(sales),cash:parseMoneyText(cash),nonCash:parseMoneyText(noncash),expense:parseMoneyText(expense)};
}
async function fetchTelegramInbox(){
  const gh=readGitHubSettings(), tg=readTelegramSettings();
  if(!githubConfigReady(gh))throw new Error("Pengaturan GitHub belum lengkap. GitHub dipakai sebagai jembatan inbox Telegram.");
  const url=telegramInboxUrl(tg), res=await fetch(url+`?ref=${encodeURIComponent(gh.branch)}`,{headers:githubApiHeaders(gh.token),cache:"no-store"});
  if(res.status===404)return {items:[],sha:null};
  if(!res.ok){let m="";try{m=(await res.json()).message||""}catch(e){}throw new Error(m||`GitHub inbox gagal (${res.status})`)}
  const x=await res.json(); let content=""; try{content=atob((x.content||"").replace(/\n/g,""));}catch(e){throw new Error("Isi inbox Telegram di GitHub tidak valid.")}
  let data; try{data=JSON.parse(decodeURIComponent(escape(content)))}catch(e){try{data=JSON.parse(content)}catch(e2){throw new Error("Format telegram/inbox.json tidak valid.")}}
  return {items:Array.isArray(data)?data:(Array.isArray(data.items)?data.items:[]),sha:x.sha||null};
}
function telegramSourceId(p){return `TG-SHIFT-${p.shift}-${p.day}`}
function applyTelegramShift(p,sourceMessageId){
  const sid=telegramSourceId(p), stamp=`${p.day}T${p.time||"00:00"}`;
  const rows=[];
  if(p.cash>0)rows.push({type:"in",name:"Tunai",amount:p.cash,note:`Telegram • Shift ${p.shift}${p.cashier?` • Kasir ${p.cashier}`:""}` ,sourceId:`${sid}-CASH`,cash:p.cash,nonCash:0});
  if(p.nonCash>0)rows.push({type:"in",name:"Non Tunai",amount:p.nonCash,note:`Telegram • Shift ${p.shift}${p.cashier?` • Kasir ${p.cashier}`:""}`,sourceId:`${sid}-NONCASH`,cash:0,nonCash:p.nonCash});
  if(p.expense>0)rows.push({type:"out",name:`Pengeluaran Shift ${p.shift}`,amount:p.expense,note:`Telegram • Shift ${p.shift}${p.cashier?` • Kasir ${p.cashier}`:""}`,sourceId:`${sid}-EXP`,cash:0,nonCash:0,paymentMethod:"Tunai"});
  let created=0,updated=0;
  rows.forEach(r=>{
    const existing=store.tx.find(x=>x.source==="TELEGRAM_SHIFT"&&x.sourceId===r.sourceId);
    const rec={id:existing?.id||r.sourceId,source:"TELEGRAM_SHIFT",sourceId:r.sourceId,type:r.type,date:stamp,name:r.name,amount:r.amount,note:r.note,cash:r.cash,nonCash:r.nonCash,telegramMessageId:sourceMessageId||null,shiftId:p.shift};
    if(existing){Object.assign(existing,rec);updated++}else{store.tx.push(rec);created++}
  });
  return {created,updated,id:sid};
}
async function syncTelegramNow(showMessage=true){
  if(telegramBusy)return; telegramBusy=true;
  try{
    const tg=readTelegramSettings(); const inbox=await fetchTelegramInbox(); let created=0,updated=0,ignored=0,seen=0;
    for(const item of inbox.items){
      if(item?.processed===true)continue;
      const parsed=parseTelegramShift(item?.text||item?.message||item?.caption||""); if(!parsed){ignored++;continue}
      const result=applyTelegramShift(parsed,item?.messageId||item?.id||null); created+=result.created;updated+=result.updated;seen++;
    }
    if(created||updated)persist();
    const now=new Date().toLocaleString("id-ID"); saveTelegramSettingsLocal({...tg,lastSync:now,lastStatus:`${seen} laporan dibaca • ${created} transaksi baru • ${updated} diperbarui • ${ignored} diabaikan`});
    if($("tgStatus"))$("tgStatus").textContent=`Sinkron terakhir: ${now} • ${created} baru • ${updated} diperbarui`;
    refresh();
    if(showMessage)appAlert(`Sinkron Telegram selesai.\n\nLaporan dibaca: ${seen}\nTransaksi baru: ${created}\nTransaksi diperbarui: ${updated}\nDiabaikan: ${ignored}`,"Telegram");
  }catch(e){const tg=readTelegramSettings();const msg=e?.message||"Sinkron Telegram gagal.";saveTelegramSettingsLocal({...tg,lastStatus:"Gagal: "+msg});if($("tgStatus"))$("tgStatus").textContent="Gagal: "+msg;if(showMessage)appAlert(msg,"Sinkron Telegram gagal");}
  finally{telegramBusy=false}
}
function scheduleTelegramSync(){
  const tg=readTelegramSettings(), gh=readGitHubSettings(); if(!tg.auto||!githubConfigReady(gh))return;
  clearTimeout(telegramTimer); telegramTimer=setTimeout(()=>syncTelegramNow(false),1500);
}

function printReport(){
  const ps=readPrinterSettings();
  if(ps.auto && ps.deviceId){ printReportBLE().catch(e=>appAlert(e?.message||"Cetak BLE gagal. Silakan gunakan printer perangkat.","Cetak gagal")); return; }
  window.print();
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
async function findWritableCharacteristic(device){
  const services=await device.gatt.getPrimaryServices();
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
  if(!s.deviceId||!navigator.bluetooth?.getDevices)return null;
  const devices=await navigator.bluetooth.getDevices();
  const d=devices.find(x=>x.id===s.deviceId); if(!d)return null;
  if(!d.gatt)throw new Error("Printer BLE tidak menyediakan GATT.");
  const server=d.gatt.connected?d.gatt:await d.gatt.connect();
  blePrinterDevice=d; blePrinterCharacteristic=await findWritableCharacteristic(server); return d;
}
async function ensureBLEPrinter(){
  if(blePrinterCharacteristic&&blePrinterDevice?.gatt?.connected)return blePrinterDevice;
  const saved=await getSavedBLEPrinter(); if(saved)return saved;
  throw new Error("Printer BLE belum terhubung. Buka Pengaturan Printer → Pilih Printer BLE terlebih dahulu.");
}
function escBytes(){return new Uint8Array([...arguments])}
async function bleWrite(data){
  const c=blePrinterCharacteristic; if(!c)throw new Error("Printer BLE belum siap.");
  const max=180; for(let i=0;i<data.length;i+=max){const chunk=data.slice(i,i+max); if(c.properties.writeWithoutResponse&&c.writeValueWithoutResponse)await c.writeValueWithoutResponse(chunk); else await c.writeValue(chunk); await new Promise(r=>setTimeout(r,15));}
}
function receiptText(){
  const d=new Date();
  const balance=store.tx.reduce((a,x)=>a+(x.type==="in"?(Number(x.amount)||0):-(Number(x.amount)||0)),0);
  return ["SEBLAK STORY PEMBUKUAN","==============================",`Tanggal: ${d.toLocaleString("id-ID")}`,"",`Saldo Kas: ${money(balance)}`,"","Terima kasih","","",""].join("\n");
}
async function testBLEPrinter(){
  try{await ensureBLEPrinter(); const bytes=new TextEncoder().encode(receiptText()); await bleWrite(new Uint8Array([0x1b,0x40])); await bleWrite(bytes); await bleWrite(new Uint8Array([0x1d,0x56,0x00])); appAlert("Test print berhasil dikirim ke printer BLE.","Test Printer");}
  catch(e){appAlert(e?.message||"Test printer gagal.","Test Printer gagal")}
}
async function disconnectBLEPrinter(){try{if(blePrinterDevice?.gatt?.connected)blePrinterDevice.gatt.disconnect();}catch(e){} blePrinterCharacteristic=null; blePrinterDevice=null; const el=$("printerStatus");if(el)el.textContent="Printer terputus.";}
async function printReportBLE(){
  await ensureBLEPrinter(); const from=$("reportFrom")?.value||""; const to=$("reportTo")?.value||""; const ins=store.tx.filter(x=>x.type==="in"&&(!from||x.date.slice(0,10)>=from)&&(!to||x.date.slice(0,10)<=to)); const outs=store.tx.filter(x=>x.type==="out"&&(!from||x.date.slice(0,10)>=from)&&(!to||x.date.slice(0,10)<=to)); const ti=ins.reduce((a,x)=>a+Number(x.amount)||0,0),toT=outs.reduce((a,x)=>a+Number(x.amount)||0,0);
  let text="SEBLAK STORY PEMBUKUAN\n==============================\nLAPORAN KEUANGAN\n"+(from?from:"-")+" s/d "+(to?to:"-")+"\n\nTotal Pemasukan: "+money(ti)+"\nTotal Pengeluaran: "+money(toT)+"\nSaldo / Laba: "+money(ti-toT)+"\n\nTRANSAKSI\n";
  for(const x of [...ins,...outs].sort((a,b)=>b.date.localeCompare(a.date))) text+=`${x.date.replace("T"," ")} ${x.type==="in"?"+":"-"} ${x.name}\n${money(x.amount)}\n`;
  text+="\n\nTerima kasih\n\n\n"; await bleWrite(new Uint8Array([0x1b,0x40])); await bleWrite(new TextEncoder().encode(text)); await bleWrite(new Uint8Array([0x1d,0x56,0x00])); appAlert("Laporan berhasil dikirim ke printer BLE.","Cetak berhasil");
}

function exportCSV(){let r=reportRows(),rows=[["Tanggal","Jenis","Nama","Metode","Jumlah","Keterangan"],...r.map(x=>[x.date,x.type==="in"?"Pemasukan":"Pengeluaran",x.name,txPaymentMethod(x),x.amount,x.note||""])];let csv=rows.map(a=>a.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");let a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));a.download="laporan-pembukuan-seblak-story.csv";a.click()}



function openTxActions(id){
  const x=store.tx.find(a=>String(a.id)===String(id)); if(!x)return;
  appChoice(`Transaksi ${x.name}\n${money(x.amount)}`,[{label:"Batal",value:"cancel"},{label:"Edit",value:"edit",primary:true},{label:"Hapus",value:"delete"}],"Aksi Transaksi").then(v=>{if(v==="edit")openTx(id);if(v==="delete")removeTx(id);});
}
function backup(){
  const payload={app:"Seblak Story Pembukuan",appVersion:"3.3.8",exportedAt:new Date().toISOString(),data:{[KEY]:JSON.stringify(store),[STOCK_KEY]:JSON.stringify(stocks)}};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`SeblakStory-Backup-${today()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function restore(e){
  const file=e.target.files?.[0]; if(!file)return; const reader=new FileReader(); reader.onload=()=>{try{const root=JSON.parse(reader.result); if(!root?.data)throw new Error("Format backup tidak dikenali."); const raw=root.data[KEY]; const rawStock=root.data[STOCK_KEY]; if(raw)store=typeof raw==="string"?JSON.parse(raw):raw; if(rawStock)stocks=typeof rawStock==="string"?JSON.parse(rawStock):rawStock; migrateStockToPack(); normalizeTxData(); persist(); refresh(); appAlert("Backup berhasil dipulihkan.","Restore berhasil");}catch(err){appAlert(err.message||"File backup tidak valid.","Restore gagal")}finally{e.target.value=""}}; reader.readAsText(file);
}
function clearAll(){appConfirm("Hapus semua transaksi dan stok dari perangkat? Data yang sudah dihapus tidak dapat dikembalikan tanpa backup.","Hapus Semua Data").then(ok=>{if(!ok)return;store={tx:[]};stocks=[];persist();refresh();appAlert("Semua data telah dihapus.","Data dihapus")})}
function renderInfo(){const el=$("dataInfo");if(el)el.innerHTML=`<div class="report"><span>Transaksi</span><b>${store.tx.length}</b></div><div class="report"><span>Stok bahan</span><b>${stocks.length}</b></div><div class="report"><span>Versi</span><b>3.3.17</b></div>`}

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
  const tg=readTelegramSettings(); if(tg.auto && githubConfigReady(gs)) setTimeout(()=>syncTelegramNow(false),1800);
  const di=$("dashboardDateInput");
  if(di) di.addEventListener("change",e=>setDashboardDate(e.target.value));
});
