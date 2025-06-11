import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            displayNameInput.value = userData.displayName;
            emailInput.value = userData.email;
            if (userData.photoURL) {
                profilePicPreview.src = userData.photoURL;
            } else {
                profilePicPreview.src = 'assets/@default-profile.png';
            }
        }
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
    if (!file || !currentUser) return;

    // Check file type and size
    if (!file.type.startsWith('image/')) {
        showStatus('이미지 파일만 업로드할 수 있습니다.', 'error');
        return;
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showStatus('이미지 크기는 5MB를 초과할 수 없습니다.', 'error');
        return;
    }

    const storageRef = ref(storage, `profilePictures/${currentUser.uid}/${file.name}`);
    showStatus('이미지 업로드 중...', 'info');

    try {
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        // Update profile in Auth and Firestore
        await updateProfile(currentUser, { photoURL: downloadURL });
        const userDocRef = doc(db, "users", currentUser.uid);
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
        return;
    }

    saveProfileBtn.disabled = true;
    saveProfileBtn.textContent = '저장 중...';

    try {
        // Update profile in Auth and Firestore
        await updateProfile(currentUser, { displayName: newDisplayName });
        const userDocRef = doc(db, "users", currentUser.uid);
        await updateDoc(userDocRef, { displayName: newDisplayName });

        alert('프로필이 성공적으로 업데이트되었습니다.');
    } catch (error) {
        console.error("Error updating profile: ", error);
        alert('프로필 업데이트에 실패했습니다.');
    } finally {
        saveProfileBtn.disabled = false;
        saveProfileBtn.textContent = '변경사항 저장';
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