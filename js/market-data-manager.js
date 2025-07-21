/**
 * 🔥 MarketDataManager - 실시간 시장 데이터 관리 클래스
 * 차트와 오더북에 필요한 실시간 가격 데이터를 관리합니다.
 */
class MarketDataManager {
    constructor() {
        this.isUpdating = false;
        this.isPriceStreamActive = false;
        this.updateInterval = null;
        this.priceStreamInterval = null;
        this.currentPrices = new Map();
        this.priceHistory = new Map();
        this.subscribers = new Set();
        this.lastUpdateTime = Date.now();
        
        // 기본 심볼들
        this.defaultSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT'];
        this.activeSymbols = new Set(this.defaultSymbols);
        
        console.log('🔥 MarketDataManager 초기화 완료');
    }

    /**
     * 🔄 주기적 데이터 업데이트 시작
     */
    startUpdating() {
        if (this.isUpdating) {
            console.log('⚠️ 이미 업데이트 중입니다');
            return;
        }

        this.isUpdating = true;
        console.log('🔄 시장 데이터 업데이트 시작');

        // 즉시 첫 업데이트 실행
        this.updateMarketData();

        // 5초마다 업데이트
        this.updateInterval = setInterval(() => {
            this.updateMarketData();
        }, 5000);
    }

    /**
     * 🛑 주기적 데이터 업데이트 중지
     */
    stopUpdating() {
        if (!this.isUpdating) return;

        this.isUpdating = false;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        console.log('�� 시장 데이터 업데이트 중지');
    }

    /**
     * �� 실시간 가격 스트림 시작
     */
    startPriceStream() {
        if (this.isPriceStreamActive) {
            console.log('⚠️ 이미 가격 스트림이 활성화되어 있습니다');
            return;
        }

        this.isPriceStreamActive = true;
        console.log('�� 실시간 가격 스트림 시작');

        // 1초마다 가격 업데이트
        this.priceStreamInterval = setInterval(() => {
            this.updatePriceStream();
        }, 1000);
    }

    /**
     * �� 실시간 가격 스트림 중지
     */
    stopPriceStream() {
        if (!this.isPriceStreamActive) return;

        this.isPriceStreamActive = false;
        if (this.priceStreamInterval) {
            clearInterval(this.priceStreamInterval);
            this.priceStreamInterval = null;
        }
        console.log('🛑 실시간 가격 스트림 중지');
    }

    /**
     * 📈 시장 데이터 업데이트
     */
    async updateMarketData() {
        try {
            const promises = Array.from(this.activeSymbols).map(symbol => 
                this.fetchSymbolData(symbol)
            );

            const results = await Promise.allSettled(promises);
            
            results.forEach((result, index) => {
                const symbol = Array.from(this.activeSymbols)[index];
                if (result.status === 'fulfilled' && result.value) {
                    this.currentPrices.set(symbol, result.value);
                    this.notifySubscribers(symbol, result.value);
                } else {
                    console.warn(`⚠️ ${symbol} 데이터 업데이트 실패:`, result.reason);
                }
            });

            this.lastUpdateTime = Date.now();
            
        } catch (error) {
            console.error('❌ 시장 데이터 업데이트 오류:', error);
        }
    }

    /**
     * 💰 실시간 가격 스트림 업데이트
     */
    async updatePriceStream() {
        try {
            // 활성 심볼들의 현재 가격만 빠르게 업데이트
            const promises = Array.from(this.activeSymbols).map(symbol => 
                this.fetchCurrentPrice(symbol)
            );

            const results = await Promise.allSettled(promises);
            
            results.forEach((result, index) => {
                const symbol = Array.from(this.activeSymbols)[index];
                if (result.status === 'fulfilled' && result.value) {
                    const currentData = this.currentPrices.get(symbol);
                    if (currentData) {
                        // 가격만 업데이트
                        currentData.price = result.value.price;
                        currentData.lastUpdated = new Date().toISOString();
                        this.currentPrices.set(symbol, currentData);
                        
                        // 가격 스트림 구독자들에게만 알림
                        this.notifyPriceStreamSubscribers(symbol, result.value);
                    }
                }
            });
            
        } catch (error) {
            console.error('❌ 가격 스트림 업데이트 오류:', error);
        }
    }

    /**
     * 📊 심볼 데이터 가져오기
     */
    async fetchSymbolData(symbol) {
        try {
            const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            
            return {
                symbol: data.symbol,
                price: parseFloat(data.lastPrice),
                priceChange: parseFloat(data.priceChange),
                priceChangePercent: parseFloat(data.priceChangePercent),
                high24h: parseFloat(data.highPrice),
                low24h: parseFloat(data.lowPrice),
                volume: parseFloat(data.volume),
                quoteVolume: parseFloat(data.quoteVolume),
                openPrice: parseFloat(data.openPrice),
                lastUpdated: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`❌ ${symbol} 데이터 가져오기 실패:`, error);
            return null;
        }
    }

    /**
     * 💰 현재 가격만 빠르게 가져오기
     */
    async fetchCurrentPrice(symbol) {
        try {
            const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            
            return {
                symbol: data.symbol,
                price: parseFloat(data.price),
                lastUpdated: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`❌ ${symbol} 현재 가격 가져오기 실패:`, error);
            return null;
        }
    }

    /**
     * �� 구독자 추가
     */
    subscribe(callback) {
        this.subscribers.add(callback);
        console.log(`👥 구독자 추가됨 (총 ${this.subscribers.size}명)`);
    }

    /**
     * �� 구독자 제거
     */
    unsubscribe(callback) {
        this.subscribers.delete(callback);
        console.log(`👥 구독자 제거됨 (총 ${this.subscribers.size}명)`);
    }

    /**
     * �� 구독자들에게 알림
     */
    notifySubscribers(symbol, data) {
        this.subscribers.forEach(callback => {
            try {
                callback(symbol, data);
            } catch (error) {
                console.error('❌ 구독자 콜백 실행 오류:', error);
            }
        });
    }

    /**
     * 📢 가격 스트림 구독자들에게 알림
     */
    notifyPriceStreamSubscribers(symbol, data) {
        // 가격 스트림 전용 구독자들에게만 알림
        // (필요시 별도 구독자 목록 구현 가능)
        this.subscribers.forEach(callback => {
            try {
                if (callback.isPriceStreamSubscriber) {
                    callback(symbol, data);
                }
            } catch (error) {
                console.error('❌ 가격 스트림 구독자 콜백 실행 오류:', error);
            }
        });
    }

    /**
     * 📊 특정 심볼 데이터 가져오기
     */
    getSymbolData(symbol) {
        return this.currentPrices.get(symbol) || null;
    }

    /**
     * �� 모든 활성 심볼 데이터 가져오기
     */
    getAllSymbolData() {
        const result = {};
        this.activeSymbols.forEach(symbol => {
            const data = this.currentPrices.get(symbol);
            if (data) {
                result[symbol] = data;
            }
        });
        return result;
    }

    /**
     * ➕ 심볼 추가
     */
    addSymbol(symbol) {
        if (!this.activeSymbols.has(symbol)) {
            this.activeSymbols.add(symbol);
            console.log(`➕ 심볼 추가: ${symbol}`);
            
            // 즉시 데이터 가져오기
            this.fetchSymbolData(symbol).then(data => {
                if (data) {
                    this.currentPrices.set(symbol, data);
                }
            });
        }
    }

    /**
     * ➖ 심볼 제거
     */
    removeSymbol(symbol) {
        if (this.activeSymbols.has(symbol)) {
            this.activeSymbols.delete(symbol);
            this.currentPrices.delete(symbol);
            console.log(`➖ 심볼 제거: ${symbol}`);
        }
    }

    /**
     * 📈 가격 히스토리 저장
     */
    savePriceHistory(symbol, price) {
        if (!this.priceHistory.has(symbol)) {
            this.priceHistory.set(symbol, []);
        }
        
        const history = this.priceHistory.get(symbol);
        history.push({
            price: price,
            timestamp: Date.now()
        });
        
        // 최근 100개만 유지
        if (history.length > 100) {
            history.shift();
        }
    }

    /**
     * 📊 가격 히스토리 가져오기
     */
    getPriceHistory(symbol, limit = 100) {
        const history = this.priceHistory.get(symbol) || [];
        return history.slice(-limit);
    }

    /**
     * �� 리소스 정리
     */
    destroy() {
        this.stopUpdating();
        this.stopPriceStream();
        this.subscribers.clear();
        this.currentPrices.clear();
        this.priceHistory.clear();
        this.activeSymbols.clear();
        console.log('🧹 MarketDataManager 정리 완료');
    }

    /**
     * 📊 상태 정보 가져오기
     */
    getStatus() {
        return {
            isUpdating: this.isUpdating,
            isPriceStreamActive: this.isPriceStreamActive,
            activeSymbolsCount: this.activeSymbols.size,
            subscribersCount: this.subscribers.size,
            lastUpdateTime: this.lastUpdateTime,
            currentPricesCount: this.currentPrices.size
        };
    }
}

// 전역으로 내보내기
window.MarketDataManager = MarketDataManager;

console.log('✅ MarketDataManager 클래스 로드 완료'); 