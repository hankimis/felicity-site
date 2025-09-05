;(function(){
  const db = window.firebase && window.firebase.firestore ? window.firebase.firestore() : null;
  const slug = decodeURIComponent(location.pathname.split('/').pop()||'');
  function el(id){ return document.getElementById(id); }
  function fmtTime(ts){ try{ const d = ts?.toDate ? ts.toDate() : new Date(ts); return new Intl.DateTimeFormat('ko-KR',{dateStyle:'short', timeStyle:'short'}).format(d); }catch(_){ return '' } }

  function card(p){
    return `<article class="card" data-id="${p.id}"><div class="avatar"></div><div><div class="meta"><b>${p.author?.displayName||'사용자'}</b><span>·</span><span>${fmtTime(p.createdAt)}</span></div><div class="text">${(p.text||'').replace(/</g,'&lt;')}</div></div></article>`;
  }

  async function load(){
    el('topic-title').textContent = `#${slug}`;
    if (!db || !slug) return;
    const q = db.collection('posts').where('topics','array-contains', slug).orderBy('createdAt','desc').limit(30);
    const s = await q.get();
    el('feed-list').innerHTML = s.docs.map(d=>card({ id:d.id, ...d.data() })).join('');
    document.addEventListener('click', (e)=>{
      const a = e.target.closest('.card');
      if (a) { const id=a.getAttribute('data-id'); window.location.href = `/feed/post/${id}`; }
    });
  }
  document.addEventListener('DOMContentLoaded', load);
})();


