import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- 전역 변수 및 DOM 요소 ---
const getElement = (id) => document.getElementById(id);

/**
 * 테마 초기화 및 적용
 */
function applyTheme() {
    const themeToggle = getElement('theme-toggle');
    const theme = localStorage.getItem('theme');
    const body = document.body;
    const icon = themeToggle?.querySelector('i');
    
    if (theme === 'dark-mode') {
        body.classList.add('dark-mode');
        if (icon) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    } else {
        body.classList.remove('dark-mode');
        if (icon) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }
}

/**
 * 테마 토글
 */
function toggleTheme() {
    const body = document.body;
    const themeToggle = getElement('theme-toggle');
    const icon = themeToggle?.querySelector('i');
    const isDarkMode = !body.classList.contains('dark-mode');
    
    body.classList.toggle('dark-mode');
    if (isDarkMode) {
        if (icon) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
        localStorage.setItem('theme', 'dark-mode');
    } else {
        if (icon) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
        localStorage.removeItem('theme');
    }
    
    // 차트 테마 동기화 이벤트 발생
    document.body.dispatchEvent(new CustomEvent('themeChanged', { 
        detail: { isDarkMode: body.classList.contains('dark-mode') } 
    }));
}

/**
 * 모달 제어
 */
function controlModal(modalId, show) {
    const modal = getElement(modalId);
    if (modal) {
        modal.style.display = show ? 'block' : 'none';
        // 모달이 열릴 때 body 스크롤 방지
        document.body.style.overflow = show ? 'hidden' : '';
    }
}

/**
 * 인증 상태에 따른 UI 업데이트
 */
async function updateAuthUI(user) {
    const authButtons = document.querySelector('.auth-buttons');
    const userProfile = getElement('user-profile');
    const mobileAuthSection = document.querySelector('.mobile-auth-section');

    if (user) {
        if (authButtons) authButtons.style.display = 'none';
        if (userProfile) {
            userProfile.style.display = 'flex';
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.exists() ? userDoc.data() : { displayName: user.displayName, level: 1 };
            const displayNameEl = getElement('user-display-name');
            const userLevelEl = getElement('user-level');
            if (displayNameEl) displayNameEl.textContent = userData.displayName;
            if (userLevelEl) userLevelEl.textContent = `Lv.${userData.level}`;
        }
    } else {
        if (authButtons) authButtons.style.display = 'flex';
        if (userProfile) userProfile.style.display = 'none';
    }

    if (mobileAuthSection) {
        if (user) {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.exists() ? userDoc.data() : { level: 1, displayName: user.displayName };
            mobileAuthSection.innerHTML = `
                <div class="mobile-menu-user">
                  <div class="mobile-user-profile-info">
                    <span class="level-badge">Lv.${userData.level}</span>
                    <span class="mobile-user-display-name">${userData.displayName}</span>
                  </div>
                  <button type="button" class="mobile-menu-link" data-action="my-page">
                    <i class="fas fa-user-circle"></i> 마이페이지
                  </button>
                  <button type="button" class="mobile-menu-logout-btn" data-action="logout">
                    <i class="fas fa-sign-out-alt"></i> 로그아웃
                  </button>
                </div>`;
        } else {
            mobileAuthSection.innerHTML = `
                <div class="mobile-menu-auth row-btns">
                    <button type="button" data-action="open-login" class="mobile-auth-btn login">
                        <i class="fas fa-sign-in-alt"></i> 로그인
                    </button>
                    <button type="button" data-action="open-signup" class="mobile-auth-btn signup">
                        <i class="fas fa-user-plus"></i> 회원가입
                    </button>
                </div>`;
        }
    }
}

/**
 * 전역 클릭 이벤트 핸들러 (이벤트 위임)
 */
function handleGlobalClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    e.preventDefault();

    switch (action) {
        case 'open-login':
            controlModal('login-modal', true);
            break;
        case 'open-signup':
            controlModal('signup-modal', true);
            break;
        case 'close-modal':
            controlModal(target.closest('.auth-modal').id, false);
            break;
        case 'show-signup':
            controlModal('login-modal', false);
            controlModal('signup-modal', true);
            break;
        case 'show-login':
            controlModal('signup-modal', false);
            controlModal('login-modal', true);
            break;
        case 'toggle-theme':
            toggleTheme();
            break;
        case 'logout':
            signOut(auth);
            break;
        case 'my-page':
            if (!auth.currentUser) {
                alert('로그인이 필요합니다.');
            } else {
                window.location.href = target.href;
            }
            break;
        case 'open-mobile-menu':
            getElement('mobile-menu')?.classList.add('is-open');
            document.body.classList.add('mobile-menu-open');
            break;
        case 'close-mobile-menu':
            getElement('mobile-menu')?.classList.remove('is-open');
            document.body.classList.remove('mobile-menu-open');
            break;
        case 'toggle-mobile-dropdown':
            const dropdownMenu = document.querySelector('.mobile-dropdown-menu');
            if (dropdownMenu) {
                dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
            }
            break;
    }
}

/**
 * 폼 제출 리스너 설정
 */
function setupFormListeners() {
    const loginForm = getElement('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            // 로그인 로직...
            const email = loginForm['login-email'].value;
            const password = loginForm['login-password'].value;
            const errorMsg = getElement('login-error-message');
            try {
                await signInWithEmailAndPassword(auth, email, password);
                controlModal('login-modal', false);
            } catch (error) {
                if(errorMsg) errorMsg.textContent = "이메일 또는 비밀번호가 잘못되었습니다.";
            }
        });
    }

    const signupForm = getElement('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            // 회원가입 로직...
            const name = signupForm['signup-name'].value;
            const email = signupForm['signup-email'].value;
            const password = signupForm['signup-password'].value;
            const confirmPassword = signupForm['signup-confirm-password'].value;
            const errorMsg = getElement('signup-error-message');

            if (password !== confirmPassword) {
                if(errorMsg) errorMsg.textContent = "비밀번호가 일치하지 않습니다.";
                return;
            }
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName: name });
                await setDoc(doc(db, "users", userCredential.user.uid), {
                    displayName: name,
                    email: email,
                    level: 1,
                    points: 0,
                    role: 'user',
                    createdAt: new Date()
                });
                controlModal('signup-modal', false);
            } catch (error) {
                if(errorMsg) errorMsg.textContent = "회원가입 중 오류가 발생했습니다.";
            }
        });
    }
}

/**
 * 클릭 가능한 요소에 data-action 속성 설정
 */
function setDataActions() {
    const actions = {
        '.login': 'open-login',
        '.signup': 'open-signup',
        '.auth-modal-close': 'close-modal',
        '#show-signup': 'show-signup',
        '#show-login': 'show-login',
        '#theme-toggle': 'toggle-theme',
        '#mobile-theme-toggle': 'toggle-theme',
        '#logout-btn': 'logout',
        '#my-page-link': 'my-page',
        '#mobile-menu-button': 'open-mobile-menu',
        '.mobile-menu-close': 'close-mobile-menu',
        '.mobile-dropdown-toggle': 'toggle-mobile-dropdown'
    };

    for (const selector in actions) {
        document.querySelectorAll(selector).forEach(el => el.dataset.action = actions[selector]);
    }
}

/**
 * 모바일 메뉴 생성 (필요한 경우)
 */
function createMobileMenuIfNeeded() {
    if (getElement('mobile-menu')) return;

    const menu = document.createElement('div');
    menu.id = 'mobile-menu';
    menu.className = 'mobile-menu';
    menu.innerHTML = `
        <div class="mobile-menu-header">
          <a href="index.html" class="logo"><img id="mobile-main-logo" src="assets/lightlogo.png" alt="Onbit Logo" height="36"/></a>
          <button class="icon-button mobile-menu-close" data-action="close-mobile-menu" aria-label="메뉴 닫기"><i class="fas fa-times"></i></button>
        </div>
        <div class="mobile-auth-section"></div>
        <nav class="mobile-menu-nav">
          <ul>
            <li><a href="affiliated.html">제휴 거래소</a></li>
            <li><a href="community.html">실시간 채팅</a></li>
            <li class="mobile-dropdown">
              <a href="#" class="mobile-dropdown-toggle" data-action="toggle-mobile-dropdown">커뮤니티 <i class="fas fa-caret-down"></i></a>
              <ul class="mobile-dropdown-menu" style="display: none;">
                <li><a href="community-board.html">자유 게시판</a></li>
                <li><a href="attendance.html">출석체크</a></li>
              </ul>
            </li>
            <li><a href="notice-board.html">공지사항</a></li>
          </ul>
        </nav>`;
    document.body.appendChild(menu);
}

// --- 스크립트 실행 ---

// 인증 상태 변화 감지
onAuthStateChanged(auth, updateAuthUI);

// DOM 로드 후 초기화
document.addEventListener('DOMContentLoaded', () => {
    createMobileMenuIfNeeded();
    applyTheme();
    setDataActions();
    document.addEventListener('click', handleGlobalClick);
    setupFormListeners();

    // 모바일 메뉴 로고도 테마에 따라 변경
    function updateMobileLogoByTheme() {
      const logoImg = document.getElementById('mobile-main-logo');
      if (!logoImg) return;
      const isDark = document.body.classList.contains('dark-mode');
      logoImg.src = isDark ? 'assets/darklogo.png' : 'assets/lightlogo.png';
    }
    updateMobileLogoByTheme();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateMobileLogoByTheme);
    const observer = new MutationObserver(updateMobileLogoByTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}); 