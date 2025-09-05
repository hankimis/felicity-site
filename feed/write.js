;(function(){
  const db = window.firebase && window.firebase.firestore ? window.firebase.firestore() : null;
  const auth = window.firebase && window.firebase.auth ? window.firebase.auth() : null;
  const storage = window.firebase && window.firebase.storage ? window.firebase.storage() : null;
  function el(id){ return document.getElementById(id); }

  let editId = null; let loadedPost = null;

  function getQueryId(){ try{ const p = new URLSearchParams(location.search); return p.get('id') || null; }catch(_){ return null; } }

  function guard(){
    const isAuthed = !!(window.currentUser || (auth && auth.currentUser));
    if (!isAuthed) {
      const btn = document.querySelector('[data-action="open-login-modal"]');
      if (btn) btn.click();
      return false;
    }
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
    if (!text) return;
    const now = window.firebase.firestore.FieldValue.serverTimestamp();
    const pasted = (window.__pastedFiles__ || []);
    const files = [...(el('post-media').files || []), ...pasted];
    const media = [];
    if (storage && files.length) {
      const bucket = storage.ref();
      for (let i=0;i<files.length;i++) {
        const f = files[i];
        const path = `posts/${(auth.currentUser && auth.currentUser.uid) || (window.currentUser && window.currentUser.uid)}/${Date.now()}_${i}_${f.name}`;
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
      const isLocal = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:');
      window.location.href = isLocal ? `/feed/post.html?id=${effectiveEditId}` : `/feed/post/${effectiveEditId}`;
      return;
    }
    // create new
    const uid = (auth.currentUser && auth.currentUser.uid) || (window.currentUser && window.currentUser.uid);
    const post = { authorId: uid, text, media, topics: [], symbols: [], createdAt: now, updatedAt: now, visibility:'public', counts:{likes:0,replies:0,reposts:0,bookmarks:0} };
    const doc = await db.collection('posts').add(post);
    const isLocal = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:');
    window.location.href = isLocal ? `/feed/post.html?id=${doc.id}` : `/feed/post/${doc.id}`;
  }

  function bind(){
    const form = el('write-form');
    form.addEventListener('submit', submit);
    el('btn-cancel').addEventListener('click', ()=>{ history.back(); });
    const mediaInput = el('post-media');
    const previews = el('media-previews');
    if (mediaInput && previews) {
      mediaInput.addEventListener('change', ()=>{
        previews.innerHTML = '';
        const files = mediaInput.files || [];
        Array.from(files).forEach(f => {
          const url = URL.createObjectURL(f);
          const img = document.createElement('img'); img.src = url; img.style.maxHeight='160px'; img.style.objectFit='cover';
          previews.appendChild(img);
        });
      });
    }
    document.addEventListener('paste', async (e) => {
      if (!storage || !auth || !(auth.currentUser || window.currentUser)) return;
      const items = (e.clipboardData && e.clipboardData.items) || [];
      for (const it of items) {
        const file = it.getAsFile && it.getAsFile();
        if (!file || !file.type.startsWith('image')) continue;
        const url = URL.createObjectURL(file);
        const img = document.createElement('img'); img.src = url; img.style.maxHeight='160px'; img.style.objectFit='cover';
        previews && previews.appendChild(img);
        (window.__pastedFiles__ = window.__pastedFiles__ || []).push(file);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{ bind(); loadForEdit(); });
})();


