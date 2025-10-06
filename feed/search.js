;(function(){
  const db = window.firebase && window.firebase.firestore ? window.firebase.firestore() : null;
  const auth = window.firebase && window.firebase.auth ? window.firebase.auth() : null;
  const isLocal = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:');
  const nav = (pretty, raw) => { window.location.href = isLocal ? raw : pretty; };

  function el(id){ return document.getElementById(id); }
  function fmtRel(ts){ try{ const d=ts?.toDate?ts.toDate():new Date(ts); const diff=Date.now()-d.getTime(); const s=Math.floor(diff/1000),m=Math.floor(s/60),h=Math.floor(m/60),day=Math.floor(h/24); if(day>=1) return day+'일 전'; if(h>=1) return h+'시간 전'; if(m>=1) return m+'분 전'; return '방금 전'; }catch(_){ return ''; } }

  function cardHtml(p){
    const author = p.author || { displayName: '사용자', photoURL: '' };
    const authorName = author.displayName || '사용자';
    const avatar = author.photoURL ? 'style="background-image:url(\''+author.photoURL+'\')"' : '';
    const rel = fmtRel(p.createdAt);
    const likeCount = p.counts?.likes || 0;
    const replyCount = p.counts?.replies || 0;
    const href = isLocal ? '/feed/post.html?id='+p.id : '/feed/post/'+p.id;
    return '<article class="card" data-id="'+p.id+'">\
      <div class="avatar" '+avatar+'></div>\
      <div>\
        <div class="meta" style="display:flex;align-items:center;gap:8px;"><b>'+authorName+'</b><span>·</span><span>'+rel+'</span></div>\
        <div class="text">'+(String(p.text||'').replace(/</g,'&lt;'))+'</div>\
        <div class="actions">\
          <a class="act" href="'+href+'">열기</a>\
          <span class="act">❤ '+likeCount+'</span>\
          <span class="act">💬 '+replyCount+'</span>\
        </div>\
      </div>\
    </article>';
  }

  function userRow(u){
    const photo = u.photoURL ? 'style="background-image:url(\''+u.photoURL+'\')"' : '';
    const name = u.displayName || (u.email ? u.email.split('@')[0] : '사용자');
    const bio = u.bio || u.intro || '';
    return '<div class="user-item" data-uid="'+(u.uid||'')+'">\
      <div class="avatar" '+photo+'></div>\
      <div class="meta">\
        <div class="name">'+name+'</div>\
        <div class="bio">'+(String(bio).replace(/</g,'&lt;'))+'</div>\
      </div>\
      <div><button class="follow-btn" data-follow="'+(u.uid||'')+'">팔로우</button></div>\
    </div>';
  }

  async function loadUserRecommendations(keyword){
    if (!db) return;
    try {
      const snap = await db.collection('users').limit(200).get();
      const all = snap.docs.map(d=> ({ uid:d.id, ...d.data() }));
      const kw = (keyword||'').toLowerCase();
      const users = all.filter(u=>{
        if (!kw) return true;
        const name = String(u.displayName || (u.email ? u.email.split('@')[0] : '')).toLowerCase();
        const bio = String(u.bio || u.intro || '').toLowerCase();
        return name.includes(kw) || bio.includes(kw);
      }).slice(0, 50);
      const listEl = el('user-recommend');
      if (listEl) listEl.innerHTML = users.map(userRow).join('');
    } catch(_) {}
  }

  async function toggleFollow(targetUid, btn){
    if (!db || !auth || !auth.currentUser || !targetUid) return;
    const me = auth.currentUser.uid;
    if (me === targetUid) return;
    const ref = db.collection('users').doc(me).collection('following').doc(targetUid);
    try {
      const snap = await ref.get();
      if (!snap.exists) {
        await ref.set({ createdAt: window.firebase.firestore.FieldValue.serverTimestamp() });
        if (btn) btn.textContent = '팔로잉';
      } else {
        await ref.delete();
        if (btn) btn.textContent = '팔로우';
      }
    } catch(_) {}
  }

  function bindFollow(){
    document.addEventListener('click', (e)=>{
      const b = e.target.closest && e.target.closest('[data-follow]');
      if (!b) return;
      if (!auth || !auth.currentUser) { const lg=document.querySelector('[data-action="open-login-modal"]'); if (lg) lg.click(); return; }
      const uid = b.getAttribute('data-follow');
      toggleFollow(uid, b);
    });
  }

  async function renderKeywordSuggestions(q){
    const box = el('keyword-suggestions');
    if (!box) return;
    if (!q) { box.innerHTML=''; box.classList.remove('is-open'); return; }
    try {
      const snap = await db.collection('posts').where('visibility','==','public').orderBy('createdAt','desc').limit(200).get();
      const texts = snap.docs.map(d=> String((d.data() && d.data().text) || ''));
      const ql = q.toLowerCase();
      const freq = new Map();
      for (const t of texts){
        const low = t.toLowerCase();
        if (!low.includes(ql)) continue;
        const tagMatches = t.match(/#[^\s#]+/g) || [];
        tagMatches.forEach(tag=>{
          const clean = tag.replace(/^#/, '').toLowerCase();
          if (clean.includes(ql)) freq.set(clean, (freq.get(clean)||0)+3);
        });
        const words = t.split(/[\s,.;:!?()\[\]{}"'`~\\/]+/).filter(Boolean);
        words.forEach(w=>{
          const clean = w.replace(/^#/, '').toLowerCase();
          if (clean.length>=2 && clean.includes(ql)) freq.set(clean, (freq.get(clean)||0)+1);
        });
      }
      let candidates = Array.from(freq.entries()).sort((a,b)=> b[1]-a[1]).map(([w])=> w);
      if (candidates.length===0) candidates = [q];
      candidates = candidates.filter((v,i,self)=> self.indexOf(v)===i).slice(0,8);
      box.innerHTML = candidates.map(k=> '<div class="suggest" data-kw="'+k+'"><span>'+k+'</span><span>›</span></div>').join('');
      if (box.innerHTML) box.classList.add('is-open'); else box.classList.remove('is-open');
    } catch(_) { box.innerHTML=''; }
  }

  function showKeywordResults(){
    const wrap = document.getElementById('keyword-results');
    if (wrap) wrap.style.display = '';
  }

  function openSearch(q){
    const enc = encodeURIComponent(q);
    nav('/feed/search?q='+enc+'&serp_type=default', '/feed/search.html?q='+enc+'&serp_type=default');
  }

  async function loadPostsByKeyword(q, sort){
    if (!db) return;
    const listEl = el('search-results');
    const countEl = el('search-result-count');
    if (!q) { if (listEl) listEl.innerHTML=''; return; }
    const snap = await db.collection('posts').where('visibility','==','public').orderBy('createdAt','desc').limit(200).get();
    let items = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    const keyword = q.toLowerCase();
    items = items.filter(p=> String(p.text||'').toLowerCase().includes(keyword));
    // enrich authors
    const authorIds = Array.from(new Set(items.map(p=>p.authorId).filter(Boolean)));
    const authorMap = new Map();
    for (const uid of authorIds){
      try { const u = await db.collection('users').doc(uid).get(); authorMap.set(uid, u.exists?u.data():{}); } catch(_) { authorMap.set(uid,{}); }
    }
    items = items.map(p=> ({...p, author: authorMap.get(p.authorId)||{} }));
    if (sort === 'popular') items.sort((a,b)=> (b?.counts?.likes||0) - (a?.counts?.likes||0));
    if (sort === 'latest') items.sort((a,b)=> (b?.createdAt?.toMillis?.()||0) - (a?.createdAt?.toMillis?.()||0));
    if (countEl) countEl.textContent = (items.length>0 ? items.length+' results' : '0 results');
    if (listEl) listEl.innerHTML = items.length ? items.map(cardHtml).join('') : '<div style="padding:24px; color: var(--text-color-secondary);">검색 결과가 없습니다.</div>';
  }

  async function performSearch(){
    if (!db) return;
    const q = (el('search-input')?.value || '').trim();
    const listEl = el('search-results');
    if (!q) { if (listEl) listEl.innerHTML=''; return; }
    const snap = await db.collection('posts').where('visibility','==','public').orderBy('createdAt','desc').limit(200).get();
    const base = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    // Enrich authors
    const authorIds = Array.from(new Set(base.map(p=>p.authorId).filter(Boolean)));
    const authorMap = new Map();
    for (const uid of authorIds){
      try { const u = await db.collection('users').doc(uid).get(); authorMap.set(uid, u.exists?u.data():{}); } catch(_) { authorMap.set(uid,{}); }
    }
    const keyword = q.toLowerCase();
    const filtered = base.filter(p=> String(p.text||'').toLowerCase().includes(keyword));
    const items = filtered.map(p=> ({...p, author: authorMap.get(p.authorId)||{} }));
    if (listEl) listEl.innerHTML = items.map(cardHtml).join('');
  }

  async function loadSidebar(){
    if (!db) return;
    try {
      const q = db.collection('posts')
        .where('visibility','==','public')
        .orderBy('createdAt','desc')
        .limit(100);
      const snap = await q.get();
      const arr = snap.docs.map(d=>({ id:d.id, ...d.data() }));
      const top = arr.sort((a,b)=> (b?.counts?.likes||0)-(a?.counts?.likes||0)).slice(0,5);
      const enriched = [];
      for (const p of top) {
        let author = { displayName: '사용자', photoURL: '' };
        try { const u = await db.collection('users').doc(p.authorId).get(); if (u.exists) author = u.data(); } catch(_) {}
        enriched.push({ ...p, author });
      }
      const ul = document.getElementById('trending');
      if (ul) ul.innerHTML = enriched.map(p=>{
        const href = isLocal ? `/feed/post.html?id=${p.id}` : `/feed/post/${p.id}`;
        const text = (p.text || '').replace(/\n/g,' ').slice(0, 90);
        const rel = fmtRel(p.createdAt);
        const avatar = p.author?.photoURL ? `style="background-image:url('${p.author.photoURL}')"` : '';
        const authorName = p.author?.displayName || '사용자';
        return `<li class="trending-item"><a href="${href}" class="trending-link"><span class="trending-avatar" ${avatar}></span><span class="trending-content"><span class="trending-title">${text}</span><span class="trending-meta">${authorName} · ${rel}</span></span></a></li>`;
      }).join('');
      const likeByUser = new Map();
      arr.forEach(p=>{ const uid=p.authorId; const lk=p?.counts?.likes||0; likeByUser.set(uid,(likeByUser.get(uid)||0)+lk); });
      const topUsers = [...likeByUser.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3);
      const profiles = [];
      for (const [uid, likes] of topUsers) {
        try { const doc = await db.collection('users').doc(uid).get(); const u = doc.exists ? doc.data() : { displayName: uid?.slice(0,6)+"…", photoURL: '' }; profiles.push({ uid, likes, displayName: u.displayName || (uid?.slice(0,6)+"…"), photoURL: u.photoURL || '' }); } catch(_) { profiles.push({ uid, likes, displayName: uid?.slice(0,6)+"…", photoURL: '' }); }
      }
      const ulA = document.getElementById('top-authors');
      if (ulA) ulA.innerHTML = profiles.map(p=>`<li style="display:flex;align-items:center;gap:10px;margin:16px 0;"><span style="width:24px;height:24px;border-radius:999px;background:${p.photoURL?'transparent':'#e5e7eb'};background-image:${p.photoURL?`url('${p.photoURL}')`:'none'};background-size:cover;background-position:center;border:1px solid var(--border-color);"></span><span>${p.displayName}</span></li>`).join('');
    } catch(_) {}
  }

  function bind(){
    const btn = el('search-btn');
    const inp = el('search-input');
    if (btn) btn.addEventListener('click', ()=>{ const q=(inp?.value||'').trim(); if(q){ openSearch(q); } else { renderKeywordSuggestions(''); loadUserRecommendations(''); } });
    if (inp) {
      let t = null; inp.addEventListener('input', ()=>{ clearTimeout(t); t=setTimeout(()=>{ const q=(inp?.value||'').trim(); renderKeywordSuggestions(q); loadUserRecommendations(q); }, 200); });
      inp.addEventListener('keydown', (e)=>{ if (e.key==='Enter'){ e.preventDefault(); const q=(inp?.value||'').trim(); if(q){ openSearch(q); } } });
    }
    document.addEventListener('click', (e)=>{
      // open profile when clicking user rows (except follow button)
      const row = e.target.closest && e.target.closest('.user-item');
      if (row && !e.target.closest('[data-follow]')){
        const uid = row.getAttribute('data-uid');
        if (uid){
          const href = '/feed/profile?uid='+encodeURIComponent(uid);
          nav(href, '/feed/profile.html?uid='+encodeURIComponent(uid));
          return;
        }
      }
      const compose = e.target.closest && e.target.closest('#open-composer');
      if (compose){ const isLocal=(location.hostname==='localhost'||location.hostname==='127.0.0.1'||location.protocol==='file:'); window.location.href = isLocal? '/login/index.html' : '/login'; return; }
      const s = e.target.closest && e.target.closest('[data-kw]');
      if (s){
        const q = s.getAttribute('data-kw');
        openSearch(q);
      }
      // click outside suggestions → close
      const box = el('keyword-suggestions');
      if (box && !e.target.closest('#keyword-suggestions') && !e.target.closest('.search-bar')){
        box.classList.remove('is-open');
      }
      const tab = e.target.closest && e.target.closest('.search-tabs .tab');
      if (tab){
        const sort = tab.getAttribute('data-sort');
        setActiveTab(sort);
        const q = (el('search-input')?.value||'').trim();
        loadPostsByKeyword(q, sort);
        // reflect sort in URL without full reload
        const enc = encodeURIComponent(q);
        const newUrl = (isLocal? '/feed/search.html?q='+enc+'&serp_type=default&sort='+sort : '/feed/search?q='+enc+'&serp_type=default&sort='+sort);
        try { history.replaceState(null, '', newUrl); } catch(_) {}
      }
    });
    bindFollow();
  }

  function setActiveTab(sort){
    document.querySelectorAll('.search-tabs .tab').forEach(b=>{ b.classList.remove('active'); });
    const b = document.querySelector('.search-tabs .tab[data-sort="'+sort+'"]');
    if (b) b.classList.add('active');
  }

  function initFromQuery(){
    try {
      const params = new URLSearchParams(location.search || '');
      const q = params.get('q') || '';
      const sort = (params.get('sort') === 'latest') ? 'latest' : 'popular';
      if (q) {
        const inp = el('search-input'); if (inp) inp.value = q;
        const box = el('keyword-suggestions'); if (box) box.innerHTML = '';
        const rec = document.getElementById('user-recommend'); if (rec) rec.style.display = 'none';
        const st = document.querySelector('.section-title'); if (st) st.style.display = 'none';
        showKeywordResults();
        setActiveTab(sort);
        loadPostsByKeyword(q, sort);
      }
    } catch(_) {}
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    bind();
    loadSidebar();
    initFromQuery();
    try { const p = new URLSearchParams(location.search||''); if (!p.get('q')) loadUserRecommendations(''); } catch(_) { loadUserRecommendations(''); }
  });
  if (auth && auth.onAuthStateChanged) auth.onAuthStateChanged(()=>{ loadSidebar(); });
})();


