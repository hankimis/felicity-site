import { AnalysisUtils } from '../analysis-utils.js';

/**
 * Realtime Trades Module
 * 실시간 거래 모듈
 */
export class RealtimeTrades {
    constructor() {
        this.currentSymbol = 'BTCUSDT';
        this.trades = [];
        this.maxTrades = 50;
        this.isTracking = false;
        this.socket = null;
        this.lastPrice = 0;
        this.currentPrice = 0;
    }

    start() {
        if (this.isTracking) return;
        this.isTracking = true;
        this.connect();
    }

    stop() {
        if (!this.isTracking) return;
        this.isTracking = false;
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }

    connect() {
        if (this.socket) {
            this.socket.close();
        }
        const wsUrl = `wss://stream.binance.com:9443/ws/${this.currentSymbol.toLowerCase()}@trade`;
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => console.log(`[RealtimeTrades] Connected to ${this.currentSymbol}`);
        this.socket.onmessage = (event) => this.handleTradeData(JSON.parse(event.data));
        this.socket.onerror = (error) => console.error('[RealtimeTrades] WebSocket Error:', error);
        this.socket.onclose = () => {
            if (this.isTracking) {
                console.log('[RealtimeTrades] WebSocket disconnected. Reconnecting...');
                setTimeout(() => this.connect(), 5000);
            }
        };
    }

    handleTradeData(data) {
        const trade = {
            price: parseFloat(data.p),
            quantity: parseFloat(data.q),
            timestamp: data.T,
            side: data.m ? 'sell' : 'buy',
        };

        this.trades.unshift(trade);
        if (this.trades.length > this.maxTrades) {
            this.trades.pop();
        }
        this.currentPrice = trade.price;
    }

    getTrades() {
        return this.trades || [];
    }

    getCurrentPrice() {
        return this.currentPrice;
    }

    getLastPrice() {
        return this.lastPrice;
    }

    setLastPrice(price) {
        this.lastPrice = price;
    }
} 