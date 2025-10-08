const CACHE_NAME = 'onbit-pwa-v1';
const OFFLINE_URLS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/index.css',
  '/assets/lightlogo.png',
  '/onbit/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS)).then(()=> self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys)=> Promise.all(keys.map(k=> k===CACHE_NAME? null : caches.delete(k)))).then(()=> self.clients.claim())
  );
});

// 네비게이션 요청은 네트워크 우선, 실패 시 캐시 폴백
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const isNavigate = req.mode === 'navigate' || (req.headers.get('accept')||'').includes('text/html');
  if (isNavigate){
    event.respondWith(
      fetch(req).catch(()=> caches.match('/index.html'))
    );
    return;
  }
  event.respondWith(
    caches.match(req).then((cached)=> cached || fetch(req).then((res)=>{
      try {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c)=> c.put(req, copy)).catch(()=>{});
      } catch(_) {}
      return res;
    }).catch(()=> cached))
  );
});


