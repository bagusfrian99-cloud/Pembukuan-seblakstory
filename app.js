const KEY="seblak_story_v314";
const STOCK_KEY="seblak_story_stock_v314";
let store=JSON.parse(localStorage.getItem(KEY)||"null")||{tx:[]};
let stocks=JSON.parse(localStorage.getItem(STOCK_KEY)||"[]");
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
    return y;
  });
  if(changed)persist();
}
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
function persist(){localStorage.setItem(KEY,JSON.stringify(store));localStorage.setItem(STOCK_KEY,JSON.stringify(stocks))}
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
function page(id,btn){document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));$(id).classList.add("active");document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));btn.classList.add("active");if(id==="dashboard")renderDashboard();if(id==="transaksi")renderTransactions();if(id==="stok")renderStock();if(id==="laporan")renderReport();if(id==="backup")renderInfo();if(id==="syncpos")renderSyncHistory()}
function updateTxNameField(){
  const isIncome=$("tType").value==="in";
  $("incomeNameWrap").style.display=isIncome?"block":"none";
  $("expenseNameWrap").style.display=isIncome?"none":"block";
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
  let amount=Number($("tAmount").value),id=$("editId").value;
  if(!name||amount<=0)return appAlert("Nama transaksi dan jumlah wajib diisi.","Data belum lengkap");
  const date=$("tDate").value||localDT();
  const old=id?store.tx.find(a=>a.id==id):null;
  let x={
    id:id?Number(id):Date.now(),
    type:$("tType").value,
    date,
    name,
    amount,
    note:$("tNote").value.trim(),
    source:old?.source||"MANUAL",
    sourceId:old?.sourceId||null
  };
  if(id)store.tx=store.tx.map(a=>a.id==id?x:a);else store.tx.push(x);
  // Transaksi manual disimpan permanen dan langsung tersedia di Laporan.
  x.source=x.source||"MANUAL";
  persist();
  closeModal();
  refresh();
  if(document.getElementById("laporan")?.classList.contains("active")) renderReport();
}

function sum(a,t){return a.filter(x=>x.type===t).reduce((s,x)=>s+Number(x.amount||0),0)}
function renderDashboard(){let d=today(),m=d.slice(0,7),td=store.tx.filter(x=>x.date.slice(0,10)===d),mo=store.tx.filter(x=>x.date.slice(0,7)===m);$("dSaldo").textContent=money(sum(store.tx,"in")-sum(store.tx,"out"));$("dIn").textContent=money(sum(td,"in"));$("dOut").textContent=money(sum(td,"out"));$("dCount").textContent=mo.length;$("recent").innerHTML=store.tx.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).map(x=>`<div class="buyrow"><span><b>${esc(x.name)}</b><div class="buyinfo">${esc(x.date.replace("T"," "))}</div></span><b class="${x.type==="in"?"green":"red"}">${x.type==="in"?"+":"−"} ${money(x.amount)}</b></div>`).join("")||'<div class="empty">Belum ada transaksi.</div>'}
function renderTransactions(){let q=($("search").value||"").toLowerCase(),ft=$("filterType").value,from=$("from").value,to=$("to").value;let r=store.tx.filter(x=>(!q||(x.name+" "+(x.note||"")).toLowerCase().includes(q))&&(!ft||x.type===ft)&&(!from||x.date.slice(0,10)>=from)&&(!to||x.date.slice(0,10)<=to)).sort((a,b)=>b.date.localeCompare(a.date));$("txTable").innerHTML=r.map(x=>`<tr><td>${esc(x.date.replace("T"," "))}</td><td>${x.type==="in"?'<span class="green"><b>Pemasukan</b></span>':'<span class="red"><b>Pengeluaran</b></span>'}</td><td>${esc(x.name)}</td><td>${money(x.amount)}</td><td><button class="actionBtn editdel" onclick="openTx(${x.id})">✏️ Edit</button> <button class="actionBtn danger" onclick="removeTx(${x.id})">🗑 Hapus</button></td></tr>`).join("")||'<tr><td colspan="6" class="empty">Belum ada transaksi.</td></tr>'}
function removeTx(id){appConfirm("Hapus transaksi ini?","Hapus transaksi").then(ok=>{if(ok){store.tx=store.tx.filter(x=>x.id!=id);persist();refresh()}})}
function openStock(id=null){$("stockModal").classList.add("show");$("stockTitle").textContent=id?"Edit Stok":"Tambah Stok";$("stockId").value=id||"";$("sName").value="";$("sUnit").value="pcs";$("sPack").value="";$("sMin").value="";$("sQty").value="0";if(id){let x=stocks.find(a=>a.id==id);if(x){$("sName").value=x.name;$("sUnit").value=x.unit;$("sPack").value=x.pack;$("sMin").value=x.min;$("sQty").value=x.qty}}}
function closeStock(){$("stockModal").classList.remove("show")}
function saveStock(){let id=$("stockId").value,name=$("sName").value.trim(),unit=$("sUnit").value.trim()||"pcs",pack=Number($("sPack").value),min=Number($("sMin").value),qty=Number($("sQty").value);if(!name||pack<=0||min<0||qty<0)return appAlert("Lengkapi nama, isi/pack, minimum, dan stok.","Data belum lengkap");let x={id:id?Number(id):Date.now(),name,unit,pack,min,qty,lastSO:id?(stocks.find(a=>a.id==id)?.lastSO??qty):qty};if(id)stocks=stocks.map(a=>a.id==id?x:a);else stocks.push(x);persist();closeStock();renderStock()}
function stockStatus(x){return x.qty<=x.min?'<span class="status low">Perlu beli</span>':'<span class="status safe">Aman</span>'}
function openSO(id){let x=stocks.find(a=>a.id==id);if(!x)return;$("soModal").classList.add("show");$("soId").value=id;$("soLabel").textContent=`Hasil Stock Opname ${x.name} (${x.unit}):`;$("soQty").value=x.qty}
function closeSO(){$("soModal").classList.remove("show")}
function saveSO(){let id=Number($("soId").value),qty=Number($("soQty").value);if(qty<0)return appAlert("Stok tidak boleh negatif.","Data tidak valid");stocks=stocks.map(x=>x.id===id?{...x,qty,lastSO:qty}:x);persist();closeSO();renderStock()}
function openBuy(id){let x=stocks.find(a=>a.id==id);if(!x)return;$("buyModal").classList.add("show");$("buyId").value=id;$("buyPack").value=1;$("buyPrice").value=0;$("buyLabel").textContent=`Beli ${x.name}`;$("buyInfo").textContent=`1 pack = ${x.pack} ${x.unit}. Stok sekarang: ${x.qty} ${x.unit}.`;updateBuyTotal()}
function closeBuy(){$("buyModal").classList.remove("show")}
function updateBuyTotal(){let packs=Number($("buyPack").value)||0,price=Number($("buyPrice").value)||0;$("buyTotal").textContent=money(packs*price)}
function saveBuy(){let id=Number($("buyId").value),packs=Number($("buyPack").value),price=Number($("buyPrice").value),x=stocks.find(a=>a.id===id);if(!x||packs<=0)return appAlert("Jumlah pack harus lebih dari 0.","Data tidak valid");if(price<=0)return appAlert("Harga per pack wajib diisi.","Data belum lengkap");let total=packs*price;x.qty+=packs*x.pack;store.tx.push({id:Date.now(),type:"out",date:localDT(),name:`Pembelian stok - ${x.name}`,amount:total,note:`${packs} pack × ${money(price)} per pack`});persist();closeBuy();renderStock();renderDashboard();renderTransactions();renderReport();appAlert(`Pembelian tersimpan. Total ${money(total)} masuk ke Pengeluaran Hari Ini.`,"Pembelian tersimpan")}
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
function renderStock(){let q=($("stockSearch").value||"").toLowerCase();let r=stocks.filter(x=>x.name.toLowerCase().includes(q));$("stockTable").innerHTML=r.map(x=>`<tr><td>${esc(x.name)}<div class="buyinfo">SO terakhir: ${x.lastSO??x.qty} ${esc(x.unit)}</div></td><td>${x.qty} ${esc(x.unit)}</td><td>${x.pack} ${esc(x.unit)}</td><td>${x.min} ${esc(x.unit)}</td><td>${stockStatus(x)}</td><td><button class="actionBtn buy" onclick="openBuy(${x.id})">🛒 Beli</button></td><td><button class="actionBtn editdel" onclick="openEditDelete(${x.id})">⚙️ Edit/Hapus</button><br><button class="actionBtn primary" onclick="openSO(${x.id})">SO</button></td></tr>`).join("")||'<tr><td colspan="7" class="empty">Belum ada stok.</td></tr>';let needs=stocks.filter(x=>x.qty<=x.min);$("buyList").innerHTML=needs.map(x=>{let deficit=Math.max(0,x.min-x.qty),packs=Math.max(1,Math.ceil(deficit/x.pack));return `<div class="buyrow"><span><b>${esc(x.name)}</b><div class="buyinfo">Sisa SO: ${x.qty} ${esc(x.unit)} • Minimum: ${x.min} ${esc(x.unit)}</div></span><span class="buyqty">${packs} pack</span></div>`}).join("")||'<div class="empty">Tidak ada barang yang perlu dibeli.</div>'}
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
  ensureReportControls();
  let r=reportRows(),i=sum(r,"in"),o=sum(r,"out");
  $("reportSummary").innerHTML=`<div class="report"><b>Pemasukan</b><b class="green">${money(i)}</b></div><div class="report"><b>Pengeluaran</b><b class="red">${money(o)}</b></div><div class="report"><b>Bersih</b><b>${money(i-o)}</b></div>`;
  $("reportTable").innerHTML=r.slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).map(x=>`<tr><td>${esc(String(x.date||"").replace("T"," "))}</td><td>${x.type==="in"?'<span class="green"><b>Pemasukan</b></span>':'<span class="red"><b>Pengeluaran</b></span>'}</td><td>${esc(x.name)}</td><td>${money(x.amount)}</td></tr>`).join("")||'<tr><td colspan="4" class="empty">Tidak ada data pada periode ini.</td></tr>';
}
function printReport(){window.print()}
function exportCSV(){let r=reportRows(),rows=[["Tanggal","Jenis","Nama","Jumlah","Keterangan"],...r.map(x=>[x.date,x.type==="in"?"Pemasukan":"Pengeluaran",x.name,x.amount,x.note||""])];let csv=rows.map(a=>a.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");let a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));a.download="laporan-pembukuan-seblak-story.csv";a.click()}



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

/* 3.3.8 UI helpers */
let cashTab="all";function setCashTab(tab,btn){cashTab=tab;document.querySelectorAll(".cashTab").forEach(x=>x.classList.remove("active"));if(btn)btn.classList.add("active");renderTransactions()}const _rt338=renderTransactions;renderTransactions=function(){_rt338();if(cashTab!=="all"){const q=($("search")?.value||"").toLowerCase(),from=$("from")?.value||"",to=$("to")?.value||"";const r=store.tx.filter(x=>x.type===cashTab&&(!q||(x.name+" "+(x.note||"")).toLowerCase().includes(q))&&(!from||x.date.slice(0,10)>=from)&&(!to||x.date.slice(0,10)<=to)).sort((a,b)=>b.date.localeCompare(a.date));$("txTable").innerHTML=r.map(x=>`<tr><td>${esc(x.date.replace("T"," "))}</td><td>${x.type==="in"?'<span class="green"><b>Pemasukan</b></span>':'<span class="red"><b>Pengeluaran</b></span>'}</td><td>${esc(x.name)}</td><td>${money(x.amount)}</td><td><button class="actionBtn editdel" onclick="openTx(${x.id})">✏️ Edit</button> <button class="actionBtn danger" onclick="removeTx(${x.id})">🗑 Hapus</button></td></tr>`).join("")||'<tr><td colspan="5" class="empty">Belum ada transaksi.</td></tr>'}};function renderBars338(id,days){const el=$(id);if(!el)return;const max=Math.max(1,...days.flatMap(d=>[d.i,d.o]));el.innerHTML=days.map(d=>`<div style="flex:1;text-align:center"><div class="barGroup"><span class="bar in" style="height:${Math.max(2,d.i/max*100)}%"></span><span class="bar out" style="height:${Math.max(2,d.o/max*100)}%"></span></div><div class="barLabel">${d.label}</div></div>`).join("")}function renderDashChart338(){const now=new Date(),days=[];for(let i=6;i>=0;i--){const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-i);const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`,r=store.tx.filter(x=>String(x.date||"").slice(0,10)===k);days.push({label:String(d.getDate()),i:sum(r,"in"),o:sum(r,"out")})}renderBars338("dashChart",days)}const _rd338=renderDashboard;renderDashboard=function(){_rd338();if($("dashDate"))$("dashDate").textContent=new Date().toLocaleDateString("id-ID",{weekday:"long",day:"2-digit",month:"long",year:"numeric"});renderDashChart338()};const _rr338=renderReport;renderReport=function(){_rr338();const r=reportRows(),days={};r.forEach(x=>{days[x._day]??={label:x._day.slice(8,10),i:0,o:0};days[x._day][x.type==="in"?"i":"o"]+=Number(x.amount||0)});renderBars338("reportChart",Object.values(days).slice(-14))};document.addEventListener("DOMContentLoaded",()=>{try{normalizeTxData();ensureReportControls();renderDashboard();renderStock();renderReport();renderTransactions();renderInfo?.();renderSyncHistory?.()}catch(e){console.error(e)}});
