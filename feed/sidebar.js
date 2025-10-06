;(function(){
  function createSidebar(){
    var root = document.getElementById('feed-sidebar');
    if (!root) return;
    var html = ''+
      '<nav class="sidebar-nav">'+
      '  <button class="sidebar-item" data-action="go-home" title="피드 홈"><i data-lucide="home"></i></button>'+
      '  <button class="sidebar-item" data-action="go-search" title="검색"><i data-lucide="search"></i></button>'+
      '  <button class="sidebar-item primary" data-action="go-write" title="작성하기"><i data-lucide="plus"></i></button>'+
      '  <button class="sidebar-item" data-action="go-notifications" title="알림"><i data-lucide="heart"></i></button>'+
      '  <button class="sidebar-item" data-action="go-profile" title="프로필"><i data-lucide="user"></i></button>'+
      '</nav>';
    root.innerHTML = html;
    try { window.lucide && window.lucide.createIcons(); } catch(_) {}
  }

  function nav(pretty, raw){
    var isLocal = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:');
    window.location.href = isLocal ? raw : pretty;
  }

  function bind(){
    document.addEventListener('click', function(e){
      var btn = e.target.closest && e.target.closest('.sidebar-item');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      if (action === 'go-home') { nav('/feed', '/feed/index.html'); }
      if (action === 'go-write') { if (!(window.currentUser)) { nav('/login', '/login/index.html'); return; } nav('/feed/write', '/feed/write.html'); }
      if (action === 'go-notifications') { nav('/feed/notifications', '/feed/notifications.html'); }
      if (action === 'go-search') { nav('/feed/search', '/feed/search.html'); }
      if (action === 'go-profile') { if (!(window.currentUser)) { nav('/login', '/login/index.html'); return; } nav('/feed/profile', '/feed/profile.html'); }
    });
  }

  document.addEventListener('DOMContentLoaded', function(){ createSidebar(); bind(); });
})();
