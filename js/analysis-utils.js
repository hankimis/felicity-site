// Analysis Dashboard Utility Functions
export class AnalysisUtils {
    
    // Format large numbers
    static formatNumber(number, decimals = 2) {
        if (typeof number !== 'number' || isNaN(number)) {
            return 'N/A';
        }
        if (number >= 1e9) {
            return (number / 1e9).toFixed(decimals) + 'B';
        }
        if (number >= 1e6) {
            return (number / 1e6).toFixed(decimals) + 'M';
        }
        if (number >= 1e3) {
            return (number / 1e3).toFixed(decimals) + 'K';
        }
        return number.toFixed(decimals);
    }
    
    // Format currency
    static formatCurrency(amount, currency = 'USD') {
        if (currency === 'USD') {
            return '$' + this.formatNumber(amount);
        }
        return this.formatNumber(amount) + ' ' + currency;
    }
    
    // Format percentage
    static formatPercentage(value, decimals = 1) {
        return value.toFixed(decimals) + '%';
    }
    
    // Get time ago string
    static getTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return '방금 전';
        if (minutes < 60) return `${minutes}분 전`;
        if (hours < 24) return `${hours}시간 전`;
        return `${days}일 전`;
    }
    
    // Format time
    static formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    // Shorten address
    static shortenAddress(address) {
        if (!address) return 'Unknown';
        if (address.length < 10) return address;
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }
    
    // Generate random hash
    static generateRandomHash(length = 64) {
        return Array.from({length}, () => 
            Math.floor(Math.random() * 16).toString(16)
        ).join('');
    }
    
    // Generate random Ethereum address
    static generateRandomAddress() {
        return '0x' + this.generateRandomHash(40);
    }
    
    // Get exchange name from address
    static getExchangeName(address) {
        if (!address || !AnalysisConfig.exchanges) return null;
        return AnalysisConfig.exchanges[address.toLowerCase()] || null;
    }
    
    // Calculate whale level
    static getWhaleLevel(type, amount) {
        if (type === 'bitcoin') {
            if (amount >= 1000) return 5;
            if (amount >= 500) return 4;
            if (amount >= 200) return 3;
            if (amount >= 100) return 2;
            return 1;
        } else {
            if (amount >= 10000) return 5;
            if (amount >= 5000) return 4;
            if (amount >= 3000) return 3;
            if (amount >= 2000) return 2;
            return 1;
        }
    }
    
    // Get whale size description
    static getWhaleSizeDescription(type, amount) {
        const level = this.getWhaleLevel(type, amount);
        const whaleEmojis = '🐋'.repeat(level);
        
        switch(level) {
            case 5: return `${whaleEmojis} 슈퍼 고래 (Ultra Whale)`;
            case 4: return `${whaleEmojis} 메가 고래 (Mega Whale)`;
            case 3: return `${whaleEmojis} 대형 고래 (Large Whale)`;
            case 2: return `${whaleEmojis} 중형 고래 (Medium Whale)`;
            default: return `${whaleEmojis} 소형 고래 (Small Whale)`;
        }
    }
    
    // Calculate price change percentage
    static calculatePriceChange(current, previous) {
        if (!previous || previous === 0) return 0;
        return ((current - previous) / previous) * 100;
    }
    
    // Throttle function execution
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }
    
    // Debounce function execution
    static debounce(func, wait, immediate) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            const later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }
    
    // Get random color for charts
    static getRandomColor(alpha = 1) {
        const colors = [
            `rgba(59, 130, 246, ${alpha})`,   // Blue
            `rgba(16, 185, 129, ${alpha})`,   // Green
            `rgba(245, 158, 11, ${alpha})`,   // Amber
            `rgba(239, 68, 68, ${alpha})`,    // Red
            `rgba(139, 92, 246, ${alpha})`,   // Purple
            `rgba(236, 72, 153, ${alpha})`,   // Pink
            `rgba(14, 165, 233, ${alpha})`,   // Sky
            `rgba(34, 197, 94, ${alpha})`,    // Emerald
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    // Validate symbol format
    static isValidSymbol(symbol) {
        return /^[A-Z]{3,10}USDT?$/.test(symbol);
    }
    
    // Convert timeframe to milliseconds
    static timeframeToMs(timeframe) {
        const multipliers = {
            '1m': 60 * 1000,
            '5m': 5 * 60 * 1000,
            '15m': 15 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '4h': 4 * 60 * 60 * 1000,
            '1d': 24 * 60 * 60 * 1000,
            '1w': 7 * 24 * 60 * 60 * 1000
        };
        return multipliers[timeframe] || multipliers['1h'];
    }
    
    // Safe JSON parse
    static safeJSONParse(str, fallback = null) {
        try {
            return JSON.parse(str);
        } catch (e) {
            console.warn('JSON parse error:', e);
            return fallback;
        }
    }
    
    // Local storage helpers
    static saveToStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.warn('Storage save error:', e);
            return false;
        }
    }
    
    static loadFromStorage(key, fallback = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : fallback;
        } catch (e) {
            console.warn('Storage load error:', e);
            return fallback;
        }
    }
    
    // Element utilities
    static createElement(tag, classes = [], attributes = {}) {
        const element = document.createElement(tag);
        
        if (classes.length) {
            element.classList.add(...classes);
        }
        
        Object.entries(attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
        
        return element;
    }
    
    // Animation utilities
    static fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.display = 'block';
        
        const start = performance.now();
        
        function animate(currentTime) {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);
            
            element.style.opacity = progress;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        }
        
        requestAnimationFrame(animate);
    }
    
    static fadeOut(element, duration = 300, callback = null) {
        const start = performance.now();
        const initialOpacity = parseFloat(window.getComputedStyle(element).opacity);
        
        function animate(currentTime) {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);
            
            element.style.opacity = initialOpacity * (1 - progress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                element.style.display = 'none';
                if (callback) callback();
            }
        }
        
        requestAnimationFrame(animate);
    }
    
    // Performance monitoring
    static measurePerformance(name, fn) {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        console.log(`${name} took ${end - start} milliseconds`);
        return result;
    }
    
    // Device detection
    static isMobile() {
        return window.innerWidth <= 768;
    }
    
    static isTablet() {
        return window.innerWidth > 768 && window.innerWidth <= 1024;
    }
    
    static isDesktop() {
        return window.innerWidth > 1024;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalysisUtils;
} else {
    window.AnalysisUtils = AnalysisUtils;
} 