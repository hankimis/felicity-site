/**
 * 3개 기능 카드 관리 (기술적 분석, 고래 탐지, 속보 뉴스)
 */
class FeatureCardsManager {
  constructor() {
    this.init();
  }
  
  init() {
    console.log('🎯 3개 카드 기능 초기화 시작');
    
    // 1. 고래 탐지 카드 초기화
    setTimeout(() => {
      try {
        this.initializeWhaleTrackerCard();
      } catch (error) {
        console.error('❌ 고래 탐지 카드 초기화 실패:', error);
      }
    }, 500);
    
    // 2. 속보 뉴스 카드 초기화 (뉴스 로딩 후)
    setTimeout(() => {
      try {
        this.initializeBreakingNewsCard();
      } catch (error) {
        console.error('❌ 속보 뉴스 카드 초기화 실패:', error);
      }
    }, 1000); // 더 빠른 초기화
  }

  // 고래 탐지 카드 초기화
  initializeWhaleTrackerCard() {
    console.log('🐋 고래 탐지 카드 초기화 시작');
    
    // WhaleTracker 클래스가 로드될 때까지 대기
    const initWhaleTracker = () => {
      if (typeof window.WhaleTracker !== 'undefined') {
        const whaleContainer = document.getElementById('whale-transactions');
        if (whaleContainer) {
          // 컨테이너를 WhaleTracker에 전달하여 카드 모드로 초기화
          window.featureWhaleTracker = new window.WhaleTracker(whaleContainer);
          console.log('🐋 고래 탐지 카드 초기화 완료 (카드 모드)');
        }
      } else {
        console.warn('🐋 WhaleTracker 클래스를 찾을 수 없습니다');
        this.showWhaleTrackerFallback();
      }
    };
    
    // WhaleTracker가 로드되었는지 확인하고 초기화
    if (typeof window.WhaleTracker !== 'undefined') {
      initWhaleTracker();
    } else {
      // 최대 5초 동안 0.5초마다 재시도
      let attempts = 0;
      const maxAttempts = 10;
      const retryInterval = setInterval(() => {
        attempts++;
        if (typeof window.WhaleTracker !== 'undefined') {
          clearInterval(retryInterval);
          initWhaleTracker();
        } else if (attempts >= maxAttempts) {
          clearInterval(retryInterval);
          console.warn('🐋 WhaleTracker 로딩 타임아웃');
          this.showWhaleTrackerFallback();
        }
      }, 500);
    }
  }

  // 고래 탐지 대체 메시지
  showWhaleTrackerFallback() {
    const whaleContainer = document.getElementById('whale-transactions');
    if (whaleContainer) {
      whaleContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #6b7280;">
          <div style="text-align: center; padding: 20px;">
            <i class="fas fa-fish" style="font-size: 2rem; margin-bottom: 1rem; color: #10b981;"></i>
            <div style="margin-bottom: 0.5rem;">고래 탐지 서비스 준비 중</div>
            <div style="font-size: 0.9rem; color: #9ca3af;">곧 실시간 대형 거래를 추적할 수 있습니다</div>
          </div>
        </div>
      `;
    }
  }

  // 속보 뉴스 카드 초기화
  initializeBreakingNewsCard() {
    console.log('📰 속보 뉴스 카드 초기화 시작');
    
    // 즉시 뉴스 함수들이 있는지 확인
    if (typeof window.getNewsImportance === 'function' && window.newsItems && window.newsItems.length > 0) {
      console.log('📰 뉴스 데이터가 이미 로드되어 있음, 즉시 표시');
      this.loadBreakingNews();
      return;
    }
    
    // 뉴스 데이터가 로드될 때까지 대기
    const checkNewsData = setInterval(() => {
      if (window.newsItems && window.newsItems.length > 0) {
        clearInterval(checkNewsData);
        console.log('📰 뉴스 데이터 로드 완료, 속보 표시');
        this.loadBreakingNews();
      }
    }, 500); // 더 빠른 체크 간격
    
    // 20초 후 타임아웃 (뉴스 로딩 시간을 더 줌)
    setTimeout(() => {
      clearInterval(checkNewsData);
      if (!window.newsItems || window.newsItems.length === 0) {
        console.log('📰 뉴스 데이터 로딩 타임아웃, 대체 메시지 표시');
        this.showBreakingNewsFallback();
      }
    }, 20000);
  }

  // 속보 뉴스 로드 및 표시
  loadBreakingNews() {
    if (!window.newsItems || window.newsItems.length === 0) {
      console.log('📰 뉴스 데이터가 없음, 대체 메시지 표시');
      this.showBreakingNewsFallback();
      return;
    }
    
    console.log(`📰 속보 뉴스 필터링 시작 (전체 ${window.newsItems.length}개 뉴스)`);
    
    // 중요도 5점 뉴스만 필터링 (속보)
    const breakingNews = window.newsItems.filter(item => {
      // getNewsImportance 함수가 있으면 사용, 없으면 기본 필터링
      if (typeof window.getNewsImportance === 'function') {
        const importance = window.getNewsImportance(item);
        return importance >= 4; // 4점 이상을 속보로 간주 (더 많은 뉴스 표시)
      } else {
        // 기본 키워드 기반 속보 필터링
        const title = (item.title || '').toLowerCase();
        const urgentKeywords = ['긴급', '속보', '규제', '승인', '금지', '해킹', '상장', '폐쇄', '급등', '폭락', 'ETF', 'SEC', '비트코인', '이더리움', '폭등', '급락', '대형', '거래', '투자'];
        return urgentKeywords.some(keyword => title.includes(keyword));
      }
    });
    
    console.log(`📰 속보 뉴스 필터링 완료: ${breakingNews.length}개 발견`);
    
    // 최신 순으로 정렬하고 상위 10개만 표시
    const topBreakingNews = breakingNews
      .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
      .slice(0, 10);
    
    const breakingContainer = document.getElementById('breaking-news-list');
    if (!breakingContainer) return;
    
    if (topBreakingNews.length === 0) {
      breakingContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 400px; color: #6b7280;">
          <div style="text-align: center; padding: 20px;">
            <i class="fas fa-newspaper" style="font-size: 2rem; margin-bottom: 1rem; color: #ef4444;"></i>
            <div style="margin-bottom: 0.5rem;">현재 속보가 없습니다</div>
            <div style="font-size: 0.9rem; color: #9ca3af;">중요한 뉴스가 발생하면 여기에 표시됩니다</div>
          </div>
        </div>
      `;
      return;
    }
    
    // 속보 뉴스 HTML 생성
    const newsHTML = topBreakingNews.map(item => {
      const relativeTime = window.getRelativeTime ? window.getRelativeTime(item.pubDate) : '방금 전';
      const sourceName = window.getSourceDisplayName ? window.getSourceDisplayName(item.source) : item.source;
      const starRating = window.createStarRating ? window.createStarRating(item) : '';
      
      return `
        <div class="breaking-news-item" onclick="window.open('${item.link}', '_blank')">
          <div class="breaking-news-meta">
            <span class="breaking-news-source">${sourceName}</span>
            <span class="breaking-news-time">
              ${relativeTime}
              ${starRating}
            </span>
          </div>
          <h4 class="breaking-news-title">${item.title}</h4>
          <p class="breaking-news-desc">${item.contentSnippet || item.title}</p>
        </div>
      `;
    }).join('');
    
    breakingContainer.innerHTML = newsHTML;
    console.log(`📰 속보 뉴스 ${topBreakingNews.length}개 로드 완료`);
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
  
  // 전역 뉴스 데이터 변경 이벤트 리스너
  window.addEventListener('newsDataUpdated', () => {
    if (window.featureCardsManager) {
      window.featureCardsManager.updateBreakingNewsCard();
    }
  });
}); 