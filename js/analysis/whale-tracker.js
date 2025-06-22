/**
 * Advanced Whale Tracker - AGGR Style Implementation
 * 실시간 암호화폐 고래 거래 추적 시스템
 */

export class WhaleTracker {
    constructor(settings = {}) {
        this.apiEndpoint = 'https://api.binance.com/api/v3/aggTrades';
        this.settings = {
            symbol: 'BTCUSDT',
            largeTradeThreshold: 500000,
            enableSound: false,
            ...settings
        };
        this.whaleTrades = [];
        this.chart = null;
        this.lastTradeId = null;
        this.trades = [];
        this.maxTrades = 100;
        this.isTracking = false;
        this.connections = {};
        this.audioContext = null;
        this.audioGain = null;
        
        // 거래 레벨 설정
        this.thresholds = [
            { amount: 100000, level: 0, buyColor: '#e8f5e8', sellColor: '#fde8e9' },
            { amount: 300000, level: 1, buyColor: '#d4edda', sellColor: '#f8d7da' },
            { amount: 1000000, level: 2, buyColor: '#c3e6cb', sellColor: '#f5c6cb' },
            { amount: 5000000, level: 3, buyColor: '#a8e6cf', sellColor: '#f0ad4e' }
        ];
        
        // 오디오 설정 - 100k 이상 거래에만 알림
        this.audioThreshold = 100000;
        this.muted = !this.settings.enableSound;
        this.audioVolume = 0.5;
        this.audioPitch = 1.0;
        
        // 표시 설정
        this.showLogos = true;
        this.showPrices = true;
        this.showTimeAgo = true;
        
        // 거래소 설정
        this.exchanges = {
            BINANCE: {
                name: 'BINANCE',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="#f3ba2f"><path d="M4.9 6.72L8 3.62l3.1 3.1 1.8-1.8L8 0 3.1 4.92zM0 8l1.8-1.8L3.62 8 1.8 9.8zm4.9 1.28L8 12.4l3.1-3.1 1.8 1.8L8 16l-4.9-4.9zM12.38 8l1.8-1.8L16 8l-1.8 1.8zM9.84 8L8 6.16 6.17 8 8 9.83 9.84 8z"/></svg>',
                wsEndpoint: 'wss://stream.binance.com:9443/ws/btcusdt@aggTrade',
                formatter: (data) => ({
                    exchange: 'BINANCE',
                    price: parseFloat(data.p),
                    amount: parseFloat(data.q),
                    side: data.m ? 'sell' : 'buy',
                    timestamp: data.T,
                    size: parseFloat(data.q),
                    avgPrice: parseFloat(data.p)
                })
            },
            BINANCE_FUTURES: {
                name: 'BINANCE_FUTURES',
                icon: '<svg version="1.1" id="Calque_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 16 16" style="enable-background:new 0 0 16 16;" xml:space="preserve"><style type="text/css">.st0{fill:#ffffff;}</style><path class="st0" d="M4.9,6.7L8,3.6l3.1,3.1l1.8-1.8L8,0L3.1,4.9L4.9,6.7z M0,8l1.8-1.8L3.6,8L1.8,9.8L0,8z M4.9,9.3L8,12.4l3.1-3.1l1.8,1.8L8,16l-4.9-4.9L4.9,9.3z M12.4,8l1.8-1.8L16,8l-1.8,1.8L12.4,8z M9.8,8L8,6.2L6.2,8L8,9.8L9.8,8z"/></svg>',
                wsEndpoint: 'wss://fstream.binance.com/ws/btcusdt@aggTrade',
                formatter: (data) => ({
                    exchange: 'BINANCE_FUTURES',
                    price: parseFloat(data.p),
                    amount: parseFloat(data.q),
                    side: data.m ? 'sell' : 'buy',
                    timestamp: data.T,
                    size: parseFloat(data.q),
                    avgPrice: parseFloat(data.p)
                })
            },
            BYBIT: {
                name: 'BYBIT',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><title>bybit</title><path d="M11.11,5.83a6.31,6.31,0,0,0-.86-.23L6.26.36s-.77.35-.82.39L8.81,4.93A3.78,3.78,0,0,1,7.92,5L4.37,1.47l-.61.7L6.7,5c-.06.07-.73.34-.79.42L3.08,3.26c0,.05-.35.77-.38.82L5,5.72c0,.07-.57.54-.62.62L2.65,5.43v.88l1,.63-.07.15-.92-.18.66.5C2,9.25,2.31,12.2,4,14.23l-.63-1.76H3.5l1.17,2.65a7.12,7.12,0,0,0,.84.24L3.64,11.25a5.1,5.1,0,0,1,.27-.6L6.8,15.93a7.79,7.79,0,0,0,1,.06L4.33,10.16a5.09,5.09,0,0,0,1,.41L9,15.93a6.74,6.74,0,0,0,.86-.3L6.35,10.9a7,7,0,0,0,1,.13L11,15s.67-.55.71-.6L8.59,11.21c.06-.07.82-.21.88-.28l3,2.49.53-.73-2.53-2c0-.08.66-.47.71-.55l2.11,1.29s.11-.84.13-.88L12,9.59a6.8,6.8,0,0,1,.5-.59l.93.19-.68-.5c1.29-1.7.92-5-.82-7L12.79,4a5,5,0,0,0-.55.1L10.66.72c-.05,0-.89-.36-.95-.33l2.35,4.74c-.05,0-.62-.07-.67,0L8.41,0a6.74,6.74,0,0,0-.9.14Z" fill="#f9b600"/></svg>',
                wsEndpoint: 'wss://stream.bybit.com/v5/public/linear',
                formatter: (msg) => {
                    if (!msg.data || !msg.data[0]) return null;
                    const trade = msg.data[0];
                    return {
                        id: trade.i,
                        price: parseFloat(trade.p),
                        quantity: parseFloat(trade.v),
                        side: trade.S,
                        timestamp: trade.T,
                        exchange: 'BYBIT'
                    };
                }
            },
            OKX: {
                name: 'OKX',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 14c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z" fill="#000000"/><path d="M6 6h4v4H6z" fill="#000000"/></svg>',
                wsEndpoint: 'wss://ws.okx.com:8443/ws/v5/public',
                formatter: (msg) => {
                    if (!msg.data || !msg.data[0]) return null;
                    const trade = msg.data[0];
                    return {
                        id: trade.tradeId,
                        price: parseFloat(trade.px),
                        quantity: parseFloat(trade.sz),
                        side: trade.side.toUpperCase(),
                        timestamp: parseInt(trade.ts),
                        exchange: 'OKX'
                    };
                }
            },
            BITGET: {
                name: 'BITGET',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 14c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z" fill="#00c2ff"/><path d="M5 5h6v6H5z" fill="#00c2ff"/></svg>',
                wsEndpoint: 'wss://ws.bitget.com/spot/v1/stream',
                formatter: (msg) => {
                    if (!msg.data || !msg.data[0]) return null;
                    const trade = msg.data[0];
                    return {
                        id: `${trade.ts}-${trade.p}`,
                        price: parseFloat(trade.p),
                        quantity: parseFloat(trade.v),
                        side: trade.S,
                        timestamp: parseInt(trade.ts),
                        exchange: 'BITGET'
                    };
                }
            },
            MEXC: {
                name: 'MEXC',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 14c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z" fill="#ff6b35"/><path d="M5 5h6v6H5z" fill="#ff6b35"/></svg>',
                wsEndpoint: 'wss://wbs.mexc.com/ws',
                formatter: (data) => ({
                    exchange: 'MEXC',
                    price: parseFloat(data.p),
                    amount: parseFloat(data.v),
                    side: data.T === 1 ? 'buy' : 'sell',
                    timestamp: data.t,
                    size: parseFloat(data.v),
                    avgPrice: parseFloat(data.p)
                })
            }
        };

        // DOM이 로드된 후 초기화
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        console.log('Whale Tracker initializing...');
        this.allExchanges = Object.keys(this.exchanges);
        this.setupAudio();
        await this.connectAllExchanges();
        this.start();
    }

    setupAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.audioGain = this.audioContext.createGain();
            this.audioGain.connect(this.audioContext.destination);
            this.audioGain.gain.value = this.audioVolume;
        } catch (error) {
            console.warn('Audio not supported:', error);
        }
    }

    async connectAllExchanges() {
        for (const [exchangeName, exchange] of Object.entries(this.exchanges)) {
            await this.connectExchange(exchangeName, exchange);
        }
    }

    async connectExchange(exchangeName, exchange) {
        try {
            const ws = new WebSocket(exchange.wsEndpoint);
            
            ws.onopen = () => {
                console.log(`Connected to ${exchangeName}`);
                this.connections[exchangeName] = ws;
                
                // 구독 메시지 전송
                if (exchangeName === 'BYBIT') {
                    ws.send(JSON.stringify({
                        "op": "subscribe",
                        "args": ["publicTrade.BTCUSDT"]
                    }));
                } else if (exchangeName === 'OKX') {
                    ws.send(JSON.stringify({
                        "op": "subscribe",
                        "args": [{
                            "channel": "trades",
                            "instId": "BTC-USDT"
                        }]
                    }));
                } else if (exchangeName === 'BITGET') {
                    ws.send(JSON.stringify({
                        "op": "subscribe",
                        "args": ["spot@public.deals.v3.api@BTCUSDT"]
                    }));
                } else if (exchangeName === 'MEXC') {
                    ws.send(JSON.stringify({
                        "method": "SUBSCRIPTION",
                        "params": ["spot@public.deals.v3.api@BTC_USDT"]
                    }));
                }
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    const trade = exchange.formatter(data);
                    
                    if (trade && trade.amount * trade.price >= this.audioThreshold) {
                        this.processTrade(trade);
                    }
                } catch (error) {
                    console.warn(`Error processing ${exchangeName} message:`, error);
                }
            };

            ws.onerror = (error) => {
                console.error(`${exchangeName} WebSocket error:`, error);
                this.reconnectExchange(exchangeName, exchange);
            };

            ws.onclose = () => {
                console.log(`${exchangeName} WebSocket closed`);
                this.reconnectExchange(exchangeName, exchange);
            };

        } catch (error) {
            console.error(`Failed to connect to ${exchangeName}:`, error);
        }
    }

    reconnectExchange(exchangeName, exchange) {
        setTimeout(() => {
            console.log(`Attempting to reconnect ${exchangeName}...`);
            this.connectExchange(exchangeName, exchange);
        }, 5000);
    }

    processTrade(trade) {
        if (!trade) return;

        // USD 가치 계산
        trade.usdValue = trade.price * trade.quantity;

        // 대량 거래 필터링
        if (trade.usdValue >= this.settings.largeTradeThreshold) {
            this.whaleTrades.unshift(trade);
            if (this.whaleTrades.length > this.maxTrades) {
                this.whaleTrades.pop();
            }
        }
    }

    playAudioAlert(trade) {
        if (!this.audioContext || this.muted) return;

        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioGain);
            
            // 거래 방향과 크기에 따른 주파수 설정
            const baseFreq = trade.side === 'buy' ? 440 : 330;
            const sizeMultiplier = Math.min(trade.value / 1000000, 2);
            oscillator.frequency.value = baseFreq * this.audioPitch * sizeMultiplier;
            
            // 거래 크기에 따른 볼륨 설정
            const volume = Math.min(trade.value / 1000000, 1);
            gainNode.gain.value = volume * this.audioVolume;
            
            // 페이드 인/아웃
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(volume * this.audioVolume, this.audioContext.currentTime + 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.5);
            
        } catch (error) {
            console.warn('Audio playback failed:', error);
        }
    }

    triggerWhaleAlert(trade) {
        // 알림 생성
        const notification = document.createElement('div');
        notification.className = `whale-alert whale-alert-${trade.side} whale-alert-level-${trade.level}`;
        notification.innerHTML = `
            <div class="whale-alert-content">
                <div class="whale-alert-header">
                    <span class="whale-alert-exchange">${trade.exchange}</span>
                    <span class="whale-alert-side">${trade.side.toUpperCase()}</span>
                </div>
                <div class="whale-alert-details">
                    <div class="whale-alert-price">$${trade.price.toLocaleString()}</div>
                    <div class="whale-alert-amount">${this.formatAmount(trade.value)}</div>
                </div>
                <div class="whale-alert-time">${this.formatTime(trade.timestamp)}</div>
            </div>
        `;
        
        if (document.body) {
            document.body.appendChild(notification);
            
            // 5초 후 제거
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 5000);
        }
    }

    updateTradeDisplay() {
        const container = document.getElementById('whale-trades-container');
        if (!container) return;

        container.innerHTML = '';
        
        this.trades.forEach(trade => {
            const tradeElement = this.createTradeElement(trade);
            container.appendChild(tradeElement);
        });
    }

    createTradeElement(trade) {
        const li = document.createElement('li');
        li.className = `trade trade-${trade.exchange.toLowerCase()} trade-${trade.side} trade-level-${trade.level}`;
        li.style.cssText = this.getTradeStyles(trade);
        
        // 1M 이상 거래에 애니메이션 클래스 추가
        if (trade.value >= 1000000) {
            li.classList.add('mega-whale-animation');
        }
        
        const exchangeIcon = this.showLogos ? 
            `<div class="trade-exchange-icon">${this.exchanges[trade.exchange]?.icon || '📊'}</div>` : '';
        
        const priceDisplay = this.showPrices ? 
            `<div class="trade-price">$${trade.price.toLocaleString()}</div>` : '';
        
        const timeDisplay = this.showTimeAgo ? 
            `<div class="trade-time">${this.formatTimeAgo(trade.timestamp)}</div>` : '';
        
        li.innerHTML = `
            ${exchangeIcon}
            ${priceDisplay}
            <div class="trade-amount">
                <span class="trade-amount-quote">$${this.formatAmount(trade.value)}</span>
            </div>
            ${timeDisplay}
        `;
        
        return li;
    }

    getTradeStyles(trade) {
        const threshold = this.thresholds.find(t => t.level === trade.level);
        const color = trade.side === 'buy' ? threshold.buyColor : threshold.sellColor;
        
        return `
            background-color: ${color};
            color: ${trade.side === 'buy' ? '#2d5a2d' : '#8b0000'};
            font-weight: ${trade.level >= 2 ? 'bold' : 'normal'};
            font-size: ${1 + trade.level * 0.1}em;
            box-shadow: ${trade.level >= 2 ? '0 0 10px rgba(0,0,0,0.3)' : 'none'};
        `;
    }

    formatAmount(amount) {
        if (amount >= 1000000) {
            return (amount / 1000000).toFixed(1) + 'M';
        } else if (amount >= 1000) {
            return (amount / 1000).toFixed(1) + 'K';
        }
        return amount.toLocaleString();
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    }

    formatTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) {
            return Math.floor(diff / 1000) + 's';
        } else if (diff < 3600000) {
            return Math.floor(diff / 60000) + 'm';
        } else {
            return Math.floor(diff / 3600000) + 'h';
        }
    }

    start() {
        this.isTracking = true;
        console.log('Whale tracker started');
    }

    stop() {
        this.isTracking = false;
        Object.values(this.connections).forEach(ws => ws.close());
        this.connections = {};
        console.log('Whale tracker stopped');
    }

    refresh() {
        console.log('Refreshing whale tracker...');
        this.trades = [];
        this.updateTradeDisplay();
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.audioThreshold = this.settings.whaleBtcThreshold ? this.settings.whaleBtcThreshold * 1000 : 100000;
        this.muted = !this.settings.enableSound;
    }

    getStats() {
        const totalTrades = this.trades.length;
        const totalValue = this.trades.reduce((sum, trade) => sum + trade.value, 0);
        const buyTrades = this.trades.filter(trade => trade.side === 'buy').length;
        const sellTrades = this.trades.filter(trade => trade.side === 'sell').length;
        
        return {
            totalTrades,
            totalValue,
            buyTrades,
            sellTrades,
            averageValue: totalTrades > 0 ? totalValue / totalTrades : 0
        };
    }

    getWhaleTransactions() {
        return this.whaleTrades;
    }

    waitForContainer() {
        return new Promise((resolve, reject) => {
            let retries = 0;
            const interval = setInterval(() => {
                const container = document.getElementById('whale-trades-container');
                if (container) {
                    clearInterval(interval);
                    resolve(container);
                } else {
                    retries++;
                    if (retries > 5) {
                        clearInterval(interval);
                        reject(new Error('Failed to find whale-trades-container after 5 retries'));
                    }
                }
            }, 500);
        });
    }
}

// CSS 스타일 추가
const whaleTrackerStyles = `
<style>
/* Advanced Whale Tracker CSS - AGGR Style */

/* Main Container */
.whale-trades-container {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background:rgb(255, 255, 255);
    color: #ffffff;
    border-radius: 8px;
    padding: 0;
    margin: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
}

/* Trade List */
.whale-trades-container ul {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    max-height: 400px;
    scrollbar-width: thin;
    scrollbar-color: #333 #1a1a1a;
    flex: 1;
}

.whale-trades-container ul::-webkit-scrollbar {
    width: 6px;
}

.whale-trades-container ul::-webkit-scrollbar-track {
    background: #1a1a1a;
}

.whale-trades-container ul::-webkit-scrollbar-thumb {
    background: #333;
    border-radius: 3px;
}

.whale-trades-container ul::-webkit-scrollbar-thumb:hover {
    background: #555;
}

/* Individual Trade Items */
.trade {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    margin: 2px 0;
    border-radius: 4px;
    transition: all 0.2s ease;
    position: relative;
    font-size: 0.875rem;
    line-height: 1.4;
    border-left: 3px solid transparent;
    animation: tradeSlideIn 0.3s ease-out;
    gap: 8px;
}

.trade:hover {
    transform: translateX(2px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

/* Trade Levels */
.trade-level-0 {
    font-size: 0.875rem;
    opacity: 0.8;
}

.trade-level-1 {
    font-size: 1rem;
    opacity: 0.9;
}

.trade-level-2 {
    font-size: 1.125rem;
    font-weight: 600;
    opacity: 1;
    box-shadow: 0 0 10px rgba(0,0,0,0.3);
}

.trade-level-3 {
    font-size: 1.25rem;
    font-weight: 700;
    opacity: 1;
    box-shadow: 0 0 20px rgba(0,0,0,0.5);
    animation: whalePulse 2s infinite;
}

/* Mega Whale Animation for 1M+ trades */
.mega-whale-animation {
    animation: megaWhaleGlow 3s ease-in-out infinite;
    background: linear-gradient(90deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 215, 0, 0.05) 100%);
    border-left-color: #ffd700 !important;
}

/* Trade Side Colors */
.trade-buy {
    background: linear-gradient(90deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%);
    border-left-color: #22c55e;
    color: #22c55e;
}

.trade-sell {
    background: linear-gradient(90deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%);
    border-left-color: #ef4444;
    color: #ef4444;
}

/* Trade Content Layout */
.trade-exchange-icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.trade-exchange-icon svg {
    width: 16px;
    height: 16px;
    display: block;
}

.trade-exchange {
    font-weight: 600;
    min-width: 80px;
    margin-right: 12px;
}

.trade-price {
    font-weight: 700;
    min-width: 80px;
    text-align: right;
    flex-shrink: 0;
}

.trade-amount {
    flex: 1;
    display: flex;
    flex-direction: column;
}

.trade-amount-quote {
    font-weight: 600;
    font-size: 1.1em;
}

.trade-amount-base {
    font-size: 0.8em;
    opacity: 0.7;
}

.trade-time {
    font-size: 0.75em;
    opacity: 0.6;
    min-width: 30px;
    text-align: right;
    flex-shrink: 0;
}

/* Whale Alerts */
.whale-alert {
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
    border: 2px solid;
    border-radius: 8px;
    padding: 16px;
    min-width: 300px;
    max-width: 400px;
    z-index: 10000;
    animation: alertSlideIn 0.5s ease-out;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}

.whale-alert-buy {
    border-color: #22c55e;
    box-shadow: 0 8px 32px rgba(34, 197, 94, 0.2);
}

.whale-alert-sell {
    border-color: #ef4444;
    box-shadow: 0 8px 32px rgba(239, 68, 68, 0.2);
}

.whale-alert-level-2 {
    border-width: 3px;
    transform: scale(1.05);
}

.whale-alert-level-3 {
    border-width: 4px;
    transform: scale(1.1);
    animation: whaleAlertPulse 1s infinite;
}

.whale-alert-content {
    color: #ffffff;
}

.whale-alert-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-weight: 700;
}

.whale-alert-exchange {
    font-size: 1.1em;
}

.whale-alert-side {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.8em;
    font-weight: 700;
    text-transform: uppercase;
}

.whale-alert-buy .whale-alert-side {
    background: #22c55e;
    color: #000;
}

.whale-alert-sell .whale-alert-side {
    background: #ef4444;
    color: #fff;
}

.whale-alert-details {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.whale-alert-price {
    font-size: 1.5em;
    font-weight: 700;
}

.whale-alert-amount {
    font-size: 1.2em;
    font-weight: 600;
    opacity: 0.9;
}

.whale-alert-time {
    font-size: 0.8em;
    opacity: 0.6;
    text-align: right;
}

/* Animations */
@keyframes tradeSlideIn {
    from {
        opacity: 0;
        transform: translateX(-20px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

@keyframes whalePulse {
    0%, 100% {
        box-shadow: 0 0 20px rgba(0,0,0,0.5);
    }
    50% {
        box-shadow: 0 0 30px rgba(34, 197, 94, 0.3);
    }
}

@keyframes megaWhaleGlow {
    0%, 100% {
        box-shadow: 0 0 15px rgba(255, 215, 0, 0.3);
        transform: scale(1);
    }
    50% {
        box-shadow: 0 0 25px rgba(255, 215, 0, 0.6);
        transform: scale(1.02);
    }
}

@keyframes alertSlideIn {
    from {
        opacity: 0;
        transform: translateX(100px) scale(0.8);
    }
    to {
        opacity: 1;
        transform: translateX(0) scale(1);
    }
}

@keyframes whaleAlertPulse {
    0%, 100% {
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }
    50% {
        box-shadow: 0 8px 32px rgba(34, 197, 94, 0.4);
    }
}

/* Exchange-specific styling */
.trade-binance {
    border-left-color: #f3ba2f;
}

.trade-binance_futures {
    border-left-color: #f3ba2f;
}

.trade-bybit {
    border-left-color: #00d4aa;
}

.trade-okx {
    border-left-color: #000000;
}

.trade-bitget {
    border-left-color: #00c2ff;
}

.trade-mexc {
    border-left-color: #ff6b35;
}

/* Mega whale trades get special treatment */
.mega-whale-animation.trade-binance,
.mega-whale-animation.trade-binance_futures {
    border-left-color: #ffd700 !important;
}

.mega-whale-animation.trade-bybit {
    border-left-color: #ffd700 !important;
}

.mega-whale-animation.trade-okx {
    border-left-color: #ffd700 !important;
}

.mega-whale-animation.trade-bitget {
    border-left-color: #ffd700 !important;
}

.mega-whale-animation.trade-mexc {
    border-left-color: #ffd700 !important;
}

/* Loading States */
.whale-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: #666;
}

.whale-loading::after {
    content: '';
    width: 20px;
    height: 20px;
    border: 2px solid #333;
    border-top: 2px solid #22c55e;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-left: 10px;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* Responsive Design */
@media (max-width: 768px) {
    .whale-trades-container {
        font-size: 0.8rem;
        max-height: 300px;
    }
    
    .whale-trades-container ul {
        max-height: 300px;
    }
    
    .trade {
        padding: 6px 8px;
        gap: 6px;
    }
    
    .trade-price {
        min-width: 70px;
        font-size: 0.9em;
    }
    
    .trade-exchange-icon {
        width: 18px;
        height: 18px;
    }
    
    .trade-exchange-icon svg {
        width: 14px;
        height: 14px;
    }
    
    .whale-alert {
        top: 10px;
        right: 10px;
        left: 10px;
        min-width: auto;
        max-width: none;
    }
}

@media (max-width: 480px) {
    .whale-trades-container {
        max-height: 250px;
    }
    
    .whale-trades-container ul {
        max-height: 250px;
    }
    
    .trade {
        flex-direction: row;
        align-items: center;
        gap: 4px;
        padding: 4px 6px;
    }
    
    .trade-amount {
        flex-direction: row;
        gap: 4px;
    }
    
    .trade-amount-quote {
        font-size: 1em;
    }
    
    .whale-alert {
        padding: 12px;
    }
    
    .whale-alert-price {
        font-size: 1.2em;
    }
    
    .whale-alert-amount {
        font-size: 1em;
    }
}
</style>
`;

// CSS 스타일을 문서에 추가
if (document.head) {
    document.head.insertAdjacentHTML('beforeend', whaleTrackerStyles);
}

// 전역 객체로 내보내기
window.WhaleTracker = WhaleTracker;

// 통계 업데이트 함수
function updateWhaleStats() {
    if (window.whaleTracker) {
        const stats = window.whaleTracker.getStats();
        
        // 통계 요소들 업데이트
        const totalTradesEl = document.getElementById('total-trades');
        const totalVolumeEl = document.getElementById('total-volume');
        const buyTradesEl = document.getElementById('buy-trades');
        const sellTradesEl = document.getElementById('sell-trades');
        const tradesCountEl = document.getElementById('trades-count');
        
        if (totalTradesEl) totalTradesEl.textContent = stats.totalTrades;
        if (totalVolumeEl) {
            totalVolumeEl.textContent = stats.totalValue >= 1000000 ? 
                `$${(stats.totalValue/1000000).toFixed(1)}M` :
                stats.totalValue >= 1000 ? `$${(stats.totalValue/1000).toFixed(0)}K` : 
                `$${stats.totalValue}`;
        }
        if (buyTradesEl) buyTradesEl.textContent = stats.buyTrades;
        if (sellTradesEl) sellTradesEl.textContent = stats.sellTrades;
        if (tradesCountEl) tradesCountEl.textContent = `${stats.totalTrades} trades`;
    }
}

// 연결 상태 업데이트 함수
function updateConnectionStatus() {
    if (!window.whaleTracker) return;
    
    const statusContainer = document.getElementById('connection-status');
    if (!statusContainer) return;
    
    const exchanges = ['BINANCE', 'BINANCE_FUTURES', 'BYBIT', 'OKX', 'BITGET', 'MEXC'];
    
    exchanges.forEach((exchange, index) => {
        const statusItem = statusContainer.children[index];
        if (statusItem) {
            const isConnected = window.whaleTracker.connections[exchange] && 
                              window.whaleTracker.connections[exchange].readyState === WebSocket.OPEN;
            
            if (isConnected) {
                statusItem.className = 'status-item status-connected';
            } else {
                statusItem.className = 'status-item status-disconnected';
            }
        }
    });
}

// 주기적 업데이트 시작
setInterval(updateWhaleStats, 1000);
setInterval(updateConnectionStatus, 2000);

console.log('🐋 Advanced Whale Tracker loaded successfully!'); 