// 풋터 로더
document.addEventListener('DOMContentLoaded', function() {
    loadFooter();
});

async function loadFooter() {
    try {
        const footerPlaceholder = document.getElementById('footer-placeholder');
        if (!footerPlaceholder) {
            // footer-placeholder가 없으면 body 끝에 추가
            const placeholder = document.createElement('div');
            placeholder.id = 'footer-placeholder';
            document.body.appendChild(placeholder);
        }
        
        // 현재 페이지의 경로에 따라 footer 경로 결정
        const currentPath = window.location.pathname;
        let footerPath = '/_footer.html';
        
        // 하위 디렉토리에 있는 경우 상위 경로로 조정
        if (currentPath.includes('/bitcoin/') || 
            currentPath.includes('/affiliated/') || 
            currentPath.includes('/community/') || 
            currentPath.includes('/news/') || 
            currentPath.includes('/event/') || 
            currentPath.includes('/notice-board/') || 
            currentPath.includes('/my-account/')) {
            footerPath = '../_footer.html';
        }
        
        // 2단계 하위 디렉토리 (/currencies/bitcoin/ 등)
        if (currentPath.includes('/currencies/bitcoin/') || 
            currentPath.includes('/affiliated/exchange-guide/')) {
            footerPath = '../../_footer.html';
        }

        // 3단계 하위 디렉토리 (/affiliated/exchange-guide/exchange-guide/ 등)
        if (currentPath.includes('/affiliated/exchange-guide/exchange-guide/')) {
            footerPath = '../../../_footer.html';
        }
        
        const response = await fetch(footerPath);
        if (!response.ok) {
            throw new Error(`풋터 로드 실패: ${response.status}`);
        }
        
        const footerHTML = await response.text();
        
        // HTML 파싱하여 footer 부분만 추출
        const parser = new DOMParser();
        const doc = parser.parseFromString(footerHTML, 'text/html');
        const footer = doc.querySelector('footer');
        const style = doc.querySelector('style');
        
        if (footer) {
            // 스타일 추가
            if (style && !document.querySelector('#footer-styles')) {
                const styleElement = document.createElement('style');
                styleElement.id = 'footer-styles';
                styleElement.textContent = style.textContent;
                document.head.appendChild(styleElement);
            }
            
            // 풋터 삽입
            const targetElement = document.getElementById('footer-placeholder') || document.body;
            targetElement.innerHTML = footer.outerHTML;
            
            // 스크립트 실행
            const scripts = doc.querySelectorAll('script');
            scripts.forEach(script => {
                if (script.textContent.trim()) {
                    const newScript = document.createElement('script');
                    newScript.textContent = script.textContent;
                    document.body.appendChild(newScript);
                }
            });
        }
        
    } catch (error) {
        console.error('풋터 로드 중 오류:', error);
        
        // 백업 풋터 표시
        const fallbackFooter = `
            <footer class="footer" style="background: var(--bg-secondary); border-top: 1px solid var(--border-light); margin-top: 4rem; padding: 2rem 0; text-align: center;">
                <div style="max-width: 1200px; margin: 0 auto; padding: 0 2rem;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">
                        <p style="margin: 0 0 1rem 0; font-weight: 600; color: var(--accent-blue); font-size: 1.2rem;">Onbit</p>
                        <p style="margin: 0 0 0.5rem 0;">© 2025 Onbit Ltd. All rights reserved.</p>
                        <p style="margin: 0;">혁신적인 암호화폐 거래 플랫폼</p>
                    </div>
                </div>
            </footer>
        `;
        
        const targetElement = document.getElementById('footer-placeholder') || document.body;
        targetElement.innerHTML = fallbackFooter;
    }
} 