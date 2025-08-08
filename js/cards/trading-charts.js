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
    
    // 전역 차트 심볼 변경 함수 호출
    if (typeof changeChartSymbol === 'function') {
      changeChartSymbol(symbol);
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
          // 무시
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
          "widget_logo"
        ],
        "enabled_features": [
          "study_templates",
          "items_favoriting",                  // 즐겨찾기 기능 활성화
          "favorites_in_search",               // 검색에서 즐겨찾기 표시
          "symbol_info",                       // 심볼 정보 표시
          "header_indicators",                 // 헤더 지표 메뉴
          "header_chart_type",                 // 헤더 차트 타입 선택
          "header_resolutions",                // 헤더 시간봉 선택
          "header_settings",                   // 헤더 설정 메뉴
          "header_undo_redo",                  // 실행 취소/다시 실행
          "header_screenshot",                 // 스크린샷 기능
          "header_fullscreen_button",          // 전체화면 버튼
          "left_toolbar",                      // 왼쪽 도구 모음
          "control_bar",                       // 컨트롤 바
          "timeframes_toolbar",                // 시간봉 도구 모음
          "edit_buttons_in_legend",            // 범례에서 편집 버튼
          "context_menus",                     // 우클릭 메뉴
          "use_localstorage_for_settings",     // 설정 로컬 저장
          "save_chart_properties_to_local_storage", // 차트 속성 로컬 저장
          "chart_property_page_style",         // 차트 속성 페이지
          "chart_property_page_scales",        // 스케일 속성 페이지
          "chart_property_page_background",    // 배경 속성 페이지
          "property_pages",                    // 속성 페이지
          "show_chart_property_page",          // 차트 속성 페이지 표시
          "chart_property_page_trading",       // 거래 속성 페이지
          "go_to_date",                        // 날짜로 이동
          "adaptive_logo",                     // 적응형 로고
          "chart_zoom",                        // 차트 줌
          "source_selection_markers",          // 소스 선택 마커
          "legend_context_menu",               // 범례 우클릭 메뉴
          "show_interval_dialog_on_key_press", // 키 누르면 시간봉 대화상자
          "create_volume_indicator_by_default_once", // 볼륨 지표 한번만 생성
          "study_dialog_search_control",       // 지표 대화상자 검색
          "side_toolbar_in_fullscreen_mode",   // 전체화면에서 사이드바
          "header_in_fullscreen_mode",         // 전체화면에서 헤더
          "chart_style_hilo",                  // 하이-로우 차트 스타일
          "chart_style_hilo_last_price",       // 하이-로우 마지막 가격
          "remove_library_container_border",   // 라이브러리 컨테이너 테두리 제거
          "chart_crosshair_menu",              // 차트 십자선 메뉴
          "pane_context_menu",                 // 패널 우클릭 메뉴
          "scales_context_menu",               // 스케일 우클릭 메뉴
          "show_logo_on_all_charts",           // 모든 차트에 로고 표시
          "cl_feed_return_all_data",           // 모든 데이터 반환
          "chart_template_storage",            // 차트 템플릿 저장
          "snapshot_trading_drawings",         // 거래 그림 스냅샷
          "study_on_study",                    // 지표 위에 지표
          "header_saveload",                   // 헤더 저장/불러오기
          "header_layouttoggle",               // 헤더 레이아웃 토글
          "legend_widget",                     // 범례 위젯
          "compare_symbol",                    // 심볼 비교
          "symbol_search_parser_mismatch",     // 심볼 검색 파서 불일치
          "display_market_status",             // 시장 상태 표시
          "countdown",                         // 카운트다운
          "show_dom_first_time",               // DOM 첫 표시
          "trading_notifications",             // 거래 알림
          "chart_events",                      // 차트 이벤트
          "format_buttons_in_legend",          // 범례 포맷 버튼
          "study_buttons_in_legend",           // 범례 지표 버튼
          "show_hide_button_in_legend",        // 범례 숨기기/보이기 버튼
          "modify_buttons_in_legend",          // 범례 수정 버튼
          "format_button",                     // 포맷 버튼
          "study_dialog_fundamentals_economy_addons", // 펀더멘털 경제 추가기능
          "uppercase_instrument_names",        // 대문자 종목명
          "popup_hints",                       // 팝업 힌트
          "volume_force_overlay",              // 볼륨 오버레이
          "create_volume_indicator_by_default" // 기본 볼륨 지표
        ],
        "favorites": {
          "intervals": ["1", "5", "15", "30", "1H", "4H", "1D", "1W"],
          "indicators": [
            "Moving Average",
            "Bollinger Bands", 
            "RSI",
            "MACD",
            "Volume",
            "Awesome Oscillator",
            "Stochastic",
            "Average True Range",
            "Ichimoku Cloud",
            "Parabolic SAR"
          ],
          "chartTypes": ["Area", "Candles", "Line", "Bars"],
          "drawingTools": [
            "LineToolTrendLine",
            "LineToolHorzLine", 
            "LineToolVertLine",
            "LineToolRectangle",
            "LineToolCircle",
            "LineToolFibRetracement",
            "LineToolText",
            "LineToolArrow"
          ]
        },
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
  } else {
    // TradingView 라이브러리가 로드될 때까지 대기
    const checkTradingView = setInterval(() => {
      if (typeof TradingView !== 'undefined') {
        clearInterval(checkTradingView);
        window.tradingChartsManager = new TradingChartsManager();
      }
    }, 100);
  }
}); 