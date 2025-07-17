// 🐋 고래탐지 관리자 - 독립적으로 작동하는 고래탐지 시스템
class WhaleTrackerManager {
    constructor() {
        this.whaleTracker = null;
        this.isInitialized = false;
        this.container = null;
        this.retryCount = 0;
        this.maxRetries = 5;
        
        console.log('🐋 고래탐지 관리자 초기화');
    }

    // 🐋 고래탐지 초기화
    async init() {
        if (this.isInitialized) {
            console.log('✅ 고래탐지가 이미 초기화되어 있습니다.');
            return;
        }

        console.log('🐋 고래탐지 초기화 시작...');
        
        try {
            // WhaleTracker 클래스 로드 확인
            await this.ensureWhaleTrackerLoaded();
            
            // 컨테이너 설정
            await this.setupContainer();
            
            // WhaleTracker 인스턴스 생성
            this.createWhaleTrackerInstance();
            
            this.isInitialized = true;
            console.log('✅ 고래탐지 초기화 완료');
            
        } catch (error) {
            console.error('❌ 고래탐지 초기화 실패:', error);
            this.handleInitializationError();
        }
    }

    // 🐋 WhaleTracker 클래스 로드 확인 (강화된 버전)
    async ensureWhaleTrackerLoaded() {
        return new Promise(async (resolve, reject) => {
            // 이미 로드되어 있는지 확인
            if (typeof window.WhaleTracker !== 'undefined') {
                console.log('✅ WhaleTracker 클래스가 이미 로드됨');
                resolve();
                return;
            }
            
            console.log('🔄 WhaleTracker 클래스 강제 로딩 시작...');
            
            // 동적 스크립트 로딩 시도
            try {
                await this.loadWhaleTrackerScript();
                resolve();
                return;
            } catch (scriptError) {
                console.warn('⚠️ 동적 스크립트 로딩 실패:', scriptError);
            }
            
            // 폴백: 기존 방식으로 대기
            const checkWhaleTracker = () => {
                if (typeof window.WhaleTracker !== 'undefined') {
                    console.log('✅ WhaleTracker 클래스 로드됨 (폴백)');
                    resolve();
                } else if (this.retryCount < this.maxRetries) {
                    this.retryCount++;
                    console.log(`⏳ WhaleTracker 클래스 로드 대기 중... (${this.retryCount}/${this.maxRetries})`);
                    setTimeout(checkWhaleTracker, 800);
                } else {
                    reject(new Error('WhaleTracker 클래스를 로드할 수 없습니다.'));
                }
            };
            
            checkWhaleTracker();
        });
    }
    
    // 🐋 동적 스크립트 로딩
    async loadWhaleTrackerScript() {
        return new Promise((resolve, reject) => {
            // 이미 스크립트가 있는지 확인
            const existingScript = document.querySelector('script[src*="whale-tracker.js"]');
            if (existingScript) {
                console.log('📜 WhaleTracker 스크립트가 이미 존재함 - 로딩 대기');
                setTimeout(() => {
                    if (typeof window.WhaleTracker !== 'undefined') {
                        resolve();
                    } else {
                        reject(new Error('기존 스크립트에서 클래스 로드 실패'));
                    }
                }, 2000);
                return;
            }
            
            console.log('📜 WhaleTracker 스크립트 동적 로딩 중...');
            const script = document.createElement('script');
            script.src = '/js/whale-tracker.js';
            script.type = 'text/javascript';
            
            script.onload = () => {
                console.log('✅ WhaleTracker 스크립트 로드 완료');
                // 클래스가 실제로 사용 가능한지 확인
                setTimeout(() => {
                    if (typeof window.WhaleTracker !== 'undefined') {
                        resolve();
                    } else {
                        reject(new Error('스크립트는 로드되었지만 클래스를 찾을 수 없음'));
                    }
                }, 500);
            };
            
            script.onerror = (error) => {
                console.error('❌ WhaleTracker 스크립트 로드 실패:', error);
                reject(new Error('스크립트 로드 실패'));
            };
            
            document.head.appendChild(script);
        });
    }

    // 🐋 컨테이너 설정
    async setupContainer() {
        // 기존 컨테이너 찾기
        this.container = document.querySelector('#whale-transactions') || 
                        document.querySelector('.whale-trades-container') ||
                        document.querySelector('.whale-tracker-card');

        if (!this.container) {
            console.log('🔨 고래탐지 컨테이너 생성 중...');
            this.createWhaleContainer();
        } else {
            console.log('✅ 기존 고래탐지 컨테이너 발견');
            this.setupExistingContainer();
        }
    }

    // 🐋 새로운 고래탐지 컨테이너 생성
    createWhaleContainer() {
        this.container = document.createElement('div');
        this.container.className = 'whale-tracker-card standalone';
        this.container.id = 'whale-transactions';
        
        // 스타일 설정
        this.container.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            width: 380px;
            max-height: 600px;
            background: var(--bg-primary, #ffffff);
            border: 1px solid var(--border-color, #e5e7eb);
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            overflow: hidden;
            font-family: 'Pretendard', sans-serif;
        `;

        // HTML 구조 생성
        this.container.innerHTML = `
            <div class="whale-tracker-header" style="
                padding: 16px;
                border-bottom: 1px solid var(--border-color, #e5e7eb);
                background: var(--bg-secondary, #f8fafc);
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <h3 style="
                    margin: 0;
                    font-size: 16px;
                    color: var(--text-primary, #1f2937);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                ">
                    <i class="fas fa-fish" style="color: #3b82f6;"></i>
                    실시간 고래 거래
                </h3>
                <div class="whale-controls" style="
                    display: flex;
                    gap: 8px;
                    align-items: center;
                ">
                    <span class="whale-status" style="
                        font-size: 12px;
                        color: var(--text-secondary, #6b7280);
                        font-weight: 500;
                    ">연결 중...</span>
                    <button class="whale-settings-btn" id="whale-settings-btn" style="
                        padding: 6px 8px;
                        background: none;
                        border: 1px solid var(--border-color, #e5e7eb);
                        border-radius: 6px;
                        cursor: pointer;
                        color: var(--text-secondary, #6b7280);
                        transition: all 0.2s ease;
                        font-size: 12px;
                    ">
                        <i class="fas fa-cog"></i>
                    </button>
                    <button class="whale-close-btn" id="whale-close-btn" style="
                        padding: 6px 8px;
                        background: none;
                        border: 1px solid var(--border-color, #e5e7eb);
                        border-radius: 6px;
                        cursor: pointer;
                        color: var(--text-secondary, #6b7280);
                        transition: all 0.2s ease;
                        font-size: 12px;
                    ">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="whale-trades-container" id="whale-trades-container" style="
                padding: 12px;
                max-height: 500px;
                overflow-y: auto;
            ">
                <div class="whale-trades-list">
                    <div class="whale-loading" style="
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                        padding: 40px;
                        color: var(--text-secondary, #6b7280);
                    ">
                        <i class="fas fa-spinner fa-spin" style="font-size: 16px;"></i>
                        <span>고래 거래 감지 중...</span>
                    </div>
                </div>
            </div>
        `;

        // DOM에 추가
        document.body.appendChild(this.container);
        
        // 이벤트 리스너 설정
        this.setupContainerEvents();
        
        console.log('✅ 고래탐지 컨테이너 생성 완료');
    }

    // 🐋 기존 컨테이너 설정
    setupExistingContainer() {
        // 기존 컨테이너가 올바른 구조를 가지고 있는지 확인
        if (!this.container.querySelector('.whale-trades-list')) {
            const tradesContainer = this.container.querySelector('.whale-trades-container') || this.container;
            
            if (!tradesContainer.querySelector('.whale-trades-list')) {
                const tradesList = document.createElement('div');
                tradesList.className = 'whale-trades-list';
                tradesList.innerHTML = `
                    <div class="whale-loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>고래 거래 감지 중...</span>
                    </div>
                `;
                tradesContainer.appendChild(tradesList);
            }
        }
        
        this.setupContainerEvents();
    }

    // 🐋 컨테이너 이벤트 설정
    setupContainerEvents() {
        // 닫기 버튼 이벤트
        const closeBtn = this.container.querySelector('#whale-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hide();
            });
        }

        // 드래그 이벤트 (고정 위치용)
        const header = this.container.querySelector('.whale-tracker-header');
        if (header) {
            this.makeDraggable(header);
        }
    }

    // 🐋 드래그 가능하게 만들기
    makeDraggable(header) {
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'I') return;
            
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            isDragging = true;
            header.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                xOffset = currentX;
                yOffset = currentY;
                
                this.container.style.transform = `translate(${currentX}px, ${currentY}px)`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                header.style.cursor = 'grab';
            }
        });

        header.style.cursor = 'grab';
    }

    // 🐋 WhaleTracker 인스턴스 생성
    createWhaleTrackerInstance() {
        try {
            const tradesContainer = this.container.querySelector('#whale-trades-container') || 
                                  this.container.querySelector('.whale-trades-container') ||
                                  this.container;

            this.whaleTracker = new window.WhaleTracker(tradesContainer);
            window.whaleTracker = this.whaleTracker; // 전역 참조 설정
            
            console.log('✅ WhaleTracker 인스턴스 생성 완료');
            
        } catch (error) {
            console.error('❌ WhaleTracker 인스턴스 생성 실패:', error);
            throw error;
        }
    }

    // 🐋 초기화 오류 처리
    handleInitializationError() {
        if (this.retryCount < this.maxRetries) {
            console.log(`🔄 고래탐지 초기화 재시도... (${this.retryCount + 1}/${this.maxRetries})`);
            setTimeout(() => {
                this.retryCount++;
                this.init();
            }, 2000);
        } else {
            console.error('❌ 고래탐지 초기화 최종 실패');
            this.showErrorMessage();
        }
    }

    // 🐋 오류 메시지 표시
    showErrorMessage() {
        if (this.container) {
            const errorHTML = `
                <div class="whale-error" style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    padding: 40px;
                    color: var(--text-secondary, #6b7280);
                    text-align: center;
                ">
                    <i class="fas fa-exclamation-triangle" style="font-size: 24px; color: #ef4444;"></i>
                    <span>고래탐지 연결 실패</span>
                    <button onclick="window.whaleTrackerManager?.retry()" style="
                        padding: 8px 16px;
                        background: #3b82f6;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 12px;
                    ">다시 시도</button>
                </div>
            `;
            
            const tradesContainer = this.container.querySelector('.whale-trades-container');
            if (tradesContainer) {
                tradesContainer.innerHTML = errorHTML;
            }
        }
    }

    // 🐋 재시도
    retry() {
        this.retryCount = 0;
        this.isInitialized = false;
        this.init();
    }

    // 🐋 표시
    show() {
        if (this.container) {
            this.container.style.display = 'block';
        }
        
        if (!this.isInitialized) {
            this.init();
        }
    }

    // 🐋 숨기기
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }

    // 🐋 토글
    toggle() {
        if (this.container) {
            if (this.container.style.display === 'none') {
                this.show();
            } else {
                this.hide();
            }
        }
    }

    // 🐋 정리
    destroy() {
        if (this.whaleTracker && typeof this.whaleTracker.destroy === 'function') {
            this.whaleTracker.destroy();
        }
        
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        this.whaleTracker = null;
        this.container = null;
        this.isInitialized = false;
        
        console.log('🐋 고래탐지 관리자 정리 완료');
    }
}

// 🐋 전역 인스턴스 생성
window.WhaleTrackerManager = WhaleTrackerManager;

// 🐋 자동 초기화 (DOM 로드 후)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (!window.whaleTrackerManager) {
                window.whaleTrackerManager = new WhaleTrackerManager();
                window.whaleTrackerManager.init();
            }
        }, 1000);
    });
} else {
    // DOM이 이미 로드된 경우
    setTimeout(() => {
        if (!window.whaleTrackerManager) {
            window.whaleTrackerManager = new WhaleTrackerManager();
            window.whaleTrackerManager.init();
        }
    }, 1000);
} 