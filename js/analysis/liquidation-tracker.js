/**
 * Liquidation Tracker Module
 * 실시간 청산 정보를 추적하고 표시하는 모듈
 */
class LiquidationTracker {
    constructor() {
        this.liquidationData = {
            long: { amount: 0, count: 0 },
            short: { amount: 0, count: 0 },
            history: []
        };
        this.isTracking = false;
        this.trackingInterval = null;
        this.currentTimeframe = '1h';
        this.chart = null;
        this.interval = null;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadInitialData();
        this.initializeChart();
    }

    setupEventListeners() {
        // 타임프레임 변경
        const timeframeSelect = document.getElementById('liquidation-timeframe');
        if (timeframeSelect) {
            timeframeSelect.addEventListener('change', (e) => {
                this.currentTimeframe = e.target.value;
                this.generateHistoryData();
                this.updateChart();
            });
        }

        // 새로고침 버튼
        const refreshBtn = document.getElementById('refresh-liquidation-data');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refresh());
        }

        // 시작/중지 버튼
        const toggleBtn = document.getElementById('toggle-liquidation-tracking');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                if (this.isTracking) {
                    this.stop();
                } else {
                    this.start();
                }
            });
        }
    }

    async start() {
        console.log('🚀 Starting liquidation tracker...');
        await this.loadData();
        // 30초마다 데이터를 새로고침합니다.
        this.interval = setInterval(() => this.loadData(), 30000);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            console.log('🛑 Stopped liquidation tracker.');
        }
    }

    async loadInitialData() {
        try {
            // CORS 문제를 피하기 위해 시뮬레이션된 데이터 사용
            this.generateSampleLiquidationData();
            this.updateDisplay();
        } catch (error) {
            console.error('Error loading liquidation data:', error);
            this.generateSampleLiquidationData();
        }
    }

    // CORS 문제를 피하기 위해 시뮬레이션된 데이터 생성
    generateSampleLiquidationData() {
        // 현재 시장 상황을 반영한 시뮬레이션 데이터
        const baseLongLiquidation = 8000000 + Math.random() * 4000000; // 8M-12M
        const baseShortLiquidation = 6000000 + Math.random() * 3000000; // 6M-9M
        
        // 시간대별 변동성 추가
        const hour = new Date().getHours();
        let longMultiplier = 1;
        let shortMultiplier = 1;
        
        // 아시아 시장 시간대 (0-8시) - 더 높은 변동성
        if (hour >= 0 && hour < 8) {
            longMultiplier = 1.2 + Math.random() * 0.3;
            shortMultiplier = 1.1 + Math.random() * 0.2;
        }
        // 유럽 시장 시간대 (8-16시) - 중간 변동성
        else if (hour >= 8 && hour < 16) {
            longMultiplier = 1.0 + Math.random() * 0.2;
            shortMultiplier = 1.0 + Math.random() * 0.2;
        }
        // 미국 시장 시간대 (16-24시) - 높은 변동성
        else {
            longMultiplier = 1.3 + Math.random() * 0.4;
            shortMultiplier = 1.2 + Math.random() * 0.3;
        }

        this.liquidationData = {
            long: { 
                amount: Math.round(baseLongLiquidation * longMultiplier), 
                count: Math.floor(100 + Math.random() * 100) 
            },
            short: { 
                amount: Math.round(baseShortLiquidation * shortMultiplier), 
                count: Math.floor(80 + Math.random() * 80) 
            },
            history: []
        };
        
        this.generateHistoryData();
    }

    generateHistoryData() {
        const historyData = [];
        const now = Date.now();
        const interval = this.getTimeframeInterval();
        
        // 최근 24개 데이터 포인트 생성
        for (let i = 24; i >= 0; i--) {
            const timestamp = now - (i * interval);
            
            // 기본값에 랜덤 변동성 추가
            const baseLong = this.liquidationData.long.amount / 25;
            const baseShort = this.liquidationData.short.amount / 25;
            
            const volatility = 0.3; // 30% 변동성
            const longVariation = 1 + (Math.random() - 0.5) * volatility;
            const shortVariation = 1 + (Math.random() - 0.5) * volatility;
            
            historyData.push({
                timestamp,
                longLiquidation: Math.round(baseLong * longVariation),
                shortLiquidation: Math.round(baseShort * shortVariation)
            });
        }
        
        this.liquidationData.history = historyData;
    }

    getTimeframeInterval() {
        switch (this.currentTimeframe) {
            case '1h': return 60 * 60 * 1000; // 1시간 간격
            case '4h': return 4 * 60 * 60 * 1000; // 4시간 간격
            case '24h': return 24 * 60 * 60 * 1000; // 24시간 간격
            default: return 60 * 60 * 1000;
        }
    }

    startRealTimeTracking() {
        this.trackingInterval = setInterval(async () => {
            if (this.isTracking) {
                await this.updateLiquidationData();
            }
        }, 30000); // 30초마다 업데이트
    }

    async updateLiquidationData() {
        try {
            // 시뮬레이션된 실시간 데이터 업데이트
            this.simulateRealTimeUpdate();
            this.updateDisplay();
        } catch (error) {
            console.error('Error updating liquidation data:', error);
        }
    }

    simulateRealTimeUpdate() {
        // 기존 데이터에 약간의 변동성 추가
        const volatility = 0.1; // 10% 변동성
        
        this.liquidationData.long.amount = Math.round(
            this.liquidationData.long.amount * (1 + (Math.random() - 0.5) * volatility)
        );
        this.liquidationData.short.amount = Math.round(
            this.liquidationData.short.amount * (1 + (Math.random() - 0.5) * volatility)
        );
        
        // 카운트도 약간 조정
        this.liquidationData.long.count = Math.max(0, 
            this.liquidationData.long.count + Math.floor((Math.random() - 0.5) * 10)
        );
        this.liquidationData.short.count = Math.max(0, 
            this.liquidationData.short.count + Math.floor((Math.random() - 0.5) * 10)
        );
        
        // 히스토리 데이터 업데이트
        this.updateHistoryData();
    }

    updateHistoryData() {
        const now = Date.now();
        const newDataPoint = {
            timestamp: now,
            longLiquidation: this.liquidationData.long.amount,
            shortLiquidation: this.liquidationData.short.amount
        };
        
        // 새로운 데이터 포인트 추가
        this.liquidationData.history.push(newDataPoint);
        
        // 최대 25개 데이터 포인트 유지
        if (this.liquidationData.history.length > 25) {
            this.liquidationData.history.shift();
        }
    }

    initializeChart() {
        const canvas = document.getElementById('liquidation-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    {
                        label: '롱 청산',
                        data: [],
                        backgroundColor: 'rgba(239, 68, 68, 0.6)',
                        borderColor: 'rgba(239, 68, 68, 1)',
                        borderWidth: 1
                    },
                    {
                        label: '숏 청산',
                        data: [],
                        backgroundColor: 'rgba(34, 197, 94, 0.6)',
                        borderColor: 'rgba(34, 197, 94, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + (value / 1000000).toFixed(1) + 'M';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': $' + 
                                    window.formatNumber(context.parsed.y);
                            }
                        }
                    }
                }
            }
        });
        ctx.canvas.chart = this.chart;
    }

    updateDisplay(data) {
        if (!data) return;

        const longEl = document.getElementById('long-liquidation');
        const shortEl = document.getElementById('short-liquidation');

        if (longEl) {
            longEl.textContent = `$${this.formatNumber(data.totalLong)}`;
        }
        if (shortEl) {
            shortEl.textContent = `$${this.formatNumber(data.totalShort)}`;
        }
        
        this.updateChart(data.history);
    }

    updateChart(data) {
        if (!this.chart) return;

        const labels = data.map(item => {
            const date = new Date(item.timestamp);
            return date.toLocaleTimeString('ko-KR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        });

        const longData = data.map(item => item.longLiquidation);
        const shortData = data.map(item => item.shortLiquidation);

        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = longData;
        this.chart.data.datasets[1].data = shortData;
        this.chart.update('none');
    }

    async updateData() {
        await this.loadInitialData();
    }

    async refresh() {
        console.log('🔄 Refreshing liquidation data...');
        
        // 데이터 초기화
        this.liquidationData = {
            long: { amount: 0, count: 0 },
            short: { amount: 0, count: 0 },
            history: []
        };
        
        // 새로운 데이터 생성
        await this.loadInitialData();
        
        // 차트 새로고침
        if (this.chart) {
            this.chart.destroy();
            this.initializeChart();
        }
    }

    getLiquidationData() {
        return this.liquidationData;
    }

    getTotalLiquidations() {
        return {
            total: this.liquidationData.long.amount + this.liquidationData.short.amount,
            long: this.liquidationData.long.amount,
            short: this.liquidationData.short.amount
        };
    }

    formatNumber(value) {
        return value.toLocaleString('ko-KR');
    }

    async loadData() {
        const symbol = this.settings.symbol;
        const url = `https://fapi.binance.com/fapi/v1/allForceOrders?symbol=${symbol}&limit=100`;

        try {
            const response = await axios.get(url);
            const trades = response.data; // API 응답은 객체의 'data' 프로퍼티 안에 있습니다.

            const totalLong = trades.filter(t => t.side === 'BUY').reduce((sum, t) => sum + (parseFloat(t.price) * parseFloat(t.qty)), 0);
            const totalShort = trades.filter(t => t.side === 'SELL').reduce((sum, t) => sum + (parseFloat(t.price) * parseFloat(t.qty)), 0);
            
            // 최근 1시간 데이터만 필터링하여 차트 생성 (예시)
            const oneHourAgo = Date.now() - 3600 * 1000;
            const history = trades.filter(t => t.time > oneHourAgo);

            this.updateDisplay({ totalLong, totalShort, history });

        } catch (error) {
            console.error(`[LiquidationTracker] Error loading data for ${symbol}:`, error);
            // 에러 발생 시 디스플레이를 초기화하거나 에러 메시지를 표시할 수 있습니다.
        }
    }
}

// Export the LiquidationTracker class
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LiquidationTracker;
} else {
    window.LiquidationTracker = LiquidationTracker;
} 