// Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyB8F0yZgZL0uqnXfh_gGsGVxaMgwBuTWrI",
    authDomain: "selferal-site.firebaseapp.com",
    projectId: "selferal-site",
    storageBucket: "selferal-site.appspot.com",
    messagingSenderId: "1098087321907",
    appId: "1:1098087321907:web:e1d49d8b72c86c5d5f3ad8",
    measurementId: "G-RLHWZ9YE7H"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);

// Firestore 데이터베이스 참조 생성
window.db = firebase.firestore(); 