import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, deleteDoc, updateDoc, addDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from '../firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import adminAuthManager from '../js/admin-auth-manager.js';

console.log("admin.js started");

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const adminDashboard = document.getElementById('admin-dashboard');
const accessDenied = document.getElementById('admin-access-denied');
const totalUsersCount = document.getElementById('total-users-count');
const newUsersCount = document.getElementById('new-users-count');
const usersTableBody = document.getElementById('users-table-body');
const userSearch = document.getElementById('user-search');
const refreshBtn = document.querySelector('.refresh-btn');

let allUsers = [];
let currentUser = null;
let isAdmin = false;

// 차단/금지 관련 변수
let currentBlockTab = 'banned';
let blockedUsers = [];
let mutedUsers = [];

// 🔒 AdminAuthManager 초기화 및 인증 상태 감지
async function initializeAdminAuth() {
    // 어드민 상태 변경 감지
    adminAuthManager.onAuthStateChange((user, isAdminUser) => {
        currentUser = user;
        isAdmin = isAdminUser;
        
        if (user && isAdminUser) {
            console.log("🔐 관리자 페이지 접근 허용:", {
                user: user.email,
                isAdmin: isAdminUser
            });
            
            adminDashboard.style.display = 'block';
            accessDenied.style.display = 'none';
            loadDashboardData();
            updateAdminSecurityUI(user, isAdminUser);
        } else if (user && !isAdminUser) {
            console.log("🔐 관리자 페이지 접근 거부: 권한 없음");
            showAccessDenied("관리자 계정이 아닙니다.");
        } else {
            console.log("🔐 관리자 페이지 접근 거부: 로그인 필요");
            showAccessDenied("이 페이지는 관리자만 접근할 수 있습니다. 먼저 로그인해주세요.");
        }
    });
}

// 필수 요소가 없으면 스크립트 실행 중단
if (!adminDashboard || !accessDenied || !usersTableBody) {
    console.error("Admin page essential elements are missing. Aborting script.");
} else {
    // 초기에는 로딩 상태 표시
    accessDenied.innerHTML = `
        <i class="fas fa-spinner fa-spin"></i>
        <h2>관리자 정보 확인 중...</h2>
        <p>잠시만 기다려주세요.</p>
    `;
    accessDenied.style.display = 'block';
    adminDashboard.style.display = 'none';

    // 페이지 로드 시 어드민 인증 초기화
    document.addEventListener('DOMContentLoaded', () => {
        initializeAdminAuth();
    });
}

function showAccessDenied(message) {
    adminDashboard.style.display = 'none';
    accessDenied.innerHTML = `
        <i class="fas fa-lock"></i>
        <h2>접근 권한 없음</h2>
        <p>${message}</p>
        <a href="index.html" class="back-btn">홈으로 돌아가기</a>
    `;
    accessDenied.style.display = 'block';
}

// 🔒 관리자 보안 UI 업데이트 함수
function updateAdminSecurityUI(user, isAdminUser) {
    // 기존 보안 상태 표시 제거
    const existingSecurityInfo = document.querySelector('.admin-security-info');
    if (existingSecurityInfo) {
        existingSecurityInfo.remove();
    }
    
    // 관리자 보안 상태 표시
    const securityInfo = document.createElement('div');
    securityInfo.className = 'admin-security-info';
    securityInfo.innerHTML = `
        <i class="fas fa-shield-alt"></i>
        <div class="security-details">
            <div class="security-main">
                <strong>관리자 인증 완료</strong> - ${user.email}
            </div>
            <div class="security-meta">
                보안 레벨: ${isAdminUser ? '관리자' : '일반 사용자'} | 세션 ID: ${user.uid?.substring(0, 8)}... | 
                마지막 검증: ${new Date(user.metadata.lastSignInTime).toLocaleTimeString()}
            </div>
        </div>
    `;
    
    // 관리자 헤더 하단에 추가
    const adminHeader = document.querySelector('.admin-header');
    if (adminHeader) {
        adminHeader.insertAdjacentElement('afterend', securityInfo);
    }
}

async function loadDashboardData() {
    if (!usersTableBody) return;

    try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        allUsers = [];
        usersSnapshot.forEach((doc) => {
            allUsers.push({ id: doc.id, ...doc.data() });
        });

        updateStats();
        renderUsersTable(allUsers);

    } catch (error) {
        console.error("Error loading dashboard data: ", error);
        alert('대시보드 데이터를 불러오는 중 오류가 발생했습니다.');
    }
}

function updateStats() {
    if (totalUsersCount) totalUsersCount.textContent = allUsers.length;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const newUsers = allUsers.filter(user => {
        const createdAt = user.createdAt?.toDate();
        return createdAt && createdAt >= today;
    });
    if (newUsersCount) newUsersCount.textContent = newUsers.length;
}

function renderUsersTable(users) {
    usersTableBody.innerHTML = '';
    users.forEach(user => {
        const row = document.createElement('tr');
        const registrationDate = user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString('ko-KR') : '알 수 없음';
        const levelInfo = window.levelSystem ? window.levelSystem.calculateLevel(user.points || 0) : { name: "새싹", gradient: "#22c55e" };
        
        row.innerHTML = `
            <td><span class="user-uid">${user.id}</span></td>
            <td><span class="user-nickname">${user.displayName || 'N/A'}</span></td>
            <td><span class="user-email">${user.email || 'N/A'}</span></td>
            <td><span class="user-points">${(user.points || 0).toLocaleString()}</span></td>
            <td>
                <span class="user-level" style="background: ${levelInfo.gradient};">
                    ${levelInfo.name}
                </span>
            </td>
            <td>
                <span class="user-role ${user.role || 'user'}">
                    ${getRoleDisplayName(user.role || 'user')}
                </span>
            </td>
            <td><span class="user-join-date">${registrationDate}</span></td>
            <td>
                <div class="admin-actions-cell">
                    <button class="admin-btn edit" data-uid="${user.id}" data-name="${user.displayName || ''}" title="닉네임 수정">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="admin-btn points" data-uid="${user.id}" title="포인트 조정">
                        <i class="fas fa-coins"></i>
                    </button>
                    <button class="admin-btn role" data-uid="${user.id}" data-role="${user.role || 'user'}" title="권한 변경">
                        <i class="fas fa-shield-alt"></i>
                    </button>
                    <button class="admin-btn view" data-uid="${user.id}" title="상세 정보">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="admin-btn danger" data-uid="${user.id}" title="사용자 삭제">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        usersTableBody.appendChild(row);
    });

    // 이벤트 리스너 추가
    document.querySelectorAll('.admin-btn.edit').forEach(button => {
        button.addEventListener('click', function(e) {
            const uid = e.target.closest('.admin-btn').dataset.uid;
            const name = e.target.closest('.admin-btn').dataset.name;
            openNicknameModal(uid, name);
        });
    });
    
    document.querySelectorAll('.admin-btn.points').forEach(button => {
        button.addEventListener('click', function(e) {
            const uid = e.target.closest('.admin-btn').dataset.uid;
            openPointsModal(uid);
        });
    });
    
    document.querySelectorAll('.admin-btn.role').forEach(button => {
        button.addEventListener('click', function(e) {
            const uid = e.target.closest('.admin-btn').dataset.uid;
            const currentRole = e.target.closest('.admin-btn').dataset.role;
            openRoleModal(uid, currentRole);
        });
    });
    
    document.querySelectorAll('.admin-btn.view').forEach(button => {
        button.addEventListener('click', function(e) {
            const uid = e.target.closest('.admin-btn').dataset.uid;
            openUserDetailModal(uid);
        });
    });
    
    document.querySelectorAll('.admin-btn.danger').forEach(button => {
        button.addEventListener('click', function(e) {
            const uid = e.target.closest('.admin-btn').dataset.uid;
            handleDeleteUser(uid);
        });
    });

    // 사용자 업데이트 이벤트 리스너
    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('update-user-btn')) {
            const uid = e.target.dataset.uid;
            const row = e.target.closest('tr');
            const nameInput = row.querySelector('.name-input');
            const pointsInput = row.querySelector('.points-input');
            const roleSelect = row.querySelector('.role-select');
            
            const newName = nameInput.value.trim();
            const newPoints = parseInt(pointsInput.value, 10);
            const newRole = roleSelect.value;
            
            if (!newName || isNaN(newPoints) || newPoints < 0) {
                alert('올바른 값을 입력해주세요.');
                return;
            }
            
            try {
                await updateDoc(doc(db, 'users', uid), {
                    displayName: newName,
                    points: newPoints,
                    role: newRole
                });
                alert('사용자 정보가 업데이트되었습니다.');
                loadDashboardData();
            } catch (error) {
                console.error('사용자 업데이트 오류:', error);
                alert('업데이트 중 오류가 발생했습니다.');
            }
        }
        
        if (e.target.classList.contains('reset-points-btn')) {
            const uid = e.target.dataset.uid;
            if (confirm('이 사용자의 포인트를 0으로 초기화하시겠습니까?')) {
                try {
                    await updateDoc(doc(db, 'users', uid), {
                        points: 0
                    });
                    alert('포인트가 초기화되었습니다.');
                    loadDashboardData();
                } catch (error) {
                    console.error('포인트 초기화 오류:', error);
                    alert('초기화 중 오류가 발생했습니다.');
                }
            }
        }
        
        if (e.target.classList.contains('delete-user-btn')) {
            const uid = e.target.dataset.uid;
            if (confirm('정말로 이 사용자를 삭제하시겠습니까?')) {
                try {
                    await deleteDoc(doc(db, 'users', uid));
                    alert('사용자가 삭제되었습니다.');
                    loadDashboardData();
                } catch (error) {
                    console.error('사용자 삭제 오류:', error);
                    alert('삭제 중 오류가 발생했습니다.');
                }
            }
        }
    });
}

async function handleUpdateLevel(event) {
    const input = event.target;
    const uidToUpdate = input.dataset.uid;
    if (!uidToUpdate) return;

    const newLevel = parseInt(input.value, 10);
    if (isNaN(newLevel) || newLevel < 1) {
        alert('유효한 레벨을 입력하세요.');
        return;
    }

    try {
        const userDocRef = doc(db, "users", uidToUpdate);
        await updateDoc(userDocRef, {
            level: newLevel
        });
        showToast(`회원의 레벨이 ${newLevel}로 업데이트되었습니다.`);
    } catch (error) {
        console.error("Error updating user level:", error);
        alert('레벨 업데이트 중 오류가 발생했습니다.');
    }
}

function openNicknameModal(uid, currentName) {
    const modal = document.getElementById('nickname-modal');
    document.getElementById('nickname-uid').value = uid;
    document.getElementById('new-nickname').value = currentName || '';
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

document.getElementById('close-nickname-modal')?.addEventListener('click', () => {
    document.getElementById('nickname-modal').style.display = 'none';
    document.body.style.overflow = '';
});

document.getElementById('nickname-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // 🔒 보안 강화된 권한 확인
    const isAdminUser = await adminAuthManager.isAdminUser();
    if (!isAdminUser) {
        alert('관리자 권한이 필요합니다.');
        return;
    }
    
    const uid = document.getElementById('nickname-uid').value;
    const newName = document.getElementById('new-nickname').value.trim();
    
    if (!uid || !newName) {
        alert('닉네임을 입력하세요.');
        return;
    }
    if (newName.length > 8) {
        alert('닉네임은 8자 이하로 입력해주세요.');
        return;
    }
    
    try {
        // 보안 이벤트 로그 기록
        await adminAuthManager.logSecurityEvent('user_nickname_change', {
            targetUserId: uid,
            action: 'change_nickname',
            newNickname: newName,
            timestamp: new Date().toISOString()
        });
        
        const userDocRef = doc(db, "users", uid);
        await updateDoc(userDocRef, { displayName: newName });
        showToast('닉네임이 성공적으로 변경되었습니다.');
        loadDashboardData();
        document.getElementById('nickname-modal').style.display = 'none';
        document.body.style.overflow = '';
        
        console.log('🔒 닉네임 변경 완료:', {
            targetUserId: uid,
            newNickname: newName,
            adminUser: currentUser.email
        });
    } catch (error) {
        alert('닉네임 변경 중 오류가 발생했습니다.');
        console.error(error);
    }
});

// 사용자 검색 기능
userSearch?.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredUsers = allUsers.filter(user => 
        user.displayName?.toLowerCase().includes(searchTerm) ||
        user.email?.toLowerCase().includes(searchTerm) ||
        user.id.toLowerCase().includes(searchTerm)
    );
    renderUsersTable(filteredUsers);
});

// 새로고침 버튼
refreshBtn?.addEventListener('click', () => {
    loadDashboardData();
    showToast('데이터가 새로고침되었습니다.');
});

// 권한 표시명 반환 함수
function getRoleDisplayName(role) {
    switch(role) {
        case 'admin': return '관리자';
        case 'moderator': return '모더레이터';
        case 'user': 
        default: return '일반 사용자';
    }
}

// 포인트 조정 모달 열기
async function openPointsModal(uid) {
    const modal = document.getElementById('points-modal');
    document.getElementById('points-uid').value = uid;
    document.getElementById('points-amount').value = '';
    document.getElementById('points-reason').value = '';
    
    // 현재 포인트 표시
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            const currentPoints = userDoc.data().points || 0;
            document.getElementById('current-points').textContent = currentPoints.toLocaleString();
        }
    } catch (error) {
        console.error('사용자 포인트 조회 오류:', error);
    }
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// 권한 변경 모달 열기
function openRoleModal(uid, currentRole) {
    const modal = document.getElementById('role-modal');
    document.getElementById('role-uid').value = uid;
    document.getElementById('new-role').value = currentRole;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// 사용자 상세 정보 모달 열기
async function openUserDetailModal(uid) {
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (!userDoc.exists()) {
            alert('사용자 정보를 찾을 수 없습니다.');
            return;
        }
        
        const userData = userDoc.data();
        const levelInfo = window.levelSystem ? window.levelSystem.calculateLevel(userData.points || 0) : { name: "새싹", gradient: "#22c55e" };
        
        const modal = document.getElementById('user-detail-modal');
        const detailInfo = document.getElementById('user-detail-info');
        
        detailInfo.innerHTML = `
            <div class="user-detail-grid">
                <div class="detail-card">
                    <h4>기본 정보</h4>
                    <div class="detail-item">
                        <span class="detail-label">UID:</span>
                        <span class="detail-value">${uid}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">닉네임:</span>
                        <span class="detail-value">${userData.displayName || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">이메일:</span>
                        <span class="detail-value">${userData.email || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">권한:</span>
                        <span class="detail-value">${getRoleDisplayName(userData.role || 'user')}</span>
                    </div>
                </div>
                
                <div class="detail-card">
                    <h4>레벨 & 포인트</h4>
                    <div class="detail-item">
                        <span class="detail-label">현재 레벨:</span>
                        <span class="detail-value">${levelInfo.name}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">총 포인트:</span>
                        <span class="detail-value">${(userData.points || 0).toLocaleString()}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">가입일:</span>
                        <span class="detail-value">${userData.createdAt?.toDate ? userData.createdAt.toDate().toLocaleDateString('ko-KR') : '알 수 없음'}</span>
                    </div>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    } catch (error) {
        console.error('사용자 상세 정보 로드 오류:', error);
        alert('사용자 정보를 불러오는 중 오류가 발생했습니다.');
    }
}

// 🔒 보안 강화된 사용자 삭제 처리
async function handleDeleteUser(uid) {
    // 실시간 권한 재확인
    const isAdminUser = await adminAuthManager.isAdminUser();
    if (!isAdminUser) {
        alert('관리자 권한이 필요합니다.');
        return;
    }
    
    if (uid === currentUser?.uid) {
        alert('자기 자신은 삭제할 수 없습니다.');
        return;
    }

    if (confirm('정말로 이 회원을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        try {
            // 보안 이벤트 로그 기록
            await adminAuthManager.logSecurityEvent('user_delete', {
                targetUserId: uid,
                action: 'delete_user',
                timestamp: new Date().toISOString()
            });
            
            await deleteDoc(doc(db, "users", uid));
            showToast('회원이 성공적으로 삭제되었습니다.');
            loadDashboardData();
            
            console.log('🔒 사용자 삭제 완료:', {
                targetUserId: uid,
                adminUser: currentUser.email
            });
        } catch (error) {
            console.error("Error deleting user: ", error);
            alert('회원 삭제 중 오류가 발생했습니다.');
        }
    }
}

// 모달 닫기 이벤트 리스너들
document.getElementById('close-points-modal')?.addEventListener('click', () => {
    document.getElementById('points-modal').style.display = 'none';
    document.body.style.overflow = '';
});

document.getElementById('close-role-modal')?.addEventListener('click', () => {
    document.getElementById('role-modal').style.display = 'none';
    document.body.style.overflow = '';
});

document.getElementById('close-user-detail-modal')?.addEventListener('click', () => {
    document.getElementById('user-detail-modal').style.display = 'none';
    document.body.style.overflow = '';
});

// 🔒 보안 강화된 포인트 조정 폼 제출
document.getElementById('points-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // 🔒 보안 강화된 권한 확인
    const isAdminUser = await adminAuthManager.isAdminUser();
    if (!isAdminUser) {
        alert('관리자 권한이 필요합니다.');
        return;
    }
    
    const uid = document.getElementById('points-uid').value;
    const amount = parseInt(document.getElementById('points-amount').value);
    const reason = document.getElementById('points-reason').value.trim();
    
    if (!uid || isNaN(amount) || !reason) {
        alert('모든 필드를 올바르게 입력하세요.');
        return;
    }
    
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (!userDoc.exists()) {
            alert('사용자를 찾을 수 없습니다.');
            return;
        }
        
        const currentPoints = userDoc.data().points || 0;
        const newPoints = Math.max(0, currentPoints + amount);
        
        // 보안 이벤트 로그 기록
        await adminAuthManager.logSecurityEvent('user_points_adjustment', {
            targetUserId: uid,
            action: 'adjust_points',
            pointsChange: amount,
            reason: reason,
            previousPoints: currentPoints,
            newPoints: newPoints,
            timestamp: new Date().toISOString()
        });
        
        // 포인트 업데이트
        await updateDoc(doc(db, 'users', uid), {
            points: newPoints
        });
        
        // 포인트 히스토리 추가
        await addDoc(collection(db, 'pointHistory'), {
            userId: uid,
            action: 'admin_adjustment',
            points: amount,
            timestamp: serverTimestamp(),
            description: `관리자 조정: ${reason}`,
            adminId: currentUser?.uid,
            adminEmail: currentUser?.email
        });
        
        showToast(`포인트가 ${amount > 0 ? '+' : ''}${amount} 조정되었습니다. (사유: ${reason})`);
        loadDashboardData();
        document.getElementById('points-modal').style.display = 'none';
        document.body.style.overflow = '';
        
        console.log('🔒 포인트 조정 완료:', {
            targetUserId: uid,
            pointsChange: amount,
            reason: reason,
            adminUser: currentUser.email
        });
        
        // 사용자 데이터 새로고침 (실시간 반영)
        if (window.refreshUserData) {
            window.refreshUserData();
        }
    } catch (error) {
        console.error('포인트 조정 오류:', error);
        alert('포인트 조정 중 오류가 발생했습니다.');
    }
});

// 🔒 보안 강화된 권한 변경 폼 제출
document.getElementById('role-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // 🔒 보안 강화된 권한 확인
    const isAdminUser = await adminAuthManager.isAdminUser();
    if (!isAdminUser) {
        alert('관리자 권한이 필요합니다.');
        return;
    }
    
    const uid = document.getElementById('role-uid').value;
    const newRole = document.getElementById('new-role').value;
    
    if (!uid || !newRole) {
        alert('권한을 선택하세요.');
        return;
    }
    
    if (uid === currentUser?.uid && newRole !== 'admin') {
        alert('자기 자신의 관리자 권한은 해제할 수 없습니다.');
        return;
    }
    
    try {
        // 기존 권한 조회
        const userDoc = await getDoc(doc(db, 'users', uid));
        const previousRole = userDoc.exists() ? userDoc.data().role : 'user';
        
        // 보안 이벤트 로그 기록
        await adminAuthManager.logSecurityEvent('user_role_change', {
            targetUserId: uid,
            action: 'change_role',
            previousRole: previousRole,
            newRole: newRole,
            timestamp: new Date().toISOString()
        });
        
        await updateDoc(doc(db, 'users', uid), {
            role: newRole
        });
        
        showToast(`권한이 ${getRoleDisplayName(newRole)}로 변경되었습니다.`);
        loadDashboardData();
        document.getElementById('role-modal').style.display = 'none';
        document.body.style.overflow = '';
        
        console.log('🔒 권한 변경 완료:', {
            targetUserId: uid,
            previousRole: previousRole,
            newRole: newRole,
            adminUser: currentUser.email
        });
    } catch (error) {
        console.error('권한 변경 오류:', error);
        alert('권한 변경 중 오류가 발생했습니다.');
    }
});

// 토스트 메시지 표시 함수
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }, 100);
}

// 차단/금지 목록 로드
async function loadBlockedUsers() {
    try {
        // 차단된 사용자 목록 로드
        const bannedSnapshot = await getDocs(collection(db, 'bannedUsers'));
        blockedUsers = [];
        bannedSnapshot.forEach(doc => {
            const data = doc.data();
            blockedUsers.push({
                uid: doc.id,
                ...data,
                timestamp: data.timestamp?.toDate()
            });
        });

        // 금지된 사용자 목록 로드
        const mutedSnapshot = await getDocs(collection(db, 'mutedUsers'));
        mutedUsers = [];
        mutedSnapshot.forEach(doc => {
            const data = doc.data();
            mutedUsers.push({
                uid: doc.id,
                ...data,
                timestamp: data.timestamp?.toDate()
            });
        });

        renderBlockedUsers();
    } catch (error) {
        console.error('차단/금지 목록 로드 실패:', error);
        showToast('차단/금지 목록을 불러오는데 실패했습니다.');
    }
}

// 차단/금지 목록 렌더링
function renderBlockedUsers() {
    const bannedList = document.getElementById('banned-users-list');
    const mutedList = document.getElementById('muted-users-list');
    
    if (!bannedList || !mutedList) return;

    // 차단 목록 렌더링
    bannedList.innerHTML = blockedUsers.map(user => {
        const isActive = isBlockActive(user);
        const status = getBlockStatus(user);
        return `
            <tr>
                <td>${user.uid}</td>
                <td>${user.reason}</td>
                <td>${getDurationText(user.duration, user.unit)}</td>
                <td>${formatDate(user.timestamp)}</td>
                <td><span class="block-status ${isActive ? 'active' : 'expired'}">${status}</span></td>
                <td>
                    ${isActive ? `<button onclick="unblockUser('${user.uid}', 'banned')" class="btn-secondary">해제</button>` : ''}
                </td>
            </tr>
        `;
    }).join('');

    // 금지 목록 렌더링
    mutedList.innerHTML = mutedUsers.map(user => {
        const isActive = isMuteActive(user);
        const status = getMuteStatus(user);
        return `
            <tr>
                <td>${user.uid}</td>
                <td>${user.reason}</td>
                <td>${getDurationText(user.duration, user.unit)}</td>
                <td>${formatDate(user.timestamp)}</td>
                <td><span class="block-status ${isActive ? 'active' : 'expired'}">${status}</span></td>
                <td>
                    ${isActive ? `<button onclick="unblockUser('${user.uid}', 'muted')" class="btn-secondary">해제</button>` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

// 차단 상태 확인
function isBlockActive(user) {
    if (user.duration === 'permanent' || user.duration === 'delete') return true;
    if (!user.timestamp) return false;
    
    const endTime = user.timestamp.getTime() + (user.duration * (user.unit === 'days' ? 24 * 60 * 60 * 1000 : 60 * 1000));
    return endTime > Date.now();
}

// 금지 상태 확인
function isMuteActive(user) {
    if (!user.timestamp) return false;
    const endTime = user.timestamp.getTime() + (user.duration * (user.unit === 'days' ? 24 * 60 * 60 * 1000 : 60 * 1000));
    return endTime > Date.now();
}

// 차단 상태 텍스트
function getBlockStatus(user) {
    if (user.duration === 'permanent') return '영구 차단';
    if (user.duration === 'delete') return '아이디 삭제';
    if (!isBlockActive(user)) return '만료됨';
    
    const endTime = user.timestamp.getTime() + (user.duration * (user.unit === 'days' ? 24 * 60 * 60 * 1000 : 60 * 1000));
    const remaining = Math.ceil((endTime - Date.now()) / (24 * 60 * 60 * 1000));
    return `${remaining}일 남음`;
}

// 금지 상태 텍스트
function getMuteStatus(user) {
    if (!isMuteActive(user)) return '만료됨';
    
    const endTime = user.timestamp.getTime() + (user.duration * (user.unit === 'days' ? 24 * 60 * 60 * 1000 : 60 * 1000));
    const remaining = Math.ceil((endTime - Date.now()) / (60 * 1000));
    return `${remaining}분 남음`;
}

// 차단/금지 기간 텍스트
function getDurationText(duration, unit) {
    if (duration === 'permanent') return '영구';
    if (duration === 'delete') return '아이디 삭제';
    return `${duration}${unit === 'days' ? '일' : '분'}`;
}

// 날짜 포맷
function formatDate(date) {
    if (!date) return '-';
    return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 탭 전환
function switchBlockTab(tab) {
    currentBlockTab = tab;
    document.querySelectorAll('.block-list').forEach(list => list.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`${tab}-list`).classList.add('active');
    document.querySelector(`[onclick="switchBlockTab('${tab}')"]`).classList.add('active');
}

// 차단 모달 표시
function showBlockUserModal() {
    const modal = document.getElementById('block-user-modal');
    if (modal) modal.style.display = 'block';
}

// 차단 모달 닫기
function closeBlockModal() {
    const modal = document.getElementById('block-user-modal');
    if (modal) modal.style.display = 'none';
}

// 차단 사유 선택 시 직접 입력 필드 표시/숨김
document.getElementById('block-reason')?.addEventListener('change', function(e) {
    const customGroup = document.getElementById('custom-reason-group');
    if (customGroup) {
        customGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
    }
});

// 🔒 보안 강화된 차단 폼 제출
document.getElementById('block-user-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // 🔒 보안 강화된 권한 확인
    const isAdminUser = await adminAuthManager.isAdminUser();
    if (!isAdminUser) {
        alert('관리자 권한이 필요합니다.');
        return;
    }
    
    const userId = document.getElementById('block-user-id').value;
    const reason = document.getElementById('block-reason').value;
    const customReason = document.getElementById('custom-block-reason').value;
    const duration = document.getElementById('block-duration').value;
    
    if (!userId) {
        showToast('사용자 UID를 입력해주세요.');
        return;
    }

    try {
        const finalReason = reason === 'custom' ? customReason : reason;
        
        // 보안 이벤트 로그 기록
        await adminAuthManager.logSecurityEvent('user_block', {
            targetUserId: userId,
            action: 'block_user',
            reason: finalReason,
            duration: duration,
            timestamp: new Date().toISOString()
        });
        
        const blockData = {
            reason: finalReason,
            duration: duration,
            unit: duration === 'permanent' || duration === 'delete' ? null : 'days',
            timestamp: serverTimestamp(),
            adminId: currentUser?.uid,
            adminEmail: currentUser?.email
        };

        await setDoc(doc(db, 'bannedUsers', userId), blockData);
        showToast('사용자가 차단되었습니다.');
        closeBlockModal();
        loadBlockedUsers();
        
        console.log('🔒 사용자 차단 완료:', {
            targetUserId: userId,
            reason: finalReason,
            duration: duration,
            adminUser: currentUser.email
        });
    } catch (error) {
        console.error('차단 실패:', error);
        showToast('차단 처리에 실패했습니다.');
    }
});

// 🔒 보안 강화된 차단/금지 해제
async function unblockUser(uid, type) {
    // 🔒 보안 강화된 권한 확인
    const isAdminUser = await adminAuthManager.isAdminUser();
    if (!isAdminUser) {
        alert('관리자 권한이 필요합니다.');
        return;
    }
    
    if (!confirm('정말 해제하시겠습니까?')) return;

    try {
        // 보안 이벤트 로그 기록
        await adminAuthManager.logSecurityEvent('user_unblock', {
            targetUserId: uid,
            action: 'unblock_user',
            blockType: type,
            timestamp: new Date().toISOString()
        });
        
        await deleteDoc(doc(db, type === 'banned' ? 'bannedUsers' : 'mutedUsers', uid));
        showToast('해제되었습니다.');
        loadBlockedUsers();
        
        console.log('🔒 사용자 차단 해제 완료:', {
            targetUserId: uid,
            blockType: type,
            adminUser: currentUser.email
        });
    } catch (error) {
        console.error('해제 실패:', error);
        showToast('해제 처리에 실패했습니다.');
    }
}

// 사용자 검색
async function searchBlockedUsers() {
    const searchTerm = document.getElementById('block-search').value.toLowerCase();
    if (!searchTerm) {
        renderBlockedUsers();
        return;
    }

    const filteredBanned = blockedUsers.filter(user => 
        user.uid.toLowerCase().includes(searchTerm)
    );
    const filteredMuted = mutedUsers.filter(user => 
        user.uid.toLowerCase().includes(searchTerm)
    );

    const bannedList = document.getElementById('banned-users-list');
    const mutedList = document.getElementById('muted-users-list');
    
    if (bannedList) {
        bannedList.innerHTML = filteredBanned.map(user => {
            const isActive = isBlockActive(user);
            const status = getBlockStatus(user);
            return `
                <tr>
                    <td>${user.uid}</td>
                    <td>${user.reason}</td>
                    <td>${getDurationText(user.duration, user.unit)}</td>
                    <td>${formatDate(user.timestamp)}</td>
                    <td><span class="block-status ${isActive ? 'active' : 'expired'}">${status}</span></td>
                    <td>
                        ${isActive ? `<button onclick="unblockUser('${user.uid}', 'banned')" class="btn-secondary">해제</button>` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    }

    if (mutedList) {
        mutedList.innerHTML = filteredMuted.map(user => {
            const isActive = isMuteActive(user);
            const status = getMuteStatus(user);
            return `
                <tr>
                    <td>${user.uid}</td>
                    <td>${user.reason}</td>
                    <td>${getDurationText(user.duration, user.unit)}</td>
                    <td>${formatDate(user.timestamp)}</td>
                    <td><span class="block-status ${isActive ? 'active' : 'expired'}">${status}</span></td>
                    <td>
                        ${isActive ? `<button onclick="unblockUser('${user.uid}', 'muted')" class="btn-secondary">해제</button>` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    }
}

// 페이지 로드 시 차단/금지 목록 로드
document.addEventListener('DOMContentLoaded', () => {
    // ... existing code ...
    loadBlockedUsers();
});

window.switchBlockTab = switchBlockTab;
window.searchBlockedUsers = searchBlockedUsers;
window.showBlockUserModal = showBlockUserModal;
window.closeBlockModal = closeBlockModal;
window.unblockUser = unblockUser; 

window.switchAdminTab = function(tabName) {
    // 모든 탭 버튼 비활성화
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    // 모든 탭 콘텐츠 숨기기
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.style.display = 'none';
    });
    // 선택된 탭 활성화
    document.querySelector(`[onclick="switchAdminTab('${tabName}')"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).style.display = 'block';
}; 