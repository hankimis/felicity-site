import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_EMAIL = "admin@site.com"; // 관리자 계정으로 사용할 이메일

// --- DOM Elements ---
const loginModal = document.getElementById('login-modal');
const signupModal = document.getElementById('signup-modal');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const authButtons = document.querySelectorAll('.auth-buttons'); // 모든 페이지의 auth-buttons 선택
const userProfiles = document.querySelectorAll('#user-profile'); // 모든 페이지의 user-profile 선택
const userLevels = document.querySelectorAll('#user-level');
const userDisplayNames = document.querySelectorAll('#user-display-name');
const logoutBtns = document.querySelectorAll('#logout-btn');
const mobileAuthButtons = document.querySelector('.mobile-menu-auth');
const mobileUserProfile = document.querySelector('.mobile-menu-user');
const mobileUserLevel = document.getElementById('mobile-user-level');
const mobileUserDisplayName = document.getElementById('mobile-user-display-name');
const mobileLogoutBtn = document.getElementById('mobile-logout-btn');

// --- Modal Handling ---
function setupModals() {
    const loginBtns = document.querySelectorAll('.login');
    const signupBtns = document.querySelectorAll('.signup');

    if (loginModal && signupModal) {
        const modals = [loginModal, signupModal];
        
        loginBtns.forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); loginModal.style.display = 'block'; }));
        signupBtns.forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); signupModal.style.display = 'block'; }));

        modals.forEach(modal => {
            const closeBtn = modal.querySelector('.auth-modal-close');
            closeBtn.addEventListener('click', () => modal.style.display = 'none');
        });

        window.addEventListener('click', (e) => {
            if (e.target === loginModal) loginModal.style.display = 'none';
            if (e.target === signupModal) signupModal.style.display = 'none';
        });

        document.getElementById('show-signup')?.addEventListener('click', (e) => {
            e.preventDefault();
            loginModal.style.display = 'none';
            signupModal.style.display = 'block';
        });
        document.getElementById('show-login')?.addEventListener('click', (e) => {
            e.preventDefault();
            signupModal.style.display = 'none';
            loginModal.style.display = 'block';
        });
    }
}
setupModals();

// --- Validation Functions ---
async function isNicknameAvailable(displayName) {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where("displayName", "==", displayName));
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty;
}

function validatePassword(password) {
    // 최소 8자, 영문, 숫자, 특수문자 포함 (더 넓은 범위의 특수문자 허용)
    const regex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    return regex.test(password);
}

// --- Authentication Logic ---
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const displayName = signupForm['signup-name'].value;
        const email = signupForm['signup-email'].value;
        const password = signupForm['signup-password'].value;
        const confirmPassword = signupForm['signup-confirm-password'].value;
        const errorMessage = document.getElementById('signup-error-message');
        
        // Validation Checks
        if (password !== confirmPassword) {
            errorMessage.textContent = '비밀번호가 일치하지 않습니다.';
            return;
        }
        if (!validatePassword(password)) {
            errorMessage.textContent = '비밀번호는 8자 이상이며, 영문, 숫자, 특수문자를 포함해야 합니다.';
            return;
        }
        if (!(await isNicknameAvailable(displayName))) {
            errorMessage.textContent = '이미 사용 중인 닉네임입니다.';
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await updateProfile(user, { displayName: displayName });
            
            const userRole = (email === ADMIN_EMAIL) ? 'admin' : 'user';
            const photoURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;

            await setDoc(doc(db, 'users', user.uid), {
                displayName: displayName,
                email: email,
                level: 1,
                role: userRole,
                photoURL: photoURL,
                createdAt: serverTimestamp()
            });

            signupForm.reset();
            signupModal.style.display = 'none';
            errorMessage.textContent = '';
        } catch (error) {
            console.error("Signup Error:", error);
            errorMessage.textContent = getAuthErrorMessage(error.code);
        }
    });
}

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm['login-email'].value;
        const password = loginForm['login-password'].value;
        const errorMessage = document.getElementById('login-error-message');

        try {
            await signInWithEmailAndPassword(auth, email, password);
            loginForm.reset();
            loginModal.style.display = 'none';
            errorMessage.textContent = '';
        } catch (error) {
            console.error("Login Error:", error);
            errorMessage.textContent = getAuthErrorMessage(error.code);
        }
    });
}

logoutBtns.forEach(btn => btn.addEventListener('click', () => signOut(auth)));
if (mobileLogoutBtn) {
    mobileLogoutBtn.addEventListener('click', () => signOut(auth));
}

// --- Auth State Change Handler ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        let userData = { 
            displayName: user.displayName, 
            level: 1, 
            role: 'user',
            photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=random` 
        };
        if (userDoc.exists()) {
            const dbData = userDoc.data();
            // If photoURL doesn't exist in db, use the generated one
            userData = { ...userData, ...dbData };
            if (!dbData.photoURL) {
                userData.photoURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(dbData.displayName)}&background=random`;
            }
        }

        // Update UI on all pages
        authButtons.forEach(btn => btn.style.display = 'none');
        userProfiles.forEach(profile => profile.style.display = 'flex');
        userLevels.forEach(levelEl => {
            if (userData.role === 'admin') {
                levelEl.textContent = '[Admin]';
                levelEl.style.color = '#ef5350';
            } else {
                levelEl.textContent = `[Lv.${userData.level}]`;
                levelEl.style.color = 'var(--primary-color)';
            }
        });
        userDisplayNames.forEach(nameEl => nameEl.textContent = userData.displayName);

        // Update Mobile Menu UI
        if (mobileAuthButtons) mobileAuthButtons.style.display = 'none';
        if (mobileUserProfile) {
            mobileUserProfile.style.display = 'flex';
            if (mobileUserLevel) {
                 if (userData.role === 'admin') {
                    mobileUserLevel.textContent = '[Admin]';
                } else {
                    mobileUserLevel.textContent = `[Lv.${userData.level}]`;
                }
            }
            if (mobileUserDisplayName) mobileUserDisplayName.textContent = userData.displayName;
        }

    } else {
        // Update UI on all pages
        authButtons.forEach(btn => btn.style.display = 'flex');
        userProfiles.forEach(profile => profile.style.display = 'none');
        
        // Update Mobile Menu UI
        if (mobileAuthButtons) mobileAuthButtons.style.display = 'flex';
        if (mobileUserProfile) mobileUserProfile.style.display = 'none';
    }
});

function getAuthErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/invalid-email': return '유효하지 않은 이메일 주소입니다.';
        case 'auth/user-disabled': return '이 계정은 비활성화되었습니다.';
        case 'auth/user-not-found': return '사용자를 찾을 수 없습니다.';
        case 'auth/wrong-password': return '비밀번호가 올바르지 않습니다.';
        case 'auth/email-already-in-use': return '이미 사용 중인 이메일입니다.';
        case 'auth/weak-password': return '비밀번호는 8자 이상이어야 합니다.';
        default: return '오류가 발생했습니다. 다시 시도해주세요.';
    }
} 