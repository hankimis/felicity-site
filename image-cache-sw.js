// 🚀 이미지 캐싱 Service Worker
const CACHE_NAME = 'felicity-images-v1';
const MAX_CACHE_SIZE = 100; // 최대 100개 이미지 캐시

// 캐시할 이미지 패턴
const IMAGE_PATTERNS = [
  /firebasestorage\.googleapis\.com.*\.(jpg|jpeg|png|gif|webp|svg)$/i,
  /assets\/.*\.(jpg|jpeg|png|gif|webp|svg)$/i,
  /\/api\/icon\//i
];

// 이미지 요청인지 확인
function isImageRequest(request) {
  return IMAGE_PATTERNS.some(pattern => pattern.test(request.url));
}

// 캐시 크기 관리
async function manageCacheSize() {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  
  if (keys.length > MAX_CACHE_SIZE) {
    // 오래된 항목부터 삭제
    const keysToDelete = keys.slice(0, keys.length - MAX_CACHE_SIZE);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
  }
}

// 이미지 최적화 헤더 추가
function addOptimizationHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Vary', 'Accept');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
}

// Install 이벤트
self.addEventListener('install', (event) => {
  self.skipWaiting();
  // PWA 기본 자원 프리캐시
  const PWA_CACHE = 'onbit-pwa-v1';
  const PWA_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/index.css',
    '/components/header/header.html'
  ];
  event.waitUntil(caches.open(PWA_CACHE).then((cache)=> cache.addAll(PWA_ASSETS)).catch(()=>{}));
});

// Activate 이벤트
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && !/^onbit-pwa-/.test(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch 이벤트 - 이미지 캐싱 전략
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // PWA 기본 페이지: 네트워크 우선, 실패 시 캐시
  if (request.method === 'GET' && url.origin === location.origin && (url.pathname === '/' || url.pathname.endsWith('.html') || url.pathname === '/components/header/header.html')){
    event.respondWith(
      fetch(request).then((res)=>{
        try { const copy = res.clone(); caches.open('onbit-pwa-v1').then((c)=> c.put(request, copy)).catch(()=>{}); } catch(_) {}
        return res;
      }).catch(()=> caches.match(request))
    );
    return;
  }

  // 이미지 요청 캐시 전략 유지
  if (!isImageRequest(request)) {
    return;
  }
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
      try {
        const response = await fetch(request);
        if (response.ok) {
          const responseToCache = response.clone();
          cache.put(request, addOptimizationHeaders(responseToCache));
          manageCacheSize();
          return addOptimizationHeaders(response);
        }
        return response;
      } catch (error) {
        return caches.match('/assets/default-event-image.svg');
      }
    })
  );
});

// 메시지 이벤트 - 캐시 관리
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_IMAGE_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }
  
  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        const keys = await cache.keys();
        event.ports[0].postMessage({ size: keys.length });
      })
    );
  }
});

// 에러 처리
self.addEventListener('error', (event) => {
});

self.addEventListener('unhandledrejection', (event) => {
}); 