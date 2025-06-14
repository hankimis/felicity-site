import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, collection, query, where, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// DOM Elements
const profilePicPreview = document.getElementById('profile-picture-preview');
const profilePicInput = document.getElementById('profile-picture-input');
const changePicBtn = document.getElementById('change-picture-btn');
const displayNameInput = document.getElementById('display-name');
const emailInput = document.getElementById('email');
const profileUpdateForm = document.getElementById('profile-update-form');
const saveProfileBtn = document.getElementById('save-profile-btn');
const uploadStatus = document.getElementById('upload-status');
const userLevelDisplay = document.getElementById('user-level-display');
const pointsHistoryDisplay = document.getElementById('points-history-display');

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        await loadUserData(user);
        await loadUserLevelInfo();
        await loadPointsHistory();
    } else {
        // Not logged in, redirect to home page
        window.location.href = 'index.html';
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
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showStatus('이미지 크기는 5MB를 초과할 수 없습니다.', 'error');
        return;
    }

    const storageRef = ref(storage, `profilePictures/${auth.currentUser.uid}/${file.name}`);
    showStatus('이미지 업로드 중...', 'info');

    try {
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        // Update profile in Auth and Firestore
        await updateProfile(auth.currentUser, { photoURL: downloadURL });
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        await updateDoc(userDocRef, { photoURL: downloadURL });

        profilePicPreview.src = downloadURL;
        showStatus('프로필 사진이 업데이트되었습니다.', 'success');
    } catch (error) {
        console.error("Error uploading profile picture: ", error);
        showStatus('업로드에 실패했습니다. 다시 시도해주세요.', 'error');
    }
});

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

    saveProfileBtn.disabled = true;
    saveProfileBtn.innerHTML = '<span class="loading-spinner"></span> 저장 중...';

    try {
        // Update profile in Auth and Firestore
        await updateProfile(currentUser, { displayName: newDisplayName });
        const userDocRef = doc(db, "users", currentUser.uid);
        await updateDoc(userDocRef, { displayName: newDisplayName });

        currentUser.displayName = newDisplayName;
        showMessage('프로필이 성공적으로 업데이트되었습니다.', 'success');
    } catch (error) {
        console.error("Error updating profile: ", error);
        showMessage('프로필 업데이트에 실패했습니다.', 'error');
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
                getIdToken: user.getIdToken.bind(user) // Auth 메서드 보존
            };
            
            displayNameInput.value = userData.displayName || '';
            emailInput.value = userData.email || user.email;
            
            if (userData.photoURL) {
                profilePicPreview.src = userData.photoURL;
            }
        } else {
            currentUser = {
                uid: user.uid,
                displayName: user.displayName || '',
                email: user.email,
                points: 0,
                level: "새싹",
                getIdToken: user.getIdToken.bind(user) // Auth 메서드 보존
            };
        }
    } catch (error) {
        console.error('사용자 데이터 로드 오류:', error);
    }
}

// 사용자 레벨 정보 표시
async function loadUserLevelInfo() {
    if (!currentUser || !window.levelSystem) return;
    
    const userPoints = currentUser.points || 0;
    const levelInfo = window.levelSystem.calculateLevel(userPoints);
    const nextLevelInfo = window.levelSystem.getNextLevel(userPoints);
    
    const progressPercent = nextLevelInfo ? 
        ((userPoints - levelInfo.minExp) / (nextLevelInfo.minExp - levelInfo.minExp)) * 100 : 100;
    
    userLevelDisplay.innerHTML = `
        <div class="level-display-container">
            <div class="current-level-info">
                <div class="level-badge-display" style="background: ${levelInfo.gradient || levelInfo.color}">
                    <i class="fas fa-star"></i>
                    <span class="level-name">${levelInfo.name}</span>
                </div>
                <div class="level-stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon">💎</div>
                        <div class="stat-content">
                            <span class="stat-label">현재 포인트</span>
                            <span class="stat-value">${userPoints.toLocaleString()}P</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">📊</div>
                        <div class="stat-content">
                            <span class="stat-label">레벨 범위</span>
                            <span class="stat-value">${levelInfo.minExp.toLocaleString()}-${levelInfo.maxExp.toLocaleString()}</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">🎯</div>
                        <div class="stat-content">
                            <span class="stat-label">진행률</span>
                            <span class="stat-value">${Math.round(progressPercent)}%</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="level-progress-section">
                <div class="progress-header">
                    <span class="progress-title">레벨 진행도</span>
                    <span class="progress-info">
                        ${nextLevelInfo ? `${nextLevelInfo.name}까지 ${(nextLevelInfo.minExp - userPoints).toLocaleString()}P 남음` : '최고 레벨 달성!'}
                    </span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${progressPercent}%; background: ${levelInfo.gradient || levelInfo.color}">
                            <div class="progress-shimmer"></div>
                        </div>
                    </div>
                    <div class="progress-labels">
                        <span>${levelInfo.name}</span>
                        ${nextLevelInfo ? `<span>${nextLevelInfo.name}</span>` : '<span>MAX</span>'}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 포인트 히스토리 로드
async function loadPointsHistory() {
    if (!currentUser) return;
    
    pointsHistoryDisplay.innerHTML = '<div class="loading-container"><span class="loading-spinner"></span> 히스토리 로딩 중...</div>';
    
    try {
        const historyQuery = query(
            collection(db, 'pointHistory'),
            where('userId', '==', currentUser.uid),
            orderBy('timestamp', 'desc'),
            limit(15)
        );
        
        const historySnapshot = await getDocs(historyQuery);
        
        if (historySnapshot.empty) {
            pointsHistoryDisplay.innerHTML = `
                <div class="no-history">
                    <i class="fas fa-history"></i>
                    <h3>포인트 히스토리가 없습니다</h3>
                    <p>활동을 시작하여 포인트를 획득해보세요!</p>
                </div>
            `;
            return;
        }
        
        const historyHTML = historySnapshot.docs.map(doc => {
            const data = doc.data();
            const date = data.timestamp?.toDate?.() || new Date();
            const actionText = getActionText(data.action);
            const pointsClass = data.points > 0 ? 'positive' : 'negative';
            const actionIcon = getActionIcon(data.action);
            
            return `
                <div class="history-item">
                    <div class="history-info">
                        <div class="history-icon">${actionIcon}</div>
                        <div class="history-details">
                            <span class="history-action">${actionText}</span>
                            <span class="history-date">${formatDate(date)}</span>
                        </div>
                    </div>
                    <span class="history-points ${pointsClass}">
                        ${data.points > 0 ? '+' : ''}${data.points}P
                    </span>
                </div>
            `;
        }).join('');
        
        pointsHistoryDisplay.innerHTML = historyHTML;
    } catch (error) {
        console.error('포인트 히스토리 로드 오류:', error);
        pointsHistoryDisplay.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>히스토리를 불러올 수 없습니다</h3>
                <p>잠시 후 다시 시도해주세요.</p>
            </div>
        `;
    }
}

// 액션 텍스트 변환
function getActionText(action) {
    const actionMap = {
        'attendance': '출석체크 완료',
        'comment': '댓글 작성',
        'like_received': '좋아요 받음',
        'post_created': '게시글 작성',
        'daily_login': '일일 로그인',
        'level_up_bonus': '레벨업 보너스',
        'admin_adjustment': '관리자 조정'
    };
    return actionMap[action] || action;
}

// 액션 아이콘 반환
function getActionIcon(action) {
    const iconMap = {
        'attendance': '📅',
        'comment': '💬',
        'like_received': '❤️',
        'post_created': '✍️',
        'daily_login': '🎁',
        'level_up_bonus': '🎉',
        'admin_adjustment': '⚙️'
    };
    return iconMap[action] || '⭐';
}

// 날짜 포맷팅
function formatDate(date) {
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
        return '오늘';
    } else if (diffDays === 2) {
        return '어제';
    } else if (diffDays <= 7) {
        return `${diffDays - 1}일 전`;
    } else {
        return date.toLocaleDateString('ko-KR');
    }
}

// 레벨 시스템이 로드될 때까지 기다림
function waitForLevelSystem() {
    if (window.levelSystem) {
        loadUserLevelInfo();
    } else {
        setTimeout(waitForLevelSystem, 100);
    }
}

// 페이지 로드 시 레벨 시스템 대기
document.addEventListener('DOMContentLoaded', () => {
    waitForLevelSystem();
});

// 추가 CSS 스타일을 동적으로 추가
const additionalStyles = `
<style>
.level-display-container {
    display: grid;
    gap: 25px;
}

.current-level-info {
    display: flex;
    flex-direction: column;
    gap: 20px;
    align-items: center;
    text-align: center;
}

.level-badge-display {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 30px;
    border-radius: 50px;
    color: white;
    font-weight: 700;
    font-size: 1.3rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.level-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 15px;
    width: 100%;
}

.stat-card {
    background: var(--bg-secondary-color);
    padding: 20px;
    border-radius: 16px;
    border: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    gap: 12px;
    transition: all 0.2s ease;
}

.stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
}

.stat-icon {
    font-size: 1.5rem;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--primary-color);
    border-radius: 10px;
}

.stat-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.stat-label {
    font-size: 0.85rem;
    color: var(--text-color-secondary);
    font-weight: 500;
}

.stat-value {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-color);
}

.level-progress-section {
    background: var(--bg-secondary-color);
    padding: 25px;
    border-radius: 16px;
    border: 1px solid var(--border-color);
}

.progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
}

.progress-title {
    font-weight: 600;
    color: var(--text-color);
    font-size: 1.1rem;
}

.progress-info {
    font-size: 0.9rem;
    color: var(--text-color-secondary);
    font-weight: 500;
}

.progress-bar-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.progress-bar-bg {
    width: 100%;
    height: 12px;
    background: var(--border-color);
    border-radius: 6px;
    overflow: hidden;
    position: relative;
}

.progress-bar-fill {
    height: 100%;
    border-radius: 6px;
    transition: width 0.8s ease;
    position: relative;
    overflow: hidden;
}

.progress-shimmer {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
    animation: shimmer 2s infinite;
}

@keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
}

.progress-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: var(--text-color-secondary);
    font-weight: 500;
}

.no-history, .error-state {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-color-secondary);
}

.no-history i, .error-state i {
    font-size: 3rem;
    margin-bottom: 15px;
    color: var(--border-color);
}

.no-history h3, .error-state h3 {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-color);
    margin-bottom: 8px;
}

.no-history p, .error-state p {
    font-size: 0.95rem;
    margin: 0;
}

.loading-container {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-color-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
}

.history-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    background: var(--bg-secondary-color);
    border-radius: 12px;
    border: 1px solid var(--border-color);
    transition: all 0.2s ease;
}

.history-item:hover {
    transform: translateX(5px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

.history-info {
    display: flex;
    align-items: center;
    gap: 15px;
}

.history-icon {
    font-size: 1.5rem;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--primary-color);
    border-radius: 10px;
}

.history-details {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.history-action {
    font-weight: 600;
    color: var(--text-color);
    font-size: 1rem;
}

.history-date {
    font-size: 0.85rem;
    color: var(--text-color-secondary);
}

.history-points {
    font-weight: 700;
    font-size: 1.1rem;
    padding: 8px 16px;
    border-radius: 8px;
}

.history-points.positive {
    color: #22c55e;
    background: rgba(34, 197, 94, 0.1);
}

.history-points.negative {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
}

@media (max-width: 768px) {
    .level-stats-grid {
        grid-template-columns: 1fr;
    }
    
    .progress-header {
        flex-direction: column;
        gap: 8px;
        text-align: center;
    }
    
    .history-item {
        flex-direction: column;
        gap: 15px;
        text-align: center;
    }
    
    .history-info {
        flex-direction: column;
        gap: 10px;
    }
}
</style>
`;

// 스타일을 head에 추가
document.head.insertAdjacentHTML('beforeend', additionalStyles); 