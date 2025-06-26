/**
 * Technical Indicators Module
 * 기술적 지표를 계산하고 표시하는 모듈
 */
export class TechnicalIndicators {
    constructor(settings) {
        this.currentSymbol = 'BTCUSDT';
        this.currentTimeframe = '1h';
        this.indicators = {
            rsi: { value: 0, status: '중립' },
            stoch: { k: 0, d: 0, status: '중립' },
            stochRsi: { k: 0, d: 0, status: '중립' },
            macd: { value: 0, signal: 0, histogram: 0, status: '중립' },
            bb: { upper: 0, middle: 0, lower: 0, position: '중간', status: '중립' },
            ao: { value: 0, status: '중립'},
            williamsR: { value: 0, status: '중립'},
            cci: { value: 0, status: '중립' },
            sma: { short: 0, long: 0, status: '중립' },
            ichimoku: { tenkan: 0, kijun: 0, spanA: 0, spanB: 0, chikou: 0, status: '중립' },
            mom: { value: 0, status: '중립' },
            vo: { value: 0, status: '중립'},
            psar: { value: 0, status: '중립' },
            adx: { value: 0, status: '중립' },
            obv: { value: 0, status: '중립' },
            mfi: { value: 0, status: '중립' },
            roc: { value: 0, status: '중립' },
            keltner: { upper: 0, middle: 0, lower: 0, status: '중립' },
            donchian: { upper: 0, middle: 0, lower: 0, status: '중립' },
            aroon: { up: 0, down: 0, status: '중립' },
            ultimate: { value: 0, status: '중립' },
            cmf: { value: 0, status: '중립' },
            atr: { value: 0, status: '중립' }
        };
        this.priceData = [];
        this.isTracking = false;
        this.interval = null;
        
        // 깜빡거림 방지를 위한 상태 관리
        this.lastUpdateHash = '';
        this.lastSummaryHash = '';
        this.lastDataHash = '';
        this.stylesInjected = false;
        this.isUpdating = false;
        
        this.init();
    }

    init() {
        // console.log('📊 Technical Indicators initializing...');
        this.setupEventListeners();
        
        // 초기 종합 분석 표시
        this.showDefaultSummary();
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
        
        // 시간봉 변경
        const timeframeSelector = document.getElementById('indicator-timeframe-selector');
        if (timeframeSelector) {
            timeframeSelector.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    // 모든 버튼에서 active 클래스 제거
                    timeframeSelector.querySelectorAll('.timeframe-btn').forEach(btn => btn.classList.remove('active'));
                    // 클릭된 버튼에 active 클래스 추가
                    e.target.classList.add('active');
                    
                    this.currentTimeframe = e.target.dataset.timeframe;
                    // console.log(`Timeframe changed to: ${this.currentTimeframe}`);
                    this.loadData();
                }
            });
        }
    }

    async start() {
        if (this.isTracking) return; // 이미 시작된 경우 중복 실행 방지
        
        this.isTracking = true;
        
        // 초기 스타일 주입 (한 번만)
        this.addSummaryStyles();
        
        // 실제 데이터 로드
        await this.loadData();
        
        // 15초마다 데이터를 새로고침 (분봉 변경 시 빠른 반응을 위해)
        this.interval = setInterval(async () => {
            if (this.isTracking && !this.isUpdating) {
                await this.loadData();
            }
        }, 15000);
    }

    stop() {
        this.isTracking = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    async loadData() {
        if (this.isUpdating) return; // 업데이트 중이면 스킵
        
        this.isUpdating = true;
        const symbol = this.currentSymbol;
        
        // Binance API는 klines(캔들) 데이터를 사용하여 기술 지표를 계산합니다.
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${this.currentTimeframe}&limit=200`;

        try {
            const response = await fetch(url);
            const klines = await response.json();
            
            if (!klines || klines.length === 0) {
                this.updateDisplay();
                return;
            }

            const newPriceData = klines.map(k => ({
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5])
            }));
            
            // 데이터 변경 감지
            const dataHash = this.generateDataHash(newPriceData);
            if (dataHash === this.lastDataHash) {
                this.isUpdating = false;
                return; // 데이터가 변경되지 않았으면 업데이트 스킵
            }
            
            this.priceData = newPriceData;
            this.lastDataHash = dataHash;
            
            this.calculateIndicators();
            this.updateDisplay();

        } catch (error) {
            this.updateDisplay();
        } finally {
            this.isUpdating = false;
        }
    }

    // 데이터 변경 감지를 위한 해시 생성
    generateDataHash(data) {
        if (!data || data.length === 0) return '';
        const lastCandle = data[data.length - 1];
        return `${lastCandle.close}_${lastCandle.volume}_${data.length}`;
    }

    calculateIndicators() {
        if (this.priceData.length < 52) { // 일목균형표 기준(52)
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
        this.calculateStochRSI();
        this.calculateCCI();
        this.calculateMOM();
        this.calculateParabolicSAR();
        this.calculateADX();
        this.calculateOBV();
        this.calculateMFI();
        this.calculateROC();
        this.calculateKeltnerChannel();
        this.calculateDonchianChannel();
        this.calculateAroon();
        this.calculateUltimateOscillator();
        this.calculateChaikinMoneyFlow();
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
        if (price > spanA && spanA > spanB) return '강세';
        if (price < spanA && spanA < spanB) return '약세';
        return '중립';
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

    calculateStochRSI(rsiPeriod = 14, stochPeriod = 14) {
        const prices = this.priceData.map(data => data.close);
        const rsiValues = this.calculateRSIValues(prices, rsiPeriod);
        if (rsiValues.length < stochPeriod) return;

        const recentRsi = rsiValues.slice(-stochPeriod);
        const highestRsi = Math.max(...recentRsi);
        const lowestRsi = Math.min(...recentRsi);
        const currentRsi = recentRsi[recentRsi.length - 1];

        const k = ((currentRsi - lowestRsi) / (highestRsi - lowestRsi)) * 100;
        this.indicators.stochRsi = {
            k: isNaN(k) ? 0 : k,
            d: 0, // D 값은 단순화를 위해 생략
            status: this.getStochRSIStatus(isNaN(k) ? 50 : k)
        };
    }
    
    calculateRSIValues(prices, period = 14) {
        let rsiValues = [];
        let gains = [];
        let losses = [];

        for (let i = 1; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            if (change > 0) {
                gains.push(change);
                losses.push(0);
            } else {
                gains.push(0);
                losses.push(Math.abs(change));
            }

            if (i >= period) {
                let avgGain = 0;
                let avgLoss = 0;

                if (i === period) {
                    avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
                    avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
                } else {
                    avgGain = (rsiValues[rsiValues.length-1].avgGain * (period - 1) + gains[gains.length - 1]) / period;
                    avgLoss = (rsiValues[rsiValues.length-1].avgLoss * (period - 1) + losses[losses.length-1]) / period;
                }

                if (avgLoss === 0) {
                    rsiValues.push({rsi: 100, avgGain, avgLoss});
                } else {
                    const rs = avgGain / avgLoss;
                    const rsi = 100 - (100 / (1 + rs));
                    rsiValues.push({rsi, avgGain, avgLoss});
                }
            }
        }
        return rsiValues.map(v => v.rsi);
    }

    getStochRSIStatus(k) {
        if (k > 80) return '과매수';
        if (k < 20) return '과매도';
        return '중립';
    }

    calculateCCI(period = 20) {
        const data = this.priceData.slice(-period);
        if (data.length < period) return;

        const typicalPrices = data.map(d => (d.high + d.low + d.close) / 3);
        const sma = typicalPrices.reduce((a, b) => a + b, 0) / period;
        const meanDeviation = typicalPrices.map(p => Math.abs(p - sma)).reduce((a, b) => a + b, 0) / period;
        
        const cci = (typicalPrices[typicalPrices.length - 1] - sma) / (0.015 * meanDeviation);
        this.indicators.cci = {
            value: cci,
            status: this.getCCIStatus(cci)
        };
    }

    getCCIStatus(cci) {
        if (cci > 100) return '과매수';
        if (cci < -100) return '과매도';
        return '중립';
    }
    
    calculateMOM(period = 10) {
        const prices = this.priceData.map(d => d.close);
        if (prices.length < period) return;

        const mom = prices[prices.length - 1] - prices[prices.length - 1 - period];
        this.indicators.mom = {
            value: mom,
            status: this.getMOMStatus(mom)
        };
    }

    getMOMStatus(mom) {
        if (mom > 0) return '상승';
        if (mom < 0) return '하락';
        return '중립';
    }

    startRealTimeTracking() {
        this.trackingInterval = setInterval(async () => {
            if (this.isTracking) {
                await this.loadData();
            }
        }, 60000); // 1분마다 업데이트
    }

    updateDisplay() {
        if (this.isUpdating) return; // 업데이트 중이면 스킵
        
        if (!this.indicators) {
            return;
        }

        // 표시할 내용의 해시 생성
        const displayHash = this.generateDisplayHash();
        if (displayHash === this.lastUpdateHash) {
            return; // 변경사항이 없으면 업데이트 스킵
        }
        
        this.lastUpdateHash = displayHash;

        // indicators-list 컨테이너에 HTML 생성
        const container = document.getElementById('indicators-list');
        
        if (container) {
            // AnalysisConfig가 없을 경우 fallback
            const indicators = AnalysisConfig?.indicators || [
                { key: 'rsi', name: 'RSI', description: '상대강도' },
                { key: 'stochRsi', name: 'Stoch RSI', description: 'RSI 스토캐스틱' },
                { key: 'macd', name: 'MACD', description: '이동평균수렴발산' },
                { key: 'ao', name: 'AO', description: '어썸 오실레이터' },
                { key: 'williamsR', name: 'Williams %R', description: '윌리엄스 %R' },
                { key: 'cci', name: 'CCI', description: '상품채널지수' },
                { key: 'sma', name: 'MA', description: '이동평균' },
                { key: 'ichimoku', name: 'Ichimoku', description: '일목균형표' },
                { key: 'bb', name: 'BB', description: '볼린저 밴드' },
                { key: 'stoch', name: 'Stoch', description: '스토캐스틱' },
                { key: 'mom', name: 'Momentum', description: '모멘텀' },
                { key: 'vo', name: 'VO', description: '거래량 오실레이터' },
                { key: 'psar', name: 'PSAR', description: '파라볼릭 SAR' },
                { key: 'adx', name: 'ADX', description: '평균방향성지수' },
                { key: 'obv', name: 'OBV', description: 'OBV' },
                { key: 'mfi', name: 'MFI', description: '자금흐름지수' },
                { key: 'roc', name: 'ROC', description: '가격변동률' },
                { key: 'keltner', name: 'Keltner', description: '켈트너 채널' },
                { key: 'donchian', name: 'Donchian', description: '돈치안 채널' },
                { key: 'aroon', name: 'Aroon', description: '아룬 지표' },
                { key: 'ultimate', name: 'Ultimate', description: '얼티미트 오실레이터' },
                { key: 'cmf', name: 'CMF', description: '차이킨 자금 흐름' },
                { key: 'atr', name: 'ATR', description: '평균 변동폭' }
            ];
            
            const indicatorsHTML = indicators.map(indicator => {
                const data = this.indicators[indicator.key];
                
                let value = '계산 중...';
                let status = '계산 중...';
                let signalClass = 'calculating';
                
                if (data) {
                    if (typeof data.value === 'number') {
                        value = data.value.toFixed(2);
                        status = data.status || 'N/A';
                        signalClass = this.getIndicatorClass(status);
                    } else if (data.k !== undefined) {
                        // Stochastic, StochRSI 등의 경우
                        value = data.k.toFixed(2);
                        status = data.status || 'N/A';
                        signalClass = this.getIndicatorClass(status);
                    } else if (data.histogram !== undefined) {
                        // MACD의 경우
                        value = data.histogram.toFixed(4);
                        status = data.status || 'N/A';
                        signalClass = this.getIndicatorClass(status);
                    } else {
                        status = data.status || 'N/A';
                        signalClass = this.getIndicatorClass(status);
                    }
        }
                
                const displayText = value !== '계산 중...' ? `${status} (${value})` : status;

                return `
                    <div class="indicator-item">
                        <div class="indicator-info">
                            <span class="indicator-name">${indicator.name}</span>
                            <span class="indicator-desc">${indicator.description}</span>
                        </div>
                        <span class="indicator-value ${signalClass}">
                            ${displayText}
                        </span>
                    </div>
                `;
            }).join('');
            
            // 부드러운 업데이트를 위한 페이드 효과
            container.style.opacity = '0.7';
            setTimeout(() => {
            container.innerHTML = indicatorsHTML;
                container.style.opacity = '1';
            }, 50);
        }

        this.updateSummary();
    }

    // 표시 내용 해시 생성 (변경 감지용)
    generateDisplayHash() {
        const values = Object.values(this.indicators).map(indicator => {
            if (typeof indicator.value === 'number') {
                return `${indicator.value.toFixed(2)}_${indicator.status}`;
            } else if (indicator.k !== undefined) {
                return `${indicator.k.toFixed(2)}_${indicator.status}`;
            } else if (indicator.histogram !== undefined) {
                return `${indicator.histogram.toFixed(4)}_${indicator.status}`;
            } else {
                return indicator.status || 'N/A';
            }
        });
        return values.join('|');
    }

    getIndicatorClass(status) {
        if (!status || status === '계산 중...' || status === 'N/A') {
            return 'calculating';
        }

        // 과매수 신호 (빨간색)
        if (status === '과매수') {
            return 'overbought';
        }
        // 과매도 신호 (초록색)
        else if (status === '과매도') {
            return 'oversold';
        }
        // 매수 신호 (초록색)
        else if (['강세', '상승추세', '구름대 상단 돌파', '거래량 증가', '강세 전환', '상승', '강한추세', '돌파'].includes(status)) {
            return 'bullish';
        }
        // 매도 신호 (빨간색)
        else if (['약세', '하락추세', '구름대 하단 이탈', '거래량 감소', '약세 전환', '하락', '약한추세', '이탈'].includes(status)) {
            return 'bearish';
        }
        else {
            return 'neutral';
        }
    }

    updateSummary() {
        // 현재 가격 데이터가 없거나 지표 계산이 완료되지 않았으면 기본값 사용
        if (!this.priceData || this.priceData.length === 0 || this.priceData.length < 52) {
            this.showDefaultSummary();
            return;
        }
        
        // 모든 지표가 계산되었는지 확인
        const requiredIndicators = ['rsi', 'macd', 'bb', 'stoch', 'sma', 'ichimoku'];
        const indicatorStatus = requiredIndicators.map(key => {
            const indicator = this.indicators[key];
            let isCalculated = false;
            
            if (indicator) {
                if (key === 'bb') {
                    // 볼린저 밴드는 upper, middle, lower 값이 있으면 계산된 것
                    isCalculated = typeof indicator.upper === 'number' && 
                                   typeof indicator.middle === 'number' && 
                                   typeof indicator.lower === 'number';
                } else if (key === 'macd') {
                    // MACD는 histogram 값이 있으면 계산된 것
                    isCalculated = typeof indicator.histogram === 'number';
                } else if (key === 'stoch') {
                    // Stochastic은 k 값이 있으면 계산된 것
                    isCalculated = typeof indicator.k === 'number';
                } else if (key === 'sma') {
                    // SMA는 short, long 값이 있으면 계산된 것
                    isCalculated = typeof indicator.short === 'number' && typeof indicator.long === 'number';
                } else if (key === 'ichimoku') {
                    // Ichimoku는 senkouA 값이 있으면 계산된 것
                    isCalculated = typeof indicator.senkouA === 'number';
                } else {
                    // 기타 지표들은 value 값이 있으면 계산된 것
                    isCalculated = typeof indicator.value === 'number';
                }
            }
            
            return isCalculated;
        });
        
        const allCalculated = indicatorStatus.every(status => status);
        
        if (!allCalculated) {
            // 지표 계산이 완료되지 않았으면 잠시 후 다시 시도
            setTimeout(() => this.updateSummary(), 1000);
            return;
        }
        
        // 안전하게 지표 상태 가져오기
        const getStatus = (indicator) => indicator && indicator.status ? indicator.status : '중립';
        const getCurrentPrice = () => this.priceData.length ? this.priceData[this.priceData.length-1].close : 0;
        
        const statuses = [
            getStatus(this.indicators.rsi),
            getStatus(this.indicators.macd),
            this.getBBStatus(getCurrentPrice(), this.indicators.bb.upper, this.indicators.bb.lower),
            getStatus(this.indicators.stoch),
            getStatus(this.indicators.sma),
            getStatus(this.indicators.ichimoku),
            getStatus(this.indicators.vo),
            getStatus(this.indicators.ao),
            getStatus(this.indicators.williamsR),
            getStatus(this.indicators.stochRsi),
            getStatus(this.indicators.cci),
            getStatus(this.indicators.mom),
            getStatus(this.indicators.psar),
            getStatus(this.indicators.adx),
            getStatus(this.indicators.obv),
            getStatus(this.indicators.mfi),
            getStatus(this.indicators.roc),
            getStatus(this.indicators.keltner),
            getStatus(this.indicators.donchian),
            getStatus(this.indicators.aroon),
            getStatus(this.indicators.ultimate),
            getStatus(this.indicators.cmf)
        ].filter(status => status && status !== ''); // 빈 값 제거

        let score = 0;
        let buyCount = 0;
        let sellCount = 0;
        let neutralCount = 0;
        
        // 과매도는 매수 신호 (초록색)
        const longSignals = ['과매도', '강세', '상승추세', '구름대 상단 돌파', '거래량 증가', '강세 전환', '상승', '강한추세', '돌파'];
        // 과매수는 매도 신호 (빨간색)
        const shortSignals = ['과매수', '약세', '하락추세', '구름대 하단 이탈', '거래량 감소', '약세 전환', '하락', '약한추세', '이탈'];
        
        statuses.forEach(status => {
            if (longSignals.includes(status)) {
                score++;
                buyCount++;
            } else if (shortSignals.includes(status)) {
                score--;
                sellCount++;
            } else {
                neutralCount++;
            }
        });

        const totalIndicators = statuses.length;
        // Normalize score from [-totalIndicators, +totalIndicators] to [0, 100]
        const percentage = totalIndicators > 0 ? ((score + totalIndicators) / (2 * totalIndicators)) * 100 : 50;

        // 요약 데이터 해시 생성 (일시적으로 비활성화하여 항상 업데이트)
        const summaryHash = `${percentage.toFixed(0)}_${buyCount}_${sellCount}_${neutralCount}`;
        // if (summaryHash === this.lastSummaryHash) {
        //     return; // 변경사항이 없으면 업데이트 스킵
        // }
        this.lastSummaryHash = summaryHash;

        const summaryContainer = document.getElementById('indicator-summary-container');

        if (summaryContainer) {
            let summaryStatusText = '';
            let statusClass = '';
            let statusIcon = '';
            let statusColor = '';
            
            if (percentage > 75) {
                summaryStatusText = '강한 매수';
                statusClass = 'strong-buy';
                statusIcon = '🚀';
                statusColor = '#059669';
            } else if (percentage > 55) {
                summaryStatusText = '매수';
                statusClass = 'buy';
                statusIcon = '📈';
                statusColor = '#10b981';
            } else if (percentage > 45) {
                summaryStatusText = '중립';
                statusClass = 'neutral';
                statusIcon = '➡️';
                statusColor = '#6b7280';
            } else if (percentage > 25) {
                summaryStatusText = '매도';
                statusClass = 'sell';
                statusIcon = '📉';
                statusColor = '#f59e0b';
            } else {
                summaryStatusText = '강한 매도';
                statusClass = 'strong-sell';
                statusIcon = '⚠️';
                statusColor = '#dc2626';
            }

            // 항상 새로운 카드를 생성하여 "대기중" 문제 해결
            this.createNewSummaryCard(summaryContainer, {
                summaryStatusText,
                statusClass,
                statusIcon,
                statusColor,
                percentage,
                buyCount,
                sellCount,
                neutralCount,
                totalIndicators
            });
            
            // 스타일 재적용 확인
            this.addSummaryStyles();
        }
    }

    updateExistingSummaryCard(card, data) {
        // 상태 텍스트 업데이트
        const statusElement = card.querySelector('.summary-status');
        if (statusElement) {
            statusElement.className = `summary-status ${data.statusClass}`;
            statusElement.querySelector('.status-icon').textContent = data.statusIcon;
            statusElement.querySelector('.status-text').textContent = data.summaryStatusText;
        }

        // 게이지 업데이트
        const gaugeProgress = card.querySelector('.gauge-progress');
        const gaugePercentage = card.querySelector('.gauge-percentage');
        const gaugeGradient = card.querySelector('#gaugeGradient stop');
        
        if (gaugeProgress) {
            gaugeProgress.setAttribute('stroke-dasharray', `${(data.percentage * 2.2).toFixed(1)} 220`);
        }
        if (gaugePercentage) {
            gaugePercentage.textContent = `${data.percentage.toFixed(0)}%`;
            gaugePercentage.setAttribute('fill', data.statusColor);
        }
        if (gaugeGradient) {
            gaugeGradient.style.stopColor = data.statusColor;
        }

        // 신호 분석 업데이트
        const signalCounts = card.querySelectorAll('.signal-count');
        if (signalCounts.length >= 3) {
            signalCounts[0].textContent = data.buyCount;
            signalCounts[1].textContent = data.neutralCount;
            signalCounts[2].textContent = data.sellCount;
        }

        // 푸터 정보 업데이트
        const countValue = card.querySelector('.count-value');
        const updateTime = card.querySelector('.update-time');
        
        if (countValue) {
            countValue.textContent = `${data.totalIndicators}개`;
        }
        if (updateTime) {
            updateTime.textContent = new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'});
        }
    }

    createNewSummaryCard(container, data) {
        container.innerHTML = `
            <div class="technical-summary-card">
                <div class="summary-header">
                    <div class="summary-title">
                        <span class="title-icon">📊</span>
                        <span>종합 매매 신호</span>
                </div>
                    <div class="summary-status ${data.statusClass}">
                        <span class="status-icon">${data.statusIcon}</span>
                        <span class="status-text">${data.summaryStatusText}</span>
                    </div>
                </div>
                
                <div class="circular-gauge-container">
                    <div class="circular-gauge">
                        <svg class="gauge-svg" viewBox="0 0 200 120">
                            <!-- 배경 호 -->
                            <path class="gauge-bg" 
                                  d="M 30 100 A 70 70 0 0 1 170 100" 
                                  fill="none" 
                                  stroke="#e5e7eb" 
                                  stroke-width="12" 
                                  stroke-linecap="round"/>
                            <!-- 진행 호 -->
                            <path class="gauge-progress" 
                                  d="M 30 100 A 70 70 0 0 1 170 100"
                                  fill="none" 
                                  stroke="url(#gaugeGradient)" 
                                  stroke-width="12" 
                                  stroke-linecap="round"
                                  stroke-dasharray="${(data.percentage * 2.2).toFixed(1)} 220"
                                  style="transition: stroke-dasharray 1s ease-in-out;"/>
                            <!-- 그라디언트 정의 -->
                            <defs>
                                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" style="stop-color:${data.statusColor};stop-opacity:1" />
                                    <stop offset="100%" style="stop-color:${data.statusColor};stop-opacity:0.7" />
                                </linearGradient>
                            </defs>
                            <!-- 중앙 텍스트 -->
                            <text x="100" y="75" text-anchor="middle" class="gauge-percentage" 
                                  fill="${data.statusColor}" font-size="24" font-weight="bold">
                                ${data.percentage.toFixed(0)}%
                            </text>
                            <text x="100" y="95" text-anchor="middle" class="gauge-label" 
                                  fill="#6b7280" font-size="12">
                                신뢰도
                            </text>
                        </svg>
                    </div>
                </div>
                
                <div class="signal-breakdown">
                    <div class="signal-item bullish">
                        <div class="signal-dot"></div>
                        <span class="signal-label">매수</span>
                        <span class="signal-count">${data.buyCount}</span>
                    </div>
                    <div class="signal-item neutral">
                        <div class="signal-dot"></div>
                        <span class="signal-label">중립</span>
                        <span class="signal-count">${data.neutralCount}</span>
                    </div>
                    <div class="signal-item bearish">
                        <div class="signal-dot"></div>
                        <span class="signal-label">매도</span>
                        <span class="signal-count">${data.sellCount}</span>
                    </div>
                </div>
                
                <div class="summary-footer">
                    <div class="indicator-count">
                        <span class="count-label">분석 지표</span>
                        <span class="count-value">${data.totalIndicators}개</span>
                    </div>
                    <div class="last-updated">
                        <span class="update-label">업데이트</span>
                        <span class="update-time">${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}</span>
                    </div>
                    </div>
                </div>
            `;
    }

    addSummaryStyles() {
        // 이미 스타일이 주입되었으면 스킵
        if (this.stylesInjected) return;
        
        // 기존 스타일이 있으면 제거
        const existingStyle = document.getElementById('technical-summary-styles');
        if (existingStyle) {
            existingStyle.remove();
        }
        
        const style = document.createElement('style');
        style.id = 'technical-summary-styles';
        style.textContent = `
            .technical-summary-card {
                background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
                border-radius: 12px;
                padding: 20px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
                position: relative;
                overflow: hidden;
                transition: all 0.3s ease;
            }
            
            .technical-summary-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 3px;
                background: linear-gradient(90deg, #3b82f6, #10b981, #f59e0b, #ef4444);
                opacity: 0.6;
            }
            
            .summary-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }
            
            .summary-title {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 16px;
                font-weight: 600;
                color: #1f2937;
            }
            
            .title-icon {
                font-size: 18px;
            }
            
            .summary-status {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: 600;
                transition: all 0.3s ease;
            }
            
            .summary-status.strong-buy {
                background: linear-gradient(135deg, #dcfce7, #bbf7d0);
                color: #059669;
                border: 1px solid #86efac;
            }
            
            .summary-status.buy {
                background: linear-gradient(135deg, #ecfdf5, #d1fae5);
                color: #10b981;
                border: 1px solid #a7f3d0;
            }
            
            .summary-status.neutral {
                background: linear-gradient(135deg, #f9fafb, #f3f4f6);
                color: #6b7280;
                border: 1px solid #d1d5db;
            }
            
            .summary-status.sell {
                background: linear-gradient(135deg, #fffbeb, #fef3c7);
                color: #f59e0b;
                border: 1px solid #fcd34d;
            }
            
            .summary-status.strong-sell {
                background: linear-gradient(135deg, #fef2f2, #fecaca);
                color: #dc2626;
                border: 1px solid #fca5a5;
            }
            
            .circular-gauge-container {
                display: flex;
                justify-content: center;
                margin: 20px 0;
            }
            
            .circular-gauge {
                width: 200px;
                height: 120px;
            }
            
            .gauge-svg {
                width: 100%;
                height: 100%;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
            }
            
            .signal-breakdown {
                display: flex;
                justify-content: space-around;
                margin: 20px 0;
                padding: 16px;
                background: rgba(0, 0, 0, 0.02);
                border-radius: 8px;
                border: 1px solid rgba(0, 0, 0, 0.05);
            }
            
            .signal-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
            }
            
            .signal-dot {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                margin-bottom: 4px;
            }
            
            .signal-item.bullish .signal-dot {
                background: linear-gradient(135deg, #10b981, #34d399);
                box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
            }
            
            .signal-item.neutral .signal-dot {
                background: linear-gradient(135deg, #6b7280, #9ca3af);
                box-shadow: 0 2px 4px rgba(107, 114, 128, 0.3);
            }
            
            .signal-item.bearish .signal-dot {
                background: linear-gradient(135deg, #ef4444, #f87171);
                box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
            }
            
            .signal-label {
                font-size: 12px;
                color: #6b7280;
                font-weight: 500;
            }
            
            .signal-count {
                font-size: 16px;
                font-weight: bold;
                color: #1f2937;
                transition: all 0.3s ease;
            }
            
            .summary-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 16px;
                padding-top: 16px;
                border-top: 1px solid rgba(0, 0, 0, 0.08);
            }
            
            .indicator-count, .last-updated {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2px;
            }
            
            .count-label, .update-label {
                font-size: 11px;
                color: #9ca3af;
                font-weight: 500;
            }
            
            .count-value, .update-time {
                font-size: 13px;
                color: #374151;
                font-weight: 600;
            }
            
            /* 지표 목록 스크롤 스타일 */
            #indicators-list {
                max-height: 400px;
                overflow-y: auto;
                padding-right: 8px;
                margin-right: -8px;
            }
            
            /* 커스텀 스크롤바 */
            #indicators-list::-webkit-scrollbar {
                width: 6px;
            }
            
            #indicators-list::-webkit-scrollbar-track {
                background: #f1f5f9;
                border-radius: 3px;
            }
            
            #indicators-list::-webkit-scrollbar-thumb {
                background: linear-gradient(135deg, #cbd5e1, #94a3b8);
                border-radius: 3px;
                transition: background 0.3s ease;
            }
            
            #indicators-list::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(135deg, #94a3b8, #64748b);
            }
            
            /* Firefox 스크롤바 */
            #indicators-list {
                scrollbar-width: thin;
                scrollbar-color: #cbd5e1 #f1f5f9;
            }
            
            /* 스크롤 영역 페이드 효과 */
            .indicators-scroll-fade {
                position: relative;
            }
            
            .indicators-scroll-fade::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 10px;
                background: linear-gradient(to bottom, rgba(255,255,255,1), rgba(255,255,255,0));
                z-index: 1;
                pointer-events: none;
            }
            
            .indicators-scroll-fade::after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 10px;
                background: linear-gradient(to top, rgba(255,255,255,1), rgba(255,255,255,0));
                z-index: 1;
                pointer-events: none;
            }
            
            /* 지표 아이템 스타일 개선 */
            .indicator-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                margin-bottom: 8px;
                background: linear-gradient(135deg, #ffffff, #f8fafc);
                border: 1px solid rgba(0, 0, 0, 0.05);
                border-radius: 8px;
                transition: all 0.2s ease;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            }
            
            .indicator-item:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                border-color: rgba(59, 130, 246, 0.2);
            }
            
            .indicator-item:last-child {
                margin-bottom: 0;
            }
            
            .indicator-info {
                display: flex;
                flex-direction: column;
                gap: 2px;
                flex: 1;
            }
            
            .indicator-name {
                font-weight: 600;
                font-size: 14px;
                color: #1f2937;
            }
            
            .indicator-desc {
                font-size: 12px;
                color: #6b7280;
                opacity: 0.8;
            }
            
            .indicator-value {
                font-weight: 600;
                font-size: 13px;
                padding: 4px 8px;
                border-radius: 6px;
                white-space: nowrap;
                min-width: 80px;
                text-align: center;
                transition: all 0.2s ease;
            }
            
            /* 지표 상태별 색상 */
            .indicator-value.bullish {
                background: linear-gradient(135deg, #dcfce7, #bbf7d0);
                color: #059669;
                border: 1px solid #86efac;
            }
            
            .indicator-value.bearish {
                background: linear-gradient(135deg, #fef2f2, #fecaca);
                color: #dc2626;
                border: 1px solid #fca5a5;
            }
            
            .indicator-value.neutral {
                background: linear-gradient(135deg, #f9fafb, #f3f4f6);
                color: #6b7280;
                border: 1px solid #d1d5db;
            }
            
            .indicator-value.overbought {
                background: linear-gradient(135deg, #fffbeb, #fef3c7);
                color: #f59e0b;
                border: 1px solid #fcd34d;
            }
            
            .indicator-value.oversold {
                background: linear-gradient(135deg, #ecfdf5, #d1fae5);
                color: #10b981;
                border: 1px solid #a7f3d0;
            }
            
            .indicator-value.calculating {
                background: linear-gradient(135deg, #f3f4f6, #e5e7eb);
                color: #9ca3af;
                border: 1px solid #d1d5db;
                animation: pulse 2s ease-in-out infinite;
            }
            
            @keyframes pulse {
                0%, 100% {
                    opacity: 1;
                }
                50% {
                    opacity: 0.7;
                }
            }
        `;
        
        document.head.appendChild(style);
        this.stylesInjected = true;
    }

    showDefaultSummary() {
        const summaryContainer = document.getElementById('indicator-summary-container');

        if (summaryContainer) {
            summaryContainer.innerHTML = `
                <div class="technical-summary-card">
                <div class="summary-header">
                        <div class="summary-title">
                            <span class="title-icon">📊</span>
                            <span>종합 매매 신호</span>
                </div>
                        <div class="summary-status neutral">
                            <span class="status-icon">⏳</span>
                            <span class="status-text">분석 중</span>
                    </div>
                    </div>
                    
                    <div class="circular-gauge-container">
                        <div class="circular-gauge">
                            <svg class="gauge-svg" viewBox="0 0 200 120">
                                <path class="gauge-bg" 
                                      d="M 30 100 A 70 70 0 0 1 170 100" 
                                      fill="none" 
                                      stroke="#e5e7eb" 
                                      stroke-width="12" 
                                      stroke-linecap="round"/>
                                <path class="gauge-progress" 
                                      d="M 30 100 A 70 70 0 0 1 170 100"
                                      fill="none" 
                                      stroke="#9ca3af" 
                                      stroke-width="12" 
                                      stroke-linecap="round"
                                      stroke-dasharray="110 220"/>
                                <text x="100" y="75" text-anchor="middle" class="gauge-percentage" 
                                      fill="#6b7280" font-size="24" font-weight="bold">
                                    --
                                </text>
                                <text x="100" y="95" text-anchor="middle" class="gauge-label" 
                                      fill="#6b7280" font-size="12">
                                    대기 중
                                </text>
                            </svg>
                        </div>
                    </div>
                    
                    <div class="signal-breakdown">
                        <div class="signal-item bullish">
                            <div class="signal-dot"></div>
                            <span class="signal-label">매수</span>
                            <span class="signal-count">-</span>
                        </div>
                        <div class="signal-item neutral">
                            <div class="signal-dot"></div>
                            <span class="signal-label">중립</span>
                            <span class="signal-count">-</span>
                        </div>
                        <div class="signal-item bearish">
                            <div class="signal-dot"></div>
                            <span class="signal-label">매도</span>
                            <span class="signal-count">-</span>
                        </div>
                    </div>
                    
                    <div class="summary-footer">
                        <div class="indicator-count">
                            <span class="count-label">분석 지표</span>
                            <span class="count-value">대기 중</span>
                        </div>
                        <div class="last-updated">
                            <span class="update-label">상태</span>
                            <span class="update-time">로딩 중</span>
                        </div>
                    </div>
                </div>
            `;
            
            this.addSummaryStyles();
        }
    }

    async refresh() {
        // console.log('📊 Refreshing technical indicators...');
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

    // 새로운 기술 지표들
    calculateParabolicSAR(acceleration = 0.02, maximum = 0.2) {
        if (this.priceData.length < 2) return;
        
        const data = this.priceData;
        let isLong = data[1].close > data[0].close;
        let sar = isLong ? data[0].low : data[0].high;
        let af = acceleration;
        let ep = isLong ? data[0].high : data[0].low;
        
        for (let i = 1; i < data.length; i++) {
            const current = data[i];
            
            if (isLong) {
                if (current.low < sar) {
                    isLong = false;
                    sar = ep;
                    ep = current.low;
                    af = acceleration;
                } else {
                    if (current.high > ep) {
                        ep = current.high;
                        af = Math.min(af + acceleration, maximum);
                    }
                    sar = sar + af * (ep - sar);
                }
            } else {
                if (current.high > sar) {
                    isLong = true;
                    sar = ep;
                    ep = current.high;
                    af = acceleration;
                } else {
                    if (current.low < ep) {
                        ep = current.low;
                        af = Math.min(af + acceleration, maximum);
                    }
                    sar = sar + af * (ep - sar);
                }
            }
        }
        
        this.indicators.psar.value = sar;
        this.indicators.psar.status = isLong ? '상승' : '하락';
    }

    calculateADX(period = 14) {
        if (this.priceData.length < period * 2) return;
        
        const data = this.priceData;
        const tr = [];
        const dmPlus = [];
        const dmMinus = [];
        
        for (let i = 1; i < data.length; i++) {
            const highDiff = data[i].high - data[i-1].high;
            const lowDiff = data[i-1].low - data[i].low;
            
            tr.push(Math.max(
                data[i].high - data[i].low,
                Math.abs(data[i].high - data[i-1].close),
                Math.abs(data[i].low - data[i-1].close)
            ));
            
            if (highDiff > lowDiff && highDiff > 0) {
                dmPlus.push(highDiff);
                dmMinus.push(0);
            } else if (lowDiff > highDiff && lowDiff > 0) {
                dmPlus.push(0);
                dmMinus.push(lowDiff);
            } else {
                dmPlus.push(0);
                dmMinus.push(0);
            }
        }
        
        const atr = this.calculateEMA(tr, period);
        const diPlus = this.calculateEMA(dmPlus, period).map((val, i) => (val / atr[i]) * 100);
        const diMinus = this.calculateEMA(dmMinus, period).map((val, i) => (val / atr[i]) * 100);
        
        const dx = diPlus.map((plus, i) => {
            const minus = diMinus[i];
            return Math.abs(plus - minus) / (plus + minus) * 100;
        });
        
        const adx = this.calculateEMA(dx, period);
        const currentADX = adx[adx.length - 1];
        
        this.indicators.adx.value = currentADX;
        this.indicators.adx.status = currentADX > 25 ? '강한추세' : '약한추세';
    }

    calculateOBV() {
        if (this.priceData.length < 2) return;
        
        let obv = 0;
        for (let i = 1; i < this.priceData.length; i++) {
            if (this.priceData[i].close > this.priceData[i-1].close) {
                obv += this.priceData[i].volume;
            } else if (this.priceData[i].close < this.priceData[i-1].close) {
                obv -= this.priceData[i].volume;
            }
        }
        
        this.indicators.obv.value = obv;
        this.indicators.obv.status = obv > 0 ? '상승' : '하락';
    }

    calculateMFI(period = 14) {
        if (this.priceData.length < period) return;
        
        const data = this.priceData.slice(-period);
        let positiveFlow = 0;
        let negativeFlow = 0;
        
        for (let i = 1; i < data.length; i++) {
            const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
            const prevTypicalPrice = (data[i-1].high + data[i-1].low + data[i-1].close) / 3;
            
            if (typicalPrice > prevTypicalPrice) {
                positiveFlow += typicalPrice * data[i].volume;
            } else {
                negativeFlow += typicalPrice * data[i].volume;
            }
        }
        
        const mfi = 100 - (100 / (1 + positiveFlow / negativeFlow));
        
        this.indicators.mfi.value = mfi;
        this.indicators.mfi.status = mfi > 80 ? '과매수' : mfi < 20 ? '과매도' : '중립';
    }

    calculateROC(period = 10) {
        if (this.priceData.length < period + 1) return;
        
        const currentPrice = this.priceData[this.priceData.length - 1].close;
        const pastPrice = this.priceData[this.priceData.length - 1 - period].close;
        const roc = ((currentPrice - pastPrice) / pastPrice) * 100;
        
        this.indicators.roc.value = roc;
        this.indicators.roc.status = roc > 0 ? '상승' : '하락';
    }

    calculateKeltnerChannel(period = 20, multiplier = 2) {
        if (this.priceData.length < period) return;
        
        const data = this.priceData.slice(-period);
        const typicalPrices = data.map(d => (d.high + d.low + d.close) / 3);
        const middle = typicalPrices.reduce((a, b) => a + b, 0) / period;
        
        const atr = this.calculateATR(period);
        const upper = middle + (multiplier * atr);
        const lower = middle - (multiplier * atr);
        
        this.indicators.keltner = {
            upper: upper,
            middle: middle,
            lower: lower,
            status: this.getKeltnerStatus(this.priceData[this.priceData.length - 1].close, upper, lower)
        };
    }

    getKeltnerStatus(price, upper, lower) {
        if (price > upper) return '과매수';
        if (price < lower) return '과매도';
        return '중립';
    }

    calculateDonchianChannel(period = 20) {
        if (this.priceData.length < period) return;
        
        const data = this.priceData.slice(-period);
        const upper = Math.max(...data.map(d => d.high));
        const lower = Math.min(...data.map(d => d.low));
        const middle = (upper + lower) / 2;
        
        this.indicators.donchian = {
            upper: upper,
            middle: middle,
            lower: lower,
            status: this.getDonchianStatus(this.priceData[this.priceData.length - 1].close, upper, lower)
        };
    }

    getDonchianStatus(price, upper, lower) {
        if (price > upper) return '돌파';
        if (price < lower) return '이탈';
        return '중립';
    }

    calculateAroon(period = 25) {
        if (this.priceData.length < period) return;
        
        const data = this.priceData.slice(-period);
        let highestIndex = 0;
        let lowestIndex = 0;
        
        for (let i = 1; i < data.length; i++) {
            if (data[i].high > data[highestIndex].high) {
                highestIndex = i;
            }
            if (data[i].low < data[lowestIndex].low) {
                lowestIndex = i;
            }
        }
        
        const aroonUp = ((period - (period - 1 - highestIndex)) / period) * 100;
        const aroonDown = ((period - (period - 1 - lowestIndex)) / period) * 100;
        
        this.indicators.aroon = {
            up: aroonUp,
            down: aroonDown,
            status: this.getAroonStatus(aroonUp, aroonDown)
        };
    }

    getAroonStatus(up, down) {
        if (up > 70 && down < 30) return '강세';
        if (down > 70 && up < 30) return '약세';
        return '중립';
    }

    calculateUltimateOscillator(period1 = 7, period2 = 14, period3 = 28) {
        if (this.priceData.length < period3) return;
        
        const data = this.priceData;
        let bp1 = 0, tr1 = 0, bp2 = 0, tr2 = 0, bp3 = 0, tr3 = 0;
        
        for (let i = 1; i < data.length; i++) {
            const close = data[i].close;
            const prevClose = data[i-1].close;
            const high = data[i].high;
            const low = data[i].low;
            
            const bp = close - Math.min(low, prevClose);
            const tr = Math.max(high, prevClose) - Math.min(low, prevClose);
            
            if (i >= data.length - period1) {
                bp1 += bp;
                tr1 += tr;
            }
            if (i >= data.length - period2) {
                bp2 += bp;
                tr2 += tr;
            }
            if (i >= data.length - period3) {
                bp3 += bp;
                tr3 += tr;
            }
        }
        
        const avg7 = tr1 > 0 ? (bp1 / tr1) * 100 : 0;
        const avg14 = tr2 > 0 ? (bp2 / tr2) * 100 : 0;
        const avg28 = tr3 > 0 ? (bp3 / tr3) * 100 : 0;
        
        const ultimate = (4 * avg7 + 2 * avg14 + avg28) / 7;
        
        this.indicators.ultimate.value = ultimate;
        this.indicators.ultimate.status = ultimate > 70 ? '과매수' : ultimate < 30 ? '과매도' : '중립';
    }

    calculateChaikinMoneyFlow(period = 20) {
        if (this.priceData.length < period) return;
        
        const data = this.priceData.slice(-period);
        let mfm = 0;
        let mfv = 0;
        
        for (const candle of data) {
            const high = candle.high;
            const low = candle.low;
            const close = candle.close;
            const volume = candle.volume;
            
            if (high !== low) {
                const mf = ((close - low) - (high - close)) / (high - low);
                mfm += mf * volume;
                mfv += volume;
            }
        }
        
        const cmf = mfv > 0 ? mfm / mfv : 0;
        
        this.indicators.cmf.value = cmf;
        this.indicators.cmf.status = cmf > 0.25 ? '강세' : cmf < -0.25 ? '약세' : '중립';
    }

    changeTimeframe(newTimeframe) {
        if (this.currentTimeframe === newTimeframe) return;
        this.currentTimeframe = newTimeframe;
        
        // 빠른 로딩을 위해 즉시 데이터 초기화 및 로딩
        this.priceData = [];
        this.lastDataHash = '';
        this.lastSummaryHash = '';
        this.isUpdating = false;
        
        // 즉시 로딩 시작
        this.loadData();
    }

    render() {
        if (!this.container) return;

        // 1. 렌더링 전, 컨테이너를 완전히 비워서 겹침 현상 방지
        this.container.innerHTML = '';

        const containerWidth = this.container.clientWidth;
        
        // 2. 너비에 따라 적절한 레이아웃을 동적으로 생성
        if (containerWidth < 350) {
            // 폭이 좁을 때 (세로형 컴팩트 레이아웃)
            this.container.innerHTML = this.getCompactLayoutHTML();
        } else {
            // 폭이 넓을 때 (가로형 전체 레이아웃)
            this.container.innerHTML = this.getFullLayoutHTML();
        }

        // 3. 레이아웃이 그려진 후 필요한 스크립트 실행
        setTimeout(() => {
            this.updateSummary();
            this.updateDisplay();
        }, 100); // DOM 업데이트 후 실행
    }

    getFullLayoutHTML() {
        return `
            <div id="indicator-summary-container">
                <!-- 종합 매매 신호는 updateSummary()에서 동적으로 생성됨 -->
                </div>
            <div class="indicators-scroll-fade">
                <div id="indicators-list">
                ${this.getListHTML()}
                </div>
            </div>
        `;
    }

    getCompactLayoutHTML() {
        return `
            <div id="indicator-summary-container">
                <!-- 종합 매매 신호는 updateSummary()에서 동적으로 생성됨 -->
                    </div>
            <div class="indicators-scroll-fade">
                <div id="indicators-list">
                ${this.getListHTML(true)}
                </div>
            </div>
        `;
    }

    getListHTML(isCompact = false) {
        // 지표 데이터 구성
        const indicatorList = [
            { name: 'RSI', desc: '상대강도지수', value: this.indicators.rsi.value, status: this.indicators.rsi.status },
            { name: 'MACD', desc: '이동평균수렴확산', value: this.indicators.macd.histogram, status: this.indicators.macd.status },
            { name: 'Bollinger Bands', desc: '볼린저밴드', value: this.indicators.bb.middle, status: this.getBBStatus(this.priceData.length ? this.priceData[this.priceData.length-1].close : 0, this.indicators.bb.upper, this.indicators.bb.lower) },
            { name: 'Stochastic', desc: '스토캐스틱', value: this.indicators.stoch.k, status: this.indicators.stoch.status },
            { name: 'SMA', desc: '단순이동평균', value: this.indicators.sma.short, status: this.indicators.sma.status },
            { name: 'Ichimoku', desc: '일목균형표', value: this.indicators.ichimoku.spanA, status: this.indicators.ichimoku.status },
            { name: 'Volume Oscillator', desc: '거래량오실레이터', value: this.indicators.vo.value, status: this.indicators.vo.status },
            { name: 'Awesome Oscillator', desc: '어썸오실레이터', value: this.indicators.ao.value, status: this.indicators.ao.status },
            { name: 'Williams %R', desc: '윌리엄스 %R', value: this.indicators.williamsR.value, status: this.indicators.williamsR.status },
            { name: 'Stoch RSI', desc: '스토캐스틱 RSI', value: this.indicators.stochRsi.k, status: this.indicators.stochRsi.status },
            { name: 'CCI', desc: '상품채널지수', value: this.indicators.cci.value, status: this.indicators.cci.status },
            { name: 'Momentum', desc: '모멘텀', value: this.indicators.mom.value, status: this.indicators.mom.status },
            { name: 'Parabolic SAR', desc: '패러볼릭 SAR', value: this.indicators.psar.value, status: this.indicators.psar.status },
            { name: 'ADX', desc: '평균방향지수', value: this.indicators.adx.value, status: this.indicators.adx.status },
            { name: 'OBV', desc: '거래량균형지수', value: this.indicators.obv.value, status: this.indicators.obv.status },
            { name: 'MFI', desc: '자금흐름지수', value: this.indicators.mfi.value, status: this.indicators.mfi.status },
            { name: 'ROC', desc: '변화율', value: this.indicators.roc.value, status: this.indicators.roc.status },
            { name: 'Keltner Channel', desc: '켈트너 채널', value: this.indicators.keltner.middle, status: this.indicators.keltner.status },
            { name: 'Donchian Channel', desc: '돈치안 채널', value: this.indicators.donchian.middle, status: this.indicators.donchian.status },
            { name: 'Aroon', desc: '아룬 지표', value: this.indicators.aroon.up, status: this.indicators.aroon.status },
            { name: 'Ultimate Oscillator', desc: '궁극적 오실레이터', value: this.indicators.ultimate.value, status: this.indicators.ultimate.status },
            { name: 'Chaikin Money Flow', desc: '차이킨 자금흐름', value: this.indicators.cmf.value, status: this.indicators.cmf.status }
        ];

        return indicatorList.map(indicator => `
            <div class="indicator-item">
                <div class="indicator-info">
                    <span class="indicator-name">${indicator.name}</span>
                    ${!isCompact ? `<span class="indicator-desc">${indicator.desc}</span>` : ''}
                </div>
                <div class="indicator-value ${this.getIndicatorClass(indicator.status)}">
                    ${indicator.status} ${indicator.value ? `(${typeof indicator.value === 'number' ? indicator.value.toFixed(2) : indicator.value})` : ''}
                </div>
            </div>
        `).join('');
    }

    // 기존의 getSummaryHTML, getListHTML(isCompact) 통합 및 수정
    // renderCompact, renderFull, checkLayout 함수는 모두 제거
} 