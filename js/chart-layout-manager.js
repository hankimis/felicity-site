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

        // 헤더 HTML 생성 (탭과 레이아웃 버튼 포함)
        const headerHTML = `
            <div class="chart-layout-header">
                <div class="tab-buttons-group">
                    <button class="tab-btn active" data-tab="chart" title="차트">
                        <i class="fas fa-chart-line"></i>
                        <span>차트</span>
                    </button>
                    <button class="tab-btn" data-tab="analysis" title="분석">
                        <i class="fas fa-analytics"></i>
                        <span>분석</span>
                    </button>
                </div>
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

        // 탭 버튼 이벤트 설정
        const tabButtons = document.querySelectorAll('.tab-btn');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.changeTab(tab);
            });
        });
    }

    // 🔥 탭 변경
    changeTab(tab) {
        console.log(`🔄 탭 변경: ${tab}`);

        // 탭 버튼 활성화 상태 업데이트
        this.updateActiveTabButton(tab);
        
        // 탭 콘텐츠 업데이트
        this.updateTabContent(tab);
    }

    // 🔥 활성 탭 버튼 업데이트
    updateActiveTabButton(tab) {
        const buttons = document.querySelectorAll('.tab-btn');
        buttons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tab) {
                btn.classList.add('active');
            }
        });
    }

    // 🔥 탭 콘텐츠 업데이트
    updateTabContent(tab) {
        const chartContainer = document.getElementById('tradingview_chart');
        const chartWrapper = document.getElementById('chart-container-wrapper');

        if (tab === 'chart') {
            this.showChartContent();
        } else if (tab === 'analysis') {
            this.showAnalysisContent();
        }
    }

    // 🔥 차트 콘텐츠 표시
    showChartContent() {
        const chartContainer = document.getElementById('tradingview_chart');
        if (!chartContainer) return;

        // 기존 분석 콘텐츠 숨기기
        const analysisContent = document.querySelector('.analysis-content');
        if (analysisContent) {
            analysisContent.style.display = 'none';
        }

        // 차트 컨테이너 표시
        chartContainer.style.display = 'block';

        // 차트 초기화 (단일 차트만)
        this.initializeSingleChart();
    }

    // 🔥 분석 콘텐츠 표시
    showAnalysisContent() {
        const chartContainer = document.getElementById('tradingview_chart');
        if (!chartContainer) return;

        // 차트 컨테이너 숨기기
        chartContainer.style.display = 'none';

        // 기존 분석 콘텐츠가 있는지 확인
        let analysisContent = document.querySelector('.analysis-content');
        
        if (!analysisContent) {
            // 분석 콘텐츠 생성
            analysisContent = this.createAnalysisContent();
            chartContainer.parentNode.appendChild(analysisContent);
        }

        // 분석 콘텐츠 표시
        analysisContent.style.display = 'block';

        // 고래 추적기 초기화
        this.initializeWhaleTracker();
        
        // 오더북 초기화
        this.initializeOrderbook();
        }

    // 🔥 분석 콘텐츠 생성
    createAnalysisContent() {
        const analysisDiv = document.createElement('div');
        analysisDiv.className = 'analysis-content';
        analysisDiv.innerHTML = `
            <div class="analysis-layout">
                <div class="analysis-left-section">
                    <div class="analysis-grid">
                        <div class="analysis-card orderbook-card">
                            <div class="analysis-card-header">
                                <div class="card-header-left">
                                    <h4><i class="fas fa-layer-group"></i> 실시간 오더북</h4>
                                    <span class="orderbook-status">연결 중...</span>
                        </div>
                                <div class="card-header-right">
                                    <div class="orderbook-type-icons">
                                        <div class="icon-group">
                                            <div class="icon-item active" data-view="combined" title="결합형">
                                                <div class="icon-squares">
                                                    <div class="square red"></div>
                                                    <div class="square red"></div>
                                                    <div class="square red"></div>
                                                    <div class="square green"></div>
                                                    <div class="square green"></div>
                                                    <div class="square green"></div>
                    </div>
                        </div>
                                            <div class="icon-item" data-view="bids-only" title="매수만">
                                                <div class="icon-squares">
                                                    <div class="square green"></div>
                                                    <div class="square green"></div>
                                                    <div class="square green"></div>
                                                    <div class="square green"></div>
                                                    <div class="square green"></div>
                                                    <div class="square green"></div>
                    </div>
                </div>
                                            <div class="icon-item" data-view="asks-only" title="매도만">
                                                <div class="icon-squares">
                                                    <div class="square red"></div>
                                                    <div class="square red"></div>
                                                    <div class="square red"></div>
                                                    <div class="square red"></div>
                                                    <div class="square red"></div>
                                                    <div class="square red"></div>
                        </div>
                                </div>
                            </div>
                        </div>
                                    <div class="precision-dropdown">
                                        <select class="precision-select">
                                            <option value="0.01">10</option>
                                            <option value="0.1" selected>100</option>
                                            <option value="1">1000</option>
                                        </select>
                                        <span class="dropdown-arrow">▼</span>
                    </div>
                        </div>
                            </div>
                            <div class="orderbook-container" id="orderbook-container">
                                <div class="orderbook-loading">
                                    <i class="fas fa-spinner fa-spin"></i>
                                    <span>오더북 데이터 로딩 중...</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="analysis-card placeholder-card">
                            <div class="analysis-card-header">
                                <h4><i class="fas fa-chart-area"></i> 기술지표</h4>
                    </div>
                            <div class="card-placeholder">
                                <i class="fas fa-chart-bar"></i>
                                <p>곧 추가될 예정</p>
                            </div>
                        </div>
                        
                        <div class="analysis-card placeholder-card">
                        <div class="analysis-card-header">
                                <h4><i class="fas fa-balance-scale"></i> 롱숏 비율</h4>
                        </div>
                            <div class="card-placeholder">
                                <i class="fas fa-chart-pie"></i>
                                <p>곧 추가될 예정</p>
                            </div>
                        </div>
                        
                        <div class="analysis-card placeholder-card">
                            <div class="analysis-card-header">
                                <h4><i class="fas fa-fire"></i> 청산 맵</h4>
                    </div>
                            <div class="card-placeholder">
                                <i class="fas fa-map"></i>
                                <p>곧 추가될 예정</p>
                            </div>
                        </div>
                        
                        <div class="analysis-card placeholder-card">
                        <div class="analysis-card-header">
                                <h4><i class="fas fa-heartbeat"></i> 실시간 거래</h4>
                        </div>
                            <div class="card-placeholder">
                                <i class="fas fa-exchange-alt"></i>
                                <p>곧 추가될 예정</p>
                                </div>
                            </div>
                        
                        <div class="analysis-card placeholder-card">
                            <div class="analysis-card-header">
                                <h4><i class="fas fa-thermometer-half"></i> 마켓 히트맵</h4>
                        </div>
                            <div class="card-placeholder">
                                <i class="fas fa-th"></i>
                                <p>곧 추가될 예정</p>
                    </div>
                </div>
                        
                        <div class="analysis-card placeholder-card">
                            <div class="analysis-card-header">
                                <h4><i class="fas fa-brain"></i> 감정 분석</h4>
            </div>
                            <div class="card-placeholder">
                                <i class="fas fa-smile"></i>
                                <p>곧 추가될 예정</p>
                            </div>
                        </div>
                        
                        <div class="analysis-card placeholder-card">
                            <div class="analysis-card-header">
                                <h4><i class="fas fa-calculator"></i> 포지션 계산기</h4>
                            </div>
                            <div class="card-placeholder">
                                <i class="fas fa-calculator"></i>
                                <p>곧 추가될 예정</p>
                            </div>
                        </div>
                        
                        <div class="analysis-card placeholder-card">
                            <div class="analysis-card-header">
                                <h4><i class="fas fa-coins"></i> 미결제 약정</h4>
                            </div>
                            <div class="card-placeholder">
                                <i class="fas fa-coins"></i>
                                <p>곧 추가될 예정</p>
                            </div>
                        </div>
                        
                        <div class="analysis-card placeholder-card">
                            <div class="analysis-card-header">
                                <h4><i class="fas fa-volume-up"></i> 거래량 프로파일</h4>
                            </div>
                            <div class="card-placeholder">
                                <i class="fas fa-chart-line"></i>
                                <p>곧 추가될 예정</p>
                            </div>
                        </div>
                        
                        <div class="analysis-card placeholder-card">
                            <div class="analysis-card-header">
                                <h4><i class="fas fa-trophy"></i> 탑 퍼포머</h4>
                            </div>
                            <div class="card-placeholder">
                                <i class="fas fa-crown"></i>
                                <p>곧 추가될 예정</p>
                            </div>
                        </div>
                        
                        <div class="analysis-card placeholder-card">
                            <div class="analysis-card-header">
                                <h4><i class="fas fa-bell"></i> 알림 센터</h4>
                            </div>
                            <div class="card-placeholder">
                                <i class="fas fa-bell"></i>
                                <p>곧 추가될 예정</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="whale-tracker-section">
                    <div class="whale-container">
                        <div class="section-header">
                            <h3 class="section-title">
                                <i class="fas fa-fish"></i>
                                실시간 고래 거래
                            </h3>
                            <div class="whale-controls">
                                <span class="whale-status">연결 중...</span>
                                <button class="whale-settings-btn" id="whale-settings-btn">
                                    <i class="fas fa-cog"></i>
                                </button>
                            </div>
                        </div>
                        <div class="whale-trades-container" id="whale-trades-container">
                            <div class="whale-trades-list">
                                <!-- 고래 거래 데이터가 여기에 동적으로 추가됩니다 -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        return analysisDiv;
    }

    // 🔥 단일 차트 초기화
    initializeSingleChart() {
        try {
            if (window.layoutManager && typeof window.layoutManager.createSingleChart === 'function') {
                window.layoutManager.createSingleChart();
            } else {
                console.log('📊 단일 차트 초기화: layoutManager 사용 불가, 기본 초기화');
            }
        } catch (error) {
            console.warn('⚠️ 단일 차트 초기화 중 오류 (무시됨):', error);
        }
    }

    // 🔥 고래 추적기 초기화
    initializeWhaleTracker() {
        // 컨테이너 확인
        const whaleContainer = document.getElementById('whale-trades-container');
        if (!whaleContainer) {
            console.warn('⚠️ whale-trades-container를 찾을 수 없습니다');
            return;
            }
            
        if (window.WhaleTracker && !window.whaleTracker) {
        try {
                window.whaleTracker = new window.WhaleTracker();
                console.log('🐋 고래 추적기 초기화 완료');
                
                // 상태 업데이트
                const statusElement = document.querySelector('.whale-status');
                if (statusElement) {
                    statusElement.textContent = '연결됨';
                    statusElement.style.color = '#10b981';
            }
        } catch (error) {
                console.error('❌ 고래 추적기 초기화 실패:', error);
                
                // 에러 상태 표시
                const statusElement = document.querySelector('.whale-status');
                if (statusElement) {
                    statusElement.textContent = '연결 실패';
                    statusElement.style.color = '#ef4444';
        }
    }
        } else if (window.whaleTracker) {
            console.log('🐋 고래 추적기 이미 초기화됨');
        
            // 상태 업데이트
            const statusElement = document.querySelector('.whale-status');
            if (statusElement) {
                statusElement.textContent = '연결됨';
                statusElement.style.color = '#10b981';
            }
        } else {
            console.warn('⚠️ WhaleTracker 클래스를 찾을 수 없습니다');
        
            // 대기 상태 표시
            const statusElement = document.querySelector('.whale-status');
            if (statusElement) {
                statusElement.textContent = '로딩 중...';
                statusElement.style.color = '#f59e0b';
            }
            
            // 클래스가 로드될 때까지 재시도
            setTimeout(() => {
                if (window.WhaleTracker && !window.whaleTracker) {
                    this.initializeWhaleTracker();
        }
            }, 1000);
        }
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
        // 분석 탭이 활성화된 경우 차트 초기화 건너뛰기
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab && activeTab.dataset.tab === 'analysis') {
            console.log('📊 분석 탭 활성화됨 - 차트 초기화 건너뛰기');
            return;
        }

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

    // 🔥 오더북 초기화
    initializeOrderbook() {
        console.log('🔥 전문 오더북 시스템 초기화 시작');
        
        // 오더북 컨테이너 확인
        const orderbookContainer = document.getElementById('orderbook-container');
        if (!orderbookContainer) {
            console.warn('⚠️ 오더북 컨테이너를 찾을 수 없습니다');
            return;
        }
        
        // 전문 오더북 관리자 초기화
        this.orderBookManager = new ProfessionalOrderBookManager('BTCUSDT');
        
        // 오더북 이벤트 리스너 설정
        this.setupOrderBookEventListeners();
        
        // 오더북 시작
        setTimeout(() => {
            this.orderBookManager.start();
        }, 500);
    }
    
    // 🔥 오더북 이벤트 리스너 설정
    setupOrderBookEventListeners() {
        // 상태 변경 이벤트
        document.addEventListener('orderbook-status-change', (event) => {
            this.updateOrderbookStatus(event.detail.status, event.detail.statusClass);
        });
        
        // 데이터 업데이트 이벤트
        document.addEventListener('orderbook-data-update', (event) => {
            this.updateOrderbookDisplay(event.detail);
        });
        
        // 에러 이벤트
        document.addEventListener('orderbook-error', (event) => {
            console.error('❌ 오더북 에러:', event.detail.error);
            this.updateOrderbookStatus('에러 발생', 'error');
        });
        
        // 성능 메트릭스 이벤트
        document.addEventListener('orderbook-metrics', (event) => {
            this.updateOrderbookMetrics(event.detail);
        });
    }
    
    // 🔥 성능 메트릭스 업데이트
    updateOrderbookMetrics(metrics) {
        if (this.metricsDebugMode) {
            console.log('📊 오더북 성능 메트릭스:', {
                latency: `${metrics.latency}ms`,
                updateRate: `${metrics.updateRate}/s`,
                missedUpdates: metrics.missedUpdates,
                syncStatus: metrics.syncStatus
            });
        }
    }
    
    // 🔥 오더북 상태 업데이트
    updateOrderbookStatus(status, statusClass = '') {
        const statusElement = document.querySelector('.orderbook-status');
        if (statusElement) {
            statusElement.textContent = status;
            statusElement.className = `orderbook-status ${statusClass}`;
        }
    }
    
    // 🔥 오더북 디스플레이 업데이트 (사진과 동일한 스타일)
    updateOrderbookDisplay(data) {
        const container = document.getElementById('orderbook-container');
        if (!container || !data.bids || !data.asks) return;
        
        // 데이터 저장 (정밀도 변경시 재사용)
        this.lastOrderbookData = data;
        
        // 로딩 상태 제거
        const loading = container.querySelector('.orderbook-loading');
        if (loading) {
            loading.remove();
        }
        
        // 기존 오더북이 있으면 업데이트, 없으면 생성
        let orderbookWrapper = container.querySelector('.orderbook-wrapper');
        if (!orderbookWrapper) {
            orderbookWrapper = this.createProfessionalOrderbook();
            container.appendChild(orderbookWrapper);
        }
        
        // 현재 가격 계산
        const bestBid = parseFloat(data.bids[0][0]);
        const bestAsk = parseFloat(data.asks[0][0]);
        const currentPrice = (bestBid + bestAsk) / 2;
        
        // 가격 변화 방향 감지
        const prevPrice = this.lastPrice || currentPrice;
        const priceDirection = currentPrice > prevPrice ? '↑' : currentPrice < prevPrice ? '↓' : '';
        this.lastPrice = currentPrice;
        
        // 현재 가격 섹션 업데이트
        this.updateCurrentPriceDisplay(currentPrice, priceDirection, prevPrice);
        
        // 매도 주문 처리 (상위 7개, 역순으로 표시)
        this.updateOrderbookSide('asks', data.asks.slice(0, 7).reverse(), true);
        
        // 매수 주문 처리 (상위 7개)
        this.updateOrderbookSide('bids', data.bids.slice(0, 7), false);
    }
    
    // 🔥 현재 가격 표시 업데이트
    updateCurrentPriceDisplay(currentPrice, direction, prevPrice) {
        const priceSection = document.querySelector('.current-price-section');
        if (!priceSection) return;
        
        const priceValue = priceSection.querySelector('.price-value');
        const priceChange = priceSection.querySelector('.price-change');
        const pricePrev = priceSection.querySelector('.price-prev');
        
        if (priceValue) {
            priceValue.textContent = this.formatOrderbookPrice(currentPrice);
            // 가격 변화에 따른 색상
            if (direction === '↑') {
                priceValue.style.color = '#0ecb81';
            } else if (direction === '↓') {
                priceValue.style.color = '#f6465d';
            }
        }
        
        if (priceChange) {
            priceChange.textContent = direction;
            priceChange.style.color = direction === '↑' ? '#0ecb81' : '#f6465d';
        }
        
        if (pricePrev) {
            pricePrev.textContent = this.formatOrderbookPrice(prevPrice);
        }
    }
    
    // 🔥 오더북 사이드 업데이트 (사진과 동일한 스타일)
    updateOrderbookSide(side, orders, isAsk) {
        const listElement = document.querySelector(`.${side}-list`);
        if (!listElement) return;
        
        // 누적 수량 계산
        let cumulativeTotal = 0;
        const processedOrders = orders.map(order => {
            const price = parseFloat(order[0]);
            const size = parseFloat(order[1]);
            cumulativeTotal += size;
            return { price, size, cumulative: cumulativeTotal };
        });
        
        // 최대 누적량 계산 (깊이 바 용)
        const maxCumulative = Math.max(...processedOrders.map(o => o.cumulative));
        
        listElement.innerHTML = '';
        
        processedOrders.forEach((order, index) => {
            const depthPercent = (order.cumulative / maxCumulative) * 100;
            
            const row = document.createElement('div');
            row.className = `orderbook-row ${side}-row`;
            
            // 깊이 바 배경 설정
            const depthColor = isAsk ? 'rgba(246, 70, 93, 0.1)' : 'rgba(14, 203, 129, 0.1)';
            row.style.background = `linear-gradient(to ${isAsk ? 'left' : 'right'}, ${depthColor} ${depthPercent}%, transparent ${depthPercent}%)`;
            
            row.innerHTML = `
                <div class="order-data">
                    <div class="price-cell ${isAsk ? 'ask-price' : 'bid-price'}">
                        ${this.formatOrderbookPrice(order.price)}
                    </div>
                    <div class="size-cell">
                        ${this.formatOrderbookSize(order.size)}
                    </div>
                    <div class="sum-cell">
                        ${this.formatOrderbookSum(order.cumulative)}
                    </div>
                </div>
            `;
            
            // 행 클릭 이벤트
            row.addEventListener('click', () => {
                this.selectOrderbookPrice(order.price, isAsk);
            });
            
            listElement.appendChild(row);
        });
    }
    
    // 🔥 오더북 가격 포맷 (소수점 처리)
    formatOrderbookPrice(price) {
        return price.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    }
    
    // 🔥 오더북 수량 포맷
    formatOrderbookSize(size) {
        return size.toFixed(3);
    }
    
    // 🔥 오더북 누적 포맷
    formatOrderbookSum(sum) {
        return sum.toFixed(3);
    }
    
    // 🔥 전문적인 오더북 UI 생성 (사진과 동일한 디자인)
    createProfessionalOrderbook() {
        const wrapper = document.createElement('div');
        wrapper.className = 'orderbook-wrapper';
        wrapper.innerHTML = `
            <div class="orderbook-table">
                <div class="orderbook-table-header">
                    <div class="header-item price-header">Price (USDT)</div>
                    <div class="header-item size-header">Size (BTC)</div>
                    <div class="header-item sum-header">Sum (BTC)</div>
                </div>
                
                <div class="orderbook-content">
                    <div class="asks-section">
                        <div class="asks-list"></div>
                    </div>
                    
                    <div class="current-price-section">
                        <div class="current-price">
                            <span class="price-value">118,870.2</span>
                            <span class="price-change">↓</span>
                            <span class="price-prev">118,879.9</span>
                        </div>
                    </div>
                    
                    <div class="bids-section">
                        <div class="bids-list"></div>
                    </div>
                </div>
            </div>
        `;
        
        // 컨트롤 이벤트 설정
        this.setupOrderbookControls(wrapper);
        
        return wrapper;
    }
    
    // 🔥 오더북 헤더 업데이트
    updateOrderbookHeader(currentPrice, spread, spreadPercent, priceChange) {
        const wrapper = document.querySelector('.orderbook-wrapper');
        if (!wrapper) return;
        
        const priceValue = wrapper.querySelector('.current-price-value');
        const priceChangeEl = wrapper.querySelector('.price-change');
        const spreadValue = wrapper.querySelector('.spread-value');
        const spreadPercentEl = wrapper.querySelector('.spread-percent');
        
        // 가격 업데이트 (플래시 효과)
        if (priceValue) {
            const formattedPrice = '$' + this.formatPrice(currentPrice);
            if (priceValue.textContent !== formattedPrice) {
                priceValue.textContent = formattedPrice;
                priceValue.classList.add('price-flash');
                setTimeout(() => priceValue.classList.remove('price-flash'), 300);
            }
        }
        
        // 가격 변화 표시
        if (priceChangeEl) {
            if (priceChange > 0) {
                priceChangeEl.className = 'price-change positive';
                priceChangeEl.textContent = `+${((priceChange / (currentPrice - priceChange)) * 100).toFixed(2)}%`;
            } else if (priceChange < 0) {
                priceChangeEl.className = 'price-change negative';
                priceChangeEl.textContent = `${((priceChange / (currentPrice - priceChange)) * 100).toFixed(2)}%`;
            } else {
                priceChangeEl.className = 'price-change neutral';
                priceChangeEl.textContent = '0.00%';
            }
        }
        
        // 스프레드 정보 업데이트
        if (spreadValue) spreadValue.textContent = '$' + this.formatPrice(spread);
        if (spreadPercentEl) spreadPercentEl.textContent = `(${spreadPercent.toFixed(3)}%)`;
    }
    
    // 🔥 오더북 사이드 업데이트 (매수/매도)
    updateOrderbookSide(side, orders, isAsk) {
        const listElement = document.querySelector(`.${side}-list`);
        if (!listElement) return;
        
        // 누적 수량 계산
        let cumulativeTotal = 0;
        const maxTotal = orders.reduce((max, order) => {
            cumulativeTotal += parseFloat(order[1]);
            return Math.max(max, cumulativeTotal);
        }, 0);
        
        listElement.innerHTML = '';
        cumulativeTotal = 0;
        
        orders.forEach((order, index) => {
            const [price, quantity] = order;
            const priceNum = parseFloat(price);
            const quantityNum = parseFloat(quantity);
            cumulativeTotal += quantityNum;
            
            const total = priceNum * quantityNum;
            const depthPercent = (cumulativeTotal / maxTotal) * 100;
            
            const row = document.createElement('div');
            row.className = `orderbook-row ${side}-row`;
            row.style.setProperty('--depth-percent', `${depthPercent}%`);
            
            // 호버 효과를 위한 데이터 속성
            row.setAttribute('data-price', priceNum);
            row.setAttribute('data-quantity', quantityNum);
            
            row.innerHTML = `
                <div class="depth-bar ${isAsk ? 'ask-depth' : 'bid-depth'}"></div>
                <div class="order-data">
                    <span class="orderbook-price ${isAsk ? 'ask-price' : 'bid-price'}">${this.formatPrice(priceNum)}</span>
                    <span class="orderbook-quantity">${this.formatQuantity(quantityNum)}</span>
                    <span class="orderbook-cumulative">${this.formatQuantity(cumulativeTotal)}</span>
                </div>
            `;
            
            // 행 클릭 이벤트 (가격 선택)
            row.addEventListener('click', () => {
                this.selectOrderbookPrice(priceNum, isAsk);
            });
            
            // 호버 효과
            row.addEventListener('mouseenter', () => {
                row.classList.add('orderbook-row-hover');
            });
            
            row.addEventListener('mouseleave', () => {
                row.classList.remove('orderbook-row-hover');
            });
            
            listElement.appendChild(row);
        });
    }
    
    // 🔥 오더북 컨트롤 설정
    setupOrderbookControls(wrapper) {
        // 뷰 타입 아이콘 클릭 이벤트
        const iconItems = document.querySelectorAll('.orderbook-type-icons .icon-item');
        iconItems.forEach(item => {
            item.addEventListener('click', () => {
                // 모든 아이콘에서 active 클래스 제거
                iconItems.forEach(icon => icon.classList.remove('active'));
                // 클릭된 아이콘에 active 클래스 추가
                item.classList.add('active');
                
                const viewType = item.dataset.view;
                this.changeOrderbookView(viewType);
                console.log('🎯 오더북 뷰 변경:', viewType);
            });
        });
        
        // 정밀도 선택 드롭다운
        const precisionSelect = document.querySelector('.precision-select');
        if (precisionSelect) {
            precisionSelect.addEventListener('change', (e) => {
                const precision = parseFloat(e.target.value);
                this.currentPrecision = precision;
                console.log('🎯 오더북 정밀도 변경:', precision);
                
                // 현재 오더북 데이터 다시 렌더링
                if (this.lastOrderbookData) {
                    this.updateOrderbookDisplay(this.lastOrderbookData);
                }
            });
        }
        
        // 디버그 모드 토글 (Ctrl + Shift + O)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'O') {
                this.toggleOrderbookDebugMode();
            }
        });
    }
    
    // 🔥 디버그 모드 토글
    toggleOrderbookDebugMode() {
        this.metricsDebugMode = !this.metricsDebugMode;
        console.log(`🐛 오더북 디버그 모드: ${this.metricsDebugMode ? 'ON' : 'OFF'}`);
        
        if (this.metricsDebugMode) {
            this.showOrderbookMetrics();
        } else {
            this.hideOrderbookMetrics();
        }
    }
    
    // 🔥 메트릭스 디스플레이 표시
    showOrderbookMetrics() {
        let metricsPanel = document.querySelector('.orderbook-metrics-panel');
        if (!metricsPanel) {
            metricsPanel = document.createElement('div');
            metricsPanel.className = 'orderbook-metrics-panel';
            metricsPanel.innerHTML = `
                <div class="metrics-header">
                    <h5>📊 오더북 성능 메트릭스</h5>
                    <button class="close-metrics">×</button>
                </div>
                <div class="metrics-content">
                    <div class="metric-item">
                        <span class="metric-label">레이턴시:</span>
                        <span class="metric-value" id="latency-value">-</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">업데이트율:</span>
                        <span class="metric-value" id="update-rate-value">-</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">누락 업데이트:</span>
                        <span class="metric-value" id="missed-updates-value">-</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">동기화 상태:</span>
                        <span class="metric-value" id="sync-status-value">-</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">마지막 업데이트 ID:</span>
                        <span class="metric-value" id="last-update-id-value">-</span>
                    </div>
                </div>
            `;
            
            const orderbookCard = document.querySelector('.orderbook-card');
            if (orderbookCard) {
                orderbookCard.appendChild(metricsPanel);
            }
            
            // 닫기 버튼 이벤트
            metricsPanel.querySelector('.close-metrics').addEventListener('click', () => {
                this.hideOrderbookMetrics();
                this.metricsDebugMode = false;
            });
        }
        
        metricsPanel.style.display = 'block';
    }
    
    // 🔥 메트릭스 디스플레이 숨기기
    hideOrderbookMetrics() {
        const metricsPanel = document.querySelector('.orderbook-metrics-panel');
        if (metricsPanel) {
            metricsPanel.style.display = 'none';
        }
    }
    
    // 🔥 성능 메트릭스 업데이트 (확장)
    updateOrderbookMetrics(metrics) {
        if (this.metricsDebugMode) {
            console.log('📊 오더북 성능 메트릭스:', {
                latency: `${metrics.latency}ms`,
                updateRate: `${metrics.updateRate}/s`,
                missedUpdates: metrics.missedUpdates,
                syncStatus: metrics.syncStatus
            });
            
            // UI 업데이트
            const panel = document.querySelector('.orderbook-metrics-panel');
            if (panel && panel.style.display !== 'none') {
                document.getElementById('latency-value').textContent = `${metrics.latency}ms`;
                document.getElementById('update-rate-value').textContent = `${metrics.updateRate}/s`;
                document.getElementById('missed-updates-value').textContent = metrics.missedUpdates;
                document.getElementById('sync-status-value').textContent = metrics.syncStatus;
                
                if (this.orderBookManager) {
                    document.getElementById('last-update-id-value').textContent = 
                        this.orderBookManager.localOrderBook.lastUpdateId;
                }
            }
        }
    }
    
    // 🔥 정밀도 적용된 가격 포맷
    formatOrderbookPrice(price) {
        const precision = this.currentPrecision || 0.01;
        
        if (precision >= 1) {
            return Math.round(price / precision) * precision;
        } else {
            const decimals = Math.abs(Math.log10(precision));
            return (Math.round(price / precision) * precision).toFixed(decimals);
        }
    }
    
    // 🔥 오더북 뷰 변경
    changeOrderbookView(viewType) {
        const asksSection = document.querySelector('.asks-section');
        const bidsSection = document.querySelector('.bids-section');
        const currentPriceSection = document.querySelector('.current-price-section');
        
        if (!asksSection || !bidsSection || !currentPriceSection) return;
        
        switch (viewType) {
            case 'combined':
                asksSection.style.display = 'flex';
                bidsSection.style.display = 'flex';
                currentPriceSection.style.display = 'block';
                break;
            case 'bids-only':
                asksSection.style.display = 'none';
                bidsSection.style.display = 'flex';
                currentPriceSection.style.display = 'block';
                bidsSection.style.flex = '1';
                break;
            case 'asks-only':
                asksSection.style.display = 'flex';
                bidsSection.style.display = 'none';
                currentPriceSection.style.display = 'block';
                asksSection.style.flex = '1';
                break;
        }
    }
    
    // 🔥 오더북 가격 선택 (거래 인터페이스와 연동 가능)
    selectOrderbookPrice(price, isAsk) {
        console.log(`🎯 오더북 가격 선택: ${price} (${isAsk ? '매도' : '매수'})`);
        
        // 가격 선택 시각적 피드백
        const rows = document.querySelectorAll('.orderbook-row');
        rows.forEach(row => row.classList.remove('selected'));
        
        const selectedRow = document.querySelector(`[data-price="${price}"]`);
        if (selectedRow) {
            selectedRow.classList.add('selected');
        }
        
        // 실제 거래 인터페이스와 연동하려면 여기에 구현
        // 예: this.setTradingPrice(price, isAsk);
    }
    

    
    // 🔥 가격 포맷팅
    formatPrice(price) {
        if (price >= 100000) {
            return price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        } else {
            return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
    }
    
    // 🔥 수량 포맷팅
    formatQuantity(quantity) {
        if (quantity >= 1) {
            return quantity.toFixed(3);
        } else {
            return quantity.toFixed(6);
        }
    }
    
    // 🔥 총액 포맷팅
    formatTotal(total) {
        if (total >= 1000000) {
            return (total / 1000000).toFixed(2) + 'M';
        } else if (total >= 1000) {
            return (total / 1000).toFixed(1) + 'K';
        } else {
            return total.toFixed(0);
        }
    }

    // 🔥 레이아웃 매니저 정리
    destroy() {
        this.cleanupWidgets();
        
        // 전문 오더북 관리자 정리
        if (this.orderBookManager) {
            this.orderBookManager.destroy();
            this.orderBookManager = null;
        }
        
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

// 🚀 전문 오더북 관리자 클래스
class ProfessionalOrderBookManager {
    constructor(symbol) {
        this.symbol = symbol.toLowerCase();
        this.localOrderBook = {
            lastUpdateId: 0,
            bids: new Map(), // price -> quantity
            asks: new Map()
        };
        this.eventBuffer = [];
        this.isInitialized = false;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000;
        
        // 성능 메트릭스
        this.metrics = {
            lastUpdateTime: Date.now(),
            updateCount: 0,
            latencySum: 0,
            missedUpdates: 0,
            syncStatus: 'disconnected'
        };
        
        console.log(`🔥 전문 오더북 관리자 생성: ${symbol}`);
    }
    
    // 🔥 오더북 시스템 시작
    async start() {
        console.log('🚀 오더북 시스템 시작');
        this.emitStatusChange('초기화 중...', 'connecting');
        
        try {
            // 1단계: 스냅샷 가져오기
            await this.getSnapshot();
            
            // 2단계: WebSocket 연결
            this.connectWebSocket();
            
        } catch (error) {
            console.error('❌ 오더북 시작 실패:', error);
            this.emitError(error);
            this.scheduleReconnect();
        }
    }
    
    // 🔥 1단계: 오더북 스냅샷 가져오기
    async getSnapshot() {
        console.log('📸 오더북 스냅샷 요청');
        
        const url = `https://api.binance.com/api/v3/depth?symbol=${this.symbol.toUpperCase()}&limit=1000`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`스냅샷 요청 실패: ${response.status}`);
            }
            
            const snapshot = await response.json();
            
            // 로컬 오더북 초기화
            this.localOrderBook.lastUpdateId = snapshot.lastUpdateId;
            this.localOrderBook.bids.clear();
            this.localOrderBook.asks.clear();
            
            // 스냅샷 데이터 저장
            snapshot.bids.forEach(([price, quantity]) => {
                if (parseFloat(quantity) > 0) {
                    this.localOrderBook.bids.set(parseFloat(price), parseFloat(quantity));
                }
            });
            
            snapshot.asks.forEach(([price, quantity]) => {
                if (parseFloat(quantity) > 0) {
                    this.localOrderBook.asks.set(parseFloat(price), parseFloat(quantity));
                }
            });
            
            console.log(`✅ 스냅샷 로드 완료: ${snapshot.bids.length} bids, ${snapshot.asks.length} asks (lastUpdateId: ${snapshot.lastUpdateId})`);
            
            // 초기 UI 업데이트
            this.emitDataUpdate();
            
        } catch (error) {
            console.error('❌ 스냅샷 가져오기 실패:', error);
            throw error;
        }
    }
    
    // 🔥 2단계: WebSocket 연결
    connectWebSocket() {
        // 기존 연결 정리
        if (this.ws) {
            this.ws.close();
        }
        
        const wsUrl = `wss://stream.binance.com:9443/ws/${this.symbol}@depth`;
        console.log(`🔗 WebSocket 연결: ${wsUrl}`);
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('✅ WebSocket 연결 성공');
            this.reconnectAttempts = 0;
            this.metrics.syncStatus = 'connected';
            this.emitStatusChange('연결됨', 'connected');
            this.processBufferedEvents();
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleDepthUpdate(data);
            } catch (error) {
                console.error('❌ WebSocket 메시지 파싱 에러:', error);
            }
        };
        
        this.ws.onerror = (error) => {
            console.error('❌ WebSocket 에러:', error);
            this.metrics.syncStatus = 'error';
            this.emitError(error);
        };
        
        this.ws.onclose = (event) => {
            console.log(`🔌 WebSocket 연결 종료: ${event.code} ${event.reason}`);
            this.metrics.syncStatus = 'disconnected';
            this.emitStatusChange('연결 끊김', 'disconnected');
            this.scheduleReconnect();
        };
    }
    
    // 🔥 3단계: Depth Update 처리
    handleDepthUpdate(data) {
        if (data.e !== 'depthUpdate') return;
        
        const updateId = data.u; // 마지막 업데이트 ID
        const firstUpdateId = data.U; // 첫 번째 업데이트 ID
        
        // 성능 메트릭스 업데이트
        this.updateMetrics(data.E);
        
        if (!this.isInitialized) {
            // 초기화 과정: 이벤트 버퍼링
            this.eventBuffer.push(data);
            return;
        }
        
        // 순서 검증
        if (updateId <= this.localOrderBook.lastUpdateId) {
            // 이미 처리된 업데이트, 무시
            return;
        }
        
        if (firstUpdateId > this.localOrderBook.lastUpdateId + 1) {
            // 업데이트 누락 감지, 재동기화 필요
            console.warn(`⚠️ 업데이트 누락 감지: ${this.localOrderBook.lastUpdateId} -> ${firstUpdateId}`);
            this.metrics.missedUpdates++;
            this.resync();
            return;
        }
        
        // 로컬 오더북 업데이트
        this.updateLocalOrderBook(data);
    }
    
    // 🔥 로컬 오더북 업데이트
    updateLocalOrderBook(data) {
        // Bids 업데이트
        data.b.forEach(([price, quantity]) => {
            const priceFloat = parseFloat(price);
            const quantityFloat = parseFloat(quantity);
            
            if (quantityFloat === 0) {
                this.localOrderBook.bids.delete(priceFloat);
            } else {
                this.localOrderBook.bids.set(priceFloat, quantityFloat);
            }
        });
        
        // Asks 업데이트
        data.a.forEach(([price, quantity]) => {
            const priceFloat = parseFloat(price);
            const quantityFloat = parseFloat(quantity);
            
            if (quantityFloat === 0) {
                this.localOrderBook.asks.delete(priceFloat);
            } else {
                this.localOrderBook.asks.set(priceFloat, quantityFloat);
            }
        });
        
        // 업데이트 ID 저장
        this.localOrderBook.lastUpdateId = data.u;
        
        // UI 업데이트
        this.emitDataUpdate();
    }
    
    // 🔥 버퍼된 이벤트 처리
    processBufferedEvents() {
        console.log(`🔄 버퍼된 이벤트 처리: ${this.eventBuffer.length}개`);
        
        // 스냅샷보다 오래된 이벤트 제거
        this.eventBuffer = this.eventBuffer.filter(event => 
            event.u > this.localOrderBook.lastUpdateId
        );
        
        // 첫 번째 유효한 이벤트 찾기
        const firstValidEventIndex = this.eventBuffer.findIndex(event =>
            event.U <= this.localOrderBook.lastUpdateId + 1 && 
            event.u >= this.localOrderBook.lastUpdateId + 1
        );
        
        if (firstValidEventIndex === -1) {
            console.warn('⚠️ 유효한 첫 이벤트를 찾을 수 없음, 재동기화 필요');
            this.resync();
            return;
        }
        
        // 유효한 이벤트들만 처리
        const validEvents = this.eventBuffer.slice(firstValidEventIndex);
        validEvents.sort((a, b) => a.U - b.U);
        
        this.isInitialized = true;
        
        validEvents.forEach(event => {
            this.updateLocalOrderBook(event);
        });
        
        this.eventBuffer = [];
        console.log(`✅ ${validEvents.length}개 이벤트 처리 완료`);
    }
    
    // 🔥 재동기화
    async resync() {
        console.log('🔄 오더북 재동기화 시작');
        this.isInitialized = false;
        this.eventBuffer = [];
        this.emitStatusChange('재동기화 중...', 'connecting');
        
        try {
            await this.getSnapshot();
            this.processBufferedEvents();
        } catch (error) {
            console.error('❌ 재동기화 실패:', error);
            this.scheduleReconnect();
        }
    }
    
    // 🔥 재연결 스케줄링
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ 최대 재연결 시도 횟수 초과');
            this.emitStatusChange('연결 실패', 'error');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 지수 백오프
        
        console.log(`🔄 ${delay}ms 후 재연결 시도 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => {
            this.start();
        }, delay);
    }
    
    // 🔥 성능 메트릭스 업데이트
    updateMetrics(eventTime) {
        const now = Date.now();
        const latency = now - eventTime;
        
        this.metrics.updateCount++;
        this.metrics.latencySum += latency;
        this.metrics.lastUpdateTime = now;
        
        // 1초마다 메트릭스 전송
        if (this.metrics.updateCount % 10 === 0) {
            const avgLatency = Math.round(this.metrics.latencySum / this.metrics.updateCount);
            const updateRate = Math.round(10000 / (now - (this.metrics.lastMetricsTime || now)));
            
            this.emitMetrics({
                latency: avgLatency,
                updateRate: updateRate,
                missedUpdates: this.metrics.missedUpdates,
                syncStatus: this.metrics.syncStatus
            });
            
            this.metrics.lastMetricsTime = now;
        }
    }
    
    // 🔥 데이터 가공 및 전송
    emitDataUpdate() {
        // 정렬된 bids/asks 생성
        const sortedBids = Array.from(this.localOrderBook.bids.entries())
            .sort(([a], [b]) => b - a) // 내림차순
            .slice(0, 20);
            
        const sortedAsks = Array.from(this.localOrderBook.asks.entries())
            .sort(([a], [b]) => a - b) // 오름차순
            .slice(0, 20);
        
        const data = {
            bids: sortedBids.map(([price, quantity]) => [price.toString(), quantity.toString()]),
            asks: sortedAsks.map(([price, quantity]) => [price.toString(), quantity.toString()]),
            lastUpdateId: this.localOrderBook.lastUpdateId
        };
        
        document.dispatchEvent(new CustomEvent('orderbook-data-update', { detail: data }));
    }
    
    // 🔥 상태 변경 이벤트
    emitStatusChange(status, statusClass) {
        document.dispatchEvent(new CustomEvent('orderbook-status-change', { 
            detail: { status, statusClass }
        }));
    }
    
    // 🔥 에러 이벤트
    emitError(error) {
        document.dispatchEvent(new CustomEvent('orderbook-error', { 
            detail: { error }
        }));
    }
    
    // 🔥 메트릭스 이벤트
    emitMetrics(metrics) {
        document.dispatchEvent(new CustomEvent('orderbook-metrics', { 
            detail: metrics
        }));
    }
    
    // 🔥 정리
    destroy() {
        if (this.ws) {
            this.ws.close();
        }
        this.eventBuffer = [];
        this.localOrderBook.bids.clear();
        this.localOrderBook.asks.clear();
        console.log('🔥 오더북 관리자 정리 완료');
    }
}