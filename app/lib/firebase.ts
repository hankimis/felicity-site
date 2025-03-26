import { initializeApp, FirebaseOptions } from "firebase/app";
import { getAuth, connectAuthEmulator, Auth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, connectFirestoreEmulator, initializeFirestore, Firestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";
import { collection, getDocs } from 'firebase/firestore';

// Firebase 구성 - 환경 변수에서 로드 또는 하드코딩된 값 사용
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAZYR2Wn8QSfu8Y-3oUQX7-kWiLiMcaqH4",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "felicity-admin.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "felicity-admin",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "felicity-admin.firebaseapp.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "60170961082",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:60170961082:web:6b6c1ff931cdd60e9cc283",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-HGM59Q718G"
};

console.log('Firebase 설정 로드됨:', { projectId: firebaseConfig.projectId });

let app: any = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let analytics: any = null;

// 이메일 기반 인증 함수
export async function signInWithEmail(email: string, password: string) {
  if (!auth) {
    throw new Error('Firebase 인증이 초기화되지 않았습니다.');
  }
  
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('이메일로 인증 성공:', userCredential.user.email);
    return userCredential.user;
  } catch (error) {
    console.error('이메일 인증 실패:', error);
    throw error;
  }
}

// 데이터베이스 연결 테스트 함수
export async function testDbConnection() {
  if (!db) {
    throw new Error('Firestore가 초기화되지 않았습니다.');
  }
  
  try {
    // 1. 기본 컬렉션 확인
    const collections = ['joinUsers', 'paymentInfo', 'cafeReviews', 'blogReviews', 'instagramReviews'];
    const results: Record<string, { exists: boolean, count: number }> = {};
    
    for (const collName of collections) {
      try {
        const ref = collection(db, collName);
        const snapshot = await getDocs(ref);
        results[collName] = { 
          exists: true, 
          count: snapshot.docs.length 
        };
        console.log(`컬렉션 ${collName} 확인 성공:`, snapshot.docs.length, '문서');
      } catch (err) {
        console.error(`컬렉션 ${collName} 확인 실패:`, err);
        results[collName] = { exists: false, count: 0 };
      }
    }
    
    return {
      success: true,
      collections: results
    };
  } catch (error) {
    console.error('데이터베이스 연결 테스트 실패:', error);
    return {
      success: false,
      error: error
    };
  }
}

// Firebase 초기화 함수
function initializeFirebase() {
  if (app) return { app, db, auth, analytics }; // 이미 초기화되었으면 반환
  
  try {
    // Firebase 애플리케이션 초기화
    app = initializeApp(firebaseConfig);
    console.log('Firebase 앱 초기화 완료');

    // Firestore 초기화 - 네트워크 타임아웃 설정
    const firestoreSettings = {
      cacheSizeBytes: CACHE_SIZE_UNLIMITED,
      experimentalForceLongPolling: true, // 더 안정적인 연결 방식 사용
      ignoreUndefinedProperties: true,    // undefined 값 무시
      retry: {
        initialDelayMs: 1000,             // 초기 재시도 대기 시간
        maxDelayMs: 10000,                // 최대 재시도 대기 시간
        maxAttempts: 5                   // 최대 재시도 횟수
      }
    };
    
    db = initializeFirestore(app, firestoreSettings);
    console.log('Firestore 초기화 완료 (확장 설정)');

    // 인증 초기화
    auth = getAuth(app);
    
    console.log('Firebase Auth 초기화 완료');

    // 분석 초기화 (브라우저에서만)
    if (typeof window !== 'undefined') {
      try {
        analytics = getAnalytics(app);
        console.log('Firebase Analytics 초기화 완료');
      } catch (err) {
        console.error('Analytics 초기화 실패:', err);
      }
    }

    return { app, db, auth, analytics };
  } catch (error) {
    console.error('Firebase 초기화 중 오류 발생:', error);
    throw error;
  }
}

try {
  // Firebase 초기화
  const initializedFirebase = initializeFirebase();
  app = initializedFirebase.app;
  db = initializedFirebase.db;
  auth = initializedFirebase.auth;
  analytics = initializedFirebase.analytics;

  // 오프라인 지속성 활성화 (브라우저에서만)
  if (typeof window !== 'undefined' && db) {
    // 네트워크 연결 모니터링
    window.addEventListener('offline', () => {
      console.log('오프라인 모드로 전환');
    });

    window.addEventListener('online', () => {
      console.log('온라인 모드로 전환');
    });

    // 멀티 탭 지원 지속성 활성화 (기존보다 안정적)
    import('firebase/firestore').then(firestore => {
      if (db) {
        firestore.enableMultiTabIndexedDbPersistence(db)
          .then(() => {
            console.log('멀티 탭 지원 Firebase 지속성 활성화 성공');
          })
          .catch((err) => {
            if (err.code === 'failed-precondition') {
              console.warn('멀티 탭 지속성 실패: 다른 탭이 이미 초기화됨');
              // 일반 지속성으로 폴백
              if (db) {
                enableIndexedDbPersistence(db)
                  .then(() => console.log('일반 지속성으로 폴백 성공'))
                  .catch(e => console.error('일반 지속성 폴백 실패:', e));
              }
            } else if (err.code === 'unimplemented') {
              console.warn('현재 브라우저는 오프라인 지속성을 지원하지 않습니다.');
            } else {
              console.error('멀티 탭 Firebase 지속성 활성화 오류:', err);
            }
          });
      }
    }).catch(err => {
      console.error('Firebase 지속성 모듈 로드 실패:', err);
      // 기존 방식으로 폴백
      if (db) {
        enableIndexedDbPersistence(db)
          .catch((err) => {
            console.error('기존 Firebase 지속성 활성화 오류:', err);
          });
      }
    });
  }

  // 개발 환경에서 에뮬레이터 연결 (선택적)
  if (process.env.NODE_ENV === 'development') {
    try {
      // connectFirestoreEmulator(db, 'localhost', 8080);
      console.log('Firebase 개발 모드 활성화됨');
    } catch (error) {
      console.error('Firebase 에뮬레이터 연결 실패:', error);
    }
  }
} catch (err) {
  console.error('Firebase 서비스 초기화 중 치명적 오류:', err);
}

export { db, auth, analytics };