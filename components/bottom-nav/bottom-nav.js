;(function(){
  function isMobile(){ return window.matchMedia && window.matchMedia('(max-width: 768px)').matches; }
  function render(){
    if (!isMobile()) return;
    if (document.getElementById('mobile-bottom-nav')) return;
    var wrap = document.createElement('div');
    wrap.id = 'mobile-bottom-nav';
    wrap.innerHTML = '<div class="mbnav-wrap">\
      <nav class="mbnav backdrop" aria-label="Onbit bottom navigation">\
        <a class="item" href="/" data-key="home"><i class="fas fa-house"></i><span>홈</span></a>\
        <a class="item" href="/news/" data-key="news"><i class="fas fa-newspaper"></i><span>뉴스</span></a>\
        <a class="item" href="/community/" data-key="chart"><i class="fas fa-chart-line"></i><span>트레이딩</span></a>\
        <a class="item" href="/feed/" data-key="community"><i class="fas fa-users"></i><span>커뮤니티</span></a>\
        <a class="item" href="/chat/" data-key="chat"><i class="fas fa-comments"></i><span>채팅</span></a>\
        <div class="center-badge" aria-hidden="true"><img src="/assets/indexicon/onbitlogo.png" alt="ONBIT"/></div>\
      </nav></div>';
    document.body.appendChild(wrap);
    try {
      var badge = document.querySelector('#mobile-bottom-nav .center-badge');
      if (badge) {
        badge.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); location.href = '/community/'; });
      }
    } catch(_) {}
    // active state
    try {
      var p = location.pathname.replace(/\/$/, '');
      var key = 'home';
      if (p.startsWith('/news')) key = 'news';
      else if (p.startsWith('/community')) key = 'chart';
      else if (p.startsWith('/feed')) key = 'community';
      else if (p.startsWith('/chat')) key = 'chat';
      var a = document.querySelector('#mobile-bottom-nav .item[data-key="'+key+'"]');
      if (a) a.classList.add('active');
    } catch(_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
  window.addEventListener('resize', function(){ if (!isMobile()) return; render(); bindScrollHandler(); });
  // hide on scroll down, show on scroll up (mobile only)
  var lastY = 0; var listened = new Set();
  function readY(el){ return (el===window) ? (window.scrollY||0) : (el.scrollTop||0); }
  function onScrollGeneric(){
    if (!isMobile()) return;
    var maxDy = 0;
    listened.forEach(function(el){ var y = readY(el); var dy = y - (el.__lastY||0); el.__lastY = y; if (Math.abs(dy) > Math.abs(maxDy)) maxDy = dy; });
    var root = document.getElementById('mobile-bottom-nav'); if (!root) return;
    if (maxDy > 6) root.style.transform = 'translateY(110%)';
    else if (maxDy < -6) root.style.transform = 'translateY(0)';
  }
  function addListener(el){ if (!el || listened.has(el)) return; el.__lastY = readY(el); el.addEventListener('scroll', onScrollGeneric, { passive:true }); listened.add(el); }
  function bindScrollHandler(){
    try {
      if (!isMobile()) return;
      // 후보들을 모두 리스닝
      addListener(window);
      [document.scrollingElement,
       document.querySelector('.main-content-section'),
       document.querySelector('.content-container'),
       document.querySelector('.main-top-split'),
       document.querySelector('.split-left'),
       document.querySelector('.split-right')].forEach(addListener);
    } catch(_) {}
  }
  bindScrollHandler();
})();


