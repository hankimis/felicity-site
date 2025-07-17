// 🔥 차트 레이아웃 관리자 (Chart Layout Manager)
class ChartLayoutManager {
    constructor() {
        this.currentLayout = 1; // 기본 1개 차트
        this.maxCharts = 4; // 최대 4개 차트
        this.widgets = []; // 차트 위젯들 저장
        this.isInitialized = false;
        
        console.log('🔥 차트 레이아웃 관리자 초기화');
    }

    // 🔥 레이아웃 관리자 초기화
    init() {
        if (this.isInitialized) {
            return;
        }

        this.createLayoutHeader();
        this.setupLayoutButtons();
        this.initializeManagers();
        this.isInitialized = true;
        
        console.log('✅ 차트 레이아웃 관리자 초기화 완료');
    }

    // 🔥 관리자들 초기화
    initializeManagers() {
        // 마켓 데이터 관리자 초기화
        if (!window.marketDataManager) {
            window.marketDataManager = new MarketDataManager();
        }
        window.marketDataManager.startUpdating();
        window.marketDataManager.startPriceStream();

        console.log('✅ 마켓 데이터 관리자 초기화 완료');
    }

    // 🔥 차트 헤더 생성
    createLayoutHeader() {
        const chartContainer = document.getElementById('tradingview_chart');
        if (!chartContainer) {
            console.error('❌ 차트 컨테이너를 찾을 수 없습니다');
            return;
        }

        // 기존 헤더 제거
        const existingHeader = document.querySelector('.chart-layout-header');
        if (existingHeader) {
            existingHeader.remove();
        }

        // 헤더 HTML 생성 (레이아웃 버튼만 포함)
        const headerHTML = `
            <div class="chart-layout-header">
                <div class="layout-buttons-group">
                    <button class="layout-btn active" data-layout="1" title="1개 차트">
                        <div class="layout-icon layout-1">
                            <div class="chart-box"></div>
                        </div>
                    </button>
                    <button class="layout-btn" data-layout="2" title="2개 차트">
                        <div class="layout-icon layout-2">
                            <div class="chart-box"></div>
                            <div class="chart-box"></div>
                        </div>
                    </button>
                    <button class="layout-btn" data-layout="3" title="3개 차트">
                        <div class="layout-icon layout-3">
                            <div class="chart-box"></div>
                            <div class="chart-box"></div>
                            <div class="chart-box"></div>
                        </div>
                    </button>
                    <button class="layout-btn" data-layout="4" title="4개 차트">
                        <div class="layout-icon layout-4">
                            <div class="chart-box"></div>
                            <div class="chart-box"></div>
                            <div class="chart-box"></div>
                            <div class="chart-box"></div>
                        </div>
                    </button>
                </div>
            </div>
        `;

        // 헤더를 차트 컨테이너 앞에 삽입
        chartContainer.insertAdjacentHTML('beforebegin', headerHTML);
    }

    // 🔥 레이아웃 버튼 이벤트 설정
    setupLayoutButtons() {
        const layoutButtons = document.querySelectorAll('.layout-btn');
        
        layoutButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const layout = parseInt(e.currentTarget.dataset.layout);
                this.changeLayout(layout);
            });
        });
    }

    // 🔥 차트 레이아웃 변경
    changeLayout(layout) {
        if (layout < 1 || layout > this.maxCharts) {
            console.error('❌ 잘못된 레이아웃:', layout);
            return;
        }

        console.log(`🔄 차트 레이아웃 변경: ${this.currentLayout} → ${layout}`);
        
        // 버튼 활성화 상태 업데이트
        this.updateActiveButton(layout);
        
        // 차트 컨테이너 레이아웃 변경
        this.updateChartContainers(layout);
        
        // 기존 위젯들 정리
        this.cleanupWidgets();
        
        // 새 레이아웃으로 차트 초기화 (비동기로 빠르게 처리)
        this.initializeChartsForLayout(layout);
        
        this.currentLayout = layout;
    }

    // 🔥 활성 버튼 업데이트
    updateActiveButton(layout) {
        const buttons = document.querySelectorAll('.layout-btn');
        buttons.forEach(btn => {
            btn.classList.remove('active');
            if (parseInt(btn.dataset.layout) === layout) {
                btn.classList.add('active');
            }
        });
    }

    // 🔥 차트 컨테이너 레이아웃 업데이트
    updateChartContainers(layout) {
        const mainContainer = document.getElementById('tradingview_chart');
        if (!mainContainer) {
            console.error('❌ 메인 차트 컨테이너를 찾을 수 없습니다');
            return;
        }

        // 기존 차트 컨테이너들 제거
        const existingCharts = document.querySelectorAll('.chart-container');
        existingCharts.forEach(chart => chart.remove());

        // 메인 컨테이너 클래스 업데이트
        mainContainer.className = `chart-main-container layout-${layout}`;
        mainContainer.innerHTML = '';

        // 새 차트 컨테이너들 생성
        for (let i = 1; i <= layout; i++) {
            const chartContainer = document.createElement('div');
            chartContainer.className = `chart-container`;
            chartContainer.id = `chart-${i}`;
            chartContainer.innerHTML = `
                <div class="chart-loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>차트 ${i} 로딩 중...</span>
                </div>
            `;
            
            mainContainer.appendChild(chartContainer);
        }
    }

    // 🔥 기존 위젯들 정리
    cleanupWidgets() {
        this.widgets.forEach(widget => {
            try {
                if (widget && widget.remove) {
                    widget.remove();
                }
            } catch (error) {
                console.warn('위젯 제거 중 오류:', error);
            }
        });
        this.widgets = [];
    }

    // 🔥 레이아웃에 맞는 차트들 초기화
    async initializeChartsForLayout(layout) {
        console.log(`🔄 ${layout}개 차트 초기화 시작`);
        
        const symbols = ['BINANCE:BTCUSDT', 'BINANCE:ETHUSDT', 'BINANCE:BNBUSDT', 'BINANCE:ADAUSDT'];
        const intervals = ['15', '1H', '4H', '1D'];
        
        // 🔥 병렬 처리로 속도 개선
        const chartPromises = [];
        for (let i = 1; i <= layout; i++) {
            chartPromises.push(
                this.initializeSingleChart(i, symbols[i-1] || symbols[0], intervals[i-1] || intervals[0])
                    .catch(error => {
                        console.error(`❌ 차트 ${i} 초기화 실패:`, error);
                    })
            );
        }
        
        // 모든 차트를 동시에 초기화
        await Promise.all(chartPromises);
        
        console.log(`✅ ${layout}개 차트 초기화 완료`);
    }

    // 🔥 단일 차트 초기화
    async initializeSingleChart(index, symbol, interval) {
        const container = document.getElementById(`chart-${index}`);
        if (!container) {
            console.error(`❌ 차트 컨테이너 ${index}를 찾을 수 없습니다`);
            return;
        }

        // 차트 저장소 확인
        if (!window.chartStorage) {
            window.chartStorage = new ChartStorage();
        }

        const widgetOptions = {
            container: container,
            library_path: '/charting_library-master/charting_library/',
            symbol: symbol,
            interval: interval,
            fullscreen: false,
            autosize: true,
            datafeed: new BinanceDatafeed(),
            locale: 'ko',
            timezone: 'Asia/Seoul',
            theme: document.documentElement.classList.contains('dark-mode') ? 'Dark' : 'Light',
            
            // 멀티 차트용 설정
            save_load_adapter: null, // 개별 차트는 저장 비활성화
            auto_save_delay: 0, // 자동 저장 비활성화
            
            enabled_features: [
                'move_logo_to_main_pane',
                'chart_crosshair_menu'
            ],
            
            disabled_features: [
                'use_localstorage_for_settings',
                'header_saveload',
                'popup_hints',
                'widget_logo',
                'compare_symbol',
                'display_market_status',
                'chart_template_storage',
                'study_templates', // 멀티 차트에서는 템플릿 비활성화
                'saveload_separate_drawings_storage' // 멀티 차트에서는 그림 저장 비활성화
            ],
            
            overrides: {
                "mainSeriesProperties.candleStyle.upColor": "#26a69a",
                "mainSeriesProperties.candleStyle.downColor": "#ef5350",
                "mainSeriesProperties.candleStyle.wickUpColor": "#26a69a",
                "mainSeriesProperties.candleStyle.wickDownColor": "#ef5350"
            },
            
            debug: false
        };

        const widget = new TradingView.widget(widgetOptions);
        
        widget.onChartReady(() => {
            console.log(`✅ 차트 ${index} 준비 완료 (${symbol})`);
            
            // 로딩 인디케이터 숨기기
            const loading = container.querySelector('.chart-loading');
            if (loading) {
                loading.style.display = 'none';
            }
        });

        this.widgets.push(widget);
    }

    // 🔥 현재 레이아웃 반환
    getCurrentLayout() {
        return this.currentLayout;
    }

    // 🔥 차트 테마 변경
    changeTheme(theme) {
        this.widgets.forEach((widget, index) => {
            if (widget && typeof widget.changeTheme === 'function') {
                try {
                    widget.changeTheme(theme);
                    console.log(`🎨 레이아웃 차트 ${index + 1} 테마 변경: ${theme}`);
                } catch (error) {
                    console.warn(`⚠️ 레이아웃 차트 ${index + 1} 테마 변경 실패:`, error);
                }
            }
        });
    }

    // 🔥 레이아웃 매니저 정리
    destroy() {
        this.cleanupWidgets();
        
        // 헤더 제거
        const header = document.querySelector('.chart-layout-header');
        if (header) {
            header.remove();
        }
        
        // 관리자들 정리
        if (window.marketDataManager) {
            window.marketDataManager.stopUpdating();
            window.marketDataManager.stopPriceStream();
        }
        
        console.log('🔥 차트 레이아웃 매니저 정리 완료');
    }
}

// 🚀 전문 오더북 클래스 (Professional Orderbook)
class ProfessionalOrderbook {
    constructor(container, options = {}) {
        this.config = {
            container,
            symbol: options.symbol || 'BTCUSDT',
            maxDepth: options.maxDepth || 15,
            precision: options.precision || 0.1,
            updateInterval: options.updateInterval || 100,
            heartbeatInterval: options.heartbeatInterval || 30000,
            maxReconnectAttempts: options.maxReconnectAttempts || 10,
            reconnectDelay: options.reconnectDelay || 1000,
            ...options
        };

        // 오더북 데이터
        this.orderbook = {
            bids: new Map(),
            asks: new Map(),
            lastUpdateId: 0,
            timestamp: 0,
            spread: 0,
            bestBid: 0,
            bestAsk: 0
        };

        // 연결 상태 - 강화된 상태 관리
        this.connection = {
            ws: null,
            isConnected: false,
            isSubscribed: false,
            reconnectAttempts: 0,
            status: 'disconnected', // disconnected, connecting, connected, error, reconnecting
            lastDataTime: 0,
            heartbeatInterval: null,
            connectionStartTime: 0
        };

        // UI 상태
        this.ui = {
            viewMode: 'combined', // combined, bids-only, asks-only
            precision: 0.1,
            isInitialized: false,
            lastRenderTime: 0,
            renderThrottle: 50
        };

        // 성능 메트릭스
        this.metrics = {
            updateCount: 0,
            lastUpdateTime: 0,
            averageLatency: 0,
            missedUpdates: 0,
            errorCount: 0,
            reconnectCount: 0,
            messagesPerSecond: 0,
            lastSecondCount: 0,
            lastSecondTime: Date.now()
        };

        // 건강 상태 관리
        this.healthCheck = {
            lastHealthTime: Date.now(),
            consecutiveErrors: 0,
            maxConsecutiveErrors: 5
        };

        // 데이터 버퍼
        this.dataBuffer = [];
        this.isProcessingBuffer = false;
        this.isDestroyed = false;

        this.initialize();
    }

    /**
     * 🔥 초기화 - 강화된 에러 처리
     */
    async initialize() {
        if (this.isDestroyed) {
            console.warn('⚠️ 오더북이 이미 정리됨, 초기화 취소');
            return;
        }

        try {
            console.log('🔄 전문 오더북 초기화 중...', this.config);
            
            this.createUI();
            this.setupEventListeners();
            await this.loadInitialSnapshot();
            await this.connectWebSocket();
            this.startPerformanceMonitoring();
            this.startHealthCheck();
            
            console.log('✅ 전문 오더북 초기화 완료');
            
        } catch (error) {
            console.error('❌ 전문 오더북 초기화 실패:', error);
            this.handleError(error);
        }
    }

    /**
     * 🔥 UI 생성 - 향상된 구조
     */
    createUI() {
        if (!this.config.container) {
            throw new Error('오더북 컨테이너가 제공되지 않았습니다');
        }

        this.config.container.innerHTML = `
            <div class="professional-orderbook">
                <!-- 간단한 컨트롤 헤더 -->
                <div class="orderbook-controls">
                    <div class="orderbook-symbol-info">
                        <span class="symbol-display">${this.config.symbol}</span>
                        <div class="connection-status">
                            <div class="status-indicator disconnected"></div>
                            <span class="status-text">연결 중...</span>
                        </div>
                    </div>
                    
                    <div class="orderbook-settings">
                        <div class="precision-controls">
                            <button class="precision-btn" data-precision="0.01">0.01</button>
                            <button class="precision-btn active" data-precision="0.1">0.1</button>
                            <button class="precision-btn" data-precision="1">1</button>
                            <button class="precision-btn" data-precision="10">10</button>
                        </div>
                        
                        <div class="view-controls">
                            <button class="view-btn active" data-view="combined" title="결합형">
                                <i class="fas fa-columns"></i>
                            </button>
                            <button class="view-btn" data-view="bids-only" title="매수만">
                                <i class="fas fa-arrow-up" style="color: #22c55e;"></i>
                            </button>
                            <button class="view-btn" data-view="asks-only" title="매도만">
                                <i class="fas fa-arrow-down" style="color: #ef4444;"></i>
                            </button>
                    </div>
                    </div>
                    </div>

                <!-- 로딩 상태 -->
                <div class="orderbook-loading-state" style="display: block;">
                    <div class="loading-spinner"></div>
                    <span>오더북 로딩 중...</span>
                </div>

                <!-- 오더북 컨테이너 -->
                <div class="professional-orderbook-container" style="display: none;">
                    <!-- 테이블 헤더 -->
                <div class="orderbook-table-header">
                        <div class="header-cell price-header">가격(USDT)</div>
                        <div class="header-cell size-header">수량(BTC)</div>
                        <div class="header-cell sum-header">누적(BTC)</div>
                </div>
                
                    <!-- 오더북 콘텐츠 -->
                <div class="orderbook-content">
                        <!-- 매도 섹션 -->
                        <div class="asks-section" id="asks-section">
                            <div class="orderbook-rows asks-rows"></div>
                    </div>
                    
                        <!-- 스프레드 정보 -->
                        <div class="spread-section">
                            <div class="current-price-info">
                                <div class="price-display">
                                    <span class="current-price">--</span>
                                    <span class="price-direction">--</span>
                                </div>
                                <div class="spread-info">
                                    <span class="spread-label">스프레드:</span>
                                    <span class="spread-value">--</span>
                                    <span class="spread-percent">(--)</span>
                                </div>
                        </div>
                    </div>
                    
                        <!-- 매수 섹션 -->
                        <div class="bids-section" id="bids-section">
                            <div class="orderbook-rows bids-rows"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.ui.isInitialized = true;
        console.log('✅ 전문 오더북 UI 생성 완료');
    }

    /**
     * 🔥 이벤트 리스너 설정 - 강화된 이벤트 처리
     */
    setupEventListeners() {
        // 정밀도 버튼 이벤트
        this.config.container.querySelectorAll('.precision-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const precision = parseFloat(btn.dataset.precision);
                this.changePrecision(precision);
                
                // UI 업데이트
                this.config.container.querySelectorAll('.precision-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // 뷰 모드 버튼 이벤트
        this.config.container.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const viewMode = btn.dataset.view;
                this.changeViewMode(viewMode);
                
                // UI 업데이트
                this.config.container.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // 페이지 가시성 변경 감지
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.handlePageVisible();
            } else {
                this.handlePageHidden();
            }
        });

        // 네트워크 상태 변경 감지
        window.addEventListener('online', () => {
            console.log('🌐 네트워크 연결 복구됨');
            this.reconnectWebSocket();
        });

        window.addEventListener('offline', () => {
            console.log('🌐 네트워크 연결 끊김');
            this.updateStatus('네트워크 끊김', 'error');
        });
    }

    /**
     * 🔥 초기 스냅샷 로드 - 향상된 에러 처리
     */
    async loadInitialSnapshot() {
        const maxRetries = 3;
        let retryCount = 0;

        while (retryCount < maxRetries) {
            try {
                this.updateStatus('스냅샷 로딩 중...', 'connecting');

                const symbol = this.config.symbol.toUpperCase();
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                const response = await fetch(`https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=1000`, {
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();

                // 데이터 유효성 검증
                if (!data.bids || !data.asks || !data.lastUpdateId) {
                    throw new Error('유효하지 않은 스냅샷 데이터');
                }

                // 오더북 데이터 초기화
                this.orderbook.bids.clear();
                this.orderbook.asks.clear();

                // 스냅샷 데이터 저장
                data.bids.forEach(([price, quantity]) => {
                    const qty = parseFloat(quantity);
                    if (qty > 0 && !isNaN(qty)) {
                        this.orderbook.bids.set(parseFloat(price), qty);
                    }
                });

                data.asks.forEach(([price, quantity]) => {
                    const qty = parseFloat(quantity);
                    if (qty > 0 && !isNaN(qty)) {
                        this.orderbook.asks.set(parseFloat(price), qty);
                    }
                });

                this.orderbook.lastUpdateId = data.lastUpdateId;
                this.orderbook.timestamp = Date.now();

                // 스프레드 계산 및 UI 업데이트
                this.calculateSpread();
                this.showOrderbookContent();
                this.updateDisplay();

                console.log(`✅ 초기 오더북 스냅샷 로드 완료: ${data.bids.length} bids, ${data.asks.length} asks`);
                return;

            } catch (error) {
                retryCount++;
                console.error(`❌ 스냅샷 로드 실패 (시도 ${retryCount}/${maxRetries}):`, error);

                if (retryCount >= maxRetries) {
                    this.updateStatus('스냅샷 로드 실패', 'error');
                    throw error;
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
            }
        }
    }

    /**
     * 🔥 오더북 콘텐츠 표시
     */
    showOrderbookContent() {
        const loadingElement = this.config.container.querySelector('.orderbook-loading-state');
        const contentElement = this.config.container.querySelector('.professional-orderbook-container');

        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        if (contentElement) {
            contentElement.style.display = 'block';
        }
    }

    /**
     * 🔥 WebSocket 연결 - 강화된 연결 관리
     */
    async connectWebSocket() {
        try {
            this.cleanupConnections();

            const symbol = this.config.symbol.toLowerCase();
            const wsUrl = `wss://stream.binance.com:9443/ws/${symbol}@depth@100ms`;

            console.log(`🔗 WebSocket 연결 시도: ${wsUrl}`);
            this.updateStatus('연결 중...', 'connecting');
            this.connection.connectionStartTime = Date.now();

            this.connection.ws = new WebSocket(wsUrl);
            this.setupWebSocketEvents();

        } catch (error) {
            console.error('❌ WebSocket 연결 실패:', error);
            this.updateStatus('연결 실패', 'error');
            this.scheduleReconnect();
        }
    }

    /**
     * 🔥 WebSocket 이벤트 설정 - 강화된 이벤트 처리
     */
    setupWebSocketEvents() {
        if (!this.connection.ws) return;

        this.connection.ws.onopen = () => {
            console.log('✅ WebSocket 연결 성공');
            this.connection.isConnected = true;
            this.connection.isSubscribed = true;
            this.connection.reconnectAttempts = 0;
            this.connection.status = 'connected';
            this.metrics.reconnectCount++;

            this.updateStatus('연결됨', 'connected');
            this.startHeartbeat();
            this.processBufferedData();

            // 건강 상태 개선
            this.healthCheck.consecutiveErrors = 0;
            this.healthCheck.lastHealthTime = Date.now();
        };

        this.connection.ws.onmessage = (event) => {
            try {
                this.connection.lastDataTime = Date.now();
                const data = JSON.parse(event.data);
                this.handleDepthUpdate(data);
            } catch (error) {
                console.error('❌ WebSocket 메시지 파싱 오류:', error);
                this.metrics.missedUpdates++;
                this.healthCheck.consecutiveErrors++;
            }
        };

        this.connection.ws.onclose = (event) => {
            console.log(`🔌 WebSocket 연결 종료: ${event.code} ${event.reason}`);
            this.connection.isConnected = false;
            this.connection.isSubscribed = false;
            this.connection.status = 'disconnected';

            this.updateStatus('연결 끊김', 'disconnected');
            this.stopHeartbeat();

            if (!event.wasClean && !this.isDestroyed &&
                this.connection.reconnectAttempts < this.config.maxReconnectAttempts) {
                this.scheduleReconnect();
            }
        };

        this.connection.ws.onerror = (error) => {
            console.error('❌ WebSocket 오류:', error);
            this.connection.status = 'error';
            this.updateStatus('연결 오류', 'error');
            this.metrics.errorCount++;
            this.healthCheck.consecutiveErrors++;
        };
    }

    /**
     * 🔥 하트비트 시작
     */
    startHeartbeat() {
        this.stopHeartbeat();

        this.connection.heartbeatInterval = setInterval(() => {
            if (this.connection.ws && this.connection.ws.readyState === WebSocket.OPEN) {
                const now = Date.now();
                const timeSinceLastData = now - this.connection.lastDataTime;

                // 30초 이상 데이터가 없으면 연결 재시도
                if (timeSinceLastData > 30000) {
                    console.warn('⚠️ 하트비트 실패 - 연결 재시도');
                    this.reconnectWebSocket();
                }
            }
        }, this.config.heartbeatInterval);
    }

    /**
     * 🔥 하트비트 중지
     */
    stopHeartbeat() {
        if (this.connection.heartbeatInterval) {
            clearInterval(this.connection.heartbeatInterval);
            this.connection.heartbeatInterval = null;
        }
    }

    /**
     * 🔥 건강 상태 체크 시작
     */
    startHealthCheck() {
        setInterval(() => {
            if (this.isDestroyed) return;

            const now = Date.now();
            const timeSinceLastHealth = now - this.healthCheck.lastHealthTime;

            if (timeSinceLastHealth > 60000) {
                this.performHealthCheck();
                this.healthCheck.lastHealthTime = now;
            }
        }, 60000);
    }

    /**
     * 🔥 건강 상태 체크 수행
     */
    performHealthCheck() {
        const issues = [];

        if (!this.connection.isConnected) {
            issues.push('WebSocket 연결 끊김');
        }

        const timeSinceLastUpdate = Date.now() - this.orderbook.timestamp;
        if (timeSinceLastUpdate > 30000) {
            issues.push('데이터 업데이트 중단');
        }

        if (this.healthCheck.consecutiveErrors > 3) {
            issues.push('높은 에러율');
        }

        if (this.orderbook.bids.size === 0 || this.orderbook.asks.size === 0) {
            issues.push('오더북 데이터 없음');
        }

        if (issues.length > 0) {
            console.warn('⚠️ 오더북 건강 상태 문제:', issues);
            if (issues.length >= 2) {
                this.restartOrderbook();
            }
        } else {
            console.log('✅ 오더북 건강 상태 양호');
        }
    }

    /**
     * 🔥 오더북 재시작
     */
    async restartOrderbook() {
        console.log('🔄 오더북 재시작 중...');

        this.cleanupConnections();
        this.orderbook.bids.clear();
        this.orderbook.asks.clear();
        this.dataBuffer = [];
        this.healthCheck.consecutiveErrors = 0;

        await this.initialize();
    }

    /**
     * 🔥 깊이 업데이트 처리
     */
    handleDepthUpdate(data) {
        try {
            if (data.e !== 'depthUpdate') return;

            const startTime = performance.now();

            // 데이터 유효성 검증
            if (!data.u || !data.U || (!data.b && !data.a)) {
                console.warn('⚠️ 유효하지 않은 깊이 업데이트 데이터');
                return;
            }

            // 성능 메트릭스 업데이트
            this.updatePerformanceMetrics(data.E);

            // 순서 검증
            if (data.u <= this.orderbook.lastUpdateId) {
                return;
            }

            // 연속성 검증
            if (data.U > this.orderbook.lastUpdateId + 1) {
                console.warn(`⚠️ 업데이트 누락 감지: ${this.orderbook.lastUpdateId} -> ${data.U}`);
                this.metrics.missedUpdates++;
                this.bufferDataAndResync(data);
                return;
            }

            // 오더북 업데이트
            this.updateOrderbookData(data);

            // 처리 시간 기록
            const processingTime = performance.now() - startTime;
            if (processingTime > 20) {
                console.warn(`⚠️ 느린 업데이트 처리: ${processingTime.toFixed(2)}ms`);
            }

        } catch (error) {
            console.error('❌ 깊이 업데이트 처리 오류:', error);
            this.metrics.missedUpdates++;
            this.healthCheck.consecutiveErrors++;

            if (this.healthCheck.consecutiveErrors >= 3) {
                this.restartOrderbook();
            }
        }
    }

    /**
     * 🔥 오더북 데이터 업데이트
     */
    updateOrderbookData(data) {
        try {
            // Bids 업데이트
            if (data.b && Array.isArray(data.b)) {
                data.b.forEach(([price, quantity]) => {
                    const priceFloat = parseFloat(price);
                    const quantityFloat = parseFloat(quantity);

                    if (isNaN(priceFloat) || isNaN(quantityFloat) || priceFloat <= 0) {
                        return;
                    }

                    if (quantityFloat === 0) {
                        this.orderbook.bids.delete(priceFloat);
                    } else {
                        this.orderbook.bids.set(priceFloat, quantityFloat);
                    }
                });
            }

            // Asks 업데이트
            if (data.a && Array.isArray(data.a)) {
                data.a.forEach(([price, quantity]) => {
                    const priceFloat = parseFloat(price);
                    const quantityFloat = parseFloat(quantity);

                    if (isNaN(priceFloat) || isNaN(quantityFloat) || priceFloat <= 0) {
                        return;
                    }

                    if (quantityFloat === 0) {
                        this.orderbook.asks.delete(priceFloat);
                    } else {
                        this.orderbook.asks.set(priceFloat, quantityFloat);
                    }
                });
            }

            // 메타데이터 업데이트
            this.orderbook.lastUpdateId = data.u;
            this.orderbook.timestamp = Date.now();

            // 스프레드 계산 및 UI 업데이트
            this.calculateSpread();
            this.throttledUpdateDisplay();

            // 건강 상태 개선
            this.healthCheck.consecutiveErrors = Math.max(0, this.healthCheck.consecutiveErrors - 1);
            
        } catch (error) {
            console.error('❌ 오더북 데이터 업데이트 오류:', error);
            this.healthCheck.consecutiveErrors++;
        }
    }

    // 오더북 사이드 렌더링
    renderOrderbookSide(side, orders, isAsk) {
        const container = this.config.container.querySelector(`.${side}-rows`);
        if (!container) return;
        
        // 뷰 모드에 따른 표시 여부 결정
        const shouldShow = this.ui.viewMode === 'combined' || 
                          (this.ui.viewMode === 'bids-only' && !isAsk) ||
                          (this.ui.viewMode === 'asks-only' && isAsk);
        
        const section = this.config.container.querySelector(`#${side}-section`);
        if (section) {
            section.style.display = shouldShow ? 'block' : 'none';
        }
        
        if (!shouldShow) return;
        
        // 누적 수량 계산
        let cumulative = 0;
        const processedOrders = orders.map(([price, quantity]) => {
            cumulative += quantity;
            return { price, quantity, cumulative };
        });
        
        const maxCumulative = cumulative;
        
        // HTML 생성 - 더 강화된 깊이 시각화
        container.innerHTML = processedOrders.map(order => {
            const depthPercent = maxCumulative > 0 ? (order.cumulative / maxCumulative) * 100 : 0;
            const priceClass = isAsk ? 'ask-price' : 'bid-price';
            
            return `
                <div class="orderbook-row ${side}-row" data-price="${order.price}">
                    <div class="depth-background ${isAsk ? 'ask-depth' : 'bid-depth'}" 
                         style="width: ${depthPercent}%"></div>
                    <div class="order-data">
                        <div class="price-cell ${priceClass}">${this.formatPrice(order.price)}</div>
                        <div class="size-cell">${this.formatQuantity(order.quantity)}</div>
                        <div class="sum-cell">${this.formatQuantity(order.cumulative)}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        // 행 클릭 이벤트 설정
        this.setupRowClickEvents(container);
    }

    // 기존의 나머지 메서드들 유지...
    calculateSpread() {
        const bids = Array.from(this.orderbook.bids.keys()).sort((a, b) => b - a);
        const asks = Array.from(this.orderbook.asks.keys()).sort((a, b) => a - b);
        
        if (bids.length > 0 && asks.length > 0) {
            this.orderbook.bestBid = bids[0];
            this.orderbook.bestAsk = asks[0];
            this.orderbook.spread = this.orderbook.bestAsk - this.orderbook.bestBid;
        } else {
            this.orderbook.bestBid = 0;
            this.orderbook.bestAsk = 0;
            this.orderbook.spread = 0;
        }
    }

    throttledUpdateDisplay() {
        const now = Date.now();
        if (now - this.ui.lastRenderTime >= this.ui.renderThrottle) {
            this.updateDisplay();
            this.ui.lastRenderTime = now;
        }
    }

    updateDisplay() {
        if (!this.ui.isInitialized || this.isDestroyed) return;

        try {
            this.updatePriceInfo();
            this.updateOrderbookSides();
        } catch (error) {
            console.error('❌ 디스플레이 업데이트 오류:', error);
        }
    }

    updatePriceInfo() {
        const spreadInfo = this.config.container.querySelector('.current-price-info');
        if (!spreadInfo) return;

        const currentPrice = (this.orderbook.bestBid + this.orderbook.bestAsk) / 2;
        const priceElement = spreadInfo.querySelector('.current-price');
        const spreadValueElement = spreadInfo.querySelector('.spread-value');
        const spreadPercentElement = spreadInfo.querySelector('.spread-percent');

        if (priceElement) {
            priceElement.textContent = this.formatPrice(currentPrice);
        }

        if (spreadValueElement) {
            spreadValueElement.textContent = this.formatPrice(this.orderbook.spread);
        }

        if (spreadPercentElement) {
            const spreadPercent = (this.orderbook.spread / this.orderbook.bestBid) * 100;
            spreadPercentElement.textContent = `(${spreadPercent.toFixed(3)}%)`;
        }
    }

    updateOrderbookSides() {
        // 매도 주문 (역순으로 정렬하여 높은 가격부터 표시)
        const askOrders = Array.from(this.orderbook.asks.entries())
            .sort((a, b) => b[0] - a[0])
            .slice(0, this.config.maxDepth);
        
        // 매수 주문 (높은 가격부터 표시)
        const bidOrders = Array.from(this.orderbook.bids.entries())
            .sort((a, b) => b[0] - a[0])
            .slice(0, this.config.maxDepth);
            
        this.renderOrderbookSide('asks', askOrders, true);
        this.renderOrderbookSide('bids', bidOrders, false);
    }

    setupRowClickEvents(container) {
        container.querySelectorAll('.orderbook-row').forEach(row => {
            row.addEventListener('click', () => {
                const price = parseFloat(row.dataset.price);
                this.selectPrice(price);
            });
        });
    }

    selectPrice(price) {
        console.log(`🎯 오더북 가격 선택: ${price}`);
        
        // 시각적 피드백
        this.config.container.querySelectorAll('.orderbook-row').forEach(row => {
            row.classList.remove('selected');
        });
        
        const selectedRow = this.config.container.querySelector(`[data-price="${price}"]`);
        if (selectedRow) {
            selectedRow.classList.add('selected');
            selectedRow.classList.add('price-flash');
            setTimeout(() => selectedRow.classList.remove('price-flash'), 500);
        }

        // 커스텀 이벤트 발송
        document.dispatchEvent(new CustomEvent('orderbook-price-selected', {
            detail: { price, timestamp: Date.now() }
        }));
    }

    changePrecision(precision) {
        this.ui.precision = precision;
        console.log(`🎯 오더북 정밀도 변경: ${precision}`);
        this.updateDisplay();
    }

    changeViewMode(viewMode) {
        this.ui.viewMode = viewMode;
        console.log(`🎯 오더북 뷰 모드 변경: ${viewMode}`);
        this.updateDisplay();
    }

    updateStatus(message, status) {
        this.connection.status = status;
        
        const statusIndicator = this.config.container.querySelector('.status-indicator');
        const statusText = this.config.container.querySelector('.status-text');
        
        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${status}`;
        }
        
        if (statusText) {
            statusText.textContent = message;
        }

        console.log(`📊 오더북 상태: ${status} - ${message}`);
    }

    updatePerformanceMetrics(eventTime) {
        const now = Date.now();
        
        this.metrics.updateCount++;
        this.metrics.lastUpdateTime = now;
        
        if (eventTime) {
            const latency = now - eventTime;
            this.metrics.averageLatency = (this.metrics.averageLatency + latency) / 2;
        }

        // 초당 메시지 수 계산
        if (now - this.metrics.lastSecondTime >= 1000) {
            this.metrics.messagesPerSecond = this.metrics.lastSecondCount;
            this.metrics.lastSecondCount = 0;
            this.metrics.lastSecondTime = now;
        } else {
            this.metrics.lastSecondCount++;
        }
    }

    startPerformanceMonitoring() {
        setInterval(() => {
            if (this.connection.isConnected && !this.isDestroyed) {
                console.log(`📊 오더북 성능 메트릭스:`, {
                    updates: this.metrics.updateCount,
                    avgLatency: `${this.metrics.averageLatency.toFixed(2)}ms`,
                    messagesPerSec: this.metrics.messagesPerSecond,
                    missedUpdates: this.metrics.missedUpdates,
                    errors: this.metrics.errorCount,
                    reconnects: this.metrics.reconnectCount
                });
            }
        }, 30000);
    }

    cleanupConnections() {
        if (this.connection.ws) {
            this.connection.ws.close();
            this.connection.ws = null;
        }
        
        this.stopHeartbeat();
        this.connection.isConnected = false;
        this.connection.isSubscribed = false;
    }

    scheduleReconnect() {
        if (this.isDestroyed) return;
        
        if (this.connection.reconnectAttempts >= this.config.maxReconnectAttempts) {
            console.error('❌ 최대 재연결 시도 횟수 초과');
            this.updateStatus('연결 실패', 'error');
            
            setTimeout(() => {
                if (!this.isDestroyed) {
                    this.restartOrderbook();
                }
            }, 30000);
            return;
        }
        
        this.connection.reconnectAttempts++;
        this.connection.status = 'reconnecting';
        
        const baseDelay = this.config.reconnectDelay * Math.pow(2, this.connection.reconnectAttempts - 1);
        const jitter = Math.random() * 1000;
        const delay = Math.min(baseDelay + jitter, 30000);
        
        console.log(`🔄 ${Math.round(delay)}ms 후 재연결 시도 (${this.connection.reconnectAttempts}/${this.config.maxReconnectAttempts})`);
        this.updateStatus(`재연결 중... (${this.connection.reconnectAttempts}/${this.config.maxReconnectAttempts})`, 'reconnecting');
        
        setTimeout(() => {
            if (!this.isDestroyed) {
                this.connectWebSocket();
            }
        }, delay);
    }

    reconnectWebSocket() {
        this.connection.reconnectAttempts = 0;
        this.connectWebSocket();
    }

    bufferDataAndResync(data) {
        this.dataBuffer.push(data);
        
        if (!this.isProcessingBuffer) {
            this.isProcessingBuffer = true;
            setTimeout(() => {
                this.resyncOrderbook();
            }, 1000);
        }
    }

    async resyncOrderbook() {
        try {
            console.log('🔄 오더북 재동기화 시작');
            this.updateStatus('재동기화 중...', 'connecting');
            
            await this.loadInitialSnapshot();
            this.processBufferedData();
            
            this.updateStatus('연결됨', 'connected');
            console.log('✅ 오더북 재동기화 완료');
            
        } catch (error) {
            console.error('❌ 오더북 재동기화 실패:', error);
            this.updateStatus('재동기화 실패', 'error');
        } finally {
            this.isProcessingBuffer = false;
        }
    }

    processBufferedData() {
        if (this.dataBuffer.length === 0) return;
        
        console.log(`🔄 버퍼된 데이터 처리: ${this.dataBuffer.length}개`);
        
        this.dataBuffer.sort((a, b) => a.U - b.U);
        
        this.dataBuffer.forEach(data => {
            if (data.U <= this.orderbook.lastUpdateId + 1) {
                this.updateOrderbookData(data);
            }
        });
        
        this.dataBuffer = [];
    }

    handlePageVisible() {
        if (!this.connection.isConnected) {
            console.log('🔄 페이지 활성화 - WebSocket 재연결 시도');
            this.reconnectWebSocket();
        }
    }

    handlePageHidden() {
        console.log('⏸️ 페이지 비활성화');
    }

    formatPrice(price) {
        if (!price || isNaN(price)) return '--';
        
        if (this.ui.precision >= 1) {
            return Math.round(price / this.ui.precision) * this.ui.precision;
        } else {
            const decimals = Math.abs(Math.log10(this.ui.precision));
            return (Math.round(price / this.ui.precision) * this.ui.precision).toFixed(decimals);
        }
    }

    formatQuantity(quantity) {
        if (!quantity || isNaN(quantity)) return '--';
        
        if (quantity >= 1) {
            return quantity.toFixed(3);
        } else {
            return quantity.toFixed(6);
        }
    }

    handleError(error) {
        console.error('❌ 오더북 오류:', error);
        this.updateStatus('오류 발생', 'error');
        this.metrics.errorCount++;
        
        setTimeout(() => {
            if (this.connection.status === 'error' && !this.isDestroyed) {
                this.restartOrderbook();
            }
        }, 5000);
    }

    destroy() {
        console.log('🧹 전문 오더북 정리 중...');
        
        this.isDestroyed = true;
        this.cleanupConnections();
        
        this.orderbook.bids.clear();
        this.orderbook.asks.clear();
        this.dataBuffer = [];
        
        console.log('✅ 전문 오더북 정리 완료');
    }
}