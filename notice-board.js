import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, getCountFromServer, getDocs, limit, startAfter } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

const ADMIN_EMAIL = "admin@site.com";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const noticeList = document.getElementById('notice-list');

let allNotices = [];
let currentFilter = 'all';



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
      <a href="notice-post.html?id=${notice.id}" class="notice-item" data-id="${notice.id}">
        <span class="notice-category ${notice.category}">${categoryText}</span>
        <div class="notice-content">
          <div class="notice-title">${notice.title}</div>
          <div class="notice-date">${notice.date}</div>
        </div>
        <i class="fas fa-chevron-right notice-arrow"></i>
      </a>
    `;
  }).join('');

  noticeList.innerHTML = noticeItems;
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
        createdAt: data.createdAt ? new Date(data.createdAt.seconds * 1000) : new Date()
      });
    });
    
    allNotices = firebaseNotices;
    
  } catch (error) {
    console.log('Firebase에서 공지사항을 불러오는 중 오류:', error);
    allNotices = [];
  }
  
  renderNotices();
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  loadNoticesFromFirebase();
});

// 관리자 기능
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  checkAdminPermission();
});

function checkAdminPermission() {
  const adminWriteBtn = document.getElementById('admin-write-btn');
  
  if (currentUser && currentUser.email === ADMIN_EMAIL) {
    if (adminWriteBtn) {
      adminWriteBtn.style.display = 'flex';
      adminWriteBtn.addEventListener('click', showWriteModal);
    }
  } else {
    if (adminWriteBtn) {
      adminWriteBtn.style.display = 'none';
    }
  }
}

// 공지사항 작성 모달 표시
function showWriteModal() {
  const modal = document.createElement('div');
  modal.className = 'write-modal';
  modal.innerHTML = `
    <div class="write-modal-content">
      <div class="write-modal-header">
        <h2>공지사항 작성</h2>
        <button class="close-modal" onclick="closeWriteModal()">&times;</button>
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

  // 폼 제출 이벤트
  document.getElementById('write-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
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

      await addDoc(collection(db, 'notices'), {
        category: category,
        title: title,
        content: processedContent,
        displayName: currentUser.displayName || '관리자',
        uid: currentUser.uid,
        createdAt: serverTimestamp(),
        views: 0,
        likes: 0
      });
      
      alert('공지사항이 등록되었습니다.');
      closeWriteModal();
      loadNoticesFromFirebase(); // 목록 새로고침
      
    } catch (error) {
      console.error('공지사항 등록 중 오류:', error);
      alert('공지사항 등록 중 오류가 발생했습니다.');
    }
  });
}

// 작성 모달 닫기
window.closeWriteModal = function() {
  const modal = document.querySelector('.write-modal');
  if (modal) {
    modal.remove();
  }
};

let currentUser = null; 