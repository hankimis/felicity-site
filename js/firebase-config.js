// Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyB8F0yZgZL0uqnXfh_gGsGVxaMgwBuTWrI",
    authDomain: "selferal-site.firebaseapp.com",
    databaseURL: "https://selferal-site-default-rtdb.firebaseio.com",
    projectId: "selferal-site",
    storageBucket: "selferal-site.appspot.com",
    messagingSenderId: "1098087321907",
    appId: "1:1098087321907:web:e1d49d8b72c86c5d5f3ad8",
    measurementId: "G-RLHWZ9YE7H"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);

// 서비스 참조 생성
window.auth = firebase.auth();
window.db = firebase.firestore();
window.database = firebase.database();

console.log('Firebase 초기화 완료:', {
    auth: !!window.auth,
    firestore: !!window.db,
    database: !!window.database
}); 