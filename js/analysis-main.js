// Analysis Dashboard Main Controller
// Analysis 모듈들 import
import { WhaleTracker } from './analysis/whale-tracker.js';
import { TechnicalIndicators } from './analysis/technical-indicators.js';
import { SentimentAnalysis } from './analysis/sentiment-analysis.js';
import { LongShortTracker } from './analysis/longshort-tracker.js';
import { OrderbookTracker } from './analysis/orderbook-tracker.js';
import { MarketHeatmap } from './analysis/market-heatmap.js';
import { LiquidationMap } from './analysis/liquidation-map.js';
import { RealtimeTrades } from './analysis/realtime-trades.js';
import { AnalysisUtils } from './analysis-utils.js';

// AnalysisConfig를 전역에서 가져오기
const AnalysisConfig = window.AnalysisConfig;

class AnalysisDashboard {
    constructor() {
        this.isTracking = false;
        this.intervals = {};
        this.modules = {};
        this.grid = null; // GridStack instance
        this.isEditMode = false;
        this.data = {
            whales: [],
            trades: [],
            indicators: {},
            sentiment: { value: 50, label: '중립' },
            longshort: { long: 50, short: 50, ratio: 1.0, status: 'neutral' },
            orderbook: { asks: [], bids: [] },
            heatmap: [],
            liquidations: []
        };
        
        this.init();
    }
    
    async init() {
        console.log('🚀 Initializing Analysis Dashboard...');
        
        await this.initializeModules();
        this.setupEventListeners();
        
        // GridStack 초기화
        this.initializeGridStack();
        
        this.loadInitialData();
        this.startTracking();
        
        console.log('✅ Analysis Dashboard initialized');
    }

    async initializeModules() {
        try {
            // 각 모듈 초기화
            this.modules.whaleTracker = new WhaleTracker({
                symbol: 'BTCUSDT',
                largeTradeThreshold: 500000,
                enableSound: false
            });

            this.modules.technicalIndicators = new TechnicalIndicators({
                symbol: 'BTCUSDT',
                timeframe: '1h'
            });

            this.modules.sentimentAnalysis = new SentimentAnalysis({
                symbol: 'BTCUSDT'
            });

            this.modules.longShortTracker = new LongShortTracker({
                symbol: 'BTCUSDT'
            });

            this.modules.orderbookTracker = new OrderbookTracker({
                symbol: 'BTCUSDT'
            });

            this.modules.marketHeatmap = new MarketHeatmap({
                symbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT']
            });

            this.modules.liquidationMap = new LiquidationMap({
                symbol: 'BTCUSDT'
            });

            this.modules.realtimeTrades = new RealtimeTrades({
                symbol: 'BTCUSDT'
            });

            console.log('✅ All analysis modules initialized');
        } catch (error) {
            console.error('❌ Error initializing modules:', error);
        }
    }
    
    setupEventListeners() {
        // Control buttons
        document.getElementById('refresh-all')?.addEventListener('click', () => {
            this.refreshAll();
        });
        
        document.getElementById('settings-btn')?.addEventListener('click', () => {
            this.openSettings();
        });
        
        // Symbol selectors
        document.getElementById('whale-symbol')?.addEventListener('change', (e) => {
            this.updateSymbol('whale', e.target.value);
        });
        
        document.getElementById('realtime-symbol')?.addEventListener('change', (e) => {
            this.updateSymbol('realtime', e.target.value);
        });
        
        document.getElementById('longshort-symbol')?.addEventListener('change', (e) => {
            this.updateSymbol('longshort', e.target.value);
        });
        
        document.getElementById('orderbook-symbol')?.addEventListener('change', (e) => {
            this.updateSymbol('orderbook', e.target.value);
        });
        
        // Timeframe selectors for Technical Indicators
        const timeframeContainer = document.getElementById('indicator-timeframe-selector');
        if (timeframeContainer && this.modules.technicalIndicators) {
            const timeframes = AnalysisConfig.timeframes || ['5m', '15m', '1h', '4h', '1d'];
            timeframeContainer.innerHTML = timeframes.map((tf, index) =>
                `<button class="timeframe-btn ${index === 2 ? 'active' : ''}" data-timeframe="${tf}">${tf}</button>`
            ).join('');

            timeframeContainer.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    timeframeContainer.querySelectorAll('.timeframe-btn').forEach(btn => btn.classList.remove('active'));
                    e.target.classList.add('active');
                    const newTimeframe = e.target.dataset.timeframe;
                    this.modules.technicalIndicators.changeTimeframe(newTimeframe);
                }
            });
        }
        
        // Settings modal
        this.setupSettingsModal();
    }
    
    setupSettingsModal() {
        const modal = document.getElementById('settings-modal');
        const closeBtn = modal?.querySelector('.modal-close');
        const cancelBtn = document.getElementById('cancel-settings');
        const saveBtn = document.getElementById('save-settings');
        
        closeBtn?.addEventListener('click', () => this.closeSettings());
        cancelBtn?.addEventListener('click', () => this.closeSettings());
        saveBtn?.addEventListener('click', () => this.saveSettings());
        
        // Close on outside click
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) this.closeSettings();
        });
    }
    
    async loadInitialData() {
        console.log('📊 Loading initial data...');
        
        try {
            // 각 모듈에서 데이터 로드
            if (this.modules.whaleTracker) {
                await this.modules.whaleTracker.start();
            }
            
            if (this.modules.technicalIndicators) {
                await this.modules.technicalIndicators.start();
            }
            
            if (this.modules.sentimentAnalysis) {
                await this.modules.sentimentAnalysis.start();
            }
            
            if (this.modules.longShortTracker) {
                await this.modules.longShortTracker.start();
            }
            
            if (this.modules.orderbookTracker) {
                await this.modules.orderbookTracker.start();
            }
            
            if (this.modules.marketHeatmap) {
                await this.modules.marketHeatmap.start();
            }
            
            if (this.modules.liquidationMap) {
                await this.modules.liquidationMap.start();
            }
            
            if (this.modules.realtimeTrades) {
                await this.modules.realtimeTrades.start();
            }
            
            console.log('✅ Initial data loaded');
        } catch (error) {
            console.error('❌ Error loading initial data:', error);
        }
    }
    
    startTracking() {
        if (this.isTracking) return;
        
        this.isTracking = true;
        this.updateStatus('active', '실시간 추적 중');
        
        // 각 모듈의 데이터를 주기적으로 업데이트
        this.intervals.dataUpdate = setInterval(() => {
            this.updateAllDisplays();
        }, 1000);
        
        console.log('🚀 Real-time tracking started');
    }
    
    stopTracking() {
        if (!this.isTracking) return;
        
        this.isTracking = false;
        this.updateStatus('connecting', '대기 중');
        
        // Clear all intervals
        Object.values(this.intervals).forEach(interval => {
            if (interval) clearInterval(interval);
        });
        this.intervals = {};
        
        // 각 모듈 중지
        Object.values(this.modules).forEach(module => {
            if (module && typeof module.stop === 'function') {
                module.stop();
            }
        });
        
        console.log('⏹️ Real-time tracking stopped');
        
        if (window.notifications) {
            window.notifications.info('실시간 추적을 중지했습니다.');
        }
    }

    updateAllDisplays() {
        // 각 모듈의 데이터를 대시보드 데이터에 반영
        if (this.modules.whaleTracker) {
            this.data.whales = this.modules.whaleTracker.getWhaleTransactions() || [];
        }
        
        if (this.modules.technicalIndicators) {
            this.data.indicators = this.modules.technicalIndicators.getIndicators() || {};
        }
        
        if (this.modules.sentimentAnalysis) {
            this.data.sentiment = this.modules.sentimentAnalysis.getSentiment() || { value: 50, label: '중립' };
        }
        
        if (this.modules.longShortTracker) {
            this.data.longshort = this.modules.longShortTracker.getLongShortRatio() || { long: 50, short: 50, ratio: 1.0, status: 'neutral' };
        }
        
        if (this.modules.orderbookTracker) {
            this.data.orderbook = this.modules.orderbookTracker.getOrderbook() || { asks: [], bids: [] };
        }
        
        if (this.modules.realtimeTrades) {
            this.data.trades = this.modules.realtimeTrades.getTrades() || [];
        }
        
        if (this.modules.marketHeatmap) {
            this.data.heatmap = this.modules.marketHeatmap.getHeatmapData() || [];
        }
        
        if (this.modules.liquidationMap) {
            this.data.liquidations = this.modules.liquidationMap.getLiquidations() || [];
        }
        
        // 모든 디스플레이 업데이트
        this.updateWhaleDisplay();
        this.updateRealtimeDisplay();
        this.updateIndicatorsDisplay();
        this.updateSentimentDisplay();
        this.updateLongShortDisplay();
        this.updateOrderbookDisplay();
        this.updateHeatmapDisplay();
        this.updateLiquidationDisplay();
    }
    
    // Update Display Methods
    updateWhaleDisplay() {
        const container = document.getElementById('whale-trades-container');
        if (!container) return;
        
        if (this.data.whales.length === 0) {
            container.innerHTML = '<div class="no-data"><i class="fas fa-search"></i><p>고래 거래 데이터를 로딩 중...</p></div>';
            return;
        }
        
        container.innerHTML = this.data.whales.map(whale => this.createWhaleHTML(whale)).join('');
        
        // Update stats
        this.updateWhaleStats();
    }
    
    updateRealtimeDisplay() {
        const container = document.getElementById('realtime-trades');
        const priceElement = document.getElementById('realtime-price');
        
        if (!container) return;
        
        // RealtimeTrades 모듈에서 데이터 가져오기
        if (this.modules.realtimeTrades) {
            const trades = this.modules.realtimeTrades.getTrades();
            const currentPrice = this.modules.realtimeTrades.getCurrentPrice();
            const lastPrice = this.modules.realtimeTrades.getLastPrice();
            
            if (trades.length > 0) {
                // 가격 업데이트
                if (priceElement && currentPrice > 0) {
                    priceElement.textContent = AnalysisUtils.formatCurrency(currentPrice);
                    
                    // 가격 변화에 따른 클래스 업데이트
                    if (currentPrice > lastPrice) {
                        priceElement.classList.remove('price-down');
                        priceElement.classList.add('price-up');
                    } else if (currentPrice < lastPrice) {
                        priceElement.classList.remove('price-up');
                        priceElement.classList.add('price-down');
                    }
                    
                    // 마지막 가격 업데이트
                    this.modules.realtimeTrades.setLastPrice(currentPrice);
                }
                
                // 거래 목록 업데이트
                container.innerHTML = trades.slice(0, 20).map(trade => this.createTradeHTML(trade)).join('');
            }
        }
    }
    
    updateIndicatorsDisplay() {
        const container = document.getElementById('indicators-list');
        if (!container) return;
        
        const indicatorsHTML = AnalysisConfig.indicators.map(indicator => {
            const data = this.data.indicators[indicator.key];
            let value = '계산 중...';
            let status = '계산 중...';
            let signalClass = 'calculating';
            
            if (data) {
                if (typeof data.value === 'number') {
                    value = data.value.toFixed(2);
                    status = data.status || 'N/A';
                    signalClass = this.getSignalClass(status);
                } else if (data.k !== undefined) {
                    // Stochastic, StochRSI 등의 경우
                    value = data.k.toFixed(2);
                    status = data.status || 'N/A';
                    signalClass = this.getSignalClass(status);
                } else if (data.histogram !== undefined) {
                    // MACD의 경우
                    value = data.histogram.toFixed(4);
                    status = data.status || 'N/A';
                    signalClass = this.getSignalClass(status);
                } else {
                    status = data.status || 'N/A';
                    signalClass = this.getSignalClass(status);
                }
            }
            
            return `
                <div class="indicator-item">
                    <div class="indicator-info">
                        <span class="indicator-name">${indicator.name}</span>
                        <span class="indicator-desc">${indicator.description}</span>
                    </div>
                    <span class="indicator-value ${signalClass}">
                        ${status === '계산 중...' ? '⏳ ' : ''}${status} (${value})
                    </span>
                </div>
            `;
        }).join('');
        
        container.innerHTML = indicatorsHTML;
        
        this.updateIndicatorSummary();
    }
    
    updateSentimentDisplay() {
        const valueElement = document.getElementById('sentiment-value');
        const labelElement = document.getElementById('sentiment-label');
        
        if (valueElement) valueElement.textContent = this.data.sentiment.value;
        if (labelElement) labelElement.textContent = this.data.sentiment.label;
        
        // Update gauge color based on value
        this.updateSentimentGauge(this.data.sentiment.value);
    }
    
    updateLongShortDisplay() {
        if (!this.data.longshort || typeof this.data.longshort.ratio !== 'number') return;

        const ratioElement = document.getElementById('longshort-ratio');
        const statusElement = document.getElementById('ratio-status');
        const longElement = document.getElementById('long-percentage');
        const shortElement = document.getElementById('short-percentage');
        const fillElement = document.getElementById('long-fill');
        
        if (ratioElement) ratioElement.textContent = this.data.longshort.ratio.toFixed(2);
        if (statusElement) {
            statusElement.textContent = this.getStatusText(this.data.longshort.status);
            statusElement.className = `ls-status ${this.data.longshort.status}`;
        }
        if (longElement) longElement.textContent = this.data.longshort.long.toFixed(1) + '%';
        if (shortElement) shortElement.textContent = this.data.longshort.short.toFixed(1) + '%';
        if (fillElement) fillElement.style.width = this.data.longshort.long.toFixed(1) + '%';
    }
    
    updateOrderbookDisplay() {
        const asksContainer = document.getElementById('asks-orders');
        const bidsContainer = document.getElementById('bids-orders');
        
        if (asksContainer && this.data.orderbook.asks) {
            asksContainer.innerHTML = this.data.orderbook.asks.slice(0, 10).map(ask => 
                `<div class="order-row ask">
                    <span>${ask.price}</span>
                    <span>${ask.quantity}</span>
                </div>`
            ).join('');
        }
        
        if (bidsContainer && this.data.orderbook.bids) {
            bidsContainer.innerHTML = this.data.orderbook.bids.slice(0, 10).map(bid => 
                `<div class="order-row bid">
                    <span>${bid.price}</span>
                    <span>${bid.quantity}</span>
                </div>`
            ).join('');
        }
    }
    
    updateHeatmapDisplay() {
        const container = document.getElementById('heatmap-container');
        if (!container) return;
        
        container.innerHTML = this.data.heatmap.map(coin => {
            const changeClass = coin.change > 0 ? 'positive' : coin.change < 0 ? 'negative' : 'neutral';
            const backgroundColor = coin.change > 0 ? 
                `rgba(16, 185, 129, ${Math.abs(coin.change) / 10})` : 
                `rgba(239, 68, 68, ${Math.abs(coin.change) / 10})`;
            
            return `
                <div class="heatmap-tile" style="background-color: ${backgroundColor}; flex: 1 1 calc(25% - 4px); min-height: 60px;">
                    <div class="heatmap-symbol">${coin.symbol}</div>
                    <div class="heatmap-change">${coin.change > 0 ? '+' : ''}${coin.change.toFixed(2)}%</div>
                </div>
            `;
        }).join('');
    }
    
    updateLiquidationDisplay() {
        const container = document.getElementById('liquidation-container');
        if (!container) return;
        
        if (this.data.liquidations.length === 0) {
            container.innerHTML = '<div class="no-data"><i class="fas fa-chart-line"></i><p>청산 데이터를 로딩 중...</p></div>';
            return;
        }
        
        // 청산 데이터 표시 로직
        container.innerHTML = this.data.liquidations.map(liquidation => `
            <div class="liquidation-item">
                <span class="liquidation-price">$${liquidation.price}</span>
                <span class="liquidation-amount">${liquidation.amount}</span>
                <span class="liquidation-side ${liquidation.side}">${liquidation.side}</span>
            </div>
        `).join('');
    }
    
    // Helper Methods
    createWhaleHTML(whale) {
        const size = AnalysisUtils.getWhaleSizeDescription(whale.type, whale.amount);
        const timeAgo = AnalysisUtils.getTimeAgo(whale.timestamp);
        const amount = AnalysisUtils.formatCurrency(whale.usdValue);
        const crypto = whale.type === 'bitcoin' ? 'BTC' : 'ETH';
        
        return `
            <div class="whale-item ${whale.confirmed ? 'confirmed' : 'pending'}">
                <div class="whale-header">
                    <span class="whale-crypto">${crypto}</span>
                    <span class="whale-size">${size}</span>
                    <span class="whale-time">${timeAgo}</span>
                </div>
                <div class="whale-details">
                    <div class="whale-amount">${whale.amount.toFixed(4)} ${crypto}</div>
                    <div class="whale-value">${amount}</div>
                    <div class="whale-status">${whale.confirmed ? '✅ 확정됨' : '⏳ 대기 중'}</div>
                </div>
            </div>
        `;
    }
    
    createTradeHTML(trade) {
        return `
            <div class="trade-item ${trade.side}">
                <span class="trade-time">${this.formatTime(trade.timestamp)}</span>
                <span class="trade-price">${AnalysisUtils.formatCurrency(trade.price)}</span>
                <span class="trade-size">${trade.quantity.toFixed(4)}</span>
            </div>
        `;
    }
    
    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString('en-GB');
    }
    
    updateWhaleStats() {
        const largeTradesElement = document.getElementById('large-trades');
        const totalVolumeElement = document.getElementById('total-volume');
        
        if (largeTradesElement) {
            largeTradesElement.textContent = this.data.whales.length;
        }
        
        if (totalVolumeElement) {
            const totalVolume = this.data.whales.reduce((sum, whale) => sum + whale.usdValue, 0);
            totalVolumeElement.textContent = AnalysisUtils.formatCurrency(totalVolume);
        }
    }
    
    updateIndicatorSummary() {
        const container = document.getElementById('indicator-summary-container');
        if (!container) return;
        
        const signals = Object.values(this.data.indicators).map(ind => this.getSignalClass(ind.status));
        const bullishCount = signals.filter(s => s === 'bullish').length;
        const bearishCount = signals.filter(s => s === 'bearish').length;
        const total = bullishCount + bearishCount; // 중립은 제외
        
        if (total === 0) {
            container.innerHTML = '';
            return;
        }
        
        const bullishRatio = bullishCount / total;
        const bearishRatio = bearishCount / total;
        
        let overallSignal = 'NEUTRAL';
        let majorColor = 'neutral';
        if (bullishRatio > 0.6) {
            overallSignal = 'STRONG BUY';
            majorColor = 'bullish';
        } else if (bullishRatio > 0.5) {
            overallSignal = 'BUY';
            majorColor = 'bullish';
        } else if (bearishRatio > 0.6) {
            overallSignal = 'STRONG SELL';
            majorColor = 'bearish';
        } else if (bearishRatio > 0.5) {
            overallSignal = 'SELL';
            majorColor = 'bearish';
        }

        container.innerHTML = `
            <div class="summary-bar-container">
                <div class="summary-bar-label bullish">${(bullishRatio * 100).toFixed(0)}% Bullish</div>
                <div class="summary-bar">
                    <div class="summary-bar-fill bullish" style="width: ${(bullishRatio * 100).toFixed(1)}%"></div>
                </div>
                <div class="summary-bar-label bearish">${(bearishRatio * 100).toFixed(0)}% Bearish</div>
            </div>
            <div class="overall-summary">
                종합 신호: <span class="${majorColor}">${overallSignal}</span> ( ${bullishCount} <i class="fas fa-arrow-up bullish"></i> / ${bearishCount} <i class="fas fa-arrow-down bearish"></i> )
            </div>
        `;
    }
    
    updateSentimentGauge(value) {
        // This would update the canvas-based gauge
        // For now, just update the styling
        const canvas = document.getElementById('sentiment-gauge');
        if (canvas) {
            // Simple color update based on value
            const container = canvas.parentElement;
            if (value <= 25) {
                container.style.background = 'radial-gradient(circle, rgba(239,68,68,0.1) 0%, transparent 70%)';
            } else if (value <= 45) {
                container.style.background = 'radial-gradient(circle, rgba(245,158,11,0.1) 0%, transparent 70%)';
            } else if (value <= 55) {
                container.style.background = 'radial-gradient(circle, rgba(107,114,128,0.1) 0%, transparent 70%)';
            } else if (value <= 75) {
                container.style.background = 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)';
            } else {
                container.style.background = 'radial-gradient(circle, rgba(5,150,105,0.1) 0%, transparent 70%)';
            }
        }
    }
    
    getStatusText(status) {
        const statusTexts = {
            'long-dominant': '롱 우세',
            'short-dominant': '숏 우세',
            'neutral': '중립'
        };
        return statusTexts[status] || '중립';
    }
    
    getSignalClass(status) {
        if (!status || status === '계산 중...' || status === 'N/A') {
            return 'calculating';
        }
        
        // 과매수 신호 (빨간색)
        const overboughtSignals = ['과매수'];
        // 과매도 신호 (초록색)
        const oversoldSignals = ['과매도'];
        // 매수 신호 (초록색)
        const bullishSignals = ['강세', '상승추세', '구름대 상단 돌파', '거래량 증가', '강세 전환', '상승', '강한추세', '돌파'];
        // 매도 신호 (빨간색)
        const bearishSignals = ['약세', '하락추세', '구름대 하단 이탈', '거래량 감소', '약세 전환', '하락', '약한추세', '이탈'];
        
        if (overboughtSignals.includes(status)) {
            return 'overbought'; // 과매수 - 빨간색
        } else if (oversoldSignals.includes(status)) {
            return 'oversold'; // 과매도 - 초록색
        } else if (bullishSignals.includes(status)) {
            return 'bullish'; // 매수 - 초록색
        } else if (bearishSignals.includes(status)) {
            return 'bearish'; // 매도 - 빨간색
        } else {
            return 'neutral'; // 중립
        }
    }
    
    // Control Methods
    refreshAll() {
        console.log('🔄 Refreshing all data...');
        this.loadInitialData();
        
        if (window.notifications) {
            window.notifications.success('모든 데이터를 새로고침했습니다.');
        }
    }
    
    updateSymbol(card, symbol) {
        console.log(`🔄 Updating ${card} symbol to ${symbol}`);
        
        switch(card) {
            case 'realtime':
                this.data.trades = AnalysisSimulation.generateMultipleRealtimeTrades(20, symbol);
                this.updateRealtimeDisplay();
                break;
            case 'orderbook':
                this.data.orderbook = AnalysisSimulation.generateOrderbook(symbol);
                this.updateOrderbookDisplay();
                break;
        }
    }
    
    updateTimeframe(timeframe) {
        console.log(`🔄 Updating timeframe to ${timeframe}`);
        
        // Update active button
        document.querySelectorAll('.timeframe-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-timeframe="${timeframe}"]`)?.classList.add('active');
        
        // Regenerate indicators for new timeframe
        this.data.indicators = AnalysisSimulation.generateTechnicalIndicators();
        this.updateIndicatorsDisplay();
    }
    
    updateStatus(status, text) {
        const statusElement = document.getElementById('global-status');
        if (!statusElement) return;
        
        const dot = statusElement.querySelector('.status-dot');
        const textElement = statusElement.querySelector('.status-text');
        
        if (dot) {
            dot.classList.remove('connecting', 'active', 'error');
            dot.classList.add(status);
        }
        
        if (textElement) {
            textElement.textContent = text;
        }
    }
    
    updateStats() {
        // Update time displays
        const now = new Date().toLocaleTimeString('ko-KR');
        document.querySelectorAll('.last-update').forEach(el => {
            el.textContent = `마지막 업데이트: ${now}`;
        });
    }
    
    // Settings Methods
    openSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.style.display = 'block';
            AnalysisUtils.fadeIn(modal, 200);
        }
    }
    
    closeSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            AnalysisUtils.fadeOut(modal, 200, () => {
                modal.style.display = 'none';
            });
        }
    }
    
    saveSettings() {
        const btcThreshold = document.getElementById('whale-btc-threshold')?.value;
        const ethThreshold = document.getElementById('whale-eth-threshold')?.value;
        const notifications = document.getElementById('enable-notifications')?.checked;
        const sound = document.getElementById('enable-sound')?.checked;
        
        // Save to config
        if (btcThreshold) AnalysisConfig.whale.btc.threshold = parseFloat(btcThreshold);
        if (ethThreshold) AnalysisConfig.whale.eth.threshold = parseFloat(ethThreshold);
        if (notifications !== undefined) AnalysisConfig.notifications.enabled = notifications;
        if (sound !== undefined) AnalysisConfig.notifications.sound = sound;
        
        // Update notification system
        if (window.notifications) {
            if (sound) window.notifications.enableSound();
            else window.notifications.disableSound();
        }
        
        // Save to localStorage
        AnalysisUtils.saveToStorage('analysisSettings', {
            btcThreshold,
            ethThreshold,
            notifications,
            sound
        });
        
        this.closeSettings();
        
        if (window.notifications) {
            window.notifications.success('설정이 저장되었습니다.');
        }
    }

    // Layout Management
    initializeGridStack() {
        const options = {
            column: 12,
            cellHeight: 'auto', // We will set this dynamically to be square.
            minRow: 1,
            float: false,
            disableOneColumnMode: true,
            removable: '.trash',
        };

        this.grid = GridStack.init(options);
        
        this.initializeGridBackground();
        this.updateGridBackground(); // Initial draw

        // Update grid on any change (drag, resize, etc.)
        this.grid.on('change', () => {
            setTimeout(() => this.updateGridBackground(), 0);
        });

        // Update on window resize, with debouncing to improve performance
        const debouncedUpdate = this.debounce(() => this.updateGridBackground(), 100);
        window.addEventListener('resize', debouncedUpdate);
        
        // Load layout from localStorage if it exists
        this.loadLayout();

        // Setup layout controls
        this.createLayoutControls();
        
        // Initially disable editing
        this.grid.disable();
    }

    initializeGridBackground() {
        const canvas = document.createElement('canvas');
        canvas.id = 'grid-background-canvas';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.zIndex = '0';
        canvas.style.pointerEvents = 'none';
        this.grid.el.insertBefore(canvas, this.grid.el.firstChild);
        this.gridCanvas = canvas;
        this.gridCanvasCtx = canvas.getContext('2d');
    }

    updateGridBackground() {
        if (!this.grid || !this.gridCanvasCtx) return;

        const columnWidth = this.grid.el.offsetWidth / this.grid.getColumn();
        this.grid.cellHeight(columnWidth);

        const canvas = this.gridCanvas;
        const ctx = this.gridCanvasCtx;

        // Use the container's full scrollable height for the canvas height
        const canvasWidth = this.grid.el.offsetWidth;
        const canvasHeight = this.grid.el.scrollHeight;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvasWidth * dpr;
        canvas.height = canvasHeight * dpr;
        canvas.style.width = `${canvasWidth}px`;
        canvas.style.height = `${canvasHeight}px`;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.07)';
        ctx.lineWidth = 1;

        // Draw vertical lines
        for (let i = 1; i < 12; i++) {
            const x = i * columnWidth;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvasHeight);
            ctx.stroke();
        }

        // Draw horizontal lines
        const numRows = Math.floor(canvasHeight / columnWidth);
        for (let i = 1; i < numRows; i++) {
            const y = i * columnWidth;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvasWidth, y);
            ctx.stroke();
        }
    }

    // Utility for debouncing events to improve performance
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    createLayoutControls() {
        const controlsContainer = document.getElementById('layout-controls-container');
        if (!controlsContainer) return;

        controlsContainer.innerHTML = `
            <button class="layout-btn" id="edit-layout-btn" title="레이아웃 편집">
                <i class="fas fa-edit"></i>
            </button>
            <button class="layout-btn" id="save-layout-btn" title="레이아웃 저장">
                <i class="fas fa-save"></i>
            </button>
            <button class="layout-btn" id="reset-layout-btn" title="레이아웃 초기화">
                <i class="fas fa-undo"></i>
            </button>
        `;
        
        document.getElementById('edit-layout-btn').addEventListener('click', () => this.toggleEditMode());
        document.getElementById('save-layout-btn').addEventListener('click', () => this.saveLayout());
        document.getElementById('reset-layout-btn').addEventListener('click', () => this.resetLayout());
    }

    toggleEditMode() {
        this.isEditMode = !this.isEditMode;
        const editBtn = document.getElementById('edit-layout-btn');
        
        if (this.isEditMode) {
            // 편집 모드 활성화 - 이동과 크기 조절 모두 허용
            this.grid.enable();
            this.grid.enableMove(true);
            this.grid.enableResize(true);
            editBtn.classList.add('active');
        } else {
            // 편집 모드 비활성화
            this.grid.disable();
            this.grid.enableMove(false);
            this.grid.enableResize(false);
            editBtn.classList.remove('active');
        }
    }

    saveLayout() {
        const serializedData = this.grid.save();
        localStorage.setItem('grid-layout', JSON.stringify(serializedData));
        
        if (window.notifications) {
            window.notifications.success('레이아웃이 저장되었습니다.');
        } else {
            alert('레이아웃이 저장되었습니다.');
        }

        // Disable edit mode after saving
        if (this.isEditMode) {
            this.toggleEditMode();
        }
    }

    loadLayout() {
        const savedLayout = localStorage.getItem('grid-layout');
        if (savedLayout) {
            try {
                const serializedData = JSON.parse(savedLayout);
                this.grid.load(serializedData);
            } catch (e) {
                console.error("Could not parse or load layout from localStorage", e);
            }
        }
    }

    resetLayout() {
        if (confirm('레이아웃을 초기 설정으로 되돌리시겠습니까?')) {
            localStorage.removeItem('grid-layout');
            window.location.reload();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalysisDashboard;
} else {
    window.AnalysisDashboard = AnalysisDashboard;
}

// Initialize Analysis Dashboard
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Analysis Dashboard...');
    
    // Initialize Analysis Dashboard
    window.analysisDashboard = new AnalysisDashboard();
    console.log('✅ Analysis Dashboard Ready!');
}); 