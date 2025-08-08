/**
 * Mobile Dashboard Slider
 */

// 모바일 대시보드 슬라이더 관리
function initMobileDashboardSlider() {
  const isMobile = window.innerWidth <= 768;
  if (!isMobile) return;

  const grid = document.getElementById('dashboard-grid');
  const indicatorsContainer = document.getElementById('dashboard-indicators');
  
  if (!grid || !indicatorsContainer) return;

  const cards = grid.querySelectorAll('.dashboard-card');
  let currentIndex = 0;

  // 인디케이터 생성
  function createIndicators() {
    indicatorsContainer.innerHTML = '';
    cards.forEach((_, index) => {
      const indicator = document.createElement('div');
      indicator.className = `dashboard-indicator ${index === 0 ? 'active' : ''}`;
      indicator.addEventListener('click', () => scrollToCard(index));
      indicatorsContainer.appendChild(indicator);
    });
  }

  // 특정 카드로 스크롤
  function scrollToCard(index) {
    if (index < 0 || index >= cards.length) return;
    
    currentIndex = index;
    const card = cards[index];
    const cardWidth = card.offsetWidth;
    const gap = 15; // CSS gap과 동일
    const scrollPosition = (cardWidth + gap) * index;
    
    grid.scrollTo({
      left: scrollPosition,
      behavior: 'smooth'
    });
    
    updateIndicators();
  }

  // 인디케이터 업데이트
  function updateIndicators() {
    const indicators = indicatorsContainer.querySelectorAll('.dashboard-indicator');
    indicators.forEach((indicator, index) => {
      indicator.classList.toggle('active', index === currentIndex);
    });
  }

  // 스크롤 이벤트로 현재 인덱스 감지
  function handleScroll() {
    const scrollLeft = grid.scrollLeft;
    const cardWidth = cards[0].offsetWidth;
    const gap = 15;
    const newIndex = Math.round(scrollLeft / (cardWidth + gap));
    
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < cards.length) {
      currentIndex = newIndex;
      updateIndicators();
    }
  }

  grid.addEventListener('scroll', handleScroll);

  // 터치 제스처 지원
  let startX = 0;
  let scrollLeft = 0;

  grid.addEventListener('touchstart', (e) => {
    startX = e.touches[0].pageX - grid.offsetLeft;
    scrollLeft = grid.scrollLeft;
  });

  grid.addEventListener('touchmove', (e) => {
    if (!startX) return;
    e.preventDefault();
    const x = e.touches[0].pageX - grid.offsetLeft;
    const walk = (x - startX) * 2;
    grid.scrollLeft = scrollLeft - walk;
  });

  grid.addEventListener('touchend', () => {
    startX = 0;
    // 스냅 효과를 위해 가장 가까운 카드로 스크롤
    setTimeout(handleScroll, 100);
  });

  // 초기화
  createIndicators();

  console.log('📱 모바일 대시보드 슬라이더 초기화 완료');
}

// 화면 크기 변경 감지
window.addEventListener('resize', () => {
  // 모바일에서 데스크톱으로 변경되면 슬라이더 비활성화
  const isMobile = window.innerWidth <= 768;
  const indicators = document.getElementById('dashboard-indicators');
  
  if (!isMobile) {
    if (indicators) indicators.style.display = 'none';
  } else {
    if (indicators) indicators.style.display = 'flex';
    // 슬라이더 재초기화
    setTimeout(initMobileDashboardSlider, 100);
  }
});