import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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
    document.body.classList.toggle('dark-mode', theme === 'dark');
    updateLogos();
}

function toggleTheme() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    updateLogos();
}

function updateLogos() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    const logoSrc = isDarkMode ? 'assets/images/logo_dark.png' : 'assets/images/logo_light.png';
    document.querySelectorAll('.logo img, #mobile-main-logo').forEach(img => {
        if(img) img.src = logoSrc;
    });
}

// 4. UI 업데이트 함수
async function updateAuthUI(user) {
    const mobileAuthSection = document.querySelector('.mobile-auth-section');
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            currentUser = userDoc.exists() ? { uid: user.uid, ...userDoc.data() } : { displayName: user.displayName || "사용자", level: 1 };
            updateUIVisibility(true, currentUser, mobileAuthSection);
        } catch (error) {
            console.error("Error fetching user data:", error);
            updateUIVisibility(false, {}, mobileAuthSection);
        }
    } else {
        currentUser = null;
        updateUIVisibility(false, {}, mobileAuthSection);
    }
}

function updateUIVisibility(isLoggedIn, userData, mobileAuthSection) {
    const userProfile = getElement('user-profile');
    const authButtons = document.querySelector('.auth-buttons');
    const adminPageLink = getElement('admin-page-link');

    if (userProfile) userProfile.style.display = isLoggedIn ? 'flex' : 'none';
    if (authButtons) authButtons.style.display = isLoggedIn ? 'none' : 'flex';

    if (isLoggedIn) {
        if (getElement('user-display-name')) getElement('user-display-name').textContent = userData.displayName;
        if (getElement('user-level')) getElement('user-level').textContent = `Lv.${userData.level}`;
        
        // 관리자일 경우 관리자 페이지 링크 표시
        if (adminPageLink) {
            adminPageLink.style.display = userData.role === 'admin' ? 'inline-block' : 'none';
        }
    } else {
        // 로그아웃 시 관리자 페이지 링크 숨김
        if (adminPageLink) {
            adminPageLink.style.display = 'none';
        }
    }

    if (mobileAuthSection) {
        mobileAuthSection.innerHTML = isLoggedIn ?
            `<div class="mobile-user-profile">
                <span>${userData.displayName}님 (Lv.${userData.level})</span>
                <a href="#" id="mobile-logout-btn" data-action="logout">로그아웃</a>
            </div>` :
            `<button class="button-login" data-action="open-login">로그인</button>
             <button class="button-signup" data-action="open-signup">회원가입</button>`;
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
        'close-modal': () => controlModal(target.closest('.auth-modal').id, false),
        'show-signup': () => { controlModal('login-modal', false); controlModal('signup-modal', true); },
        'show-login': () => { controlModal('signup-modal', false); controlModal('login-modal', true); },
        'toggle-theme': toggleTheme,
        'logout': () => signOut(auth),
        'my-page': () => { if (auth.currentUser) window.location.href = target.href; else alert('로그인이 필요합니다.'); },
        'open-mobile-menu': () => { getElement('mobile-menu')?.classList.add('is-open'); document.body.classList.add('mobile-menu-open'); },
        'close-mobile-menu': () => { getElement('mobile-menu')?.classList.remove('is-open'); document.body.classList.remove('mobile-menu-open'); },
    };

    if (actions[action]) {
        actions[action]();
    }
}

// 6. 초기화 함수
function createMobileMenuIfNeeded() {
    if (getElement('mobile-menu')) return;
    const menu = document.createElement('div');
    menu.id = 'mobile-menu';
    menu.className = 'mobile-menu';
    menu.innerHTML = `
        <div class="mobile-menu-header">
          <a href="index.html" class="logo-container"><img id="mobile-main-logo" src="" alt="Onbit Logo" height="36"/></a>
          <button class="icon-button mobile-menu-close" data-action="close-mobile-menu" aria-label="메뉴 닫기"><i class="fas fa-times"></i></button>
        </div>
        <div class="mobile-auth-section"></div>
        <nav class="mobile-menu-nav">
          <ul>
            <li><a href="affiliated.html">제휴 거래소</a></li>
            <li><a href="community.html">커뮤니티</a></li>
            <li><a href="notice-board.html">공지사항</a></li>
            <li><a href="#" data-action="toggle-theme">테마 변경</a></li>
          </ul>
        </nav>`;
    document.body.appendChild(menu);
}

// 7. 스크립트 실행
onAuthStateChanged(auth, updateAuthUI);

document.addEventListener('DOMContentLoaded', () => {
    createMobileMenuIfNeeded();
    applyTheme();
    document.addEventListener('click', handleGlobalClick);

    const loginForm = getElement('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = loginForm['login-email'].value;
            const password = loginForm['login-password'].value;
            const errorMsg = getElement('login-error-message');
            signInWithEmailAndPassword(auth, email, password)
                .then(() => {
                    controlModal('login-modal', false);
                    loginForm.reset();
                })
                .catch(() => { if(errorMsg) errorMsg.textContent = "이메일 또는 비밀번호가 잘못되었습니다."; });
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

            if (password !== confirmPassword) {
                if(errorMsg) errorMsg.textContent = "비밀번호가 일치하지 않습니다.";
                return;
            }
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName: name });
                await setDoc(doc(db, "users", userCredential.user.uid), {
                    displayName: name, email, level: 1, points: 0, role: 'user', createdAt: serverTimestamp()
                });
                controlModal('signup-modal', false);
                signupForm.reset();
                alert('회원가입이 완료되었습니다!');
            } catch (error) {
                if(errorMsg) errorMsg.textContent = error.code === 'auth/email-already-in-use' ? '이미 사용 중인 이메일입니다.' : "회원가입 중 오류가 발생했습니다.";
            }
        });
    }
});