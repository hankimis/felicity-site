(function(){
  const DEFAULTS = {
    binance: {
      wsBase: (window.PT_CONFIG && window.PT_CONFIG.binanceWsBase) || 'wss://fstream.binance.com/ws',
      apiBase: (window.PT_CONFIG && window.PT_CONFIG.binanceApiBase) || 'https://fapi.binance.com',
      depthStream: (s)=> `${((window.PT_CONFIG && window.PT_CONFIG.binanceWsBase) || 'wss://fstream.binance.com/ws')}/${s}@depth20@100ms`,
      depthRest: (sym, limit=50)=> `${((window.PT_CONFIG && window.PT_CONFIG.binanceApiBase) || 'https://fapi.binance.com')}/fapi/v1/depth?symbol=${sym}&limit=${limit}`
    }
  };

  class BinanceOrderbookAdapter {
    constructor(cfg){ this.cfg = Object.assign({}, DEFAULTS.binance, cfg||{}); }

    async fetchSnapshot(symbol, opts){
      const limit = (opts && opts.limit) || 50;
      const url = this.cfg.depthRest(String(symbol).toUpperCase(), limit);
      const res = await fetch(url, { signal: opts && opts.signal });
      const data = await res.json();
      return this._normalizeRest(data, limit);
    }

    openStream(symbol, { onMessage, onError, onClose, signal, limit=50 }){
      const sym = String(symbol||'BTCUSDT').toLowerCase();
      const url = this.cfg.depthStream(sym);
      let ws;
      try { ws = new WebSocket(url); } catch (e) { if (onError) onError(e); return { close: ()=>{} }; }
      const close = ()=>{ try{ ws && ws.close && ws.close(); }catch(_){} };
      if (signal){
        if (signal.aborted) { close(); return { close }; }
        try { signal.addEventListener('abort', close, { once: true }); } catch(_){}
      }
      ws.onmessage = (ev)=>{
        try{
          const m = JSON.parse(ev.data);
          const bids = (m.b || m.bids || []).map(([p,q])=>({price:Number(p), size:Number(q)}));
          const asks = (m.a || m.asks || []).map(([p,q])=>({price:Number(p), size:Number(q)}));
          if (bids.length===0 && asks.length===0) return;
          const state = this._normalizeArrays(bids, asks, limit);
          onMessage && onMessage(state);
        }catch(err){ /* ignore */ }
      };
      ws.onerror = (err)=>{ onError && onError(err); try{ ws.close(); }catch(_){} };
      ws.onclose = ()=>{ onClose && onClose(); };
      return { close, ws };
    }

    _normalizeArrays(bids, asks, limit){
      try{
        const agg = (arr)=>{
          const map = new Map();
          for (const x of (arr||[])){
            if (!isFinite(x.price) || !isFinite(x.size)) continue;
            if (x.size <= 0) continue;
            const k = x.price;
            map.set(k, (map.get(k)||0) + x.size);
          }
          return Array.from(map.entries()).map(([price,size])=>({ price, size }));
        };
        bids = agg(bids).sort((a,b)=> b.price - a.price).slice(0, limit);
        asks = agg(asks).sort((a,b)=> a.price - b.price).slice(0, limit);
        return { bids, asks };
      }catch(_){ return { bids:[], asks:[] }; }
    }

    _normalizeRest(d, limit){
      const norm = (arr,isBid)=> (arr||[])
        .filter(x=>Array.isArray(x)&&x.length>=2)
        .map(([p,q])=>({price:Number(p), size:Number(q)}))
        .filter(x=>isFinite(x.price)&&isFinite(x.size))
        .sort((a,b)=> isBid? (b.price-a.price):(a.price-b.price))
        .slice(0,limit);
      return { bids: norm(d.bids||d.b||[], true), asks: norm(d.asks||d.a||[], false) };
    }
  }

  class OrderbookService {
    constructor({ adapter, symbolStore, onUpdate }){
      this.adapter = adapter;
      this.symbolStore = symbolStore;
      this.onUpdate = typeof onUpdate==='function'? onUpdate : ()=>{};
      this._running = false;
      this._disposed = false;
      this._abort = null;
      this._reconnectT = null;
      this._hbIv = null;
      this._restIv = null;
      this._rafQueued = false;
      this._lastTs = 0;
      this._retry = 0;
      this._maxRetry = 99; // 포기 안 함
      this._visBound = false;
      this._onVisibilityChange = this._handleVisibility.bind(this);
      this._unsubSymbol = null;
      this._pending = null;
      this._limit = (typeof window !== 'undefined' && Number.isFinite(window.orderbookDepthLimit)) ? Math.max(5, Math.min(100, Math.floor(window.orderbookDepthLimit))) : 50;
      this._restTick = 0;
    }

    start(){
      if (this._running) return;
      this._running = true; this._disposed = false; this._retry = 0;
      const cur = this._getSymbol();
      this._bindSymbol();
      this._connect(cur);
    }

    stop(){
      this._running = false; this._clearTimers(); this._abortActive();
      try{ if (this._visBound){ document.removeEventListener('visibilitychange', this._onVisibilityChange); this._visBound=false; } }catch(_){ }
    }

    dispose(){ this.stop(); if (this._unsubSymbol) { try{ this._unsubSymbol(); }catch(_){ } this._unsubSymbol=null; } this._disposed = true; }

    async switchSymbol(sym){
      try { if (this.symbolStore && this.symbolStore.set) this.symbolStore.set(String(sym||'BTCUSDT').toUpperCase()); } catch(_){ }
      const s = this._getSymbol();
      if (!this._running) return this._connect(s);
      this._connect(s);
    }

    // 내부 구현
    _getSymbol(){ try { return (this.symbolStore && this.symbolStore.get && this.symbolStore.get()) || 'BTCUSDT'; } catch(_) { return 'BTCUSDT'; } }

    _bindSymbol(){
      if (!this.symbolStore || !this.symbolStore.on || this._unsubSymbol) return;
      try { this._unsubSymbol = this.symbolStore.on((sym)=>{ if (!this._running) return; this._connect(sym); }); } catch(_){ }
    }

    _abortActive(){ try{ this._abort && this._abort.abort && this._abort.abort(); }catch(_){ } this._abort = null; }
    _clearTimers(){ try{ clearTimeout(this._reconnectT); }catch(_){ } this._reconnectT=null; try{ clearInterval(this._hbIv); }catch(_){ } this._hbIv=null; try{ clearInterval(this._restIv); }catch(_){ } this._restIv=null; }

    async _connect(symbol){
      // cancel previous
      this._abortActive(); this._clearTimers(); this._pending = null; this._lastTs = Date.now();
      if (!this._visBound){ try{ document.addEventListener('visibilitychange', this._onVisibilityChange); this._visBound=true; }catch(_){ }}

      const ctrl = new AbortController(); this._abort = ctrl;
      const update = (state)=>{ this._pending = state; this._scheduleEmit(); this._lastTs = Date.now(); };
      // 1) snapshot
      try { const snap = await this.adapter.fetchSnapshot(symbol, { signal: ctrl.signal, limit: this._limit }); if (ctrl.signal.aborted) return; update(snap); } catch(_){ }
      if (ctrl.signal.aborted) return;
      // 2) stream
      const stream = this.adapter.openStream(symbol, {
        onMessage: (st)=>{ if (ctrl.signal.aborted) return; update(st); },
        onError: ()=>{ if (ctrl.signal.aborted || this._disposed) return; this._scheduleReconnect(symbol); },
        onClose: ()=>{ if (ctrl.signal.aborted || this._disposed) return; this._scheduleReconnect(symbol); },
        signal: ctrl.signal,
        limit: this._limit
      });
      // 3) heartbeat
      try{ clearInterval(this._hbIv); }catch(_){ }
      this._hbIv = setInterval(()=>{
        if (this._disposed || ctrl.signal.aborted) return;
        const hidden = (typeof document!=='undefined' && document.hidden) ? true : false;
        const idleMs = Date.now() - (this._lastTs || 0);
        const IDLE_LIMIT = hidden ? 120000 : 10000;
        if (!isFinite(idleMs) || idleMs > IDLE_LIMIT){ try{ console.warn('[OrderbookService] heartbeat timeout - reconnect'); }catch(_){ } try{ stream && stream.close && stream.close(); }catch(_){ } }
      }, 5000);
      // 4) periodic REST resync (visibility-aware)
      try{ clearInterval(this._restIv); }catch(_){ }
      this._restIv = setInterval(async ()=>{
        if (this._disposed || ctrl.signal.aborted) return;
        this._restTick = (this._restTick + 1) % 3;
        const hidden = (typeof document!=='undefined' && document.hidden) ? true : false;
        if (hidden && this._restTick !== 0) return; // about 45s when hidden
        try { const snap = await this.adapter.fetchSnapshot(symbol, { signal: ctrl.signal, limit: this._limit }); if (!ctrl.signal.aborted) update(snap); } catch(_){ }
      }, 15000);
    }

    _scheduleReconnect(symbol){
      if (this._reconnectT || !this._running) return;
      const base = Math.min(10000, 800*Math.pow(2, Math.min(this._retry+1, 10)));
      const jitter = Math.floor(Math.random()*300);
      const delay = base + jitter;
      try{ console.warn('[OrderbookService] reconnect in', delay, 'ms'); }catch(_){ }
      this._reconnectT = setTimeout(()=>{ this._reconnectT=null; if (this._disposed || !this._running) return; this._retry = Math.min(this._retry+1, this._maxRetry); this._connect(this._getSymbol()); }, delay);
    }

    _handleVisibility(){ try{ if (!document.hidden) { this._lastTs = Date.now(); try{ console.log('[OrderbookService] tab active - ts reset'); }catch(_){ } } }catch(_){ } }

    _scheduleEmit(){
      if (!this._pending) return;
      if (this._rafQueued) return; this._rafQueued = true;
      const emit = ()=>{ this._rafQueued=false; const st = this._pending; this._pending=null; try{ this.onUpdate({ bids: st.bids||[], asks: st.asks||[] }); }catch(_){} };
      try{
        if (typeof document!=='undefined' && document.hidden){ setTimeout(emit, 16); }
        else if (typeof requestAnimationFrame==='function'){ requestAnimationFrame(emit); }
        else { setTimeout(emit, 16); }
      }catch(_){ setTimeout(emit, 16); }
    }
  }

  // Backward-compatible wrapper preserving existing API new OrderbookEngine(symbol, onUpdate)
  class OrderbookEngine {
    constructor(symbol, onUpdate){
      this._adapter = new BinanceOrderbookAdapter();
      this._onUpdate = onUpdate;
      // SSOT: symbolStore 사용. 초기 심볼 반영
      try { if (window.symbolStore && window.symbolStore.set) window.symbolStore.set(String(symbol||'BTCUSDT').toUpperCase()); } catch(_){ }
      this._service = new OrderbookService({ adapter: this._adapter, symbolStore: window.symbolStore, onUpdate });
      this._started = false;
    }
    setSymbol(sym){ try { window.symbolStore && window.symbolStore.set && window.symbolStore.set(String(sym||'BTCUSDT').toUpperCase()); } catch(_){ } try{ this._service && this._service.switchSymbol && this._service.switchSymbol(sym); }catch(_){ } }
    async start(){ if (this._started) return; this._started = true; try{ this._service.start(); }catch(_){ } }
    stop(){ try{ this._service.stop(); }catch(_){ } this._started=false; }
    dispose(){ try{ this._service.dispose(); }catch(_){ } this._started=false; }
  }

  // Expose
  window.BinanceOrderbookAdapter = BinanceOrderbookAdapter;
  window.OrderbookService = OrderbookService;
  window.OrderbookEngine = OrderbookEngine;
  // 전역 설정자: 오더북 레벨 동적 변경 (5..100)
  try {
    window.setOrderbookDepthLimit = function(n){
      const v = Math.max(5, Math.min(100, Math.floor(Number(n||50))));
      window.orderbookDepthLimit = v;
      try { if (window.orderbookService && window.orderbookService._limit !== v){ window.orderbookService._limit = v; } } catch(_){ }
    };
  } catch(_){ }
})();