// Performance Monitor Module
// Tracks Core Web Vitals and page performance metrics

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      lcp: null,
      fid: null,
      cls: null,
      ttfb: null,
      fcp: null
    };
    
    this.observers = new Set();
    this.startTime = performance.now();
    this.resourceLoadTimes = new Map();
    
    this.init();
  }
  
  init() {
    console.log('📊 Performance Monitor initialized');
    
    // Initialize all performance observers
    this.setupCoreWebVitals();
    this.setupResourceTiming();
    this.setupNavigationTiming();
    
    // Log initial page load performance
    this.logInitialMetrics();
    
    // Setup periodic memory monitoring
    this.setupMemoryMonitoring();
  }
  
  setupCoreWebVitals() {
    if (!('PerformanceObserver' in window)) {
      console.warn('PerformanceObserver not supported');
      return;
    }
    
    // Largest Contentful Paint (LCP)
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        
        this.metrics.lcp = Math.round(lastEntry.startTime);
        console.log(`📊 LCP: ${this.metrics.lcp}ms`);
        
        this.reportMetric('lcp', this.metrics.lcp);
      });
      
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.add(lcpObserver);
    } catch (e) {
      console.warn('LCP observer failed:', e);
    }
    
    // First Input Delay (FID)
    try {
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.metrics.fid = Math.round(entry.processingStart - entry.startTime);
          console.log(`📊 FID: ${this.metrics.fid}ms`);
          
          this.reportMetric('fid', this.metrics.fid);
        }
      });
      
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.add(fidObserver);
    } catch (e) {
      console.warn('FID observer failed:', e);
    }
    
    // Cumulative Layout Shift (CLS)
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        
        this.metrics.cls = Math.round(clsValue * 1000) / 1000;
        console.log(`📊 CLS: ${this.metrics.cls}`);
        
        this.reportMetric('cls', this.metrics.cls);
      });
      
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.add(clsObserver);
    } catch (e) {
      console.warn('CLS observer failed:', e);
    }
    
    // First Contentful Paint (FCP)
    try {
      const fcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.fcp = Math.round(entry.startTime);
            console.log(`📊 FCP: ${this.metrics.fcp}ms`);
            
            this.reportMetric('fcp', this.metrics.fcp);
          }
        }
      });
      
      fcpObserver.observe({ entryTypes: ['paint'] });
      this.observers.add(fcpObserver);
    } catch (e) {
      console.warn('FCP observer failed:', e);
    }
  }
  
  setupResourceTiming() {
    if (!('PerformanceObserver' in window)) return;
    
    try {
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const duration = Math.round(entry.duration);
          const type = this.getResourceType(entry.name);
          
          if (duration > 100) { // Only log slow resources
            console.log(`📦 ${type}: ${entry.name.split('/').pop()} - ${duration}ms`);
          }
          
          this.resourceLoadTimes.set(entry.name, {
            duration,
            type,
            size: entry.transferSize || 0
          });
        }
      });
      
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.add(resourceObserver);
    } catch (e) {
      console.warn('Resource timing observer failed:', e);
    }
  }
  
  setupNavigationTiming() {
    // Log navigation timing after page load
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        if (navigation) {
          this.metrics.ttfb = Math.round(navigation.responseStart - navigation.requestStart);
          
          console.log('📊 Navigation Timing:');
          console.log(`  TTFB: ${this.metrics.ttfb}ms`);
          console.log(`  DOM Load: ${Math.round(navigation.domContentLoadedEventEnd - navigation.navigationStart)}ms`);
          console.log(`  Page Load: ${Math.round(navigation.loadEventEnd - navigation.navigationStart)}ms`);
          
          this.reportMetric('ttfb', this.metrics.ttfb);
        }
      }, 0);
    });
  }
  
  setupMemoryMonitoring() {
    if (!('memory' in performance)) return;
    
    // Log memory usage every 30 seconds
    setInterval(() => {
      const memory = performance.memory;
      const usedMB = Math.round(memory.usedJSHeapSize / 1048576);
      const totalMB = Math.round(memory.totalJSHeapSize / 1048576);
      const limitMB = Math.round(memory.jsHeapSizeLimit / 1048576);
      
      if (usedMB > 50) { // Only log if using significant memory
        console.log(`🧠 Memory: ${usedMB}MB / ${totalMB}MB (limit: ${limitMB}MB)`);
      }
      
      // Warn if memory usage is high
      if (usedMB / limitMB > 0.8) {
        console.warn('⚠️ High memory usage detected!');
        this.reportMetric('memory-warning', usedMB);
      }
    }, 30000);
  }
  
  getResourceType(url) {
    if (url.includes('.css')) return 'CSS';
    if (url.includes('.js')) return 'JS';
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return 'Image';
    if (url.match(/\.(woff|woff2|ttf|otf)$/i)) return 'Font';
    return 'Other';
  }
  
  logInitialMetrics() {
    // Log performance marks
    const marks = performance.getEntriesByType('mark');
    marks.forEach(mark => {
      console.log(`📍 ${mark.name}: ${Math.round(mark.startTime)}ms`);
    });
    
    // Log page load progress
    console.log(`📊 Script loaded in: ${Math.round(performance.now() - this.startTime)}ms`);
  }
  
  reportMetric(name, value) {
    // This could be extended to send metrics to analytics service
    // For now, just store in sessionStorage for debugging
    try {
      const metrics = JSON.parse(sessionStorage.getItem('performance-metrics') || '{}');
      metrics[name] = value;
      metrics.timestamp = Date.now();
      sessionStorage.setItem('performance-metrics', JSON.stringify(metrics));
    } catch (e) {
      // Ignore storage errors
    }
  }
  
  // Public method to get current metrics
  getMetrics() {
    return {
      ...this.metrics,
      pageLoadTime: Math.round(performance.now() - this.startTime),
      resourceCount: this.resourceLoadTimes.size
    };
  }
  
  // Public method to get performance summary
  getSummary() {
    const metrics = this.getMetrics();
    
    return {
      coreWebVitals: {
        lcp: metrics.lcp ? `${metrics.lcp}ms ${this.getLCPRating(metrics.lcp)}` : 'Not measured',
        fid: metrics.fid ? `${metrics.fid}ms ${this.getFIDRating(metrics.fid)}` : 'Not measured',
        cls: metrics.cls ? `${metrics.cls} ${this.getCLSRating(metrics.cls)}` : 'Not measured'
      },
      loadingMetrics: {
        fcp: metrics.fcp ? `${metrics.fcp}ms` : 'Not measured',
        ttfb: metrics.ttfb ? `${metrics.ttfb}ms` : 'Not measured',
        pageLoadTime: `${metrics.pageLoadTime}ms`
      },
      resources: {
        totalResources: metrics.resourceCount,
        slowResources: Array.from(this.resourceLoadTimes.entries())
          .filter(([_, data]) => data.duration > 500)
          .length
      }
    };
  }
  
  // Rating helpers
  getLCPRating(lcp) {
    if (lcp <= 2500) return '🟢 Good';
    if (lcp <= 4000) return '🟡 Needs Improvement';
    return '🔴 Poor';
  }
  
  getFIDRating(fid) {
    if (fid <= 100) return '🟢 Good';
    if (fid <= 300) return '🟡 Needs Improvement';
    return '🔴 Poor';
  }
  
  getCLSRating(cls) {
    if (cls <= 0.1) return '🟢 Good';
    if (cls <= 0.25) return '🟡 Needs Improvement';
    return '🔴 Poor';
  }
  
  // Cleanup method
  destroy() {
    this.observers.forEach(observer => {
      if (observer.disconnect) observer.disconnect();
    });
    this.observers.clear();
    
    this.resourceLoadTimes.clear();
    console.log('📊 Performance Monitor destroyed');
  }
}

// Initialize performance monitor
let performanceMonitor;

// Auto-initialize if not in test environment
if (typeof window !== 'undefined' && !window.isTestEnvironment) {
  performanceMonitor = new PerformanceMonitor();
  
  // Make it globally accessible for debugging
  window.performanceMonitor = performanceMonitor;
  
  // Add console command for easy access
  window.getPerformanceReport = () => {
    console.table(performanceMonitor.getSummary());
    return performanceMonitor.getSummary();
  };
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (performanceMonitor) {
      performanceMonitor.destroy();
    }
  });
}

export default PerformanceMonitor; 