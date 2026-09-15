
const KEY="seblak_story_full_bookkeeping_v1";
const defaultCats=["Penjualan","Modal","Bahan Baku","Gaji","Listrik","Air","Sewa","Transportasi","Operasional","Lainnya"];
let store=JSON.parse(localStorage.getItem(KEY)||"null")||{tx:[],cats:defaultCats};
if(!Array.isArray(store.cats)||!store.cats.length)store.cats=defaultCats;
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n||0);
const isoToday=()=>new Date().toISOString().slice(0,10);
const localDT=()=>{let d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)};
$("reportMonth").value=isoToday().slice(0,7);
function persist(){localStorage.setItem(KEY,JSON.stringify(store))}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function page(id,btn){document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));$(id).classList.add("active");document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));btn.classList.add("active");if(id==="dashboard")renderDashboard();if(id==="transaksi")renderTransactions();if(id==="laporan")renderReport();if(id==="kategori")renderCats();if(id==="backup")renderInfo()}
function openTx(id=null){
 $("modal").classList.add("show");$("modalTitle").textContent=id?"Edit Transaksi":"Tambah Transaksi";
 $("editId").value=id||""; $("tDate").value=localDT();$("tName").value="";$("tAmount").value="";$("tNote").value="";$("tType").value="in";fillCats();
 if(id){let x=store.tx.find(a=>a.id==id);if(x){$("tType").value=x.type;$("tDate").value=x.date;$("tName").value=x.name;$("tCat").value=x.cat;$("tAmount").value=x.amount;$("tNote").value=x.note||""}}
}
function closeTx(){$("modal").classList.remove("show")}
function fillCats(){$("tCat").innerHTML=store.cats.map(c=>`<option>${esc(c)}</option>`).join("")}
function saveTx(){
 let name=$("tName").value.trim(),amount=Number($("tAmount").value);
 if(!name||amount<=0)return alert("Nama transaksi dan jumlah wajib diisi.");
 let obj={id:$("editId").value||Date.now(),type:$("tType").value,date:$("tDate").value||localDT(),name,cat:$("tCat").value,amount,note:$("tNote").value.trim()};
 let i=store.tx.findIndex(x=>x.id==obj.id);if(i>=0)store.tx[i]=obj;else store.tx.push(obj);
 persist();closeTx();refresh();
}
function removeTx(id){if(confirm("Hapus transaksi ini?")){store.tx=store.tx.filter(x=>x.id!=id);persist();refresh()}}
function filteredTx(){
 let q=($("search")?.value||"").toLowerCase(),ft=$("filterType")?.value||"",f=$("from")?.value||"",t=$("to")?.value||"";
 return store.tx.filter(x=>(!q||(x.name+" "+x.note+" "+x.cat).toLowerCase().includes(q))&&(!ft||x.type===ft)&&(!f||x.date.slice(0,10)>=f)&&(!t||x.date.slice(0,10)<=t)).sort((a,b)=>b.date.localeCompare(a.date));
}
function renderTransactions(){
 let r=filteredTx();
 $("txTable").innerHTML=r.length?r.map(x=>`<tr><td>${x.date.replace("T"," ")}</td><td><span class="badge">${x.type==="in"?"Pemasukan":"Pengeluaran"}</span></td><td><b>${esc(x.name)}</b><br><small>${esc(x.note||"")}</small></td><td>${esc(x.cat)}</td><td class="right ${x.type==="in"?"green":"red"}">${x.type==="in"?"+":"−"} ${money(x.amount)}</td><td><button class="btn" onclick="openTx(${x.id})">Edit</button> <button class="btn danger" onclick="removeTx(${x.id})">Hapus</button></td></tr>`).join(""):'<tr><td colspan="6" class="empty">Belum ada transaksi.</td></tr>';
}
function sum(r,type){return r.filter(x=>x.type===type).reduce((s,x)=>s+x.amount,0)}
function renderDashboard(){
 let d=isoToday(),month=d.slice(0,7),i=sum(store.tx,"in"),o=sum(store.tx,"out"),today=store.tx.filter(x=>x.date.slice(0,10)===d),m=store.tx.filter(x=>x.date.slice(0,7)===month);
 $("dSaldo").textContent=money(i-o);$("dInToday").textContent=money(sum(today,"in"));$("dOutToday").textContent=money(sum(today,"out"));$("dCount").textContent=m.length;
 $("recent").innerHTML=store.tx.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).map(x=>`<div class="tx"><span><b>${esc(x.name)}</b><br><small>${x.date.replace("T"," ")} • ${esc(x.cat)}</small></span><b class="${x.type==="in"?"green":"red"}">${x.type==="in"?"+":"−"} ${money(x.amount)}</b></div>`).join("")||'<div class="empty">Belum ada transaksi.</div>';
 drawChart();
 $("monthSummary").innerHTML=`<div class="report"><b>Pemasukan</b><span class="green">${money(sum(m,"in"))}</span></div><div class="report"><b>Pengeluaran</b><span class="red">${money(sum(m,"out"))}</span></div><div class="report"><b>Selisih</b><b>${money(sum(m,"in")-sum(m,"out"))}</b></div>`;
}
function drawChart(){
 let c=$("chart"),ctx=c.getContext("2d"),w=c.width=c.clientWidth*2,h=c.height=300,days=[];
 for(let k=6;k>=0;k--){let d=new Date();d.setDate(d.getDate()-k);days.push(d.toISOString().slice(0,10))}
 let ins=days.map(d=>sum(store.tx.filter(x=>x.date.slice(0,10)===d),"in")),outs=days.map(d=>sum(store.tx.filter(x=>x.date.slice(0,10)===d),"out")),max=Math.max(1,...ins,...outs);
 ctx.clearRect(0,0,w,h);let p=45,gw=w-p*2,gh=h-65;
 ctx.strokeStyle="#ddd";ctx.fillStyle="#555";ctx.font="22px Arial";ctx.textAlign="center";
 for(let j=0;j<7;j++){let x=p+gw*j/6;ctx.beginPath();ctx.moveTo(x,p);ctx.lineTo(x,h-40);ctx.stroke();ctx.fillText(days[j].slice(5),x,h-12)}
 function bars(vals,offset){ctx.fillStyle=offset?"#d33":"#16844d";vals.forEach((v,j)=>{let x=p+gw*j/6-12+offset*12,y=h-40-(v/max)*gh;ctx.fillRect(x,y,10,(v/max)*gh)})}
 bars(ins,0);bars(outs,1);
}
function getReportRows(){
 let p=$("period").value,d=isoToday(),r=[];
 if(p==="today")r=store.tx.filter(x=>x.date.slice(0,10)===d);
 else if(p==="week"){let s=new Date();s.setDate(s.getDate()-6);let a=s.toISOString().slice(0,10);r=store.tx.filter(x=>x.date.slice(0,10)>=a&&x.date.slice(0,10)<=d)}
 else if(p==="month"){let m=$("reportMonth").value||d.slice(0,7);r=store.tx.filter(x=>x.date.slice(0,7)===m)}
 else {let f=$("reportFrom").value,t=$("reportTo").value;r=store.tx.filter(x=>(!f||x.date.slice(0,10)>=f)&&(!t||x.date.slice(0,10)<=t))}
 return r.sort((a,b)=>a.date.localeCompare(b.date))
}
function renderReport(){
 let r=getReportRows(),i=sum(r,"in"),o=sum(r,"out");
 $("reportSummary").innerHTML=`<div class="grid"><div class="card"><small>Pemasukan</small><div class="value green">${money(i)}</div></div><div class="card"><small>Pengeluaran</small><div class="value red">${money(o)}</div></div><div class="card"><small>Selisih</small><div class="value">${money(i-o)}</div></div><div class="card"><small>Jumlah Transaksi</small><div class="value">${r.length}</div></div></div>`;
 $("reportTable").innerHTML=r.map(x=>`<tr><td>${x.date.replace("T"," ")}</td><td>${x.type==="in"?"Pemasukan":"Pengeluaran"}</td><td>${esc(x.name)}</td><td>${esc(x.cat)}</td><td class="right">${money(x.amount)}</td></tr>`).join("")||'<tr><td colspan="5" class="empty">Tidak ada data pada periode ini.</td></tr>';
}
function printReport(){document.querySelector(".page.active")?.classList.add("printable");window.print();document.querySelector(".page.active")?.classList.remove("printable")}
function exportCSV(){
 let r=getReportRows(),rows=[["Tanggal","Jenis","Nama","Kategori","Jumlah","Keterangan"],...r.map(x=>[x.date,x.type==="in"?"Pemasukan":"Pengeluaran",x.name,x.cat,x.amount,x.note||""])];
 let csv=rows.map(a=>a.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n"),a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));a.download="laporan-pembukuan-seblak-story.csv";a.click();
}
function renderCats(){$("cats").innerHTML=store.cats.map((c,i)=>`<div class="tx"><span>${esc(c)}</span><button class="btn danger" onclick="delCat(${i})">Hapus</button></div>`).join("")}
function addCategory(){let c=$("newCat").value.trim();if(!c)return;if(store.cats.includes(c))return alert("Kategori sudah ada.");store.cats.push(c);$("newCat").value="";persist();renderCats();fillCats()}
function delCat(i){if(store.cats.length<=1)return alert("Minimal harus ada satu kategori.");if(confirm("Hapus kategori ini? Transaksi lama tetap tersimpan.")){store.cats.splice(i,1);persist();renderCats();fillCats()}}
function backup(){let a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(store,null,2)],{type:"application/json"}));a.download="backup-pembukuan-seblak-story.json";a.click()}
function restore(e){let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{let x=JSON.parse(r.result);if(!x||!Array.isArray(x.tx)||!Array.isArray(x.cats))throw 0;store=x;persist();refresh();alert("Restore berhasil.")}catch(_){alert("File backup tidak valid.")}};r.readAsText(f)}
function clearAll(){if(confirm("Semua transaksi dan kategori akan dihapus. Lanjutkan?")){localStorage.removeItem(KEY);store={tx:[],cats:defaultCats};refresh()}}
function renderInfo(){$("dataInfo").innerHTML=`<b>${store.tx.length}</b> transaksi<br><b>${store.cats.length}</b> kategori<br><small>Data tersimpan di browser/perangkat ini.</small>`}
function refresh(){renderDashboard();renderTransactions();renderReport();renderCats();renderInfo()}
refresh();


/* ===== Seblak Story Bookkeeping v2 enhancements ===== */
const AUTO_BACKUP_KEY = "seblak_story_last_auto_backup_v2";

function toast(msg){
  let t=document.querySelector(".toast");
  if(!t){t=document.createElement("div");t.className="toast";document.body.appendChild(t);}
  t.textContent=msg;t.classList.add("show");
  clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.classList.remove("show"),2200);
}

function quickExpense(){
  openTx();
  setTimeout(()=>{
    const el=document.getElementById("tType");
    if(el) el.value="out";
  },0);
}

function exportXLSX(){
  const rows=getReportRows().map(x=>({
    "Tanggal":x.date,
    "Jenis":x.type==="in"?"Pemasukan":"Pengeluaran",
    "Nama":x.name,
    "Kategori":x.cat,
    "Jumlah":x.amount,
    "Keterangan":x.note||""
  }));
  if(!rows.length){alert("Tidak ada data untuk diekspor.");return;}
  if(typeof XLSX==="undefined"){
    alert("Fitur Excel membutuhkan koneksi internet saat pertama kali mengekspor. Gunakan Export CSV jika sedang offline.");
    return;
  }
  const ws=XLSX.utils.json_to_sheet(rows);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"Transaksi");
  XLSX.writeFile(wb,"Laporan-Pembukuan-Seblak-Story.xlsx");
  toast("File Excel berhasil dibuat");
}

/* Automatic local safety snapshot. This does not upload data anywhere. */
function autoBackupLocal(){
  try{
    const payload=JSON.stringify(store);
    localStorage.setItem(AUTO_BACKUP_KEY, payload);
  }catch(e){}
}
const oldPersist = persist;
persist = function(){
  oldPersist();
  autoBackupLocal();
};

function restoreLocalSnapshot(){
  const raw=localStorage.getItem(AUTO_BACKUP_KEY);
  if(!raw)return false;
  try{
    const x=JSON.parse(raw);
    if(x && Array.isArray(x.tx) && Array.isArray(x.cats)){
      store=x;persist();refresh();toast("Snapshot lokal dipulihkan");return true;
    }
  }catch(e){}
  return false;
}
