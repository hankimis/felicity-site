// 실시간 마켓 헤더 데이터 바인딩 (BINANCE Futures 기준)
(function(){
  const BINANCE_FAPI = 'https://fapi.binance.com';
  // Spot 미사용

  const els = {
    icon: document.getElementById('mh-coin-icon'),
    symbolBtn: document.getElementById('mh-symbol-btn'),
    symbolText: document.getElementById('mh-symbol-text'),
    dropdown: document.getElementById('mh-dropdown'),
    ddSearch: document.getElementById('mh-dd-search'),
    ddList: document.getElementById('mh-dd-list'),
    last: document.getElementById('mh-last-price'),
    chg: document.getElementById('mh-change'),
    mark: document.getElementById('mh-mark'),
    index: document.getElementById('mh-index'),
    funding: document.getElementById('mh-funding'),
    fundingEta: document.getElementById('mh-funding-eta'),
    high: document.getElementById('mh-high'),
    low: document.getElementById('mh-low'),
    volUSDT: document.getElementById('mh-vol-usdt'),
    volBTC: document.getElementById('mh-vol-btc')
  };

  const state = {
    symbol: 'BTCUSDT', // TradingView 기본과 동기
    favorites: (function(){ try { return JSON.parse(localStorage.getItem('mh_favorites')||'[]'); } catch(_) { return []; } })(),
    fundingRate: null,
    nextFundingTs: null,
    countdownTimer: null,
    priceSocket: null,
    priceDisposed: false,
    priceRetry: 0,
    __price_start_t: null,
    __price_reconnect: null,
    priceToken: 0,
    ddIv: null,
  };

  function setIcon(symbol){
    try {
      const base = symbol.replace(/(USDT|BUSD|USDC|USD|BTC|ETH)$/,'').toLowerCase();
      const srcs = [
        `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/${base}.png`,
        `https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@master/32/color/${base}.png`,
        `/assets/logoicon/${base}.webp`,
        `/assets/logoicon/${base}.png`
      ];
      let i=0;
      const tryNext=()=>{
        if (!els.icon) return;
        if (i>=srcs.length){ els.icon.removeAttribute('src'); return; }
        els.icon.onerror=()=>{ i++; tryNext(); };
        els.icon.src = srcs[i++];
      };
      tryNext();
    } catch(_) {}
  }

  function fmt(n, opts){
    if (n==null || !isFinite(n)) return '--';
    const {digits=2, style='number'} = (opts||{});
    if (style==='percent') return (n*100).toFixed(digits)+'%';
    if (style==='abbr'){
      const abs = Math.abs(n);
      if (abs>=1e12) return (n/1e12).toFixed(digits)+'T';
      if (abs>=1e9) return (n/1e9).toFixed(digits)+'B';
      if (abs>=1e6) return (n/1e6).toFixed(digits)+'M';
      if (abs>=1e3) return (n/1e3).toFixed(digits)+'K';
    }
    return Number(n).toLocaleString(undefined,{maximumFractionDigits:digits});
  }

  function setChangeClass(val){
    if (!els.chg) return;
    els.chg.classList.remove('up','down');
    if (!isFinite(val)) return;
    if (val>0) els.chg.classList.add('up');
    else if (val<0) els.chg.classList.add('down');
  }

  async function fetch24h(symbol){
    const r = await fetch(`${BINANCE_FAPI}/fapi/v1/ticker/24hr?symbol=${symbol}`);
    if (!r.ok) throw new Error('24hr fail');
    return r.json();
  }

  async function fetchMark(symbol){
    const r = await fetch(`${BINANCE_FAPI}/fapi/v1/premiumIndex?symbol=${symbol}`);
    if (!r.ok) throw new Error('mark fail');
    return r.json();
  }

  async function fetchFunding(symbol){
    const [rateRes, incomeRes] = await Promise.all([
      fetch(`${BINANCE_FAPI}/fapi/v1/premiumIndex?symbol=${symbol}`),
      fetch(`${BINANCE_FAPI}/fapi/v1/fundingRate?symbol=${symbol}&limit=1`)
    ]);
    const premium = await rateRes.json();
    const latest = await incomeRes.json();
    const fr = Number(premium.lastFundingRate ?? latest?.[0]?.fundingRate ?? 0);
    // 다음 펀딩 시간: API가 nextFundingTime 제공 (ms)
    const nextTs = Number(premium.nextFundingTime || 0);
    return { rate: fr, nextTs };
  }

  function startCountdown(){
    if (state.countdownTimer) clearInterval(state.countdownTimer);
    state.countdownTimer = setInterval(()=>{
      try {
        if (!state.nextFundingTs || !els.fundingEta) return;
        const ms = state.nextFundingTs - Date.now();
        if (ms<=0){ els.fundingEta.textContent = '00:00:00'; return; }
        const h = Math.floor(ms/3600000);
        const m = Math.floor((ms%3600000)/60000);
        const s = Math.floor((ms%60000)/1000);
        els.fundingEta.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      } catch(_) {}
    }, 1000);
  }

  function startPriceWS(){
    clearTimeout(state.__price_start_t);
    state.__price_start_t = setTimeout(()=>{
      if (state.priceDisposed) return;
      try {
        if (state.priceSocket && state.priceSocket.readyState===WebSocket.OPEN){
          try { state.priceSocket.close(); } catch(_) {}
        }
      } catch(_) {}
      const stream = `${state.symbol.toLowerCase()}@bookTicker`;
      let ws;
      try { ws = new WebSocket(`wss://fstream.binance.com/ws/${stream}`); } catch(_) { return; }
      const myToken = (++state.priceToken);
      state.priceSocket = ws;
      ws.__token = myToken;
      if (ws){
        ws.onopen = ()=>{ if (ws.__token !== state.priceToken) { try{ ws.close(); }catch(_){} return; } state.priceRetry = 0; };
        ws.onmessage = (ev)=>{
          if (ws.__token !== state.priceToken) return;
          try {
            const m = JSON.parse(ev.data);
            const last = (Number(m.b)+Number(m.a))/2;
            if (isFinite(last) && els.last){ els.last.textContent = fmt(last, {digits:1}); }
          } catch(_) {}
        };
        ws.onerror = ()=>{ try{ ws.close(); }catch(_){} };
        ws.onclose = ()=>{
          if (ws.__token !== state.priceToken) return;
          if (state.priceDisposed) return;
          state.priceRetry = Math.min(6, (state.priceRetry||0)+1);
          const delay = Math.min(10000, 800*Math.pow(2,state.priceRetry));
          clearTimeout(state.__price_reconnect);
          state.__price_reconnect = setTimeout(startPriceWS, delay);
        };
      }
    }, 80);
  }

  // 특정 환경에서 MetaMask 미설치로 발생하는 전역 Unhandled Promise Rejection 소음 억제
  try {
    if (!window.__suppress_metamask_errors){
      window.addEventListener('unhandledrejection', (e)=>{
        try {
          const msg = (e && e.reason && (e.reason.message || String(e.reason))) || '';
          if (typeof msg==='string' && (msg.includes('MetaMask') || msg.includes('extension not found'))){
            e.preventDefault && e.preventDefault();
          }
        } catch(_) {}
      });
      window.__suppress_metamask_errors = true;
    }
  } catch(_) {}

  // 외부(복원 등)에서 WS 일시정지/재개를 제어할 수 있게 공개 API 제공
  try {
    window.marketHeader = window.marketHeader || {};
    window.marketHeader.pauseWs = function(){
      try { state.priceDisposed = true; } catch(_) {}
      try { if (state.priceSocket) state.priceSocket.close(); } catch(_) {}
    };
    window.marketHeader.resumeWs = function(){
      try { state.priceDisposed = false; state.priceRetry = 0; } catch(_) {}
      startPriceWS();
    };
  } catch(_) {}

  function computePositionsBTC(){
    try {
      const ls = JSON.parse(localStorage.getItem('paper_trading_state')||'{}');
      const positions = Array.isArray(ls?.positions) ? ls.positions : (Array.isArray(ls?.state?.positions)? ls.state.positions : []);
      const btcSum = positions.reduce((s,p)=> s + Number(p?.amount||0), 0);
      return btcSum;
    } catch(_) { return 0; }
  }

  async function refreshAll(){
    const sym = state.symbol;
    els.symbolText && (els.symbolText.textContent = `${sym} Perp`);
    setIcon(sym);

    try {
      const [d24, mark, fund] = await Promise.all([
        fetch24h(sym),
        fetchMark(sym),
        fetchFunding(sym)
      ]);

      const last = Number(d24?.lastPrice);
      const chg = Number(d24?.priceChangePercent);
      els.last && (els.last.textContent = fmt(last,{digits:1}));
      els.chg && (els.chg.textContent = (chg>0?'+':'')+fmt(chg/100,{style:'percent',digits:2}));
      setChangeClass(chg);

      els.mark && (els.mark.textContent = fmt(Number(mark?.markPrice ?? mark?.lastPrice ?? last), {digits:1}));
      els.index && (els.index.textContent = fmt(Number(mark?.indexPrice ?? last), {digits:1}));

      state.fundingRate = Number(fund.rate);
      state.nextFundingTs = Number(fund.nextTs)||null;
      els.funding && (els.funding.textContent = (state.fundingRate>0?'+':'')+fmt(state.fundingRate,{style:'percent',digits:4}));
      startCountdown();

      const vol = Number(d24?.quoteVolume);
      const volCoin = Number(d24?.volume);
      els.volUSDT && (els.volUSDT.textContent = fmt(vol,{style:'abbr',digits:2})+' (USDT)');
      els.volBTC && (els.volBTC.textContent = fmt(volCoin,{style:'abbr',digits:2})+' (BTC)');
      els.high && (els.high.textContent = fmt(Number(d24?.highPrice),{digits:1}));
      els.low && (els.low.textContent = fmt(Number(d24?.lowPrice),{digits:1}));

      // Positions 항목 제거됨

    } catch (e) {
      // 조용한 실패 처리
    }
  }

  // =======================
  // Dropdown (심볼 선택)
  // =======================
  const STATIC_SYMBOLS_FUTURES = [
    { base:'BTC', symbol:'BTCUSDT', name:'Bitcoin' },
    { base:'ETH', symbol:'ETHUSDT', name:'Ethereum' },
    { base:'SOL', symbol:'SOLUSDT', name:'Solana' },
    { base:'XRP', symbol:'XRPUSDT', name:'XRP' },
    { base:'BNB', symbol:'BNBUSDT', name:'BNB' }
  ];
  // Spot 제거

  async function fetchPricesForList(symbols){
    try {
      // Binance는 다중 심볼 쿼리 미지원 → 병렬 호출
      const results = await Promise.all(symbols.map(async (s)=>{
        const r = await fetch(`${BINANCE_FAPI}/fapi/v1/ticker/24hr?symbol=${s.symbol}`);
        const d = r.ok ? await r.json() : {};
        return {
          ...s,
          price: Number(d.lastPrice||0),
          change: Number(d.priceChangePercent||0),
          quoteVolume: Number(d.quoteVolume||0)
        };
      }));
      return results;
    } catch(_) {
      return symbols.map(s=>({ ...s, price: NaN, change: NaN, quoteVolume: NaN }));
    }
  }

  function renderDropdownList(items){
    if (!els.ddList) return;
    els.ddList.innerHTML = items.map(item=>{
      const up = isFinite(item.change) && item.change>0;
      const dn = isFinite(item.change) && item.change<0;
      const fav = state.favorites.includes(item.symbol);
      return (
        `<div class="mh-row" data-sym="${item.symbol}">
          <div class="mh-star" data-act="fav">${fav? '★':'☆'}</div>
          <div class="mh-coin">
            <img src="https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/${item.base.toLowerCase()}.png" alt="${item.base}" onerror="this.style.display='none'" />
            <div class="meta">
              <div class="name"><b>${item.base}</b> <span class="sym-quote">Perp</span></div>
              <div class="cap">${fmt(item.quoteVolume,{style:'abbr',digits:2})} USDT</div>
            </div>
          </div>
          <div class="mh-price">${fmt(item.price,{digits:4})}</div>
          <div class="mh-change ${up?'up': dn?'down':''}">${ isFinite(item.change) ? ((item.change>0?'+':'')+item.change.toFixed(2)+'%') : '--' }</div>
        </div>`
      );
    }).join('');

    // 바인딩
    els.ddList.querySelectorAll('.mh-row').forEach(row=>{
      row.addEventListener('click', (e)=>{
        const target = e.target;
        if (target && target.getAttribute('data-act')==='fav'){
          e.stopPropagation();
          const sym = row.getAttribute('data-sym');
          toggleFavorite(sym);
          // 재렌더
          filterAndRender();
          return;
        }
        const sym = row.getAttribute('data-sym');
        if (sym) selectSymbol(sym);
      });
    });
  }

  function toggleFavorite(sym){
    const set = new Set(state.favorites);
    if (set.has(sym)) set.delete(sym); else set.add(sym);
    state.favorites = Array.from(set);
    try { localStorage.setItem('mh_favorites', JSON.stringify(state.favorites)); } catch(_) {}
  }

  function getBackdrop(){ return document.getElementById('mh-dd-backdrop'); }
  function openDropdown(){
    if (!els.dropdown) return;
    const backdrop = getBackdrop();
    els.dropdown.style.display='block';
    requestAnimationFrame(()=>{ els.dropdown.classList.add('is-open'); });
    if (backdrop){ backdrop.style.display='block'; requestAnimationFrame(()=> backdrop.classList.add('is-open')); }
    positionDropdown();
    // 실시간 가격 리스트 주기 갱신
    try { clearInterval(state.ddIv); } catch(_) {}
    state.ddIv = setInterval(prepareDropdown, 3000);
  }
  function closeDropdown(){
    if (!els.dropdown) return;
    const backdrop = getBackdrop();
    els.dropdown.classList.remove('is-open');
    els.dropdown.classList.add('is-closing');
    if (backdrop) backdrop.classList.remove('is-open');
    setTimeout(()=>{
      try { els.dropdown.style.display='none'; els.dropdown.classList.remove('is-closing'); } catch(_) {}
      if (backdrop) backdrop.style.display='none';
    }, 280);
    try { clearInterval(state.ddIv); state.ddIv = null; } catch(_) {}
  }
  function isOpen(){ return els.dropdown && els.dropdown.style.display !== 'none'; }
  function positionDropdown(){ try { const btn = els.symbolBtn; const dd = els.dropdown; if (!btn||!dd) return; /* 기본 좌측 배치 */ } catch(_){} }

  function filterAndRender(){
    const q = (els.ddSearch?.value||'').trim().toLowerCase();
    let items = state.__listCache || [];
    if (q) items = items.filter(x=> x.base.toLowerCase().includes(q) || x.symbol.toLowerCase().includes(q));
    renderDropdownList(items);
  }

  async function prepareDropdown(){
    if (!els.dropdown) return;
    const tab = document.querySelector('.mh-dd-tab.active')?.getAttribute('data-tab') || 'futures';
    const baseList = STATIC_SYMBOLS_FUTURES;
    let list = await fetchPricesForList(baseList);
    if (tab === 'favorites') {
      const favSet = new Set(state.favorites);
      list = list.filter(x=> favSet.has(x.symbol));
    }
    state.__listCache = list;
    filterAndRender();
  }

  function selectSymbol(sym){
    state.symbol = sym.toUpperCase();
    refreshAll();
    // 가격 WS는 안정화 타이머로 재시작
    startPriceWS();
    // TradingView 위젯 심볼도 변경
    try {
      const tvSymbol = `BINANCE:${state.symbol}`;
      const chart = (window.widget && (window.widget.activeChart ? window.widget.activeChart() : (window.widget.chart && window.widget.chart())));
      if (chart && chart.setSymbol){
        let curRes;
        try { curRes = chart.resolution && chart.resolution(); } catch(_) {}
        chart.setSymbol(tvSymbol, curRes || undefined);
      } else if (window.widget && window.widget.setSymbol){
        window.widget.setSymbol(tvSymbol, undefined, ()=>{});
      }
      if (window.paperTrading && window.paperTrading.setSymbol){
        window.paperTrading.setSymbol(state.symbol);
        // 보유 포지션 심볼들의 Mark를 선행 로드하여 표시 흔들림 방지
        try {
          const eng = window.paperTrading;
          const arr = Array.isArray(eng.state?.positions) ? eng.state.positions : [];
          const uniq = Array.from(new Set(arr.map(p=> (p && p.symbol ? String(p.symbol).toUpperCase() : null)).filter(Boolean)));
          uniq.forEach(s=>{ try { eng.fetchMarkForSymbol && eng.fetchMarkForSymbol(s); } catch(_) {} });
        } catch(_) {}
      }
    } catch(_) {}
    // 전역 브로드캐스트 + SSOT 업데이트
    try { window.dispatchEvent(new CustomEvent('mh:symbolChanged', { detail: { symbol: state.symbol } })); } catch(_) {}
    try { window.symbolStore && window.symbolStore.set && window.symbolStore.set(state.symbol); } catch(_) {}
    closeDropdown();
  }

  function bindDropdown(){
    if (els.symbolBtn && !els.symbolBtn.__bound){
      els.symbolBtn.addEventListener('click', ()=>{ isOpen()? closeDropdown(): (prepareDropdown(), openDropdown()); });
      els.symbolBtn.__bound = true;
    }
    if (els.ddSearch && !els.ddSearch.__bound){ els.ddSearch.addEventListener('input', filterAndRender); els.ddSearch.__bound=true; }
    // 탭 전환
    document.querySelectorAll('.mh-dd-tab').forEach(btn=>{
      if (!btn.__bound){
        btn.addEventListener('click', async ()=>{
          document.querySelectorAll('.mh-dd-tab').forEach(b=>b.classList.remove('active'));
          btn.classList.add('active');
          await prepareDropdown();
        });
        btn.__bound = true;
      }
    });
    document.addEventListener('click', (e)=>{
      try {
        if (!isOpen()) return;
        const dd = els.dropdown;
        const btn = els.symbolBtn;
        if (!dd || !btn) return;
        const t = e.target;
        if (dd.contains(t) || btn.contains(t)) return;
        closeDropdown();
      } catch(_) {}
    });
  }

  // 심볼 변경(TradingView와 동기화 가능하면 반영)
  function bindSymbolSync(){
    try {
      const chart = (window.widget && (window.widget.activeChart ? window.widget.activeChart() : (window.widget.chart && window.widget.chart())));
      if (chart && chart.onSymbolChanged){
        chart.onSymbolChanged((s)=>{
          try{
            const name = typeof s==='string'? s : (s.name||'');
            const base = String(name).split(':').pop().replace(/[-:]/g,'');
            const sym = base.toUpperCase().replace(/[-]/g,'');
            if (sym && sym!==state.symbol){
              state.symbol = sym; refreshAll(); startPriceWS();
              // 모듈 동기화 (페이퍼 엔진 및 리스너)
              try { if (window.paperTrading && window.paperTrading.setSymbol) window.paperTrading.setSymbol(state.symbol); } catch(_) {}
              try { window.dispatchEvent(new CustomEvent('mh:symbolChanged', { detail: { symbol: state.symbol } })); } catch(_) {}
              try { window.symbolStore && window.symbolStore.set && window.symbolStore.set(state.symbol); } catch(_) {}
            }
          }catch(_){ }
        });
      }
    } catch(_) {}
  }

  // 초기 실행
  document.addEventListener('DOMContentLoaded', ()=>{
    try {
      const params = new URLSearchParams(location.search);
      const sym = params.get('symbol');
      if (sym && /[A-Z]+USDT/i.test(sym)) state.symbol = sym.toUpperCase();
    } catch(_) {}
    refreshAll();
    startPriceWS();
    bindSymbolSync();
    bindDropdown();
    // 5초 주기 REST 리프레시
    setInterval(refreshAll, 5000);
  });
})();


