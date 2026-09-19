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
