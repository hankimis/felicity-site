/**
 * Long/Short Tracker Module
 * 롱숏 포지션 비율을 추적하고 표시하는 모듈
 */
class LongShortTracker {
    constructor() {
        this.currentSymbol = 'BTCUSDT';
        this.ratioData = {
            overall: { long: 50, short: 50 },
            exchanges: {
                binance: { long: 60, short: 40 },
                okx: { long: 55, short: 45 }
            },
            history: []
        };
        this.chart = null;
        this.isTracking = false;
        this.interval = null;
        
        this.init();
    }

    init() {
        console.log('⚖️ Long/Short Tracker initializing...');
        this.setupEventListeners();
        this.initializeChart();
    }

    setupEventListeners() {
        // 심볼 변경
        const symbolSelect = document.getElementById('ls-coin');
        if (symbolSelect) {
            symbolSelect.addEventListener('change', (e) => {
                this.currentSymbol = e.target.value;
                this.loadData();
            });
        }
    }

    async start() {
        console.log('⚖️ Starting long/short tracking...');
        await this.loadData();
        // 10초마다 데이터를 새로고침합니다.
        this.interval = setInterval(() => this.loadData(), 10000);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            console.log('🛑 Stopped long/short tracker.');
        }
    }

    async loadData() {
        const symbol = this.currentSymbol;
        const period = '5m';
        const url = `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=30`;

        try {
            const response = await axios.get(url);
            const history = response.data; // API 응답은 데이터 배열 자체입니다.
            const latestData = history[history.length - 1];

            if (!latestData) {
                console.warn(`[LongShortTracker] No data received for ${symbol}`);
                return;
            }

            const processedData = {
                longShortRatio: parseFloat(latestData.longShortRatio),
                longAccount: parseFloat(latestData.longAccount) * 100, // API는 비율을 주므로 100을 곱해 백분율로 만듭니다.
                history: history 
            };
            
            this.updateDisplay(processedData);

        } catch (error) {
            console.error(`[LongShortTracker] Error loading data for ${symbol}:`, error);
            const sampleData = this.generateSampleData();
            this.updateDisplay(sampleData);
        }
    }

    processLongShortData(data) {
        if (!Array.isArray(data) || data.length === 0) {
            this.simulateLongShortData();
            return;
        }

        // 최신 데이터 처리
        const latest = data[data.length - 1];
        const longRatio = parseFloat(latest.longShortRatio);
        
        // 비율 계산 (longShortRatio = long / short)
        const longPercent = (longRatio / (1 + longRatio)) * 100;
        const shortPercent = 100 - longPercent;
        
        this.ratioData.overall.long = longPercent;
        this.ratioData.overall.short = shortPercent;
        
        // 히스토리 데이터 처리
        this.ratioData.history = data.map(item => ({
            timestamp: parseInt(item.timestamp),
            long: (parseFloat(item.longShortRatio) / (1 + parseFloat(item.longShortRatio))) * 100,
            short: 100 - (parseFloat(item.longShortRatio) / (1 + parseFloat(item.longShortRatio))) * 100
        }));
        
        // 거래소별 데이터는 시뮬레이션 (실제로는 각 거래소 API 필요)
        this.generateExchangeData();
    }

    simulateLongShortData() {
        // 시뮬레이션 데이터 생성
        const baseRatio = 45 + Math.random() * 10; // 45-55% 범위
        this.ratioData.overall.long = baseRatio;
        this.ratioData.overall.short = 100 - baseRatio;
        
        this.generateExchangeData();
        this.generateHistoryData();
    }

    generateExchangeData() {
        // 전체 비율을 기준으로 거래소별 데이터 생성
        const baseLong = this.ratioData.overall.long;
        
        this.ratioData.exchanges.binance.long = Math.max(0, Math.min(100, baseLong + (Math.random() - 0.5) * 10));
        this.ratioData.exchanges.binance.short = 100 - this.ratioData.exchanges.binance.long;
        
        this.ratioData.exchanges.okx.long = Math.max(0, Math.min(100, baseLong + (Math.random() - 0.5) * 8));
        this.ratioData.exchanges.okx.short = 100 - this.ratioData.exchanges.okx.long;
    }

    generateHistoryData() {
        const historyData = [];
        const now = Date.now();
        
        for (let i = 30; i >= 0; i--) {
            const timestamp = now - (i * 5 * 60 * 1000); // 5분 간격
            const longRatio = 45 + Math.sin(i * 0.1) * 5 + Math.random() * 5;
            
            historyData.push({
                timestamp,
                long: longRatio,
                short: 100 - longRatio
            });
        }
        
        this.ratioData.history = historyData;
    }

    startRealTimeTracking() {
        this.trackingInterval = setInterval(async () => {
            if (this.isTracking) {
                await this.loadData();
            }
        }, 60000); // 1분마다 업데이트
    }

    initializeChart() {
        const ctx = document.getElementById('longshort-chart')?.getContext('2d');
        if (!ctx) {
            console.error("Long/Short chart canvas not found");
            return;
        }

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: '롱 비율',
                        data: [],
                        borderColor: 'rgba(40, 167, 69, 0.8)',
                        backgroundColor: 'rgba(40, 167, 69, 0.2)',
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: '숏 비율',
                        data: [],
                        borderColor: 'rgba(220, 53, 69, 0.8)',
                        backgroundColor: 'rgba(220, 53, 69, 0.2)',
                        fill: true,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                    },
                }
            }
        });
        ctx.canvas.chart = this.chart;
    }

    updateDisplay(data) {
        if (!data) return;

        const ratioEl = document.getElementById('longshort-ratio');
        const fillEl = document.getElementById('ratio-fill');

        if (ratioEl) {
            ratioEl.textContent = data.longShortRatio.toFixed(2);
        }
        if (fillEl) {
            fillEl.style.width = `${data.longAccount}%`;
        }
        
        // 차트 업데이트 로직은 여기에...
        this.updateChart(data.history);
    }

    updateChart(history) {
        if (!this.chart || !history || history.length === 0) return;

        const labels = history.map(item => new Date(item.timestamp).toLocaleTimeString());
        
        // 롱/숏 비율로부터 각 파트의 백분율을 계산
        const longData = history.map(item => {
            const ratio = item.longShortRatio || 1;
            return (1 / (1 + 1 / ratio)) * 100;
        });
        const shortData = longData.map(longPercentage => 100 - longPercentage);

        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = longData;
        this.chart.data.datasets[1].data = shortData;
        this.chart.update();
    }

    async refresh() {
        console.log('⚖️ Refreshing long/short data...');
        await this.loadData();
        
        if (window.analysisDashboard) {
            window.analysisDashboard.showToast('롱숏 비율 데이터가 업데이트되었습니다', 'success');
        }
    }

    // 외부에서 접근 가능한 메서드들
    getRatioData() {
        return this.ratioData;
    }

    getCurrentRatio() {
        return {
            long: this.ratioData.overall.long,
            short: this.ratioData.overall.short,
            symbol: this.currentSymbol
        };
    }

    getExchangeRatios() {
        return this.ratioData.exchanges;
    }

    generateSampleData() {
        console.log("Generating sample long/short data due to an API error.");
        const history = [];
        let ratio = 1.2;
        for (let i = 0; i < 30; i++) {
            ratio += (Math.random() - 0.5) * 0.2;
            history.push({
                timestamp: Date.now() - (30 - i) * 60 * 1000,
                longShortRatio: ratio,
            });
        }
        return {
            longShortRatio: ratio,
            longAccount: (1 / (1 + 1/ratio)) * 100,
            history: history
        };
    }
} 