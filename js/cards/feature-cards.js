/**
 * 3개 기능 카드 관리 (기술적 분석, 고래 탐지, 속보 뉴스)
 */
class FeatureCardsManager {
  constructor() {
    this.breakingPage = 1;
    this.breakingPageSize = 10; // show enough items for grid + list
    this.sortedBreakingNews = [];
    this.currentKeywordExpr = 'all';
    this.init();
  }
  
  init() {
    // 1. 고래 탐지 카드 초기화
    setTimeout(() => {
      try {
        this.initializeWhaleTrackerCard();
      } catch (error) {
        // Silent error handling
      }
    }, 500);
    
    // 2. 속보 뉴스 카드 초기화 (뉴스 로딩 후)
    setTimeout(() => {
      try {
        this.initializeBreakingNewsCard();
      } catch (error) {
        // Silent error handling
      }
    }, 1000); // 더 빠른 초기화
  }

  // 고래 탐지 카드 초기화
  initializeWhaleTrackerCard() {
    // WhaleTracker 클래스가 로드될 때까지 대기
    const initWhaleTracker = () => {
      if (typeof window.WhaleTracker !== 'undefined') {
        const whaleContainer = document.getElementById('whale-transactions');
        if (whaleContainer) {
          try {
            // 컨테이너를 WhaleTracker에 전달하여 카드 모드로 초기화
            // 카드 모드용 설정
            const cardSettings = {
              largeTradeThreshold: 50000, // 카드에서는 더 낮은 임계값 사용
              enableSound: false, // 카드에서는 소리 비활성화
              cardMode: true
            };
            
            window.featureWhaleTracker = new window.WhaleTracker(whaleContainer, cardSettings);
            
          } catch (error) {
            this.showWhaleTrackerFallback();
          }
        } else {
          this.showWhaleTrackerFallback();
        }
      } else {
        this.showWhaleTrackerFallback();
      }
    };
    
    // WhaleTracker가 로드되었는지 확인하고 초기화
    if (typeof window.WhaleTracker !== 'undefined') {
      // 약간의 지연 후 초기화 (다른 스크립트들이 로드되기를 기다림)
      setTimeout(initWhaleTracker, 100);
    } else {
      // 최대 10초 동안 0.5초마다 재시도
      let attempts = 0;
      const maxAttempts = 20;
      const retryInterval = setInterval(() => {
        attempts++;
        
        if (typeof window.WhaleTracker !== 'undefined') {
          clearInterval(retryInterval);
          setTimeout(initWhaleTracker, 100);
        } else if (attempts >= maxAttempts) {
          clearInterval(retryInterval);
          this.showWhaleTrackerFallback();
        }
      }, 500);
    }
  }

  // 고래 탐지 연결 중 상태 표시
  showWhaleTrackerConnecting() {
    const whaleContainer = document.getElementById('whale-transactions');
    if (whaleContainer) {
      whaleContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #6b7280;">
          <div style="text-align: center; padding: 20px;">
            <i class="fas fa-fish whale-pulse" style="font-size: 2rem; margin-bottom: 1rem; color: #10b981;"></i>
            <div style="margin-bottom: 0.5rem;">고래 탐지 시스템 연결 중...</div>
            <div style="font-size: 0.9rem; color: #9ca3af;">거래소에 연결하고 있습니다</div>
          </div>
        </div>
        <style>
          .whale-pulse {
            animation: whale-pulse 2s infinite;
          }
          @keyframes whale-pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.7; }
          }
        </style>
      `;
    }
  }

  // 고래 탐지 대체 메시지 표시
  showWhaleTrackerFallback() {
    const whaleContainer = document.getElementById('whale-transactions');
    if (whaleContainer) {
      whaleContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #6b7280;">
          <div style="text-align: center; padding: 20px;">
            <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem; color: #f59e0b;"></i>
            <div style="margin-bottom: 0.5rem;">고래 탐지 서비스 일시 중단</div>
            <div style="font-size: 0.9rem; color: #9ca3af;">시스템 점검 중입니다</div>
            <button onclick="window.location.reload()" style="
              margin-top: 1rem; 
              padding: 0.5rem 1rem; 
              border: 1px solid var(--border-default); 
              border-radius: 6px; 
              background: var(--accent-blue); 
              color: white; 
              cursor: pointer;
              font-size: 0.9rem;
            ">
              다시 시도
            </button>
          </div>
        </div>
      `;
    }
  }

  // 속보 뉴스 카드 초기화
  initializeBreakingNewsCard() {
    // 즉시 뉴스 함수들이 있는지 확인
    if (typeof window.getNewsImportance === 'function' && window.newsItems && window.newsItems.length > 0) {
      this.loadBreakingNews();
      return;
    }
    
    // 뉴스 데이터가 로드될 때까지 대기
    const checkNewsData = setInterval(() => {
      if (window.newsItems && window.newsItems.length > 0) {
        clearInterval(checkNewsData);
        this.loadBreakingNews();
      }
    }, 500); // 더 빠른 체크 간격
    
    // 20초 후 타임아웃 (뉴스 로딩 시간을 더 줌)
    setTimeout(() => {
      clearInterval(checkNewsData);
      if (!window.newsItems || window.newsItems.length === 0) {
        this.showBreakingNewsFallback();
      }
    }, 20000);
  }

  // 속보 뉴스 로드 및 표시
  loadBreakingNews() {
    if (!window.newsItems || window.newsItems.length === 0) {
      this.showBreakingNewsFallback();
      return;
    }
    
    // 최신순 전체 정렬 후 보관
    this.sortedBreakingNews = window.newsItems.slice().sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    this.breakingPage = 1; // 초기화
    this.renderBreakingNewsPage();
  }

  getFilteredNews() {
    if (this.currentKeywordExpr === 'all') return this.sortedBreakingNews.slice();
    try {
      const re = new RegExp(this.currentKeywordExpr, 'i');
      return this.sortedBreakingNews.filter(n=> re.test(`${n.title||''} ${n.contentSnippet||''}`));
    } catch(_) {
      return this.sortedBreakingNews.slice();
    }
  }

  // 페이지 단위 렌더링 (4개씩)
  renderBreakingNewsPage() {
    const breakingContainer = document.getElementById('breaking-news-list');
    if (!breakingContainer) return;
    const parent = breakingContainer.parentElement;
    const total = this.sortedBreakingNews.length;
    let totalPages = Math.max(1, Math.ceil(total / this.breakingPageSize));
    if (this.breakingPage > totalPages) this.breakingPage = totalPages;
    if (this.breakingPage < 1) this.breakingPage = 1;
    const start = (this.breakingPage - 1) * this.breakingPageSize;
    const working = this.getFilteredNews();
    const slice = working.slice(start, start + this.breakingPageSize);

    const hasImage = (item)=> !!(item && item.image && item.image !== '/img/default-news.jpg' && /^(https?:)?\//.test(item.image));

    if (slice.length === 0) {
      breakingContainer.innerHTML = `
        <div class="bn-layout">
          <div class="bn-grid"><div style="padding:20px;color:var(--text-color-secondary)">표시할 속보가 없습니다.</div></div>
          <div class="bn-list"></div>
        </div>`;
    } else {
      // 좌측: 이미지 있는 뉴스 4개 고정 (현재 페이지에 부족하면 이후 아이템에서 보충)
      const leftItems = [];
      // 1) 현재 페이지에서 채움
      for (const it of slice) {
        if (leftItems.length >= 4) break;
        if (hasImage(it)) leftItems.push(it);
      }
      // 2) 부족하면 이후 전체 리스트에서 보충
      if (leftItems.length < 4) {
        for (let i = start + this.breakingPageSize; i < this.sortedBreakingNews.length && leftItems.length < 4; i++) {
          const it = this.sortedBreakingNews[i];
          if (hasImage(it)) leftItems.push(it);
        }
      }
      // 3) 그래도 부족하면 앞쪽에서 보충 (예외 케이스)
      if (leftItems.length < 4) {
        for (let i = 0; i < start && leftItems.length < 4; i++) {
          const it = this.sortedBreakingNews[i];
          if (hasImage(it)) leftItems.push(it);
        }
      }

      // 우측: 나머지 텍스트 뉴스 (이미지/비이미지 모두 허용)
      const used = new Set(leftItems.map(it => it.link));
      let rightItems = [];
      // 1) 현재 페이지 슬라이스에서 우선 채우기
      for (const it of slice) {
        if (rightItems.length >= 8) break;
        if (!used.has(it.link)) rightItems.push(it);
      }
      // 2) 부족하면 이후 뉴스로 보충
      if (rightItems.length < 8) {
        for (let i = start + this.breakingPageSize; i < working.length && rightItems.length < 8; i++) {
          const it = working[i];
          if (!it) continue;
          if (!used.has(it.link)) rightItems.push(it);
        }
      }
      rightItems = rightItems.slice(0, 8);

      const leftHTML = leftItems.map(item => {
        const relativeTime = window.getRelativeTime ? window.getRelativeTime(item.pubDate) : '방금 전';
        const sourceName = window.getSourceDisplayName ? window.getSourceDisplayName(item.source) : item.source;
        const img = hasImage(item) ? item.image : '';
        const thumb = img ? `style=\"background-image:url('${img}')\"` : '';
        return `
          <div class=\"bn-card\" onclick=\"window.open('${item.link}','_blank','noopener,noreferrer')\">\n            <div class=\"thumb\" ${thumb}></div>\n            <div class=\"body\">\n              <div class=\"title\">${item.title}</div>\n              <div class=\"meta\"><span>${sourceName}</span></div>\n            </div>\n          </div>`;
      }).join('');

      const rightHTML = rightItems.map(item => {
        const relativeTime = window.getRelativeTime ? window.getRelativeTime(item.pubDate) : '방금 전';
        return `<div class=\"bn-row\" onclick=\"window.open('${item.link}','_blank','noopener,noreferrer')\"><div class=\"txt\">${item.title}</div></div>`;
      }).join('');

      breakingContainer.innerHTML = `<div class=\"bn-layout\"><div class=\"bn-grid\">${leftHTML}</div><div class=\"bn-list\">${rightHTML}</div></div>`;
    }

    // 페이지네이션 렌더링
    let paginator = document.getElementById('breaking-news-pagination');
    if (!paginator) {
      paginator = document.createElement('div');
      paginator.id = 'breaking-news-pagination';
      paginator.className = 'breaking-pagination';
      parent.appendChild(paginator);
    }
    totalPages = Math.max(1, Math.ceil(this.getFilteredNews().length / this.breakingPageSize));
    paginator.innerHTML = `
      <button class="bp-btn prev" aria-label="이전"><i class="fas fa-chevron-left"></i></button>
      <span class="bp-text">속보 더보기 ${this.breakingPage}/${totalPages}</span>
      <button class="bp-btn next" aria-label="다음"><i class="fas fa-chevron-right"></i></button>
    `;

    // 이벤트 바인딩
    const prevBtn = paginator.querySelector('.bp-btn.prev');
    const nextBtn = paginator.querySelector('.bp-btn.next');
    prevBtn.onclick = () => { this.breakingPage = this.breakingPage <= 1 ? totalPages : this.breakingPage - 1; this.renderBreakingNewsPage(); };
    nextBtn.onclick = () => { this.breakingPage = this.breakingPage >= totalPages ? 1 : this.breakingPage + 1; this.renderBreakingNewsPage(); };
  }

  bindNewsTabs(){
    try {
      const tabs = document.querySelectorAll('#news-tabs .ntab');
      tabs.forEach(btn=>{
        btn.addEventListener('click', ()=>{
          tabs.forEach(b=> b.classList.remove('active'));
          btn.classList.add('active');
          const kw = btn.getAttribute('data-kw') || 'all';
          this.currentKeywordExpr = kw === 'all' ? 'all' : kw;
          this.breakingPage = 1;
          this.renderBreakingNewsPage();
        });
      });
    } catch(_) {}
  }

  // 속보 뉴스 대체 메시지
  showBreakingNewsFallback() {
    const breakingContainer = document.getElementById('breaking-news-list');
    if (breakingContainer) {
      breakingContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 400px; color: #6b7280;">
          <div style="text-align: center; padding: 20px;">
            <i class="fas fa-newspaper" style="font-size: 2rem; margin-bottom: 1rem; color: #ef4444;"></i>
            <div style="margin-bottom: 0.5rem;">뉴스 로딩 중...</div>
            <div style="font-size: 0.9rem; color: #9ca3af;">잠시만 기다려주세요</div>
          </div>
        </div>
      `;
    }
  }

  // 뉴스 데이터 변경 감지 및 속보 업데이트
  updateBreakingNewsCard() {
    if (window.newsItems && window.newsItems.length > 0) {
      this.loadBreakingNews();
    }
  }
}

// 전역 함수 (기존 코드와 호환성 유지)
window.updateBreakingNewsCard = function() {
  if (window.featureCardsManager) {
    window.featureCardsManager.updateBreakingNewsCard();
  }
};

// DOM 로드 후 초기화
document.addEventListener('DOMContentLoaded', () => {
  window.featureCardsManager = new FeatureCardsManager();
  window.featureCardsManager.bindNewsTabs();
  
  // 전역 뉴스 데이터 변경 이벤트 리스너
  window.addEventListener('newsDataUpdated', () => {
    if (window.featureCardsManager) {
      window.featureCardsManager.updateBreakingNewsCard();
    }
  });
}); 