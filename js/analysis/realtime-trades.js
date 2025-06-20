/**
 * Realtime Trader Module
 * 실시간 거래 데이터를 추적하고 표시하는 모듈
 */
class RealtimeTrader {
    constructor() {
        this.currentSymbol = 'BTCUSDT';
        this.currentPrice = 0;
        this.trades = [];
        this.maxTrades = 50;
        this.websocket = null;
        this.isConnected = false;
        
        this.init();
    }

    init() {
        console.log('⚡ Realtime Trader initializing...');
        this.setupEventListeners();
        this.updateDisplay();
    }

    setupEventListeners() {
        // 심볼 변경
        const symbolSelect = document.getElementById('realtime-symbol');
        if (symbolSelect) {
            symbolSelect.addEventListener('change', (e) => {
                this.currentSymbol = e.target.value;
                this.reconnectWebSocket();
            });
        }
    }

    async start() {
        console.log('⚡ Starting realtime trading...');
        await this.connectWebSocket();
    }

    stop() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        this.isConnected = false;
        console.log('⚡ Realtime trading stopped');
    }

    async connectWebSocket() {
        try {
            const symbol = this.currentSymbol.toLowerCase();
            const wsUrl = `wss://stream.binance.com:9443/ws/${symbol}@trade`;
            
            if (this.websocket) {
                this.websocket.close();
            }
            
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('⚡ WebSocket connected for', this.currentSymbol);
                this.isConnected = true;
                this.updateConnectionStatus(true);
            };
            
            this.websocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleTradeData(data);
            };
            
            this.websocket.onclose = () => {
                console.log('⚡ WebSocket disconnected');
                this.isConnected = false;
                this.updateConnectionStatus(false);
                
                // 재연결 시도
                setTimeout(() => {
                    if (!this.isConnected) {
                        this.connectWebSocket();
                    }
                }, 5000);
            };
            
            this.websocket.onerror = (error) => {
                console.error('⚡ WebSocket error:', error);
                this.isConnected = false;
                this.updateConnectionStatus(false);
            };
            
        } catch (error) {
            console.error('Error connecting to WebSocket:', error);
            // WebSocket 연결 실패 시 폴링으로 대체
            this.startPolling();
        }
    }

    async reconnectWebSocket() {
        this.trades = []; // 심볼 변경 시 거래 내역 초기화
        this.updateDisplay();
        await this.connectWebSocket();
    }

    handleTradeData(data) {
        const trade = {
            id: data.t,
            price: parseFloat(data.p),
            quantity: parseFloat(data.q),
            timestamp: parseInt(data.T),
            isBuyerMaker: data.m,
            symbol: data.s
        };
        
        this.currentPrice = trade.price;
        this.addTrade(trade);
        this.updateDisplay();
    }

    addTrade(trade) {
        this.trades.unshift(trade);
        
        // 최대 거래 수 제한
        if (this.trades.length > this.maxTrades) {
            this.trades = this.trades.slice(0, this.maxTrades);
        }
    }

    startPolling() {
        // WebSocket 실패 시 REST API로 폴링
        console.log('⚡ Starting REST API polling...');
        
        this.pollingInterval = setInterval(async () => {
            try {
                await this.fetchRecentTrades();
            } catch (error) {
                console.error('Error fetching trades:', error);
            }
        }, 2000); // 2초마다
    }

    async fetchRecentTrades() {
        try {
            const response = await fetch(
                `https://api.binance.com/api/v3/trades?symbol=${this.currentSymbol}&limit=10`
            );
            const trades = await response.json();
            
            if (Array.isArray(trades)) {
                trades.reverse().forEach(trade => {
                    const tradeData = {
                        id: trade.id,
                        price: parseFloat(trade.price),
                        quantity: parseFloat(trade.qty),
                        timestamp: parseInt(trade.time),
                        isBuyerMaker: trade.isBuyerMaker,
                        symbol: this.currentSymbol
                    };
                    
                    // 중복 거래 확인
                    if (!this.trades.find(t => t.id === tradeData.id)) {
                        this.addTrade(tradeData);
                    }
                });
                
                if (trades.length > 0) {
                    this.currentPrice = trades[trades.length - 1].price;
                }
            }
            
            this.updateDisplay();
            
        } catch (error) {
            console.error('Error fetching recent trades:', error);
        }
    }

    updateDisplay() {
        this.updatePrice();
        this.updateTradesList();
    }

    updatePrice() {
        const priceElement = document.getElementById('realtime-price');
        if (priceElement && this.currentPrice > 0) {
            priceElement.textContent = window.formatPrice(this.currentPrice);
            
            // 가격 변동 애니메이션
            priceElement.classList.remove('price-up', 'price-down');
            
            if (this.lastPrice && this.currentPrice !== this.lastPrice) {
                if (this.currentPrice > this.lastPrice) {
                    priceElement.classList.add('price-up');
                } else {
                    priceElement.classList.add('price-down');
                }
            }
            
            this.lastPrice = this.currentPrice;
        }
    }

    updateTradesList() {
        const container = document.getElementById('realtime-trades');
        if (!container) return;

        if (this.trades.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-chart-line"></i>
                    <p>거래 데이터 로딩 중...</p>
                </div>
            `;
            return;
        }

        const tradesHTML = this.trades.slice(0, 10).map(trade => 
            this.createTradeHTML(trade)
        ).join('');

        container.innerHTML = tradesHTML;
    }

    createTradeHTML(trade) {
        const tradeType = trade.isBuyerMaker ? 'sell' : 'buy';
        const tradeTypeText = trade.isBuyerMaker ? '매도' : '매수';
        const time = new Date(trade.timestamp).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        return `
            <div class="trade-item ${tradeType}">
                <span class="trade-time">${time}</span>
                <span class="trade-price">${window.formatPrice(trade.price)}</span>
                <span class="trade-size">${trade.quantity.toFixed(6)}</span>
                <span class="trade-type">${tradeTypeText}</span>
            </div>
        `;
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('global-status');
        if (statusElement) {
            const dot = statusElement.querySelector('.status-dot');
            const text = statusElement.querySelector('.status-text');
            
            if (connected) {
                dot.className = 'status-dot active';
                text.textContent = '실시간 연결됨';
            } else {
                dot.className = 'status-dot connecting';
                text.textContent = '연결 중...';
            }
        }
    }

    async refresh() {
        console.log('⚡ Refreshing realtime trades...');
        
        this.trades = [];
        
        if (this.isConnected) {
            // WebSocket이 연결되어 있으면 그대로 두고
            this.updateDisplay();
        } else {
            // 연결되어 있지 않으면 재연결
            await this.connectWebSocket();
        }
        
        if (window.analysisDashboard) {
            window.analysisDashboard.showToast('실시간 거래 데이터가 업데이트되었습니다', 'success');
        }
    }

    // 외부에서 접근 가능한 메서드들
    getCurrentPrice() {
        return this.currentPrice;
    }

    getTrades() {
        return this.trades;
    }

    getSymbol() {
        return this.currentSymbol;
    }

    isWebSocketConnected() {
        return this.isConnected;
    }
} 