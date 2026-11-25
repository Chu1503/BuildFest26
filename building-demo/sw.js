// Offline support for the installed GoGo web app.
// Everything the navigator needs is cached on first visit, so routes work with no signal.
// Bump VERSION whenever a cached file changes; old caches are deleted on activation.
const VERSION='gogo-v1';
const CORE=[
 './','index.html','product.html','about.html','contact.html','privacy.html','404.html',
 'manifest.webmanifest','favicon.svg','icons/apple-touch-icon.png','icons/icon-192.png','icons/icon-512.png',
 'theme.js','theme.css','style.css','site.css','site.js','app.js',
 'routing.js','active-building.js','building.js','catalog-data.js','waypoint-data.js','campus.js',
 'viewer.js','amenities.js','place-search.js','nav-guide.js',
 'vendor/three.module.js','vendor/three.core.js','vendor/leaflet/leaflet.css','vendor/leaflet/leaflet.js'
];

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET')return;
 // Map tiles and other sites go straight to the network (fonts are cached once fetched).
 if(url.origin!==location.origin){
  if(url.hostname.endsWith('fonts.googleapis.com')||url.hostname.endsWith('fonts.gstatic.com'))event.respondWith(staleWhileRevalidate(request));
  return;
 }
 if(url.pathname.endsWith('.apk'))return;
 // Our own files: network first so a new release never mixes with old cached scripts;
 // the cached copy is used only when offline. The browser's HTTP cache keeps this fast.
 event.respondWith(fetch(request).then(response=>{
  if(response.ok)refresh(request,response.clone());
  return response;
 }).catch(()=>caches.match(request,{ignoreSearch:true}).then(hit=>hit||(request.mode==='navigate'?caches.match('index.html'):Response.error()))));
});

// Store a fresh copy only when it differs from the cached one (avoids rewriting the 6 MB map data each visit).
function refresh(request,response){
 caches.open(VERSION).then(cache=>cache.match(request).then(old=>{
  const tag=r=>r&&(r.headers.get('etag')||r.headers.get('last-modified'));
  if(!old||!tag(response)||tag(old)!==tag(response))cache.put(request,response);
 }));
}
function staleWhileRevalidate(request){
 return caches.open(VERSION).then(cache=>cache.match(request,{ignoreSearch:true}).then(hit=>{
  const network=fetch(request).then(response=>{if(response.ok||response.type==='opaque')cache.put(request,response.clone());return response;}).catch(()=>hit);
  return hit||network;
 }));
}
