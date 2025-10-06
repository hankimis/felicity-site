;(function(){
  const db = window.firebase && window.firebase.firestore ? window.firebase.firestore() : null;
  const auth = window.firebase && window.firebase.auth ? window.firebase.auth() : null;
  const storage = window.firebase && window.firebase.storage ? window.firebase.storage() : null;
  function el(id){ return document.getElementById(id); }
  function createIconsSafe(){ try { window.lucide && window.lucide.createIcons(); } catch(_) {} }

  let editId = null; let loadedPost = null;
  let selectedFiles = [];

  function getQueryId(){ try{ const p = new URLSearchParams(location.search||''); return p.get('id') || null; }catch(_){ return null; } }
  function isLocal(){ return (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:'); }
  function redirectToPost(id){ window.location.href = isLocal() ? `/feed/post.html?id=${id}` : `/feed/post/${id}`; }

  function guard(){
    const isAuthed = !!(window.currentUser || (auth && auth.currentUser));
    if (!isAuthed) { const btn = document.querySelector('[data-action="open-login-modal"]'); if (btn) btn.click(); return false; }
    return true;
  }

  async function loadForEdit(){
    if (!db) return;
    editId = getQueryId();
    if (!editId) return;
    const form = el('write-form'); if (form) form.dataset.editId = editId;
    const doc = await db.collection('posts').doc(editId).get();
    if (!doc.exists) return;
    loadedPost = { id: doc.id, ...doc.data() };
    const textEl = el('post-text'); if (textEl) textEl.value = loadedPost.text || '';
    const previews = el('media-previews');
    if (previews && Array.isArray(loadedPost.media)) {
      previews.innerHTML = '';
      loadedPost.media.slice(0,4).forEach(m=>{ const img=document.createElement('img'); img.src=m.url; img.style.maxHeight='160px'; img.style.objectFit='cover'; previews.appendChild(img); });
    }
    const submitBtn = el('btn-submit'); if (submitBtn) submitBtn.textContent = '수정하기';
  }

  async function submit(e){
    e.preventDefault(); if (!db || !auth) return; if (!guard()) return;
    const formEl = (e.currentTarget || e.target);
    const textEl = (formEl && formEl.querySelector) ? formEl.querySelector('#post-text') : el('post-text');
    if (!textEl) { console.warn('post-text not found'); return; }
    const text = textEl.value.trim();
    if (!text && selectedFiles.length===0) return;
    const now = window.firebase.firestore.FieldValue.serverTimestamp();
    const files = selectedFiles.slice();
    const media = [];
    if (storage && files.length) {
      const bucket = storage.ref();
      for (let i=0;i<files.length;i++) {
        const f = files[i];
        const uid = (auth.currentUser && auth.currentUser.uid) || (window.currentUser && window.currentUser.uid) || 'anon';
        const path = `posts/${uid}/${Date.now()}_${i}_${f.name}`;
        const snap = await bucket.child(path).put(f);
        const url = await snap.ref.getDownloadURL();
        media.push({ type: f.type.startsWith('video')?'video':'image', url });
      }
    }
    const effectiveEditId = (formEl && formEl.dataset && formEl.dataset.editId) ? formEl.dataset.editId : editId;
    if (effectiveEditId) {
      const patch = { text, updatedAt: now };
      if (media.length) patch.media = (loadedPost && Array.isArray(loadedPost.media) ? [...loadedPost.media, ...media] : media);
      await db.collection('posts').doc(effectiveEditId).update(patch);
      redirectToPost(effectiveEditId);
      return;
    }
    const uid = (auth.currentUser && auth.currentUser.uid) || (window.currentUser && window.currentUser.uid);
    const post = { authorId: uid, text, media, topics: [], symbols: [], createdAt: now, updatedAt: now, visibility:'public', counts:{likes:0,replies:0,reposts:0,bookmarks:0} };
    const doc = await db.collection('posts').add(post);
    redirectToPost(doc.id);
  }

  function renderPreviews(files){
    const previews = el('media-previews'); if (!previews) return;
    previews.innerHTML = '';
    files.forEach((f, idx)=>{
      const url = URL.createObjectURL(f);
      const wrap = document.createElement('div');
      wrap.style.position='relative';
      const img = document.createElement('img'); img.src = url; img.style.maxHeight='160px'; img.style.objectFit='cover'; img.style.borderRadius='12px';
      const rm = document.createElement('button'); rm.type='button'; rm.textContent='×'; rm.setAttribute('data-remove-file', String(idx)); rm.style.position='absolute'; rm.style.right='6px'; rm.style.top='6px'; rm.style.width='24px'; rm.style.height='24px'; rm.style.border='1px solid var(--border-color)'; rm.style.borderRadius='999px'; rm.style.background='var(--card-bg)'; rm.style.cursor='pointer';
      wrap.appendChild(img); wrap.appendChild(rm); previews.appendChild(wrap);
    });
    createIconsSafe();
  }

  function hydrateProfile(){
    const av = el('composer-avatar');
    const name = el('composer-username');
    (async ()=>{
      try {
        const uid = (auth && auth.currentUser && auth.currentUser.uid) || (window.currentUser && window.currentUser.uid) || null;
        let display = '';
        let photo = '';
        if (uid && db) {
          const doc = await db.collection('users').doc(uid).get();
          if (doc.exists) {
            const u = doc.data() || {};
            display = u.displayName || u.nickname || u.name || u.userName || u.username || '';
            photo = u.photoURL || u.photoUrl || u.avatar || u.avatarUrl || u.profileImage || u.profilePhoto || '';
          }
        }
        if (!display) {
          const email = (auth && auth.currentUser && auth.currentUser.email) || (window.currentUser && window.currentUser.email) || '';
          display = email ? email.split('@')[0] : '사용자';
        }
        if (av) {
          if (photo) {
            av.style.backgroundImage = `url('${photo}')`;
            av.style.backgroundSize = 'cover';
            av.style.backgroundPosition = 'center';
          } else {
            av.style.backgroundImage = '';
          }
        }
        if (name) name.textContent = display;
      } catch(_) {}
    })();
  }

  function bind(){
    const form = el('write-form'); if (form) form.addEventListener('submit', submit);
    const cancel = el('btn-cancel'); if (cancel) cancel.addEventListener('click', ()=>{ history.back(); });
    const mediaInput = el('post-media');
    const attach = document.getElementById('action-attach');
    if (attach && mediaInput) attach.addEventListener('click', ()=> mediaInput.click());
    if (mediaInput) mediaInput.addEventListener('change', ()=>{ const files = Array.from(mediaInput.files || []); if (files.length){ selectedFiles.push(...files); mediaInput.value=''; renderPreviews(selectedFiles); } });

    // Remove file handler
    document.addEventListener('click', (e)=>{
      const btn = e.target.closest && e.target.closest('[data-remove-file]');
      if (btn) { const idx = parseInt(btn.getAttribute('data-remove-file')||'-1',10); if (!isNaN(idx)) { selectedFiles.splice(idx,1); renderPreviews(selectedFiles); } }
    });

    if (window.firebase && window.firebase.auth) window.firebase.auth().onAuthStateChanged(()=>{ hydrateProfile(); });
    hydrateProfile();
    createIconsSafe();
  }

  document.addEventListener('DOMContentLoaded', ()=>{ bind(); loadForEdit(); createIconsSafe(); });
})();


