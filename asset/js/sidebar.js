class SidebarManager {
  constructor() {
    this.isOpen = false;
    this.currentPage = null;
    this.init();
  }

  init() {
    this.createSidebar();
    this.bindEvents();
    this.loadPageFromURL();
  }

  createSidebar() {
    // 사이드바 생성
    const sidebar = document.createElement('div');
    sidebar.className = 'sidebar';
    sidebar.id = 'sidebar';
    sidebar.innerHTML = `
      <div class="sidebar-header">
        <div class="sidebar-title">지표</div>
      </div>
      <div class="sidebar-search">
        <input type="text" class="search-input" placeholder="지표 검색" id="sidebar-search">
      </div>
      <div class="sidebar-menu">
        <div class="menu-item" data-page="overview">
          <span class="menu-item-text">개요</span>
          <span class="menu-item-arrow">▶</span>
        </div>
        <div class="menu-item" data-page="market-indicators" data-has-submenu="true">
          <span class="menu-item-text">시장 지표</span>
          <span class="menu-item-arrow">▶</span>
        </div>
        <div class="submenu" data-parent="market-indicators" style="display: none;">
          <div class="menu-item" data-page="retail-activity">
            <span class="menu-item-text">비트코인: 선물 거래 빈도 급증에 따른 개인 투자자 활동</span>
            <span class="menu-item-arrow">▶</span>
          </div>
          <div class="menu-item" data-page="mvrv-ratio">
            <span class="menu-item-text">비트코인: MVRV 비율</span>
            <span class="menu-item-arrow">▶</span>
          </div>
          <div class="menu-item" data-page="taker-cvd">
            <span class="menu-item-text">비트코인: 선물 시장가 거래 누적 거래량 변화, 90일 (Taker CVD)</span>
            <span class="menu-item-arrow">▶</span>
          </div>
          <div class="menu-item" data-page="volume-bubble-map">
            <span class="menu-item-text">비트코인: 선물 Volume Bubble Map</span>
            <span class="menu-item-arrow">▶</span>
          </div>
        </div>
        <div class="menu-item" data-page="exchange-flow" data-has-submenu="true">
          <span class="menu-item-text">거래소 자금 흐름</span>
          <span class="menu-item-arrow">▶</span>
        </div>
        <div class="submenu" data-parent="exchange-flow" style="display: none;">
          <div class="menu-item" data-page="exchange-holdings">
            <span class="menu-item-text">비트코인: 거래소 보유량 - 전체 거래소</span>
            <span class="menu-item-arrow">▶</span>
          </div>
          <div class="menu-item" data-page="exchange-netflow">
            <span class="menu-item-text">비트코인: 거래소 순입출금량 (Netflow) - 전체 거래소</span>
            <span class="menu-item-arrow">▶</span>
          </div>
        </div>
        <div class="menu-item" data-page="derivatives" data-has-submenu="true">
          <span class="menu-item-text">파생 상품</span>
          <span class="menu-item-arrow">▶</span>
        </div>
        <div class="submenu" data-parent="derivatives" style="display: none;">
          <div class="menu-item" data-page="funding-rate">
            <span class="menu-item-text">비트코인: 펀딩비 - 전체 거래소</span>
            <span class="menu-item-arrow">▶</span>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(sidebar);

    // 메인 컨테이너에 클래스 추가
    const mainContainer = document.querySelector('.container') || document.body;
    mainContainer.classList.add('main-container', 'sidebar-open');
  }

  bindEvents() {
    // 메뉴 아이템 클릭
    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const page = e.currentTarget.dataset.page;
        const hasSubmenu = e.currentTarget.dataset.hasSubmenu;
        
        if (hasSubmenu) {
          this.toggleSubmenu(page);
        } else {
          this.navigateToPage(page);
        }
      });
    });

    // 검색 기능
    document.getElementById('sidebar-search').addEventListener('input', (e) => {
      this.filterMenuItems(e.target.value);
    });
  }

  toggleSubmenu(parentPage) {
    const submenu = document.querySelector(`[data-parent="${parentPage}"]`);
    const parentItem = document.querySelector(`[data-page="${parentPage}"]`);
    const arrow = parentItem.querySelector('.menu-item-arrow');
    
    if (submenu.style.display === 'none') {
      submenu.style.display = 'block';
      arrow.textContent = '▼';
      parentItem.classList.add('active');
    } else {
      submenu.style.display = 'none';
      arrow.textContent = '▶';
      parentItem.classList.remove('active');
    }
  }

  // 사이드바는 항상 열려있음
  toggleSidebar() {
    // 사용하지 않음
  }

  openSidebar() {
    // 사용하지 않음
  }

  closeSidebar() {
    // 사용하지 않음
  }

  navigateToPage(page) {
    // 현재 활성 메뉴 아이템 업데이트
    document.querySelectorAll('.menu-item').forEach(item => {
      item.classList.remove('active');
    });
    
    const activeItem = document.querySelector(`[data-page="${page}"]`);
    if (activeItem) {
      activeItem.classList.add('active');
    }

    // 페이지별 라우팅 (현재 페이지가 아닌 경우에만 이동)
    const currentPath = window.location.pathname;
    let shouldNavigate = false;
    
    switch (page) {
      case 'overview':
        if (!currentPath.includes('/')) {
          shouldNavigate = true;
        }
        break;
      case 'retail-activity':
        if (!currentPath.includes('/asset/retailactivity/')) {
          shouldNavigate = true;
        }
        break;
      case 'exchange-holdings':
        if (!currentPath.includes('/asset/exchange-holdings/')) {
          shouldNavigate = true;
        }
        break;
      case 'mvrv-ratio':
        if (!currentPath.includes('/asset/mvrv-ratio/')) {
          shouldNavigate = true;
        }
        break;
      case 'taker-cvd':
        if (!currentPath.includes('/asset/taker-cvd/')) {
          shouldNavigate = true;
        }
        break;
      case 'volume-bubble-map':
        if (!currentPath.includes('/asset/volume-bubble-map/')) {
          shouldNavigate = true;
        }
        break;
      case 'exchange-netflow':
        if (!currentPath.includes('/asset/exchange-netflow/')) {
          shouldNavigate = true;
        }
        break;
      case 'funding-rate':
        if (!currentPath.includes('/asset/funding-rate/')) {
          shouldNavigate = true;
        }
        break;
      case 'exchange-flow':
        this.loadExchangeFlow();
        break;
      // 다른 페이지들도 여기에 추가
      default:
        if (!currentPath.includes('/')) {
          shouldNavigate = true;
        }
        break;
    }

    // 현재 페이지가 아닌 경우에만 이동
    if (shouldNavigate) {
      switch (page) {
        case 'overview':
          this.loadOverview();
          break;
        case 'retail-activity':
          this.loadRetailActivity();
          break;
        case 'exchange-holdings':
          this.loadExchangeHoldings();
          break;
        case 'mvrv-ratio':
          this.loadMVRVRatio();
          break;
        case 'taker-cvd':
          this.loadTakerCVD();
          break;
        case 'volume-bubble-map':
          this.loadVolumeBubbleMap();
          break;
        case 'exchange-netflow':
          this.loadExchangeNetflow();
          break;
        case 'funding-rate':
          this.loadFundingRate();
          break;
      }
    }

    this.currentPage = page;
  }

  loadOverview() {
    // 메인 페이지 내용 로드
    window.location.href = '/';
  }

  loadRetailActivity() {
    // 개인 투자자 활동 페이지 로드
    window.location.href = '/asset/retailactivity/';
  }

  loadExchangeHoldings() {
    // 거래소 보유량 페이지 로드
    window.location.href = '/asset/exchange-holdings/';
  }

  loadMVRVRatio() {
    // MVRV 비율 페이지 로드
    window.location.href = '/asset/mvrv-ratio/';
  }

  loadTakerCVD() {
    // Taker CVD 페이지 로드
    window.location.href = '/asset/taker-cvd/';
  }

  loadVolumeBubbleMap() {
    // Volume Bubble Map 페이지 로드
    window.location.href = '/asset/volume-bubble-map/';
  }

  loadExchangeNetflow() {
    // 거래소 순입출금량 페이지 로드
    window.location.href = '/asset/exchange-netflow/';
  }

  loadFundingRate() {
    // 펀딩비 페이지 로드
    window.location.href = '/asset/funding-rate/';
  }

  loadExchangeFlow() {
    // 거래소 자금 흐름 페이지 (향후 구현)
    console.log('거래소 자금 흐름 페이지 로드');
  }

  filterMenuItems(searchTerm) {
    const menuItems = document.querySelectorAll('.menu-item');
    
    menuItems.forEach(item => {
      const text = item.querySelector('.menu-item-text').textContent.toLowerCase();
      const matches = text.includes(searchTerm.toLowerCase());
      
      if (matches || searchTerm === '') {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  }

  updateURL(page) {
    // URL 업데이트는 사용하지 않음 (무한 루프 방지)
    // const url = new URL(window.location);
    // url.searchParams.set('page', page);
    // window.history.pushState({}, '', url);
  }

  loadPageFromURL() {
    // 현재 페이지 경로에 따라 활성 메뉴만 설정 (페이지 이동 없음)
    const currentPath = window.location.pathname;
    let activePage = 'overview';
    
    if (currentPath.includes('/asset/retailactivity/')) {
      activePage = 'retail-activity';
    } else if (currentPath.includes('/asset/exchange-holdings/')) {
      activePage = 'exchange-holdings';
    } else if (currentPath.includes('/asset/mvrv-ratio/')) {
      activePage = 'mvrv-ratio';
    } else if (currentPath.includes('/asset/taker-cvd/')) {
      activePage = 'taker-cvd';
    } else if (currentPath.includes('/asset/exchange-netflow/')) {
      activePage = 'exchange-netflow';
    } else if (currentPath.includes('/asset/funding-rate/')) {
      activePage = 'funding-rate';
    } else if (currentPath.includes('/asset/volume-bubble-map/')) {
      activePage = 'volume-bubble-map';
    }
    
    // 활성 메뉴 아이템만 설정
    document.querySelectorAll('.menu-item').forEach(item => {
      item.classList.remove('active');
    });
    
    const activeItem = document.querySelector(`[data-page="${activePage}"]`);
    if (activeItem) {
      activeItem.classList.add('active');
    }
    
    this.currentPage = activePage;
  }
}

// 페이지 로드 시 사이드바 매니저 초기화
document.addEventListener('DOMContentLoaded', () => {
  // 메인페이지(index.html)에서는 사이드바를 표시하지 않음
  const currentPath = window.location.pathname;
  const isMainPage = currentPath === '/' || currentPath === '/index.html' || currentPath.endsWith('/');
  
  if (!isMainPage) {
    new SidebarManager();
  }
}); 