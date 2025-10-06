(function(){
  class OrderEngine {
    constructor(state, risk, ui){
      this.state = state; // 참조 객체
      this.risk = risk;
      this.ui = ui;
      this.MAXH = (window.PT_CONFIG && window.PT_CONFIG.cache && window.PT_CONFIG.cache.historyMax) || 500;
    }
    // 같은 심볼/같은 방향/같은 모드 포지션 병합
    mergePosition(newPos){
      try {
        const idx = this.state.positions.findIndex(p => p.symbol===newPos.symbol && p.side===newPos.side && p.mode===newPos.mode);
        if (idx === -1){
          this.state.positions.push(newPos);
          return newPos;
        }
        const cur = this.state.positions[idx];
        const totalAmt = Number(cur.amount) + Number(newPos.amount);
        const curNotional = Number(cur.entry) * Number(cur.amount);
        const addNotional = Number(newPos.entry) * Number(newPos.amount);
        const nextEntry = totalAmt>0 ? ((curNotional + addNotional) / totalAmt) : newPos.entry;
        cur.amount = totalAmt;
        cur.entry = nextEntry;
        // 증거금 합산 (격리/교차 공통으로 사용)
        cur.margin = Math.max(0, Number(cur.margin) + Number(newPos.margin));
        // 표시 레버리지는 암묵적 레버리지로 재계산(명목/사용마진)
        const impliedLev = (cur.entry * cur.amount) / Math.max(1e-8, cur.margin);
        cur.leverage = Math.max(1, Number.isFinite(impliedLev) ? impliedLev : cur.leverage);
        return cur;
      } catch(_) { this.state.positions.push(newPos); return newPos; }
    }
    addHistory(rec){
      try {
        this.state.history.unshift(rec);
        if (this.state.history.length > this.MAXH) this.state.history.length = this.MAXH;
      } catch(_) {}
    }
    calcPnL(p, price){ return this.risk.calcPnL(p, price); }
    placeMarket(side, price, amount){
      // 레버리지 1~100으로 클램프 (Long/Short 별 값 사용)
      const baseLev = (side === 'long')
        ? (this.state.leverageLong || this.state.leverage)
        : (this.state.leverageShort || this.state.leverage);
      const lev=Math.max(1, Math.min(100, baseLev));
      const margin=price*amount/lev;
      const fee=price*amount*(window.PT_CONFIG.fees.taker);
      if (margin+fee>this.state.balanceUSDT+1e-8) return false;
      const sym = (window.symbolStore && window.symbolStore.get && window.symbolStore.get()) || this.state.symbol;
      const pos={ id:'pos_'+Date.now(), symbol:sym, side, entry:price, amount, leverage:lev, margin, mode:this.state.marginMode };
      this.state.balanceUSDT-= (margin+fee);
      this.mergePosition(pos);
      this.addHistory({ id:'his_'+Date.now(), ts:Date.now(), symbol:sym, mode:this.state.marginMode, leverage:lev, direction: side==='long'?'Open Long':'Open Short', type:'Market', avgPrice:price, orderPrice:price, filled:amount, fee, pnl:null });
      this.ui && this.ui.notifyFill({ title:`Open ${side==='long'?'Long':'Short'} ${sym} ${this.state.marginMode==='cross'?'Cross':'Isolated'} · ${lev}x`, subtitle:'Perp · Filled', price, amount, mode:this.state.marginMode, leverage:lev, type:'success' });
      return true;
    }

    placeLimit(side, price, amount){
      // 레버리지 1~100으로 클램프 (Long/Short 별 값 사용)
      const baseLev = (side === 'long')
        ? (this.state.leverageLong || this.state.leverage)
        : (this.state.leverageShort || this.state.leverage);
      const lev = Math.max(1, Math.min(100, baseLev));
      const bestBid = Number(this.state.bestBid || 0);
      const bestAsk = Number(this.state.bestAsk || Infinity);
      const eps = 1e-8;

      // 시장성 있는 지정가 여부 판정:
      // - Long: bestAsk <= limit price → 즉시 체결(테이커)
      // - Short: bestBid >= limit price → 즉시 체결(테이커)
      const marketable = side === 'long' ? (bestAsk <= price + eps) : (bestBid >= price - eps);
      if (marketable && isFinite(bestBid) && isFinite(bestAsk)){
        // 즉시 체결: 테이커 수수료 적용, 체결가는 현재 최우선 호가와 지정가 중 유리한 가격으로 근사
        const execPrice = side === 'long' ? Math.min(price, bestAsk) : Math.max(price, bestBid);
        const margin = execPrice * amount / lev;
        const fee = execPrice * amount * (window.PT_CONFIG.fees.taker);
        if (margin + fee > this.state.balanceUSDT + eps) return null;
        const sym = (window.symbolStore && window.symbolStore.get && window.symbolStore.get()) || this.state.symbol;
        const pos = { id:'pos_'+Date.now(), symbol:sym, side, entry:execPrice, amount, leverage:lev, margin, mode:this.state.marginMode };
        this.state.balanceUSDT -= (margin + fee);
        this.mergePosition(pos);
        this.addHistory({ id:'his_'+Date.now(), ts:Date.now(), symbol:sym, mode:this.state.marginMode, leverage:lev, direction: side==='long'?'Open Long':'Open Short', type:'Limit', avgPrice:execPrice, orderPrice:price, filled:amount, fee, pnl:null });
        this.ui && this.ui.notifyFill({ title:`Open ${side==='long'?'Long':'Short'} ${sym} ${this.state.marginMode==='cross'?'Cross':'Isolated'} · ${lev}x`, subtitle:'Limit · Filled', price:execPrice, amount, mode:this.state.marginMode, leverage:lev, type:'success' });
        return null; // 오더북에 남기지 않음 (즉시 체결)
      }

      // 대기 지정가: 오더북에 적재 (메이커)
      const sym2 = (window.symbolStore && window.symbolStore.get && window.symbolStore.get()) || this.state.symbol;
      const order = { id:'ord_'+Date.now(), symbol:sym2, side, price, amount, leverage:lev, mode:this.state.marginMode, status:'Unfilled', createdAt:new Date().toISOString() };
      this.state.openOrders.push(order);
      return order;
    }

    matchOpenOrders(mark){
      // 베스트 호가 기준으로 매칭 (maker fill)
      const bestBid = Number(this.state.bestBid || 0);
      const bestAsk = Number(this.state.bestAsk || Infinity);
      if (!Array.isArray(this.state.openOrders)||this.state.openOrders.length===0) return 0;
      const next=[]; let filled=0; const feeMaker=window.PT_CONFIG.fees.maker;
      for (const o of this.state.openOrders){
        // 메이커 체결 조건: 현재 베스트 호가가 주문가를 관통
        const shouldFill = o.side==='long' ? (bestAsk <= o.price + 1e-8) : (bestBid >= o.price - 1e-8);
        if (!shouldFill){ next.push(o); continue; }
        const margin = o.price*o.amount/o.leverage; const openNotional=o.price*o.amount; const fee=openNotional*feeMaker;
        if (margin+fee>this.state.balanceUSDT+1e-8){ next.push(o); continue; }
        const pos={ id:'pos_'+Date.now(), symbol:o.symbol, side:o.side, entry:o.price, amount:o.amount, leverage:o.leverage, margin, mode:o.mode };
        this.state.balanceUSDT-= (margin+fee); this.mergePosition(pos); filled++;
        this.addHistory({ id:'his_'+Date.now(), ts:Date.now(), symbol:o.symbol, mode:o.mode, leverage:o.leverage, direction: o.side==='long'?'Open Long':'Open Short', type:'Limit', avgPrice:o.price, orderPrice:o.price, filled:o.amount, fee, pnl:null });
        this.ui && this.ui.notifyFill({ title:`Open ${o.side==='long'?'Long':'Short'} ${o.symbol} ${o.mode==='cross'?'Cross':'Isolated'} · ${o.leverage}x`, subtitle:'Limit · Filled', price:o.price, amount:o.amount, mode:o.mode, leverage:o.leverage, type:'success' });
      }
      this.state.openOrders = next; return filled;
    }

    closePositionById(id, mark){
      const idx=this.state.positions.findIndex(p=>p.id===id); if (idx===-1) return false;
      const p=this.state.positions[idx]; const price=Number(mark||p.entry);
      const pnl=this.risk.calcPnL(p, price); const fee=Math.max(0, price*p.amount*(window.PT_CONFIG.fees.taker));
      this.state.balanceUSDT += Math.max(0, p.margin + pnl - fee);
      this.state.positions.splice(idx,1);
      this.addHistory({ id:'his_'+Date.now(), ts:Date.now(), symbol:p.symbol, mode:p.mode, leverage:p.leverage, direction: p.side==='long'?'Close Long':'Close Short', type:'Market', avgPrice:price, orderPrice:price, filled:p.amount, fee, pnl });
      this.ui && this.ui.notifyFill({ title:`Close ${p.side==='long'?'Long':'Short'} ${p.symbol} ${p.mode==='cross'?'Cross':'Isolated'} · ${p.leverage}x`, subtitle:'Market · Filled', price, amount:p.amount, mode:p.mode, leverage:p.leverage, type: pnl>=0?'success':'warn' });
      return true;
    }

    closeAll(mark){
      const price=Number(mark||0); const closed=[...this.state.positions]; let total=0;
      for (const p of closed){ const pnl=this.risk.calcPnL(p, price); const fee=Math.max(0, price*p.amount*(window.PT_CONFIG.fees.taker)); total+=Math.max(0, p.margin + pnl - fee); this.addHistory({ id:'his_'+Date.now()+Math.random(), ts:Date.now(), symbol:p.symbol, mode:p.mode, leverage:p.leverage, direction: p.side==='long'?'Close Long':'Close Short', type:'Market', avgPrice:price, orderPrice:price, filled:p.amount, fee, pnl }); this.ui && this.ui.notifyFill({ title:`Close ${p.side==='long'?'Long':'Short'} ${p.symbol} ${p.mode==='cross'?'Cross':'Isolated'} · ${p.leverage}x`, subtitle:'Market · Filled', price, amount:p.amount, mode:p.mode, leverage:p.leverage, type: pnl>=0?'success':'warn' }); }
      this.state.balanceUSDT += total; this.state.positions=[]; return closed.length;
    }
  }
  window.OrderEngine = OrderEngine;
})();


