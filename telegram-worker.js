/**
 * Seblak Story Telegram -> GitHub bridge
 * Deploy as a Cloudflare Worker.
 * Secrets required:
 * TELEGRAM_BOT_TOKEN
 * TELEGRAM_WEBHOOK_SECRET
 * GITHUB_TOKEN (fine-grained, Contents: Read and write)
 * GITHUB_OWNER
 * GITHUB_REPO
 * GITHUB_BRANCH (optional, default main)
 * GITHUB_PATH (optional, default telegram/inbox.json)
 */
const enc = new TextEncoder();
function b64utf8(s){
  const bytes=enc.encode(s); let out="";
  for(let i=0;i<bytes.length;i+=0x8000) out+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(out);
}
function ghHeaders(env){return {"Accept":"application/vnd.github+json","Authorization":`Bearer ${env.GITHUB_TOKEN}`,"X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"};}
function ghUrl(env){
  const owner=encodeURIComponent(env.GITHUB_OWNER), repo=encodeURIComponent(env.GITHUB_REPO);
  const path=(env.GITHUB_PATH||"telegram/inbox.json").split("/").map(encodeURIComponent).join("/");
  return `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
}
async function readInbox(env){
  const r=await fetch(ghUrl(env)+`?ref=${encodeURIComponent(env.GITHUB_BRANCH||"main")}`,{headers:ghHeaders(env)});
  if(r.status===404)return {items:[],sha:null};
  if(!r.ok)throw new Error(`GitHub GET ${r.status}: ${await r.text()}`);
  const x=await r.json();
  const raw=atob((x.content||"").replace(/\n/g,""));
  const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  const text=new TextDecoder().decode(bytes);
  let data=JSON.parse(text); if(!Array.isArray(data))data=data.items||[];
  return {items:Array.isArray(data)?data:[],sha:x.sha};
}
async function writeInbox(env,items,sha){
  const body={message:`Telegram shift inbox update ${new Date().toISOString()}`,content:b64utf8(JSON.stringify(items,null,2)),branch:env.GITHUB_BRANCH||"main"};
  if(sha)body.sha=sha;
  const r=await fetch(ghUrl(env),{method:"PUT",headers:ghHeaders(env),body:JSON.stringify(body)});
  if(r.ok)return await r.json();
  throw new Error(`GitHub PUT ${r.status}: ${await r.text()}`);
}
async function upsert(env,item){
  for(let attempt=0;attempt<4;attempt++){
    const {items,sha}=await readInbox(env);
    const key=String(item.messageId||item.id||`${item.chatId||"chat"}-${item.date||Date.now()}`);
    const existing=items.findIndex(x=>String(x.messageId||x.id||"")===key);
    if(existing>=0)items[existing]={...items[existing],...item,receivedAt:new Date().toISOString()};
    else items.push(item);
    const trimmed=items.slice(-1000);
    try{return await writeInbox(env,trimmed,sha);}catch(e){if(/409|sha|does not match/i.test(String(e)))continue;throw e;}
  }
  throw new Error("GitHub SHA berubah terus; coba lagi.");
}
export default {async fetch(request,env){
  const url=new URL(request.url);
  if(request.method==="GET")return new Response("Seblak Story Telegram Bridge OK",{status:200});
  if(request.method!=="POST")return new Response("Method Not Allowed",{status:405});
  if(env.TELEGRAM_WEBHOOK_SECRET && request.headers.get("X-Telegram-Bot-Api-Secret-Token")!==env.TELEGRAM_WEBHOOK_SECRET)
    return new Response("Unauthorized",{status:401});
  try{
    const update=await request.json();
    const m=update.message||update.edited_message||update.channel_post||update.edited_channel_post;
    if(!m)return Response.json({ok:true,ignored:true});
    const text=m.text||m.caption||"";
    if(!text.trim())return Response.json({ok:true,ignored:true});
    await upsert(env,{id:String(m.message_id),messageId:String(m.message_id),chatId:String(m.chat?.id||""),chatTitle:m.chat?.title||m.chat?.first_name||"",from:m.from?.first_name||"",text,telegramDate:m.date?new Date(m.date*1000).toISOString():null,receivedAt:new Date().toISOString(),processed:false});
    return Response.json({ok:true});
  }catch(e){return Response.json({ok:false,error:String(e?.message||e)},{status:500});}
}};


(function(){
  function esc(v){return String(v??'').replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
  function getSOItems(){
    const roots=[...document.querySelectorAll('[id*="so" i],[class*="so" i]')];
    let root=roots.find(x=>/Stok Opname|SO\b/i.test(x.innerText||'')) || document.body;
    const rows=[...root.querySelectorAll('tr')].filter(r=>r.innerText.trim());
    let items=[];
    if(rows.length){
      rows.forEach(r=>{
        const c=[...r.querySelectorAll('th,td')].map(x=>x.innerText.trim()).filter(Boolean);
        if(c.length>=2 && !/nama|barang|stok/i.test(c.join(' ')) && !/simpan|cetak/i.test(c.join(' '))){
          items.push({name:c[0],stock:c[1]});
        }
      });
    }
    if(!items.length){
      const cards=[...root.querySelectorAll('[class*="item" i],[class*="row" i],[class*="card" i]')];
      cards.forEach(c=>{
        const t=(c.innerText||'').trim().split(/\n+/).map(x=>x.trim()).filter(Boolean);
        if(t.length>=2 && !/cetak|simpan opname/i.test(t.join(' '))){
          const n=t.find(x=>!/(stok|sistem|fisik|hasil|selisih|pack|pcs|\d)/i.test(x));
          const st=t.find(x=>/(stok|hasil)/i.test(x)) || t.find(x=>/^\d+(\s|$)/.test(x));
          if(n && st) items.push({name:n,stock:st});
        }
      });
    }
    // Last fallback: parse rows from common table-like elements.
    if(!items.length){
      [...document.querySelectorAll('table tr')].forEach(r=>{
        const c=[...r.children].map(x=>x.innerText.trim()).filter(Boolean);
        if(c.length>=2 && !/nama|barang/i.test(c[0])) items.push({name:c[0],stock:c[1]});
      });
    }
    return items;
  }
  function printSO(){
    const items=getSOItems();
    const rows=items.map((x,i)=>`<tr><td>${esc(x.name)}</td><td>${esc(x.stock)}</td></tr>`).join('');
    const w=window.open('','_blank','width=420,height=700');
    if(!w){alert('Izinkan pop-up untuk mencetak.');return;}
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Cetak SO</title>
<style>
@page{size:80mm auto;margin:3mm}
*{box-sizing:border-box}
body{width:74mm;margin:0;font-family:Arial,sans-serif;font-size:12px;color:#000}
h2{text-align:center;font-size:15px;margin:0 0 2mm}
.meta{text-align:center;font-size:10px;margin-bottom:3mm}
table{width:100%;border-collapse:collapse}
th,td{padding:1.5mm 0;border-bottom:1px dashed #000}
th{text-align:left;font-size:11px}
td:last-child,th:last-child{text-align:right}
</style></head><body>
<h2>STOK OPNAME</h2><div class="meta">Seblak Story</div>
<table><thead><tr><th>Nama Barang</th><th>Stok</th></tr></thead><tbody>${rows || '<tr><td colspan="2">Tidak ada data</td></tr>'}</tbody></table>
<script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script>
</body></html>`);
    w.document.close();
  }
  document.addEventListener('click',function(e){
    const b=e.target.closest('#soPrintButton');
    if(b) printSO();
  });
})();
