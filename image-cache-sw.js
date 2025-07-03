// 🚀 이미지 캐싱 Service Worker
const CACHE_NAME = 'felicity-images-v1';
const MAX_CACHE_SIZE = 100; // 최대 100개 이미지 캐시

// 캐시할 이미지 패턴
const IMAGE_PATTERNS = [
  /firebasestorage\.googleapis\.com.*\.(jpg|jpeg|png|gif|webp|svg)$/i,
  /assets\/.*\.(jpg|jpeg|png|gif|webp|svg)$/i
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
  console.log('🚀 Image Cache Service Worker 설치됨');
  self.skipWaiting();
});

// Activate 이벤트
self.addEventListener('activate', (event) => {
  console.log('🚀 Image Cache Service Worker 활성화됨');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ 오래된 캐시 삭제:', cacheName);
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
  
  // 이미지 요청만 처리
  if (!isImageRequest(request)) {
    return;
  }
  
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 캐시에서 먼저 확인
      const cachedResponse = await cache.match(request);
      
      if (cachedResponse) {
        console.log('📦 캐시에서 이미지 로드:', request.url);
        return cachedResponse;
      }
      
      try {
        // 네트워크에서 가져오기
        console.log('🌐 네트워크에서 이미지 로드:', request.url);
        const response = await fetch(request);
        
        if (response.ok) {
          // 캐시에 저장
          const responseToCache = response.clone();
          cache.put(request, addOptimizationHeaders(responseToCache));
          
          // 캐시 크기 관리
          manageCacheSize();
          
          return addOptimizationHeaders(response);
        }
        
        return response;
        
      } catch (error) {
        console.error('❌ 이미지 로드 실패:', error);
        
        // 기본 이미지 반환
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
        console.log('🗑️ 이미지 캐시 모두 삭제됨');
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
  console.error('❌ Service Worker 에러:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Service Worker 처리되지 않은 Promise 거부:', event.reason);
}); 