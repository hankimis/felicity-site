// Wallet page logic - reads Firestore users collection and displays balances

function $(id){ return document.getElementById(id); }
const STORAGE_KEY = 'paperTradingState_v1';
// 환율 캐시 (간단 샘플, 필요 시 API 연동)
const FX = { USD: 1, USDT: 1, BTC: 1/70000, KRW: 1350 };
let currentCurrency = 'USDT';

function fmtUSD(n){
  const v = Number(n||0);
  if (!isFinite(v)) return '$0.0000';
  return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

// 자산 코드 → 아이콘/배경/이름 매핑
function getAssetIconInfo(assetCode){
  const upper = String(assetCode||'').toUpperCase();
  // 파일 경로는 대소문자 주의
  const iconMap = {
    USDT: '/assets/indexicon/USDT.png',
    BTC: '/assets/indexicon/bitcoin.png',
    ETH: '/assets/indexicon/ethereum.png',
    SOL: '/assets/indexicon/solana.png',
    XRP: '/assets/indexicon/xrp.png',
    BNB: '/assets/indexicon/BNB.png',
    ONBIT: '/assets/indexicon/onbitlogo.png',
  };
  const nameMap = {
    USDT: 'Tether',
    BTC: 'Bitcoin',
    ETH: 'Ethereum',
    SOL: 'Solana',
    XRP: 'XRP',
    BNB: 'BNB',
    ONBIT: 'Onbit Token',
  };
  const bgMap = {
    USDT: '#26A17B',
    BTC: '#F7931A',
    ETH: '#627EEA',
    SOL: '#9945FF',
    XRP: '#ffffff',
    BNB: '#F0B90B',
    ONBIT: '#0a62ff',
  };
  return {
    icon: iconMap[upper] || '',
    fallbackBg: bgMap[upper] || '#333',
    name: nameMap[upper] || upper
  };
}

// 텍스트에서 숫자만 파싱(콤마/공백/문자 제거)
function parseNumeric(text){
  try{ return Number(String(text||'').replace(/[^0-9.\-]/g,'')) || 0; }catch(_){ return 0; }
}

// 로컬 스토리지 포지션에서 심볼별 투자(증거금) 합계를 계산 (USDT 기준)
function getInvestedByBaseFromLocal(){
  const invested = {};
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return invested;
    const ls = JSON.parse(raw);
    const positions = Array.isArray(ls?.positions) ? ls.positions : (Array.isArray(ls?.state?.positions) ? ls.state.positions : []);
    for (const p of positions){
      const symRaw = String(p?.symbol || '').toUpperCase();
      let clean = symRaw.replace(/\s+/g,'').replace(/[^A-Z]/g,'');
      clean = clean.replace(/PERP$/,'');
      clean = clean.replace(/USDT$/,'').replace(/USD$/,'');
      const base = clean && clean.length >= 3 ? clean : null;
      if (!base) continue;
      const margin = Number(p?.margin || 0);
      if (!isFinite(margin) || margin <= 0) continue;
      invested[base] = (invested[base] || 0) + margin; // 이미 USDT 기준
    }
  }catch(_){/* noop */}
  return invested;
}

// 현재 테이블 가격 기준으로 로컬 포지션의 미실현PnL(USDT)을 계산
function computePnLFromLocal(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const ls = JSON.parse(raw);
    const positions = Array.isArray(ls?.positions) ? ls.positions : (Array.isArray(ls?.state?.positions) ? ls.state.positions : []);
    if (!positions || positions.length===0) return 0;
    const body = document.getElementById('pair-table-body');
    let sum = 0;
    for (const p of positions){
      try{
        const symRaw = String(p?.symbol || '').toUpperCase();
        let clean = symRaw.replace(/\s+/g,'').replace(/[^A-Z]/g,'');
        clean = clean.replace(/PERP$/,'');
        clean = clean.replace(/USDT$/,'').replace(/USD$/,'');
        const base = clean && clean.length >= 3 ? clean : null;
        if (!base) continue;
        const entry = Number(p?.entry||0);
        const amtAbs = Math.abs(Number(p?.amount||0));
        const side = String(p?.side||'').toLowerCase();
        if (!isFinite(entry) || entry<=0 || !isFinite(amtAbs) || amtAbs<=0) continue;
        // 현재가: 테이블의 해당 행의 data-price 사용 (없으면 skip)
        let cur = 0;
        if (body){
          const row = Array.from(body.children).find(div=>div.dataset.asset===base);
          if (row) cur = Number(row.dataset.price||0);
        }
        if (!isFinite(cur) || cur<=0) continue;
        const diff = (side==='short') ? (entry - cur) : (cur - entry);
        sum += diff * amtAbs;
      }catch(_){}
    }
    return sum;
  }catch(_){ return 0; }
}

function updateTodayPnl(){
  try {
    const pnl = computePnLFromLocal();
    const el = document.getElementById('tb-pnl');
    if (!el) return;
    const txt = `${pnl>=0?'+':''}${Number(pnl).toFixed(4)} USDT`;
    el.textContent = txt;
    el.style.color = pnl>=0 ? '#10b981' : '#ef4444';
  } catch(_) {}
}

// Hide/Show amounts
let __maskMode = false;
function setMaskMode(flag){
  __maskMode = !!flag;
  try{
    const mask = (el)=>{
      if (!el) return;
      if (__maskMode){ if (!el.dataset.real){ el.dataset.real = el.textContent; } el.textContent = '****'; }
      else { if (el.dataset.real){ el.textContent = el.dataset.real; el.dataset.real = ''; } }
    };
    // Odometer 총잔액은 가시성으로 처리
    const tbAmount = document.getElementById('tb-amount');
    if (__maskMode){ if (tbAmount) tbAmount.style.visibility = 'hidden'; } else { if (tbAmount) tbAmount.style.visibility=''; }
    // 오늘의 손익
    mask(document.getElementById('tb-pnl'));
    const body = document.getElementById('pair-table-body');
    if (body){
      Array.from(body.querySelectorAll('.val, .subval')).forEach(mask);
      // 가격 셀 (3번째 컬럼)
      Array.from(body.children).forEach(row=>{ const priceCell = row.children && row.children[2]; if (priceCell) mask(priceCell); });
    }
    const list = document.getElementById('as-list');
    if (list){ Array.from(list.querySelectorAll('.val .num, .val .pct')).forEach(mask); }
  }catch(_){ }
}
// account-summary 업데이트 (pair-table을 기준으로 코인별 비중 표시)
function updateAccountSummary(){
  try {
    const list = document.getElementById('as-list');
    if (!list) return;
    const bodyEl = document.getElementById('pair-table-body');
    const items = [];

    // 1) USDT 지갑 금액 (잔고)
    let walletUSDT = 0;
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw){
        const ls = JSON.parse(raw);
        walletUSDT = Number(ls?.balanceUSDT ?? ls?.state?.balanceUSDT ?? 0) || 0;
      }
    }catch(_){ walletUSDT = 0; }
    items.push({ name:'USDT', val: walletUSDT, amt: walletUSDT });

    // 2) 포지션별 투자 증거금 합계 (USDT 기준)
    const invested = getInvestedByBaseFromLocal();
    Object.keys(invested).forEach(base=>{
      const v = Number(invested[base]||0);
      if (v > 0) items.push({ name: base, val: v, amt: v });
    });

    // 3) 표시 순서: 금액 큰 순
    items.sort((a,b)=> (b.val - a.val));
    if (bodyEl && bodyEl.children && bodyEl.children.length){
      Array.from(bodyEl.children).forEach((row)=>{
        try{
          const code = String(row?.dataset?.asset||'').toUpperCase();
          const price = Number(row?.dataset?.price|| (code==='USDT'?1:0) || 0);
          const amountText = row.querySelector('.val')?.textContent || '0';
          const amt = parseNumeric(amountText);
          const usd = amt * (price||0);
          if (!code) return;
          // 이미 투자 합계에 포함된 베이스면 DOM 기반 값은 무시 (투자금 우선)
          if (code !== 'USDT' && !invested[code] && usd > 0){
            // 테이블 표시 값(평가액)도 보조로 포함 (투자금 없는 자산 대비)
            items.push({ name: code, val: usd, amt });
          }
        }catch(_){}
      });
    }
    if (items.length === 0) { list.innerHTML = ''; return; }
    const sumVal = items.reduce((s,r)=> s + (Number(r.val)||0), 0);
    const sumAmt = items.reduce((s,r)=> s + (Number(r.amt)||0), 0);
    // 색상 매핑 (아이콘 배경과 동일 팔레트)
    const colorMap = { USDT:'#22c55e', BTC:'#F7931A', ETH:'#627EEA', SOL:'#9945FF', XRP:'#222222', BNB:'#F0B90B', ONBIT:'#0a62ff' };
    list.innerHTML = items.map(r=>{
      const pct = sumVal>0 ? (Number(r.val)/sumVal*100) : (sumAmt>0 ? (Number(r.amt)/sumAmt*100) : 0);
      const dot = `<span class=\"dot\" style=\"background:${colorMap[r.name]||'#888'}\"></span>`;
      return `<li><span class=\"label\">${dot}<span>${r.name}</span></span><span class=\"val\"><span class=\"num\">${fmtUSD(r.val)}</span><span class=\"pct\">${pct.toFixed(2)}%</span></span></li>`;
    }).join('');
    // 상단 바: 각 코인별 색상 세그먼트를 추가
    const bar = document.querySelector('.as-bar');
    if (bar) {
      // 기존 단색 채우기 제거 후 세그먼트 렌더
      bar.innerHTML = '';
      const total = sumVal>0 ? sumVal : sumAmt;
      items.forEach((r)=>{
        const share = total>0 ? (Number(sumVal>0 ? r.val : r.amt)/total*100) : 0;
        const seg = document.createElement('span');
        seg.className = 'as-bar-seg';
        seg.style.width = share + '%';
        seg.style.background = colorMap[r.name] || '#888';
        bar.appendChild(seg);
      });
    }
  } catch(_) {}
}

async function ensureFirebase(){
  return new Promise((resolve)=>{
    const tick = ()=>{
      if (window.firebase && window.auth && window.db) return resolve();
      if (window.startApp) try { window.startApp(); } catch(_) {}
      setTimeout(tick, 200);
    };
    tick();
  });
}

async function loadWallet(){
  await ensureFirebase();
  const authInst = window.auth;
  const user = authInst && authInst.currentUser;
  if (!user) {
    // 아직 로그인 정보가 준비되지 않음 → onAuthStateChanged로 1회만 대기
    if (!window.__walletAuthWaiting && authInst && typeof authInst.onAuthStateChanged === 'function') {
      window.__walletAuthWaiting = true;
      authInst.onAuthStateChanged((u)=>{ if (u && !window.__walletStarted){ window.__walletStarted = true; loadWallet(); } });
    } else {
      // 폴백: 짧은 폴링 시도
      setTimeout(loadWallet, 500);
    }
    return;
  }
  if (window.__walletStarted) return; // 중복 실행 방지
  window.__walletStarted = true;
  try{
    const ref = window.db.collection('users').doc(user.uid);

    const render = (data)=>{
      const pt = (data && data.paperTrading) || {};
      const wallet = (data && data.wallet) || {};

      // 모의투자 로컬 스토리지 상태 읽기 (포지션 합산용)
      let lsBalance = 0, lsMarginSum = 0;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const ls = JSON.parse(raw);
          lsBalance = Number(ls?.balanceUSDT ?? ls?.state?.balanceUSDT ?? 0);
          const positions = (ls?.positions ?? ls?.state?.positions ?? []);
          if (Array.isArray(positions)) lsMarginSum = positions.reduce((s,p)=> s + Number(p?.margin||0), 0);
        }
      } catch(_) {}

      // Firestore 값 우선, 없으면 로컬 값 사용
      const fsBalance = Number(pt.balanceUSDT ?? pt.balance ?? 0);
      const balance = isFinite(fsBalance) && fsBalance>0 ? fsBalance : lsBalance;
      // Total Balance = 모의투자 잔고 + 현재 포지션에 들어간 마진 합
      const total = Number(balance) + Number(lsMarginSum||0);
      window.__lastTotalUSDT = total;
      renderTotalWithCurrency(total);
      $('tb-pnl').textContent = typeof pt.todayPnL === 'number' ? `${pt.todayPnL>=0?'+':''}${pt.todayPnL.toFixed(4)} USDT` : '';
      // PnL 색상 적용
      try {
        const pnlVal = Number(pt.todayPnL);
        const pnlEl = document.getElementById('tb-pnl');
        if (isFinite(pnlVal) && pnlEl) {
          pnlEl.style.color = pnlVal >= 0 ? '#10b981' : '#ef4444';
        }
      } catch(_) {}

      // account summary → 코인 심볼별 비중(USDT 환산)
      try {
        const list = $('as-list');
        if (list) {
          const body = $('pair-table-body');
          const items = [];
          if (body) {
            Array.from(body.children).forEach((row)=>{
              const code = String(row?.dataset?.asset||'').toUpperCase();
              const price = Number(row?.dataset?.price|| (code==='USDT'?1:0) || 0);
              const amountText = row.querySelector('.val')?.textContent || '0';
              const amt = Number(String(amountText).replace(/[^0-9.\-]/g,'')) || 0;
              const usd = amt * (price||0);
              if (!code) return;
              items.push({ name: code, val: usd });
            });
          }
          const sum = items.reduce((s,r)=> s + (Number(r.val)||0), 0);
          list.innerHTML = items.map(r=>{
            const pct = sum>0 ? (Number(r.val)/sum*100) : 0;
            return `<li><span>${r.name}</span><span class=\"val\"><span class=\"num\">${fmtUSD(r.val)}</span><span class=\"pct\">${pct.toFixed(2)}%</span></span></li>`;
          }).join('');
          const fill = $('as-bar-fill');
          if (fill) {
            const maxShare = sum>0 ? Math.max(0, ...items.map(r=> Number(r.val)/sum*100)) : 0;
            fill.style.width = `${maxShare}%`;
          }
        }
      } catch(_) {}

      // ONBIT 값 결정 (우선순위: Firestore → currentUser → onbitMiner)
      let onbit = 0;
      try {
        if (typeof data?.mining?.onbit === 'number') onbit = Number(data.mining.onbit);
        else if (typeof data?.onbit === 'number') onbit = Number(data.onbit);
        else if (typeof window.currentUser?.mining?.onbit === 'number') onbit = Number(window.currentUser.mining.onbit);
        else if (window.onbitMiner && typeof window.onbitMiner.current === 'number') onbit = Number(window.onbitMiner.current);
      } catch(_) {}

      // 가격 소스 (간략 고정/샘플). 필요 시 실시간 API로 교체 가능
      const priceMap = {
        BTC: Number(wallet.btcPriceUSD || 11296.33),
        USDT: 1,
      };

      // 자산 목록 (아이콘 경로 포함)
      const baseFromPos = getBaseAssetAmountsFromLocal();
      const assets = [
        { code:'USDT', name:'Tether', amount: Number(wallet.usdt ?? balance ?? 0), price: priceMap.USDT, icon:'/assets/indexicon/USDT.png', fallbackBg:'#26A17B' },
        { code:'BTC', name:'Bitcoin', amount: Number(wallet.btcAmount||baseFromPos.BTC||0), price: priceMap.BTC, icon:'/assets/indexicon/bitcoin.png', fallbackBg:'#F7931A' },
        { code:'ONBIT', name:'Onbit Token', amount: Number(onbit||0), price: Number(wallet.onbitPrice||0), icon:'/assets/indexicon/onbitlogo.png', fallbackBg:'#0a62ff' },
      ];
      const body = $('pair-table-body');
      if (body) body.innerHTML = assets.map(a=>{
        const amount = Number(a.amount||0);
        const usdVal = amount * Number(a.price||0);
        const iconImg = a.icon ? `<img src="${a.icon}" alt="${a.code}" onerror="this.remove()">` : '';
        return `
        <div class="row" data-asset="${a.code}" data-price="${Number(a.price||0)}">
          <div class="asset-cell">
            <span class="asset-icon" style="background:${a.fallbackBg}">${iconImg || a.code[0]}</span>
            <span class="asset-info">
              <span class="asset-code">${a.code}</span>
              <span class="asset-name">${a.name}</span>
            </span>
          </div>
          <div>
            <div class="val">${a.code==='ONBIT' ? amount.toFixed(3) : amount}</div>
            <div class="subval">≈${fmtUSD(usdVal)}</div>
          </div>
          <div>${fmtUSD(a.price)}</div>
          ${ (a.code==='USDT' || a.code==='ONBIT')
              ? '<div></div>'
              : `<div style="display:flex; justify-content:flex-end;"><button class="act-btn" data-asset="${a.code}">Trade</button></div>` }
        </div>`;
      }).join('');
      // 로컬 포지션에 존재하는 다른 베이스 자산들도 테이블에 보장
      try {
        Object.keys(baseFromPos||{}).forEach((base)=>{
          const up = String(base).toUpperCase();
          if (up==='USDT' || up==='BTC' || up==='ONBIT') return;
          ensureAssetRow(up, Number(baseFromPos[up]||0));
          startAssetPriceStream(up);
        });
      } catch(_) {}

      // 확실한 동기화: ONBIT 값 다시 찍기 (Firestore 값/이벤트 마지막 값 우선)
      const finalOnbit = (typeof window.__onbitLast === 'number') ? window.__onbitLast : onbit;
      updateAssetAmount('ONBIT', finalOnbit);

      // account summary 업데이트 트리거
      try { updateAccountSummary(); } catch(_) {}
    };

    // 최초 로드 + 실시간 구독
    const snap = await ref.get();
    const initial = snap.exists ? snap.data() : {};
    render(initial);
    // Firestore가 비어 있거나 총액이 0이면 로컬 스토리지 폴백
    try {
      const currentTotal = parseNumeric($('tb-amount')?.textContent || '0');
      if (!isFinite(currentTotal) || currentTotal === 0) {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const ls = JSON.parse(raw);
          const lsBalance = Number(ls?.balanceUSDT ?? ls?.state?.balanceUSDT ?? 0);
          if (isFinite(lsBalance) && lsBalance > 0) {
            $('tb-amount').innerHTML = lsBalance.toFixed(4);
            const body = $('pair-table-body');
            if (body) {
              const usdtRow = `
                <div class="row" data-asset="USDT" data-price="1">
                  <div class="asset-cell">
                    <span class="asset-icon" style="background:#26A17B"><img src="/assets/indexicon/USDT.png" alt="USDT" onerror="this.remove()"></span>
                    <span class="asset-info"><span class="asset-code">USDT</span><span class="asset-name">Tether</span></span>
                  </div>
                  <div><div class="val">${lsBalance.toFixed(4)}</div><div class="subval">≈${fmtUSD(lsBalance)}</div></div>
                  <div>${fmtUSD(1)}</div>
                  <div></div>
                </div>`;
              body.innerHTML = usdtRow + body.innerHTML;
            }
          }
        }
      }
    } catch(_) {}
    ref.onSnapshot((doc)=>{
      if (doc && doc.exists) {
        const data = doc.data();
        render(data);
        try {
          const ob = Number(data?.mining?.onbit ?? data?.onbit ?? NaN);
          if (isFinite(ob)) {
            window.__onbitLast = ob;
            updateAssetAmount('ONBIT', ob);
          }
        } catch(_) {}
      }
    });

    // onbitMiner 실시간 이벤트 반영
    window.addEventListener('onbit:balance', (e)=>{
      try {
        const val = Number(e?.detail?.balance ?? e?.detail);
        if (!isFinite(val)) return;
        window.__onbitLast = val;
        updateAssetAmount('ONBIT', val);
      } catch(_) {}
    });
    try {
      if (window.onbitMiner && typeof window.onbitMiner.setUser === 'function') {
        window.onbitMiner.setUser({ uid: user.uid });
        if (typeof window.onbitMiner.setExternalControlled === 'function') {
          window.onbitMiner.setExternalControlled(true);
        }
        if (typeof window.onbitMiner.refreshBalance === 'function') {
          window.onbitMiner.refreshBalance().then((v)=>{
            if (typeof v === 'number') { window.__onbitLast = v; updateAssetAmount('ONBIT', v); }
          }).catch(()=>{});
        }
      }
    } catch(_) {}

  }catch(e){ console.error('Wallet load failed', e); }
}

document.addEventListener('DOMContentLoaded', loadWallet);

// 홈과 동일하게 currentUser 캐시를 폴백으로 사용하여 즉시 ONBIT 반영
document.addEventListener('DOMContentLoaded', ()=>{
  // Odometer 초기화 보장 (초기 진입 시 애니메이션)
  try { ensureOdometer(); } catch(_) {}
  // Pair 검색 필터 연결
  try {
    const inp = document.getElementById('pair-search');
    if (inp && !inp.__bound) {
      inp.addEventListener('input', ()=>{
        try{
          const q = String(inp.value||'').trim().toLowerCase();
          const body = document.getElementById('pair-table-body');
          if (!body) return;
          Array.from(body.children).forEach((row)=>{
            const code = String(row?.dataset?.asset||'').toLowerCase();
            const name = String(row?.querySelector('.asset-name')?.textContent||'').toLowerCase();
            row.style.display = (!q || code.includes(q) || name.includes(q)) ? '' : 'none';
          });
        }catch(_){/* noop */}
      });
      inp.__bound = true;
    }
  } catch(_) {}
  try {
    const tryUpdate = ()=>{
      const v = Number(window.currentUser?.mining?.onbit);
      if (isFinite(v) && v > 0) {
        window.__onbitLast = v;
        updateAssetAmount('ONBIT', v);
        return true;
      }
      return false;
    };
    // 즉시 1회 + 최대 10회(5초) 재시도
    if (!tryUpdate()) {
      let n=0; const iv = setInterval(()=>{ n++; if (tryUpdate() || n>10) clearInterval(iv); }, 500);
    }
    // auth.js가 쏘는 사용자 데이터 갱신 이벤트도 구독
    window.addEventListener('userDataUpdated', (e)=>{
      try {
        const v = Number(e?.detail?.user?.mining?.onbit);
        if (isFinite(v)) { window.__onbitLast = v; updateAssetAmount('ONBIT', v); }
      } catch(_) {}
    });
  } catch(_) {}
});

// 먼저 로컬 스토리지 기반으로 즉시 프리렌더 (로그인/파이어베이스 없이도 표시)
(function preRenderFromLocal(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const ls = JSON.parse(raw);
    const bal = Number(ls?.balanceUSDT ?? 0);
    const positions = Array.isArray(ls?.positions) ? ls.positions : [];
    const marginSum = positions.reduce((s,p)=> s + Number(p?.margin||0), 0);
    const total = bal + marginSum;
    if (isFinite(total)) { window.__lastTotalUSDT = total; renderTotalWithCurrency(total); }
    const body = document.getElementById('pair-table-body');
      if (body) {
        const priceMap = { BTC: 11296.33, USDT: 1 };
        const btcAmt = Number((window.wallet?.btcAmount)||0);
        let onbit = 0;
        try {
          if (typeof window.currentUser?.mining?.onbit === 'number') onbit = Number(window.currentUser.mining.onbit);
          else if (window.onbitMiner && typeof window.onbitMiner.current==='number') onbit = Number(window.onbitMiner.current);
        } catch(_) {}
        body.innerHTML = `
          <div class="row" data-asset="USDT" data-price="1">
            <div class="asset-cell">
              <span class="asset-icon" style="background:#26A17B"><img src="/assets/indexicon/USDT.png" alt="USDT" onerror="this.remove()"></span>
              <span class="asset-info"><span class="asset-code">USDT</span><span class="asset-name">Tether</span></span>
            </div>
            <div><div class="val">${isFinite(bal)?bal.toFixed(4):'0.0000'}</div><div class="subval">≈${fmtUSD((isFinite(bal)?bal:0)*priceMap.USDT)}</div></div>
            <div>${fmtUSD(priceMap.USDT)}</div>
            <div></div>
          </div>
          <div class="row" data-asset="BTC" data-price="${priceMap.BTC}">
            <div class="asset-cell">
              <span class="asset-icon" style="background:#F7931A"><img src="/assets/indexicon/bitcoin.png" alt="BTC" onerror="this.remove()"></span>
              <span class="asset-info"><span class="asset-code">BTC</span><span class="asset-name">Bitcoin</span></span>
            </div>
            <div><div class="val">${btcAmt}</div><div class="subval">≈${fmtUSD(btcAmt*priceMap.BTC)}</div></div>
            <div>${fmtUSD(priceMap.BTC)}</div>
            <div><button class="act-btn" data-asset="BTC">Trade</button></div>
          </div>
          <div class="row" data-asset="ONBIT" data-price="0">
            <div class="asset-cell">
              <span class="asset-icon" style="background:#0a62ff"><img src="/assets/indexicon/onbitlogo.png" alt="ONBIT" onerror="this.remove()"></span>
              <span class="asset-info"><span class="asset-code">ONBIT</span><span class="asset-name">Onbit Token</span></span>
            </div>
            <div><div class="val">${isFinite(onbit)?Number(onbit).toFixed(3):'0.000'}</div><div class="subval">≈${fmtUSD(0)}</div></div>
          <div>${fmtUSD(0)}</div>
          <div></div>
          </div>
        `;
      }
  }catch(_){/* noop */}
})();

// 통화 드롭다운 동작 및 변환(표시 전용)
document.addEventListener('click', (e)=>{
  const btn = document.getElementById('tb-currency');
  const menu = document.getElementById('tb-currency-menu');
  if (!btn || !menu) return;
  if (btn.contains(e.target)) {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    // 메뉴 위치를 버튼 바로 아래로 정렬
    try {
      const container = btn.closest('.tb-amount-row') || btn.parentElement || document.body;
      // 컨테이너 상대 위치로 버튼 바로 아래 정렬
      const top = btn.offsetTop + btn.offsetHeight + 6; // 버튼 하단 + 여백
      const left = btn.offsetLeft; // 버튼의 좌측에 정렬
      menu.style.top = top + 'px';
      menu.style.left = left + 'px';
      // 컨테이너는 CSS에서 position: relative;
    } catch(_) {}
    menu.hidden = expanded;
    return;
  }
  if (menu.contains(e.target)) {
    const opt = e.target.closest('button[role="option"]');
    if (opt) {
      menu.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
      opt.classList.add('active');
      const cur = opt.dataset.cur;
      currentCurrency = cur;
      btn.innerHTML = cur + ' <span class="tb-caret">▾</span>';
      applyCurrency(cur);
    }
    btn.setAttribute('aria-expanded','false');
    menu.hidden = true;
    return;
  }
  // 외부 클릭 닫기
  if (!menu.hidden) { menu.hidden = true; btn.setAttribute('aria-expanded','false'); }
  // 눈 아이콘 토글 (마스킹)
  if (e.target && e.target.id === 'tb-eye') {
    setMaskMode(!__maskMode);
  }
});

function ensureOdometer(){
  try{
    if (!window.__odometer && window.Odometer) {
      const el = document.getElementById('tb-amount');
      if (el) {
        window.__odometer = new Odometer({
          el,
          value: parseNumeric(el.textContent || '0'),
          format: '(,ddd).dddd',
          theme: 'default',
          duration: 600
        });
      }
    }
  }catch(_){/* noop */}
}

function renderTotalWithCurrency(baseUSDT){
  const el = document.getElementById('tb-amount'); if (!el) return;
  ensureOdometer();
  const v = convert(baseUSDT, currentCurrency);
  const formatted = formatAmount(v, currentCurrency);
  // Odometer는 숫자만 전달해야 자연스러운 자리수 애니메이션
  const numeric = parseNumeric(formatted);
  if (window.__odometer) {
    // 마스킹 중에도 내부 값은 업데이트하되 표시만 가린다
    try { window.__odometer.update(numeric); } catch(_) {}
    if (__maskMode) { el.style.visibility = 'hidden'; } else { el.style.visibility = ''; }
  } else {
    if (!__maskMode) el.textContent = formatted;
  }
  const btn = document.getElementById('tb-currency');
  if (btn) btn.innerHTML = currentCurrency + ' <span class="tb-caret">▾</span>';
}

// 로컬 스토리지 포지션으로부터 베이스 코인 수량 합산 (예: BTCUSDT -> BTC)
function getBaseAssetAmountsFromLocal(){
  const out = {};
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return out;
    const ls = JSON.parse(raw);
    const positions = Array.isArray(ls?.positions) ? ls.positions : (Array.isArray(ls?.state?.positions) ? ls.state.positions : []);
    for (const p of positions){
      const symRaw = String(p?.symbol || '').toUpperCase();
      let clean = symRaw.replace(/\s+/g,'').replace(/[^A-Z]/g,'');
      clean = clean.replace(/PERP$/,'');
      clean = clean.replace(/USDT$/,'').replace(/USD$/,'');
      const base = clean && clean.length >= 3 ? clean : null;
      if (!base) continue;
      const amt = Number(p?.amount || 0);
      if (!isFinite(amt)) continue;
      out[base] = (out[base] || 0) + Math.abs(amt);
    }
  }catch(_){/* noop */}
  return out;
}

// pair 테이블을 로컬 포지션 기준으로 즉시 갱신 (BTC 등)
function refreshPairsFromLocal(){
  try{
    const baseFromPos = getBaseAssetAmountsFromLocal();
    // 모든 발견된 베이스 자산을 테이블에 반영
    Object.keys(baseFromPos||{}).forEach((base)=>{
      const upper = String(base).toUpperCase();
      ensureAssetRow(upper, Number(baseFromPos[upper]));
      updateAssetAmount(upper, Number(baseFromPos[upper]));
      startAssetPriceStream(upper);
    });
  }catch(_){/* noop */}
}

// 다른 탭(실시간 차트 페이지)에서 localStorage가 갱신되면 즉시 반영
window.addEventListener('storage', (e)=>{
  if (e && e.key === STORAGE_KEY) { refreshPairsFromLocal(); updateTotalFromLocal(); }
});

// 폴백: 동일 탭 내에서 엔진이 상태를 저장해도 storage 이벤트가 없을 수 있으므로 주기 확인
(function pollLocalPositions(){
  try{
    let prev = localStorage.getItem(STORAGE_KEY) || '';
    setInterval(()=>{
      try{
        const cur = localStorage.getItem(STORAGE_KEY) || '';
        if (cur !== prev) { prev = cur; refreshPairsFromLocal(); updateTotalFromLocal(); }
      }catch(_){/* noop */}
    }, 1500);
  }catch(_){/* noop */}
})();

// 총잔액을 로컬 상태 기준으로 재계산하여 즉시 반영
function updateTotalFromLocal(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const ls = JSON.parse(raw);
    const bal = Number(ls?.balanceUSDT ?? ls?.state?.balanceUSDT ?? 0);
    const positions = Array.isArray(ls?.positions) ? ls.positions : (Array.isArray(ls?.state?.positions) ? ls.state.positions : []);
    const marginSum = positions.reduce((s,p)=> s + Number(p?.margin||0), 0);
    const total = bal + marginSum;
    if (isFinite(total)) { window.__lastTotalUSDT = total; renderTotalWithCurrency(total); }
  }catch(_){/* noop */}
}

// 초기 진입 시 즉시 반영
document.addEventListener('DOMContentLoaded', ()=>{
  try{ refreshPairsFromLocal(); updateTotalFromLocal(); }catch(_){/* noop */}
  try{ startBtcPriceStream(); }catch(_){/* noop */}
  // 첫 렌더 직후 account-summary 채우기 (pair-table 생성 이후 한 프레임 지연)
  try { requestAnimationFrame(()=>{ try{ updateAccountSummary(); }catch(_){}}); } catch(_) {}
  // 오늘의 손익 초기 표시
  try { setTimeout(updateTodayPnl, 80); } catch(_) {}
  // Trade 버튼 네비게이션 (위임)
  try {
    const container = document.querySelector('.pair-table');
    if (container && !container.__tradeNavBound){
      container.addEventListener('click', (e)=>{
        const btn = e.target.closest && e.target.closest('.act-btn');
        if (!btn) return;
        const row = btn.closest('.row');
        const asset = row && row.getAttribute('data-asset');
        if (!asset) return;
        const symbol = `${asset}USDT`.toUpperCase();
        // 기존 리다이렉트 제거: 필요 시 별도 버튼에서 이동
        const url = `/community/index.html?symbol=${encodeURIComponent(symbol)}`;
        // window.location.href = url;
      });
      container.__tradeNavBound = true;
    }
  } catch(_) {}
});

function convert(valueUSDT, currency){
  const v = Number(valueUSDT||0);
  if (!isFinite(v)) return 0;
  if (currency === 'BTC') return v * (FX.BTC); // USDT->BTC (대략)
  if (currency === 'KRW') return v * FX.KRW;   // USDT->KRW
  // USD/USDT는 1:1
  return v;
}

function formatAmount(n, currency){
  if (currency === 'BTC') return Number(n).toFixed(6);
  if (currency === 'KRW') return Number(n).toLocaleString('ko-KR');
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function applyCurrency(cur){
  try {
    const text = document.getElementById('tb-amount')?.textContent || '0';
    // 재계산을 위해 다시 총액을 로컬/메모리에서 산출
    const raw = localStorage.getItem(STORAGE_KEY);
    let base = 0;
    if (raw) {
      const ls = JSON.parse(raw);
      const bal = Number(ls?.balanceUSDT ?? 0);
      const pos = Array.isArray(ls?.positions) ? ls.positions : [];
      const marginSum = pos.reduce((s,p)=> s + Number(p?.margin||0), 0);
      base = bal + marginSum;
    }
    window.__lastTotalUSDT = base;
    renderTotalWithCurrency(base);
  } catch(_) {}
}

// 표 내부 특정 자산 수량/보조표기 즉시 갱신 유틸
function updateAssetAmount(assetCode, amount){
  try {
    const body = document.getElementById('pair-table-body'); if (!body) return;
    let row = Array.from(body.children).find(div=>div.dataset.asset === assetCode);
    if (!row) {
      // 존재하지 않으면 새 행 생성 후 가격 스트림 보장
      ensureAssetRow(assetCode, Number(amount||0));
      row = Array.from(body.children).find(div=>div.dataset.asset === assetCode);
    }
    const amountCell = row.children[1];
    if (!amountCell) return;
    const valEl = amountCell.querySelector('.val');
    if (valEl) valEl.textContent = (assetCode==='ONBIT') ? Number(amount).toFixed(3) : String(amount);
    const sub = amountCell.querySelector('.subval');
    const price = Number(row.dataset.price || 0);
    if (sub) sub.textContent = `≈${fmtUSD(Number(amount) * price)}`;
  } catch(_) {}
}

// 자산별 실시간 가격 스트림 (Binance miniTicker)
const __assetWsMap = Object.create(null);
function startAssetPriceStream(assetCode){
  try{
    const base = String(assetCode||'').toUpperCase();
    if (!base) return;
    const key = base + 'USDT';
    const cur = __assetWsMap[key];
    if (cur && cur.readyState === 1) return;
    try { cur && cur.close && cur.close(); } catch(_){ }
    const url = 'wss://stream.binance.com:9443/ws/' + String(base).toLowerCase() + 'usdt@miniTicker';
    const ws = new WebSocket(url);
    __assetWsMap[key] = ws;
    ws.onmessage = (ev)=>{
      try{
        const data = JSON.parse(ev.data);
        const price = Number(data?.c || data?.lastPrice || 0);
        if (!isFinite(price) || price <= 0) return;
        const body = document.getElementById('pair-table-body');
        const row = body && Array.from(body.children).find(div=>div.dataset.asset === base);
        if (row){
          row.dataset.price = String(price);
          if (row.children[2]) row.children[2].textContent = fmtUSD(price);
          const amountCell = row.children[1];
          const amtText = amountCell?.querySelector('.val')?.textContent || '0';
          const amt = Number(amtText.replace(/[^0-9.\-]/g,'')) || 0;
          const sub = amountCell?.querySelector('.subval');
          if (sub) sub.textContent = `≈${fmtUSD(amt * price)}`;
        }
        if (base === 'BTC') {
          FX.BTC = 1/price;
          if (currentCurrency === 'BTC' && typeof window.__lastTotalUSDT === 'number') {
            renderTotalWithCurrency(window.__lastTotalUSDT);
          }
        }
      }catch(_){/* noop */}
    };
    ws.onclose = ()=>{ setTimeout(()=>{ try{ startAssetPriceStream(base); }catch(_){} }, 3000); };
    ws.onerror = ()=>{ try{ ws.close(); }catch(_){} };
  }catch(_){/* noop */}
}

// 초기에는 BTC 스트림 보장
function startBtcPriceStream(){ startAssetPriceStream('BTC'); }

// 행이 없으면 생성하는 유틸
function ensureAssetRow(assetCode, amount){
  try{
    const body = document.getElementById('pair-table-body'); if (!body) return;
    const upper = String(assetCode||'').toUpperCase(); if (!upper) return;
    let row = Array.from(body.children).find(div=>div.dataset.asset === upper);
    if (row) return; // 이미 존재
    const info = getAssetIconInfo(upper);
    const icon = info.icon || '';
    const bg = info.fallbackBg || '#333';
    const name = info.name || upper;
    const iconImg = icon ? `<img src="${icon}" alt="${upper}" onerror="this.remove()">` : '';
    const price = 0;
    const html = `
        <div class="row" data-asset="${upper}" data-price="${price}">
        <div class="asset-cell">
          <span class="asset-icon" style="background:${bg}">${iconImg || upper[0]}</span>
          <span class="asset-info">
            <span class="asset-code">${upper}</span>
            <span class="asset-name">${name}</span>
          </span>
        </div>
        <div>
          <div class="val">${upper==='ONBIT' ? Number(amount||0).toFixed(3) : String(Number(amount||0))}</div>
          <div class="subval">≈${fmtUSD(0)}</div>
        </div>
        <div>${fmtUSD(price)}</div>
        ${ (upper==='USDT' || upper==='ONBIT')
            ? '<div></div>'
            : `<div><button class="act-btn" data-asset="${upper}">Trade</button></div>` }
      </div>`;
    body.insertAdjacentHTML('beforeend', html);
  }catch(_){/* noop */}
}


