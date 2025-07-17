/**
 * 🚀 전문 오더북 트래커 (Professional Orderbook Tracker)
 * 거래소 수준의 안정적인 실시간 오더북 시스템
 * 
 * 주요 기능:
 * - 안정적인 WebSocket 연결 관리
 * - 실시간 데이터 동기화
 * - 전문적인 UI/UX
 * - 성능 최적화
 * - 강화된 에러 복구 시스템
 */

export class OrderbookTracker {
    constructor(options = {}) {
        this.config = {
            symbol: options.symbol || 'BTCUSDT',
            maxDepth: options.maxDepth || 15,
            precision: options.precision || 0.1,
            updateInterval: options.updateInterval || 100,
            reconnectDelay: options.reconnectDelay || 1000,
            maxReconnectAttempts: options.maxReconnectAttempts || 10,
            enablePriceGrouping: options.enablePriceGrouping || true,
            heartbeatInterval: options.heartbeatInterval || 30000,
            ...options
        };

        // 오더북 데이터 구조
        this.orderbook = {
            bids: new Map(), // price -> quantity
            asks: new Map(),
            lastUpdateId: 0,
            timestamp: 0,
            spread: 0,
            spreadPercent: 0,
            bestBid: 0,
            bestAsk: 0
        };

        // WebSocket 연결 관리 - 강화된 상태 관리
        this.connection = {
            ws: null,
            isConnected: false,
            isSubscribed: false,
            reconnectAttempts: 0,
            status: 'disconnected', // disconnected, connecting, connected, error, reconnecting
            lastPingTime: 0,
            pingInterval: null,
            heartbeatInterval: null,
            connectionStartTime: 0,
            lastDataTime: 0
        };

        // 성능 메트릭스
        this.metrics = {
            updateCount: 0,
            lastUpdateTime: 0,
            averageLatency: 0,
            missedUpdates: 0,
            connectionUptime: 0,
            messagesPerSecond: 0,
            lastSecondCount: 0,
            lastSecondTime: Date.now(),
            errorCount: 0,
            reconnectCount: 0
        };

        // UI 요소 및 상태
        this.ui = {
            container: null,
            asksContainer: null,
            bidsContainer: null,
            spreadInfo: null,
            statusIndicator: null,
            precisionSelector: null,
            isInitialized: false,
            lastRenderTime: 0,
            renderThrottle: 50,
            animationFrame: null
        };

        // 가격 그룹핑 설정
        this.priceGrouping = {
            enabled: this.config.enablePriceGrouping,
            levels: [0.01, 0.1, 1, 10, 100], // USDT 기준
            currentLevel: this.config.precision
        };

        // 데이터 버퍼 및 안정성 개선
        this.dataBuffer = [];
        this.isProcessingBuffer = false;
        this.healthCheck = {
            lastHealthTime: Date.now(),
            consecutiveErrors: 0,
            maxConsecutiveErrors: 5
        };

        // 초기화 상태 관리
        this.isDestroyed = false;
        this.initializationAttempts = 0;
        this.maxInitializationAttempts = 3;

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

        this.initializationAttempts++;
        
        try {
            console.log(`🔄 오더북 트래커 초기화 중... (시도 ${this.initializationAttempts}/${this.maxInitializationAttempts})`, this.config);
            
            await this.initializeElements();
        this.setupEventListeners();
            await this.loadInitialSnapshot();
            await this.connectWebSocket();
            this.startPerformanceMonitoring();
            this.startHealthCheck();
            
            console.log('✅ 오더북 트래커 초기화 완료');
            this.initializationAttempts = 0; // 성공 시 리셋
            
        } catch (error) {
            console.error(`❌ 오더북 트래커 초기화 실패 (시도 ${this.initializationAttempts}):`, error);
            this.handleInitializationError(error);
        }
    }

    /**
     * 🔥 초기화 에러 처리
     */
    handleInitializationError(error) {
        this.metrics.errorCount++;
        
        if (this.initializationAttempts < this.maxInitializationAttempts) {
            const delay = 2000 * this.initializationAttempts; // 점진적 지연
            console.log(`🔄 ${delay}ms 후 초기화 재시도...`);
            
            setTimeout(() => {
                if (!this.isDestroyed) {
                    this.initialize();
                }
            }, delay);
        } else {
            console.error('❌ 최대 초기화 시도 횟수 초과');
            this.updateStatus('초기화 실패', 'error');
        }
    }

    /**
     * 🔥 UI 요소 초기화 - 강화된 요소 검증
     */
    async initializeElements() {
        // 컨테이너 찾기 - 여러 시도
        const containerSelectors = [
            '#professional-orderbook-container',
            '.professional-orderbook-container',
            '#orderbook-container',
            '.orderbook-container'
        ];

        for (const selector of containerSelectors) {
            this.ui.container = document.querySelector(selector);
            if (this.ui.container) break;
        }
        
        if (!this.ui.container) {
            throw new Error('오더북 컨테이너를 찾을 수 없습니다');
        }

        // UI 구조가 이미 있는지 확인
        if (!this.ui.container.querySelector('.professional-orderbook')) {
            this.createOrderbookUI();
        }

        // UI 요소 참조 설정 - 안전한 참조
        this.ui.asksContainer = this.ui.container.querySelector('.asks-rows');
        this.ui.bidsContainer = this.ui.container.querySelector('.bids-rows');
        this.ui.spreadInfo = this.ui.container.querySelector('.current-price-info');
        this.ui.statusIndicator = document.querySelector('.status-indicator');
        
        // 요소 검증
        if (!this.ui.asksContainer || !this.ui.bidsContainer) {
            throw new Error('오더북 UI 요소가 올바르게 생성되지 않았습니다');
        }
        
        this.ui.isInitialized = true;
        console.log('✅ 오더북 UI 요소 초기화 완료');
    }

    /**
     * 🔥 오더북 UI 생성
     */
    createOrderbookUI() {
        this.ui.container.innerHTML = `
            <div class="professional-orderbook">
                <!-- 오더북 컨트롤 (심플한 헤더) -->
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

                <!-- 테이블 헤더 -->
                <div class="orderbook-table-header">
                    <div class="header-cell price-header">가격(USDT)</div>
                    <div class="header-cell size-header">수량(BTC)</div>
                    <div class="header-cell sum-header">누적(BTC)</div>
                </div>
                
                <div class="orderbook-content">
                    <div class="asks-section" id="asks-section">
                        <div class="orderbook-rows asks-rows"></div>
                    </div>
                    
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
                    
                    <div class="bids-section" id="bids-section">
                        <div class="orderbook-rows bids-rows"></div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 🔥 이벤트 리스너 설정 - 안전한 이벤트 처리
     */
    setupEventListeners() {
        // 가격 그룹핑 변경 이벤트
        document.addEventListener('orderbook-precision-change', (event) => {
            this.changePrecision(event.detail.precision);
        });

        // 뷰 모드 변경 이벤트
        document.addEventListener('orderbook-view-change', (event) => {
            this.changeViewMode(event.detail.viewMode);
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

        // 오류 이벤트 전역 처리
        window.addEventListener('error', (event) => {
            if (event.error && event.error.message && 
                event.error.message.includes('orderbook')) {
                this.handleGlobalError(event.error);
            }
        });
    }

    /**
     * 🔥 전역 오류 처리
     */
    handleGlobalError(error) {
        console.error('🚨 전역 오더북 오류:', error);
        this.metrics.errorCount++;
        this.healthCheck.consecutiveErrors++;
        
        if (this.healthCheck.consecutiveErrors >= this.healthCheck.maxConsecutiveErrors) {
            console.error('❌ 연속 오류 임계값 초과, 오더북 재시작');
            this.restartOrderbook();
        }
    }

    /**
     * 🔥 오더북 재시작
     */
    async restartOrderbook() {
        console.log('🔄 오더북 재시작 중...');
        
        // 기존 연결 정리
        this.cleanupConnections();
        
        // 데이터 초기화
        this.orderbook.bids.clear();
        this.orderbook.asks.clear();
        this.dataBuffer = [];
        
        // 메트릭스 리셋
        this.healthCheck.consecutiveErrors = 0;
        this.initializationAttempts = 0;
        
        // 재초기화
        await this.initialize();
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
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃
                
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
                this.updateDisplay();
                
                console.log(`✅ 초기 오더북 스냅샷 로드 완료: ${data.bids.length} bids, ${data.asks.length} asks`);
                return; // 성공 시 루프 종료
                
            } catch (error) {
                retryCount++;
                console.error(`❌ 스냅샷 로드 실패 (시도 ${retryCount}/${maxRetries}):`, error);
                
                if (retryCount >= maxRetries) {
                    this.updateStatus('스냅샷 로드 실패', 'error');
                    throw error;
                } else {
                    // 재시도 전 대기
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
            }
        }
    }

    /**
     * 🔥 WebSocket 연결 - 강화된 연결 관리
     */
    async connectWebSocket() {
        try {
            // 기존 연결 정리
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
            this.metrics.connectionUptime = Date.now();
            this.metrics.reconnectCount++;
            
            this.updateStatus('연결됨', 'connected');
            this.startHeartbeat();
            this.processBufferedData();
            
            // 연결 성공 시 건강 상태 개선
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
            
            // 정상적인 종료가 아닌 경우에만 재연결
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
        this.stopHeartbeat(); // 기존 하트비트 정리
        
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
            
            // 1분마다 건강 상태 체크
            if (timeSinceLastHealth > 60000) {
                this.performHealthCheck();
                this.healthCheck.lastHealthTime = now;
            }
        }, 60000); // 1분마다
    }

    /**
     * 🔥 건강 상태 체크 수행
     */
    performHealthCheck() {
        const issues = [];
        
        // 연결 상태 체크
        if (!this.connection.isConnected) {
            issues.push('WebSocket 연결 끊김');
        }
        
        // 데이터 업데이트 체크
        const timeSinceLastUpdate = Date.now() - this.orderbook.timestamp;
        if (timeSinceLastUpdate > 30000) { // 30초
            issues.push('데이터 업데이트 중단');
        }
        
        // 에러율 체크
        if (this.healthCheck.consecutiveErrors > 3) {
            issues.push('높은 에러율');
        }
        
        // 오더북 데이터 유효성 체크
        if (this.orderbook.bids.size === 0 || this.orderbook.asks.size === 0) {
            issues.push('오더북 데이터 없음');
        }
        
        if (issues.length > 0) {
            console.warn('⚠️ 오더북 건강 상태 문제:', issues);
            
            // 심각한 문제가 있으면 재시작
            if (issues.length >= 2) {
                this.restartOrderbook();
            }
        } else {
            console.log('✅ 오더북 건강 상태 양호');
        }
    }

    /**
     * 🔥 깊이 업데이트 처리 - 향상된 검증
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
                return; // 이미 처리된 업데이트 무시
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
            if (processingTime > 20) { // 20ms 이상 걸리면 로그
                console.warn(`⚠️ 느린 업데이트 처리: ${processingTime.toFixed(2)}ms`);
            }
            
        } catch (error) {
            console.error('❌ 깊이 업데이트 처리 오류:', error);
            this.metrics.missedUpdates++;
            this.healthCheck.consecutiveErrors++;
            
            // 치명적 오류가 반복되면 재시작
            if (this.healthCheck.consecutiveErrors >= 3) {
                this.restartOrderbook();
            }
        }
    }

    /**
     * 🔥 오더북 데이터 업데이트 - 안전한 데이터 처리
     */
    updateOrderbookData(data) {
        try {
            // Bids 업데이트
            if (data.b && Array.isArray(data.b)) {
                data.b.forEach(([price, quantity]) => {
                    const priceFloat = parseFloat(price);
                    const quantityFloat = parseFloat(quantity);
                    
                    if (isNaN(priceFloat) || isNaN(quantityFloat) || priceFloat <= 0) {
                        return; // 유효하지 않은 데이터 무시
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
                        return; // 유효하지 않은 데이터 무시
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
            
            // 스프레드 계산 및 UI 업데이트 (스로틀링 적용)
            this.calculateSpread();
            this.throttledUpdateDisplay();
            
            // 건강 상태 개선
            this.healthCheck.consecutiveErrors = Math.max(0, this.healthCheck.consecutiveErrors - 1);
            
        } catch (error) {
            console.error('❌ 오더북 데이터 업데이트 오류:', error);
            this.healthCheck.consecutiveErrors++;
        }
    }

    /**
     * 🔥 연결 정리
     */
    cleanupConnections() {
        if (this.connection.ws) {
            this.connection.ws.close();
            this.connection.ws = null;
        }
        
        this.stopHeartbeat();
        this.connection.isConnected = false;
        this.connection.isSubscribed = false;
    }

    /**
     * 🔥 재연결 스케줄링 - 향상된 재연결 로직
     */
    scheduleReconnect() {
        if (this.isDestroyed) return;
        
        if (this.connection.reconnectAttempts >= this.config.maxReconnectAttempts) {
            console.error('❌ 최대 재연결 시도 횟수 초과');
            this.updateStatus('연결 실패', 'error');
            
            // 최대 시도 후 완전 재시작
            setTimeout(() => {
                if (!this.isDestroyed) {
                    this.restartOrderbook();
                }
            }, 30000); // 30초 후
            return;
        }

        this.connection.reconnectAttempts++;
        this.connection.status = 'reconnecting';
        
        // 지수 백오프 + 지터
        const baseDelay = this.config.reconnectDelay * Math.pow(2, this.connection.reconnectAttempts - 1);
        const jitter = Math.random() * 1000; // 0-1초 랜덤 지연
        const delay = Math.min(baseDelay + jitter, 30000); // 최대 30초
        
        console.log(`🔄 ${Math.round(delay)}ms 후 재연결 시도 (${this.connection.reconnectAttempts}/${this.config.maxReconnectAttempts})`);
        this.updateStatus(`재연결 중... (${this.connection.reconnectAttempts}/${this.config.maxReconnectAttempts})`, 'reconnecting');
        
        setTimeout(() => {
            if (!this.isDestroyed) {
                this.connectWebSocket();
            }
        }, delay);
    }

    // 기존 메서드들 유지 (스프레드 계산, 디스플레이 업데이트 등)
    calculateSpread() {
        const bids = Array.from(this.orderbook.bids.keys()).sort((a, b) => b - a);
        const asks = Array.from(this.orderbook.asks.keys()).sort((a, b) => a - b);
        
        if (bids.length > 0 && asks.length > 0) {
            this.orderbook.bestBid = bids[0];
            this.orderbook.bestAsk = asks[0];
            this.orderbook.spread = this.orderbook.bestAsk - this.orderbook.bestBid;
            this.orderbook.spreadPercent = (this.orderbook.spread / this.orderbook.bestBid) * 100;
        } else {
            this.orderbook.bestBid = 0;
            this.orderbook.bestAsk = 0;
            this.orderbook.spread = 0;
            this.orderbook.spreadPercent = 0;
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
            // 현재 가격 정보 업데이트
            this.updatePriceInfo();
            
            // 오더북 사이드 업데이트
            this.updateOrderbookSide('asks');
            this.updateOrderbookSide('bids');
                } catch (error) {
            console.error('❌ 디스플레이 업데이트 오류:', error);
        }
    }

    updatePriceInfo() {
        if (!this.ui.spreadInfo) return;

        const currentPrice = (this.orderbook.bestBid + this.orderbook.bestAsk) / 2;
        const priceElement = this.ui.spreadInfo.querySelector('.current-price');
        const spreadValueElement = this.ui.spreadInfo.querySelector('.spread-value');
        const spreadPercentElement = this.ui.spreadInfo.querySelector('.spread-percent');

        if (priceElement) {
            priceElement.textContent = this.formatPrice(currentPrice);
        }

        if (spreadValueElement) {
            spreadValueElement.textContent = this.formatPrice(this.orderbook.spread);
        }

        if (spreadPercentElement) {
            spreadPercentElement.textContent = `(${this.orderbook.spreadPercent.toFixed(3)}%)`;
        }
    }

    updateOrderbookSide(side) {
        const isAsk = side === 'asks';
        const container = isAsk ? this.ui.asksContainer : this.ui.bidsContainer;
        if (!container) return;

        try {
            const orders = this.getGroupedOrders(side);
            const maxDepth = Math.min(orders.length, this.config.maxDepth);
            const displayOrders = orders.slice(0, maxDepth);

            if (isAsk) {
                displayOrders.reverse(); // asks는 역순으로 표시
            }

            // 누적 수량 계산
            let cumulative = 0;
            const ordersWithCumulative = displayOrders.map(order => {
                cumulative += order.quantity;
                return { ...order, cumulative };
            });

            const maxCumulative = cumulative;

            // HTML 생성
            const html = ordersWithCumulative.map(order => {
                const depthPercent = maxCumulative > 0 ? (order.cumulative / maxCumulative) * 100 : 0;
                const priceClass = isAsk ? 'ask-price' : 'bid-price';
                const depthClass = isAsk ? 'ask-depth' : 'bid-depth';
                
                return `
                    <div class="orderbook-row ${side}-row" data-price="${order.price}">
                        <div class="depth-background ${depthClass}" style="width: ${depthPercent}%"></div>
                        <div class="order-data">
                            <div class="price-cell ${priceClass}">${this.formatPrice(order.price)}</div>
                            <div class="size-cell">${this.formatQuantity(order.quantity)}</div>
                            <div class="sum-cell">${this.formatQuantity(order.cumulative)}</div>
                        </div>
                    </div>
                `;
            }).join('');

            container.innerHTML = html;

            // 클릭 이벤트 설정
            this.setupRowClickEvents(container);
        } catch (error) {
            console.error(`❌ ${side} 사이드 업데이트 오류:`, error);
        }
    }

    getGroupedOrders(side) {
        const isAsk = side === 'asks';
        const orderMap = isAsk ? this.orderbook.asks : this.orderbook.bids;
        
        if (!this.priceGrouping.enabled) {
            // 그룹핑 없이 원본 데이터 반환
            return Array.from(orderMap.entries())
                .map(([price, quantity]) => ({ price, quantity }))
                .sort((a, b) => isAsk ? a.price - b.price : b.price - a.price);
        }

        // 가격 그룹핑 적용
        const groupedOrders = new Map();
        const groupSize = this.priceGrouping.currentLevel;

        orderMap.forEach((quantity, price) => {
            const groupedPrice = Math.floor(price / groupSize) * groupSize;
            const existing = groupedOrders.get(groupedPrice) || 0;
            groupedOrders.set(groupedPrice, existing + quantity);
        });

        return Array.from(groupedOrders.entries())
            .map(([price, quantity]) => ({ price, quantity }))
            .sort((a, b) => isAsk ? a.price - b.price : b.price - a.price);
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
        document.querySelectorAll('.orderbook-row').forEach(row => {
            row.classList.remove('selected');
        });
        
        const selectedRow = document.querySelector(`[data-price="${price}"]`);
        if (selectedRow) {
            selectedRow.classList.add('selected');
            
            // 플래시 효과
            selectedRow.classList.add('price-flash');
            setTimeout(() => selectedRow.classList.remove('price-flash'), 500);
        }

        // 커스텀 이벤트 발송
        document.dispatchEvent(new CustomEvent('orderbook-price-selected', {
            detail: { price, timestamp: Date.now() }
        }));
    }

    changePrecision(precision) {
        this.priceGrouping.currentLevel = precision;
        this.config.precision = precision;
        console.log(`🎯 오더북 정밀도 변경: ${precision}`);
        this.updateDisplay();
    }

    changeViewMode(viewMode) {
        console.log(`🎯 오더북 뷰 모드 변경: ${viewMode}`);
        
        const asksSection = document.getElementById('asks-section');
        const bidsSection = document.getElementById('bids-section');
        
        if (!asksSection || !bidsSection) return;
        
        switch (viewMode) {
            case 'combined':
                asksSection.style.display = 'block';
                bidsSection.style.display = 'block';
                break;
            case 'bids-only':
                asksSection.style.display = 'none';
                bidsSection.style.display = 'block';
                break;
            case 'asks-only':
                asksSection.style.display = 'block';
                bidsSection.style.display = 'none';
                break;
        }
    }

    updateStatus(message, status) {
        this.connection.status = status;
        
        if (this.ui.statusIndicator) {
            this.ui.statusIndicator.className = `status-indicator ${status}`;
        }

        const statusText = document.querySelector('.status-text');
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
                    reconnects: this.metrics.reconnectCount,
                    uptime: `${((Date.now() - this.metrics.connectionUptime) / 1000).toFixed(0)}s`
                });
            }
        }, 30000); // 30초마다 로그
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
        
        // 순서대로 정렬
        this.dataBuffer.sort((a, b) => a.U - b.U);
        
        // 유효한 데이터만 처리
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
        // 필요시 연결 일시 중지 등의 로직 구현
        console.log('⏸️ 페이지 비활성화');
    }

    formatPrice(price) {
        if (!price || isNaN(price)) return '--';
        
        if (this.config.precision >= 1) {
            return Math.round(price / this.config.precision) * this.config.precision;
        } else {
            const decimals = Math.abs(Math.log10(this.config.precision));
            return (Math.round(price / this.config.precision) * this.config.precision).toFixed(decimals);
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
        
        // 자동 복구 시도
        setTimeout(() => {
            if (this.connection.status === 'error' && !this.isDestroyed) {
                this.restartOrderbook();
            }
        }, 5000);
    }

    destroy() {
        console.log('🧹 오더북 트래커 정리 중...');
        
        this.isDestroyed = true;
        
        // WebSocket 연결 종료
        this.cleanupConnections();
        
        // 애니메이션 프레임 정리
        if (this.ui.animationFrame) {
            cancelAnimationFrame(this.ui.animationFrame);
        }
        
        // 데이터 정리
        this.orderbook.bids.clear();
        this.orderbook.asks.clear();
        this.dataBuffer = [];
        
        console.log('✅ 오더북 트래커 정리 완료');
    }
} 