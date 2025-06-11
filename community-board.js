import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, getCountFromServer, getDocs, limit, startAfter, where, increment, updateDoc, deleteDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const writeBtn = document.getElementById('write-post-btn');
const writeModal = document.getElementById('write-modal');
const closeWriteModal = document.getElementById('close-write-modal');
const writeForm = document.getElementById('write-form');
const boardList = document.getElementById('board-list');
const popularCol1 = document.querySelector('.popular-posts-col:nth-child(1)');
const popularCol2 = document.querySelector('.popular-posts-col:nth-child(2)');
const subFilterBtns = document.querySelectorAll('.sub-filter-btn');
const loadMoreBtn = document.getElementById('load-more-btn');
const scrollTopBtn = document.getElementById('scroll-top-btn');

let lastVisible = null;
let currentPage = 1;
const POSTS_PER_PAGE = 10;
let currentFilter = 'latest';
let isLoading = false;

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
    profileImg: user.photoURL || 'assets/@default-profile.png',
    createdAt: serverTimestamp(),
    views: 0,
    likes: 0,
    comments: 0,
    isNews: false // 예시
  });
  writeForm.reset();
  showWriteModal(false);
  renderFeed(true);
});

// 인기글 렌더링 (댓글+좋아요수 기준 상위 10개)
async function renderPopularPosts() {
  let q = query(collection(db, 'community-posts'), orderBy('likes', 'desc'), limit(20));
  const snap = await getDocs(q);
  let posts = [];
  snap.forEach(doc => posts.push({ id: doc.id, ...doc.data() }));
  // 댓글수 fetch 후 합산 정렬
  for (let post of posts) {
    const commentsSnap = await getCountFromServer(collection(db, `community-posts/${post.id}/comments`));
    post.comments = commentsSnap.data().count;
    post.popularScore = (post.likes || 0) + post.comments;
  }
  posts = posts.sort((a, b) => b.popularScore - a.popularScore).slice(0, 5);
  
  // 인기글 아이템 HTML 생성 함수
  const popularPostItem = (post, rank) => `
    <div class="popular-post-item2" data-id="${post.id}">
      <span class="popular-rank2">${rank}</span>
      <span class="popular-cat2">${post.subCategory || post.category || '자유'}</span>
      <span class="popular-time2">${timeAgo(post.createdAt.seconds * 1000)}</span>
      <span class="popular-title2">${post.title}</span>
      <span class="popular-comments2">${post.comments || 0}</span>
    </div>
  `;

  // 5개만 1컬럼에 렌더링
  const row1 = posts.map((post, i) => popularPostItem(post, i+1)).join('');
  document.querySelector('.popular-posts-col').innerHTML = row1;
  // 혹시 남아있을 두번째 컬럼은 비움
  const col2 = document.querySelectorAll('.popular-posts-col')[1];
  if (col2) col2.innerHTML = '';

  // 클릭 이벤트
  document.querySelectorAll('.popular-post-item2').forEach(item => {
    item.addEventListener('click', () => {
      window.location.href = `community-post.html?id=${item.dataset.id}`;
    });
  });
}

// 카테고리 탭/필터 이벤트
// currentCategory, categoryTabs 관련 코드 완전 삭제

// 플로팅 버튼
scrollTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// 더보기 버튼
loadMoreBtn.addEventListener('click', () => {
  if (!isLoading) renderFeed(false);
});

// 게시글 피드 렌더링 (카드 상단 카테고리 뱃지 포함)
async function renderFeed(reset = false) {
  if (isLoading) return;
  isLoading = true;
  if (reset) {
    boardList.innerHTML = '';
    lastVisible = null;
    currentPage = 1;
  }
  let q;
  if (currentFilter === 'hot') {
    // HOT: 최신 200개 글을 모두 가져와서 (likes+comments) 합산 점수로 정렬
    q = query(collection(db, 'community-posts'), orderBy('createdAt', 'desc'), limit(200));
  } else {
    // 최신순
    q = query(collection(db, 'community-posts'), orderBy('createdAt', 'desc'), limit(POSTS_PER_PAGE));
  }
  if (lastVisible && currentFilter !== 'hot') {
    q = query(q, startAfter(lastVisible));
  }
  const snap = await getDocs(q);
  let posts = [];
  snap.forEach(doc => posts.push({ id: doc.id, ...doc.data() }));
  if (currentFilter === 'hot') {
    // 각 게시글의 댓글 수 fetch 후 합산 정렬
    for (let post of posts) {
      const commentsSnap = await getCountFromServer(collection(db, `community-posts/${post.id}/comments`));
      post.comments = commentsSnap.data().count;
      post.hotScore = (post.likes || 0) + post.comments;
    }
    posts = posts.sort((a, b) => b.hotScore - a.hotScore);
    posts = posts.slice(0, POSTS_PER_PAGE); // 페이지당 10개만
  }
  if (posts.length > 0 && currentFilter !== 'hot') lastVisible = snap.docs[snap.docs.length - 1];
  // 카드 렌더링
  posts.forEach(post => {
    boardList.appendChild(postCard2(post));
  });
  isLoading = false;
}

// 게시글 카드 렌더링
function postCard2(post) {
  const card = document.createElement('div');
  card.className = 'post-card';
  card.innerHTML = `
    <div class="post-card-header">
      <img class="post-profile-img" src="${post.profileImg || 'assets/@default-profile.png'}" alt="프로필">
      <div class="post-header-info">
        <span class="post-nickname">${post.displayName}</span>
        <span class="post-time">${post.createdAt ? timeAgo(post.createdAt.seconds*1000) : ''}${post.isEdited ? ' (수정됨)' : ''}</span>
      </div>
      <span class="post-category-badge">${post.subCategory || post.category || '자유'}</span>
    </div>
    <a href="community-post.html?id=${post.id}" class="post-card-content-wrapper">
      <h2 class="post-card-title">${post.title}</h2>
      <p class="post-card-content">${post.content ? post.content.slice(0, 120) : ''}</p>
      ${post.isNews ? `
        <div class="post-news-block">
          <span class="post-news-icon"><i class="fas fa-chart-line"></i></span>
          <div>
            <h3 class="post-news-title">${post.newsTitle || '분석 "BTC, 3분기 횡보 전망"'}</h3>
            <p class="post-news-summary">${post.newsSummary || '비트코인 3분기 가격 횡보 예상, 투자자 심리 분석 등'}</p>
          </div>
        </div>
      ` : ''}
    </a>
    <div class="post-card-footer">
      <button class="post-footer-btn" data-action="like" data-post-id="${post.id}">
        <span class="icon"><i class="fas fa-heart"></i></span>
        <span class="count">${post.likes || 0}</span>
      </button>
      <button class="post-footer-btn" data-action="comment" data-post-id="${post.id}">
        <span class="icon"><i class="fas fa-comment"></i></span>
        <span class="count" id="comment-count-${post.id}">${post.comments || 0}</span>
      </button>
      <button class="post-footer-btn" data-action="share" data-post-id="${post.id}">
        <span class="icon"><i class="fas fa-share"></i></span>
      </button>
    </div>
  `;

  // 반응 버튼 이벤트
  card.querySelectorAll('.post-footer-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const action = btn.dataset.action;
      const postId = btn.dataset.postId;
      if (action === 'like') {
        handleLike(postId, btn);
      } else if (action === 'share') {
        handleShare(postId);
      } else if (action === 'comment') {
        window.location.href = `community-post.html?id=${postId}#comments`;
      }
    });
  });

  // 댓글 카운트 실시간 반영
  const commentsRef = collection(db, `community-posts/${post.id}/comments`);
  onSnapshot(commentsRef, snap => {
    const count = snap.size;
    const countEl = card.querySelector(`#comment-count-${post.id}`);
    if (countEl) countEl.textContent = count;
  });

  // 카드 클릭 이벤트 (버튼 제외)
  card.addEventListener('click', (e) => {
    if (!e.target.closest('.post-footer-btn')) {
      window.location.href = `community-post.html?id=${post.id}`;
    }
  });
  return card;
}

// 좋아요 처리 함수
async function handleLike(postId, btn) {
  if (!auth.currentUser) {
    showLoginModal();
    return;
  }
  const postRef = doc(db, 'community-posts', postId);
  const likeRef = doc(db, `community-posts/${postId}/likes`, auth.currentUser.uid);
  const postSnap = await getDoc(postRef);
  let likes = postSnap.data().likes || 0;
  const likeSnap = await getDoc(likeRef);
  if (likeSnap.exists()) {
    // 이미 좋아요 눌렀으면 취소
    if (likes > 0) await updateDoc(postRef, { likes: likes - 1 });
    await deleteDoc(likeRef);
    btn.classList.remove('active');
  } else {
    await updateDoc(postRef, { likes: likes + 1 });
    await setDoc(likeRef, { liked: true });
    btn.classList.add('active');
  }
  // 새로고침 없이 카운트 갱신
  const snap2 = await getDoc(postRef);
  btn.querySelector('.count').textContent = snap2.data().likes || 0;
}

// 공유 처리 함수
function handleShare(postId) {
  const url = `${window.location.origin}/community-post.html?id=${postId}`;
  
  if (navigator.share) {
    navigator.share({
      title: 'ONBit 커뮤니티 게시글',
      url: url
    }).catch(console.error);
  } else {
    // 클립보드에 복사
    navigator.clipboard.writeText(url).then(() => {
      alert('게시글 링크가 클립보드에 복사되었습니다.');
    }).catch(console.error);
  }
}

function timeAgo(date) {
  const now = Date.now();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff/60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff/3600)}시간 전`;
  if (diff < 2592000) return `${Math.floor(diff/86400)}일 전`;
  return new Date(date).toLocaleDateString();
}

// HOT/최신 필터 이벤트만 남김
subFilterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    subFilterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (btn.textContent.includes('HOT')) {
      currentFilter = 'hot';
    } else {
      currentFilter = 'latest';
    }
    renderFeed(true);
  });
});

// 초기 렌더링
renderPopularPosts();
renderFeed(true); 