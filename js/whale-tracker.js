class WhaleTracker {
    constructor(container) {
        this.container = container;
        this.trades = [];
        this.maxTrades = 200; // 최대 표시 거래 수 증가
        this.audioEnabled = false;
        this.tradeThreshold = 100000; // $100k minimum
        
        // Add long/short tracking
        this.longVolume = 0;
        this.shortVolume = 0;
        this.volumeWindow = 5 * 60 * 1000; // 5 minutes in milliseconds
        this.recentTrades = [];
        
        // Only setup UI and connect WebSockets if container exists
        if (this.container) {
            this.setupUI();
            this.connectWebSockets();
            
            // Start periodic ratio updates
            setInterval(() => this.updateLSRatio(), 1000);
        } else {
            console.log('🐋 WhaleTracker: Container is null, running in headless mode');
            // Headless mode - only connect WebSockets and track trades
            this.connectWebSockets();
            
            // Start periodic ratio updates
            setInterval(() => this.updateLSRatio(), 1000);
        }
    }

    setupUI() {
        // Add audio toggle button (if container exists)
        if (this.container) {
            const audioBtn = document.createElement('button');
            audioBtn.innerHTML = '🔊';
            audioBtn.onclick = () => this.toggleAudio();
            audioBtn.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                background: rgba(0,0,0,0.5);
                border: none;
                border-radius: 4px;
                padding: 8px;
                cursor: pointer;
                color: white;
            `;
            this.container.appendChild(audioBtn);
        }
    }

    connectWebSockets() {
        // Connect to various exchange WebSockets
        this.connectBinance();
        this.connectBybit();
        this.connectOKX();
        this.connectBitget();
        this.connectMEXC();
    }

    getTradeLevel(amount) {
        if (amount >= 1000000) return 3; // $1M+
        if (amount >= 500000) return 2;  // $500k+
        if (amount >= 250000) return 1;  // $250k+
        return 0; // $100k+
    }

    formatAmount(amount) {
        if (amount >= 1000000) {
            return `$${(amount / 1000000).toFixed(1)}M`;
        }
        return `$${(amount / 1000).toFixed(1)}K`;
    }

    updateLSRatio() {
        // Keep only the last 20 trades
        if (this.recentTrades.length > 20) {
            this.recentTrades = this.recentTrades.slice(-20);
        }

        console.log('📊 Calculating from', this.recentTrades.length, 'trades');

        // Calculate volumes from last 20 trades
        this.longVolume = this.recentTrades
            .filter(t => t.side === 'BUY')
            .reduce((sum, t) => sum + t.amount, 0);
        
        this.shortVolume = this.recentTrades
            .filter(t => t.side === 'SELL')
            .reduce((sum, t) => sum + t.amount, 0);

        // Calculate ratio
        const totalVolume = this.longVolume + this.shortVolume;
        const longRatio = totalVolume > 0 ? (this.longVolume / totalVolume) * 100 : 50;

        console.log(`📊 Calculated from ${this.recentTrades.length} trades: ${longRatio.toFixed(1)}% (Buy: ${this.longVolume.toFixed(0)}, Sell: ${this.shortVolume.toFixed(0)})`);

        // Update mini gauge in whale header
        this.updateWhaleHeaderGauge(longRatio);
    }

    updateWhaleHeaderGauge(ratio) {
        // 전역 게이지 업데이트 함수 사용
        if (window.tradingPlatform && window.tradingPlatform.updateWhaleRatioDisplay) {
            window.tradingPlatform.updateWhaleRatioDisplay(ratio, this.recentTrades.length);
        } else {
            // Fallback to direct element update
            const ratioValueMini = document.getElementById('whale-ls-ratio-mini');
            if (ratioValueMini) {
                ratioValueMini.textContent = `${ratio.toFixed(1)}%`;

                // Apply styling based on ratio
                if (ratio > 60) {
                    // 롱 우세 (초록색)
                    ratioValueMini.style.color = '#10b981';
                    ratioValueMini.style.background = 'rgba(16, 185, 129, 0.2)';
                    console.log('🎯 Applied long bias styling');
                } else if (ratio < 40) {
                    // 숏 우세 (빨간색)
                    ratioValueMini.style.color = '#ef4444';
                    ratioValueMini.style.background = 'rgba(239, 68, 68, 0.2)';
                    console.log('🎯 Applied short bias styling');
                } else {
                    // 중립 (회색)
                    ratioValueMini.style.color = '#6b7280';
                    ratioValueMini.style.background = 'rgba(107, 114, 128, 0.2)';
                    console.log('🎯 Applied neutral styling');
                }
            }
        }

        console.log('✅ Whale ratio display updated:', ratio.toFixed(1) + '%', `(${this.recentTrades.length} trades)`);
    }

    addTrade(exchange, price, amount, side) {
        const tradeAmount = price * amount;
        
        // Only show trades above threshold
        if (tradeAmount < this.tradeThreshold) return;

        // Add to recent trades for L/S ratio
        this.recentTrades.push({
            timestamp: Date.now(),
            side: side,
            amount: tradeAmount
        });

        // Keep only the last 20 trades for gauge calculation
        if (this.recentTrades.length > 20) {
            this.recentTrades = this.recentTrades.slice(-20);
        }

        const container = document.getElementById('whale-transactions');
        if (!container) return;

        // 최대 표시 거래 수 제한
        const maxTrades = 200;
        while (container.children.length >= maxTrades) {
            container.removeChild(container.lastChild);
        }

        const tradeLevel = this.getTradeLevel(tradeAmount);
        const formattedAmount = this.formatAmount(tradeAmount);
        
        const tradeItem = document.createElement('div');
        tradeItem.className = `trade-item ${side.toLowerCase()} level-${tradeLevel}`;
        
        // Trade HTML 구성
        tradeItem.innerHTML = `
            <div class="trade-exchange">
                <img src="images/exchanges/${exchange.toLowerCase()}.png" alt="${exchange}" class="exchange-icon" onerror="this.style.display='none'">
                <span class="exchange-name">${exchange}</span>
            </div>
            <div class="trade-info">
                <span class="trade-price">${price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                <span class="trade-amount">${formattedAmount}</span>
                <span class="trade-side ${side.toLowerCase()}">${side === 'BUY' || side === 'buy' ? '매수' : '매도'}</span>
            </div>
            <div class="trade-time">${new Date().toLocaleTimeString()}</div>
        `;

        // 새로운 거래를 맨 위에 추가
        container.insertBefore(tradeItem, container.firstChild);

        // 메가 고래 거래($1M+)에 대한 특별 애니메이션
        if (tradeAmount >= 1000000) {
            tradeItem.classList.add('mega-whale');
            setTimeout(() => tradeItem.classList.remove('mega-whale'), 2000);
        }

        // 사운드 재생
        if (this.audioEnabled && tradeAmount >= 500000) {
            this.playTradeSound(side);
        }

        // 스크롤 위치 유지
        container.scrollTop = 0;

        // 실시간 게이지 업데이트 (마지막 20개 거래 기반)
        this.updateGaugeFromRecentTrades();
    }

    updateGaugeFromRecentTrades() {
        if (this.recentTrades.length === 0) {
            this.updateWhaleHeaderGauge(50); // 기본값
            return;
        }

        // 롱/숏 볼륨 계산 (마지막 20개 거래)
        const longVolume = this.recentTrades
            .filter(t => t.side === 'BUY')
            .reduce((sum, t) => sum + t.amount, 0);
        
        const shortVolume = this.recentTrades
            .filter(t => t.side === 'SELL')
            .reduce((sum, t) => sum + t.amount, 0);

        // 비율 계산
        const totalVolume = longVolume + shortVolume;
        let longRatio = 50; // 기본값

        if (totalVolume > 0) {
            longRatio = (longVolume / totalVolume) * 100;
        }

        console.log(`📊 Real-time gauge update: ${longRatio.toFixed(1)}% (${this.recentTrades.length}/20 trades, Long: $${(longVolume/1000000).toFixed(1)}M, Short: $${(shortVolume/1000000).toFixed(1)}M)`);

        // 게이지 업데이트
        this.updateWhaleHeaderGauge(longRatio);
    }

    playTradeSound(side) {
        const audio = new Audio();
        audio.src = side.toLowerCase() === 'buy' ? 
            'sounds/buy.mp3' : 'sounds/sell.mp3';
        audio.play().catch(e => console.log('Audio play failed:', e));
    }

    toggleAudio() {
        this.audioEnabled = !this.audioEnabled;
    }

    // WebSocket connection methods
    connectBinance() {
        const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade');
        
        ws.onmessage = (event) => {
            const trade = JSON.parse(event.data);
            const amount = parseFloat(trade.q);
            const price = parseFloat(trade.p);
            
            // Binance uses 'm' (isMaker) flag - true for SELL, false for BUY
            this.addTrade('BINANCE', price, amount, 
                trade.m ? 'SELL' : 'BUY');
        };

        ws.onclose = () => {
            console.log('Binance WebSocket closed. Reconnecting...');
            setTimeout(() => this.connectBinance(), 1000);
        };
    }

    connectBybit() {
        const ws = new WebSocket('wss://stream.bybit.com/v5/public/spot');
        
        ws.onopen = () => {
            ws.send(JSON.stringify({
                "op": "subscribe",
                "args": ["trade.BTCUSDT"]
            }));
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.data) {
                const trade = data.data[0];
                // Bybit uses 'S' field directly as 'Buy' or 'Sell'
                const side = trade.S.toUpperCase();
                this.addTrade('BYBIT', 
                    parseFloat(trade.p),
                    parseFloat(trade.v),
                    side);
            }
        };

        ws.onclose = () => {
            console.log('Bybit WebSocket closed. Reconnecting...');
            setTimeout(() => this.connectBybit(), 1000);
        };
    }

    connectOKX() {
        const ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');
        
        ws.onopen = () => {
            ws.send(JSON.stringify({
                "op": "subscribe",
                "args": [{
                    "channel": "trades",
                    "instId": "BTC-USDT"
                }]
            }));
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.data) {
                const trade = data.data[0];
                // OKX uses 'side' field directly
                const side = trade.side.toUpperCase();
                this.addTrade('OKX',
                    parseFloat(trade.px),
                    parseFloat(trade.sz),
                    side);
            }
        };

        ws.onclose = () => {
            console.log('OKX WebSocket closed. Reconnecting...');
            setTimeout(() => this.connectOKX(), 1000);
        };
    }

    connectBitget() {
        const ws = new WebSocket('wss://ws.bitget.com/spot/v1/stream');
        
        ws.onopen = () => {
            ws.send(JSON.stringify({
                "op": "subscribe",
                "args": [{
                    "instType": "sp",
                    "channel": "trade",
                    "instId": "BTCUSDT"
                }]
            }));
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.data) {
                const trade = data.data[0];
                // Bitget uses 'side' field directly
                const side = trade.side.toUpperCase();
                this.addTrade('BITGET',
                    parseFloat(trade.price),
                    parseFloat(trade.size),
                    side);
            }
        };

        ws.onclose = () => {
            console.log('Bitget WebSocket closed. Reconnecting...');
            setTimeout(() => this.connectBitget(), 1000);
        };
    }

    connectMEXC() {
        const ws = new WebSocket('wss://wbs.mexc.com/ws');
        
        ws.onopen = () => {
            ws.send(JSON.stringify({
                "method": "SUBSCRIPTION",
                "params": ["spot@public.deals.v3.api@BTCUSDT"]
            }));
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.d) {
                const trade = data.d;
                // MEXC uses 'S' field as 1 for BUY, 2 for SELL
                const side = trade.S === 1 ? 'BUY' : 'SELL';
                this.addTrade('MEXC',
                    parseFloat(trade.p),
                    parseFloat(trade.v),
                    side);
            }
        };

        ws.onclose = () => {
            console.log('MEXC WebSocket closed. Reconnecting...');
            setTimeout(() => this.connectMEXC(), 1000);
        };
    }
}

// Export the WhaleTracker class
export default WhaleTracker; 