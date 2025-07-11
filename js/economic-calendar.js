// 탭 네비게이션 및 경제 캘린더 모듈 (비활성화 - news.js에서 통합 관리)
class TabNavigation {
    constructor() {
        this.currentTab = 'news';
        this.isCalendarLoaded = false;
        // 탭 관리는 news.js에서 하므로 초기화하지 않음
        console.log('📋 경제 캘린더 모듈 초기화 (탭 관리는 news.js에서 처리)');
    }

    init() {
        // 탭 관리는 news.js에서 하므로 비활성화
        console.log('📋 탭 관리는 news.js에서 통합 처리됨');
    }

    initializeNavigation() {
        // 비활성화
        console.log('📋 탭 네비게이션은 news.js에서 처리됨');
    }

    setupTabNavigation() {
        // 비활성화 - news.js에서 처리
        console.log('📋 탭 설정은 news.js에서 처리됨');
    }

    switchTab(tabName) {
        // 비활성화 - news.js에서 처리
        console.log(`📋 탭 전환 요청 무시됨 (news.js에서 처리): ${tabName}`);
        return;
    }

    loadTradingViewCalendar() {
        const widgetContainer = document.querySelector('.tradingview-widget-container__widget');
        if (!widgetContainer) {
            console.error('TradingView 위젯 컨테이너를 찾을 수 없습니다.');
            return;
        }

        console.log('📊 TradingView 경제 캘린더 로드 시작');

        // 로딩 메시지 표시
        widgetContainer.innerHTML = `
            <div style="
                display: flex;
                align-items: center;
                justify-content: center;
                height: 600px;
                color: var(--text-color-secondary);
                text-align: center;
                padding: 20px;
                background: #fff;
                border-radius: 8px;
            ">
                <div>
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem; color: #2962ff;"></i>
                    <p style="margin: 0; font-size: 1rem;">경제 캘린더를 불러오는 중...</p>
                </div>
            </div>
        `;

        // 안정적인 HTML 임베드 방식으로 로드
        setTimeout(() => {
            this.loadWithHTMLEmbed();
        }, 500);
    }

    loadWithHTMLEmbed() {
        const widgetContainer = document.querySelector('.tradingview-widget-container__widget');
        if (!widgetContainer) return;

        console.log('📊 TradingView HTML 임베드 방식으로 로드');

        try {
            // 기존 내용 초기화
            widgetContainer.innerHTML = '';

            // TradingView 위젯 HTML 임베드 (contentWindow 접근 없음)
            const widgetHTML = `
                <div class="tradingview-widget-container" style="height: 600px; width: 100%;">
                    <div class="tradingview-widget-container__widget" style="height: 100%; width: 100%;">
                        <iframe 
                            src="https://www.tradingview.com/embed-widget/events/?locale=ko&importanceFilter=-1%2C0%2C1&countryFilter=us%2Ceu%2Cjp%2Ccn%2Ckr%2Cgb%2Cca%2Cau%2Cde%2Cfr%2Cit%2Ces%2Cbr%2Cin%2Cru%2Cmx%2Cza%2Ctr%2Csg%2Chk%2Ctw%2Cth%2Cmy%2Cid%2Cph%2Cvn&currencyFilter=USD%2CEUR%2CJPY%2CGBP%2CCHF%2CAUD%2CCAD%2CNZD%2CCNY%2CKRW%2CBTC%2CETH&utm_source=&utm_medium=widget&utm_campaign=events&utm_term="
                            width="100%"
                            height="600"
                            frameborder="0"
                            scrolling="no"
                            allowfullscreen="true"
                            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                            referrerpolicy="no-referrer-when-downgrade"
                            style="
                                border: none;
                                width: 100%;
                                height: 600px;
                                background: #fff;
                                border-radius: 8px;
                                display: block;
                            "
                            loading="lazy">
                        </iframe>
                    </div>
                </div>
            `;

            widgetContainer.innerHTML = widgetHTML;
            this.isCalendarLoaded = true;
            console.log('📊 TradingView HTML 임베드 설정 완료');

            // 5초 후 로드 상태 확인
            setTimeout(() => {
                this.checkWidgetLoad();
            }, 5000);

        } catch (error) {
            console.error('TradingView HTML 임베드 생성 중 오류:', error);
            this.loadKoreanCalendar();
        }
    }

    checkWidgetLoad() {
        const iframe = document.querySelector('.tradingview-widget-container__widget iframe');
        if (!iframe) {
            console.log('iframe이 없어서 한국 캘린더로 대체');
            this.loadKoreanCalendar();
            return;
        }

        // iframe이 정상적으로 로드되었는지 확인
        const rect = iframe.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            console.log('📊 TradingView 위젯 정상 작동 중');
        } else {
            console.log('위젯 로드 실패, 한국 캘린더로 대체');
            this.loadKoreanCalendar();
        }
    }

    loadKoreanCalendar() {
        const widgetContainer = document.querySelector('.tradingview-widget-container__widget');
        if (!widgetContainer) return;

        console.log('📊 한국 경제 캘린더 로드');

        // 한국 투자 정보 사이트의 경제 캘린더
        widgetContainer.innerHTML = `
            <div style="height: 600px; width: 100%; background: #fff; border-radius: 8px; overflow: hidden; position: relative;">
                <div style="
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 15px;
                    text-align: center;
                    font-weight: bold;
                    z-index: 10;
                ">
                    📊 경제 캘린더 - 주요 경제 지표 및 이벤트
                </div>
                <iframe 
                    src="https://kr.investing.com/economic-calendar/"
                    width="100%"
                    height="560"
                    frameborder="0"
                    scrolling="yes"
                    allowfullscreen="true"
                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                    referrerpolicy="no-referrer-when-downgrade"
                    style="
                        border: none;
                        width: 100%;
                        height: 560px;
                        background: #fff;
                        margin-top: 40px;
                    "
                    loading="lazy">
                </iframe>
            </div>
        `;

        console.log('📊 한국 경제 캘린더 설정 완료');

        // 10초 후에도 로드되지 않으면 대체 방법 시도
        setTimeout(() => {
            this.checkKoreanCalendarLoad();
        }, 10000);
    }

    checkKoreanCalendarLoad() {
        const iframe = document.querySelector('.tradingview-widget-container__widget iframe');
        if (!iframe) {
            console.log('한국 캘린더도 없어서 정적 캘린더로 대체');
            this.showStaticCalendar();
            return;
        }

        // iframe이 정상적으로 로드되었는지 확인
        const rect = iframe.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            console.log('📊 한국 경제 캘린더 정상 작동 중');
        } else {
            console.log('한국 캘린더 로드 실패, 정적 캘린더로 대체');
            this.showStaticCalendar();
        }
    }

    showStaticCalendar() {
        const widgetContainer = document.querySelector('.tradingview-widget-container__widget');
        if (!widgetContainer) return;

        const today = new Date();
        const todayStr = today.toLocaleDateString('ko-KR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            weekday: 'long'
        });

        widgetContainer.innerHTML = `
            <div style="
                height: 600px;
                width: 100%;
                background: #fff;
                border-radius: 8px;
                padding: 20px;
                box-sizing: border-box;
                overflow-y: auto;
            ">
                <div style="
                    text-align: center;
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #e9ecef;
                ">
                    <h2 style="
                        color: #2962ff;
                        margin: 0 0 10px 0;
                        font-size: 1.8rem;
                    ">📊 경제 캘린더</h2>
                    <p style="
                        color: #666;
                        margin: 0;
                        font-size: 1.1rem;
                    ">${todayStr}</p>
                </div>

                <div style="margin-bottom: 30px;">
                    <h3 style="
                        color: #333;
                        margin: 0 0 15px 0;
                        font-size: 1.3rem;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    ">
                        <span style="color: #ff6b6b;">🔴</span>
                        주요 경제 지표
                    </h3>
                    <div style="
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 15px;
                    ">
                        <div style="
                            background: #f8f9fa;
                            padding: 15px;
                            border-radius: 8px;
                            border-left: 4px solid #ff6b6b;
                        ">
                            <h4 style="margin: 0 0 5px 0; color: #333;">🇺🇸 미국 CPI</h4>
                            <p style="margin: 0; color: #666; font-size: 0.9rem;">소비자물가지수</p>
                        </div>
                        <div style="
                            background: #f8f9fa;
                            padding: 15px;
                            border-radius: 8px;
                            border-left: 4px solid #ffa500;
                        ">
                            <h4 style="margin: 0 0 5px 0; color: #333;">🇺🇸 FOMC</h4>
                            <p style="margin: 0; color: #666; font-size: 0.9rem;">연방공개시장위원회</p>
                        </div>
                        <div style="
                            background: #f8f9fa;
                            padding: 15px;
                            border-radius: 8px;
                            border-left: 4px solid #28a745;
                        ">
                            <h4 style="margin: 0 0 5px 0; color: #333;">🇰🇷 한국 기준금리</h4>
                            <p style="margin: 0; color: #666; font-size: 0.9rem;">한국은행 금통위</p>
                        </div>
                        <div style="
                            background: #f8f9fa;
                            padding: 15px;
                            border-radius: 8px;
                            border-left: 4px solid #007bff;
                        ">
                            <h4 style="margin: 0 0 5px 0; color: #333;">🇪🇺 ECB 정책금리</h4>
                            <p style="margin: 0; color: #666; font-size: 0.9rem;">유럽중앙은행</p>
                        </div>
                    </div>
                </div>

                <div style="margin-bottom: 30px;">
                    <h3 style="
                        color: #333;
                        margin: 0 0 15px 0;
                        font-size: 1.3rem;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    ">
                        <span style="color: #2962ff;">💼</span>
                        암호화폐 관련 이벤트
                    </h3>
                    <div style="
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 8px;
                        border: 1px solid #e9ecef;
                    ">
                        <p style="
                            margin: 0 0 10px 0;
                            color: #333;
                            font-weight: bold;
                        ">🚀 주요 암호화폐 이벤트</p>
                        <ul style="
                            margin: 0;
                            padding-left: 20px;
                            color: #666;
                        ">
                            <li>비트코인 ETF 승인 관련 소식</li>
                            <li>주요 거래소 상장/상폐 공지</li>
                            <li>메이저 프로젝트 업데이트</li>
                            <li>규제 관련 발표</li>
                        </ul>
                    </div>
                </div>

                <div style="
                    text-align: center;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 8px;
                    border: 1px solid #e9ecef;
                ">
                    <p style="
                        margin: 0 0 15px 0;
                        color: #666;
                        font-size: 0.9rem;
                    ">더 자세한 경제 캘린더는 아래 링크에서 확인하세요</p>
                    <div style="
                        display: flex;
                        gap: 10px;
                        justify-content: center;
                        flex-wrap: wrap;
                    ">
                        <a href="https://kr.tradingview.com/economic-calendar/" 
                           target="_blank" 
                           style="
                               display: inline-block;
                               padding: 10px 20px;
                               background: #2962ff;
                               color: white;
                               text-decoration: none;
                               border-radius: 5px;
                               font-size: 0.9rem;
                               margin: 5px;
                           ">TradingView 캘린더</a>
                        <a href="https://kr.investing.com/economic-calendar/" 
                           target="_blank" 
                           style="
                               display: inline-block;
                               padding: 10px 20px;
                               background: #28a745;
                               color: white;
                               text-decoration: none;
                               border-radius: 5px;
                               font-size: 0.9rem;
                               margin: 5px;
                           ">Investing.com 캘린더</a>
                        <button onclick="tabNavigation.loadTradingViewCalendar()" style="
                            padding: 10px 20px;
                            background: #007bff;
                            color: white;
                            border: none;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 0.9rem;
                            margin: 5px;
                        ">위젯 다시 로드</button>
                    </div>
                </div>
            </div>
        `;

        console.log('📊 정적 경제 캘린더 표시 완료');
    }

    showCalendarError() {
        const widgetContainer = document.querySelector('.tradingview-widget-container__widget');
        if (!widgetContainer) return;

        widgetContainer.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 600px;
                color: var(--text-color-secondary);
                text-align: center;
                padding: 20px;
                background: #fff;
                border-radius: 8px;
            ">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem; color: #ff6b6b;"></i>
                <h3 style="margin: 0 0 1rem 0; color: var(--text-color);">경제 캘린더를 불러올 수 없습니다</h3>
                <p style="margin: 0 0 1rem 0; line-height: 1.5; color: var(--text-color-secondary);">
                    네트워크 연결을 확인하고 다시 시도해주세요.<br>
                    또는 아래 링크를 통해 직접 확인하세요.
                </p>
                <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;">
                    <button onclick="tabNavigation.loadTradingViewCalendar()" style="
                        padding: 10px 20px;
                        background: #2962ff;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 0.9rem;
                        margin: 5px;
                    ">다시 시도</button>
                    <button onclick="tabNavigation.showStaticCalendar()" style="
                        padding: 10px 20px;
                        background: #28a745;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 0.9rem;
                        margin: 5px;
                    ">정적 캘린더</button>
                    <a href="https://kr.tradingview.com/economic-calendar/" 
                       target="_blank" 
                       style="
                           display: inline-block;
                           padding: 10px 20px;
                           background: #007bff;
                           color: white;
                           text-decoration: none;
                           border-radius: 5px;
                           font-size: 0.9rem;
                           margin: 5px;
                       ">TradingView 사이트로</a>
                </div>
            </div>
        `;
    }

    // 현재 활성 탭 반환
    getCurrentTab() {
        return this.currentTab;
    }

    // 특정 탭으로 전환 (외부에서 호출 가능)
    goToTab(tabName) {
        this.switchTab(tabName);
    }

    // 캘린더 새로고침
    refreshCalendar() {
        this.isCalendarLoaded = false;
        if (this.currentTab === 'economic-calendar') {
            this.loadTradingViewCalendar();
        }
    }
}

// 전역 인스턴스 생성 (호환성을 위해 유지)
const tabNavigation = new TabNavigation();

// 전역 함수로 노출 (호환성을 위해 유지)
window.TabNavigation = TabNavigation;
window.tabNavigation = tabNavigation;

console.log('📋 경제 캘린더 모듈 로드됨 (탭 관리는 news.js에서 처리)'); 