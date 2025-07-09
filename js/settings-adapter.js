// 🔥 Settings Adapter - TradingView 공식 사용자 설정 저장/로드 시스템
// Firebase 기반 사용자 설정 관리 (localStorage 대신 서버 저장소 사용)

class SettingsAdapter {
    constructor() {
        this.userId = null;
        this.settings = {};
        this.initialized = false;
        this.saveTimeout = null;
        this.SAVE_DELAY = 1000; // 1초 디바운스
        
        console.log('🔥 Settings Adapter 초기화');
    }

    // 🔥 사용자 ID 설정
    setUserId(userId) {
        this.userId = userId;
        console.log('👤 Settings Adapter 사용자 ID 설정:', userId);
        
        if (userId) {
            // 비동기 초기화 - 블로킹하지 않음
            this.loadUserSettings().catch(error => {
                console.error('Settings 로딩 실패:', error);
                // 기본 설정으로 폴백
                this.settings = this.getDefaultSettings();
                this.initialized = true;
            });
        } else {
            // 사용자 데이터 정리
            this.settings = this.getDefaultSettings();
            this.initialized = true;
        }
    }

    // 🔥 Firebase에서 사용자 설정 로드
    async loadUserSettings() {
        if (!this.userId) {
            console.warn('⚠️ 사용자 ID가 없습니다');
            this.settings = this.getDefaultSettings();
            this.initialized = true;
            return;
        }
        
        if (!window.db) {
            console.warn('⚠️ Firebase DB가 없습니다 - 기본 설정 사용');
            this.settings = this.getDefaultSettings();
            this.initialized = true;
            return;
        }

        try {
            const docRef = window.db.collection('userSettings').doc(this.userId);
            const doc = await docRef.get();
            
            if (doc.exists) {
                this.settings = doc.data().settings || {};
                console.log('✅ 사용자 설정 로드 완료:', Object.keys(this.settings).length, '개 설정');
            } else {
                console.log('📝 새 사용자 - 기본 설정 적용');
                this.settings = this.getDefaultSettings();
                await this.saveUserSettings();
            }
            
            this.initialized = true;
        } catch (error) {
            console.error('❌ 사용자 설정 로드 실패:', error);
            this.settings = this.getDefaultSettings();
            this.initialized = true;
        }
    }

    // 🔥 Firebase에 사용자 설정 저장
    async saveUserSettings() {
        if (!this.userId || !window.db) {
            console.warn('⚠️ 사용자 ID 또는 Firebase DB가 없습니다');
            return;
        }

        try {
            const docRef = window.db.collection('userSettings').doc(this.userId);
            await docRef.set({
                settings: this.settings,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            console.log('💾 사용자 설정 저장 완료');
        } catch (error) {
            console.error('❌ 사용자 설정 저장 실패:', error);
        }
    }

    // 🔥 기본 설정 반환
    getDefaultSettings() {
        return {
            // 차트 기본 설정
            'chart.resolution': '15',
            'chart.style': 'candle',
            'chart.theme': 'Light',
            'chart.timezone': 'Asia/Seoul',
            'chart.locale': 'ko',
            
            // 거래 설정
            'trading.orderType': 'market',
            'trading.quantity': '100',
            'trading.instantOrders': 'false',
            'trading.soundEnabled': 'true',
            'trading.notifications': 'true',
            
            // UI 설정
            'ui.rightToolbar': 'true',
            'ui.bottomToolbar': 'true',
            'ui.watchlist': '[]',
            'ui.symbolWatermark': JSON.stringify({
                visibility: false,
                color: 'rgba(244, 67, 54, 0.25)'
            }),
            
            // 성능 설정
            'performance.autoSave': 'true',
            'performance.saveInterval': '5000',
            'performance.maxHistoryItems': '1000'
        };
    }

    // 🔥 TradingView Settings Adapter 인터페이스 구현
    createTradingViewAdapter() {
        return {
            // 초기 설정 제공
            initialSettings: this.getInitialSettings(),
            
            // 설정 값 저장
            setValue: (key, value) => {
                console.log(`🔧 설정 저장: ${key} = ${value}`);
                this.setValue(key, value);
            },
            
            // 설정 값 삭제
            removeValue: (key) => {
                console.log(`🗑️ 설정 삭제: ${key}`);
                this.removeValue(key);
            }
        };
    }

    // 🔥 초기 설정 반환 (TradingView 형식)
    getInitialSettings() {
        if (!this.initialized) {
            return this.getDefaultSettings();
        }
        
        return {
            ...this.settings,
            // 특별한 형식이 필요한 설정들
            'symbolWatermark': this.settings['ui.symbolWatermark'] || JSON.stringify({
                visibility: false,
                color: 'rgba(244, 67, 54, 0.25)'
            }),
            'trading.Broker': this.getTradingBrokerSettings()
        };
    }

    // 🔥 거래 브로커 설정 반환
    getTradingBrokerSettings() {
        const orderType = this.settings['trading.orderType'] || 'market';
        const quantity = parseInt(this.settings['trading.quantity'] || '100');
        
        return JSON.stringify({
            qty: {
                'BTCUSDT': quantity,
                'ETHUSDT': quantity,
                'BINANCE:BTCUSDT': quantity,
                'BINANCE:ETHUSDT': quantity
            },
            orderType: {
                'BTCUSDT': orderType === 'market' ? 1 : 3,
                'ETHUSDT': orderType === 'market' ? 1 : 3,
                'BINANCE:BTCUSDT': orderType === 'market' ? 1 : 3,
                'BINANCE:ETHUSDT': orderType === 'market' ? 1 : 3
            }
        });
    }

    // 🔥 설정 값 저장
    setValue(key, value) {
        if (!this.initialized) {
            console.warn('⚠️ Settings Adapter가 초기화되지 않았습니다. 사용자 ID:', this.userId);
            // 초기화되지 않았어도 메모리에는 저장
            this.settings[key] = value;
            return;
        }

        this.settings[key] = value;
        this.scheduleSave();
    }

    // 🔥 설정 값 삭제
    removeValue(key) {
        if (!this.initialized) {
            console.warn('⚠️ Settings Adapter가 초기화되지 않았습니다');
            return;
        }

        delete this.settings[key];
        this.scheduleSave();
    }

    // 🔥 설정 값 조회
    getValue(key, defaultValue = null) {
        return this.settings[key] || defaultValue;
    }

    // 🔥 저장 스케줄링 (디바운스)
    scheduleSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = setTimeout(() => {
            this.saveUserSettings();
        }, this.SAVE_DELAY);
    }

    // 🔥 모든 설정 반환
    getAllSettings() {
        return { ...this.settings };
    }

    // 🔥 설정 초기화
    resetSettings() {
        this.settings = this.getDefaultSettings();
        this.saveUserSettings();
        console.log('🔄 설정이 초기화되었습니다');
    }

    // 🔥 설정 내보내기
    exportSettings() {
        return {
            version: '1.0',
            timestamp: new Date().toISOString(),
            settings: this.getAllSettings()
        };
    }

    // 🔥 설정 가져오기
    async importSettings(settingsData) {
        if (!settingsData || !settingsData.settings) {
            throw new Error('잘못된 설정 데이터입니다');
        }

        this.settings = {
            ...this.getDefaultSettings(),
            ...settingsData.settings
        };

        await this.saveUserSettings();
        console.log('✅ 설정을 가져왔습니다');
    }

    // 🔥 설정 동기화 상태 확인
    isSynchronized() {
        return this.initialized && this.userId && window.db;
    }

    // 🔥 정리 함수
    cleanup() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        
        // 마지막 저장 시도
        if (this.initialized && this.userId) {
            this.saveUserSettings();
        }
        
        console.log('🧹 Settings Adapter 정리 완료');
    }
}

// 🔥 전역 인스턴스 생성
window.settingsAdapter = new SettingsAdapter();

// 🔥 모듈 내보내기
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsAdapter;
} 