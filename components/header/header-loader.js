document.addEventListener('DOMContentLoaded', () => {
    let headerPlaceholder = document.getElementById('header-placeholder');
    // If the placeholder is missing, create and inject it at the very top of <body>
    if (!headerPlaceholder) {
        headerPlaceholder = document.createElement('div');
        headerPlaceholder.id = 'header-placeholder';
        document.body.insertBefore(headerPlaceholder, document.body.firstChild);
    }

    // 현재 경로에 따라 헤더 파일 경로 결정
    const currentPath = window.location.pathname;
    
    // 경로별 헤더 파일 경로 결정
    let headerPath = 'components/header/header.html'; // 기본값
    
    // 1단계 하위 디렉토리 (/event/, /community/, /bitcoin/, /login/, /signup/ 등)
    if (currentPath.includes('/event/') || currentPath.includes('/event-board/') || 
        currentPath.includes('/community/') || currentPath.includes('/news/') || 
        currentPath.includes('/affiliated/') || currentPath.includes('/notice-board/') || 
        currentPath.includes('/my-account/') || currentPath.includes('/admin/') ||
        currentPath.includes('/bitcoin/') || currentPath.includes('/login/') ||
        currentPath.includes('/signup/')) {
        headerPath = '../components/header/header.html';
    }
    
    // asset 디렉토리는 2단계 하위 디렉토리로 처리
    if (currentPath.includes('/asset/')) {
        headerPath = '../../components/header/header.html';
    }
    
    // 2단계 하위 디렉토리 (/affiliated/exchange-guide/, /affiliated/payback-calculator/, /currencies/bitcoin/ 등)
    if (currentPath.includes('/affiliated/exchange-guide/') || 
        currentPath.includes('/affiliated/payback-calculator/') ||
        currentPath.includes('/affiliated/bitget/') ||
        currentPath.includes('/affiliated/bitmex/') ||
        currentPath.includes('/affiliated/lbank/') ||
        currentPath.includes('/affiliated/okx/') ||
        currentPath.includes('/currencies/bitcoin/')) {
        headerPath = '../../components/header/header.html';
    }
    
    // 3단계 하위 디렉토리 (/affiliated/exchange-guide/bitget-guide/ 등)
    if (currentPath.includes('/affiliated/exchange-guide/bitget-guide/') ||
        currentPath.includes('/affiliated/exchange-guide/bitmex-guide/') ||
        currentPath.includes('/affiliated/exchange-guide/lbank-guide/')) {
        headerPath = '../../../components/header/header.html';
    }
    
    // 4단계 하위 디렉토리 (/affiliated/exchange-guide/bitget-guide/kyc/ 등)
    if (currentPath.includes('/affiliated/exchange-guide/bitget-guide/kyc/') ||
        currentPath.includes('/affiliated/exchange-guide/bitget-guide/regi/') ||
        currentPath.includes('/affiliated/exchange-guide/bitget-guide/trade/')) {
        headerPath = '../../../../components/header/header.html';
    }
    
    console.log(`Header loader: Current path: ${currentPath}, Header path: ${headerPath}`);
    
    // Font Awesome 로드 확인
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const fontAwesomeLink = document.createElement('link');
        fontAwesomeLink.rel = 'stylesheet';
        fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
        document.head.appendChild(fontAwesomeLink);
    }
    
    fetch(headerPath)
        .then(response => {
            if (!response.ok) {
                console.error(`Header fetch failed: ${response.status} ${response.statusText}`);
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
            console.warn(`Removed ${navbars.length - 1} legacy navbar element(s).`);
        }
        ['login-modal', 'signup-modal'].forEach(id => {
            const duplicates = document.querySelectorAll(`#${id}`);
            if (duplicates.length > 1) {
                // Keep the first (the one we just inserted) and remove the rest
                duplicates.forEach((el, idx) => {
                    if (idx !== 0) el.remove();
                });
                console.warn(`Removed ${duplicates.length - 1} duplicate element(s) with id #${id}.`);
            }
        });
        
        // Remove duplicate top-bars
        const topBars = document.querySelectorAll('div.top-bar');
        if (topBars.length > 1) {
            topBars.forEach((el, idx) => {
                if (idx !== 0) el.remove();
            });
            console.warn(`Removed ${topBars.length - 1} legacy top-bar element(s).`);
        }
            
            // 헤더가 로드되면 즉시 표시
            const mainHeader = document.getElementById('main-header');
            if (mainHeader) {
                mainHeader.style.opacity = '1';
                console.log("Header loaded and displayed successfully.");
            }
            
            // 1. Start the main authentication and header logic (if startApp exists)
            if (typeof startApp === 'function') {
                try {
                    await startApp(); // Wait for firebase etc. to be ready
                    console.log("Header loader: Main app started.");
                    
                    // Attach auth form handlers now that header/DOM elements exist
                    if (typeof window.bindAuthForms === 'function') {
                        window.bindAuthForms();
                    }
                    
                    // Firebase 초기화 후 현재 인증 상태 확인
                    if (window.auth && typeof window.updateAuthUI === 'function') {
                        const currentUser = window.auth.currentUser;
                        console.log("Header loader: Checking current auth state:", currentUser ? 'logged in' : 'logged out');
                        window.updateAuthUI(currentUser);
                    }
                    
                    // TurnstileManager가 모든 이벤트 처리 - 별도 설정 불필요
                    console.log("Header loader: TurnstileManager에서 모든 Turnstile 처리");
                } catch (error) {
                    console.error('startApp 실행 중 오류:', error);
                }
            } else {
                console.log('startApp function not found - continuing without Firebase initialization.');
                
                // startApp이 없어도 인증 폼 바인딩 시도
                if (typeof window.bindAuthForms === 'function') {
                    window.bindAuthForms();
                }
            }

            // 2. Run page-specific logic if it exists
            if (typeof initializePage === 'function') {
                console.log("Header loader: Initializing page-specific script.");
                try {
                    initializePage();
                } catch (error) {
                    console.error('initializePage 실행 중 오류:', error);
                }
            } else {
                console.log("Header loader: No page-specific script (initializePage) found.");
            }
        })
        .catch(error => {
            console.error('Error fetching or initializing header:', error);
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