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
                'show_object_tree',                  // 객체 트리 표시
                'items_favoriting',                  // 즐겨찾기 기능 활성화
                'favorites_in_search',               // 검색에서 즐겨찾기 표시
                'symbol_info',                       // 심볼 정보 표시
                'header_indicators',                 // 헤더 지표 메뉴
                'header_chart_type',                 // 헤더 차트 타입 선택
                'header_resolutions',                // 헤더 시간봉 선택
                'header_settings',                   // 헤더 설정 메뉴
                'header_undo_redo',                  // 실행 취소/다시 실행
                'header_screenshot',                 // 스크린샷 기능
                'header_fullscreen_button',          // 전체화면 버튼
                'header_widget',                     // 헤더 위젯
                'header_compare',                    // 심볼 비교 버튼
                'header_symbol_search',              // 심볼 검색 버튼
                'header_quick_search',               // 빠른 검색 버튼
                'left_toolbar',                      // 왼쪽 도구 모음
                'control_bar',                       // 컨트롤 바
                'timeframes_toolbar',                // 시간봉 도구 모음
                'edit_buttons_in_legend',            // 범례에서 편집 버튼
                'delete_button_in_legend',           // 범례 삭제 버튼
                'format_button_in_legend',           // 범례 포맷 버튼
                'show_hide_button_in_legend',        // 범례 숨기기/보이기 버튼
                'context_menus',                     // 우클릭 메뉴
                'use_localstorage_for_settings',     // 설정 로컬 저장
                'save_chart_properties_to_local_storage', // 차트 속성 로컬 저장
                'chart_property_page_style',         // 차트 속성 페이지
                'chart_property_page_scales',        // 스케일 속성 페이지
                'chart_property_page_background',    // 배경 속성 페이지
                'chart_property_page_right_margin_editor', // 오른쪽 여백 편집기
                'property_pages',                    // 속성 페이지
                'show_chart_property_page',          // 차트 속성 페이지 표시
                'chart_property_page_trading',       // 거래 속성 페이지
                'go_to_date',                        // 날짜로 이동
                'adaptive_logo',                     // 적응형 로고
                'hide_left_toolbar_by_default',      // 기본적으로 왼쪽 도구바 숨김
                'chart_zoom',                        // 차트 줌
                'source_selection_markers',          // 소스 선택 마커
                // 🔥 추가 고급 기능들
                'legend_context_menu',               // 범례 우클릭 메뉴
                'show_interval_dialog_on_key_press', // 키 누르면 시간봉 대화상자
                'create_volume_indicator_by_default_once', // 볼륨 지표 한번만 생성
                'study_dialog_search_control',       // 지표 대화상자 검색
                'side_toolbar_in_fullscreen_mode',   // 전체화면에서 사이드바
                'header_in_fullscreen_mode',         // 전체화면에서 헤더
                'chart_style_hilo',                  // 하이-로우 차트 스타일
                'chart_style_hilo_last_price',       // 하이-로우 마지막 가격
                'remove_library_container_border',   // 라이브러리 컨테이너 테두리 제거
                'chart_crosshair_menu',              // 차트 십자선 메뉴
                'pane_context_menu',                 // 패널 우클릭 메뉴
                'scales_context_menu',               // 스케일 우클릭 메뉴
                'show_logo_on_all_charts',           // 모든 차트에 로고 표시
                'cl_feed_return_all_data',           // 모든 데이터 반환
                'chart_template_storage',            // 차트 템플릿 저장
                'snapshot_trading_drawings',         // 거래 그림 스냅샷
                'study_on_study',                    // 지표 위에 지표
                'side_toolbar_in_fullscreen_mode',   // 전체화면 사이드바
                'header_saveload',                   // 헤더 저장/불러오기
                'header_layouttoggle',               // 헤더 레이아웃 토글
                'legend_widget',                     // 범례 위젯
                'compare_symbol',                    // 심볼 비교
                'symbol_search_parser_mismatch',     // 심볼 검색 파서 불일치
                'display_market_status',             // 시장 상태 표시
                'show_chart_property_page',          // 차트 속성 페이지 표시
                'countdown',                         // 카운트다운
                'show_dom_first_time',               // DOM 첫 표시
                'trading_notifications',             // 거래 알림
                'chart_events',                      // 차트 이벤트
                'chart_crosshair_menu',              // 차트 십자선 메뉴
                'format_buttons_in_legend',          // 범례 포맷 버튼
                'study_buttons_in_legend',           // 범례 지표 버튼
                'show_hide_button_in_legend',        // 범례 숨기기/보이기 버튼
                'modify_buttons_in_legend',          // 범례 수정 버튼
                'format_button',                     // 포맷 버튼
                'study_dialog_fundamentals_economy_addons', // 펀더멘털 경제 추가기능
                'uppercase_instrument_names',        // 대문자 종목명
                'popup_hints',                       // 팝업 힌트
                'volume_force_overlay',              // 볼륨 오버레이
                'create_volume_indicator_by_default', // 기본 볼륨 지표
                // 🚀 추가된 고급 기능들 (공식 문서 기반)
                'always_show_legend_values_on_mobile', // 모바일에서 범례 값 항상 표시
                'border_around_the_chart',           // 차트 주변 테두리
                'clear_price_scale_on_error_or_empty_bars', // 오류/빈 바에서 가격 스케일 정리
                'compare_symbol_search_spread_operators', // 심볼 비교 검색에서 스프레드 연산자
                'display_data_mode',                 // 데이터 모드 표시
                'display_legend_on_all_charts',      // 모든 차트에 범례 표시
                'dont_show_boolean_study_arguments', // 불린 지표 인수 숨기기
                'hide_image_invalid_symbol',         // 잘못된 심볼 이미지 숨기기
                'hide_last_na_study_output',         // 마지막 N/A 지표 출력 숨기기
                'hide_main_series_symbol_from_indicator_legend', // 지표 범례에서 메인 시리즈 심볼 숨기기
                'hide_price_scale_global_last_bar_value', // 글로벌 마지막 바 값 숨기기
                'hide_exponentiation_spread_operator', // 지수 스프레드 연산자 숨기기
                'hide_reciprocal_spread_operator',   // 역수 스프레드 연산자 숨기기
                'hide_object_tree_and_price_scale_exchange_label', // 객체 트리와 가격 스케일 거래소 라벨 숨기기
                'hide_resolution_in_legend',         // 범례에서 해상도 숨기기
                'hide_unresolved_symbols_in_legend', // 범례에서 해결되지 않은 심볼 숨기기
                'main_series_scale_menu',            // 메인 시리즈 스케일 메뉴
                'object_tree_legend_mode',           // 객체 트리 범례 모드
                'pricescale_currency',               // 가격 스케일 통화
                'pricescale_unit',                   // 가격 스케일 단위
                'pre_post_market_sessions',          // 시장 전후 세션
                'scales_date_format',                // 스케일 날짜 형식
                'scales_time_hours_format',          // 스케일 시간 형식
                'show_average_close_price_line_and_label', // 평균 종가 라인과 라벨 표시
                'show_exchange_logos',               // 거래소 로고 표시
                'show_right_widgets_panel_by_default', // 기본적으로 오른쪽 위젯 패널 표시
                'show_symbol_logos',                 // 심볼 로고 표시
                'show_symbol_logo_for_compare_studies', // 비교 지표용 심볼 로고 표시
                'show_symbol_logo_in_legend',        // 범례에서 심볼 로고 표시
                'show_percent_option_for_right_margin', // 오른쪽 여백 백분율 옵션 표시
                'show_spread_operators',             // 스프레드 연산자 표시
                'show_zoom_and_move_buttons_on_touch', // 터치에서 줌/이동 버튼 표시
                'studies_symbol_search_spread_operators', // 지표 심볼 검색 스프레드 연산자
                'symbol_info_long_description',      // 심볼 정보 긴 설명
                'symbol_info_price_source',          // 심볼 정보 가격 소스
                'timezone_menu',                     // 시간대 메뉴
                'use_na_string_for_not_available_values', // 사용 불가 값에 N/A 문자열 사용
                'use_symbol_name_for_header_toolbar', // 헤더 툴바에 심볼 이름 사용
                // 🎯 동작 제어 기능들
                'accessible_keyboard_shortcuts',     // 접근 가능한 키보드 단축키
                'allow_arbitrary_symbol_search_input', // 임의 심볼 검색 입력 허용
                'aria_crosshair_price_description',  // ARIA 십자선 가격 설명
                'aria_detailed_chart_descriptions',  // ARIA 세부 차트 설명
                'auto_enable_symbol_labels',         // 심볼 라벨 자동 활성화
                'axis_pressed_mouse_move_scale',     // 축 마우스 누름 이동 스케일
                'chart_scroll',                      // 차트 스크롤
                'charting_library_debug_mode',       // 차트 라이브러리 디버그 모드
                'confirm_overwrite_if_chart_layout_with_name_exists', // 동일 이름 차트 레이아웃 덮어쓰기 확인
                'create_volume_indicator_by_default', // 기본 볼륨 지표 생성
                'constraint_dialogs_movement',       // 대화상자 이동 제한
                'cropped_tick_marks',                // 잘린 틱 마크
                'custom_resolutions',                // 사용자 정의 해상도
                'datasource_copypaste',              // 데이터소스 복사/붙여넣기
                'determine_first_data_request_size_using_visible_range', // 가시 범위로 첫 데이터 요청 크기 결정
                'disable_pulse_animation',           // 펄스 애니메이션 비활성화
                'disable_resolution_rebuild',        // 해상도 재구축 비활성화
                'end_of_period_timescale_marks',     // 기간 종료 시간 스케일 마크
                'fix_left_edge',                     // 왼쪽 가장자리 고정
                'hide_price_scale_if_all_sources_hidden', // 모든 소스 숨김 시 가격 스케일 숨기기
                'horz_touch_drag_scroll',            // 수평 터치 드래그 스크롤
                'intraday_inactivity_gaps',          // 장중 비활성 간격
                'iframe_loading_compatibility_mode', // iframe 로딩 호환성 모드
                'iframe_loading_same_origin',        // iframe 로딩 동일 출처
                'insert_indicator_dialog_shortcut',  // 지표 삽입 대화상자 단축키
                'legend_inplace_edit',               // 범례 제자리 편집
                'library_custom_color_themes',       // 라이브러리 사용자 정의 컬러 테마
                'lock_visible_time_range_on_resize', // 크기 조정 시 가시 시간 범위 잠금
                'lock_visible_time_range_when_adjusting_percentage_right_margin', // 백분율 오른쪽 여백 조정 시 가시 시간 범위 잠금
                'low_density_bars',                  // 낮은 밀도 바
                'mouse_wheel_scale',                 // 마우스 휠 스케일
                'mouse_wheel_scroll',                // 마우스 휠 스크롤
                'no_min_chart_width',                // 최소 차트 너비 없음
                'pinch_scale',                       // 핀치 스케일
                'pressed_mouse_move_scroll',         // 누른 마우스 이동 스크롤
                'pre_post_market_price_line',        // 시장 전후 가격선
                'request_only_visible_range_on_reset', // 리셋 시 가시 범위만 요청
                'right_bar_stays_on_scroll',         // 스크롤 시 오른쪽 바 유지
                'save_shortcut',                     // 저장 단축키
                'seconds_resolution',                // 초 해상도
                'secondary_series_extend_time_scale', // 보조 시리즈 시간 스케일 확장
                'shift_visible_range_on_new_bar',    // 새 바에서 가시 범위 이동
                'study_symbol_ticker_search_request_delay', // 지표 심볼 티커 검색 요청 지연
                'study_dialog_search_request_delay', // 지표 대화상자 검색 요청 지연
                'symbol_search_request_delay',       // 심볼 검색 요청 지연
                'update_study_formatter_on_symbol_change', // 심볼 변경 시 지표 포맷터 업데이트
                'vertical_touch_drag_scroll',        // 수직 터치 드래그 스크롤
                'widget_logo'                        // 위젯 로고
            ],
            
            // 🔥 기본 즐겨찾기 설정
            favorites: {
                intervals: ['1', '5', '15', '30', '1H', '4H', '1D', '1W'],
                indicators: [
                    'Moving Average',
                    'Bollinger Bands', 
                    'RSI',
                    'MACD',
                    'Volume',
                    'Awesome Oscillator',
                    'Stochastic',
                    'Average True Range',
                    'Ichimoku Cloud',
                    'Parabolic SAR'
                ],
                chartTypes: ['Area', 'Candles', 'Line', 'Bars'],
                drawingTools: [
                    'LineToolTrendLine',
                    'LineToolHorzLine', 
                    'LineToolVertLine',
                    'LineToolRectangle',
                    'LineToolCircle',
                    'LineToolFibRetracement',
                    'LineToolText',
                    'LineToolArrow'
                ]
            },
            
            // 🔥 모든 기능 활성화! 비활성화 없음
        // disabled_features 완전 제거
            
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
            
            // 🔥 실시간 데이터 구독 강화
            console.log('🔄 실시간 데이터 구독 상태 확인 중...');
            setTimeout(() => {
                if (window.chartStorage && window.chartStorage.datafeed) {
                    console.log('✅ 데이터피드 확인됨, 실시간 구독 활성화');
                } else {
                    console.warn('⚠️ 데이터피드 확인 실패, 수동으로 실시간 구독 활성화');
                }
            }, 2000);
            
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

        // 🔥 실시간 고래 탐지 시스템 초기화
        initializeWhaleTrackingSystem();

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

// 🔥 실시간 고래 탐지 시스템 초기화
function initializeWhaleTrackingSystem() {
    console.log('🐋 실시간 고래 탐지 시스템 초기화 시작');
    
    try {
        // 고래 탐지 컨테이너 확인
        const whaleContainer = document.getElementById('whale-trades-container');
        if (!whaleContainer) {
            console.warn('⚠️ 고래 탐지 컨테이너를 찾을 수 없습니다');
            return;
        }

        // 상태 표시 요소들
        const statusIndicator = document.querySelector('.whale-status-indicator');
        const statusText = document.querySelector('.whale-status-text');

        // WhaleTracker 클래스가 있는지 확인
        if (window.WhaleTracker) {
            // 고래 추적기 초기화
            if (!window.whaleTracker) {
                window.whaleTracker = new window.WhaleTracker();
                console.log('🐋 고래 추적기 인스턴스 생성 완료');
                
                // 연결 상태 업데이트
                updateWhaleStatus('연결됨', 'connected');
            } else {
                console.log('🐋 고래 추적기 이미 초기화됨');
                updateWhaleStatus('연결됨', 'connected');
            }
        } else {
            console.warn('⚠️ WhaleTracker 클래스를 찾을 수 없습니다');
            updateWhaleStatus('로딩 중...', 'disconnected');
            
            // WhaleTracker 클래스 로드 대기
            let retryCount = 0;
            const maxRetries = 10;
            
            const checkWhaleTracker = setInterval(() => {
                retryCount++;
                
                if (window.WhaleTracker) {
                    clearInterval(checkWhaleTracker);
                    console.log('🐋 WhaleTracker 클래스 로드됨 - 초기화 재시도');
                    initializeWhaleTrackingSystem();
                } else if (retryCount >= maxRetries) {
                    clearInterval(checkWhaleTracker);
                    console.error('❌ WhaleTracker 클래스 로드 실패');
                    updateWhaleStatus('로드 실패', 'error');
                    showWhaleLoadingError();
                }
            }, 1000);
        }

        // 고래 상태 업데이트 함수
        function updateWhaleStatus(message, status) {
            if (statusIndicator) {
                statusIndicator.className = `whale-status-indicator ${status}`;
            }
            if (statusText) {
                statusText.textContent = message;
            }
            console.log(`🐋 고래 탐지 상태: ${status} - ${message}`);
        }

        // 고래 로딩 에러 표시
        function showWhaleLoadingError() {
            const whaleList = document.querySelector('.whale-trades-list');
            if (whaleList) {
                whaleList.innerHTML = `
                    <div class="whale-error-message">
                        <div class="error-icon">⚠️</div>
                        <div class="error-text">
                            <p>고래 탐지 시스템을 로드할 수 없습니다.</p>
                            <p>페이지를 새로고침 해주세요.</p>
                        </div>
                        <button onclick="location.reload()" class="retry-button">
                            새로고침
                        </button>
                    </div>
                `;
            }
        }

        console.log('✅ 고래 탐지 시스템 초기화 완료');
        
    } catch (error) {
        console.error('❌ 고래 탐지 시스템 초기화 실패:', error);
        
        // 에러 상태 표시
        const statusIndicator = document.querySelector('.whale-status-indicator');
        const statusText = document.querySelector('.whale-status-text');
        
        if (statusIndicator) {
            statusIndicator.className = 'whale-status-indicator error';
        }
        if (statusText) {
            statusText.textContent = '초기화 실패';
        }
    }
}