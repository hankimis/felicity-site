// Index Page Optimized Script
// Performance-optimized version with lazy loading and memory management

class IndexPageManager {
  constructor() {
    this.initialized = false;
    this.swiperInstances = new Map();
    this.observers = new Set();
    this.eventListeners = new Map();
    
    // Bind methods to preserve context
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleResize = this.throttle(this.handleResize.bind(this), 250);
    
    this.init();
  }
  
  async init() {
    if (this.initialized) return;
    
    console.log('🚀 Initializing optimized index page...');
    
    // Initialize core functionality immediately
    this.setupPerformanceMonitoring();
    this.setupEventListeners();
    
    // Initialize Swiper only when needed
    this.setupIntersectionObserver();
    
    // Mark as initialized
    this.initialized = true;
    
    // Performance mark
    performance.mark('index-page-initialized');
  }
  
  setupPerformanceMonitoring() {
    // Monitor Core Web Vitals
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          switch (entry.entryType) {
            case 'largest-contentful-paint':
              console.log('📊 LCP:', entry.startTime.toFixed(2), 'ms');
              break;
            case 'cumulative-layout-shift':
              console.log('📊 CLS:', entry.value.toFixed(4));
              break;
            case 'first-input':
              console.log('📊 FID:', entry.processingStart - entry.startTime, 'ms');
              break;
          }
        }
      });
      
      try {
        observer.observe({entryTypes: ['largest-contentful-paint', 'cumulative-layout-shift', 'first-input']});
        this.observers.add(observer);
      } catch (e) {
        console.warn('Performance observer not fully supported:', e);
      }
    }
  }
  
  setupEventListeners() {
    // Use event delegation for better performance
    document.addEventListener('click', this.handleClick.bind(this), { passive: true });
    document.addEventListener('visibilitychange', this.handleVisibilityChange, { passive: true });
    window.addEventListener('resize', this.handleResize, { passive: true });
    
    // Store references for cleanup
    this.eventListeners.set('click', this.handleClick.bind(this));
    this.eventListeners.set('visibilitychange', this.handleVisibilityChange);
    this.eventListeners.set('resize', this.handleResize);
  }
  
  setupIntersectionObserver() {
    // Lazy load Swiper when carousel elements come into view
    const carouselElements = document.querySelectorAll('.swiper, .table-tabs');
    
    if (carouselElements.length === 0) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.loadSwiper();
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '50px' }
    );
    
    carouselElements.forEach(el => observer.observe(el));
    this.observers.add(observer);
  }
  
  async loadSwiper() {
    try {
      // Check if Swiper is already loaded
      if (window.Swiper) {
        this.initializeSliders();
        return;
      }
      
      console.log('📦 Loading Swiper library...');
      
      // Dynamic import for better performance
      if (typeof window.loadSwiper === 'function') {
        await window.loadSwiper();
      } else {
        // Fallback method
        await this.loadScript('https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js');
      }
      
      console.log('✅ Swiper loaded, initializing sliders...');
      this.initializeSliders();
      
    } catch (error) {
      console.error('❌ Failed to load Swiper:', error);
    }
  }
  
  loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  
  initializeSliders() {
    try {
      // Top banner swiper
      const topBannerEl = document.querySelector('.top-event-banner-swiper .swiper');
      if (topBannerEl && !this.swiperInstances.has('topBanner')) {
        const swiper = new Swiper(topBannerEl, {
          loop: true,
          autoplay: {
            delay: 5000,
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
          },
          pagination: {
            el: '.swiper-pagination',
            clickable: true,
          },
          navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
          },
          lazy: true,
          preloadImages: false,
          watchSlidesProgress: true,
        });
        
        this.swiperInstances.set('topBanner', swiper);
      }
      
      // Table tabs swiper
      const tableTabsEl = document.querySelector('.table-tabs');
      if (tableTabsEl && !this.swiperInstances.has('tableTabs')) {
        const swiper = new Swiper(tableTabsEl, {
          slidesPerView: 'auto',
          spaceBetween: 24,
          freeMode: true,
          mousewheel: {
            releaseOnEdges: true,
          },
        });
        
        this.swiperInstances.set('tableTabs', swiper);
      }
      
      // Setup table sorting after sliders are initialized
      this.setupTableSorting();
      
    } catch (error) {
      console.error('❌ Error initializing sliders:', error);
    }
  }
  
  setupTableSorting() {
    const tabsContainer = document.querySelector('.table-tabs .swiper-wrapper');
    const tableBody = document.querySelector('.exchange-table-wrapper tbody');
    
    if (!tableBody) return;
    
    const originalRows = Array.from(tableBody.querySelectorAll('tr'));
    
    if (!tabsContainer) return;
    
    // Use event delegation instead of individual listeners
    tabsContainer.addEventListener('click', (e) => {
      const tab = e.target.closest('.swiper-slide');
      if (!tab) return;
      
      this.handleTabClick(tab, tabsContainer, originalRows, tableBody);
    }, { passive: true });
  }
  
  handleTabClick(tab, tabsContainer, originalRows, tableBody) {
    // Remove active class from all tabs
    tabsContainer.querySelectorAll('.swiper-slide').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    const sortBy = tab.dataset.sort;
    let rowsToShow = [...originalRows];
    
    // Reset visibility
    rowsToShow.forEach(row => row.style.display = '');
    
    // Apply filters
    if (sortBy === 'recommended') {
      rowsToShow = rowsToShow.filter(row => 
        row.querySelector('.tag-cell')?.textContent.includes('추천')
      );
    } else if (sortBy === 'event') {
      rowsToShow = rowsToShow.filter(row => 
        row.querySelector('.tag.boost')
      );
    }
    
    // Apply sorting
    let sortedRows = this.sortRows(rowsToShow, sortBy);
    
    // Update DOM efficiently
    this.updateTableRows(originalRows, sortedRows, tableBody);
  }
  
  sortRows(rows, sortBy) {
    const parseValue = (text) => {
      if (!text) return -Infinity;
      const parsed = parseFloat(text.replace(/[^0-9.-]+/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    };
    
    switch (sortBy) {
      case 'payback':
        return rows.sort((a, b) => 
          parseValue(b.children[2]?.textContent) - parseValue(a.children[2]?.textContent)
        );
      case 'maker':
      case 'taker':
        return rows.sort((a, b) => 
          parseValue(a.children[4]?.textContent) - parseValue(b.children[4]?.textContent)
        );
      default:
        return rows;
    }
  }
  
  updateTableRows(originalRows, sortedRows, tableBody) {
    // Use DocumentFragment for efficient DOM manipulation
    const fragment = document.createDocumentFragment();
    
    // Hide all original rows
    originalRows.forEach(row => row.style.display = 'none');
    
    // Add sorted rows to fragment
    sortedRows.forEach(row => {
      row.style.display = '';
      fragment.appendChild(row);
    });
    
    // Single DOM update
    tableBody.appendChild(fragment);
  }
  
  handleClick(e) {
    // Handle modal close
    if (e.target.matches('[data-action="close-modal"]') || 
        e.target.closest('[data-action="close-modal"]')) {
      this.closeConsultModal();
    }
  }
  
  handleVisibilityChange() {
    // Pause/resume autoplay when page visibility changes
    if (document.hidden) {
      this.swiperInstances.forEach(swiper => {
        if (swiper.autoplay) swiper.autoplay.stop();
      });
    } else {
      this.swiperInstances.forEach(swiper => {
        if (swiper.autoplay) swiper.autoplay.start();
      });
    }
  }
  
  handleResize() {
    // Update Swiper instances on resize
    this.swiperInstances.forEach(swiper => {
      if (swiper.update) swiper.update();
    });
  }
  
  closeConsultModal() {
    const modal = document.getElementById('consult-modal');
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
  }
  
  // Utility: Throttle function for performance
  throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
  
  // Cleanup method for proper memory management
  destroy() {
    console.log('🧹 Cleaning up IndexPageManager...');
    
    // Destroy Swiper instances
    this.swiperInstances.forEach(swiper => {
      if (swiper.destroy) swiper.destroy(true, true);
    });
    this.swiperInstances.clear();
    
    // Disconnect observers
    this.observers.forEach(observer => {
      if (observer.disconnect) observer.disconnect();
    });
    this.observers.clear();
    
    // Remove event listeners
    this.eventListeners.forEach((handler, event) => {
      if (event === 'resize') {
        window.removeEventListener(event, handler);
      } else {
        document.removeEventListener(event, handler);
      }
    });
    this.eventListeners.clear();
    
    this.initialized = false;
  }
}

// Initialize page manager
let indexPageManager;

// Page-specific initialization function (called by header-loader.js)
function initializePage() {
  if (!indexPageManager) {
    indexPageManager = new IndexPageManager();
  }
}

// Global functions for backward compatibility
window.initializePage = initializePage;
window.closeConsultModal = () => {
  if (indexPageManager) {
    indexPageManager.closeConsultModal();
  }
};

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (indexPageManager) {
    indexPageManager.destroy();
  }
});

console.log('✅ Optimized index.js loaded successfully');

// Performance mark
performance.mark('index-script-loaded'); 