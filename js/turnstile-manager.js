// =========================
// 통합 Turnstile 관리자
// 모든 Turnstile 렌더링을 단일 시스템으로 통합
// =========================

class TurnstileManager {
    constructor() {
        this.isRendering = false;
        this.isRendered = false;
        this.currentWidget = null;
        this.sitekey = '0x4AAAAAABhG8vjyB5nsUxll';
        this.setupComplete = false;
        
        console.log('🔧 TurnstileManager 초기화');
        this.init();
    }
    
    init() {
        // 전역 함수로 등록
        window.renderTurnstile = this.render.bind(this);
        window.TurnstileManager = this;
        
        // 다른 스크립트들이 완전히 로드되도록 충분한 지연 후 초기화
        const initializeAfterDelay = () => {
            console.log('🚀 TurnstileManager 지연 초기화 시작');
            this.setupEvents();
        };
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(initializeAfterDelay, 1000); // 1초 지연
            });
        } else {
            setTimeout(initializeAfterDelay, 1000); // 1초 지연
        }
    }
    
    setupEvents() {
        if (this.setupComplete) {
            console.log('⏸️ TurnstileManager 이벤트 이미 설정됨');
            return;
        }
        this.setupComplete = true;
        
        console.log('🎯 TurnstileManager 이벤트 설정');
        
        // 즉시 한 번 실행
        this.addSignupButtonListeners();
        
        // 조금 더 자주 체크 (캐시 문제 대응)
        setInterval(() => this.addSignupButtonListeners(), 500);
        
        // 페이지 가시성 변경 시에도 체크
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                setTimeout(() => this.addSignupButtonListeners(), 100);
            }
        });
    }
    
    addSignupButtonListeners() {
        const buttons = document.querySelectorAll('[data-action="open-signup-modal"]');
        buttons.forEach((btn, index) => {
            if (!btn.dataset.turnstileManagerSetup) {
                btn.dataset.turnstileManagerSetup = 'true';
                btn.addEventListener('click', () => {
                    console.log(`🔄 TurnstileManager: 회원가입 버튼 ${index + 1} 클릭`);
                    setTimeout(() => this.render(), 300);
                });
            }
        });
    }
    
    async render() {
        console.log('🔄 TurnstileManager.render() 호출');
        
        // 이미 렌더링 중이면 무시
        if (this.isRendering) {
            console.log('⏸️ TurnstileManager: 이미 렌더링 중 - 무시');
            return;
        }
        
        // 기존 렌더링된 것이 있고 유효하면 무시
        if (this.isRendered && this.isCurrentWidgetValid()) {
            console.log('✅ TurnstileManager: 유효한 Turnstile 이미 존재 - 무시');
            return;
        }
        
        this.isRendering = true;
        
        try {
            // 1. 기존 모든 Turnstile 제거
            this.removeAllTurnstiles();
            
            // 2. Turnstile 스크립트 로드 대기
            await this.ensureScriptLoaded();
            
            // 3. 새 Turnstile 요소 준비
            const element = this.prepareElement();
            if (!element) {
                throw new Error('Turnstile 요소 준비 실패');
            }
            
            // 4. 렌더링 실행
            await this.performRender(element);
            
            console.log('✅ TurnstileManager: 렌더링 완료');
            
        } catch (error) {
            console.error('❌ TurnstileManager 렌더링 오류:', error);
            this.isRendered = false;
            this.currentWidget = null;
        } finally {
            this.isRendering = false;
        }
    }
    
    removeAllTurnstiles() {
        console.log('🗑️ TurnstileManager: 모든 기존 Turnstile 제거');
        
        // 모든 cf-turnstile 요소 찾기
        const turnstiles = document.querySelectorAll('.cf-turnstile');
        turnstiles.forEach((element, index) => {
            console.log(`🗑️ Turnstile 요소 ${index + 1} 제거 중...`);
            
            // Turnstile API로 reset 시도
            if (window.turnstile && element.querySelector('iframe')) {
                try {
                    window.turnstile.reset(element);
                } catch (e) {
                    console.log('Reset 실패, 직접 제거:', e);
                }
            }
            
            // 내용 완전 제거
            element.innerHTML = '';
        });
        
        // 상태 초기화
        this.isRendered = false;
        this.currentWidget = null;
    }
    
    async ensureScriptLoaded() {
        return new Promise((resolve) => {
            if (window.turnstile) {
                console.log('✅ TurnstileManager: 스크립트 이미 로드됨');
                resolve();
                return;
            }
            
            // 기존 스크립트 찾기
            const existingScript = document.querySelector('script[src*="turnstile"]');
            if (existingScript) {
                console.log('⏳ TurnstileManager: 기존 스크립트 로딩 대기');
                const checkLoaded = () => {
                    if (window.turnstile) {
                        resolve();
                    } else {
                        setTimeout(checkLoaded, 100);
                    }
                };
                checkLoaded();
            } else {
                console.log('📥 TurnstileManager: 새 스크립트 로드');
                const script = document.createElement('script');
                script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
                script.async = true;
                script.defer = true;
                script.onload = () => {
                    console.log('✅ TurnstileManager: 스크립트 로드 완료');
                    resolve();
                };
                script.onerror = () => {
                    console.error('❌ TurnstileManager: 스크립트 로드 실패');
                    resolve(); // 계속 진행
                };
                document.head.appendChild(script);
            }
        });
    }
    
    prepareElement() {
        console.log('📝 TurnstileManager: 요소 준비');
        
        // 기존 요소 찾기
        let element = document.getElementById('cf-turnstile');
        
        if (!element) {
            // 회원가입 폼 찾기
            const signupForm = document.getElementById('signup-form');
            if (!signupForm) {
                console.error('❌ 회원가입 폼 없음');
                return null;
            }
            
            // 새 요소 생성
            const container = document.createElement('div');
            container.className = 'input-group';
            container.innerHTML = `<div id="cf-turnstile" class="cf-turnstile" data-sitekey="${this.sitekey}"></div>`;
            
            const submitButton = signupForm.querySelector('button[type="submit"]');
            if (submitButton) {
                signupForm.insertBefore(container, submitButton);
                element = document.getElementById('cf-turnstile');
                console.log('✅ TurnstileManager: 새 요소 생성');
            }
        }
        
        return element;
    }
    
    async performRender(element) {
        if (!window.turnstile) {
            throw new Error('Turnstile 스크립트 없음');
        }
        
        console.log('🎨 TurnstileManager: 렌더링 실행');
        
        const theme = document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light';
        
        return new Promise((resolve, reject) => {
            try {
                this.currentWidget = window.turnstile.render(element, {
                    sitekey: this.sitekey,
                    theme: theme,
                    callback: (token) => {
                        console.log('✅ TurnstileManager: 인증 완료');
                        this.isRendered = true;
                        resolve(token);
                    },
                    'error-callback': () => {
                        console.log('❌ TurnstileManager: 인증 오류');
                        this.isRendered = false;
                        this.currentWidget = null;
                        reject(new Error('Turnstile 인증 오류'));
                    }
                });
                
                console.log('✅ TurnstileManager: 렌더링 시작됨');
                this.isRendered = true;
                
            } catch (error) {
                console.error('❌ TurnstileManager: 렌더링 예외:', error);
                reject(error);
            }
        });
    }
    
    isCurrentWidgetValid() {
        const element = document.getElementById('cf-turnstile');
        return element && element.querySelector('iframe') && this.currentWidget;
    }
    
    getToken() {
        const input = document.querySelector('#cf-turnstile input[name="cf-turnstile-response"]');
        return input ? input.value : null;
    }
    
    reset() {
        console.log('🔄 TurnstileManager: 수동 리셋');
        this.removeAllTurnstiles();
        setTimeout(() => this.render(), 100);
    }
}

// 강력한 초기화 (캐시 문제 대응)
(function() {
    // 기존 TurnstileManager 인스턴스 제거
    if (window.TurnstileManager) {
        console.log('🗑️ 기존 TurnstileManager 제거');
        delete window.TurnstileManager;
    }
    
    // 새 인스턴스 생성
    const manager = new TurnstileManager();
    
    // 추가 안전장치: 페이지 로드 완료 후에도 한 번 더 초기화
    window.addEventListener('load', () => {
        setTimeout(() => {
            console.log('🔄 페이지 로드 완료 후 TurnstileManager 재점검');
            manager.addSignupButtonListeners();
        }, 2000);
    });
    
    console.log('🚀 TurnstileManager 강력 초기화 완료');
})(); 