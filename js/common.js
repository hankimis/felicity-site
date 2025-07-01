// 공통 헤더 로드 함수
async function loadCommonHead() {
    try {
        const response = await fetch('common-head.html');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const content = await response.text();
        
        // HTML 파싱
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        
        // 스크립트와 스타일시트 추가
        const promises = [];
        
        doc.querySelectorAll('script, link[rel="stylesheet"]').forEach(node => {
            const element = document.createElement(node.tagName);
            
            // 속성 복사
            Array.from(node.attributes).forEach(attr => {
                element.setAttribute(attr.name, attr.value);
            });
            
            // 인라인 스크립트인 경우 내용 복사
            if (node.tagName === 'SCRIPT' && !node.src) {
                element.textContent = node.textContent;
            }
            
            // 스크립트 로딩 완료 대기
            if (node.tagName === 'SCRIPT' && node.src) {
                const promise = new Promise((resolve, reject) => {
                    element.onload = resolve;
                    element.onerror = reject;
                });
                promises.push(promise);
            }
            
            document.head.appendChild(element);
        });
        
        // 모든 스크립트 로딩 완료 대기
        await Promise.all(promises);
        console.log('공통 헤더 로드 완료');
        
    } catch (error) {
        console.error('공통 헤더 로드 중 오류 발생:', error);
        // 5초 후 재시도
        setTimeout(loadCommonHead, 5000);
    }
}

// 페이지 로드 시 공통 헤더 로드
document.addEventListener('DOMContentLoaded', loadCommonHead);

// 공통 기능들을 담당하는 스크립트

// 모바일 메뉴 관련 기능
function setupMobileMenu() {
    const body = document.body;
    const menuButton = document.getElementById('mobile-menu-button');
    const closeButton = document.getElementById('mobile-menu-close');
    const mobileMenu = document.getElementById('mobile-menu');

    if (menuButton && mobileMenu) {
        menuButton.addEventListener('click', () => {
            mobileMenu.classList.add('is-open');
            body.classList.add('mobile-menu-open');
        });
    }

    if (closeButton && mobileMenu) {
        closeButton.addEventListener('click', () => {
            mobileMenu.classList.remove('is-open');
            body.classList.remove('mobile-menu-open');
        });
    }
}

// 테마 관련 기능 - auth.js에서 처리하므로 제거

// 드롭다운 메뉴 관련 기능
function setupDropdowns() {
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    if (dropdownToggle) {
        dropdownToggle.addEventListener('click', (e) => {
            e.preventDefault();
            const dropdown = e.currentTarget.closest('.dropdown');
            if (dropdown) {
                dropdown.classList.toggle('open');
            }
        });
    }

    // 문서의 다른 곳을 클릭하면 드롭다운 닫기
    document.addEventListener('click', (e) => {
        const dropdown = document.querySelector('.dropdown.open');
        if (dropdown && !dropdown.contains(e.target)) {
            dropdown.classList.remove('open');
        }
    });
}

// 공통 이벤트 리스너 설정
function setupCommonEventListeners() {
    setupMobileMenu();
    setupDropdowns();
}

// 페이지 로드 시 공통 기능 초기화
document.addEventListener('DOMContentLoaded', () => {
    setupCommonEventListeners();
});

console.log('Common.js loaded successfully'); 