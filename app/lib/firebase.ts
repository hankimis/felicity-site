import { initializeApp, FirebaseOptions, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator, Auth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, connectFirestoreEmulator, initializeFirestore, Firestore, CACHE_SIZE_UNLIMITED, persistentLocalCache, persistentMultipleTabManager, enableNetwork, disableNetwork, collection, getDocs, query, limit } from 'firebase/firestore';
import { getAnalytics, isSupported } from "firebase/analytics";

// Vercel 환경과 로컬 환경을 위한 Firebase 구성
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
let firestoreInitialized = false;
let isInitializing = false; // 초기화 진행 중 상태 추적
let initializationAttempts = 0; // 초기화 시도 횟수
const MAX_INITIALIZATION_ATTEMPTS = 3; // 최대 초기화 시도 횟수

// 이메일 기반 인증 함수
export async function signInWithEmail(email: string, password: string) {
  if (!auth) {
    // 인증이 초기화되지 않은 경우 초기화 시도
    await ensureFirebaseInitialized();
    if (!auth) {
      throw new Error('Firebase 인증이 초기화되지 않았습니다.');
    }
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

// Firebase가 초기화되었는지 확인하고, 필요한 경우 초기화하는 함수
export async function ensureFirebaseInitialized() {
  if (app && db && auth && firestoreInitialized) {
    return { app, db, auth, analytics };
  }
  
  if (isInitializing) {
    // 이미 초기화 중인 경우 잠시 대기 후 재시도
    console.log('Firebase 초기화가 이미 진행 중, 대기 중...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    return ensureFirebaseInitialized();
  }
  
  if (initializationAttempts >= MAX_INITIALIZATION_ATTEMPTS) {
    console.error(`최대 초기화 시도 횟수(${MAX_INITIALIZATION_ATTEMPTS})를 초과했습니다.`);
    throw new Error('Firebase 초기화 실패: 최대 시도 횟수 초과');
  }
  
  isInitializing = true;
  initializationAttempts++;
  
  try {
    const result = await initializeFirebase();
    isInitializing = false;
    return result;
  } catch (error) {
    isInitializing = false;
    console.error(`Firebase 초기화 실패 (시도 ${initializationAttempts}/${MAX_INITIALIZATION_ATTEMPTS}):`, error);
    throw error;
  }
}

// 데이터베이스 연결 테스트 함수
export async function testDbConnection(): Promise<{
  success: boolean;
  collections?: Record<string, { exists: boolean, count: number }>;
  error?: any;
  timestamp: string;
}> {
  // DB가 초기화되지 않았으면 초기화 시도
  if (!db) {
    try {
      await ensureFirebaseInitialized();
    } catch (error) {
      return {
        success: false,
        error: new Error('Firestore가 초기화되지 않았습니다.'),
        timestamp: new Date().toISOString()
      };
    }
  }
  
  if (!db) {
    return {
      success: false,
      error: new Error('Firestore가 초기화되지 않았습니다.'),
      timestamp: new Date().toISOString()
    };
  }
  
  try {
    // 1. 네트워크 연결 활성화 시도
    await enableNetwork(db);
    
    // 2. 기본 컬렉션 확인 - 효율성을 위해 각 컬렉션에서 1개 문서만 쿼리
    const collections = ['joinUsers', 'paymentInfo', 'dentalReviews', 'dermaReviews', 'realHospitalReviews'];
    const results: Record<string, { exists: boolean, count: number }> = {};
    
    for (const collName of collections) {
      try {
        const ref = collection(db, collName);
        const q = query(ref, limit(1)); // 효율성을 위해 문서 1개만 쿼리
        const snapshot = await getDocs(q);
        results[collName] = { 
          exists: true, 
          count: snapshot.size 
        };
        console.log(`컬렉션 ${collName} 확인 성공:`, snapshot.size ? '접근 가능' : '빈 컬렉션');
      } catch (err) {
        console.error(`컬렉션 ${collName} 확인 실패:`, err);
        results[collName] = { exists: false, count: 0 };
      }
    }
    
    return {
      success: true,
      collections: results,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('데이터베이스 연결 테스트 실패:', error);
    return {
      success: false,
      error: error,
      timestamp: new Date().toISOString()
    };
  }
}

// Vercel 환경에서 안정적으로 작동하는 Firebase 초기화 함수
async function initializeFirebase() {
  // 이미 초기화된 경우
  if (app && db && firestoreInitialized) {
    console.log('Firebase가 이미 초기화되어 있습니다.');
    return { app, db, auth, analytics };
  }
  
  try {
    // 이미 초기화된 앱이 있는지 확인
    const existingApps = getApps();
    if (existingApps.length > 0) {
      console.log('이미 존재하는 Firebase 앱을 사용합니다.');
      app = existingApps[0];
    } else {
      // Firebase 애플리케이션 초기화
      app = initializeApp(firebaseConfig);
      console.log('새로운 Firebase 앱 초기화 완료');
    }

    // Firestore 초기화 - 네트워크 타임아웃 및 Vercel 최적화 설정
    if (!db) {
      // 최신 Firestore 지속성 설정
      const firestoreSettings = {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
          cacheSizeBytes: CACHE_SIZE_UNLIMITED
        }),
        experimentalAutoDetectLongPolling: true,
        ignoreUndefinedProperties: true,
        retry: {
          initialDelayMs: 1000,
          maxDelayMs: 10000,
          maxAttempts: 5
        }
      };
      
      try {
        db = initializeFirestore(app, firestoreSettings);
        firestoreInitialized = true;
        console.log('Firestore 초기화 완료 (Vercel 최적화 설정)');
        
        // 오프라인 지원 활성화
        if (typeof window !== 'undefined') {
          await enableIndexedDbPersistence(db)
            .then(() => {
              console.log('Firestore 오프라인 지원 활성화 완료');
            })
            .catch((err) => {
              if (err.code === 'failed-precondition') {
                console.warn('Firestore 다중 탭에서 오프라인 지원을 활성화할 수 없습니다.');
              } else if (err.code === 'unimplemented') {
                console.warn('현재 브라우저에서 Firestore 오프라인 지원을 사용할 수 없습니다.');
              } else {
                console.error('Firestore 오프라인 지원 활성화 실패:', err);
              }
            });
        }
      } catch (firestoreError) {
        console.error('Firestore 초기화 실패, 기본 설정으로 재시도:', firestoreError);
        
        // 기본 설정으로 재시도
        db = getFirestore(app);
        firestoreInitialized = true;
        console.log('Firestore 기본 설정으로 초기화 완료');
      }
    }

    // 인증 초기화
    if (!auth) {
      auth = getAuth(app);
      console.log('Firebase Auth 초기화 완료');
    }

    // 분석 초기화 (브라우저에서만)
    if (typeof window !== 'undefined' && !analytics) {
      const analyticsSupported = await isSupported();
      if (analyticsSupported) {
        analytics = getAnalytics(app);
        console.log('Firebase Analytics 초기화 완료');
      }
    }

    return { app, db, auth, analytics };
  } catch (error) {
    console.error('Firebase 초기화 중 오류 발생:', error);
    // 오류가 발생해도 사용 가능한 인스턴스 반환
    return { app, db, auth, analytics };
  }
}

// 네트워크 재연결 함수
export async function reconnectFirebase(): Promise<{
  success: boolean;
  testResult?: any;
  error?: any;
}> {
  try {
    console.log('Firebase 재연결 시도 중...');
    
    // 먼저 전체 초기화가 안 되어 있는 경우 초기화
    if (!app || !db) {
      console.log('Firebase 앱 초기화되지 않음, 새로 초기화 시도');
      const { app: newApp, db: newDb, auth: newAuth } = await ensureFirebaseInitialized();
      
      if (newDb) {
        app = newApp;
        db = newDb;
        auth = newAuth;
        console.log('Firebase 새로 초기화 성공');
      } else {
        throw new Error('Firebase 초기화 실패');
      }
    }
    
    // 기존 연결이 있는 경우 먼저 네트워크 연결 재활성화 시도
    if (db) {
      try {
        await enableNetwork(db);
        console.log('기존 Firestore 연결 재활성화 성공');
        
        // 연결 테스트
        const quickTest = await testDbConnection();
        if (quickTest.success) {
          console.log('기존 연결로 테스트 성공');
          return { success: true, testResult: quickTest };
        }
      } catch (enableError) {
        console.error('기존 Firestore 연결 재활성화 실패:', enableError);
        // 실패 시 오프라인 모드 자동 활성화
        try {
          await disableNetwork(db);
          console.log('오프라인 모드 활성화 (캐시 사용)');
        } catch (offlineError) {
          console.error('오프라인 모드 활성화 실패:', offlineError);
        }
      }
    }
    
    // 재초기화 시도
    try {
      const { app: newApp, db: newDb, auth: newAuth } = await ensureFirebaseInitialized();
      
      if (newDb) {
        db = newDb;
        auth = newAuth;
        app = newApp;
        console.log('Firebase 서비스 재연결 성공');
        
        // 연결 테스트
        const testResult = await testDbConnection();
        return { success: testResult.success, testResult };
      } else {
        console.error('재연결 시도 실패: 데이터베이스가 초기화되지 않음');
        return { success: false, error: '데이터베이스 초기화 실패' };
      }
    } catch (reInitError) {
      console.error('Firebase 재초기화 실패:', reInitError);
      return { success: false, error: reInitError };
    }
  } catch (error) {
    console.error('Firebase 재연결 시도 실패:', error);
    return { success: false, error };
  }
}

// 안전한 Firebase 초기화 실행
try {
  if (typeof window !== 'undefined') {
    // 클라이언트 사이드에서만 초기화 시도
    ensureFirebaseInitialized()
      .then(({ app: initializedApp, db: initializedDb, auth: initializedAuth, analytics: initializedAnalytics }) => {
        app = initializedApp;
        db = initializedDb;
        auth = initializedAuth;
        analytics = initializedAnalytics;
        
        console.log('Firebase 초기 설정 완료');
      })
      .catch(err => {
        console.error('Firebase 초기 설정 실패:', err);
        // 크리티컬 에러가 아니므로 계속 진행 가능
      });
  } else {
    console.log('서버 사이드 환경: Firebase 초기화 건너뜀');
  }
} catch (err) {
  console.error('Firebase 서비스 초기화 중 치명적 오류:', err);
  // 앱은 계속 실행 가능
}

export { db, auth, analytics };