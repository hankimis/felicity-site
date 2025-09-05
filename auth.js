// Firebase compat 버전 사용
// import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendEmailVerification, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
// import { getFirestore, doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// import { firebaseConfig } from './firebase-config.js';

// Firebase 초기화
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

// Firebase 초기화 (compat 버전)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Firebase 서비스 가져오기
const auth = firebase.auth();
const db = firebase.firestore();

// 2. 전역 상태 변수 (중복 로드 안전)
var currentUser = (typeof window !== 'undefined' && window.currentUser) ? window.currentUser : null;
window.currentUser = currentUser;

// 3. 핵심 헬퍼 함수
const getElement = (id) => document.getElementById(id);
// 전역으로도 접근 가능하도록 설정
window.getElement = getElement;

// 안전한 Turnstile 렌더링 함수
function renderTurnstile() {
    // 이미 렌더링 중이면 중단
    if (window.turnstileRenderingInProgress) {
        return;
    }
    
    // 이미 렌더링되어 있으면 건너뛰기
    if (window.turnstileAlreadyRendered) {
        return;
    }
    
    window.turnstileRenderingInProgress = true;
    
    // 스크립트 로드 후 렌더링
    ensureTurnstileScript().then(() => {
        const turnstileElement = findOrCreateTurnstileElement();
        if (turnstileElement) {
            performTurnstileRender(turnstileElement);
        }
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

// Turnstile 요소 찾기 또는 생성 (중복 방지)
function findOrCreateTurnstileElement() {
    // 기존 요소 먼저 찾기
    let turnstileElement = document.getElementById('cf-turnstile');
    
    if (turnstileElement) {
        return turnstileElement;
    }
    
    // 중복 생성 방지
    if (document.querySelector('.cf-turnstile')) {
        return document.querySelector('.cf-turnstile');
    }
    
    const signupForm = document.getElementById('signup-form');
    if (!signupForm) {
        return null;
    }
    
    // 이미 input-group이 있는지 확인
    const existingInputGroup = signupForm.querySelector('.input-group:has(.cf-turnstile)');
    if (existingInputGroup) {
        return existingInputGroup.querySelector('.cf-turnstile');
    }
    
    const turnstileDiv = document.createElement('div');
    turnstileDiv.className = 'input-group';
    turnstileDiv.innerHTML = `<div id="cf-turnstile" class="cf-turnstile" data-sitekey="0x4AAAAAABhG8vjyB5nsUxll" data-theme="${document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light'}"></div>`;
    
    const submitButton = signupForm.querySelector('button[type="submit"]');
    if (submitButton) {
        signupForm.insertBefore(turnstileDiv, submitButton);
        turnstileElement = document.getElementById('cf-turnstile');
    }
    
    return turnstileElement;
}

// 실제 Turnstile 렌더링 수행 (중복 방지)
function performTurnstileRender(turnstileElement) {
    if (!window.turnstile) {
        return;
    }
    
    // 이미 렌더링되어 있는지 최종 확인
    if (turnstileElement.querySelector('iframe')) {
        window.turnstileAlreadyRendered = true;
        return;
    }
    
    // 기존 렌더링된 Turnstile 위젯 정리
    try {
        const existingWidgets = document.querySelectorAll('.cf-turnstile iframe');
        existingWidgets.forEach((widget, index) => {
            const parent = widget.closest('.cf-turnstile');
            if (parent !== turnstileElement) {
                try {
                    window.turnstile.reset(parent);
                } catch (e) {
                    parent.innerHTML = '';
                }
            }
        });
    } catch (error) {
        // Silent error handling
    }
    
    // 새로 렌더링
    try {
        // 기존 내용 제거
        turnstileElement.innerHTML = '';
        
        window.turnstile.render(turnstileElement, {
            sitekey: '0x4AAAAAABhG8vjyB5nsUxll',
            theme: document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light',
            callback: function(token) {
                window.turnstileAlreadyRendered = true;
                window.turnstileToken = token;
            },
            'error-callback': function(error) {
                window.turnstileAlreadyRendered = false;
                // 오류 발생 시 재시도 지연
                setTimeout(() => {
                    window.turnstileRenderingInProgress = false;
                    if (document.getElementById('signup-modal').style.display === 'flex') {
                        renderTurnstile();
                    }
                }, 3000);
            },
            'expired-callback': function() {
                window.turnstileAlreadyRendered = false;
                window.turnstileToken = null;
            }
        });
        window.turnstileAlreadyRendered = true;
    } catch (error) {
        window.turnstileAlreadyRendered = false;
        // 오류 발생 시 재시도 지연
        setTimeout(() => {
            window.turnstileRenderingInProgress = false;
            if (document.getElementById('signup-modal').style.display === 'flex') {
                renderTurnstile();
            }
        }, 3000);
    }
}

function controlModal(modalId, show) {
    const modal = getElement(modalId);
    if (modal) {
        modal.style.display = show ? 'flex' : 'none';
        document.body.style.overflow = show ? 'hidden' : '';
        
        // 회원가입 모달이 열릴 때 Turnstile 렌더링
        if (modalId === 'signup-modal' && show) {
            // 기존 상태 초기화
            window.turnstileAlreadyRendered = false;
            window.turnstileRenderingInProgress = false;
            
            setTimeout(() => {
                renderTurnstile();
            }, 300);
        }
        
        // 모달이 닫힐 때 Turnstile 상태 초기화
        if (modalId === 'signup-modal' && !show) {
            window.turnstileAlreadyRendered = false;
            window.turnstileRenderingInProgress = false;
            window.turnstileToken = null;
        }
    }
}

function applyTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.classList.toggle('dark-mode', theme === 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    updateLogos();
    updateThemeIcon();
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark-mode', newTheme === 'dark');
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateLogos();
    updateThemeIcon();
    
    // 테마 변경 이벤트 발생
    document.dispatchEvent(new CustomEvent('themeChanged', { 
        detail: { theme: newTheme } 
    }));
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
    document.querySelectorAll('.logo img, #mobile-main-logo').forEach(img => {
        if(img) img.src = logoSrc;
    });
}

// 4. UI 업데이트 함수
async function updateAuthUI(user) {
    const mobileAuthSection = document.querySelector('.mobile-auth-section');
    const userProfile = getElement('user-profile');
    const mobileUserProfile = getElement('mobile-user-profile');
    const authButtons = document.querySelector('.auth-buttons');
    const adminPageLink = getElement('admin-page-link');

    if (user) {
        try {
            const userDoc = await db.collection("users").doc(user.uid).get();
            currentUser = userDoc.exists 
                ? { uid: user.uid, ...userDoc.data() } 
                : { uid: user.uid, displayName: user.displayName || "사용자", points: 0, level: "새싹" };
            window.currentUser = currentUser;

            // 로그인 상태 UI 업데이트
            if (userProfile) userProfile.style.display = 'flex';
            if (mobileUserProfile) {
                // PC에서는 모바일 요소 숨김 (768px 초과 시)
                if (window.innerWidth <= 768) {
                    mobileUserProfile.style.display = 'flex';
                } else {
                    mobileUserProfile.style.display = 'none';
                }
            }
            if (authButtons) authButtons.style.display = 'none';
            if (getElement('user-display-name')) getElement('user-display-name').textContent = currentUser.displayName;
            if (getElement('mobile-user-display-name')) getElement('mobile-user-display-name').textContent = currentUser.displayName;
            
            // 레벨 정보 업데이트
            updateUserLevelDisplay();
            
            if (adminPageLink) adminPageLink.style.display = currentUser.role === 'admin' ? 'inline-block' : 'none';
            
            // 모바일 관리자 링크 업데이트
            const mobileAdminLink = getElement('mobile-admin-link');
            if (mobileAdminLink) mobileAdminLink.style.display = currentUser.role === 'admin' ? 'block' : 'none';

            // 주기적 사용자 데이터 새로고침 시작
            startUserDataRefresh();
            
            // 모바일에서 로그인 시 커뮤니티 페이지로 이동
            if (window.innerWidth <= 768 && !window.location.pathname.includes('/community/')) {
                window.location.href = '/community/';
            }
        } catch (error) {
            // 에러 발생 시 로그아웃 처리
            auth.signOut().catch(() => {});
        }
    } else {
        currentUser = null;
        window.currentUser = null;

        // 주기적 새로고침 중지
        stopUserDataRefresh();

        // 로그아웃 상태 UI 업데이트
        if (userProfile) userProfile.style.display = 'none';
        if (mobileUserProfile) mobileUserProfile.style.display = 'none';
        if (authButtons) authButtons.style.display = 'flex';
        if (adminPageLink) adminPageLink.style.display = 'none';
    }
}

// 사용자 레벨 표시 업데이트
function updateUserLevelDisplay() {
    if (!currentUser) {
        return;
    }
    
    // 레벨 시스템이 로드될 때까지 기다림
    if (!window.levelSystem) {
        setTimeout(updateUserLevelDisplay, 200);
        return;
    }
    
    const levelInfo = window.levelSystem.calculateLevel(currentUser.points || 0);
    
    // 헤더 레벨 업데이트 (여러 방법으로 시도)
    // getElement 함수가 정의되지 않은 경우를 대비한 안전한 호출
    const userLevelElement = (typeof getElement === 'function' ? getElement('user-level') : document.getElementById('user-level'));
    const userLevelElements = document.querySelectorAll('#user-level, .user-level');
    
    if (userLevelElement) {
        userLevelElement.textContent = levelInfo.name;
        userLevelElement.style.color = levelInfo.color || '#22c55e';
    }
    
    // 모든 레벨 요소 업데이트
    userLevelElements.forEach(element => {
        element.textContent = levelInfo.name;
        element.style.color = levelInfo.color || '#22c55e';
    });
    
    // 채팅에서 사용할 수 있도록 전역 변수 설정
    window.currentUserLevel = levelInfo;
    
    // 모든 페이지에서 사용할 수 있도록 전역 사용자 정보 업데이트
    window.currentUserData = currentUser;
}

// 사용자 데이터 새로고침 함수 (관리자가 포인트 변경 시 호출)
window.refreshUserData = async function() {
    if (auth.currentUser) {
        // 최신 사용자 데이터를 다시 가져와서 업데이트
        try {
            const userDoc = await db.collection("users").doc(auth.currentUser.uid).get();
            if (userDoc.exists()) {
                const oldPoints = currentUser ? currentUser.points : 0;
                const newUserData = userDoc.data();
                
                // 레벨 시스템이 로드될 때까지 기다림
                if (!window.levelSystem) {
                    setTimeout(window.refreshUserData, 200);
                    return;
                }
                
                // 헤더 레벨 업데이트
                updateUserLevelDisplay();
                
                // 채팅에서 사용할 수 있도록 전역 변수 업데이트
                window.currentUserLevel = window.levelSystem.calculateLevel(newUserData.points || 0);
                window.currentUserData = { uid: auth.currentUser.uid, ...newUserData };
                
                // 마이페이지에서 사용할 수 있도록 이벤트 발생
                window.dispatchEvent(new CustomEvent('userDataUpdated', { 
                    detail: { user: window.currentUserData, level: window.currentUserLevel } 
                }));
                
                // currentUser 업데이트
                currentUser = { uid: auth.currentUser.uid, ...newUserData };
                window.currentUser = currentUser;
            }
        } catch (error) {
            // Silent error handling
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
        if (auth.currentUser && currentUser) {
            try {
                const userDoc = await db.collection("users").doc(auth.currentUser.uid).get();
                if (userDoc.exists) {
                    const newUserData = userDoc.data();
                    
                    // 포인트가 변경되었는지 확인
                    if (newUserData.points !== currentUser.points) {
                        await window.refreshUserData();
                    }
                }
            } catch (error) {
                // Silent error handling
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
        'open-login': () => controlModal('login-modal', true),
        'open-signup': () => controlModal('signup-modal', true),
        'open-login-modal': () => controlModal('login-modal', true),
        'open-signup-modal': () => {
            controlModal('signup-modal', true);
        },
        'close-modal': () => {
            const modal = target.closest('.auth-modal');
            if (modal) {
                controlModal(modal.id, false);
            }
        },
        'show-signup': () => { 
            controlModal('login-modal', false); 
            controlModal('signup-modal', true);
        },
        'show-login': () => { controlModal('signup-modal', false); controlModal('login-modal', true); },
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
            auth.signOut().catch(() => {});
        },
        'my-page': () => {
            if (auth.currentUser) window.location.href = target.href;
            else alert('로그인이 필요합니다.');
        },
    };

    if (actions[action]) {
        actions[action]();
    }
}



// 7. 스크립트 실행
auth.onAuthStateChanged(async (user) => {
    // 이메일 인증 여부와 관계없이 로그인 허용
    updateAuthUI(user);
});

document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    
    document.addEventListener('click', handleGlobalClick);

    const loginForm = getElement('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm['login-email'].value;
            const password = loginForm['login-password'].value;
            const errorMsg = getElement('login-error-message');
            try {
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                // Firestore에 사용자 정보가 없으면 최초 로그인 → 정보 저장
                const userDoc = await db.collection("users").doc(userCredential.user.uid).get();
                if (!userDoc.exists) {
                    await db.collection("users").doc(userCredential.user.uid).set({
                        displayName: userCredential.user.displayName || "사용자",
                        email,
                        points: 0,
                        level: "새싹",
                        role: 'user',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                controlModal('login-modal', false);
                loginForm.reset();
            } catch (error) {
                if(errorMsg) errorMsg.textContent = "이메일 또는 비밀번호가 잘못되었습니다.";
            }
        });
    }

    const signupForm = getElement('signup-form');
    if (signupForm && !document.getElementById('cf-turnstile')) {
        const turnstileDiv = document.createElement('div');
        turnstileDiv.className = 'input-group';
        turnstileDiv.innerHTML = `<div id="cf-turnstile" class="cf-turnstile" data-sitekey="0x4AAAAAABhG8vjyB5nsUxll" data-theme="light"></div>`;
        signupForm.insertBefore(turnstileDiv, signupForm.querySelector('button'));
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = signupForm['signup-name'].value;
            const email = signupForm['signup-email'].value;
            const password = signupForm['signup-password'].value;
            const confirmPassword = signupForm['signup-confirm-password'].value;
            const errorMsg = getElement('signup-error-message');

            if (name.length > 8) {
                if(errorMsg) errorMsg.textContent = "닉네임은 8자 이하로 입력해주세요.";
                return;
            }
            if (password !== confirmPassword) {
                if(errorMsg) errorMsg.textContent = "비밀번호가 일치하지 않습니다.";
                return;
            }

            // turnstile 토큰 체크 (회원가입 전에 먼저 체크)
            const turnstileToken = document.querySelector('#cf-turnstile input[name="cf-turnstile-response"]')?.value;
            if (!turnstileToken) {
                if(errorMsg) errorMsg.textContent = "자동 가입 방지 인증을 완료해 주세요.";
                return;
            }

            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                await userCredential.user.updateProfile({ displayName: name });
                // Firestore에 사용자 정보 저장
                await db.collection("users").doc(userCredential.user.uid).set({
                    displayName: name,
                    email,
                    points: 0,
                    level: "새싹",
                    role: email === 'admin@site.com' ? 'admin' : 'user',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                controlModal('signup-modal', false);
                signupForm.reset();
                alert('회원가입이 완료되었습니다!');
            } catch (error) {
                if(errorMsg) errorMsg.textContent = error.code === 'auth/email-already-in-use' ? '이미 사용 중인 이메일입니다.' : "회원가입 중 오류가 발생했습니다.";
                // 오류 발생 시 Turnstile 초기화
                setTimeout(() => {
                    renderTurnstile();
                }, 100);
            }
        });
    }

    // 비밀번호 찾기 링크 클릭 시
    const findPasswordLink = getElement('find-password-link');
    if (findPasswordLink) {
        findPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            controlModal('login-modal', false);
            controlModal('reset-password-modal', true);
        });
    }
    // 아이디(이메일) 찾기 링크 클릭 시
    const findIdLink = getElement('find-id-link');
    if (findIdLink) {
        findIdLink.addEventListener('click', (e) => {
            e.preventDefault();
            controlModal('login-modal', false);
            controlModal('find-id-modal', true);
        });
    }
    // 비밀번호 재설정 폼 제출
    const resetForm = getElement('reset-password-form');
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = getElement('reset-password-email').value.trim();
            const msg = getElement('reset-password-message');
            try {
                // 이메일이 등록되어 있는지 확인
                const methods = await auth.fetchSignInMethodsForEmail(email);
                if (!methods || methods.length === 0) {
                    msg.textContent = '가입된 계정이 없습니다.';
                    msg.style.color = '#ef5350';
                    return;
                }
                await auth.sendPasswordResetEmail(email);
                msg.textContent = '비밀번호 재설정 메일을 전송했습니다. 메일함을 확인해 주세요.';
                msg.style.color = '#388e3c';
            } catch (error) {
                msg.textContent = '이메일이 올바르지 않거나 오류가 발생했습니다.';
                msg.style.color = '#ef5350';
            }
        });
    }
    // 아이디(이메일) 찾기 폼 제출
    const findIdForm = getElement('find-id-form');
    if (findIdForm) {
        findIdForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nickname = getElement('find-id-nickname').value.trim();
            const msg = getElement('find-id-message');
            try {
                const snapshot = await db.collection('users').where('displayName', '==', nickname).get();
                if (!snapshot.empty) {
                    const user = snapshot.docs[0].data();
                    msg.textContent = `이메일: ${user.email}`;
                    msg.style.color = '#388e3c';
                } else {
                    msg.textContent = '해당 닉네임으로 가입된 이메일이 없습니다.';
                    msg.style.color = '#ef5350';
                }
            } catch (error) {
                msg.textContent = '오류가 발생했습니다. 다시 시도해 주세요.';
                msg.style.color = '#ef5350';
            }
        });
    }
});

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
// Lazy form binding for header-injected modals
// =========================

function bindAuthForms() {
    // 로그인 폼
    const loginForm = document.getElementById('login-form');
    if (loginForm && !loginForm.dataset.bound) {
        loginForm.dataset.bound = 'true';
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm['login-email'].value;
            const password = loginForm['login-password'].value;
            const errorMsg = document.getElementById('login-error-message');
            try {
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                // Firestore에 사용자 정보가 없으면 최초 로그인 → 정보 저장
                const userDoc = await db.collection("users").doc(userCredential.user.uid).get();
                if (!userDoc.exists) {
                    await db.collection("users").doc(userCredential.user.uid).set({
                        displayName: userCredential.user.displayName || "사용자",
                        email,
                        points: 0,
                        level: "새싹",
                        role: 'user',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                controlModal('login-modal', false);
                loginForm.reset();
            } catch (error) {
                if(errorMsg) errorMsg.textContent = "이메일 또는 비밀번호가 잘못되었습니다.";
            }
        });
    }

    // 회원가입 폼
    const signupForm = document.getElementById('signup-form');
    if (signupForm && !signupForm.dataset.bound) {
        signupForm.dataset.bound = 'true';
        // Turnstile 위젯 렌더링
        setTimeout(() => {
            renderTurnstile();
        }, 500);

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

            // turnstile 토큰 체크 (회원가입 전에 먼저 체크)
            const turnstileToken = document.querySelector('#cf-turnstile input[name="cf-turnstile-response"]')?.value;
            if (!turnstileToken) {
                if(errorMsg) errorMsg.textContent = "자동 가입 방지 인증을 완료해 주세요.";
                return;
            }

            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                await userCredential.user.updateProfile({ displayName: name });
                const userDoc = await db.collection("users").doc(userCredential.user.uid).get();
                const _exists = typeof userDoc.exists === 'function' ? userDoc.exists() : userDoc.exists;
                if (!_exists) {
                    await db.collection("users").doc(userCredential.user.uid).set({
                        displayName: name,
                        email,
                        points: 0,
                        level: "새싹",
                        role: email === 'admin@site.com' ? 'admin' : 'user',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                controlModal('signup-modal', false);
                signupForm.reset();
                alert('회원가입이 완료되었습니다!');
            } catch (error) {
                if(errorMsg) errorMsg.textContent = error.code === 'auth/email-already-in-use' ? '이미 사용 중인 이메일입니다.' : "회원가입 중 오류가 발생했습니다.";
                // 오류 발생 시 Turnstile 초기화
                setTimeout(() => {
                    renderTurnstile();
                }, 100);
            }
        });
    }
}

window.bindAuthForms = bindAuthForms;
// 기본적으로 DOMContentLoaded 시도, 이후 헤더 로더가 추가 호출
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAuthForms);
} else {
    bindAuthForms();
}

// =========================
// Compatibility shim to ensure full auth script is loaded
// If this lightweight stub is included instead of js/auth.js, dynamically load the full script.
// =========================

// 외부 경량 로더가 아닌, 본 스크립트를 단독으로 사용합니다.
// 중복 로드를 방지하기 위해 추가 auth.js 로더는 비활성화합니다.

// 화면 크기 변경 시 모바일 요소 표시/숨김 처리
window.addEventListener('resize', () => {
    const mobileUserProfile = getElement('mobile-user-profile');
    if (mobileUserProfile && window.currentUser) {
        if (window.innerWidth <= 768) {
            mobileUserProfile.style.display = 'flex';
        } else {
            mobileUserProfile.style.display = 'none';
        }
    }
}); 