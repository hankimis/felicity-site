// 팝업 배너 관리 시스템
class PopupBanner {
    constructor() {
        this.overlay = null;
        this.isShown = false;
        this.storageKey = 'popup_banner_shown';
        this.expireTime = 24 * 60 * 60 * 1000; // 24시간
        
        this.init();
    }
    
    init() {
        // 이미 오늘 보여줬는지 확인
        if (this.wasShownToday()) {
            return;
        }
        
        // 페이지 로드 후 2초 뒤에 팝업 표시
        setTimeout(() => {
            this.show();
        }, 2000);
    }
    
    wasShownToday() {
        const lastShown = localStorage.getItem(this.storageKey);
        if (!lastShown) return false;
        
        const now = Date.now();
        const lastShownTime = parseInt(lastShown);
        
        return (now - lastShownTime) < this.expireTime;
    }
    
    markAsShown() {
        localStorage.setItem(this.storageKey, Date.now().toString());
    }
    
    createPopupHTML() {
        return `
            <div class="popup-overlay" id="popup-overlay">
                <div class="popup-banner">
                    <button class="popup-close" id="popup-close">×</button>
                    
                    <div class="popup-decorative-elements">
                        <div class="popup-sphere popup-sphere-1"></div>
                        <div class="popup-sphere popup-sphere-2"></div>
                        <div class="popup-sphere popup-sphere-3"></div>
                    </div>
                    
                    <div class="popup-content">
                        <div class="popup-logo">ONBit</div>
                        
                        <h1 class="popup-title">최대 수수료<br>페이백</h1>
                        <p class="popup-subtitle">국내 최고 수준의<br>수수료 환급 서비스</p>
                        
                        <div class="popup-highlight">최대</div>
                        
                        <div class="popup-number popup-number-65">65<span style="font-size: 0.4em;">%</span></div>
                        
                        <div class="popup-bottom-text">
                            <span class="popup-bottom-highlight">실시간 정산<br>보장된 페이백</span>
                            안전하고 투명한 거래
                        </div>
                    </div>
                    
                    <a href="/affiliated/" class="popup-cta-button">
                        지금 시작하기
                    </a>
                </div>
            </div>
        `;
    }
    
    show() {
        if (this.isShown) return;
        
        // HTML 생성 및 DOM에 추가
        const popupHTML = this.createPopupHTML();
        document.body.insertAdjacentHTML('beforeend', popupHTML);
        
        // 요소 참조
        this.overlay = document.getElementById('popup-overlay');
        const closeBtn = document.getElementById('popup-close');
        
        // 이벤트 리스너 등록
        closeBtn.addEventListener('click', () => this.hide());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.hide();
            }
        });
        
        // ESC 키로 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isShown) {
                this.hide();
            }
        });
        
        // 애니메이션으로 표시
        setTimeout(() => {
            this.overlay.classList.add('show');
        }, 100);
        
        this.isShown = true;
        
        // 표시 기록
        this.markAsShown();
        
        // 바디 스크롤 비활성화
        document.body.style.overflow = 'hidden';
    }
    
    hide() {
        if (!this.isShown || !this.overlay) return;
        
        this.overlay.classList.remove('show');
        
        // 애니메이션 완료 후 DOM에서 제거
        setTimeout(() => {
            if (this.overlay && this.overlay.parentNode) {
                this.overlay.parentNode.removeChild(this.overlay);
            }
            this.overlay = null;
            this.isShown = false;
            
            // 바디 스크롤 활성화
            document.body.style.overflow = '';
        }, 300);
    }
    
    // 강제로 다시 보여주기 (테스트용)
    forceShow() {
        localStorage.removeItem(this.storageKey);
        this.show();
    }
    
    // 오늘 하루 보지 않기
    hideForToday() {
        this.markAsShown();
        this.hide();
    }
}

// 전역 인스턴스
let popupBanner;

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', () => {
    // 메인 페이지에서만 동작
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        popupBanner = new PopupBanner();
        
        // 전역 함수로 노출 (디버깅용)
        window.showPopup = () => {
            if (popupBanner) {
                popupBanner.forceShow();
            }
        };
        
        window.hidePopup = () => {
            if (popupBanner) {
                popupBanner.hide();
            }
        };
    }
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
    if (popupBanner && popupBanner.isShown) {
        document.body.style.overflow = '';
    }
}); 