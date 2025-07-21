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

// 전역 객체에 노출 (기존 코드 호환성을 위해)
if (typeof window !== 'undefined') {
    window.firebaseConfig = firebaseConfig;
}

// ES6 모듈 export (새로운 코드 호환성을 위해)
export { firebaseConfig }; 