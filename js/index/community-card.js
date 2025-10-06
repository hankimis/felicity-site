// 커뮤니티 카드 렌더러: 주간 인기글 Top30 페이지네이션(10개씩) + 순위 표시
(function(){
  function getDB(){
    return (window.firebase && window.firebase.firestore) ? window.firebase.firestore() : null;
  }
  const isLocal = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:');

  // 페이징 설정
  const PAGE_SIZE = 10;
  const MAX_ITEMS = 30;
  const state = { page: 1, items: [] };

  function fmtRel(ts){
    try {
      const d = ts?.toDate ? ts.toDate() : new Date(ts);
      const diff = Date.now() - d.getTime();
      const m = Math.floor(diff/60000);
      const h = Math.floor(m/60);
      const day = Math.floor(h/24);
      if (day >= 1) return `${day}일 전`;
      if (h >= 1) return `${h}시간 전`;
      if (m >= 1) return `${m}분 전`;
      return '방금 전';
    } catch(_) { return ''; }
  }

  function buildItem(p, idxGlobal){
    const href = isLocal ? `/feed/post.html?id=${p.id}` : `/feed/post/${p.id}`;
    const author = p.author || {};
    const name = author.displayName || '사용자';
    const text = (p.text||'').replace(/\n/g,' ').slice(0, 48);
    const rel = fmtRel(p.createdAt);
    const media = Array.isArray(p.media) ? p.media : [];
    const hasThumb = media.length > 0 && media[0]?.url;
    const replyCount = Number(p.counts?.replies || 0);
    const rank = idxGlobal + 1; // 전체 순위
    const thumb = hasThumb ? `<div class="cc-thumb"><img src="${media[0].url}" alt="" loading="lazy" decoding="async" onerror="this.parentNode.style.display='none'"/></div>` : '';
    return `
      <a class="cc-item ${hasThumb?'has-thumb':'no-thumb'}" href="${href}">
        <span class="cc-rank">${rank}</span>
        <div class="cc-body">
          <div class="cc-title-row"><div class="cc-title">${text}</div><span class="cc-replies">[${replyCount}]</span></div>
          <div class="cc-sub">
            <span class="cc-author">${name}</span>
            <span class="cc-dot">·</span>
            <span class="cc-time">${rel}</span>
          </div>
        </div>
        ${thumb}
      </a>`;
  }

  function scoreOf(p){
    return (Number(p.counts?.replies||0)*2) + (Number(p.counts?.likes||0));
  }

  function chunk(arr, size){ const out=[]; for(let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size)); return out; }

  async function hydrateReplyCounts(db, items){
    const ids = items.map(p=>p.id).filter(Boolean);
    if (!ids.length) return items;
    try {
      // Firestore 'in' 제한(10개) → 10개 단위로 배치 집계
      const batches = chunk(ids, 10);
      const byPost = new Map();
      await Promise.all(batches.map(async (part)=>{
        const snap = await db.collection('comments').where('postId','in', part).get();
        snap.forEach(doc=>{ const pid = doc.data().postId; byPost.set(pid, (byPost.get(pid)||0) + 1); });
      }));
      items.forEach(p=>{ p.counts = Object.assign({}, p.counts || {}, { replies: byPost.get(p.id) || 0 }); });
    } catch(_) {}
    return items;
  }

  async function fetchWeeklyPopular(){
    const db = getDB();
    if (!db) return [];
    const now = new Date();
    const start = new Date(now.getTime() - 7*24*60*60*1000);
    // 1) 최근 일주일 공개글 최대 500건 수집
    let q = db.collection('posts')
      .where('visibility','==','public')
      .where('createdAt','>=', start)
      .orderBy('createdAt','desc')
      .limit(500);
    const snap = await q.get();
    let items = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    items = items.map(p=> ({ ...p, __score: scoreOf(p) }));
    items.sort((a,b)=> (b.__score - a.__score));

    // 2) 부족하면 과거 데이터에서 보충
    if (items.length < MAX_ITEMS) {
      try {
        const snap2 = await db.collection('posts')
          .where('visibility','==','public')
          .orderBy('createdAt','desc')
          .limit(1000)
          .get();
        const more = snap2.docs.map(d=>({ id:d.id, ...d.data(), __score: scoreOf(d.data()) }));
        const used = new Set(items.map(p=> p.id));
        more.sort((a,b)=> (b.__score - a.__score));
        for (const it of more) { if (items.length >= MAX_ITEMS) break; if (!used.has(it.id)) { items.push(it); used.add(it.id); } }
      } catch(_) {}
    }

    items = items.slice(0, MAX_ITEMS);

    // 3) 댓글 수 보강
    await hydrateReplyCounts(db, items);

    // 작성자 보강
    const authorIds = Array.from(new Set(items.map(p=>p.authorId).filter(Boolean)));
    const profiles = new Map();
    await Promise.all(authorIds.map(async (uid)=>{
      try { const doc = await db.collection('users').doc(uid).get(); profiles.set(uid, doc.exists?doc.data():{}); } catch(_) { profiles.set(uid, {}); }
    }));
    return items.map(p=> ({ ...p, author: profiles.get(p.authorId) || {} }));
  }

  function renderPage(){
    const root = document.getElementById('community-card-list');
    if (!root) return;
    const total = state.items.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;

    const start = (state.page - 1) * PAGE_SIZE;
    const slice = state.items.slice(start, start + PAGE_SIZE);
    if (!slice.length){
      root.innerHTML = '<div class="loading" style="padding:28px 10px;color:var(--text-color-secondary);">표시할 게시글이 없습니다.</div>';
    } else {
      root.innerHTML = slice.map((p,i)=> buildItem(p, start + i)).join('');
    }

    // 페이지네이션
    const parent = root.parentElement || document.querySelector('.community-card-body');
    let paginator = document.getElementById('community-card-pagination');
    if (!paginator) {
      paginator = document.createElement('div');
      paginator.id = 'community-card-pagination';
      paginator.className = 'breaking-pagination'; // 뉴스와 동일 스타일
      parent.appendChild(paginator);
    }
    paginator.innerHTML = `
      <button class="bp-btn prev" aria-label="이전"><i class="fas fa-chevron-left"></i></button>
      <span class="bp-text">커뮤니티 더보기 ${state.page}/${totalPages}</span>
      <button class="bp-btn next" aria-label="다음"><i class="fas fa-chevron-right"></i></button>
    `;
    const prevBtn = paginator.querySelector('.bp-btn.prev');
    const nextBtn = paginator.querySelector('.bp-btn.next');
    prevBtn.onclick = () => { state.page = state.page <= 1 ? totalPages : state.page - 1; renderPage(); };
    nextBtn.onclick = () => { state.page = state.page >= totalPages ? 1 : state.page + 1; renderPage(); };
  }

  async function render(){
    const root = document.getElementById('community-card-list');
    if (!root) return;
    root.innerHTML = '<div class="loading" style="padding:18px 10px;">불러오는 중...</div>';
    try {
      state.items = await fetchWeeklyPopular();
      state.page = 1;
      renderPage();
    } catch (e){
      root.innerHTML = '<div class="loading" style="padding:28px 10px;color:var(--text-color-secondary);">불러오기 실패</div>';
    }
  }

  function bindTabs(){ /* 탭 삭제됨 - noop */ }

  function waitForFirebase(){
    return new Promise((resolve)=>{
      const check=()=>{
        try {
          if (window.firebase && window.firebase.apps && window.firebase.apps.length>0 && window.firebase.firestore){
            resolve();
            return;
          }
        } catch(_) {}
        setTimeout(check, 100);
      };
      check();
    });
  }

  document.addEventListener('DOMContentLoaded', async ()=>{
    try { await waitForFirebase(); } catch(_) {}
    render();
  });
})();


