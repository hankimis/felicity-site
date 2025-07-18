/**
 * 히트맵 카드 관리 (암호화폐 히트맵, S&P 500 히트맵)
 */
class HeatmapCardsManager {
  constructor() {
    this.init();
  }
  
  init() {
    console.log('📊 차트 카드 매니저 초기화');
    this.bindEvents();
  }
  
  bindEvents() {
    // 히트맵 카드 호버 효과
    document.querySelectorAll('.heatmap-card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-2px)';
        card.style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)';
      });
      
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
      });
    });
    
    // 다크모드 변경 감지
    this.handleThemeChange();
  }
  
  handleThemeChange() {
    // 테마 변경 감지 (헤더의 테마 토글 버튼용)
    document.addEventListener('themeChanged', () => {
      console.log('🌙 테마 변경 감지 - 차트 카드 업데이트');
      // 차트 위젯들이 자동으로 테마를 감지하므로 별도 처리 불필요
    });
  }
  
  // 차트 카드 상태 확인
  checkHeatmapStatus() {
    const cryptoChart = document.querySelector('.crypto-chart .tradingview-widget-container__widget');
    const dominanceWidget = document.querySelector('.dominance-widget .tradingview-widget-container__widget');
    
    if (cryptoChart && cryptoChart.children.length === 0) {
      console.log('📊 암호화폐 차트 로딩 중...');
    } else {
      console.log('✅ 암호화폐 차트 로드 완료');
    }
    
    if (dominanceWidget && dominanceWidget.children.length === 0) {
      console.log('🏆 도미넌스 위젯 로딩 중...');
    } else {
      console.log('✅ 도미넌스 위젯 로드 완료');
    }
  }
  
  // 차트 카드 새로고침
  refreshHeatmaps() {
    console.log('🔄 차트 카드 새로고침');
    
    // TradingView 위젯들이 자동으로 데이터를 업데이트하므로
    // 페이지 새로고침 없이 실시간 데이터가 반영됩니다
    this.checkHeatmapStatus();
  }
}

// DOM 로드 후 초기화
document.addEventListener('DOMContentLoaded', () => {
      // 차트 카드가 로드될 때까지 대기
    setTimeout(() => {
      window.heatmapCardsManager = new HeatmapCardsManager();
      
      // 5초 후 차트 상태 확인
      setTimeout(() => {
        window.heatmapCardsManager.checkHeatmapStatus();
      }, 5000);
    }, 1000);
});

// 전역 함수 (기존 코드와 호환성 유지)
window.refreshHeatmaps = function() {
  if (window.heatmapCardsManager) {
    window.heatmapCardsManager.refreshHeatmaps();
  }
}; 