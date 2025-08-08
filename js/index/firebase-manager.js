/**
 * Firebase Management
 */

// Firebase 초기화 및 관리
(function() {
  // Firebase 초기화 함수
  const initializeFirebase = () => {
    try {
      // Firebase 설정 확인
      if (!window.firebaseConfig) {
        throw new Error('Firebase 설정이 로드되지 않았습니다.');
      }

      // Firebase 앱이 이미 초기화되었는지 확인
      let app;
      if (firebase.apps.length === 0) {
        // Firebase 앱 초기화
        app = firebase.initializeApp(window.firebaseConfig);
      } else {
        // 이미 초기화된 앱 사용
        app = firebase.app();
      }
      
      // Firestore 초기화
      const db = firebase.firestore();
      
      // 전역 변수로 Firebase 객체들 노출
      window.firebaseDB = db;
      window.firebaseCollection = db.collection.bind(db);
      window.firebaseGetDocs = (ref) => ref.get();
      
      // Firebase 초기화 완료 플래그
      window.firebaseInitialized = true;
      
      // Firebase 초기화 완료 이벤트 발생
      window.dispatchEvent(new CustomEvent('firebaseInitialized'));
      
    } catch (error) {
      window.firebaseInitialized = false;
    }
  };

  // Firebase SDK와 설정이 로드될 때까지 대기
  const waitForFirebaseReady = () => {
    if (typeof firebase !== 'undefined' && window.firebaseConfig) {
      initializeFirebase();
    } else {
      setTimeout(waitForFirebaseReady, 100);
    }
  };

  // 초기화 시작
  waitForFirebaseReady();
})();