// Firebase compat 버전 사용
// import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendEmailVerification, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
// import { getFirestore, doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// import { firebaseConfig } from './firebase-config.js';

// Firebase 초기화 함수
function initializeFirebase() {
    return new Promise((resolve, reject) => {
        const maxAttempts = 50; // 최대 5초 대기
        let attempts = 0;
        
        const checkFirebase = () => {
            attempts++;
            try {
                if (typeof firebase === 'undefined') {
                    if (attempts < maxAttempts) {
                        setTimeout(checkFirebase, 100);
                        return;
                    } else {
                        // FOUC 방지: Firebase 로딩 실패 시에도 헤더 표시
                        const mainHeader = document.getElementById('main-header');
                        const authLoading = document.getElementById('auth-loading');
                        if (mainHeader && authLoading) {
                            authLoading.style.opacity = '0';
                            setTimeout(() => {
                                authLoading.style.display = 'none';
                            }, 300);
                            mainHeader.style.opacity = '1';
                        }
                        reject(new Error('Firebase SDK 로딩 시간 초과'));
                        return;
                    }
                }

                if (!firebase.apps.length) {
                    // firebase-config.js에서 설정을 가져옴
                    const firebaseConfig = {
                        apiKey: "AIzaSyCbvgcol3P4wTUNh88-d9HPZl-2NC9WbqI",
                        authDomain: "livechattest-35101.firebaseapp.com",
                        projectId: "livechattest-35101",
                        storageBucket: "livechattest-35101.firebasestorage.app",
                        messagingSenderId: "880700591040",
                        appId: "1:880700591040:web:a93e47bf19a9713a245625",
                        measurementId: "G-ER1H2CCZW9",
                        databaseURL: "https://livechattest-35101-default-rtdb.asia-southeast1.firebasedatabase.app/"
                    };
                    firebase.initializeApp(firebaseConfig);
                }

                // Firebase 서비스 초기화
                window.auth = firebase.auth();
                window.db = firebase.firestore();
                
                // Auth 상태 변경 리스너 설정 (FOUC 방지를 위해 즉시 호출)
                window.auth.onAuthStateChanged((user) => {
                    updateAuthUI(user);
                });
                
                // 현재 사용자 상태 즉시 확인
                const currentUser = window.auth.currentUser;
                if (currentUser) {
                    updateAuthUI(currentUser);
                } else {
                    updateAuthUI(null);
                }
                
                // 테마 적용 및 헤더 버튼 이벤트 리스너 초기화
                applyTheme();
                initializeHeaderEventListeners();

                resolve(true);
            } catch (error) {
                // FOUC 방지: Firebase 초기화 실패 시에도 헤더 표시
                const mainHeader = document.getElementById('main-header');
                const authLoading = document.getElementById('auth-loading');
                if (mainHeader && authLoading) {
                    authLoading.style.opacity = '0';
                    setTimeout(() => {
                        authLoading.style.display = 'none';
                    }, 300);
                    mainHeader.style.opacity = '1';
                }
                reject(error);
            }
        };
        
        checkFirebase();
    });
}

// 전역에서 호출할 수 있는 시작 함수
async function startApp() {
    try {
        await initializeFirebase();
    } catch (error) {
        // 필요 시 재시도 로직 추가
    }
}
window.startApp = startApp;
window.updateAuthUI = updateAuthUI;

// 헤더 관련 이벤트 리스너 초기화 함수 (인증 관련만)
function initializeHeaderEventListeners() {
    document.body.addEventListener('click', handleGlobalClick);
}

// 2. 전역 상태 변수
let currentUser = null;
window.currentUser = null;

// 3. 핵심 헬퍼 함수
const getElement = (id) => document.getElementById(id);

// 모달 제어 함수 (비활성화됨)
/*
function controlModal(modalId, show) {
    const modal = getElement(modalId);
    if (modal) {
        if (show) {
            modal.classList.add('show', 'active');
            // 회원가입 모달을 열 때 Turnstile 자동 렌더링
            if (modalId === 'signup-modal') {
                // 약간의 지연 후 Turnstile 렌더링 (DOM이 완전히 준비된 후)
                setTimeout(() => {
                    if (typeof window.renderTurnstile === 'function') {
                        window.renderTurnstile();
                    } else if (window.TurnstileManager) {
                        window.TurnstileManager.render();
                    }
                }, 100);
            }
        } else {
            modal.classList.remove('show', 'active');
            // 회원가입 모달을 닫을 때 Turnstile 상태 초기화
            if (modalId === 'signup-modal') {
                // Turnstile 상태 초기화
                window.turnstileAlreadyRendered = false;
                window.turnstileRenderingInProgress = false;
            }
        }
        document.body.style.overflow = show ? 'hidden' : '';
    }
}
*/

function applyTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    
    // 모든 테마 속성 설정
    document.documentElement.classList.toggle('dark-mode', theme === 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    
    updateLogos();
    updateThemeIcon();
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    // 즉시 테마 적용
    document.documentElement.classList.toggle('dark-mode', newTheme === 'dark');
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // 로고와 아이콘 즉시 업데이트
    updateLogos();
    updateThemeIcon();
    
    // 차트 테마 업데이트 (community 페이지에서만)
    if (typeof window.updateChartTheme === 'function') {
        window.updateChartTheme();
    }
    
    // 인덱스 페이지 차트 테마 업데이트
    if (typeof window.updateIndexChartTheme === 'function') {
        window.updateIndexChartTheme();
    }
    
    // Turnstile 테마 업데이트
    if (window.TurnstileManager) {
        setTimeout(() => {
            window.TurnstileManager.reset();
        }, 150);
    }
    
    // 다른 페이지의 테마 변경 이벤트 발생
    document.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: newTheme } }));
}

function updateThemeIcon() {
    const themeButton = document.querySelector('#theme-toggle');
    if (themeButton) {
        const isDarkMode = document.documentElement.classList.contains('dark-mode');
        themeButton.innerHTML = isDarkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }
}

function updateLogos() {
    const isDarkMode = document.documentElement.classList.contains('dark-mode');
    const logoSrc = isDarkMode ? '/assets/darklogo.png' : '/assets/lightlogo.png';
    
    // 헤더 로고 업데이트 (모바일 메뉴는 텍스트 기반)
    document.querySelectorAll('.logo img').forEach(img => {
        if(img) {
            img.src = logoSrc;
            // 로드 에러 시 기본 로고로 설정
            img.onerror = function() {
                this.src = '/assets/lightlogo.png';
            };
        }
    });
}

function getCurrentTheme() {
    return localStorage.getItem('theme') || 'light';
}

// 4. UI 업데이트 함수
async function updateAuthUI(user) {
    const mobileAuthSection = document.querySelector('.mobile-auth-section');
    const userProfile = getElement('user-profile');
    const mobileUserProfile = getElement('mobile-user-profile');
    const authButtons = document.querySelector('.auth-buttons');
    const adminPageLink = getElement('admin-page-link');
    const mainHeader = getElement('main-header');
    const authLoading = getElement('auth-loading');

    if (user) {
        try {
            const userDoc = await window.db.collection("users").doc(user.uid).get();
            const _exists = typeof userDoc.exists === 'function' ? userDoc.exists() : userDoc.exists;
            currentUser = _exists 
                ? { uid: user.uid, ...userDoc.data() } 
                : { uid: user.uid, displayName: user.displayName || "사용자" };
            window.currentUser = currentUser;

            // 로그인 상태 UI 업데이트
            
            if (userProfile) {
                userProfile.style.display = 'flex';
            }
            if (mobileUserProfile) {
                mobileUserProfile.style.display = 'flex';
            }
            if (authButtons) {
                authButtons.style.display = 'none';
            }
            if (getElement('user-display-name')) {
                getElement('user-display-name').textContent = currentUser.displayName;
            }
            if (getElement('mobile-user-display-name')) {
                getElement('mobile-user-display-name').textContent = currentUser.displayName;
            }
            
            // 레벨 정보 업데이트
            updateUserLevelDisplay();
            
            // 관리자 권한 확인
            if (currentUser.isAdmin) {
                if (adminPageLink) adminPageLink.style.display = 'inline-block';
                if (getElement('mobile-admin-link')) getElement('mobile-admin-link').style.display = 'block';
            } else {
                if (adminPageLink) adminPageLink.style.display = 'none';
                if (getElement('mobile-admin-link')) getElement('mobile-admin-link').style.display = 'none';
            }
            
            // 사용자 데이터 새로고침 시작
            startUserDataRefresh();
            
            // 모바일에서 로그인 시 커뮤니티 페이지로 이동
            if (window.innerWidth <= 768 && !window.location.pathname.includes('/community/')) {
                window.location.href = '/community/';
            }
            
        } catch (error) {
            // 에러 발생 시에도 기본 사용자 정보로 설정
            currentUser = { uid: user.uid, displayName: user.displayName || "사용자" };
            window.currentUser = currentUser;
            
            if (userProfile) userProfile.style.display = 'flex';
            if (mobileUserProfile) mobileUserProfile.style.display = 'flex';
            if (authButtons) authButtons.style.display = 'none';
            if (getElement('user-display-name')) getElement('user-display-name').textContent = currentUser.displayName;
            if (getElement('mobile-user-display-name')) getElement('mobile-user-display-name').textContent = currentUser.displayName;
            
            // 모바일에서 로그인 시 커뮤니티 페이지로 이동
            if (window.innerWidth <= 768 && !window.location.pathname.includes('/community/')) {
                window.location.href = '/community/';
            }
        }
    } else {
        // 로그아웃 상태
        currentUser = null;
        window.currentUser = null;
        
        if (userProfile) {
            userProfile.style.display = 'none';
        }
        if (mobileUserProfile) {
            mobileUserProfile.style.display = 'none';
        }
        if (authButtons) {
            authButtons.style.display = 'flex';
        }
        if (adminPageLink) adminPageLink.style.display = 'none';
        if (getElement('mobile-admin-link')) getElement('mobile-admin-link').style.display = 'none';
        
        // 사용자 데이터 새로고침 중지
        stopUserDataRefresh();
    }
    
    // FOUC 해결: 인증 상태 확인 후 헤더 표시
    if (mainHeader && authLoading) {
        // 로딩 스피너 숨기기
        authLoading.style.opacity = '0';
        setTimeout(() => {
            authLoading.style.display = 'none';
        }, 300);
        
        // 헤더 표시
        mainHeader.style.opacity = '1';
    }
}

// 사용자 레벨 표시 업데이트
function updateUserLevelDisplay() { /* level system removed */ }

// 사용자 데이터 새로고침 함수
window.refreshUserData = async function() {
    if (window.auth.currentUser) {
        // 최신 사용자 데이터를 다시 가져와서 업데이트
        try {
            const userDoc = await window.db.collection("users").doc(window.auth.currentUser.uid).get();
            if ( (typeof userDoc.exists === 'function' ? userDoc.exists() : userDoc.exists) ) {
                const newUserData = userDoc.data();
                
                // 채팅에서 사용할 수 있도록 전역 변수 업데이트
                window.currentUserData = { uid: window.auth.currentUser.uid, ...newUserData };
                
                // 마이페이지에서 사용할 수 있도록 이벤트 발생
                window.dispatchEvent(new CustomEvent('userDataUpdated', { 
                    detail: { user: window.currentUserData } 
                }));
                
                // currentUser 업데이트
                currentUser = { uid: window.auth.currentUser.uid, ...newUserData };
                window.currentUser = currentUser;
            }
        } catch (error) {
        }
    }
}

// 페이지 로드 시 주기적으로 사용자 데이터 확인 (5초마다)
let userDataRefreshInterval;
function startUserDataRefresh() {
    if (userDataRefreshInterval) {
        clearInterval(userDataRefreshInterval);
    }
    
    userDataRefreshInterval = setInterval(async () => {
        if (window.auth.currentUser && currentUser) {
            try {
                const userDoc = await window.db.collection("users").doc(window.auth.currentUser.uid).get();
                if ( (typeof userDoc.exists === 'function' ? userDoc.exists() : userDoc.exists) ) {
                    const newUserData = userDoc.data();
                    
                    // 포인트가 변경되었는지 확인
                    if (newUserData.points !== currentUser.points) {
                        await window.refreshUserData();
                    }
                }
            } catch (error) {
            }
        }
    }, 3000); // 3초마다 확인
}

function stopUserDataRefresh() {
    if (userDataRefreshInterval) {
        clearInterval(userDataRefreshInterval);
        userDataRefreshInterval = null;
    }
}

// 5. 이벤트 핸들러
function handleGlobalClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    e.preventDefault();

    const actions = {
        'toggle-theme': () => {
            toggleTheme();
        },
        'logout': () => {
            // 로그아웃 후 즉시 UI 업데이트
            const userProfile = getElement('user-profile');
            const mobileUserProfile = getElement('mobile-user-profile');
            const authButtons = document.querySelector('.auth-buttons');
            
            // 즉시 UI 업데이트
            if (userProfile) userProfile.style.display = 'none';
            if (mobileUserProfile) mobileUserProfile.style.display = 'none';
            if (authButtons) authButtons.style.display = 'flex';
            
            // Firebase 로그아웃
            window.auth.signOut().catch(() => {});
        },
        'my-page': () => {
            if (window.auth.currentUser) window.location.href = target.href;
            else alert('로그인이 필요합니다.');
        },
    };

    if (actions[action]) {
        actions[action]();
    }
}

// =========================
// 전략 데이터 구조 예시 및 공유/랭킹/백테스트 함수 틀
// =========================

// 전략 데이터 구조 예시
const exampleStrategy = {
    name: 'RSI+MACD 매수전략',
    groups: [
        {
            name: 'A그룹',
            conditions: [
                { indicator: 'RSI', period: 14, operator: '<', value: 30 },
                { indicator: 'MACD', cross: 'golden' }
            ],
            logic: 'AND'
        }
    ],
    alertType: 'chat|push|marker'
};

// 전략 공유/랭킹 함수 틀
function getPopularStrategies() {
    // 서버/DB에서 인기 전략 리스트 받아오기 (샘플)
    return [];
}
function getUserStrategies(userId) {
    // 서버/DB에서 해당 유저의 전략 리스트 받아오기 (샘플)
    return [];
}
function likeStrategy(strategyId) {
    // 서버/DB에 좋아요 반영 (샘플)
}
function shareStrategy(strategy) {
    // 서버/DB에 전략 저장 (샘플)
}

// 전략 백테스트 함수 틀
function runBacktest(strategy, historicalData) {
    // 실제 전략 로직에 따라 조건 충족 시점 기록 (샘플)
    return [];
}
function showBacktestMarkers(results) {
    // 차트에 마커 표시 (샘플)
}

// =========================
// 강력한 폼 바인딩 시스템
// =========================

// 모달 기반 인증 폼 바인딩 (비활성화됨 - 페이지로 이동)

// 빈 bindAuthForms 함수 (호환성 유지)
if (!window.bindAuthForms) {
    window.bindAuthForms = function() {
    };
}

// Utility: hide any auth modals that might still be open (비활성화됨)
/*
function hideOpenAuthModals() {
    document.querySelectorAll('.auth-modal.show, .auth-modal.active').forEach(modal => {
        modal.classList.remove('show', 'active');
    });
    document.body.style.overflow = '';
}
*/

// Provide a minimal stub if level-system.js is not loaded
if (!window.levelSystem) {
  window.levelSystem = { calculateLevel: (points)=>({name:'Lv.0', color:'#22c55e'}) };
}

// =========================
// 강력한 Turnstile 렌더링 시스템
// =========================

// 강력한 Turnstile 렌더링 시스템
function renderTurnstile() {
    // 중복 렌더링 방지
    if (window.turnstileRenderingInProgress) {
        return;
    }
    
    if (window.turnstileAlreadyRendered) {
        return;
    }
    
    window.turnstileRenderingInProgress = true;
    
    // Turnstile 스크립트 로드 확인 및 렌더링
    ensureTurnstileScript().then(() => {
        const turnstileElement = findOrCreateTurnstileElement();
        if (turnstileElement) {
            performTurnstileRender(turnstileElement);
        } else {
            window.turnstileRenderingInProgress = false;
        }
    }).catch((error) => {
        window.turnstileRenderingInProgress = false;
    });
}

// Turnstile 스크립트 확실히 로드
function ensureTurnstileScript() {
    return new Promise((resolve) => {
        if (window.turnstile) {
            resolve();
            return;
        }
        
        // 기존 스크립트 확인
        const existingScript = document.querySelector('script[src*="turnstile"]');
        if (existingScript) {
            const checkLoaded = () => {
                if (window.turnstile) {
                    resolve();
                } else {
                    setTimeout(checkLoaded, 100);
                }
            };
            checkLoaded();
            return;
        }
        
        // 새 스크립트 추가
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            resolve();
        };
        script.onerror = () => {
            resolve(); // 계속 진행
        };
        document.head.appendChild(script);
    });
}

// Turnstile 요소 찾기 또는 생성
function findOrCreateTurnstileElement() {
    let turnstileElement = document.getElementById('cf-turnstile');
    
    if (!turnstileElement) {
        const signupForm = document.getElementById('signup-form');
        if (!signupForm) {
            return null;
        }
        
        const turnstileDiv = document.createElement('div');
        turnstileDiv.className = 'input-group';
        turnstileDiv.innerHTML = `<div id="cf-turnstile" class="cf-turnstile" data-sitekey="0x4AAAAAABhG8vjyB5nsUxll" data-theme="${document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light'}"></div>`;
        
        const submitButton = signupForm.querySelector('button[type="submit"]');
        if (submitButton) {
            signupForm.insertBefore(turnstileDiv, submitButton);
            turnstileElement = document.getElementById('cf-turnstile');
        }
    }
    
    return turnstileElement;
}

// 실제 Turnstile 렌더링 수행 (중복 방지)
function performTurnstileRender(turnstileElement) {
    if (!window.turnstile) {
        window.turnstileRenderingInProgress = false;
        return;
    }
    
    // 이미 렌더링되어 있는지 최종 확인
    if (turnstileElement.querySelector('iframe')) {
        window.turnstileAlreadyRendered = true;
        window.turnstileRenderingInProgress = false;
        return;
    }
    
    // 모든 Turnstile 요소들 정리 (중복 방지)
    document.querySelectorAll('.cf-turnstile').forEach((element, index) => {
        if (element !== turnstileElement && element.querySelector('iframe')) {
            try {
                window.turnstile.reset(element);
            } catch (e) {
                element.innerHTML = '';
            }
        }
    });
    
    // 새로 렌더링
    try {
        window.turnstile.render(turnstileElement, {
            sitekey: '0x4AAAAAABhG8vjyB5nsUxll',
            theme: document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light',
            callback: function(token) {
                window.turnstileAlreadyRendered = true;
                window.turnstileRenderingInProgress = false;
            },
            'error-callback': function() {
                window.turnstileAlreadyRendered = false;
                window.turnstileRenderingInProgress = false;
                setTimeout(() => {
                    renderTurnstile();
                }, 2000);
            }
        });
        window.turnstileAlreadyRendered = true;
        window.turnstileRenderingInProgress = false;
    } catch (error) {
        window.turnstileAlreadyRendered = false;
        window.turnstileRenderingInProgress = false;
        setTimeout(() => {
            renderTurnstile();
        }, 2000);
    }
}

// 전역에서 접근 가능하도록
window.renderTurnstile = renderTurnstile; 