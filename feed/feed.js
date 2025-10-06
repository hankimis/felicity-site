// Feed core interactions (Firestore compat)
;(function(){
  const db = window.firebase && window.firebase.firestore ? window.firebase.firestore() : null;
  const auth = window.firebase && window.firebase.auth ? window.firebase.auth() : null;
  let cursor = null; const pageLimit = 10; let isLoading = false; let hasMore = true;
  const requestIdle = window.requestIdleCallback || function(cb){ return setTimeout(cb, 1); };

  let mediaObserver = null;
  let bgObserver = null;
  let commentsObserver = null;
  const authorCache = (window.__authorCache = window.__authorCache || new Map());

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
      const cards = qsa('.feed-list .card').slice(0, 12);
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
    const authorName = author.displayName || '사용자';
    const avatarData = author.photoURL ? `data-bg="${author.photoURL}"` : '';
    const timeRel = fmtRel(p.createdAt);
    const likeCount = p.counts?.likes || 0;
    const replyCount = p.counts?.replies || 0;
    return `<article class="card" data-id="${p.id}">
      <div class="avatar lazy-bg" ${avatarData} data-profile="${p.authorId}" style="cursor:pointer"></div>
      <div>
        <div class="meta" style="display:flex;align-items:center;gap:8px;">
          <b data-profile="${p.authorId}" style="cursor:pointer">${authorName}</b>
          <span>·</span>
          <span>${timeRel}</span>
          ${canDelete?`<div class="dropdown" style="margin-left:auto;">
            <button class="act" data-dd-trigger="${p.id}"><i data-lucide="more-horizontal"></i></button>
            <div class="dropdown-menu" id="dd-${p.id}">
              <button class="menu-item" data-edit="${p.id}"><i data-lucide="pencil"></i>수정</button>
              <button class="menu-item" data-del="${p.id}"><i data-lucide="trash"></i>삭제</button>
            </div>
          </div>`:''}
        </div>
        <div class="text">${(p.text||'').replace(/</g,'&lt;')}</div>
        ${mlen?`<div class="${mediaClass}">${media.slice(0,4).map(m=>`<img class=\"lazy-media\" data-src=\"${m.url}\" alt=\"\" loading=\"lazy\" decoding=\"async\" fetchpriority=\"low\"/>`).join('')}</div>`:''}
        <div class="actions">
          <button class="act like" data-like="${p.id}"><svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A4.5 4.5 0 0 0 17.5 4c-1.74 0-3.41.81-4.5 2.09A6 6 0 0 0 6.5 4 4.5 4.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/></svg><span>${likeCount}</span></button>
          <button class="act reply"><i data-lucide="message-circle-more"></i><span>${replyCount}</span></button>
          <button class="act share"><svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v14"/></svg></button>
        </div>
      </div>
    </article>`;
  }

  async function fetchFeed(initial=false){
    if (!db || isLoading || (!initial && !hasMore)) return;
    isLoading = true;
    let q = db.collection('posts').where('visibility','==','public').orderBy('createdAt','desc').limit(pageLimit);

    // Apply Following filter if selected
    try {
      if (window.__feedFilter__ === 'following' && auth && auth.currentUser){
        const ids = [];
        const fs = await db.collection('users').doc(auth.currentUser.uid).collection('following').get();
        fs.forEach(d=> ids.push(d.id));
        if (ids.length){
          const data = await q.get();
          const list = el('feed-list');
          const baseItems = data.docs.map(d=>({ id:d.id, ...d.data() })).filter(p=> ids.includes(p.authorId));
          const authorIds = Array.from(new Set(baseItems.map(p=>p.authorId).filter(Boolean)));
          const missing = authorIds.filter(uid => !authorCache.has(uid));
          try { await Promise.all(missing.map(async (uid)=>{ try { const u = await db.collection('users').doc(uid).get(); authorCache.set(uid, u.exists ? u.data() : {}); } catch(_) { authorCache.set(uid, {}); } })); } catch(_) {}
          const items = baseItems.map(p=> ({ ...p, author: authorCache.get(p.authorId) || {} }));
          if (items.length) cursor = data.docs[data.docs.length-1];
          list.insertAdjacentHTML('beforeend', items.map(cardHtml).join(''));
          try { window.lucide && window.lucide.createIcons(); } catch(_) {}
          hydrateNewContent(list);
          observeCardsForComments(list);
          if (data.empty || data.docs.length < pageLimit) hasMore = false;
          isLoading = false;
          return;
        }
      }
    } catch(_) {}

    if (!initial && cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    const list = el('feed-list');
    const baseItems = snap.docs.map(d=>({ id: d.id, ...d.data() }));
    const authorIds = Array.from(new Set(baseItems.map(p=>p.authorId).filter(Boolean)));
    const missing = authorIds.filter(uid => !authorCache.has(uid));
    try {
      await Promise.all(missing.map(async (uid)=>{
        try { const u = await db.collection('users').doc(uid).get(); authorCache.set(uid, u.exists ? u.data() : {}); } catch(_) { authorCache.set(uid, {}); }
      }));
    } catch(_) {}
    const items = baseItems.map(p=> ({ ...p, author: authorCache.get(p.authorId) || {} }));
    if (items.length) cursor = snap.docs[snap.docs.length-1];
    // Defer comment count updates to viewport observer to reduce initial reads
    list.insertAdjacentHTML('beforeend', items.map(cardHtml).join(''));
    try { window.lucide && window.lucide.createIcons(); } catch(_) {}
    hydrateNewContent(list);
    requestIdle(()=> markInitialLikes());
    observeCardsForComments(list);
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

  function createObservers(){
    if (!mediaObserver) {
      mediaObserver = new IntersectionObserver((entries)=>{
        entries.forEach((entry)=>{
          if (!entry.isIntersecting) return;
          const img = entry.target;
          const src = img.getAttribute('data-src');
          if (src) {
            const vpThreshold = (window.innerHeight || 800) * 1.2;
            if (entry.boundingClientRect.top < vpThreshold) img.setAttribute('fetchpriority','high');
            img.decoding = 'async';
            img.loading = 'lazy';
            img.src = src;
            img.addEventListener('load', ()=>{ img.classList.add('is-loaded'); }, { once:true });
            img.removeAttribute('data-src');
          }
          mediaObserver.unobserve(img);
        });
      }, { rootMargin: '400px 0px' });
    }
    if (!bgObserver) {
      bgObserver = new IntersectionObserver((entries)=>{
        entries.forEach((entry)=>{
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const url = el.getAttribute('data-bg');
          if (url) {
            const im = new Image();
            im.decoding = 'async';
            im.onload = ()=>{ el.style.backgroundImage = `url('${url}')`; el.classList.add('is-loaded'); };
            im.src = url;
            el.removeAttribute('data-bg');
          }
          bgObserver.unobserve(el);
        });
      }, { rootMargin: '400px 0px' });
    }
    if (!commentsObserver) {
      commentsObserver = new IntersectionObserver((entries)=>{
        entries.forEach((entry)=>{
          if (!entry.isIntersecting) return;
          const card = entry.target;
          const postId = card.getAttribute('data-id');
          if (postId) listenCommentsCount(postId);
          commentsObserver.unobserve(card);
        });
      }, { rootMargin: '600px 0px' });
    }
  }

  function hydrateNewContent(root){
    createObservers();
    const imgs = root.querySelectorAll('img.lazy-media:not([data-observed])');
    imgs.forEach((img)=>{ img.setAttribute('data-observed','1'); mediaObserver.observe(img); });
    const bgs = root.querySelectorAll('.lazy-bg[data-bg]:not([data-observed])');
    bgs.forEach((el)=>{ el.setAttribute('data-observed','1'); bgObserver.observe(el); });
  }

  function observeCardsForComments(root){
    createObservers();
    const cards = root.querySelectorAll('.card:not([data-comments-observed])');
    cards.forEach((c)=>{ c.setAttribute('data-comments-observed','1'); commentsObserver.observe(c); });
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
      // Read post to get author for notifications
      let postAuthorId = null;
      try { const pd = await postRef.get(); postAuthorId = (pd.exists && pd.data() && pd.data().authorId) ? pd.data().authorId : null; } catch(_) {}
      const snap = await likeRef.get();
      if (!snap.exists) {
        await db.runTransaction(async (tx)=>{
          tx.set(likeRef, { createdAt: window.firebase.firestore.FieldValue.serverTimestamp() });
          tx.update(postRef, { 'counts.likes': window.firebase.firestore.FieldValue.increment(1) });
        });
        const span = btn.querySelector('span'); if (span) span.textContent = String((parseInt(span.textContent||'0')||0) + 1);
        btn.classList.add('liked');
        // Add notification for post author on like
        try {
          if (postAuthorId && postAuthorId !== uid) {
            await db.collection('notifications').add({
              userId: postAuthorId,
              actorId: uid,
              postId: postId,
              type: 'like',
              createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
            });
          }
        } catch(_) {}
      } else {
        await db.runTransaction(async (tx)=>{
          tx.delete(likeRef);
          tx.update(postRef, { 'counts.likes': window.firebase.firestore.FieldValue.increment(-1) });
        });
        const span = btn.querySelector('span'); if (span) span.textContent = String(Math.max(0,(parseInt(span.textContent||'0')||0) - 1));
        btn.classList.remove('liked');
        // Remove like notification if exists
        try {
          if (postAuthorId && postAuthorId !== uid) {
            const qs = await db.collection('notifications')
              .where('userId','==',postAuthorId)
              .where('postId','==',postId)
              .where('actorId','==',uid)
              .where('type','==','like').get();
            qs.forEach(doc=>{ try { doc.ref.delete(); } catch(_) {} });
          }
        } catch(_) {}
      }
    } catch(_) {}
  }

  function bind(){
    ensureAuthUI();
    document.addEventListener('click', (e)=>{
      const ddBtn = e.target.closest && e.target.closest('[data-dd-trigger]');
      if (ddBtn){
        const id = ddBtn.getAttribute('data-dd-trigger');
        const menu = document.getElementById(`dd-${id}`);
        if (menu) menu.style.display = (menu.style.display==='block'?'none':'block');
        return;
      }
      const outside = !e.target.closest('.dropdown');
      if (outside){ document.querySelectorAll('.dropdown-menu').forEach(el=> el.style.display='none'); }

      // navigate to profile when clicking avatar or author name
      const prof = e.target.closest && e.target.closest('[data-profile]');
      if (prof){
        const uid = prof.getAttribute('data-profile');
        const isLocal = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:');
        if (!window.currentUser) { window.location.href = isLocal ? '/login/index.html' : '/login'; return; }
        window.location.href = isLocal ? `/feed/profile.html?uid=${uid}` : `/feed/profile?uid=${uid}`;
        return;
      }

      // filter dropdown toggle
      const toggle = e.target.closest && e.target.closest('#filter-toggle');
      if (toggle){
        const m = document.getElementById('filter-menu');
        if (m) m.style.display = (m.style.display==='block'?'none':'block');
        return;
      }
      const item = e.target.closest && e.target.closest('.filter-item');
      if (item){
        const v = item.getAttribute('data-filter');
        const label = document.getElementById('filter-label');
        if (label) label.textContent = (v==='following'?'팔로잉':'추천');
        document.querySelectorAll('.filter-item .check').forEach(el=> el.style.display='none');
        const mark = document.querySelector(`.filter-item[data-filter="${v}"] .check`); if (mark) mark.style.display='';
        const menu = document.getElementById('filter-menu'); if (menu) menu.style.display='none';
        window.__feedFilter__ = v;
        el('feed-list').innerHTML=''; cursor=null; hasMore=true; fetchFeed(true);
        return;
      }

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
        if (!window.currentUser) { nav('/login', '/login/index.html'); return; }
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

  document.addEventListener('DOMContentLoaded', ()=>{ bind(); fetchFeed(true); try { window.lucide && window.lucide.createIcons(); } catch(_) {}
    // 모바일: 아래로 스크롤 시 하단 바 숨김, 위로 올리면 표시
    try {
      if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
        var bar = document.querySelector('.feed-right');
        if (bar) {
          var lastY = window.scrollY || 0;
          window.addEventListener('scroll', function(){
            var y = window.scrollY || 0;
            var dy = y - lastY;
            if (dy > 6) { bar.classList.add('is-hidden'); }
            else if (dy < -6) { bar.classList.remove('is-hidden'); }
            lastY = y;
          }, { passive: true });
        }
      }
    } catch(_) {}
  });
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


