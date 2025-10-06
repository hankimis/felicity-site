;(function(){
  const db = window.firebase && window.firebase.firestore ? window.firebase.firestore() : null;
  const auth = window.firebase && window.firebase.auth ? window.firebase.auth() : null;

  function el(id){ return document.getElementById(id); }
  const isLocal = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:');
  const nav = (pretty, raw) => { window.location.href = isLocal ? raw : pretty; };

  function itemHtml(n){
    const actorName = n.actor?.displayName || '사용자';
    const actorPhoto = n.actor?.photoURL || '';
    let typeText = '활동이 있습니다';
    if (n.type === 'like') typeText = '게시글을 좋아합니다';
    if (n.type === 'comment') typeText = '댓글을 남겼습니다';
    if (n.type === 'comment_like') typeText = '댓글을 좋아합니다';
    if (n.type === 'follow') typeText = '회원님을 팔로우했습니다';
    const link = n.postId ? (isLocal ? `/feed/post.html?id=${n.postId}` : `/feed/post/${n.postId}`) : '#';
    // for comment, render quoted text
    const commentText = (n.type==='comment' && n.message) ? String(n.message).replace(/^\s*(댓글|답글)\s*:\s*/, '').trim() : '';
    const htmlText = (n.type==='comment' && commentText)
      ? (actorName + '님이 "' + commentText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;') + '"라고 댓글을 남겼습니다')
      : (n.message || (actorName + '님이 '+ typeText));
    return '<article class="card" data-id="'+(n.id||'')+'">\
      <div class="avatar" style="'+(actorPhoto?('background-image:url(\''+actorPhoto+'\')'):'')+'" data-profile="'+(n.actorId||'')+'"></div>\
      <div>\
        <div class="meta" style="display:flex;align-items:center;gap:8px;">\
          <b data-profile="'+(n.actorId||'')+'" style="cursor:pointer">'+actorName+'</b>\
          <span>·</span>\
          <span>'+(n.createdAt && n.createdAt.toDate ? timeRel(n.createdAt) : '')+'</span>\
        </div>\
        <div class="text">'+ htmlText +'</div>\
        '+(n.postId?('<div class="actions"><button class="act" data-open-post="'+n.postId+'">열기</button></div>'):'')+'\
      </div>\
    </article>';
  }

  function timeRel(ts){
    try { const d = ts?.toDate ? ts.toDate() : new Date(ts); const diff=Date.now()-d.getTime(); const s=Math.floor(diff/1000), m=Math.floor(s/60), h=Math.floor(m/60), day=Math.floor(h/24); if(day>=1) return day+'일 전'; if(h>=1) return h+'시간 전'; if(m>=1) return m+'분 전'; return '방금 전'; } catch(_) { return ''; }
  }

  async function loadNotifications(){
    if (!db || !auth || !auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const q = db.collection('notifications').where('userId','==',uid).orderBy('createdAt','desc').limit(50);
    const snap = await q.get();
    const items = [];
    for (const d of snap.docs){
      const n = { id:d.id, ...d.data() };
      let actor = {};
      try { if (n.actorId) { const u = await db.collection('users').doc(n.actorId).get(); if (u.exists) actor = u.data(); } } catch(_) {}
      items.push({ ...n, actor });
    }
    const list = el('notification-list');
    if (list) list.innerHTML = items.map(itemHtml).join('');
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
        const rel = timeRel(p.createdAt);
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

  document.addEventListener('click', function(e){
    const btn = e.target.closest && e.target.closest('[data-open-post]');
    if (btn){ const pid = btn.getAttribute('data-open-post'); nav('/feed/post/'+pid, '/feed/post.html?id='+pid); return; }
    const prof = e.target.closest && e.target.closest('[data-profile]');
    if (prof){ const uid = prof.getAttribute('data-profile'); nav('/feed/profile?uid='+uid, '/feed/profile.html?uid='+uid); return; }
  });

  document.addEventListener('DOMContentLoaded', function(){ loadNotifications(); loadSidebar(); });
  if (auth && auth.onAuthStateChanged) auth.onAuthStateChanged(function(){ loadNotifications(); loadSidebar(); });
})();


