/**
 * Technical Indicators Module
 * 기술적 지표를 계산하고 표시하는 모듈
 */
class TechnicalIndicators {
    constructor(settings) {
        this.currentSymbol = 'BTCUSDT';
        this.indicators = {
            rsi: { value: 50, status: '중립' },
            macd: { value: 0, signal: 0, histogram: 0, status: '중립' },
            bb: { upper: 0, middle: 0, lower: 0, position: '중간', status: '중립' },
            stoch: { k: 50, d: 50, status: '중립' }
        };
        this.priceData = [];
        this.isTracking = false;
        this.interval = null;
        
        this.init();
    }

    init() {
        console.log('📊 Technical Indicators initializing...');
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 심볼 변경
        const symbolSelect = document.getElementById('indicator-symbol');
        if (symbolSelect) {
            symbolSelect.addEventListener('change', (e) => {
                this.currentSymbol = e.target.value;
                this.loadData();
            });
        }
    }

    async start() {
        console.log('📊 Starting technical indicators tracking...');
        await this.loadData();
        // 10초마다 데이터를 새로고침하여 실시간에 가깝게 업데이트합니다.
        this.interval = setInterval(() => this.loadData(), 1000);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            console.log('🛑 Stopped technical indicators tracking.');
        }
    }

    async loadData() {
        const symbol = this.currentSymbol;
        // Binance API는 klines(캔들) 데이터를 사용하여 기술 지표를 계산합니다.
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=100`;

        try {
            const response = await fetch(url);
            const klines = await response.json();
            const closingPrices = klines.map(k => parseFloat(k[4]));
            
            // 여기서 실제 기술 지표 계산 로직이 필요합니다. 
            // 현재는 임시로 랜덤 값을 사용합니다.
            const indicators = {
                rsi: Math.random() * 100,
                macd: Math.random() * 2 - 1,
                bollingerBands: ['상단', '중간', '하단'][Math.floor(Math.random() * 3)]
            };

            this.updateDisplay(indicators);

        } catch (error) {
            console.error(`[TechnicalIndicators] Error loading data for ${symbol}:`, error);
        }
    }

    calculateIndicators() {
        if (this.priceData.length < 50) {
            this.generateSampleData();
            return;
        }

        this.calculateRSI();
        this.calculateMACD();
        this.calculateBollingerBands();
        this.calculateStochastic();
    }

    calculateRSI(period = 14) {
        const prices = this.priceData.map(data => data.close);
        const gains = [];
        const losses = [];
        
        for (let i = 1; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            gains.push(change > 0 ? change : 0);
            losses.push(change < 0 ? Math.abs(change) : 0);
        }
        
        // 초기 평균 계산
        let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
        let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
        
        // 스무딩된 평균 계산
        for (let i = period; i < gains.length; i++) {
            avgGain = (avgGain * (period - 1) + gains[i]) / period;
            avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
        }
        
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        
        this.indicators.rsi.value = rsi;
        this.indicators.rsi.status = this.getRSIStatus(rsi);
    }

    getRSIStatus(rsi) {
        if (rsi > 70) return '과매수';
        if (rsi < 30) return '과매도';
        return '중립';
    }

    calculateMACD(fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        const prices = this.priceData.map(data => data.close);
        
        const fastEMA = this.calculateEMA(prices, fastPeriod);
        const slowEMA = this.calculateEMA(prices, slowPeriod);
        
        const macdLine = fastEMA[fastEMA.length - 1] - slowEMA[slowEMA.length - 1];
        
        // MACD 히스토리 계산 (간단화)
        const macdHistory = [];
        for (let i = slowPeriod - 1; i < prices.length; i++) {
            macdHistory.push(fastEMA[i] - slowEMA[i]);
        }
        
        const signalLine = this.calculateEMA(macdHistory, signalPeriod);
        const signal = signalLine[signalLine.length - 1];
        
        this.indicators.macd.value = macdLine;
        this.indicators.macd.signal = signal;
        this.indicators.macd.histogram = macdLine - signal;
        this.indicators.macd.status = this.getMACDStatus(macdLine, signal);
    }

    getMACDStatus(macd, signal) {
        if (macd > signal && macd > 0) return '강세';
        if (macd < signal && macd < 0) return '약세';
        return '중립';
    }

    calculateEMA(prices, period) {
        const ema = [];
        const multiplier = 2 / (period + 1);
        
        // 첫 번째 EMA는 단순 평균
        ema[period - 1] = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
        
        // 나머지 EMA 계산
        for (let i = period; i < prices.length; i++) {
            ema[i] = (prices[i] - ema[i - 1]) * multiplier + ema[i - 1];
        }
        
        return ema;
    }

    calculateBollingerBands(period = 20, multiplier = 2) {
        const prices = this.priceData.map(data => data.close);
        const currentIndex = prices.length - 1;
        
        if (currentIndex < period) return;
        
        const recentPrices = prices.slice(currentIndex - period + 1, currentIndex + 1);
        const sma = recentPrices.reduce((a, b) => a + b, 0) / period;
        
        // 표준편차 계산
        const squaredDiffs = recentPrices.map(price => Math.pow(price - sma, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
        const stdDev = Math.sqrt(variance);
        
        const upper = sma + (stdDev * multiplier);
        const lower = sma - (stdDev * multiplier);
        const currentPrice = prices[currentIndex];
        
        this.indicators.bb.upper = upper;
        this.indicators.bb.middle = sma;
        this.indicators.bb.lower = lower;
        this.indicators.bb.position = this.getBBPosition(currentPrice, upper, sma, lower);
        this.indicators.bb.status = this.getBBStatus(currentPrice, upper, lower);
    }

    getBBPosition(price, upper, middle, lower) {
        if (price > upper) return '상단';
        if (price < lower) return '하단';
        if (price > middle) return '중상';
        return '중하';
    }

    getBBStatus(price, upper, lower) {
        if (price > upper) return '과매수';
        if (price < lower) return '과매도';
        return '중립';
    }

    calculateStochastic(kPeriod = 14, dPeriod = 3) {
        if (this.priceData.length < kPeriod) return;
        
        const recentData = this.priceData.slice(-kPeriod);
        const currentClose = recentData[recentData.length - 1].close;
        const highestHigh = Math.max(...recentData.map(d => d.high));
        const lowestLow = Math.min(...recentData.map(d => d.low));
        
        const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
        
        // %D는 %K의 이동평균 (간단화)
        const d = k; // 실제로는 3일 이동평균 계산 필요
        
        this.indicators.stoch.k = k;
        this.indicators.stoch.d = d;
        this.indicators.stoch.status = this.getStochStatus(k);
    }

    getStochStatus(k) {
        if (k > 80) return '과매수';
        if (k < 20) return '과매도';
        return '중립';
    }

    generateSampleData() {
        this.indicators = {
            rsi: { value: 45 + Math.random() * 20, status: '중립' },
            macd: { value: (Math.random() - 0.5) * 100, signal: 0, histogram: 0, status: '중립' },
            bb: { upper: 0, middle: 0, lower: 0, position: '중간', status: '중립' },
            stoch: { k: 30 + Math.random() * 40, d: 35 + Math.random() * 30, status: '중립' }
        };
        
        // 상태 업데이트
        this.indicators.rsi.status = this.getRSIStatus(this.indicators.rsi.value);
        this.indicators.stoch.status = this.getStochStatus(this.indicators.stoch.k);
    }

    startRealTimeTracking() {
        this.trackingInterval = setInterval(async () => {
            if (this.isTracking) {
                await this.loadData();
            }
        }, 60000); // 1분마다 업데이트
    }

    updateDisplay(indicators) {
        if (!this.indicators) return;

        const rsiValueEl = document.getElementById('rsi-value');
        const macdValueEl = document.getElementById('macd-value');
        const bbValueEl = document.getElementById('bb-value');

        if (rsiValueEl) {
            rsiValueEl.textContent = indicators.rsi.toFixed(2);
            rsiValueEl.className = 'indicator-value';
            if (indicators.rsi > 70) rsiValueEl.classList.add('overbought');
            if (indicators.rsi < 30) rsiValueEl.classList.add('oversold');
        }

        if (macdValueEl) {
            macdValueEl.textContent = indicators.macd.value.toFixed(4);
        }

        if (bbValueEl) {
            bbValueEl.textContent = indicators.bollingerBands || '중립';
        }
    }

    async refresh() {
        console.log('📊 Refreshing technical indicators...');
        await this.loadData();
        
        if (window.analysisDashboard) {
            window.analysisDashboard.showToast('기술지표가 업데이트되었습니다', 'success');
        }
    }

    // 외부에서 접근 가능한 메서드들
    getIndicators() {
        return this.indicators;
    }

    getRSI() {
        return this.indicators.rsi;
    }

    getMACD() {
        return this.indicators.macd;
    }

    getBollingerBands() {
        return this.indicators.bb;
    }

    getStochastic() {
        return this.indicators.stoch;
    }
} 