/**
 * 🔐 ADMIN AUTHENTICATION & SECURITY MANAGER
 * 재사용 가능한 어드민 인증 및 보안 관리 모듈
 * 
 * 기능:
 * - 다층 어드민 인증 검증
 * - 우회 시도 실시간 탐지
 * - 보안 이벤트 로깅
 * - 세션 무결성 검사
 * - 자동 보안 조치
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, limit, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from '../firebase-config.js';

// 🔥 SECURITY CONFIGURATION
const SECURITY_CONFIG = {
    // 허용된 어드민 이메일 목록
    ADMIN_EMAILS: [
        'admin@site.com',
        'admin@felicity.com',
        'manager@felicity.com',
        'hankim@felicity.com'
    ],
    
    // 보안 설정
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000, // 15분
    SESSION_TIMEOUT: 30 * 60 * 1000,  // 30분
    
    // 개발 환경 설정
    DEV_MODE: ['localhost', '127.0.0.1'].includes(window.location.hostname),
    
    // 보안 이벤트 타입
    SECURITY_EVENTS: {
        LOGIN_SUCCESS: 'LOGIN_SUCCESS',
        LOGIN_FAILED: 'LOGIN_FAILED',
        BYPASS_ATTEMPT: 'BYPASS_ATTEMPT',
        CONSOLE_MANIPULATION: 'CONSOLE_MANIPULATION',
        DOM_MANIPULATION: 'DOM_MANIPULATION',
        UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
        SESSION_EXPIRED: 'SESSION_EXPIRED',
        PRIVILEGE_ESCALATION: 'PRIVILEGE_ESCALATION'
    }
};

class AdminAuthManager {
    constructor() {
        this.app = initializeApp(firebaseConfig);
        this.auth = getAuth(this.app);
        this.db = getFirestore(this.app);
        
        this.currentUser = null;
        this.isAdmin = false;
        this.sessionStartTime = null;
        this.lastActivityTime = null;
        this.securityMonitor = null;
        this.callbacks = {
            onAuthChange: [],
            onSecurityEvent: [],
            onAccessDenied: []
        };
        
        this.initializeSecurityMonitoring();
        this.setupAuthStateListener();
    }

    /**
     * 🛡️ 다층 어드민 인증 검증
     */
    async validateAdminAccess(user = null) {
        const targetUser = user || this.currentUser;
        
        if (!targetUser) {
            await this.logSecurityEvent(SECURITY_CONFIG.SECURITY_EVENTS.UNAUTHORIZED_ACCESS, {
                reason: 'No authenticated user',
                timestamp: new Date().toISOString()
            });
            return false;
        }

        try {
            // 1차: Firestore 역할 검증
            const userDoc = await getDoc(doc(this.db, 'users', targetUser.uid));
            let isFirestoreAdmin = false;
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                isFirestoreAdmin = userData.role === 'admin' || userData.isAdmin === true;
                
                // 계정 상태 확인
                if (userData.isBlocked || userData.isDeactivated) {
                    await this.logSecurityEvent(SECURITY_CONFIG.SECURITY_EVENTS.UNAUTHORIZED_ACCESS, {
                        reason: 'Blocked or deactivated account',
                        userId: targetUser.uid,
                        email: targetUser.email
                    });
                    return false;
                }
            }

            // 2차: 이메일 기반 검증 (백업)
            const isEmailAdmin = SECURITY_CONFIG.ADMIN_EMAILS.includes(targetUser.email);

            // 3차: 개발 환경 로컬 스토리지 검증 (개발용)
            let isLocalAdmin = false;
            if (SECURITY_CONFIG.DEV_MODE) {
                isLocalAdmin = localStorage.getItem('isAdmin') === 'true';
            }

            // 4차: 세션 무결성 검사
            const isSessionValid = this.validateSession();

            const finalResult = (isFirestoreAdmin || isEmailAdmin || isLocalAdmin) && isSessionValid;

            // 보안 이벤트 로깅
            await this.logSecurityEvent(
                finalResult ? SECURITY_CONFIG.SECURITY_EVENTS.LOGIN_SUCCESS : SECURITY_CONFIG.SECURITY_EVENTS.LOGIN_FAILED,
                {
                    userId: targetUser.uid,
                    email: targetUser.email,
                    firestoreAdmin: isFirestoreAdmin,
                    emailAdmin: isEmailAdmin,
                    localAdmin: isLocalAdmin,
                    sessionValid: isSessionValid,
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString()
                }
            );

            return finalResult;

        } catch (error) {
            console.error('🚨 Admin validation error:', error);
            await this.logSecurityEvent(SECURITY_CONFIG.SECURITY_EVENTS.UNAUTHORIZED_ACCESS, {
                reason: 'Validation error',
                error: error.message,
                userId: targetUser.uid
            });
            return false;
        }
    }

    /**
     * 🔒 세션 무결성 검사
     */
    validateSession() {
        const now = Date.now();
        
        // 세션 시작 시간 확인
        if (!this.sessionStartTime) {
            this.sessionStartTime = now;
            this.lastActivityTime = now;
            return true;
        }

        // 세션 타임아웃 검사
        if (now - this.lastActivityTime > SECURITY_CONFIG.SESSION_TIMEOUT) {
            this.logSecurityEvent(SECURITY_CONFIG.SECURITY_EVENTS.SESSION_EXPIRED, {
                sessionDuration: now - this.sessionStartTime,
                inactivityDuration: now - this.lastActivityTime
            });
            return false;
        }

        // 활동 시간 업데이트
        this.lastActivityTime = now;
        return true;
    }

    /**
     * 🚨 실시간 보안 모니터링 초기화
     */
    initializeSecurityMonitoring() {
        // 콘솔 조작 탐지
        this.monitorConsoleManipulation();
        
        // DOM 조작 탐지
        this.monitorDOMManipulation();
        
        // 개발자 도구 탐지
        this.monitorDevTools();
        
        // 키보드 단축키 탐지
        this.monitorKeyboardShortcuts();
    }

    /**
     * 🔍 콘솔 조작 탐지
     */
    monitorConsoleManipulation() {
        const originalConsole = { ...console };
        
        ['log', 'warn', 'error', 'info'].forEach(method => {
            console[method] = (...args) => {
                const message = args.join(' ');
                
                // 의심스러운 콘솔 명령어 탐지
                const suspiciousPatterns = [
                    /isAdmin\s*=\s*true/i,
                    /role\s*=\s*['"']admin['"']/i,
                    /localStorage\.setItem.*admin/i,
                    /firebase\.auth\(\)\.currentUser/i,
                    /document\.getElementById.*admin/i
                ];

                if (suspiciousPatterns.some(pattern => pattern.test(message))) {
                    this.logSecurityEvent(SECURITY_CONFIG.SECURITY_EVENTS.CONSOLE_MANIPULATION, {
                        command: message,
                        stack: new Error().stack,
                        timestamp: new Date().toISOString()
                    });
                }
                
                return originalConsole[method].apply(console, args);
            };
        });
    }

    /**
     * 🔍 DOM 조작 탐지
     */
    monitorDOMManipulation() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes') {
                    const element = mutation.target;
                    
                    // 어드민 관련 요소의 스타일 변경 탐지
                    if (element.id && element.id.includes('admin') && 
                        mutation.attributeName === 'style') {
                        
                        const oldValue = mutation.oldValue;
                        const newValue = element.getAttribute('style');
                        
                        if (oldValue && oldValue.includes('display: none') && 
                            newValue && !newValue.includes('display: none')) {
                            
                            this.logSecurityEvent(SECURITY_CONFIG.SECURITY_EVENTS.DOM_MANIPULATION, {
                                elementId: element.id,
                                oldStyle: oldValue,
                                newStyle: newValue,
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                }
            });
        });

        observer.observe(document.body, {
            attributes: true,
            attributeOldValue: true,
            subtree: true,
            attributeFilter: ['style', 'class']
        });
    }

    /**
     * 🔍 개발자 도구 탐지
     */
    monitorDevTools() {
        let devtools = { open: false };
        
        setInterval(() => {
            if (window.outerHeight - window.innerHeight > 200 || 
                window.outerWidth - window.innerWidth > 200) {
                if (!devtools.open) {
                    devtools.open = true;
                    this.logSecurityEvent(SECURITY_CONFIG.SECURITY_EVENTS.BYPASS_ATTEMPT, {
                        type: 'Developer tools opened',
                        timestamp: new Date().toISOString()
                    });
                }
            } else {
                devtools.open = false;
            }
        }, 1000);
    }

    /**
     * 🔍 키보드 단축키 탐지
     */
    monitorKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U 등
            const suspiciousKeys = [
                { key: 'F12' },
                { key: 'I', ctrlKey: true, shiftKey: true },
                { key: 'J', ctrlKey: true, shiftKey: true },
                { key: 'U', ctrlKey: true },
                { key: 'C', ctrlKey: true, shiftKey: true }
            ];

            const isSuspicious = suspiciousKeys.some(combo => {
                return e.key === combo.key && 
                       (!combo.ctrlKey || e.ctrlKey) && 
                       (!combo.shiftKey || e.shiftKey);
            });

            if (isSuspicious) {
                this.logSecurityEvent(SECURITY_CONFIG.SECURITY_EVENTS.BYPASS_ATTEMPT, {
                    type: 'Suspicious keyboard shortcut',
                    key: e.key,
                    ctrlKey: e.ctrlKey,
                    shiftKey: e.shiftKey,
                    timestamp: new Date().toISOString()
                });
            }
        });
    }

    /**
     * 📝 보안 이벤트 로깅
     */
    async logSecurityEvent(eventType, details) {
        try {
            const securityLog = {
                eventType,
                details,
                userId: this.currentUser?.uid || 'anonymous',
                userEmail: this.currentUser?.email || 'anonymous',
                userAgent: navigator.userAgent,
                url: window.location.href,
                timestamp: serverTimestamp(),
                ipAddress: await this.getClientIP()
            };

            await addDoc(collection(this.db, 'security_logs'), securityLog);
            
            // 콜백 실행
            this.callbacks.onSecurityEvent.forEach(callback => {
                try {
                    callback(eventType, details);
                } catch (error) {
                    console.error('Security event callback error:', error);
                }
            });

        } catch (error) {
            console.error('🚨 Failed to log security event:', error);
        }
    }

    /**
     * 🌐 클라이언트 IP 주소 획득
     */
    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * 👤 인증 상태 리스너 설정
     */
    setupAuthStateListener() {
        onAuthStateChanged(this.auth, async (user) => {
            this.currentUser = user;
            
            if (user) {
                this.isAdmin = await this.validateAdminAccess(user);
                this.sessionStartTime = Date.now();
                this.lastActivityTime = Date.now();
            } else {
                this.isAdmin = false;
                this.sessionStartTime = null;
                this.lastActivityTime = null;
            }

            // 콜백 실행
            this.callbacks.onAuthChange.forEach(callback => {
                try {
                    callback(user, this.isAdmin);
                } catch (error) {
                    console.error('Auth change callback error:', error);
                }
            });
        });
    }

    /**
     * 📞 이벤트 콜백 등록
     */
    onAuthStateChange(callback) {
        this.callbacks.onAuthChange.push(callback);
    }

    onSecurityEvent(callback) {
        this.callbacks.onSecurityEvent.push(callback);
    }

    onAccessDenied(callback) {
        this.callbacks.onAccessDenied.push(callback);
    }

    /**
     * 🔐 어드민 권한 확인 (공개 메서드)
     */
    async isAdminUser() {
        if (!this.currentUser) return false;
        return await this.validateAdminAccess();
    }

    /**
     * 👤 현재 사용자 정보 반환
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * 🔓 로그아웃
     */
    async logout() {
        try {
            await this.auth.signOut();
            this.currentUser = null;
            this.isAdmin = false;
            this.sessionStartTime = null;
            this.lastActivityTime = null;
            
            // 로컬 스토리지 정리
            localStorage.removeItem('isAdmin');
            
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    /**
     * 🔧 개발 환경 디버깅 도구
     */
    enableDebugMode() {
        console.log('🔧 AdminAuthManager Debug Mode Enabled');
        console.log('Current User:', this.currentUser);
        console.log('Is Admin:', this.isAdmin);
        console.log('Session Start:', this.sessionStartTime);
        console.log('Last Activity:', this.lastActivityTime);
    }
}

// 🌟 전역 인스턴스 생성
const adminAuthManager = new AdminAuthManager();

// 개발 환경에서 디버그 모드 활성화
if (SECURITY_CONFIG.DEV_MODE) {
    adminAuthManager.enableDebugMode();
}

// Default export for ES6 modules (전역 인스턴스)
export default adminAuthManager;
export { AdminAuthManager, SECURITY_CONFIG }; 