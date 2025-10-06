document.addEventListener('DOMContentLoaded', () => {
    let headerPlaceholder = document.getElementById('header-placeholder');
    // If the placeholder is missing, create and inject it at the very top of <body>
    if (!headerPlaceholder) {
        headerPlaceholder = document.createElement('div');
        headerPlaceholder.id = 'header-placeholder';
        document.body.insertBefore(headerPlaceholder, document.body.firstChild);
    }

    // 헤더 파일 경로: 절대 경로로 고정 (라우팅 영향 제거)
    const headerPath = '/components/header/header.html';
    
    // Font Awesome 로드 확인
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const fontAwesomeLink = document.createElement('link');
        fontAwesomeLink.rel = 'stylesheet';
        fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
        document.head.appendChild(fontAwesomeLink);
    }

    // 방문 집계 스크립트 전역 로드 (절대 경로)
    try {
        const existingVisitTracker = document.querySelector('script[src="/js/visit-tracker.js"]');
        if (!existingVisitTracker) {
            const visitTracker = document.createElement('script');
            visitTracker.type = 'module';
            visitTracker.src = '/js/visit-tracker.js';
            document.head.appendChild(visitTracker);
        }
    } catch (e) {
        // 로드 실패 시 조용히 무시 (핵심 기능 아님)
    }
    
    fetch(headerPath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Could not load header: ${response.status}`);
            }
            return response.text();
        })
        .then(async (data) => {
            headerPlaceholder.innerHTML = data;
        
        /* Remove any legacy header / modal instances that may already exist in the page */
        const navbars = document.querySelectorAll('header.navbar');
        if (navbars.length > 1) {
            navbars.forEach((el, idx) => {
                if (idx !== 0) el.remove();
            });

        }
        ['login-modal', 'signup-modal'].forEach(id => {
            const duplicates = document.querySelectorAll(`#${id}`);
            if (duplicates.length > 1) {
                // Keep the first (the one we just inserted) and remove the rest
                duplicates.forEach((el, idx) => {
                    if (idx !== 0) el.remove();
                });

            }
        });
        
        // Remove duplicate top-bars
        const topBars = document.querySelectorAll('div.top-bar');
        if (topBars.length > 1) {
            topBars.forEach((el, idx) => {
                if (idx !== 0) el.remove();
            });

        }
            
            // 헤더가 로드되면 즉시 표시
            const mainHeader = document.getElementById('main-header');
            if (mainHeader) {
                mainHeader.style.opacity = '1';
            }
            // 모바일 메뉴 시트 이벤트 바인딩
            try {
                const btn = document.getElementById('mobile-menu-button');
                const sheet = document.getElementById('mobile-menu');
                const overlay = document.getElementById('mobile-menu-overlay');
                const closeBtn = document.getElementById('mobile-menu-close');
                function open(){ if(sheet){ sheet.style.display='block'; requestAnimationFrame(()=> sheet.classList.add('is-open')); } }
                function close(){ if(sheet){ sheet.classList.remove('is-open'); setTimeout(()=>{ sheet.style.display='none'; }, 220); } }
                if (btn && sheet && overlay && closeBtn){
                    btn.addEventListener('click', function(){
                      if (sheet.classList && sheet.classList.contains('is-open')) close(); else open();
                    });
                    overlay.addEventListener('click', close);
                    closeBtn.addEventListener('click', close);
                    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') close(); });
                }
            } catch(_) {}
            // 현재 경로에 맞춰 활성 메뉴 강조
            const path = window.location.pathname.replace(/\/index\.html$/, '/');
            document.querySelectorAll('.desktop-nav a').forEach(a => {
                const href = a.getAttribute('href');
                if (!href) return;
                // 매핑: 섹션 루트 매치
                if (href === '/' && (path === '/' || path === '/index.html')) {
                    a.classList.add('active');
                } else if (href !== '/' && path.startsWith(href)) {
                    a.classList.add('active');
                }
            });
            
            // 1. Start the main authentication and header logic
            async function ensureAuthScript() {
                // 이미 초기화된 경우 재주입 금지 (중복 선언 오류 방지)
                if ((window.auth && window.db) || typeof startApp === 'function') return true;
                try {
                    // 이미 어떤 경로로든 auth.js가 포함되어 있는지 탐지 (상대/절대 모두)
                    const anyAuth = document.querySelector('script[src$="/auth.js"], script[src*="/js/auth.js"], script[src$="auth.js"]');
                    if (anyAuth) {
                        let tries = 0; const max = 50;
                        await new Promise((res)=>{
                            (function wait(){
                                if ((window.auth && window.db) || typeof startApp === 'function' || tries++ > max) return res();
                                setTimeout(wait, 100);
                            })();
                        });
                        if ((window.auth && window.db) || typeof startApp === 'function') return true;
                    }
                    // 우선 `/js/auth.js`만 시도 (startApp 제공)
                    await new Promise((resolve)=>{
                        const s = document.createElement('script');
                        s.src = '/js/auth.js';
                        s.async = true;
                        s.onload = resolve; s.onerror = resolve;
                        document.head.appendChild(s);
                    });
                    return (window.auth && window.db) || (typeof startApp === 'function');
                } catch (_) { return false; }
            }

            try {
                if (!(typeof startApp === 'function')) {
                    await ensureAuthScript();
                }
                if (typeof startApp === 'function') {
                    await startApp(); // Wait for firebase etc. to be ready
                }

                // Attach auth form handlers now that header/DOM elements exist
                if (typeof window.bindAuthForms === 'function') {
                    window.bindAuthForms();
                }
                
                // Firebase 초기화 후 현재 인증 상태 확인
                if (window.auth && typeof window.updateAuthUI === 'function') {
                    const currentUser = window.auth.currentUser;
                    window.updateAuthUI(currentUser);
                }
                
                // 헤더 DOM이 준비된 직후 이벤트 리스너 강제 초기화 (안전장치)
                if (typeof window.initializeHeaderEventListeners === 'function') {
                    try { window.initializeHeaderEventListeners(); } catch (_) {}
                }
                
                // TurnstileManager가 모든 이벤트 처리 - 별도 설정 불필요
            } catch (error) {
            }

            // 추가 안전 동기화: 초기 몇 초 동안 인증 상태에 맞춰 버튼 토글 보정
            (function ensureHeaderAuthSync(){
                let attempts = 0; const max = 30; // 약 6초
                const iv = setInterval(()=>{
                    attempts++;
                    try {
                        const user = (window.auth && window.auth.currentUser) || null;
                        if (typeof window.updateAuthUI === 'function') {
                            window.updateAuthUI(user);
                        } else {
                            const authButtons = document.querySelector('.auth-buttons');
                            const myPageLink = document.getElementById('my-page-link');
                            const notifBtn = document.getElementById('notif-toggle');
                            const walletBtn = document.getElementById('wallet-toggle');
                            const headerDivider = document.querySelector('.header-divider');
                            const pipeSep = document.querySelector('.pipe-sep');
                            const profileDropdown = document.getElementById('profile-dropdown');
                            if (authButtons) authButtons.style.display = user ? 'none' : 'flex';
                            if (myPageLink) myPageLink.style.display = user ? '' : 'none';
                            if (notifBtn) notifBtn.style.display = user ? '' : 'none';
                            if (walletBtn) walletBtn.style.display = user ? '' : 'none';
                            if (headerDivider) headerDivider.style.display = user ? '' : 'none';
                            if (pipeSep) pipeSep.style.display = user ? 'inline' : 'inline';
                            if (!user && profileDropdown) { profileDropdown.style.display='none'; profileDropdown.setAttribute('aria-hidden','true'); }
                        }
                        // 사용자가 결정되면 조기 종료
                        if (user || attempts >= max) clearInterval(iv);
                    } catch(_) {
                        if (attempts >= max) clearInterval(iv);
                    }
                }, 200);
            })();

            // 2. Run page-specific logic if it exists
            if (typeof initializePage === 'function') {
                try {
                    initializePage();
                } catch (error) {
                }
            }
            
            // 최종 안전장치: 약간의 지연 후 한 번 더 이벤트 리스너/인증 UI 동기화
            setTimeout(()=>{
                try {
                    if (typeof window.initializeHeaderEventListeners === 'function') {
                        window.initializeHeaderEventListeners();
                    }
                } catch(_) {}
                try {
                    if (typeof window.updateAuthUI === 'function') {
                        const user = (window.auth && window.auth.currentUser) || null;
                        window.updateAuthUI(user);
                    }
                } catch(_) {}
            }, 250);
        })
        .catch(error => {
            headerPlaceholder.innerHTML = `
                <div style="
                    background: #1a1a1a; 
                    color: #ffffff; 
                    padding: 20px; 
                    text-align: center; 
                    border-bottom: 1px solid #333;
                    height: 60px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <a href="/index.html" style="color: #ffffff; text-decoration: none; font-weight: bold;">
                        Onbit
                    </a>
                </div>
            `;
        });
}); 