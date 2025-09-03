// 🔥 Paper Trading Engine for Community Page
// - USDT 선물 모의 투자
// - 시장가/지정가 주문, 롱/숏, 레버리지, 교차/격리 모드(간소화)
// - 오더북/체결 리스트는 가격을 중심으로 시뮬레이션 생성
// - 잔고/포지션은 localStorage에 저장

(function () {
  const STORAGE_KEY = 'paperTradingState_v1';

  // =============================
  // CONFIG
  // =============================
  const CONFIG = {
    binanceWsBase: 'wss://fstream.binance.com/ws',
    binanceApiBase: 'https://fapi.binance.com',
    orderbookDepthStream: (sym) => `${CONFIG.binanceWsBase}/${sym}@depth20`,
    bookTickerStream: (sym) => `${CONFIG.binanceWsBase}/${sym}@bookTicker`,
    depthRest: (sym, limit=25) => `${CONFIG.binanceApiBase}/fapi/v1/depth?symbol=${sym}&limit=${limit}`,
    tickerRest: (sym) => `${CONFIG.binanceApiBase}/fapi/v1/ticker/bookTicker?symbol=${sym}`,
    leverageBracketRest: (sym) => `${CONFIG.binanceApiBase}/fapi/v1/leverageBracket?symbol=${sym}`,
    ui: {
      minOrderbookRows: 9,
      rowHeight: 24,
      ladderTick: 0.1,
    },
    fees: { taker: 0.0006, maker: 0.0002 },
    fundingIntervalMs: 60*60*1000,
  };

  const defaultState = {
    symbol: 'BTCUSDT',
    balanceUSDT: 10000, // 시작 자본
    equityUSDT: 10000,
    leverage: 15,
    marginMode: 'cross', // cross | isolated
    positions: [], // { id, symbol, side, entry, amount, leverage, margin, mode }
    openOrders: [], // { id, symbol, side, price, amount, leverage, mode, status }
    lastPrice: 0,
    history: [],
    fundingRate: 0.0001,
    lastFundingTs: 0,
  };
  const FEE_TAKER = CONFIG.fees.taker; // 6 bps
  const FEE_MAKER = CONFIG.fees.maker; // 2 bps
  const FUNDING_INTERVAL_MS = CONFIG.fundingIntervalMs; // 테스트: 1시간
  const PRICE_TICK = (CONFIG.ticks && CONFIG.ticks.price) || 0.1;
  const AMOUNT_TICK = (CONFIG.ticks && CONFIG.ticks.amount) || 0.0001;
  const MMR_TTL = (CONFIG.cache && CONFIG.cache.mmrTtlMs) || (10*60*1000);

  const dlog = (...args) => { if (CONFIG.debug) { try { console.log('[PT]', ...args); } catch(_) {} } };

  class PaperTradingEngine {
    constructor() {
      this.state = this.loadState();
      // 새 MarketSockets로 대체 (기존 MarketDataManager 폴백 유지)
      if (window.MarketSockets) {
        this.market = new window.MarketSockets(this.state.symbol, {
          onPrice: (mid) => { this.state.lastPrice = Number(mid); this.renderPrices(); this.updatePnL(); },
          onDepth: (m) => {
            try {
              this.orderbookState = {
                bids: (m.b || []).map(([p,q]) => ({ price: Number(p), size: Number(q) })),
                asks: (m.a || []).map(([p,q]) => ({ price: Number(p), size: Number(q) })),
              };
              this.renderDepth();
            } catch(_) {}
          }
        });
        this.market.startPrice();
        this.market.startOrderbook();
      } else {
        this.market = new (window.MarketDataManager || function(){})();
      }
      this.priceTimer = null;
      this.orderbookState = { asks: [], bids: [] };
      this.orderbookLevels = 16;
      this.ladderTick = CONFIG.ui.ladderTick; // 가격 고정 간격 0.1
      // 렌더 스로틀러
      this._rafQueued = false;
      this.ladderLevels = 15; // 각 사이드 고정 행 수
      this.ladderCenter = null; // 고정 기준가
      this.pricePrecision = 1; // 간소화된 가격 자리수
      this.amountPrecision = 4;
      this.priceTouched = false;
      this.prev = { lastPrice: null, uPnL: null, marginBalance: null };
      this.prevPnlByPos = new Map();
      this.firstPriceReceived = false;
      this.user = null;
      this.guestLocked = false;
      this._syncTimer = null;
      this._obDebounce = null; // orderbook UI 디바운스 타이머
      this._lastPnlRender = 0; // PnL/가격 렌더 스로틀
      this._obRowCache = new Map(); // 가격키->행 엘리먼트 캐시
      this._obMounted = false;
      this._mmrBrackets = null; // 유지증거금 브래킷 (REST 로드)
      this._obWorker = null; // 오더북 계산용 Web Worker
      this._obLastPriceArrays = null; // worker 결과 매핑용
      this._obLastMsgHash = '';
      this._obBucketSig = '';
      this._hidden = document.hidden; // 가시성 상태
      this._online = navigator.onLine !== false; // 온라인 상태
      this._priceAbort = null; // REST 가격 AbortController
      this._depthAbort = null; // REST 깊이 AbortController
      this._fmtMax = (CONFIG.cache && CONFIG.cache.formatLruSize) || 64;

      this.cacheElements();
      this.bindEvents();
      this.initAuthIntegration();
      this.start();
      this.render();
      this.renderPositionsSkeleton();
      // 저장/동기화 디바운스 래퍼
      this._saveTimer = null;
      this._lastSavedJson = '';
      this.initOrderbookWorker();
      this.initVisibilityAndOnlineHandlers();

      // ONBIT Miner UI 구독 (balance-grid 중앙)
      try {
        if (window.onbitMiner) {
          window.onbitMiner.subscribeUI(document.getElementById('acc-onbit'));
          window.onbitMiner.setExternalControlled(true); // 합산 표기는 여기서만 제어
          window.addEventListener('onbit:balance', (e) => {
            const el = document.getElementById('acc-onbit');
            if (el && e && e.detail && typeof e.detail.balance === 'number') {
              // 최신 프리뷰와 합산 표시
              const base = Number(e.detail.balance || 0);
              this._onbitBase = base;
              const total = base + Number(this._onbitPreview || 0);
              this.updateOnbitDisplay(total);
            }
          });
        }
      } catch(_) {}

      // 채굴 미리보기는 포지션 PnL을 기준으로 고정 보상(수익 1, 손실 0.1) 합산
      this._miningPosAccUSDT = 0; // 사용 안함
      this._miningNegAccUSDT = 0; // 사용 안함
      this._lastMiningAwardTs = 0;
      this._onbitPreview = 0; // 현재 포지션 기준 예상 채굴량(합계)
    }

    initOrderbookWorker() {
      try {
        const url = '../js/orderbook-worker.js';
        const w = new Worker(url);
        w.onmessage = (e) => {
          const d = e.data || {};
          if (!this._obLastPriceArrays) return;
          const { asksPrices, bidsPrices } = this._obLastPriceArrays;
          const { askSizes, bidSizes, askCumMax, bidCumMax } = d;
          if (!Array.isArray(askSizes) || !Array.isArray(bidSizes)) return;
          this.drawOrderbook(asksPrices, bidsPrices, askSizes, bidSizes, askCumMax, bidCumMax);
        };
        w.onerror = () => { try { w.terminate(); } catch(_) {}; this._obWorker = null; setTimeout(()=>this.initOrderbookWorker(), 300); };
        w.onmessageerror = () => { try { w.terminate(); } catch(_) {}; this._obWorker = null; setTimeout(()=>this.initOrderbookWorker(), 300); };
        this._obWorker = w;
      } catch (_) {
        this._obWorker = null;
      }
    }

    initVisibilityAndOnlineHandlers() {
      const onVis = () => {
        const hidden = !!document.hidden;
        this._hidden = hidden;
        // 숨겨지면 소켓만 유지, 렌더 일시 중지. 다시 보이면 즉시 한 번 렌더/가격 fetch
        if (!hidden) {
          this.renderDepth();
          this.fetchInitialPrice();
          // hidden 유지 시간 리셋
          this._hiddenSince = 0;
        }
      };
      const onOnline = () => {
        this._online = true;
        // 즉시 재연결 트리거
        const jitter = Math.floor(Math.random()*200)+50; // 50~250ms 지터
        setTimeout(() => {
          try { this.market && this.market.startPrice && this.market.startPrice(); } catch(_) {}
          try { this.market && this.market.startOrderbook && this.market.startOrderbook(); } catch(_) {}
        }, jitter);
      };
      const onOffline = () => { this._online = false; };
      document.addEventListener('visibilitychange', onVis);
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      // beforeunload flush
      window.addEventListener('beforeunload', () => {
        try {
          const json = JSON.stringify(this.state);
          localStorage.setItem(STORAGE_KEY, json);
        } catch (_) {}
      });
      // hidden 30s 이상이면 worker 종료, 다시 보이면 재생성
      setInterval(() => {
        if (this._hidden) {
          this._hiddenSince = (this._hiddenSince||0) + 1000;
          if (this._hiddenSince > 30000 && this._obWorker) {
            try { this._obWorker.terminate(); } catch(_) {}
            this._obWorker = null;
          }
        }
      }, 1000);
    }

    cacheElements() {
      this.el = {
        symbol: document.getElementById('pt-symbol'),
        lastPrice: document.getElementById('pt-last-price'),
        mid: document.getElementById('orderbook-mid-price'),
        asks: document.getElementById('orderbook-asks'),
        bids: document.getElementById('orderbook-bids'),
        price: document.getElementById('pt-price'),
        amount: document.getElementById('pt-amount'),
        amountPercent: document.getElementById('pt-amount-percent'),
        percent: document.getElementById('pt-percent'),
        balance: document.getElementById('pt-balance'),
        cost: document.getElementById('pt-cost'),
        feeBasis: document.getElementById('pt-fee-basis'),
        feeEstimate: document.getElementById('pt-fee-estimate'),
        btnLong: document.getElementById('pt-open-long'),
        btnShort: document.getElementById('pt-open-short'),
        positionsUnder: document.getElementById('positions-under-chart'),
        positionsTableBody: document.getElementById('positions-table-body'),
        btnCloseAll: document.getElementById('pt-close-all'),
        ordersTableBody: document.getElementById('orders-table-body'),
      };
      // 단일 모드 (Open 전용)
    }

    bindEvents() {
      const sidebar = document.getElementById('paper-trading-sidebar');
      if (!sidebar) {
        console.warn('paper-trading: sidebar not found, proceeding to bind global handlers');
      }

      if (sidebar) sidebar.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab');
        if (tab) {
          sidebar.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
          tab.classList.add('active');
          // 오더북/고래탐지 탭 전환
          const key = tab.getAttribute('data-tab');
          const obBody = document.getElementById('orderbook-body');
          const whaleBody = document.getElementById('whale-tab-body');
          if (key === 'whale') {
            // 패널 높이/레이아웃은 고정, 콘텐츠만 전환
            if (obBody) obBody.style.display = 'none';
            if (whaleBody) whaleBody.style.display = '';
          } else {
            if (obBody) obBody.style.display = '';
            if (whaleBody) whaleBody.style.display = 'none';
          }
        }

        // trade-tab 제거됨

        const orderType = e.target.closest('.order-type');
        if (orderType) {
          sidebar.querySelectorAll('.order-type').forEach((b) => b.classList.remove('active'));
          orderType.classList.add('active');
          // a11y
          sidebar.querySelectorAll('.order-type').forEach((b)=>b.setAttribute('aria-selected', b.classList.contains('active')?'true':'false'));
          const type = orderType.getAttribute('data-type');
          const isMkt = type === 'market';
          this.el.price.disabled = isMkt;
          const form = document.getElementById('order-form');
          if (form) form.classList.toggle('is-market', isMkt);
          this.el.price.placeholder = isMkt ? 'Fill at market price' : '';
          if (!isMkt && !this.priceTouched && !this.el.price.value) this.el.price.value = (this.state.lastPrice || 0).toFixed(1);
        }

        const modeBtn = e.target.closest('.mode');
        if (modeBtn) {
          sidebar.querySelectorAll('.mode').forEach((b) => b.classList.remove('active'));
          modeBtn.classList.add('active');
          this.state.marginMode = modeBtn.getAttribute('data-mode');
          this.saveState();
          try { localStorage.setItem('pt_mode', this.state.marginMode); } catch(_) {}
        }

        const levBtn = e.target.closest('.lev');
        if (levBtn) {
          sidebar.querySelectorAll('.lev').forEach((b) => b.classList.remove('active'));
          levBtn.classList.add('active');
          this.state.leverage = Number(levBtn.getAttribute('data-lev')) || 15;
          this.saveState();
          this.updateCostPreview();
        }
      });

      if (this.el.percent) {
        this.el.percent.step = '1';
        this.el.percent.addEventListener('input', () => this.updateAmountFromPercent());
      }
      this.el.amount && this.el.amount.addEventListener('input', () => this.validateAndPreviewAmount());
      if (this.el.amountPercent) {
        this.el.amountPercent.addEventListener('input', () => this.updatePercentFromText());
      }
      if (this.el.price) {
        const onPriceInput = () => { this.priceTouched = true; this.updateCostPreview(); };
        this.el.price.addEventListener('input', onPriceInput);
        this.el.price.addEventListener('change', onPriceInput);
      }
      // priceType select 제거에 따라 change 리스너 삭제

      this.el.btnLong && this.el.btnLong.addEventListener('click', () => this.handleActionClick('long'));
      this.el.btnShort && this.el.btnShort.addEventListener('click', () => this.handleActionClick('short'));
      this.el.btnCloseAll && this.el.btnCloseAll.addEventListener('click', () => {
        if (!this._risk) this._risk = new window.RiskFunding({ getState: ()=>this.state, getBrackets: ()=>this._mmrBrackets });
        if (!this._ui) { this._ui = new window.UIRenderer(); this._ui.setFormat((n)=>this.format(n)); }
        if (!this._orders) this._orders = new window.OrderEngine(this.state, this._risk, this._ui);
        const cnt = this._orders.closeAll(this.state.lastPrice);
        if (cnt>0) { this.saveState(); this.renderPositions(); this.updateCostPreview(); this.syncUserBalanceDebounced(); }
      });

      // 초기 렌더 시 로컬 포지션 즉시 표시 (새로고침 후 빈 상태 방지)
      requestAnimationFrame(() => this.renderPositions());

      // 인라인 모드/레버리지 컨트롤
      const btnCross = document.getElementById('btn-mode-cross');
      const btnIso = document.getElementById('btn-mode-isolated');
      const levPercent = document.getElementById('lev-percent');
      const levValue = document.getElementById('lev-value');
      // 인라인 모드/레버리지 동작
      const attach = () => {
        const c = document.getElementById('btn-mode-cross');
        const i = document.getElementById('btn-mode-isolated');
        const s = document.getElementById('lev-percent');
        const v = document.getElementById('lev-value');
        // load prefs
        try {
          const savedMode = localStorage.getItem('pt_mode');
          if (savedMode === 'cross' || savedMode === 'isolated') this.state.marginMode = savedMode;
          const savedLev = Number(localStorage.getItem('pt_lev'));
          if (isFinite(savedLev) && savedLev>=1 && savedLev<=200) this.state.leverage = savedLev;
          const savedPct = Number(localStorage.getItem('pt_percent'));
          if (isFinite(savedPct) && s) s.value = String(Math.max(0, Math.min(100, savedPct)));
        } catch(_) {}
        if (c && !c.__bound) {
          c.addEventListener('click', () => {
            this.state.marginMode = 'cross';
            c.classList.add('active');
            i && i.classList.remove('active');
            this.saveState();
            try { localStorage.setItem('pt_mode','cross'); } catch(_) {}
          });
          c.__bound = true;
        }
        if (i && !i.__bound) {
          i.addEventListener('click', () => {
            this.state.marginMode = 'isolated';
            i.classList.add('active');
            c && c.classList.remove('active');
            this.saveState();
            try { localStorage.setItem('pt_mode','isolated'); } catch(_) {}
          });
          i.__bound = true;
        }
        if (s && !s.__bound) {
          // percent 0~100 -> leverage 1~200 매핑
          const pctToLev = (p) => Math.round(1 + (199 * (p/100)));
          const levToPct = (l) => Math.round(((l-1)/199)*100);
          const initLev = this.state.leverage || 15;
          s.value = String(levToPct(initLev));
          if (v && v.tagName === 'INPUT') v.value = String(initLev);
          else if (v) v.textContent = `${initLev}x`;
          s.addEventListener('input', () => {
            const lev = pctToLev(Number(s.value||0));
            if (v && v.tagName === 'INPUT') v.value = String(lev); else if (v) v.textContent = `${lev}x`;
            // 레버리지 변경 시 수량/예상표기 동기화
            this.state.leverage = lev;
            this.updateAmountFromPercent();
            this.updateActionButtonsEnabled();
            try { localStorage.setItem('pt_lev', String(lev)); localStorage.setItem('pt_percent', String(s.value||'0')); } catch(_) {}
            // a11y
            s.setAttribute('aria-valuemin','0');
            s.setAttribute('aria-valuemax','100');
            s.setAttribute('aria-valuenow', String(s.value||'0'));
          });
          s.addEventListener('change', () => {
            const lev = pctToLev(Number(s.value||0));
            this.state.leverage = lev;
            this.saveState();
            this.updateAmountFromPercent();
            this.updateCostPreview();
            this.updateActionButtonsEnabled();
            try { localStorage.setItem('pt_lev', String(lev)); localStorage.setItem('pt_percent', String(s.value||'0')); } catch(_) {}
          });
          s.__bound = true;
        }
        // 입력 박스에서 직접 변경
        if (v && !v.__bound && v.tagName === 'INPUT') {
          const pctFromLev = (lev) => Math.round(((lev-1)/199)*100);
          v.addEventListener('input', () => {
            let lv = Math.max(1, Math.min(200, Number(v.value||0)));
            if (!isFinite(lv)) return;
            this.state.leverage = lv;
            this.saveState();
            if (s) s.value = String(pctFromLev(lv));
            this.updateAmountFromPercent();
            this.updateCostPreview();
            this.updateActionButtonsEnabled();
            try { localStorage.setItem('pt_lev', String(lv)); localStorage.setItem('pt_percent', String(s?s.value:'0')); } catch(_) {}
          });
          v.__bound = true;
        }
      };
      attach();
      const observer = new MutationObserver(attach);
      observer.observe(document.body, { childList: true, subtree: true });

      // 오더북 툴팁 (위임)
      const rowsEl = document.getElementById('orderbook-rows');
      if (rowsEl && !rowsEl.__tooltipBound) {
        const tt = this.ensureObTooltip();
        const show = (ev, row) => {
          const total = row?.getAttribute('data-cum-size');
          const notion = row?.getAttribute('data-cum-notional');
          if (!total || !notion) { tt.style.display = 'none'; return; }
          tt.innerHTML = `<div>누적 수량: <b>${Number(total).toFixed(4)} BTC</b></div><div>명목가: <b>${this.format(Number(notion))} USDT</b></div>`;
          tt.style.display = 'block';
          const x = ev.clientX + 12;
          const y = ev.clientY + 12;
          tt.style.left = x + 'px';
          tt.style.top = y + 'px';
        };
        rowsEl.addEventListener('mousemove', (e) => {
          const row = e.target.closest && e.target.closest('.ob-row.ask, .ob-row.bid');
          if (!row) { tt.style.display = 'none'; return; }
          show(e, row);
        });
        rowsEl.addEventListener('mouseleave', () => { tt.style.display = 'none'; });
        rowsEl.__tooltipBound = true;
      }

      // 오더북 가격 클릭 → 가격 입력 자동 채우기 (위임)
      if (rowsEl && !rowsEl.__priceClickBound) {
        rowsEl.addEventListener('click', (e) => {
          const row = e.target.closest && e.target.closest('.ob-row.ask, .ob-row.bid');
          if (!row) return;
          const priceAttr = row.getAttribute('data-price');
          const priceVal = Number(priceAttr);
          if (!isFinite(priceVal) || priceVal <= 0) return;
          if (!this.el || !this.el.price) return;

          // 마켓 모드인 경우 Limit로 전환하여 가격 입력 가능 상태로 변경
          if (this.el.price.disabled) {
            try {
              const sidebarEl = document.getElementById('paper-trading-sidebar');
              if (sidebarEl) {
                sidebarEl.querySelectorAll('.order-type').forEach((b) => b.classList.remove('active'));
                const limitBtn = sidebarEl.querySelector('.order-type[data-type="limit"]');
                if (limitBtn) limitBtn.classList.add('active');
              }
              const form = document.getElementById('order-form');
              if (form) form.classList.remove('is-market');
              this.el.price.disabled = false;
              this.el.price.placeholder = '';
            } catch(_) {}
          }

          this.el.price.value = String(priceVal);
          this.priceTouched = true;
          this.updateCostPreview();
        });
        rowsEl.__priceClickBound = true;
      }

      // 전역 클릭 위임: Limit/Market + 모달 버튼들(교차/레버리지)
      if (!window.__pt_globalBound) {
        document.addEventListener('click', (ev) => {
          // trade-tab 제거됨

          const typeBtn = ev.target.closest && ev.target.closest('.order-type');
          if (typeBtn) {
            document.querySelectorAll('.trade-panel .order-type').forEach(b => b.classList.remove('active'));
            typeBtn.classList.add('active');
            const t = typeBtn.getAttribute('data-type');
            if (this.el.price) {
              const isMkt = t === 'market';
              this.el.price.disabled = isMkt;
              const form = document.getElementById('order-form');
              if (form) form.classList.toggle('is-market', isMkt);
              this.el.price.placeholder = isMkt ? 'Fill at market price' : '';
              if (!isMkt && !this.priceTouched && !this.el.price.value) this.el.price.value = (this.state.lastPrice || 0).toFixed(1);
            }
            this.updateCostPreview();
          }

          // 모달 제거됨
          const posTab = ev.target.closest && ev.target.closest('.pos-tab');
          if (posTab) {
            document.querySelectorAll('.pos-tab').forEach(b=>b.classList.remove('active'));
            posTab.classList.add('active');
            const key = posTab.getAttribute('data-pos-tab');
            const posTable = document.querySelector('.positions-table');
            const ordTable = document.querySelector('.orders-table');
            const hisTable = document.querySelector('.history-table');
            if (key === 'orders') {
              posTable && (posTable.style.display = 'none');
              ordTable && (ordTable.style.display = 'block');
              hisTable && (hisTable.style.display = 'none');
              this.renderOrders();
            } else if (key === 'history') {
              posTable && (posTable.style.display = 'none');
              ordTable && (ordTable.style.display = 'none');
              hisTable && (hisTable.style.display = 'block');
              this.renderHistory && this.renderHistory();
            } else {
              posTable && (posTable.style.display = 'block');
              ordTable && (ordTable.style.display = 'none');
              hisTable && (hisTable.style.display = 'none');
            }
            return;
          }
        });
        window.__pt_globalBound = true;
      }
    }

    // ===============================
    // Auth 연동: 회원 잔고 연동 + 비회원 차단
    // ===============================
    initAuthIntegration() {
      // Firebase auth 상태 변경 연결
      try {
        if (window.auth && typeof window.auth.onAuthStateChanged === 'function') {
          window.auth.onAuthStateChanged((user) => this.onAuthChanged(user));
        } else {
          // 초기 로드 지연 대비: 잠시 후 재시도
          setTimeout(() => this.initAuthIntegration(), 300);
        }
      } catch (_) {}

      // 사용자 데이터 업데이트(프로필/필드 변경) 수신
      window.addEventListener('userDataUpdated', (e) => {
        const d = e && e.detail && e.detail.user;
        if (d && this.user && d.uid === this.user.uid) {
          // 필요 시 추가 필드 반영 가능
        }
      });
    }

    async onAuthChanged(user) {
      this.user = user || null;
      if (!this.user) {
        // 비회원: 거래 차단 + UI 비활성화 + 잔고 0 표시 (로컬 저장은 하지 않음)
        this.guestLocked = true;
        this.setBalanceInMemory(0, { persist: false });
        // 로그아웃 시 로컬 포지션/오더/히스토리 및 저장 상태 완전 초기화
        this.clearTradingStateOnLogout();
        this.updateAuthLockUI(true);
        return;
      }

      // 회원: 거래 허용, 서버 잔고 로드/동기화
      this.guestLocked = false;
      this.updateAuthLockUI(false);
      await this.loadUserBalanceFromFirestore();
      try { window.onbitMiner && window.onbitMiner.setUser(this.user); } catch(_) {}
    }

    clearTradingStateOnLogout() {
      try { localStorage.removeItem(STORAGE_KEY); } catch(_) {}
      // 내부 상태 초기화
      this.state.positions = [];
      this.state.openOrders = [];
      this.state.history = [];
      this.state.balanceUSDT = 0;
      this.state.equityUSDT = 0;
      // 입력값/플래그 초기화
      try { if (this.el && this.el.amount) this.el.amount.value = ''; } catch(_) {}
      this.priceTouched = false;
      // UI 즉시 반영
      try { this.renderPositions(); } catch(_) {}
      try { this.renderOrders(); } catch(_) {}
      try { this.renderAccountPanel(); } catch(_) {}
      try { this.renderHistory && this.renderHistory(); } catch(_) {}
    }

    updateAuthLockUI(locked) {
      const disable = (el, flag) => { if (el) el.disabled = !!flag; };
      disable(this.el.amount, locked);
      disable(this.el.price, locked || (document.querySelector('.order-type.active')?.dataset.type === 'market'));
      disable(this.el.percent, locked);
      disable(this.el.btnLong, locked);
      disable(this.el.btnShort, locked);
      // 표시용 잔고 텍스트
      if (this.el.balance) this.el.balance.textContent = locked ? '0' : this.format(this.state.balanceUSDT);
      // trade-panel 전체에 클래스 토글(선택적으로 스타일링 가능)
      const panel = document.querySelector('.trade-panel');
      if (panel) panel.classList.toggle('locked', !!locked);
    }

    setBalanceInMemory(value, { persist = true } = {}) {
      this.state.balanceUSDT = Math.max(0, Number(value) || 0);
      if (persist && !this.guestLocked) this.saveState();
      this.renderAccountPanel();
      this.updateCostPreview();
    }

    async loadUserBalanceFromFirestore() {
      try {
        if (!window.db || !this.user) return;
        const ref = window.db.collection('users').doc(this.user.uid);
        const snap = await ref.get();
        const data = snap && (typeof snap.data === 'function' ? snap.data() : snap.data);
        const pt = data && data.paperTrading;
        if (pt && typeof pt.balanceUSDT === 'number' && isFinite(pt.balanceUSDT)) {
          this.setBalanceInMemory(pt.balanceUSDT, { persist: true });
        } else {
          // 서버에 초기값 기록 (로컬 상태 기준)
          await ref.set({ paperTrading: { balanceUSDT: this.state.balanceUSDT, equityUSDT: this.state.equityUSDT || this.state.balanceUSDT } }, { merge: true });
        }
      } catch (_) {}
    }

    syncUserBalanceDebounced() {
      if (!this.user || !window.db) return;
      clearTimeout(this._syncTimer);
      this._syncTimer = setTimeout(() => this.syncUserBalance(), 1200); // 쿨다운 1.2s
    }

    async syncUserBalance() {
      if (!this.user || !window.db) return;
      let attempts = 0;
      let delay = 400;
      while (attempts < 5) {
        try {
          await window.db.collection('users').doc(this.user.uid).set({
            paperTrading: {
              balanceUSDT: this.state.balanceUSDT,
              equityUSDT: this.state.equityUSDT
            }
          }, { merge: true });
          return;
        } catch (e) {
          attempts++;
          await new Promise(r => setTimeout(r, delay));
          delay = Math.min(10000, delay * 2);
        }
      }
    }

    handleActionClick(side) {
      // 단일 모드: 항상 신규 오더
      if (!this.user) {
        alert('로그인이 필요합니다. 회원만 거래할 수 있습니다.');
        return;
      }
      this.placeOrder(side);
    }

    // Close/부분청산 로직 제거됨 (단일 오픈 모드)

    start() {
      // MarketSockets 사용. 초기 REST 1회만 수행
      this.fetchInitialPrice();
    }

    stop() {
      if (this.priceTimer) clearInterval(this.priceTimer);
    }

    setSymbol(sym) {
      if (!sym) return;
      const compact = sym.replace(/[-:]/g, '').replace(/USDTUSDT/, 'USDT');
      this.state.symbol = compact.endsWith('USDT') ? compact : compact + 'USDT';
      this.el.symbol.textContent = this.state.symbol;
      this.market?.addSymbol?.(this.state.symbol);
      this.saveState();
      this.market.setSymbol(this.state.symbol);
      this.renderDepth();
      // 가격 소켓은 MarketSockets가 관리
      this.priceTouched = false;
      this.fetchInitialPrice();
      // 심볼 변경 시 유지증거금 브래킷 갱신
      this.fetchLeverageBrackets();
    }

    getActivePrice() {
      if (this.el.price.disabled) return this.state.lastPrice;
      const p = Number(this.el.price.value);
      return p > 0 ? p : this.state.lastPrice;
    }

    updateAmountFromPercent() {
      // 자산(지갑 잔고)의 퍼센트를 기반으로 수량 계산
      const percent = Number(this.el.percent.value) / 100;
      const price = this.getActivePrice();
      const lev = this.state.leverage;
      const wallet = Math.max(0, this.state.balanceUSDT);
      const cost = wallet * percent; // 투입 증거금
      const amount = (cost * lev) / Math.max(1e-8, price);
      if (this.el.amount) {
        // 수량 틱 스냅
        const snapped = Math.round(this.toAmount(amount) / AMOUNT_TICK) * AMOUNT_TICK;
        this.el.amount.value = this.toAmount(snapped);
      }
      if (this.el.amountPercent) this.el.amountPercent.value = `${Math.round((percent)*100)}%`;
      this.validateAndPreviewAmount();
      this.updateActionButtonsEnabled();
    }

    updatePercentFromText() {
      const raw = (this.el.amountPercent?.value || '').toString();
      // 공백/문자 제거 → 숫자만 추출
      const cleaned = raw.replace(/[^0-9.]/g, '');
      let p = Number(cleaned);
      if (!isFinite(p)) return;
      p = Math.max(0, Math.min(100, p));
      if (this.el.percent) this.el.percent.value = String(p);
      // 슬라이더 변화와 동일 계산 재사용
      this.updateAmountFromPercent();
      // 표기 정규화
      if (this.el.amountPercent) this.el.amountPercent.value = `${p}%`;
      this.updateActionButtonsEnabled();
    }

    validateAndPreviewAmount() {
      const err = document.getElementById('pt-amount-error');
      const wrap = this.el.amount && this.el.amount.closest('.input-wrap');
      const amt = Number(this.el.amount?.value || 0);
      if (!isFinite(amt) || amt <= 0) {
        if (wrap) wrap.classList.add('error');
        if (err) err.style.display = '';
      } else {
        if (wrap) wrap.classList.remove('error');
        if (err) err.style.display = 'none';
      }
      this.updateCostPreview();
    }

    updateActionButtonsEnabled() {
      const p = Number(this.el.percent?.value || 0);
      const amt = Number(this.el.amount?.value || 0);
      const disabled = this.guestLocked || !isFinite(p) || p <= 0 || !isFinite(amt) || amt <= 0;
      if (this.el.btnLong) this.el.btnLong.disabled = disabled;
      if (this.el.btnShort) this.el.btnShort.disabled = disabled;
    }

    updateCostPreview() {
      const price = this.getActivePrice();
      const amt = Number(this.el.amount.value || 0);
      const lev = this.state.leverage;
      // 퍼센트가 있으면 퍼센트 기반 비용 표시(레버리지와 무관하게 투입 증거금)
      let cost;
      const pStr = this.el.percent && this.el.percent.value;
      const pNum = Number(pStr);
      if (this.el.percent && isFinite(pNum)) {
        const wallet = Math.max(0, this.state.balanceUSDT);
        cost = wallet * (pNum/100);
      } else {
        // 퍼센트 불명확 시 수량 기반 계산
        cost = price * amt / lev;
      }
      if (this.el.balance) this.el.balance.textContent = this.format(this.state.balanceUSDT);
      if (this.el.cost) this.el.cost.textContent = this.format(cost);

      // 수수료 미리보기 (기본: 테이커 수수료 기준)
      try {
        const notional = Math.max(0, price * amt);
        const makerRate = (window.CONFIG?.fees?.maker ?? 0.00025); // 0.025%
        const takerRate = (window.CONFIG?.fees?.taker ?? 0.0006);  // 0.06%
        const makerFee = notional * makerRate;
        const takerFee = notional * takerRate;
        const isMarket = this.el.price && this.el.price.disabled;
        const basis = isMarket ? `Taker (시장가) — ${(takerRate*100).toFixed(3)}%` : `Maker (지정가) — ${(makerRate*100).toFixed(3)}%`;
        const fee = isMarket ? takerFee : makerFee;
        if (this.el.feeBasis) this.el.feeBasis.textContent = basis;
        if (this.el.feeEstimate) this.el.feeEstimate.textContent = this.format(fee);
      } catch(_) {}
    }

    // Close 관련 보조함수 제거됨

    placeOrder(side) {
      if (!this.user) {
        alert('로그인이 필요합니다. 회원만 거래할 수 있습니다.');
        return;
      }
      const amt = Number(this.el.amount.value || 0);
      if (!isFinite(amt) || amt <= 0) { alert('올바른 수량을 입력하세요.'); return; }
      if (amt <= 0) return alert('수량을 입력하세요.');
      const isMarket = this.el.price.disabled;
      const price = this.getActivePrice();
      if (!isFinite(price) || price <= 0) { alert('올바른 가격을 입력하세요.'); return; }
      const lev = this.state.leverage;
      if (isMarket) {
        // OrderEngine 경로로 우선 시도
        if (window.RiskFunding && window.OrderEngine && window.UIRenderer) {
          if (!this._risk) this._risk = new window.RiskFunding({ getState: ()=>this.state, getBrackets: ()=>this._mmrBrackets });
          if (!this._ui) { this._ui = new window.UIRenderer(); this._ui.setFormat((n)=>this.format(n)); }
          if (!this._orders) this._orders = new window.OrderEngine(this.state, this._risk, this._ui);
          const ok = this._orders.placeMarket(side, price, amt);
          if (ok) {
            this.saveState();
            this.syncUserBalance();
            this.renderPositions();
            this.updateCostPreview();
            this.el.amount.value = '';
            this.syncUserBalanceDebounced();
            this.showCenterOrderMessage('order successfully placed');
            return;
          }
        }
        const margin = price * amt / lev;
        const openNotional = price * amt;
        const openFee = openNotional * FEE_TAKER;
        if (margin + openFee > this.state.balanceUSDT + 1e-8) return alert('가용 자산이 부족합니다.');
        const pos = {
          id: 'pos_' + Date.now(),
          symbol: this.state.symbol,
          side,
          entry: price,
          amount: amt,
          leverage: lev,
          margin,
          mode: this.state.marginMode,
        };
        this.state.balanceUSDT -= (margin + openFee);
        this.state.positions.push(pos);
        this.saveState();
        this.syncUserBalance(); // 체결 즉시 1회 동기화
        // history는 OrderEngine에 위임됨
        try { window.TradeNotifier && window.TradeNotifier.notify({
          title: `Open ${side==='long'?'Long':'Short'} ${this.state.symbol} ${this.state.marginMode==='cross'?'Cross':'Isolated'} · ${this.state.leverage}x`,
          subtitle: 'Perp · Filled',
          price,
          amount: amt,
          mode: this.state.marginMode,
          leverage: this.state.leverage,
          type: 'success',
        }); } catch(_) {}
        this.renderPositions();
        this.updateCostPreview();
        this.el.amount.value = '';
        this.syncUserBalanceDebounced();
        this.showCenterOrderMessage('order successfully placed');
      } else {
        if (!this._risk) this._risk = new window.RiskFunding({ getState: ()=>this.state, getBrackets: ()=>this._mmrBrackets });
        if (!this._ui) { this._ui = new window.UIRenderer(); this._ui.setFormat((n)=>this.format(n)); }
        if (!this._orders) this._orders = new window.OrderEngine(this.state, this._risk, this._ui);
        const order = this._orders.placeLimit(side, price, amt);
        this.saveState();
        this.syncUserBalance(); // 즉시 동기화
        this.renderOrders();
        this.el.amount.value = '';
        // 알림 창 제거 (요청)
        if (order) this.showCenterOrderMessage('order successfully placed');
      }
    }

    closePosition(id) {
      const idx = this.state.positions.findIndex((p) => p.id === id);
      if (idx === -1) return;
      const p = this.state.positions[idx];
      const price = this.state.lastPrice || p.entry;
      const pnl = this.calcPnL(p, price);
      const closeFee = Math.max(0, price * p.amount * FEE_TAKER);
      this.state.balanceUSDT += Math.max(0, p.margin + pnl - closeFee);
      this.state.positions.splice(idx, 1);
      this.saveState();
      // history record - Market Close
      this.state.history.unshift({ id:'his_'+Date.now(), ts:Date.now(), symbol:p.symbol, mode:p.mode, leverage:p.leverage, direction: p.side==='long'?'Close Long':'Close Short', type:'Market', avgPrice:price, orderPrice:price, filled:p.amount, fee: closeFee, pnl });
      if (this.state.history.length>500) this.state.history.length=500;
      // ONBIT 채굴: 수익/손실 모두 규칙에 따라 적립 (실시간 잔고 갱신 이벤트 발생)
      try { if (window.onbitMiner && this.user && pnl !== 0) {
        window.onbitMiner.awardForProfit(pnl);
      } } catch(_) {}
      try { window.TradeNotifier && window.TradeNotifier.notify({
        title: `Close ${p.side==='long'?'Long':'Short'} ${p.symbol} ${p.mode==='cross'?'Cross':'Isolated'} · ${p.leverage}x`,
        subtitle: 'Market · Filled',
        price,
        amount: p.amount,
        mode: p.mode,
        leverage: p.leverage,
        type: pnl>=0?'success':'warn',
      }); } catch(_) {}
      this.renderPositions();
      this.updateCostPreview();
      this.syncUserBalanceDebounced();
    }

    closeAll() {
      const price = this.state.lastPrice;
      const closed = [...this.state.positions];
      let total = 0;
      for (const p of closed) {
        const pnl = this.calcPnL(p, price);
        const closeFee = Math.max(0, price * p.amount * FEE_TAKER);
        total += Math.max(0, p.margin + pnl - closeFee);
        // history per position
        this.state.history.unshift({ id:'his_'+Date.now()+Math.random(), ts:Date.now(), symbol:p.symbol, mode:p.mode, leverage:p.leverage, direction: p.side==='long'?'Close Long':'Close Short', type:'Market', avgPrice:price, orderPrice:price, filled:p.amount, fee: closeFee, pnl });
        if (this.state.history.length>500) this.state.history.length=500;
        // notify per position
        try { window.TradeNotifier && window.TradeNotifier.notify({
          title: `Close ${p.side==='long'?'Long':'Short'} ${p.symbol} ${p.mode==='cross'?'Cross':'Isolated'} · ${p.leverage}x`,
          subtitle: 'Market · Filled',
          price,
          amount: p.amount,
          mode: p.mode,
          leverage: p.leverage,
          type: pnl>=0?'success':'warn',
        }); } catch(_) {}
        // ONBIT 채굴 (배치 청산에서도 각 포지션별 적용)
        try { if (window.onbitMiner && this.user && pnl !== 0) {
          window.onbitMiner.awardForProfit(pnl);
        } } catch(_) {}
      }
      this.state.balanceUSDT += total;
      this.state.positions = [];
      this.saveState();
      this.renderPositions();
      this.updateCostPreview();
      this.syncUserBalanceDebounced();
    }

    calcPnL(p, price) {
      const diff = p.side === 'long' ? price - p.entry : p.entry - price;
      return diff * p.amount;
    }

    calcEffectiveLeverage(p) {
      // 격리: 실제 마진 기준, 교차: 가용 잔고로 유지증거금 보강
      const notional = p.entry * p.amount;
      if (p.mode === 'isolated') {
        const im = Math.max(1e-8, p.margin);
        return Math.max(1, notional / im);
      } else {
        const crossMargin = Math.max(1e-8, p.margin + Math.max(0, this.state.balanceUSDT));
        return Math.max(1, notional / crossMargin);
      }
    }

    calcLiqPrice(p) {
      // 유지증거금 = notional(price) × mmr
      // 가용자금(available) = (격리) p.margin + uPnL(price) - fee(price)
      //                     = (교차) (p.margin + wallet) + uPnL(price) - fee(price)
      // 롱 uPnL(price) = (price - entry) * amount
      // 숏 uPnL(price) = (entry - price) * amount
      // fee(price) ≈ notional(price) × taker_fee (보수적 추정)
      //
      // 롱 격리: p.margin + (P - e)A - f P A = mmr P A
      //   => p.margin - eA + P A (1 - f - mmr) = 0
      //   => P = (eA - p.margin) / (A (1 - f - mmr))
      // 숏 격리: p.margin + (e - P)A - f P A = mmr P A
      //   => p.margin + eA = P A (1 + f + mmr)
      //   => P = (p.margin + eA) / (A (1 + f + mmr))
      // 교차는 p.margin 대신 (p.margin + wallet)을 사용 (간이 근사)
      try {
        const e = Number(p.entry);
        const A = Math.max(1e-12, Number(p.amount));
        const f = Number(FEE_TAKER);
        const mmr = Number(this.getMaintenanceRate(p));
        const wallet = Math.max(0, this.state.balanceUSDT || 0);
        const base = p.mode === 'isolated' ? Number(p.margin) : Number(p.margin) + wallet;
        const denomLong = A * (1 - f - mmr);
        const denomShort = A * (1 + f + mmr);
        if (p.side === 'long') {
          if (denomLong > 1e-12) {
            const P = (e * A - base) / denomLong;
            if (isFinite(P) && P > 0) return P;
          }
        } else {
          if (denomShort > 1e-12) {
            const P = (base + e * A) / denomShort;
            if (isFinite(P) && P > 0) return P;
          }
        }
        // Fallback: 유효하지 않으면 유효레버리지 기반 간단 근사식 사용
        const Lf = Math.max(1.0001, Number(p.leverage) || 1);
        if (p.side === 'long') return Math.max(1e-6, e * (1 - 1 / Lf));
        return Math.max(1e-6, e * (1 + 1 / Lf));
      } catch (_) { return NaN; }
    }

    getMaintenanceRate(p) {
      // 1) 실데이터 브래킷 우선 사용 (명목가 상한 cap 기준)
      try {
        if (this._mmrBrackets && this._mmrBrackets.length) {
          const notional = Math.max(0, (this.state.lastPrice || p.entry) * p.amount);
          let mmr = this._mmrBrackets[0].mmr;
          for (const b of this._mmrBrackets) {
            if (!isFinite(b.cap) || b.cap <= 0) { mmr = b.mmr; break; }
            if (notional <= b.cap) { mmr = b.mmr; break; }
            mmr = b.mmr; // 넘어가면 다음 티어로 갱신
          }
          if (isFinite(mmr) && mmr > 0) return mmr;
        }
      } catch (_) {}
      // 2) 폴백: 레버리지 기반 근사 (0.25%~0.8%)
      const L = Math.max(1, p.leverage);
      const initialMarginRate = 1 / L;
      const scaled = initialMarginRate * 0.6;
      return Math.max(0.0025, Math.min(0.008, scaled));
    }

    updatePnL() {
      const now = performance.now();
      this.state.equityUSDT = this.state.balanceUSDT + this.state.positions.reduce((acc, p) => acc + this.calcPnL(p, this.state.lastPrice), 0);
      // Limit 체결 매칭을 OrderEngine로 위임
      if (!this._risk) this._risk = new (window.RiskFunding||function(){})({ getState: ()=>this.state, getBrackets: ()=>this._mmrBrackets });
      if (!this._ui) { this._ui = new (window.UIRenderer||function(){})(); this._ui.setFormat && this._ui.setFormat((n)=>this.format(n)); }
      if (!this._orders) this._orders = new (window.OrderEngine||function(){ })(this.state, this._risk, this._ui);
      const filled = this._orders.matchOpenOrders(this.state.lastPrice);
      if (filled > 0) {
        // 신규 체결 즉시 보유 포지션 테이블 재생성
        this.renderPositions();
      }
      // 청산 체크 (가격 변동 시)
      const didLiq = this._risk.checkLiquidations ? this._risk.checkLiquidations() : this.checkLiquidations();
      if (didLiq) {
        this.renderPositions();
      }
      if (this._risk.applyFundingIfDue) {
        const changed = this._risk.applyFundingIfDue();
        if (changed) { this.saveState(); this.syncUserBalanceDebounced && this.syncUserBalanceDebounced(); }
      } else {
        this.applyFundingIfDue();
      }
      if (now - this._lastPnlRender > 150) { // 150ms 스로틀
        this._lastPnlRender = now;
        // 포지션 기반 실시간 채굴 예상 누적 → 잔고 패널에 반영 (UI 표시용)
        try {
          let minedPreview = 0;
          for (const pos of this.state.positions) {
            const pnl = this.calcPnL(pos, this.state.lastPrice);
            const rate = pnl > 0 ? 1.0 : (pnl < 0 ? 0.1 : 0);
            minedPreview += Math.abs(pnl) * rate;
          }
          this._onbitPreview = minedPreview;
          const base = (typeof this._onbitBase === 'number') ? this._onbitBase : ((window.onbitMiner && Number.isFinite(window.onbitMiner.current)) ? Number(window.onbitMiner.current) : 0);
          const total = base + minedPreview;
          this.updateOnbitDisplay(total);
        } catch(_) {}
        this.renderPositionsValuesOnly();
        this.renderAccountPanel();
      }
    }

    updateOnbitDisplay(total) {
      try {
        const el = document.getElementById('acc-onbit');
        if (!el) return;
        const prev = (typeof el.__rollingPrev === 'number') ? el.__rollingPrev : Number(total || 0);
        el.__rollingPrev = Number(total || 0);
        this.animateNumber(el, prev, Number(total || 0), 600, (v)=> `${Number(v).toFixed(3)} ONBIT`);
        el.style.color = 'var(--primary-color)';
      } catch (_) {}
    }

    showCenterOrderMessage(text = 'order successfully placed') {
      try {
        let el = document.getElementById('center-order-msg');
        if (!el) {
          el = document.createElement('div');
          el.id = 'center-order-msg';
          el.setAttribute('aria-live', 'polite');
          el.style.position = 'fixed';
          el.style.left = '50%';
          el.style.top = '20%';
          el.style.transform = 'translate(-50%, -50%)';
          el.style.padding = '12px 18px';
          el.style.borderRadius = '10px';
          // 테마 변수 사용
          el.style.background = 'var(--card-bg)';
          el.style.border = '1px solid var(--border-color)';
          el.style.color = 'var(--text-color)';
          el.style.fontWeight = '700';
          el.style.fontSize = '16px';
          el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
          el.style.pointerEvents = 'none';
          el.style.opacity = '0';
          el.style.transition = 'opacity 200ms ease, transform 200ms ease';
          document.body.appendChild(el);
        }
        el.textContent = text;
        // show
        requestAnimationFrame(() => {
          el.style.opacity = '1';
          el.style.transform = 'translate(-50%, -50%) scale(1)';
        });
        // hide after 1.5s
        clearTimeout(el.__timer);
        el.__timer = setTimeout(() => {
          el.style.opacity = '0';
          el.style.transform = 'translate(-50%, -50%) scale(0.98)';
        }, 1500);
      } catch (_) {}
    }

    applyFundingIfDue() {
      const now = Date.now();
      if (!this.state.lastFundingTs) this.state.lastFundingTs = now;
      if (now - this.state.lastFundingTs < FUNDING_INTERVAL_MS) return;
      const rate = Number(this.state.fundingRate || 0);
      if (!isFinite(rate) || this.state.positions.length === 0) {
        this.state.lastFundingTs = now;
        return;
      }
      const mark = this.state.lastPrice || 0;
      let changed = false;
      for (const p of this.state.positions) {
        const notional = Math.max(0, mark * p.amount);
        if (notional <= 0) continue;
        const base = notional * Math.abs(rate);
        const flow = (rate > 0)
          ? (p.side === 'long' ? -base : +base)
          : (p.side === 'long' ? +base : -base);
        if (p.mode === 'isolated') {
          p.margin = Math.max(0, p.margin + flow);
        } else {
          this.state.balanceUSDT += flow;
        }
        this.state.history.unshift({ id:'his_'+Date.now()+Math.random(), ts:now, symbol:p.symbol, mode:p.mode, leverage:p.leverage, direction: 'Funding', type:'Funding', avgPrice:mark, orderPrice:mark, filled:p.amount, fee:0, pnl: flow });
        if (this.state.history.length>500) this.state.history.length=500;
        changed = true;
      }
      this.state.lastFundingTs = now;
      if (changed) {
        this.saveState();
        this.syncUserBalanceDebounced && this.syncUserBalanceDebounced();
      }
    }

    checkLiquidations() {
      let liqCount = 0;
      const mark = this.state.lastPrice || 0;
      const totalUPnL = this.state.positions.reduce((s, x) => s + this.calcPnL(x, mark), 0);
      const remain = [];
      for (const p of this.state.positions) {
        const notional = Math.max(0, mark * p.amount);
        const maintRate = this.getMaintenanceRate(p);
        const maintMargin = notional * maintRate;
        const feeEst = notional * FEE_TAKER;
        const pnl = this.calcPnL(p, mark);
        let available;
        if (p.mode === 'isolated') {
          available = p.margin + pnl - feeEst;
        } else {
          // 교차: 지갑 잔고 + 전체 uPnL로 충당
          available = this.state.balanceUSDT + totalUPnL - feeEst;
        }
        const deficit = available - maintMargin;
        if (deficit < -1e-8) {
          // 청산: 마크가로 정산 처리 + 히스토리
          const liqFee = Math.max(0, mark * p.amount * FEE_TAKER);
          this.state.balanceUSDT += Math.max(0, p.margin + pnl - liqFee);
          this.state.history.unshift({ id:'his_'+Date.now(), ts:Date.now(), symbol:p.symbol, mode:p.mode, leverage:p.leverage, direction: 'Forced '+(p.side==='long'?'Long':'Short'), type:'Market', avgPrice:mark, orderPrice:mark, filled:p.amount, fee: liqFee, pnl });
          if (this.state.history.length>500) this.state.history.length=500;
          liqCount++;
        } else {
          remain.push(p);
        }
      }
      if (liqCount > 0) {
        this.state.positions = remain;
        this.saveState();
      }
      return liqCount;
    }

    matchOpenOrders() {
      if (!Array.isArray(this.state.openOrders) || this.state.openOrders.length === 0) return 0;
      const price = this.state.lastPrice || 0;
      const next = [];
      let filledCount = 0;
      for (const o of this.state.openOrders) {
        const shouldFill = (o.side === 'long') ? (price <= o.price + 1e-8) : (price >= o.price - 1e-8);
        if (shouldFill) {
          const margin = o.price * o.amount / o.leverage;
          const openNotional = o.price * o.amount;
          const openFee = openNotional * FEE_MAKER;
          if (margin + openFee > this.state.balanceUSDT + 1e-8) {
            // 잔고 부족 시 유지
            next.push(o);
            continue;
          }
          const pos = {
            id: 'pos_' + Date.now(),
            symbol: o.symbol,
            side: o.side,
            entry: o.price,
            amount: o.amount,
            leverage: o.leverage,
            margin,
            mode: o.mode,
          };
          this.state.balanceUSDT -= (margin + openFee);
          this.state.positions.push(pos);
          filledCount++;
          // history record - Limit Fill
          this.state.history.unshift({ id:'his_'+Date.now(), ts:Date.now(), symbol:o.symbol, mode:o.mode, leverage:o.leverage, direction: o.side==='long'?'Open Long':'Open Short', type:'Limit', avgPrice:o.price, orderPrice:o.price, filled:o.amount, fee: openFee, pnl:null });
          if (this.state.history.length>500) this.state.history.length=500;
          try { window.TradeNotifier && window.TradeNotifier.notify({
            title: `Open ${o.side==='long'?'Long':'Short'} ${o.symbol} ${o.mode==='cross'?'Cross':'Isolated'} · ${o.leverage}x`,
            subtitle: 'Limit · Filled',
            price: o.price,
            amount: o.amount,
            mode: o.mode,
            leverage: o.leverage,
            type: 'success',
          }); } catch(_) {}
          this.syncUserBalanceDebounced();
        } else {
          next.push(o);
        }
      }
      this.state.openOrders = next;
      this.renderOrders();
      this.saveState();
      return filledCount;
    }

    renderOrders() {
      if (!this.el.ordersTableBody) return;
      const rows = (this.state.openOrders || []).map(o => `
        <div class="row" data-id="${o.id}">
          <div class="cell-pair"><div class="pair">${o.symbol} Perp</div><div class="tags"><span class="chip">${o.mode==='cross'?'Cross':'Isolated'}</span><span class="chip">${o.leverage}x</span></div></div>
          <div>${new Date(o.createdAt||Date.now()).toLocaleString()}</div>
          <div>Limit</div>
          <div class="dir ${o.side}">${o.side==='long'?'Open Long':'Open Short'}</div>
          <div>--</div>
          <div>0.0000 BTC<br/>${o.amount.toFixed(4)} BTC</div>
          <div>--</div>
          <div>${this.format(o.price)}</div>
          <div>${this.format(o.price * o.amount / o.leverage)} USDT</div>
          <div>0.0000</div>
          <div><button class="cancel" data-id="${o.id}">Cancel</button></div>
        </div>
      `).join('');
      this.el.ordersTableBody.innerHTML = rows || '<div style="padding:12px; color:var(--text-color-secondary)">오픈 오더 없음</div>';
      this.el.ordersTableBody.querySelectorAll('button.cancel').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          this.state.openOrders = (this.state.openOrders || []).filter(o => o.id !== id);
          this.saveState();
          this.renderOrders();
        });
      });
    }

    render() {
      this.setSymbol(this.state.symbol);
      this.startOrderbook();
      this.renderDepth();
      this.renderPositions();
      this.updateCostPreview();
      this.renderPrices();
      this.renderAccountPanel();
      this.renderHistory && this.renderHistory();
      this.fetchLeverageBrackets();
    }

    async fetchLeverageBrackets() {
      try {
        const sym = (this.state.symbol || 'BTCUSDT').toUpperCase();
        // 캐시 확인
        try {
          const cached = JSON.parse(localStorage.getItem('pt_mmr_'+sym)||'null');
          if (cached && cached.at && (Date.now()-cached.at < MMR_TTL)) {
            this._mmrBrackets = cached.brackets;
            return;
          }
        } catch(_) {}
        const res = await fetch(CONFIG.leverageBracketRest(sym));
        if (!res.ok) return;
        const data = await res.json();
        // 응답 형태: [{ symbol, brackets:[{ notionalCap, maintMarginRatio, ... }] }]
        const item = Array.isArray(data) ? data[0] : data;
        const brackets = (item && item.brackets) ? item.brackets.map(b => ({
          cap: Number(b.notionalCap),
          mmr: Number(b.maintMarginRatio)
        })) : null;
        if (brackets && brackets.length) {
          this._mmrBrackets = brackets;
          try { localStorage.setItem('pt_mmr_'+sym, JSON.stringify({ at: Date.now(), brackets })); } catch(_) {}
        }
      } catch (_) {}
    }

    renderPrices() {
      if (this.el.lastPrice) {
        const prev = this.prev.lastPrice;
        // 자연스러운 롤링 애니메이션 적용 (1자리 고정)
        this.renderRollingNumber(this.el.lastPrice, Number(this.state.lastPrice || 0), 1);
        this.prev.lastPrice = this.state.lastPrice;
      }
      if (this.el.mid) {
        // 오더북 중앙가도 부드럽게
        this.renderRollingNumber(this.el.mid, Number(this.state.lastPrice || 0), 1);
      }
      if (this.el.price && !this.el.price.disabled && !this.priceTouched) {
        if (!this.el.price.value) this.el.price.value = (this.state.lastPrice || 0).toFixed(1);
      }
    }

    // 가격 소켓은 MarketSockets가 관리

    // 새로고침 직후 즉시 1회 가격 갱신 (REST, Futures)
    async fetchInitialPrice() {
      try {
        const sym = (this.state.symbol || 'BTCUSDT').toUpperCase();
        if (this._priceAbort) { try { this._priceAbort.abort(); } catch(_) {} }
        this._priceAbort = new AbortController();
        const res = await fetch(CONFIG.tickerRest(sym), { signal: this._priceAbort.signal });
        if (!res.ok) return;
        const m = await res.json();
        const bid = parseFloat(m.bidPrice || m.b);
        const ask = parseFloat(m.askPrice || m.a);
        if (isFinite(bid) && isFinite(ask)) {
          const mid = (bid + ask) / 2;
          this.state.lastPrice = mid;
          this.renderPrices();
          this.updatePnL();
          this.firstPriceReceived = true;
        }
      } catch {}
    }

    async fetchDepth() {
      try {
        if (this._depthAbort) { try { this._depthAbort.abort(); } catch(_) {} }
        this._depthAbort = new AbortController();
        const res = await fetch(CONFIG.depthRest(this.state.symbol, 25), { signal: this._depthAbort.signal });
        if (!res.ok) throw new Error('depth ' + res.status);
        const data = await res.json();
        return data;
      } catch (e) {
        return null;
      }
    }

    async renderDepth() {
      const rowsEl = document.getElementById('orderbook-rows');
      const buyBar = document.getElementById('ob-buy-bar');
      const sellBar = document.getElementById('ob-sell-bar');
      const buyRatioEl = document.getElementById('ob-buy-ratio');
      const sellRatioEl = document.getElementById('ob-sell-ratio');
      if (!rowsEl) return;
      let { asks, bids } = this.orderbookState;
      // 최초 로드 시 REST로 보충
      if (!asks.length || !bids.length) {
        const depth = await this.fetchDepth();
        if (!depth) return;
        const norm = (arr) => (arr || [])
          .filter(x => Array.isArray(x) && x.length >= 2)
          .map(([p, q]) => ({ price: Number(p), size: Number(q) }))
          .filter(x => Number.isFinite(x.price) && Number.isFinite(x.size) && x.size > 0);
        asks = norm(depth.asks);
        bids = norm(depth.bids);
      }

      // 고정 라더 중앙 가격 설정/유지
      const tick = this.ladderTick;
      const last = Number(this.state.lastPrice || (asks[0]?.price || bids[0]?.price || 0));
      if (!this.ladderCenter) {
        this.ladderCenter = Math.round(last / tick) * tick;
      } else {
        const span = tick * (this.ladderLevels - 2);
        if (last > this.ladderCenter + span || last < this.ladderCenter - span) {
          this.ladderCenter = Math.round(last / tick) * tick;
        }
      }

      // 버킷 맵 구축 (0.1단위)
      const askBuckets = new Map();
      for (const r of asks) {
        const bp = Math.ceil(r.price / tick) * tick;
        const k = bp.toFixed(1);
        const v = Number(r.size);
        if (isFinite(v) && v > 0) askBuckets.set(k, (askBuckets.get(k) || 0) + v);
      }
      const bidBuckets = new Map();
      for (const r of bids) {
        const bp = Math.floor(r.price / tick) * tick;
        const k = bp.toFixed(1);
        const v = Number(r.size);
        if (isFinite(v) && v > 0) bidBuckets.set(k, (bidBuckets.get(k) || 0) + v);
      }

      // 가용 높이에 딱 맞는 행 수 계산 → 빈칸 방지
      const table = rowsEl.parentElement; // .orderbook-table
      const headerEl = table?.querySelector('.ob-header');
      const footerEl = table?.querySelector('.ob-footer');
      const rowsBoxH = rowsEl.clientHeight || (table ? Math.max(0, table.clientHeight - (headerEl?.clientHeight || 0) - (footerEl?.clientHeight || 0)) : 0);
      const cssRowH = table ? parseFloat(getComputedStyle(table).getPropertyValue('--ob-row-h')) : NaN;
      const rowH = Number.isFinite(cssRowH) && cssRowH > 0 ? cssRowH : 24;
      let capacity = rowsBoxH > 0 ? Math.max(9, Math.floor(rowsBoxH / rowH)) : 31; // 최소 9행(ASK x4 + MID + BID x4)
      // 홀수 강제: 중앙가 1행 포함 위해
      if (capacity % 2 === 0) capacity -= 1;
      const topCount = Math.max(1, Math.floor((capacity - 1) / 2));
      const bottomCount = Math.max(1, capacity - 1 - topCount);

      // 고정 가격 라더 생성 (계산된 행 수에 맞춤)
      const asksPrices = Array.from({ length: topCount }, (_, i) => Number((this.ladderCenter + tick * (i + 1)).toFixed(1)));
      const bidsPrices = Array.from({ length: bottomCount }, (_, i) => Number((this.ladderCenter - tick * (i + 1)).toFixed(1)));

      // 누적 합/총합 계산: Web Worker가 있으면 위임 (버킷 시그니처 동일 시 스킵)
      let askSizes, bidSizes, askCumMax, bidCumMax;
      if (this._obWorker) {
        const bucketSig = `${asksPrices[0]}-${asksPrices[asksPrices.length-1]}|${bidsPrices[0]}-${bidsPrices[bidsPrices.length-1]}|A${askBuckets.size}|B${bidBuckets.size}`;
        if (bucketSig !== this._obBucketSig) {
          this._obBucketSig = bucketSig;
          this._obLastPriceArrays = { asksPrices, bidsPrices };
          this._obWorker.postMessage({
            asksPrices,
            bidsPrices,
            askBuckets: Array.from(askBuckets.entries()),
            bidBuckets: Array.from(bidBuckets.entries())
          });
          // draw는 worker onmessage에서 실행됨
          return;
        }
        // 시그니처 동일: 동기 계산로 즉시 갱신 (worker 응답 대기하지 않음)
        askSizes = asksPrices.map(p => Number((askBuckets.get(p.toFixed(1)) || 0).toFixed(4)));
        bidSizes = bidsPrices.map(p => Number((bidBuckets.get(p.toFixed(1)) || 0).toFixed(4)));
        askCumMax = Math.max(1, askSizes.reduce((a,b)=>a+b,0));
        bidCumMax = Math.max(1, bidSizes.reduce((a,b)=>a+b,0));
      } else {
        askSizes = asksPrices.map(p => Number((askBuckets.get(p.toFixed(1)) || 0).toFixed(4)));
        bidSizes = bidsPrices.map(p => Number((bidBuckets.get(p.toFixed(1)) || 0).toFixed(4)));
        askCumMax = Math.max(1, askSizes.reduce((a,b)=>a+b,0));
        bidCumMax = Math.max(1, bidSizes.reduce((a,b)=>a+b,0));
      }

      // 렌더 (DOM 재사용)
      this.drawOrderbook(asksPrices, bidsPrices, askSizes, bidSizes, askCumMax, bidCumMax);
    }

    drawOrderbook(asksPrices, bidsPrices, askSizes, bidSizes, askCumMax, bidCumMax) {
      const rowsEl = document.getElementById('orderbook-rows');
      if (!rowsEl) return;
      // 비율 바/표시 DOM 캐시 (1회)
      if (!this._ratioEls) {
        this._ratioEls = {
          buyBar: document.getElementById('ob-buy-bar'),
          sellBar: document.getElementById('ob-sell-bar'),
          buyRatioEl: document.getElementById('ob-buy-ratio'),
          sellRatioEl: document.getElementById('ob-sell-ratio'),
        };
      }
      const { buyBar, sellBar, buyRatioEl, sellRatioEl } = this._ratioEls || {};

      // 라더 프라이스 세트가 바뀌면 DOM을 재구성하도록 신호
      // 라더 프라이스 경계값으로 간단한 서명(첫/마지막 값)만 비교해 비용 절감
      const sig = `A:${asksPrices[0]}-${asksPrices[asksPrices.length-1]}|B:${bidsPrices[0]}-${bidsPrices[bidsPrices.length-1]}`;
      if (this._obLadderSig !== sig) {
        this._obLadderSig = sig;
        this._obMounted = false;
        this._obRowCache.clear();
      }
      // 렌더 (DOM 재사용)
      if (!this._obMounted) {
        rowsEl.innerHTML = '';
        this._obMounted = true;
        this._obRowCache.clear();
      }
      const rows = [];
      let totalAsk = 0, totalBid = 0;
      // 상단: ASK (가격 높음→낮음) 고정 갯수
      for (let i = asksPrices.length - 1; i >= 0; i--) {
        const price = asksPrices[i];
        const sz = askSizes[i] || 0;
        totalAsk += sz;
        const ratio = Math.min(1, totalAsk / askCumMax);
        const w = Math.round(ratio * 100);
        rows.push(`<div class=\"ob-row ask\" data-key=\"ask-${price.toFixed(1)}\" data-cum-size=\"${totalAsk}\" data-cum-notional=\"${(totalAsk*price).toFixed(2)}\" data-price=\"${price}\"><div class=\"bar\" style=\"background:#ef4444; width:${w}%; right:0; transition:width 180ms ease;\"></div><div class=\"price\">${this.format(price)}</div><div class=\"qty\" data-prev=\"${sz.toFixed(4)}\">${sz.toFixed(4)}</div><div class=\"total\" data-prev=\"${totalAsk.toFixed(4)}\">${totalAsk.toFixed(4)}</div></div>`);
      }
      rows.push(`<div class=\"ob-row mid\" data-key=\"mid\" style=\"position:sticky; top:0; background:var(--card-bg); font-weight:700;\"><div class=\"price\">${this.format(this.state.lastPrice)}</div><div></div><div></div></div>`);
      // 하단: BID (가격 낮음→높음) 고정 갯수
      for (let i = 0; i < bidsPrices.length; i++) {
        const price = bidsPrices[i];
        const sz = bidSizes[i] || 0;
        totalBid += sz;
        const ratio = Math.min(1, totalBid / bidCumMax);
        const w = Math.round(ratio * 100);
        rows.push(`<div class=\"ob-row bid\" data-key=\"bid-${price.toFixed(1)}\" data-cum-size=\"${totalBid}\" data-cum-notional=\"${(totalBid*price).toFixed(2)}\" data-price=\"${price}\"><div class=\"bar\" style=\"background:#10b981; width:${w}%; right:0; transition:width 180ms ease;\"></div><div class=\"price\">${this.format(price)}</div><div class=\"qty\" data-prev=\"${sz.toFixed(4)}\">${sz.toFixed(4)}</div><div class=\"total\" data-prev=\"${totalBid.toFixed(4)}\">${totalBid.toFixed(4)}</div></div>`);
      }
      // 초기 마운트 시에만 DOM 생성, 이후에는 해당 키만 갱신
      if (rowsEl.children.length === 0) {
        rowsEl.innerHTML = rows.join('');
        // 캐시 구축
        rowsEl.querySelectorAll('.ob-row').forEach((el) => {
          const key = el.getAttribute('data-key');
          if (key) this._obRowCache.set(key, el);
        });
      } else {
        // 값만 갱신
        const updateRow = (key, price, qty, cumSize, width, color) => {
          let el = this._obRowCache.get(key);
          if (!el) return; // 라더 리셋시 초기화됨
          el.setAttribute('data-cum-size', String(cumSize));
          el.setAttribute('data-cum-notional', String((cumSize*price).toFixed(2)));
          const bar = el.querySelector('.bar');
          const priceEl = el.querySelector('.price');
          const qtyEl = el.querySelector('.qty');
          const totalEl = el.querySelector('.total');
          if (bar) { bar.style.transition = 'width 180ms ease'; bar.style.width = width + '%'; if (color) bar.style.background = color; }
          if (priceEl) priceEl.textContent = this.format(price);
          if (qtyEl) {
            const prev = Number(qtyEl.getAttribute('data-prev') || '0');
            qtyEl.setAttribute('data-prev', String(qty||0));
            this.animateNumber(qtyEl, prev, Number(qty||0), 200, (v)=> Number(v).toFixed(4));
          }
          if (totalEl) {
            const prevT = Number(totalEl.getAttribute('data-prev') || '0');
            totalEl.setAttribute('data-prev', String(cumSize||0));
            this.animateNumber(totalEl, prevT, Number(cumSize||0), 220, (v)=> Number(v).toFixed(4));
          }
        };
        // 상단 ASK 역순으로 다시 계산된 배열 기반 갱신
        let runningAsk = 0;
        for (let i = asksPrices.length - 1; i >= 0; i--) {
          const price = asksPrices[i];
          const sz = askSizes[i] || 0;
          runningAsk += sz;
          const ratio = Math.min(1, runningAsk / askCumMax);
          const w = Math.round(ratio * 100);
          updateRow(`ask-${price.toFixed(1)}`, price, sz, runningAsk, w, '#ef4444');
        }
        // 중앙
        const mid = this._obRowCache.get('mid');
        if (mid) {
          const priceEl = mid.querySelector('.price');
          if (priceEl) this.renderRollingNumber(priceEl, Number(this.state.lastPrice || 0), 1);
        }
        // 하단 BID
        let runningBid = 0;
        for (let i = 0; i < bidsPrices.length; i++) {
          const price = bidsPrices[i];
          const sz = bidSizes[i] || 0;
          runningBid += sz;
          const ratio = Math.min(1, runningBid / bidCumMax);
          const w = Math.round(ratio * 100);
          updateRow(`bid-${price.toFixed(1)}`, price, sz, runningBid, w, '#10b981');
        }
      }

      // 부드러운 업데이트를 위해 다음 프레임에 강제 리플로우 → 트랜지션 적용
      requestAnimationFrame(() => {
        rowsEl.querySelectorAll('.ob-row .bar').forEach((el) => {
          el.getBoundingClientRect();
        });
      });

      const sumB = Number(bidSizes.reduce((a,b)=>a+b,0).toFixed(4));
      const sumS = Number(askSizes.reduce((a,b)=>a+b,0).toFixed(4));
      const total = sumB + sumS || 1;
      const bRatio = Math.round((sumB/total)*100);
      const sRatio = 100 - bRatio;
      if (buyBar && sellBar) {
        buyBar.style.width = bRatio + '%';
        sellBar.style.width = sRatio + '%';
      }
      if (buyRatioEl) buyRatioEl.textContent = String(bRatio);
      if (sellRatioEl) sellRatioEl.textContent = String(sRatio);
    }

    startOrderbook() {
      // 폴링 제거, 소켓 기반으로 전환하여 틱틱 움직이게
      this.stopOrderbookSocket?.();
      this.startOrderbookSocket?.();
    }

    stopOrderbookSocket() {
      try { this.orderbookSocket && this.orderbookSocket.close(); } catch(_) {}
      this.orderbookSocket = null;
    }

    startOrderbookSocket() {
      const sym = (this.state.symbol || 'BTCUSDT').toLowerCase();
      const url = CONFIG.orderbookDepthStream(sym);
      try { this.orderbookSocket && this.orderbookSocket.close(); } catch(_) {}
      let ws;
      try { ws = new WebSocket(url); } catch (e) { console.warn('OB socket create failed', e); return; }
      this.orderbookSocket = ws;
      let rafId = 0;
      const schedule = () => {
        // 디바운스 제거, rAF로만 묶어서 즉시 다음 프레임에 렌더
        if (this._rafQueued) return;
        this._rafQueued = true;
        rafId = requestAnimationFrame(() => { this._rafQueued = false; this.renderDepth(); });
      };
      let lastFrame = 0;
      ws.onmessage = (ev) => {
        const now = performance.now();
        const MIN_INTERVAL = 33; // ~30fps
        if (now - lastFrame < MIN_INTERVAL) return;
        lastFrame = now;
        try {
          const text = ev.data;
          // 간단 해시로 동일 메시지 중복 처리 방지
          const hash = (typeof text === 'string') ? (text.length + ':' + text.charCodeAt(0) + ':' + text.charCodeAt(text.length-1)) : '';
          if (hash && hash === this._obLastMsgHash) { return; }
          this._obLastMsgHash = hash;

          const m = typeof text === 'string' ? JSON.parse(text) : text;
          // diff-merge: 기존 맵 업데이트 (가격수준만 수정)
          const toMap = (arr, isBid) => {
            const map = new Map();
            for (const it of arr || []) { const p = Number(it[0]); const q = Number(it[1]); if (isFinite(p) && isFinite(q)) map.set(p, q); }
            return map;
          };
          const bidsMap = toMap(m.b, true);
          const asksMap = toMap(m.a, false);
          // 기존 상태 반영
          const mergeSide = (prevArr, patchMap) => {
            const out = new Map();
            for (const r of prevArr || []) { out.set(r.price, r.size); }
            patchMap.forEach((q, p) => { if (q <= 0) out.delete(p); else out.set(p, q); });
            // 상위 50레벨까지만 유지
            const sorted = [...out.entries()].sort((a,b)=> (b[0]-a[0]));
            return sorted.slice(0,50).map(([price,size]) => ({ price, size }));
          };
          this.orderbookState = {
            bids: mergeSide(this.orderbookState.bids, bidsMap),
            asks: mergeSide(this.orderbookState.asks, asksMap),
          };
          schedule();
          this._obRetry = 0; // 정상 수신 시 리셋
        } catch (e) { /* ignore parse errors */ }
      };
      ws.onclose = () => {
        cancelAnimationFrame(rafId);
        // 지수 백오프 (최대 10초)
        this._obRetry = Math.min(6, (this._obRetry||0) + 1);
        const base = Math.min(10000, 800 * Math.pow(2, this._obRetry));
        const jitter = base * (0.9 + Math.random()*0.2); // ±10%
        const delay = Math.round(jitter);
        setTimeout(()=> this.startOrderbookSocket(), delay);
      };
      ws.onerror = () => { try { ws.close(); } catch(_) {} };
    }

    renderPositions() {
      if (!this.el.positionsTableBody) return;
      const hasPos = this.state.positions.length > 0;
      if (!hasPos) {
        this.el.positionsTableBody.innerHTML = `<div style=\"padding:16px; color: var(--text-color-secondary);\">보유 포지션이 없습니다.</div>`;
        return;
      }
      this.el.positionsTableBody.innerHTML = this.state.positions
        .map((p) => {
          const mark = this.state.lastPrice;
          const pnl = this.calcPnL(p, mark);
          const pnlPct = ((pnl / Math.max(1e-8, p.entry * p.amount / p.leverage)) * 100); // 마진 대비 수익률 근사
          const pnlCls = pnl >= 0 ? 'positive' : 'negative';
          const estLiq = this.calcLiqPrice(p);
          const notional = (p.entry * p.amount).toFixed(4);
          const rate = pnl > 0 ? 1.0 : (pnl < 0 ? 0.1 : 0);
          const estMined = Math.abs(pnl) * rate;
          return `
            <div class="row ${p.side}" data-id="${p.id}">
              <div class="cell-pair"><div class="pair">${p.symbol} Perp</div><div class="tags"><span class="chip">${p.mode==='cross'?'Cross':'Isolated'}</span><span class="chip">${p.leverage}x</span></div></div>
              <div class="dir ${p.side}">${p.amount.toFixed(4)} BTC</div>
              <div>${this.format(p.entry)}</div>
              <div>${this.format(mark)}</div>
              <div>${this.format(estLiq)}</div>
              <div>${(p.margin).toFixed(4)}</div>
              <div class="notional-usdt">${this.format(mark * p.amount)} USDT</div>
              <div class="pnl ${pnlCls}"><span class="pnl-val" data-prev="${pnl}">${pnl >= 0 ? '+' : ''}${this.formatFixed(pnl,3)}</span> USDT<br/><span class="pnl-percent">(${pnlPct>=0?'+':''}${pnlPct.toFixed(2)}%)</span></div>
              <div class="mined-cell" style="color:var(--primary-color);"><span class="mined-val" data-prev="${estMined}">${Number(estMined).toFixed(3)}</span> ONBIT</div>
              <div><button class="btn-mini" data-act="mkt-close">MKT Close</button></div>
              <div><input class="size-input" type="number" step="0.1" value="${mark.toFixed(1)}" /></div>
              <div><input class="size-input" data-role="qty" type="number" step="0.0001" min="0" max="${p.amount.toFixed(4)}" value="${p.amount.toFixed(4)}" /></div>
              <div class="actions"><button class="btn-mini close">Close</button></div>
            </div>
          `;
        })
        .join('');

      this.el.positionsTableBody.querySelectorAll('.row .close').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const id = e.target.closest('.row').getAttribute('data-id');
          this.closePosition(id);
        });
      });
      // 수량 입력 상한: 포지션 보유 수량을 초과하지 않도록 제한
      this.el.positionsTableBody.querySelectorAll('.row [data-role="qty"]').forEach((inp) => {
        const row = inp.closest('.row');
        const id = row && row.getAttribute('data-id');
        const pos = this.state.positions.find(x=>x.id===id);
        if (!pos) return;
        const max = Number(pos.amount || 0);
        inp.setAttribute('max', String(max.toFixed ? max.toFixed(4) : max));
        inp.addEventListener('input', () => {
          let v = Number(inp.value || 0);
          if (v > max) v = max;
          if (v < 0) v = 0;
          inp.value = (Math.max(0, Math.min(max, v))).toFixed(4);
          // 슬라이더와 동기화
          if (this._qtySlider && this._qtySlider.input === inp) {
            const pct = max > 0 ? Math.round((Number(inp.value||0) / max) * 100) : 0;
            this._qtySlider.range.value = String(Math.max(0, Math.min(100, pct)));
            this.updateQtySliderTooltip(pos, Number(inp.value||0), this._qtySlider);
          }
        });
        inp.addEventListener('blur', () => {
          let v = Number(inp.value || 0);
          if (!isFinite(v)) v = 0;
          if (v > max) v = max;
          if (v < 0) v = 0;
          inp.value = v.toFixed(4);
        });
        // 클릭/포커스 시 퍼센트 슬라이더 표시
        const show = () => this.showCloseQtySlider(row, pos, inp);
        inp.addEventListener('focus', show);
        inp.addEventListener('click', show);
      });
      // MKT CLOSE 버튼 → 현재 시장가 기준 즉시 청산
      this.el.positionsTableBody.querySelectorAll('.row [data-act="mkt-close"]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const id = e.target.closest('.row')?.getAttribute('data-id');
          if (id) this.closePosition(id);
        });
      });
      // add-margin 버튼 제거됨
    }

    renderPositionsValuesOnly() {
      if (!this.el.positionsTableBody) return;
      this.el.positionsTableBody.querySelectorAll('.row').forEach((row) => {
        const id = row.getAttribute('data-id');
        const p = this.state.positions.find((x) => x.id === id);
        if (!p) return;
        const pnl = this.calcPnL(p, this.state.lastPrice);
        // 표기는 사용 마진 대비로 고정
        const usedMargin = Math.max(1e-8, p.margin || 0);
        const pnlPct = (pnl / usedMargin) * 100;
        const pnlEl = row.querySelector('.pnl');
        if (pnlEl) {
          const rate = pnl > 0 ? 1.0 : (pnl < 0 ? 0.1 : 0);
          const estMined = Math.abs(pnl) * rate;
          // 숫자 애니메이션: PnL
          const pnlVal = pnlEl.querySelector('.pnl-val');
          if (pnlVal) {
            const prev = Number(pnlVal.getAttribute('data-prev') || '0');
            pnlVal.setAttribute('data-prev', String(pnl));
            this.animateNumber(pnlVal, prev, pnl, 400, (v)=> `${v>=0?'+':''}${this.formatFixed(v,3)}`);
          }
          // 퍼센트 갱신 (고정 두 자리)
          const pnlPctEl = pnlEl.querySelector('.pnl-percent');
          if (pnlPctEl) {
            pnlPctEl.textContent = `(${pnlPct>=0?'+':''}${Number(pnlPct).toFixed(2)}%)`;
          }
          // 채굴 애니메이션
          const minedVal = row.querySelector('.mined-val');
          if (minedVal) {
            const prevM = Number(minedVal.getAttribute('data-prev') || '0');
            minedVal.setAttribute('data-prev', String(estMined));
            this.animateNumber(minedVal, prevM, estMined, 500, (v)=> `${Number(v).toFixed(3)}`);
          }
          pnlEl.classList.toggle('positive', pnl >= 0);
          pnlEl.classList.toggle('negative', pnl < 0);
        }
        // 실시간 금액(명목가) 업데이트
        const notionEl = row.querySelector('.notional-usdt');
        if (notionEl) notionEl.textContent = `${this.format(this.state.lastPrice * p.amount)} USDT`;
        // 실시간 현재가/청산가 갱신
        if (row.children && row.children.length > 5) {
          // 현재가 컬럼 (index 3)
          const markCol = row.children[3];
          if (markCol) {
            // 보유 포지션 현재가 자연스러운 롤링 적용 (1자리 고정)
            this.renderRollingNumber(markCol, Number(this.state.lastPrice || 0), 1);
          }
          // 예상 청산가 컬럼 (index 4) + 툴팁 정보 (교차 커버리지 안내)
          const liqCol = row.children[4];
          if (liqCol) {
            const lp = this.calcLiqPrice(p);
            const val = (isFinite(lp) && lp > 0) ? lp : (p.side==='long' ? (p.entry*(1-1/Math.max(1.0001,Number(p.leverage)||1))) : (p.entry*(1+1/Math.max(1.0001,Number(p.leverage)||1))));
            // 자연스러운 숫자 전환
            this.renderRollingNumber(liqCol, val, 2);
            try {
              if (!this._risk) this._risk = new window.RiskFunding({ getState: ()=>this.state, getBrackets: ()=>this._mmrBrackets });
              const tier = this._risk.getTierInfo && this._risk.getTierInfo(p);
              if (tier) {
                liqCol.title = `표기는 사용 마진 대비 기준입니다.\n교차 모드에서는 지갑잔고로 커버 가능.\nMMR: ${(tier.mmr*100).toFixed(3)}%\nNotional: ${this.format(tier.notional)} USDT${tier.cap?`\nTier Cap: ${this.format(tier.cap)} USDT (#${tier.idx})`:''}`;
              }
            } catch(_) {}
          }
        }
      });
    }

    // ===== Close Quantity Slider (Percent-based) =====
    showCloseQtySlider(rowEl, pos, qtyInput) {
      try {
        // 기존 슬라이더 제거
        if (this._qtySlider && this._qtySlider.wrapper && this._qtySlider.wrapper.parentNode) {
          this._qtySlider.wrapper.parentNode.removeChild(this._qtySlider.wrapper);
          this._qtySlider = null;
        }
        // 래퍼 생성
        const wrap = document.createElement('div');
        wrap.style.position = 'absolute';
        // 위치를 청산 수량 입력 바로 아래로 제한된 폭으로 표시
        const rowRect = rowEl.getBoundingClientRect();
        const inpRect = qtyInput.getBoundingClientRect();
        const left = Math.max(0, (inpRect.left - rowRect.left) - 10);
        const top = (inpRect.bottom - rowRect.top) + 8;
        wrap.style.left = left + 'px';
        wrap.style.top = top + 'px';
        wrap.style.width = '260px';
        wrap.style.maxWidth = 'calc(100% - 24px)';
        wrap.style.padding = '10px 12px 12px';
        wrap.style.background = 'var(--bg-color)';
        wrap.style.border = '1px solid var(--border-color)';
        wrap.style.borderRadius = '10px';
        wrap.style.boxShadow = '0 8px 20px rgba(0,0,0,.25)';
        wrap.style.zIndex = '20';

        // 슬라이더 UI
        const labelMin = document.createElement('div');
        labelMin.textContent = '0%';
        labelMin.style.color = 'var(--text-color-secondary)';
        const labelMax = document.createElement('div');
        labelMax.textContent = '100%';
        labelMax.style.color = 'var(--text-color-secondary)';
        const head = document.createElement('div');
        head.style.display = 'flex';
        head.style.justifyContent = 'space-between';
        head.style.marginBottom = '6px';
        head.appendChild(labelMin); head.appendChild(labelMax);

        const range = document.createElement('input');
        range.type = 'range';
        range.min = '0'; range.max = '100'; range.step = '1';
        range.style.width = '100%';
        range.style.height = '8px';
        range.value = (pos.amount>0) ? String(Math.round((Number(qtyInput.value||0)/pos.amount)*100)) : '0';

        // 툴팁
        const tip = document.createElement('div');
        tip.style.position = 'absolute';
        tip.style.top = '-32px';
        tip.style.transform = 'translateX(-50%)';
        tip.style.background = 'var(--card-bg)';
        tip.style.border = '1px solid var(--border-color)';
        tip.style.padding = '4px 8px';
        tip.style.borderRadius = '6px';
        tip.style.fontSize = '12px';
        tip.style.color = 'var(--text-color)';
        tip.style.display = 'none';

        const container = document.createElement('div');
        container.style.position = 'relative';
        container.appendChild(range);
        container.appendChild(tip);

        // 눈금(0/25/50/75/100) 표시 및 클릭으로 점프
        const marks = document.createElement('div');
        marks.style.position = 'absolute';
        marks.style.left = '0';
        marks.style.right = '0';
        marks.style.top = '50%';
        marks.style.transform = 'translateY(-50%)';
        marks.style.height = '0';
        const mkVals = [0,25,50,75,100];
        mkVals.forEach(p => {
          const dot = document.createElement('span');
          dot.style.position = 'absolute';
          dot.style.left = p+'%';
          dot.style.transform = 'translate(-50%, -50%)';
          dot.style.width = '8px';
          dot.style.height = '8px';
          dot.style.borderRadius = '50%';
          dot.style.background = 'rgba(255,255,255,.4)';
          dot.style.border = '1px solid var(--border-color)';
          dot.style.cursor = 'pointer';
          dot.addEventListener('click', () => { range.value = String(p); range.dispatchEvent(new Event('input')); });
          marks.appendChild(dot);
        });
        container.appendChild(marks);

        // 포지션/금액 요약 툴팁 (상단)
        const bubble = document.createElement('div');
        bubble.style.position = 'absolute';
        bubble.style.bottom = '100%';
        bubble.style.left = '0';
        bubble.style.transform = 'translateY(-8px)';
        bubble.style.background = 'var(--card-bg)';
        bubble.style.border = '1px solid var(--border-color)';
        bubble.style.padding = '8px 10px';
        bubble.style.borderRadius = '8px';
        bubble.style.color = 'var(--text-color)';
        bubble.style.fontSize = '12px';
        bubble.style.whiteSpace = 'nowrap';
        const updateBubble = (amt) => {
          bubble.textContent = `${amt.toFixed(4)} BTC`;
        };

        wrap.appendChild(bubble);
        wrap.appendChild(head);
        wrap.appendChild(container);

        // 행에 부착
        rowEl.style.position = rowEl.style.position || 'relative';
        rowEl.appendChild(wrap);

        const moveTip = (pct) => {
          const rect = range.getBoundingClientRect();
          const x = rect.left + (rect.width * (pct/100));
          tip.style.left = (x - rect.left) + 'px';
          tip.textContent = `${pct}%`;
        };

        const onInput = () => {
          const pct = Number(range.value||0);
          const amt = Math.max(0, Math.min(pos.amount, pos.amount * (pct/100)));
          qtyInput.value = amt.toFixed(4);
          this.updateQtySliderTooltip(pos, amt, { tip });
          moveTip(pct);
          updateBubble(amt);
          tip.style.display = 'block';
        };
        range.addEventListener('input', onInput);
        range.addEventListener('change', onInput);
        range.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowLeft' || e.key === 'Left') {
            e.preventDefault();
            range.value = String(Math.max(0, Number(range.value||0) - 1));
            onInput();
          } else if (e.key === 'ArrowRight' || e.key === 'Right') {
            e.preventDefault();
            range.value = String(Math.min(100, Number(range.value||0) + 1));
            onInput();
          } else if (e.key === 'Escape' || e.key === 'Esc') {
            try { wrap.remove(); } catch(_) {}
            this._qtySlider = null;
          }
        });

        // 외부 클릭 시 닫기
        const onDocClick = (e) => {
          if (!wrap.contains(e.target) && e.target !== qtyInput) {
            try { wrap.remove(); } catch(_) {}
            document.removeEventListener('click', onDocClick);
            this._qtySlider = null;
          }
        };
        setTimeout(()=> document.addEventListener('click', onDocClick), 0);

        this._qtySlider = { wrapper: wrap, range, tip, input: qtyInput };
        // 초기 표시
        onInput();
      } catch (_) {}
    }

    updateQtySliderTooltip(pos, amt, ctx) {
      if (!ctx || !ctx.tip) return;
      try {
        const pct = pos.amount > 0 ? Math.round((amt/pos.amount)*100) : 0;
        ctx.tip.textContent = `${pct}%`;
      } catch(_) {}
    }

    renderPositionsSkeleton() { /* removed by request */ }

    saveState() {
      // 300ms 디바운스 + 변경 감지
      try { clearTimeout(this._saveTimer); } catch(_) {}
      this._saveTimer = setTimeout(() => {
        try {
          const json = JSON.stringify(this.state);
          if (json !== this._lastSavedJson) {
            localStorage.setItem(STORAGE_KEY, json);
            this._lastSavedJson = json;
          }
        } catch {}
      }, 300);
    }

    renderAccountPanel() {
      const elEq = document.getElementById('acc-equity');
      const elAv = document.getElementById('acc-available');
      const elMg = document.getElementById('acc-margin');
      const elUp = document.getElementById('acc-upnl');
      const elEqBig = document.getElementById('acc-equity-big');
      const elWallet = document.getElementById('acc-wallet');
      const elUpBig = document.getElementById('acc-upnl-big');
      const elBonus = document.getElementById('acc-bonus');
      const elOnbit = document.getElementById('acc-onbit');

      const usedMargin = this.state.positions.reduce((sum, p) => sum + (p.margin), 0);
      const uPnL = this.state.positions.reduce((sum, p) => sum + this.calcPnL(p, this.state.lastPrice), 0);
      const available = this.state.balanceUSDT;
      const equity = this.state.equityUSDT;
      const marginBalance = available + usedMargin + uPnL; // 지갑 + 포지션(사용 마진) + 미실현손익

      // Small info (있을 때만 업데이트)
      if (elEq) elEq.textContent = `${this.format(marginBalance)} USDT`;
      if (elAv) elAv.textContent = `${this.format(available)} USDT`;
      if (elMg) elMg.textContent = `${this.format(usedMargin)} USDT`;
      if (elUp) {
        const prevUp = this.prev.uPnL;
        elUp.textContent = `${uPnL>=0?'+':''}${this.format(uPnL)} USDT`;
        elUp.classList.toggle('up', uPnL >= 0);
        elUp.classList.toggle('down', uPnL < 0);
        // spark 효과 제거
      }

      // Large summary 동기화 (새 디자인) → 제목: 마진 잔고
      if (elEqBig) {
        // 고정 소수 4자리 + Rolling Number Animation 적용 (위치 고정)
        this.renderRollingNumber(elEqBig, marginBalance, 4);
      }
      if (elWallet) elWallet.textContent = `$${this.format(available)}`;
      if (elUpBig) {
        const prevUp = this.prev.uPnL;
        elUpBig.textContent = `${uPnL>=0?'+':''}$${this.format(uPnL)}`;
        elUpBig.classList.toggle('up', uPnL >= 0);
        elUpBig.classList.toggle('down', uPnL < 0);
        // spark 효과 제거
      }
      // 보너스는 사용하지 않음 (요소가 남아있으면 숨김)
      if (elBonus) elBonus.parentElement && (elBonus.parentElement.style.display = 'none');

      // ONBIT 채굴 잔고 실시간 반영
      // 외부(본 모듈)에서 합산 값을 제어하므로 여기서는 건드리지 않음
      // (onbitMiner.externalControlled === true 인 상태)

      // 이전 값 저장 (다음 변화 대비)
      this.prev.uPnL = uPnL;
      this.prev.marginBalance = marginBalance;
    }

    loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...defaultState };
        const parsed = JSON.parse(raw);
        return { ...defaultState, ...parsed, positions: parsed.positions || [] };
      } catch {
        return { ...defaultState };
      }
    }

    format(n) {
      if (n === undefined || n === null || isNaN(n)) return '-';
      const key = Math.round(Number(n) * 10000); // 4자리 정밀도로 키 생성
      if (!this._fmtCache) { this._fmtCache = new Map(); this._fmtKeys = []; }
      if (this._fmtCache.has(key)) return this._fmtCache.get(key);
      const v = Number(n).toLocaleString('en-US', { maximumFractionDigits: 4 });
      this._fmtCache.set(key, v);
      this._fmtKeys.push(key);
      if (this._fmtKeys.length > 64) {
        const old = this._fmtKeys.shift();
        this._fmtCache.delete(old);
      }
      return v;
    }

    round(n, p) {
      const m = Math.pow(10, p);
      return Math.round(n * m) / m;
    }

    toAmount(n) {
      return this.round(n, this.amountPrecision);
    }

    // spark 효과 제거됨

    animateNumber(el, from, to, duration, formatter) {
      if (!el) return;
      if (!isFinite(from) || !isFinite(to) || duration <= 0) {
        el.textContent = formatter ? formatter(to) : String(to);
        return;
      }
      if (Math.abs(to - from) < 1e-6) {
        el.textContent = formatter ? formatter(to) : String(to);
        return;
      }
      const start = performance.now();
      const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
      const seq = (el.__animSeq || 0) + 1;
      el.__animSeq = seq;
      const step = (now) => {
        if (el.__animSeq !== seq) return; // 이전 애니메이션 취소
        const t = Math.min(1, (now - start) / duration);
        const v = from + (to - from) * easeOutCubic(t);
        el.textContent = formatter ? formatter(v) : String(v);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    // Rolling Number Animation: 각 자리수별 디지트 플립 없이도 부드럽고 정렬 유지
    renderRollingNumber(targetEl, value, fixed = 4) {
      if (!targetEl) return;
      const prev = targetEl.__rollingPrev;
      const to = Number(value);
      const from = (typeof prev === 'number') ? prev : to;
      targetEl.__rollingPrev = to;
      const duration = 1000;
      const formatFixed = (n) => {
        const num = Number(n);
        if (!isFinite(num)) return '-';
        const parts = num.toFixed(fixed).split('.');
        parts[0] = Number(parts[0]).toLocaleString('en-US');
        return parts.join('.');
      };
      if (Math.abs(to - from) < 1e-9) {
        targetEl.textContent = formatFixed(to);
        return;
      }
      const start = performance.now();
      const seq = (targetEl.__rollingSeq || 0) + 1;
      targetEl.__rollingSeq = seq;
      const ease = (t) => 1 - Math.pow(1 - t, 3);
      const step = (now) => {
        if (targetEl.__rollingSeq !== seq) return;
        const t = Math.min(1, (now - start) / duration);
        const v = from + (to - from) * ease(t);
        targetEl.textContent = formatFixed(v);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    // 고정 소수 포맷터(부호 포함)
    formatFixed(n, digits = 2) {
      const num = Number(n);
      if (!isFinite(num)) return '0.00';
      const abs = Math.abs(num).toFixed(digits);
      const withSep = Number(abs).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
      return (num >= 0 ? withSep : '-' + withSep);
    }

    ensureObTooltip() {
      let el = document.getElementById('ob-tooltip');
      if (!el) {
        el = document.createElement('div');
        el.id = 'ob-tooltip';
        el.className = 'ob-tooltip';
        document.body.appendChild(el);
      }
      return el;
    }

    getTickSize(price) {
      if (price >= 100000) return 50;
      if (price >= 50000) return 10;
      if (price >= 10000) return 5;
      if (price >= 1000) return 0.5;
      return 0.1;
    }

    renderHistory() {
      if (!this.el || !document.getElementById('history-table-body')) return;
      const body = document.getElementById('history-table-body');
      const rows = (this.state.history || []).map(h => {
        const pnlPct = (h.pnl != null && h.leverage) ? ((h.pnl / Math.max(1e-8, h.avgPrice*h.filled/h.leverage))*100) : null;
        const pnlCls = h.pnl != null ? (h.pnl >= 0 ? 'positive' : 'negative') : '';
        const asset = h.symbol.startsWith('BTC') ? 'BTC' : 'ETH';
        const isClose = /Close|Forced/i.test(String(h.direction||''));
        const minedForRow = (isClose && h.pnl != null)
          ? (Math.abs(Number(h.pnl)) * (Number(h.pnl) >= 0 ? 0.01 : 0.001))
          : null;
        return `
          <div class="row" data-id="${h.id}">
            <div class="cell-pair"><div class="pair">${h.symbol} Perp</div><div class="tags"><span class="chip">${h.mode==='cross'?'Cross':'Isolated'}</span><span class="chip">${h.leverage}x</span></div></div>
            <div>${new Date(h.ts).toLocaleString()}</div>
            <div class="dir ${/Open/.test(h.direction)?'long':/Close Short|Forced Short/.test(h.direction)?'short':''}">${h.direction}</div>
            <div>${this.format(h.avgPrice)}<br/>${h.type}</div>
            <div>${(h.filled||0).toFixed(4)} ${asset}</div>
            <div class="pnl ${pnlCls}">${h.pnl==null?'--':(h.pnl>=0?'+':'')+this.format(h.pnl)}${pnlPct==null?'':`<br/><span class="pnl-percent">${pnlPct>=0?'+':''}${pnlPct.toFixed(2)}%</span>`}${minedForRow!=null ? `<br/><span class="mined" style="color:var(--primary-color);">${Number(minedForRow).toFixed(3)} ONBIT</span>` : ''}</div>
            <div>${(h.fee||0).toFixed(4)}</div>
          </div>
        `;
      }).join('');
      body.innerHTML = rows || '<div style="padding:12px; color:var(--text-color-secondary)">거래 내역 없음</div>';
    }
  }

  // 전역 노출
  window.paperTrading = new PaperTradingEngine();
})();


