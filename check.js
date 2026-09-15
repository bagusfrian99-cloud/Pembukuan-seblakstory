
const KEY='seblak_story_bookkeeping_v3';
const OLD=['seblak_story_full_bookkeeping_v1','seblak_story_bookkeeping_v2'];
const defaultCats=['Penjualan','Modal','Bahan Baku','Gaji','Listrik','Air','Sewa','Transportasi','Operasional','Kas Masuk','Kas Keluar','Lainnya'];
const emptyStore={tx:[],cats:defaultCats.slice(),stock:[],shifts:[],debts:[],settings:{}};
let store=loadStore();
function loadStore(){try{let x=JSON.parse(localStorage.getItem(KEY)||'null');if(x&&Array.isArray(x.tx))return normalize(x)}catch(e){} for(const k of OLD){try{let x=JSON.parse(localStorage.getItem(k)||'null');if(x&&Array.isArray(x.tx))return normalize({...emptyStore,...x,stock:[],shifts:[],debts:[]})}catch(e){}} return normalize({...emptyStore})}
function normalize(x){x={...emptyStore,...x};x.cats=Array.isArray(x.cats)&&x.cats.length?x.cats:defaultCats.slice();x.tx=Array.isArray(x.tx)?x.tx:[];x.stock=Array.isArray(x.stock)?x.stock:[];x.shifts=Array.isArray(x.shifts)?x.shifts:[];x.debts=Array.isArray(x.debts)?x.debts:[];return x}
const $=id=>document.getElementById(id);const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n)||0);const today=()=>new Date().toLocaleDateString('sv-SE');
const localDT=()=>{let d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)};
function persist(){localStorage.setItem(KEY,JSON.stringify(store))}function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function page(id,btn){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));$(id).classList.add('active');document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));if(btn)btn.classList.add('active');if(id==='dashboard')renderDashboard();if(id==='transaksi')renderTransactions();if(id==='stok')renderStock();if(id==='laporan')renderReport();if(id==='kategori')renderCats();if(id==='backup')renderInfo()}
function pageById(id){let b=[...document.querySelectorAll('nav button')].find(x=>x.getAttribute('onclick')?.includes("'"+id+"'"));page(id,b)}
function sum(r,type){return r.filter(x=>x.type===type).reduce((s,x)=>s+Number(x.amount||0),0)}
function openTx(id=null,type=null){$('modal').classList.add('show');$('modalTitle').textContent=id?'Edit Transaksi':'Tambah Transaksi';$('editId').value=id||'';$('tDate').value=localDT();$('tName').value='';$('tAmount').value='';$('tNote').value='';$('tType').value=type||'in';fillCats();if(id){let x=store.tx.find(a=>String(a.id)===String(id));if(x){$('tType').value=x.type;$('tDate').value=x.date;$('tName').value=x.name;$('tCat').value=x.cat;$('tAmount').value=x.amount;$('tNote').value=x.note||''}}}
function closeModal(){$('modal').classList.remove('show')}function fillCats(){$('tCat').innerHTML=store.cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}
function saveTx(){let name=$('tName').value.trim(),amount=Number($('tAmount').value);if(!name||amount<=0)return alert('Nama transaksi dan jumlah wajib diisi.');let id=$('editId').value||Date.now();let obj={id,type:$('tType').value,date:$('tDate').value||localDT(),name,cat:$('tCat').value,amount,note:$('tNote').value.trim()};let i=store.tx.findIndex(x=>String(x.id)===String(id));if(i>=0)store.tx[i]=obj;else store.tx.push(obj);persist();closeModal();refresh()}
function removeTx(id){if(confirm('Hapus transaksi ini?')){store.tx=store.tx.filter(x=>String(x.id)!==String(id));persist();refresh()}}
function filteredTx(){let q=($('search')?.value||'').toLowerCase(),ft=$('filterType')?.value||'',f=$('from')?.value||'',t=$('to')?.value||'';return store.tx.filter(x=>(!q||(x.name+' '+(x.note||'')+' '+x.cat).toLowerCase().includes(q))&&(!ft||x.type===ft)&&(!f||x.date.slice(0,10)>=f)&&(!t||x.date.slice(0,10)<=t)).sort((a,b)=>b.date.localeCompare(a.date))}
function renderTransactions(){let r=filteredTx();$('txTable').innerHTML=r.length?r.map(x=>`<tr><td>${esc(x.date.replace('T',' '))}</td><td><span class="badge">${x.type==='in'?'Pemasukan':'Pengeluaran'}</span></td><td><b>${esc(x.name)}</b><br><small class="muted">${esc(x.note||'')}</small></td><td>${esc(x.cat)}</td><td class="right ${x.type==='in'?'green':'red'}">${x.type==='in'?'+':'−'} ${money(x.amount)}</td><td><button class="btn" onclick="openTx(${x.id})">Edit</button> <button class="btn danger" onclick="removeTx(${x.id})">Hapus</button></td></tr>`).join(''):'<tr><td colspan="6" class="empty">Belum ada transaksi.</td></tr>'}
function renderDashboard(){let d=today(),m=d.slice(0,7),allIn=sum(store.tx,'in'),allOut=sum(store.tx,'out'),td=store.tx.filter(x=>x.date.slice(0,10)===d),mt=store.tx.filter(x=>x.date.slice(0,7)===m);$('dSaldo').textContent=money(allIn-allOut);$('dIn').textContent=money(sum(td,'in'));$('dOut').textContent=money(sum(td,'out'));$('dProfit').textContent=money(sum(td,'in')-sum(td,'out'));$('dCount').textContent=mt.length;$('dReceivable').textContent=money(store.debts.filter(x=>x.kind==='receivable'&&!x.paid).reduce((s,x)=>s+x.amount,0));$('dPayable').textContent=money(store.debts.filter(x=>x.kind==='payable'&&!x.paid).reduce((s,x)=>s+x.amount,0));$('dLowStock').textContent=store.stock.filter(x=>Number(x.qty)<=Number(x.min)).length;$('recent').innerHTML=store.tx.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).map(x=>`<div class="report"><span><b>${esc(x.name)}</b><br><small class="muted">${esc(x.date.replace('T',' '))} • ${esc(x.cat)}</small></span><b class="${x.type==='in'?'green':'red'}">${x.type==='in'?'+':'−'} ${money(x.amount)}</b></div>`).join('')||'<div class="empty">Belum ada transaksi.</div>';$('todaySummary').innerHTML=`<div class="report"><b>Pemasukan</b><span class="green">${money(sum(td,'in'))}</span></div><div class="report"><b>Pengeluaran</b><span class="red">${money(sum(td,'out'))}</span></div><div class="report"><b>Laba bersih</b><b>${money(sum(td,'in')-sum(td,'out'))}</b></div>`;drawChart()}
function drawChart(){let c=$('chart'),ctx=c.getContext('2d'),w=c.clientWidth*2,h=300;c.width=w;c.height=h;let days=[];for(let k=6;k>=0;k--){let d=new Date();d.setDate(d.getDate()-k);days.push(d.toLocaleDateString('sv-SE'))}let ins=days.map(d=>sum(store.tx.filter(x=>x.date.slice(0,10)===d),'in')),outs=days.map(d=>sum(store.tx.filter(x=>x.date.slice(0,10)===d),'out')),max=Math.max(1,...ins,...outs),p=45,gw=w-p*2,gh=h-65;ctx.clearRect(0,0,w,h);ctx.strokeStyle='#ddd';ctx.fillStyle='#555';ctx.font='22px Arial';ctx.textAlign='center';days.forEach((d,j)=>{let x=p+gw*j/6;ctx.beginPath();ctx.moveTo(x,p);ctx.lineTo(x,h-40);ctx.stroke();ctx.fillText(d.slice(5),x,h-12)});function bars(vals,off){ctx.fillStyle=off?'#d33':'#16844d';vals.forEach((v,j)=>{let x=p+gw*j/6-12+off*12,y=h-40-(v/max)*gh;ctx.fillRect(x,y,10,(v/max)*gh)})}bars(ins,0);bars(outs,1)}
function openCash(type){$('cashModal').classList.add('show');$('cashType').value=type;$('cashTitle').textContent=type==='in'?'Kas Masuk':'Kas Keluar';$('cashAmount').value='';$('cashNote').value=''}function closeCash(){$('cashModal').classList.remove('show')}function saveCash(){let amount=Number($('cashAmount').value);if(amount<=0)return alert('Jumlah wajib diisi.');let type=$('cashType').value;store.tx.push({id:Date.now(),type,date:localDT(),name:type==='in'?'Kas Masuk':'Kas Keluar',cat:type==='in'?'Kas Masuk':'Kas Keluar',amount,note:$('cashNote').value.trim()});persist();closeCash();refresh()}

function renderStock(){
  $('stockTable').innerHTML=store.stock.length?store.stock.map((x,i)=>{
    x.packQty=Number(x.packQty||1); x.min=Number(x.min||0); x.qty=Number(x.qty||0);
    let low=x.qty<=x.min;
    return `<tr>
      <td><b>${esc(x.name)}</b></td>
      <td>${x.qty} ${esc(x.unit)}</td>
      <td>${x.packQty} ${esc(x.unit)}</td>
      <td>${x.min} ${esc(x.unit)}</td>
      <td><span class="badge ${low?'stock-low':'stock-ok'}">${low?'Perlu beli':'Aman'}</span></td>
      <td>
        <button class="btn" onclick="stockInV31(${i})">+ Beli</button>
        <button class="btn" onclick="stockSOV31(${i})">SO</button>
        <button class="btn" onclick="editStockV31(${i})">✏️ Edit</button>
        <button class="btn danger" onclick="deleteStockV31(${i})">🗑 Hapus</button>
       
      </td>
    </tr>`;
  }).join(''):'<tr><td colspan="6" class="empty">Belum ada data stok.</td></tr>';
  renderPurchaseListV31();
}
function addStockV31(){
  let name=$('stockName').value.trim(),unit=$('stockUnit').value,
      pack=Number($('stockPack').value),min=Number($('stockMin').value);
  if(!name||pack<=0)return alert('Nama bahan dan isi 1 pack wajib diisi.');
  store.stock.push({id:Date.now(),name,unit,qty:0,min,packQty:pack});
  ['stockName','stockPack','stockMin'].forEach(id=>$(id).value='');
  persist();renderStock();renderDashboard();
}
function stockInV31(i){
  let x=store.stock[i], p=prompt(`Berapa pack ${x.name} yang dibeli?`,'1');
  if(p===null)return;
  p=Number(p); if(!Number.isFinite(p)||p<=0)return alert('Jumlah pack tidak valid.');
  x.qty=Number(x.qty||0)+p*Number(x.packQty||1);
  let price=prompt(`Total harga pembelian ${x.name} (opsional):`,'0');
  price=Number(price||0);
  if(price>0){
    store.tx.push({id:Date.now()+1,type:'out',date:localDT(),name:'Pembelian '+x.name,cat:'Bahan',amount:price,note:`${p} pack × ${x.packQty} ${x.unit}`});
  }
  persist();renderStock();renderDashboard();
}
function stockSOV31(i){
  let x=store.stock[i], v=prompt(`Hasil Stock Opname ${x.name} (${x.unit}):`,String(x.qty));
  if(v===null)return;
  v=Number(v); if(!Number.isFinite(v)||v<0)return alert('Jumlah SO tidak valid.');
  x.qty=v; x.lastSO=localDT(); persist(); renderStock(); renderDashboard();
}
function renderPurchaseListV31(){
  let host=$('purchaseListV31'); if(!host)return;
  let low=store.stock.filter(x=>Number(x.qty||0)<=Number(x.min||0));
  if(!low.length){host.innerHTML='<div class="empty">Semua stok masih mencukupi. ✅</div>';return;}
  host.innerHTML=low.map(x=>{
    let need=Math.max(0,Number(x.min||0)-Number(x.qty||0));
    let packs=Math.ceil(need/Number(x.packQty||1));
    return `<div class="report"><span><b>${esc(x.name)}</b><br><small class="muted">Sisa SO: ${x.qty} ${esc(x.unit)} • Minimum: ${x.min} ${esc(x.unit)}</small></span><b>${packs} pack</b></div>`;
  }).join('');
}


function editStockV31(i){
  const x=store.stock[i]; if(!x)return;
  const name=prompt("Nama bahan:",x.name); if(name===null)return;
  const unit=prompt("Satuan stok (pcs/kg/gram/liter/ml/bungkus/botol):",x.unit); if(unit===null)return;
  const pack=prompt(`Isi 1 pack (${unit}):`,String(x.packQty||1)); if(pack===null)return;
  const min=prompt(`Stok minimum (${unit}):`,String(x.min||0)); if(min===null)return;
  if(!name.trim() || Number(pack)<=0 || Number(min)<0){alert("Data tidak valid.");return;}
  x.name=name.trim(); x.unit=unit.trim()||x.unit; x.packQty=Number(pack); x.min=Number(min);
  persist(); renderStock(); renderDashboard();
}
function deleteStockV31(i){
  const x=store.stock[i]; if(!x)return;
  if(!confirm(`Hapus barang "${x.name}" dari daftar stok?\\n\\nData transaksi keuangan tidak ikut dihapus.`))return;
  store.stock.splice(i,1);
  persist(); renderStock(); renderDashboard();
}

function getReportRows(){let p=$('period').value,d=today(),r=[];if(p==='today')r=store.tx.filter(x=>x.date.slice(0,10)===d);else if(p==='week'){let s=new Date();s.setDate(s.getDate()-6);let a=s.toLocaleDateString('sv-SE');r=store.tx.filter(x=>x.date.slice(0,10)>=a&&x.date.slice(0,10)<=d)}else if(p==='month'){let m=$('reportMonth').value||d.slice(0,7);r=store.tx.filter(x=>x.date.slice(0,7)===m)}else{let f=$('reportFrom').value,t=$('reportTo').value;r=store.tx.filter(x=>(!f||x.date.slice(0,10)>=f)&&(!t||x.date.slice(0,10)<=t))}return r.sort((a,b)=>a.date.localeCompare(b.date))}
function renderReport(){let r=getReportRows(),i=sum(r,'in'),o=sum(r,'out');$('reportSummary').innerHTML=`<div class="grid"><div class="card"><small>Pemasukan</small><div class="value green">${money(i)}</div></div><div class="card"><small>Pengeluaran</small><div class="value red">${money(o)}</div></div><div class="card"><small>Laba Bersih</small><div class="value">${money(i-o)}</div></div><div class="card"><small>Transaksi</small><div class="value">${r.length}</div></div></div>`;$('reportTable').innerHTML=r.map(x=>`<tr><td>${esc(x.date.replace('T',' '))}</td><td>${x.type==='in'?'Pemasukan':'Pengeluaran'}</td><td>${esc(x.name)}</td><td>${esc(x.cat)}</td><td class="right">${money(x.amount)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">Tidak ada data pada periode ini.</td></tr>'}
function printReport(){let p=document.querySelector('.page.active');p.classList.add('printable');window.print();p.classList.remove('printable')}
function exportCSV(){let r=getReportRows(),rows=[['Tanggal','Jenis','Nama','Kategori','Jumlah','Keterangan'],...r.map(x=>[x.date,x.type==='in'?'Pemasukan':'Pengeluaran',x.name,x.cat,x.amount,x.note||''])];let csv=rows.map(a=>a.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n'),a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download='laporan-pembukuan-seblak-story-v3.1.csv';a.click()}
function renderCats(){$('cats').innerHTML=store.cats.map((c,i)=>`<div class="report"><span>${esc(c)}</span><button class="btn danger" onclick="delCat(${i})">Hapus</button></div>`).join('')}
function addCategory(){let c=$('newCat').value.trim();if(!c)return;if(store.cats.includes(c))return alert('Kategori sudah ada.');store.cats.push(c);$('newCat').value='';persist();renderCats();fillCats()}function delCat(i){if(store.cats.length<=1)return alert('Minimal satu kategori.');if(confirm('Hapus kategori ini? Transaksi lama tetap aman.')){store.cats.splice(i,1);persist();renderCats();fillCats()}}
function backup(){let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(store,null,2)],{type:'application/json'}));a.download='backup-pembukuan-seblak-story-v3.1.json';a.click()}
function restore(e){let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{let x=JSON.parse(r.result);if(!x||!Array.isArray(x.tx))throw 0;store=normalize(x);persist();refresh();alert('Restore berhasil.')}catch(_){alert('File backup tidak valid.')}};r.readAsText(f)}
function clearAll(){if(confirm('SEMUA data transaksi, stok, dan kategori akan dihapus. Lanjutkan?')){localStorage.removeItem(KEY);store=normalize({...emptyStore});refresh()}}
function renderInfo(){$('dataInfo').innerHTML=`<b>${store.tx.length}</b> transaksi<br><b>${store.stock.length}</b> bahan stok<br><b>${store.debts.length}</b> data hutang/piutang<br><small>Versi aplikasi: V3.1.1 • Data lokal perangkat.</small>`}
function refresh(){renderDashboard();renderTransactions();renderStock();renderReport();renderCats();renderInfo()}
$('reportMonth').value=today().slice(0,7);refresh();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
