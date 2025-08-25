(function(){
  class OrderEngine {
    constructor(state, risk, ui){
      this.state = state; // 참조 객체
      this.risk = risk;
      this.ui = ui;
      this.MAXH = (window.PT_CONFIG && window.PT_CONFIG.cache && window.PT_CONFIG.cache.historyMax) || 500;
    }
    addHistory(rec){
      try {
        this.state.history.unshift(rec);
        if (this.state.history.length > this.MAXH) this.state.history.length = this.MAXH;
      } catch(_) {}
    }
    calcPnL(p, price){ return this.risk.calcPnL(p, price); }
    placeMarket(side, price, amount){
      const lev=this.state.leverage;
      const margin=price*amount/lev;
      const fee=price*amount*(window.PT_CONFIG.fees.taker);
      if (margin+fee>this.state.balanceUSDT+1e-8) return false;
      const pos={ id:'pos_'+Date.now(), symbol:this.state.symbol, side, entry:price, amount, leverage:lev, margin, mode:this.state.marginMode };
      this.state.balanceUSDT-= (margin+fee);
      this.state.positions.push(pos);
      this.addHistory({ id:'his_'+Date.now(), ts:Date.now(), symbol:this.state.symbol, mode:this.state.marginMode, leverage:lev, direction: side==='long'?'Open Long':'Open Short', type:'Market', avgPrice:price, orderPrice:price, filled:amount, fee, pnl:null });
      this.ui && this.ui.notifyFill({ title:`Open ${side==='long'?'Long':'Short'} ${this.state.symbol} ${this.state.marginMode==='cross'?'Cross':'Isolated'} · ${lev}x`, subtitle:'Perp · Filled', price, amount, mode:this.state.marginMode, leverage:lev, type:'success' });
      return true;
    }

    placeLimit(side, price, amount){
      const order={ id:'ord_'+Date.now(), symbol:this.state.symbol, side, price, amount, leverage:this.state.leverage, mode:this.state.marginMode, status:'Unfilled', createdAt:new Date().toISOString() };
      this.state.openOrders.push(order); return order;
    }

    matchOpenOrders(mark){
      const price = Number(mark||0);
      if (!Array.isArray(this.state.openOrders)||this.state.openOrders.length===0) return 0;
      const next=[]; let filled=0; const feeMaker=window.PT_CONFIG.fees.maker;
      for (const o of this.state.openOrders){
        const shouldFill = o.side==='long' ? (price <= o.price + 1e-8) : (price >= o.price - 1e-8);
        if (!shouldFill){ next.push(o); continue; }
        const margin = o.price*o.amount/o.leverage; const openNotional=o.price*o.amount; const fee=openNotional*feeMaker;
        if (margin+fee>this.state.balanceUSDT+1e-8){ next.push(o); continue; }
        const pos={ id:'pos_'+Date.now(), symbol:o.symbol, side:o.side, entry:o.price, amount:o.amount, leverage:o.leverage, margin, mode:o.mode };
        this.state.balanceUSDT-= (margin+fee); this.state.positions.push(pos); filled++;
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


