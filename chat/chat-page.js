function ensureDbReady(cb){
  if (window.db) { cb(); return; }
  const iv = setInterval(()=>{ if (window.db){ clearInterval(iv); cb(); } }, 200);
}

function setActiveChannel(channelId, title){
  const wrapper = document.getElementById('chat-wrapper');
  const titleEl = document.getElementById('active-channel-title');
  if (wrapper){
    wrapper.setAttribute('data-chat-channel', channelId || '');
  }
  if (titleEl){ titleEl.textContent = title || (channelId ? `#${channelId}` : '전체 채팅'); }
  try { localStorage.setItem('chat.selectedChannel', channelId || ''); } catch(_) {}
  // 기존 인스턴스 정리 후 재생성
  if (window.communityChat && window.communityChat.cleanup){ try { window.communityChat.cleanup(); } catch(_){} }
  window.communityChat = new CommunityChat({ channelId });
}

function renderChannels(list){
  const ul = document.getElementById('channels-list'); if (!ul) return;
  const selected = (localStorage.getItem('chat.selectedChannel') || '').toLowerCase();
  ul.innerHTML = '';

  // 단일 ONBIT Chat 항목 렌더
  const onbitItem = list.find(c => c.id.toLowerCase() === 'onbit') || { id: 'onbit', data: {} };
  const li = document.createElement('li');
  if (selected === 'onbit') li.classList.add('active');

  li.innerHTML = `
    <div class="channel-icon"><img src="/assets/indexicon/onbitlogo.png" alt="ONBIT" onerror="this.src='/assets/icon/logoicon.png'"/></div>
    <div class="channel-meta">
      <div class="channel-title">ONBIT Chat</div>
      <div class="last-message">
        <img class="avatar" id="last-avatar" alt="" />
        <span class="nick" id="last-nick"></span>
        <span class="preview" id="last-text"></span>
      </div>
    </div>
  `;

  li.addEventListener('click', ()=>{
    ul.querySelectorAll('li').forEach(x=>x.classList.remove('active'));
    li.classList.add('active');
    setActiveChannel('onbit', 'ONBIT Chat');
  });
  ul.appendChild(li);

  // 최근 메시지 1건 로드하여 미리보기 채움
  ensureDbReady(async ()=>{
    try {
      const snap = await window.db.collection('channels').doc('onbit').collection('messages')
        .orderBy('timestamp', 'desc').limit(1).get();
      if (!snap.empty){
        const m = snap.docs[0].data();
        const avatar = (m.photoThumbURL || m.photoURL) || '/assets/icon/profileicon.png';
        const nick = m.displayName || '사용자';
        const text = (m.text || '').toString();
        const uid = (m.uid || '').toString();
        const avEl = li.querySelector('#last-avatar'); if (avEl){ avEl.src = avatar; avEl.onerror = function(){ this.src='/assets/icon/profileicon.png'; }; avEl.classList.add('clickable'); }
        const nkEl = li.querySelector('#last-nick'); if (nkEl){ nkEl.textContent = nick; nkEl.classList.add('clickable'); }
        const txEl = li.querySelector('#last-text'); if (txEl) txEl.textContent = text;
        if (uid) li.dataset.lastUid = uid;
      } else {
        // 폴백: 기존 커뮤니티 채팅에서 최신 메시지 사용
        const fb = await window.db.collection('community-chat').orderBy('timestamp','desc').limit(1).get();
        if (!fb.empty){
          const m = fb.docs[0].data();
          const avatar = (m.photoThumbURL || m.photoURL) || '/assets/icon/profileicon.png';
          const nick = m.displayName || '사용자';
          const text = (m.text || '').toString();
          const uid = (m.uid || '').toString();
          const avEl = li.querySelector('#last-avatar'); if (avEl){ avEl.src = avatar; avEl.onerror = function(){ this.src='/assets/icon/profileicon.png'; }; avEl.classList.add('clickable'); }
          const nkEl = li.querySelector('#last-nick'); if (nkEl){ nkEl.textContent = nick; nkEl.classList.add('clickable'); }
          const txEl = li.querySelector('#last-text'); if (txEl) txEl.textContent = text;
          if (uid) li.dataset.lastUid = uid;
        } else {
          const txEl = li.querySelector('#last-text'); if (txEl) txEl.textContent = '메시지가 없습니다.';
        }
      }
    } catch(_) {
      const txEl = li.querySelector('#last-text'); if (txEl) txEl.textContent = '메시지를 불러올 수 없습니다.';
    }
  });

  // 아바타/닉네임 클릭 시 프로필로 이동
  li.addEventListener('click', (e)=>{
    const t = e.target;
    if (!t) return;
    if (t.id === 'last-avatar' || t.id === 'last-nick'){
      const uid = li.dataset.lastUid || '';
      if (uid) {
        location.href = `/feed/profile.html?uid=${encodeURIComponent(uid)}`;
        e.stopPropagation();
      }
    }
  });
}

function loadChannels(){
  ensureDbReady(async ()=>{
    try {
      // 채널 존재 여부만 확인 (onbit)
      await window.db.collection('channels').doc('onbit').get();
    } catch(_) {}
    renderChannels([{ id: 'onbit' }]);
    // 초기 선택은 ONBIT 채널 고정
    setActiveChannel('onbit', 'ONBIT Chat');
  });
}

// 이 페이지는 채팅 인스턴스를 직접 제어한다
window.CHAT_PAGE_CONTROLLED = true;
document.addEventListener('DOMContentLoaded', loadChannels);

// last-message 실시간 업데이트 (onSnapshot)
ensureDbReady(()=>{
  try{
    const ref = window.db.collection('channels').doc('onbit').collection('messages')
      .orderBy('timestamp','desc').limit(1);
    ref.onSnapshot((snap)=>{
      const li = document.querySelector('#channels-list li'); if (!li) return;
      if (!snap.empty){
        const m = snap.docs[0].data();
        const avatar = (m.photoThumbURL || m.photoURL) || '/assets/icon/profileicon.png';
        const nick = m.displayName || '사용자';
        const text = (m.text || '').toString();
        const uid = (m.uid || '').toString();
        const avEl = li.querySelector('#last-avatar'); if (avEl){ avEl.src = avatar; avEl.onerror = function(){ this.src='/assets/icon/profileicon.png'; }; }
        const nkEl = li.querySelector('#last-nick'); if (nkEl) nkEl.textContent = nick;
        const txEl = li.querySelector('#last-text'); if (txEl) txEl.textContent = text;
        if (uid) li.dataset.lastUid = uid;
      }
    });
  } catch(_){ }
});


