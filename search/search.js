;(function(){
  const db = window.firebase && window.firebase.firestore ? window.firebase.firestore() : null;
  const auth = window.firebase && window.firebase.auth ? window.firebase.auth() : null;
  const isLocal = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:');
  function el(id){ return document.getElementById(id); }

  function setActive(pane){
    document.querySelectorAll('#search-tabs .tab').forEach(b=> b.classList.remove('active'));
    document.querySelectorAll('.pane').forEach(p=> p.style.display='none');
    const btn = document.querySelector(`#search-tabs .tab[data-pane="${pane}"]`);
    const sec = el(`pane-${pane}`);
    if (btn) btn.classList.add('active');
    if (sec) sec.style.display='block';
  }

  function openPageUrl(q, pane){
    const enc = encodeURIComponent(q);
    const p = (pane==='news'||pane==='community'||pane==='users')?pane:'news';
    const url = `/search/?q=${enc}&pane=${p}`;
    const raw = `/search/index.html?q=${enc}&pane=${p}`;
    window.location.href = isLocal ? raw : url;
  }

function escapeRegExp(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function highlight(text, kw){ if(!kw) return String(text||''); try{ const re=new RegExp('('+escapeRegExp(kw)+')','ig'); return String(text||'').replace(re,'<span class="kw">$1</span>'); }catch(_){ return String(text||''); } }

function buildNewsItem(n, kw){
    const rel = (function(ts){ try{ const d = new Date(ts); const diff=Date.now()-d.getTime(); const m=Math.floor(diff/60000), h=Math.floor(m/60), day=Math.floor(h/24); if(day>=1) return day+'일 전'; if(h>=1) return h+'시간 전'; if(m>=1) return m+'분 전'; return '방금 전'; }catch(_){ return ''; } })(n.pubDate);
    const src = n.source || '';
    const img = n.image || '';
    const isDefault = /\/img\/default-news\.jpg$/i.test(String(img));
    const hasImg = !!(img && /^(https?:)?\//.test(img) && !isDefault);
    const href = (n.link||'').replace(/"/g,'&quot;');
  return `<article class="card news-card" data-href="${href}" style="display:grid;grid-template-columns:${hasImg?'1fr 120px':'1fr'}; gap:12px; padding:12px 0; border-bottom:1px solid var(--border-color);">
      <div>
        <div style="display:flex;gap:8px;color:var(--text-color-secondary);font-size:12px;"><span>${src}</span><span>·</span><span>${rel}</span></div>
        <div style="color:var(--text-color);font-weight:700;margin:4px 0;">${highlight(n.title, kw)}</div>
        <div style="color:var(--text-color-secondary)">${highlight(n.contentSnippet||'', kw)}</div>
      </div>
      ${hasImg?`<div class="news-thumb" style="display:flex;align-items:center;justify-content:flex-end;"><img src="${img}" alt="" style="width:120px;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--border-color)" loading="lazy" onerror="var a=this.closest('article'); if(a){ a.style.gridTemplateColumns='1fr'; } this.parentNode.remove();"/></div>`:''}
    </article>`;
  }

  async function loadNewsByKeyword(q){
    try {
      const cached = JSON.parse(localStorage.getItem('newsFeedsCache')||'{}');
      const data = Array.isArray(cached.data)? cached.data : [];
      const kw = q.toLowerCase();
      const items = data.filter(n=> (n.title||'').toLowerCase().includes(kw) || (n.contentSnippet||'').toLowerCase().includes(kw)).slice(0,50);
      const list = el('news-results'); if (list) list.innerHTML = items.map(n=> buildNewsItem(n, q)).join('') || '<div style="padding:16px;color:var(--text-color-secondary)">관련 뉴스가 없습니다.</div>';
      // no all tab
    } catch(_) {}
  }

function cardHtml(p, kw){
    const author = p.author || { displayName: '사용자', photoURL: '' };
    const authorName = author.displayName || '사용자';
    const avatar = author.photoURL ? `style="background-image:url('${author.photoURL}')"` : '';
    const rel = (function(ts){ try{ const d=ts?.toDate?ts.toDate():new Date(ts); const diff=Date.now()-d.getTime(); const s=Math.floor(diff/1000),m=Math.floor(s/60),h=Math.floor(m/60),day=Math.floor(h/24); if(day>=1) return day+'일 전'; if(h>=1) return h+'시간 전'; if(m>=1) return m+'분 전'; return '방금 전'; }catch(_){ return ''; } })(p.createdAt);
    const firstMedia = (Array.isArray(p.media) && p.media.length && p.media[0] && (p.media[0].url||p.media[0].src)) ? (p.media[0].url||p.media[0].src) : '';
    const hasMedia = /^https?:\/\//i.test(String(firstMedia));
  const safeText = String(p.text||'').replace(/</g,'&lt;');
  const short = (function(t){ t=String(t||''); return t.length>160 ? t.slice(0,159)+'…' : t; })(safeText);
  const hiText = highlight(short, kw);
  return `<article class="card post-card" data-post="${p.id}">
      <div class="avatar" ${avatar}></div>
      <div>
        <div class="meta" style="display:flex;align-items:center;gap:8px;"><b>${authorName}</b><span>·</span><span>${rel}</span></div>
        <div class="content-row ${hasMedia?'has-img':''}">
          <div class="content-text"><div class="text">${hiText}</div></div>
          ${hasMedia?`<div class=\"c-thumb\"><img src=\"${firstMedia}\" alt=\"\" width=\"120\" height=\"80\" loading=\"lazy\" onerror=\"this.parentNode.style.display='none'\"></div>`:''}
        </div>
      </div>
    </article>`;
  }

  async function loadCommunityByKeyword(q){
    if (!db) return;
    try {
      const snap = await db.collection('posts').where('visibility','==','public').orderBy('createdAt','desc').limit(200).get();
      let items = snap.docs.map(d=>({ id:d.id, ...d.data() }));
      const kw = q.toLowerCase();
      items = items.filter(p=> String(p.text||'').toLowerCase().includes(kw));
      // enrich authors
      const authorIds = Array.from(new Set(items.map(p=>p.authorId).filter(Boolean)));
      const authorMap = new Map();
      for (const uid of authorIds){
        try { const u = await db.collection('users').doc(uid).get(); authorMap.set(uid, u.exists?u.data():{}); } catch(_) { authorMap.set(uid,{}); }
      }
      items = items.map(p=> ({...p, author: authorMap.get(p.authorId)||{} }));
      const list = el('community-results'); if (list) list.innerHTML = items.map(p=> cardHtml(p, q)).join('') || '<div style="padding:16px;color:var(--text-color-secondary)">검색 결과가 없습니다.</div>';
      // no all tab
    } catch(_) {}
  }

  function userRow(u){
    const photo = u.photoURL ? `style="background-image:url('${u.photoURL}')"` : '';
    const name = u.displayName || (u.email ? u.email.split('@')[0] : '사용자');
    const bio = u.bio || u.intro || '';
    return `<div class="user-item" data-uid="${u.uid||''}">
      <div class="avatar" ${photo}></div>
      <div class="meta"><div class="name">${name}</div><div class="bio">${String(bio).replace(/</g,'&lt;')}</div></div>
      <div><button class="follow-btn" data-follow="${u.uid||''}">프로필 방문</button></div>
    </div>`;
  }

  async function loadUsersByKeyword(q){
    if (!db) return;
    try {
      const snap = await db.collection('users').limit(200).get();
      const all = snap.docs.map(d=> ({ uid:d.id, ...d.data() }));
      const kw = (q||'').toLowerCase();
      const users = all.filter(u=>{
        if (!kw) return false;
        const name = String(u.displayName || (u.email ? u.email.split('@')[0] : '')).toLowerCase();
        const bio = String(u.bio || u.intro || '').toLowerCase();
        return name.includes(kw) || bio.includes(kw);
      }).slice(0, 50);
      const listEl = el('user-results'); if (listEl) listEl.innerHTML = users.map(userRow).join('') || '<div style="padding:16px;color:var(--text-color-secondary)">일치하는 유저가 없습니다.</div>';
      // no all tab
    } catch(_) {}
  }

  // build suggestion list from real data (news cache + recent posts keywords)
  async function buildSuggestions(base){
    const list = el('suggest-list'); if (!list) return;
    const kw = (base||'').toLowerCase();
    const items = [];
    try {
      const cached = JSON.parse(localStorage.getItem('newsFeedsCache')||'{}');
      const data = Array.isArray(cached.data)? cached.data : [];
      data.slice(0,80).forEach(n=>{ const t=(n.title||'').trim(); if (t && (!kw || t.toLowerCase().includes(kw))) items.push({ type:'news', text:t }); });
    } catch(_) {}
    try {
      if (db){
        const snap = await db.collection('posts').orderBy('createdAt','desc').limit(120).get();
        snap.docs.forEach(d=>{
          const t = String(d.data()?.text||'');
          const words = t.split(/\s+/).filter(w=> w.length>=2 && w.length<=18);
          words.slice(0,8).forEach(w=>{ if (!kw || w.toLowerCase().includes(kw)) items.push({ type:'post', text:w }); });
        });
      }
    } catch(_) {}
    const uniq = [];
    const seen = new Set();
    for (const it of items){ const k=it.text.toLowerCase(); if (!seen.has(k)){ seen.add(k); uniq.push(it); } if (uniq.length>=10) break; }
    list.innerHTML = uniq.map(it=> `<div class="suggest-item" data-kw="${it.text.replace(/"/g,'&quot;')}"><div class="left"><i data-lucide="search"></i><span>${highlight(it.text, base)}</span></div><i data-lucide="corner-up-right"></i></div>`).join('') || '<div class="suggest-item" style="color:var(--text-color-secondary)">추천어가 없습니다</div>';
    try { window.lucide && window.lucide.createIcons(); } catch(_) {}
  }

  function bind(){
    const input = el('global-search-input');
    const btn = el('global-search-btn');
    const tabs = document.getElementById('search-tabs');
    const layer = document.getElementById('search-layer');
    const doSearch = ()=>{
      const q = (input?.value||'').trim();
      if (!q) return;
      tabs && (tabs.style.display='flex');
      setActive('news');
      loadNewsByKeyword(q);
      loadCommunityByKeyword(q);
      loadUsersByKeyword(q);
      if (layer) layer.style.display='none';
      try { history.replaceState(null,'', isLocal? `/search/index.html?q=${encodeURIComponent(q)}&pane=news` : `/search/?q=${encodeURIComponent(q)}&pane=news`); } catch(_) {}
    };
    if (btn) btn.addEventListener('click', doSearch);
    const trigger = document.getElementById('search-trigger');
    if (trigger) {
      trigger.addEventListener('click', doSearch);
      trigger.addEventListener('keydown', (e)=>{ if (e.key==='Enter' || e.key===' ') { e.preventDefault(); doSearch(); } });
    }
    if (input) {
      input.addEventListener('focus', async ()=>{ if (layer) { layer.style.display='block'; await buildSuggestions(input.value||''); } });
      input.addEventListener('input', async ()=>{ await buildSuggestions(input.value||''); });
      input.addEventListener('keydown', (e)=>{ if (e.key==='Enter'){ e.preventDefault(); doSearch(); } });
    }
    document.addEventListener('click', (e)=>{
      const t = e.target.closest && e.target.closest('#search-tabs .tab');
      if (t){ const pane = t.getAttribute('data-pane'); setActive(pane); const q=(input?.value||'').trim(); if(q){ if(pane==='news') loadNewsByKeyword(q); if(pane==='community') loadCommunityByKeyword(q); if(pane==='users') loadUsersByKeyword(q); } }
      const row = e.target.closest && e.target.closest('.user-item');
      if (row){
        const uid = row.getAttribute('data-uid');
        if (uid){
          const href = isLocal? `/feed/profile.html?uid=${encodeURIComponent(uid)}` : `/feed/profile?uid=${encodeURIComponent(uid)}`;
          window.location.href = href;
          return;
        }
      }
      const sug = e.target.closest && e.target.closest('.suggest-item');
      if (sug){ const kw = sug.getAttribute('data-kw'); if (input){ input.value = kw; } doSearch(); return; }
      const newsCard = e.target.closest && e.target.closest('.news-card');
      if (newsCard){
        const href = newsCard.getAttribute('data-href');
        if (href){ try { window.open(href, '_blank', 'noopener,noreferrer'); } catch(_) { location.href = href; } }
        return;
      }
      const postCard = e.target.closest && e.target.closest('.post-card');
      if (postCard){
        const pid = postCard.getAttribute('data-post');
        if (pid){
          const href = isLocal? `/feed/post.html?id=${encodeURIComponent(pid)}` : `/feed/post/${encodeURIComponent(pid)}`;
          window.location.href = href;
        }
        return;
      }
      if (layer && !e.target.closest('.search-layer') && !e.target.closest('.input-group')){ layer.style.display='none'; }
    });

    document.addEventListener('click', (e)=>{
      const b = e.target.closest && e.target.closest('[data-follow]');
      if (!b) return;
      const uid = b.getAttribute('data-follow');
      if (!uid) return;
      const href = isLocal? `/feed/profile.html?uid=${encodeURIComponent(uid)}` : `/feed/profile?uid=${encodeURIComponent(uid)}`;
      window.location.href = href;
    });
  }

  function initFromQuery(){
    try {
      const p = new URLSearchParams(location.search||'');
      const q = p.get('q') || '';
      const pane = (function(v){ return (v==='news'||v==='community'||v==='users')?v:'news'; })(p.get('pane'));
      if (q){ const inp = el('global-search-input'); if (inp) inp.value = q; const tabs = document.getElementById('search-tabs'); if (tabs) tabs.style.display='flex'; setActive(pane); loadNewsByKeyword(q); loadCommunityByKeyword(q); loadUsersByKeyword(q); }
      else { const layer = document.getElementById('search-layer'); if (layer) layer.style.display='block'; buildSuggestions(''); }
      try { window.lucide && window.lucide.createIcons(); } catch(_) {}
    } catch(_) {}
  }

  document.addEventListener('DOMContentLoaded', ()=>{ bind(); initFromQuery(); });
})();


