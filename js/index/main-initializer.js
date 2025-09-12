/**
 * Main Page Initializer
 */

// 스크립트 로딩 오류 처리
window.addEventListener('error', function(e) {
  if (e.target.tagName === 'SCRIPT') {
    console.warn('스크립트 로딩 실패:', e.target.src);
  }
});

// 페이지 초기화
document.addEventListener('DOMContentLoaded', function() {
  
  // 페이지별 초기화 함수 호출
  if (typeof initializePage === 'function') {
    initializePage();
  }

  // TradingView 심볼 탭
  try {
    const tabs = document.getElementById('tv-coin-tabs');
    if (tabs) {
      tabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.tv-tab');
        if (!btn) return;
        tabs.querySelectorAll('.tv-tab').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        const sym = btn.getAttribute('data-sym');
        if (sym && window.TradingViewManager && window.TradingViewManager.setChartSymbol) {
          window.TradingViewManager.setChartSymbol(sym);
        }
      });
    }
  } catch(_) {}

  // 홈 로그인 카드 잔액 탭 스위칭
  try {
    const tabsRoot = document.getElementById('home-balance-tabs');
    if (tabsRoot) {
      const tabs = tabsRoot.querySelectorAll('.tab-list .tab');
      const panels = tabsRoot.querySelectorAll('.tab-panels .tab-panel');
      const repositionTooltip = (infoEl) => {
        try {
          const rect = infoEl.getBoundingClientRect();
          const tip = infoEl.getAttribute('data-tip') || '';
          infoEl.style.setProperty('--tip-left', rect.left + rect.width/2 + 'px');
        } catch(_) {}
      };
      tabs.forEach((btn)=>{
        btn.addEventListener('click', ()=>{
          const key = btn.getAttribute('data-tab');
          tabs.forEach(b=>b.classList.remove('active'));
          btn.classList.add('active');
          panels.forEach(p=>{
            p.classList.toggle('active', p.getAttribute('data-panel') === key);
          });
        });
      });
      tabsRoot.querySelectorAll('.amount .info').forEach((el)=>{
        el.addEventListener('mouseenter', ()=>repositionTooltip(el));
        el.addEventListener('mousemove', ()=>repositionTooltip(el));
      });
    }
  } catch (_) {}
});

// 페이지 로드 후 초기화
let dashboard;
let cryptoTable;

// 대시보드 초기화 함수
function initializeDashboard() {
  
  // 대시보드 초기화
  try {
    dashboard = new Dashboard();
  } catch (error) {
    console.error('Dashboard 초기화 실패:', error);
  }
  
  // 코인 테이블 즉시 초기화 (지연 제거)
  try {
    cryptoTable = new CryptoTable();
  } catch (error) {
    console.error('CryptoTable 초기화 실패:', error);
  }
}

// 즉시 대시보드 초기화 (Firebase 의존성 제거)
document.addEventListener('DOMContentLoaded', function() {
  initializeDashboard();
});

// 모바일 대시보드 슬라이더 초기화
document.addEventListener('DOMContentLoaded', function() {
  initMobileDashboardSlider();
});