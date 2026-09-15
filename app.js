const KEY="seblak_story_v314";
const STOCK_KEY="seblak_story_stock_v314";
let store=JSON.parse(localStorage.getItem(KEY)||"null")||{tx:[]};
let stocks=JSON.parse(localStorage.getItem(STOCK_KEY)||"[]");
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n)||0);
const today=()=>new Date().toISOString().slice(0,10);
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
function page(id,btn){document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));$(id).classList.add("active");document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));btn.classList.add("active");if(id==="dashboard")renderDashboard();if(id==="transaksi")renderTransactions();if(id==="stok")renderStock();if(id==="laporan")renderReport();if(id==="kategori")renderCats();if(id==="backup")renderInfo()}
function openTx(id=null){$("modal").classList.add("show");$("modalTitle").textContent=id?"Edit Transaksi":"Tambah Transaksi";$("editId").value=id||"";$("tDate").value=localDT();$("tName").value="";$("tAmount").value="";$("tNote").value="";$("tType").value="in";if(id){let x=store.tx.find(a=>a.id==id);if(x){$("tType").value=x.type;$("tDate").value=x.date;$("tName").value=x.name;$("tAmount").value=x.amount;$("tNote").value=x.note||""}}}
function closeModal(){$("modal").classList.remove("show")}
function saveTx(){let name=$("tName").value.trim(),amount=Number($("tAmount").value),id=$("editId").value;if(!name||amount<=0)return appAlert("Nama transaksi dan jumlah wajib diisi.","Data belum lengkap");let x={id:id?Number(id):Date.now(),type:$("tType").value,date:$("tDate").value||localDT(),name,amount,note:$("tNote").value.trim()};if(id)store.tx=store.tx.map(a=>a.id==id?x:a);else store.tx.push(x);persist();closeModal();refresh()}
function sum(a,t){return a.filter(x=>x.type===t).reduce((s,x)=>s+Number(x.amount||0),0)}
function renderDashboard(){let d=today(),m=d.slice(0,7),td=store.tx.filter(x=>x.date.slice(0,10)===d),mo=store.tx.filter(x=>x.date.slice(0,7)===m);$("dSaldo").textContent=money(sum(store.tx,"in")-sum(store.tx,"out"));$("dIn").textContent=money(sum(td,"in"));$("dOut").textContent=money(sum(td,"out"));$("dCount").textContent=mo.length;$("recent").innerHTML=store.tx.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).map(x=>`<div class="buyrow"><span><b>${esc(x.name)}</b><div class="buyinfo">${esc(x.date.replace("T"," "))}</div></span><b class="${x.type==="in"?"green":"red"}">${x.type==="in"?"+":"−"} ${money(x.amount)}</b></div>`).join("")||'<div class="empty">Belum ada transaksi.</div>'}
function renderTransactions(){let q=($("search").value||"").toLowerCase(),ft=$("filterType").value,from=$("from").value,to=$("to").value;let r=store.tx.filter(x=>(!q||(x.name+" "+(x.note||"")).toLowerCase().includes(q))&&(!ft||x.type===ft)&&(!from||x.date.slice(0,10)>=from)&&(!to||x.date.slice(0,10)<=to)).sort((a,b)=>b.date.localeCompare(a.date));$("txTable").innerHTML=r.map(x=>`<tr><td>${esc(x.date.replace("T"," "))}</td><td>${x.type==="in"?"Pemasukan":"Pengeluaran"}</td><td>${esc(x.name)}</td><td>${esc("")}</td><td>${money(x.amount)}</td><td><button class="actionBtn editdel" onclick="openTx(${x.id})">✏️ Edit</button> <button class="actionBtn danger" onclick="removeTx(${x.id})">🗑 Hapus</button></td></tr>`).join("")||'<tr><td colspan="6" class="empty">Belum ada transaksi.</td></tr>'}
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
function saveBuy(){let id=Number($("buyId").value),packs=Number($("buyPack").value),price=Number($("buyPrice").value),x=stocks.find(a=>a.id===id);if(!x||packs<=0)return appAlert("Jumlah pack harus lebih dari 0.","Data tidak valid");if(price<=0)return appAlert("Harga per pack wajib diisi.","Data belum lengkap");let total=packs*price;x.qty+=packs*x.pack;let cat=store.cats.includes("Bahan Baku")?"Bahan Baku":(store.cats[0]||"Lainnya");store.tx.push({id:Date.now(),type:"out",date:localDT(),name:`Pembelian stok - ${x.name}`,cat,amount:total,note:`${packs} pack × ${money(price)} per pack`});persist();closeBuy();renderStock();renderDashboard();renderTransactions();renderReport();appAlert(`Pembelian tersimpan. Total ${money(total)} masuk ke Pengeluaran Hari Ini.`,"Pembelian tersimpan")}
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
);}

function renderInfo(){$("dataInfo").innerHTML=`<b>${store.tx.length}</b> transaksi<br><b>${stocks.length}</b> barang stok<br><small>Data tersimpan di browser/perangkat ini.</small>`}
function refresh(){renderDashboard();renderTransactions();renderStock();renderReport();renderCats();renderInfo()}
$("reportMonth").value=today().slice(0,7);refresh();
