// 🔥 Community.js - TradingView 공식 권장사항 완전 구현 (지표/그림 유지)

// 🔥 TradingView 차트 관련 변수
let widget = null;
let chartStorage = null;
let isChartReady = false;
let autoSaveEnabled = true;

// Firebase 초기화 대기
function waitForFirebase() {
    return new Promise((resolve) => {
        const checkFirebase = () => {
            if (window.firebase && window.db) {
                resolve();
            } else {
                setTimeout(checkFirebase, 100);
            }
        };
        checkFirebase();
    });
}

// 🔥 TradingView 차트 초기화 (공식 권장사항 완전 구현)
async function initializeTradingViewChart() {
    console.log('🔥 TradingView 차트 초기화 시작 (공식 권장사항)');
    
    // 🔥 차트 레이아웃 관리자 초기화
    if (!window.chartLayoutManager) {
        window.chartLayoutManager = new ChartLayoutManager();
    }
    
    // 레이아웃 관리자 초기화
    window.chartLayoutManager.init();
    
    // 기본 단일 차트 모드로 시작
    await initializeSingleChart();
}

// 🔥 단일 차트 초기화 함수 (기존 로직 유지)
async function initializeSingleChart() {
    console.log('🔄 단일 차트 모드 초기화');
    
    // 차트 컨테이너 확인
    const chartContainer = document.getElementById('tradingview_chart');
    if (!chartContainer) {
        console.error('❌ 차트 컨테이너를 찾을 수 없습니다: tradingview_chart');
        return;
    }

    // 기존 위젯 제거
    if (widget) {
        try {
            widget.remove();
        } catch (e) {
            console.log('기존 위젯 제거 중 오류:', e);
        }
        widget = null;
        isChartReady = false;
    }
    
    try {
        // 차트 저장소 초기화
        if (!chartStorage) {
            chartStorage = new ChartStorage();
        }

        // 사용자 ID 설정
        if (window.currentUser) {
            chartStorage.setUserId(window.currentUser.uid);
        }

        // 저장된 차트 상태 확인
        const savedChartState = await chartStorage.getLastChartState();
        console.log('📊 저장된 차트 상태:', savedChartState ? '있음' : '없음');
        
        // 🔥 TradingView 공식 위젯 설정 (지표/그림 유지 최적화)
    const widgetOptions = {
            // 🔥 필수 기본 설정
        container: chartContainer,
        library_path: '/charting_library-master/charting_library/',
            
            // 🔥 기본 차트 설정
            symbol: 'BINANCE:BTCUSDT',
            interval: '15',
        fullscreen: false,
        autosize: true,
            
            // 🔥 Binance 데이터피드 사용
            datafeed: new BinanceDatafeed(),
            
            // 🔥 한국어 및 시간대 설정
            locale: 'ko',
            timezone: 'Asia/Seoul',
            
            // 🔥 테마 설정
            theme: document.documentElement.classList.contains('dark-mode') ? 'Dark' : 'Light',
            
            // 🔥 TradingView 공식 저장/불러오기 설정
            save_load_adapter: chartStorage.createTradingViewAdapter(),
            charts_storage_api_version: '1.1',
            client_id: 'felicity-site',
            user_id: window.currentUser ? window.currentUser.uid : 'anonymous',
            
            // 🔥 자동 저장 설정 (TradingView 공식 권장)
            auto_save_delay: 5, // 5초 (TradingView 권장 설정)
            
            // 🔥 마지막 차트 자동 로드 (TradingView 공식 기능)
            load_last_chart: true,
            
            // 🔥 지표 및 그림 유지를 위한 기능 활성화
            enabled_features: [
                'study_templates',                    // 지표 템플릿 저장/불러오기
                'saveload_separate_drawings_storage', // 그림 별도 저장 (TradingView 권장)
                'move_logo_to_main_pane',            // 로고 위치 조정
                'chart_crosshair_menu',              // 십자선 메뉴
                'symbol_search_hot_key',             // Ctrl+K 심볼 검색
                'adaptive_logo',                     // 적응형 로고
                'show_object_tree'                   // 객체 트리 표시
            ],
            
            // 🔥 불필요한 기능 비활성화 (성능 최적화)
        disabled_features: [
                'use_localstorage_for_settings',     // 서버 저장소 사용
                'header_saveload',                   // 커스텀 저장/불러오기 사용
                'popup_hints',                       // 팝업 힌트 비활성화
                'widget_logo',                       // 위젯 로고 비활성화
                'compare_symbol',                    // 심볼 비교 비활성화
                'display_market_status',             // 시장 상태 표시 비활성화
                'chart_template_storage'             // 차트 템플릿 저장 비활성화 (오류 방지)
            ],
            
            // 🔥 차트 스타일 설정
        overrides: {
            "mainSeriesProperties.candleStyle.upColor": "#26a69a",
            "mainSeriesProperties.candleStyle.downColor": "#ef5350",
            "mainSeriesProperties.candleStyle.wickUpColor": "#26a69a",
            "mainSeriesProperties.candleStyle.wickDownColor": "#ef5350"
            },
            
            // 🔥 디버그 설정
            debug: false
        };

        // 🔥 저장된 차트가 있으면 복원 데이터 설정 (TradingView 공식 방식)
        if (savedChartState && window.currentUser) {
            widgetOptions.saved_data = savedChartState;
            console.log('📊 저장된 차트 상태를 위젯에 설정');
        }

        // 🔥 TradingView 위젯 생성
        widget = new TradingView.widget(widgetOptions);

        // 🔥 차트 준비 완료 이벤트 (TradingView 공식)
        widget.onChartReady(() => {
            console.log('✅ TradingView 차트 준비 완료');
            isChartReady = true;
            
            // 로딩 인디케이터 숨기기
            const loadingIndicator = document.getElementById('chart-loading');
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
            
            // 🔥 차트 저장 관리자 초기화
            if (window.chartSaveManager) {
                window.chartSaveManager.initialize(widget);
                console.log('✅ 차트 저장 관리자 연결 완료');
            }
            
            // 🔥 헤더 준비 완료 후 추가 설정
            widget.headerReady().then(() => {
                console.log('✅ 차트 헤더 준비 완료');
                    updateChartTheme();
                
                // 🔥 자동 저장 이벤트 설정 (TradingView 공식 권장)
                setupAutoSaveEvents();
                
                // 🔥 차트 로드 완료 이벤트 설정
                setupChartLoadEvents();
            });
        });

            } catch (error) {
        console.error('❌ TradingView 차트 초기화 실패:', error);
        showChartError('차트를 불러올 수 없습니다.');
    }
}

// 🔥 자동 저장 이벤트 설정 (TradingView 공식 권장사항)
function setupAutoSaveEvents() {
    if (!widget || !chartStorage || !isChartReady) {
        console.warn('⚠️ 자동 저장 이벤트 설정 조건 불충족');
                    return;
                }
                
    console.log('🔄 자동 저장 이벤트 설정 시작 (TradingView 공식)');

    try {
        // 🔥 TradingView 공식 onAutoSaveNeeded 이벤트 (최우선)
        if (widget.onAutoSaveNeeded) {
            widget.onAutoSaveNeeded(() => {
                console.log('💾 TradingView 공식 자동 저장 이벤트 발생');
                if (autoSaveEnabled && window.currentUser) {
                    saveChartStateWithOptions();
                }
            });
            console.log('✅ onAutoSaveNeeded 이벤트 설정 완료');
        }

        // 🔥 차트 변경 이벤트들 (백업 및 추가 트리거)
        const chartEvents = [
            'onSymbolChanged',
            'onIntervalChanged',
            'onDataLoaded',
            'onVisibleRangeChanged'
        ];

        chartEvents.forEach(eventName => {
            if (widget[eventName]) {
                widget[eventName](() => {
                    console.log(`📊 차트 변경 이벤트: ${eventName}`);
                    if (autoSaveEnabled && window.currentUser) {
                        scheduleAutoSave();
                    }
                });
            }
        });

        // 🔥 사용자 상호작용 이벤트 (그림 도구 사용 감지)
        setupUserInteractionEvents();

        console.log('✅ 자동 저장 이벤트 설정 완료');
    } catch (error) {
        console.error('❌ 자동 저장 이벤트 설정 실패:', error);
    }
}

// 🔥 사용자 상호작용 이벤트 설정 (그림 도구 사용 감지)
function setupUserInteractionEvents() {
    if (!widget || !isChartReady) {
        return;
    }

    try {
        // 차트 컨테이너에서 사용자 상호작용 감지
        const chartContainer = document.getElementById('tradingview_chart');
        if (chartContainer) {
            // 마우스 이벤트 (그림 도구 사용)
            ['mouseup', 'touchend'].forEach(eventType => {
                chartContainer.addEventListener(eventType, debounce(() => {
                    if (autoSaveEnabled && window.currentUser) {
                        console.log('🎨 사용자 상호작용 감지 (그림 도구)');
                        scheduleAutoSave();
                    }
                }, 1000));
            });

            // 키보드 이벤트 (단축키 사용)
            chartContainer.addEventListener('keyup', debounce((e) => {
                if (autoSaveEnabled && window.currentUser) {
                    // 그림 도구 관련 단축키 감지
                    if (e.key === 'Escape' || e.key === 'Delete' || e.key === 'Enter') {
                        console.log('⌨️ 키보드 상호작용 감지');
                        scheduleAutoSave();
                    }
                }
            }, 1000));
        }
    } catch (error) {
        console.error('❌ 사용자 상호작용 이벤트 설정 실패:', error);
    }
}

// 🔥 차트 로드 완료 이벤트 설정
function setupChartLoadEvents() {
    if (!widget || !isChartReady) {
            return;
        }

    try {
        // 차트 로드 요청 이벤트
        if (widget.chart && widget.chart().onChartLoadRequested) {
            widget.chart().onChartLoadRequested(() => {
                console.log('📊 차트 로드 요청됨');
            });
        }

        // 차트 로드 완료 이벤트
        if (widget.chart && widget.chart().onChartLoaded) {
            widget.chart().onChartLoaded(() => {
                console.log('✅ 차트 로드 완료');
                // 로드 완료 후 자동 저장 활성화
                setTimeout(() => {
                    autoSaveEnabled = true;
                }, 2000);
            });
        }
    } catch (error) {
        console.error('❌ 차트 로드 이벤트 설정 실패:', error);
    }
}

// 🔥 차트 상태 저장 (TradingView 공식 옵션 사용)
function saveChartStateWithOptions() {
    if (!widget || !chartStorage || !window.currentUser || !isChartReady) {
        return;
    }
    
    try {
        // 🔥 TradingView 공식 저장 옵션 (지표/그림 포함)
        const saveOptions = {
            includeDrawings: true,        // 그림 포함 (TradingView 공식)
            saveStudyTemplates: true,     // 지표 템플릿 저장
            saveChartProperties: true,    // 차트 속성 저장
            saveDrawingTemplates: true    // 그림 템플릿 저장
        };

        widget.save((chartData) => {
            if (chartData && typeof chartData === 'object') {
                console.log('💾 차트 상태 저장 중... (지표/그림 포함)');
                console.log('📊 저장 데이터 정보:', {
                    hasDrawings: chartStorage.hasDrawings(chartData),
                    hasStudies: chartStorage.hasStudies(chartData),
                    dataSize: JSON.stringify(chartData).length
                });
                
                // 자동 저장 스케줄링
                chartStorage.scheduleAutoSave(chartData);
        } else {
                console.warn('⚠️ 잘못된 차트 데이터');
            }
        }, saveOptions);
    } catch (error) {
        console.error('❌ 차트 상태 저장 실패:', error);
    }
}

// 🔥 자동 저장 스케줄링 (디바운스 적용)
let autoSaveTimeout = null;
function scheduleAutoSave() {
    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
    }
    
    autoSaveTimeout = setTimeout(() => {
        saveChartStateWithOptions();
    }, 2000); // 2초 후 저장
}

// 🔥 차트 테마 업데이트
function updateChartTheme() {
    try {
        const isDarkMode = document.documentElement.classList.contains('dark-mode');
        const newTheme = isDarkMode ? 'Dark' : 'Light';
        
        let themeChanged = false;
        
        // 단일 차트 테마 변경
        if (widget && widget.changeTheme && typeof widget.changeTheme === 'function' && isChartReady) {
            try {
                widget.changeTheme(newTheme);
                console.log(`🎨 단일 차트 테마 변경: ${newTheme}`);
                themeChanged = true;
    } catch (error) {
                console.warn('⚠️ 단일 차트 테마 변경 실패:', error);
            }
        }
        
        // 레이아웃 매니저의 모든 차트 테마 변경
        if (window.chartLayoutManager && window.chartLayoutManager.widgets && Array.isArray(window.chartLayoutManager.widgets)) {
            window.chartLayoutManager.widgets.forEach((chartWidget, index) => {
                if (chartWidget && chartWidget.changeTheme && typeof chartWidget.changeTheme === 'function') {
                    try {
                        chartWidget.changeTheme(newTheme);
                        console.log(`🎨 레이아웃 차트 ${index + 1} 테마 변경: ${newTheme}`);
                        themeChanged = true;
    } catch (error) {
                        console.warn(`⚠️ 레이아웃 차트 ${index + 1} 테마 변경 실패:`, error);
                    }
                }
            });
        }
        
        if (themeChanged) {
            console.log(`✅ 차트 테마 변경 완료: ${newTheme}`);
        } else {
            console.log(`⚠️ 변경할 차트가 없습니다 (테마: ${newTheme})`);
        }
    } catch (error) {
        console.error('❌ 차트 테마 변경 실패:', error);
    }
}

// 🔥 차트 오류 표시
function showChartError(message) {
    const chartContainer = document.getElementById('tradingview_chart');
    if (chartContainer) {
        chartContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-color);">
                <div style="text-align: center;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px; color: var(--warning-color);"></i>
                    <p>${message}</p>
                    <button onclick="initializeTradingViewChart()" style="padding: 8px 16px; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 16px;">다시 시도</button>
                    </div>
                </div>
            `;
    }
}

// 🔥 사용자 인증 상태 변경 처리
function onAuthStateChanged(user) {
    window.currentUser = user;
    if (user) {
        console.log('👤 사용자 로그인:', user.uid);
        
        // 차트 저장소에 사용자 ID 설정
        if (chartStorage) {
            chartStorage.setUserId(user.uid);
        }
        
        // 자동 저장 활성화
        autoSaveEnabled = true;
        
        // 메시지 스타일 업데이트
        if (window.communityChat) {
            window.communityChat.updateUserMessageStyles();
        }
    } else {
        console.log('👤 사용자 로그아웃');
        
        // 자동 저장 비활성화
        autoSaveEnabled = false;
        
        // 메시지 스타일 업데이트
        if (window.communityChat) {
            window.communityChat.updateUserMessageStyles();
        }
    }
}

// 🔥 Firebase 인증 리스너 설정
async function setupAuthListener() {
    try {
    await waitForFirebase();
        
        // Firebase Auth 상태 변화 감지
        firebase.auth().onAuthStateChanged(onAuthStateChanged);
        
        console.log('✅ Firebase 인증 리스너 설정 완료');
        } catch (error) {
        console.error('❌ Firebase 인증 리스너 설정 실패:', error);
    }
}

// 🔥 모달 이벤트 리스너 설정
function setupModalListeners() {
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
}

// 🔥 디바운스 함수
function debounce(func, wait) {
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

// 🔥 페이지 종료 시 최종 저장
function handlePageUnload() {
    if (widget && chartStorage && window.currentUser && isChartReady) {
        try {
            // 동기적으로 빠른 저장 시도
            widget.save((chartData) => {
                if (chartData) {
                    // 즉시 저장 (Promise 없이)
                    chartStorage.updateAutoSaveState(chartData);
                }
            }, {
                includeDrawings: true,
                saveStudyTemplates: true,
                saveChartProperties: true
            });
                } catch (error) {
            console.error('❌ 페이지 종료 시 저장 실패:', error);
        }
    }
}

// 🔥 페이지 초기화
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔥 커뮤니티 페이지 로드 시작 (TradingView 공식 구현)');
    
    try {
        // Firebase 초기화 대기
    await waitForFirebase();
    
        // 인증 리스너 설정
        await setupAuthListener();
    
    // 모달 리스너 설정
    setupModalListeners();
    
        // 🔥 TradingView 차트 초기화
        if (typeof TradingView !== 'undefined') {
            await initializeTradingViewChart();
        } else {
            console.warn('⚠️ TradingView 라이브러리가 로드되지 않았습니다.');
            
            // TradingView 라이브러리 로드 대기
            const checkTradingView = setInterval(() => {
                if (typeof TradingView !== 'undefined') {
                    clearInterval(checkTradingView);
                    initializeTradingViewChart();
                }
            }, 1000);
        }

        // 🔥 페이지 종료 이벤트 리스너
        window.addEventListener('beforeunload', handlePageUnload);
        window.addEventListener('unload', handlePageUnload);
        
        // 🔥 페이지 가시성 변경 이벤트 (탭 전환 시 저장)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && autoSaveEnabled) {
                console.log('📱 페이지 숨김 - 자동 저장 실행');
                saveChartStateWithOptions();
            }
        });
        
        console.log('✅ 커뮤니티 페이지 초기화 완료');
    } catch (error) {
        console.error('❌ 커뮤니티 페이지 초기화 실패:', error);
    }
});

// 🔥 전역 함수로 내보내기 (HTML에서 호출 가능)
window.initializeTradingViewChart = initializeTradingViewChart;
window.updateChartTheme = updateChartTheme;
window.saveChartStateWithOptions = saveChartStateWithOptions;