import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, deleteDoc, updateDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

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

    onAuthStateChanged(auth, async (user) => {
        console.log("onAuthStateChanged triggered in admin.js");
        if (user) {
            console.log("User is logged in:", user.uid);
            try {
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists() && userDoc.data().role === 'admin') {
                    console.log("Admin access GRANTED.");
                    adminDashboard.style.display = 'block';
                    accessDenied.style.display = 'none';
                    loadDashboardData();
                } else {
                    console.log("Admin access DENIED. User role is not 'admin'.");
                    showAccessDenied("관리자 계정이 아닙니다.");
                }
            } catch (error) {
                console.error("Error checking admin role:", error);
                showAccessDenied("권한 확인 중 오류가 발생했습니다.");
            }
        } else {
            console.log("User is not logged in.");
            showAccessDenied("이 페이지는 관리자만 접근할 수 있습니다. 먼저 로그인해주세요.");
        }
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
        const userDocRef = doc(db, "users", uid);
        await updateDoc(userDocRef, { displayName: newName });
        showToast('닉네임이 성공적으로 변경되었습니다.');
        loadDashboardData();
        document.getElementById('nickname-modal').style.display = 'none';
        document.body.style.overflow = '';
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

// 사용자 삭제 처리
async function handleDeleteUser(uid) {
    if (uid === auth.currentUser?.uid) {
        alert('자기 자신은 삭제할 수 없습니다.');
        return;
    }

    if (confirm('정말로 이 회원을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        try {
            await deleteDoc(doc(db, "users", uid));
            showToast('회원이 성공적으로 삭제되었습니다.');
            loadDashboardData();
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

// 포인트 조정 폼 제출
document.getElementById('points-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
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
            adminId: auth.currentUser?.uid
        });
        
        showToast(`포인트가 ${amount > 0 ? '+' : ''}${amount} 조정되었습니다. (사유: ${reason})`);
        loadDashboardData();
        document.getElementById('points-modal').style.display = 'none';
        document.body.style.overflow = '';
        
        // 사용자 데이터 새로고침 (실시간 반영)
        if (window.refreshUserData) {
            window.refreshUserData();
        }
    } catch (error) {
        console.error('포인트 조정 오류:', error);
        alert('포인트 조정 중 오류가 발생했습니다.');
    }
});

// 권한 변경 폼 제출
document.getElementById('role-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const uid = document.getElementById('role-uid').value;
    const newRole = document.getElementById('new-role').value;
    
    if (!uid || !newRole) {
        alert('권한을 선택하세요.');
        return;
    }
    
    if (uid === auth.currentUser?.uid && newRole !== 'admin') {
        alert('자기 자신의 관리자 권한은 해제할 수 없습니다.');
        return;
    }
    
    try {
        await updateDoc(doc(db, 'users', uid), {
            role: newRole
        });
        
        showToast(`권한이 ${getRoleDisplayName(newRole)}로 변경되었습니다.`);
        loadDashboardData();
        document.getElementById('role-modal').style.display = 'none';
        document.body.style.overflow = '';
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