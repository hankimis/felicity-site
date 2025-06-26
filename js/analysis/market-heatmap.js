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
            // 더 현대적이고 시각적으로 매력적인 색상 팔레트
            positive: [
                '#f0fdf4', // 매우 연한 초록
                '#dcfce7', // 연한 초록
                '#bbf7d0', // 중간 연한 초록
                '#86efac', // 중간 초록
                '#4ade80', // 진한 초록
                '#22c55e', // 매우 진한 초록
                '#16a34a'  // 가장 진한 초록
            ],
            negative: [
                '#fef2f2', // 매우 연한 빨강
                '#fecaca', // 연한 빨강
                '#fca5a5', // 중간 연한 빨강
                '#f87171', // 중간 빨강
                '#ef4444', // 진한 빨강
                '#dc2626', // 매우 진한 빨강
                '#b91c1c'  // 가장 진한 빨강
            ],
            neutral: '#f8fafc' // 중립 색상 (변동이 거의 없을 때)
        };
        
        this.init();
    }

    init() {
        console.log('🔥 Market Heatmap initializing...');
        this.setupEventListeners();
        this.heatmapContainer = document.getElementById('heatmap-container');
        
        // 리사이즈 이벤트 리스너 추가
        this.resizeObserver = new ResizeObserver(() => {
            if (this.marketData.length > 0) {
                this.debounceRegenerate();
            }
        });
        
        if (this.heatmapContainer) {
            this.resizeObserver.observe(this.heatmapContainer);
        }
    }

    // 리사이즈 시 히트맵 재생성을 위한 디바운스 함수
    debounceRegenerate() {
        if (this.regenerateTimeout) {
            clearTimeout(this.regenerateTimeout);
        }
        this.regenerateTimeout = setTimeout(() => {
            this.generateHeatmap();
        }, 150);
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
        
        // 윈도우 리사이즈 이벤트 (추가 보험)
        window.addEventListener('resize', () => {
            this.debounceRegenerate();
        });
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
        if (this.regenerateTimeout) {
            clearTimeout(this.regenerateTimeout);
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        this.hideTooltip();
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
        
        // 상위 16개만 표시 (4x4 그리드에 최적화)
        const topCoins = sortedData.slice(0, 16);
        
        // 깔끔한 그리드 레이아웃으로 생성
        this.createGridHeatmap(topCoins);
    }

    createGridHeatmap(data) {
        const container = this.heatmapContainer;
        container.innerHTML = '';
        
        // 컨테이너에 히트맵 전용 스타일 적용
        container.style.cssText = `
            position: relative;
            width: 100%;
            height: 100%;
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            grid-template-rows: repeat(4, 1fr);
            gap: 2px;
            padding: 8px;
            box-sizing: border-box;
            background: #f8fafc;
            border-radius: 8px;
        `;
        
        const containerWidth = container.clientWidth - 16; // padding 고려
        const containerHeight = container.clientHeight - 16; // padding 고려

        if (containerWidth <= 0 || containerHeight <= 0) {
            console.warn("Heatmap container has zero dimensions.");
            setTimeout(() => this.generateHeatmap(), 100);
            return;
        }

        // 16개 그리드 셀 생성
        data.forEach((coin, index) => {
            this.createHeatmapTile(coin, index);
        });
        
        // 빈 셀 채우기 (16개 미만일 경우)
        for (let i = data.length; i < 16; i++) {
            this.createEmptyTile(i);
        }
    }

    createHeatmapTile(coin, index) {
        const tile = document.createElement('div');
        tile.className = 'heatmap-tile';
        
        const change = coin.change_24h;
        const color = this.getColorForChange(change);
        
        // 그리드 아이템 스타일
        tile.style.cssText = `
            position: relative;
            background-color: ${color};
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 4px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            transition: all 0.2s ease;
            box-sizing: border-box;
            overflow: hidden;
            min-height: 0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        `;
        
        // 동적 폰트 크기 계산 (컨테이너 크기 기반)
        const containerRect = this.heatmapContainer.getBoundingClientRect();
        const baseFontSize = Math.max(8, Math.min(14, containerRect.width / 30));
        
        const symbolSize = Math.max(10, baseFontSize * 1.2);
        const priceSize = Math.max(8, baseFontSize * 0.8);
        const changeSize = Math.max(9, baseFontSize * 0.9);
        
        // 가격 포맷팅
        const formatPrice = (price) => {
            if (price >= 1000) return `$${(price/1000).toFixed(1)}K`;
            if (price >= 1) return `$${price.toFixed(2)}`;
            if (price >= 0.01) return `$${price.toFixed(3)}`;
            return `$${price.toFixed(6)}`;
        };
        
        const textColor = this.getTextColor(color);
        
        tile.innerHTML = `
            <div class="tile-symbol" style="
                font-weight: bold;
                font-size: ${symbolSize}px;
                color: ${textColor};
                margin-bottom: 1px;
                white-space: nowrap;
                text-shadow: 0 1px 2px rgba(0,0,0,0.2);
                line-height: 1;
            ">${coin.symbol.replace(/USDT$/, '')}</div>
            <div class="tile-price" style="
                font-size: ${priceSize}px;
                color: ${textColor};
                opacity: 0.8;
                margin-bottom: 1px;
                white-space: nowrap;
                line-height: 1;
            ">${formatPrice(coin.price)}</div>
            <div class="tile-change" style="
                font-size: ${changeSize}px;
                font-weight: 600;
                color: ${textColor};
                padding: 1px 3px;
                border-radius: 2px;
                background: rgba(0,0,0,0.1);
                white-space: nowrap;
                line-height: 1;
            ">${change > 0 ? '+' : ''}${change.toFixed(2)}%</div>
        `;
        
        // 호버 효과
        tile.addEventListener('mouseenter', () => {
            tile.style.transform = 'scale(1.02)';
            tile.style.zIndex = '10';
            tile.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
            this.showTooltip(coin, tile);
        });
        
        tile.addEventListener('mouseleave', () => {
            tile.style.transform = 'scale(1)';
            tile.style.zIndex = '1';
            tile.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            this.hideTooltip();
        });
        
        // 클릭 이벤트
        tile.addEventListener('click', () => {
            console.log(`Clicked on ${coin.symbol}:`, coin);
        });
        
        this.heatmapContainer.appendChild(tile);
    }

    createEmptyTile(index) {
        const tile = document.createElement('div');
        tile.className = 'heatmap-tile empty';
        
        tile.style.cssText = `
            position: relative;
            background-color: #f1f5f9;
            border: 1px solid rgba(0,0,0,0.05);
            border-radius: 4px;
            display: flex;
            justify-content: center;
            align-items: center;
            box-sizing: border-box;
            min-height: 0;
        `;
        
        tile.innerHTML = `
            <div style="
                color: #94a3b8;
                font-size: 12px;
                opacity: 0.5;
            ">-</div>
        `;
        
        this.heatmapContainer.appendChild(tile);
    }

    getColorForChange(change) {
        const absChange = Math.abs(change);
        let colorIndex;
        
        // 더 세밀한 색상 구분
        if (absChange < 0.5) colorIndex = 0;
        else if (absChange < 1.5) colorIndex = 1;
        else if (absChange < 3) colorIndex = 2;
        else if (absChange < 6) colorIndex = 3;
        else if (absChange < 10) colorIndex = 4;
        else if (absChange < 20) colorIndex = 5;
        else colorIndex = 6;
        
        // 변동이 매우 작을 때는 중립 색상 사용
        if (absChange < 0.1) {
            return this.colors.neutral;
        }
        
        return change >= 0 ? this.colors.positive[colorIndex] : this.colors.negative[colorIndex];
    }

    getTextColor(backgroundColor) {
        // 더 정확한 텍스트 색상 계산
        if (backgroundColor === this.colors.neutral) {
            return '#374151'; // 중립 색상일 때는 회색 텍스트
        }
        
        const rgb = this.hexToRgb(backgroundColor);
        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
        
        // 밝기에 따라 텍스트 색상 결정
        if (brightness > 180) {
            return '#1f2937'; // 어두운 회색
        } else if (brightness > 120) {
            return '#374151'; // 중간 회색
        } else {
            return '#ffffff'; // 흰색
        }
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
        // 기존 툴팁이 있으면 제거
        this.hideTooltip();
        
        const tooltip = document.createElement('div');
        tooltip.className = 'heatmap-tooltip';
        
        // 가격 및 시가총액 포맷팅 함수
        const formatPrice = (price) => {
            if (price >= 1000) return `$${(price/1000).toFixed(1)}K`;
            if (price >= 1) return `$${price.toFixed(2)}`;
            if (price >= 0.01) return `$${price.toFixed(3)}`;
            return `$${price.toFixed(6)}`;
        };
        
        const formatMarketCap = (marketCap) => {
            if (marketCap >= 1e12) return `$${(marketCap/1e12).toFixed(2)}T`;
            if (marketCap >= 1e9) return `$${(marketCap/1e9).toFixed(2)}B`;
            if (marketCap >= 1e6) return `$${(marketCap/1e6).toFixed(2)}M`;
            return `$${(marketCap/1e3).toFixed(2)}K`;
        };
        
        const formatVolume = (volume) => {
            if (volume >= 1e9) return `$${(volume/1e9).toFixed(2)}B`;
            if (volume >= 1e6) return `$${(volume/1e6).toFixed(2)}M`;
            return `$${(volume/1e3).toFixed(2)}K`;
        };
        
        const changeColor = coin.change_24h >= 0 ? '#22c55e' : '#ef4444';
        
        tooltip.innerHTML = `
            <div class="tooltip-header">
                <div class="tooltip-symbol">${coin.symbol}</div>
                <div class="tooltip-name">${coin.name || coin.symbol}</div>
            </div>
            <div class="tooltip-body">
                <div class="tooltip-row">
                    <span class="tooltip-label">현재가:</span>
                    <span class="tooltip-value">${formatPrice(coin.price)}</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">24h 변동:</span>
                    <span class="tooltip-value" style="color: ${changeColor}; font-weight: 600;">
                        ${coin.change_24h > 0 ? '+' : ''}${coin.change_24h.toFixed(2)}%
                    </span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">시가총액:</span>
                    <span class="tooltip-value">${formatMarketCap(coin.market_cap)}</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">거래량:</span>
                    <span class="tooltip-value">${formatVolume(coin.volume)}</span>
                </div>
            </div>
        `;
        
        tooltip.style.cssText = `
            position: fixed;
            background: linear-gradient(135deg, rgba(17, 24, 39, 0.95), rgba(31, 41, 55, 0.95));
            backdrop-filter: blur(10px);
            color: white;
            padding: 12px;
            border-radius: 8px;
            font-size: 12px;
            pointer-events: none;
            z-index: 1000;
            min-width: 180px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        `;
        
        // 툴팁 내부 스타일
        const style = document.createElement('style');
        style.textContent = `
            .tooltip-header {
                margin-bottom: 8px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                padding-bottom: 6px;
            }
            .tooltip-symbol {
                font-weight: bold;
                font-size: 14px;
                color: #60a5fa;
            }
            .tooltip-name {
                font-size: 11px;
                color: #9ca3af;
                margin-top: 2px;
            }
            .tooltip-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 4px;
            }
            .tooltip-label {
                color: #d1d5db;
                font-size: 11px;
            }
            .tooltip-value {
                color: #ffffff;
                font-weight: 500;
                font-size: 11px;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(tooltip);
        this.currentTooltip = tooltip;
        this.currentTooltipStyle = style;
        
        // 마우스 위치에 따라 툴팁 위치 조정
        document.addEventListener('mousemove', this.updateTooltipPosition);
    }

    updateTooltipPosition = (e) => {
        if (this.currentTooltip) {
            const tooltip = this.currentTooltip;
            const rect = tooltip.getBoundingClientRect();
            
            let left = e.clientX + 15;
            let top = e.clientY - 15;
            
            // 화면 경계 확인 및 조정
            if (left + rect.width > window.innerWidth) {
                left = e.clientX - rect.width - 15;
            }
            if (top + rect.height > window.innerHeight) {
                top = e.clientY - rect.height - 15;
            }
            if (left < 0) left = 10;
            if (top < 0) top = 10;
            
            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
        }
    }

    hideTooltip() {
        if (this.currentTooltip) {
            document.body.removeChild(this.currentTooltip);
            this.currentTooltip = null;
            document.removeEventListener('mousemove', this.updateTooltipPosition);
        }
        if (this.currentTooltipStyle) {
            document.head.removeChild(this.currentTooltipStyle);
            this.currentTooltipStyle = null;
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