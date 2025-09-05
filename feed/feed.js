// Feed core interactions (Firestore compat)
;(function(){
  const db = window.firebase && window.firebase.firestore ? window.firebase.firestore() : null;
  const auth = window.firebase && window.firebase.auth ? window.firebase.auth() : null;
  let cursor = null; let tab = 'for-you'; const pageLimit = 10; let isLoading = false; let hasMore = true;

  function el(id){ return document.getElementById(id); }
  function qs(sel,root=document){ return root.querySelector(sel); }
  function qsa(sel,root=document){ return Array.from(root.querySelectorAll(sel)); }

  function fmtRel(ts){
    try {
      const d = ts?.toDate ? ts.toDate() : new Date(ts);
      const diff = Date.now() - d.getTime();
      const s = Math.floor(diff/1000);
      const m = Math.floor(s/60);
      const h = Math.floor(m/60);
      const day = Math.floor(h/24);
      if (day >= 1) return `${day}일 전`;
      if (h >= 1) return `${h}시간 전`;
      if (m >= 1) return `${m}분 전`;
      return '방금 전';
    } catch(_) { return ''; }
  }

  function ensureAuthUI(){
    const comp = el('composer');
    if (!comp) return;
    comp.style.display = window.currentUser ? '' : 'none';
  }

  async function markInitialLikes(){
    try {
      if (!db || !auth || !auth.currentUser) return;
      const uid = auth.currentUser.uid;
      const cards = qsa('.feed-list .card');
      await Promise.all(cards.map(async (card)=>{
        const pid = card.getAttribute('data-id');
        if (!pid) return;
        const likedDoc = await db.collection('posts').doc(pid).collection('likes').doc(uid).get();
        if (likedDoc.exists) {
          const btn = card.querySelector('.actions .like');
          if (btn) btn.classList.add('liked');
        }
      }));
    } catch(_) {}
  }

  function cardHtml(p){
    const author = p.author || { displayName: '사용자', photoURL: '' };
    const media = Array.isArray(p.media)? p.media : [];
    const isAdmin = !!(window.currentUser && (window.currentUser.role === 'admin' || window.currentUser.isAdmin === true));
    const canDelete = (window.currentUser && (window.currentUser.uid === p.authorId)) || isAdmin;
    const mlen = media.length;
    const mediaClass = mlen>=4 ? 'media media-4' : (mlen===3 ? 'media media-3' : (mlen===2 ? 'media media-2' : (mlen===1 ? 'media media-1' : 'media')));
    return `<article class="card" data-id="${p.id}">
      <div class="avatar" style="${author.photoURL?`background-image:url('${author.photoURL}')`:''}"></div>
      <div>
        <div class="meta"><b>${author.displayName||'사용자'}</b><span>·</span><span>${fmtRel(p.createdAt)}</span>${canDelete?`<span style="margin-left:auto;display:flex;gap:6px;"><button class="act edit" data-edit="${p.id}">수정</button><button class="act delete" data-del="${p.id}">삭제</button></span>`:''}</div>
        <div class="text">${(p.text||'').replace(/</g,'&lt;')}</div>
        ${mlen?`<div class="${mediaClass}">${media.slice(0,4).map(m=>`<img src="${m.url}" loading="lazy"/>`).join('')}</div>`:''}
        <div class="actions">
          <button class="act like" data-like="${p.id}"><i data-lucide="heart"></i><span>${p.counts?.likes||0}</span></button>
          <button class="act reply"><i data-lucide="message-circle-more"></i><span>${p.counts?.replies||0}</span></button>
          <button class="act share"><i data-lucide="share"></i></button>
        </div>
      </div>
    </article>`;
  }

  async function fetchFeed(initial=false){
    if (!db || isLoading || (!initial && !hasMore)) return;
    isLoading = true;
    let q = db.collection('posts').where('visibility','==','public').orderBy('createdAt','desc').limit(pageLimit);
    if (!initial && cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    const list = el('feed-list');
    const items = [];
    for (const d of snap.docs){
      const data = d.data();
      let author = null;
      try { const u = await db.collection('users').doc(data.authorId).get(); author = u.exists ? u.data() : null; } catch(_) {}
      items.push({ id: d.id, ...data, author });
    }
    if (items.length) cursor = snap.docs[snap.docs.length-1];
    try {
      await Promise.all(items.map(async (p)=>{
        try {
          const csnap = await db.collection('comments').where('postId','==',p.id).get();
          p.counts = Object.assign({}, p.counts || {}, { replies: csnap.size });
        } catch(_) { p.counts = Object.assign({}, p.counts || {}, { replies: 0 }); }
      }));
    } catch(_) {}
    list.insertAdjacentHTML('beforeend', items.map(cardHtml).join(''));
    try { window.lucide && window.lucide.createIcons(); } catch(_) {}
    markInitialLikes();
    items.forEach(p=> listenCommentsCount(p.id));
    if (snap.empty || snap.docs.length < pageLimit) hasMore = false;
    isLoading = false;
  }

  const commentUnsubs = new Map();
  function listenCommentsCount(postId){
    if (!db || commentUnsubs.has(postId)) return;
    const q = db.collection('comments').where('postId','==',postId);
    const unsub = q.onSnapshot((snap)=>{
      const span = document.querySelector(`.card[data-id="${postId}"] .actions .reply span`);
      if (span) span.textContent = String(snap.size);
    });
    commentUnsubs.set(postId, unsub);
  }

  async function createPost(){
    if (!db || !auth || !auth.currentUser) return;
    const txt = el('composer-text').value.trim();
    if (!txt) return;
    const now = window.firebase.firestore.FieldValue.serverTimestamp();
    const post = { authorId: auth.currentUser.uid, text: txt, media: [], topics: [], symbols: [], createdAt: now, updatedAt: now, visibility:'public', counts:{likes:0,replies:0,reposts:0,bookmarks:0} };
    await db.collection('posts').add(post);
    el('composer-text').value='';
    el('feed-list').innerHTML=''; cursor=null; hasMore=true; fetchFeed(true);
  }

  async function toggleLike(postId, btn){
    if (!db || !auth || !auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const postRef = db.collection('posts').doc(postId);
    const likeRef = postRef.collection('likes').doc(uid);
    try {
      const snap = await likeRef.get();
      if (!snap.exists) {
        await db.runTransaction(async (tx)=>{
          tx.set(likeRef, { createdAt: window.firebase.firestore.FieldValue.serverTimestamp() });
          tx.update(postRef, { 'counts.likes': window.firebase.firestore.FieldValue.increment(1) });
        });
        const span = btn.querySelector('span'); if (span) span.textContent = String((parseInt(span.textContent||'0')||0) + 1);
        btn.classList.add('liked');
      } else {
        await db.runTransaction(async (tx)=>{
          tx.delete(likeRef);
          tx.update(postRef, { 'counts.likes': window.firebase.firestore.FieldValue.increment(-1) });
        });
        const span = btn.querySelector('span'); if (span) span.textContent = String(Math.max(0,(parseInt(span.textContent||'0')||0) - 1));
        btn.classList.remove('liked');
      }
    } catch(_) {}
  }

  function bind(){
    ensureAuthUI();
    document.addEventListener('click', (e)=>{
      // handle delete first to avoid card navigation
      const delFirst = e.target.closest && e.target.closest('[data-del]');
      if (delFirst) {
        e.preventDefault(); e.stopPropagation();
        const id = delFirst.getAttribute('data-del');
        const isAdmin = !!(window.currentUser && (window.currentUser.role === 'admin' || window.currentUser.isAdmin === true));
        if (!window.currentUser) return;
        if (!confirm('삭제하시겠습니까?')) return;
        db.collection('posts').doc(id).delete().then(()=>{
          const cardEl = document.querySelector(`.card[data-id="${id}"]`);
          if (cardEl) cardEl.remove();
        }).catch(()=>{});
        return;
      }

      if (e.target.id === 'open-composer') {
        if (!window.currentUser) { const btn = document.querySelector('[data-action="open-login-modal"]'); if (btn) btn.click(); return; }
        nav('/feed/write', '/feed/write.html');
        return;
      }
      const card = e.target.closest('.card');
      if (card) {
        const id = card.getAttribute('data-id');
        if (e.target.closest('[data-like]')) {
          if (!window.currentUser) { const btn = document.querySelector('[data-action="open-login-modal"]'); if (btn) btn.click(); return; }
          const likeBtn = e.target.closest('[data-like]');
          const pid = likeBtn.getAttribute('data-like');
          toggleLike(pid, likeBtn);
          return;
        }
        if (e.target.closest('[data-edit]')) {
          e.preventDefault(); e.stopPropagation();
          const editBtn = e.target.closest('[data-edit]');
          const pid = editBtn.getAttribute('data-edit');
          nav(`/feed/write?id=${pid}`, `/feed/write.html?id=${pid}`);
          return;
        }
        nav(`/feed/post/${id}`, `/feed/post.html?id=${id}`);
      }
      if (e.target.id === 'composer-submit') {
        if (!window.currentUser) { const btn = document.querySelector('[data-action="open-login-modal"]'); if (btn) btn.click(); return; }
        createPost();
      }
    });

    // infinite scroll
    window.addEventListener('scroll', ()=>{
      if (!hasMore || isLoading) return;
      const threshold = 600;
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - threshold) {
        fetchFeed(false);
      }
    }, { passive: true });
  }

  const isLocal = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:');
  const nav = (pretty, raw) => { window.location.href = isLocal ? raw : pretty; };

  document.addEventListener('DOMContentLoaded', ()=>{ bind(); fetchFeed(true); try { window.lucide && window.lucide.createIcons(); } catch(_) {} });
  if (window.firebase && window.firebase.auth) window.firebase.auth().onAuthStateChanged(()=> { ensureAuthUI(); markInitialLikes(); });
  document.addEventListener('DOMContentLoaded', ()=>{ try { window.lucide && window.lucide.createIcons(); } catch(_) {} });

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
      const ul = el('trending');
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
      const ulA = el('top-authors');
      if (ulA) ulA.innerHTML = profiles.map(p=>`<li style="display:flex;align-items:center;gap:10px;margin:16px 0;"><span style="width:24px;height:24px;border-radius:999px;background:${p.photoURL?'transparent':'#e5e7eb'};background-image:${p.photoURL?`url('${p.photoURL}')`:'none'};background-size:cover;background-position:center;border:1px solid var(--border-color);"></span><span>${p.displayName}</span></li>`).join('');
    } catch(_) {}
  }
  document.addEventListener('DOMContentLoaded', loadSidebar);
})();


