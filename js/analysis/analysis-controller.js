/**
 * Analysis Dashboard Controller
 * 모든 분석 모듈을 관리하는 메인 컨트롤러
 */

// 중복 선언 방지
if (typeof window.AnalysisController === 'undefined') {
    window.AnalysisController = class AnalysisController {
        constructor() {
            this.modules = {};
            this.settings = {
                whaleBtcThreshold: 50,
                whaleEthThreshold: 1000,
                enableNotifications: true,
                enableSound: true
            };
            
            this.init();
        }

        async init() {
            console.log('🚀 Analysis Dashboard initializing...');
            
            // 설정 로드
            this.loadSettings();
            
            // 모듈 초기화
            await this.initializeModules();
            
            // 이벤트 리스너 설정
            this.setupEventListeners();
            
            // 실시간 데이터 시작
            this.startRealTimeTracking();
            
            console.log('✅ Analysis Dashboard initialized');
        }

        async initializeModules() {
            try {
                // 고래 추적 모듈 - 기존 인스턴스 사용
                this.modules.whaleTracker = window.whaleTracker || new WhaleTracker(this.settings);
                
                // 청산 추적 모듈
                // this.modules.liquidationTracker = new LiquidationTracker();
                
                // 롱숏 비율 모듈
                this.modules.longShortTracker = new LongShortTracker();
                
                // 기술지표 모듈
                this.modules.technicalIndicators = new TechnicalIndicators();
                
                // 실시간 거래 모듈
                this.modules.realtimeTrader = new RealtimeTrader();
                
                // 감정 분석 모듈
                this.modules.sentimentAnalysis = new SentimentAnalysis();
                
                // 오더북 모듈
                this.modules.orderbookTracker = new OrderbookTracker();
                
                // 히트맵 모듈
                this.modules.marketHeatmap = new MarketHeatmap();
                
                console.log('📊 All modules initialized');
            } catch (error) {
                console.error('❌ Error initializing modules:', error);
                this.showToast('모듈 초기화 실패', 'error');
            }
        }

        setupEventListeners() {
            // 새로고침 버튼
            document.getElementById('refresh-all')?.addEventListener('click', () => {
                this.refreshAllData();
            });

            // 설정 버튼
            document.getElementById('settings-btn')?.addEventListener('click', () => {
                this.showSettingsModal();
            });

            // 설정 모달 이벤트
            document.getElementById('save-settings')?.addEventListener('click', () => {
                this.saveSettings();
            });

            document.getElementById('cancel-settings')?.addEventListener('click', () => {
                this.hideSettingsModal();
            });

            document.querySelector('.modal-close')?.addEventListener('click', () => {
                this.hideSettingsModal();
            });

            // 각 카드의 새로고침 버튼
            document.getElementById('whale-refresh')?.addEventListener('click', () => {
                this.modules.whaleTracker?.refresh();
            });
        }

        async startRealTimeTracking() {
            // 헤더 가격 정보 업데이트
            this.updateHeaderPrices();
            
            // 모든 모듈 시작
            Object.values(this.modules).forEach(module => {
                if (module && typeof module.start === 'function') {
                    module.start();
                }
            });

            // 정기적으로 데이터 업데이트
            setInterval(() => {
                this.updateHeaderPrices();
            }, 30000); // 30초마다
        }

        async updateHeaderPrices() {
            // header-content가 제거되었으므로 이 메서드는 비활성화
            // 필요시 개별 카드에서 가격 정보를 업데이트하도록 변경
            console.log('Header prices update disabled - header removed');
        }

        async refreshAllData() {
            this.showToast('모든 데이터를 새로고침하는 중...', 'info');
            
            try {
                // 헤더 데이터 업데이트
                await this.updateHeaderPrices();
                
                // 모든 모듈 새로고침
                const refreshPromises = Object.values(this.modules).map(module => {
                    if (module && typeof module.refresh === 'function') {
                        return module.refresh();
                    }
                    return Promise.resolve();
                });
                
                await Promise.all(refreshPromises);
                
                this.showToast('모든 데이터가 업데이트되었습니다', 'success');
            } catch (error) {
                console.error('Error refreshing data:', error);
                this.showToast('데이터 새로고침 실패', 'error');
            }
        }

        showSettingsModal() {
            const modal = document.getElementById('settings-modal');
            if (modal) {
                // 현재 설정 값 로드
                document.getElementById('whale-btc-threshold').value = this.settings.whaleBtcThreshold;
                document.getElementById('whale-eth-threshold').value = this.settings.whaleEthThreshold;
                document.getElementById('enable-notifications').checked = this.settings.enableNotifications;
                document.getElementById('enable-sound').checked = this.settings.enableSound;
                
                modal.style.display = 'block';
            }
        }

        hideSettingsModal() {
            const modal = document.getElementById('settings-modal');
            if (modal) {
                modal.style.display = 'none';
            }
        }

        saveSettings() {
            // 설정 값 읽기
            this.settings.whaleBtcThreshold = parseFloat(document.getElementById('whale-btc-threshold').value);
            this.settings.whaleEthThreshold = parseFloat(document.getElementById('whale-eth-threshold').value);
            this.settings.enableNotifications = document.getElementById('enable-notifications').checked;
            this.settings.enableSound = document.getElementById('enable-sound').checked;
            
            // 로컬 스토리지에 저장
            localStorage.setItem('analysisSettings', JSON.stringify(this.settings));
            
            // 고래 추적 모듈 설정 업데이트
            if (this.modules.whaleTracker) {
                this.modules.whaleTracker.updateSettings(this.settings);
            }
            
            this.hideSettingsModal();
            this.showToast('설정이 저장되었습니다', 'success');
        }

        loadSettings() {
            try {
                const savedSettings = localStorage.getItem('analysisSettings');
                if (savedSettings) {
                    this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
                }
            } catch (error) {
                console.error('Error loading settings:', error);
            }
        }

        showToast(message, type = 'info') {
            const container = document.getElementById('toast-container');
            if (!container) return;

            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.innerHTML = `
                <div class="toast-content">
                    <i class="fas fa-${this.getToastIcon(type)}"></i>
                    <span>${message}</span>
                </div>
            `;

            container.appendChild(toast);

            // 애니메이션
            setTimeout(() => toast.classList.add('show'), 100);

            // 자동 제거
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => {
                    if (container.contains(toast)) {
                        container.removeChild(toast);
                    }
                }, 300);
            }, 3000);
        }

        getToastIcon(type) {
            const icons = {
                success: 'check-circle',
                error: 'exclamation-triangle',
                warning: 'exclamation-circle',
                info: 'info-circle'
            };
            return icons[type] || 'info-circle';
        }

        // 외부에서 호출할 수 있는 메서드
        getModules() {
            return this.modules;
        }

        getSettings() {
            return this.settings;
        }
    };
}

// 전역 함수들
window.formatPrice = function(price) {
    return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 8
    }).format(price);
};

window.formatNumber = function(num) {
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(2) + 'B';
    } else if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(2) + 'K';
    } else {
        return num.toFixed(2);
    }
};

window.getTimeAgo = function(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}일 전`;
    if (hours > 0) return `${hours}시간 전`;
    if (minutes > 0) return `${minutes}분 전`;
    return '방금 전';
};

// 공통 대시보드 카드 스타일 삽입 (최초 1회)
if (!document.getElementById('dashboard-card-style')) {
  const style = document.createElement('style');
  style.id = 'dashboard-card-style';
  style.textContent = `
    .dashboard-card {
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      padding: 20px;
      position: relative;
      overflow: hidden;
      transition: all 0.3s;
    }
  `;
  document.head.appendChild(style);
} 