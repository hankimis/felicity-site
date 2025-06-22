/**
 * Market Heatmap Module
 * 암호화폐 시장 히트맵을 생성하고 표시하는 모듈
 */
export class MarketHeatmap {
    constructor() {
        this.currentTimeframe = '24h';
        this.marketData = [];
        this.isTracking = false;
        this.heatmapContainer = null;
        this.colors = {
            positive: ['#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d'],
            negative: ['#fef2f2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c']
        };
        
        this.init();
    }

    init() {
        console.log('🔥 Market Heatmap initializing...');
        this.setupEventListeners();
        this.heatmapContainer = document.getElementById('heatmap-container');
    }

    setupEventListeners() {
        // 시간대 변경
        const timeframeSelect = document.getElementById('heatmap-timeframe');
        if (timeframeSelect) {
            timeframeSelect.addEventListener('change', (e) => {
                this.currentTimeframe = e.target.value;
                this.generateHeatmap();
            });
        }
    }

    async start() {
        if (this.isTracking) return;
        
        this.isTracking = true;
        console.log('🔥 Starting market heatmap...');
        
        // 초기 데이터 로드
        await this.loadMarketData();
        
        // 히트맵 생성
        this.generateHeatmap();
        
        // 실시간 추적 시작
        this.startRealTimeTracking();
    }

    stop() {
        this.isTracking = false;
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
        }
        console.log('🔥 Market heatmap stopped');
    }

    async loadMarketData() {
        try {
            // CoinGecko API로 상위 100개 코인 데이터 가져오기
            await this.fetchTopCoins();
        } catch (error) {
            console.error('Error loading market data:', error);
            this.generateSampleData();
        }
    }

    async fetchTopCoins() {
        try {
            const response = await fetch(
                'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false'
            );
            
            if (!response.ok) {
                // HTTP 에러 상태를 명시적으로 에러로 처리
                throw new Error(`CoinGecko API Error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            this.marketData = data.map(coin => ({
                id: coin.id,
                symbol: coin.symbol.toUpperCase(),
                name: coin.name,
                price: coin.current_price,
                change_24h: coin.price_change_percentage_24h || 0,
                market_cap: coin.market_cap,
                volume: coin.total_volume,
                image: coin.image
            }));
            
        } catch (error) {
            console.warn('CoinGecko API fetching failed, trying Binance API as a fallback.', error);
            try {
                // API 실패 시 바이낸스 데이터로 대체
                await this.fetchBinanceData();
            } catch (fallbackError) {
                console.error('Fallback Binance API also failed. Generating sample data.', fallbackError);
                this.showErrorState('시장 데이터를 불러오는 데 실패했습니다.');
                this.generateSampleData(); // 최종 대체제로 샘플 데이터 생성
            }
        }
    }

    async fetchBinanceData() {
        try {
            const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
            const data = await response.json();
            
            // 주요 코인들만 필터링
            const majorCoins = data.filter(coin => 
                coin.symbol.endsWith('USDT') && 
                parseFloat(coin.quoteVolume) > 10000000 // 1천만 달러 이상 거래량
            ).slice(0, 30);
            
            this.marketData = majorCoins.map(coin => ({
                id: coin.symbol.replace('USDT', '').toLowerCase(),
                symbol: coin.symbol.replace('USDT', ''),
                name: coin.symbol.replace('USDT', ''),
                price: parseFloat(coin.lastPrice),
                change_24h: parseFloat(coin.priceChangePercent),
                market_cap: parseFloat(coin.quoteVolume) * 30, // 추정 시가총액
                volume: parseFloat(coin.quoteVolume),
                image: null
            }));
            
        } catch (error) {
            console.error('Error fetching Binance data:', error);
            throw error; // 이 에러를 호출자에게 전파하여 최종 처리를 할 수 있도록 함
        }
    }

    generateSampleData() {
        const coins = [
            'BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'XRP', 'DOT', 'DOGE', 'AVAX', 'SHIB',
            'MATIC', 'LTC', 'UNI', 'LINK', 'BCH', 'ALGO', 'ICP', 'VET', 'FIL', 'TRX'
        ];
        
        this.marketData = coins.map((symbol, index) => ({
            id: symbol.toLowerCase(),
            symbol: symbol,
            name: symbol,
            price: Math.random() * 1000 + 1,
            change_24h: (Math.random() - 0.5) * 20, // -10% ~ +10%
            market_cap: Math.random() * 50000000000 + 1000000000, // 10억~500억
            volume: Math.random() * 1000000000 + 100000000, // 1억~10억
            image: null
        }));
    }

    startRealTimeTracking() {
        this.trackingInterval = setInterval(async () => {
            if (this.isTracking) {
                await this.updateMarketData();
            }
        }, 300000); // 5분마다 업데이트
    }

    async updateMarketData() {
        try {
            await this.loadMarketData();
            this.generateHeatmap();
        } catch (error) {
            console.error('Error updating market data:', error);
        }
    }

    generateHeatmap() {
        if (!this.heatmapContainer || this.marketData.length === 0) {
            this.showLoadingState();
            return;
        }

        // 시가총액 기준으로 정렬
        const sortedData = [...this.marketData].sort((a, b) => b.market_cap - a.market_cap);
        
        // 상위 20개만 표시
        const topCoins = sortedData.slice(0, 20);
        
        // 히트맵 생성
        this.createTreemap(topCoins);
    }

    createTreemap(data) {
        const container = this.heatmapContainer;
        container.innerHTML = '';
        
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        if (containerWidth === 0 || containerHeight === 0) {
            console.warn("Heatmap container has zero dimensions.");
            return;
        }

        const totalMarketCap = data.reduce((sum, coin) => sum + coin.market_cap, 0);
        
        const squarify = (items, x, y, width, height) => {
            if (!items.length) return;

            const totalValue = items.reduce((sum, item) => sum + item.value, 0);
            
            let i = 1;
            for (; i < items.length; i++) {
                const row = items.slice(0, i + 1);
                if (this.worstAspectRatio(row, width, totalValue) > this.worstAspectRatio(items.slice(0, i), width, totalValue)) {
                    break;
                }
            }
            const currentRow = items.slice(0, i);
            const remaining = items.slice(i);
            
            const rowTotalValue = currentRow.reduce((sum, item) => sum + item.value, 0);
            const rowHeight = rowTotalValue / totalValue * height;
            
            let currentX = x;
            currentRow.forEach(item => {
                const itemWidth = item.value / rowTotalValue * width;
                this.createHeatmapTile(item.data, currentX, y, itemWidth, rowHeight);
                currentX += itemWidth;
            });

            squarify(remaining, x, y + rowHeight, width, height - rowHeight);
        };
        
        const items = data.map(coin => ({ value: coin.market_cap, data: coin }));
        squarify(items, 0, 0, containerWidth, containerHeight);
    }
    
    worstAspectRatio(row, length, totalValue) {
        const rowTotalValue = row.reduce((sum, item) => sum + item.value, 0);
        const rowArea = (rowTotalValue / totalValue) * length * length; // 가정: 정사각형 영역
        const rowLength = rowArea / length;
        let maxRatio = 0;
        row.forEach(item => {
            const itemArea = item.value / rowTotalValue * rowArea;
            const itemHeight = itemArea / rowLength;
            maxRatio = Math.max(maxRatio, rowLength / itemHeight, itemHeight / rowLength);
        });
        return maxRatio;
    }

    createHeatmapTile(coin, x, y, width, height) {
        const tile = document.createElement('div');
        tile.className = 'heatmap-tile';
        
        const change = coin.change_24h;
        const color = this.getColorForChange(change);
        
        tile.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            width: ${width - 2}px; /* border 고려 */
            height: ${height - 2}px; /* border 고려 */
            background-color: ${color};
            border: 1px solid rgba(0,0,0,0.3);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            transition: all 0.2s ease;
            box-sizing: border-box;
            overflow: hidden;
        `;
        
        const smallerDim = Math.min(width, height);
        const symbolSize = Math.max(8, smallerDim * 0.18);
        const changeSize = Math.max(7, smallerDim * 0.12);
        
        tile.innerHTML = `
            <div class="tile-symbol" style="
                font-weight: bold;
                font-size: ${symbolSize}px;
                color: ${this.getTextColor(color)};
                margin-bottom: ${smallerDim * 0.05}px;
                white-space: nowrap;
            ">${coin.symbol.replace(/USDT$/, '')}</div>
            <div class="tile-change" style="
                font-size: ${changeSize}px;
                color: ${this.getTextColor(color)};
                opacity: 0.9;
                white-space: nowrap;
            ">${change > 0 ? '+' : ''}${change.toFixed(2)}%</div>
        `;
        
        tile.addEventListener('mouseenter', () => {
            tile.style.zIndex = '10';
        });
        
        tile.addEventListener('mouseleave', () => {
            tile.style.zIndex = '1';
        });
        
        this.heatmapContainer.appendChild(tile);
    }

    getColorForChange(change) {
        const absChange = Math.abs(change);
        let colorIndex;
        
        if (absChange < 1) colorIndex = 0;
        else if (absChange < 3) colorIndex = 1;
        else if (absChange < 5) colorIndex = 2;
        else if (absChange < 10) colorIndex = 3;
        else if (absChange < 15) colorIndex = 4;
        else if (absChange < 25) colorIndex = 5;
        else colorIndex = 6;
        
        return change >= 0 ? this.colors.positive[colorIndex] : this.colors.negative[colorIndex];
    }

    getTextColor(backgroundColor) {
        // 배경색이 밝으면 검정, 어두우면 흰색
        const rgb = this.hexToRgb(backgroundColor);
        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
        return brightness > 150 ? '#1f2937' : '#ffffff';
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    showTooltip(coin, element) {
        // 간단한 툴팁 구현
        const tooltip = document.createElement('div');
        tooltip.className = 'heatmap-tooltip';
        tooltip.innerHTML = `
            <div><strong>${coin.name} (${coin.symbol})</strong></div>
            <div>가격: ${window.formatPrice(coin.price)}</div>
            <div>24h 변동: ${coin.change_24h > 0 ? '+' : ''}${coin.change_24h.toFixed(2)}%</div>
            <div>시가총액: ${window.formatNumber(coin.market_cap)}</div>
            <div>거래량: ${window.formatNumber(coin.volume)}</div>
        `;
        
        tooltip.style.cssText = `
            position: fixed;
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            pointer-events: none;
            z-index: 1000;
            max-width: 200px;
        `;
        
        document.body.appendChild(tooltip);
        this.currentTooltip = tooltip;
        
        // 마우스 위치에 따라 툴팁 위치 조정
        document.addEventListener('mousemove', this.updateTooltipPosition);
    }

    updateTooltipPosition = (e) => {
        if (this.currentTooltip) {
            this.currentTooltip.style.left = (e.clientX + 10) + 'px';
            this.currentTooltip.style.top = (e.clientY - 10) + 'px';
        }
    }

    hideTooltip() {
        if (this.currentTooltip) {
            document.body.removeChild(this.currentTooltip);
            this.currentTooltip = null;
            document.removeEventListener('mousemove', this.updateTooltipPosition);
        }
    }

    showLoadingState() {
        if (this.heatmapContainer) {
            this.heatmapContainer.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>히트맵 생성 중...</p>
                </div>
            `;
        }
    }

    async refresh() {
        console.log('🔥 Refreshing market heatmap...');
        this.showLoadingState();
        await this.loadMarketData();
        this.generateHeatmap();
        
        if (window.analysisDashboard) {
            window.analysisDashboard.showToast('히트맵이 업데이트되었습니다', 'success');
        }
    }

    // 외부에서 접근 가능한 메서드들
    getMarketData() {
        return this.marketData;
    }

    getTopMovers(type = 'gainers') {
        const sorted = [...this.marketData].sort((a, b) => 
            type === 'gainers' ? b.change_24h - a.change_24h : a.change_24h - b.change_24h
        );
        return sorted.slice(0, 5);
    }

    getMarketSummary() {
        const totalMarketCap = this.marketData.reduce((sum, coin) => sum + coin.market_cap, 0);
        const totalVolume = this.marketData.reduce((sum, coin) => sum + coin.volume, 0);
        const avgChange = this.marketData.reduce((sum, coin) => sum + coin.change_24h, 0) / this.marketData.length;
        
        return {
            totalMarketCap,
            totalVolume,
            avgChange: avgChange.toFixed(2),
            totalCoins: this.marketData.length
        };
    }

    showErrorState(message) {
        if (!this.heatmapContainer) return;
        this.heatmapContainer.innerHTML = `
            <div class="loading-state error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${message}</p>
                <button id="retry-market-data" class="retry-btn">재시도</button>
            </div>
        `;
        document.getElementById('retry-market-data')?.addEventListener('click', () => {
            this.showLoadingState();
            this.loadMarketData();
        });
    }

    getHeatmapData() {
        return this.heatmapData || [];
    }
} 