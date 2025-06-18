// Index Page Specific Script

// 페이지별 초기화 함수 (header-loader.js에서 호출됨)
function initializePage() {
  console.log('Initializing index page...');
  
  // Swiper 라이브러리 로드 확인
  if (typeof Swiper === 'undefined') {
    console.log('Loading Swiper library...');
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js';
    script.onload = () => {
      console.log('Swiper loaded, initializing sliders...');
      initializeSliders();
    };
    document.head.appendChild(script);
  } else {
    console.log('Swiper already loaded, initializing sliders...');
    initializeSliders();
  }
}

function initializeSliders() {
  // Top banner swiper
  new Swiper('.top-event-banner-swiper .swiper', {
    loop: true,
    autoplay: {
      delay: 5000,
      disableOnInteraction: false,
    },
    pagination: {
      el: '.swiper-pagination',
      clickable: true,
    },
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
    },
  });

  // Table tabs swiper
  new Swiper('.table-tabs', {
    slidesPerView: 'auto',
    spaceBetween: 24,
    freeMode: true,
  });

  // Table sorting functionality
  setupTableSorting();
}

function setupTableSorting() {
  const tabsContainer = document.querySelector('.table-tabs .swiper-wrapper');
  const tableBody = document.querySelector('.exchange-table-wrapper tbody');
  
  if (tableBody) {
    const originalRows = Array.from(tableBody.querySelectorAll('tr'));
    
    function parseValue(text) {
      if (!text) return -Infinity;
      const parsed = parseFloat(text.replace(/[^0-9.-]+/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    }

    if(tabsContainer) {
        tabsContainer.addEventListener('click', (e) => {
            const tab = e.target.closest('.swiper-slide');
            if (!tab) return;
    
            tabsContainer.querySelectorAll('.swiper-slide').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
    
            const sortBy = tab.dataset.sort;
            let rowsToShow = [...originalRows];
    
            // First, reset all rows to be potentially visible
            rowsToShow.forEach(row => {
                row.style.display = '';
            });
    
            // Filter based on tab
            if (sortBy === 'recommended') {
                rowsToShow = rowsToShow.filter(row => row.querySelector('.tag-cell').textContent.includes('추천'));
            } else if (sortBy === 'event') {
                rowsToShow = rowsToShow.filter(row => row.querySelector('.tag.boost'));
            }
    
            let sortedRows;
            switch (sortBy) {
                case 'payback':
                    sortedRows = rowsToShow.sort((a, b) => parseValue(b.children[2].textContent) - parseValue(a.children[2].textContent));
                    break;
                case 'maker':
                    sortedRows = rowsToShow.sort((a, b) => parseValue(a.children[4].textContent) - parseValue(b.children[4].textContent));
                    break;
                case 'taker':
                    sortedRows = rowsToShow.sort((a, b) => parseValue(a.children[4].textContent) - parseValue(b.children[4].textContent));
                    break;
                default:
                    // For 'all', 'recommended', 'event' just use the filtered (or original) order
                    sortedRows = rowsToShow;
                    break;
            }
            
            // Hide all original rows first
            originalRows.forEach(row => {
                row.style.display = 'none';
            });
    
            // Append and show only the sorted/filtered rows
            sortedRows.forEach(row => {
                row.style.display = '';
                tableBody.appendChild(row);
            });
        });
    }
  }
}

// 상담 모달 관련 함수
function closeConsultModal() {
  const modal = document.getElementById('consult-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// 전역에서 접근 가능하도록 설정
window.initializePage = initializePage;
window.closeConsultModal = closeConsultModal;

console.log('Index.js loaded successfully'); 