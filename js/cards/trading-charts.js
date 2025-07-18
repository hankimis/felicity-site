/**
 * TradingView 차트 그리드 관리
 */
class TradingChartsManager {
  constructor() {
    this.currentSymbol = 'BTCUSDT';
    this.tvWidget = null;
    this.isChartReady = false;
    this.init();
  }
  
  init() {
    this.bindEvents();
  }
  
  bindEvents() {
    // 차트 심볼 변경
    const chartSymbol = document.getElementById('chart-symbol');
    if (chartSymbol) {
      chartSymbol.addEventListener('change', (e) => {
        this.changeSymbol(e.target.value);
      });
    }
    
    // 분봉 드롭다운 이벤트 리스너 추가
    const timeframeSelect = document.getElementById('chart-timeframe');
    if (timeframeSelect) {
      timeframeSelect.addEventListener('change', function() {
        const timeframe = this.value;
        this.changeTimeframe(timeframe);
      }.bind(this));
    }
  }
  
  changeSymbol(symbol) {
    this.currentSymbol = symbol;
    console.log('심볼 변경:', symbol);
    
    // 전역 차트 심볼 변경 함수 호출
    if (typeof changeChartSymbol === 'function') {
      changeChartSymbol(symbol);
    } else {
      console.warn('changeChartSymbol 함수를 찾을 수 없습니다.');
    }
  }
  
  changeTimeframe(timeframe) {
    // 로딩 표시
    const chartContainer = document.getElementById('tradingview_chart');
    if (chartContainer) {
      chartContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary);">
          <div style="text-align: center;">
            <div class="loading-spinner" style="width: 40px; height: 40px; border: 3px solid var(--border-color); border-top: 3px solid var(--primary-color); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
            <div>분봉 변경 중...</div>
          </div>
        </div>
      `;
    }
    
    setTimeout(() => {
      this.initializeTradingViewChart(this.currentSymbol, timeframe);
    }, 300);
  }
  
  initializeTradingViewChart(symbol = 'BTCUSDT', interval = null) {
    const chartContainer = document.getElementById('tradingview_chart');
    if (!chartContainer) {
      console.warn('차트 컨테이너를 찾을 수 없습니다.');
      return;
    }

    try {
      // 로딩 표시 제거
      const loadingElement = document.getElementById('chart-loading');
      if (loadingElement) {
        loadingElement.style.display = 'none';
      }
      
      // 기존 위젯이 있다면 제거
      if (this.tvWidget) {
        try {
          this.tvWidget.remove();
        } catch (e) {
          console.warn('기존 위젯 제거 중 오류:', e);
        }
      }
      
      // 컨테이너 초기화
      chartContainer.innerHTML = '';
      
      const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
      this.currentSymbol = symbol;
      
      // 시간 프레임 설정 (interval이 제공되면 사용, 아니면 현재 설정 사용)
      const timeframe = interval || '1';
      
      this.tvWidget = new TradingView.widget({
        "autosize": true,
        "symbol": `BINANCE:${symbol}`,
        "interval": timeframe,
        "timezone": "Asia/Seoul",
        "theme": isDarkMode ? "dark" : "light",
        "style": "1",
        "locale": "ko",
        "toolbar_bg": isDarkMode ? "#1e222d" : "#f1f3f6",
        "enable_publishing": false,
        "hide_top_toolbar": true,
        "hide_legend": false,
        "hide_side_toolbar": false,
        "save_image": false,
        "container_id": "tradingview_chart",
        "disabled_features": [
          "use_localstorage_for_settings",
          "volume_force_overlay",
          "create_volume_indicator_by_default"
        ],
        "enabled_features": [
          "study_templates"
        ],
        "loading_screen": {
          "backgroundColor": isDarkMode ? "#1e222d" : "#ffffff",
          "foregroundColor": isDarkMode ? "#ffffff" : "#000000"
        },
        "overrides": {
          "paneProperties.background": isDarkMode ? "#1e222d" : "#ffffff",
          "paneProperties.vertGridProperties.color": isDarkMode ? "#363c4e" : "#e1e3e6",
          "paneProperties.horzGridProperties.color": isDarkMode ? "#363c4e" : "#e1e3e6"
        }
      });
      
    } catch (error) {
      console.error('TradingView 차트 초기화 실패:', error);
      // 백업 차트 표시
      chartContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary);">
          <div style="text-align: center;">
            <i class="fas fa-chart-line" style="font-size: 3rem; margin-bottom: 1rem;"></i>
            <div>차트를 불러오는 중...</div>
          </div>
        </div>
      `;
    }
  }
}

// 전역 함수들 (기존 코드와 호환성 유지)
window.changeTimeframe = function(timeframe) {
  if (window.tradingChartsManager) {
    window.tradingChartsManager.changeTimeframe(timeframe);
  }
};

window.changeChartSymbol = function(symbol) {
  // 로딩 표시
  const chartContainer = document.getElementById('tradingview_chart');
  if (chartContainer) {
    chartContainer.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary);">
        <div style="text-align: center;">
          <div class="loading-spinner" style="width: 40px; height: 40px; border: 3px solid var(--border-color); border-top: 3px solid var(--primary-color); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
          <div>차트 변경 중...</div>
        </div>
      </div>
    `;
  }
  
  // 새로운 심볼로 차트 재초기화 (현재 시간 프레임 유지)
  setTimeout(() => {
    if (window.tradingChartsManager) {
      window.tradingChartsManager.initializeTradingViewChart(symbol, '1');
    }
  }, 500);
};

// DOM 로드 후 초기화
document.addEventListener('DOMContentLoaded', () => {
  if (typeof TradingView !== 'undefined') {
    window.tradingChartsManager = new TradingChartsManager();
    console.log('📊 TradingView 차트 매니저 초기화 완료');
  } else {
    // TradingView 라이브러리가 로드될 때까지 대기
    const checkTradingView = setInterval(() => {
      if (typeof TradingView !== 'undefined') {
        clearInterval(checkTradingView);
        window.tradingChartsManager = new TradingChartsManager();
        console.log('📊 TradingView 차트 매니저 초기화 완료');
      }
    }, 100);
  }
}); 