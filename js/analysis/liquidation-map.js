/**
 * Liquidation Map Module
 * TradingView 스타일 청산 지도 (실제 API 데이터)
 */
export class LiquidationMap {
    constructor(options = {}) {
        this.symbol = options.symbol || 'BTCUSDT';
        this.liquidationData = null;
        this.currentPrice = 0;
        this.isLoading = false;
        this.chart = null;
        this.maxLiquidationValue = 0;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupThemeObserver();
        this.render();
    }

    start() {
        this.loadData();
        // 1분마다 데이터 업데이트
        this.interval = setInterval(() => {
            if (!this.isLoading) {
                this.loadData();
            }
        }, 60000);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }

        if (this.themeObserver) {
            this.themeObserver.disconnect();
            this.themeObserver = null;
        }
    }

    setupEventListeners() {
        const symbolSelect = document.getElementById('liquidation-symbol');
        if (symbolSelect) {
            symbolSelect.addEventListener('change', (e) => {
                this.symbol = e.target.value;
                this.loadData();
            });
        }
    }

    setupThemeObserver() {
        // 테마 변경 감지를 위한 MutationObserver
        const observer = new MutationObserver(() => {
            if (this.liquidationData) {
                // 테마가 변경되면 차트 다시 렌더링
                setTimeout(() => {
                    this.renderChart();
                }, 100);
            }
        });

        // body와 html의 클래스 변경 감지
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
        });

        // localStorage 변경 감지
        window.addEventListener('storage', (e) => {
            if (e.key === 'theme' && this.liquidationData) {
                setTimeout(() => {
                    this.renderChart();
                }, 100);
            }
        });

        this.themeObserver = observer;
    }

    async loadData() {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            // 현재가 가져오기
            const priceResponse = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${this.symbol}`);
            const priceData = await priceResponse.json();
            this.currentPrice = parseFloat(priceData.price);

            // 청산 데이터 가져오기 (실제 API 사용)
            await this.fetchLiquidationData();
            
            this.renderChart();
        } catch (error) {
            console.error('Error loading liquidation data:', error);
            this.generateFallbackData();
            this.renderChart();
        } finally {
            this.isLoading = false;
        }
    }

    async fetchLiquidationData() {
        try {
            // 실제 청산 데이터 API 호출
            const response = await fetch('https://martyn-ukrainian.pp.ua/liq-data');
            const data = await response.json();
            
            if (data && data.data) {
                this.liquidationData = this.processLiquidationData(data.data);
                console.log('✅ Real liquidation data loaded');
            } else {
                throw new Error('Invalid data format');
            }
        } catch (error) {
            console.warn('⚠️ Failed to load real data, using fallback');
            this.generateFallbackData();
        }
    }

    processLiquidationData(data) {
        const { liq, prices, y } = data;
        
        // 청산 데이터를 가격별로 그룹화
        const liqObj = liq.reduce((res, [xInd, yInd, value]) => {
            const price = prices[xInd][0];
            const level = y[yInd];

            if (!res[price]) {
                res[price] = [];
            }
            res[price].push([level, value]);
            return res;
        }, {});

        // 최대값 계산 및 정렬
        const processedData = Object.entries(liqObj).map(([price, items]) => {
            const totalValue = items.reduce((sum, [level, value]) => sum + value, 0);
            const maxItem = items.reduce((max, current) => 
                current[1] > max[1] ? current : max, items[0]);

            return {
                price: parseFloat(price),
                totalValue,
                maxValue: maxItem[1],
                maxLevel: maxItem[0],
                items
            };
        }).sort((a, b) => a.price - b.price);

        this.maxLiquidationValue = Math.max(...processedData.map(d => d.maxValue));
        
        return {
            processed: processedData,
            yLevels: y,
            originalData: data
        };
    }

    generateFallbackData() {
        // 폴백 데이터 생성
        const basePrice = this.currentPrice;
        const priceRange = basePrice * 0.1; // ±10%
        const processed = [];

        for (let i = 0; i < 50; i++) {
            const price = basePrice - priceRange + (priceRange * 2 * i / 50);
            const totalValue = Math.random() * 100000000; // 0-100M
            const maxValue = totalValue * (0.5 + Math.random() * 0.5);
            
            processed.push({
                price,
                totalValue,
                maxValue,
                maxLevel: price,
                items: [[price, maxValue]]
            });
        }

        this.maxLiquidationValue = Math.max(...processed.map(d => d.maxValue));
        
        this.liquidationData = {
            processed,
            yLevels: processed.map(d => d.price),
            originalData: null
        };
    }

    renderChart() {
        const container = document.getElementById('liquidation-container');
        if (!container) return;

        container.innerHTML = `
            <div class="liquidation-heatmap-container">
                <div class="heatmap-header">
                    <div class="price-info">
                        <span class="current-price">$${this.currentPrice.toLocaleString()}</span>
                        <span class="price-label">현재가</span>
                    </div>
                    <div class="intensity-legend">
                        <span class="legend-label">청산 강도</span>
                        <div class="intensity-scale">
                            <div class="scale-item low"></div>
                            <div class="scale-item medium"></div>
                            <div class="scale-item high"></div>
                            <div class="scale-item extreme"></div>
                        </div>
                    </div>
                </div>
                <div class="heatmap-canvas-container">
                    <canvas id="liquidation-heatmap-canvas"></canvas>
                    <div class="price-markers"></div>
                </div>
                <div class="heatmap-footer">
                    <div class="stats">
                        <div class="stat-item">
                            <span class="stat-value">${this.formatValue(this.maxLiquidationValue)}</span>
                            <span class="stat-label">최대 청산량</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${this.liquidationData?.processed.length || 0}</span>
                            <span class="stat-label">가격 레벨</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.createHeatmapChart();
        this.addPriceMarkers();
        this.addChartStyles();
    }

    createHeatmapChart() {
        const canvas = document.getElementById('liquidation-heatmap-canvas');
        if (!canvas || !this.liquidationData) return;

        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;
        
        // 고해상도 설정
        const dpr = window.devicePixelRatio || 1;
        const rect = container.getBoundingClientRect();
        
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        
        ctx.scale(dpr, dpr);
        
        this.drawHeatmap(ctx, rect.width, rect.height);
    }

    drawHeatmap(ctx, width, height) {
        const { processed } = this.liquidationData;
        if (!processed || processed.length === 0) return;

        const padding = { top: 20, right: 40, bottom: 20, left: 60 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // 테마 감지
        const isDarkMode = document.body.classList.contains('dark-mode') || 
                          document.documentElement.classList.contains('dark-mode') ||
                          localStorage.getItem('theme') === 'dark';

        // 배경 그라디언트
        const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
        if (isDarkMode) {
            bgGradient.addColorStop(0, 'rgba(15, 23, 42, 0.95)');
            bgGradient.addColorStop(1, 'rgba(30, 41, 59, 0.95)');
        } else {
            bgGradient.addColorStop(0, 'rgba(248, 250, 252, 0.95)');
            bgGradient.addColorStop(1, 'rgba(226, 232, 240, 0.95)');
        }
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);

        // 가격 범위 계산
        const minPrice = Math.min(...processed.map(d => d.price));
        const maxPrice = Math.max(...processed.map(d => d.price));
        const priceRange = maxPrice - minPrice;

        // 현재가 위치
        const currentPriceY = padding.top + chartHeight - 
            ((this.currentPrice - minPrice) / priceRange) * chartHeight;

        // 히트맵 그리기
        this.drawHeatmapBars(ctx, padding, chartWidth, chartHeight, processed, minPrice, maxPrice);

        // 현재가 라인
        this.drawCurrentPriceLine(ctx, padding, chartWidth, currentPriceY, isDarkMode);

        // 가격 라벨
        this.drawPriceLabels(ctx, padding, chartHeight, minPrice, maxPrice, isDarkMode);
    }

    drawHeatmapBars(ctx, padding, chartWidth, chartHeight, processed, minPrice, maxPrice) {
        const barWidth = chartWidth / processed.length;
        const priceRange = maxPrice - minPrice;

        processed.forEach((data, index) => {
            const x = padding.left + (index * barWidth);
            const intensity = data.maxValue / this.maxLiquidationValue;
            
            // 히트맵 색상 계산
            const color = this.getHeatmapColor(intensity);
            
            // 막대 높이 (청산량에 비례)
            const barHeight = Math.max(2, intensity * chartHeight * 0.8);
            const y = padding.top + chartHeight - barHeight;

            // 막대 그리기
            ctx.fillStyle = color;
            ctx.fillRect(x, y, barWidth * 0.9, barHeight);

            // 글로우 효과 (고강도일 때)
            if (intensity > 0.7) {
                ctx.shadowColor = color;
                ctx.shadowBlur = 10;
                ctx.fillRect(x, y, barWidth * 0.9, barHeight);
                ctx.shadowBlur = 0;
            }
        });
    }

    getHeatmapColor(intensity) {
        // TradingView 스타일 히트맵 색상
        if (intensity > 0.8) {
            return `rgba(255, 59, 48, ${0.7 + intensity * 0.3})`; // 극강 빨강
        } else if (intensity > 0.6) {
            return `rgba(255, 149, 0, ${0.6 + intensity * 0.4})`; // 주황
        } else if (intensity > 0.4) {
            return `rgba(255, 204, 0, ${0.5 + intensity * 0.5})`; // 노랑
        } else if (intensity > 0.2) {
            return `rgba(52, 199, 89, ${0.4 + intensity * 0.6})`; // 초록
        } else {
            return `rgba(59, 130, 246, ${0.3 + intensity * 0.7})`; // 파랑
        }
    }

    drawCurrentPriceLine(ctx, padding, chartWidth, currentPriceY, isDarkMode) {
        // 현재가 라인
        ctx.strokeStyle = isDarkMode ? '#FFD60A' : '#d97706';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        
        ctx.beginPath();
        ctx.moveTo(padding.left, currentPriceY);
        ctx.lineTo(padding.left + chartWidth, currentPriceY);
        ctx.stroke();
        
        ctx.setLineDash([]);

        // 현재가 마커
        ctx.fillStyle = isDarkMode ? '#FFD60A' : '#d97706';
        ctx.beginPath();
        ctx.arc(padding.left + chartWidth + 10, currentPriceY, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    drawPriceLabels(ctx, padding, chartHeight, minPrice, maxPrice, isDarkMode) {
        ctx.fillStyle = isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)';
        ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'right';

        const steps = 8;
        const priceStep = (maxPrice - minPrice) / steps;

        for (let i = 0; i <= steps; i++) {
            const price = minPrice + (priceStep * i);
            const y = padding.top + chartHeight - (i / steps) * chartHeight;
            
            ctx.fillText(
                `$${price.toLocaleString()}`,
                padding.left - 10,
                y + 3
            );
        }
    }

    addPriceMarkers() {
        const markersContainer = document.querySelector('.price-markers');
        if (!markersContainer || !this.liquidationData) return;

        const { processed } = this.liquidationData;
        const topLiquidations = processed
            .sort((a, b) => b.maxValue - a.maxValue)
            .slice(0, 3);

        markersContainer.innerHTML = topLiquidations.map((data, index) => `
            <div class="price-marker marker-${index + 1}">
                <div class="marker-price">$${data.price.toLocaleString()}</div>
                <div class="marker-value">${this.formatValue(data.maxValue)}</div>
            </div>
        `).join('');
    }

    formatValue(value) {
        if (value >= 1000000000) {
            return `${(value / 1000000000).toFixed(1)}B`;
        } else if (value >= 1000000) {
            return `${(value / 1000000).toFixed(1)}M`;
        } else if (value >= 1000) {
            return `${(value / 1000).toFixed(1)}K`;
        }
        return value.toFixed(0);
    }

    showError() {
        const container = document.getElementById('liquidation-container');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">⚠️</div>
                    <div class="error-message">청산 데이터를 불러올 수 없습니다</div>
                    <button class="retry-btn" onclick="window.liquidationMap?.loadData()">
                        다시 시도
                    </button>
                </div>
            `;
        }
    }

    render() {
        const container = document.getElementById('liquidation-container');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">청산 데이터 분석 중...</div>
                </div>
            `;
        }
    }

    addChartStyles() {
        const existingStyle = document.getElementById('liquidation-chart-styles');
        if (existingStyle) {
            existingStyle.remove();
        }

        const style = document.createElement('style');
        style.id = 'liquidation-chart-styles';
        
        // 테마 감지
        const isDarkMode = document.body.classList.contains('dark-mode') || 
                          document.documentElement.classList.contains('dark-mode') ||
                          localStorage.getItem('theme') === 'dark';
        
        style.textContent = `
            .liquidation-heatmap-container {
                position: relative;
                width: 100%;
                height: 100%;
                background: ${isDarkMode 
                    ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' 
                    : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'};
                border-radius: 12px;
                overflow: hidden;
                border: 1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
            }

            .heatmap-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 20px;
                background: ${isDarkMode ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.7)'};
                border-bottom: 1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
            }

            .price-info {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .current-price {
                font-size: 18px;
                font-weight: bold;
                color: ${isDarkMode ? '#FFD60A' : '#d97706'};
                text-shadow: ${isDarkMode 
                    ? '0 0 10px rgba(255, 214, 10, 0.3)' 
                    : '0 2px 4px rgba(217, 119, 6, 0.2)'};
            }

            .price-label {
                font-size: 11px;
                color: ${isDarkMode ? '#94a3b8' : '#64748b'};
                font-weight: 500;
            }

            .intensity-legend {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 6px;
            }

            .legend-label {
                font-size: 11px;
                color: ${isDarkMode ? '#94a3b8' : '#64748b'};
                font-weight: 500;
            }

            .intensity-scale {
                display: flex;
                gap: 3px;
                align-items: center;
            }

            .scale-item {
                width: 12px;
                height: 12px;
                border-radius: 2px;
            }

            .scale-item.low {
                background: rgba(59, 130, 246, 0.7);
            }

            .scale-item.medium {
                background: rgba(52, 199, 89, 0.7);
            }

            .scale-item.high {
                background: rgba(255, 204, 0, 0.7);
            }

            .scale-item.extreme {
                background: rgba(255, 59, 48, 0.8);
            }

            .heatmap-canvas-container {
                position: relative;
                height: calc(100% - 120px);
                margin: 0 10px;
            }

            #liquidation-heatmap-canvas {
                width: 100%;
                height: 100%;
                display: block;
            }

            .price-markers {
                position: absolute;
                top: 10px;
                right: 10px;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .price-marker {
                background: ${isDarkMode 
                    ? 'rgba(0, 0, 0, 0.8)' 
                    : 'rgba(255, 255, 255, 0.9)'};
                border-radius: 6px;
                padding: 6px 10px;
                border-left: 3px solid;
                min-width: 80px;
                box-shadow: ${isDarkMode 
                    ? '0 4px 12px rgba(0, 0, 0, 0.3)' 
                    : '0 4px 12px rgba(0, 0, 0, 0.1)'};
            }

            .price-marker.marker-1 {
                border-left-color: #ff3b30;
            }

            .price-marker.marker-2 {
                border-left-color: #ff9500;
            }

            .price-marker.marker-3 {
                border-left-color: #ffcc00;
            }

            .marker-price {
                font-size: 11px;
                font-weight: bold;
                color: ${isDarkMode ? 'white' : '#1e293b'};
                line-height: 1.2;
            }

            .marker-value {
                font-size: 10px;
                color: ${isDarkMode ? '#94a3b8' : '#64748b'};
                line-height: 1.2;
            }

            .heatmap-footer {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 50px;
                background: ${isDarkMode ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.7)'};
                border-top: 1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .stats {
                display: flex;
                gap: 32px;
            }

            .stat-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2px;
            }

            .stat-value {
                font-size: 14px;
                font-weight: bold;
                color: ${isDarkMode ? '#e2e8f0' : '#1e293b'};
            }

            .stat-label {
                font-size: 10px;
                color: ${isDarkMode ? '#94a3b8' : '#64748b'};
            }

            .loading-state, .error-state {
                height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 16px;
                color: ${isDarkMode ? '#94a3b8' : '#64748b'};
                background: ${isDarkMode 
                    ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' 
                    : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'};
                border-radius: 12px;
            }

            .loading-spinner {
                width: 32px;
                height: 32px;
                border: 3px solid rgba(148, 163, 184, 0.3);
                border-top: 3px solid #FFD60A;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            .error-icon {
                font-size: 32px;
            }

            .retry-btn {
                padding: 10px 20px;
                background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 500;
                transition: all 0.2s ease;
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            }

            .retry-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            /* 반응형 디자인 */
            @media (max-width: 768px) {
                .heatmap-header {
                    padding: 12px 16px;
                }

                .current-price {
                    font-size: 16px;
                }

                .price-markers {
                    right: 5px;
                    top: 5px;
                }

                .price-marker {
                    padding: 4px 8px;
                    min-width: 70px;
                }

                .stats {
                    gap: 20px;
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    getLiquidations() {
        return this.liquidationData?.processed || [];
    }
}

// 전역 등록
if (typeof window !== 'undefined') {
    window.LiquidationMap = LiquidationMap;
}