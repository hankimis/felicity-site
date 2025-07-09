# 🔐 AdminAuthManager 사용 가이드

## 📋 개요

`AdminAuthManager`는 Felicity-Site 프로젝트의 보안 강화된 어드민 인증 시스템입니다. 다층 보안 검증, 실시간 우회 탐지, 보안 이벤트 로깅 등의 기능을 제공합니다.

## 🚀 기본 사용법

### 1. 모듈 Import

```javascript
import adminAuthManager from './js/admin-auth-manager.js';
```

### 2. 인증 상태 감지

```javascript
// 인증 상태 변경 감지
adminAuthManager.onAuthStateChange((user, isAdmin) => {
    console.log('사용자:', user ? user.email : 'none');
    console.log('어드민 권한:', isAdmin);
    
    // UI 업데이트
    updateAdminUI(isAdmin);
});
```

### 3. 어드민 권한 확인

```javascript
// 현재 사용자의 어드민 권한 확인
const isAdmin = await adminAuthManager.isAdminUser();

if (isAdmin) {
    // 어드민 전용 기능 실행
    showAdminFeatures();
} else {
    // 접근 거부
    showAccessDenied();
}
```

## 🛡️ 보안 기능

### 1. 다층 인증 검증

시스템은 다음 4단계 검증을 수행합니다:

1. **Firestore 역할 검증**: `users` 컬렉션의 `role` 필드 확인
2. **이메일 기반 검증**: 허용된 어드민 이메일 목록 확인
3. **개발 환경 검증**: 로컬 스토리지 검증 (개발용)
4. **세션 무결성 검사**: 세션 타임아웃 및 활동 추적

### 2. 실시간 우회 탐지

```javascript
// 보안 이벤트 감지
adminAuthManager.onSecurityEvent((eventType, details) => {
    console.log('보안 이벤트:', eventType, details);
    
    if (eventType === 'BYPASS_ATTEMPT') {
        // 우회 시도 탐지 시 조치
        handleSecurityBreach(details);
    }
});
```

### 3. 보안 이벤트 로깅

모든 보안 이벤트는 자동으로 Firestore의 `security_logs` 컬렉션에 저장됩니다.

## 📖 페이지별 구현 예시

### 1. 공지사항 페이지 (notice-board.js)

```javascript
import adminAuthManager from './js/admin-auth-manager.js';

let currentUser = null;
let isAdmin = false;

// 인증 상태 감지
adminAuthManager.onAuthStateChange((user, adminStatus) => {
    currentUser = user;
    isAdmin = adminStatus;
    updateAdminUI();
});

// UI 업데이트
function updateAdminUI() {
    const adminWriteBtn = document.getElementById('admin-write-btn');
    
    if (adminWriteBtn) {
        adminWriteBtn.style.display = isAdmin ? 'flex' : 'none';
        
        if (isAdmin) {
            adminWriteBtn.addEventListener('click', handleAdminAction);
        }
    }
}

// 보안 강화된 어드민 액션
async function handleAdminAction() {
    // 실시간 권한 재검증
    const isCurrentlyAdmin = await adminAuthManager.isAdminUser();
    
    if (!isCurrentlyAdmin) {
        alert('⚠️ 관리자 권한이 없습니다.');
        return;
    }
    
    // 어드민 기능 실행
    showAdminModal();
}
```

### 2. 이벤트 관리 페이지

```javascript
import adminAuthManager from './js/admin-auth-manager.js';

// 이벤트 생성 폼 제출
document.getElementById('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // 권한 검증
    const isAdmin = await adminAuthManager.isAdminUser();
    
    if (!isAdmin) {
        alert('⚠️ 관리자 권한이 필요합니다.');
        return;
    }
    
    // 이벤트 생성 로직
    await createEvent(formData);
});
```

### 3. 사용자 관리 페이지

```javascript
import adminAuthManager from './js/admin-auth-manager.js';

// 사용자 차단 기능
async function blockUser(userId) {
    // 권한 검증
    const isAdmin = await adminAuthManager.isAdminUser();
    
    if (!isAdmin) {
        throw new Error('관리자 권한이 필요합니다.');
    }
    
    // 사용자 차단 로직
    await updateDoc(doc(db, 'users', userId), {
        isBlocked: true,
        blockedAt: serverTimestamp(),
        blockedBy: adminAuthManager.getCurrentUser().uid
    });
}
```

## 🔧 개발 환경 디버깅

개발 환경에서는 다음 디버깅 도구를 사용할 수 있습니다:

```javascript
// 콘솔에서 사용 가능한 디버깅 함수들
AdminAuthDebug.setAdmin();        // 어드민 권한 부여
AdminAuthDebug.removeAdmin();     // 어드민 권한 제거
AdminAuthDebug.checkStatus();     // 현재 권한 상태 확인
AdminAuthDebug.getSecurityLogs(); // 최근 보안 로그 조회
```

## 🚨 보안 모범 사례

### 1. 실시간 권한 재검증

```javascript
// ❌ 잘못된 방법: 한 번만 검증
if (isAdmin) {
    // 시간이 지난 후 실행되는 코드
    setTimeout(() => {
        performAdminAction(); // 권한이 만료되었을 수 있음
    }, 30000);
}

// ✅ 올바른 방법: 실시간 재검증
setTimeout(async () => {
    const isCurrentlyAdmin = await adminAuthManager.isAdminUser();
    if (isCurrentlyAdmin) {
        performAdminAction();
    }
}, 30000);
```

### 2. 보안 메타데이터 추가

```javascript
// 어드민 액션 실행 시 보안 정보 추가
const securityMetadata = {
    authorId: adminAuthManager.getCurrentUser().uid,
    authorEmail: adminAuthManager.getCurrentUser().email,
    createdBy: 'AdminAuthManager',
    securityLevel: 'admin-verified',
    sessionId: adminAuthManager.sessionStartTime
};

await addDoc(collection(db, 'notices'), {
    ...noticeData,
    ...securityMetadata
});
```

### 3. 에러 처리

```javascript
try {
    const isAdmin = await adminAuthManager.isAdminUser();
    if (!isAdmin) {
        throw new Error('UNAUTHORIZED');
    }
    
    // 어드민 기능 실행
    await performAdminAction();
    
} catch (error) {
    if (error.message === 'UNAUTHORIZED') {
        alert('⚠️ 관리자 권한이 필요합니다.');
    } else {
        console.error('어드민 액션 오류:', error);
        alert('❌ 작업 중 오류가 발생했습니다.');
    }
}
```

## 📊 보안 모니터링

### 1. 보안 이벤트 타입

- `LOGIN_SUCCESS`: 성공적인 로그인
- `LOGIN_FAILED`: 로그인 실패
- `BYPASS_ATTEMPT`: 우회 시도 탐지
- `CONSOLE_MANIPULATION`: 콘솔 조작 탐지
- `DOM_MANIPULATION`: DOM 조작 탐지
- `UNAUTHORIZED_ACCESS`: 무권한 접근 시도
- `SESSION_EXPIRED`: 세션 만료
- `PRIVILEGE_ESCALATION`: 권한 상승 시도

### 2. 보안 로그 분석

```javascript
// 보안 로그 조회
const securityLogs = await getDocs(query(
    collection(db, 'security_logs'),
    where('eventType', '==', 'BYPASS_ATTEMPT'),
    orderBy('timestamp', 'desc'),
    limit(10)
));

securityLogs.forEach(doc => {
    const log = doc.data();
    console.log('보안 이벤트:', log.eventType, log.details);
});
```

## 🔒 HTML 페이지 통합

### 1. 스크립트 추가

```html
<!-- AdminAuthManager 모듈 추가 -->
<script type="module" src="js/admin-auth-manager.js"></script>
<script type="module" src="your-page.js"></script>
```

### 2. 보안 UI 스타일

```css
/* 보안 인증 표시 */
.admin-security-info {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    font-size: 0.9rem;
    font-weight: 500;
}

/* 보안 경고 */
.security-warning {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 16px;
}

/* 보안 강화된 버튼 */
.admin-btn {
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}
```

## 🎯 마이그레이션 가이드

기존 어드민 인증 코드를 새로운 시스템으로 마이그레이션하는 방법:

### 1. 기존 코드 제거

```javascript
// ❌ 제거할 코드
const ADMIN_EMAIL = "admin@site.com";

onAuthStateChanged(auth, (user) => {
    if (user && user.email === ADMIN_EMAIL) {
        // 어드민 기능 활성화
    }
});
```

### 2. 새로운 시스템 적용

```javascript
// ✅ 새로운 코드
import adminAuthManager from './js/admin-auth-manager.js';

adminAuthManager.onAuthStateChange((user, isAdmin) => {
    if (isAdmin) {
        // 어드민 기능 활성화
    }
});
```

## 🔍 문제 해결

### 1. 권한이 제대로 인식되지 않는 경우

```javascript
// 디버깅 정보 확인
AdminAuthDebug.checkStatus();

// Firestore 사용자 문서 확인
const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
console.log('사용자 데이터:', userDoc.data());
```

### 2. 보안 이벤트가 과도하게 발생하는 경우

개발 환경에서는 일부 보안 모니터링을 비활성화할 수 있습니다:

```javascript
// 개발 환경에서만 특정 모니터링 비활성화
if (SECURITY_CONFIG.DEV_MODE) {
    // 개발자 도구 탐지 비활성화
    // this.monitorDevTools();
}
```

## 📝 결론

`AdminAuthManager`는 강력한 보안 기능을 제공하는 동시에 사용하기 쉬운 인터페이스를 제공합니다. 모든 어드민 기능에서 실시간 권한 재검증을 수행하고, 보안 이벤트를 적절히 모니터링하여 안전한 관리자 시스템을 구축할 수 있습니다. 