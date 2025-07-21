// 비트코인 가격 알람 시스템
class BitcoinPriceAlert {
    constructor() {
        this.currentPrice = 0;
        this.lastAlertPrice = 0;
        this.alertThreshold = 1000; // 1000달러 단위
        this.isInitialized = false;
        this.priceCheckInterval = null;
        this.websocket = null;
        this.alertCooldown = 30000; // 30초 쿨다운
        this.lastAlertTime = 0;
        
        this.init();
    }

    async init() {
        console.log('BitcoinPriceAlert 초기화 시작');
        
        if (!window.db) {
            console.warn('Firestore 서비스 대기 중...');
            setTimeout(() => this.init(), 1000);
            return;
        }

        this.isInitialized = true;
        window.BitcoinPriceAlertState.isActive = true;
        this.startPriceMonitoring();
        console.log('✅ BitcoinPriceAlert 초기화 완료');
    }

    // 가격 모니터링 시작
    startPriceMonitoring() {
        // Binance WebSocket 연결
        this.connectWebSocket();
        
        // 백업용 HTTP 폴링 (WebSocket 실패 시)
        this.startHttpPolling();
    }

    // WebSocket 연결
    connectWebSocket() {
        try {
            this.websocket = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker');
            
            this.websocket.onopen = () => {
                console.log('✅ Binance WebSocket 연결 성공');
            };
            
            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    const price = parseFloat(data.c); // 현재 가격
                    this.handlePriceUpdate(price);
                } catch (error) {
                    console.error('WebSocket 데이터 파싱 오류:', error);
                }
            };
            
            this.websocket.onerror = (error) => {
                console.error('WebSocket 오류:', error);
                this.websocket = null;
            };
            
            this.websocket.onclose = () => {
                console.log('WebSocket 연결 종료, 재연결 시도...');
                this.websocket = null;
                setTimeout(() => this.connectWebSocket(), 5000);
            };
            
        } catch (error) {
            console.error('WebSocket 연결 실패:', error);
        }
    }

    // HTTP 폴링 (백업)
    startHttpPolling() {
        if (this.priceCheckInterval) {
            clearInterval(this.priceCheckInterval);
        }
        
        this.priceCheckInterval = setInterval(async () => {
            if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                return; // WebSocket이 정상이면 HTTP 폴링 건너뛰기
            }
            
            try {
                const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
                const data = await response.json();
                const price = parseFloat(data.price);
                this.handlePriceUpdate(price);
            } catch (error) {
                console.error('HTTP 폴링 오류:', error);
            }
        }, 10000); // 10초마다
    }

    // 가격 업데이트 처리
    handlePriceUpdate(price) {
        if (!price || price <= 0) return;
        
        this.currentPrice = price;
        this.checkPriceAlert();
    }

    // 가격 알람 체크
    checkPriceAlert() {
        if (!this.isInitialized || !window.db) return;
        
        const now = Date.now();
        
        // 전역 쿨다운 체크 (모든 인스턴스에서 공유)
        if (now - window.BitcoinPriceAlertState.lastAlertTime < this.alertCooldown) {
            return; // 전역 쿨다운 중
        }

        const currentThreshold = Math.floor(this.currentPrice / this.alertThreshold) * this.alertThreshold;
        const lastThreshold = Math.floor(this.lastAlertPrice / this.alertThreshold) * this.alertThreshold;
        
        // 1000단위 돌파 체크
        if (currentThreshold !== lastThreshold && this.lastAlertPrice > 0) {
            // 전역 상태에서 이미 같은 임계값에 대한 알람이 있었는지 확인
            if (window.BitcoinPriceAlertState.lastAlertThreshold === currentThreshold) {
                console.log(`이미 ${currentThreshold}달러 임계값에 대한 알람이 전송되었습니다.`);
                return;
            }
            
            const direction = currentThreshold > lastThreshold ? '상승' : '하락';
            const alertMessage = this.createAlertMessage(currentThreshold, direction);
            
            this.sendAlertToChat(alertMessage);
            
            // 전역 상태 업데이트
            window.BitcoinPriceAlertState.lastAlertTime = now;
            window.BitcoinPriceAlertState.lastAlertThreshold = currentThreshold;
            this.lastAlertTime = now;
        }
        
        this.lastAlertPrice = this.currentPrice;
    }

    // 알람 메시지 생성
    createAlertMessage(threshold, direction) {
        const formattedPrice = this.formatPrice(this.currentPrice);
        const formattedThreshold = this.formatPrice(threshold);
        
        return `비트코인 ${direction} 알람\n` +
               `현재가: $${formattedPrice}\n` +
               `${threshold.toLocaleString()} 달러 ${direction} 돌파`;
    }

    // 가격 포맷팅
    formatPrice(price) {
        return price.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    }

    // 채팅에 알람 전송
    async sendAlertToChat(message) {
        try {
            const alertData = {
                text: message,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                uid: 'system-alert',
                displayName: '💰 가격 알람',
                photoURL: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNmZmQ3MDAiLz4KPHBhdGggZD0iTTIwIDEwQzIyLjIwOTEgMTAgMjQgMTEuNzkwOSAyNCAxNEMyNCAxNi4yMDkxIDIyLjIwOTEgMTggMjAgMThDMTcuNzkwOSAxOCAxNiAxNi4yMDkxIDE2IDE0QzE2IDExLjc5MDkgMTcuNzkwOSAxMCAyMCAxMFoiIGZpbGw9IiNmZmZmZmYiLz4KPHBhdGggZD0iTTI4IDI4QzI4IDI0LjY4NjMgMjQuNDE4MyAyMiAyMCAyMkMxNS41ODE3IDIyIDEyIDI0LjY4NjMgMTIgMjhIMjhaIiBmaWxsPSIjZmZmZmZmIi8+Cjwvc3ZnPgo=',
                isSystemAlert: true
            };

            await window.db.collection('community-chat').add(alertData);
            console.log('✅ 가격 알람 전송 완료:', message);
            
            // 브라우저 알림도 표시
            this.showBrowserNotification(message);
            
        } catch (error) {
            console.error('가격 알람 전송 실패:', error);
        }
    }

    // 브라우저 알림 표시
    showBrowserNotification(message) {
        if (!('Notification' in window)) return;
        
        if (Notification.permission === 'granted') {
            new Notification('비트코인 가격 알람', {
                body: message,
                icon: '/assets/logoicon/bitcoin.png',
                badge: '/assets/logoicon/bitcoin.png',
                tag: 'bitcoin-price-alert' // 중복 알림 방지
            });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification('비트코인 가격 알람', {
                        body: message,
                        icon: '/assets/logoicon/bitcoin.png',
                        badge: '/assets/logoicon/bitcoin.png',
                        tag: 'bitcoin-price-alert' // 중복 알림 방지
                    });
                }
            });
        }
    }

    // 현재 가격 가져오기 (수동)
    async getCurrentPrice() {
        try {
            const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
            const data = await response.json();
            return parseFloat(data.price);
        } catch (error) {
            console.error('현재 가격 조회 실패:', error);
            return null;
        }
    }

    // 알람 설정 변경
    updateAlertSettings(threshold = 1000, cooldown = 30000) {
        this.alertThreshold = threshold;
        this.alertCooldown = cooldown;
        console.log(`알람 설정 업데이트: ${threshold}달러 단위, ${cooldown/1000}초 쿨다운`);
    }

    // 정리 함수
    cleanup() {
        console.log('BitcoinPriceAlert 정리 시작');
        
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        
        if (this.priceCheckInterval) {
            clearInterval(this.priceCheckInterval);
            this.priceCheckInterval = null;
        }
        
        this.isInitialized = false;
        
        // 전역 상태 초기화 (페이지 이동 시에만)
        if (window.location.pathname !== window.location.pathname) {
            window.BitcoinPriceAlertState.lastAlertThreshold = 0;
            window.BitcoinPriceAlertState.lastAlertTime = 0;
            window.BitcoinPriceAlertState.isActive = false;
        }
        
        console.log('BitcoinPriceAlert 정리 완료');
    }
}

// 전역 인스턴스 관리 (싱글톤 패턴)
let bitcoinPriceAlert = null;
let isInitializing = false;

// 전역 알람 상태 관리 (중복 방지)
window.BitcoinPriceAlertState = {
    lastAlertThreshold: 0,
    lastAlertTime: 0,
    isActive: false
};

// 싱글톤 인스턴스 생성 함수
function createBitcoinPriceAlert() {
    if (bitcoinPriceAlert) {
        console.log('BitcoinPriceAlert 인스턴스가 이미 존재합니다.');
        return bitcoinPriceAlert;
    }
    
    if (isInitializing) {
        console.log('BitcoinPriceAlert 초기화 중입니다.');
        return null;
    }
    
    isInitializing = true;
    bitcoinPriceAlert = new BitcoinPriceAlert();
    isInitializing = false;
    
    return bitcoinPriceAlert;
}

// 페이지 로드 시 초기화 (한 번만)
document.addEventListener('DOMContentLoaded', () => {
    // 이미 인스턴스가 있으면 재사용
    if (bitcoinPriceAlert && bitcoinPriceAlert.isInitialized) {
        console.log('기존 BitcoinPriceAlert 인스턴스를 재사용합니다.');
        return;
    }
    
    // 이미 전역 상태가 활성화되어 있으면 초기화하지 않음
    if (window.BitcoinPriceAlertState.isActive) {
        console.log('BitcoinPriceAlert가 이미 활성화되어 있습니다.');
        return;
    }
    
    createBitcoinPriceAlert();
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
    if (bitcoinPriceAlert) {
        bitcoinPriceAlert.cleanup();
        window.BitcoinPriceAlertState.isActive = false;
    }
});

// 전역 함수로 노출 (다른 스크립트에서 사용 가능)
window.BitcoinPriceAlert = {
    getInstance: () => bitcoinPriceAlert,
    getCurrentPrice: () => bitcoinPriceAlert ? bitcoinPriceAlert.getCurrentPrice() : null,
    updateSettings: (threshold, cooldown) => bitcoinPriceAlert ? bitcoinPriceAlert.updateAlertSettings(threshold, cooldown) : null,
    // 전역 상태 확인
    isActive: () => window.BitcoinPriceAlertState.isActive,
    // 강제 초기화 (필요시)
    forceInit: () => {
        if (!bitcoinPriceAlert && !isInitializing) {
            return createBitcoinPriceAlert();
        }
        return bitcoinPriceAlert;
    }
}; 