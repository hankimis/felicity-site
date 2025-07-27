class SidebarManager {
  constructor() {
    this.init();
  }

  init() {
    this.bindEvents();
    this.setActiveMenuItem();
  }

  bindEvents() {
    // 서브메뉴 토글 이벤트
    document.addEventListener('click', (e) => {
      if (e.target.closest('.nav-link') && e.target.closest('.nav-link').onclick) {
        return; // onclick이 있는 경우는 이미 처리됨
      }
    });
  }

  setActiveMenuItem() {
    const currentPath = window.location.pathname;
    const navItems = document.querySelectorAll('.nav-item');
    const submenuItems = document.querySelectorAll('.submenu-item');

    // 모든 활성 상태 제거
    navItems.forEach(item => item.classList.remove('active'));
    submenuItems.forEach(item => item.classList.remove('active'));

    // 현재 페이지에 맞는 메뉴 활성화
    if (currentPath === '/' || currentPath === '/index.html') {
      // 홈 페이지
      const homeItem = document.querySelector('.nav-item:first-child');
      if (homeItem) homeItem.classList.add('active');
    } else if (currentPath.includes('/asset/mvrv-ratio/')) {
      // MVRV 페이지
      const marketIndicatorsItem = document.querySelector('.nav-item:nth-child(2)');
      const mvrvSubmenuItem = document.querySelector('.submenu-item[href*="mvrv-ratio"]');
      
      if (marketIndicatorsItem) {
        marketIndicatorsItem.classList.add('active');
        // 서브메뉴 열기
        const submenu = document.getElementById('market-indicators-submenu');
        const toggle = document.getElementById('market-indicators-toggle');
        if (submenu && toggle) {
          submenu.classList.add('open');
          toggle.classList.add('rotated');
        }
      }
      if (mvrvSubmenuItem) mvrvSubmenuItem.classList.add('active');
    }
  }
}

// 전역 함수로 서브메뉴 토글 함수 추가
window.toggleSubmenu = function(menuId) {
  const submenu = document.getElementById(menuId + '-submenu');
  const toggle = document.getElementById(menuId + '-toggle');
  
  if (submenu && toggle) {
    const isOpen = submenu.classList.contains('open');
    
    // 모든 서브메뉴 닫기
    document.querySelectorAll('.submenu').forEach(menu => {
      menu.classList.remove('open');
    });
    document.querySelectorAll('.menu-toggle').forEach(btn => {
      btn.classList.remove('rotated');
    });
    
    // 클릭한 메뉴가 닫혀있었다면 열기
    if (!isOpen) {
      submenu.classList.add('open');
      toggle.classList.add('rotated');
    }
  }
};

// 페이지 로드 시 사이드바 매니저 초기화
document.addEventListener('DOMContentLoaded', () => {
  if (typeof SidebarManager !== 'undefined') {
    window.sidebarManager = new SidebarManager();
  }
}); 