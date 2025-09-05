;(function(){
  const db = window.firebase && window.firebase.firestore ? window.firebase.firestore() : null;
  const auth = window.firebase && window.firebase.auth ? window.firebase.auth() : null;
  const storage = window.firebase && window.firebase.storage ? window.firebase.storage() : null;
  const postId = (window.__POST_ID_FROM_QS__) || location.pathname.split('/').pop();

  let commentsUnsub = null;

  function el(id){ return document.getElementById(id); }
  function fmtRel(ts){ try{ const d = ts?.toDate ? ts.toDate() : new Date(ts); const diff = Date.now()-d.getTime(); const s=Math.floor(diff/1000), m=Math.floor(s/60), h=Math.floor(m/60), day=Math.floor(h/24); if (day>=1) return `${day}일 전`; if (h>=1) return `${h}시간 전`; if (m>=1) return `${m}분 전`; return '방금 전'; }catch(_){ return ''; } }
  function html(s){ return s.replace(/</g,'&lt;'); }

  async function loadPost(){
    if (!db || !postId) return;
    const doc = await db.collection('posts').doc(postId).get();
    if (!doc.exists) { el('post').innerHTML = '<div style="padding:24px;">게시글을 찾을 수 없습니다.</div>'; return; }
    const p = { id: doc.id, ...doc.data() };
    let author = { displayName: '사용자', photoURL: '' };
    try { const u = await db.collection('users').doc(p.authorId).get(); if (u.exists) author = u.data(); } catch(_) {}
    const canDelete = (window.currentUser && (window.currentUser.uid === p.authorId));
    el('post').innerHTML = `
      <div class="avatar" style="${author.photoURL?`background-image:url('${author.photoURL}')`:''}"></div>
      <div>
        <div class="meta"><b>${(author.displayName)||'사용자'}</b><span>·</span><span>${fmtRel(p.createdAt)}</span>${canDelete?`<span style=\"margin-left:auto;display:flex;gap:6px;\"><button class=\"act edit\" id=\"post-edit\">수정</button><button class=\"act delete\" id=\"post-delete\">삭제</button></span>`:''}</div>
        <div class="text">${html(p.text||'')}</div>
        ${(Array.isArray(p.media)&&p.media.length)?`<div class="media">${p.media.map(m=>`<img src="${m.url}"/>`).join('')}</div>`:''}
        <div class="actions">
          <button class="act like" data-like="${p.id}"><i data-lucide="heart"></i><span>${p.counts?.likes||0}</span></button>
          <button class="act reply"><i data-lucide="message-circle-more"></i><span>${p.counts?.replies||0}</span></button>
          <button class="act share"><i data-lucide="share"></i></button>
        </div>
      </div>`;
    try { window.lucide && window.lucide.createIcons(); } catch(_) {}
    markInitialLike();
  }

  async function loadComments(){
    if (!db || !postId) return;
    if (commentsUnsub) { try { commentsUnsub(); } catch(_) {} commentsUnsub = null; }
    const q = db.collection('comments').where('postId','==',postId).where('parentId','==',null).orderBy('createdAt','asc');
    commentsUnsub = q.onSnapshot(async (snap)=>{
      const cont = el('comments');
      cont.innerHTML = '';
      const rows = [];
      for (const doc of snap.docs){
        const c = { id: doc.id, ...doc.data() };
        let u = { displayName: '사용자', photoURL: '' };
        try { const ud = await db.collection('users').doc(c.authorId).get(); if (ud.exists) u = ud.data(); } catch(_) {}
        const canEdit = window.currentUser && window.currentUser.uid === c.authorId;
        rows.push(renderComment(c, u, canEdit));
      }
      cont.insertAdjacentHTML('beforeend', rows.join(''));
      try { window.lucide && window.lucide.createIcons(); } catch(_) {}
      const count = snap.size;
      const elBtn = document.querySelector('#post .actions .reply span') || document.querySelector('.actions .reply span');
      if (elBtn) elBtn.textContent = String(count);
    });
  }

  function renderComment(c, u, canEdit){
    return `<article class="card comment" data-id="${c.id}">
      <div class="avatar" style="${u.photoURL?`background-image:url('${u.photoURL}')`:''}"></div>
      <div>
        <div class="meta"><b>${u.displayName||'사용자'}</b><span>·</span><span>${fmtRel(c.createdAt)}</span>${canEdit?`<span style=\"margin-left:auto;display:flex;gap:6px;\"><button class=\"act\" data-edit-cid=\"${c.id}\">수정</button><button class=\"act\" data-del-cid=\"${c.id}\">삭제</button></span>`:''}</div>
        <div class="text" data-role="c-text">${html(c.text||'')}</div>
        <div class="actions">
          <button class="act like" data-clike="${c.id}"><i data-lucide="heart"></i><span>${c.counts?.likes||0}</span></button>
        </div>
      </div>
    </article>`;
  }

  async function createReply(){
    if (!db || !auth || !auth.currentUser) return;
    const text = el('reply-text').value.trim();
    if (!text) return;
    const now = window.firebase.firestore.FieldValue.serverTimestamp();
    const input = el('reply-media');
    const files = [...(window.__replyPastedFiles__||[]), ...((input && input.files) ? Array.from(input.files) : [])];
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
    await db.collection('comments').add({ postId, parentId: null, authorId: auth.currentUser.uid, text, media, createdAt: now, counts:{likes:0,replies:0}, deleted:false });
    el('reply-text').value = '';
    if (input) input.value = '';
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
    const comp = document.getElementById('reply-composer');
    if (!comp) return;
    try {
      let photo = '';
      // 1) auth.currentUser 우선 확인
      if (auth && auth.currentUser && auth.currentUser.photoURL) photo = auth.currentUser.photoURL;
      // 2) window.currentUser
      if (!photo && window.currentUser && window.currentUser.photoURL) photo = window.currentUser.photoURL;
      // 3) users 컬렉션 보강
      if (!photo && db && (auth?.currentUser?.uid || window.currentUser?.uid)) {
        const uid = auth?.currentUser?.uid || window.currentUser?.uid;
        const ud = await db.collection('users').doc(uid).get();
        if (ud.exists) {
          const u = ud.data();
          photo = u.photoURL || u.photoUrl || u.avatar || u.avatarUrl || u.profileImage || u.profilePhoto || '';
        }
      }
      const ta = document.getElementById('reply-text');
      if (ta) ta.placeholder = '메세지를 입력해주세요';
      const av = comp.querySelector('.avatar');
      if (av && photo) {
        av.style.backgroundImage = `url('${photo}')`;
        av.style.backgroundSize = 'cover';
        av.style.backgroundPosition = 'center';
      }
    } catch(_) {}
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
      if (e.target.id === 'reply-submit') {
        if (!window.currentUser && !(auth && auth.currentUser)) { const btn = document.querySelector('[data-action="open-login-modal"]'); if (btn) btn.click(); return; }
        createReply();
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
        const card = document.querySelector(`.comment[data-id="${cid}"]`);
        if (!card) return;
        const textEl = card.querySelector('[data-role="c-text"]');
        const old = textEl?.textContent || '';
        const ta = document.createElement('textarea'); ta.style.width='100%'; ta.style.minHeight='80px'; ta.value = old; textEl.replaceWith(ta);
        const actions = card.querySelector('.actions');
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
    });
    const comp = document.getElementById('reply-composer');
    if (comp) comp.style.display = '';
    updateComposerProfile();
    const attach = document.getElementById('reply-attach');
    const input = document.getElementById('reply-media');
    if (attach && input) attach.addEventListener('click', ()=> input.click());
    document.addEventListener('paste', (e)=>{
      const items = (e.clipboardData && e.clipboardData.items) || [];
      for (const it of items) {
        const f = it.getAsFile && it.getAsFile();
        if (f && f.type && f.type.startsWith('image')) {
          (window.__replyPastedFiles__ = window.__replyPastedFiles__ || []).push(f);
        }
      }
    });
    if (window.firebase && window.firebase.auth) window.firebase.auth().onAuthStateChanged(()=>{ if (comp) comp.style.display = ''; markInitialLike(); updateComposerProfile(); });
  }

  document.addEventListener('DOMContentLoaded', ()=>{ bind(); loadPost().then(()=>{ try { window.lucide && window.lucide.createIcons(); } catch(_) {} }); loadComments(); loadSidebar(); });
})();


