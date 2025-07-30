import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from '../firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const profilePicPreview = document.getElementById('profile-picture-preview');
const profilePicInput = document.getElementById('profile-picture-input');
const changePicBtn = document.getElementById('change-picture-btn');
const displayNameInput = document.getElementById('display-name');
const emailInput = document.getElementById('email');
const profileUpdateForm = document.getElementById('profile-update-form');
const saveProfileBtn = document.getElementById('save-profile-btn');
const uploadStatus = document.getElementById('upload-status');

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        await loadUserData(user);
    } else {
        // Not logged in, redirect to home page
        window.location.href = '../index.html';
    }
});

// Trigger file input when "Change Picture" is clicked
changePicBtn.addEventListener('click', () => {
    profilePicInput.click();
});

// Handle file selection and upload
profilePicInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !auth.currentUser) return;

    // Check file type and size
    if (!file.type.startsWith('image/')) {
        showStatus('이미지 파일만 업로드할 수 있습니다.', 'error');
        return;
    }
    if (file.size > 10 * 1024 * 1024) { // 10MB limit for original file
        showStatus('이미지 크기는 10MB를 초과할 수 없습니다.', 'error');
        return;
    }

    showStatus('이미지 압축 중...', 'info');

    try {
        // 이미지 압축 및 크기 조정
        const compressedImage = await compressImage(file);
        
        // 압축된 이미지 크기 확인 (Firestore 제한: 약 1MB)
        const compressedSize = compressedImage.length;
        console.log(`압축된 이미지 크기: ${(compressedSize / 1024).toFixed(1)}KB`);
        
        if (compressedSize > 800000) { // 800KB 제한 (안전 마진)
            showStatus('이미지가 너무 큽니다. 더 작은 이미지를 선택해주세요.', 'error');
            return;
        }
        
        showStatus('Firestore에 업로드 중...', 'info');
        
        // Firestore에 압축된 Base64 이미지 저장
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        await updateDoc(userDocRef, { 
            photoURL: compressedImage,
            updatedAt: new Date()
        });

        // UI 업데이트
        profilePicPreview.src = compressedImage;
        showStatus('프로필 사진이 성공적으로 업데이트되었습니다!', 'success');
        
        // currentUser 객체 업데이트
        if (currentUser) {
            currentUser.photoURL = compressedImage;
        }
        
        // 파일 입력 초기화
        profilePicInput.value = '';
        
    } catch (error) {
        console.error("Error uploading profile picture: ", error);
        
        // 더 구체적인 오류 메시지
        if (error.message.includes('permission-denied')) {
            showStatus('업로드 권한이 없습니다.', 'error');
        } else if (error.message.includes('unavailable')) {
            showStatus('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.', 'error');
        } else if (error.message.includes('이미지 로드 실패')) {
            showStatus('이미지 파일을 읽을 수 없습니다. 다른 이미지를 선택해주세요.', 'error');
        } else {
            showStatus('업로드에 실패했습니다. 다시 시도해주세요.', 'error');
        }
        
        // 파일 입력 초기화
        profilePicInput.value = '';
    }
});

// 이미지 압축 함수
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            // 원본 이미지 크기
            const originalWidth = img.width;
            const originalHeight = img.height;
            
            // 최대 크기 설정 (프로필 이미지용)
            const maxWidth = 200;
            const maxHeight = 200;
            
            // 비율 유지하면서 크기 조정
            let { width, height } = img;
            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }
            
            // 캔버스 크기 설정
            canvas.width = width;
            canvas.height = height;
            
            // 이미지 품질 향상을 위한 설정
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // 이미지 그리기
            ctx.drawImage(img, 0, 0, width, height);
            
            // 압축 품질 동적 조정 (이미지 크기에 따라)
            let quality = 0.7; // 기본 품질 70%
            
            // 원본 이미지가 큰 경우 더 많이 압축
            if (originalWidth > 1000 || originalHeight > 1000) {
                quality = 0.6;
            }
            if (originalWidth > 2000 || originalHeight > 2000) {
                quality = 0.5;
            }
            
            // JPEG로 압축
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            
            console.log(`이미지 압축 완료: ${originalWidth}x${originalHeight} → ${width}x${height}, 품질: ${quality * 100}%`);
            
            resolve(compressedDataUrl);
        };
        
        img.onerror = () => {
            reject(new Error('이미지 로드 실패'));
        };
        
        // FileReader로 파일을 Data URL로 변환
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
        };
        reader.onerror = () => {
            reject(new Error('파일 읽기 실패'));
        };
        reader.readAsDataURL(file);
    });
}

// Handle profile info update
profileUpdateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newDisplayName = displayNameInput.value.trim();

    if (!newDisplayName || !currentUser) {
        showMessage('닉네임을 입력해주세요.', 'error');
        return;
    }
    if (newDisplayName.length > 8) {
        showMessage('닉네임은 8자 이하로 입력해주세요.', 'error');
        return;
    }
    if (newDisplayName === currentUser.displayName) {
        showMessage('현재 닉네임과 동일합니다.', 'error');
        return;
    }

    saveProfileBtn.disabled = true;
    saveProfileBtn.innerHTML = '<span class="loading-spinner"></span> 저장 중...';

    try {
        // Firestore에만 업데이트 (Auth 프로필 업데이트 제외)
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        await updateDoc(userDocRef, { 
            displayName: newDisplayName,
            updatedAt: new Date()
        });

        // currentUser 객체 업데이트
        currentUser.displayName = newDisplayName;
        
        showMessage('프로필이 성공적으로 업데이트되었습니다.', 'success');
        
    } catch (error) {
        console.error("Error updating profile: ", error);
        
        // 더 구체적인 오류 메시지
        if (error.code === 'permission-denied') {
            showMessage('프로필 업데이트 권한이 없습니다.', 'error');
        } else if (error.code === 'unavailable') {
            showMessage('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.', 'error');
        } else {
            showMessage('프로필 업데이트에 실패했습니다. 다시 시도해주세요.', 'error');
        }
    } finally {
        saveProfileBtn.disabled = false;
        saveProfileBtn.innerHTML = '변경사항 저장';
    }
});

function showStatus(message, type) {
    uploadStatus.textContent = message;
    uploadStatus.className = `upload-status ${type}`;
    setTimeout(() => {
        uploadStatus.textContent = '';
        uploadStatus.className = 'upload-status';
    }, 4000);
} 

function showMessage(message, type) {
    // 기존 메시지 제거
    const existingMessage = document.querySelector('.success-message, .error-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    // 새 메시지 생성
    const messageDiv = document.createElement('div');
    messageDiv.className = `${type}-message`;
    messageDiv.textContent = message;
    
    // 프로필 카드 하단에 추가
    const profileCard = document.querySelector('.profile-card');
    profileCard.appendChild(messageDiv);
    
    // 3초 후 제거
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 3000);
}

// 사용자 데이터 로드
async function loadUserData(user) {
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            currentUser = { 
                ...userData,
                uid: user.uid,
                email: user.email // 항상 최신 이메일 사용
            };
            
            displayNameInput.value = userData.displayName || '';
            emailInput.value = userData.email || user.email;
            
            // 프로필 이미지 표시 (Base64 또는 URL)
            if (userData.photoURL) {
                profilePicPreview.src = userData.photoURL;
            } else {
                profilePicPreview.src = 'assets/icon/profileicon.png';
            }
        } else {
            // 사용자 문서가 없는 경우 기본 데이터로 생성
            currentUser = {
                uid: user.uid,
                displayName: user.displayName || user.email?.split('@')[0] || '',
                email: user.email
            };
            
            displayNameInput.value = currentUser.displayName;
            emailInput.value = currentUser.email;
            profilePicPreview.src = 'assets/icon/profileicon.png';
            
            // Firestore에 기본 사용자 데이터 생성
            try {
                const userDocRef = doc(db, 'users', user.uid);
                await setDoc(userDocRef, {
                    displayName: currentUser.displayName,
                    email: currentUser.email,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            } catch (createError) {
                console.log('새 사용자 문서 생성:', createError);
            }
        }
    } catch (error) {
        console.error('사용자 데이터 로드 오류:', error);
        
        // 오류가 발생해도 기본값으로 설정
        currentUser = {
            uid: user.uid,
            displayName: user.displayName || user.email?.split('@')[0] || '',
            email: user.email
        };
        
        displayNameInput.value = currentUser.displayName;
        emailInput.value = currentUser.email;
        profilePicPreview.src = 'assets/icon/profileicon.png';
    }
}

// 추가 CSS 스타일을 동적으로 추가 (레벨 시스템 제거로 단순화)
const additionalStyles = `
<style>
.account-container {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
}

.profile-card {
    background: var(--bg-secondary-color);
    border-radius: 16px;
    padding: 30px;
    border: 1px solid var(--border-color);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
}

.profile-picture-section {
    text-align: center;
    margin-bottom: 30px;
}

.profile-info-section {
    max-width: 400px;
    margin: 0 auto;
}

.form-group {
    margin-bottom: 20px;
}

.form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: var(--text-color);
}

.form-group input {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-color);
    color: var(--text-color);
    font-size: 1rem;
    transition: border-color 0.2s ease;
}

.form-group input:focus {
    outline: none;
    border-color: var(--primary-color);
}

.input-hint {
    font-size: 0.85rem;
    color: var(--text-color-secondary);
    margin-top: 6px;
}

.primary-btn {
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    width: 100%;
    transition: all 0.2s ease;
}

.primary-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.secondary-btn {
    background: var(--bg-color);
    color: var(--text-color);
    border: 1px solid var(--border-color);
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
}

.secondary-btn:hover {
    background: var(--border-color);
}

.upload-status {
    margin-top: 10px;
    font-size: 0.9rem;
    text-align: center;
}

.upload-status.success {
    color: #22c55e;
}

.upload-status.error {
    color: #ef4444;
}

.upload-status.info {
    color: var(--primary-color);
}

.success-message {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
    padding: 12px 16px;
    border-radius: 8px;
    margin-top: 15px;
    font-weight: 500;
}

.error-message {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    padding: 12px 16px;
    border-radius: 8px;
    margin-top: 15px;
    font-weight: 500;
}

.loading-spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
    .account-container {
        padding: 15px;
    }
    
    .profile-card {
        padding: 20px;
    }
}
</style>
`;

// 스타일을 head에 추가
document.head.insertAdjacentHTML('beforeend', additionalStyles); 