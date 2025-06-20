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
            stoch: { k: 50, d: 50, status: '중립' },
            sma: { short: 0, long: 0, status: '중립' },
            ichimoku: { tenkan: 0, kijun: 0, spanA: 0, spanB: 0, chikou: 0, status: '중립' },
            atr: { value: 0 },
            vo: { value: 0, status: '중립'},
            ao: { value: 0, status: '중립'},
            williamsR: { value: -50, status: '중립'}
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
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=100`;

        try {
            const response = await fetch(url);
            const klines = await response.json();
            
            if (!klines || klines.length === 0) {
                console.warn(`[TechnicalIndicators] No kline data for ${symbol}`);
                this.generateSampleData(); // 데이터 없으면 샘플 데이터로 대체
                this.updateDisplay();
                return;
            }

            this.priceData = klines.map(k => ({
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5])
            }));
            
            this.calculateIndicators();
            this.updateDisplay();

        } catch (error) {
            console.error(`[TechnicalIndicators] Error loading data for ${symbol}:`, error);
            // 에러 발생 시 샘플 데이터 사용
            this.generateSampleData();
            this.updateDisplay();
        }
    }

    calculateIndicators() {
        if (this.priceData.length < 52) { // 일목균형표 기준(52)
            this.generateSampleData();
            return;
        }

        this.calculateRSI();
        this.calculateMACD();
        this.calculateBollingerBands();
        this.calculateStochastic();
        this.calculateSMA();
        this.calculateIchimoku();
        this.calculateATR();
        this.calculateVO();
        this.calculateAO();
        this.calculateWilliamsR();
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

    calculateSMA() {
        const prices = this.priceData.map(data => data.close);
        const shortPeriod = 20;
        const longPeriod = 50;

        const shortSMA = this.calculateSimpleSMA(prices, shortPeriod);
        const longSMA = this.calculateSimpleSMA(prices, longPeriod);
        
        this.indicators.sma.short = shortSMA;
        this.indicators.sma.long = longSMA;
        this.indicators.sma.status = this.getSMAStatus(prices[prices.length - 1], shortSMA, longSMA);
    }

    calculateSimpleSMA(prices, period) {
        if (prices.length < period) return 0;
        const slice = prices.slice(-period);
        return slice.reduce((a, b) => a + b, 0) / period;
    }

    getSMAStatus(price, shortSMA, longSMA) {
        if (price > shortSMA && shortSMA > longSMA) return '강세';
        if (price < shortSMA && shortSMA < longSMA) return '약세';
        if (shortSMA > longSMA) return '상승추세';
        if (shortSMA < longSMA) return '하락추세';
        return '중립';
    }
    
    calculateIchimoku() {
        const data = this.priceData;
        if (data.length < 52) return;

        const tenkanSenPeriod = 9;
        const kijunSenPeriod = 26;
        const senkouSpanBPeriod = 52;
        
        const subSlice = (period) => data.slice(-period);

        const getHigh = (arr) => Math.max(...arr.map(d => d.high));
        const getLow = (arr) => Math.min(...arr.map(d => d.low));

        const tenkan = (getHigh(subSlice(tenkanSenPeriod)) + getLow(subSlice(tenkanSenPeriod))) / 2;
        const kijun = (getHigh(subSlice(kijunSenPeriod)) + getLow(subSlice(kijunSenPeriod))) / 2;
        
        const senkouA = (tenkan + kijun) / 2;
        const senkouB = (getHigh(subSlice(senkouSpanBPeriod)) + getLow(subSlice(senkouSpanBPeriod))) / 2;

        const currentPrice = data[data.length - 1].close;
        
        this.indicators.ichimoku = {
            tenkan, kijun, senkouA, senkouB,
            status: this.getIchimokuStatus(currentPrice, senkouA, senkouB)
        };
    }

    getIchimokuStatus(price, spanA, spanB) {
        const cloudTop = Math.max(spanA, spanB);
        const cloudBottom = Math.min(spanA, spanB);
        
        if (price > cloudTop) return '구름대 상단 돌파';
        if (price < cloudBottom) return '구름대 하단 이탈';
        return '구름대 내부';
    }
    
    calculateATR(period = 14) {
        const data = this.priceData;
        if (data.length < period) return;
        
        let trValues = [];
        for(let i = 1; i < data.length; i++) {
            const high = data[i].high;
            const low = data[i].low;
            const prevClose = data[i-1].close;
            
            const tr1 = high - low;
            const tr2 = Math.abs(high - prevClose);
            const tr3 = Math.abs(low - prevClose);
            
            trValues.push(Math.max(tr1, tr2, tr3));
        }
        
        const atr = trValues.slice(-period).reduce((a, b) => a + b, 0) / period;
        this.indicators.atr.value = atr;
    }

    calculateVO(shortPeriod = 5, longPeriod = 10) {
        const volumes = this.priceData.map(d => d.volume);
        if (volumes.length < longPeriod) return;

        const shortMA = this.calculateSimpleSMA(volumes, shortPeriod);
        const longMA = this.calculateSimpleSMA(volumes, longPeriod);

        const vo = ((shortMA - longMA) / longMA) * 100;
        this.indicators.vo = {
            value: vo,
            status: this.getVOStatus(vo)
        };
    }

    getVOStatus(vo) {
        if (vo > 0) return '거래량 증가';
        if (vo < -20) return '거래량 감소';
        return '중립';
    }

    calculateAO(shortPeriod = 5, longPeriod = 34) {
        const midPoints = this.priceData.map(d => (d.high + d.low) / 2);
        if (midPoints.length < longPeriod) return;

        const shortMA = this.calculateSimpleSMA(midPoints, shortPeriod);
        const longMA = this.calculateSimpleSMA(midPoints, longPeriod);
        
        const ao = shortMA - longMA;
        this.indicators.ao = {
            value: ao,
            status: this.getAOStatus(ao, this.calculateSimpleSMA(midPoints.slice(-2), 2) - this.calculateSimpleSMA(midPoints.slice(-longPeriod-2, -2), longPeriod))
        };
    }

    getAOStatus(currentAO, prevAO) {
        if (currentAO > 0 && prevAO < 0) return '강세 전환';
        if (currentAO < 0 && prevAO > 0) return '약세 전환';
        if (currentAO > 0) return '강세';
        if (currentAO < 0) return '약세';
        return '중립';
    }

    calculateWilliamsR(period = 14) {
        const data = this.priceData.slice(-period);
        if (data.length < period) return;

        const high = Math.max(...data.map(d => d.high));
        const low = Math.min(...data.map(d => d.low));
        const currentClose = data[data.length - 1].close;

        const wr = ((high - currentClose) / (high - low)) * -100;
        this.indicators.williamsR = {
            value: wr,
            status: this.getWilliamsRStatus(wr)
        };
    }
    
    getWilliamsRStatus(wr) {
        if (wr > -20) return '과매수';
        if (wr < -80) return '과매도';
        return '중립';
    }

    generateSampleData() {
        this.indicators = {
            rsi: { value: 45 + Math.random() * 20, status: '중립' },
            macd: { value: (Math.random() - 0.5) * 100, signal: 0, histogram: 0, status: '중립' },
            bb: { upper: 0, middle: 0, lower: 0, position: '중간', status: '중립' },
            stoch: { k: 30 + Math.random() * 40, d: 35 + Math.random() * 30, status: '중립' },
            sma: { short: 45000, long: 46000, status: '중립' },
            ichimoku: { tenkan: 0, kijun: 0, spanA: 0, spanB: 0, chikou: 0, status: '중립' },
            atr: { value: 150 + Math.random() * 50 },
            vo: { value: (Math.random() - 0.5) * 50, status: '중립' },
            ao: { value: (Math.random() - 0.5) * 100, status: '중립' },
            williamsR: { value: -70 + Math.random() * 40, status: '중립' }
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

    updateDisplay() {
        if (!this.indicators) return;

        const { rsi, macd, bb, stoch, sma, ichimoku, atr, vo, ao, williamsR } = this.indicators;

        // RSI 업데이트
        const rsiValueEl = document.getElementById('rsi-value');
        if (rsiValueEl) {
            rsiValueEl.textContent = `${rsi.value.toFixed(2)} (${this.getRSIStatus(rsi.value)})`;
            this.updateIndicatorClass(rsiValueEl, this.getRSIStatus(rsi.value));
        }

        // MACD 업데이트
        const macdValueEl = document.getElementById('macd-value');
        if (macdValueEl) {
            const macdStatus = this.getMACDStatus(macd.value, macd.signal);
            macdValueEl.textContent = `${macd.histogram.toFixed(4)} (${macdStatus})`;
            this.updateIndicatorClass(macdValueEl, macdStatus);
        }

        // 볼린저 밴드 업데이트
        const bbValueEl = document.getElementById('bb-value');
        if (bbValueEl) {
            const bbStatus = this.getBBStatus(this.priceData[this.priceData.length - 1].close, bb.upper, bb.lower);
            bbValueEl.textContent = `${bb.position} (${bbStatus})`;
            this.updateIndicatorClass(bbValueEl, bbStatus);
        }
        
        // 스토캐스틱 업데이트
        const stochValueEl = document.getElementById('stoch-value');
        if (stochValueEl) {
             const stochStatus = this.getStochStatus(stoch.k);
             stochValueEl.textContent = `${stoch.k.toFixed(2)} (${stochStatus})`;
             this.updateIndicatorClass(stochValueEl, stochStatus);
        }

        // SMA 업데이트
        const smaValueEl = document.getElementById('sma-value');
        if (smaValueEl) {
            smaValueEl.textContent = `${this.indicators.sma.status}`;
            this.updateIndicatorClass(smaValueEl, this.indicators.sma.status);
        }

        // 일목균형표 업데이트
        const ichimokuValueEl = document.getElementById('ichimoku-value');
        if (ichimokuValueEl) {
            ichimokuValueEl.textContent = `${this.indicators.ichimoku.status}`;
            this.updateIndicatorClass(ichimokuValueEl, this.indicators.ichimoku.status);
        }

        // ATR 업데이트
        const atrValueEl = document.getElementById('atr-value');
        if (atrValueEl) {
            atrValueEl.textContent = `${this.indicators.atr.value.toFixed(2)}`;
            atrValueEl.classList.remove('long', 'short');
            atrValueEl.classList.add('neutral');
        }

        // VO 업데이트
        const voValueEl = document.getElementById('vo-value');
        if (voValueEl) {
            voValueEl.textContent = `${vo.value.toFixed(2)}% (${vo.status})`;
            this.updateIndicatorClass(voValueEl, vo.status);
        }
        
        // AO 업데이트
        const aoValueEl = document.getElementById('ao-value');
        if (aoValueEl) {
            aoValueEl.textContent = `${ao.value.toFixed(2)} (${ao.status})`;
            this.updateIndicatorClass(aoValueEl, ao.status);
        }

        // Williams %R 업데이트
        const williamsRValueEl = document.getElementById('williams-r-value');
        if (williamsRValueEl) {
            williamsRValueEl.textContent = `${williamsR.value.toFixed(2)} (${williamsR.status})`;
            this.updateIndicatorClass(williamsRValueEl, williamsR.status);
        }

        this.updateSummary();
    }

    updateSummary() {
        const statuses = [
            this.indicators.rsi.status,
            this.indicators.macd.status,
            this.getBBStatus(this.priceData.length ? this.priceData[this.priceData.length-1].close : 0, this.indicators.bb.upper, this.indicators.bb.lower),
            this.indicators.stoch.status,
            this.indicators.sma.status,
            this.indicators.ichimoku.status,
            this.indicators.vo.status,
            this.indicators.ao.status,
            this.indicators.williamsR.status
        ];

        const longSignals = ['과매도', '강세', '상승추세', '구름대 상단 돌파', '거래량 증가', '강세 전환'];
        const shortSignals = ['과매수', '약세', '하락추세', '구름대 하단 이탈', '거래량 감소', '약세 전환'];
        
        let score = 0;
        statuses.forEach(status => {
            if (longSignals.includes(status)) {
                score++;
            } else if (shortSignals.includes(status)) {
                score--;
            }
        });

        const totalIndicators = statuses.length;
        // Normalize score from [-totalIndicators, +totalIndicators] to [0, 100]
        const percentage = totalIndicators > 0 ? ((score + totalIndicators) / (2 * totalIndicators)) * 100 : 50;

        const summaryBar = document.getElementById('indicator-summary-bar');
        const summaryText = document.getElementById('indicator-summary-text');

        if (summaryBar && summaryText) {
            summaryBar.style.width = `${percentage.toFixed(1)}%`;
            
            let summaryStatusText = '';
            if (percentage > 75) {
                summaryStatusText = '강한 매수';
            } else if (percentage > 55) {
                summaryStatusText = '매수';
            } else if (percentage > 45) {
                summaryStatusText = '중립';
            } else if (percentage > 25) {
                summaryStatusText = '매도';
            } else {
                summaryStatusText = '강한 매도';
            }

            summaryText.textContent = `종합: ${summaryStatusText} (${percentage.toFixed(0)}%)`;
        }
    }

    updateIndicatorClass(element, status) {
        element.classList.remove('long', 'short', 'neutral');
        const longSignals = ['과매도', '강세', '상승추세', '구름대 상단 돌파', '거래량 증가', '강세 전환'];
        const shortSignals = ['과매수', '약세', '하락추세', '구름대 하단 이탈', '거래량 감소', '약세 전환'];

        if (longSignals.includes(status)) {
            element.classList.add('long');
        } else if (shortSignals.includes(status)) {
            element.classList.add('short');
        } else {
            element.classList.add('neutral');
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

    getSMA() {
        return this.indicators.sma;
    }

    getIchimoku() {
        return this.indicators.ichimoku;
    }

    getATR() {
        return this.indicators.atr;
    }
} 