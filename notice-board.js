import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, getCountFromServer, getDocs, limit, startAfter } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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
  writeModal.style.display = show ? 'block' : 'none';
}

onAuthStateChanged(auth, user => {
  if (user && user.email === ADMIN_EMAIL) {
    writeBtn.style.display = 'inline-block';
  } else {
    writeBtn.style.display = 'none';
  }
});

writeBtn.addEventListener('click', () => showWriteModal(true));
closeWriteModal.addEventListener('click', () => showWriteModal(false));

writeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user || user.email !== ADMIN_EMAIL) return alert('관리자만 작성 가능합니다.');
  const title = document.getElementById('notice-title').value.trim();
  const content = document.getElementById('notice-content').value.trim();
  if (!title || !content) return;
  await addDoc(collection(db, 'notices'), {
    title,
    content,
    uid: user.uid,
    displayName: user.displayName || '관리자',
    createdAt: serverTimestamp(),
    views: 0,
    likes: 0,
    dislikes: 0
  });
  writeForm.reset();
  showWriteModal(false);
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