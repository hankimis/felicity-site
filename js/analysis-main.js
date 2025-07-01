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
import { OpenInterestTracker } from './analysis/open-interest-tracker.js';
import { AnalysisUtils } from './analysis-utils.js';

// AnalysisConfig를 전역에서 가져오기
const AnalysisConfig = window.AnalysisConfig;

class AnalysisDashboard {
    constructor() {
        this.isTracking = false;
        this.intervals = {};
        this.modules = {};
        this.grid = null;
        this.isEditMode = false;
        this.currentUser = this.getCurrentUser();
        this.gridInitialized = false;
        
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
    
    getCurrentUser() {
        try {
            // Firebase Auth에서 현재 사용자 가져오기
            if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
                const user = firebase.auth().currentUser;
                return user.uid || user.email || 'firebase_user';
            }
            
            // 전역 변수에서 사용자 정보 확인
            if (window.currentUser) {
                return window.currentUser;
            }
            
            // 로컬 스토리지에서 사용자 정보 확인
            const localUser = localStorage.getItem('currentUserId') || localStorage.getItem('currentUser');
            if (localUser && localUser !== 'guest') {
                return localUser;
            }
            
            // 브라우저별 고유 ID 생성 및 저장
            let browserUserId = localStorage.getItem('browserUserId');
            if (!browserUserId) {
                browserUserId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('browserUserId', browserUserId);
                console.log('🆔 Generated new browser user ID:', browserUserId);
            }
            
            return browserUserId;
            
        } catch (error) {
            console.warn('⚠️ Error getting current user:', error);
            return 'anonymous_user_' + Date.now();
        }
    }
    
    async init() {
        console.log('🚀 Initializing Analysis Dashboard...');
        
        await this.initializeModules();
        this.setupEventListeners();
        
        // GridStack 초기화를 DOM 로드 후에 실행
        this.waitForDOM().then(() => {
            this.initializeGridStack();
            this.loadInitialData();
            this.startTracking();
        });
        
        console.log('✅ Analysis Dashboard initialized');
    }

    waitForDOM() {
        return new Promise((resolve) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }

    async initializeModules() {
        try {
            // 각 모듈 초기화
            this.modules.whaleTracker = new WhaleTracker({
                symbol: 'BTCUSDT',
                largeTradeThreshold: 100000,
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

            this.modules.realtimeTrades = new RealtimeTrades();

            this.modules.openInterestTracker = new OpenInterestTracker({
                symbol: 'BTCUSDT'
            });

            // Open Interest Tracker 기간 선택 버튼 이벤트 재설정
            setTimeout(() => {
                this.setupOpenInterestTimeframeButtons();
            }, 100);

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
        
        // Whale tracker settings button
        document.getElementById('whale-settings-btn')?.addEventListener('click', () => {
            this.modules.whaleTracker?.openSettingsModal();
        });
        
        // Symbol selectors
        document.getElementById('whale-symbol-selector')?.addEventListener('change', (e) => {
            console.log(`UI Symbol filter changed to: ${e.target.value}`);
        });
        
        document.getElementById('realtime-symbol')?.addEventListener('change', async (e) => {
            await this.updateSymbol('realtime', e.target.value);
        });
        
        // longshort-symbol 이벤트는 LongShortTracker에서 직접 처리
        
        document.getElementById('orderbook-symbol')?.addEventListener('change', async (e) => {
            await this.updateSymbol('orderbook', e.target.value);
        });
        
        document.getElementById('open-interest-symbol')?.addEventListener('change', async (e) => {
            await this.updateSymbol('open-interest', e.target.value);
        });

        // Open Interest 기간 선택 버튼들
        this.setupOpenInterestTimeframeButtons();
        
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
        
        // Window resize
        window.addEventListener('resize', () => this.handleResize());
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

    setupOpenInterestTimeframeButtons() {
        const timeframeButtons = document.querySelectorAll('#oi-timeframe-buttons .timeframe-btn');
        
        timeframeButtons.forEach(btn => {
            // 기존 이벤트 리스너 제거 (중복 방지)
            btn.replaceWith(btn.cloneNode(true));
        });

        // 새로운 버튼들에 이벤트 리스너 추가
        document.querySelectorAll('#oi-timeframe-buttons .timeframe-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const period = e.target.dataset.period;
                if (period && this.modules.openInterestTracker) {
                    await this.modules.openInterestTracker.changeTimeframe(period);
                }
            });
        });

        console.log('✅ Open Interest timeframe buttons setup complete');
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
            
            if (this.modules.openInterestTracker) {
                await this.modules.openInterestTracker.start();
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
        
        // 각 모듈 시작
        Object.entries(this.modules).forEach(([name, module]) => {
            if (module && typeof module.start === 'function') {
                module.start();
            }
        });
        
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
        if (this.modules.technicalIndicators) {
            this.data.indicators = this.modules.technicalIndicators.getIndicators() || {};
        }
        
        if (this.modules.sentimentAnalysis) {
            this.data.sentiment = this.modules.sentimentAnalysis.getSentiment() || { value: 50, label: '중립' };
        }
        
        if (this.modules.longShortTracker) {
            const currentRatio = this.modules.longShortTracker.getLongShortRatio();
            // 유효한 데이터가 있을 때만 업데이트 (초기화 방지)
            if (currentRatio && currentRatio.long !== undefined && currentRatio.short !== undefined) {
                this.data.longshort = currentRatio;
            } else if (!this.data.longshort) {
                // 초기값만 설정
                this.data.longshort = { long: 50, short: 50, ratio: 1.0, status: 'neutral' };
            }
        }
        
        if (this.modules.orderbookTracker) {
            this.data.orderbook = this.modules.orderbookTracker.getOrderbook() || { asks: [], bids: [] };
        }
        
        if (this.modules.liquidationMap) {
            this.data.liquidations = this.modules.liquidationMap.getLiquidations() || [];
        }
        
        // 각 디스플레이 업데이트
        this.updateIndicatorsDisplay();
        this.updateSentimentDisplay();
        this.updateLongShortDisplay();
        this.updateOrderbookDisplay();
        this.updateLiquidationDisplay();
        this.updateRealtimeDisplay();
        
        // 실시간 통계 업데이트
        this.updateStats();
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
        // 기술지표 모듈의 updateDisplay 메서드 직접 호출
        if (this.modules.technicalIndicators) {
            this.modules.technicalIndicators.updateDisplay();
        }
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
    
    updateLiquidationDisplay() {
        // LiquidationMap 모듈이 직접 렌더링을 담당하므로 여기서는 아무것도 하지 않음
        // 데이터는 this.data.liquidations에 저장되어 있음
    }
    
    // Helper Methods
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
    
    updateSentimentGauge(value) {
        const canvas = document.getElementById('sentiment-gauge');
        if (canvas) {
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
    
    // Control Methods
    refreshAll() {
        console.log('🔄 Refreshing all data...');
        this.loadInitialData();
        
        if (window.notifications) {
            window.notifications.success('모든 데이터를 새로고침했습니다.');
        }
    }
    
    async updateSymbol(card, symbol) {
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
            case 'open-interest':
                if (this.modules.openInterestTracker) {
                    await this.modules.openInterestTracker.updateSymbol(symbol);
                }
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
            window.notifications.success('설정이 성공적으로 저장되었습니다.');
        }
    }

    // GridStack Layout Management
    initializeGridStack() {
        console.log('🎯 Initializing GridStack...');
        
        const gridElement = document.getElementById('dashboard-grid');
        if (!gridElement) {
            console.error('Grid element not found');
            return;
        }

        // 정사각형 셀 높이 계산
        const calculateSquareCellHeight = () => {
            const containerWidth = gridElement.clientWidth;
            const margin = 12;
            const columns = 12;
            return Math.floor((containerWidth - (margin * (columns - 1))) / columns);
        };

        // GridStack 옵션 설정 - 정사방형 그리드
        const options = {
            column: 12,
            cellHeight: calculateSquareCellHeight(),
            margin: 12,
            minRow: 1,
            disableOneColumnMode: true,
            removable: false,
            acceptWidgets: false,
            alwaysShowResizeHandle: false,
            // 반응형 컬럼 설정
            columnOpts: {
                1200: 12,  // 1200px 이상: 12컬럼
                768: 8,    // 768px-1199px: 8컬럼
                576: 4,    // 576px-767px: 4컬럼
                0: 2       // 575px 이하: 2컬럼
            },
            // 초기에는 정적 그리드 (편집 버튼으로 제어)
            staticGrid: true,
            // 애니메이션 설정 - 부드러운 전환
            animate: true,
            animationSpeed: 200,
            // 자동 위치 조정 비활성화 (안정성 향상)
            float: false,
            // 드래그 핸들을 카드 헤더로 제한
            handle: '.card-header',
        };

        try {
            this.grid = GridStack.init(options, gridElement);
            
            if (!this.grid) {
                throw new Error('GridStack initialization failed');
            }

            // 이벤트 리스너 설정
            this.setupGridEvents();
            
            // 정사각형 비율 유지 설정
            this.setupSquareGrid();
            
            // 레이아웃 로드 - HTML 기본 구조 사용 후 사용자 레이아웃 적용
            // GridStack 완전 초기화 후 레이아웃 로드
            setTimeout(() => {
                this.loadUserLayout();
            }, 300);
            
            // 인라인 컨트롤 버튼 이벤트 리스너 설정
            this.setupLayoutControlEvents();
            
            this.gridInitialized = true;
            console.log('✅ GridStack initialized successfully with square grid layout');
            
        } catch (error) {
            console.error('❌ GridStack initialization failed:', error);
            this.fallbackToRegularGrid();
        }
    }

    fallbackToRegularGrid() {
        console.log('📋 Falling back to regular CSS grid layout');
        const gridElement = document.getElementById('dashboard-grid');
        if (gridElement) {
            gridElement.style.display = 'grid';
            gridElement.style.gridTemplateColumns = 'repeat(12, 1fr)';
            gridElement.style.gap = '1rem';
        }
    }

    setupGridEvents() {
        if (!this.grid) return;

        // 그리드 변경 이벤트
        this.grid.on('change', (event, items) => {
            if (this.isEditMode) {
                this.autoSaveLayout();
            }
        });

        // 드래그 완료 이벤트
        this.grid.on('dragstop', (event, element) => {
            if (this.isEditMode) {
                this.autoSaveLayout();
            }
        });
    }

    setupLayoutControlEvents() {
        // 인라인 레이아웃 컨트롤 버튼들에 이벤트 리스너 추가
        const editBtn = document.getElementById('edit-layout-btn');
        const saveBtn = document.getElementById('save-layout-btn');
        const resetBtn = document.getElementById('reset-layout-btn');
        const cancelBtn = document.getElementById('cancel-edit-btn');
        
        if (editBtn) {
            editBtn.addEventListener('click', () => this.toggleEditMode());
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveUserLayout());
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetLayout());
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.cancelEditMode());
        }
        
        console.log('🎮 Layout control events setup completed');
    }

    toggleEditMode() {
        if (!this.grid) {
            console.error('❌ Grid not initialized');
            return;
        }

        this.isEditMode = !this.isEditMode;
        
        const editBtn = document.getElementById('edit-layout-btn');
        const saveBtn = document.getElementById('save-layout-btn');
        const cancelBtn = document.getElementById('cancel-edit-btn');
        const gridElement = document.getElementById('dashboard-grid');
        
        console.log(`🔄 Toggling edit mode to: ${this.isEditMode}`);
        
        if (this.isEditMode) {
            try {
                // 현재 레이아웃 백업
                this.backupLayout = this.grid.save();
                
                // GridStack 편집 활성화 - staticGrid 해제
                this.grid.setStatic(false);
                
                // 편집 모드 UI 업데이트
                gridElement?.classList.add('edit-mode');
                editBtn.style.display = 'none';
                saveBtn.style.display = 'flex';
                cancelBtn.style.display = 'flex';
                
                // 드래그 핸들 확인 (이미 GridStack 옵션에서 설정됨)
                console.log('드래그 핸들: .card-header로 제한됨');
                
                console.log('✏️ Edit mode enabled - 헤더로 드래그 제한');
                
                if (window.notifications) {
                    window.notifications.info('편집 모드 활성화: 카드 헤더를 드래그하여 이동하세요');
                }
                
            } catch (error) {
                console.error('❌ Error enabling edit mode:', error);
                if (window.notifications) {
                    window.notifications.error('편집 모드 활성화에 실패했습니다.');
                }
            }
        } else {
            this.disableEditMode();
        }
    }

    disableEditMode() {
        if (!this.grid) return;

        this.isEditMode = false;
        
        try {
            // GridStack 편집 비활성화 - staticGrid 활성화
            this.grid.setStatic(true);
            
            console.log('🔒 Edit mode disabled');
            
        } catch (error) {
            console.error('❌ Error disabling edit mode:', error);
        }
        
        const editBtn = document.getElementById('edit-layout-btn');
        const saveBtn = document.getElementById('save-layout-btn');
        const cancelBtn = document.getElementById('cancel-edit-btn');
        const gridElement = document.getElementById('dashboard-grid');
        
        gridElement?.classList.remove('edit-mode');
        editBtn.style.display = 'flex';
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
        
        console.log('✅ Edit mode disabled - drag and resize deactivated');
    }

    cancelEditMode() {
        if (!this.grid || !this.backupLayout) return;

        // 백업된 레이아웃으로 복원
        this.grid.load(this.backupLayout);
        this.disableEditMode();
        
        if (window.notifications) {
            window.notifications.info('편집이 취소되었습니다.');
        }
    }

    autoSaveLayout() {
        // 편집 중 자동 저장 (debounce 적용)
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }
        
        this.autoSaveTimeout = setTimeout(() => {
            const currentLayout = this.grid.save();
            this.tempLayout = currentLayout;
        }, 1000);
    }

    saveUserLayout() {
        if (!this.grid) {
            console.error('❌ Grid not available for saving');
            return;
        }

        try {
            const serializedData = this.grid.save();
            
            // 데이터 유효성 검사
            if (!serializedData || !Array.isArray(serializedData) || serializedData.length === 0) {
                console.warn('⚠️ No valid layout data to save');
                if (window.notifications) {
                    window.notifications.warning('저장할 레이아웃 데이터가 없습니다.');
                }
                return;
            }
            
            const currentUser = this.getCurrentUser();
            const storageKey = `gridLayout_${currentUser}`;
            
            const layoutData = {
                layout: serializedData,
                timestamp: Date.now(),
                version: '2.0',
                user: currentUser,
                itemCount: serializedData.length,
                checksum: this.generateLayoutChecksum(serializedData)
            };
            
            // 로컬 스토리지에 저장
            localStorage.setItem(storageKey, JSON.stringify(layoutData));
            
            // 백업 저장 (최근 3개 유지)
            this.saveLayoutBackup(currentUser, layoutData);
            
            this.disableEditMode();
            
            console.log('💾 Layout saved successfully:', {
                user: currentUser,
                itemCount: serializedData.length,
                timestamp: new Date(layoutData.timestamp).toLocaleString()
            });
            
            if (window.notifications) {
                window.notifications.success('레이아웃이 성공적으로 저장되었습니다.');
            }
            
        } catch (error) {
            console.error('❌ Failed to save layout:', error);
            
            if (window.notifications) {
                window.notifications.error('레이아웃 저장에 실패했습니다: ' + error.message);
            }
        }
    }

    generateLayoutChecksum(layoutData) {
        // 간단한 체크섬 생성 (데이터 무결성 확인용)
        const str = JSON.stringify(layoutData);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32bit 정수로 변환
        }
        return hash.toString(16);
    }

    saveLayoutBackup(userId, layoutData) {
        try {
            const backupKey = `gridLayoutBackups_${userId}`;
            let backups = JSON.parse(localStorage.getItem(backupKey) || '[]');
            
            // 새 백업 추가
            backups.unshift({
                ...layoutData,
                backupId: Date.now()
            });
            
            // 최근 3개만 유지
            backups = backups.slice(0, 3);
            
            localStorage.setItem(backupKey, JSON.stringify(backups));
            console.log('📦 Layout backup saved, total backups:', backups.length);
            
        } catch (error) {
            console.warn('⚠️ Failed to save layout backup:', error);
        }
    }

    loadUserLayout() {
        if (!this.grid) {
            console.warn('⚠️ Grid not available for loading layout');
            return;
        }

        try {
            const currentUser = this.getCurrentUser();
            const storageKey = `gridLayout_${currentUser}`;
            const savedData = localStorage.getItem(storageKey);
            
            if (savedData) {
                const layoutData = JSON.parse(savedData);
                const { layout, timestamp, version, user, itemCount, checksum } = layoutData;
                
                // 데이터 유효성 검사
                if (!layout || !Array.isArray(layout)) {
                    throw new Error('Invalid layout data structure');
                }
                
                // 체크섬 검증 (버전 2.0 이상)
                if (version === '2.0' && checksum) {
                    const calculatedChecksum = this.generateLayoutChecksum(layout);
                    if (calculatedChecksum !== checksum) {
                        console.warn('⚠️ Layout checksum mismatch, data may be corrupted');
                        // 백업에서 복원 시도
                        if (this.loadFromBackup(currentUser)) {
                            return;
                        }
                    }
                }
                
                // 버전 호환성 체크 및 로드
                if ((version === '1.0' || version === '2.0') && layout.length > 0) {
                    // GridStack이 완전히 초기화되었는지 확인
                    if (this.grid && this.gridInitialized) {
                        try {
                            // 기존 HTML 아이템들을 모두 제거하고 저장된 레이아웃 로드
                            this.grid.removeAll();
                            
                            // 약간의 지연을 두고 로드 (DOM 안정화)
                            setTimeout(() => {
                                this.grid.load(layout);
                                
                                console.log('📂 User layout loaded successfully:', {
                                    user: currentUser,
                                    version: version,
                                    itemCount: layout.length,
                                    savedAt: new Date(timestamp).toLocaleString()
                                });
                                
                                if (window.notifications) {
                                    window.notifications.info(`저장된 레이아웃을 불러왔습니다 (${layout.length}개 카드)`);
                                }
                            }, 200);
                            
                            return;
                        } catch (loadError) {
                            console.error('❌ Error loading saved layout:', loadError);
                            // 에러 발생 시 백업에서 복원 시도
                            throw loadError;
                        }
                    } else {
                        console.warn('⚠️ GridStack not ready, deferring layout load');
                        // GridStack이 준비되지 않았으면 잠시 후 재시도
                        setTimeout(() => this.loadUserLayout(), 500);
                        return;
                    }
                }
            }
            
            // 저장된 레이아웃이 없으면 HTML 기본 구조 사용
            console.log('📋 No saved layout found, using HTML default layout');
            
        } catch (error) {
            console.error('❌ Failed to load user layout:', error);
            
            // 백업에서 복원 시도
            const currentUser = this.getCurrentUser();
            if (this.loadFromBackup(currentUser)) {
                console.log('🔄 Restored layout from backup');
                return;
            }
            
            console.log('📋 Falling back to HTML default layout');
            
            if (window.notifications) {
                window.notifications.warning('저장된 레이아웃을 불러오는데 실패했습니다. 기본 레이아웃을 사용합니다.');
            }
        }
    }

    loadFromBackup(userId) {
        try {
            const backupKey = `gridLayoutBackups_${userId}`;
            const backups = JSON.parse(localStorage.getItem(backupKey) || '[]');
            
            if (backups.length > 0) {
                const latestBackup = backups[0];
                if (latestBackup.layout && Array.isArray(latestBackup.layout)) {
                    this.grid.removeAll();
                    this.grid.load(latestBackup.layout);
                    
                    console.log('🔄 Layout restored from backup:', {
                        backupId: latestBackup.backupId,
                        itemCount: latestBackup.layout.length
                    });
                    
                    if (window.notifications) {
                        window.notifications.info('백업에서 레이아웃을 복원했습니다.');
                    }
                    return true;
                }
            }
            return false;
            
        } catch (error) {
            console.error('❌ Failed to load from backup:', error);
            return false;
        }
    }

    resetLayout() {
        const confirmed = confirm('레이아웃을 기본 설정으로 되돌리시겠습니까?\n\n저장된 레이아웃과 백업이 모두 삭제됩니다.');
        
        if (confirmed && this.grid) {
            try {
                const currentUser = this.getCurrentUser();
                
                // 사용자 레이아웃 삭제
                const storageKey = `gridLayout_${currentUser}`;
                localStorage.removeItem(storageKey);
                
                // 백업도 삭제
                const backupKey = `gridLayoutBackups_${currentUser}`;
                localStorage.removeItem(backupKey);
                
                console.log('🗑️ Layout and backups cleared for user:', currentUser);
                
                // 편집 모드 비활성화
                if (this.isEditMode) {
                    this.disableEditMode();
                }
                
                if (window.notifications) {
                    window.notifications.success('레이아웃이 초기화되었습니다. 페이지를 새로고침합니다.');
                }
                
                // 짧은 지연 후 페이지 새로고침으로 HTML 기본 레이아웃 복원
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
                
            } catch (error) {
                console.error('❌ Failed to reset layout:', error);
                
                if (window.notifications) {
                    window.notifications.error('레이아웃 초기화에 실패했습니다: ' + error.message);
                }
            }
        }
    }

    setupSquareGrid() {
        if (!this.grid) return;

        const gridElement = document.getElementById('dashboard-grid');
        if (!gridElement) return;

        const updateSquareGrid = () => {
            const containerWidth = gridElement.clientWidth;
            const margin = this.grid.opts.margin || 12;
            const columns = this.grid.getColumn();
            
            // 정사각형 셀 높이 계산
            const cellHeight = Math.floor((containerWidth - (margin * (columns - 1))) / columns);
            
            // GridStack의 cellHeight 업데이트
            this.grid.cellHeight(cellHeight);
            
            console.log(`📐 Square grid updated: ${columns} columns, ${cellHeight}px cell height`);
        };

        // 초기 설정
        updateSquareGrid();

        // 윈도우 리사이즈 이벤트
        const resizeObserver = new ResizeObserver(() => {
            if (this.gridInitialized) {
                requestAnimationFrame(updateSquareGrid);
            }
        });

        resizeObserver.observe(gridElement);

        // GridStack 컬럼 변경 시에도 업데이트
        this.grid.on('change', () => {
            setTimeout(updateSquareGrid, 100);
        });

        // 리사이즈 observer를 나중에 정리할 수 있도록 저장
        this.resizeObserver = resizeObserver;
    }

    handleResize() {
        // 윈도우 리사이즈 시 그리드 조정 (이제 ResizeObserver가 처리)
        if (this.grid && this.gridInitialized) {
            console.log('🔄 Window resized, grid will auto-adjust');
        }
    }

    // Cleanup method
    destroy() {
        if (this.grid) {
            this.grid.destroy();
        }
        
        // ResizeObserver 정리
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        // Clear intervals
        Object.values(this.intervals).forEach(interval => {
            if (interval) clearInterval(interval);
        });
        
        // Remove event listeners
        window.removeEventListener('resize', this.handleResize);
        
        // Clean up layout control event listeners (인라인 컨트롤은 자동 정리됨)
        
        console.log('🧹 Dashboard cleanup completed');
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