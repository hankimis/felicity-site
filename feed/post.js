;(function(){
  const db = window.firebase && window.firebase.firestore ? window.firebase.firestore() : null;
  const auth = window.firebase && window.firebase.auth ? window.firebase.auth() : null;
  const storage = window.firebase && window.firebase.storage ? window.firebase.storage() : null;

  function resolvePostId(){
    try {
      if (window.__POST_ID_FROM_QS__) return window.__POST_ID_FROM_QS__;
      const m = location.pathname && location.pathname.match(/\/feed\/post\/([^\/#?]+)/);
      if (m && m[1]) return m[1];
      const last = (location.pathname || '').split('/').filter(Boolean).pop() || '';
      if (last && !/\.html?$/.test(last)) return last;
      const qsId = new URLSearchParams(location.search || '').get('id');
      return qsId || '';
    } catch (_) { return ''; }
  }

  const postId = resolvePostId();

  let commentsUnsub = null;

  function el(id){ return document.getElementById(id); }
  function fmtRel(ts){ try{ const d = ts?.toDate ? ts.toDate() : new Date(ts); const diff = Date.now()-d.getTime(); const s=Math.floor(diff/1000), m=Math.floor(s/60), h=Math.floor(m/60), day=Math.floor(h/24); if (day>=1) return `${day}일 전`; if (h>=1) return `${h}시간 전`; if (m>=1) return `${m}분 전`; return '방금 전'; }catch(_){ return ''; } }
  function html(s){ return s.replace(/</g,'&lt;'); }
  function createIconsSafe(){ try { window.lucide && window.lucide.createIcons(); } catch(_) {} }
  // 리라이트 이슈 우회: 항상 HTML 쿼리 경로로 이동
  const nav = (pretty, raw) => { window.location.href = raw; };

  async function hydrateReplyProfile(){
    const comp = document.getElementById('reply-composer');
    const av = document.getElementById('reply-avatar');
    const input = document.getElementById('reply-text');
    if (!comp) return;
    try {
      let user = auth?.currentUser || window.currentUser || null;
      if (!user && auth && auth.onAuthStateChanged) {
        await new Promise(resolve => auth.onAuthStateChanged(()=> resolve()));
        user = auth.currentUser || window.currentUser || null;
      }
      let u = {};
      if (db && (user?.uid)) {
        const ud = await db.collection('users').doc(user.uid).get(); if (ud.exists) u = ud.data() || {};
      }
      const displayName = u.displayName || u.nickname || user?.displayName || (user?.email? user.email.split('@')[0]: '사용자');
      const photo = u.photoURL || u.photoUrl || u.avatar || u.avatarUrl || user?.photoURL || '';
      window.__currentUserPhoto__ = photo || '';
      if (input) input.placeholder = `${displayName}님의 생각을 공유해보세요.`;
      if (av && photo) { av.style.backgroundImage = `url('${photo}')`; av.style.backgroundSize='cover'; av.style.backgroundPosition='center'; }
      comp.style.display = '';
    } catch(_) { comp.style.display = ''; }
  }

  function hydrateReplyBarsAvatar(){
    try {
      const photo = window.__currentUserPhoto__ || '';
      if (!photo) return;
      document.querySelectorAll('.comment-composer.reply-bar .avatar').forEach(el=>{
        el.style.backgroundImage = `url('${photo}')`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
      });
    } catch(_){}
  }

  async function loadPost(){
    if (!db || !postId) { const c = el('post'); if (c) c.innerHTML = '<div style="padding:24px;">유효하지 않은 게시글 주소입니다.</div>'; return; }
    const doc = await db.collection('posts').doc(postId).get();
    if (!doc.exists) { el('post').innerHTML = '<div style="padding:24px;">게시글을 찾을 수 없습니다.</div>'; return; }
    const p = { id: doc.id, ...doc.data() };
    let author = { displayName: '사용자', photoURL: '' };
    try { const u = await db.collection('users').doc(p.authorId).get(); if (u.exists) author = u.data(); } catch(_) {}
    const canDelete = (window.currentUser && (window.currentUser.uid === p.authorId));
    el('post').innerHTML = `
      <div class="avatar" style="${author.photoURL?`background-image:url('${author.photoURL}')`:''}"></div>
      <div>
        <div class="meta"><b>${(author.displayName)||'사용자'}</b><span>·</span><span>${fmtRel(p.createdAt)}</span>${canDelete?`<div class=\"dropdown\" style=\"margin-left:auto;\"><button class=\"act\" data-dd-trigger=\"post\"><i data-lucide=\"more-horizontal\"></i></button><div class=\"dropdown-menu\" id=\"dd-post\"><button class=\"menu-item\" id=\"post-edit\"><i data-lucide=\"pencil\"></i>수정</button><button class=\"menu-item\" id=\"post-delete\"><i data-lucide=\"trash\"></i>삭제</button></div></div>`:''}</div>
        <div class="text">${html(p.text||'')}</div>
        ${(Array.isArray(p.media)&&p.media.length)?`<div class="media">${p.media.map(m=>`<img src="${m.url}"/>`).join('')}</div>`:''}
        <div class="actions">
          <button class="act like" data-like="${p.id}"><i data-lucide="heart"></i><span>${p.counts?.likes||0}</span></button>
          <button class="act reply"><i data-lucide="message-circle-more"></i><span>${p.counts?.replies||0}</span></button>
          <button class="act share"><i data-lucide="share"></i></button>
        </div>
      </div>`;
    createIconsSafe();
    markInitialLike();
  }

  async function loadComments(){
    if (!db || !postId) return;
    if (commentsUnsub) { try { commentsUnsub(); } catch(_) {} commentsUnsub = null; }
    const sortByLikes = !!window.__commentSortLikes__;
    let q = db.collection('comments').where('postId','==',postId).where('parentId','==',null);
    q = sortByLikes ? q.orderBy('counts.likes','desc').orderBy('createdAt','desc') : q.orderBy('createdAt','asc');
    const renderFromDocs = async (docs) => {
      const cont = el('comments');
      if (!cont) return;
      cont.innerHTML = '';
      const rows = [];
      const parentIds = [];
      for (const d of docs){
        const c = { id: d.id, ...d.data() };
        let u = { displayName: '사용자', photoURL: '' };
        try { const ud = await db.collection('users').doc(c.authorId).get(); if (ud.exists) u = ud.data(); } catch(_) {}
        const canEdit = window.currentUser && window.currentUser.uid === c.authorId;
        rows.push(renderComment(c, u, canEdit));
        rows.push(`<div class="replies" id="replies-${c.id}"></div>`);
        rows.push(renderReplyComposer(c.id));
        parentIds.push(c.id);
      }
      cont.insertAdjacentHTML('beforeend', rows.join(''));
      // Now that containers exist in DOM, fetch their replies
      parentIds.forEach((pid)=> fetchReplies(pid));
      createIconsSafe();
      const count = docs.length;
      const countEl = document.getElementById('comments-count'); if (countEl) countEl.textContent = `댓글 ${count}개`;
      const elBtn = document.querySelector('#post .actions .reply span') || document.querySelector('.actions .reply span');
      if (elBtn) elBtn.textContent = String(count);
      // mark liked states for replies and comments if logged in
      markLikedStates();
    };

    const fallbackOnce = async () => {
      try {
        let ref = db.collection('comments').where('postId','==',postId).orderBy('createdAt','asc');
        let snap;
        try { snap = await ref.get(); }
        catch (_) { snap = await db.collection('comments').where('postId','==',postId).get(); }
        const root = snap.docs.filter(d=>{
          const v = d.data() && d.data().parentId;
          return v === null || typeof v === 'undefined';
        });
        await renderFromDocs(root);
      } catch (_) {}
    };

    try {
      commentsUnsub = q.onSnapshot(async (snap)=>{ await renderFromDocs(snap.docs); }, ()=>{ fallbackOnce(); });
    } catch (_) {
      fallbackOnce();
    }
  }

  async function markLikedStates(){
    try {
      if (!db || !auth || !auth.currentUser) return;
      const uid = auth.currentUser.uid;
      // top-level comments
      const cards = Array.from(document.querySelectorAll('.card.comment'));
      for (const card of cards){
        const cid = card.getAttribute('data-id'); if (!cid) continue;
        const likedDoc = await db.collection('comments').doc(cid).collection('likes').doc(uid).get();
        if (likedDoc.exists) { const btn = card.querySelector('.actions .like'); if (btn) btn.classList.add('liked'); }
      }
      // reply items
      const replies = Array.from(document.querySelectorAll('.reply-item'));
      for (const node of replies){
        const cid = node.getAttribute('data-id'); if (!cid) continue;
        const likedDoc = await db.collection('comments').doc(cid).collection('likes').doc(uid).get();
        if (likedDoc.exists) { const btn = node.querySelector('.actions .like'); if (btn) btn.classList.add('liked'); }
      }
    } catch(_){}
  }

  function renderComment(c, u, canEdit){
    return `<article class="card comment" data-id="${c.id}">
      <div class="avatar" data-profile="${c.authorId||''}" style="${u.photoURL?`background-image:url('${u.photoURL}')`:''}"></div>
      <div>
        <div class="meta" style="display:flex;align-items:center;gap:8px;"><b data-profile="${c.authorId||''}" style="cursor:pointer">${u.displayName||'사용자'}</b><span>·</span><span>${fmtRel(c.createdAt)}</span>${canEdit?`<div class=\"dropdown\" style=\"margin-left:auto;\"><button class=\"act\" data-dd-c=\"${c.id}\"><i data-lucide=\"more-horizontal\"></i></button><div class=\"dropdown-menu\" id=\"dd-c-${c.id}\"><button class=\"menu-item\" data-edit-cid=\"${c.id}\"><i data-lucide=\"pencil\"></i>수정</button><button class=\"menu-item\" data-del-cid=\"${c.id}\"><i data-lucide=\"trash\"></i>삭제</button></div></div>`:''}</div>
        <div class="text" data-role="c-text">${html(c.text||'')}</div>
        <div class="actions">
          <button class="act like" data-clike="${c.id}"><i data-lucide="heart"></i><span>${c.counts?.likes||0}</span></button>
        </div>
      </div>
    </article>`;
  }

  function renderReplyComposer(parentId){
    return `<div class="comment-composer reply-bar" style="display:none">
      <span class="avatar" style="width:24px;height:24px;border:1px solid var(--border-color);border-radius:999px;"></span>
      <input type="text" data-reply-input="${parentId}" placeholder="답글을 입력하세요" />
      <div class="icons">
        <button data-reply-attach="${parentId}" title="이미지 추가" style="background:none;border:none;cursor:pointer;padding:6px;border-radius:8px"><i data-lucide="image"></i></button>
        <input type="file" accept="image/*" multiple data-reply-media="${parentId}" style="display:none" />
      </div>
      <button class="btn" data-reply-submit="${parentId}" style="border:1px solid var(--border-color); border-radius:6px; padding:4px 12px;">답글쓰기</button>
    </div>`;
  }

  async function fetchReplies(parentId){
    try {
      const s = await db.collection('comments').where('postId','==',postId).where('parentId','==',parentId).orderBy('createdAt','asc').get();
      const container = document.getElementById(`replies-${parentId}`);
      if (!container) return;
      const items = [];
      for (const d of s.docs){
        const c = { id:d.id, ...d.data() };
        let u = { displayName: '사용자', photoURL: '' };
        try { const ud = await db.collection('users').doc(c.authorId).get(); if (ud.exists) u = ud.data(); } catch(_) {}
        const canEdit = window.currentUser && window.currentUser.uid === c.authorId;
        items.push(`
          <div class="reply-item" data-id="${c.id}">
            <div class="avatar" data-profile="${c.authorId||''}" style="${u.photoURL?`background-image:url('${u.photoURL}')`:''}"></div>
            <div>
              <div class="meta" style="display:flex;align-items:center;gap:8px;"><b data-profile="${c.authorId||''}" style="cursor:pointer">${u.displayName||'사용자'}</b><span>·</span><span>${fmtRel(c.createdAt)}</span>${canEdit?`<div class="dropdown" style="margin-left:auto;"><button class="act" data-dd-r="${c.id}"><i data-lucide="more-horizontal"></i></button><div class="dropdown-menu" id="dd-r-${c.id}"><button class="menu-item" data-edit-cid="${c.id}"><i data-lucide="pencil"></i>수정</button><button class="menu-item" data-del-cid="${c.id}"><i data-lucide="trash"></i>삭제</button></div></div>`:''}</div>
              <div class="text" data-role="c-text">${html(c.text||'')}</div>
              <div class="actions">
                <button class="act like" data-clike="${c.id}"><i data-lucide="heart"></i><span>${c.counts?.likes||0}</span></button>
              </div>
            </div>
          </div>`);
      }
      container.innerHTML = items.join('');
      createIconsSafe();
      markLikedStates();
    } catch(_){ }
  }

  async function createReply(){
    if (!db || !auth || !auth.currentUser) return;
    const input = el('reply-text');
    const text = (input && input.value ? input.value.trim() : '');
    if (!text && !(window.__replyPastedFiles__ && window.__replyPastedFiles__.length)) return;
    const now = window.firebase.firestore.FieldValue.serverTimestamp();
    const inputFile = el('reply-media');
    const files = [...(window.__replyPastedFiles__||[]), ...((inputFile && inputFile.files) ? Array.from(inputFile.files) : [])];
    const media = [];
    if (storage && files.length) {
      const bucket = storage.ref();
      for (let i=0;i<files.length;i++) {
        const f = files[i];
        const path = `comments/${auth.currentUser.uid}/${Date.now()}_${i}_${f.name}`;
        const snap = await bucket.child(path).put(f);
        const url = await snap.ref.getDownloadURL();
        media.push({ type: f.type.startsWith('video')?'video':'image', url });
      }
    }
    const res = await db.collection('comments').add({ postId, parentId: null, authorId: auth.currentUser.uid, text, media, createdAt: now, counts:{likes:0,replies:0}, deleted:false });
    // Notify post author about new comment
    try {
      const pd = await db.collection('posts').doc(postId).get();
      const postAuthorId = (pd.exists && pd.data() && pd.data().authorId) ? pd.data().authorId : null;
      if (postAuthorId && postAuthorId !== auth.currentUser.uid){
        await db.collection('notifications').add({ userId: postAuthorId, actorId: auth.currentUser.uid, type: 'comment', postId, commentId: res.id, message: `댓글: ${(text||'').slice(0,140)}`, createdAt: window.firebase.firestore.FieldValue.serverTimestamp() });
      }
    } catch(_) {}
    if (input) input.value = '';
    if (inputFile) inputFile.value = '';
    window.__replyPastedFiles__ = [];
    loadComments();
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
      let cDoc = null; let commentAuthorId = null; let commentPostId = null;
      try { cDoc = await cRef.get(); if (cDoc.exists){ const d=cDoc.data()||{}; commentAuthorId = d.authorId || null; commentPostId = d.postId || null; } } catch(_) {}
      const snap = await lRef.get();
      if (!snap.exists) {
        await db.runTransaction(async (tx)=>{
          tx.set(lRef, { createdAt: window.firebase.firestore.FieldValue.serverTimestamp() });
          tx.update(cRef, { 'counts.likes': window.firebase.firestore.FieldValue.increment(1) });
        });
        const span = btn.querySelector('span'); if (span) span.textContent = String((parseInt(span.textContent||'0')||0) + 1);
        btn.classList.add('liked');
        // notify comment author about like
        try {
          if (commentAuthorId && commentAuthorId !== uid){
            await db.collection('notifications').add({
              userId: commentAuthorId,
              actorId: uid,
              type: 'comment_like',
              postId: commentPostId || postId,
              commentId: commentId,
              createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
            });
          }
        } catch(_) {}
      } else {
        await db.runTransaction(async (tx)=>{
          tx.delete(lRef);
          tx.update(cRef, { 'counts.likes': window.firebase.firestore.FieldValue.increment(-1) });
        });
        const span = btn.querySelector('span'); if (span) span.textContent = String(Math.max(0,(parseInt(span.textContent||'0')||0) - 1));
        btn.classList.remove('liked');
        // remove like notification if exists
        try {
          if (commentAuthorId && commentAuthorId !== uid){
            const qs = await db.collection('notifications')
              .where('userId','==', commentAuthorId)
              .where('actorId','==', uid)
              .where('commentId','==', commentId)
              .where('type','==','comment_like')
              .get();
            qs.forEach(doc=>{ try { doc.ref.delete(); } catch(_) {} });
          }
        } catch(_) {}
      }
    } catch(_) {}
  }

  async function markInitialLike(){
    try {
      const btn = document.querySelector('.actions .like[data-like]');
      if (!btn || !db || !auth || !auth.currentUser) return;
      const uid = auth.currentUser.uid;
      const likeDoc = await db.collection('posts').doc(postId).collection('likes').doc(uid).get();
      if (likeDoc.exists) btn.classList.add('liked');
    } catch(_) {}
  }

  async function updateComposerProfile(){
    await hydrateReplyProfile();
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
      const isLocal = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:');
      const ul = document.getElementById('trending');
      if (ul) ul.innerHTML = enriched.map(p=>{
        const href = isLocal ? `/feed/post.html?id=${p.id}` : `/feed/post/${p.id}`;
        const text = (p.text || '').replace(/\n/g,' ').slice(0, 90);
        const rel = fmtRel(p.createdAt);
        const avatar = p.author?.photoURL ? `style=\"background-image:url('${p.author.photoURL}')\"` : '';
        const authorName = p.author?.displayName || '사용자';
        return `<li class=\"trending-item\"><a href=\"${href}\" class=\"trending-link\"><span class=\"trending-avatar\" ${avatar}></span><span class=\"trending-content\"><span class=\"trending-title\">${text}</span><span class=\"trending-meta\">${authorName} · ${rel}</span></span></a></li>`;
      }).join('');

      const likeByUser = new Map();
      arr.forEach(p=>{ const uid=p.authorId; const lk=p?.counts?.likes||0; likeByUser.set(uid,(likeByUser.get(uid)||0)+lk); });
      const topUsers = [...likeByUser.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3);
      const profiles = [];
      for (const [uid] of topUsers) {
        try { const doc = await db.collection('users').doc(uid).get(); const u = doc.exists ? doc.data() : { displayName: uid?.slice(0,6)+"…", photoURL: '' }; profiles.push({ uid, displayName: u.displayName || (uid?.slice(0,6)+"…"), photoURL: u.photoURL || '' }); } catch(_) { profiles.push({ uid, displayName: uid?.slice(0,6)+"…", photoURL: '' }); }
      }
      const ulA = document.getElementById('top-authors');
      if (ulA) ulA.innerHTML = profiles.map(p=>`<li style=\"display:flex;align-items:center;gap:10px;margin:16px 0;\"><span style=\"width:24px;height:24px;border-radius:999px;background:${p.photoURL?'transparent':'#e5e7eb'};background-image:${p.photoURL?`url('${p.photoURL}')`:'none'};background-size:cover;background-position:center;border:1px solid var(--border-color);\"></span><span>${p.displayName}</span></li>`).join('');
    } catch(_) {}
  }

  function bind(){
    document.addEventListener('click', (e)=>{
      const ddBtn = e.target.closest && e.target.closest('[data-dd-trigger="post"]');
      if (ddBtn){ const m = document.getElementById('dd-post'); if (m) m.style.display = (m.style.display==='block'?'none':'block'); return; }
      const ddC = e.target.closest && e.target.closest('[data-dd-c]');
      if (ddC){ const id = ddC.getAttribute('data-dd-c'); const m = document.getElementById(`dd-c-${id}`); if (m) m.style.display = (m.style.display==='block'?'none':'block'); return; }
      const ddR = e.target.closest && e.target.closest('[data-dd-r]');
      if (ddR){ const id = ddR.getAttribute('data-dd-r'); const m = document.getElementById(`dd-r-${id}`); if (m) m.style.display = (m.style.display==='block'?'none':'block'); return; }
      if (!e.target.closest('.dropdown')){ document.querySelectorAll('.dropdown-menu').forEach(el=> el.style.display='none'); }
      // navigate to profile from avatar/name
      const prof = e.target.closest && e.target.closest('[data-profile]');
      if (prof){ const uid = prof.getAttribute('data-profile'); const isLocal=(location.hostname==='localhost'||location.hostname==='127.0.0.1'||location.protocol==='file:'); window.location.href = isLocal?(`/feed/profile.html?uid=${uid}`):(`/feed/profile?uid=${uid}`); return; }
      if (e.target.id === 'reply-submit') {
        if (!window.currentUser && !(auth && auth.currentUser)) { const btn = document.querySelector('[data-action="open-login-modal"]'); if (btn) btn.click(); return; }
        createReply();
      }
      if (e.target && e.target.id === 'open-composer'){
        const isLocal=(location.hostname==='localhost'||location.hostname==='127.0.0.1'||location.protocol==='file:');
        if (!(auth && auth.currentUser)) { window.location.href = isLocal? '/login/index.html' : '/login'; return; }
        nav('/feed/write', '/feed/write.html');
        return;
      }
      if (e.target && e.target.id === 'post-edit'){ nav(`/feed/write?id=${postId}`, `/feed/write.html?id=${postId}`); return; }
      if (e.target && e.target.id === 'post-delete'){
        if (!confirm('삭제하시겠습니까?')) return;
        db.collection('posts').doc(postId).delete().then(()=>{ nav('/feed', '/feed/index.html'); });
        return;
      }
      const likeBtn = e.target.closest && e.target.closest('[data-like]');
      if (likeBtn) {
        if (!window.currentUser && !(auth && auth.currentUser)) { const btn = document.querySelector('[data-action="open-login-modal"]'); if (btn) btn.click(); return; }
        const pid = likeBtn.getAttribute('data-like');
        toggleLike(pid, likeBtn);
      }
      const cLikeBtn = e.target.closest && e.target.closest('[data-clike]');
      if (cLikeBtn) {
        if (!window.currentUser && !(auth && auth.currentUser)) { const btn = document.querySelector('[data-action="open-login-modal"]'); if (btn) btn.click(); return; }
        const cid = cLikeBtn.getAttribute('data-clike');
        toggleCommentLike(cid, cLikeBtn);
      }
      const delBtn = e.target.closest && e.target.closest('[data-del-cid]');
      if (delBtn) {
        const cid = delBtn.getAttribute('data-del-cid');
        if (confirm('댓글을 삭제하시겠습니까?')) {
          db.collection('comments').doc(cid).delete().then(loadComments);
        }
      }
      const editBtn = e.target.closest && e.target.closest('[data-edit-cid]');
      if (editBtn) {
        const cid = editBtn.getAttribute('data-edit-cid');
        const card = document.querySelector(`.comment[data-id="${cid}"]`) || document.querySelector(`.reply-item[data-id="${cid}"]`);
        if (!card) return;
        const textEl = card.querySelector('[data-role="c-text"]');
        const old = textEl?.textContent || '';
        const ta = document.createElement('textarea'); ta.style.width='100%'; ta.style.minHeight='80px'; ta.value = old; textEl.replaceWith(ta);
        const actions = card.querySelector('.actions') || card.appendChild(document.createElement('div'));
        if (!actions.classList.contains('actions')) { actions.className='actions'; }
        const save = document.createElement('button'); save.className='act'; save.textContent='저장';
        const cancel = document.createElement('button'); cancel.className='act'; cancel.textContent='취소';
        actions.appendChild(save); actions.appendChild(cancel);
        save.addEventListener('click', async()=>{
          await db.collection('comments').doc(cid).update({ text: ta.value.trim(), updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() });
          const div = document.createElement('div'); div.className='text'; div.setAttribute('data-role','c-text'); div.textContent = ta.value.trim();
          ta.replaceWith(div); save.remove(); cancel.remove();
        });
        cancel.addEventListener('click', ()=>{ const div=document.createElement('div'); div.className='text'; div.setAttribute('data-role','c-text'); div.textContent = old; ta.replaceWith(div); save.remove(); cancel.remove(); });
      }
      const replySubmit = e.target.closest && e.target.closest('[data-reply-submit]');
      if (replySubmit) {
        if (!window.currentUser && !(auth && auth.currentUser)) { const btn = document.querySelector('[data-action="open-login-modal"]'); if (btn) btn.click(); return; }
        const parentId = replySubmit.getAttribute('data-reply-submit');
        const input = document.querySelector(`[data-reply-input="${parentId}"]`);
        const val = input && input.value ? input.value.trim() : '';
        const filesArr = (window.__replyFiles__ && window.__replyFiles__[parentId]) || [];
        if (!val && filesArr.length===0) return;
        const now = window.firebase.firestore.FieldValue.serverTimestamp();
        (async()=>{
          const media = [];
          if (storage && filesArr.length) {
            const bucket = storage.ref();
            for (let i=0;i<filesArr.length;i++) {
              const f = filesArr[i];
              const path = `comments/${auth.currentUser.uid}/${Date.now()}_${i}_${f.name}`;
              const snap = await bucket.child(path).put(f);
              const url = await snap.ref.getDownloadURL();
              media.push({ type: f.type.startsWith('video')?'video':'image', url });
            }
          }
          const cRef = await db.collection('comments').add({ postId, parentId, authorId: auth.currentUser.uid, text: val, media, createdAt: now, counts:{likes:0,replies:0}, deleted:false });
          // notify parent comment author about reply
          try {
            const cd = await db.collection('comments').doc(parentId).get();
            const commentAuthorId = (cd.exists && cd.data() && cd.data().authorId) ? cd.data().authorId : null;
            if (commentAuthorId && commentAuthorId !== auth.currentUser.uid){
              await db.collection('notifications').add({ userId: commentAuthorId, actorId: auth.currentUser.uid, type: 'comment', postId, commentId: cRef.id, message: `답글: ${(val||'').slice(0,140)}`, createdAt: window.firebase.firestore.FieldValue.serverTimestamp() });
            }
          } catch(_) {}
          if (input) input.value='';
          if (window.__replyFiles__) delete window.__replyFiles__[parentId];
          fetchReplies(parentId);
        })();
      }
      const replyToggle = e.target.closest && e.target.closest('[data-reply-toggle]');
      if (replyToggle) {
        if (!(auth && auth.currentUser)) { const isLocal=(location.hostname==='localhost'||location.hostname==='127.0.0.1'||location.protocol==='file:'); window.location.href = isLocal? '/login/index.html' : '/login'; return; }
        const parentId = replyToggle.getAttribute('data-reply-toggle');
        const comp = document.querySelector(`.comment-composer.reply-bar [data-reply-input="${parentId}"]`)?.closest('.comment-composer.reply-bar');
        if (comp) { comp.style.display = (comp.style.display==='none'||!comp.style.display)?'flex':'none'; hydrateReplyBarsAvatar(); }
      }

      const replyAttach = e.target.closest && e.target.closest('[data-reply-attach]');
      if (replyAttach) {
        const pid = replyAttach.getAttribute('data-reply-attach');
        const input = document.querySelector(`[data-reply-media="${pid}"]`);
        if (input) input.click();
      }
    });

    document.addEventListener('change', (e)=>{
      const mediaInput = e.target && e.target.getAttribute && e.target.getAttribute('data-reply-media');
      if (mediaInput) {
        const pid = mediaInput;
        const el = e.target;
        const files = Array.from(el.files || []);
        window.__replyFiles__ = window.__replyFiles__ || {};
        (window.__replyFiles__[pid] = window.__replyFiles__[pid] || []).push(...files);
        el.value='';
      }
    });

    // removed emoji UI

    const comp = document.getElementById('reply-composer');
    if (comp) {
      if (auth && auth.currentUser) { comp.style.display = ''; }
      else { comp.style.display = 'none'; }
    }
    updateComposerProfile();
    if (window.firebase && window.firebase.auth) window.firebase.auth().onAuthStateChanged(()=>{ updateComposerProfile(); });

    const sortLikes = document.getElementById('comment-sort-likes');
    const sortLatest = document.getElementById('comment-sort-latest');
    if (sortLikes && sortLatest) {
      sortLikes.addEventListener('click', ()=>{ window.__commentSortLikes__ = true; sortLikes.classList.add('active'); sortLatest.classList.remove('active'); loadComments(); });
      sortLatest.addEventListener('click', ()=>{ window.__commentSortLikes__ = false; sortLatest.classList.add('active'); sortLikes.classList.remove('active'); loadComments(); });
    }

    // Enter to submit for main input
    const mainInput = document.getElementById('reply-text');
    if (mainInput) mainInput.addEventListener('keydown', (e)=>{ if (e.key==='Enter'){ e.preventDefault(); const btn=document.getElementById('reply-submit'); if(btn) btn.click(); } });

    // Delegate Enter submit for reply inputs
    document.addEventListener('keydown', (e)=>{
      const inp = e.target && e.target.getAttribute && e.target.getAttribute('data-reply-input');
      if (inp && e.key==='Enter') { e.preventDefault(); const b=document.querySelector(`[data-reply-submit="${inp}"]`); if (b) b.click(); }
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{ 
    bind(); 
    loadPost().then(()=>{ createIconsSafe(); }); 
    loadComments(); 
    loadSidebar(); 
    // 뒤로가기 버튼
    try {
      var back = document.getElementById('post-back');
      if (back){ back.addEventListener('click', function(){ if (history.length > 1) history.back(); else location.href = '/feed/'; }); }
    } catch(_){}
    // 모바일: 메인 댓글 입력창을 하단 스티키로 이동 (sidebar-nav 위)
    try {
      if (window.matchMedia('(max-width: 768px)').matches){
        var comp = document.getElementById('reply-composer');
        if (comp){
          document.body.appendChild(comp);
          comp.style.position = 'fixed';
          comp.style.left = '10px';
          comp.style.right = '10px';
          comp.style.bottom = 'calc(60px + env(safe-area-inset-bottom))';
          comp.style.zIndex = '45';
          comp.style.display = '';
          comp.style.background = 'var(--bg-color)';
        }
      }
    } catch(_) {}
  });
})();


