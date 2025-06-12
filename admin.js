import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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
        
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.displayName || 'N/A'}</td>
            <td>${user.email || 'N/A'}</td>
            <td>
                <input type="number" class="level-input" value="${user.level || 1}" min="1" data-uid="${user.id}">
            </td>
            <td>${registrationDate}</td>
            <td class="user-actions">
                <button class="action-btn edit" data-uid="${user.id}" data-name="${user.displayName || ''}" title="닉네임 변경">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn delete" data-uid="${user.id}" title="회원 삭제">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        `;
        usersTableBody.appendChild(row);
    });

    // 이벤트 리스너 추가
    document.querySelectorAll('.action-btn.delete').forEach(button => {
        button.addEventListener('click', handleDeleteUser);
    });
    document.querySelectorAll('.action-btn.edit').forEach(button => {
        button.addEventListener('click', function(e) {
            const uid = e.target.closest('.action-btn').dataset.uid;
            const name = e.target.closest('.action-btn').dataset.name;
            openNicknameModal(uid, name);
        });
    });
    document.querySelectorAll('.level-input').forEach(input => {
        input.addEventListener('change', handleUpdateLevel);
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

async function handleDeleteUser(event) {
    const button = event.target.closest('.action-btn');
    const uidToDelete = button.dataset.uid;
    if (!uidToDelete) return;

    if (uidToDelete === auth.currentUser?.uid) {
        alert('자기 자신은 삭제할 수 없습니다.');
        return;
    }

    if (confirm('정말로 이 회원을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        try {
            await deleteDoc(doc(db, "users", uidToDelete));
            showToast('회원이 성공적으로 삭제되었습니다.');
            loadDashboardData();
        } catch (error) {
            console.error("Error deleting user: ", error);
            alert('회원 삭제 중 오류가 발생했습니다.');
        }
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