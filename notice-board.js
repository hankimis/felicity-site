import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, getCountFromServer, getDocs, limit, startAfter } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

const ADMIN_EMAIL = "admin@site.com";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const writeBtn = document.getElementById('write-notice-btn');
const writeModal = document.getElementById('notice-modal');
const closeWriteModal = document.getElementById('close-notice-modal');
const writeForm = document.getElementById('notice-form');
const noticeList = document.getElementById('notice-list');

let lastVisible = null;
let currentPage = 1;
const POSTS_PER_PAGE = 10;

function showWriteModal(show) {
  if (show) {
    const user = auth.currentUser;
    if (!user || user.email !== ADMIN_EMAIL) {
      alert('관리자만 공지사항을 작성할 수 있습니다.');
      return;
    }
    writeModal.classList.add('show');
  } else {
    writeModal.classList.remove('show');
  }
}

onAuthStateChanged(auth, (user) => {
  if (writeBtn) {
  if (user && user.email === ADMIN_EMAIL) {
      writeBtn.style.display = 'flex';
  } else {
    writeBtn.style.display = 'none';
      if (writeModal && writeModal.classList.contains('show')) {
        writeModal.classList.remove('show');
      }
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  if (writeBtn) {
    writeBtn.addEventListener('click', () => {
      console.log('공지작성 버튼 클릭됨');
      showWriteModal(true);
    });
  }

  if (closeWriteModal) {
    closeWriteModal.addEventListener('click', () => {
      console.log('닫기 버튼 클릭됨');
      showWriteModal(false);
    });
  }

  if (writeModal) {
    writeModal.addEventListener('click', (e) => {
      if (e.target === writeModal) {
        showWriteModal(false);
      }
    });
  }

  if (writeForm) {
writeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
      console.log('공지사항 폼 제출됨');
      
  const user = auth.currentUser;
      if (!user || user.email !== ADMIN_EMAIL) {
        alert('관리자만 공지사항을 작성할 수 있습니다.');
        showWriteModal(false);
        return;
      }

  const title = document.getElementById('notice-title').value.trim();
  const content = document.getElementById('notice-content').value.trim();
  if (!title || !content) return;

      try {
  await addDoc(collection(db, 'notices'), {
    title,
    content,
    uid: user.uid,
          displayName: '관리자',
    createdAt: serverTimestamp(),
    views: 0,
    likes: 0,
          comments: 0
  });

  writeForm.reset();
  showWriteModal(false);
        location.reload(); // 공지사항 목록 새로고침
      } catch (error) {
        console.error('공지사항 작성 중 오류:', error);
        alert('공지사항 작성 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    });
  }
});

async function renderPage(page = 1) {
  noticeList.innerHTML = '';
  let q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'), limit(POSTS_PER_PAGE));
  if (page > 1 && lastVisible) {
    q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(POSTS_PER_PAGE));
  }
  const snap = await getDocs(q);
  const posts = [];
  snap.forEach(doc => posts.push({ id: doc.id, ...doc.data() }));
  if (posts.length > 0) lastVisible = snap.docs[snap.docs.length - 1];
  // 카드형 렌더링
  noticeList.innerHTML = posts.map(post => `
    <div class="notice-card" data-id="${post.id}">
      <div class="notice-title">${post.title}</div>
      <div class="notice-content-preview">${(post.content || '').replace(/<[^>]+>/g, '').slice(0, 60)}${(post.content||'').length>60?'...':''}</div>
      <div class="notice-meta">
        <span class="meta-item"><i class="fas fa-user"></i> ${post.displayName || '관리자'}</span>
        <span class="meta-item"><i class="fas fa-calendar-alt"></i> ${post.createdAt ? new Date(post.createdAt.seconds*1000).toLocaleDateString() : ''}</span>
        <span class="meta-item"><i class="fas fa-eye"></i> ${post.views || 0}</span>
        <span class="meta-item"><i class="fas fa-thumbs-up"></i> ${post.likes || 0}</span>
        <span class="meta-item"><i class="fas fa-comment"></i> <span id="comment-count-${post.id}">-</span></span>
      </div>
    </div>
  `).join('') + '<div class="pagination" id="pagination"></div>';
  // 댓글수 fetch
  posts.forEach(async post => {
    const commentsSnap = await getCountFromServer(collection(db, `notices/${post.id}/comments`));
    const el = document.getElementById(`comment-count-${post.id}`);
    if (el) el.textContent = commentsSnap.data().count;
  });
  // 카드 클릭시 상세로 이동
  noticeList.querySelectorAll('.notice-card').forEach(card => {
    card.addEventListener('click', () => {
      window.location.href = `notice-post.html?id=${card.dataset.id}`;
    });
  });
  renderPagination(page);
}

function renderPagination(page) {
  // 전체 게시글 수 fetch
  getCountFromServer(collection(db, 'notices')).then(snap => {
    const total = snap.data().count;
    const totalPages = Math.ceil(total / POSTS_PER_PAGE);
    const pagDiv = document.getElementById('pagination');
    pagDiv.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.textContent = i;
      btn.className = (i === page) ? 'active' : '';
      btn.onclick = () => { currentPage = i; renderPage(i); };
      pagDiv.appendChild(btn);
    }
  });
}

renderPage(currentPage); 