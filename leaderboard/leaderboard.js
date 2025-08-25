// Leaderboard page script
// 데이터 소스: users 컬렉션의 paperTrading.{equityUSDT|balanceUSDT}

const q = (s, r=document) => r.querySelector(s);
const qa = (s, r=document) => Array.from(r.querySelectorAll(s));
const fmt = (n) => Number(n||0).toLocaleString('ko-KR', { maximumFractionDigits: 2 });

const state = {
  tab: 'futures',
  sub: 'roi',
  items: [],
};

async function waitForFirebase(maxMs = 5000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function tick(){
      if (typeof firebase !== 'undefined') return resolve();
      if (Date.now() - start > maxMs) return reject(new Error('Firebase SDK not loaded'));
      setTimeout(tick, 100);
    })();
  });
}

async function ensureFirestore() {
  await waitForFirebase(7000);
  if (!firebase.apps || !firebase.apps.length) {
    const cfg = (typeof window !== 'undefined' && window.firebaseConfig) ? window.firebaseConfig : {
      apiKey: "AIzaSyCbvgcol3P4wTUNh88-d9HPZl-2NC9WbqI",
      authDomain: "livechattest-35101.firebaseapp.com",
      projectId: "livechattest-35101",
      storageBucket: "livechattest-35101.firebasestorage.app",
      messagingSenderId: "880700591040",
      appId: "1:880700591040:web:a93e47bf19a9713a245625",
      measurementId: "G-ER1H2CCZW9",
      databaseURL: "https://livechattest-35101-default-rtdb.asia-southeast1.firebasedatabase.app/"
    };
    firebase.initializeApp(cfg);
  }
  if (!window.db) {
    window.db = firebase.firestore();
  }
  return window.db;
}

function computeRoiAndPnl(equity, initial) {
  const pnl = equity - initial;
  const roi = (pnl / (initial || 1)) * 100;
  return { roi, pnl };
}

async function fetchUsersPaperTrading() {
  const db = await ensureFirestore();
  const snap = await db.collection('users').limit(1000).get();
  const DEFAULT_INITIAL = 10000;
  const rows = [];
  snap.forEach(doc => {
    const u = doc.data() || {};
    const pt = u.paperTrading || {};
    const onbit = Number(u.mining && u.mining.onbit || 0);
    const initial = Number(pt.initialBalanceUSDT ?? DEFAULT_INITIAL);
    const equity = Number(pt.equityUSDT ?? pt.balanceUSDT ?? NaN);
    if (!isFinite(equity)) return;
    const { roi, pnl } = computeRoiAndPnl(equity, initial);
    rows.push({
      id: doc.id,
      name: u.displayName || '알 수 없음',
      handle: (u.handle || u.email || doc.id || 'user').toString().split('@')[0],
      avatarUrl: u.photoURL || '',
      roi, pnl,
      onbit,
      isSpot: false,
    });
  });
  rows.sort((a,b)=> state.sub === 'yield' ? (b.pnl||0)-(a.pnl||0) : state.sub === 'onbit' ? (b.onbit||0)-(a.onbit||0) : (b.roi||0)-(a.roi||0));
  return rows.slice(0, 20); // 상위 20명만 반환
}

async function fetchData() {
  return fetchUsersPaperTrading();
}

function renderTop3(items) {
  const el = q('#lb-top3');
  if (!el) return;
  const top = items.slice(0,3);
  // 표시 순서: 2위, 1위(중앙), 3위
  const ordered = [];
  if (top[1]) ordered.push({ it: top[1], rank: 2 });
  if (top[0]) ordered.push({ it: top[0], rank: 1 });
  if (top[2]) ordered.push({ it: top[2], rank: 3 });

  el.innerHTML = ordered.map(({ it, rank }) => {
    const cls = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : 'rank-3';
    if (state.sub === 'onbit') {
      return `
        <div class="lb-card top-card ${cls}">
          <div class="avatar-wrap">
            <img src="${it.avatarUrl||'/onbit/favicon-96x96.png'}" alt=""/>
            <div class="rank-ribbon">🏆 ${rank}</div>
          </div>
          <div class="topcard-name">${it.name||'알 수 없음'}</div>
          <div class="topcard-handle">@${(it.handle||it.id||'user').slice(0,16)}</div>
          <div class="topcard-stats">
            <div class="stat" style="color: var(--primary-color);">${Number(it.onbit||0).toFixed(3)} ONBIT</div>
          </div>
        </div>
      `;
    } else {
      const roiClass = (it.roi||0) >= 0 ? 'pos' : 'neg';
      return `
        <div class="lb-card top-card ${cls}">
          <div class="avatar-wrap">
            <img src="${it.avatarUrl||'/onbit/favicon-96x96.png'}" alt=""/>
            <div class="rank-ribbon">🏆 ${rank}</div>
          </div>
          <div class="topcard-name">${it.name||'알 수 없음'}</div>
          <div class="topcard-handle">@${(it.handle||it.id||'user').slice(0,16)}</div>
          <div class="topcard-stats">
            <div class="stat">ROI: <span class="${roiClass}">${(it.roi>=0?'+':'')+fmt(it.roi)}%</span></div>
            <div class="stat">$${fmt(it.pnl)} <span class="muted">PnL</span></div>
          </div>
        </div>
      `;
    }
  }).join('');
}

function renderRows(items) {
  const el = q('#lb-rows');
  if (!el) return;
  if (items.length === 0) {
    el.innerHTML = `
      <div class="lb-empty">
        <p>랭킹 데이터가 없습니다.</p>
      </div>
    `;
    return;
  }
  const top20 = items.slice(0, 20); // 안전하게 20명으로 제한
  el.innerHTML = top20.map((it, idx) => `
    <div class="lb-row">
      <div class="col-rank">${idx+1}</div>
      <div class="col-user user"><img src="${it.avatarUrl||'/onbit/favicon-96x96.png'}" alt=""/><div>
        <div class="name">${it.name||'알 수 없음'}</div>
        <div class="meta">@${(it.handle||it.id||'user').slice(0,20)}</div>
      </div></div>
      ${state.sub==='onbit' ? `<div class="col-roi">ONBIT</div><div class="col-pnl" style="color: var(--primary-color);">${Number(it.onbit||0).toFixed(3)} ONBIT</div>` : `<div class=\"col-roi\"><span class=\"${(it.roi||0)>=0?'pos':'neg'}\">${(it.roi>=0?'+':'')+fmt(it.roi)}%</span></div><div class=\"col-pnl\">$${fmt(it.pnl)}</div>`}
    </div>
  `).join('');
}

function renderHead() {
  const head = q('.lb-head');
  if (!head) return;
  if (state.sub === 'onbit') {
    head.innerHTML = `
      <div class="col-rank">#</div>
      <div class="col-user">닉네임</div>
      <div class="col-roi">항목</div>
      <div class="col-pnl">보유 ONBIT</div>
    `;
  } else {
    head.innerHTML = `
      <div class="col-rank">#</div>
      <div class="col-user">닉네임</div>
      <div class="col-roi">ROI</div>
      <div class="col-pnl">손익</div>
    `;
  }
}

async function refresh() {
  try {
    const data = await fetchData();
    state.items = data;
    renderHead();
    renderTop3(state.items);
    renderRows(state.items);
  } catch (e) {
    renderRows([]);
    console.warn('리더보드 로드 실패:', e);
  }
}

function bindUI() {
  qa('.subtab').forEach(b=>b.addEventListener('click', ()=>{
    qa('.subtab').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    state.sub = b.dataset.key;
    refresh();
  }));
}

document.addEventListener('DOMContentLoaded', () => { bindUI(); renderHead(); refresh(); });