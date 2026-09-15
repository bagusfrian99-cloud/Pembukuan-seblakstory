const CACHE="seblak-story-pwa-v3.1.9";
const CORE=["./","./index.html","./style.css","./app.js","./manifest.json","./icon.svg"];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(CORE))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

// Untuk file aplikasi, selalu cek versi terbaru di server terlebih dahulu.
// Jika offline, gunakan cache agar aplikasi tetap bisa dipakai.
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;

  const url=new URL(event.request.url);
  const sameOrigin=url.origin===self.location.origin;
  const isAppFile=sameOrigin && ["document","script","style"].includes(event.request.destination);

  if(isAppFile){
    event.respondWith(
      fetch(event.request, {cache:"no-store"})
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
          return response;
        })
        .catch(()=>caches.match(event.request).then(r=>r || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cached=>cached || fetch(event.request).then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
        return response;
      }))
      .catch(()=>caches.match("./index.html"))
  );
});
