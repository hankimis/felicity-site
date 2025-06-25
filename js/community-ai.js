// AI 분석 관련 기능 모듈
let aiAnalysisActive = false;
let volumeAlertActive = false;

// AI 기능 초기화
function initializeAIFeatures() {
    // AI 분석 버튼
    const aiAnalysisBtn = document.getElementById('ai-analysis-btn');
    const aiAnalysisModal = document.getElementById('ai-analysis-modal');
    const startAnalysisBtn = document.getElementById('start-ai-analysis');
    
    if (aiAnalysisBtn) {
        aiAnalysisBtn.addEventListener('click', () => {
            if (aiAnalysisModal) {
                aiAnalysisModal.style.display = 'flex';
                updateCoinInfo();
            }
        });
    }
    
    if (startAnalysisBtn) {
        startAnalysisBtn.addEventListener('click', startAIAnalysis);
    }
    
    // 거래량 알람 버튼
    const volumeAlertBtn = document.getElementById('volume-alert-btn');
    const volumeAlertModal = document.getElementById('volume-alert-modal');
    const saveVolumeAlertBtn = document.getElementById('save-volume-alert');
    
    if (volumeAlertBtn) {
        volumeAlertBtn.addEventListener('click', () => {
            if (volumeAlertModal) {
                volumeAlertModal.style.display = 'flex';
            }
        });
    }
    
    if (saveVolumeAlertBtn) {
        saveVolumeAlertBtn.addEventListener('click', saveVolumeAlert);
    }
    
    // 알림 설정 버튼
    const notificationSettingsBtn = document.getElementById('notification-settings-btn');
    const notificationSettingsModal = document.getElementById('notification-settings-modal');
    const saveNotificationSettingsBtn = document.getElementById('save-notification-settings');
    
    if (notificationSettingsBtn) {
        notificationSettingsBtn.addEventListener('click', () => {
            if (notificationSettingsModal) {
                notificationSettingsModal.style.display = 'flex';
            }
        });
    }
    
    if (saveNotificationSettingsBtn) {
        saveNotificationSettingsBtn.addEventListener('click', saveNotificationSettings);
    }
    
    // 분석 유형 선택
    const analysisCards = document.querySelectorAll('.analysis-card');
    analysisCards.forEach(card => {
        card.addEventListener('click', () => {
            analysisCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
        });
    });
    
    // AI 코인 선택
    const aiCoinSelect = document.getElementById('ai-coin-select');
    if (aiCoinSelect) {
        aiCoinSelect.addEventListener('change', updateCoinInfo);
    }
}

// 거래량 알람 저장
async function saveVolumeAlert() {
    try {
        const coin = document.getElementById('alert-coin-select').value;
        const threshold = parseFloat(document.getElementById('alert-volume-threshold').value);
        const browserAlert = document.getElementById('alert-browser').checked;
        const soundAlert = document.getElementById('alert-sound').checked;
        
        if (!coin || !threshold) {
            showNotification('모든 필드를 입력해주세요.', 'error');
            return;
        }
        
        // Firebase에 저장
        await waitForFirebase();
        const user = firebase.auth().currentUser;
        if (!user) {
            showNotification('로그인이 필요합니다.', 'error');
            return;
        }
        
        const alertData = {
            coin,
            threshold,
            browserAlert,
            soundAlert,
            active: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await firebase.firestore()
            .collection('users')
            .doc(user.uid)
            .collection('volumeAlerts')
            .doc(coin)
            .set(alertData);
        
        volumeAlertActive = true;
        showNotification('거래량 알람이 설정되었습니다.', 'success');
        document.getElementById('volume-alert-modal').style.display = 'none';
        
    } catch (error) {
        console.error('거래량 알람 저장 실패:', error);
        showNotification('알람 설정에 실패했습니다.', 'error');
    }
}

// 시장 데이터 가져오기
async function getMarketData(symbol) {
    try {
        const [klinesResponse, tickerResponse] = await Promise.all([
            fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=200`),
            fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
        ]);
        
        const klines = await klinesResponse.json();
        const ticker = await tickerResponse.json();
        
        const marketData = {
            symbol,
            currentPrice: parseFloat(ticker.lastPrice),
            priceChange24h: parseFloat(ticker.priceChangePercent),
            volume24h: parseFloat(ticker.volume),
            high24h: parseFloat(ticker.highPrice),
            low24h: parseFloat(ticker.lowPrice),
            klines: klines.map(k => ({
                time: k[0],
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5])
            }))
        };
        
        return marketData;
    } catch (error) {
        console.error('시장 데이터 가져오기 실패:', error);
        throw error;
    }
}

// 기술적 지표 계산 함수들
function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return null;
    
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    for (let i = period + 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) {
            avgGain = (avgGain * (period - 1) + change) / period;
            avgLoss = (avgLoss * (period - 1)) / period;
        } else {
            avgGain = (avgGain * (period - 1)) / period;
            avgLoss = (avgLoss * (period - 1) - change) / period;
        }
    }
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function calculateBollingerBands(prices, period = 20, multiplier = 2) {
    if (prices.length < period) return null;
    
    const sma = prices.slice(-period).reduce((a, b) => a + b, 0) / period;
    const variance = prices.slice(-period).reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    return {
        upper: sma + (multiplier * stdDev),
        middle: sma,
        lower: sma - (multiplier * stdDev)
    };
}

function calculateSMA(prices, period) {
    if (prices.length < period) return null;
    return prices.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function calculateEMA(prices, period) {
    if (prices.length < period) return null;
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
        ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
}

function calculateStandardDeviation(prices) {
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
    return Math.sqrt(variance);
}

function calculateStochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
    if (closes.length < kPeriod) return null;
    
    const kValues = [];
    for (let i = kPeriod - 1; i < closes.length; i++) {
        const highestHigh = Math.max(...highs.slice(i - kPeriod + 1, i + 1));
        const lowestLow = Math.min(...lows.slice(i - kPeriod + 1, i + 1));
        const k = ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100;
        kValues.push(k);
    }
    
    const k = kValues[kValues.length - 1];
    const d = kValues.slice(-dPeriod).reduce((a, b) => a + b, 0) / dPeriod;
    
    return { k, d };
}

function calculateWilliamsR(highs, lows, closes, period = 14) {
    if (closes.length < period) return null;
    
    const highestHigh = Math.max(...highs.slice(-period));
    const lowestLow = Math.min(...lows.slice(-period));
    const currentClose = closes[closes.length - 1];
    
    return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
}

function calculateATR(highs, lows, closes, period = 14) {
    if (closes.length < period + 1) return null;
    
    const trueRanges = [];
    for (let i = 1; i < closes.length; i++) {
        const highLow = highs[i] - lows[i];
        const highClose = Math.abs(highs[i] - closes[i - 1]);
        const lowClose = Math.abs(lows[i] - closes[i - 1]);
        trueRanges.push(Math.max(highLow, highClose, lowClose));
    }
    
    return trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
}

// 패턴 감지 함수들
function detectPatterns(highs, lows, closes) {
    const patterns = [];
    
    // 이중 바닥 패턴
    if (closes.length >= 20) {
        const recentLows = lows.slice(-20);
        const peaks = findPeaks(recentLows.map((low, i) => ({ value: low, index: i })));
        
        if (peaks.length >= 2) {
            const lastTwoPeaks = peaks.slice(-2);
            const priceDiff = Math.abs(lastTwoPeaks[0].value - lastTwoPeaks[1].value) / lastTwoPeaks[0].value;
            
            if (priceDiff < 0.02 && lastTwoPeaks[1].index - lastTwoPeaks[0].index >= 5) {
                patterns.push({
                    name: '이중 바닥',
                    type: 'bullish',
                    confidence: 75,
                    description: '지지선에서 반등 가능성 높음'
                });
            }
        }
    }
    
    // 이중 천정 패턴
    if (closes.length >= 20) {
        const recentHighs = highs.slice(-20);
        const troughs = findTroughs(recentHighs.map((high, i) => ({ value: high, index: i })));
        
        if (troughs.length >= 2) {
            const lastTwoTroughs = troughs.slice(-2);
            const priceDiff = Math.abs(lastTwoTroughs[0].value - lastTwoTroughs[1].value) / lastTwoTroughs[0].value;
            
            if (priceDiff < 0.02 && lastTwoTroughs[1].index - lastTwoTroughs[0].index >= 5) {
                patterns.push({
                    name: '이중 천정',
                    type: 'bearish',
                    confidence: 75,
                    description: '저항선에서 하락 가능성 높음'
                });
            }
        }
    }
    
    return patterns;
}

function findPeaks(data, minDistance = 3) {
    const peaks = [];
    for (let i = 1; i < data.length - 1; i++) {
        if (data[i].value < data[i - 1].value && data[i].value < data[i + 1].value) {
            if (peaks.length === 0 || i - peaks[peaks.length - 1].index >= minDistance) {
                peaks.push(data[i]);
            }
        }
    }
    return peaks;
}

function findTroughs(data, minDistance = 3) {
    const troughs = [];
    for (let i = 1; i < data.length - 1; i++) {
        if (data[i].value > data[i - 1].value && data[i].value > data[i + 1].value) {
            if (troughs.length === 0 || i - troughs[troughs.length - 1].index >= minDistance) {
                troughs.push(data[i]);
            }
        }
    }
    return troughs;
}

// 신호 분석
function performSignalAnalysis(rsi, macd, bollinger, stochastic, williamsR, sma20, sma50, currentPrice, atr) {
    const signals = {
        bullish: 0,
        bearish: 0,
        neutral: 0,
        details: []
    };
    
    // RSI 분석
    if (rsi !== null) {
        if (rsi < 30) {
            signals.bullish++;
            signals.details.push({ indicator: 'RSI', signal: '과매도', value: rsi.toFixed(2) });
        } else if (rsi > 70) {
            signals.bearish++;
            signals.details.push({ indicator: 'RSI', signal: '과매수', value: rsi.toFixed(2) });
        } else {
            signals.neutral++;
        }
    }
    
    // MACD 분석
    if (macd && macd.histogram !== null) {
        if (macd.histogram > 0 && macd.histogram > macd.signal) {
            signals.bullish++;
            signals.details.push({ indicator: 'MACD', signal: '상승 신호', value: macd.histogram.toFixed(4) });
        } else if (macd.histogram < 0 && macd.histogram < macd.signal) {
            signals.bearish++;
            signals.details.push({ indicator: 'MACD', signal: '하락 신호', value: macd.histogram.toFixed(4) });
        } else {
            signals.neutral++;
        }
    }
    
    // 볼린저 밴드 분석
    if (bollinger) {
        if (currentPrice < bollinger.lower) {
            signals.bullish++;
            signals.details.push({ indicator: '볼린저 밴드', signal: '하단 돌파', value: '반등 기대' });
        } else if (currentPrice > bollinger.upper) {
            signals.bearish++;
            signals.details.push({ indicator: '볼린저 밴드', signal: '상단 돌파', value: '조정 기대' });
        } else {
            signals.neutral++;
        }
    }
    
    // 스토캐스틱 분석
    if (stochastic) {
        if (stochastic.k < 20) {
            signals.bullish++;
            signals.details.push({ indicator: '스토캐스틱', signal: '과매도', value: `K: ${stochastic.k.toFixed(2)}` });
        } else if (stochastic.k > 80) {
            signals.bearish++;
            signals.details.push({ indicator: '스토캐스틱', signal: '과매수', value: `K: ${stochastic.k.toFixed(2)}` });
        } else {
            signals.neutral++;
        }
    }
    
    // 윌리엄스 %R 분석
    if (williamsR !== null) {
        if (williamsR < -80) {
            signals.bullish++;
            signals.details.push({ indicator: 'Williams %R', signal: '과매도', value: williamsR.toFixed(2) });
        } else if (williamsR > -20) {
            signals.bearish++;
            signals.details.push({ indicator: 'Williams %R', signal: '과매수', value: williamsR.toFixed(2) });
        } else {
            signals.neutral++;
        }
    }
    
    // 이동평균 분석
    if (sma20 && sma50) {
        if (currentPrice > sma20 && sma20 > sma50) {
            signals.bullish++;
            signals.details.push({ indicator: '이동평균', signal: '상승 추세', value: '골든크로스' });
        } else if (currentPrice < sma20 && sma20 < sma50) {
            signals.bearish++;
            signals.details.push({ indicator: '이동평균', signal: '하락 추세', value: '데드크로스' });
        } else {
            signals.neutral++;
        }
    }
    
    return signals;
}

// 전체 신호 결정
function determineOverallSignal(signalAnalysis) {
    const total = signalAnalysis.bullish + signalAnalysis.bearish + signalAnalysis.neutral;
    const bullishRatio = signalAnalysis.bullish / total;
    const bearishRatio = signalAnalysis.bearish / total;
    
    if (bullishRatio > 0.5) return 'bullish';
    if (bearishRatio > 0.5) return 'bearish';
    return 'neutral';
}

// 거래 추천 계산
function calculateTradingRecommendation(signalAnalysis, currentPrice, support, resistance, atr) {
    const overallSignal = determineOverallSignal(signalAnalysis);
    
    let recommendation = {
        action: '관망',
        confidence: 50,
        entry: null,
        stopLoss: null,
        target: null,
        risk: '중간'
    };
    
    if (overallSignal === 'bullish' && support) {
        recommendation.action = '매수';
        recommendation.confidence = Math.min(85, 60 + signalAnalysis.bullish * 10);
        recommendation.entry = currentPrice;
        recommendation.stopLoss = support * 0.98;
        recommendation.target = currentPrice + (atr * 2);
        recommendation.risk = signalAnalysis.bullish > 3 ? '낮음' : '중간';
    } else if (overallSignal === 'bearish' && resistance) {
        recommendation.action = '매도';
        recommendation.confidence = Math.min(85, 60 + signalAnalysis.bearish * 10);
        recommendation.entry = currentPrice;
        recommendation.stopLoss = resistance * 1.02;
        recommendation.target = currentPrice - (atr * 2);
        recommendation.risk = signalAnalysis.bearish > 3 ? '낮음' : '중간';
    }
    
    return recommendation;
}

// 분석 신뢰도 계산
function calculateAnalysisConfidence(signalAnalysis, patterns) {
    let confidence = 50;
    
    // 신호 강도에 따른 가중치
    const totalSignals = signalAnalysis.bullish + signalAnalysis.bearish + signalAnalysis.neutral;
    const strongSignals = Math.max(signalAnalysis.bullish, signalAnalysis.bearish);
    confidence += (strongSignals / totalSignals) * 20;
    
    // 패턴 개수에 따른 가중치
    if (patterns.length > 0) {
        confidence += Math.min(20, patterns.length * 5);
    }
    
    return Math.min(95, confidence);
}

// 코인 정보 업데이트
async function updateCoinInfo() {
    const coinSelect = document.getElementById('ai-coin-select');
    const coinInfo = document.getElementById('coin-info');
    
    if (!coinSelect || !coinInfo) return;
    
    try {
        const symbol = coinSelect.value;
        const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
        const data = await response.json();
        
        const price = parseFloat(data.lastPrice);
        const changePercent = parseFloat(data.priceChangePercent);
        
        coinInfo.innerHTML = `
            <div class="coin-price">$${price.toFixed(2)}</div>
            <div class="coin-change ${changePercent >= 0 ? 'positive' : 'negative'}">${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%</div>
        `;
    } catch (error) {
        console.error('코인 정보 업데이트 실패:', error);
    }
}

// AI 분석 시작
async function startAIAnalysis() {
    const coinSelect = document.getElementById('ai-coin-select');
    const activeCard = document.querySelector('.analysis-card.active');
    const resultContainer = document.getElementById('ai-analysis-result');
    const loadingElement = document.getElementById('ai-loading');
    const resultContent = document.getElementById('ai-result-content');
    
    if (!coinSelect || !activeCard || !resultContainer) return;
    
    const symbol = coinSelect.value;
    const analysisType = activeCard.dataset.type;
    
    try {
        // 결과 컨테이너 표시
        resultContainer.style.display = 'block';
        loadingElement.style.display = 'block';
        resultContent.style.display = 'none';
        
        // 시장 데이터 가져오기
        const marketData = await getMarketData(symbol);
        
        // 분석 수행
        const result = await performAdvancedAnalysis(symbol, analysisType);
        
        // 결과 표시
        displayAIAnalysisResult(result, analysisType);
        
        // 로딩 숨기기
        loadingElement.style.display = 'none';
        resultContent.style.display = 'block';
        
    } catch (error) {
        console.error('AI 분석 실패:', error);
        loadingElement.style.display = 'none';
        resultContent.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>분석 실패</h4>
                <p>분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.</p>
                <button class="retry-btn" onclick="startAIAnalysis()">다시 시도</button>
            </div>
        `;
    }
}

// 고급 분석 수행
async function performAdvancedAnalysis(symbol, analysisType) {
    const marketData = await getMarketData(symbol);
    const { klines } = marketData;
    
    const closes = klines.map(k => k.close);
    const highs = klines.map(k => k.high);
    const lows = klines.map(k => k.low);
    const volumes = klines.map(k => k.volume);
    
    const currentPrice = closes[closes.length - 1];
    
    // 기술적 지표 계산
    const rsi = calculateRSI(closes);
    const sma20 = calculateSMA(closes, 20);
    const sma50 = calculateSMA(closes, 50);
    const bollinger = calculateBollingerBands(closes);
    const stochastic = calculateStochastic(highs, lows, closes);
    const williamsR = calculateWilliamsR(highs, lows, closes);
    const atr = calculateATR(highs, lows, closes);
    
    // MACD 계산
    const macd = calculateMACD(closes);
    
    // 패턴 감지
    const patterns = detectPatterns(highs, lows, closes);
    
    // 신호 분석
    const signalAnalysis = performSignalAnalysis(rsi, macd, bollinger, stochastic, williamsR, sma20, sma50, currentPrice, atr);
    
    // 지지/저항 계산
    const support = calculateAccurateSupport(lows, currentPrice);
    const resistance = calculateAccurateResistance(highs, currentPrice);
    
    // 거래 추천
    const recommendation = calculateTradingRecommendation(signalAnalysis, currentPrice, support, resistance, atr);
    
    // 분석 신뢰도
    const confidence = calculateAnalysisConfidence(signalAnalysis, patterns);
    
    return {
        symbol,
        currentPrice,
        signalAnalysis,
        patterns,
        recommendation,
        confidence,
        indicators: {
            rsi, sma20, sma50, bollinger, stochastic, williamsR, atr, macd
        },
        support,
        resistance
    };
}

// 정확한 지지선 계산
function calculateAccurateSupport(lows, currentPrice) {
    const recentLows = lows.slice(-20);
    const sortedLows = [...recentLows].sort((a, b) => a - b);
    const potentialSupport = sortedLows[Math.floor(sortedLows.length * 0.2)];
    
    return potentialSupport < currentPrice ? potentialSupport : null;
}

// 정확한 저항선 계산
function calculateAccurateResistance(highs, currentPrice) {
    const recentHighs = highs.slice(-20);
    const sortedHighs = [...recentHighs].sort((a, b) => b - a);
    const potentialResistance = sortedHighs[Math.floor(sortedHighs.length * 0.2)];
    
    return potentialResistance > currentPrice ? potentialResistance : null;
}

// MACD 계산
function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const calculateEMA = (data, period) => {
        const multiplier = 2 / (period + 1);
        let ema = data[0];
        
        for (let i = 1; i < data.length; i++) {
            ema = (data[i] * multiplier) + (ema * (1 - multiplier));
        }
        
        return ema;
    };
    
    const fastEMA = calculateEMA(prices, fastPeriod);
    const slowEMA = calculateEMA(prices, slowPeriod);
    const macdLine = fastEMA - slowEMA;
    const signalLine = calculateEMA([macdLine], signalPeriod);
    const histogram = macdLine - signalLine;
    
    return {
        macd: macdLine,
        signal: signalLine,
        histogram: histogram
    };
}

// 알림 설정 저장
async function saveNotificationSettings() {
    try {
        const volumeAlert = document.getElementById('notify-volume').checked;
        const priceAlert = document.getElementById('notify-price').checked;
        const aiAlert = document.getElementById('notify-ai').checked;
        const frequency = document.getElementById('notification-frequency').value;
        
        // Firebase에 저장
        await waitForFirebase();
        const user = firebase.auth().currentUser;
        if (!user) {
            showNotification('로그인이 필요합니다.', 'error');
            return;
        }
        
        const settings = {
            volumeAlert,
            priceAlert,
            aiAlert,
            frequency,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await firebase.firestore()
            .collection('users')
            .doc(user.uid)
            .update({ notificationSettings: settings });
        
        showNotification('알림 설정이 저장되었습니다.', 'success');
        document.getElementById('notification-settings-modal').style.display = 'none';
        
    } catch (error) {
        console.error('알림 설정 저장 실패:', error);
        showNotification('설정 저장에 실패했습니다.', 'error');
    }
}

// 알림 표시
function showNotification(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;
    toast.innerHTML = `
        <div class="notification-title">알림</div>
        <div class="notification-message">${message}</div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

// Firebase 초기화 대기
function waitForFirebase() {
    return new Promise((resolve) => {
        const checkFirebase = () => {
            if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
                resolve();
            } else {
                setTimeout(checkFirebase, 100);
            }
        };
        checkFirebase();
    });
}

// AI 분석 결과 표시
function displayAIAnalysisResult(result, analysisType) {
    const resultContent = document.getElementById('ai-result-content');
    if (!resultContent) return;
    
    const timestamp = document.getElementById('analysis-timestamp');
    if (timestamp) {
        timestamp.textContent = new Date().toLocaleString('ko-KR');
    }
    
    let html = '';
    
    if (analysisType === 'pattern') {
        html = generatePatternAnalysisHTML(result);
    } else if (analysisType === 'prediction') {
        html = generatePredictionAnalysisHTML(result);
    } else if (analysisType === 'sentiment') {
        html = generateSentimentAnalysisHTML(result);
    } else if (analysisType === 'recommendation') {
        html = generateRecommendationAnalysisHTML(result);
    }
    
    resultContent.innerHTML = html;
}

// 패턴 분석 HTML 생성
function generatePatternAnalysisHTML(result) {
    const { symbol, currentPrice, signalAnalysis, patterns, recommendation, confidence, indicators, support, resistance } = result;
    
    return `
        <div class="analysis-summary">
            <div class="summary-header">
                <h3>${symbol} 패턴 분석 결과</h3>
                <div class="overall-signal ${recommendation.action === '매수' ? 'bullish' : recommendation.action === '매도' ? 'bearish' : 'neutral'}">
                    ${recommendation.action}
                </div>
            </div>
            
            <div class="signal-counts">
                <div class="signal-count">
                    <span class="count">${signalAnalysis.bullish}</span>
                    <span class="label">강세 신호</span>
                </div>
                <div class="signal-count">
                    <span class="count">${signalAnalysis.bearish}</span>
                    <span class="label">약세 신호</span>
                </div>
                <div class="signal-count">
                    <span class="count">${signalAnalysis.neutral}</span>
                    <span class="label">중립 신호</span>
                </div>
            </div>
            
            <div class="confidence-bar">
                <div class="confidence-fill" style="width: ${confidence}%"></div>
            </div>
            <div style="text-align: center; margin-top: 8px; font-size: 12px;">신뢰도: ${confidence}%</div>
        </div>
        
        <div class="analysis-grid">
            <div class="analysis-card-result">
                <div class="card-header">
                    <h4><i class="fas fa-chart-line"></i> 기술적 지표</h4>
                    <span class="confidence-badge">실시간</span>
                </div>
                <div class="indicators-grid">
                    ${generateIndicatorsHTML(indicators)}
                </div>
            </div>
            
            <div class="analysis-card-result">
                <div class="card-header">
                    <h4><i class="fas fa-shapes"></i> 감지된 패턴</h4>
                    <span class="confidence-badge">${patterns.length}개</span>
                </div>
                <div class="pattern-list">
                    ${patterns.length > 0 ? patterns.map(pattern => `
                        <div class="pattern-item ${pattern.type}">
                            <div>
                                <strong>${pattern.name}</strong>
                                <span class="pattern-confidence">${pattern.confidence}%</span>
                            </div>
                            <small>${pattern.description || ''}</small>
                        </div>
                    `).join('') : '<p>감지된 패턴이 없습니다.</p>'}
                </div>
            </div>
            
            <div class="analysis-card-result">
                <div class="card-header">
                    <h4><i class="fas fa-target"></i> 지지/저항</h4>
                    <span class="confidence-badge">핵심</span>
                </div>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">현재가</span>
                        <span class="detail-value">$${currentPrice.toFixed(2)}</span>
                    </div>
                    ${support ? `<div class="detail-item">
                        <span class="detail-label">지지선</span>
                        <span class="detail-value">$${support.toFixed(2)}</span>
                    </div>` : ''}
                    ${resistance ? `<div class="detail-item">
                        <span class="detail-label">저항선</span>
                        <span class="detail-value">$${resistance.toFixed(2)}</span>
                    </div>` : ''}
                </div>
            </div>
            
            <div class="analysis-card-result full-width">
                <div class="card-header">
                    <h4><i class="fas fa-lightbulb"></i> 거래 추천</h4>
                    <span class="confidence-badge">${recommendation.confidence}%</span>
                </div>
                <div class="trading-signals">
                    <div class="signal-item">
                        <span class="signal-label">행동</span>
                        <span class="signal-value ${recommendation.action === '매수' ? 'direction-상승' : recommendation.action === '매도' ? 'direction-하락' : 'direction-횡보'}">${recommendation.action}</span>
                    </div>
                    <div class="signal-item">
                        <span class="signal-label">신뢰도</span>
                        <span class="signal-value">${recommendation.confidence}%</span>
                    </div>
                    <div class="signal-item">
                        <span class="signal-label">리스크</span>
                        <span class="signal-value risk-${recommendation.risk === '낮음' ? '낮음' : recommendation.risk === '높음' ? '높음' : '중간'}">${recommendation.risk}</span>
                    </div>
                    ${recommendation.entry ? `<div class="signal-item">
                        <span class="signal-label">진입가</span>
                        <span class="signal-value">$${recommendation.entry.toFixed(2)}</span>
                    </div>` : ''}
                    ${recommendation.stopLoss ? `<div class="signal-item">
                        <span class="signal-label">손절가</span>
                        <span class="signal-value">$${recommendation.stopLoss.toFixed(2)}</span>
                    </div>` : ''}
                    ${recommendation.target ? `<div class="signal-item">
                        <span class="signal-label">목표가</span>
                        <span class="signal-value">$${recommendation.target.toFixed(2)}</span>
                    </div>` : ''}
                </div>
            </div>
        </div>
    `;
}

// 지표 HTML 생성
function generateIndicatorsHTML(indicators) {
    const items = [];
    
    if (indicators.rsi !== null) {
        const rsiSignal = indicators.rsi < 30 ? '강세' : indicators.rsi > 70 ? '약세' : '중립';
        items.push(`
            <div class="indicator-item">
                <span class="indicator-name">RSI</span>
                <span class="indicator-value">${indicators.rsi.toFixed(2)}</span>
                <span class="indicator-signal ${rsiSignal}">${rsiSignal}</span>
            </div>
        `);
    }
    
    if (indicators.sma20 && indicators.sma50) {
        const maSignal = indicators.sma20 > indicators.sma50 ? '강세' : '약세';
        items.push(`
            <div class="indicator-item">
                <span class="indicator-name">이동평균</span>
                <span class="indicator-value">SMA20: ${indicators.sma20.toFixed(2)}</span>
                <span class="indicator-signal ${maSignal}">${maSignal}</span>
            </div>
        `);
    }
    
    if (indicators.bollinger) {
        items.push(`
            <div class="indicator-item">
                <span class="indicator-name">볼린저 밴드</span>
                <span class="indicator-value">상단: ${indicators.bollinger.upper.toFixed(2)}</span>
                <span class="indicator-signal">중립</span>
            </div>
        `);
    }
    
    if (indicators.stochastic) {
        const stochSignal = indicators.stochastic.k < 20 ? '강세' : indicators.stochastic.k > 80 ? '약세' : '중립';
        items.push(`
            <div class="indicator-item">
                <span class="indicator-name">스토캐스틱</span>
                <span class="indicator-value">K: ${indicators.stochastic.k.toFixed(2)}</span>
                <span class="indicator-signal ${stochSignal}">${stochSignal}</span>
            </div>
        `);
    }
    
    return items.join('') || '<p>지표 데이터를 불러올 수 없습니다.</p>';
}

// 예측 분석 HTML 생성
function generatePredictionAnalysisHTML(result) {
    return `
        <div class="analysis-summary">
            <div class="summary-header">
                <h3>${result.symbol} 가격 예측</h3>
                <div class="prediction-trend ${result.recommendation.action === '매수' ? 'bullish' : 'bearish'}">
                    ${result.recommendation.action === '매수' ? '상승 예상' : '하락 예상'}
                </div>
            </div>
            <p>AI 모델 기반 단기 가격 예측 결과입니다.</p>
        </div>
        <div class="analysis-card-result">
            <h4>예측 결과</h4>
            <p>예측 기능은 현재 개발 중입니다.</p>
        </div>
    `;
}

// 감정 분석 HTML 생성
function generateSentimentAnalysisHTML(result) {
    return `
        <div class="analysis-summary">
            <div class="summary-header">
                <h3>${result.symbol} 시장 감정</h3>
                <div class="sentiment-score">중립적</div>
            </div>
            <p>뉴스 및 소셜 미디어 감정 분석 결과입니다.</p>
        </div>
        <div class="analysis-card-result">
            <h4>감정 분석</h4>
            <p>감정 분석 기능은 현재 개발 중입니다.</p>
        </div>
    `;
}

// 추천 분석 HTML 생성
function generateRecommendationAnalysisHTML(result) {
    return `
        <div class="analysis-summary">
            <div class="summary-header">
                <h3>${result.symbol} 투자 추천</h3>
                <div class="recommendation-grade ${result.recommendation.action === '매수' ? 'buy' : result.recommendation.action === '매도' ? 'sell' : 'hold'}">
                    ${result.recommendation.action}
                </div>
            </div>
            <p>종합적인 분석을 통한 투자 추천입니다.</p>
        </div>
        <div class="analysis-card-result">
            <h4>추천 상세</h4>
            <p>추천 기능은 현재 개발 중입니다.</p>
        </div>
    `;
}

// 모듈 내보내기
window.CommunityAI = {
    initializeAIFeatures,
    startAIAnalysis,
    updateCoinInfo,
    showNotification,
    displayAIAnalysisResult
}; 