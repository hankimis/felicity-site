import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { firebaseConfig } from '../firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const eventList = document.getElementById('event-list');
const writeBtn = document.getElementById('write-event-btn');
const eventModal = document.getElementById('event-modal');
const closeEventModal = document.getElementById('close-event-modal');
const eventForm = document.getElementById('event-form');

// 이미지/로고 미리보기 및 유효성 안내
const eventImgInput = document.getElementById('event-img');
const eventImgFile = document.getElementById('event-img-file');
const eventImgUrl = document.getElementById('event-img-url');
const uploadImageBtn = document.getElementById('upload-image-btn');
const removeImageBtn = document.getElementById('remove-image-btn');
const toggleUrlBtn = document.getElementById('toggle-url-input');
const urlInputContainer = document.getElementById('url-input-container');
const uploadProgress = document.getElementById('upload-progress');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const exchangeSelect = document.getElementById('event-exchange');
const exchangePreview = document.getElementById('exchange-preview');
const exchangePreviewLogo = document.getElementById('exchange-preview-logo');
const exchangePreviewName = document.getElementById('exchange-preview-name');
const customExchangeGroup = document.getElementById('custom-exchange-group');
const customLogoGroup = document.getElementById('custom-logo-group');
const customExchangeName = document.getElementById('custom-exchange-name');
const customLogoUrl = document.getElementById('custom-logo-url');
const previewEventImg = document.getElementById('preview-event-img');
const eventFormMessage = document.getElementById('event-form-message');

let currentUser = null;
let isAdmin = false;
let currentImageFile = null;
let currentImageUrl = null;
let uploadTask = null;
let adminAuthManager = null;

// 🔒 AdminAuthManager 초기화 및 인증 상태 감지
async function initializeAdminAuth() {
  // 전역 인스턴스 import
  const { default: authManager } = await import('../js/admin-auth-manager.js');
  adminAuthManager = authManager;
  
  // 어드민 상태 변경 감지 (올바른 메서드명과 매개변수 사용)
  adminAuthManager.onAuthStateChange((user, isAdminStatus) => {
    currentUser = user;
    isAdmin = isAdminStatus;
    
    // UI 업데이트
    writeBtn.style.display = isAdmin ? 'inline-block' : 'none';
    
    // 🔒 작성 버튼에 보안 스타일 적용
    if (isAdmin && writeBtn) {
      writeBtn.className = 'floating-write-btn admin-btn';
      writeBtn.innerHTML = '<i class="fas fa-shield-alt"></i> 보안 이벤트 작성';
    }
    
    renderEvents();
    
    // 🔒 보안 상태 UI 업데이트
    updateSecurityStatusUI(user, isAdminStatus);
    
    // 디버그 정보 출력
    if (user) {
      console.log('🔐 이벤트 게시판 어드민 인증 상태:', {
        user: user.email,
        isAdmin: isAdminStatus,
        timestamp: new Date().toISOString()
      });
    }
  });
}

// 🔒 보안 상태 UI 업데이트 함수
function updateSecurityStatusUI(user, isAdminStatus) {
  // 기존 보안 상태 표시 제거
  const existingSecurityInfo = document.querySelector('.admin-security-info');
  if (existingSecurityInfo) {
    existingSecurityInfo.remove();
  }
  
  // 관리자인 경우 보안 상태 표시
  if (isAdminStatus && user) {
    const securityInfo = document.createElement('div');
    securityInfo.className = 'admin-security-info';
    securityInfo.innerHTML = `
      <i class="fas fa-shield-alt"></i>
      <span>관리자 인증됨 - ${user.email}</span>
    `;
    
    // 이벤트 보드 컨테이너 상단에 추가
    const eventBoardContainer = document.querySelector('.event-board-container');
    if (eventBoardContainer) {
      eventBoardContainer.insertBefore(securityInfo, eventBoardContainer.firstChild);
    }
  }
}

// 페이지 로드 시 어드민 인증 초기화
document.addEventListener('DOMContentLoaded', () => {
  initializeAdminAuth();
});

// 🚀 이미지 최적화 유틸리티 함수들
class ImageOptimizer {
  constructor() {
    this.imageCache = new Map();
    this.loadingImages = new Set();
    this.observer = null;
    this.initLazyLoading();
  }

  // Lazy Loading 초기화
  initLazyLoading() {
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadImage(entry.target);
            this.observer.unobserve(entry.target);
          }
        });
      }, {
        rootMargin: '50px 0px',
        threshold: 0.1
      });
    }
  }

  // WebP 지원 확인
  supportsWebP() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }

  // 이미지 URL 최적화 (Firebase Storage용)
  optimizeImageUrl(url, width = 400, height = 400) {
    if (!url || !url.includes('firebase')) return url;
    
    try {
      // Firebase Storage 이미지 변환 파라미터 추가
      const urlObj = new URL(url);
      urlObj.searchParams.set('alt', 'media');
      
      // WebP 지원 시 변환 요청
      if (this.supportsWebP()) {
        urlObj.searchParams.set('format', 'webp');
      }
      
      // 리사이징 파라미터 (Firebase Storage Transform API)
      urlObj.searchParams.set('w', width.toString());
      urlObj.searchParams.set('h', height.toString());
      urlObj.searchParams.set('fit', 'cover');
      urlObj.searchParams.set('q', '85'); // 품질 85%
      
      return urlObj.toString();
    } catch (error) {
      console.warn('이미지 URL 최적화 실패:', error);
      return url;
    }
  }

  // 이미지 압축 (업로드 시)
  async compressImage(file, maxWidth = 800, maxHeight = 600, quality = 0.8) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // 비율 유지하면서 크기 조정
        const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
        const newWidth = img.width * ratio;
        const newHeight = img.height * ratio;
        
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        // 이미지 그리기
        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        
        // WebP 지원 시 WebP로 변환, 아니면 JPEG
        const mimeType = this.supportsWebP() ? 'image/webp' : 'image/jpeg';
        canvas.toBlob(resolve, mimeType, quality);
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

  // Progressive 이미지 로딩 (성능 모니터링 추가)
  async loadImage(imgElement) {
    const src = imgElement.dataset.src;
    if (!src || this.loadingImages.has(src)) return;
    
    this.loadingImages.add(src);
    performanceMonitor.startLoading(src);
    imageDebugger.logImageEvent('로딩 시작', src);
    
    try {
      // 캐시 확인
      if (this.imageCache.has(src)) {
        imgElement.src = this.imageCache.get(src);
        imgElement.classList.add('loaded');
        performanceMonitor.finishLoading(src, true);
        imageDebugger.logImageEvent('캐시 히트', src);
        return;
      }
      
      // 로딩 상태 표시
      imgElement.classList.add('loading');
      
      // 이미지 미리 로드
      const img = new Image();
      img.onload = () => {
        // 캐시에 저장
        this.imageCache.set(src, src);
        
        // 실제 이미지 적용
        imgElement.src = src;
        imgElement.classList.remove('loading');
        imgElement.classList.add('loaded');
        
        this.loadingImages.delete(src);
        performanceMonitor.finishLoading(src, false);
        imageDebugger.logImageEvent('로딩 완료', src);
      };
      
              img.onerror = () => {
          // 에러 시 기본 이미지 표시
          imgElement.src = '../assets/default-event-image.svg';
          imgElement.classList.remove('loading');
          imgElement.classList.add('error');
        this.loadingImages.delete(src);
        performanceMonitor.failLoading(src);
        imageDebugger.logImageEvent('로딩 실패', src);
      };
      
      img.src = src;
      
    } catch (error) {
      console.error('이미지 로딩 실패:', error);
      imgElement.classList.remove('loading');
      imgElement.classList.add('error');
      this.loadingImages.delete(src);
      performanceMonitor.failLoading(src);
      imageDebugger.logImageEvent('로딩 에러', src, { error: error.message });
    }
  }

  // Lazy Loading 관찰 시작
  observe(imgElement) {
    if (this.observer) {
      this.observer.observe(imgElement);
    } else {
      // IntersectionObserver 미지원 시 즉시 로드
      this.loadImage(imgElement);
    }
  }

  // 메모리 정리
  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.imageCache.clear();
    this.loadingImages.clear();
  }
}

// 이미지 최적화 인스턴스 생성
const imageOptimizer = new ImageOptimizer();

// 🚀 이미지 성능 모니터링 클래스
class ImagePerformanceMonitor {
  constructor() {
    this.metrics = {
      totalImages: 0,
      loadedImages: 0,
      failedImages: 0,
      cacheHits: 0,
      totalLoadTime: 0,
      averageLoadTime: 0
    };
    this.loadStartTimes = new Map();
  }

  // 로딩 시작 기록
  startLoading(url) {
    this.loadStartTimes.set(url, performance.now());
    this.metrics.totalImages++;
  }

  // 로딩 완료 기록
  finishLoading(url, fromCache = false) {
    const startTime = this.loadStartTimes.get(url);
    if (startTime) {
      const loadTime = performance.now() - startTime;
      this.metrics.totalLoadTime += loadTime;
      this.metrics.loadedImages++;
      
      if (fromCache) {
        this.metrics.cacheHits++;
      }
      
      this.metrics.averageLoadTime = this.metrics.totalLoadTime / this.metrics.loadedImages;
      this.loadStartTimes.delete(url);
      
      if (imageDebugger.debugMode) {
        console.log(`📊 이미지 로딩 완료: ${url.split('/').pop()} (${loadTime.toFixed(2)}ms, 캐시: ${fromCache})`);
      }
    }
  }

  // 로딩 실패 기록
  failLoading(url) {
    this.metrics.failedImages++;
    this.loadStartTimes.delete(url);
    if (imageDebugger.debugMode) {
      console.warn(`❌ 이미지 로딩 실패: ${url}`);
    }
  }

  // 성능 리포트 출력
  getReport() {
    const report = {
      ...this.metrics,
      cacheHitRate: this.metrics.totalImages > 0 ? (this.metrics.cacheHits / this.metrics.totalImages * 100).toFixed(1) : '0',
      successRate: this.metrics.totalImages > 0 ? (this.metrics.loadedImages / this.metrics.totalImages * 100).toFixed(1) : '0'
    };
    
    console.table(report);
    return report;
  }

  // 성능 최적화 제안
  getSuggestions() {
    const suggestions = [];
    
    if (this.metrics.averageLoadTime > 1000) {
      suggestions.push('⚡ 이미지 크기를 줄이거나 WebP 형식 사용을 고려하세요');
    }
    
    if (this.metrics.cacheHits / this.metrics.totalImages < 0.3) {
      suggestions.push('💾 캐시 전략을 개선하세요');
    }
    
    if (this.metrics.failedImages > 0) {
      suggestions.push('🔧 실패한 이미지들의 URL을 확인하세요');
    }
    
    return suggestions;
  }
}

// 성능 모니터 인스턴스 생성
const performanceMonitor = new ImagePerformanceMonitor();

// 🚀 이미지 최적화 디버깅 도구
class ImageDebugger {
  constructor() {
    this.debugMode = localStorage.getItem('felicity-image-debug') === 'true';
    this.createDebugPanel();
  }

  // 디버그 패널 생성
  createDebugPanel() {
    if (!this.debugMode) return;
    
    const panel = document.createElement('div');
    panel.id = 'image-debug-panel';
    panel.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0,0,0,0.9);
      color: white;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    panel.innerHTML = `
      <h4 style="margin: 0 0 10px 0;">🚀 이미지 성능 디버거</h4>
      <div id="debug-stats"></div>
      <div style="margin-top: 10px;">
        <button id="clear-cache-btn" style="padding: 5px 10px; margin-right: 5px;">캐시 삭제</button>
        <button id="toggle-debug-btn" style="padding: 5px 10px;">디버그 끄기</button>
      </div>
    `;
    
    document.body.appendChild(panel);
    
    // 이벤트 리스너
    document.getElementById('clear-cache-btn').addEventListener('click', this.clearCache.bind(this));
    document.getElementById('toggle-debug-btn').addEventListener('click', this.toggleDebug.bind(this));
    
    // 주기적으로 업데이트
    setInterval(() => this.updateStats(), 1000);
  }

  // 통계 업데이트
  updateStats() {
    const statsElement = document.getElementById('debug-stats');
    if (!statsElement) return;
    
    const report = performanceMonitor.getReport();
    const suggestions = performanceMonitor.getSuggestions();
    
    statsElement.innerHTML = `
      <div>총 이미지: ${report.totalImages}</div>
      <div>로딩 완료: ${report.loadedImages}</div>
      <div>실패: ${report.failedImages}</div>
      <div>캐시 히트율: ${report.cacheHitRate}%</div>
      <div>성공률: ${report.successRate}%</div>
      <div>평균 로딩 시간: ${report.averageLoadTime.toFixed(0)}ms</div>
      ${suggestions.length > 0 ? `<div style="margin-top: 10px; color: #ffa726;">${suggestions.join('<br>')}</div>` : ''}
    `;
  }

  // 캐시 삭제
  async clearCache() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        if (event.data.success) {
          alert('이미지 캐시가 삭제되었습니다.');
          location.reload();
        }
      };
      
      navigator.serviceWorker.controller.postMessage(
        { type: 'CLEAR_IMAGE_CACHE' },
        [messageChannel.port2]
      );
    }
  }

  // 디버그 모드 토글
  toggleDebug() {
    this.debugMode = !this.debugMode;
    localStorage.setItem('felicity-image-debug', this.debugMode.toString());
    location.reload();
  }

  // 이미지 로딩 이벤트 로깅
  logImageEvent(event, url, details = {}) {
    if (!this.debugMode) return;
    
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] 🖼️ ${event}: ${url.split('/').pop()}`, details);
  }
}

// 디버거 인스턴스 생성
const imageDebugger = new ImageDebugger();

// 기존 ImageOptimizer 클래스의 loadImage 메서드를 성능 모니터링으로 업데이트

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
  imageOptimizer.cleanup();
  
  // 성능 리포트 출력 (디버그 모드에서만)
  if (imageDebugger.debugMode && performanceMonitor.metrics.totalImages > 0) {
    console.log('📊 최종 이미지 성능 리포트:');
    performanceMonitor.getReport();
    
    const suggestions = performanceMonitor.getSuggestions();
    if (suggestions.length > 0) {
      console.log('💡 성능 최적화 제안:');
      suggestions.forEach(suggestion => console.log(suggestion));
    }
  }
});

// 🚀 디버그 모드 활성화 단축키 (Ctrl+Shift+I)
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'I') {
    e.preventDefault();
    const currentMode = localStorage.getItem('felicity-image-debug') === 'true';
    localStorage.setItem('felicity-image-debug', (!currentMode).toString());
    location.reload();
  }
});

async function renderEvents() {
  eventList.innerHTML = '';
  const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const card = document.createElement('div');
    card.className = 'event-card';
    
    // 🚀 이미지 URL 최적화
    const optimizedImgUrl = imageOptimizer.optimizeImageUrl(data.img, 240, 240);
    
    // 로고 경로 수정 (event/ 폴더에서 접근할 때)
    let logoPath = data.logo;
    if (logoPath && logoPath.startsWith('assets/')) {
      logoPath = '../' + logoPath;
    } else if (logoPath && logoPath.startsWith('/assets/')) {
      logoPath = '..' + logoPath;
    }
    
    const optimizedLogoUrl = imageOptimizer.optimizeImageUrl(logoPath, 56, 56);
    
    card.innerHTML = `
      <button class="event-card-btn" ${data.link ? `data-link="${data.link}"` : ''}>
        <div class="event-card-inner">
          <div class="event-card-left">
            <div>
              <div class="event-card-timer">
                <svg viewBox="0 0 24 24" fill="none" width="20" height="20" color="#8b94a9"><path d="M3 7.02381C3 5.52475 4.20883 4.30952 5.7 4.30952H18.3C19.7912 4.30952 21 5.52475 21 7.02381V18.7857C21 20.2848 19.7912 21.5 18.3 21.5H5.7C4.20883 21.5 3 20.2848 3 18.7857V7.02381Z" fill="#E5E9EE"></path><path d="M7.5 3.85714C7.5 3.10761 8.10442 2.5 8.85 2.5C9.59558 2.5 10.2 3.10761 10.2 3.85714V5.66667C10.2 6.4162 9.59558 7.02381 8.85 7.02381C8.10442 7.02381 7.5 6.4162 7.5 5.66667V3.85714Z" fill="#151E42"></path><path d="M13.8 3.85714C13.8 3.10761 14.4044 2.5 15.15 2.5C15.8956 2.5 16.5 3.10761 16.5 3.85714V5.66667C16.5 6.4162 15.8956 7.02381 15.15 7.02381C14.4044 7.02381 13.8 6.4162 13.8 5.66667V3.85714Z" fill="#151E42"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M16.266 10.939C16.6003 11.3088 16.5732 11.881 16.2054 12.2171L10.9078 17.0586C10.7183 17.2318 10.4234 17.2113 10.2594 17.0135L7.70862 13.9364C7.39042 13.5525 7.44201 12.982 7.82386 12.6621C8.20571 12.3422 8.77321 12.3941 9.09142 12.7779L10.4391 14.4037C10.6031 14.6015 10.898 14.6221 11.0875 14.4489L14.9946 10.8782C15.3624 10.542 15.9316 10.5693 16.266 10.939Z" fill="#0067FF"></path></svg>
                <span>${data.period}</span>
              </div>
              <div class="event-card-title">${data.title}</div>
              <div class="event-card-desc">${data.desc}</div>
            </div>
            <div class="event-card-exchange-row">
              <img class="event-card-exchange-logo" 
                   src="${optimizedLogoUrl}" 
                   alt="${data.exchange}" 
                   loading="lazy" />
              <span class="event-card-exchange-name">${data.exchange}</span>
              ${isAdmin ? `<button class="event-card-edit" data-id="${docSnap.id}" title="수정"><i class="fas fa-edit"></i></button><button class="event-card-delete" data-id="${docSnap.id}" title="삭제"><i class="fas fa-trash-alt"></i></button>` : ''}
            </div>
          </div>
          <div class="event-card-img-wrap">
            <img class="event-card-img lazy-image" 
                 data-src="${optimizedImgUrl}" 
                 alt="${data.exchange} Event" 
                 loading="lazy" />
          </div>
        </div>
      </button>
    `;
    
    eventList.appendChild(card);
  });
  
  // 🚀 Lazy Loading 적용
  const lazyImages = document.querySelectorAll('.lazy-image');
  lazyImages.forEach(img => {
    imageOptimizer.observe(img);
  });
  
  // 카드 클릭 시 링크 이동
  document.querySelectorAll('.event-card-btn[data-link]').forEach(btn => {
    btn.addEventListener('click', e => {
      const link = btn.getAttribute('data-link');
      if (link) window.open(link, '_blank');
    });
  });
      // 🔒 보안 강화된 삭제 버튼 이벤트
    if (isAdmin) {
      document.querySelectorAll('.event-card-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          
          // 실시간 권한 재확인
          const isAdminUser = await adminAuthManager.isAdminUser();
          if (!isAdminUser) {
            alert('관리자 권한이 필요합니다.');
            return;
          }
          
          if (confirm('정말로 삭제하시겠습니까?')) {
            try {
              // 보안 메타데이터와 함께 삭제 로그 기록
              await adminAuthManager.logSecurityEvent('event_delete', {
                eventId: id,
                action: 'delete',
                timestamp: new Date().toISOString()
              });
              
              await deleteDoc(doc(db, 'events', id));
              renderEvents();
              
              console.log('🔒 이벤트 삭제 완료:', {
                eventId: id,
                user: currentUser.email
              });
            } catch (error) {
              console.error('이벤트 삭제 실패:', error);
              alert('삭제 중 오류가 발생했습니다.');
            }
          }
        });
      });
          // 🔒 보안 강화된 수정 버튼 클릭 이벤트
      document.querySelectorAll('.event-card-edit').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          
          // 실시간 권한 재확인
          const isAdminUser = await adminAuthManager.isAdminUser();
          if (!isAdminUser) {
            alert('관리자 권한이 필요합니다.');
            return;
          }
          
          const eventDoc = await getDoc(doc(db, 'events', id));
          if (!eventDoc.exists()) return alert('이벤트를 찾을 수 없습니다.');
          const data = eventDoc.data();
          
          // 수정 시도 로그 기록
          await adminAuthManager.logSecurityEvent('event_edit_attempt', {
            eventId: id,
            action: 'edit_form_open',
            timestamp: new Date().toISOString()
          });
        
        // 기본 필드 채우기
        document.getElementById('event-title').value = data.title;
        document.getElementById('event-desc').value = data.desc;
        document.getElementById('event-period').value = data.period;
        document.getElementById('event-link').value = data.link;
        
        // 🔥 이미지 정보 설정 (수정 시)
        if (data.img) {
          currentImageUrl = data.img;
          showImagePreview(data.img);
        }
        
        // 거래소 선택 처리
        const exchangeSelect = document.getElementById('event-exchange');
        const exchangeName = data.exchange;
        let logoPath = data.logo;
        
        // 로고 경로 수정 (event/ 폴더에서 접근할 때)
        if (logoPath && logoPath.startsWith('assets/')) {
          logoPath = '../' + logoPath;
        } else if (logoPath && logoPath.startsWith('/assets/')) {
          logoPath = '..' + logoPath;
        }
        
        // 기본 거래소 목록에서 찾기
        let foundOption = false;
        for (let option of exchangeSelect.options) {
          if (option.value === exchangeName && option.getAttribute('data-logo') === logoPath) {
            exchangeSelect.value = exchangeName;
            foundOption = true;
            break;
          }
        }
        
        if (!foundOption) {
          // 기타 거래소인 경우
          exchangeSelect.value = '기타';
          document.getElementById('custom-exchange-name').value = exchangeName;
          document.getElementById('custom-logo-url').value = logoPath;
          customExchangeGroup.style.display = 'block';
          customLogoGroup.style.display = 'block';
          exchangePreviewLogo.src = logoPath;
          exchangePreviewName.textContent = exchangeName;
          exchangePreview.style.display = 'flex';
        } else {
          // 기본 거래소인 경우
          exchangePreviewLogo.src = logoPath;
          exchangePreviewName.textContent = exchangeName;
          exchangePreview.style.display = 'flex';
          customExchangeGroup.style.display = 'none';
          customLogoGroup.style.display = 'none';
        }
        
        // 🔥 이미지 미리보기 (수정 시에는 기존 로직 제거됨)
        
        eventModal.setAttribute('data-edit-id', id);
        eventModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
      });
    });
  }
}

writeBtn.addEventListener('click', () => {
  eventModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
});
closeEventModal.addEventListener('click', () => {
  eventModal.style.display = 'none';
  document.body.style.overflow = '';
  eventForm.reset();
  eventModal.removeAttribute('data-edit-id');
  
  // 🔥 이미지 관련 상태 초기화
  removeImagePreview();
  cancelUpload();
  if (urlInputContainer) {
    urlInputContainer.style.display = 'none';
  }
  if (toggleUrlBtn) {
    toggleUrlBtn.innerHTML = '<i class="fas fa-link"></i> URL로 입력하기';
  }
  
  // 미리보기 초기화
  exchangePreview.style.display = 'none';
  customExchangeGroup.style.display = 'none';
  customLogoGroup.style.display = 'none';
  previewEventImg.style.display = 'none';
  clearFormMessage();
});

function showPreview(input, preview) {
  const url = input.value.trim();
  if (url && /^https?:\/\//.test(url)) {
    preview.src = url;
    preview.style.display = 'block';
  } else {
    preview.src = '';
    preview.style.display = 'none';
  }
}

// 🔥 이미지 파일 업로드 함수 (압축 기능 추가)
async function uploadImageFile(file) {
  return new Promise(async (resolve, reject) => {
    // 🔒 보안 강화된 권한 확인
    if (!adminAuthManager) {
      reject(new Error('인증 시스템이 초기화되지 않았습니다.'));
      return;
    }
    
    const isAdminUser = await adminAuthManager.isAdminUser();
    if (!isAdminUser) {
      reject(new Error('관리자 권한이 필요합니다.'));
      return;
    }
    
    try {
      // 🚀 이미지 압축 적용
      const compressedFile = await imageOptimizer.compressImage(file, 800, 600, 0.85);
      
      // 압축된 파일 크기 검증 (5MB 제한)
      if (compressedFile.size > 5 * 1024 * 1024) {
        reject(new Error('압축 후에도 파일 크기가 5MB를 초과합니다.'));
        return;
      }
      
      if (imageDebugger.debugMode) {
        console.log(`이미지 압축 완료: ${(file.size / 1024).toFixed(1)}KB → ${(compressedFile.size / 1024).toFixed(1)}KB`);
      }
      
      // 파일명 생성 (타임스탬프 + 랜덤 문자열)
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const extension = imageOptimizer.supportsWebP() ? 'webp' : 'jpg';
      const fileName = `events/${timestamp}_${randomString}.${extension}`;
      
      // Firebase Storage 참조 생성
      const storageRef = ref(storage, fileName);
      
      // 업로드 작업 생성
      const uploadTask = uploadBytesResumable(storageRef, compressedFile, {
        contentType: compressedFile.type,
        cacheControl: 'public, max-age=31536000' // 1년 캐시
      });
      
      // 업로드 진행률 추적
      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          updateUploadProgress(progress);
        },
        (error) => {
          console.error('Upload error:', error);
          hideUploadProgress();
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            hideUploadProgress();
            resolve(downloadURL);
          } catch (error) {
            hideUploadProgress();
            reject(error);
          }
        }
      );
      
      // 업로드 취소 기능을 위해 전역 변수에 저장
      window.currentUploadTask = uploadTask;
      
    } catch (error) {
      console.error('이미지 압축 실패:', error);
      reject(new Error('이미지 처리 중 오류가 발생했습니다.'));
    }
  });
}

// 업로드 진행률 표시
function updateUploadProgress(progress) {
  if (uploadProgress && progressFill && progressText) {
    uploadProgress.style.display = 'block';
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `${Math.round(progress)}%`;
    
    // 업로드 버튼 비활성화
    if (uploadImageBtn) {
      uploadImageBtn.disabled = true;
      uploadImageBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 업로드 중...';
    }
  }
}

// 업로드 진행률 숨기기
function hideUploadProgress() {
  if (uploadProgress) {
    uploadProgress.style.display = 'none';
  }
  if (progressFill) {
    progressFill.style.width = '0%';
  }
  if (progressText) {
    progressText.textContent = '0%';
  }
  
  // 업로드 버튼 활성화
  if (uploadImageBtn) {
    uploadImageBtn.disabled = false;
    uploadImageBtn.innerHTML = '<i class="fas fa-upload"></i> 이미지 업로드';
  }
}

// 이미지 미리보기 표시
function showImagePreview(url) {
  if (previewEventImg && removeImageBtn) {
    previewEventImg.src = url;
    previewEventImg.style.display = 'block';
    removeImageBtn.style.display = 'block';
    currentImageUrl = url;
  }
}

// 이미지 미리보기 제거
function removeImagePreview() {
  if (previewEventImg && removeImageBtn) {
    previewEventImg.style.display = 'none';
    removeImageBtn.style.display = 'none';
    currentImageUrl = null;
    currentImageFile = null;
    
    // 파일 입력 초기화
    if (eventImgFile) {
      eventImgFile.value = '';
    }
    if (eventImgUrl) {
      eventImgUrl.value = '';
    }
  }
}

// 업로드 취소
function cancelUpload() {
  if (uploadTask) {
    uploadTask.cancel();
    uploadTask = null;
    hideUploadProgress();
  }
}
// 🔥 이미지 업로드 관련 이벤트 리스너
if (uploadImageBtn && eventImgFile) {
  uploadImageBtn.addEventListener('click', () => {
    eventImgFile.click();
  });
}

if (eventImgFile) {
  eventImgFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        // 🔒 보안 강화된 업로드 전 권한 확인
        if (!adminAuthManager) {
          showFormMessage('인증 시스템이 초기화되지 않았습니다.');
          return;
        }
        
        const isAdminUser = await adminAuthManager.isAdminUser();
        if (!isAdminUser) {
          showFormMessage('관리자 권한이 필요합니다.');
          return;
        }
        
        console.log('🔒 보안 강화된 업로드 시도:', {
          user: currentUser.email
        });
        currentImageFile = file;
        showFormMessage('이미지 업로드 중...', '#1976d2');
        const downloadURL = await uploadImageFile(file);
        showImagePreview(downloadURL);
        showFormMessage('이미지 업로드 완료!', '#388e3c');
        setTimeout(() => clearFormMessage(), 2000);
      } catch (error) {
        console.error('Image upload error:', error);
        showFormMessage(error.message || '이미지 업로드에 실패했습니다.');
        removeImagePreview();
      }
    }
  });
}

if (removeImageBtn) {
  removeImageBtn.addEventListener('click', () => {
    removeImagePreview();
  });
}

if (toggleUrlBtn && urlInputContainer) {
  toggleUrlBtn.addEventListener('click', () => {
    const isVisible = urlInputContainer.style.display !== 'none';
    urlInputContainer.style.display = isVisible ? 'none' : 'block';
    toggleUrlBtn.innerHTML = isVisible ? 
      '<i class="fas fa-link"></i> URL로 입력하기' : 
      '<i class="fas fa-times"></i> URL 입력 닫기';
  });
}

if (eventImgUrl) {
  eventImgUrl.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url && /^https?:\/\//.test(url)) {
      showImagePreview(url);
    } else if (!url) {
      removeImagePreview();
    }
  });
}

// 기존 이벤트 리스너 (URL 입력용)
if (eventImgInput && previewEventImg) {
  eventImgInput.addEventListener('input', () => showPreview(eventImgInput, previewEventImg));
}
if (exchangeSelect) {
  exchangeSelect.addEventListener('change', (e) => {
    const selectedOption = e.target.selectedOptions[0];
    const exchangeName = selectedOption.value;
    const logoPath = selectedOption.getAttribute('data-logo');
    
    if (exchangeName === '기타') {
      // 기타 선택 시 직접 입력 필드 표시
      customExchangeGroup.style.display = 'block';
      customLogoGroup.style.display = 'block';
      exchangePreview.style.display = 'none';
    } else if (exchangeName && logoPath) {
      // 기본 거래소 선택 시 미리보기 표시
      exchangePreviewLogo.src = logoPath;
      exchangePreviewName.textContent = exchangeName;
      exchangePreview.style.display = 'flex';
      customExchangeGroup.style.display = 'none';
      customLogoGroup.style.display = 'none';
    } else {
      // 아무것도 선택하지 않은 경우
      exchangePreview.style.display = 'none';
      customExchangeGroup.style.display = 'none';
      customLogoGroup.style.display = 'none';
    }
  });
}

// 커스텀 로고 URL 미리보기
if (customLogoUrl) {
  customLogoUrl.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url && /^https?:\/\//.test(url)) {
      exchangePreviewLogo.src = url;
      exchangePreviewName.textContent = customExchangeName.value || '사용자 지정';
      exchangePreview.style.display = 'flex';
    } else {
      exchangePreview.style.display = 'none';
    }
  });
}

if (customExchangeName) {
  customExchangeName.addEventListener('input', (e) => {
    if (exchangePreview.style.display === 'flex') {
      exchangePreviewName.textContent = e.target.value || '사용자 지정';
    }
  });
}

function showFormMessage(msg, color = '#ef5350') {
  if (eventFormMessage) {
    eventFormMessage.textContent = msg;
    eventFormMessage.style.color = color;
  }
}
function clearFormMessage() {
  if (eventFormMessage) eventFormMessage.textContent = '';
}

const eventFormSubmitHandler = async (e) => {
  e.preventDefault();
  
  // 🔒 보안 강화된 권한 확인
  if (!adminAuthManager) {
    showFormMessage('인증 시스템이 초기화되지 않았습니다.');
    return;
  }
  
  const isAdminUser = await adminAuthManager.isAdminUser();
  if (!isAdminUser) {
    showFormMessage('관리자 권한이 필요합니다.');
    return;
  }
  
  clearFormMessage();
  
  const title = document.getElementById('event-title').value.trim();
  const desc = document.getElementById('event-desc').value.trim();
  const period = document.getElementById('event-period').value.trim();
  const link = document.getElementById('event-link').value.trim();
  
  // 🔥 이미지 URL 가져오기 (업로드된 이미지 또는 URL 입력)
  let img = currentImageUrl || '';
  if (!img && eventImgUrl) {
    img = eventImgUrl.value.trim();
  }
  if (!img && eventImgInput) {
    img = eventImgInput.value.trim();
  }
  
  // 거래소 정보 처리
  const exchangeSelect = document.getElementById('event-exchange');
  const selectedExchange = exchangeSelect.value;
  let exchange, logo;
  
  if (selectedExchange === '기타') {
    exchange = document.getElementById('custom-exchange-name').value.trim();
    logo = document.getElementById('custom-logo-url').value.trim();
  } else if (selectedExchange) {
    exchange = selectedExchange;
    logo = exchangeSelect.selectedOptions[0].getAttribute('data-logo');
  }
  
  if (!title || !desc || !period || !exchange || !img || !logo || !link) {
    showFormMessage('모든 항목을 입력해 주세요.');
    return;
  }
  if (title.length > 40 || desc.length > 120) {
    showFormMessage('제목/설명 글자 수를 확인해 주세요.');
    return;
  }
  
  showFormMessage('등록 중입니다...', '#1976d2');
  const editId = eventModal.getAttribute('data-edit-id');
  
  try {
    // 🔒 보안 메타데이터 추가
    const securityMetadata = {
      authorId: currentUser.uid,
      authorEmail: currentUser.email,
      createdAt: serverTimestamp(),
      lastModified: serverTimestamp()
    };
    
    if (editId) {
      // 수정 시 기존 데이터 유지하면서 보안 메타데이터 업데이트
      await updateDoc(doc(db, 'events', editId), { 
        title, desc, period, exchange, img, logo, link,
        ...securityMetadata,
        modifiedAt: serverTimestamp()
      });
      
      // 수정 완료 로그 기록
      await adminAuthManager.logSecurityEvent('event_update', {
        eventId: editId,
        action: 'update',
        changes: { title, desc, period, exchange, img, logo, link },
        timestamp: new Date().toISOString()
      });
      
      eventModal.removeAttribute('data-edit-id');
      showFormMessage('수정 완료!', '#388e3c');
      
      console.log('🔒 이벤트 수정 완료:', {
        eventId: editId,
        user: currentUser.email,
        securityLevel: authResult.securityLevel
      });
    } else {
      // 새 이벤트 생성
      const newEventRef = await addDoc(collection(db, 'events'), { 
        title, desc, period, exchange, img, logo, link, 
        ...securityMetadata
      });
      
      // 생성 완료 로그 기록
      await adminAuthManager.logSecurityEvent('event_create', {
        eventId: newEventRef.id,
        action: 'create',
        data: { title, desc, period, exchange, img, logo, link },
        timestamp: new Date().toISOString()
      });
      
      showFormMessage('등록 완료!', '#388e3c');
      
      console.log('🔒 이벤트 생성 완료:', {
        eventId: newEventRef.id,
        user: currentUser.email,
        securityLevel: authResult.securityLevel
      });
    }
    setTimeout(() => {
      eventModal.style.display = 'none';
      document.body.style.overflow = '';
      eventForm.reset();
      clearFormMessage();
      
      // 🔥 이미지 관련 상태 초기화
      removeImagePreview();
      cancelUpload();
      if (urlInputContainer) {
        urlInputContainer.style.display = 'none';
      }
      if (toggleUrlBtn) {
        toggleUrlBtn.innerHTML = '<i class="fas fa-link"></i> URL로 입력하기';
      }
      
      exchangePreview.style.display = 'none';
      customExchangeGroup.style.display = 'none';
      customLogoGroup.style.display = 'none';
      previewEventImg.style.display = 'none';
      renderEvents();
    }, 800);
  } catch (err) {
    showFormMessage('오류가 발생했습니다. 다시 시도해 주세요.');
  }
};
eventForm.removeEventListener('submit', eventFormSubmitHandler);
eventForm.addEventListener('submit', eventFormSubmitHandler);

 