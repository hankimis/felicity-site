/**
 * Dashboard Management
 */

// 대시보드 관리 클래스
class Dashboard {
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
  }
  
  changeSymbol(symbol) {
    this.currentSymbol = symbol;
    console.log('심볼 변경:', symbol);
    console.log('차트 심볼 변경:', symbol);
  }
}

// 다크모드 초기화
function initializeDarkMode() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  const themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    });
  }
}

// WhaleTracker 초기화
window.initializeWhaleTracker = () => {
  if (typeof window.WhaleTracker !== 'undefined') {
    try {
      window.whaleTracker = new window.WhaleTracker();
      console.log('✅ WhaleTracker 초기화 완료');
    } catch (error) {
      console.error('❌ WhaleTracker 초기화 실패:', error);
    }
  }
};

// 모듈 로드 완료 이벤트 리스너
window.addEventListener('moduleLoaded', (event) => {
  if (event.detail.moduleName === 'WhaleTracker') {
    window.initializeWhaleTracker();
  }
});

// 다크모드 초기화 실행
initializeDarkMode();