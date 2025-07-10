// 탭 네비게이션 및 경제 캘린더 모듈
class TabNavigation {
    constructor() {
        this.currentTab = 'news';
        this.isCalendarLoaded = false;
        this.init();
    }

    init() {
        // DOM이 로드된 후 초기화
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeNavigation());
        } else {
            this.initializeNavigation();
        }
    }

    initializeNavigation() {
        this.setupTabNavigation();
        console.log('📋 탭 네비게이션 초기화 완료');
    }

    setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tabName = e.target.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });
    }

    switchTab(tabName) {
        // 모든 탭 버튼에서 active 클래스 제거
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // 모든 탭 콘텐츠 숨기기
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });

        // 선택된 탭 버튼에 active 클래스 추가
        const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }

        // 선택된 탭 콘텐츠 표시
        const activeContent = document.getElementById(tabName === 'news' ? 'newsTab' : 'economicCalendarTab');
        if (activeContent) {
            activeContent.style.display = 'block';
        }

        // 경제 캘린더 탭이 선택되고 아직 로드되지 않았다면 로드
        if (tabName === 'economic-calendar' && !this.isCalendarLoaded) {
            this.loadTradingViewCalendar();
        }

        this.currentTab = tabName;
        console.log(`📋 탭 전환: ${tabName}`);
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
            ">
                <div>
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem; color: #2962ff;"></i>
                    <p style="margin: 0; font-size: 1rem;">TradingView 경제 캘린더를 불러오는 중...</p>
                </div>
            </div>
        `;

        // 즉시 iframe 방식으로 로드 (더 안정적)
        setTimeout(() => {
            this.loadWithIframe();
        }, 1000);
    }

    loadWithIframe() {
        const widgetContainer = document.querySelector('.tradingview-widget-container__widget');
        if (!widgetContainer) return;

        console.log('📊 TradingView iframe 방식으로 로드');

        try {
            // 한국어 TradingView 경제 캘린더 iframe
            widgetContainer.innerHTML = `
                <iframe 
                    src="https://www.tradingview.com/embed-widget/events/?locale=ko&importanceFilter=-1%2C0%2C1&countryFilter=us%2Ceu%2Cjp%2Ccn%2Ckr%2Cgb%2Cca%2Cau%2Cde%2Cfr%2Cit%2Ces%2Cbr%2Cin%2Cru%2Cmx%2Cza%2Ctr%2Csg%2Chk%2Ctw%2Cth%2Cmy%2Cid%2Cph%2Cvn&currencyFilter=USD%2CEUR%2CJPY%2CGBP%2CCHF%2CAUD%2CCAD%2CNZD%2CCNY%2CKRW%2CBTC%2CETH&utm_source=&utm_medium=widget&utm_campaign=events&utm_term="
                    width="100%"
                    height="600"
                    frameborder="0"
                    scrolling="no"
                    allowfullscreen="true"
                    sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
                    referrerpolicy="no-referrer-when-downgrade"
                    style="
                        border: none;
                        width: 100%;
                        height: 600px;
                        background: #fff;
                        border-radius: 8px;
                    "
                    onload="console.log('📊 TradingView iframe 로드 완료'); tabNavigation.onIframeLoad();"
                    onerror="console.error('📊 TradingView iframe 로드 실패'); tabNavigation.showCalendarError();">
                </iframe>
            `;

            this.isCalendarLoaded = true;
            console.log('📊 TradingView iframe 설정 완료');

            // 10초 후에도 로드되지 않으면 대체 방법 시도
            setTimeout(() => {
                this.checkIframeLoad();
            }, 10000);

        } catch (error) {
            console.error('TradingView iframe 생성 중 오류:', error);
            this.showCalendarError();
        }
    }

    onIframeLoad() {
        console.log('📊 TradingView 캘린더 iframe 로드 성공');
        // 로드 성공 시 추가 처리가 필요하면 여기에 추가
    }

    checkIframeLoad() {
        const iframe = document.querySelector('.tradingview-widget-container__widget iframe');
        if (!iframe) {
            console.log('iframe이 없어서 대체 방법 시도');
            this.loadAlternativeCalendar();
            return;
        }

        // iframe의 로드 상태 확인
        try {
            if (iframe.contentDocument || iframe.contentWindow) {
                console.log('📊 TradingView iframe 정상 작동 중');
            } else {
                console.log('iframe 접근 불가, 대체 방법 시도');
                this.loadAlternativeCalendar();
            }
        } catch (error) {
            console.log('iframe 접근 제한, 대체 방법 시도');
            this.loadAlternativeCalendar();
        }
    }

    loadAlternativeCalendar() {
        const widgetContainer = document.querySelector('.tradingview-widget-container__widget');
        if (!widgetContainer) return;

        console.log('📊 대체 경제 캘린더 로드');

        // 대체 경제 캘린더 (Investing.com 한국어)
        widgetContainer.innerHTML = `
            <div style="height: 600px; width: 100%; background: #fff; border-radius: 8px; overflow: hidden;">
                <iframe 
                    src="https://kr.investing.com/economic-calendar/"
                    width="100%"
                    height="600"
                    frameborder="0"
                    scrolling="yes"
                    allowfullscreen="true"
                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                    referrerpolicy="no-referrer-when-downgrade"
                    style="
                        border: none;
                        width: 100%;
                        height: 600px;
                        background: #fff;
                    "
                    onload="console.log('📊 대체 경제 캘린더 로드 완료')"
                    onerror="console.error('📊 대체 경제 캘린더 로드 실패'); tabNavigation.showCalendarError();">
                </iframe>
            </div>
        `;

        console.log('📊 대체 경제 캘린더 설정 완료');
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
                    <button onclick="tabNavigation.loadAlternativeCalendar()" style="
                        padding: 10px 20px;
                        background: #28a745;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 0.9rem;
                        margin: 5px;
                    ">대체 캘린더</button>
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

// 전역 인스턴스 생성
const tabNavigation = new TabNavigation();

// 전역 함수로 노출
window.TabNavigation = TabNavigation;
window.tabNavigation = tabNavigation; 