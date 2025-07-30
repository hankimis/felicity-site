import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy, getDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { firebaseConfig } from '../firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// DOM 요소들
const eventList = document.getElementById('event-list');
const writeBtn = document.getElementById('write-event-btn');
const eventModal = document.getElementById('event-modal');
const closeEventModal = document.getElementById('close-event-modal');
const eventForm = document.getElementById('event-form');
const eventImgFile = document.getElementById('event-img-file');
const eventImgUrl = document.getElementById('event-img-url');
const uploadImageBtn = document.getElementById('upload-image-btn');
const removeImageBtn = document.getElementById('remove-image-btn');
const toggleUrlBtn = document.getElementById('toggle-url-input');
const urlInputContainer = document.getElementById('url-input-container');
const uploadProgress = document.getElementById('upload-progress');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const exchangeSelect = document.getElementById('event-exchange');
const exchangePreview = document.getElementById('exchange-preview');
const exchangePreviewLogo = document.getElementById('exchange-preview-logo');
const exchangePreviewName = document.getElementById('exchange-preview-name');
const customExchangeGroup = document.getElementById('custom-exchange-group');
const customLogoGroup = document.getElementById('custom-logo-group');
const customExchangeName = document.getElementById('custom-exchange-name');
const customLogoUrl = document.getElementById('custom-logo-url');
const previewEventImg = document.getElementById('preview-event-img');
const eventFormMessage = document.getElementById('event-form-message');

let currentUser = null;
let isAdmin = false;
let currentImageUrl = null;
let uploadTask = null;
let isEditing = false;
let editingEventId = null;

// 이미지 최적화 클래스
class ImageOptimizer {
  constructor() {
    this.imageCache = new Map();
  }

  // WebP 지원 확인
  supportsWebP() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }

  // 이미지 압축
  async compressImage(file, maxWidth = 800, maxHeight = 600, quality = 0.8) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
        const newWidth = img.width * ratio;
        const newHeight = img.height * ratio;
        
        canvas.width = newWidth;
        canvas.height = newHeight;
        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        
        const mimeType = this.supportsWebP() ? 'image/webp' : 'image/jpeg';
        canvas.toBlob(resolve, mimeType, quality);
      };
      
      img.src = URL.createObjectURL(file);
    });
  }
}

const imageOptimizer = new ImageOptimizer();

// Firebase 인증 상태 변경 감지
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  
  if (user) {
    // 사용자 정보 가져오기
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // 다양한 관리자 권한 확인 방식
        isAdmin = userData.isAdmin === true || 
                 userData.role === 'admin' || 
                 userData.admin === true ||
                 (userData.permissions && userData.permissions.includes('admin'));
      } else {
        isAdmin = false;
        
        // 문서가 없는 경우 기본 사용자 문서 생성
        try {
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || '',
            isAdmin: false,
            role: 'user',
            createdAt: serverTimestamp()
          });
        } catch (createError) {
          console.error('사용자 문서 생성 실패:', createError);
        }
      }
    } catch (error) {
      console.error('사용자 정보 조회 실패:', error);
      isAdmin = false;
    }
  } else {
    isAdmin = false;
  }
  
  // UI 업데이트
  updateUI();
  renderEvents();
});

// UI 업데이트
function updateUI() {
  if (writeBtn) {
    writeBtn.style.display = isAdmin ? 'block' : 'none';
    
    // 관리자인 경우 버튼 스타일 적용
    if (isAdmin) {
      writeBtn.innerHTML = '<i class="fas fa-plus"></i> 이벤트 작성';
    }
  }
}

// 이벤트 목록 렌더링
async function renderEvents() {
  if (!eventList) return;
  
  eventList.innerHTML = '<div class="loading">이벤트를 불러오는 중...</div>';
  
  try {
    const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    eventList.innerHTML = '';
    
    if (snapshot.empty) {
      eventList.innerHTML = '<div class="no-events">등록된 이벤트가 없습니다.</div>';
      return;
    }
    
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const card = createEventCard(docSnap.id, data);
      eventList.appendChild(card);
    });
  } catch (error) {
    console.error('이벤트 조회 실패:', error);
    eventList.innerHTML = '<div class="error">이벤트를 불러오는데 실패했습니다.</div>';
  }
}

// 이벤트 카드 생성
function createEventCard(id, data) {
  const card = document.createElement('div');
  card.className = 'event-card';
  
  // 로고 경로 수정
  let logoPath = data.logo;
  if (logoPath && logoPath.startsWith('assets/')) {
    logoPath = '../' + logoPath;
  } else if (logoPath && logoPath.startsWith('/assets/')) {
    logoPath = '..' + logoPath;
  }
  
  card.innerHTML = `
    <button class="event-card-btn" ${data.link ? `data-link="${data.link}"` : ''}>
      <div class="event-card-inner">
        <div class="event-card-left">
          <div>
            <div class="event-card-timer">
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20" color="#8b94a9">
                <path d="M3 7.02381C3 5.52475 4.20883 4.30952 5.7 4.30952H18.3C19.7912 4.30952 21 5.52475 21 7.02381V18.7857C21 20.2848 19.7912 21.5 18.3 21.5H5.7C4.20883 21.5 3 20.2848 3 18.7857V7.02381Z" fill="#E5E9EE"></path>
                <path d="M7.5 3.85714C7.5 3.10761 8.10442 2.5 8.85 2.5C9.59558 2.5 10.2 3.10761 10.2 3.85714V5.66667C10.2 6.4162 9.59558 7.02381 8.85 7.02381C8.10442 7.02381 7.5 6.4162 7.5 5.66667V3.85714Z" fill="#151E42"></path>
                <path d="M13.8 3.85714C13.8 3.10761 14.4044 2.5 15.15 2.5C15.8956 2.5 16.5 3.10761 16.5 3.85714V5.66667C16.5 6.4162 15.8956 7.02381 15.15 7.02381C14.4044 7.02381 13.8 6.4162 13.8 5.66667V3.85714Z" fill="#151E42"></path>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M16.266 10.939C16.6003 11.3088 16.5732 11.881 16.2054 12.2171L10.9078 17.0586C10.7183 17.2318 10.4234 17.2113 10.2594 17.0135L7.70862 13.9364C7.39042 13.5525 7.44201 12.982 7.82386 12.6621C8.20571 12.3422 8.77321 12.3941 9.09142 12.7779L10.4391 14.4037C10.6031 14.6015 10.898 14.6221 11.0875 14.4489L14.9946 10.8782C15.3624 10.542 15.9316 10.5693 16.266 10.939Z" fill="#0067FF"></path>
              </svg>
              <span>${data.period}</span>
            </div>
            <div class="event-card-title">${data.title}</div>
            <div class="event-card-desc">${data.desc}</div>
          </div>
          <div class="event-card-exchange-row">
            <img class="event-card-exchange-logo" 
                 src="${logoPath}" 
                 alt="${data.exchange}" 
                 loading="lazy" />
            <span class="event-card-exchange-name">${data.exchange}</span>
            ${isAdmin ? `
              <button class="event-card-edit" data-id="${id}" title="수정">
                <i class="fas fa-edit"></i>
              </button>
              <button class="event-card-delete" data-id="${id}" title="삭제">
                <i class="fas fa-trash-alt"></i>
              </button>
            ` : ''}
          </div>
        </div>
        <div class="event-card-img-wrap">
          <img class="event-card-img" 
               src="${data.img}" 
               alt="${data.exchange} Event" 
               loading="lazy" />
        </div>
      </div>
    </button>
  `;
  
  // 이벤트 리스너 추가
  setupCardEventListeners(card, id);
  
  return card;
}

// 카드 이벤트 리스너 설정
function setupCardEventListeners(card, id) {
  // 카드 클릭 시 링크 이동
  const cardBtn = card.querySelector('.event-card-btn[data-link]');
  if (cardBtn) {
    cardBtn.addEventListener('click', (e) => {
      if (e.target.closest('.event-card-edit') || e.target.closest('.event-card-delete')) {
        return; // 편집/삭제 버튼 클릭 시 링크 이동 방지
      }
      const link = cardBtn.getAttribute('data-link');
      if (link) window.open(link, '_blank');
    });
  }
  
  // 수정 버튼
  const editBtn = card.querySelector('.event-card-edit');
  if (editBtn) {
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      editEvent(id);
    });
  }
  
  // 삭제 버튼
  const deleteBtn = card.querySelector('.event-card-delete');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteEvent(id);
    });
  }
}

// 이벤트 수정
async function editEvent(id) {
  if (!isAdmin) {
    alert('관리자 권한이 필요합니다.');
    return;
  }
  
  try {
    const eventDoc = await getDoc(doc(db, 'events', id));
    if (!eventDoc.exists()) {
      alert('이벤트를 찾을 수 없습니다.');
      return;
    }
    
    const data = eventDoc.data();
    
    // 편집 모드 설정
    isEditing = true;
    editingEventId = id;
    
    // 폼에 데이터 채우기
    document.getElementById('event-title').value = data.title || '';
    document.getElementById('event-desc').value = data.desc || '';
    document.getElementById('event-period').value = data.period || '';
    document.getElementById('event-link').value = data.link || '';
    
    // 이미지 설정
    if (data.img) {
      currentImageUrl = data.img;
      showImagePreview(data.img);
    }
    
    // 거래소 선택 설정
    setupExchangeSelection(data);
    
    // 모달 제목 변경
    const modalTitle = eventModal.querySelector('h2');
    if (modalTitle) modalTitle.textContent = '이벤트 수정';
    
    // 버튼 텍스트 변경
    const submitBtn = eventForm.querySelector('.submit-btn');
    if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-edit"></i> 수정하기';
    
    // 모달 열기
    openModal();
    
  } catch (error) {
    console.error('이벤트 수정 준비 실패:', error);
    alert('이벤트 정보를 불러오는데 실패했습니다.');
  }
}

// 거래소 선택 설정 (수정 시)
function setupExchangeSelection(data) {
  const exchangeName = data.exchange;
  let logoPath = data.logo;
  const customInputs = document.querySelector('.custom-exchange-inputs');
  
  // 로고 경로 수정
  if (logoPath && logoPath.startsWith('assets/')) {
    logoPath = '../' + logoPath;
  } else if (logoPath && logoPath.startsWith('/assets/')) {
    logoPath = '..' + logoPath;
  }
  
  // 기본 거래소 목록에서 찾기
  let foundOption = false;
  for (let option of exchangeSelect.options) {
    if (option.value === exchangeName && option.getAttribute('data-logo') === logoPath) {
      exchangeSelect.value = exchangeName;
      foundOption = true;
      break;
    }
  }
  
  if (!foundOption) {
    // 기타 거래소인 경우
    exchangeSelect.value = '기타';
    customExchangeName.value = exchangeName;
    customLogoUrl.value = logoPath;
    customExchangeGroup.style.display = 'block';
    customLogoGroup.style.display = 'block';
    if (customInputs) customInputs.style.display = 'block';
  } else {
    customExchangeGroup.style.display = 'none';
    customLogoGroup.style.display = 'none';
    if (customInputs) customInputs.style.display = 'none';
  }
  
  // 미리보기 표시
  if (logoPath) {
    exchangePreviewLogo.src = logoPath;
    exchangePreviewName.textContent = exchangeName;
    exchangePreview.style.display = 'flex';
  }
}

// 이벤트 삭제
async function deleteEvent(id) {
  if (!isAdmin) {
    alert('관리자 권한이 필요합니다.');
    return;
  }
  
  if (!confirm('정말로 삭제하시겠습니까?')) {
    return;
  }
  
  try {
    await deleteDoc(doc(db, 'events', id));
    showMessage('이벤트가 삭제되었습니다.', 'success');
    renderEvents();
  } catch (error) {
    console.error('이벤트 삭제 실패:', error);
    showMessage('삭제 중 오류가 발생했습니다.', 'error');
  }
}

// 이미지 업로드
async function uploadImageFile(file) {
  return new Promise(async (resolve, reject) => {
    try {
      // 이미지 압축
      const compressedFile = await imageOptimizer.compressImage(file, 800, 600, 0.85);
      
      // 파일 크기 검증 (5MB 제한)
      if (compressedFile.size > 5 * 1024 * 1024) {
        reject(new Error('파일 크기가 5MB를 초과합니다.'));
        return;
      }
      
      // 파일명 생성
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const extension = compressedFile.type.split('/')[1];
      const fileName = `events/${timestamp}_${randomString}.${extension}`;
      
      // Firebase Storage 업로드
      const storageRef = ref(storage, fileName);
      uploadTask = uploadBytesResumable(storageRef, compressedFile);
      
      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          updateUploadProgress(progress);
        },
        (error) => {
          console.error('업로드 실패:', error);
          hideUploadProgress();
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            hideUploadProgress();
            resolve(downloadURL);
          } catch (error) {
            hideUploadProgress();
            reject(error);
          }
        }
      );
    } catch (error) {
      console.error('이미지 처리 실패:', error);
      reject(error);
    }
  });
}

// 업로드 진행률 표시
function updateUploadProgress(progress) {
  if (uploadProgress && progressFill && progressText) {
    uploadProgress.style.display = 'block';
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `${Math.round(progress)}%`;
    
    if (uploadImageBtn) {
      uploadImageBtn.disabled = true;
      uploadImageBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 업로드 중...';
    }
  }
}

// 업로드 진행률 숨기기
function hideUploadProgress() {
  if (uploadProgress) {
    uploadProgress.style.display = 'none';
  }
  if (progressFill) {
    progressFill.style.width = '0%';
  }
  if (progressText) {
    progressText.textContent = '0%';
  }
  
  if (uploadImageBtn) {
    uploadImageBtn.disabled = false;
    uploadImageBtn.innerHTML = '<i class="fas fa-upload"></i> 이미지 업로드';
  }
}

// 이미지 미리보기 표시
function showImagePreview(url) {
  if (previewEventImg && removeImageBtn) {
    previewEventImg.src = url;
    previewEventImg.style.display = 'block';
    removeImageBtn.style.display = 'block';
    currentImageUrl = url;
  }
}

// 이미지 미리보기 제거
function removeImagePreview() {
  if (previewEventImg && removeImageBtn) {
    previewEventImg.style.display = 'none';
    removeImageBtn.style.display = 'none';
    currentImageUrl = null;
    
    if (eventImgFile) eventImgFile.value = '';
    if (eventImgUrl) eventImgUrl.value = '';
  }
}

// 모달 열기
function openModal() {
  if (eventModal) {
    eventModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

// 모달 닫기
function closeModal() {
  if (eventModal) {
    eventModal.style.display = 'none';
    document.body.style.overflow = '';
    resetForm();
  }
}

// 폼 리셋
function resetForm() {
  if (eventForm) eventForm.reset();
  
  isEditing = false;
  editingEventId = null;
  
  // 이미지 관련 리셋
  removeImagePreview();
  if (uploadTask) {
    uploadTask.cancel();
    uploadTask = null;
    hideUploadProgress();
  }
  
  // URL 입력 컨테이너 숨기기
  if (urlInputContainer) {
    urlInputContainer.style.display = 'none';
  }
  if (toggleUrlBtn) {
    toggleUrlBtn.innerHTML = '<i class="fas fa-link"></i> <span>URL 입력</span>';
  }
  
  // 거래소 미리보기 숨기기
  const customInputs = document.querySelector('.custom-exchange-inputs');
  if (exchangePreview) exchangePreview.style.display = 'none';
  if (customExchangeGroup) customExchangeGroup.style.display = 'none';
  if (customLogoGroup) customLogoGroup.style.display = 'none';
  if (customInputs) customInputs.style.display = 'none';
  
  // 모달 제목과 버튼 텍스트 원복
  const modalTitle = eventModal.querySelector('h2');
  if (modalTitle) modalTitle.textContent = '이벤트 작성';
  
  const submitBtn = eventForm.querySelector('.submit-btn');
  if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> 등록하기';
  
  clearFormMessage();
}

// 메시지 표시
function showMessage(message, type = 'info') {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message message-${type}`;
  messageDiv.textContent = message;
  messageDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 5px;
    color: white;
    font-weight: bold;
    z-index: 10000;
    transition: opacity 0.3s ease;
    ${type === 'success' ? 'background-color: #4caf50;' : 
      type === 'error' ? 'background-color: #f44336;' : 
      'background-color: #2196f3;'}
  `;
  
  document.body.appendChild(messageDiv);
  
  setTimeout(() => {
    messageDiv.style.opacity = '0';
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.parentNode.removeChild(messageDiv);
      }
    }, 300);
  }, 3000);
}

// 폼 메시지 표시
function showFormMessage(msg, color = '#ef5350') {
  if (eventFormMessage) {
    eventFormMessage.textContent = msg;
    eventFormMessage.style.color = color;
  }
}

// 폼 메시지 지우기
function clearFormMessage() {
  if (eventFormMessage) eventFormMessage.textContent = '';
}

// 이벤트 리스너 설정
function setupEventListeners() {
  // 작성 버튼
  if (writeBtn) {
    writeBtn.addEventListener('click', () => {
      if (!isAdmin) {
        alert('관리자 권한이 필요합니다.');
        return;
      }
      openModal();
    });
  }
  
  // 모달 닫기
  if (closeEventModal) {
    closeEventModal.addEventListener('click', closeModal);
  }
  
  // 모달 외부 클릭 시 닫기
  if (eventModal) {
    eventModal.addEventListener('click', (e) => {
      if (e.target === eventModal) {
        closeModal();
      }
    });
  }
  
  // 이미지 업로드 버튼
  if (uploadImageBtn && eventImgFile) {
    uploadImageBtn.addEventListener('click', () => {
      eventImgFile.click();
    });
  }
  
  // 파일 선택
  if (eventImgFile) {
    eventImgFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        if (!isAdmin) {
          showFormMessage('관리자 권한이 필요합니다.');
          return;
        }
        
        try {
          showFormMessage('이미지 업로드 중...', '#1976d2');
          const downloadURL = await uploadImageFile(file);
          showImagePreview(downloadURL);
          showFormMessage('이미지 업로드 완료!', '#388e3c');
          setTimeout(() => clearFormMessage(), 2000);
        } catch (error) {
          console.error('이미지 업로드 실패:', error);
          showFormMessage(error.message || '이미지 업로드에 실패했습니다.');
          removeImagePreview();
        }
      }
    });
  }
  
  // 이미지 제거 버튼
  if (removeImageBtn) {
    removeImageBtn.addEventListener('click', removeImagePreview);
  }
  
  // URL 입력 토글
  if (toggleUrlBtn && urlInputContainer) {
    toggleUrlBtn.addEventListener('click', () => {
      const isVisible = urlInputContainer.style.display !== 'none';
      urlInputContainer.style.display = isVisible ? 'none' : 'block';
      toggleUrlBtn.innerHTML = isVisible ? 
        '<i class="fas fa-link"></i> <span>URL 입력</span>' : 
        '<i class="fas fa-times"></i> <span>URL 닫기</span>';
    });
  }
  
  // URL 입력
  if (eventImgUrl) {
    eventImgUrl.addEventListener('input', (e) => {
      const url = e.target.value.trim();
      if (url && /^https?:\/\//.test(url)) {
        showImagePreview(url);
      } else if (!url) {
        removeImagePreview();
      }
    });
  }
  
  // 거래소 선택
  if (exchangeSelect) {
    exchangeSelect.addEventListener('change', (e) => {
      const selectedOption = e.target.selectedOptions[0];
      const exchangeName = selectedOption.value;
      const logoPath = selectedOption.getAttribute('data-logo');
      const customInputs = document.querySelector('.custom-exchange-inputs');
      
      if (exchangeName === '기타') {
        customExchangeGroup.style.display = 'block';
        customLogoGroup.style.display = 'block';
        if (customInputs) customInputs.style.display = 'block';
        exchangePreview.style.display = 'none';
      } else if (exchangeName && logoPath) {
        exchangePreviewLogo.src = logoPath;
        exchangePreviewName.textContent = exchangeName;
        exchangePreview.style.display = 'flex';
        customExchangeGroup.style.display = 'none';
        customLogoGroup.style.display = 'none';
        if (customInputs) customInputs.style.display = 'none';
      } else {
        exchangePreview.style.display = 'none';
        customExchangeGroup.style.display = 'none';
        customLogoGroup.style.display = 'none';
        if (customInputs) customInputs.style.display = 'none';
      }
    });
  }
  
  // 커스텀 로고 URL 미리보기
  if (customLogoUrl) {
    customLogoUrl.addEventListener('input', (e) => {
      const url = e.target.value.trim();
      if (url && /^https?:\/\//.test(url)) {
        exchangePreviewLogo.src = url;
        exchangePreviewName.textContent = customExchangeName.value || '사용자 지정';
        exchangePreview.style.display = 'flex';
      } else {
        exchangePreview.style.display = 'none';
      }
    });
  }
  
  if (customExchangeName) {
    customExchangeName.addEventListener('input', (e) => {
      if (exchangePreview.style.display === 'flex') {
        exchangePreviewName.textContent = e.target.value || '사용자 지정';
      }
    });
  }
  
  // 폼 제출
  if (eventForm) {
    eventForm.addEventListener('submit', handleFormSubmit);
  }
}

// 폼 제출 처리
async function handleFormSubmit(e) {
  e.preventDefault();
  
  if (!isAdmin) {
    showFormMessage('관리자 권한이 필요합니다.');
    return;
  }
  
  clearFormMessage();
  
  // 폼 데이터 수집
  const title = document.getElementById('event-title').value.trim();
  const desc = document.getElementById('event-desc').value.trim();
  const period = document.getElementById('event-period').value.trim();
  const link = document.getElementById('event-link').value.trim();
  
  // 이미지 URL 가져오기
  let img = currentImageUrl || '';
  if (!img && eventImgUrl) {
    img = eventImgUrl.value.trim();
  }
  
  // 거래소 정보 처리
  const selectedExchange = exchangeSelect.value;
  let exchange, logo;
  
  if (selectedExchange === '기타') {
    exchange = customExchangeName.value.trim();
    logo = customLogoUrl.value.trim();
  } else if (selectedExchange) {
    exchange = selectedExchange;
    logo = exchangeSelect.selectedOptions[0].getAttribute('data-logo');
  }
  
  // 유효성 검사
  if (!title || !desc || !period || !exchange || !img || !logo || !link) {
    showFormMessage('모든 항목을 입력해 주세요.');
    return;
  }
  
  if (title.length > 40) {
    showFormMessage('제목은 40자 이하로 입력해주세요.');
    return;
  }
  
  if (desc.length > 120) {
    showFormMessage('설명은 120자 이하로 입력해주세요.');
    return;
  }
  
  try {
    showFormMessage('처리 중입니다...', '#1976d2');
    
    const eventData = {
      title,
      desc,
      period,
      exchange,
      img,
      logo,
      link,
      lastModified: serverTimestamp()
    };
    
    if (isEditing && editingEventId) {
      // 수정
      await updateDoc(doc(db, 'events', editingEventId), eventData);
      showFormMessage('수정 완료!', '#388e3c');
    } else {
      // 새로 등록
      eventData.createdAt = serverTimestamp();
      await addDoc(collection(db, 'events'), eventData);
      showFormMessage('등록 완료!', '#388e3c');
    }
    
    setTimeout(() => {
      closeModal();
      renderEvents();
    }, 1000);
    
  } catch (error) {
    console.error('이벤트 저장 실패:', error);
    showFormMessage('저장 중 오류가 발생했습니다.');
  }
}

// 초기화
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  renderEvents();
});

 