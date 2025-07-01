// js/analysis/data-storage.js
// 실시간 데이터 저장 및 관리 클래스

export class DataStorage {
    constructor() {
        this.dbName = 'BinanceDataDB';
        this.dbVersion = 1;
        this.db = null;
        this.maxDataPoints = 10000; // 최대 저장 데이터 포인트
        this.initialized = false;
    }

    // 데이터베이스 초기화
    async initialize() {
        if (this.initialized) return;
        
        try {
            await this.initDatabase();
            this.initialized = true;
            console.log('DataStorage 초기화 완료');
        } catch (error) {
            console.error('DataStorage 초기화 실패:', error);
            throw error;
        }
    }

    // IndexedDB 초기화
    async initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('IndexedDB 초기화 실패:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB 초기화 완료');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 거래 데이터 저장소
                if (!db.objectStoreNames.contains('trades')) {
                    const tradeStore = db.createObjectStore('trades', { keyPath: 'timestamp' });
                    tradeStore.createIndex('price', 'price', { unique: false });
                    tradeStore.createIndex('time', 'time', { unique: false });
                }

                // 오더북 데이터 저장소
                if (!db.objectStoreNames.contains('orderbook')) {
                    const orderbookStore = db.createObjectStore('orderbook', { keyPath: 'timestamp' });
                    orderbookStore.createIndex('timestamp', 'timestamp', { unique: true });
                }

                // 미결제 약정 데이터 저장소
                if (!db.objectStoreNames.contains('openInterest')) {
                    const oiStore = db.createObjectStore('openInterest', { keyPath: 'timestamp' });
                    oiStore.createIndex('timestamp', 'timestamp', { unique: true });
                }

                // 자금조달률 데이터 저장소
                if (!db.objectStoreNames.contains('fundingRate')) {
                    const frStore = db.createObjectStore('fundingRate', { keyPath: 'timestamp' });
                    frStore.createIndex('timestamp', 'timestamp', { unique: true });
                }

                // 롱숏 비율 데이터 저장소
                if (!db.objectStoreNames.contains('longShortRatio')) {
                    const lsStore = db.createObjectStore('longShortRatio', { keyPath: 'timestamp' });
                    lsStore.createIndex('timestamp', 'timestamp', { unique: true });
                }

                // 청산 예측 데이터 저장소
                if (!db.objectStoreNames.contains('liquidationPredictions')) {
                    const lpStore = db.createObjectStore('liquidationPredictions', { keyPath: 'timestamp' });
                    lpStore.createIndex('timestamp', 'timestamp', { unique: true });
                }
            };
        });
    }

    // 거래 데이터 저장
    async saveTrade(tradeData) {
        if (!this.db) return;

        const transaction = this.db.transaction(['trades'], 'readwrite');
        const store = transaction.objectStore('trades');

        try {
            await store.add(tradeData);
            await this.cleanupOldData('trades');
        } catch (error) {
            console.error('거래 데이터 저장 실패:', error);
        }
    }

    // 오더북 데이터 저장
    async saveOrderBook(orderBookData) {
        if (!this.db) return;

        const transaction = this.db.transaction(['orderbook'], 'readwrite');
        const store = transaction.objectStore('orderbook');

        try {
            await store.add(orderBookData);
            await this.cleanupOldData('orderbook');
        } catch (error) {
            console.error('오더북 데이터 저장 실패:', error);
        }
    }

    // 미결제 약정 데이터 저장
    async saveOpenInterest(oiData) {
        if (!this.db) return;

        const transaction = this.db.transaction(['openInterest'], 'readwrite');
        const store = transaction.objectStore('openInterest');

        try {
            await store.add(oiData);
            await this.cleanupOldData('openInterest');
        } catch (error) {
            console.error('미결제 약정 데이터 저장 실패:', error);
        }
    }

    // 자금조달률 데이터 저장
    async saveFundingRate(frData) {
        if (!this.db) return;

        const transaction = this.db.transaction(['fundingRate'], 'readwrite');
        const store = transaction.objectStore('fundingRate');

        try {
            await store.add(frData);
            await this.cleanupOldData('fundingRate');
        } catch (error) {
            console.error('자금조달률 데이터 저장 실패:', error);
        }
    }

    // 롱숏 비율 데이터 저장
    async saveLongShortRatio(lsData) {
        if (!this.db) return;

        const transaction = this.db.transaction(['longShortRatio'], 'readwrite');
        const store = transaction.objectStore('longShortRatio');

        try {
            await store.add(lsData);
            await this.cleanupOldData('longShortRatio');
        } catch (error) {
            console.error('롱숏 비율 데이터 저장 실패:', error);
        }
    }

    // 청산 예측 데이터 저장
    async saveLiquidationPrediction(predictionData) {
        if (!this.db) return;

        const transaction = this.db.transaction(['liquidationPredictions'], 'readwrite');
        const store = transaction.objectStore('liquidationPredictions');

        try {
            await store.add(predictionData);
            await this.cleanupOldData('liquidationPredictions');
        } catch (error) {
            console.error('청산 예측 데이터 저장 실패:', error);
        }
    }

    // 오래된 데이터 정리
    async cleanupOldData(storeName) {
        if (!this.db) return;

        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const countRequest = store.count();

        countRequest.onsuccess = () => {
            if (countRequest.result > this.maxDataPoints) {
                const deleteCount = countRequest.result - this.maxDataPoints;
                const request = store.openCursor();

                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor && deleteCount > 0) {
                        cursor.delete();
                        deleteCount--;
                        cursor.continue();
                    }
                };
            }
        };
    }

    // 최근 거래 데이터 조회
    async getRecentTrades(limit = 1000) {
        if (!this.db || !this.initialized) {
            console.warn('데이터베이스가 초기화되지 않았습니다. 기본 거래 데이터를 생성합니다.');
            return this.generateDefaultTrades(limit);
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['trades'], 'readonly');
            const store = transaction.objectStore('trades');
            const index = store.index('time');
            const request = index.openCursor(null, 'prev');

            const trades = [];
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && trades.length < limit) {
                    trades.push(cursor.value);
                    cursor.continue();
                } else {
                    // 데이터가 없으면 기본 데이터 생성
                    if (trades.length === 0) {
                        console.warn('저장된 거래 데이터가 없습니다. 기본 데이터를 생성합니다.');
                        resolve(this.generateDefaultTrades(limit));
                    } else {
                        resolve(trades);
                    }
                }
            };

            request.onerror = () => {
                console.error('거래 데이터 조회 실패:', request.error);
                resolve(this.generateDefaultTrades(limit));
            };
        });
    }

    // 기본 거래 데이터 생성
    generateDefaultTrades(limit = 1000) {
        const trades = [];
        const basePrice = 50000; // 기본 BTC 가격
        const now = Date.now();
        
        for (let i = 0; i < limit; i++) {
            const timestamp = now - (limit - i) * 1000; // 1초 간격
            const priceVariation = (Math.random() - 0.5) * 0.02; // ±1% 변동
            const price = basePrice * (1 + priceVariation);
            const quantity = Math.random() * 10 + 0.1; // 0.1 ~ 10 BTC
            const isBuyerMaker = Math.random() > 0.5;
            
            trades.push({
                timestamp: timestamp,
                time: timestamp,
                price: parseFloat(price.toFixed(2)),
                quantity: parseFloat(quantity.toFixed(4)),
                isBuyerMaker: isBuyerMaker,
                side: isBuyerMaker ? 'Sell' : 'Buy',
                amount: parseFloat((price * quantity).toFixed(2))
            });
        }
        
        return trades;
    }

    // 최근 오더북 데이터 조회
    async getRecentOrderBook(limit = 100) {
        if (!this.db) return [];

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['orderbook'], 'readonly');
            const store = transaction.objectStore('orderbook');
            const index = store.index('timestamp');
            const request = index.openCursor(null, 'prev');

            const orderbooks = [];
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && orderbooks.length < limit) {
                    orderbooks.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(orderbooks);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    // 가격 범위별 거래 데이터 조회
    async getTradesByPriceRange(minPrice, maxPrice, limit = 1000) {
        if (!this.db) return [];

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['trades'], 'readonly');
            const store = transaction.objectStore('trades');
            const index = store.index('price');
            const range = IDBKeyRange.bound(minPrice, maxPrice);
            const request = index.openCursor(range, 'prev');

            const trades = [];
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && trades.length < limit) {
                    trades.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(trades);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    // 시간 범위별 데이터 조회
    async getDataByTimeRange(storeName, startTime, endTime) {
        if (!this.db) return [];

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const range = IDBKeyRange.bound(startTime, endTime);
            const request = store.openCursor(range);

            const data = [];
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    data.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(data);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    // 통계 데이터 계산
    async calculateStatistics() {
        const trades = await this.getRecentTrades(10000);
        
        if (trades.length === 0) return null;

        const prices = trades.map(t => t.price);
        const volumes = trades.map(t => t.quantity);

        return {
            totalTrades: trades.length,
            avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
            minPrice: Math.min(...prices),
            maxPrice: Math.max(...prices),
            totalVolume: volumes.reduce((a, b) => a + b, 0),
            avgVolume: volumes.reduce((a, b) => a + b, 0) / volumes.length,
            priceVolatility: this.calculateVolatility(prices),
            lastUpdate: Date.now()
        };
    }

    // 변동성 계산
    calculateVolatility(prices) {
        if (prices.length < 2) return 0;
        
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i] - prices[i-1]) / prices[i-1]);
        }
        
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
        
        return Math.sqrt(variance);
    }

    // 데이터베이스 초기화
    async clearAllData() {
        if (!this.db) return;

        const storeNames = ['trades', 'orderbook', 'openInterest', 'fundingRate', 'longShortRatio', 'liquidationPredictions'];
        
        for (const storeName of storeNames) {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            await store.clear();
        }
        
        console.log('모든 데이터가 삭제되었습니다.');
    }
} 