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
function page(id,btn){
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  const target=$(id); if(!target)return; target.classList.add('active');
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
}
function toggleMenu(){ page('lainnya',document.querySelector('[data-page="lainnya"]')); }
let txTab='in';
function setTxTab(tab){ txTab=tab||'in'; document.querySelectorAll('.tabs button').forEach(b=>b.classList.remove('active')); const id=txTab==='out'?'tabOut':txTab==='all'?'tabAll':'tabIn'; $(id)?.classList.add('active'); const ft=$('filterType'); if(ft)ft.value=txTab==='all'?'':txTab; const add=$('txAddBtn'); if(add)add.textContent=txTab==='out'?'＋ Tambah Pengeluaran':'＋ Tambah Pemasukan'; renderTransactions(); }

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
  $('dSaldo').textContent=money(sum(store.tx,'in')-sum(store.tx,'out'));
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
  $('txCards').innerHTML=r.map(x=>`<div class="txCard ${x.type==='in'?'incomeCard':'expenseCard'}"><div class="txIcon">${x.type==='in'?'▣':'■'}</div><div class="txMain"><b>${esc(x.name)}</b><small>${esc(String(x.date||'').replace('T',' '))}</small>${x.note?`<small>${esc(x.note)}</small>`:''}</div><div class="txAmount ${x.type==='in'?'green':'red'}">${money(x.amount)}<span>${x.type==='in'?(x.name==='Tunai'?'Tunai':'Non Tunai'):''}</span></div><button class="moreBtn" onclick="openTxActions(${x.id})">⋮</button></div>`).join('')||'<div class="empty">Belum ada transaksi.</div>';
}

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
function renderStock(){
  const q=($('stockSearch')?.value||'').toLowerCase(); const r=stocks.filter(x=>x.name.toLowerCase().includes(q));
  $('stockCards').innerHTML=r.map(x=>{const status=x.qty<=x.min?'Habis':x.qty<=x.min+x.pack?'Hampir Habis':'Aman'; const cls=status==='Habis'?'stockBad':status==='Hampir Habis'?'stockWarn':'stockGood'; return `<div class="stockCard"><div class="foodIcon">${x.name.toLowerCase().includes('mie')?'🍜':x.name.toLowerCase().includes('telur')?'🥚':x.name.toLowerCase().includes('bakso')?'🟤':x.name.toLowerCase().includes('kerupuk')?'🟠':x.name.toLowerCase().includes('sosis')?'🌭':'📦'}</div><div class="stockMain"><b>${esc(x.name)}</b><small>${esc(x.unit)} (${x.pack} ${esc(x.unit)})</small><span class="${cls}">Stok: ${x.qty} ${esc(x.unit)}</span><small>Min. ${x.min} ${esc(x.unit)}</small></div><div class="stockActions"><button onclick="openEditDelete(${x.id})">⋮</button><button class="buyMini" onclick="openBuy(${x.id})">Beli</button><button onclick="openSO(${x.id})">SO</button></div></div>`}).join('')||'<div class="empty">Belum ada bahan.</div>';
  const needs=stocks.filter(x=>x.qty<=x.min); $('buyList').innerHTML=needs.map(x=>`<div class="buyrow"><span><b>${esc(x.name)}</b><div class="buyinfo">Sisa ${x.qty} ${esc(x.unit)} • Minimum ${x.min}</div></span><span class="buyqty">${Math.max(1,Math.ceil(Math.max(0,x.min-x.qty)/x.pack))} pack</span></div>`).join('')||'<div class="empty">Tidak ada barang yang perlu dibeli.</div>';
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
  $('reportTable').innerHTML=r.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).map(x=>`<tr><td>${esc(String(x.date||'').replace('T',' '))}</td><td>${x.type==='in'?'<span class="green"><b>Pemasukan</b></span>':'<span class="red"><b>Pengeluaran</b></span>'}</td><td>${esc(x.name)}</td><td>${money(x.amount)}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">Tidak ada data pada periode ini.</td></tr>';
}

function printReport(){window.print()}
function exportCSV(){let r=reportRows(),rows=[["Tanggal","Jenis","Nama","Jumlah","Keterangan"],...r.map(x=>[x.date,x.type==="in"?"Pemasukan":"Pengeluaran",x.name,x.amount,x.note||""])];let csv=rows.map(a=>a.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");let a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));a.download="laporan-pembukuan-seblak-story.csv";a.click()}



function openTxActions(id){
  const x=store.tx.find(a=>String(a.id)===String(id)); if(!x)return;
  appChoice(`Transaksi ${x.name}\n${money(x.amount)}`,[{label:"Batal",value:"cancel"},{label:"Edit",value:"edit",primary:true},{label:"Hapus",value:"delete"}],"Aksi Transaksi").then(v=>{if(v==="edit")openTx(id);if(v==="delete")removeTx(id);});
}
function backup(){
  const payload={app:"Seblak Story Pembukuan",appVersion:"3.3.8",exportedAt:new Date().toISOString(),data:{[KEY]:JSON.stringify(store),[STOCK_KEY]:JSON.stringify(stocks)}};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`SeblakStory-Backup-${today()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function restore(e){
  const file=e.target.files?.[0]; if(!file)return; const reader=new FileReader(); reader.onload=()=>{try{const root=JSON.parse(reader.result); if(!root?.data)throw new Error("Format backup tidak dikenali."); const raw=root.data[KEY]; const rawStock=root.data[STOCK_KEY]; if(raw)store=typeof raw==="string"?JSON.parse(raw):raw; if(rawStock)stocks=typeof rawStock==="string"?JSON.parse(rawStock):rawStock; normalizeTxData(); persist(); refresh(); appAlert("Backup berhasil dipulihkan.","Restore berhasil");}catch(err){appAlert(err.message||"File backup tidak valid.","Restore gagal")}finally{e.target.value=""}}; reader.readAsText(file);
}
function clearAll(){appConfirm("Hapus semua transaksi dan stok dari perangkat? Data yang sudah dihapus tidak dapat dikembalikan tanpa backup.","Hapus Semua Data").then(ok=>{if(!ok)return;store={tx:[]};stocks=[];persist();refresh();appAlert("Semua data telah dihapus.","Data dihapus")})}
function renderInfo(){const el=$("dataInfo");if(el)el.innerHTML=`<div class="report"><span>Transaksi</span><b>${store.tx.length}</b></div><div class="report"><span>Stok bahan</span><b>${stocks.length}</b></div><div class="report"><span>Versi</span><b>3.3.10</b></div>`}

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

document.addEventListener("DOMContentLoaded",()=>{
  const di=$("dashboardDateInput");
  if(di) di.addEventListener("change",e=>setDashboardDate(e.target.value));
});
