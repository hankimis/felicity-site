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
                        console.log(`Firebase SDK 로딩 대기 중... (${attempts}/${maxAttempts})`);
                        setTimeout(checkFirebase, 100);
                        return;
                    } else {
                        console.error('Firebase SDK 로딩 시간 초과');
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
                
                // 테마 적용 및 헤더 버튼 이벤트 리스너 초기화
                applyTheme();
                initializeHeaderEventListeners();

                console.log('Firebase 초기화 완료');
                resolve(true);
            } catch (error) {
                console.error('Firebase 초기화 중 오류 발생:', error);
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
        console.log('Firebase 초기화 성공. 앱 시작.');
    } catch (error) {
        console.error('Firebase 초기화 실패:', error);
        // 필요 시 재시도 로직 추가
    }
}
window.startApp = startApp;

// 헤더 관련 이벤트 리스너 초기화 함수 (인증 관련만)
function initializeHeaderEventListeners() {
    console.log("Initializing header event listeners...");
    document.body.addEventListener('click', handleGlobalClick);
}

// 2. 전역 상태 변수
let currentUser = null;
window.currentUser = null;

// 3. 핵심 헬퍼 함수
const getElement = (id) => document.getElementById(id);

function controlModal(modalId, show) {
    const modal = getElement(modalId);
    console.log(`controlModal: Attempting to ${show ? 'show' : 'hide'} modal with ID #${modalId}. Element found:`, modal);
    if (modal) {
        if (show) {
            modal.classList.add('show', 'active');
            // 회원가입 모달을 열 때 Turnstile 자동 렌더링
            if (modalId === 'signup-modal') {
                console.log('🔄 [controlModal] 회원가입 모달 열림 - Turnstile 자동 렌더링 시작');
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
                console.log('🔄 [controlModal] 회원가입 모달 닫힘 - Turnstile 상태 초기화');
                // Turnstile 상태 초기화
                window.turnstileAlreadyRendered = false;
                window.turnstileRenderingInProgress = false;
            }
        }
        document.body.style.overflow = show ? 'hidden' : '';
        console.log(`controlModal: Modal #${modalId} class list:`, modal.classList);
    }
}

function applyTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    
    // 모든 테마 속성 설정
    document.documentElement.classList.toggle('dark-mode', theme === 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    
    updateLogos();
    updateThemeIcon();
}

function toggleTheme() {
    console.log('Toggling theme...');
    const currentTheme = localStorage.getItem('theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    // 즉시 테마 적용
    document.documentElement.classList.toggle('dark-mode', newTheme === 'dark');
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    console.log(`Theme changed to ${newTheme}. Dark mode class present:`, document.documentElement.classList.contains('dark-mode'));
    
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
    console.log("updateAuthUI called with user:", user);
    const mobileAuthSection = document.querySelector('.mobile-auth-section');
    const userProfile = getElement('user-profile');
    const authButtons = document.querySelector('.auth-buttons');
    const adminPageLink = getElement('admin-page-link');
    const mainHeader = getElement('main-header');
    const authLoading = getElement('auth-loading');

    if (user) {
        try {
            console.log("Fetching user data for:", user.uid);
            const userDoc = await window.db.collection("users").doc(user.uid).get();
            const _exists = typeof userDoc.exists === 'function' ? userDoc.exists() : userDoc.exists;
            currentUser = _exists 
                ? { uid: user.uid, ...userDoc.data() } 
                : { uid: user.uid, displayName: user.displayName || "사용자" };
            window.currentUser = currentUser;
            console.log("User data fetched:", currentUser);

            // 로그인 상태 UI 업데이트
            if (userProfile) userProfile.style.display = 'flex';
            if (authButtons) authButtons.style.display = 'none';
            if (getElement('user-display-name')) getElement('user-display-name').textContent = currentUser.displayName;
            
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
            
        } catch (error) {
            console.error("Error fetching user data:", error);
            // 에러 발생 시에도 기본 사용자 정보로 설정
            currentUser = { uid: user.uid, displayName: user.displayName || "사용자" };
            window.currentUser = currentUser;
            
            if (userProfile) userProfile.style.display = 'flex';
            if (authButtons) authButtons.style.display = 'none';
            if (getElement('user-display-name')) getElement('user-display-name').textContent = currentUser.displayName;
        }
    } else {
        // 로그아웃 상태
        currentUser = null;
        window.currentUser = null;
        
        if (userProfile) userProfile.style.display = 'none';
        if (authButtons) authButtons.style.display = 'flex';
        if (adminPageLink) adminPageLink.style.display = 'none';
        if (getElement('mobile-admin-link')) getElement('mobile-admin-link').style.display = 'none';
        
        // 사용자 데이터 새로고침 중지
        stopUserDataRefresh();
        
        // 모바일 메뉴 초기화
        updateMobileMenuUserInfo();
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

// 모바일 메뉴 사용자 정보 업데이트
function updateMobileMenuUserInfo() {
    const mobileAuthSection = document.querySelector('.mobile-auth-section');
    if (!mobileAuthSection) return;
    
    if (!currentUser) {
        // 로그인/회원가입 버튼 (비로그인 시)
        mobileAuthSection.innerHTML = `
            <div class="mobile-auth-buttons">
                <button class="mobile-auth-btn login" data-action="open-login-modal">
                    <i class="fas fa-sign-in-alt"></i> 로그인
                </button>
                <button class="mobile-auth-btn signup" data-action="open-signup-modal">
                    <i class="fas fa-user-plus"></i> 회원가입
                </button>
            </div>
        `;
        return;
    }
    
    // 로그인 상태 - 사용자 프로필 표시
    mobileAuthSection.innerHTML = `
        <div class="mobile-user-profile">
            <div class="mobile-user-info">
                <span class="mobile-user-name">${currentUser.displayName}님</span>
            </div>
            <button class="mobile-logout-btn" data-action="logout">
                <i class="fas fa-sign-out-alt"></i> 로그아웃
            </button>
        </div>`;
}

// 사용자 데이터 새로고침 함수
window.refreshUserData = async function() {
    if (window.auth.currentUser) {
        // 최신 사용자 데이터를 다시 가져와서 업데이트
        try {
            console.log('사용자 데이터 새로고침 시작...');
            const userDoc = await window.db.collection("users").doc(window.auth.currentUser.uid).get();
            if ( (typeof userDoc.exists === 'function' ? userDoc.exists() : userDoc.exists) ) {
                const newUserData = userDoc.data();
                
                console.log('사용자 데이터 업데이트:', newUserData);
                
                // 모바일 메뉴 업데이트
                updateMobileMenuUserInfo();
                
                // 채팅에서 사용할 수 있도록 전역 변수 업데이트
                window.currentUserData = { uid: window.auth.currentUser.uid, ...newUserData };
                
                // 마이페이지에서 사용할 수 있도록 이벤트 발생
                window.dispatchEvent(new CustomEvent('userDataUpdated', { 
                    detail: { user: window.currentUserData } 
                }));
                
                console.log('사용자 데이터가 새로고침되었습니다:', window.currentUserData);
                
                // currentUser 업데이트
                currentUser = { uid: window.auth.currentUser.uid, ...newUserData };
                window.currentUser = currentUser;
            }
        } catch (error) {
            console.error('사용자 데이터 새로고침 오류:', error);
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
                        console.log('포인트 변경 감지:', currentUser.points, '->', newUserData.points);
                        await window.refreshUserData();
                    }
                }
            } catch (error) {
                console.error('주기적 사용자 데이터 확인 오류:', error);
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

    console.log("Handling action:", action);

    const actions = {
        'open-login': () => controlModal('login-modal', true),
        'open-signup': () => controlModal('signup-modal', true),
        'open-login-modal': () => controlModal('login-modal', true),
        'open-signup-modal': () => controlModal('signup-modal', true),
        'close-modal': () => {
            const modal = target.closest('.auth-modal');
            if (modal) {
                console.log("Closing modal:", modal.id);
                controlModal(modal.id, false);
            }
        },
        'show-signup': () => { controlModal('login-modal', false); controlModal('signup-modal', true); },
        'show-login': () => { controlModal('signup-modal', false); controlModal('login-modal', true); },
        'toggle-theme': () => {
            console.log("Toggling theme");
            toggleTheme();
        },
        'logout': () => {
            console.log("Logging out");
            window.auth.signOut().catch(console.error);
        },
        'my-page': () => {
            if (window.auth.currentUser) window.location.href = target.href;
            else alert('로그인이 필요합니다.');
        },
        'open-mobile-menu': () => {
            console.log('Opening mobile menu');
            // 모바일 메뉴가 없으면 생성
            if (!getElement('mobile-menu')) {
                createMobileMenuIfNeeded();
            }
            const mobileMenu = getElement('mobile-menu');
            if (mobileMenu) {
                // 900px 미만에서 메뉴 열기
                if (window.innerWidth < 900) {
                    mobileMenu.style.display = 'flex';
                }
                mobileMenu.classList.add('is-open');
                document.body.classList.add('mobile-menu-open');
                console.log('Mobile menu opened');
            } else {
                console.log('Mobile menu element not found');
            }
        },
        'close-mobile-menu': () => {
            console.log('Closing mobile menu');
            const mobileMenu = getElement('mobile-menu');
            if (mobileMenu) {
                mobileMenu.classList.remove('is-open');
                document.body.classList.remove('mobile-menu-open');
                console.log('Mobile menu closed');
                
                // 링크 클릭 시 페이지 이동 허용
                if (target.tagName === 'A' && target.href && !target.href.includes('#')) {
                    setTimeout(() => {
                window.location.href = target.href;
                    }, 100);
                }
            }
        },
    };

    if (actions[action]) {
        actions[action]();
    }
}

// 6. 초기화 함수
function createMobileMenuIfNeeded() {
    // 기존 모바일 메뉴와 오버레이 제거
    const existingMenu = getElement('mobile-menu');
    const existingOverlay = document.querySelector('.mobile-menu-overlay');
    if (existingMenu) existingMenu.remove();
    if (existingOverlay) existingOverlay.remove();

    // 오버레이 생성
    const overlay = document.createElement('div');
    overlay.className = 'mobile-menu-overlay';
    overlay.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const mobileMenu = getElement('mobile-menu');
        if (mobileMenu && mobileMenu.classList.contains('is-open')) {
            mobileMenu.classList.remove('is-open');
            document.body.classList.remove('mobile-menu-open');
        }
    });
    document.body.appendChild(overlay);

    // 메뉴 생성 (현대적인 사이드 슬라이드 디자인)
    const menu = document.createElement('div');
    menu.id = 'mobile-menu';
    menu.className = 'mobile-menu';
    menu.innerHTML = `
        <div class="mobile-menu-header">
          <div class="mobile-menu-title">
            <span>Onbit</span>
          </div>
          <button class="mobile-menu-close" data-action="close-mobile-menu" aria-label="메뉴 닫기">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="mobile-auth-section">
            <div class="mobile-auth-buttons">
                <button class="mobile-auth-btn login" data-action="open-login-modal">
                    <i class="fas fa-sign-in-alt"></i> 로그인
                </button>
                <button class="mobile-auth-btn signup" data-action="open-signup-modal">
                    <i class="fas fa-user-plus"></i> 회원가입
                </button>
            </div>
        </div>
        <nav class="mobile-menu-nav">
          <ul>
            <li><a href="/affiliated/" data-action="close-mobile-menu"><i class="fas fa-building"></i> 제휴 거래소</a></li>
            <li><a href="/community/" data-action="close-mobile-menu"><i class="fas fa-comments"></i> 실시간 채팅</a></li>
            <li><a href="/news/" data-action="close-mobile-menu"><i class="fas fa-newspaper"></i> 뉴스</a></li>
            <li><a href="/event-board.html" data-action="close-mobile-menu"><i class="fas fa-calendar-alt"></i> 이벤트</a></li>
            <li><a href="/notice-board.html" data-action="close-mobile-menu"><i class="fas fa-bullhorn"></i> 공지사항</a></li>
            <li><a href="/my-account.html" data-action="close-mobile-menu"><i class="fas fa-user"></i> 마이페이지</a></li>
            <li><a href="#" data-action="toggle-theme"><i class="fas fa-adjust"></i> 테마 변경</a></li>
          </ul>
        </nav>
        <div class="mobile-menu-actions">
          <div class="mobile-action-grid">
            <a href="/admin/" class="mobile-action-btn" id="mobile-admin-link" style="display: none;">
              <i class="fas fa-shield-alt"></i>
              <span>관리자</span>
            </a>
          </div>
        </div>`;
    document.body.appendChild(menu);
    
    // 모바일 메뉴는 텍스트 기반이므로 별도 로고 설정 불필요
    
    updateMobileMenuUserInfo();
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

if (!window.bindAuthForms) {
    function bindAuthForms() {
        console.log('🔧 폼 바인딩 시작...');
        bindLoginForm();
        bindSignupForm();
    }
    
    function bindLoginForm() {
        const loginForm = document.getElementById('login-form');
        if (loginForm && !loginForm.dataset.bound) {
            loginForm.dataset.bound = 'true';
            console.log('✅ 로그인 폼 바인딩 완료');
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = loginForm['login-email'].value;
                const password = loginForm['login-password'].value;
                const errorMsg = document.getElementById('login-error-message');
                try {
                    const userCredential = await window.auth.signInWithEmailAndPassword(email, password);
                    const userDoc = await window.db.collection("users").doc(userCredential.user.uid).get();
                    const _exists = typeof userDoc.exists === 'function' ? userDoc.exists() : userDoc.exists;
                    if (!_exists) {
                        await window.db.collection("users").doc(userCredential.user.uid).set({
                            displayName: userCredential.user.displayName || "사용자",
                            email,
                            role: 'user',
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }
                    controlModal('login-modal', false);
                    loginForm.reset();
                } catch (error) {
                    console.warn('로그인 오류:', error.code, error.message);
                    if(errorMsg) {
                        switch(error.code) {
                            case 'auth/user-not-found':
                                errorMsg.textContent = "등록되지 않은 이메일입니다.";
                                break;
                            case 'auth/wrong-password':
                                errorMsg.textContent = "비밀번호가 잘못되었습니다.";
                                break;
                            case 'auth/invalid-email':
                                errorMsg.textContent = "유효하지 않은 이메일 형식입니다.";
                                break;
                            case 'auth/user-disabled':
                                errorMsg.textContent = "비활성화된 계정입니다.";
                                break;
                            case 'auth/too-many-requests':
                                errorMsg.textContent = "너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해주세요.";
                                break;
                            default:
                                errorMsg.textContent = "로그인 중 오류가 발생했습니다. 다시 시도해주세요.";
                        }
                    }
                }
            });
        }
    }
    
    function bindSignupForm() {
        const signupForm = document.getElementById('signup-form');
        if (signupForm && !signupForm.dataset.bound) {
            signupForm.dataset.bound = 'true';
            console.log('✅ [js/auth.js] 회원가입 폼 바인딩 완료');
            
            // TurnstileManager가 자동으로 처리 - 별도 호출 불필요
            console.log('✅ [js/auth.js] TurnstileManager가 자동 처리');
            
            signupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = signupForm['signup-name'].value;
                const email = signupForm['signup-email'].value;
                const password = signupForm['signup-password'].value;
                const confirmPassword = signupForm['signup-confirm-password'].value;
                const errorMsg = document.getElementById('signup-error-message');
                
                if (name.length > 8) {
                    if(errorMsg) errorMsg.textContent = "닉네임은 8자 이하로 입력해주세요.";
                    return;
                }
                if (password !== confirmPassword) {
                    if(errorMsg) errorMsg.textContent = "비밀번호가 일치하지 않습니다.";
                    return;
                }
                
                // Turnstile 토큰 확인
                const token = document.querySelector('#cf-turnstile input[name="cf-turnstile-response"]')?.value;
                if (!token) {
                    if(errorMsg) errorMsg.textContent = "자동 가입 방지 인증을 완료해 주세요.";
                    if (typeof renderTurnstile === 'function') {
                        renderTurnstile();
                    }
                    return;
                }
                
                try {
                    const userCredential = await window.auth.createUserWithEmailAndPassword(email, password);
                    await userCredential.user.updateProfile({ displayName: name });
                    const userDoc = await window.db.collection("users").doc(userCredential.user.uid).get();
                    const _exists = typeof userDoc.exists === 'function' ? userDoc.exists() : userDoc.exists;
                    if (!_exists) {
                        await window.db.collection("users").doc(userCredential.user.uid).set({
                            displayName: name,
                            email,
                            role: email === 'admin@site.com' ? 'admin' : 'user',
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }
                    controlModal('signup-modal', false);
                    signupForm.reset();
                    alert('회원가입이 완료되었습니다!');
                } catch (error) {
                    console.warn('회원가입 오류:', error.code, error.message);
                    if(errorMsg) {
                        switch(error.code) {
                            case 'auth/email-already-in-use':
                                errorMsg.textContent = "이미 사용 중인 이메일입니다.";
                                break;
                            case 'auth/invalid-email':
                                errorMsg.textContent = "유효하지 않은 이메일 형식입니다.";
                                break;
                            case 'auth/weak-password':
                                errorMsg.textContent = "비밀번호가 너무 약합니다. 6자 이상으로 설정해주세요.";
                                break;
                            case 'auth/operation-not-allowed':
                                errorMsg.textContent = "회원가입이 현재 비활성화되어 있습니다.";
                                break;
                            default:
                                errorMsg.textContent = "회원가입 중 오류가 발생했습니다. 다시 시도해주세요.";
                        }
                    }
                }
            });
        }
    }
    
    window.bindAuthForms = bindAuthForms;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindAuthForms);
    } else {
        bindAuthForms();
    }
}

// Utility: hide any auth modals that might still be open
function hideOpenAuthModals() {
    document.querySelectorAll('.auth-modal.show, .auth-modal.active').forEach(modal => {
        modal.classList.remove('show', 'active');
    });
    document.body.style.overflow = '';
}

// Provide a minimal stub if level-system.js is not loaded
if (!window.levelSystem) {
  window.levelSystem = { calculateLevel: (points)=>({name:'Lv.0', color:'#22c55e'}) };
}

// =========================
// 강력한 Turnstile 렌더링 시스템
// =========================

// 강력한 Turnstile 렌더링 시스템
function renderTurnstile() {
    console.log('🎯 [js/auth.js] renderTurnstile 호출됨');
    
    // 중복 렌더링 방지
    if (window.turnstileRenderingInProgress) {
        console.log('⏳ [js/auth.js] Turnstile 렌더링 진행 중 - 대기');
        return;
    }
    
    if (window.turnstileAlreadyRendered) {
        console.log('✅ [js/auth.js] Turnstile이 이미 렌더링됨 - 건너뛰기');
        return;
    }
    
    window.turnstileRenderingInProgress = true;
    
    // Turnstile 스크립트 로드 확인 및 렌더링
    ensureTurnstileScript().then(() => {
        const turnstileElement = findOrCreateTurnstileElement();
        if (turnstileElement) {
            performTurnstileRender(turnstileElement);
        } else {
            console.error('❌ [js/auth.js] Turnstile 요소를 찾거나 생성할 수 없음');
            window.turnstileRenderingInProgress = false;
        }
    }).catch((error) => {
        console.error('❌ [js/auth.js] Turnstile 렌더링 준비 실패:', error);
        window.turnstileRenderingInProgress = false;
    });
}

// Turnstile 스크립트 확실히 로드
function ensureTurnstileScript() {
    return new Promise((resolve) => {
        if (window.turnstile) {
            console.log('✅ Turnstile 스크립트 이미 로드됨');
            resolve();
            return;
        }
        
        // 기존 스크립트 확인
        const existingScript = document.querySelector('script[src*="turnstile"]');
        if (existingScript) {
            console.log('⏳ 기존 Turnstile 스크립트 로딩 대기...');
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
        console.log('📥 Turnstile 스크립트 추가 중...');
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            console.log('✅ Turnstile 스크립트 로드 완료');
            resolve();
        };
        script.onerror = () => {
            console.error('❌ Turnstile 스크립트 로드 실패');
            resolve(); // 계속 진행
        };
        document.head.appendChild(script);
    });
}

// Turnstile 요소 찾기 또는 생성
function findOrCreateTurnstileElement() {
    let turnstileElement = document.getElementById('cf-turnstile');
    
    if (!turnstileElement) {
        console.log('📝 Turnstile 요소 동적 생성...');
        const signupForm = document.getElementById('signup-form');
        if (!signupForm) {
            console.log('❌ 회원가입 폼을 찾을 수 없음');
            return null;
        }
        
        const turnstileDiv = document.createElement('div');
        turnstileDiv.className = 'input-group';
        turnstileDiv.innerHTML = `<div id="cf-turnstile" class="cf-turnstile" data-sitekey="0x4AAAAAABhG8vjyB5nsUxll" data-theme="${document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light'}"></div>`;
        
        const submitButton = signupForm.querySelector('button[type="submit"]');
        if (submitButton) {
            signupForm.insertBefore(turnstileDiv, submitButton);
            turnstileElement = document.getElementById('cf-turnstile');
            console.log('✅ Turnstile 요소 생성 완료');
        }
    }
    
    return turnstileElement;
}

// 실제 Turnstile 렌더링 수행 (중복 방지)
function performTurnstileRender(turnstileElement) {
    if (!window.turnstile) {
        console.log('❌ [js/auth.js] Turnstile 스크립트가 로드되지 않음');
        window.turnstileRenderingInProgress = false;
        return;
    }
    
    // 이미 렌더링되어 있는지 최종 확인
    if (turnstileElement.querySelector('iframe')) {
        console.log('⚠️ [js/auth.js] Turnstile이 이미 렌더링되어 있음 - 건너뛰기');
        window.turnstileAlreadyRendered = true;
        window.turnstileRenderingInProgress = false;
        return;
    }
    
    // 모든 Turnstile 요소들 정리 (중복 방지)
    document.querySelectorAll('.cf-turnstile').forEach((element, index) => {
        if (element !== turnstileElement && element.querySelector('iframe')) {
            console.log(`🗑️ [js/auth.js] 중복 Turnstile 요소 ${index + 1} 제거`);
            try {
                window.turnstile.reset(element);
            } catch (e) {
                element.innerHTML = '';
            }
        }
    });
    
    // 새로 렌더링
    try {
        console.log('🎨 [js/auth.js] Turnstile 렌더링 실행...');
        window.turnstile.render(turnstileElement, {
            sitekey: '0x4AAAAAABhG8vjyB5nsUxll',
            theme: document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light',
            callback: function(token) {
                console.log('✅ [js/auth.js] Turnstile 인증 완료!');
                window.turnstileAlreadyRendered = true;
                window.turnstileRenderingInProgress = false;
            },
            'error-callback': function() {
                console.log('❌ [js/auth.js] Turnstile 오류 - 재시도 예약');
                window.turnstileAlreadyRendered = false;
                window.turnstileRenderingInProgress = false;
                setTimeout(() => {
                    renderTurnstile();
                }, 2000);
            }
        });
        console.log('✅ [js/auth.js] Turnstile 렌더링 성공!');
        window.turnstileAlreadyRendered = true;
        window.turnstileRenderingInProgress = false;
    } catch (error) {
        console.error('❌ [js/auth.js] Turnstile 렌더링 실패:', error);
        window.turnstileAlreadyRendered = false;
        window.turnstileRenderingInProgress = false;
        setTimeout(() => {
            renderTurnstile();
        }, 2000);
    }
}

// 전역에서 접근 가능하도록
window.renderTurnstile = renderTurnstile; 