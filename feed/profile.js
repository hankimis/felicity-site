;(function(){
  const db = window.firebase && window.firebase.firestore ? window.firebase.firestore() : null;
  const auth = window.firebase && window.firebase.auth ? window.firebase.auth() : null;

  function el(id){ return document.getElementById(id); }
  function fmtRel(ts){ try{ const d = ts?.toDate ? ts.toDate() : new Date(ts); const diff = Date.now()-d.getTime(); const s=Math.floor(diff/1000), m=Math.floor(s/60), h=Math.floor(m/60), day=Math.floor(h/24); if (day>=1) return `${day}일 전`; if (h>=1) return `${h}시간 전`; if (m>=1) return `${m}분 전`; return '방금 전'; }catch(_){ return ''; } }
  function createIconsSafe(){ try { window.lucide && window.lucide.createIcons(); } catch(_) {} }
  const isLocal = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:');
  const nav = (pretty, raw) => { window.location.href = isLocal ? raw : pretty; };

  const userCache = new Map();
  async function getUser(uid){
    if (!db || !uid) return {};
    if (userCache.has(uid)) return userCache.get(uid);
    try { const d = await db.collection('users').doc(uid).get(); const u = d.exists ? (d.data()||{}) : {}; userCache.set(uid, u); return u; } catch(_) { return {}; }
  }

  function resolveUidFromQuery(){
    try {
      const p = new URLSearchParams(location.search||'');
      const q = p.get('uid');
      return q || null;
    } catch(_) { return null; }
  }

  async function loadProfile(){
    try {
      if (!db || !auth) return;
      await new Promise(res=>{ if (auth.currentUser || resolveUidFromQuery()) return res(); auth.onAuthStateChanged(()=>res()); });
      const uid = resolveUidFromQuery() || (auth.currentUser && auth.currentUser.uid);
      if (!uid) return;
      const doc = await db.collection('users').doc(uid).get();
      const u = doc.exists ? (doc.data()||{}) : {};
      el('profile-name').textContent = u.displayName || u.nickname || u.name || '사용자';
      const email = u.email || (auth.currentUser && auth.currentUser.email) || '';
      el('profile-id').textContent = email || '';
      const bioEl = el('profile-bio'); if (bioEl) bioEl.textContent = u.bio || u.intro || '';
      const av = el('profile-avatar');
      const photo = u.photoURL || u.photoUrl || u.avatar || u.avatarUrl || u.profileImage || u.profilePhoto || '';
      if (photo && av){ av.style.backgroundImage = `url('${photo}')`; av.style.backgroundSize='cover'; av.style.backgroundPosition='center'; }
      // followers preview and count
      try {
        const folRef = db.collection('users').doc(uid).collection('followers');
        const previewSnap = await folRef.limit(3).get();
        const totalSnap = await folRef.get();
        const imgs = [];
        for (const d of previewSnap.docs){
          try {
            const uDoc = await db.collection('users').doc(d.id).get();
            const up = uDoc.exists ? (uDoc.data()||{}) : {};
            const img = up.photoURL || '';
            imgs.push(`<span style="width:24px;height:24px;border-radius:999px;background:#e5e7eb;border:1px solid var(--border-color);background-image:${img?`url('${img}')`:'none'};background-size:cover;background-position:center"></span>`);
          } catch(_) { imgs.push(`<span style="width:24px;height:24px;border-radius:999px;background:#e5e7eb;border:1px solid var(--border-color);"></span>`); }
        }
        const cont = document.getElementById('profile-followers');
        if (cont) cont.innerHTML = `${imgs.join(' ')} <span>팔로워 ${totalSnap.size}명</span>`;
      } catch(_) {}
      // action button
      const actionBtn = document.getElementById('profile-action-btn');
      const me = auth.currentUser && auth.currentUser.uid;
      function setBtnState(state){
        if (!actionBtn) return;
        actionBtn.classList.remove('btn-follow','btn-following');
        if (state==='follow'){ actionBtn.textContent='팔로우'; actionBtn.classList.add('btn-follow'); }
        if (state==='following'){ actionBtn.textContent='팔로잉'; actionBtn.classList.add('btn-following'); }
      }
      if (actionBtn){
        if (!me) {
          // not logged in: hide action button (no edit/follow)
          actionBtn.style.display = 'none';
        } else if (me && me === uid) {
          actionBtn.classList.remove('btn-follow','btn-following');
          actionBtn.textContent = '프로필 편집';
          actionBtn.onclick = ()=> nav('/my-account', '/my-account/index.html');
        } else {
          // initialize state
          try {
            const ref = db.collection('users').doc(me||'__').collection('following').doc(uid);
            if (me){ const s = await ref.get(); if (s.exists) setBtnState('following'); else setBtnState('follow'); }
          } catch(_) { setBtnState('follow'); }
          // click handler
          actionBtn.onclick = async ()=>{
            if (!auth.currentUser) return;
            try {
              const followingRef = db.collection('users').doc(auth.currentUser.uid).collection('following').doc(uid);
              const followerRef = db.collection('users').doc(uid).collection('followers').doc(auth.currentUser.uid);
              const s = await followingRef.get();
              if (!s.exists) {
                // follow: save following + follower
                await followingRef.set({ createdAt: window.firebase.firestore.FieldValue.serverTimestamp() });
                let myPhoto = '';
                try { const myDoc = await db.collection('users').doc(auth.currentUser.uid).get(); if (myDoc.exists) myPhoto = myDoc.data()?.photoURL || ''; } catch(_) {}
                await followerRef.set({ createdAt: window.firebase.firestore.FieldValue.serverTimestamp(), photoURL: myPhoto });
                // notification for follow
                try {
                  await db.collection('notifications').add({
                    userId: uid,
                    actorId: auth.currentUser.uid,
                    type: 'follow',
                    createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
                  });
                } catch(_) {}
                setBtnState('following');
                // bump follower count UI
                try { const cont=document.getElementById('profile-followers'); if(cont){ const span=cont.querySelector('span:last-child'); if(span){ const m=span.textContent.match(/(\d+)/); if(m){ span.textContent = `팔로워 ${Number(m[1])+1}명`; } } } } catch(_) {}
              } else {
                // ask confirm modal for unfollow
                const modal = document.getElementById('unfollow-modal');
                if (modal){
                  const av = document.getElementById('unfollow-avatar'); if(av && photo) { av.style.backgroundImage=`url('${photo}')`; }
                  const nameText = u.displayName || email || '사용자';
                  const tx = document.getElementById('unfollow-text'); if (tx) tx.textContent = `${nameText}님을 팔로우 취소하시겠어요?`;
                  modal.style.display='flex';
                  const close = ()=>{ modal.style.display='none'; };
                  const cancelBtn = document.getElementById('unfollow-cancel');
                  const confirmBtn = document.getElementById('unfollow-confirm');
                  if (cancelBtn) cancelBtn.onclick = close;
                  if (confirmBtn) confirmBtn.onclick = async ()=>{
                    try {
                      await followingRef.delete();
                      await followerRef.delete();
                      setBtnState('follow');
                      // decrease follower count UI
                      try { const cont=document.getElementById('profile-followers'); if(cont){ const span=cont.querySelector('span:last-child'); if(span){ const m=span.textContent.match(/(\d+)/); if(m){ span.textContent = `팔로워 ${Math.max(0,Number(m[1])-1)}명`; } } } } catch(_) {}
                    } catch(_) {}
                    close();
                  };
                }
              }
            } catch(_) {}
          };
        }
      }
      loadPosts(uid, u);
      loadComments(uid, u);
    } catch(_) {}
  }

  function cardHtml(p, author){
    const media = Array.isArray(p.media)? p.media : [];
    const mlen = media.length;
    const mediaClass = mlen>=4 ? 'media media-4' : (mlen===3 ? 'media media-3' : (mlen===2 ? 'media media-2' : (mlen===1 ? 'media media-1' : 'media')));
    const authorName = author.displayName || '사용자';
    const avatarStyle = author.photoURL ? `style="background-image:url('${author.photoURL}')"` : '';
    const timeRel = fmtRel(p.createdAt);
    const likeCount = p.counts?.likes || 0;
    const replyCount = p.counts?.replies || 0;
    const canEdit = (auth && auth.currentUser && auth.currentUser.uid === p.authorId);
    return `<article class="card" data-id="${p.id}">
      <div class="avatar" ${avatarStyle}></div>
      <div>
        <div class="meta" style="display:flex;align-items:center;gap:8px;">
          <b>${authorName}</b>
          <span>·</span>
          <span>${timeRel}</span>
          ${canEdit?`<div class=\"dropdown\" style=\"margin-left:auto;\"><button class=\"act\" data-dd-trigger=\"${p.id}\"><i data-lucide=\"more-horizontal\"></i></button><div class=\"dropdown-menu\" id=\"dd-${p.id}\"><button class=\"menu-item\" data-edit=\"${p.id}\"><i data-lucide=\"pencil\"></i>수정</button><button class=\"menu-item\" data-del=\"${p.id}\"><i data-lucide=\"trash\"></i>삭제</button></div></div>`:''}
        </div>
        <div class="text">${(p.text||'').replace(/</g,'&lt;')}</div>
        ${mlen?`<div class="${mediaClass}">${media.slice(0,4).map(m=>`<img src="${m.url}" loading="lazy"/>`).join('')}</div>`:''}
        <div class="actions">
          <button class="act like" data-like="${p.id}"><i data-lucide="heart"></i><span>${likeCount}</span></button>
          <button class="act reply"><i data-lucide="message-circle-more"></i><span>${replyCount}</span></button>
          <button class="act share"><i data-lucide="share"></i></button>
        </div>
      </div>
    </article>`;
  }

  function replyItemHtml(c, author){
    const avatar = author.photoURL ? `style=\"background-image:url('${author.photoURL}')\"` : '';
    return `<div class=\"reply-item\" data-id=\"${c.id}\">\n      <div class=\"avatar\" ${avatar}></div>\n      <div>\n        <div class=\"meta\"><b>${author.displayName||'나'}</b><span>·</span><span>${fmtRel(c.createdAt)}</span></div>\n        <div class=\"text\">${(c.text||'').replace(/</g,'&lt;')}</div>\n        <div class=\"actions\">\n          <button class=\"act like\" data-clike=\"${c.id}\"><i data-lucide=\"heart\"></i><span>${c.counts?.likes||0}</span></button>\n        </div>\n      </div>\n    </div>`;
  }

  async function loadPosts(uid, author){
    if (!db) return;
    const list = el('profile-posts'); if (!list) return;
    list.innerHTML = '';
    try {
      let qs = db.collection('posts').where('authorId','==',uid).orderBy('createdAt','desc').limit(50);
      let snap;
      try { snap = await qs.get(); }
      catch(_) { snap = await db.collection('posts').where('authorId','==',uid).limit(50).get(); }
      const docs = snap.docs.slice();
      docs.sort((a,b)=>{
        const ta = (a.data().createdAt && a.data().createdAt.toMillis? a.data().createdAt.toMillis(): (a.data().createdAt? new Date(a.data().createdAt).getTime():0));
        const tb = (b.data().createdAt && b.data().createdAt.toMillis? b.data().createdAt.toMillis(): (b.data().createdAt? new Date(b.data().createdAt).getTime():0));
        return tb - ta;
      });
      const items = [];
      const posts = docs.map(d=>({ id:d.id, ...d.data(), author }));
      await Promise.all(posts.map(async (p)=>{
        try {
          const csnap = await db.collection('comments').where('postId','==',p.id).get();
          p.counts = Object.assign({}, p.counts || {}, { replies: csnap.size });
        } catch(_) { p.counts = Object.assign({}, p.counts || {}, { replies: 0 }); }
      }));
      posts.forEach(p=> items.push(cardHtml(p, author)));
      list.innerHTML = items.join('') || '<div style="padding:16px;color:var(--text-color-secondary)">작성한 스레드가 없습니다.</div>';
      createIconsSafe();
      markLikedStatesProfile();
    } catch(_) { list.innerHTML = '<div style="padding:16px;color:var(--text-color-secondary)">작성한 스레드가 없습니다.</div>'; }
  }

  async function loadComments(uid, me){
    if (!db) return;
    const list = el('profile-comments'); if (!list) return;
    list.innerHTML = '';
    try {
      let qs = db.collection('comments').where('authorId','==',uid).orderBy('createdAt','desc').limit(100);
      let snap;
      try { snap = await qs.get(); }
      catch(_) { snap = await db.collection('comments').where('authorId','==',uid).limit(100).get(); }
      const docs = snap.docs.slice();
      // 그룹화 by postId
      const byPost = new Map();
      docs.forEach(d=>{ const c = { id:d.id, ...d.data() }; const arr = byPost.get(c.postId) || []; arr.push(c); byPost.set(c.postId, arr); });
      // 렌더
      const chunks = [];
      for (const [postId, comments] of byPost.entries()){
        // 원글
        let pDoc = await db.collection('posts').doc(postId).get();
        if (!pDoc.exists) continue;
        const pData = { id:pDoc.id, ...pDoc.data() };
        const pAuthor = await getUser(pData.authorId);
        // 댓글 오래된 순으로
        comments.sort((a,b)=>{
          const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt? new Date(a.createdAt).getTime():0);
          const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt? new Date(b.createdAt).getTime():0);
          return ta - tb;
        });
        const repliesHtml = comments.map(c=> replyItemHtml(c, me)).join('');
        chunks.push(`<div class="comment-thread">${cardHtml(pData, pAuthor)}<div class="replies">${repliesHtml}</div></div>`);
      }
      list.innerHTML = chunks.join('') || '<div style="padding:16px;color:var(--text-color-secondary)">작성한 댓글이 없습니다.</div>';
      createIconsSafe();
      markLikedStatesProfile();
    } catch(_) { list.innerHTML = '<div style="padding:16px;color:var(--text-color-secondary)">작성한 댓글이 없습니다.</div>'; }
  }

  async function markLikedStatesProfile(){
    try {
      if (!db || !auth || !auth.currentUser) return;
      const uid = auth.currentUser.uid;
      // posts in posts tab
      const postCards = Array.from(document.querySelectorAll('#profile-posts .card'));
      for (const card of postCards){
        const pid = card.getAttribute('data-id'); if (!pid) continue;
        const likedDoc = await db.collection('posts').doc(pid).collection('likes').doc(uid).get();
        if (likedDoc.exists) {
          const btn = card.querySelector('.actions .like');
          if (btn) {
            btn.classList.add('liked');
            const path = btn.querySelector('svg path');
            if (path) { path.setAttribute('fill', '#ff334b'); path.setAttribute('stroke', '#ff334b'); }
          }
        }
      }
      // parent post cards rendered in comments tab
      const parentCards = Array.from(document.querySelectorAll('#profile-comments .card'));
      for (const card of parentCards){
        const pid = card.getAttribute('data-id'); if (!pid) continue;
        const likedDoc = await db.collection('posts').doc(pid).collection('likes').doc(uid).get();
        if (likedDoc.exists) {
          const btn = card.querySelector('.actions .like');
          if (btn) {
            btn.classList.add('liked');
            const path = btn.querySelector('svg path');
            if (path) { path.setAttribute('fill', '#ff334b'); path.setAttribute('stroke', '#ff334b'); }
          }
        }
      }
      // replies likes
      const replyNodes = Array.from(document.querySelectorAll('#profile-comments .reply-item'));
      for (const node of replyNodes){
        const cid = node.getAttribute('data-id'); if (!cid) continue;
        const likedDoc = await db.collection('comments').doc(cid).collection('likes').doc(uid).get();
        if (likedDoc.exists) {
          const btn = node.querySelector('.actions .like');
          if (btn) {
            btn.classList.add('liked');
            const path = btn.querySelector('svg path');
            if (path) { path.setAttribute('fill', '#ff334b'); path.setAttribute('stroke', '#ff334b'); }
          }
        }
      }
    } catch(_){}
  }

  function bindTabs(){
    const t1 = el('tab-posts');
    const t2 = el('tab-comments');
    const posts = el('profile-posts');
    const comments = el('profile-comments');
    if (t1) t1.addEventListener('click', ()=>{ t1.style.color=''; t1.style.fontWeight='600'; if (t2){ t2.style.color='var(--text-color-secondary)'; t2.style.fontWeight='400'; } posts.style.display=''; comments.style.display='none'; });
    if (t2) t2.addEventListener('click', ()=>{ t2.style.color=''; t2.style.fontWeight='600'; if (t1){ t1.style.color='var(--text-color-secondary)'; t1.style.fontWeight='400'; } posts.style.display='none'; comments.style.display=''; });
  }

  function bindInteractions(){
    const editBtn = document.getElementById('btn-edit-profile');
    if (editBtn) editBtn.addEventListener('click', function(){ nav('/my-account', '/my-account/index.html'); });
    document.addEventListener('click', (e)=>{
      const dd = e.target.closest && e.target.closest('[data-dd-trigger]');
      if (dd){ const id = dd.getAttribute('data-dd-trigger'); const m = document.getElementById(`dd-${id}`); if (m) m.style.display = (m.style.display==='block'?'none':'block'); return; }
      if (!e.target.closest('.dropdown')){ document.querySelectorAll('.dropdown-menu').forEach(el=> el.style.display='none'); }
      const card = e.target.closest && e.target.closest('article.card');
      if (card && !e.target.closest('.actions')){
        const id = card.getAttribute('data-id');
        if (id) nav(`/feed/post/${id}`, `/feed/post.html?id=${id}`);
      }
      const likeBtn = e.target.closest && e.target.closest('[data-like]');
      if (likeBtn) {
        if (!auth || !auth.currentUser) return;
        const pid = likeBtn.getAttribute('data-like');
        toggleLike(pid, likeBtn);
      }
      const delBtn = e.target.closest && e.target.closest('[data-del]');
      if (delBtn){ const id = delBtn.getAttribute('data-del'); if (confirm('삭제하시겠습니까?')){ db.collection('posts').doc(id).delete().then(()=>{ const c=document.querySelector(`.card[data-id="${id}"]`); if(c) c.remove(); }); } return; }
      const editInline = e.target.closest && e.target.closest('[data-edit]');
      if (editInline){ const id = editInline.getAttribute('data-edit'); nav(`/feed/write?id=${id}`, `/feed/write.html?id=${id}`); return; }
      const cLikeBtn = e.target.closest && e.target.closest('[data-clike]');
      if (cLikeBtn) {
        if (!auth || !auth.currentUser) return;
        const cid = cLikeBtn.getAttribute('data-clike');
        toggleCommentLike(cid, cLikeBtn);
      }
    });
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

  async function toggleCommentLike(commentId, btn){
    if (!db || !auth || !auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const cRef = db.collection('comments').doc(commentId);
    const lRef = cRef.collection('likes').doc(uid);
    try {
      const snap = await lRef.get();
      if (!snap.exists) {
        await db.runTransaction(async (tx)=>{
          tx.set(lRef, { createdAt: window.firebase.firestore.FieldValue.serverTimestamp() });
          tx.update(cRef, { 'counts.likes': window.firebase.firestore.FieldValue.increment(1) });
        });
        const span = btn.querySelector('span'); if (span) span.textContent = String((parseInt(span.textContent||'0')||0) + 1);
        btn.classList.add('liked');
      } else {
        await db.runTransaction(async (tx)=>{
          tx.delete(lRef);
          tx.update(cRef, { 'counts.likes': window.firebase.firestore.FieldValue.increment(-1) });
        });
        const span = btn.querySelector('span'); if (span) span.textContent = String(Math.max(0,(parseInt(span.textContent||'0')||0) - 1));
        btn.classList.remove('liked');
      }
    } catch(_) {}
  }

  document.addEventListener('DOMContentLoaded', function(){ bindTabs(); bindInteractions(); loadProfile(); });
})();
