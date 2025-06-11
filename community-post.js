import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, increment, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

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
  if (!currentUser || !postData) {
    deleteBtn.style.display = 'none';
    return;
  }
  if (currentUser.uid === postData.uid || currentUser.email === 'admin@site.com') {
    deleteBtn.style.display = 'block';
    deleteBtn.onclick = async () => {
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
  } else {
    deleteBtn.style.display = 'none';
  }
}

async function loadPost() {
  const snap = await getDoc(postRef);
  if (!snap.exists()) {
    postDetail.innerHTML = '<div>게시글을 찾을 수 없습니다.</div>';
    deleteBtn.style.display = 'none';
    return;
  }
  postData = snap.data();
  await updateDoc(postRef, { views: increment(1) });
  postDetail.innerHTML = `
    <div class="post-detail-header">
      <div class="post-title">${postData.title}</div>
      <div class="post-meta">${postData.displayName} · ${postData.createdAt ? new Date(postData.createdAt.seconds*1000).toLocaleString() : ''} · 조회수 ${postData.views+1 || 1}</div>
    </div>
    <div class="post-content">${postData.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
  `;
  checkDeleteButton();
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
  // 댓글 카운트 업데이트 (community-board.js의 comment-count-${postId} 엘리먼트가 있다면)
  const countEl = document.getElementById(`comment-count-${postId}`);
  if (countEl) countEl.textContent = comments.length;
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
    commentInput.value = '';
  });
}

// ... 이하 기존 상세/댓글/추천 등 코드 ... 