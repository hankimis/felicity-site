import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, RecaptchaVerifier, signInWithPhoneNumber, PhoneAuthProvider, linkWithCredential, PhoneAuthCredential, verifyBeforeUpdateEmail, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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
const bioInput = document.getElementById('bio');
const profileUpdateForm = document.getElementById('profile-update-form');
const saveProfileBtn = document.getElementById('save-profile-btn');
const uploadStatus = document.getElementById('upload-status');
// Sidebar
const sidebarImg = document.getElementById('sidebar-profile-img');
const sidebarName = document.getElementById('sidebar-name');
const sidebarEmail = document.getElementById('sidebar-email');
// new left header elements
const leftProfileImg = document.getElementById('left-profile-img');
const leftUsername = document.getElementById('left-username');
const leftUseremail = document.getElementById('left-useremail');
// Display fields
const nameDisplay = document.getElementById('name-display');
const emailDisplay = document.getElementById('email-display');
const phoneDisplay = document.getElementById('phone-display');
const introDisplay = document.getElementById('intro-display');
// Toggles
const togglePromoPhone = document.getElementById('toggle-promo-phone');
const togglePromoEmail = document.getElementById('toggle-promo-email');
const toggleAlertSms = document.getElementById('toggle-alert-sms');
// Edit modal
const editModal = document.getElementById('edit-modal');
const editInput = document.getElementById('edit-input');
const editTextarea = document.getElementById('edit-textarea');
const editError = document.getElementById('edit-error');
const editSuccess = document.getElementById('edit-success');
const editMessage = document.getElementById('edit-message');
const editForm = document.getElementById('edit-modal-form');
const editSubmitBtn = document.getElementById('edit-submit-btn');
let editFieldKey = null;
let nameCheckUnsub = null;

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        await loadUserData(user);
    } else {
        // Not logged in, redirect to home page
        window.location.href = '../index.html';
    }
});

// 동의 토글 상태 로드/저장
function bindConsentToggle(input, key) {
    if (!input) return;
    input.addEventListener('change', async () => {
        if (!auth.currentUser) return;
        try {
            const userDocRef = doc(db, 'users', auth.currentUser.uid);
            const value = !!input.checked;
            await updateDoc(userDocRef, { [`consent.${key}`]: value, updatedAt: new Date() });
        } catch (e) {
            console.error('consent update error', e);
            input.checked = !input.checked; // revert
        }
    });
}

bindConsentToggle(togglePromoPhone, 'promoPhone');
bindConsentToggle(togglePromoEmail, 'promoEmail');
bindConsentToggle(toggleAlertSms, 'alertSms');

// Open edit modal helper
function openEditModal(title, currentValue, fieldKey) {
    if (!editModal) return;
    document.getElementById('edit-modal-title').textContent = title;
    // textarea for bio (multiline), input for others
    if (fieldKey === 'bio') {
        editInput.style.display = 'none';
        editTextarea.style.display = 'block';
        editTextarea.value = currentValue || '';
        // textarea mode
    } else {
        editTextarea.style.display = 'none';
        editInput.style.display = 'block';
        editInput.value = currentValue || '';
        // input mode
    }
    // 이름 수정 시 실시간 중복 확인
    if (fieldKey === 'displayName') {
        setupNameDuplicateCheck();
    } else {
        teardownNameDuplicateCheck();
    }
    if (editError) { editError.style.display = 'none'; editError.textContent = ''; }
    editFieldKey = fieldKey;
    editModal.style.display = 'flex';
}

function closeEditModal() {
    if (editModal) editModal.style.display = 'none';
    editFieldKey = null;
    teardownNameDuplicateCheck();
}

// bind close buttons
document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', closeEditModal));

// attach to row actions
const editPhoneBtn = document.getElementById('edit-phone-btn');
const editEmailBtn = document.getElementById('edit-email-btn');
const editIntroBtn = document.getElementById('edit-intro-btn');
const editNameBtn = document.getElementById('edit-name-btn');
if (editNameBtn) editNameBtn.addEventListener('click', () => openEditModal('이름 수정', nameDisplay?.textContent, 'displayName'));
if (editPhoneBtn) editPhoneBtn.addEventListener('click', () => openPhoneModal());
if (editEmailBtn) editEmailBtn.addEventListener('click', () => openEmailModal());
if (editIntroBtn) editIntroBtn.addEventListener('click', () => openEditModal('소개 수정', introDisplay?.textContent, 'bio'));

// save from modal
if (editForm) {
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!auth.currentUser || !editFieldKey) return;
        try {
            const value = (editFieldKey === 'bio' ? editTextarea.value : editInput.value).trim();
            // validation: displayName duplicate check
            if (editFieldKey === 'displayName') {
                if (!value) throw new Error('닉네임을 입력하세요.');
                if (value.length > 8) throw new Error('닉네임은 8자 이하로 입력해주세요.');
                // 간단 중복 체크: 인덱스 컬렉션
                const q = await getDoc(doc(db, 'displayNames', value));
                if (q.exists() && (currentUser?.displayName !== value)) {
                    throw new Error('이미 사용 중인 닉네임입니다.');
                }
            }
            const userDocRef = doc(db, 'users', auth.currentUser.uid);
            await updateDoc(userDocRef, { [editFieldKey]: value, updatedAt: new Date() });
            // 닉네임 인덱스 문서 업데이트(중복 체크용)
            if (editFieldKey === 'displayName') {
                try { await setDoc(doc(db, 'displayNames', value), { uid: auth.currentUser.uid }); } catch {}
            }
            // reflect UI
            if (editFieldKey === 'displayName') {
                if (nameDisplay) nameDisplay.textContent = value;
                if (leftUsername) leftUsername.textContent = value;
                if (sidebarName) sidebarName.textContent = value;
            } else if (editFieldKey === 'phone') {
                if (phoneDisplay) phoneDisplay.textContent = value || '미등록';
            } else if (editFieldKey === 'email') {
                if (emailDisplay) emailDisplay.textContent = value;
                if (leftUseremail) leftUseremail.textContent = value;
                if (sidebarEmail) sidebarEmail.textContent = value;
            } else if (editFieldKey === 'bio') {
                if (introDisplay) introDisplay.textContent = value;
            }
            closeEditModal();
        } catch (e) {
            console.error('edit save error', e);
            if (editError) { editError.textContent = e.message || '저장 실패'; editError.style.display = 'block'; }
        }
    });
}

// 실시간 닉네임 중복 확인 세팅
function setupNameDuplicateCheck() {
    if (!editInput) return;
    const handler = async () => {
        const value = editInput.value.trim();
        if (!value) { setNameStatus('닉네임을 입력하세요.', 'error'); toggleSubmit(false); return; }
        if (value.length > 8) { setNameStatus('닉네임은 8자 이하', 'error'); toggleSubmit(false); return; }
        try {
            const snap = await getDoc(doc(db, 'displayNames', value));
            const taken = snap.exists() && (currentUser?.displayName !== value);
            if (taken) { setNameStatus('이미 사용 중', 'error'); toggleSubmit(false); }
            else { setNameStatus('사용 가능', 'ok'); toggleSubmit(true); }
        } catch {
            setNameStatus('', ''); toggleSubmit(true);
        }
    };
    editInput.addEventListener('input', handler);
    nameCheckUnsub = () => editInput.removeEventListener('input', handler);
    // 최초 1회 체크
    handler();
}

function teardownNameDuplicateCheck() {
    if (nameCheckUnsub) { nameCheckUnsub(); nameCheckUnsub = null; }
    setNameStatus('', ''); toggleSubmit(true);
}

function setNameStatus(text, type) {
    // show success in green, error in red
    if (!editSuccess || !editError) return;
    editSuccess.style.display = 'none'; editSuccess.textContent = '';
    editError.style.display = 'none'; editError.textContent = '';
    if (!text) return;
    if (type === 'ok') { editSuccess.textContent = text; editSuccess.style.display = 'block'; }
    else { editError.textContent = text; editError.style.display = 'block'; }
}

function toggleSubmit(enabled) {
    if (!editSubmitBtn) return;
    editSubmitBtn.disabled = !enabled;
}

// 사진 변경 모달
const openPhotoBtn = document.getElementById('open-photo-modal');
const photoModal = document.getElementById('photo-modal');
const photoFile = document.getElementById('photo-file');
const photoPreview = document.getElementById('photo-preview');
const photoSaveBtn = document.getElementById('photo-save-btn');
if (openPhotoBtn) openPhotoBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (photoModal) {
        if (photoPreview) photoPreview.src = profilePicPreview.src;
        if (photoFile) photoFile.value = '';
        if (photoSaveBtn) photoSaveBtn.disabled = true;
        photoModal.style.display = 'flex';
    }
});
if (photoSaveBtn) photoSaveBtn.addEventListener('click', async () => {
    if (!photoFile || !photoFile.files?.[0]) { closePhotoModal(); return; }
    await updatePhotoWithFile(photoFile.files[0]);
});
// 파일 선택 시 미리보기만 반영하고 저장은 버튼으로
if (photoFile) photoFile.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) { if (photoSaveBtn) photoSaveBtn.disabled = true; return; }
    try {
        const tempUrl = URL.createObjectURL(file);
        if (photoPreview) photoPreview.src = tempUrl;
        if (photoSaveBtn) photoSaveBtn.disabled = false;
    } catch (e) { console.error('photo change error', e); }
});
async function updatePhotoWithFile(file) {
    if (!auth.currentUser || !file) return;
    try {
        const compressedImage = await compressImage(file);
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userDocRef, { photoURL: compressedImage, updatedAt: new Date() });
        // UI 동기화
        profilePicPreview.src = compressedImage;
        if (leftProfileImg) leftProfileImg.src = compressedImage;
        if (sidebarImg) sidebarImg.src = compressedImage;
        closePhotoModal();
    } catch (e) { console.error('updatePhotoWithFile error', e); }
}
function closePhotoModal() { if (photoModal) photoModal.style.display = 'none'; }
document.querySelectorAll('#photo-modal [data-close]').forEach(btn => btn.addEventListener('click', closePhotoModal));

// 휴대전화 인증 모달
const phoneModal = document.getElementById('phone-modal');
const phoneSendForm = document.getElementById('phone-send-form');
const phoneDDBtn = document.getElementById('dropdown-phone-button');
const phoneDD = document.getElementById('dropdown-phone');
const phoneInput = document.getElementById('phone-input');
const phoneSendBtn = document.getElementById('send-code-btn');
let phoneCode = '+82';
const phoneVerifyBtn = document.getElementById('phone-verify-btn');
const phoneStatus = document.getElementById('phone-status');
const phoneSuccess = document.getElementById('phone-success');
let confirmationResult = null;
let recaptchaVerifierInstance = null;

function openPhoneModal() {
    if (!phoneModal) return;
    hidePhoneStatus();
    phoneVerifyBtn.disabled = true;
    phoneModal.style.display = 'flex';
    // reCAPTCHA 준비 (1회 생성)
    initRecaptchaVerifier();
}
document.querySelectorAll('#phone-modal [data-close]').forEach(btn => btn.addEventListener('click', () => phoneModal.style.display = 'none'));

// dropdown interactions
if (phoneDDBtn) phoneDDBtn.addEventListener('click', () => {
    if (phoneDD) phoneDD.classList.toggle('hidden');
});
document.querySelectorAll('.phone-dd-item').forEach(btn => btn.addEventListener('click', (e) => {
    phoneCode = e.currentTarget.getAttribute('data-code') || '+82';
    if (phoneDDBtn) phoneDDBtn.textContent = phoneCode + ' ▾';
    if (phoneDD) phoneDD.classList.add('hidden');
}));

if (phoneSendForm) phoneSendForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!auth.currentUser) return;
    const phone = (phoneCode || '+82') + (phoneInput.value || '').replace(/[^0-9]/g, '');
    if (!/^[+][0-9]{6,15}$/.test(phone)) { showPhoneError('전화번호를 정확히 입력하세요.'); return; }
    try {
        const appVerifier = await initRecaptchaVerifier();
        // reCAPTCHA 토큰 미리 획득 (invisible)
        try { await appVerifier.verify(); } catch {}
        confirmationResult = await signInWithPhoneNumber(auth, phone, appVerifier);
        window._confirmationResult = confirmationResult;
        showPhoneSuccess('인증번호를 전송했습니다.');
        document.getElementById('otp-wrap').style.display = 'flex';
        phoneVerifyBtn.disabled = false;
        setupOtpInputs();
        const first = document.getElementById('otp-0');
        if (first) first.focus();
    } catch (e) {
        console.error('send code error', e);
        showPhoneError('전송 실패. 잠시 후 다시 시도해주세요.');
        // reCAPTCHA 재초기화 (invalid-app-credential 방지)
        resetRecaptchaVerifier();
    }
});

if (phoneVerifyBtn) phoneVerifyBtn.addEventListener('click', async () => {
    if (!auth.currentUser || !confirmationResult) return;
    const code = collectOtp();
    if (code.length !== 6) { showPhoneError('6자리 인증번호를 입력하세요.'); return; }
    try {
        const credential = PhoneAuthProvider.credential(confirmationResult.verificationId, code);
        // 계정에 전화번호 링크
        await linkWithCredential(auth.currentUser, credential);
        // Firestore 업데이트
        const phone = (phoneCode || '+82') + (phoneInput.value || '').replace(/[^0-9]/g, '');
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { phone, updatedAt: new Date() });
        if (phoneDisplay) phoneDisplay.textContent = phone;
        phoneSuccess.textContent = '인증 및 저장 완료';
        phoneSuccess.style.display = 'block';
        setTimeout(() => phoneModal.style.display = 'none', 700);
    } catch (e) {
        console.error('verify error', e);
        showPhoneError('인증 실패. 코드가 올바른지 확인하세요.');
    }
});

function collectOtp() {
    let v = '';
    for (let i = 0; i < 6; i++) {
        const el = document.getElementById(`otp-${i}`);
        v += (el && el.value) ? el.value.trim() : '';
    }
    return v;
}

function setupOtpInputs() {
    for (let i = 0; i < 6; i++) {
        const el = document.getElementById(`otp-${i}`);
        if (!el) continue;
        el.addEventListener('input', () => {
            el.value = el.value.replace(/[^0-9]/g, '').slice(0,1);
            if (el.value && i < 5) {
                const next = document.getElementById(`otp-${i+1}`);
                if (next) next.focus();
            }
        });
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !el.value && i > 0) {
                const prev = document.getElementById(`otp-${i-1}`);
                if (prev) prev.focus();
            }
        });
    }
}

function hidePhoneStatus() {
    if (phoneStatus) { phoneStatus.style.display = 'none'; phoneStatus.textContent = ''; }
    if (phoneSuccess) { phoneSuccess.style.display = 'none'; phoneSuccess.textContent = ''; }
}
function showPhoneError(text) { hidePhoneStatus(); if (phoneStatus) { phoneStatus.textContent = text; phoneStatus.style.display = 'block'; } }
function showPhoneSuccess(text) { hidePhoneStatus(); if (phoneSuccess) { phoneSuccess.textContent = text; phoneSuccess.style.display = 'block'; } }

// reCAPTCHA 관리
async function initRecaptchaVerifier() {
    if (recaptchaVerifierInstance) return recaptchaVerifierInstance;
    recaptchaVerifierInstance = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible'
    });
    try { await recaptchaVerifierInstance.render(); } catch {}
    window.recaptchaVerifier = recaptchaVerifierInstance;
    return recaptchaVerifierInstance;
}

// 탭 전환: 사이드바 항목 클릭 시 해당 섹션만 표시
document.querySelectorAll('.left_item[data-section], .lnb_item[data-section]').forEach((el) => {
    el.addEventListener('click', (e) => {
        e.preventDefault();
        const section = el.getAttribute('data-section');
        switchSection(section);
        // active 표시 업데이트
        document.querySelectorAll('.left_menu .menu_text').forEach(m => m.classList.remove('on'));
        const text = el.querySelector('.menu_text');
        if (text) text.classList.add('on');
    });
});

function switchSection(section) {
    // account-content 내부의 탭만 전환: 같은 컨테이너의 .section-block 대상으로
    const container = document.querySelector('.account-content');
    if (!container) return;
    container.querySelectorAll('.section-block').forEach(s => {
        if (s.getAttribute('data-section') === section) s.style.display = '';
        else s.style.display = 'none';
    });
}

// 보안설정 모달 핸들러
const openPasswordModalBtn = document.getElementById('open-password-modal');
const openDeleteModalBtn = document.getElementById('open-delete-modal');
const passwordModal = document.getElementById('password-modal');
const deleteModal = document.getElementById('delete-modal');
if (openPasswordModalBtn) openPasswordModalBtn.addEventListener('click', () => { if (passwordModal) passwordModal.style.display = 'flex'; });
if (openDeleteModalBtn) openDeleteModalBtn.addEventListener('click', () => { if (deleteModal) deleteModal.style.display = 'flex'; });
document.querySelectorAll('#password-modal [data-close]').forEach(btn => btn.addEventListener('click', () => passwordModal.style.display='none'));
document.querySelectorAll('#delete-modal [data-close]').forEach(btn => btn.addEventListener('click', () => deleteModal.style.display='none'));

// 비밀번호 변경
const passwordForm = document.getElementById('password-form');
const currentPasswordEl = document.getElementById('current-password');
const newPasswordEl = document.getElementById('new-password');
const confirmPasswordEl = document.getElementById('confirm-password');
const passwordStatus = document.getElementById('password-status');
const passwordSuccess = document.getElementById('password-success');
if (passwordForm) passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    // Turnstile 토큰 확인
    const turnstileToken = window.turnstile ? window.turnstile.getResponse?.(document.getElementById('password-turnstile')) : null;
    if (!turnstileToken) { passwordStatus.textContent='보안 확인을 완료해주세요.'; passwordStatus.style.display='block'; return; }
    const currentPw = currentPasswordEl.value;
    const newPw = newPasswordEl.value;
    const confirmPw = confirmPasswordEl.value;
    if (!currentPw || !newPw || !confirmPw) { passwordStatus.textContent='모든 필드를 입력하세요.'; passwordStatus.style.display='block'; return; }
    if (newPw !== confirmPw) { passwordStatus.textContent='새 비밀번호가 일치하지 않습니다.'; passwordStatus.style.display='block'; return; }
    try {
        // 재인증 후 업데이트 권장: 이메일/비밀번호 로그인 사용 시
        // 여기서는 간단히 updatePassword만 사용 (실서비스에서 reauthenticateWithCredential 사용 권장)
        const { updatePassword, EmailAuthProvider, reauthenticateWithCredential } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        if (auth.currentUser.email) {
            const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPw);
            await reauthenticateWithCredential(auth.currentUser, cred);
        }
        await updatePassword(auth.currentUser, newPw);
        passwordStatus.style.display='none';
        passwordSuccess.textContent='비밀번호가 변경되었습니다.'; passwordSuccess.style.display='block';
        setTimeout(()=>{ if (passwordModal) passwordModal.style.display='none'; }, 600);
    } catch (err) {
        console.error('password change error', err);
        passwordSuccess.style.display='none';
        passwordStatus.textContent='변경 실패. 현재 비밀번호를 확인하거나 잠시 후 재시도하세요.'; passwordStatus.style.display='block';
    }
});

// 회원탈퇴
const deleteForm = document.getElementById('delete-form');
const deletePasswordEl = document.getElementById('delete-password');
const deleteEmailEl = document.getElementById('delete-email');
const deleteStatus = document.getElementById('delete-status');
if (deleteForm) deleteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    try {
        const { deleteUser, EmailAuthProvider, reauthenticateWithCredential } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        if (auth.currentUser.email && deletePasswordEl.value) {
            const cred = EmailAuthProvider.credential(auth.currentUser.email, deletePasswordEl.value);
            await reauthenticateWithCredential(auth.currentUser, cred);
        }
        // 이메일 확인 요구
        if (!deleteEmailEl || deleteEmailEl.value.trim() !== (auth.currentUser.email || '')) {
            deleteStatus.textContent = '계정 이메일이 일치하지 않습니다.'; deleteStatus.style.display='block'; return;
        }
        await deleteUser(auth.currentUser);
        window.location.href = '../index.html';
    } catch (err) {
        console.error('delete error', err);
        deleteStatus.textContent='탈퇴 실패. 비밀번호를 확인하고 다시 시도하세요.'; deleteStatus.style.display='block';
    }
});

// 로그아웃 버튼
const leftLogoutBtn = document.getElementById('left-logout-btn');
if (leftLogoutBtn) leftLogoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const { signOut } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    try { await signOut(auth); window.location.href = '../index.html'; } catch {}
});

// Turnstile 렌더링 (비밀번호 변경용)
async function renderPasswordTurnstile() {
    const target = document.getElementById('password-turnstile');
    if (!target) return;
    // 스크립트 보장
    if (!window.turnstile) {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true; script.defer = true;
        script.onload = () => doRender();
        document.head.appendChild(script);
    } else {
        doRender();
    }
    function doRender() {
        try {
            window.turnstile.render('#password-turnstile', {
                sitekey: '0x4AAAAAABhG8vjyB5nsUxll'
            });
        } catch (e) { console.error('turnstile render error', e); }
    }
}
renderPasswordTurnstile();


// 이메일 인증 모달 (형식 통일: 메일 전송만 담당, 검증은 Magic Link 등으로 처리)
const emailModal = document.getElementById('email-modal');
const emailSendBtn = document.getElementById('email-send-verify');
const emailCloseBtn = document.getElementById('email-close-btn');
const emailInputEl = document.getElementById('email-change-input');
const emailStatus = document.getElementById('email-status');
const emailSuccess = document.getElementById('email-success');

function openEmailModal() {
    if (!emailModal) return;
    if (emailStatus) { emailStatus.style.display='none'; emailStatus.textContent=''; }
    if (emailSuccess) { emailSuccess.style.display='none'; emailSuccess.textContent=''; }
    emailModal.style.display = 'flex';
}
document.querySelectorAll('#email-modal [data-close]').forEach(btn => btn.addEventListener('click', () => emailModal.style.display='none'));
if (emailCloseBtn) emailCloseBtn.addEventListener('click', () => emailModal.style.display='none');

if (emailSendBtn) emailSendBtn.addEventListener('click', async () => {
    if (!auth.currentUser) return;
    const newEmail = (emailInputEl?.value || '').trim();
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        if (emailStatus) { emailStatus.textContent = '올바른 이메일을 입력하세요.'; emailStatus.style.display='block'; }
        return;
    }
    try {
        // Firebase 메일 인증 링크 전송 (Verify Before Update)
        await verifyBeforeUpdateEmail(auth.currentUser, newEmail, {
            url: location.origin + '/auth/action',
            handleCodeInApp: true
        });
        if (emailSuccess) { emailSuccess.textContent = '인증 메일을 전송했습니다. 받은 메일의 링크 확인 후 자동으로 이메일이 변경됩니다.'; emailSuccess.style.display='block'; }
    } catch (e) {
        console.error('email send error', e);
        if (emailStatus) { emailStatus.textContent = '전송 실패. 콘솔 설정(발신 주소/승인 도메인) 확인 후 재시도해주세요.'; emailStatus.style.display='block'; }
    }
});
function resetRecaptchaVerifier() {
    try { if (recaptchaVerifierInstance?.clear) recaptchaVerifierInstance.clear(); } catch {}
    recaptchaVerifierInstance = null;
}

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
    let newBio = (bioInput && bioInput.value ? bioInput.value.trim().slice(0,300) : '');
    // 최대 3줄 제한
    if (newBio) {
        const lines = newBio.split(/\r?\n/).slice(0,3);
        newBio = lines.join('\n');
    }

    if (!currentUser) { showMessage('로그인이 필요합니다.', 'error'); return; }
    if (!newDisplayName) { showMessage('닉네임을 입력해주세요.', 'error'); return; }
    if (newDisplayName.length > 8) {
        showMessage('닉네임은 8자 이하로 입력해주세요.', 'error');
        return;
    }
    const nameChanged = newDisplayName !== (currentUser.displayName || '');
    const bioChanged = newBio !== (currentUser.bio || currentUser.intro || '');
    if (!nameChanged && !bioChanged) { showMessage('변경사항이 없습니다.', 'error'); return; }

    saveProfileBtn.disabled = true;
    saveProfileBtn.innerHTML = '<span class="loading-spinner"></span> 저장 중...';

    try {
        // Firestore에만 업데이트 (Auth 프로필 업데이트 제외)
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        const updates = { updatedAt: new Date() };
        if (nameChanged) updates.displayName = newDisplayName;
        if (bioChanged) updates.bio = newBio;
        await updateDoc(userDocRef, updates);

        // currentUser 객체 업데이트
        if (nameChanged) currentUser.displayName = newDisplayName;
        if (bioChanged) currentUser.bio = newBio;
        
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
            if (bioInput) bioInput.value = userData.bio || userData.intro || '';
            emailInput.value = userData.email || user.email;
            
            // 프로필 이미지 표시 (Base64 또는 URL)
            if (userData.photoURL) {
                profilePicPreview.src = userData.photoURL;
            } else {
                profilePicPreview.src = 'assets/icon/profileicon.png';
            }

            // Sidebar/summary binding
            if (sidebarImg) sidebarImg.src = profilePicPreview.src;
            if (sidebarName) sidebarName.textContent = userData.displayName || (user.email?.split('@')[0] || '사용자');
            if (sidebarEmail) sidebarEmail.textContent = userData.email || user.email;
            if (leftProfileImg) leftProfileImg.src = profilePicPreview.src;
            if (leftUsername) leftUsername.textContent = userData.displayName || (user.email?.split('@')[0] || '사용자');
            if (leftUseremail) leftUseremail.textContent = userData.email || user.email;
            if (nameDisplay) nameDisplay.textContent = userData.displayName || '-';
            if (introDisplay) introDisplay.textContent = userData.bio || userData.intro || '';
            if (emailDisplay) emailDisplay.textContent = userData.email || user.email || '-';
            if (phoneDisplay) phoneDisplay.textContent = userData.phone || '미등록';

            // consent toggles
            const consent = userData.consent || {};
            if (togglePromoPhone) togglePromoPhone.checked = !!consent.promoPhone;
            if (togglePromoEmail) togglePromoEmail.checked = !!consent.promoEmail;
            if (toggleAlertSms) toggleAlertSms.checked = !!consent.alertSms;
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

            if (sidebarImg) sidebarImg.src = profilePicPreview.src;
            if (sidebarName) sidebarName.textContent = currentUser.displayName || '사용자';
            if (sidebarEmail) sidebarEmail.textContent = currentUser.email;
            if (leftProfileImg) leftProfileImg.src = profilePicPreview.src;
            if (leftUsername) leftUsername.textContent = currentUser.displayName || '사용자';
            if (leftUseremail) leftUseremail.textContent = currentUser.email;
            if (nameDisplay) nameDisplay.textContent = currentUser.displayName || '-';
            if (introDisplay) introDisplay.textContent = '';
            if (emailDisplay) emailDisplay.textContent = currentUser.email || '-';
            if (phoneDisplay) phoneDisplay.textContent = '미등록';
            
            // Firestore에 기본 사용자 데이터 생성
            try {
                const userDocRef = doc(db, 'users', user.uid);
                await setDoc(userDocRef, {
                    displayName: currentUser.displayName,
                    email: currentUser.email,
                    bio: '',
                    consent: { promoPhone: false, promoEmail: false, alertSms: false },
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