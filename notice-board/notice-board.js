import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, getCountFromServer, getDocs, limit, startAfter, getDoc, updateDoc, deleteDoc, writeBatch, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from '../firebase-config.js';
import adminAuthManager from '../js/admin-auth-manager.js';

// 🔥 LEGACY CODE REMOVED - Using AdminAuthManager instead
// const ADMIN_EMAIL = "admin@site.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const noticeList = document.getElementById('notice-list');

let allNotices = [];
let currentFilter = 'all';
let currentUser = null;
let isAdmin = false;
let editingNoticeId = null;
let editingNoticeData = null;

// 🛡️ 보안 강화된 어드민 인증 시스템 초기화
adminAuthManager.onAuthStateChange((user, adminStatus) => {
    currentUser = user;
    isAdmin = adminStatus;
    
    console.log('🔐 Auth state changed:', {
        user: user ? user.email : 'none',
        isAdmin: adminStatus
    });
    
    updateAdminUI();
});

// 초기 관리자 상태 확인
console.log('🚀 AdminAuthManager 초기화:', {
    adminAuthManager: typeof adminAuthManager,
    onAuthStateChange: typeof adminAuthManager.onAuthStateChange
});

// 임시 관리자 권한 확인 함수 (adminAuthManager가 작동하지 않을 때 사용)
async function checkAdminPermission() {
    try {
        if (typeof adminAuthManager.isAdminUser === 'function') {
            return await adminAuthManager.isAdminUser();
        } else {
            // adminAuthManager가 작동하지 않을 때 하드코딩된 관리자 이메일 사용
            const adminEmails = ['admin@site.com'];
            console.log('🔐 하드코딩된 관리자 이메일 확인:', {
                currentUser: currentUser ? currentUser.email : 'none',
                adminEmails: adminEmails,
                isAdmin: currentUser && adminEmails.includes(currentUser.email)
            });
            return currentUser && adminEmails.includes(currentUser.email);
        }
    } catch (error) {
        console.error('❌ 관리자 권한 확인 중 오류:', error);
        // 에러 발생 시 하드코딩된 관리자 이메일 사용
        const adminEmails = ['admin@site.com', 'admin@onbit.com', 'admin@felicity.com'];
        console.log('🔐 에러 발생 시 하드코딩된 관리자 이메일 확인:', {
            currentUser: currentUser ? currentUser.email : 'none',
            adminEmails: adminEmails,
            isAdmin: currentUser && adminEmails.includes(currentUser.email)
        });
        return currentUser && adminEmails.includes(currentUser.email);
    }
}

// 🔒 어드민 UI 업데이트
function updateAdminUI() {
    const adminWriteBtn = document.getElementById('admin-write-btn');
    
    if (adminWriteBtn) {
        if (isAdmin) {
            adminWriteBtn.style.display = 'flex';
            adminWriteBtn.removeEventListener('click', showWriteModal);
            adminWriteBtn.addEventListener('click', handleAdminAction);
        } else {
            adminWriteBtn.style.display = 'none';
        }
    }
    
    // 관리자 상태가 변경되면 공지사항 목록도 다시 렌더링
    if (allNotices.length > 0) {
        renderNotices();
    }
}

// 🚨 보안 강화된 어드민 액션 핸들러
async function handleAdminAction() {
    // 실시간 권한 재검증
    const isCurrentlyAdmin = await checkAdminPermission();
    
    if (!isCurrentlyAdmin) {
        alert('⚠️ 관리자 권한이 없습니다. 다시 로그인해주세요.');
        return;
    }
    
    showWriteModal();
}

// 공지사항 목록 렌더링
function renderNotices(notices = allNotices) {
  if (!noticeList) return;

  if (notices.length === 0) {
    noticeList.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: var(--text-color-secondary);">
        <i class="fas fa-clipboard-list" style="font-size: 3rem; margin-bottom: 16px; opacity: 0.5;"></i>
        <h3 style="font-size: 1.2rem; margin-bottom: 8px;">공지사항이 없습니다</h3>
        <p style="font-size: 0.9rem;">새로운 공지사항이 등록되면 알려드리겠습니다.</p>
      </div>
    `;
    return;
  }

  const noticeItems = notices.map(notice => {
    const categoryText = notice.category === 'general' ? '일반' : 
                        notice.category === 'update' ? '업데이트' : '공지';
    
    return `
      <div class="notice-item" data-id="${notice.id}">
        <a href="../notice-post.html?id=${notice.id}" class="notice-link">
          <span class="notice-category ${notice.category}">${categoryText}</span>
          <div class="notice-content">
            <div class="notice-title">${notice.title}</div>
            <div class="notice-date">${notice.date}</div>
          </div>
          <i class="fas fa-chevron-right notice-arrow"></i>
        </a>
        ${isAdmin ? `
          <div class="notice-admin-actions">
            <button class="admin-action-btn edit-btn" onclick="editNotice('${notice.id}')" title="수정">
              <i class="fas fa-edit"></i>
            </button>
            <button class="admin-action-btn delete-btn" onclick="deleteNotice('${notice.id}')" title="삭제">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  noticeList.innerHTML = noticeItems;
  
  // 디버깅을 위한 로그 추가
  console.log('🔍 공지사항 렌더링 완료:', {
    noticesCount: notices.length,
    isAdmin: isAdmin,
    currentUser: currentUser ? currentUser.email : 'none'
  });
}

// 필터링 함수
function filterNotices(filterType) {
  currentFilter = filterType;
  
  let filteredNotices = allNotices;
  
  if (filterType !== 'all') {
    filteredNotices = allNotices.filter(notice => notice.category === filterType);
  }
  
  renderNotices(filteredNotices);
}

// 전역 함수로 설정 (HTML에서 호출하기 위해)
window.filterNotices = filterNotices;

// Firebase에서 공지사항 불러오기 (실제 구현)
async function loadNoticesFromFirebase() {
  try {
    const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const firebaseNotices = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      firebaseNotices.push({
        id: doc.id,
        category: data.category || 'general',
        title: data.title,
        date: data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString('ko-KR') + ' ' + 
               new Date(data.createdAt.seconds * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '',
        createdAt: data.createdAt ? new Date(data.createdAt.seconds * 1000) : new Date(),
        likes: data.likes || 0,
        views: data.views || 0
      });
    });
    
    allNotices = firebaseNotices;
    
    // 관리자 상태 재확인 후 렌더링
    try {
      const adminStatus = await checkAdminPermission();
      console.log('👑 공지사항 로드 시 관리자 상태:', adminStatus);
      isAdmin = adminStatus;
    } catch (error) {
      console.error('❌ 관리자 상태 확인 중 오류:', error);
    }
    
  } catch (error) {
    console.log('Firebase에서 공지사항을 불러오는 중 오류:', error);
    allNotices = [];
  }
  
  renderNotices();
}

// 수정 모드 감지 및 초기화 (URL 파라미터 방식 제거)
async function checkEditMode() {
  // URL 파라미터 방식 대신 직접 모달 열기 방식 사용
  console.log('🔍 수정 모드 감지 - URL 파라미터 방식 비활성화');
}

// 수정할 공지사항 로드
async function loadNoticeForEdit(noticeId) {
  console.log('📝 수정할 공지사항 로드 시작:', noticeId);
  
  try {
    const noticeDoc = await getDoc(doc(db, 'notices', noticeId));
    
    if (!noticeDoc.exists()) {
      console.error('❌ 수정할 공지사항을 찾을 수 없음:', noticeId);
      alert('수정할 공지사항을 찾을 수 없습니다.');
      return;
    }
    
    editingNoticeData = noticeDoc.data();
    console.log('✅ 수정할 공지사항 데이터 로드 완료:', editingNoticeData);
    showEditModal();
    
  } catch (error) {
    console.error('❌ 공지사항 로드 중 오류:', error);
    alert('공지사항을 불러오는 중 오류가 발생했습니다.');
  }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
  console.log('📄 페이지 로드 시작');
  
  // 관리자 상태 확인
  try {
    const adminStatus = await checkAdminPermission();
    console.log('👑 초기 관리자 상태:', adminStatus);
    isAdmin = adminStatus;
  } catch (error) {
    console.error('❌ 관리자 상태 확인 중 오류:', error);
  }
  
  loadNoticesFromFirebase();
  checkEditMode();
});

// 🔥 LEGACY CODE REMOVED - AdminAuthManager handles authentication
// onAuthStateChanged(auth, (user) => {
//   currentUser = user;
//   checkAdminPermission();
// });

// 🔥 LEGACY CODE REMOVED - Replaced with secure validation
// function checkAdminPermission() {
//   const adminWriteBtn = document.getElementById('admin-write-btn');
//   
//   if (currentUser && currentUser.email === ADMIN_EMAIL) {
//     if (adminWriteBtn) {
//       adminWriteBtn.style.display = 'flex';
//       adminWriteBtn.addEventListener('click', showWriteModal);
//     }
//   } else {
//     if (adminWriteBtn) {
//       adminWriteBtn.style.display = 'none';
//     }
//   }
// }

// 🛡️ 보안 강화된 공지사항 작성 모달 표시
async function showWriteModal() {
  // 🚨 실시간 권한 재검증
  const isCurrentlyAdmin = await checkAdminPermission();
  
  if (!isCurrentlyAdmin) {
    alert('⚠️ 관리자 권한이 없습니다. 접근이 거부되었습니다.');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'write-modal';
  modal.innerHTML = `
    <div class="write-modal-content">
      <div class="write-modal-header">
        <h2>🔐 관리자 공지사항 작성</h2>
        <button class="close-modal" onclick="closeWriteModal()">&times;</button>
      </div>
      <div class="admin-security-info">
        <i class="fas fa-shield-alt"></i>
        <span>보안 인증된 관리자 세션</span>
      </div>
      <form id="write-form" class="write-form">
        <div class="form-group">
          <label>카테고리</label>
          <select id="write-category" required>
            <option value="general">일반</option>
            <option value="update">업데이트</option>
          </select>
        </div>
        <div class="form-group">
          <label>제목</label>
          <input type="text" id="write-title" required placeholder="공지사항 제목을 입력하세요">
        </div>
        <div class="quill-editor-container">
          <label>내용</label>
          <div id="editor" placeholder="공지사항 내용을 입력하세요. 이미지, 링크, 서식 등을 자유롭게 사용할 수 있습니다."></div>
        </div>
        <div class="image-upload-section">
          <button type="button" class="image-upload-btn" onclick="document.getElementById('image-input').click()">
            <i class="fas fa-image"></i>
            이미지 업로드
          </button>
          <input type="file" id="image-input" accept="image/*" multiple />
          <div class="image-upload-text">
            이미지를 드래그 앤 드롭하거나 클릭하여 업로드하세요 (JPG, PNG, GIF)
          </div>
          <div class="uploaded-images" id="uploaded-images"></div>
        </div>
        <div class="form-actions">
          <button type="button" onclick="closeWriteModal()">취소</button>
          <button type="submit">등록</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Quill 에디터 초기화
  const quill = new Quill('#editor', {
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

  // 이미지 업로드 핸들러
  const imageInput = document.getElementById('image-input');
  const uploadedImagesContainer = document.getElementById('uploaded-images');
  const imageUploadSection = document.querySelector('.image-upload-section');
  let uploadedImages = [];

  // 파일 선택 이벤트
  imageInput.addEventListener('change', handleImageUpload);

  // 드래그 앤 드롭 이벤트
  imageUploadSection.addEventListener('dragover', (e) => {
    e.preventDefault();
    imageUploadSection.classList.add('dragover');
  });

  imageUploadSection.addEventListener('dragleave', (e) => {
    e.preventDefault();
    imageUploadSection.classList.remove('dragover');
  });

  imageUploadSection.addEventListener('drop', (e) => {
    e.preventDefault();
    imageUploadSection.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    handleImageFiles(files);
  });

  // 이미지 파일 처리 함수
  function handleImageUpload(e) {
    const files = Array.from(e.target.files);
    handleImageFiles(files);
  }

  function handleImageFiles(files) {
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const imageData = {
            id: Date.now() + Math.random(),
            file: file,
            dataUrl: e.target.result,
            name: file.name
          };
          uploadedImages.push(imageData);
          displayUploadedImage(imageData);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // 업로드된 이미지 표시
  function displayUploadedImage(imageData) {
    const imageItem = document.createElement('div');
    imageItem.className = 'uploaded-image-item';
    imageItem.innerHTML = `
      <img src="${imageData.dataUrl}" alt="${imageData.name}" />
      <button type="button" class="remove-image-btn" onclick="removeUploadedImage('${imageData.id}')">×</button>
    `;
    uploadedImagesContainer.appendChild(imageItem);
  }

  // 이미지 삭제 함수 (전역으로 설정)
  window.removeUploadedImage = function(imageId) {
    uploadedImages = uploadedImages.filter(img => img.id != imageId);
    const imageItems = uploadedImagesContainer.querySelectorAll('.uploaded-image-item');
    imageItems.forEach(item => {
      const button = item.querySelector('.remove-image-btn');
      if (button && button.getAttribute('onclick').includes(imageId)) {
        item.remove();
      }
    });
  };

  // Quill 에디터의 이미지 삽입 기능 오버라이드
  quill.getModule('toolbar').addHandler('image', () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = () => {
      const file = input.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const range = quill.getSelection();
          quill.insertEmbed(range.index, 'image', e.target.result);
        };
        reader.readAsDataURL(file);
      }
    };
  });

  // 🛡️ 보안 강화된 폼 제출 이벤트
  document.getElementById('write-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // 🚨 제출 전 최종 권한 검증
    const isCurrentlyAdmin = await adminAuthManager.isAdminUser();
    
    if (!isCurrentlyAdmin) {
      alert('⚠️ 관리자 권한이 만료되었습니다. 다시 로그인해주세요.');
      closeWriteModal();
      return;
    }
    
    const category = document.getElementById('write-category').value;
    const title = document.getElementById('write-title').value;
    const content = quill.root.innerHTML; // Quill 에디터의 HTML 내용 가져오기
    
    if (!title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }
    
    if (!quill.getText().trim()) {
      alert('내용을 입력해주세요.');
      return;
    }

    try {
      // 이미지가 있다면 base64로 저장 (실제 서비스에서는 Firebase Storage 등을 사용 권장)
      let processedContent = content;
      
      // 업로드된 이미지들을 내용에 추가
      if (uploadedImages.length > 0) {
        const imageSection = uploadedImages.map(img => 
          `<p><img src="${img.dataUrl}" alt="${img.name}" style="max-width: 100%; height: auto; margin: 10px 0;"/></p>`
        ).join('');
        
        processedContent += '<div class="uploaded-images-section">' + imageSection + '</div>';
      }

      // 🔐 보안 메타데이터 추가
      const securityMetadata = {
        authorId: currentUser.uid,
        authorEmail: currentUser.email,
        createdBy: 'AdminAuthManager',
        securityLevel: 'admin-verified',
        sessionId: adminAuthManager.sessionStartTime,
        ipAddress: await adminAuthManager.getClientIP?.() || 'unknown'
      };

      await addDoc(collection(db, 'notices'), {
        category: category,
        title: title,
        content: processedContent,
        displayName: currentUser.displayName || '관리자',
        uid: currentUser.uid,
        createdAt: serverTimestamp(),
        views: 0,
        likes: 0,
        ...securityMetadata
      });
      
      alert('✅ 공지사항이 안전하게 등록되었습니다.');
      closeWriteModal();
      loadNoticesFromFirebase(); // 목록 새로고침
      
    } catch (error) {
      console.error('공지사항 등록 중 오류:', error);
      alert('❌ 공지사항 등록 중 오류가 발생했습니다.');
    }
  });
}

// 수정 모달 표시
async function showEditModal() {
  console.log('🎨 수정 모달 표시 시작:', {
    editingNoticeData: editingNoticeData ? '있음' : '없음',
    editingNoticeId: editingNoticeId
  });
  
  if (!editingNoticeData) {
    console.error('❌ 수정할 데이터가 없습니다.');
    return;
  }

  // 🚨 실시간 권한 재검증
  const isCurrentlyAdmin = await checkAdminPermission();
  
  if (!isCurrentlyAdmin) {
    alert('⚠️ 관리자 권한이 없습니다. 접근이 거부되었습니다.');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'write-modal';
  modal.innerHTML = `
    <div class="write-modal-content">
      <div class="write-modal-header">
        <h2>🔐 공지사항 수정</h2>
        <button class="close-modal" onclick="closeEditModal()">&times;</button>
      </div>
      <div class="admin-security-info">
        <i class="fas fa-shield-alt"></i>
        <span>보안 인증된 관리자 세션</span>
      </div>
      <form id="edit-form" class="write-form">
        <div class="form-group">
          <label>카테고리</label>
          <select id="edit-category" required>
            <option value="general" ${editingNoticeData.category === 'general' ? 'selected' : ''}>일반</option>
            <option value="update" ${editingNoticeData.category === 'update' ? 'selected' : ''}>업데이트</option>
          </select>
        </div>
        <div class="form-group">
          <label>제목</label>
          <input type="text" id="edit-title" required placeholder="공지사항 제목을 입력하세요" value="${editingNoticeData.title}">
        </div>
        <div class="quill-editor-container">
          <label>내용</label>
          <div id="edit-editor" placeholder="공지사항 내용을 입력하세요. 이미지, 링크, 서식 등을 자유롭게 사용할 수 있습니다.">${editingNoticeData.content}</div>
        </div>
        <div class="form-actions">
          <button type="button" onclick="closeEditModal()">취소</button>
          <button type="submit">수정 완료</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Quill 에디터 초기화
  const quill = new Quill('#edit-editor', {
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

  // 수정 폼 제출 이벤트
  document.getElementById('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const isCurrentlyAdmin = await checkAdminPermission();
    
    if (!isCurrentlyAdmin) {
      alert('⚠️ 관리자 권한이 만료되었습니다. 다시 로그인해주세요.');
      closeEditModal();
      return;
    }
    
    const category = document.getElementById('edit-category').value;
    const title = document.getElementById('edit-title').value;
    const content = quill.root.innerHTML;
    
    if (!title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }
    
    if (!quill.getText().trim()) {
      alert('내용을 입력해주세요.');
      return;
    }

    try {
      await updateDoc(doc(db, 'notices', editingNoticeId), {
        category: category,
        title: title,
        content: content,
        updatedAt: serverTimestamp()
      });
      
      alert('✅ 공지사항이 수정되었습니다.');
      closeEditModal();
      loadNoticesFromFirebase(); // 목록 새로고침
      
    } catch (error) {
      console.error('공지사항 수정 중 오류:', error);
      alert('❌ 공지사항 수정 중 오류가 발생했습니다.');
    }
  });
}

// 수정 모달 닫기
window.closeEditModal = function() {
  const modal = document.querySelector('.write-modal');
  if (modal) {
    modal.remove();
  }
  // 수정 데이터 초기화
  editingNoticeData = null;
  editingNoticeId = null;
};

// 공지사항 수정 (전역 함수)
window.editNotice = async function(noticeId) {
  console.log('✏️ 수정 버튼 클릭:', { noticeId, isAdmin });
  
  const adminStatus = await checkAdminPermission();
  if (!adminStatus) {
    alert('관리자 권한이 필요합니다.');
    return;
  }
  
  // 바로 수정 모달 열기
  editingNoticeId = noticeId;
  await loadNoticeForEdit(noticeId);
};

// 공지사항 삭제 (전역 함수)
window.deleteNotice = async function(noticeId) {
  console.log('🗑️ 삭제 버튼 클릭:', { noticeId, isAdmin });
  
  const adminStatus = await checkAdminPermission();
  if (!adminStatus) {
    alert('관리자 권한이 필요합니다.');
    return;
  }

  if (!confirm('정말로 이 공지사항을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
    return;
  }

  try {
    // 관련 데이터들도 함께 삭제
    const batch = writeBatch(db);
    
    // 공지사항 삭제
    batch.delete(doc(db, 'notices', noticeId));
    
    // 관련 댓글들 삭제
    const commentsQuery = query(collection(db, 'notice_comments'), where('noticeId', '==', noticeId));
    const commentsSnapshot = await getDocs(commentsQuery);
    commentsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // 관련 좋아요들 삭제
    const likesQuery = query(collection(db, 'notice_likes'), where('noticeId', '==', noticeId));
    const likesSnapshot = await getDocs(likesQuery);
    likesSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // 관련 저장들 삭제
    const savesQuery = query(collection(db, 'notice_saves'), where('noticeId', '==', noticeId));
    const savesSnapshot = await getDocs(savesQuery);
    savesSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    alert('공지사항이 삭제되었습니다.');
    loadNoticesFromFirebase(); // 목록 새로고침
    
  } catch (error) {
    console.error('공지사항 삭제 중 오류:', error);
    alert('공지사항 삭제 중 오류가 발생했습니다.');
  }
};

// 작성 모달 닫기
window.closeWriteModal = function() {
  const modal = document.querySelector('.write-modal');
  if (modal) {
    modal.remove();
  }
};

// 🔥 LEGACY CODE REMOVED - AdminAuthManager handles this
// let currentUser = null; 