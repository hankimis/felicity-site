// 사이드바 광고 시스템
class SidebarAds {
    constructor() {
        this.leftAd = null;
        this.rightAd = null;
        this.isVisible = false;
        this.mainBanner = null;
        this.throttleTimer = null;
        
        this.init();
    }
    
    init() {
        this.createAdElements();
        this.setupEventListeners();
        // 초기 표시는 지연시켜서 메인 배너가 완전히 로드된 후에 실행
        setTimeout(() => {
            this.updateAdVisibility();
        }, 500);
    }
    
    createAdElements() {
        // 메인 배너 참조
        this.mainBanner = document.querySelector('.main-banner');
        
        // 왼쪽 광고
        this.leftAd = document.createElement('div');
        this.leftAd.className = 'sidebar-ad sidebar-ad-left';
        this.leftAd.innerHTML = `
            <div class="ad-content">
                <div class="ad-close" onclick="sidebarAds.hideAd('left')">×</div>
                <a href="#" target="_blank" class="ad-link">
                    <img src="assets/lbankbanner.png" alt="LBank 광고" class="ad-image">
                    <div class="ad-text">
                        <h3>LBank 거래소</h3>
                        <p>최대 70% 수수료 할인</p>
                        <span class="ad-cta">지금 가입하기</span>
                    </div>
                </a>
            </div>
        `;
        
        // 오른쪽 광고
        this.rightAd = document.createElement('div');
        this.rightAd.className = 'sidebar-ad sidebar-ad-right';
        this.rightAd.innerHTML = `
            <div class="ad-content">
                <div class="ad-close" onclick="sidebarAds.hideAd('right')">×</div>
                <a href="#" target="_blank" class="ad-link">
                    <img src="assets/partner/bitget.png" alt="Bitget 광고" class="ad-image">
                    <div class="ad-text">
                        <h3>Bitget 거래소</h3>
                        <p>신규 가입 보너스</p>
                        <span class="ad-cta">혜택 받기</span>
                    </div>
                </a>
            </div>
        `;
        
        // DOM에 추가
        document.body.appendChild(this.leftAd);
        document.body.appendChild(this.rightAd);
    }
    
    setupEventListeners() {
        // 스크롤 이벤트 (쓰로틀링 적용)
        window.addEventListener('scroll', () => {
            if (this.throttleTimer) return;
            
            this.throttleTimer = setTimeout(() => {
                this.updateAdVisibility();
                this.throttleTimer = null;
            }, 16); // 60fps
        });
        
        // 리사이즈 이벤트
        window.addEventListener('resize', () => {
            setTimeout(() => {
                this.updateAdVisibility();
            }, 100);
        });
        
        // 페이지 로드 완료 후 초기화
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    this.updateAdVisibility();
                }, 300);
            });
        }
        
        // 이미지 로드 완료 후 재계산
        window.addEventListener('load', () => {
            setTimeout(() => {
                this.updateAdVisibility();
            }, 100);
        });
    }
    
    updateAdVisibility() {
        // 메인 배너가 없으면 다시 찾기
        if (!this.mainBanner) {
            this.mainBanner = document.querySelector('.main-banner');
            if (!this.mainBanner) return;
        }
        
        const windowWidth = window.innerWidth;
        const scrollY = window.scrollY;
        const bannerHeight = this.mainBanner.offsetHeight;
        const bannerTop = this.mainBanner.offsetTop;
        const bannerBottom = bannerTop + bannerHeight;
        
        // 데스크톱에서만 표시 (1400px 이상)
        const shouldShow = windowWidth >= 1400;
        
        if (shouldShow && !this.isVisible) {
            this.showAds();
        } else if (!shouldShow && this.isVisible) {
            this.hideAds();
        }
        
        // 광고 위치 업데이트
        if (this.isVisible) {
            this.updateAdPosition();
        }
    }
    
    updateAdPosition() {
        if (!this.mainBanner) return;
        
        const scrollY = window.scrollY;
        const windowHeight = window.innerHeight;
        const bannerHeight = this.mainBanner.offsetHeight;
        const bannerTop = this.mainBanner.offsetTop;
        const bannerBottom = bannerTop + bannerHeight;
        
        let topPosition;
        
        // 메인 배너 아래에 고정되어 있다가 스크롤하면 따라오기
        const fixedPosition = bannerBottom + 20; // 메인 배너 아래 고정 위치
        const followPosition = scrollY + 120; // 스크롤 따라가는 위치
        
        // 스크롤이 배너 아래까지 오면 따라오기 시작
        if (scrollY + 120 > fixedPosition) {
            topPosition = followPosition;
        } else {
            topPosition = fixedPosition;
        }
        
        if (this.leftAd) {
            this.leftAd.style.top = `${topPosition}px`;
        }
        if (this.rightAd) {
            this.rightAd.style.top = `${topPosition}px`;
        }
    }
    
    showAds() {
        this.isVisible = true;
        
        // 위치를 먼저 설정한 후 표시
        this.updateAdPosition();
        
        if (this.leftAd) {
            this.leftAd.classList.add('visible');
        }
        if (this.rightAd) {
            this.rightAd.classList.add('visible');
        }
    }
    
    hideAds() {
        this.isVisible = false;
        
        if (this.leftAd) {
            this.leftAd.classList.remove('visible');
        }
        if (this.rightAd) {
            this.rightAd.classList.remove('visible');
        }
    }
    
    hideAd(side) {
        if (side === 'left' && this.leftAd) {
            this.leftAd.style.display = 'none';
        } else if (side === 'right' && this.rightAd) {
            this.rightAd.style.display = 'none';
        }
    }
    
    // 광고 내용 업데이트 메서드
    updateAdContent(side, content) {
        const ad = side === 'left' ? this.leftAd : this.rightAd;
        if (ad) {
            const adContent = ad.querySelector('.ad-content');
            if (adContent) {
                adContent.innerHTML = content;
            }
        }
    }
}

// 전역 인스턴스 생성
let sidebarAds;

// DOM 로드 후 초기화
document.addEventListener('DOMContentLoaded', () => {
    // 메인 배너가 로드될 때까지 기다린 후 초기화
    const initializeAds = () => {
        const mainBanner = document.querySelector('.main-banner');
        if (mainBanner) {
            sidebarAds = new SidebarAds();
        } else {
            // 메인 배너가 없으면 100ms 후 다시 시도
            setTimeout(initializeAds, 100);
        }
    };
    
    initializeAds();
}); 