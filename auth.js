import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendEmailVerification, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// 1. Firebase 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 2. 전역 상태 변수
let currentUser = null;

// 3. 핵심 헬퍼 함수
const getElement = (id) => document.getElementById(id);

function controlModal(modalId, show) {
    const modal = getElement(modalId);
    if (modal) {
        modal.style.display = show ? 'flex' : 'none';
        document.body.style.overflow = show ? 'hidden' : '';
    }
}

function applyTheme() {
    const theme = localStorage.getItem('theme');
    document.documentElement.classList.toggle('dark-mode', theme === 'dark');
    updateLogos();
    updateThemeIcon();
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark-mode', newTheme === 'dark');
    localStorage.setItem('theme', newTheme);
    updateLogos();
    updateThemeIcon();
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
    console.log("updateAuthUI called with user:", user);
    const mobileAuthSection = document.querySelector('.mobile-auth-section');
    const userProfile = getElement('user-profile');
    const authButtons = document.querySelector('.auth-buttons');
    const adminPageLink = getElement('admin-page-link');

    if (user) {
        try {
            console.log("Fetching user data for:", user.uid);
            const userDoc = await getDoc(doc(db, "users", user.uid));
            currentUser = userDoc.exists() 
                ? { uid: user.uid, ...userDoc.data() } 
                : { uid: user.uid, displayName: user.displayName || "사용자", points: 0, level: "새싹" };
            console.log("User data fetched:", currentUser);

            // 로그인 상태 UI 업데이트
            if (userProfile) userProfile.style.display = 'flex';
        if (authButtons) authButtons.style.display = 'none';
            if (getElement('user-display-name')) getElement('user-display-name').textContent = currentUser.displayName;
            
            // 레벨 정보 업데이트
            updateUserLevelDisplay();
            
            if (adminPageLink) adminPageLink.style.display = currentUser.role === 'admin' ? 'inline-block' : 'none';
            
            // 모바일 관리자 링크 업데이트
            const mobileAdminLink = getElement('mobile-admin-link');
            if (mobileAdminLink) mobileAdminLink.style.display = currentUser.role === 'admin' ? 'block' : 'none';

            // 모바일 메뉴 업데이트
            updateMobileMenuUserInfo();
            
            // 주기적 사용자 데이터 새로고침 시작
            startUserDataRefresh();
        } catch (error) {
            console.error("Error fetching user data:", error);
            // 에러 발생 시 로그아웃 처리
            signOut(auth).catch(console.error);
        }
    } else {
        console.log("User is logged out");
        currentUser = null;

        // 주기적 새로고침 중지
        stopUserDataRefresh();

        // 로그아웃 상태 UI 업데이트
        if (userProfile) userProfile.style.display = 'none';
        if (authButtons) authButtons.style.display = 'flex';
        if (adminPageLink) adminPageLink.style.display = 'none';

        // 모바일 메뉴 업데이트
    if (mobileAuthSection) {
            mobileAuthSection.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:12px; padding:20px 0;">
                    <button class="mobile-auth-btn login" data-action="open-login-modal" style="font-size:1.15rem; padding:14px 0; border-radius:12px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px; background:var(--primary-color); color:#fff; border:none;">
                        <i class="fas fa-sign-in-alt"></i> 로그인
                    </button>
                    <button class="mobile-auth-btn signup" data-action="open-signup-modal" style="font-size:1.15rem; padding:14px 0; border-radius:12px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px; background:var(--bg-secondary-color); color:var(--primary-color); border:1.5px solid var(--primary-color);">
                        <i class="fas fa-user-plus"></i> 회원가입
                    </button>
                </div>
            `;
        }
    }
}

// 사용자 레벨 표시 업데이트
function updateUserLevelDisplay() {
    if (!currentUser) {
        console.log('currentUser가 없어서 레벨 업데이트 중단');
        return;
    }
    
    // 레벨 시스템이 로드될 때까지 기다림
    if (!window.levelSystem) {
        console.log('레벨 시스템 로딩 대기 중...');
        setTimeout(updateUserLevelDisplay, 200);
        return;
    }
    
    const levelInfo = window.levelSystem.calculateLevel(currentUser.points || 0);
    console.log('헤더 레벨 업데이트:', currentUser.points, '->', levelInfo.name);
    
    // 헤더 레벨 업데이트 (여러 방법으로 시도)
    const userLevelElement = getElement('user-level');
    const userLevelElements = document.querySelectorAll('#user-level, .user-level');
    
    if (userLevelElement) {
        userLevelElement.textContent = levelInfo.name;
        userLevelElement.style.color = levelInfo.color || '#22c55e';
        console.log('헤더 레벨 요소 업데이트 완료:', levelInfo.name);
    } else {
        console.log('user-level 요소를 찾을 수 없음');
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
    
    console.log('전역 레벨 정보 업데이트 완료:', window.currentUserLevel);
}

// 모바일 메뉴 사용자 정보 업데이트
function updateMobileMenuUserInfo() {
    const mobileAuthSection = document.querySelector('.mobile-auth-section');
    if (!mobileAuthSection) return;
    
    if (!currentUser) {
        // 로그인/회원가입 버튼 (비로그인 시)
        mobileAuthSection.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:12px; padding:20px 0;">
                <button class="mobile-auth-btn login" data-action="open-login-modal" style="font-size:1.15rem; padding:14px 0; border-radius:12px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px; background:var(--primary-color); color:#fff; border:none;">
                    <i class="fas fa-sign-in-alt"></i> 로그인
                </button>
                <button class="mobile-auth-btn signup" data-action="open-signup-modal" style="font-size:1.15rem; padding:14px 0; border-radius:12px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px; background:var(--bg-secondary-color); color:var(--primary-color); border:1.5px solid var(--primary-color);">
                    <i class="fas fa-user-plus"></i> 회원가입
                </button>
            </div>
        `;
        return;
    }
    
    // 레벨 시스템이 로드될 때까지 기다림
    if (!window.levelSystem) {
        setTimeout(updateMobileMenuUserInfo, 100);
        return;
    }
    
    const levelInfo = window.levelSystem.calculateLevel(currentUser.points || 0);
    
    mobileAuthSection.innerHTML = `
        <div class="mobile-user-profile">
            <div class="mobile-user-info">
                <span class="mobile-user-name">${currentUser.displayName}님</span>
                <span class="mobile-user-level" style="color: ${levelInfo.color || levelInfo.gradient || '#22c55e'}">${levelInfo.name}</span>
            </div>
            <div class="mobile-user-stats">
                <span class="mobile-user-points">${(currentUser.points || 0).toLocaleString()}P</span>
            </div>
            <button class="mobile-logout-btn" data-action="logout">로그아웃</button>
                </div>`;
}

// 사용자 데이터 새로고침 함수 (관리자가 포인트 변경 시 호출)
window.refreshUserData = async function() {
    if (auth.currentUser) {
        // 최신 사용자 데이터를 다시 가져와서 업데이트
        try {
            console.log('사용자 데이터 새로고침 시작...');
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            if (userDoc.exists()) {
                const oldPoints = currentUser ? currentUser.points : 0;
                currentUser = { uid: auth.currentUser.uid, ...userDoc.data() };
                
                console.log('포인트 변경:', oldPoints, '->', currentUser.points);
                
                // 레벨 시스템이 로드될 때까지 기다림
                if (!window.levelSystem) {
                    console.log('레벨 시스템 로딩 대기 중...');
                    setTimeout(window.refreshUserData, 200);
                    return;
                }
                
                // 헤더 레벨 업데이트
                updateUserLevelDisplay();
                
                // 모바일 메뉴 업데이트
                updateMobileMenuUserInfo();
                
                // 채팅에서 사용할 수 있도록 전역 변수 업데이트
                window.currentUserLevel = window.levelSystem.calculateLevel(currentUser.points || 0);
                window.currentUserData = currentUser;
                
                // 마이페이지에서 사용할 수 있도록 이벤트 발생
                window.dispatchEvent(new CustomEvent('userDataUpdated', { 
                    detail: { user: currentUser, level: window.currentUserLevel } 
                }));
                
                console.log('사용자 데이터가 새로고침되었습니다:', currentUser);
                console.log('현재 레벨:', window.currentUserLevel);
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
        if (auth.currentUser && currentUser) {
            try {
                const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
                if (userDoc.exists()) {
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
            signOut(auth).catch(console.error);
        },
        'my-page': () => {
            if (auth.currentUser) window.location.href = target.href;
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

    // 메뉴 생성 (깔끔한 세로형, 큰 터치영역, 상단 사용자 정보)
    const menu = document.createElement('div');
    menu.id = 'mobile-menu';
    menu.className = 'mobile-menu';
    menu.innerHTML = `
        <div class="mobile-menu-header">
          <a href="index.html" class="logo-container"><img id="mobile-main-logo" src="" alt="Onbit Logo" height="36"/></a>
          <button class="mobile-menu-close" data-action="close-mobile-menu" aria-label="메뉴 닫기"><i class="fas fa-times"></i></button>
        </div>
        <div class="mobile-auth-section"></div>
        <nav class="mobile-menu-nav">
          <ul>
            <li><a href="affiliated.html" data-action="close-mobile-menu"><i class="fas fa-building"></i> 제휴 거래소</a></li>
            <li><a href="community.html" data-action="close-mobile-menu"><i class="fas fa-comments"></i> 실시간 채팅</a></li>
            <li><a href="community-board.html" data-action="close-mobile-menu"><i class="fas fa-clipboard-list"></i> 자유 게시판</a></li>
            <li><a href="attendance.html" data-action="close-mobile-menu"><i class="fas fa-calendar-check"></i> 출석체크</a></li>
            <li><a href="notice-board.html" data-action="close-mobile-menu"><i class="fas fa-bullhorn"></i> 공지사항</a></li>
            <li><a href="my-account.html" data-action="close-mobile-menu"><i class="fas fa-user"></i> 마이페이지</a></li>
            <li><a href="#" data-action="toggle-theme"><i class="fas fa-adjust"></i> 테마 변경</a></li>
          </ul>
        </nav>
        <div class="mobile-menu-footer" style="margin-top:auto; padding-top:20px; border-top:1px solid var(--border-color); text-align:center; color:var(--text-color-secondary); font-size:0.95em;">
          <span>© 2024 Onbit</span>
        </div>`;
    document.body.appendChild(menu);
}

// 7. 스크립트 실행
onAuthStateChanged(auth, async (user) => {
    if (user && user.email !== 'admin@site.com' && !user.emailVerified) {
        await signOut(auth);
        // 안내 메시지는 로그인 시도 시 이미 표시됨
        return;
    }
    updateAuthUI(user);
});

document.addEventListener('DOMContentLoaded', () => {
    createMobileMenuIfNeeded();
    applyTheme();
    
    // 모바일 메뉴 초기 상태 확실히 설정
    setTimeout(() => {
        const mobileMenu = getElement('mobile-menu');
        if (mobileMenu) {
            mobileMenu.classList.remove('is-open');
            document.body.classList.remove('mobile-menu-open');
            // PC에서는 완전히 숨김
            if (window.innerWidth > 768) {
                mobileMenu.style.display = 'none';
            }
        }
    }, 100);
    
    document.addEventListener('click', handleGlobalClick);
    
    // ESC 키로 모바일 메뉴 닫기
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const mobileMenu = getElement('mobile-menu');
            if (mobileMenu && mobileMenu.classList.contains('is-open')) {
                mobileMenu.classList.remove('is-open');
                document.body.classList.remove('mobile-menu-open');
                console.log('Mobile menu closed via ESC key');
            }
        }
    });

    const loginForm = getElement('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm['login-email'].value;
            const password = loginForm['login-password'].value;
            const errorMsg = getElement('login-error-message');
            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                // admin@site.com은 이메일 인증 예외
                if (email !== 'admin@site.com' && !userCredential.user.emailVerified) {
                    if(errorMsg) errorMsg.textContent = "이메일 인증이 필요합니다. 메일함을 확인해 주세요.";
                    await sendEmailVerification(userCredential.user);
                    await signOut(auth);
                    // 로그인 모달을 닫지 않고, 폼도 reset하지 않음
                    return;
                }
                // Firestore에 사용자 정보가 없으면 최초 로그인 → 정보 저장
                const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
                if (!userDoc.exists()) {
                    await setDoc(doc(db, "users", userCredential.user.uid), {
                        displayName: userCredential.user.displayName || "사용자",
                        email,
                        points: 0,
                        level: "새싹",
                        role: 'user',
                        createdAt: serverTimestamp()
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
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName: name });
                // admin@site.com은 이메일 인증 예외
                if (email !== 'admin@site.com') {
                    await sendEmailVerification(userCredential.user);
                    controlModal('signup-modal', false);
                    signupForm.reset();
                    alert('회원가입이 완료되었습니다! 이메일로 전송된 인증 링크를 확인해 주세요.');
                    await signOut(auth);
                } else {
                    // Firestore에 사용자 정보 저장
                await setDoc(doc(db, "users", userCredential.user.uid), {
                    displayName: name,
                        email,
                    points: 0,
                        level: "새싹",
                        role: 'admin',
                        createdAt: serverTimestamp()
                });
                controlModal('signup-modal', false);
                    signupForm.reset();
                    alert('관리자 계정으로 회원가입이 완료되었습니다!');
                }
            } catch (error) {
                if(errorMsg) errorMsg.textContent = error.code === 'auth/email-already-in-use' ? '이미 사용 중인 이메일입니다.' : "회원가입 중 오류가 발생했습니다.";
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
                await sendPasswordResetEmail(auth, email);
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
                const q = query(collection(db, 'users'), where('displayName', '==', nickname));
                const snapshot = await getDocs(q);
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