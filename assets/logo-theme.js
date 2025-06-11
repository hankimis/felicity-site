// logo-theme.js
function updateLogoByTheme() {
  // 데스크톱 로고
  const logoImg = document.getElementById('main-logo');
  if (logoImg) {
    const isDark = document.body.classList.contains('dark-mode');
    logoImg.src = isDark ? 'assets/darklogo.png' : 'assets/lightlogo.png';
  }
  // 모바일 메뉴 로고
  const mobileLogoImg = document.getElementById('mobile-main-logo');
  if (mobileLogoImg) {
    const isDark = document.body.classList.contains('dark-mode');
    mobileLogoImg.src = isDark ? 'assets/darklogo.png' : 'assets/lightlogo.png';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateLogoByTheme();
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function() {
      setTimeout(updateLogoByTheme, 10);
    });
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateLogoByTheme);
  const observer = new MutationObserver(updateLogoByTheme);
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}); 