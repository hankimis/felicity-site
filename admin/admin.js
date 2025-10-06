import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, deleteDoc, updateDoc, addDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { firebaseConfig } from '../firebase-config.js';
import { getVisitStats } from '../js/visit-tracker.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import adminAuthManager from '../js/admin-auth-manager.js';

console.log("admin.js started");

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const fns = getFunctions(app, 'asia-northeast3');

const adminDashboard = document.getElementById('admin-dashboard');
const accessDenied = document.getElementById('admin-access-denied');
const totalUsersCount = document.getElementById('total-users-count');
const newUsersCount = document.getElementById('new-users-count');
const totalVisitsCount = document.getElementById('total-visits-count');
const todayVisitsCount = document.getElementById('today-visits-count');
const usersTableBody = document.getElementById('users-table-body');
const usersTableBodyUM = document.getElementById('users-table-body-um');
const userSearchUid = document.getElementById('filter-uid-input');
const filterTypeSelect = document.getElementById('filter-type');
const refreshBtn = document.querySelector('.refresh-btn');
const sidebar = document.querySelector('.admin-sidebar');
const sidebarUserEmail = document.getElementById('sidebar-user-email');

// Data table controls
const selectAllCheckbox = document.getElementById('select-all-rows');
const selectAllCheckboxUM = document.getElementById('select-all-rows-um');
const selectionInfo = document.getElementById('selection-info');
const selectionInfoUM = document.getElementById('selection-info-um');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const pageInfo = document.getElementById('page-info');
const pageSizeSelect = document.getElementById('page-size');
const prevPageBtnUM = document.getElementById('prev-page-um');
const nextPageBtnUM = document.getElementById('next-page-um');
const pageInfoUM = document.getElementById('page-info-um');
const pageSizeSelectUM = document.getElementById('page-size-um');
const columnToggleBtn = document.getElementById('column-toggle-btn');
const columnToggleMenu = document.getElementById('column-toggle-menu');
const userEditModal = document.getElementById('user-edit-modal');
const closeUserEditModalBtn = document.getElementById('close-user-edit-modal');
const userEditForm = document.getElementById('user-edit-form');
const editUidInput = document.getElementById('edit-uid');
const editDisplayNameInput = document.getElementById('edit-display-name');
const editRoleSelect = document.getElementById('edit-role');
const editUsdtInput = document.getElementById('edit-usdt');
const editOnbitInput = document.getElementById('edit-onbit');
const deleteUserBtn = document.getElementById('delete-user-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

let allUsers = [];
let allUsersUM = [];
let currentUser = null;
let isAdmin = false;
let selectionSet = new Set();
let currentPage = 1;
let pageSize = 10;
let currentPageUM = 1;
let pageSizeUM = 10;
let sortState = { key: null, dir: 'asc' }; // dir: 'asc' | 'desc'
let sortStateUM = { key: null, dir: 'asc' };
let visibleColumns = {
    uid: true,
    nickname: true,
    email: true,
    usdt: true,
    onbit: true,
    role: true,
    createdAt: true,
    actions: true
};
let visibleColumnsUM = {
    uid: true,
    nickname: true,
    email: true,
    postCount: true,
    likeCount: true,
    followerCount: true,
    commentCount: true,
    role: true,
    createdAt: true,
    actions: true
};
let hasShownUsersPermissionToast = false;
let hasShownDetailPermissionToast = false;

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
            if (sidebarUserEmail) sidebarUserEmail.textContent = user?.email || '-';
            restoreSidebarState();
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
        setupSidebarMenuScroll();
        setupColumnVisibility();
        setupPaginationControls();
        setupOutsideClickForColumns();
        setupSortableHeaders();
        setupPaginationControlsUM();
        setupSortableHeadersUM();
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
        updateVisitStats();
        selectionSet.clear();
        currentPage = 1;
        applyAndRender();

        // 사용자 관리 탭 데이터는 동일한 원본을 사용
        allUsersUM = allUsers.map(u => ({ ...u }));
        await enrichUsersWithCommunityMetrics(allUsersUM);
        selectionSet.clear();
        currentPageUM = 1;
        applyAndRenderUM();

    } catch (error) {
        console.error("Error loading dashboard data: ", error);
        // 권한 문제는 중복 노이즈 방지 및 안내 최적화
        if (error && (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions.'))) {
            if (!hasShownUsersPermissionToast) {
                showToast('관리 권한 확인 중입니다. 잠시 후 다시 시도해주세요.');
                hasShownUsersPermissionToast = true;
            }
        } else {
            showToast('대시보드 데이터를 불러오는 중 문제가 발생했습니다.');
        }
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

async function updateVisitStats() {
    try {
        const stats = await getVisitStats();
        if (totalVisitsCount) totalVisitsCount.textContent = (stats.totalVisits || 0).toLocaleString();
        if (todayVisitsCount) todayVisitsCount.textContent = (stats.todayVisits || 0).toLocaleString();
    } catch (e) {
        // 조용히 실패
    }
}

function renderUsersTable(users) {
    usersTableBody.innerHTML = '';
    users.forEach(user => {
        const row = document.createElement('tr');
        const registrationDate = user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString('ko-KR') : '알 수 없음';
        const isChecked = selectionSet.has(user.id) ? 'checked' : '';
        row.innerHTML = `
            <td class="row-select"><input type="checkbox" class="row-select-checkbox" data-uid="${user.id}" ${isChecked}></td>
            <td data-col="uid" style="${visibleColumns.uid ? '' : 'display:none'}"><span class="user-uid truncate">${user.id}</span></td>
            <td data-col="nickname" style="${visibleColumns.nickname ? '' : 'display:none'}"><span class="user-nickname truncate">${user.displayName || 'N/A'}</span></td>
            <td data-col="email" style="${visibleColumns.email ? '' : 'display:none'}"><span class="user-email truncate">${user.email || 'N/A'}</span></td>
            <td data-col="usdt" style="${visibleColumns.usdt ? '' : 'display:none'}">
                <div class="cell-inline">
                    <span class="user-usdt">${(user.paperTrading?.balanceUSDT ?? 0).toLocaleString()} USDT</span>
                </div>
            </td>
            <td data-col="onbit" style="${visibleColumns.onbit ? '' : 'display:none'}">
                <div class="cell-inline">
                    <span class="user-onbit">${Number(user.mining?.onbit || 0).toFixed(3)} ONBIT</span>
                </div>
            </td>
            
            <td data-col="role" style="${visibleColumns.role ? '' : 'display:none'}">
                <span class="user-role ${user.role || 'user'}">
                    ${getRoleDisplayName(user.role || 'user')}
                </span>
            </td>
            <td data-col="createdAt" style="${visibleColumns.createdAt ? '' : 'display:none'}"><span class="user-join-date truncate">${registrationDate}</span></td>
            <td data-col="actions" style="${visibleColumns.actions ? '' : 'display:none'}">
                <div class="admin-actions-cell">
                    <button class="admin-btn points open-edit" data-uid="${user.id}" data-name="${user.displayName || ''}" data-role="${user.role || 'user'}" data-usdt="${user.paperTrading?.balanceUSDT ?? 0}" data-onbit="${Number(user.mining?.onbit || 0)}" title="편집">
                        <i class="fas fa-pen"></i>
                        Edit
                    </button>
                </div>
            </td>
        `;
        usersTableBody.appendChild(row);
    });

    // 이벤트 리스너 추가
    // 단일 Edit 버튼
    
    // 빠른 편집 버튼
    document.querySelectorAll('.admin-btn.open-edit').forEach(button => {
        button.addEventListener('click', function(e) {
            const btn = e.target.closest('.admin-btn');
            const uid = btn.dataset.uid;
            const name = btn.dataset.name || '';
            const role = btn.dataset.role || 'user';
            const usdt = Number(btn.dataset.usdt || 0);
            const onbit = Number(btn.dataset.onbit || 0);
            openUserEditModal(uid, name, role, usdt, onbit);
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
        
        // 포인트 초기화 제거됨
        
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
    // 행 선택 핸들러
    usersTableBody.querySelectorAll('.row-select-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const uid = e.target.dataset.uid;
            if (e.target.checked) selectionSet.add(uid); else selectionSet.delete(uid);
            updateSelectionInfo();
            updateSelectAllState();
        });
    });
}

function renderUsersTableUM(users) {
    if (!usersTableBodyUM) return;
    usersTableBodyUM.innerHTML = '';
    users.forEach(user => {
        const row = document.createElement('tr');
        const registrationDate = user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString('ko-KR') : '알 수 없음';
        const isChecked = selectionSet.has(user.id) ? 'checked' : '';
        row.innerHTML = `
            <td class="row-select"><input type="checkbox" class="row-select-checkbox-um" data-uid="${user.id}" ${isChecked}></td>
            <td data-col="uid" style="${visibleColumnsUM.uid ? '' : 'display:none'}"><span class="user-uid truncate">${user.id}</span></td>
            <td data-col="nickname" style="${visibleColumnsUM.nickname ? '' : 'display:none'}"><span class="user-nickname truncate">${user.displayName || 'N/A'}</span></td>
            <td data-col="email" style="${visibleColumnsUM.email ? '' : 'display:none'}"><span class="user-email truncate">${user.email || 'N/A'}</span></td>
            <td data-col="postCount" style="${visibleColumnsUM.postCount ? '' : 'display:none'}"><span class="user-posts truncate">${Number(user.__metrics?.postCount || 0).toLocaleString()}</span></td>
            <td data-col="likeCount" style="${visibleColumnsUM.likeCount ? '' : 'display:none'}"><span class="user-likes truncate">${Number(user.__metrics?.likeCount || 0).toLocaleString()}</span></td>
            <td data-col="followerCount" style="${visibleColumnsUM.followerCount ? '' : 'display:none'}"><span class="user-followers truncate">${Number(user.__metrics?.followerCount || 0).toLocaleString()}</span></td>
            <td data-col="commentCount" style="${visibleColumnsUM.commentCount ? '' : 'display:none'}"><span class="user-comments truncate">${Number(user.__metrics?.commentCount || 0).toLocaleString()}</span></td>
            <td data-col="role" style="${visibleColumnsUM.role ? '' : 'display:none'}">
                <span class="user-role ${user.role || 'user'}">
                    ${getRoleDisplayName(user.role || 'user')}
                </span>
            </td>
            <td data-col="createdAt" style="${visibleColumnsUM.createdAt ? '' : 'display:none'}"><span class="user-join-date truncate">${registrationDate}</span></td>
            <td data-col="actions" style="${visibleColumnsUM.actions ? '' : 'display:none'}">
                <div class="admin-actions-cell">
                    <button class="admin-btn points open-edit" data-uid="${user.id}" data-name="${user.displayName || ''}" data-role="${user.role || 'user'}" data-usdt="${user.paperTrading?.balanceUSDT ?? 0}" data-onbit="${Number(user.mining?.onbit || 0)}" title="편집">
                        <i class="fas fa-pen"></i>
                        Edit
                    </button>
                </div>
            </td>
        `;
        usersTableBodyUM.appendChild(row);
    });

    usersTableBodyUM.querySelectorAll('.row-select-checkbox-um').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const uid = e.target.dataset.uid;
            if (e.target.checked) selectionSet.add(uid); else selectionSet.delete(uid);
            updateSelectionInfoUM();
            updateSelectAllStateUM();
        });
    });
}

function applyAndRender() {
    const filtered = applyFilter(allUsers);
    const sorted = applySort(filtered);
    const paged = applyPagination(sorted);
    renderUsersTable(paged);
    updatePaginationInfo(sorted.length);
    updateSelectionInfo();
    updateSelectAllState();
}

function applyAndRenderUM() {
    const filtered = applyFilterUM(allUsersUM);
    const sorted = applySortUM(filtered);
    const paged = applyPaginationUM(sorted);
    renderUsersTableUM(paged);
    updatePaginationInfoUM(sorted.length);
    updateSelectionInfoUM();
    updateSelectAllStateUM();
}

function applyFilter(users) {
    const term = (userSearchUid?.value || '').toLowerCase();
    const type = filterTypeSelect?.value || 'uid';
    if (!term) return users;
    return users.filter(user => {
        switch (type) {
            case 'nickname':
                return (user.displayName || '').toLowerCase().includes(term);
            case 'email':
                return (user.email || '').toLowerCase().includes(term);
            case 'uid':
            default:
                return (user.id || '').toLowerCase().includes(term);
        }
    });
}

function applyFilterUM(users) {
    const term = (document.getElementById('filter-uid-input-um')?.value || '').toLowerCase();
    const type = document.getElementById('filter-type-um')?.value || 'uid';
    if (!term) return users;
    return users.filter(user => {
        switch (type) {
            case 'nickname':
                return (user.displayName || '').toLowerCase().includes(term);
            case 'email':
                return (user.email || '').toLowerCase().includes(term);
            case 'uid':
            default:
                return (user.id || '').toLowerCase().includes(term);
        }
    });
}

function applySort(users) {
    if (!sortState.key) return users;
    const dir = sortState.dir === 'asc' ? 1 : -1;
    const key = sortState.key;
    return [...users].sort((a, b) => {
        let va, vb;
        switch (key) {
            case 'amount':
            case 'usdt': va = a.paperTrading?.balanceUSDT ?? 0; vb = b.paperTrading?.balanceUSDT ?? 0; break;
            case 'onbit': va = Number(a.mining?.onbit || 0); vb = Number(b.mining?.onbit || 0); break;
            case 'email': va = (a.email || '').toLowerCase(); vb = (b.email || '').toLowerCase(); break;
            case 'nickname': va = (a.displayName || '').toLowerCase(); vb = (b.displayName || '').toLowerCase(); break;
            case 'role': va = a.role || 'user'; vb = b.role || 'user'; break;
            case 'createdAt': va = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0; vb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0; break;
            default: va = (a[key] || '').toString(); vb = (b[key] || '').toString();
        }
        if (va < vb) return -1 * dir;
        if (va > vb) return 1 * dir;
        return 0;
    });
}

function applySortUM(users) {
    if (!sortStateUM.key) return users;
    const dir = sortStateUM.dir === 'asc' ? 1 : -1;
    const key = sortStateUM.key;
    return [...users].sort((a, b) => {
        let va, vb;
        switch (key) {
            case 'postCount': va = a.__metrics?.postCount || 0; vb = b.__metrics?.postCount || 0; break;
            case 'likeCount': va = a.__metrics?.likeCount || 0; vb = b.__metrics?.likeCount || 0; break;
            case 'followerCount': va = a.__metrics?.followerCount || 0; vb = b.__metrics?.followerCount || 0; break;
            case 'commentCount': va = a.__metrics?.commentCount || 0; vb = b.__metrics?.commentCount || 0; break;
            case 'email': va = (a.email || '').toLowerCase(); vb = (b.email || '').toLowerCase(); break;
            case 'nickname': va = (a.displayName || '').toLowerCase(); vb = (b.displayName || '').toLowerCase(); break;
            case 'role': va = a.role || 'user'; vb = b.role || 'user'; break;
            case 'createdAt': va = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0; vb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0; break;
            default: va = (a[key] || '').toString(); vb = (b[key] || '').toString();
        }
        if (va < vb) return -1 * dir;
        if (va > vb) return 1 * dir;
        return 0;
    });
}

function applyPagination(users) {
    const start = (currentPage - 1) * pageSize;
    return users.slice(start, start + pageSize);
}

function applyPaginationUM(users) {
    const start = (currentPageUM - 1) * pageSizeUM;
    return users.slice(start, start + pageSizeUM);
}

function updatePaginationInfo(total) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    if (pageInfo) pageInfo.textContent = `${currentPage} / ${totalPages}`;
    if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;
}

function updatePaginationInfoUM(total) {
    const totalPages = Math.max(1, Math.ceil(total / pageSizeUM));
    if (currentPageUM > totalPages) currentPageUM = totalPages;
    if (pageInfoUM) pageInfoUM.textContent = `${currentPageUM} / ${totalPages}`;
    if (prevPageBtnUM) prevPageBtnUM.disabled = currentPageUM <= 1;
    if (nextPageBtnUM) nextPageBtnUM.disabled = currentPageUM >= totalPages;
}

function updateSelectionInfo() {
    const filtered = applyFilter(allUsers);
    const selectedOnFiltered = [...selectionSet].filter(uid => filtered.some(u => u.id === uid));
    if (selectionInfo) selectionInfo.textContent = `${selectedOnFiltered.length} / ${filtered.length} 선택됨`;
}

function updateSelectionInfoUM() {
    const filtered = applyFilterUM(allUsersUM);
    const selectedOnFiltered = [...selectionSet].filter(uid => filtered.some(u => u.id === uid));
    if (selectionInfoUM) selectionInfoUM.textContent = `${selectedOnFiltered.length} / ${filtered.length} 선택됨`;
}

function updateSelectAllState() {
    if (!selectAllCheckbox) return;
    const currentRows = [...usersTableBody.querySelectorAll('.row-select-checkbox')];
    const allChecked = currentRows.length > 0 && currentRows.every(cb => cb.checked);
    const someChecked = currentRows.some(cb => cb.checked);
    selectAllCheckbox.indeterminate = !allChecked && someChecked;
    selectAllCheckbox.checked = allChecked;
}

function updateSelectAllStateUM() {
    if (!selectAllCheckboxUM || !usersTableBodyUM) return;
    const currentRows = [...usersTableBodyUM.querySelectorAll('.row-select-checkbox-um')];
    const allChecked = currentRows.length > 0 && currentRows.every(cb => cb.checked);
    const someChecked = currentRows.some(cb => cb.checked);
    selectAllCheckboxUM.indeterminate = !allChecked && someChecked;
    selectAllCheckboxUM.checked = allChecked;
}

function setupPaginationControls() {
    if (prevPageBtn) prevPageBtn.addEventListener('click', () => { currentPage = Math.max(1, currentPage - 1); applyAndRender(); });
    if (nextPageBtn) nextPageBtn.addEventListener('click', () => { currentPage = currentPage + 1; applyAndRender(); });
    if (pageSizeSelect) pageSizeSelect.addEventListener('change', (e) => { pageSize = Number(e.target.value) || 10; currentPage = 1; applyAndRender(); });
    if (selectAllCheckbox) selectAllCheckbox.addEventListener('change', (e) => {
        const pageRows = [...usersTableBody.querySelectorAll('.row-select-checkbox')];
        pageRows.forEach(cb => { cb.checked = e.target.checked; const uid = cb.dataset.uid; if (e.target.checked) selectionSet.add(uid); else selectionSet.delete(uid); });
        updateSelectionInfo();
        updateSelectAllState();
    });
}

function setupPaginationControlsUM() {
    if (prevPageBtnUM) prevPageBtnUM.addEventListener('click', () => { currentPageUM = Math.max(1, currentPageUM - 1); applyAndRenderUM(); });
    if (nextPageBtnUM) nextPageBtnUM.addEventListener('click', () => { currentPageUM = currentPageUM + 1; applyAndRenderUM(); });
    if (pageSizeSelectUM) pageSizeSelectUM.addEventListener('change', (e) => { pageSizeUM = Number(e.target.value) || 10; currentPageUM = 1; applyAndRenderUM(); });
    if (selectAllCheckboxUM) selectAllCheckboxUM.addEventListener('change', (e) => {
        if (!usersTableBodyUM) return;
        const pageRows = [...usersTableBodyUM.querySelectorAll('.row-select-checkbox-um')];
        pageRows.forEach(cb => { cb.checked = e.target.checked; const uid = cb.dataset.uid; if (e.target.checked) selectionSet.add(uid); else selectionSet.delete(uid); });
        updateSelectionInfoUM();
        updateSelectAllStateUM();
    });
}

function setupColumnVisibility() {
    // restore from localStorage
    try {
        const saved = localStorage.getItem('admin_column_visibility');
        if (saved) visibleColumns = { ...visibleColumns, ...JSON.parse(saved) };
    } catch (_) {}

    if (columnToggleBtn && columnToggleMenu) {
        columnToggleBtn.addEventListener('click', () => {
            const expanded = columnToggleBtn.getAttribute('aria-expanded') === 'true';
            columnToggleBtn.setAttribute('aria-expanded', String(!expanded));
            columnToggleMenu.setAttribute('aria-hidden', String(expanded));
        });
        columnToggleMenu.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            const key = cb.dataset.col;
            if (key in visibleColumns) cb.checked = !!visibleColumns[key];
            cb.addEventListener('change', () => {
                visibleColumns[key] = cb.checked;
                try { localStorage.setItem('admin_column_visibility', JSON.stringify(visibleColumns)); } catch (_) {}
                applyAndRender();
            });
        });
    }
}

function setupOutsideClickForColumns() {
    document.addEventListener('click', (e) => {
        if (!columnToggleBtn || !columnToggleMenu) return;
        const within = columnToggleBtn.contains(e.target) || columnToggleMenu.contains(e.target);
        if (!within) {
            columnToggleBtn.setAttribute('aria-expanded', 'false');
            columnToggleMenu.setAttribute('aria-hidden', 'true');
        }
    });
}

function restoreSidebarState() {
    if (!sidebar) return;
    try {
        const state = localStorage.getItem('admin_sidebar_state') || 'expanded';
        sidebar.setAttribute('data-state', state);
    } catch (_) {}
}

// sidebar toggle 제거됨

function setupSortableHeaders() {
    const headerMap = [
        { selector: 'th[data-col="uid"]', key: 'id' },
        { selector: 'th[data-col="nickname"]', key: 'nickname' },
        { selector: 'th[data-col="email"]', key: 'email' },
        { selector: 'th[data-col="usdt"]', key: 'usdt' },
        { selector: 'th[data-col="onbit"]', key: 'onbit' },
        { selector: 'th[data-col="role"]', key: 'role' },
        { selector: 'th[data-col="createdAt"]', key: 'createdAt' },
    ];
    headerMap.forEach(({ selector, key }) => {
        const th = document.querySelector(selector);
        if (!th) return;
        th.classList.add('sortable');
        th.addEventListener('click', () => {
            if (sortState.key === key) {
                sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
            } else {
                sortState.key = key;
                sortState.dir = 'asc';
            }
            applyAndRender();
            updateHeaderSortUI();
        });
    });
    updateHeaderSortUI();
}

function setupSortableHeadersUM() {
    const headerMap = [
        { selector: '#users-table-um thead th[data-col="uid"]', key: 'id' },
        { selector: '#users-table-um thead th[data-col="nickname"]', key: 'nickname' },
        { selector: '#users-table-um thead th[data-col="email"]', key: 'email' },
        { selector: '#users-table-um thead th[data-col="postCount"]', key: 'postCount' },
        { selector: '#users-table-um thead th[data-col="likeCount"]', key: 'likeCount' },
        { selector: '#users-table-um thead th[data-col="followerCount"]', key: 'followerCount' },
        { selector: '#users-table-um thead th[data-col="commentCount"]', key: 'commentCount' },
        { selector: '#users-table-um thead th[data-col="role"]', key: 'role' },
        { selector: '#users-table-um thead th[data-col="createdAt"]', key: 'createdAt' },
    ];
    headerMap.forEach(({ selector, key }) => {
        const th = document.querySelector(selector);
        if (!th) return;
        th.classList.add('sortable');
        th.addEventListener('click', () => {
            if (sortStateUM.key === key) {
                sortStateUM.dir = sortStateUM.dir === 'asc' ? 'desc' : 'asc';
            } else {
                sortStateUM.key = key;
                sortStateUM.dir = 'asc';
            }
            applyAndRenderUM();
            updateHeaderSortUIUM();
        });
    });
    updateHeaderSortUIUM();
}

function updateHeaderSortUI() {
    document.querySelectorAll('#users-table thead th').forEach(th => {
        const col = th.getAttribute('data-col');
        const isActive = (col === (sortState.key === 'nickname' ? 'nickname' : sortState.key));
        th.querySelector('.sort-icon')?.remove();
        if (isActive) {
            const icon = document.createElement('span');
            icon.className = 'sort-icon';
            icon.textContent = sortState.dir === 'asc' ? '▲' : '▼';
            th.appendChild(icon);
        }
    });
}

function updateHeaderSortUIUM() {
    document.querySelectorAll('#users-table-um thead th').forEach(th => {
        const col = th.getAttribute('data-col');
        const isActive = (col === (sortStateUM.key === 'nickname' ? 'nickname' : sortStateUM.key));
        th.querySelector('.sort-icon')?.remove();
        if (isActive) {
            const icon = document.createElement('span');
            icon.className = 'sort-icon';
            icon.textContent = sortStateUM.dir === 'asc' ? '▲' : '▼';
            th.appendChild(icon);
        }
    });
}

// 사용자 커뮤니티 지표 집계: posts, likes, comments, followers (간략 조회)
const userMetricsCache = new Map();
async function enrichUsersWithCommunityMetrics(users) {
    try {
        const dbCompat = window.firebase && window.firebase.firestore ? window.firebase.firestore() : null;
        if (!dbCompat) {
            users.forEach(u => { u.__metrics = u.__metrics || { postCount: 0, likeCount: 0, followerCount: 0, commentCount: 0 }; });
            return;
        }
        const pageUsers = users.slice();
        await Promise.all(pageUsers.map(async (u) => {
            if (!u || !u.id) return;
            if (userMetricsCache.has(u.id)) { u.__metrics = userMetricsCache.get(u.id); return; }
            const uid = u.id;
            const metrics = { postCount: 0, likeCount: 0, followerCount: 0, commentCount: 0 };
            try {
                const postsSnap = await dbCompat.collection('posts').where('authorId', '==', uid).get();
                metrics.postCount = postsSnap.size;
                let likeSum = 0;
                postsSnap.forEach(d => { const c = d.data()?.counts?.likes || 0; likeSum += (typeof c === 'number' ? c : 0); });
                metrics.likeCount = likeSum;
            } catch (_) {}
            try {
                const commentsSnap = await dbCompat.collection('comments').where('authorId', '==', uid).get();
                metrics.commentCount = commentsSnap.size;
            } catch (_) {}
            try {
                const followersSnap = await dbCompat.collection('users').doc(uid).collection('followers').get();
                metrics.followerCount = followersSnap.size;
            } catch (_) {}
            u.__metrics = metrics;
            userMetricsCache.set(uid, metrics);
        }));
    } catch (e) {
        users.forEach(u => { u.__metrics = u.__metrics || { postCount: 0, likeCount: 0, followerCount: 0, commentCount: 0 }; });
    }
}

// 사용자 관리 탭 필터 이벤트
document.getElementById('filter-search-um')?.addEventListener('click', () => { currentPageUM = 1; applyAndRenderUM(); });
document.getElementById('filter-uid-input-um')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { currentPageUM = 1; applyAndRenderUM(); }});
document.getElementById('filter-uid-input-um')?.addEventListener('input', () => { currentPageUM = 1; applyAndRenderUM(); });
document.getElementById('filter-type-um')?.addEventListener('change', () => { currentPageUM = 1; applyAndRenderUM(); });
document.getElementById('filter-reset-um')?.addEventListener('click', () => {
    const term = document.getElementById('filter-uid-input-um');
    const typeSel = document.getElementById('filter-type-um');
    if (term) term.value = '';
    if (typeSel) typeSel.value = 'uid';
    currentPageUM = 1;
    applyAndRenderUM();
});

function setupSidebarMenuScroll() {
    document.querySelectorAll('.sidebar-menu-button[data-scroll]')?.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-scroll');
            const dashboard = document.querySelector('#dashboard-users');
            const userMgmt = document.querySelector('#user-management');
            if (target === '#dashboard-users') {
                if (dashboard) dashboard.style.display = '';
                if (userMgmt) userMgmt.style.display = 'none';
                dashboard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else if (target === '#user-management') {
                if (dashboard) dashboard.style.display = 'none';
                if (userMgmt) userMgmt.style.display = '';
                userMgmt?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                const el = document.querySelector(target);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

// 사용자 편집 모달 로직
function openUserEditModal(uid, displayName, role, usdt, onbit) {
    if (!userEditModal) return;
    editUidInput.value = uid;
    editDisplayNameInput.value = displayName || '';
    editRoleSelect.value = role || 'user';
    if (typeof usdt === 'number') editUsdtInput.value = String(Math.max(0, Math.floor(usdt)));
    if (typeof onbit === 'number') editOnbitInput.value = Number(onbit).toFixed(3);
    userEditModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

closeUserEditModalBtn?.addEventListener('click', () => {
    if (!userEditModal) return;
    userEditModal.style.display = 'none';
    document.body.style.overflow = '';
});

cancelEditBtn?.addEventListener('click', () => {
    if (!userEditModal) return;
    userEditModal.style.display = 'none';
    document.body.style.overflow = '';
});

userEditForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const isAdminUser = await adminAuthManager.isAdminUser();
        if (!isAdminUser) {
            showToast('관리자 권한이 필요합니다.');
            return;
        }
        const uid = editUidInput.value;
        const newName = editDisplayNameInput.value.trim();
        const newRole = editRoleSelect.value;
        const newUsdt = Number(editUsdtInput.value);
        const newOnbit = Number(editOnbitInput.value);
        if (!uid || !newName || !newRole) {
            showToast('필수 값을 입력해주세요.');
            return;
        }
        if (!Number.isFinite(newUsdt) || newUsdt < 0) {
            showToast('USDT 잔고는 0 이상 숫자여야 합니다.');
            return;
        }
        if (!Number.isFinite(newOnbit) || newOnbit < 0) {
            showToast('ONBIT은 0 이상 숫자여야 합니다.');
            return;
        }
        await updateDoc(doc(db, 'users', uid), {
            displayName: newName,
            role: newRole,
            paperTrading: {
                balanceUSDT: Math.floor(newUsdt),
                equityUSDT: Math.floor(newUsdt)
            },
            mining: {
                onbit: Number(newOnbit.toFixed(3))
            }
        });
        showToast('사용자 정보가 저장되었습니다.');
        userEditModal.style.display = 'none';
        document.body.style.overflow = '';
        loadDashboardData();
    } catch (error) {
        console.error('사용자 편집 저장 오류:', error);
        showToast('저장 중 오류가 발생했습니다.');
    }
});

// 회원 탈퇴 (클라우드 함수 호출)
deleteUserBtn?.addEventListener('click', async () => {
    try {
        const isAdminUser = await adminAuthManager.isAdminUser();
        if (!isAdminUser) {
            showToast('관리자 권한이 필요합니다.');
            return;
        }
        const uid = editUidInput.value;
        if (!uid) return;
        if (!confirm('정말 이 회원을 탈퇴 처리하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
        const call = httpsCallable(fns, 'adminDeleteUser');
        await call({ uid });
        showToast('회원 탈퇴가 완료되었습니다.');
        userEditModal.style.display = 'none';
        document.body.style.overflow = '';
        loadDashboardData();
    } catch (e) {
        console.error('회원 탈퇴 실패:', e);
        showToast('회원 탈퇴 중 오류가 발생했습니다.');
    }
});

// USDT 잔고 설정 프롬프트 + 저장
async function openUsdtPrompt(uid) {
    try {
        const isAdminUser = await adminAuthManager.isAdminUser();
        if (!isAdminUser) {
            alert('관리자 권한이 필요합니다.');
            return;
        }
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (!userDoc.exists()) {
            alert('사용자를 찾을 수 없습니다.');
            return;
        }
        const current = userDoc.data().paperTrading?.balanceUSDT ?? 0;
        const input = prompt(`USDT 잔고를 설정하세요 (현재 ${current} USDT)`, String(current));
        if (input === null) return;
        const value = Number(input);
        if (!isFinite(value) || value < 0) {
            alert('0 이상 숫자를 입력하세요.');
            return;
        }
        await updateDoc(doc(db, 'users', uid), {
            paperTrading: {
                balanceUSDT: value,
                equityUSDT: value
            }
        });
        showToast(`USDT 잔고가 ${value.toLocaleString()}로 설정되었습니다.`);
        loadDashboardData();
    } catch (error) {
        console.error('USDT 설정 오류:', error);
        alert('USDT 잔고 설정 중 오류가 발생했습니다.');
    }
}

// ONBIT 잔고 설정 프롬프트 + 저장
async function openOnbitPrompt(uid) {
    try {
        const isAdminUser = await adminAuthManager.isAdminUser();
        if (!isAdminUser) {
            alert('관리자 권한이 필요합니다.');
            return;
        }
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (!userDoc.exists()) {
            alert('사용자를 찾을 수 없습니다.');
            return;
        }
        const current = Number(userDoc.data().mining?.onbit || 0);
        const input = prompt(`ONBIT 잔고를 설정하세요 (현재 ${current.toFixed(3)} ONBIT)`, String(current.toFixed(3)));
        if (input === null) return;
        const value = Number(input);
        if (!isFinite(value) || value < 0) {
            alert('0 이상 숫자를 입력하세요.');
            return;
        }
        await updateDoc(doc(db, 'users', uid), {
            mining: {
                onbit: Number(value.toFixed(3))
            }
        });
        showToast(`ONBIT 잔고가 ${value.toFixed(3)}로 설정되었습니다.`);
        loadDashboardData();
    } catch (error) {
        console.error('ONBIT 설정 오류:', error);
        alert('ONBIT 잔고 설정 중 오류가 발생했습니다.');
    }
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

// 사용자 검색 기능 제거됨 (개별 필터 입력 사용)

// 새로고침 버튼
refreshBtn?.addEventListener('click', () => {
    loadDashboardData();
    showToast('데이터가 새로고침되었습니다.');
});

// Filter bar actions
document.getElementById('filter-reset')?.addEventListener('click', () => {
    const uid = document.getElementById('filter-uid-input');
    const typeSel = document.getElementById('filter-type');
    if (uid) uid.value = '';
    if (typeSel) typeSel.value = 'uid';
    currentPage = 1;
    applyAndRender();
});

function triggerFilter() {
    currentPage = 1;
    applyAndRender();
}
document.getElementById('filter-search')?.addEventListener('click', triggerFilter);
document.getElementById('filter-uid-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') triggerFilter(); });
document.getElementById('filter-uid-input')?.addEventListener('input', () => { triggerFilter(); });
document.getElementById('filter-type')?.addEventListener('change', () => { triggerFilter(); });

// 권한 표시명 반환 함수
function getRoleDisplayName(role) {
    switch(role) {
        case 'admin': return '관리자';
        case 'moderator': return '모더레이터';
        case 'user': 
        default: return '일반 사용자';
    }
}

// 포인트 조정 모달 제거됨

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
            showToast('사용자 정보를 찾을 수 없습니다.');
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
                        <span class="detail-label">USDT 잔고:</span>
                        <span class="detail-value">${(userData.paperTrading?.balanceUSDT ?? 0).toLocaleString()} USDT</span>
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
        if (error && (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions.'))) {
            if (!hasShownDetailPermissionToast) {
                showToast('권한이 없어 사용자 상세를 볼 수 없습니다.');
                hasShownDetailPermissionToast = true;
            }
        } else {
            showToast('사용자 정보 로드에 문제가 발생했습니다. 잠시 후 다시 시도하세요.');
        }
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
// 포인트 모달 관련 이벤트 제거됨

document.getElementById('close-role-modal')?.addEventListener('click', () => {
    document.getElementById('role-modal').style.display = 'none';
    document.body.style.overflow = '';
});

document.getElementById('close-user-detail-modal')?.addEventListener('click', () => {
    document.getElementById('user-detail-modal').style.display = 'none';
    document.body.style.overflow = '';
});

// 🔒 보안 강화된 포인트 조정 폼 제출
// 포인트 조정 폼 제거됨

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