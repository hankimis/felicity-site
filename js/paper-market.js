(function(){
  const CONFIG = window.PT_CONFIG;
  class MarketSockets {
    constructor(symbol, handlers){
      this.symbol = symbol || 'BTCUSDT';
      this.handlers = handlers || {};
      this.priceSocket = null;
      this.orderbookSocket = null;
      this._obRetry = 0; this._priceRetry = 0;
    }
    setSymbol(sym){ this.symbol = sym || 'BTCUSDT'; }
    startPrice(){
      const sym = (this.symbol||'BTCUSDT').toLowerCase();
      const url = CONFIG.bookTickerStream(sym);
      try { this.priceSocket && this.priceSocket.close(); } catch(_) {}
      const ws = new WebSocket(url);
      this.priceSocket = ws;
      ws.onmessage = (ev) => {
        try{ const m=JSON.parse(ev.data); const bid=+m.b, ask=+m.a; if(isFinite(bid)&&isFinite(ask)) this.handlers.onPrice && this.handlers.onPrice((bid+ask)/2);}catch(_){}}
      ws.onclose = ()=>{ this._priceRetry=Math.min(6,this._priceRetry+1); const d=Math.min(10000,500*Math.pow(2,this._priceRetry)); setTimeout(()=>this.startPrice(), d); };
      ws.onerror = ()=>{ try{ws.close();}catch(_){} };
    }
    startOrderbook(){
      const sym=(this.symbol||'BTCUSDT').toLowerCase();
      const url=CONFIG.orderbookDepthStream(sym);
      try { this.orderbookSocket && this.orderbookSocket.close(); } catch(_) {}
      const ws = new WebSocket(url);
      this.orderbookSocket = ws;
      ws.onmessage = (ev)=>{ try{ const m=JSON.parse(ev.data); this.handlers.onDepth && this.handlers.onDepth(m);}catch(_){}}
      ws.onclose = ()=>{ this._obRetry=Math.min(6,this._obRetry+1); const d=Math.min(10000,800*Math.pow(2,this._obRetry)); setTimeout(()=>this.startOrderbook(), d); };
      ws.onerror = ()=>{ try{ws.close();}catch(_){} };
    }
  }
  window.MarketSockets = MarketSockets;
})();


