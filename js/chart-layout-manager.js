// 🔥 차트 레이아웃 관리자 (Chart Layout Manager)
// Stub: 삭제 보존 파일 (호환성)
class ChartLayoutManager {
    constructor() {}

    // 🔥 레이아웃 관리자 초기화
    init() {
        // header/멀티 레이아웃 제거됨. 단일 차트만 사용
        this.initializeManagers();
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


    // 🔥 아이콘에서 레이아웃 타입 추출
    getLayoutTypeFromIcon(icon) {
        const classList = icon.classList;
        
        if (classList.contains('layout-single')) return 'single';
        if (classList.contains('layout-horizontal')) return 'horizontal';
        if (classList.contains('layout-vertical')) return 'vertical';
        if (classList.contains('layout-grid-3') || classList.contains('layout-grid-4')) return 'grid';
        
        return 'single'; // 기본값
    }

    // 🔥 차트 레이아웃 변경
    changeLayout(layout, type = 'single') {
        if (layout < 1 || layout > this.maxCharts) {
            console.error('❌ 잘못된 레이아웃:', layout);
            return;
        }

        console.log(`🔄 차트 레이아웃 변경: ${this.currentLayout}(${this.currentLayoutType}) → ${layout}(${type})`);
        
        // 버튼 활성화 상태 업데이트
        this.updateActiveButton(layout, type);
        
        // 차트 컨테이너 레이아웃 변경
        this.updateChartContainers(layout, type);
        
        // 기존 위젯들 정리
        this.cleanupWidgets();
        
        // 새 레이아웃으로 차트 초기화 (비동기로 빠르게 처리)
        this.initializeChartsForLayout(layout);
        
        this.currentLayout = layout;
        this.currentLayoutType = type;
        
        // 레이아웃 변경 후 드롭다운 상태 확인 및 복구
        setTimeout(() => {
            const dropdown = document.querySelector('.layout-dropdown');
            const icons = document.querySelectorAll('.layout-dropdown-icon');
            console.log(`🔍 레이아웃 변경 후 드롭다운 상태:`);
            console.log(`  - 드롭다운 존재: ${!!dropdown}`);
            console.log(`  - 아이콘 개수: ${icons.length}`);
            
            // 드롭다운이 숨겨져 있다면 초기 상태로 복구
            if (dropdown && (dropdown.style.opacity === '0' || dropdown.style.visibility === 'hidden')) {
                console.log('🔧 드롭다운 상태 복구 중...');
                dropdown.style.opacity = '';
                dropdown.style.visibility = '';
            }
            
            console.log(`  - 드롭다운 스타일:`, dropdown ? {
                opacity: dropdown.style.opacity,
                visibility: dropdown.style.visibility,
                display: dropdown.style.display
            } : '없음');
        }, 100);
        
        console.log(`✅ 레이아웃 변경 완료: ${layout}개 차트, ${type} 배치`);
    }

    // 🔥 활성 버튼 업데이트
    updateActiveButton() {}

    // 🔥 차트 컨테이너 레이아웃 업데이트
    updateChartContainers(layout, type) {
        const mainContainer = document.getElementById('tradingview_chart');
        if (!mainContainer) {
            console.error('❌ 메인 차트 컨테이너를 찾을 수 없습니다');
            return;
        }

        // 기존 차트 컨테이너들 제거
        const existingCharts = document.querySelectorAll('.chart-container');
        existingCharts.forEach(chart => chart.remove());

        // 메인 컨테이너 클래스 업데이트
        mainContainer.className = `chart-main-container layout-${layout} layout-${type}`;
        mainContainer.innerHTML = '';

        // 레이아웃 타입에 따른 컨테이너 생성
        if (type === 'single') {
            // 단일 차트
            this.createChartContainer(mainContainer, 1);
        } else if (type === 'horizontal') {
            // 가로 배치
        for (let i = 1; i <= layout; i++) {
                this.createChartContainer(mainContainer, i);
            }
        } else if (type === 'vertical') {
            // 세로 배치
            for (let i = 1; i <= layout; i++) {
                this.createChartContainer(mainContainer, i);
            }
        } else if (type === 'grid') {
            // 그리드 배치
            if (layout === 3) {
                // 3개 차트: L자 형태
                this.createChartContainer(mainContainer, 1, 'grid-top-left');
                this.createChartContainer(mainContainer, 2, 'grid-top-right');
                this.createChartContainer(mainContainer, 3, 'grid-bottom-left');
            } else if (layout === 4) {
                // 4개 차트: 2x2 그리드
                this.createChartContainer(mainContainer, 1, 'grid-top-left');
                this.createChartContainer(mainContainer, 2, 'grid-top-right');
                this.createChartContainer(mainContainer, 3, 'grid-bottom-left');
                this.createChartContainer(mainContainer, 4, 'grid-bottom-right');
            }
        }
    }

    // 🔥 차트 컨테이너 생성 헬퍼 메서드
    createChartContainer(parent, index, gridClass = '') {
            const chartContainer = document.createElement('div');
        chartContainer.className = `chart-container ${gridClass}`;
        chartContainer.id = `chart-${index}`;
            chartContainer.innerHTML = `
                <div class="chart-loading">
                    <i class="fas fa-spinner fa-spin"></i>
                <span>차트 ${index} 로딩 중...</span>
                </div>
            `;
            
        parent.appendChild(chartContainer);
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
            
            // 🔥 실시간 데이터 구독 상태 확인
            setTimeout(() => {
                console.log(`🔄 차트 ${index} 실시간 데이터 구독 상태 확인: ${symbol} ${interval}`);
                if (window.chartStorage && window.chartStorage.datafeed) {
                    console.log(`✅ 차트 ${index} 데이터피드 확인됨`);
                } else {
                    console.warn(`⚠️ 차트 ${index} 데이터피드 확인 실패`);
                }
            }, 1000);
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
        
        // 이벤트 리스너 정리
        const dropdownContainer = document.querySelector('.layout-dropdown');
        if (dropdownContainer && this.handleDropdownClick) {
            dropdownContainer.removeEventListener('click', this.handleDropdownClick);
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

// 전역으로 내보내기
window.ChartLayoutManager = ChartLayoutManager;

console.log('✅ ChartLayoutManager 클래스 로드 완료');