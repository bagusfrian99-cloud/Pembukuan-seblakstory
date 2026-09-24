const CACHE="seblak-story-pwa-v3.3.85";
const ASSETS=["./","./index.html","./style.css","./app.js?v=3.3.85","./manifest.json","./icon.svg"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const url=new URL(e.request.url);
  if(url.pathname.endsWith("/sw.js")||url.pathname.endsWith("/index.html")||url.pathname.endsWith("/app.js")){
    e.respondWith(fetch(e.request,{cache:"no-store"}).then(r=>{if(url.pathname.endsWith("/index.html")||url.pathname.endsWith("/app.js")){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return r}).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>cached)));
})
