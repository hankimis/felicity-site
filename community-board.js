import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, getCountFromServer, getDocs, limit, startAfter } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const writeBtn = document.getElementById('write-post-btn');
const writeModal = document.getElementById('write-modal');
const closeWriteModal = document.getElementById('close-write-modal');
const writeForm = document.getElementById('write-form');
const boardList = document.getElementById('board-list');

let lastVisible = null;
let currentPage = 1;
const POSTS_PER_PAGE = 10;

function showWriteModal(show) {
  writeModal.style.display = show ? 'block' : 'none';
}

onAuthStateChanged(auth, user => {
  if (user) {
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
  if (!user) return alert('로그인 후 작성 가능합니다.');
  const title = document.getElementById('post-title').value.trim();
  const content = document.getElementById('post-content').value.trim();
  if (!title || !content) return;
  await addDoc(collection(db, 'community-posts'), {
    title,
    content,
    uid: user.uid,
    displayName: user.displayName || '익명',
    createdAt: serverTimestamp(),
    views: 0,
    likes: 0,
    dislikes: 0
  });
  writeForm.reset();
  showWriteModal(false);
});

async function renderPage(page = 1) {
  boardList.innerHTML = '';
  let q = query(collection(db, 'community-posts'), orderBy('createdAt', 'desc'), limit(POSTS_PER_PAGE));
  if (page > 1 && lastVisible) {
    q = query(collection(db, 'community-posts'), orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(POSTS_PER_PAGE));
  }
  const snap = await getDocs(q);
  const posts = [];
  snap.forEach(doc => posts.push({ id: doc.id, ...doc.data() }));
  if (posts.length > 0) lastVisible = snap.docs[snap.docs.length - 1];
  // 댓글수, 추천수, 조회수 등 표시
  boardList.innerHTML = `
    <table class="board-table">
      <thead><tr><th>번호</th><th>제목</th><th>글쓴이</th><th>조회</th><th>추천</th><th>댓글</th><th>날짜</th></tr></thead>
      <tbody>
        ${posts.map((post, idx) => `
          <tr data-id="${post.id}">
            <td>${(page-1)*POSTS_PER_PAGE + idx + 1}</td>
            <td class="title-cell">${post.title}</td>
            <td>${post.displayName}</td>
            <td>${post.views || 0}</td>
            <td>${post.likes || 0}</td>
            <td id="comment-count-${post.id}">-</td>
            <td>${post.createdAt ? new Date(post.createdAt.seconds*1000).toLocaleDateString() : ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="pagination" id="pagination"></div>
  `;
  // 댓글수 fetch
  posts.forEach(async post => {
    const commentsSnap = await getCountFromServer(collection(db, `community-posts/${post.id}/comments`));
    document.getElementById(`comment-count-${post.id}`).textContent = commentsSnap.data().count;
  });
  // 행 클릭시 상세로 이동
  boardList.querySelectorAll('tr[data-id]').forEach(row => {
    row.addEventListener('click', () => {
      window.location.href = `community-post.html?id=${row.dataset.id}`;
    });
  });
  renderPagination(page);
}

function renderPagination(page) {
  // 전체 게시글 수 fetch
  getCountFromServer(collection(db, 'community-posts')).then(snap => {
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