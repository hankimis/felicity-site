/**
 * Advanced Whale Tracker - AGGR Style Implementation
 * 실시간 암호화폐 고래 거래 추적 시스템
 */

export class WhaleTracker {
    constructor(settings = {}) {
        this.defaultMarkets = [
            // BINANCE_FUTURES btcusdt (btcusd_perp는 존재하지 않음)
            { id: 'binance_futures_btcusdt', exchange: 'Binance', type: 'Futures', symbol: 'BTCUSDT', rawSymbol: 'btcusdt', enabled: true, threshold: 100000 },
            // BITFINEX BTCUSD
            { id: 'bitfinex_spot_btcusd', exchange: 'Bitfinex', type: 'Spot', symbol: 'BTCUSD', rawSymbol: 'tBTCUSD', enabled: true, threshold: 100000 },
            // BITMEX XBTUSD
            { id: 'bitmex_futures_xbtusd', exchange: 'BitMEX', type: 'Futures', symbol: 'XBTUSD', rawSymbol: 'XBTUSD', enabled: true, threshold: 100000 },
            // BYBIT BTCUSD
            { id: 'bybit_futures_btcusd', exchange: 'Bybit', type: 'Inverse', symbol: 'BTCUSD', rawSymbol: 'BTCUSD', enabled: true, threshold: 100000 },
            // COINBASE BTC-USD
            { id: 'coinbase_spot_btcusd', exchange: 'Coinbase', type: 'Spot', symbol: 'BTC-USD', rawSymbol: 'BTC-USD', enabled: true, threshold: 100000 },
            // DERIBIT BTC-PERPETUAL
            { id: 'deribit_futures_btc_perpetual', exchange: 'Deribit', type: 'Futures', symbol: 'BTC-PERPETUAL', rawSymbol: 'BTC-PERPETUAL', enabled: true, threshold: 100000 },
            // BINANCE btcusdt
            { id: 'binance_spot_btcusdt', exchange: 'Binance', type: 'Spot', symbol: 'BTCUSDT', rawSymbol: 'btcusdt', enabled: true, threshold: 100000 },
            // BITFINEX BTCUST
            { id: 'bitfinex_spot_btcust', exchange: 'Bitfinex', type: 'Spot', symbol: 'BTCUST', rawSymbol: 'tBTCUST', enabled: true, threshold: 100000 },
            // BITFINEX BTCF0:USTF0 (올바른 형식으로 수정)
            { id: 'bitfinex_futures_btcf0_ustf0', exchange: 'Bitfinex', type: 'Futures', symbol: 'BTCF0:USTF0', rawSymbol: 'tBTCF0:USTF0', enabled: false, threshold: 100000 },
            // BITMEX XBTUSDT
            { id: 'bitmex_futures_xbtusdt', exchange: 'BitMEX', type: 'Futures', symbol: 'XBTUSDT', rawSymbol: 'XBTUSDT', enabled: true, threshold: 100000 },
            // BYBIT BTCUSDT
            { id: 'bybit_futures_btcusdt', exchange: 'Bybit', type: 'Linear', symbol: 'BTCUSDT', rawSymbol: 'BTCUSDT', enabled: true, threshold: 100000 },
            // COINBASE BTC-USDT
            { id: 'coinbase_spot_btcusdt', exchange: 'Coinbase', type: 'Spot', symbol: 'BTC-USDT', rawSymbol: 'BTC-USDT', enabled: true, threshold: 100000 },
            // BITSTAMP btcusd
            { id: 'bitstamp_spot_btcusd', exchange: 'Bitstamp', type: 'Spot', symbol: 'btcusd', rawSymbol: 'btcusd', enabled: true, threshold: 100000 },
            // OKEX BTC-USD-SWAP
            { id: 'okx_futures_btcusd_swap', exchange: 'OKX', type: 'Futures', symbol: 'BTC-USD-SWAP', rawSymbol: 'BTC-USD-SWAP', enabled: true, threshold: 100000 },
            // OKEX BTC-USDT-SWAP
            { id: 'okx_futures_btcusdt_swap', exchange: 'OKX', type: 'Futures', symbol: 'BTC-USDT-SWAP', rawSymbol: 'BTC-USDT-SWAP', enabled: true, threshold: 100000 },
        ];

        this.settings = {
            largeTradeThreshold: 100000, // This can be a global fallback
            enableSound: false,
            ...settings
        };
        
        this.markets = JSON.parse(localStorage.getItem('whaleTrackerMarkets')) || this.defaultMarkets;

        this.whaleTrades = [];
        this.lastTradeId = null;
        this.trades = [];
        this.maxTrades = 100;
        this.isTracking = false;
        this.connections = {};
        this.audioContext = null;
        this.audioGain = null;
        this.recentTradeIds = new Set();
        this.tradeIdQueue = [];
        this.maxRecentIds = 500;
        
        // 거래소별 통계 추가
        this.exchangeStats = {};
        
        this.thresholds = [
            { amount: 1000000, buyColor: '#81FFB0', sellColor: '#FE8E8E' },
            { amount: 400000,  buyColor: '#ABFECA', sellColor: '#FFADAD' },
            { amount: 200000,  buyColor: '#C3FFD9', sellColor: '#FDCBCB' },
            { amount: 150000,  buyColor: '#E1FFEC', sellColor: '#FFE0E0' },
            { amount: 100000,  buyColor: '#EFFAF3', sellColor: '#FEF1F1' }
        ];
        
        // 오디오 설정
        this.audioThreshold = 100000;
        this.muted = !this.settings.enableSound;
        this.audioVolume = 0.5;
        
        // DOM 요소
        this.container = document.getElementById('whale-trades-container');
        
        // 초기화
        this.init();
    }

    async init() {
        this.setupAudio();
        this.connectWebSockets();
        this.start();
        
        // 연결 상태 업데이트
        setTimeout(() => {
            this.updateConnectionStatus();
        }, 2000);
    }

    setupAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.audioGain = this.audioContext.createGain();
            this.audioGain.connect(this.audioContext.destination);
            this.audioGain.gain.value = this.muted ? 0 : this.audioVolume;
        } catch (error) {
            // Audio not supported
            this.audioContext = null;
        }
    }

    connectWebSockets() {
        this.closeAllConnections();
        
        // 기본 시장 설정 (실제 작동하는 연결만)
        const defaultMarkets = [
            {
                id: 'BINANCE_SPOT',
                exchange: 'Binance',
                type: 'Spot',
                symbol: 'BTCUSDT',
                rawSymbol: 'BTCUSDT',
                enabled: true,
                threshold: 50000
            },
            {
                id: 'BINANCE_FUTURES',
                exchange: 'Binance',
                type: 'Futures',
                symbol: 'BTCUSDT',
                rawSymbol: 'BTCUSDT',
                enabled: true,
                threshold: 50000
            },
            {
                id: 'BYBIT_LINEAR',
                exchange: 'Bybit',
                type: 'Linear',
                symbol: 'BTCUSDT',
                rawSymbol: 'BTCUSDT',
                enabled: true,
                threshold: 50000
            }
        ];
        
        // 기존 markets가 없거나 비어있으면 기본값 사용
        const marketsToConnect = this.markets.length > 0 ? this.markets : defaultMarkets;
        
        let connectedCount = 0;
        marketsToConnect.forEach(market => {
            if (!market.enabled) return;

            const connector = this[`connect${market.exchange}${market.type}`];
            if (typeof connector === 'function') {
                try {
                    connector.call(this, market);
                    connectedCount++;
                } catch (error) {
                    console.warn(`Failed to connect to ${market.exchange} ${market.type}:`, error);
                }
            }
        });
        
        // 연결 상태 업데이트
        this.updateConnectionStatus(connectedCount);
    }
    
    addTrade(trade) {
        this.addTrades([trade]);
    }

    addTrades(trades) {
        const newValidTrades = [];
        for (const trade of trades) {
            if (this.recentTradeIds.has(trade.id)) {
                continue; // 중복 거래 건너뛰기
            }

            const market = this.markets.find(m => m.exchange === trade.exchange && (m.symbol === trade.symbol || m.rawSymbol === trade.symbol || m.id.includes(trade.symbol.toLowerCase())));
            const threshold = market ? market.threshold : this.settings.largeTradeThreshold;
            
            // 100K 이상만 탐지
            const realThreshold = Math.max(threshold, 100000); // 최소 $100K
            
            if (trade.value >= realThreshold) {
                newValidTrades.push(trade);
                this.recentTradeIds.add(trade.id);
                this.tradeIdQueue.push(trade.id);
                
                // 고래 거래 감지됨 (콘솔 로그 제거)
            }
        }

        while (this.tradeIdQueue.length > this.maxRecentIds) {
            const oldId = this.tradeIdQueue.shift();
            this.recentTradeIds.delete(oldId);
        }

        if (newValidTrades.length === 0) return;

        newValidTrades.forEach(trade => {
            if (!this.exchangeStats[trade.exchange]) {
                this.exchangeStats[trade.exchange] = { count: 0, totalValue: 0 };
            }
            this.exchangeStats[trade.exchange].count++;
            this.exchangeStats[trade.exchange].totalValue += trade.value;
        });

        // this.trades 배열에 추가 (이게 중요!)
        this.trades.unshift(...newValidTrades.sort((a, b) => b.timestamp - a.timestamp));
        if (this.trades.length > 50) {
            this.trades.length = 50;
        }

        // whaleTrades도 유지 (호환성)
        this.whaleTrades.unshift(...newValidTrades.sort((a, b) => b.timestamp - a.timestamp));
        if (this.whaleTrades.length > 50) {
            this.whaleTrades.length = 50;
        }

        const largestTrade = newValidTrades.reduce((max, t) => t.value > max.value ? t : max, newValidTrades[0]);
        this.playAudioAlert(largestTrade);
        this.updateDisplay();
        
        console.log(`🐋 총 거래 수: ${this.trades.length}, 새 거래: ${newValidTrades.length}`);
    }

    // --- Exchange-specific connectors for SPOT markets ---

    connectBinanceSpot(market) {
        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${market.rawSymbol.toLowerCase()}@aggTrade`);
        
        ws.onopen = () => {
            console.log(`🐋 Binance Spot 연결됨: ${market.symbol}`);
        };
        
        ws.onmessage = (event) => {
            const t = JSON.parse(event.data);
            this.addTrade({
                id: t.a.toString(),
                price: parseFloat(t.p),
                quantity: parseFloat(t.q),
                value: parseFloat(t.p) * parseFloat(t.q),
                side: t.m ? 'sell' : 'buy',
                timestamp: t.T,
                exchange: 'Binance',
                symbol: market.symbol
            });
        };
        
        ws.onerror = (e) => {
            console.error(`🐋 Binance Spot 연결 오류: ${market.symbol}`, e);
        };
        
        ws.onclose = (e) => {
            console.log(`🐋 Binance Spot 연결 종료: ${market.symbol}, 코드: ${e.code}`);
            if (this.isTracking) {
                setTimeout(() => this.connectBinanceSpot(market), 5000);
            }
        };
        
        this.connections[market.id] = ws;
    }

    // --- Exchange-specific connectors for FUTURES markets ---

    connectBinanceFutures(market) {
        const ws = new WebSocket(`wss://fstream.binance.com/ws/${market.rawSymbol.toLowerCase()}@aggTrade`);
        
        ws.onopen = () => {
            console.log(`🐋 Binance Futures 연결됨: ${market.symbol}`);
        };
        
        ws.onmessage = (event) => {
            const t = JSON.parse(event.data);
            this.addTrade({
                id: t.a.toString(),
                price: parseFloat(t.p),
                quantity: parseFloat(t.q),
                value: parseFloat(t.p) * parseFloat(t.q),
                side: t.m ? 'sell' : 'buy',
                timestamp: t.T,
                exchange: 'Binance',
                symbol: market.symbol,
                type: 'Futures'
            });
        };
        
        ws.onerror = (e) => {
            console.error(`🐋 Binance Futures 연결 오류: ${market.symbol}`, e);
        };
        
        ws.onclose = (e) => {
            console.log(`🐋 Binance Futures 연결 종료: ${market.symbol}, 코드: ${e.code}`);
            if (this.isTracking) {
                setTimeout(() => this.connectBinanceFutures(market), 5000);
            }
        };
        
        this.connections[market.id] = ws;
    }

    connectBybitLinear(market) {
        const ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');
        ws.onopen = () => ws.send(JSON.stringify({ "op": "subscribe", "args": [`publicTrade.${market.rawSymbol}`] }));
        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.topic && msg.topic.startsWith('publicTrade') && Array.isArray(msg.data)) {
                const trades = msg.data.map(t => ({
                    id: t.i,
                    price: parseFloat(t.p),
                    quantity: parseFloat(t.v),
                    value: parseFloat(t.p) * parseFloat(t.v),
                    side: t.S === 'Buy' ? 'buy' : 'sell',
                    timestamp: parseInt(t.t),
                    exchange: 'Bybit',
                    symbol: market.symbol,
                    type: 'Futures'
                }));
                this.addTrades(trades);
            }
        };
        ws.onerror = (e) => {
            // Bybit Linear WS Error
        };
        ws.onclose = () => { if (this.isTracking) setTimeout(() => this.connectBybitLinear(market), 5000); };
        this.connections[market.id] = ws;
    }

    connectBybitInverse(market) {
        const ws = new WebSocket('wss://stream.bybit.com/v5/public/inverse');
        ws.onopen = () => ws.send(JSON.stringify({ "op": "subscribe", "args": [`publicTrade.${market.rawSymbol}`] }));
        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.topic && msg.topic.startsWith('publicTrade') && Array.isArray(msg.data)) {
                const trades = msg.data.map(t => ({
                    id: t.i,
                    price: parseFloat(t.p),
                    quantity: parseFloat(t.v),
                    value: parseFloat(t.v), // For inverse, value is in contracts, not USD
                    side: t.S === 'Buy' ? 'buy' : 'sell',
                    timestamp: parseInt(t.t),
                    exchange: 'Bybit',
                    symbol: market.symbol,
                    type: 'Futures'
                }));
                this.addTrades(trades);
            }
        };
        ws.onerror = (e) => {
            // Bybit Inverse WS Error
        };
        ws.onclose = () => { if (this.isTracking) setTimeout(() => this.connectBybitInverse(market), 5000); };
        this.connections[market.id] = ws;
    }

    connectOKXFutures(market) {
        const ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');
        ws.onopen = () => ws.send(JSON.stringify({ "op": "subscribe", "args": [{ "channel": "trades", "instId": market.rawSymbol }] }));
        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.data) {
                const trades = msg.data.map(t => {
                    const price = parseFloat(t.px);
                    const quantity = parseFloat(t.sz);
                    const contractValue = 100;
                    const value = quantity * contractValue;
                    return {
                        id: t.tradeId,
                        price: price,
                        quantity: quantity,
                        value: value,
                        side: t.side,
                        timestamp: parseInt(t.ts),
                        exchange: 'OKX',
                        symbol: market.symbol,
                        type: 'Futures'
                    };
                });
                this.addTrades(trades);
            }
        };
        ws.onerror = (e) => {
            // OKX Futures WS Error
        };
        ws.onclose = () => { if (this.isTracking) setTimeout(() => this.connectOKXFutures(market), 5000); };
        this.connections[market.id] = ws;
    }

    connectBitfinexSpot(market) {
        const ws = new WebSocket('wss://api-pub.bitfinex.com/ws/2');
        ws.onopen = () => ws.send(JSON.stringify({ event: 'subscribe', channel: 'trades', symbol: market.rawSymbol }));
        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (Array.isArray(msg) && (msg[1] === 'te' || msg[1] === 'tu')) {
                const t = msg[2];
                this.addTrade({
                    id: `${market.id}-${t[0]}`,
                    price: parseFloat(t[3]),
                    quantity: Math.abs(parseFloat(t[2])),
                    value: parseFloat(t[3]) * Math.abs(parseFloat(t[2])),
                    side: parseFloat(t[2]) > 0 ? 'buy' : 'sell',
                    timestamp: t[1],
                    exchange: 'Bitfinex',
                    symbol: market.symbol,
                    type: 'Spot'
                });
            }
        };
        ws.onerror = (e) => {
            // Bitfinex Spot WS Error
        };
        ws.onclose = () => { if (this.isTracking) setTimeout(() => this.connectBitfinexSpot(market), 5000); };
        this.connections[market.id] = ws;
    }

    connectBitfinexFutures(market) {
        const ws = new WebSocket('wss://api-pub.bitfinex.com/ws/2');
        ws.onopen = () => ws.send(JSON.stringify({ event: 'subscribe', channel: 'trades', symbol: market.rawSymbol }));
        ws.onmessage = (event) => {
             const msg = JSON.parse(event.data);
            if (Array.isArray(msg) && (msg[1] === 'te' || msg[1] === 'tu')) {
                 const t = msg[2];
                this.addTrade({
                    id: `${market.id}-${t[0]}`,
                    price: parseFloat(t[3]),
                    quantity: Math.abs(parseFloat(t[2])),
                    value: parseFloat(t[3]) * Math.abs(parseFloat(t[2])),
                    side: parseFloat(t[2]) > 0 ? 'buy' : 'sell',
                    timestamp: t[1],
                    exchange: 'Bitfinex',
                    symbol: market.symbol,
                    type: 'Futures'
                });
            }
        };
        ws.onerror = (e) => {
            // Bitfinex Futures WS Error
        };
        ws.onclose = () => { if (this.isTracking) setTimeout(() => this.connectBitfinexFutures(market), 5000); };
        this.connections[market.id] = ws;
    }

    connectBitMEXFutures(market) {
        const ws = new WebSocket('wss://ws.bitmex.com/realtime');
        ws.onopen = () => ws.send(JSON.stringify({ op: 'subscribe', args: [`trade:${market.rawSymbol}`] }));
        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.table === 'trade' && msg.data) {
                const trades = msg.data.map(t => ({
                    id: t.trdMatchID,
                    price: t.price,
                    quantity: t.size,
                    value: t.homeNotional,
                    side: t.side.toLowerCase(),
                    timestamp: new Date(t.timestamp).getTime(),
                    exchange: 'BitMEX',
                    symbol: market.symbol,
                    type: 'Futures'
                }));
                this.addTrades(trades);
            }
        };
        ws.onerror = (e) => {
            // BitMEX Futures WS Error
        };
        ws.onclose = () => { if (this.isTracking) setTimeout(() => this.connectBitMEXFutures(market), 5000); };
        this.connections[market.id] = ws;
    }

    connectCoinbaseSpot(market) {
        const ws = new WebSocket('wss://advanced-trade-ws.coinbase.com');
        ws.onopen = () => ws.send(JSON.stringify({
            type: 'subscribe',
            product_ids: [market.rawSymbol],
            channel: 'matches'
        }));
        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.channel === 'matches' && msg.events) {
                const trades = msg.events.flatMap(e => e.trades ? e.trades.map(t => {
                    const price = parseFloat(t.price);
                    const size = parseFloat(t.size);
                    return {
                        id: t.trade_id.toString(),
                        price: price,
                        quantity: size,
                        value: price * size,
                        side: t.side.toLowerCase(),
                        timestamp: new Date(t.time).getTime(),
                        exchange: 'Coinbase',
                        symbol: market.symbol,
                        type: 'Spot'
                    };
                }) : []);
                if(trades.length > 0) {
                    this.addTrades(trades);
                }
            }
        };
        ws.onerror = (e) => {
            // Coinbase Spot WS Error
        };
        ws.onclose = () => { if (this.isTracking) setTimeout(() => this.connectCoinbaseSpot(market), 5000); };
        this.connections[market.id] = ws;
    }

    connectDeribitFutures(market) {
        const ws = new WebSocket('wss://www.deribit.com/ws/api/v2');
        ws.onopen = () => ws.send(JSON.stringify({ jsonrpc: '2.0', method: 'public/subscribe', params: { channels: [`trades.${market.rawSymbol}.raw`] } }));
        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.method === 'subscription' && msg.params.data) {
                const trades = msg.params.data.map(t => ({
                    id: t.trade_id,
                    price: t.price,
                    quantity: t.amount,
                    value: t.price * t.amount,
                    side: t.direction,
                    timestamp: t.timestamp,
                    exchange: 'Deribit',
                    symbol: market.symbol,
                    type: 'Futures'
                }));
                this.addTrades(trades);
            }
        };
        ws.onerror = (e) => {
            // Deribit Futures WS Error
        };
        ws.onclose = () => { if (this.isTracking) setTimeout(() => this.connectDeribitFutures(market), 5000); };
        this.connections[market.id] = ws;
    }

    connectBitstampSpot(market) {
        const ws = new WebSocket('wss://ws.bitstamp.net');
        ws.onopen = () => ws.send(JSON.stringify({ event: 'bts:subscribe', data: { channel: `live_trades_${market.rawSymbol}` } }));
        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.event === 'trade') {
                const t = msg.data;
                this.addTrade({
                    id: t.id.toString(),
                    price: t.price,
                    quantity: t.amount,
                    value: t.price * t.amount,
                    side: t.type === 0 ? 'buy' : 'sell',
                    timestamp: parseInt(t.timestamp) * 1000,
                    exchange: 'Bitstamp',
                    symbol: market.symbol,
                    type: 'Spot'
                });
            }
        };
        ws.onerror = (e) => {
            // Bitstamp Spot WS Error
        };
        ws.onclose = () => { if (this.isTracking) setTimeout(() => this.connectBitstampSpot(market), 5000); };
        this.connections[market.id] = ws;
    }

    playAudioAlert(trade) {
        if (!this.audioContext || this.muted) return;

        const oscillator = this.audioContext.createOscillator();
        oscillator.connect(this.audioGain);
        
        oscillator.type = trade.side === 'buy' ? 'sine' : 'sawtooth';
        oscillator.frequency.setValueAtTime(trade.side === 'buy' ? 880 : 440, this.audioContext.currentTime);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }
    
    updateDisplay() {
        const container = document.querySelector('.whale-trades-list');
        if (!container) return;

        if (this.trades.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">고래 거래 대기 중...</div>';
            return;
        }

        // 최신 거래부터 표시 (위에서 아래로 떨어지는 효과)
        const recentTrades = this.trades.slice(0, 15); // 최신 15개만 표시
        container.innerHTML = recentTrades.map(trade => this.createTradeHTML(trade)).join('');
        
        this.updateStats();
    }
    
    createTradeHTML(trade) {
        const { side, exchange, symbol, price, value, timestamp } = trade;
        const timeAgo = this.formatTimeAgo(timestamp);
        const arrow = side === 'buy' ? '▲' : '▼';
        const exchangeIcon = this.getExchangeIcon(exchange);
        
        // 거래량 크기에 따른 레벨 결정
        let level = 1;
        if (value >= 1000000) level = 4;      // $1M+
        else if (value >= 500000) level = 3;  // $500K+
        else if (value >= 250000) level = 2;  // $250K+
        else level = 1;                       // $100K+
        
        const sideClass = side === 'sell' ? 'sell' : '';
        const levelClass = `level-${level}`;

        return `
            <div class="whale-trade-pixel ${levelClass} ${sideClass}">
                <span class="trade-arrow">${arrow}</span>
                <span class="trade-exchange-icon">${exchangeIcon}</span>
                <span class="trade-price">${price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                <span class="trade-amount">${this.formatValue(value)}</span>
                <span class="trade-time">${timeAgo}</span>
            </div>
        `;
    }

    getExchangeIcon(exchange) {
        const icons = {
            'Binance': 'BN',
            'Bybit': 'BY',
            'OKX': 'OK',
            'Bitget': 'BG',
            'MEXC': 'MX',
            'BitMEX': 'BM',
            'Coinbase': 'CB',
            'Deribit': 'DB',
            'Bitfinex': 'BF',
            'Bitstamp': 'BS'
        };
        return icons[exchange] || exchange.substring(0, 2).toUpperCase();
    }

    formatValue(value) {
        if (value >= 1000000) {
            return `$${(value / 1000000).toFixed(1)} M`;
        }
        if (value >= 1000) {
            return `$${(value / 1000).toFixed(1)} K`;
        }
        return `$${value.toFixed(0)}`;
    }

    formatTimeAgo(timestamp) {
        const now = Date.now();
        const seconds = Math.floor((now - timestamp) / 1000);

        if (seconds < 60) {
            return `${seconds}s`;
        }
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m`;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    }

    updateStats() {
        // This function is no longer needed as the stats elements are removed.
    }
    
    updateConnectionStatus(connectedCount = null) {
        const statusElement = document.querySelector('.whale-status');
        if (!statusElement) return;
        
        if (connectedCount !== null) {
            if (connectedCount > 0) {
                statusElement.textContent = `${connectedCount}개 거래소 연결됨`;
                statusElement.style.color = '#22c55e';
            } else {
                statusElement.textContent = '연결 실패';
                statusElement.style.color = '#ef4444';
            }
        } else {
            // 연결 상태 확인
            const activeConnections = Object.values(this.connections).filter(conn => 
                conn && conn.readyState === WebSocket.OPEN
            ).length;
            
            // 테스트 데이터 생성 중인지 확인
            if (this.testDataInterval && this.isTracking) {
                statusElement.textContent = '테스트 데이터 생성 중';
                statusElement.style.color = '#f59e0b';
            } else if (activeConnections > 0) {
                statusElement.textContent = `${activeConnections}개 거래소 연결됨`;
                statusElement.style.color = '#22c55e';
            } else {
                statusElement.textContent = '연결 중...';
                statusElement.style.color = '#f59e0b';
            }
        }
    }

    getStats() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        
        const recentTrades = this.trades.filter(trade => trade.timestamp > oneMinuteAgo);
        const buyTrades = recentTrades.filter(trade => trade.side === 'buy');
        const sellTrades = recentTrades.filter(trade => trade.side === 'sell');
        
        return {
            totalTrades: recentTrades.length,
            buyTrades: buyTrades.length,
            sellTrades: sellTrades.length,
            totalValue: recentTrades.reduce((sum, trade) => sum + trade.value, 0),
            avgValue: recentTrades.length > 0 ? recentTrades.reduce((sum, trade) => sum + trade.value, 0) / recentTrades.length : 0
        };
    }

    start() {
        this.isTracking = true;
        console.log('🐋 고래 탐지 시작... (실제 데이터만)');
        
        // 실제 WebSocket 연결만 시도
        this.connectWebSockets();
        
        // 10초마다 거래소별 통계 출력
        this.statsInterval = setInterval(() => {
            this.logExchangeStats();
        }, 10000);
        
        // 연결 상태 확인
        setTimeout(() => {
            this.checkConnections();
        }, 5000);
    }

    checkConnections() {
        const connectedCount = Object.values(this.connections).filter(ws => 
            ws && ws.readyState === WebSocket.OPEN
        ).length;
        
        if (connectedCount === 0) {
            console.warn('🐋 고래 탐지: 실제 거래소 연결 실패. 테스트 데이터를 생성합니다.');
            this.startTestDataGeneration();
        } else {
            console.log(`🐋 고래 탐지: ${connectedCount}개 거래소 연결됨`);
        }
    }

    // 테스트 데이터 생성 (WebSocket 연결 실패 시)
    startTestDataGeneration() {
        if (this.testDataInterval) return; // 이미 실행 중이면 중단
        
        console.log('🐋 테스트 고래 거래 데이터 생성 시작...');
        
        // 연결 상태 업데이트
        this.updateConnectionStatus();
        
        this.testDataInterval = setInterval(() => {
            if (!this.isTracking) {
                clearInterval(this.testDataInterval);
                this.testDataInterval = null;
                return;
            }
            
            // 랜덤 고래 거래 생성
            const exchanges = ['Binance', 'Bybit', 'OKX'];
            const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
            const sides = ['buy', 'sell'];
            
            const exchange = exchanges[Math.floor(Math.random() * exchanges.length)];
            const symbol = symbols[Math.floor(Math.random() * symbols.length)];
            const side = sides[Math.floor(Math.random() * sides.length)];
            
            // 실제 가격 범위 시뮬레이션
            const basePrices = { 'BTCUSDT': 95000, 'ETHUSDT': 3500, 'SOLUSDT': 200 };
            const basePrice = basePrices[symbol];
            const price = basePrice * (0.98 + Math.random() * 0.04); // ±2% 변동
            
            // 고래 거래 크기 (100K ~ 2M) - 다양한 레벨 테스트
            const rand = Math.random();
            let value;
            if (rand < 0.1) {
                value = 1000000 + Math.random() * 1000000; // 10% 확률로 $1M-2M (레벨 4)
            } else if (rand < 0.25) {
                value = 500000 + Math.random() * 500000; // 15% 확률로 $500K-1M (레벨 3)
            } else if (rand < 0.5) {
                value = 250000 + Math.random() * 250000; // 25% 확률로 $250K-500K (레벨 2)
            } else {
                value = 100000 + Math.random() * 150000; // 50% 확률로 $100K-250K (레벨 1)
            }
            const quantity = value / price;
            
            const testTrade = {
                id: `test_${Date.now()}_${Math.random()}`,
                price,
                quantity,
                value,
                side,
                timestamp: Date.now(),
                exchange,
                symbol,
                type: 'Test'
            };
            
            this.addTrade(testTrade);
            
        }, 3000); // 3초마다 새로운 테스트 거래 생성
    }

    stop() {
        this.isTracking = false;
        this.closeAllConnections();
        
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }
        
        if (this.testDataInterval) {
            clearInterval(this.testDataInterval);
            this.testDataInterval = null;
        }
        
        console.log('🐋 고래 탐지 중지됨');
    }

    updateSymbol(newSymbol) {
       // This function will be replaced by a more generic updateSettings function
       // updateSymbol is deprecated. Use updateSettings instead.
    }

    closeAllConnections() {
        Object.values(this.connections).forEach(ws => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        });
        this.connections = {};
    }

    updateSettings(newMarkets) {
        this.markets = newMarkets;
        localStorage.setItem('whaleTrackerMarkets', JSON.stringify(this.markets));
        this.connectWebSockets();
    }

    // --- UI and Settings Panel Logic ---

    openSettingsModal() {
        const modal = document.getElementById('whale-settings-modal');
        const listEl = document.getElementById('whale-settings-list');
        if (!modal || !listEl) return;

        listEl.innerHTML = this.markets.map(market => `
            <div class="market-setting-item" data-market-id="${market.id}">
                <div class="market-info">
                    <span class="exchange-name">${market.exchange} <span class="market-type">${market.type}</span></span>
                    <span class="market-symbol">${market.symbol}</span>
                </div>
                <div class="market-controls">
                    <div class="threshold-slider">
                        <label>최소금액: <span class="threshold-value">$${(market.threshold / 1000)}k</span></label>
                        <input type="range" min="10000" max="1000000" step="10000" value="${market.threshold}" class="slider">
                    </div>
                    <label class="switch">
                        <input type="checkbox" ${market.enabled ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>
            </div>
        `).join('');

        modal.style.display = 'flex';
        this.addSettingsEventListeners();
    }

    addSettingsEventListeners() {
        document.getElementById('close-whale-settings')?.addEventListener('click', () => this.closeSettingsModal());
        document.getElementById('save-whale-settings')?.addEventListener('click', () => this.saveSettings());
        
        document.querySelectorAll('.market-setting-item .slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const valueEl = e.target.previousElementSibling.querySelector('.threshold-value');
                valueEl.textContent = `$${(e.target.value / 1000)}k`;
            });
        });
    }

    closeSettingsModal() {
        const modal = document.getElementById('whale-settings-modal');
        if(modal) modal.style.display = 'none';
    }

    saveSettings() {
        const newMarkets = [...this.markets];
        document.querySelectorAll('.market-setting-item').forEach(item => {
            const marketId = item.dataset.marketId;
            const market = newMarkets.find(m => m.id === marketId);
            if (market) {
                market.enabled = item.querySelector('input[type="checkbox"]').checked;
                market.threshold = parseInt(item.querySelector('input[type="range"]').value, 10);
            }
        });

        this.updateSettings(newMarkets);
        this.closeSettingsModal();
    }

    // 거래소별 통계 출력 함수 추가
    logExchangeStats() {
        // Exchange Statistics (Last 10 seconds)
        Object.entries(this.exchangeStats).forEach(([exchange, stats]) => {
            // ${exchange}: ${stats.count} trades, Total: $${stats.totalValue.toLocaleString()}
        });
        // ==========================================
        
        // 통계 초기화
        this.exchangeStats = {};
    }
}

// CSS 스타일 추가
const whaleTrackerStyles = `
<style>
/* Advanced Whale Tracker - New UI */
:root {
    --long-color: #16a34a;
    --long-bg: rgba(22, 163, 74, 0.15);
    --long-bg-highlight: rgba(22, 163, 74, 0.3);
    --short-color: #dc2626;
    --short-bg: rgba(220, 38, 38, 0.15);
    --short-bg-highlight: rgba(220, 38, 38, 0.3);
}

.whale-trades-container {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #e5e7eb; /* Light gray text */
    padding: 0;
    margin: 0;
    overflow: hidden;
    background-color:rgb(255, 255, 255); /* Dark background */
}

.whale-trades-container ul {
    list-style: none;
    margin: 0;
    padding: 0;
}

.whale-trade-item {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid #1f2937; /* Slightly lighter border */
    font-size: 14px;
    font-weight: 500;
}

.trade-item.long { background-color: var(--long-bg); }
.trade-item.short { background-color: var(--short-bg); }

.trade-icon {
    width: 20px;
    font-size: 16px;
    text-align: center;
}

.trade-exchange {
    flex-grow: 1;
    display: flex;
    align-items: center;
    gap: 8px;
}

.trade-exchange img {
    width: 16px;
    height: 16px;
    border-radius: 50%;
}

.trade-price {
    width: 100px;
    text-align: right;
    font-weight: 700;
    font-size: 15px;
}

.trade-value {
    width: 100px;
    text-align: right;
    font-weight: 700;
    font-size: 15px;
}

.trade-time {
    width: 40px;
    text-align: right;
    color: #9ca3af; /* Muted color for time */
    font-size: 13px;
}

/* Highlight styles */
.trade-item.whale {
    /* Optional: style for 500k+ trades */
}

.trade-item.super-whale {
    font-weight: 700;
}
.trade-item.super-whale.long { background-color: var(--long-bg-highlight); }
.trade-item.super-whale.short { background-color: var(--short-bg-highlight); }

.trade-item.mega-whale {
    font-weight: 700;
    border-left: 4px solid;
}
.trade-item.mega-whale.long {
    background: linear-gradient(90deg, rgba(34, 197, 94, 0.4) 0%, var(--long-bg-highlight) 100%);
    border-left-color: #4ade80;
}
.trade-item.mega-whale.short {
    background: linear-gradient(90deg, rgba(239, 68, 68, 0.4) 0%, var(--short-bg-highlight) 100%);
    border-left-color: #f87171;
}

/* --- Light Mode Styles --- */
body.light-mode .whale-trades-container {
    background-color: #ffffff;
    color: #1f2937;
}

body.light-mode .whale-trade-item {
    border-bottom-color: #f3f4f6;
}

body.light-mode {
    --long-color: #166534;
    --long-bg: #f0fdf4;
    --long-bg-highlight: #dcfce7;
    --short-color: #991b1b;
    --short-bg: #fef2f2;
    --short-bg-highlight: #fee2e2;
}

body.light-mode .trade-item.long .trade-value,
body.light-mode .trade-item.short .trade-value {
    color: #111827;
}

body.light-mode .trade-price {
    color: #374151;
}

body.light-mode .trade-time {
    color: #6b7280;
}

/* --- Settings Modal Styles --- */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}
.modal-content {
    background-color: #1f2937;
    padding: 20px;
    border-radius: 8px;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
}
.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #374151;
    padding-bottom: 10px;
    margin-bottom: 15px;
}
.modal-header h2 { margin: 0; }
.modal-close {
    background: none;
    border: none;
    font-size: 24px;
    color: #9ca3af;
    cursor: pointer;
}
.modal-body {
    overflow-y: auto;
    flex-grow: 1;
}
.modal-footer {
    padding-top: 15px;
    border-top: 1px solid #374151;
    text-align: right;
}

.market-setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 8px;
    border-bottom: 1px solid #374151;
}
.market-info .exchange-name { font-weight: bold; font-size: 1.1em; }
.market-info .market-type { font-size: 0.8em; color: #9ca3af; padding: 2px 5px; background-color: #374151; border-radius: 4px; margin-left: 5px;}
.market-info .market-symbol { color: #d1d5db; }
.market-controls { display: flex; align-items: center; gap: 20px; }
.threshold-slider label { font-size: 0.9em; color: #9ca3af; }
.threshold-slider .threshold-value { font-weight: bold; color: #e5e7eb;}
.threshold-slider input[type="range"] { width: 120px; }

/* Switch Toggle */
.switch { position: relative; display: inline-block; width: 50px; height: 28px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #374151; transition: .4s; }
.slider.round { border-radius: 28px; }
.slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; }
input:checked + .slider { background-color: #22c55e; }
input:focus + .slider { box-shadow: 0 0 1px #22c55e; }
input:checked + .slider:before { transform: translateX(22px); }

/* --- Light Mode for Modal --- */
body.light-mode .modal-content { background-color: #f9fafb; color: #111827; }
body.light-mode .modal-header, body.light-mode .modal-footer, body.light-mode .market-setting-item { border-color: #e5e7eb; }
body.light-mode .modal-header h2 { color: #111827; }
body.light-mode .market-info .market-symbol { color: #374151; }
body.light-mode .market-info .market-type { background-color: #e5e7eb; color: #4b5563; }
body.light-mode .threshold-slider label { color: #6b7280; }
body.light-mode .threshold-slider .threshold-value { color: #111827; }
body.light-mode .slider { background-color: #ccc; }
body.light-mode .slider:before { background-color: white; }

</style>
`;

document.head.insertAdjacentHTML('beforeend', whaleTrackerStyles);

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