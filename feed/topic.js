;(function(){
  const db = window.firebase && window.firebase.firestore ? window.firebase.firestore() : null;
  const slug = decodeURIComponent(location.pathname.split('/').pop()||'');
  function el(id){ return document.getElementById(id); }
  function fmtTime(ts){ try{ const d = ts?.toDate ? ts.toDate() : new Date(ts); return new Intl.DateTimeFormat('ko-KR',{dateStyle:'short', timeStyle:'short'}).format(d); }catch(_){ return '' } }
  function isLocal(){ return (location.hostname==='localhost' || location.hostname==='127.0.0.1' || location.protocol==='file:'); }
  function toPost(id){ window.location.href = isLocal() ? `/feed/post.html?id=${id}` : `/feed/post/${id}`; }

  function card(p){
    return `<article class="card" data-id="${p.id}"><div class="avatar"></div><div><div class="meta"><b>${p.author?.displayName||'사용자'}</b><span>·</span><span>${fmtTime(p.createdAt)}</span></div><div class="text">${(p.text||'').replace(/</g,'&lt;')}</div></div></article>`;
  }

  async function load(){
    const title = el('topic-title'); if (title) title.textContent = `#${slug}`;
    if (!db || !slug) return;
    const q = db.collection('posts').where('topics','array-contains', slug).orderBy('createdAt','desc').limit(30);
    const s = await q.get();
    const list = el('feed-list'); if (list) list.innerHTML = s.docs.map(d=>card({ id:d.id, ...d.data() })).join('');
    document.addEventListener('click', (e)=>{
      const a = e.target.closest && e.target.closest('.card');
      if (a) { const id=a.getAttribute('data-id'); toPost(id); }
    });
  }
  document.addEventListener('DOMContentLoaded', load);
})();


