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
        isTransparent: false,
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
        chartOnly: false,
        width: "100%",
        height: "100%",
        locale: "kr",
        colorTheme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
        autosize: true,
        showVolume: true,
        lineColor: "rgba(41, 98, 255, 1)",
        "topColor": "rgba(41, 98, 255, 0.2)",
        "bottomColor": "rgba(41, 98, 255, 0)"
      }
    },
    'technical-analysis': {
      container: 'tradingview-technical-analysis',
      script: 'embed-widget-technical-analysis.js',
      config: {
        colorTheme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
        displayMode: "single",
        isTransparent: false,
        locale: "kr",
        interval: "1m",
        disableInterval: false,
        width: "100%",
        height: 500,
        symbol: "BINANCE:BTCUSDT",
        showIntervalTabs: true
      }
    }
  },

  // 위젯 초기화
  async initializeWidgets() {
    if (this.isInitialized) return;
    
    // 1. Ticker tape는 즉시 로드
    await this.createWidget('ticker-tape', this.widgetConfigs['ticker-tape']);
    
    // 2. 메인 대시보드 위젯들 로드
    await this.createWidget('btc-chart', this.widgetConfigs['btc-chart']);
    await new Promise(resolve => setTimeout(resolve, 200));
    await this.createWidget('technical-analysis', this.widgetConfigs['technical-analysis']);
    
    this.isInitialized = true;
  },

  // 개별 위젯 생성
  async createWidget(key, config) {
    try {
      const container = document.getElementById(config.container);
      if (!container) return;
      
      container.innerHTML = '';
      
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