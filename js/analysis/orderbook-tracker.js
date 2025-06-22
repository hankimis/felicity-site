/**
 * Orderbook Tracker
 * 오더북 추적 모듈
 */
export class OrderbookTracker {
    constructor() {
        this.currentSymbol = 'BTCUSDT';
        this.orderbook = {
            asks: [],
            bids: [],
            lastUpdate: 0
        };
        this.websocket = null;
        this.isConnected = false;
        this.isTracking = false;
        this.maxDepth = 10;
        
        this.init();
    }

    init() {
        console.log('📚 Orderbook Tracker initializing...');
        this.setupEventListeners();
        this.updateDisplay();
    }

    setupEventListeners() {
        // 심볼 변경
        const symbolSelect = document.getElementById('orderbook-symbol');
        if (symbolSelect) {
            symbolSelect.addEventListener('change', (e) => {
                this.currentSymbol = e.target.value;
                this.reconnectWebSocket();
            });
        }
    }

    async start() {
        if (this.isTracking) return;
        
        this.isTracking = true;
        console.log('📚 Starting orderbook tracking...');
        
        // 초기 데이터 로드
        await this.loadInitialData();
        
        // 웹소켓 연결
        await this.connectWebSocket();
    }

    stop() {
        this.isTracking = false;
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        this.isConnected = false;
        console.log('📚 Orderbook tracking stopped');
    }

    async loadInitialData() {
        try {
            // REST API로 초기 오더북 데이터 가져오기
            await this.fetchOrderbook();
            this.updateDisplay();
        } catch (error) {
            console.error('Error loading initial orderbook data:', error);
            this.generateSampleData();
        }
    }

    async fetchOrderbook() {
        try {
            const response = await fetch(
                `https://api.binance.com/api/v3/depth?symbol=${this.currentSymbol}&limit=20`
            );
            const data = await response.json();
            
            if (data.asks && data.bids) {
                this.orderbook.asks = data.asks.map(ask => ({
                    price: parseFloat(ask[0]),
                    quantity: parseFloat(ask[1]),
                    total: 0 // 누적량은 나중에 계산
                }));
                
                this.orderbook.bids = data.bids.map(bid => ({
                    price: parseFloat(bid[0]),
                    quantity: parseFloat(bid[1]),
                    total: 0 // 누적량은 나중에 계산
                }));
                
                this.orderbook.lastUpdate = Date.now();
                this.calculateTotals();
            }
        } catch (error) {
            console.error('Error fetching orderbook:', error);
            throw error;
        }
    }

    calculateTotals() {
        // 매도 호가 누적량 계산 (가격이 낮은 것부터)
        let askTotal = 0;
        this.orderbook.asks.forEach(ask => {
            askTotal += ask.quantity;
            ask.total = askTotal;
        });
        
        // 매수 호가 누적량 계산 (가격이 높은 것부터)
        let bidTotal = 0;
        this.orderbook.bids.forEach(bid => {
            bidTotal += bid.quantity;
            bid.total = bidTotal;
        });
    }

    async connectWebSocket() {
        try {
            const symbol = this.currentSymbol.toLowerCase();
            const wsUrl = `wss://stream.binance.com:9443/ws/${symbol}@depth@100ms`;
            
            if (this.websocket) {
                this.websocket.close();
            }
            
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('📚 Orderbook WebSocket connected for', this.currentSymbol);
                this.isConnected = true;
            };
            
            this.websocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleOrderbookUpdate(data);
            };
            
            this.websocket.onclose = () => {
                console.log('📚 Orderbook WebSocket disconnected');
                this.isConnected = false;
                
                // 재연결 시도
                if (this.isTracking) {
                    setTimeout(() => {
                        this.connectWebSocket();
                    }, 5000);
                }
            };
            
            this.websocket.onerror = (error) => {
                console.error('📚 Orderbook WebSocket error:', error);
                this.isConnected = false;
            };
            
        } catch (error) {
            console.error('Error connecting to orderbook WebSocket:', error);
            // WebSocket 실패 시 폴링으로 대체
            this.startPolling();
        }
    }

    async reconnectWebSocket() {
        this.orderbook = { asks: [], bids: [], lastUpdate: 0 };
        this.updateDisplay();
        await this.loadInitialData();
        await this.connectWebSocket();
    }

    handleOrderbookUpdate(data) {
        if (data.a && data.b) {
            // 증분 업데이트 처리
            this.updateOrderbookLevel(this.orderbook.asks, data.a);
            this.updateOrderbookLevel(this.orderbook.bids, data.b);
            
            // 가격 순으로 정렬
            this.orderbook.asks.sort((a, b) => a.price - b.price);
            this.orderbook.bids.sort((a, b) => b.price - a.price);
            
            // 상위 depth만 유지
            this.orderbook.asks = this.orderbook.asks.slice(0, this.maxDepth);
            this.orderbook.bids = this.orderbook.bids.slice(0, this.maxDepth);
            
            this.calculateTotals();
            this.orderbook.lastUpdate = Date.now();
            this.updateDisplay();
        }
    }

    updateOrderbookLevel(levels, updates) {
        updates.forEach(update => {
            const price = parseFloat(update[0]);
            const quantity = parseFloat(update[1]);
            
            const existingIndex = levels.findIndex(level => level.price === price);
            
            if (quantity === 0) {
                // 수량이 0이면 해당 레벨 제거
                if (existingIndex !== -1) {
                    levels.splice(existingIndex, 1);
                }
            } else {
                // 수량이 있으면 업데이트 또는 추가
                if (existingIndex !== -1) {
                    levels[existingIndex].quantity = quantity;
                } else {
                    levels.push({ price, quantity, total: 0 });
                }
            }
        });
    }

    startPolling() {
        console.log('📚 Starting orderbook polling...');
        
        this.pollingInterval = setInterval(async () => {
            if (this.isTracking) {
                try {
                    await this.fetchOrderbook();
                    this.updateDisplay();
                } catch (error) {
                    console.error('Error polling orderbook:', error);
                }
            }
        }, 1000); // 1초마다
    }

    generateSampleData() {
        const basePrice = 45000; // BTC 기준가
        this.orderbook.asks = [];
        this.orderbook.bids = [];
        
        // 샘플 매도 호가 생성
        for (let i = 0; i < this.maxDepth; i++) {
            this.orderbook.asks.push({
                price: basePrice + (i + 1) * 10,
                quantity: Math.random() * 5 + 0.1,
                total: 0
            });
        }
        
        // 샘플 매수 호가 생성
        for (let i = 0; i < this.maxDepth; i++) {
            this.orderbook.bids.push({
                price: basePrice - (i + 1) * 10,
                quantity: Math.random() * 5 + 0.1,
                total: 0
            });
        }
        
        this.calculateTotals();
        this.orderbook.lastUpdate = Date.now();
    }

    updateDisplay() {
        const asksContainer = document.getElementById('asks-orders');
        const bidsContainer = document.getElementById('bids-orders');

        if (!asksContainer || !bidsContainer) return;

        const asks = this.orderbook.asks.slice(0, 15).map(ask => ({ price: parseFloat(ask.price), quantity: parseFloat(ask.quantity) }));
        const bids = this.orderbook.bids.slice(0, 15).map(bid => ({ price: parseFloat(bid.price), quantity: parseFloat(bid.quantity) }));

        let asksTotal = 0;
        const asksWithDepth = asks.map(ask => ({ ...ask, total: asksTotal += ask.quantity }));

        let bidsTotal = 0;
        const bidsWithDepth = bids.map(bid => ({ ...bid, total: bidsTotal += bid.quantity }));

        const maxDepth = Math.max(asksTotal, bidsTotal);

        // 매도 주문은 가격 오름차순으로 표시되므로, UI에서는 역순으로 표시 (낮은 가격이 아래로)
        asksContainer.innerHTML = asksWithDepth.reverse().map(ask => {
            const depthPercent = maxDepth > 0 ? (ask.total / maxDepth) * 100 : 0;
            return `
                <div class="order-row ask" style="--depth-percent: ${depthPercent}%">
                    <span class="price">${ask.price.toFixed(2)}</span>
                    <span class="quantity">${ask.quantity.toFixed(4)}</span>
                </div>
            `;
        }).join('');

        // 매수 주문은 가격 내림차순으로 표시 (API 순서 그대로)
        bidsContainer.innerHTML = bidsWithDepth.map(bid => {
            const depthPercent = maxDepth > 0 ? (bid.total / maxDepth) * 100 : 0;
            return `
                <div class="order-row bid" style="--depth-percent: ${depthPercent}%">
                    <span class="price">${bid.price.toFixed(2)}</span>
                    <span class="quantity">${bid.quantity.toFixed(4)}</span>
                </div>
            `;
        }).join('');
    }

    async refresh() {
        console.log('📚 Refreshing orderbook...');
        await this.loadInitialData();
        
        if (window.analysisDashboard) {
            window.analysisDashboard.showToast('오더북이 업데이트되었습니다', 'success');
        }
    }

    // 외부에서 접근 가능한 메서드들
    getOrderbook() {
        return {
            asks: this.orderbook.asks || [],
            bids: this.orderbook.bids || []
        };
    }

    getBestPrices() {
        return {
            bestAsk: this.orderbook.asks.length > 0 ? this.orderbook.asks[0].price : 0,
            bestBid: this.orderbook.bids.length > 0 ? this.orderbook.bids[0].price : 0,
            spread: this.getSpread()
        };
    }

    getSpread() {
        if (this.orderbook.asks.length > 0 && this.orderbook.bids.length > 0) {
            return this.orderbook.asks[0].price - this.orderbook.bids[0].price;
        }
        return 0;
    }

    getDepth(side = 'both') {
        const result = {};
        
        if (side === 'asks' || side === 'both') {
            result.asks = this.orderbook.asks;
        }
        
        if (side === 'bids' || side === 'both') {
            result.bids = this.orderbook.bids;
        }
        
        return result;
    }

    isConnectedToWebSocket() {
        return this.isConnected;
    }
} 