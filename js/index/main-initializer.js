/**
 * Main Page Initializer
 */

// 스크립트 로딩 오류 처리
window.addEventListener('error', function(e) {
  if (e.target.tagName === 'SCRIPT') {
    console.warn('스크립트 로딩 실패:', e.target.src);
  }
});

// 좌/우 컬럼 높이 동기화 (데스크톱 전용)
function syncTopSplitHeights(){
  try {
    const root = document.querySelector('.main-top-split');
    if (!root) return;
    if (window.matchMedia && window.matchMedia('(max-width: 1024px)').matches) {
      root.querySelectorAll('[data-topfill]')
        .forEach(el=>{ el.style.minHeight=''; el.removeAttribute('data-topfill'); });
      return;
    }
    const left = root.querySelector('.split-left');
    const right = root.querySelector('.split-right');
    if (!left || !right) return;
    root.querySelectorAll('[data-topfill]')
      .forEach(el=>{ el.style.minHeight=''; el.removeAttribute('data-topfill'); });
    const leftH = left.getBoundingClientRect().height;
    const rightH = right.getBoundingClientRect().height;
    const diff = Math.round(Math.abs(leftH - rightH));
    if (diff < 4) return;
    const needFill = leftH > rightH ? right : left;
    const target = needFill.querySelector('.dashboard-card:last-of-type');
    if (!target) return;
    const base = target.getBoundingClientRect().height;
    target.style.minHeight = (base + diff) + 'px';
    target.setAttribute('data-topfill','1');
  } catch(_) {}
}

function initSplitScrollSync(){
  try {
    const root = document.querySelector('.main-top-split');
    const left = root?.querySelector('.split-left');
    const right = root?.querySelector('.split-right');
    if (!left || !right) return;
    const isScrollable = (el)=> el && (el.scrollHeight > el.clientHeight);
    if (!isScrollable(left) && !isScrollable(right)) return;
    let syncing = false;
    const onScroll = (src, dest)=>{
      if (syncing) return; syncing = true;
      const max = Math.max(src.scrollHeight - src.clientHeight, 1);
      const ratio = max > 0 ? (src.scrollTop / max) : 0;
      const destMax = Math.max(dest.scrollHeight - dest.clientHeight, 1);
      dest.scrollTop = ratio * destMax;
      syncing = false;
    };
    left.addEventListener('scroll', ()=> onScroll(left, right), { passive:true });
    right.addEventListener('scroll', ()=> onScroll(right, left), { passive:true });
  } catch(_) {}
}

// 홈 로그인 카드: 잔액/채굴량 탭 및 채굴량 클릭 이동
function initHomeBalanceTabs(){
  try {
    const root = document.getElementById('home-balance-tabs');
    if (!root) return;
    const tabs = root.querySelectorAll('.tab-list .tab');
    const panels = root.querySelectorAll('.tab-panels .tab-panel');
    const activate = (key)=>{
      try {
        tabs.forEach(btn=>{
          const isActive = btn.getAttribute('data-tab') === key;
          btn.classList.toggle('active', isActive);
          btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
        panels.forEach(p=>{
          const match = p.getAttribute('data-panel') === key;
          p.classList.toggle('active', match);
          if (match) p.setAttribute('aria-hidden','false'); else p.setAttribute('aria-hidden','true');
        });
      } catch(_) {}
    };
    tabs.forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const key = btn.getAttribute('data-tab');
        if (key) activate(key);
      });
    });
    // ONBIT 채굴량 클릭 시 지갑으로 이동 (미로그인 시 로그인 페이지)
    const onbitAmt = document.getElementById('home-onbit-balance');
    if (onbitAmt){
      onbitAmt.style.cursor = 'pointer';
      onbitAmt.setAttribute('title','지갑으로 이동');
      onbitAmt.addEventListener('click', ()=>{
        const loggedIn = !!(window.auth && window.auth.currentUser);
        window.location.href = loggedIn ? '/wallet/' : '/login/';
      });
    }
  } catch(_) {}
}

function mountTvEventsWidget(theme){
  try {
    const container = document.getElementById('tv-events-embed');
    if (!container) return;
    container.innerHTML = '';
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-events.js';
    script.innerHTML = JSON.stringify({
      colorTheme: theme === 'dark' ? 'dark' : 'white',
      isTransparent: true,
      locale: 'kr',
      countryFilter: 'ar,au,br,ca,cn,fr,de,in,id,it,jp,kr,mx,ru,sa,za,tr,gb,us,eu',
      importanceFilter: '-1,0,1',
      width: 390,
      height: 550
    });
    const wrap = document.createElement('div');
    wrap.className = 'tradingview-widget-container';
    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    wrap.appendChild(widgetDiv);
    wrap.appendChild(script);
    container.appendChild(wrap);
    setTimeout(syncTopSplitHeights, 80);
  } catch(_) {}
}

async function renderHomeNotices(){
  try {
    const list = document.getElementById('home-notice-list');
    if (!list || !window.firebase || !window.firebase.firestore) return;
    const db = window.firebase.firestore();
    const snap = await db.collection('notices').orderBy('createdAt','desc').limit(5).get();
    const items = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    const html = items.map(n=>{
      return `<a class="notice-row" href="${location.origin}/notice-post.html?id=${n.id}" style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-bottom:1px solid var(--border-default); text-decoration:none; color:inherit;">
        <span class="badge" style="background:#ef4444;color:#fff;border-radius:999px;padding:2px 10px;font-weight:800;font-size:12px;">공지</span>
        <div style="flex:1; overflow:hidden; display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical;">${(n.title||'').replace(/</g,'&lt;')}</div>
      </a>`;
    }).join('');
    list.innerHTML = html || '<div class="loading" style="padding:18px 10px;color:var(--text-color-secondary);">공지 없음</div>';
    setTimeout(syncTopSplitHeights, 50);
  } catch(_) {}
}

// 페이지 초기화
document.addEventListener('DOMContentLoaded', function() {
  
  if (typeof initializePage === 'function') {
    initializePage();
  }

  // 테마 동기화된 경제캘린더 위젯 마운트
  try {
    const currentTheme = (localStorage.getItem('theme') || 'light');
    mountTvEventsWidget(currentTheme);
    document.addEventListener('themeChanged', (e)=>{
      const theme = e?.detail?.theme || (document.documentElement.getAttribute('data-theme')||'light');
      mountTvEventsWidget(theme);
      setTimeout(syncTopSplitHeights, 100);
    });
  } catch(_) {}

  // 홈 공지 렌더링
  renderHomeNotices();

  // 실시간 가격(BTC/ETH)
  try {
    if (window.MarketDataManager) {
      const mdm = new window.MarketDataManager();
      mdm.addSymbol('BTCUSDT');
      mdm.addSymbol('ETHUSDT');
      mdm.startUpdating();
      mdm.startPriceStream();
      const btcEl = document.getElementById('btc-live-price');
      const ethEl = document.getElementById('eth-live-price');
      const render = (el, d)=>{
        if (!el || !d) return;
        const price = Number(d.price||0);
        const pct = Number(d.priceChangePercent||0);
        const sign = pct>=0? '+' : '';
        el.textContent = `${price.toLocaleString()} (${sign}${pct.toFixed(2)}%)`;
        el.classList.toggle('down', pct<0);
      };
      const initBTC = mdm.getSymbolData('BTCUSDT'); if (initBTC) render(btcEl, initBTC);
      const initETH = mdm.getSymbolData('ETHUSDT'); if (initETH) render(ethEl, initETH);
      mdm.subscribe((symbol, d)=>{
        if (symbol==='BTCUSDT') render(btcEl, d);
        if (symbol==='ETHUSDT') render(ethEl, d);
      });
    }
  } catch(_) {}

  // 초기 동기화 및 리스너
  setTimeout(syncTopSplitHeights, 150);
  window.addEventListener('resize', ()=> setTimeout(syncTopSplitHeights, 120));
  initSplitScrollSync();
  initHomeBalanceTabs();
});

// 페이지 로드 후 초기화
let dashboard;

function initializeDashboard() {
  try {
    dashboard = new Dashboard();
  } catch (error) {
    console.error('Dashboard 초기화 실패:', error);
  }
  // 코인 테이블 제거됨
}

// 즉시 대시보드 초기화
document.addEventListener('DOMContentLoaded', function() {
  initializeDashboard();
  // 검색 레이어 표시/숨김
  try {
    const input = document.getElementById('site-search-input');
    const layer = document.getElementById('search-layer');
    const list = document.getElementById('suggest-list');
    if (input && layer) {
      const buildSuggestions = async (base)=>{
        try {
          if (!list) return;
          const kw = (base||'').toLowerCase();
          const items = [];
          try { const cached = JSON.parse(localStorage.getItem('newsFeedsCache')||'{}'); const data = Array.isArray(cached.data)? cached.data : []; data.slice(0,80).forEach(n=>{ const t=(n.title||'').trim(); if (t && (!kw || t.toLowerCase().includes(kw))) items.push({ text:t }); }); } catch(_) {}
          const uniq=[]; const seen=new Set();
          for (const it of items){ const k=it.text.toLowerCase(); if(!seen.has(k)){ seen.add(k); uniq.push(it);} if(uniq.length>=10) break; }
          list.innerHTML = uniq.map(it=>`<div class="suggest-item" data-kw="${it.text.replace(/"/g,'&quot;')}"><div class="left"><i data-lucide="search"></i><span>${it.text}</span></div><i data-lucide="corner-up-right"></i></div>`).join('') || '<div class="suggest-item" style="color:var(--text-color-secondary)">추천어가 없습니다</div>';
          try { window.lucide && window.lucide.createIcons(); } catch(_) {}
        } catch(_) {}
      };
      const show = async ()=>{ layer.style.display = 'block'; await buildSuggestions(input.value||''); };
      const hide = ()=>{ layer.style.display = 'none'; };
      input.addEventListener('focus', show);
      input.addEventListener('input', async ()=>{ await buildSuggestions(input.value||''); layer.style.display='block'; });
      document.addEventListener('click', (e)=>{
        const sug = e.target.closest && e.target.closest('.suggest-item');
        if (sug){ const kw = sug.getAttribute('data-kw'); if (input){ input.value=kw; } const form = input.closest('form'); if (form) form.submit(); return; }
      });
      document.addEventListener('click', (e)=>{
        if (!layer.contains(e.target) && e.target !== input) hide();
      });
    }
  } catch(_) {}
});

// 모바일 대시보드 슬라이더 초기화
document.addEventListener('DOMContentLoaded', function() {
  initMobileDashboardSlider();
  // 모바일에서 로그인 카드를 검색 바로 아래로 이동
  try {
    if (window.matchMedia('(max-width: 768px)').matches){
      var login = document.getElementById('home-login-card');
      var search = document.querySelector('.search-hero');
      if (login && search && search.parentElement){
        // 검색영역 바로 뒤로 이동
        search.insertAdjacentElement('afterend', login);
      }
    }
  } catch(_){}
});