(function(){
  const normalize = (s)=>{
    try { return String(s||'').replace(/\s*Perp$/i,'').replace(/^BINANCE:/i,'').replace(/[:\-]/g,'').trim() || 'BTCUSDT'; } catch(_) { return 'BTCUSDT'; }
  };
  const subs = new Set();
  let sym = (function(){ try { return normalize(localStorage.getItem('lastSymbol')||'BTCUSDT'); } catch(_) { return 'BTCUSDT'; } })();
  const api = {
    get(){ return sym; },
    set(next){
      next = normalize(next);
      if (next === sym) return;
      sym = next;
      try { localStorage.setItem('lastSymbol', sym); } catch(_) {}
      subs.forEach(fn=>{ try { fn(sym); } catch(_) {} });
    },
    on(fn){ if (typeof fn==='function'){ subs.add(fn); return ()=>subs.delete(fn); } return ()=>{}; },
    normalize,
    displayName(s){ s = normalize(s); return `${s} Perp`; }
  };
  window.symbolStore = api;
})();


