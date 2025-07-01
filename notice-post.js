import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, increment, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// URL 파라미터에서 게시글 ID 가져오기
const urlParams = new URLSearchParams(window.location.search);
const postId = urlParams.get('id');

// DOM 요소들
const postTitle = document.getElementById('post-title');
const postCategory = document.getElementById('post-category');
const postAuthor = document.getElementById('post-author');
const postDate = document.getElementById('post-date');
const postViews = document.getElementById('post-views');
const postContent = document.getElementById('post-content');
const commentList = document.getElementById('comment-list');
const commentForm = document.getElementById('comment-form');
const commentInput = document.getElementById('comment-input');
const commentCount = document.getElementById('comment-count');
const likeButton = document.getElementById('like-button');
const likeCount = document.getElementById('like-count');
const bookmarkButton = document.getElementById('bookmark-button');
const shareButton = document.getElementById('share-button');

// 전역 변수
let currentUser = null;
let postData = null;
let userLiked = false;
let userBookmarked = false;

// 로그인 상태 확인
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    checkUserInteractions();
    checkAdminPermission();
  }
});

// 페이지 로드 시 게시글 불러오기
if (postId) {
  loadNoticePost();
  loadComments();
} else {
  showError('게시글을 찾을 수 없습니다.');
}

// 게시글 불러오기
async function loadNoticePost() {
  try {
    const postRef = doc(db, 'notices', postId);
    const postDoc = await getDoc(postRef);
    
    if (!postDoc.exists()) {
      showError('게시글을 찾을 수 없습니다.');
      return;
    }
    
    postData = postDoc.data();
    
    // 조회수 증가
    await updateDoc(postRef, {
      views: increment(1)
    });
    
    // 게시글 데이터 표시
    displayPost(postData);
    
  } catch (error) {
    console.error('게시글 로드 중 에러:', error);
    showError('게시글을 불러오는 중 오류가 발생했습니다.');
  }
}

// 게시글 표시
function displayPost(data) {
  // 카테고리 설정
  if (data.category) {
    postCategory.textContent = data.category;
    postCategory.className = `post-category ${data.category.toLowerCase()}`;
    postCategory.style.display = 'inline-block';
  }
  
  // 제목
  postTitle.textContent = data.title || '제목 없음';
  postTitle.style.display = 'block';
  
  // 작성자
  postAuthor.textContent = data.displayName || '익명';
  
  // 날짜
  if (data.createdAt) {
    const date = new Date(data.createdAt.seconds * 1000);
    postDate.textContent = formatDate(date);
  }
  
  // 조회수
  postViews.textContent = (data.views || 0) + 1;
  
  // 내용
  postContent.innerHTML = formatContent(data.content || '내용이 없습니다.');
  postContent.style.display = 'block';
  
  // 좋아요 수
  if (likeCount) {
    likeCount.textContent = data.likes || 0;
  }
}

// 댓글 불러오기
function loadComments() {
  const commentsRef = collection(db, 'notices', postId, 'comments');
  const commentsQuery = query(commentsRef, orderBy('createdAt', 'desc'));
  
  onSnapshot(commentsQuery, (snapshot) => {
    const comments = [];
    snapshot.forEach((doc) => {
      comments.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    displayComments(comments);
    updateCommentCount(comments.length);
  });
}

// 댓글 표시
function displayComments(comments) {
  if (!commentList) return;
  
  if (comments.length === 0) {
    commentList.innerHTML = `
      <div class="empty-comments">
        <i class="fas fa-comment-slash"></i>
        <h3>첫 번째 댓글을 작성해보세요</h3>
        <p>여러분의 의견을 기다리고 있습니다.</p>
      </div>
    `;
    return;
  }
  
  commentList.innerHTML = comments.map(comment => `
    <div class="comment-item" data-comment-id="${comment.id}">
      <div class="comment-header">
        <span class="comment-author">${comment.displayName || '익명'}</span>
        <span class="comment-date">${formatDate(new Date(comment.createdAt?.seconds * 1000))}</span>
      </div>
      <div class="comment-content">${escapeHtml(comment.text)}</div>
      ${canDeleteComment(comment) ? '<button class="delete-comment-btn" onclick="deleteComment(\'' + comment.id + '\')"><i class="fas fa-trash"></i></button>' : ''}
    </div>
  `).join('');
}

// 댓글 수 업데이트
function updateCommentCount(count) {
  if (commentCount) {
    commentCount.textContent = count;
  }
}

// 댓글 작성
if (commentForm) {
  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      alert('로그인 후 댓글을 작성할 수 있습니다.');
      return;
    }
    
    const text = commentInput.value.trim();
    if (!text) {
      alert('댓글 내용을 입력해주세요.');
      return;
    }
    
    try {
      const commentsRef = collection(db, 'notices', postId, 'comments');
      await addDoc(commentsRef, {
        text: text,
        displayName: currentUser.displayName || '익명',
        uid: currentUser.uid,
        createdAt: serverTimestamp()
      });
      
      commentInput.value = '';
      
    } catch (error) {
      console.error('댓글 작성 중 에러:', error);
      alert('댓글 작성 중 오류가 발생했습니다.');
    }
  });
}

// 좋아요 버튼 이벤트
if (likeButton) {
  likeButton.addEventListener('click', async () => {
    if (!currentUser) {
      alert('로그인 후 좋아요를 누를 수 있습니다.');
      return;
    }
    
    try {
      const postRef = doc(db, 'notices', postId);
      
      if (userLiked) {
        // 좋아요 취소
        await updateDoc(postRef, {
          likes: increment(-1)
        });
        userLiked = false;
        likeButton.classList.remove('active');
      } else {
        // 좋아요 추가
        await updateDoc(postRef, {
          likes: increment(1)
        });
        userLiked = true;
        likeButton.classList.add('active');
      }
      
      // 좋아요 수 업데이트
      const updatedDoc = await getDoc(postRef);
      const updatedData = updatedDoc.data();
      likeCount.textContent = updatedData.likes || 0;
      
    } catch (error) {
      console.error('좋아요 처리 중 에러:', error);
      alert('좋아요 처리 중 오류가 발생했습니다.');
    }
  });
}

// 북마크 버튼 이벤트
if (bookmarkButton) {
  bookmarkButton.addEventListener('click', () => {
    if (!currentUser) {
      alert('로그인 후 북마크를 설정할 수 있습니다.');
      return;
    }
    
    userBookmarked = !userBookmarked;
    bookmarkButton.classList.toggle('active', userBookmarked);
    
    // 북마크 상태를 로컬 스토리지에 저장
    const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
    if (userBookmarked) {
      bookmarks.push(postId);
    } else {
      const index = bookmarks.indexOf(postId);
      if (index > -1) {
        bookmarks.splice(index, 1);
      }
    }
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
  });
}

// 공유 버튼 이벤트
if (shareButton) {
  shareButton.addEventListener('click', () => {
    const url = window.location.href;
    const title = postData?.title || '공지사항';
    
    if (navigator.share) {
      navigator.share({
        title: title,
        url: url
      });
    } else {
      // 클립보드에 복사
      navigator.clipboard.writeText(url).then(() => {
        alert('링크가 클립보드에 복사되었습니다.');
      }).catch(() => {
        alert('링크 복사에 실패했습니다.');
      });
    }
  });
}

// 사용자 상호작용 상태 확인
function checkUserInteractions() {
  if (!currentUser) return;
  
  // 북마크 상태 확인
  const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
  userBookmarked = bookmarks.includes(postId);
  if (bookmarkButton) {
    bookmarkButton.classList.toggle('active', userBookmarked);
  }
  
  // 좋아요 상태는 서버에서 관리해야 하므로 여기서는 간단히 처리
  // 실제 구현에서는 사용자별 좋아요 상태를 별도 컬렉션에서 관리
}

// 댓글 삭제 권한 확인
function canDeleteComment(comment) {
  if (!currentUser) return false;
  return currentUser.uid === comment.uid || currentUser.email === 'admin@site.com';
}

// 댓글 삭제
window.deleteComment = async function(commentId) {
  if (!confirm('댓글을 삭제하시겠습니까?')) return;
  
  try {
    const commentRef = doc(db, 'notices', postId, 'comments', commentId);
    await deleteDoc(commentRef);
  } catch (error) {
    console.error('댓글 삭제 중 에러:', error);
    alert('댓글 삭제 중 오류가 발생했습니다.');
  }
};

// 유틸리티 함수들
function formatDate(date) {
  if (!date) return '';
  
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return date.toLocaleDateString('ko-KR');
  } else if (hours > 0) {
    return `${hours}시간 전`;
  } else if (minutes > 0) {
    return `${minutes}분 전`;
  } else {
    return '방금 전';
  }
}

function formatContent(content) {
  // Quill 에디터에서 온 HTML 콘텐츠는 그대로 반환
  // 단, 보안상 스크립트 태그는 제거
  if (content.includes('<') && content.includes('>')) {
    // HTML 콘텐츠인 경우 스크립트 태그만 제거
    return content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  } else {
    // 일반 텍스트인 경우 기존 방식대로 처리
    return escapeHtml(content).replace(/\n/g, '<br>');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showError(message) {
  if (postContent) {
    postContent.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-color-secondary);">
        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 16px;"></i>
        <h3>${message}</h3>
        <p>다시 시도해 주세요.</p>
      </div>
    `;
  }
}

// 관리자 권한 확인
function checkAdminPermission() {
  const adminActions = document.getElementById('admin-actions');
  const editBtn = document.getElementById('edit-post-btn');
  const deleteBtn = document.getElementById('delete-post-btn');
  
  if (currentUser && currentUser.email === 'admin@site.com') {
    if (adminActions) {
      adminActions.style.display = 'flex';
      
      // 수정 버튼 이벤트
      if (editBtn) {
        editBtn.addEventListener('click', showEditModal);
      }
      
      // 삭제 버튼 이벤트
      if (deleteBtn) {
        deleteBtn.addEventListener('click', deletePost);
      }
    }
  } else {
    if (adminActions) {
      adminActions.style.display = 'none';
    }
  }
}

// 게시글 삭제
async function deletePost() {
  if (!confirm('정말로 이 공지사항을 삭제하시겠습니까?')) {
    return;
  }
  
  try {
    // 댓글들 먼저 삭제
    const commentsRef = collection(db, 'notices', postId, 'comments');
    const commentsSnapshot = await getDocs(commentsRef);
    
    for (const commentDoc of commentsSnapshot.docs) {
      await deleteDoc(commentDoc.ref);
    }
    
    // 게시글 삭제
    const postRef = doc(db, 'notices', postId);
    await deleteDoc(postRef);
    
    alert('공지사항이 삭제되었습니다.');
    window.location.href = 'notice-board.html';
    
  } catch (error) {
    console.error('게시글 삭제 중 에러:', error);
    alert('게시글 삭제 중 오류가 발생했습니다.');
  }
}

// 수정 모달 표시
function showEditModal() {
  if (!postData) return;
  
  const modal = document.createElement('div');
  modal.className = 'edit-modal';
  modal.innerHTML = `
    <div class="edit-modal-content">
      <div class="edit-modal-header">
        <h2>공지사항 수정</h2>
        <button class="close-modal" onclick="closeEditModal()">&times;</button>
      </div>
      <form id="edit-form" class="edit-form">
        <div class="form-group">
          <label>카테고리</label>
          <select id="edit-category" required>
            <option value="general" ${postData.category === 'general' ? 'selected' : ''}>일반</option>
            <option value="update" ${postData.category === 'update' ? 'selected' : ''}>업데이트</option>
          </select>
        </div>
        <div class="form-group">
          <label>제목</label>
          <input type="text" id="edit-title" required value="${escapeHtml(postData.title || '')}">
        </div>
        <div class="quill-editor-container">
          <label>내용</label>
          <div id="edit-editor" placeholder="공지사항 내용을 입력하세요. 이미지, 링크, 서식 등을 자유롭게 사용할 수 있습니다."></div>
        </div>
        <div class="form-actions">
          <button type="button" onclick="closeEditModal()">취소</button>
          <button type="submit">수정</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Quill 에디터 초기화
  const editQuill = new Quill('#edit-editor', {
    theme: 'snow',
    placeholder: '공지사항 내용을 입력하세요. 이미지, 링크, 서식 등을 자유롭게 사용할 수 있습니다.',
    modules: {
      toolbar: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'indent': '-1'}, { 'indent': '+1' }],
        [{ 'align': [] }],
        ['link', 'image'],
        ['clean']
      ]
    }
  });

  // 기존 내용 설정
  if (postData.content) {
    if (postData.content.includes('<') && postData.content.includes('>')) {
      // HTML 콘텐츠인 경우
      editQuill.root.innerHTML = postData.content;
    } else {
      // 일반 텍스트인 경우
      editQuill.setText(postData.content);
    }
  }

  // Quill 에디터의 이미지 삽입 기능 오버라이드
  editQuill.getModule('toolbar').addHandler('image', () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = () => {
      const file = input.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const range = editQuill.getSelection();
          editQuill.insertEmbed(range.index, 'image', e.target.result);
        };
        reader.readAsDataURL(file);
      }
    };
  });
  
  // 폼 제출 이벤트
  document.getElementById('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const category = document.getElementById('edit-category').value;
    const title = document.getElementById('edit-title').value;
    const content = editQuill.root.innerHTML;
    
    if (!title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }
    
    if (!editQuill.getText().trim()) {
      alert('내용을 입력해주세요.');
      return;
    }
    
    try {
      const postRef = doc(db, 'notices', postId);
      await updateDoc(postRef, {
        category: category,
        title: title,
        content: content,
        updatedAt: serverTimestamp()
      });
      
      alert('공지사항이 수정되었습니다.');
      closeEditModal();
      
      // 페이지 새로고침
      window.location.reload();
      
    } catch (error) {
      console.error('공지사항 수정 중 오류:', error);
      alert('공지사항 수정 중 오류가 발생했습니다.');
    }
  });
}

// 수정 모달 닫기
window.closeEditModal = function() {
  const modal = document.querySelector('.edit-modal');
  if (modal) {
    modal.remove();
  }
}; 