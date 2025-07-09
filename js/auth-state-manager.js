// 🔐 UNIFIED AUTHENTICATION STATE MANAGER
// Solves dual auth listeners conflict and ensures proper storage initialization

class AuthStateManager {
    constructor() {
        this.listeners = new Set();
        this.currentUser = null;
        this.isInitialized = false;
        this.initializationPromise = null;
        
        console.log('🔐 AuthStateManager 초기화');
    }
    
    // 🎯 인증 상태 변경 리스너 등록
    onAuthStateChange(callback) {
        this.listeners.add(callback);
        
        // 이미 초기화된 경우 즉시 호출
        if (this.isInitialized) {
            try {
                callback(this.currentUser);
            } catch (error) {
                console.error('Auth state callback error:', error);
            }
        }
        
        return () => {
            this.listeners.delete(callback);
        };
    }
    
    // 🎯 중앙화된 인증 상태 업데이트
    async updateAuthState(user) {
        console.log('🔐 Auth state 업데이트:', user ? user.uid : 'logged out');
        
        this.currentUser = user;
        this.isInitialized = true;
        window.currentUser = user;
        
        // 저장 시스템 초기화
        await this.initializeStorageSystems(user);
        
        // 모든 리스너에게 알림
        this.listeners.forEach(callback => {
            try {
                callback(user);
            } catch (error) {
                console.error('Auth state callback error:', error);
            }
        });
    }
    
    // 🎯 저장 시스템 초기화 순서
    async initializeStorageSystems(user) {
        if (!user) {
            console.log('👤 사용자 로그아웃 - 저장 시스템 정리');
            if (window.settingsAdapter) window.settingsAdapter.setUserId(null);
            if (window.drawingsStorage) window.drawingsStorage.setUserId(null);
            if (window.chartStorage) window.chartStorage.setUserId(null);
            return;
        }
        
        console.log('👤 사용자 인증됨:', user.uid);
        
        // 1. 모든 저장 시스템에 사용자 ID 설정
        const storagePromises = [];
        
        if (window.settingsAdapter) {
            storagePromises.push(
                Promise.resolve(window.settingsAdapter.setUserId(user.uid))
            );
        }
        
        if (window.drawingsStorage) {
            storagePromises.push(
                Promise.resolve(window.drawingsStorage.setUserId(user.uid))
            );
        }
        
        if (window.chartStorage) {
            storagePromises.push(
                Promise.resolve(window.chartStorage.setUserId(user.uid))
            );
        }
        
        // 2. 모든 저장 시스템 초기화 대기
        await Promise.allSettled(storagePromises);
        
        // 3. Firebase 데이터 로딩 대기
        if (window.waitForStorageInitialization) {
            await window.waitForStorageInitialization();
        }
        
        console.log('✅ 모든 저장 시스템 초기화 완료');
    }
    
    // 🎯 현재 사용자 반환
    getCurrentUser() {
        return this.currentUser;
    }
    
    // 🎯 초기화 상태 확인
    isReady() {
        return this.isInitialized;
    }
    
    // 🎯 초기화 대기
    async waitForInitialization() {
        if (this.isInitialized) {
            return this.currentUser;
        }
        
        return new Promise((resolve) => {
            const unsubscribe = this.onAuthStateChange((user) => {
                unsubscribe();
                resolve(user);
            });
        });
    }
    
    // 🎯 정리 함수
    cleanup() {
        this.listeners.clear();
        this.currentUser = null;
        this.isInitialized = false;
        window.currentUser = null;
        
        console.log('🧹 AuthStateManager 정리 완료');
    }
}

// 🔐 전역 인스턴스 생성
window.authStateManager = new AuthStateManager();

// 🔐 모듈 내보내기
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthStateManager;
} 