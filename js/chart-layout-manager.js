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

// 🔥 전역으로 내보내기
window.ChartLayoutManager = ChartLayoutManager;