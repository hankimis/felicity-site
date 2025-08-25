(function(){
  const CONFIG = window.PT_CONFIG;
  const FEE_TAKER = CONFIG.fees.taker;
  class RiskFunding {
    constructor(getters){
      this.getters = getters; // { getState, getBrackets }
    }
    getMaintenanceRate(p){
      const brackets = (this.getters && this.getters.getBrackets && this.getters.getBrackets()) || null;
      if (brackets && brackets.length){
        const state = this.getters.getState();
        const notional = Math.max(0,(state.lastPrice||p.entry)*p.amount);
        let mmr = brackets[0].mmr;
        for (const b of brackets){ if (!isFinite(b.cap)||b.cap<=0){ mmr=b.mmr; break; } if (notional<=b.cap){ mmr=b.mmr; break; } mmr=b.mmr; }
        if (isFinite(mmr)&&mmr>0) return mmr;
      }
      const L=Math.max(1,p.leverage); const scaled=(1/L)*0.6; return Math.max(0.0025, Math.min(0.008, scaled));
    }
    calcPnL(p, price){ const d=p.side==='long'? price-p.entry : p.entry-price; return d*p.amount; }
    calcLiqPrice(p){
      try{
        const s=this.getters.getState();
        const e=+p.entry, A=Math.max(1e-12,+p.amount), f=+FEE_TAKER, mmr=+this.getMaintenanceRate(p);
        const wallet=Math.max(0, s.balanceUSDT||0);
        const base=p.mode==='isolated'? +p.margin : +p.margin + wallet;
        const denomLong=A*(1-f-mmr), denomShort=A*(1+f+mmr);
        if (p.side==='long'){ if (denomLong>1e-12){ const P=(e*A-base)/denomLong; if (isFinite(P)&&P>0) return P; } }
        else { if (denomShort>1e-12){ const P=(base+e*A)/denomShort; if (isFinite(P)&&P>0) return P; } }
        const Lf=Math.max(1.0001, +p.leverage||1); return p.side==='long'? e*(1-1/Lf) : e*(1+1/Lf);
      }catch(_){ return NaN; }
    }

    applyFundingIfDue(){
      const s=this.getters.getState(); const now=Date.now();
      if (!s.lastFundingTs) s.lastFundingTs = now;
      if (now - s.lastFundingTs < window.PT_CONFIG.fundingIntervalMs) return false;
      const rate=Number(s.fundingRate||0); if (!isFinite(rate) || s.positions.length===0){ s.lastFundingTs=now; return false; }
      const mark=s.lastPrice||0; let changed=false;
      for (const p of s.positions){ const notional=Math.max(0, mark*p.amount); if (notional<=0) continue; const base=notional*Math.abs(rate); const flow=(rate>0)?(p.side==='long'?-base:+base):(p.side==='long'?+base:-base); if (p.mode==='isolated'){ p.margin=Math.max(0,p.margin+flow);} else { s.balanceUSDT+=flow; } changed=true; }
      s.lastFundingTs=now; return changed;
    }

    checkLiquidations(){
      const s=this.getters.getState(); let liq=0; const mark=s.lastPrice||0; const totalUPnL=s.positions.reduce((a,p)=>a+this.calcPnL(p,mark),0); const remain=[];
      for (const p of s.positions){ const notional=Math.max(0, mark*p.amount); const mmr=this.getMaintenanceRate(p); const maint=notional*mmr; const feeEst=notional*FEE_TAKER; const pnl=this.calcPnL(p,mark); let available; if (p.mode==='isolated'){ available=p.margin+pnl-feeEst; } else { available=s.balanceUSDT + totalUPnL - feeEst; } if (available - maint < -1e-8){ const liqFee=Math.max(0, mark*p.amount*FEE_TAKER); s.balanceUSDT += Math.max(0, p.margin + pnl - liqFee); liq++; } else { remain.push(p); } }
      if (liq>0) s.positions=remain; return liq;
    }

    getTierInfo(p){
      const brackets = (this.getters && this.getters.getBrackets && this.getters.getBrackets()) || null;
      const s=this.getters.getState();
      const notional=Math.max(0,(s.lastPrice||p.entry)*p.amount);
      if (brackets && brackets.length){
        let mmr = brackets[0].mmr, cap = brackets[0].cap; let idx=0;
        for (let i=0;i<brackets.length;i++){ const b=brackets[i]; if (!isFinite(b.cap)||b.cap<=0){ mmr=b.mmr; cap=b.cap; idx=i; break; } if (notional<=b.cap){ mmr=b.mmr; cap=b.cap; idx=i; break; } mmr=b.mmr; cap=b.cap; idx=i; }
        return { mmr, cap, idx, notional };
      }
      const mmr = this.getMaintenanceRate(p);
      return { mmr, cap: null, idx: null, notional };
    }
  }
  window.RiskFunding = RiskFunding;
})();


