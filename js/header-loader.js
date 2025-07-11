document.addEventListener('DOMContentLoaded', () => {
    let headerPlaceholder = document.getElementById('header-placeholder');
    // If the placeholder is missing, create and inject it at the very top of <body>
    if (!headerPlaceholder) {
        headerPlaceholder = document.createElement('div');
        headerPlaceholder.id = 'header-placeholder';
        document.body.insertBefore(headerPlaceholder, document.body.firstChild);
    }

    // FOUC 방지: 초기 로딩 상태 설정
    const authLoading = document.getElementById('auth-loading');
    if (authLoading) {
        authLoading.style.display = 'flex';
    }

    // 현재 경로에 따라 헤더 파일 경로 결정
    const currentPath = window.location.pathname;
    
    // 경로별 헤더 파일 경로 결정
    let headerPath = '_header.html'; // 기본값
    
    // 1단계 하위 디렉토리 (/event/, /community/, /bitcoin/ 등)
    if (currentPath.includes('/event/') || currentPath.includes('/event-board/') || 
        currentPath.includes('/community/') || currentPath.includes('/news/') || 
        currentPath.includes('/affiliated/') || currentPath.includes('/notice-board/') || 
        currentPath.includes('/my-account/') || currentPath.includes('/admin/') ||
        currentPath.includes('/bitcoin/')) {
        headerPath = '../_header.html';
    }
    
    // 2단계 하위 디렉토리 (/affiliated/exchange-guide/, /affiliated/payback-calculator/, /currencies/bitcoin/ 등)
    if (currentPath.includes('/affiliated/exchange-guide/') || 
        currentPath.includes('/affiliated/payback-calculator/') ||
        currentPath.includes('/affiliated/bitget/') ||
        currentPath.includes('/affiliated/bitmex/') ||
        currentPath.includes('/affiliated/lbank/') ||
        currentPath.includes('/affiliated/okx/') ||
        currentPath.includes('/currencies/bitcoin/')) {
        headerPath = '../../_header.html';
    }
    
    // 3단계 하위 디렉토리 (/affiliated/exchange-guide/bitget-guide/ 등)
    if (currentPath.includes('/affiliated/exchange-guide/bitget-guide/') ||
        currentPath.includes('/affiliated/exchange-guide/bitmex-guide/') ||
        currentPath.includes('/affiliated/exchange-guide/lbank-guide/')) {
        headerPath = '../../../_header.html';
    }
    
    // 4단계 하위 디렉토리 (/affiliated/exchange-guide/bitget-guide/kyc/ 등)
    if (currentPath.includes('/affiliated/exchange-guide/bitget-guide/kyc/') ||
        currentPath.includes('/affiliated/exchange-guide/bitget-guide/regi/') ||
        currentPath.includes('/affiliated/exchange-guide/bitget-guide/trade/')) {
        headerPath = '../../../../_header.html';
    }
    
    console.log(`Header loader: Current path: ${currentPath}, Header path: ${headerPath}`);
    
    fetch(headerPath)
        .then(response => {
            if (!response.ok) throw new Error('Could not load header.');
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
            
            // 1. Start the main authentication and header logic
            if (typeof startApp === 'function') {
                await startApp(); // Wait for firebase etc. to be ready
                console.log("Header loader: Main app started.");
            // Attach auth form handlers now that header/DOM elements exist
            if (typeof window.bindAuthForms === 'function') {
                window.bindAuthForms();
            }
            
            // TurnstileManager가 모든 이벤트 처리 - 별도 설정 불필요
            console.log("Header loader: TurnstileManager에서 모든 Turnstile 처리");
            } else {
                console.error('startApp function not found!');
                // FOUC 방지: startApp이 없어도 헤더는 표시
                const mainHeader = document.getElementById('main-header');
                const authLoading = document.getElementById('auth-loading');
                if (mainHeader && authLoading) {
                    authLoading.style.opacity = '0';
                    setTimeout(() => {
                        authLoading.style.display = 'none';
                    }, 300);
                    mainHeader.style.opacity = '1';
                }
                return;
            }

            // 2. Run page-specific logic if it exists
            if (typeof initializePage === 'function') {
                console.log("Header loader: Initializing page-specific script.");
                initializePage();
            } else {
                console.log("Header loader: No page-specific script (initializePage) found.");
            }
        })
        .catch(error => {
            console.error('Error fetching or initializing header:', error);
            headerPlaceholder.innerHTML = '<p style="color: red; text-align: center;">Error loading header.</p>';
            
            // 에러 발생 시에도 로딩 상태 해제
            const authLoading = document.getElementById('auth-loading');
            if (authLoading) {
                authLoading.style.opacity = '0';
                setTimeout(() => {
                    authLoading.style.display = 'none';
                }, 300);
            }
        });
}); 