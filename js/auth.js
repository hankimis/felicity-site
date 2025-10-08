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
    // 프로필 드롭다운 토글
    const myPageLink = document.getElementById('my-page-link');
    const profileDropdown = document.getElementById('profile-dropdown');
    const walletToggle = document.getElementById('wallet-toggle');
    const walletPopover = document.getElementById('header-wallet-popover');
    let profileHoverCloseTimer = null;
    let walletHoverCloseTimer = null;
    if (myPageLink && profileDropdown) {
        myPageLink.addEventListener('click', (e) => {
            // 로그인 상태에서만 드롭다운 토글
            if (window.auth && window.auth.currentUser) {
                e.preventDefault();
                // 전파 차단: 전역 data-action 핸들러에서 my-page 네비게이션되는 문제 방지
                if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
                if (typeof e.stopPropagation === 'function') e.stopPropagation();
                const isHidden = profileDropdown.style.display === 'none' || !profileDropdown.style.display;
                profileDropdown.style.display = isHidden ? 'block' : 'none';
                profileDropdown.setAttribute('aria-hidden', isHidden ? 'false' : 'true');
                // 지갑 팝오버는 동시 열림 방지
                if (walletPopover) { walletPopover.style.display = 'none'; walletPopover.setAttribute('aria-hidden','true'); }
            }
        });

        // 호버로 열기/닫기 (프로필)
        const openProfile = () => {
            if (!(window.auth && window.auth.currentUser)) return;
            clearTimeout(profileHoverCloseTimer);
            profileDropdown.style.display = 'block';
            profileDropdown.setAttribute('aria-hidden','false');
            if (walletPopover) { walletPopover.style.display = 'none'; walletPopover.setAttribute('aria-hidden','true'); }
        };
        const scheduleCloseProfile = () => {
            clearTimeout(profileHoverCloseTimer);
            profileHoverCloseTimer = setTimeout(()=>{
                profileDropdown.style.display = 'none';
                profileDropdown.setAttribute('aria-hidden','true');
            }, 150);
        };
        myPageLink.addEventListener('mouseenter', openProfile);
        myPageLink.addEventListener('mouseleave', scheduleCloseProfile);
        profileDropdown.addEventListener('mouseenter', ()=>{ clearTimeout(profileHoverCloseTimer); });
        profileDropdown.addEventListener('mouseleave', scheduleCloseProfile);

        // 외부 클릭으로 닫기
        document.addEventListener('click', (e) => {
            if (!profileDropdown || profileDropdown.style.display === 'none') return;
            const within = e.target.closest('#profile-dropdown') || e.target.closest('#my-page-link');
            if (!within) {
                profileDropdown.style.display = 'none';
                profileDropdown.setAttribute('aria-hidden', 'true');
            }
        });
    }

    // 알림 토글 버튼 동작: Firestore 알림 미리보기
    const notifToggle = document.getElementById('notif-toggle');
    const notifPopover = document.getElementById('header-notif-popover');
    if (notifToggle && notifPopover && !notifToggle.__notifBound) {
        let notifHoverCloseTimer = null;
        const renderItems = (items=[])=>{
            const list = document.getElementById('notif-list');
            if (!list) return;
            if (!items.length) { list.innerHTML = '<div style="padding:14px; color: var(--text-color-secondary);">새 알림이 없습니다</div>'; return; }
            list.innerHTML = items.map((n)=>{
                const actorName = n.actor?.displayName || '사용자';
                const actorPhoto = n.actor?.photoURL || '';
                let typeText = '활동이 있습니다';
                if (n.type==='like') typeText = '게시글을 좋아합니다';
                if (n.type==='comment') typeText = '댓글을 남겼습니다';
                if (n.type==='comment_like') typeText = '댓글을 좋아합니다';
                if (n.type==='follow') typeText = '회원님을 팔로우했습니다';
                const created = (function(){ try { const d=n.createdAt?.toDate?n.createdAt.toDate(): new Date(n.createdAt); const diff=Date.now()-d.getTime(); const m=Math.floor(diff/60000), h=Math.floor(m/60), day=Math.floor(h/24); if(day>=1) return day+'일 전'; if(h>=1) return h+'시간 전'; if(m>=1) return m+'분 전'; return '방금 전'; } catch(_) { return ''; } })();
                return `<div class="notif-item" data-post="${n.postId||''}" data-actor="${n.actorId||''}">\
                  <div class="avatar" ${actorPhoto?`style="background-image:url('${actorPhoto}')"`:''}></div>\
                  <div>\
                    <div class="meta"><b>${actorName}</b><span>·</span><span>${created}</span></div>\
                    <div class="text">${n.message || (actorName + '님이 ' + typeText)}</div>\
                  </div>\
                </div>`;
            }).join('');
        };
        const fetchItems = async()=>{
            try {
                if (!(window.db && window.auth && window.auth.currentUser)) { renderItems([]); return; }
                const uid = window.auth.currentUser.uid;
                const q = window.db.collection('notifications').where('userId','==',uid).orderBy('createdAt','desc').limit(10);
                const snap = await q.get();
                const arr = [];
                for (const d of snap.docs){
                    const n = { id:d.id, ...d.data() };
                    let actor = {};
                    try { if (n.actorId) { const u = await window.db.collection('users').doc(n.actorId).get(); if (u.exists) actor = u.data(); } } catch(_) {}
                    arr.push({ ...n, actor });
                }
                renderItems(arr);
            } catch(_) { renderItems([]); }
        };
        const openNotif = ()=>{ clearTimeout(notifHoverCloseTimer); fetchItems(); notifPopover.style.display='block'; notifPopover.setAttribute('aria-hidden','false'); if (walletPopover) { walletPopover.style.display='none'; walletPopover.setAttribute('aria-hidden','true'); } if (profileDropdown) { profileDropdown.style.display='none'; profileDropdown.setAttribute('aria-hidden','true'); } };
        const scheduleCloseNotif = ()=>{ clearTimeout(notifHoverCloseTimer); notifHoverCloseTimer = setTimeout(()=>{ notifPopover.style.display='none'; notifPopover.setAttribute('aria-hidden','true'); }, 150); };
        notifToggle.addEventListener('click', (e)=>{ e.preventDefault(); if (typeof e.stopImmediatePropagation==='function') e.stopImmediatePropagation(); if (typeof e.stopPropagation==='function') e.stopPropagation(); const hidden = notifPopover.style.display==='none' || !notifPopover.style.display; if (hidden) openNotif(); else scheduleCloseNotif(); });
        notifToggle.addEventListener('mouseenter', openNotif);
        notifToggle.addEventListener('mouseleave', scheduleCloseNotif);
        notifPopover.addEventListener('mouseenter', ()=>{ clearTimeout(notifHoverCloseTimer); });
        notifPopover.addEventListener('mouseleave', scheduleCloseNotif);
        if (!document.__notifOutsideBound) {
            document.addEventListener('click', (e)=>{ if (!notifPopover || notifPopover.style.display==='none') return; const within = e.target.closest && (e.target.closest('#header-notif-popover') || e.target.closest('#notif-toggle')); if (!within) { notifPopover.style.display='none'; notifPopover.setAttribute('aria-hidden','true'); } });
            document.__notifOutsideBound = true;
        }
        // 내부 항목 클릭 네비게이션
        notifPopover.addEventListener('click', (e)=>{
            const item = e.target.closest && e.target.closest('.notif-item');
            if (!item) return;
            const pid = item.getAttribute('data-post');
            const uid = item.getAttribute('data-actor');
            if (pid) {
                const isLocal = (location.hostname==='localhost'||location.hostname==='127.0.0.1');
                window.location.href = isLocal ? `/feed/post.html?id=${pid}` : `/feed/post/${pid}`;
                return;
            }
            if (uid) {
                const isLocal = (location.hostname==='localhost'||location.hostname==='127.0.0.1');
                window.location.href = isLocal ? `/feed/profile.html?uid=${uid}` : `/feed/profile?uid=${uid}`;
            }
        });
        notifToggle.__notifBound = true;
    }

    // 지갑 토글 버튼 동작: 월렛 페이지 총잔액(tb-amount) 또는 캐시값을 표시
    if (walletToggle && walletPopover) {
        walletToggle.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            const hidden = walletPopover.style.display === 'none' || !walletPopover.style.display;
            // 최신 총액 가져오기: 우선 window.__lastTotalUSDT → 로컬스토리지 폴백
            let total = typeof window.__lastTotalUSDT === 'number' ? window.__lastTotalUSDT : 0;
            try {
                if (!total) {
                    const raw = localStorage.getItem('paperTradingState_v1');
                    if (raw) {
                        const ls = JSON.parse(raw);
                        const bal = Number(ls?.balanceUSDT ?? ls?.state?.balanceUSDT ?? 0);
                        const positions = Array.isArray(ls?.positions) ? ls.positions : (Array.isArray(ls?.state?.positions) ? ls.state.positions : []);
                        const marginSum = positions.reduce((s,p)=> s + Number(p?.margin||0), 0);
                        total = bal + marginSum;
                    }
                }
            } catch(_) {}
            const hw = document.getElementById('hw-amount');
            if (hw) hw.textContent = (Number(total)||0).toLocaleString('en-US', { maximumFractionDigits: 4 });
            walletPopover.style.display = hidden ? 'block' : 'none';
            walletPopover.setAttribute('aria-hidden', hidden ? 'false' : 'true');
            // 프로필 드롭다운은 동시 열림 방지
            if (profileDropdown) { profileDropdown.style.display = 'none'; profileDropdown.setAttribute('aria-hidden','true'); }
        });

        // hw-inner 클릭 시 월렛 페이지로 이동
        document.addEventListener('click', (e)=>{
            const inner = document.getElementById('hw-inner');
            if (inner && inner.contains(e.target)) {
                window.location.href = '/wallet/';
            }
        });

        // 호버로 열기/닫기 (월렛)
        const openWallet = () => {
            clearTimeout(walletHoverCloseTimer);
            // 최신 총액 갱신 (간략 호출)
            try {
                const hw = document.getElementById('hw-amount');
                let total = typeof window.__lastTotalUSDT === 'number' ? window.__lastTotalUSDT : 0;
                if (!total) {
                    const raw = localStorage.getItem('paperTradingState_v1');
                    if (raw) {
                        const ls = JSON.parse(raw);
                        const bal = Number(ls?.balanceUSDT ?? ls?.state?.balanceUSDT ?? 0);
                        const positions = Array.isArray(ls?.positions) ? ls.positions : (Array.isArray(ls?.state?.positions) ? ls.state.positions : []);
                        const marginSum = positions.reduce((s,p)=> s + Number(p?.margin||0), 0);
                        total = bal + marginSum;
                    }
                }
                if (hw) hw.textContent = (Number(total)||0).toLocaleString('en-US', { maximumFractionDigits: 4 });
            } catch(_) {}
            walletPopover.style.display = 'block';
            walletPopover.setAttribute('aria-hidden','false');
            if (profileDropdown) { profileDropdown.style.display = 'none'; profileDropdown.setAttribute('aria-hidden','true'); }
        };
        const scheduleCloseWallet = () => {
            clearTimeout(walletHoverCloseTimer);
            walletHoverCloseTimer = setTimeout(()=>{
                walletPopover.style.display = 'none';
                walletPopover.setAttribute('aria-hidden','true');
            }, 150);
        };
        walletToggle.addEventListener('mouseenter', openWallet);
        walletToggle.addEventListener('mouseleave', scheduleCloseWallet);
        walletPopover.addEventListener('mouseenter', ()=>{ clearTimeout(walletHoverCloseTimer); });
        walletPopover.addEventListener('mouseleave', scheduleCloseWallet);

        // 외부 클릭 닫기
        document.addEventListener('click', (e) => {
            if (!walletPopover || walletPopover.style.display === 'none') return;
            const within = e.target.closest('#header-wallet-popover') || e.target.closest('#wallet-toggle');
            if (!within) {
                walletPopover.style.display = 'none';
                walletPopover.setAttribute('aria-hidden','true');
            }
        });
    }
}

// 전역 노출: 헤더 로더가 주입 직후 안전하게 재초기화할 수 있도록
try { window.initializeHeaderEventListeners = initializeHeaderEventListeners; } catch(_) {}

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
    const myPageLink = document.getElementById('my-page-link');
    const myPageAvatar = document.getElementById('my-page-avatar');
    const myPageIcon = document.getElementById('my-page-icon');
    const profileDropdown = document.getElementById('profile-dropdown');
    const profileAvatar = document.getElementById('profile-dropdown-avatar');
    const profileName = document.getElementById('profile-dropdown-name');
    const profileEmail = document.getElementById('profile-dropdown-email');
    const pipeSep = document.querySelector('.pipe-sep');
    const notifBtn = document.getElementById('notif-toggle');
    const walletBtn = document.getElementById('wallet-toggle');
    const headerDivider = document.querySelector('.header-divider');
    // 모바일 메뉴 항목 참조
    const mProfileLink = document.querySelector('#mobile-menu a[href="/my-account/"]');
    const mWalletLink = document.querySelector('#mobile-menu a[href="/wallet/"]');

    // normalize signup style to match login
    try {
      const signupBtn = document.querySelector('.auth-buttons .signup');
      const loginBtn = document.querySelector('.auth-buttons .login');
      if (signupBtn && loginBtn) {
        signupBtn.classList.add('login');
      }
    } catch(_) {}

    if (user) {
        try {
            const userRef = window.db.collection("users").doc(user.uid);
            const userDoc = await userRef.get();
            const _exists = typeof userDoc.exists === 'function' ? userDoc.exists() : userDoc.exists;
            if (!_exists) {
                try {
                    await userRef.set({
                        displayName: user.displayName || "사용자",
                        email: user.email || null,
                        createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                } catch (_) {}
            }
            currentUser = _exists 
                ? { uid: user.uid, ...userDoc.data() } 
                : { uid: user.uid, displayName: user.displayName || "사용자" };
            window.currentUser = currentUser;

            // 일일 접속 보너스 지급 (매일 최초 접속 시 1000 USDT)
            try {
                if (window.db && user && user.uid) {
                    const todayYmd = new Date().toISOString().slice(0,10);
                    const res = await window.db.runTransaction(async (tx) => {
                        const ref = window.db.collection('users').doc(user.uid);
                        const snap = await tx.get(ref);
                        const data = snap.exists ? snap.data() : {};
                        const pt = data && data.paperTrading || {};
                        const last = pt.lastDailyBonusYmd;
                        if (last === todayYmd) {
                            return { awarded: false, balance: Number(pt.balanceUSDT || 0) };
                        }
                        const prevBal = Number(pt.balanceUSDT || 0);
                        const nextBal = prevBal + 1000;
                        const next = {
                            paperTrading: {
                                balanceUSDT: nextBal,
                                equityUSDT: Number(pt.equityUSDT || nextBal),
                                lastDailyBonusYmd: todayYmd
                            }
                        };
                        tx.set(ref, next, { merge: true });
                        return { awarded: true, balance: nextBal };
                    });
                    // 보너스가 지급되었다면 관련 UI/모듈 동기화
                    if (res && res.awarded) {
                        try { 
                            // 홈 카드 잔고 즉시 갱신
                            const el = document.getElementById('home-usdt-balance');
                            if (el) el.textContent = `${res.balance.toLocaleString()} USDT`;
                        } catch(_) {}
                        try {
                            if (window.paperTrading && typeof window.paperTrading.loadUserBalanceFromFirestore === 'function') {
                                window.paperTrading.loadUserBalanceFromFirestore();
                            }
                        } catch(_) {}
                    }
                }
            } catch (_) {}

            // 로그인 상태 UI 업데이트
            
            if (userProfile) {
                userProfile.style.display = 'flex';
            }
            if (mobileUserProfile) {
                // PC에서는 모바일 요소 숨김 (768px 초과 시)
                if (window.innerWidth <= 768) {
                    mobileUserProfile.style.display = 'flex';
                } else {
                    mobileUserProfile.style.display = 'none';
                }
            }
            if (authButtons) {
                authButtons.style.display = 'none';
            }
            if (pipeSep) pipeSep.style.display = 'none';
            if (notifBtn) notifBtn.style.display = '';
            if (walletBtn) walletBtn.style.display = '';
            if (headerDivider) headerDivider.style.display = '';
            const myLink = document.getElementById('my-page-link');
            if (myLink) myLink.style.display='';
            // 모바일 메뉴 항목 표시
            if (mProfileLink) mProfileLink.style.display = '';
            if (mWalletLink) mWalletLink.style.display = '';
            if (getElement('user-display-name')) {
                getElement('user-display-name').textContent = currentUser.displayName;
            }
            if (getElement('mobile-user-display-name')) {
                getElement('mobile-user-display-name').textContent = currentUser.displayName;
            }

            // 아바타 적용 (Firestore photoURL > Firebase user.photoURL)
            if (myPageLink && myPageAvatar) {
                const avatarUrl = (currentUser && currentUser.photoURL) || (user && user.photoURL) || '';
                if (avatarUrl) {
                    myPageAvatar.src = avatarUrl;
                    myPageAvatar.alt = `${currentUser.displayName || '사용자'}의 프로필 이미지`;
                    myPageAvatar.style.display = 'block';
                    if (myPageLink && !myPageLink.classList.contains('has-avatar')) {
                        myPageLink.classList.add('has-avatar');
                    }
                    if (myPageIcon) {
                        myPageIcon.style.display = 'none';
                    }
                } else {
                    myPageAvatar.removeAttribute('src');
                    myPageAvatar.style.display = 'none';
                    if (myPageLink) {
                        myPageLink.classList.remove('has-avatar');
                    }
                    if (myPageIcon) {
                        myPageIcon.style.display = '';
                    }
                }
            }

            // 드롭다운 사용자 정보 바인딩
            if (profileDropdown) {
                const avatarUrl = (currentUser && currentUser.photoURL) || (user && user.photoURL) || '';
                if (profileAvatar) {
                    if (avatarUrl) {
                        profileAvatar.src = avatarUrl;
                    } else {
                        profileAvatar.removeAttribute('src');
                    }
                }
                if (profileName) profileName.textContent = currentUser.displayName || '사용자';
                if (profileEmail) profileEmail.textContent = currentUser.email || user.email || '';
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
            
            // 모바일 리다이렉트 제거
            
            // 홈 로그인 카드 상태 업데이트
            const homeLoginCard = document.getElementById('home-login-card');
            if (homeLoginCard) {
                const loggedIn = homeLoginCard.querySelector('.logged-in-view');
                const loggedOut = homeLoginCard.querySelector('.logged-out-view');
                if (loggedIn && loggedOut) {
                    loggedIn.style.display = 'block';
                    loggedOut.style.display = 'none';
                    const nameEl = document.getElementById('home-user-name');
                    if (nameEl) nameEl.textContent = currentUser.displayName || '사용자';
                    const emailEl = document.getElementById('home-user-email');
                    if (emailEl) emailEl.textContent = currentUser.email || user.email || '-';
                    // 아바타 적용: Firestore 사용자 문서 photoURL 우선, 없으면 Firebase user.photoURL
                    try {
                        const avatarEl = document.getElementById('home-user-avatar');
                        const url = (currentUser && currentUser.photoURL) || (user && user.photoURL) || '';
                        if (avatarEl) {
                            if (url) {
                                avatarEl.style.backgroundImage = `url('${url}')`;
                            } else {
                                avatarEl.style.backgroundImage = '';
                            }
                            avatarEl.style.display = 'inline-block';
                        }
                    } catch(_) {}
                    // 로그인 시 로그인 헤더 숨김, 잔액/채굴량 표시
                    const loginHeader = homeLoginCard.querySelector('.login-header');
                    if (loginHeader) loginHeader.style.display = 'none';
                    const balanceTabs = document.getElementById('home-balance-tabs');
                    if (balanceTabs) balanceTabs.style.display = '';
                    // Onbit Miner에 사용자 설정 및 UI 구독
                    if (window.onbitMiner) {
                        try {
                            window.onbitMiner.setUser({ uid: currentUser.uid });
                            window.onbitMiner.setExternalControlled(true);
                            window.addEventListener('onbit:balance', (e) => {
                                const onb = (e && e.detail && (typeof e.detail.balance === 'number' ? e.detail.balance : e.detail)) || 0;
                                const onbitEl = document.getElementById('home-onbit-balance');
                                if (onbitEl) onbitEl.textContent = `${Number(onb || 0).toFixed(3)} ONBIT`;
                            }, { once: false });
                            window.onbitMiner.refreshBalance().catch(()=>{});
                        } catch (_) { }
                    }
                    // 지갑 잔액(페이퍼 트레이딩 잔액) 표시: Firestore users.paperTrading.balanceUSDT
                    try {
                        if (window.db && currentUser.uid) {
                            window.db.collection('users').doc(currentUser.uid).get().then((doc)=>{
                                const data = doc.exists ? doc.data() : {};
                                const pt = data && data.paperTrading || {};
                                const bal = Number(pt.balanceUSDT || 0);
                                const el = document.getElementById('home-usdt-balance');
                                if (el) el.textContent = `${bal.toLocaleString()} USDT`;
                                // 서버 초기화 대기 중이면 잠시 후 재확인 (신규 가입 직후)
                                if (el && (!pt || typeof pt.balanceUSDT !== 'number')) {
                                    setTimeout(async () => {
                                        try {
                                            const later = await window.db.collection('users').doc(currentUser.uid).get();
                                            const laterData = later.exists ? later.data() : {};
                                            const laterPt = laterData && laterData.paperTrading || {};
                                            const laterBal = Number(laterPt.balanceUSDT || 0);
                                            if (laterBal) el.textContent = `${laterBal.toLocaleString()} USDT`;
                                        } catch(_) {}
                                    }, 1500);
                                }
                            }).catch(()=>{});
                        }
                    } catch(_) {}
                }
            }

        } catch (error) {
            // 에러 발생 시에도 기본 사용자 정보로 설정
            currentUser = { uid: user.uid, displayName: user.displayName || "사용자" };
            window.currentUser = currentUser;
            
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
            if (pipeSep) pipeSep.style.display = 'inline';
            if (notifBtn) notifBtn.style.display = 'none';
            if (walletBtn) walletBtn.style.display = 'none';
            if (headerDivider) headerDivider.style.display = 'none';
            if (getElement('user-display-name')) getElement('user-display-name').textContent = currentUser.displayName;
            if (getElement('mobile-user-display-name')) getElement('mobile-user-display-name').textContent = currentUser.displayName;
            
            // 모바일 리다이렉트 제거

            // 홈 로그인 카드 상태 업데이트 (fallback)
            const homeLoginCard = document.getElementById('home-login-card');
            if (homeLoginCard) {
                const loggedIn = homeLoginCard.querySelector('.logged-in-view');
                const loggedOut = homeLoginCard.querySelector('.logged-out-view');
                if (loggedIn && loggedOut) {
                    loggedIn.style.display = 'block';
                    loggedOut.style.display = 'none';
                    const nameEl = document.getElementById('home-user-name');
                    if (nameEl) nameEl.textContent = currentUser.displayName || '사용자';
                }
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
        const myLink = document.getElementById('my-page-link');
        if (myLink) myLink.style.display='none';
        if (profileDropdown) { profileDropdown.style.display='none'; profileDropdown.setAttribute('aria-hidden','true'); }
        if (pipeSep) pipeSep.style.display = 'inline';
        if (notifBtn) notifBtn.style.display = 'none';
        if (walletBtn) walletBtn.style.display = 'none';
        if (headerDivider) headerDivider.style.display = 'none';
        // 모바일 메뉴 항목 숨김
        if (mProfileLink) mProfileLink.style.display = 'none';
        if (mWalletLink) mWalletLink.style.display = 'none';

        // 아바타 초기화 (아이콘 노출)
        if (myPageLink) {
            myPageLink.classList.remove('has-avatar');
        }
        if (myPageAvatar) {
            myPageAvatar.removeAttribute('src');
            myPageAvatar.style.display = 'none';
        }
        if (myPageIcon) {
            myPageIcon.style.display = '';
        }

        // 드롭다운 닫기/초기화
        if (profileDropdown) {
            profileDropdown.style.display = 'none';
            profileDropdown.setAttribute('aria-hidden', 'true');
        }
        
        // 사용자 데이터 새로고침 중지
        stopUserDataRefresh();

        // 홈 로그인 카드 상태 업데이트
        const homeLoginCard = document.getElementById('home-login-card');
        if (homeLoginCard) {
            const loggedIn = homeLoginCard.querySelector('.logged-in-view');
            const loggedOut = homeLoginCard.querySelector('.logged-out-view');
            if (loggedIn && loggedOut) {
                loggedIn.style.display = 'none';
                loggedOut.style.display = 'block';
                // 로그아웃 시 헤더/밸런스 영역 초기화
                const loginHeader = homeLoginCard.querySelector('.login-header');
                if (loginHeader) loginHeader.style.display = '';
                const balanceRow = document.getElementById('home-balance-row');
                if (balanceRow) balanceRow.style.display = 'none';
                const onbitEl = document.getElementById('home-onbit-balance');
                if (onbitEl) onbitEl.textContent = '-';
                const usdtEl = document.getElementById('home-usdt-balance');
                if (usdtEl) usdtEl.textContent = '-';
            }
        }
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
            if (!window.auth.currentUser) {
                alert('로그인이 필요합니다.');
                return;
            }
            // 드롭다운이 있으면 네비게이션 대신 토글
            const dropdown = document.getElementById('profile-dropdown');
            if (dropdown) {
                const isHidden = dropdown.style.display === 'none' || !dropdown.style.display;
                dropdown.style.display = isHidden ? 'block' : 'none';
                dropdown.setAttribute('aria-hidden', isHidden ? 'false' : 'true');
                return;
            }
            // 드롭다운이 없을 때만 이동
            window.location.href = target.href;
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