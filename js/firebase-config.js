// Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyCbvgcol3P4wTUNh88-d9HPZl-2NC9WbqI",
    authDomain: "livechattest-35101.firebaseapp.com",
    projectId: "livechattest-35101",
    storageBucket: "livechattest-35101.firebasestorage.app",
    messagingSenderId: "880700591040",
    appId: "1:880700591040:web:a93e47bf19a9713a245625",
    measurementId: "G-ER1H2CCZW9",
    databaseURL: "https://livechattest-35101-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

// Firebase 초기화 함수
function initializeFirebase() {
    try {
        if (typeof firebase !== 'undefined') {
            // Firebase 앱이 이미 초기화되었는지 확인
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
                console.log('Firebase 앱 초기화 완료');
            }
            
            // 서비스 참조 생성
            window.auth = firebase.auth();
            window.db = firebase.firestore();
            
            // database는 선택적으로 초기화 (필요한 경우에만)
            if (typeof firebase.database === 'function') {
                window.database = firebase.database();
            } else {
                console.warn('Firebase Database를 사용하지 않습니다.');
                window.database = null;
            }

            // 전역 변수 설정
            window.firebaseInitialized = true;
            window.firebaseDB = window.db;

            console.log('Firebase 초기화 완료:', {
                auth: !!window.auth,
                firestore: !!window.db,
                database: !!window.database
            });
        } else {
            console.error('Firebase SDK가 로드되지 않았습니다.');
        }
    } catch (error) {
        console.error('Firebase 초기화 오류:', error);
    }
}

// DOM 로드 후 Firebase 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFirebase);
} else {
    initializeFirebase();
} 