/**
 * Long/Short Tracker Module
 * 롱숏 포지션 비율을 추적하고 표시하는 모듈
 */
export class LongShortTracker {
    constructor(options = {}) {
        this.currentSymbol = options.symbol || 'BTCUSDT';
        this.currentTimeframe = options.timeframe || '1h';
        this.ratioData = {
            overall: { long: 50, short: 50 },
            exchanges: {
                binance: { long: 60, short: 40 },
                okx: { long: 55, short: 45 }
            },
            history: []
        };
        this.isTracking = false;
        this.interval = null;
        
        this.init();
    }

    init() {
        console.log('⚖️ Long/Short Tracker initializing...');
        
        // 약간의 지연을 두고 이벤트 리스너 설정 (DOM 안정화)
        setTimeout(() => {
            this.setupEventListeners();
        }, 100);
    }

    setupEventListeners() {
        // DOM이 완전히 로드된 후 이벤트 리스너 설정
        const setupListeners = () => {
            // 심볼 변경
            const symbolSelect = document.getElementById('longshort-symbol');
            if (symbolSelect) {
                console.log('🎯 Setting up longshort symbol listener');
                
                // 현재 선택된 값으로 초기화
                if (symbolSelect.value && symbolSelect.value !== this.currentSymbol) {
                    this.currentSymbol = symbolSelect.value;
                    console.log(`📌 Initial symbol set to: ${this.currentSymbol}`);
                }
                
                symbolSelect.addEventListener('change', (e) => {
                    console.log(`🔄 Long/Short symbol changed to: ${e.target.value}`);
                    this.currentSymbol = e.target.value;
                    this.loadData();
                });
            } else {
                console.warn('⚠️ longshort-symbol element not found');
            }
            
            // 시간봉 변경 (드롭다운)
            const timeframeSelect = document.getElementById('longshort-timeframe');
            if (timeframeSelect) {
                console.log('🎯 Setting up longshort timeframe listener');
                
                // 현재 선택된 값으로 초기화
                if (timeframeSelect.value && timeframeSelect.value !== this.currentTimeframe) {
                    this.currentTimeframe = timeframeSelect.value;
                    console.log(`📌 Initial timeframe set to: ${this.currentTimeframe}`);
                }
                
                timeframeSelect.addEventListener('change', (e) => {
                    console.log(`🔄 Long/Short timeframe changed to: ${e.target.value}`);
                    this.currentTimeframe = e.target.value;
                    this.loadData();
                });
            } else {
                console.warn('⚠️ longshort-timeframe element not found');
            }
        };

        // DOM이 로드되어 있으면 즉시 설정, 아니면 대기
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupListeners);
        } else {
            setupListeners();
        }
    }

    async start() {
        console.log('⚖️ Starting long/short tracking...');
        this.isTracking = true;
        
        // 이벤트 리스너가 설정될 때까지 대기
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // 현재 설정으로 데이터 로드
        await this.loadData();
        
        // 10초마다 데이터를 새로고침합니다.
        this.interval = setInterval(() => {
            if (this.isTracking) {
                this.loadData();
            }
        }, 10000);
    }

    stop() {
        this.isTracking = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            console.log('🛑 Stopped long/short tracker.');
        }
    }

    async loadData() {
        const symbol = this.currentSymbol;
        const period = this.currentTimeframe;
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
        const interval = this.getTimeframeInterval();
        
        for (let i = 30; i >= 0; i--) {
            const timestamp = now - (i * interval);
            const longRatio = 45 + Math.sin(i * 0.1) * 5 + Math.random() * 5;
            
            historyData.push({
                timestamp,
                long: longRatio,
                short: 100 - longRatio
            });
        }
        
        this.ratioData.history = historyData;
    }

    getTimeframeInterval() {
        switch (this.currentTimeframe) {
            case '5m': return 5 * 60 * 1000; // 5분 간격
            case '15m': return 15 * 60 * 1000; // 15분 간격
            case '1h': return 60 * 60 * 1000; // 1시간 간격
            case '4h': return 4 * 60 * 60 * 1000; // 4시간 간격
            case '1d': return 24 * 60 * 60 * 1000; // 1일 간격
            default: return 60 * 60 * 1000; // 기본값 1시간
        }
    }

    startRealTimeTracking() {
        this.trackingInterval = setInterval(async () => {
            if (this.isTracking) {
                await this.loadData();
            }
        }, 60000); // 1분마다 업데이트
    }

    updateDisplay(data) {
        if (!data) return;

        // 롱/숏 퍼센트 계산
        const longPercent = data.longAccount;
        const shortPercent = 100 - longPercent;

        // 내부 데이터 업데이트 (중요!)
        this.ratioData.overall.long = longPercent;
        this.ratioData.overall.short = shortPercent;

        // 비율 값 업데이트
        const ratioEl = document.getElementById('longshort-ratio');
        if (ratioEl) {
            ratioEl.textContent = data.longShortRatio.toFixed(2);
        }

        // 퍼센트 값 업데이트
        const longPercentEl = document.getElementById('long-percentage');
        const shortPercentEl = document.getElementById('short-percentage');
        
        if (longPercentEl) {
            longPercentEl.textContent = `${longPercent.toFixed(1)}%`;
        }
        if (shortPercentEl) {
            shortPercentEl.textContent = `${shortPercent.toFixed(1)}%`;
        }

        // 상태 업데이트
        const statusEl = document.getElementById('ratio-status');
        if (statusEl) {
            statusEl.className = 'ls-status'; // Reset classes
            if (longPercent > 55) {
                statusEl.textContent = '롱 우세';
                statusEl.classList.add('long-dominant');
            } else if (shortPercent > 55) {
                statusEl.textContent = '숏 우세';
                statusEl.classList.add('short-dominant');
            } else {
                statusEl.textContent = '균형';
                statusEl.classList.add('neutral');
            }
        }

        // 시각적 게이지 업데이트
        const longFillEl = document.getElementById('long-fill');
        
        if (longFillEl) {
            longFillEl.style.width = `${longPercent}%`;
        }

        console.log(`📊 Long/Short updated: ${longPercent.toFixed(1)}% / ${shortPercent.toFixed(1)}%`);
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
        let ratio = 1.2 + (Math.random() - 0.5) * 0.4; // 0.8 ~ 1.6 범위
        
        for (let i = 0; i < 30; i++) {
            ratio += (Math.random() - 0.5) * 0.1;
            ratio = Math.max(0.5, Math.min(2.0, ratio)); // 0.5 ~ 2.0 범위로 제한
            history.push({
                timestamp: Date.now() - (30 - i) * 60 * 1000,
                longShortRatio: ratio,
            });
        }
        
        const longAccount = (ratio / (1 + ratio)) * 100;
        
        return {
            longShortRatio: ratio,
            longAccount: longAccount,
            history: history
        };
    }

    getLongShortRatio() {
        const long = this.ratioData.overall.long;
        const short = this.ratioData.overall.short;
        
        // 상태 결정
        let status = 'neutral';
        if (long > 55) {
            status = 'long-dominant';
        } else if (short > 55) {
            status = 'short-dominant';
        }
        
        const ratio = short > 0 ? long / short : 1.0;
        
        return {
            long: long,
            short: short,
            ratio: ratio,
            status: status
        };
    }
} 