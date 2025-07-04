import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, increment, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from '../js/firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const urlParams = new URLSearchParams(window.location.search);
const postId = urlParams.get('id');
const postRef = doc(db, 'community-posts', postId);
const postDetail = document.getElementById('post-detail');
const postActions = document.getElementById('post-actions');
const deleteBtn = document.getElementById('delete-post-btn');

let currentUser = null;
let postData = null;

function checkDeleteButton() {
  const deleteBtn = document.getElementById('delete-post-btn');
  if (!deleteBtn) return;
  if (!currentUser || !postData) {
    deleteBtn.style.display = 'none';
    return;
  }
  if (currentUser.uid === postData.uid || currentUser.email === 'admin@site.com') {
    deleteBtn.style.display = 'inline-block';
  } else {
    deleteBtn.style.display = 'none';
  }
}

async function loadPost() {
  const snap = await getDoc(postRef);
  if (!snap.exists()) {
    postDetail.innerHTML = '<div>게시글을 찾을 수 없습니다.</div>';
    return;
  }
  postData = snap.data();
  await updateDoc(postRef, { views: increment(1) });
  // 카드형 레이아웃 (클래스 기반)
  postDetail.innerHTML = `
    <div class="post-card-header">
      <img class="post-profile-img" src="${postData.profileImg || 'assets/@default-profile.png'}" onerror="this.onerror=null;this.src='assets/@default-profile.png';" alt="프로필">
      <div style="display:flex;flex-direction:column;gap:2px;">
        <span class="post-nickname">${postData.displayName || '익명'}</span>
        <span class="post-time">
          ${postData.createdAt ? new Date(postData.createdAt.seconds*1000).toLocaleString() : ''}
          ${postData.isEdited ? ' (수정됨)' : ''}
        </span>
      </div>
      <span class="post-category-badge">${postData.subCategory || postData.category || '자유'}
        <button id="delete-post-btn" style="margin-left:10px;background:#ef5350;color:#fff;border:none;border-radius:8px;padding:4px 14px;font-weight:600;cursor:pointer;">삭제</button>
      </span>
    </div>
    <div class="post-card-title">${postData.title}</div>
    <div class="post-card-content">${postData.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    ${postData.isNews ? `
      <div class="post-news-block">
        <span class="post-news-icon"><i class="fas fa-chart-line"></i></span>
        <div>
          <h3 class="post-news-title">${postData.newsTitle || ''}</h3>
          <div class="post-news-summary">${postData.newsSummary || ''}</div>
        </div>
      </div>
    ` : ''}
    <div class="post-meta">조회수 ${postData.views+1 || 1}</div>
  `;
  // 태그(있으면)
  const postTags = document.getElementById('post-tags');
  if (postTags) {
    if (postData.tags && Array.isArray(postData.tags) && postData.tags.length > 0) {
      postTags.innerHTML = postData.tags.map(tag => `<span class="post-tag-badge">${tag}</span>`).join('');
    } else {
      postTags.innerHTML = '';
    }
  }
  // 반응 버튼 렌더링
  renderReactions();
  // 삭제 버튼 이벤트 연결
  const deleteBtn = document.getElementById('delete-post-btn');
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      if (!currentUser || !(currentUser.uid === postData.uid || currentUser.email === 'admin@site.com')) return;
      if (!confirm('정말 삭제하시겠습니까?')) return;
      const commentsRef = collection(db, `community-posts/${postId}/comments`);
      const commentsSnap = await getDocs(commentsRef);
      for (const c of commentsSnap.docs) {
        await deleteDoc(c.ref);
      }
      await deleteDoc(postRef);
      alert('삭제되었습니다.');
      window.location.href = 'community-board.html';
    };
  }
  checkDeleteButton();
}

function renderReactions() {
  const reactions = document.getElementById('post-reactions');
  if (!reactions || !postData) return;
  reactions.innerHTML = `
    <button class="post-reaction-btn" id="like-btn"><span class="icon"><i class="fas fa-heart"></i></span> <span id="like-count">${postData.likes || 0}</span></button>
    <button class="post-reaction-btn" id="comment-btn"><span class="icon"><i class="fas fa-comment"></i></span> <span id="comment-count">0</span></button>
    <button class="post-reaction-btn" id="share-btn"><span class="icon"><i class="fas fa-share"></i></span></button>
  `;
  document.getElementById('like-btn').onclick = () => handleLike();
  document.getElementById('share-btn').onclick = () => handleShare();
  document.getElementById('comment-btn').onclick = () => {
    document.getElementById('comment-input')?.focus();
  };
  // 댓글 카운트 실시간 반영
  const commentsRef = collection(db, `community-posts/${postId}/comments`);
  onSnapshot(commentsRef, snap => {
    const countEl = document.getElementById('comment-count');
    if (countEl) {
      countEl.textContent = snap.size;
    }
  });
}

async function handleLike() {
  if (!auth.currentUser) return alert('로그인 후 이용 가능합니다.');
  const likeRef = doc(db, `community-posts/${postId}/likes`, auth.currentUser.uid);
  const postRef2 = doc(db, 'community-posts', postId);
  const postSnap = await getDoc(postRef2);
  let likes = postSnap.data().likes || 0;
  const likeSnap = await getDoc(likeRef);
  
  if (likeSnap.exists()) {
    if (likes > 0) await updateDoc(postRef2, { likes: likes - 1 });
    await deleteDoc(likeRef);
    document.getElementById('like-btn').classList.remove('active');
  } else {
    await updateDoc(postRef2, { likes: likes + 1 });
    await setDoc(likeRef, { liked: true });
    document.getElementById('like-btn').classList.add('active');
    
    // 좋아요 받은 게시글 작성자에게 포인트 추가 (레벨 시스템)
    try {
      if (typeof addLikePoints === 'function' && postData && postData.uid) {
        await addLikePoints(postData.uid);
        console.log('좋아요 포인트 추가됨 (+3점)');
      }
    } catch (levelError) {
      console.error('레벨 시스템 오류:', levelError);
  }
  }
  
  // 새로고침 없이 카운트 갱신
  const snap2 = await getDoc(postRef2);
  const likeCountEl = document.getElementById('like-count');
  if (likeCountEl) {
    likeCountEl.textContent = snap2.data().likes || 0;
  }
}

function handleShare() {
  const url = `${window.location.origin}/community-post.html?id=${postId}`;
  if (navigator.share) {
    navigator.share({ title: postData.title, url });
  } else {
    navigator.clipboard.writeText(url).then(() => alert('링크가 복사되었습니다.'));
  }
}

onAuthStateChanged(auth, user => {
  currentUser = user;
  checkDeleteButton();
});

loadPost();

// 댓글 렌더링 함수 (삭제 버튼 추가)
function renderComments(comments) {
  const commentList = document.getElementById('comment-list');
  if (!commentList) return;
  if (comments.length === 0) {
    commentList.innerHTML = '<div style="color:var(--text-color-secondary);padding:12px;">아직 댓글이 없습니다.</div>';
    return;
  }
  commentList.innerHTML = comments.map(c => `
    <div class="comment-item" data-comment-id="${c.id}">
      <div class="comment-meta">${c.displayName} · ${c.createdAt ? new Date(c.createdAt.seconds*1000).toLocaleString() : ''}${(currentUser && (currentUser.uid === c.uid || currentUser.email === 'admin@site.com')) ? `<button class="delete-comment-btn" style="float:right;background:none;border:none;color:var(--text-color-secondary);cursor:pointer;font-size:0.9em;">삭제</button>` : ''}</div>
      <div>${c.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </div>
  `).join('');
  // 삭제 버튼 이벤트 등록
  commentList.querySelectorAll('.delete-comment-btn').forEach(btn => {
    const commentItem = btn.closest('.comment-item');
    const commentId = commentItem.dataset.commentId;
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('댓글을 삭제하시겠습니까?')) {
        const commentRef = doc(db, `community-posts/${postId}/comments`, commentId);
        await deleteDoc(commentRef);
      }
    });
  });
}

// 댓글 실시간 구독 (댓글 카운트 업데이트 추가)
const commentsRef = collection(db, `community-posts/${postId}/comments`);
const commentsQuery = query(commentsRef, orderBy('createdAt', 'asc'));
onSnapshot(commentsQuery, snap => {
  const comments = [];
  snap.forEach(doc => { comments.push({ id: doc.id, ...doc.data() }); });
  renderComments(comments);
  const commentCountEl = document.getElementById('comment-count');
  if (commentCountEl) {
    commentCountEl.textContent = comments.length;
  }
});

// 댓글 등록
const commentForm = document.getElementById('comment-form');
const commentInput = document.getElementById('comment-input');
if (commentForm) {
  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return alert('로그인 후 댓글 작성 가능합니다.');
    const text = commentInput.value.trim();
    if (!text) return;
    
    await addDoc(commentsRef, {
      text,
      displayName: currentUser.displayName || '익명',
      uid: currentUser.uid,
      createdAt: serverTimestamp()
    });
    
    // 댓글 작성 포인트 추가 (레벨 시스템)
    try {
      if (typeof addCommentPoints === 'function') {
        await addCommentPoints(currentUser.uid);
        console.log('댓글 작성 포인트 추가됨 (+5점)');
      }
    } catch (levelError) {
      console.error('레벨 시스템 오류:', levelError);
    }
    
    commentInput.value = '';
  });
}

// ... 이하 기존 상세/댓글/추천 등 코드 ... 