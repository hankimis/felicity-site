/**
 * TradingView Widgets Configuration and Management
 */

// TradingView 위젯 관리 시스템
window.TradingViewManager = {
  widgets: {},
  isInitialized: false,
  
  // 위젯 설정 정의
  widgetConfigs: {
    'ticker-tape': {
      container: 'tradingview-ticker-tape',
      script: 'embed-widget-ticker-tape.js',
      config: {
        symbols: [
          { proName: "FOREXCOM:SPXUSD", title: "S&P 500" },
          { proName: "FOREXCOM:NSXUSD", title: "나스닥" },
          { proName: "FX_IDC:EURUSD", title: "EUR/USD" },
          { proName: "BITSTAMP:BTCUSD", title: "비트코인" },
          { proName: "BITSTAMP:ETHUSD", title: "이더리움" },
          { proName: "BINANCE:BNBUSDT", title: "BNB" },
          { proName: "BINANCE:ADAUSDT", title: "카르다노" },
          { proName: "BINANCE:DOTUSDT", title: "폴카닷" }
        ],
        showSymbolLogo: true,
        isTransparent: true,
        displayMode: "adaptive",
        colorTheme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
        locale: "kr",
        width: "100%",
        height: 46
      }
    },
    'btc-chart': {
      container: 'tradingview-btc-chart',
      script: 'embed-widget-symbol-overview.js',
      config: {
        symbols: [["BINANCE:BTCUSD|1M"]],
        chartOnly: true,
        width: "100%",
        height: "100%",
        locale: "kr",
        colorTheme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
        autosize: true,
        isTransparent: true,
        showVolume: true,
        lineColor: "rgba(41, 98, 255, 1)",
        "topColor": "rgba(41, 98, 255, 0.2)",
        "bottomColor": "rgba(41, 98, 255, 0)"
      }
    },
    'eth-chart': {
      container: 'tradingview-eth-chart',
      script: 'embed-widget-symbol-overview.js',
      config: {
        symbols: [["BINANCE:ETHUSD|1M"]],
        chartOnly: true,
        width: "100%",
        height: "100%",
        locale: "kr",
        colorTheme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
        autosize: true,
        isTransparent: true,
        showVolume: true,
        lineColor: "rgba(16, 185, 129, 1)",
        "topColor": "rgba(16, 185, 129, 0.2)",
        "bottomColor": "rgba(16, 185, 129, 0)"
      }
    },
    // technical-analysis 위젯은 롱/숏 게이지로 대체되었습니다
  },

  // 위젯 초기화
  async initializeWidgets() {
    if (this.isInitialized) return;
    
    // 1. Ticker tape는 즉시 로드
    await this.createWidget('ticker-tape', this.widgetConfigs['ticker-tape']);
    
    // 2. 메인 대시보드 위젯들 로드 (BTC + ETH 그리드)
    await this.createWidget('btc-chart', this.widgetConfigs['btc-chart']);
    await this.createWidget('eth-chart', this.widgetConfigs['eth-chart']);
    await new Promise(resolve => setTimeout(resolve, 200));
    
    this.isInitialized = true;
  },

  // 개별 위젯 생성
  async createWidget(key, config) {
    try {
      const container = document.getElementById(config.container);
      if (!container) return;
      
      container.innerHTML = '';
      try {
        const card = container.closest('.bitcoin-chart-card');
        if (card) {
          container.style.height = 'auto';
          // 모바일에서 차트 컨테이너가 폭을 밀어내는 현상 방지
          card.style.maxWidth = '100%';
          card.style.overflow = 'hidden';
          const grid = card.querySelector('.tv-grid');
          if (grid) {
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = window.matchMedia('(max-width: 768px)').matches ? '1fr' : '1fr 1fr';
          }
        }
      } catch(_) {}
      
      const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const updatedConfig = {
        ...config.config,
        colorTheme: currentTheme
      };
      
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = `https://s3.tradingview.com/external-embedding/${config.script}`;
      script.async = true;
      
      const configJson = JSON.stringify(updatedConfig, null, 2);
      script.textContent = configJson;
      
      container.appendChild(script);
      
      this.widgets[key] = script;
      
    } catch (error) {
    }
  },

  // 심볼 변경 API (왼쪽 BTC/오른쪽 ETH만 지원)
  setChartSymbol(tvSymbol) {
    const isBTC = /BTC/.test(tvSymbol);
    const key = isBTC ? 'btc-chart' : 'eth-chart';
    const cfg = this.widgetConfigs[key];
    if (!cfg) return;
    const newCfg = JSON.parse(JSON.stringify(cfg));
    newCfg.config.symbols = [[`${tvSymbol}|1M`]];
    this.createWidget(key, newCfg);
  },

  // 테마 변경 시 위젯 업데이트
  updateWidgetTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    Object.keys(this.widgets).forEach(key => {
      const config = this.widgetConfigs[key];
      if (config) {
        this.createWidget(key, config);
      }
    });
  }
};

// 페이지 로드 시 위젯 초기화
if (document.readyState === 'complete') {
  window.TradingViewManager.initializeWidgets();
} else {
  window.addEventListener('load', () => {
    window.TradingViewManager.initializeWidgets();
  });
}

// 테마 변경 감지
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
      setTimeout(() => {
        if (window.TradingViewManager && window.TradingViewManager.updateWidgetTheme) {
          window.TradingViewManager.updateWidgetTheme();
        }
      }, 100);
    }
  });
});

observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-theme']
});