'use client';

import { useEffect, useState, useRef, useCallback, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth, analytics, signInWithEmail, testDbConnection, reconnectFirebase } from '../../lib/firebase';
import { collection, getDocs, updateDoc, deleteDoc, doc, query, orderBy, DocumentData, onSnapshot, enableNetwork, disableNetwork, setLogLevel, Firestore, limit, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';
import { exportToExcel } from '../../lib/exportExcel';
import { useSessionTimeout } from '../../hooks/useSessionTimeout';
import Cookies from 'js-cookie';
import { toast } from 'react-hot-toast';
import { onAuthStateChanged } from 'firebase/auth';

interface UserData extends DocumentData {
  id: string;
  name: string;
  phone: string;
  email: string;
  birthDate: string;
  gender: string;
  trafficSource: string;
  callTime: string;
  referralCode: string;
  createdAt: string;
  approved: boolean;
  phoneCarrier?: string;
}

interface AccountData {
  phone: string;
  bank: string;
  accountNumber: string;
}

interface MergedAccountData extends UserData, AccountData {}

interface ReviewData extends DocumentData {
  id: string;
  name: string;
  phone: string;
  accountNumber: string;
  reviewLink: string;
  createdAt: string;
  service: string;
  status: 'pending' | 'approved' | 'rejected';
  termsAccepted: boolean;
  verificationStatus: boolean;
  updatedAt?: string;
}

interface ConnectionStatus {
  isConnected: boolean;
  lastChecked: string;
  collections?: Record<string, { exists: boolean, count: number }>;
  error?: any;
}

const itemsPerPage = 20;
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const RETRY_LIMIT = 3;
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5분으로 변경
const CONNECTION_RETRY_INTERVAL = 1 * 60 * 1000; // 1분

// SSR 하이드레이션 오류 방지를 위한 초기 시간 고정
const INITIAL_DATE = '2023-01-01T00:00:00.000Z';

export default function Dashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<string>('join');
  const tabOptions = [
    { value: 'join', label: '가입 신청' },
    { value: 'account', label: '계좌 정보' },
    { value: 'joinEvent', label: '가입 이벤트' },
    { value: 'cafeReview', label: '카페 후기' },
    { value: 'blogReview', label: '블로그 후기' },
    { value: 'instaReview', label: '인스타 후기' }
  ];
  const [users, setUsers] = useState<UserData[]>([]);
  const [accounts, setAccounts] = useState<MergedAccountData[]>([]);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const authCheckComplete = useRef(false);
  const [authFailed, setAuthFailed] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    lastChecked: INITIAL_DATE
  });
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Session timeout hook
  useSessionTimeout(SESSION_TIMEOUT, () => {
    Cookies.remove('adminAuth');
    Cookies.remove('adminEmail');
    toast.error('세션이 만료되었습니다. 다시 로그인해주세요.');
    router.replace('/admin/login');
  });

  // Auto refresh feature
  useEffect(() => {
    let refreshTimerRef: NodeJS.Timeout | null = null;
    
    if (autoRefresh) {
      console.log(`자동 연결 확인 활성화: ${AUTO_REFRESH_INTERVAL/1000}초 간격`);
      
      refreshTimerRef = setInterval(() => {
        // 이미 로딩 중이거나 오프라인인 경우 스킵
        if (isLoading || !navigator.onLine) {
          console.log('자동 연결 확인 스킵: ' + 
            (isLoading ? '로딩 중' : '오프라인 상태'));
          return;
        }
        
        console.log('자동 연결 확인 실행...');
        checkConnection().catch(err => {
          console.error('자동 연결 확인 실패:', err);
        });
      }, AUTO_REFRESH_INTERVAL);
    }
    
    return () => {
      if (refreshTimerRef) {
        clearInterval(refreshTimerRef);
      }
    };
  }, [autoRefresh, isLoading]);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      console.log('Online status');
      setIsOnline(true);
      reconnectAndLoad();
    };
    
    const handleOffline = () => {
      console.log('Offline status');
      setIsOnline(false);
      setError('Offline status. Please check your internet connection.');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial network status check
    setIsOnline(navigator.onLine);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Authentication status check
  useEffect(() => {
    let authCheckPerformed = false;
    
    const checkAuth = async () => {
      // 중복 체크 방지
      if (authCheckPerformed) return;
      authCheckPerformed = true;
      
      try {
        // Cookie check
        const isAuth = Cookies.get('adminAuth') === 'true';
        const savedEmail = Cookies.get('adminEmail');
        
        if (!isAuth) {
          console.log('No auth cookie, redirect to login page');
          router.replace('/admin/login');
          return;
        }
        
        setAdminEmail(savedEmail || null);
        
        // Firebase authentication status check
        if (auth) {
          // 강제 세션 유지 처리
          if (savedEmail) {
            console.log('Admin email found in cookie, keeping session:', savedEmail);
            setAuthFailed(false);
            authCheckComplete.current = true;
            return;
          }
          
          const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) {
              console.log('Firebase authentication status not found');
              
              // 중요: 로컬 쿠키가 있는 경우 세션 유지
              if (isAuth && savedEmail) {
                console.log('Local session active, keeping access:', savedEmail);
                setAuthFailed(false);
                setAdminEmail(savedEmail);
              } else {
                setAuthFailed(true);
                // 세션이 없는 경우에만 쿠키 제거 및 리디렉션
                Cookies.remove('adminAuth');
                Cookies.remove('adminEmail');
                router.replace('/admin/login');
              }
            } else {
              console.log('Firebase authentication confirmed:', user.email);
              setAuthFailed(false);
              setAdminEmail(user.email);
            }
            authCheckComplete.current = true;
          });
          
          return () => unsubscribe();
        }
      } catch (err) {
        console.error('Authentication check error:', err);
        // 오류 발생 시 세션 유지 (로그아웃되지 않도록)
        authCheckComplete.current = true;
      }
    };
    
    checkAuth();
  }, [router]);

  // Page load data load
  useEffect(() => {
    // 클라이언트 사이드에서만 실행
    if (typeof window === 'undefined') return;
    
    let dataLoadAttempted = false;
    
    // Firebase 데이터 로드
    const initialLoad = async () => {
      // 중복 로드 방지
      if (dataLoadAttempted || isLoading) {
        console.log('이미 데이터 로드 시도 중 또는 완료됨');
        return;
      }
      
      dataLoadAttempted = true;
      setIsLoading(true);
      
      try {
        // 실제 파이어베이스 데이터 로드 시도
        console.log('파이어베이스 데이터 로드 시도 중...');
        
        if (db) {
          // 파이어베이스 연결 확인
          const connected = await checkConnection();
          
          if (connected) {
            console.log('파이어베이스 연결 성공, 실제 데이터 로드 중...');
            
            // 데이터 로드 시도
            const userDataLoaded = await loadRealData();
            await fetchReviews();
            
            if (userDataLoaded) {
              console.log('파이어베이스 데이터 로드 성공');
              setIsLoading(false);
              return;
            }
          }
        }
        
        // 연결 실패 또는 데이터 로드 실패 시 샘플 데이터 사용
        console.log('파이어베이스 데이터 로드 실패, 샘플 데이터 사용');
        loadSampleData();
      } catch (error) {
        console.error('초기 데이터 로드 중 오류:', error);
        loadSampleData();
      } finally {
        setIsLoading(false);
      }
    };
    
    // 초기 로드 실행
    initialLoad();
  }, []);

  // Tab change data load
  useEffect(() => {
    const loadTabData = async () => {
      if (isLoading) return;
      
      setIsLoading(true);
      try {
        if (tab === 'join' || tab === 'account') {
          await loadRealData();
        } else if (tab === 'joinEvent' || tab === 'cafeReview' || tab === 'blogReview' || tab === 'instaReview') {
          await loadReviewData();
        }
      } catch (err) {
        console.error('탭 데이터 로드 실패:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTabData();
  }, [tab]);

  // Connection status update helper function (일관된 방식으로 상태 업데이트)
  const updateConnectionStatus = useCallback((isConnected: boolean, error?: any) => {
    const now = new Date().toISOString();
    setConnectionStatus({
      isConnected,
      lastChecked: now,
      error: error || null
    });
  }, []);

  // Firebase connection status check
  const checkConnection = async (): Promise<boolean> => {
    if (isLoading) return false; // 이미 로딩 중이면 중복 실행 방지
    
    console.log("파이어베이스 연결 상태 확인 중...");
    
    // Firestore가 초기화되지 않았으면 즉시 실패 처리
    if (!db) {
      console.error("Firestore가 초기화되지 않았습니다");
      updateConnectionStatus(false, new Error("Firestore가 초기화되지 않았습니다"));
      return false;
    }
    
    try {
      // 실제 연결 테스트 (빈 쿼리 실행)
      console.log("연결 테스트 중...");
      const testRef = collection(db, 'joinUsers');
      const testQuery = query(testRef, limit(1));
      const snapshot = await getDocs(testQuery);
      
      console.log("연결 테스트 성공, 결과:", snapshot.docs.length, "건");
      
      // 연결 성공
      updateConnectionStatus(true);
      setIsOnline(true);
      setError(null);
      
      return true;
    } catch (testError: any) {
      // 쿼리 실행 실패
      console.error("연결 테스트 실패:", testError);
      updateConnectionStatus(false, testError);
      setError(`연결 테스트 실패: ${testError.message || '알 수 없는 오류'}`);
      return false;
    }
  };
  
  // 연결 오류 시 자동 복구 시도 기능
  useEffect(() => {
    // 연결 오류 상태에서 일정 시간마다 자동 재연결 시도
    if (!isOnline && autoRefresh) {
      console.log(`${CONNECTION_RETRY_INTERVAL/1000}초 후 자동 재연결 시도 예약됨...`);
      const recoveryTimer = setTimeout(() => {
        console.log('자동 재연결 시도 중...');
        // 불필요한 중복 시도 방지
        if (!isLoading) {
          reconnectAndLoad().catch(err => {
            console.error('자동 재연결 실패:', err);
          });
        } else {
          console.log('이미 로딩 중입니다. 자동 재연결 취소');
        }
      }, CONNECTION_RETRY_INTERVAL); // 앞서 정의한 간격으로 시도
      
      return () => clearTimeout(recoveryTimer);
    }
  }, [isOnline, autoRefresh, isLoading]);
  
  // Reconnect and load data - 간소화
  const reconnectAndLoad = async () => {
    if (isLoading) {
      console.log('이미 로딩 중입니다. 재연결 작업 취소');
      return false;
    }
    
    setIsLoading(true);
    setError(null);
    toast.loading('파이어베이스에 연결 중...');
    
    try {
      // 먼저 네트워크 연결 상태 확인
      if (!navigator.onLine) {
        toast.dismiss();
        toast.error('오프라인 상태입니다. 인터넷 연결을 확인해주세요.');
        throw new Error('오프라인 상태입니다');
      }
      
      // 파이어베이스 재연결 시도
      console.log('Firebase 재연결 시도...');
      const { success } = await reconnectFirebase();
      
      if (success && db) {
        toast.dismiss();
        toast.success('파이어베이스에 연결되었습니다!');
        
        // 데이터 로드 시도
        console.log('데이터 로드 시작...');
        const dataResult = await loadRealData();
        await fetchReviews();
        
        return dataResult;
      } else {
        // 연결 실패 시 샘플 데이터 표시
        toast.dismiss();
        toast.error('파이어베이스 연결 실패. 샘플 데이터를 사용합니다.');
        loadSampleData();
        return false;
      }
    } catch (err) {
      console.error('재연결 시도 중 오류:', err);
      toast.dismiss();
      toast.error('연결 시도 중 오류가 발생했습니다.');
      loadSampleData();
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Sample data load function
  const loadSampleData = () => {
    console.log('샘플 데이터 로드 중...');
    
    try {
      // Sample user data
    const sampleUsers = [
      {
        id: '1',
          name: 'Hong Gil Dong',
        phone: '010-1234-5678',
        email: 'hong@example.com',
        birthDate: '1990-01-01',
          gender: 'Male',
          trafficSource: 'Naver Search',
          callTime: 'Afternoon',
        referralCode: '',
        createdAt: '2025-03-20T15:00:00.000Z',
        approved: false
      },
      {
        id: '2',
          name: 'Kim Chul Su',
        phone: '010-9876-5432',
        email: 'kim@example.com',
        birthDate: '1985-05-05',
          gender: 'Male',
          trafficSource: 'Recommendation',
          callTime: 'Morning',
        referralCode: 'FRIEND1',
        createdAt: '2025-03-22T10:00:00.000Z',
        approved: true
      },
      {
        id: '3',
          name: 'Lee Young Hee',
        phone: '010-2222-3333',
        email: 'lee@example.com',
        birthDate: '1995-12-25',
          gender: 'Female',
          trafficSource: 'Instagram',
          callTime: 'Evening',
        referralCode: '',
        createdAt: '2025-03-25T18:30:00.000Z',
        approved: false
      }
    ];
    
      // Sample account data
    const sampleAccounts = sampleUsers.map(user => ({
      ...user,
        bank: ['KB Bank', 'Shinhan Bank', 'Woori Bank'][Math.floor(Math.random() * 3)],
      accountNumber: '123-45-678901'
    }));
    
      // Sample review data
      const sampleReviews: ReviewData[] = [
      {
        id: '1',
          name: 'Park Ji Sung',
        phone: '010-5555-6666',
        accountNumber: '111-22-333333',
        reviewLink: 'https://example.com/review1',
          createdAt: '2025-03-18T14:00:00.000Z',
          service: 'cafeReview',
          status: 'pending',
          termsAccepted: true,
          verificationStatus: true
      },
      {
        id: '2',
          name: 'Son Heung Min',
        phone: '010-7777-8888',
        accountNumber: '444-55-666666',
        reviewLink: 'https://example.com/review2',
          createdAt: '2025-03-21T09:00:00.000Z',
          service: 'blogReview',
          status: 'approved',
          termsAccepted: true,
          verificationStatus: true
        }
      ];
      
      // Data setting
      console.log('샘플 사용자 데이터 설정:', sampleUsers.length);
    setUsers(sampleUsers);
      
      console.log('샘플 계좌 데이터 설정:', sampleAccounts.length);
    setAccounts(sampleAccounts);
      
      console.log('샘플 리뷰 데이터 설정:', sampleReviews.length);
    setReviews(sampleReviews);
    
      // Connection status display
      updateConnectionStatus(false, new Error('샘플 데이터 사용 중 - 실제 연결 없음'));
      
      // Loading complete
    setIsLoading(false);
    setIsOnline(false);
      setError('파이어베이스 연결 불가능. 샘플 데이터 사용 중. 네트워크 연결을 확인하세요.');
    
    console.log('샘플 데이터 로드 완료');
      return true;
    } catch (error) {
      console.error('샘플 데이터 로드 실패:', error);
      setIsLoading(false);
      setError('샘플 데이터 로드 실패. 페이지를 새로고침하세요.');
      return false;
    }
  };

  // Real data load function 
  const loadRealData = async () => {
    if (isLoading && !isOnline) return false; // 이미 로딩 중이거나 오프라인 상태면 중복 실행 방지
    console.log('실제 데이터 로드 시작...');
    
    try {
      // Firestore가 초기화되지 않았으면 재초기화 시도
      if (!db) {
        console.log('Firestore 초기화되지 않음, 재초기화 시도');
        const reconnectResult = await reconnectFirebase();
        if (!reconnectResult.success || !db) {
          console.error('Firestore 재초기화 실패');
          return false;
        }
        console.log('Firestore 재초기화 성공');
      }
      
      // 1. user collection 로드
      console.log('사용자 데이터 로드 중...');
      try {
        const joinRef = collection(db, 'joinUsers');
            const joinSnap = await getDocs(joinRef);
        console.log('사용자 데이터 로드 성공:', joinSnap.docs.length, '건');
            
            if (joinSnap.docs.length > 0) {
          // 사용자 데이터 변환
          const userList = joinSnap.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
                  const data = doc.data();
                  return {
                    id: doc.id,
                    name: data.name || '',
                    phone: data.phone || '',
                    email: data.email || '',
                    birthDate: data.birthDate || '',
                    gender: data.gender || '',
                    trafficSource: data.trafficSource || '',
                    callTime: data.callTime || '',
                    referralCode: data.referralCode || '',
                    createdAt: data.createdAt || new Date().toISOString(),
              phoneCarrier: data.phoneCarrier || '',
              approved: data.approved || false
                  } as UserData;
                });
                
          // 상태 업데이트
          console.log('사용자 상태 업데이트:', userList.length, '건');
          setUsers(userList);
          
          // 2. 계좌 정보 로드
          try {
            console.log('계좌 정보 로드 중...');
            const paymentRef = collection(db, 'paymentInfo');
            const paymentSnap = await getDocs(paymentRef);
            console.log('계좌 정보 로드 성공:', paymentSnap.docs.length, '건');
            
            const accList = paymentSnap.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
                  const data = doc.data();
                  return {
                    phone: data.phone || '',
                    bank: data.bank || '',
                    accountNumber: data.accountNumber || '',
                  } as AccountData;
                });
                
            // Create merged data
            const merged = userList.map((user: UserData) => {
                  const account = accList.find(acc => acc.phone === user.phone) || {
                    phone: user.phone,
                    bank: '',
                    accountNumber: ''
                  };
                  return {
                    ...user,
                    ...account
                  } as MergedAccountData;
                });
                
            // 상태 업데이트
            console.log('계좌 정보 상태 업데이트:', merged.length, '건');
                setAccounts(merged);
            toast.success('데이터 로드 완료');
          } catch (accountError) {
            console.error('계좌 정보 로드 실패:', accountError);
            // 계좌 정보 로드 실패해도 사용자 정보는 유지
            toast.error('계좌 정보 로드 실패');
          }
          
          // Connection status update
          updateConnectionStatus(true);
          setIsOnline(true);
          setError(null);
          
          return true;
              } else {
          // 빈 컬렉션인 경우 (데이터 없음)
          console.log('사용자 데이터가 없습니다.');
          setUsers([]);
          setAccounts([]);
          toast('등록된 사용자 데이터가 없습니다.');
          return true;
        }
      } catch (userQueryError: any) {
        console.error('사용자 데이터 쿼리 실패:', userQueryError);
        toast.error(`사용자 데이터 로드 실패: ${userQueryError.message || '알 수 없는 오류'}`);
        throw userQueryError;
      }
    } catch (err: any) {
      console.error('실제 데이터 로드 실패:', err);
      
      // 연결 오류 시 오류 표시
      toast.error(`데이터 로드 실패: ${err.message || '알 수 없는 오류'}`);
      updateConnectionStatus(false, err);
      return false;
    }
  };

  // Local version of modified processing functions
  const approveUser = async (id: string) => {
    try {
      // Local data update
      if (authFailed) {
        setUsers(prev => prev.map(user => 
          user.id === id ? { ...user, approved: true } : user
        ));
        toast.success('User approved.');
        return;
      }
      
      // Firebase processing (if connected)
      if (!db) {
        toast.error('Firebase not initialized.');
        return;
      }
      const userRef = doc(db, 'joinUsers', id);
      await updateDoc(userRef, { approved: true });
      setUsers(prev => prev.map(user => user.id === id ? { ...user, approved: true } : user));
      toast.success('User approved.');
    } catch (error) {
      console.error('Error approving user:', error);
      toast.error('Error occurred during approval processing.');
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete? This operation cannot be undone.')) return;
    
    try {
      // Local data update
      if (authFailed) {
        setUsers(prev => prev.filter(user => user.id !== id));
        toast.success('User deleted.');
        return;
      }
      
      // Firebase processing (if connected)
      if (!db) {
        toast.error('Firebase not initialized.');
        return;
      }
      await deleteDoc(doc(db, 'joinUsers', id));
      setUsers(prev => prev.filter(user => user.id !== id));
      toast.success('User deleted.');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Error occurred during deletion processing.');
    }
  };

  // 데이터 필터링 함수 - useMemo로 최적화
  const filterData = useCallback((list: any[]) => {
    return list.filter(item => {
      const matchText = search === '' || 
        (item.name?.toLowerCase().includes(search.toLowerCase()) || 
        item.phone?.includes(search));
      const matchStart = startDate ? new Date(item.createdAt) >= new Date(startDate) : true;
      const matchEnd = endDate ? new Date(item.createdAt) <= new Date(endDate) : true;
      return matchText && matchStart && matchEnd;
    });
  }, [search, startDate, endDate]);

  // 필터링된 데이터 계산 - useMemo로 최적화
  const dataToShow = useMemo(() => {
    const sourceData = tab === 'join' 
      ? users 
      : tab === 'account' 
      ? accounts 
      : reviews.filter(r => r.service === tab);
    
    return filterData(sourceData);
  }, [tab, users, accounts, reviews, filterData]);

  // 페이지네이션된 데이터 - useMemo로 최적화
  const paginatedData = useMemo(() => {
    return dataToShow.slice(
      (currentPage - 1) * itemsPerPage, 
      currentPage * itemsPerPage
    );
  }, [dataToShow, currentPage]);

  // 총 페이지 수 - useMemo로 최적화
  const totalPages = useMemo(() => {
    return Math.ceil(dataToShow.length / itemsPerPage);
  }, [dataToShow.length]);

  const exportData = useCallback(() => {
    try {
      toast.loading('엑셀 파일 생성 중...');
      
      // 현재 필터링된 데이터 사용
      exportToExcel(
        dataToShow, 
        tab === 'join' 
          ? '가입 신청자' 
          : tab === 'account' 
            ? '계좌 정보' 
            : `${tabOptions.find(option => option.value === tab)?.label || tab} 후기`
      );
      
      toast.dismiss();
      toast.success('엑셀 파일이 다운로드되었습니다.');
    } catch (error) {
      toast.dismiss();
      console.error('엑셀 내보내기 오류:', error);
      toast.error('엑셀 다운로드 중 오류가 발생했습니다.');
    }
  }, [tab, dataToShow, tabOptions]);

  const handleLogout = () => {
    Cookies.remove('adminAuth');
    Cookies.remove('adminEmail');
    // Force page move
    window.location.href = '/admin/login';
  };

  const handleRetryConnection = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    toast('파이어베이스에 재연결 시도 중...');
    
    try {
      const reconnectResult = await reconnectFirebase();
      
      if (reconnectResult.success) {
        toast.success('파이어베이스에 성공적으로 재연결되었습니다!');
        setIsOnline(true);
        updateConnectionStatus(true, reconnectResult.error);
        
        // 데이터 다시 로드
        await Promise.all([
          loadRealData(),
          fetchReviews()
        ]);
      } else {
        toast.error('파이어베이스 재연결 실패. 샘플 데이터를 사용합니다.');
        setIsOnline(false);
        updateConnectionStatus(false, reconnectResult.error);
        
        // 샘플 데이터 로드
        loadSampleData();
      }
    } catch (err) {
      console.error('재연결 시도 오류:', err);
      toast.error('재연결 실패, 샘플 데이터를 사용합니다.');
      setIsOnline(false);
      updateConnectionStatus(false, err);
      
      // 샘플 데이터 로드
      loadSampleData();
    } finally {
        setIsLoading(false);
    }
  }, []);

  // Review data load function
  const loadReviewData = async () => {
    if (isLoading && !isOnline) return;
    
    try {
      if (!db) {
        console.log('Firestore 초기화되지 않음, 재초기화 시도');
        const reconnectResult = await reconnectFirebase();
        if (!reconnectResult.success || !db) {
          console.error('Firestore 재초기화 실패');
          toast.error('Firebase 연결 실패');
          setError('Firebase 연결 실패');
          return;
        }
      }
      
      setIsLoading(true);
      
      try {
        console.log(`${tab} 리뷰 데이터 로드 중...`);
        
        const collectionMapping: { [key: string]: string } = {
          'joinEvent': 'joinEventReviews',
          'cafeReview': 'cafeReviews',
          'blogReview': 'blogReviews',
          'instaReview': 'instaReviews'
        };
        
        const collectionName = collectionMapping[tab];
        if (!collectionName) {
          console.error('잘못된 탭 이름:', tab);
          return;
        }
        
        const reviewRef = collection(db, collectionName);
        const reviewSnap = await getDocs(reviewRef);
        
        if (reviewSnap.empty) {
          console.log(`${collectionName} 컬렉션에 데이터가 없습니다`);
          setReviews([]);
          toast(`${tabOptions.find(option => option.value === tab)?.label || tab} 데이터가 없습니다`);
          return;
        }
        
        console.log(`${collectionName}에서 ${reviewSnap.docs.length}건의 데이터 로드 완료`);
        const reviewList: ReviewData[] = reviewSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || '',
            phone: data.phone || '',
            accountNumber: data.accountNumber || '',
            reviewLink: data.reviewLink || '',
            createdAt: data.createdAt || new Date().toISOString(),
            service: tab,
            status: data.status || 'pending',
            termsAccepted: data.termsAccepted || false,
            verificationStatus: data.verificationStatus || false
          };
        });
        
        setReviews(reviewList);
        setIsOnline(true);
        setError(null);
        toast.success(`${tabOptions.find(option => option.value === tab)?.label || tab} 데이터 로드 완료`);
        
        updateConnectionStatus(true);
      } catch (err: any) {
        console.error(`${tab} 데이터를 불러오는 중 오류 발생:`, err);
        setError(`${tab} 데이터를 불러오는 중 오류가 발생했습니다.`);
        toast.error(`데이터 로드 실패: ${err.message || '알 수 없는 오류'}`);
      } finally {
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('데이터 로드 중 오류:', err);
      setError(`데이터 로드 중 오류가 발생했습니다: ${err.message || '알 수 없는 오류'}`);
      setIsLoading(false);
    }
  };

  // Review management functions
  const handleApproveReview = async (id: string) => {
    if (!db) {
      toast.error('Firebase not initialized');
      return;
    }
    
    try {
      const collectionMapping: { [key: string]: string } = {
        'joinEvent': 'joinEventReviews',
        'cafeReview': 'cafeReviews',
        'blogReview': 'blogReviews',
        'instaReview': 'instaReviews'
      };
      
      const collectionName = collectionMapping[tab];
      if (!collectionName) {
        console.error('Invalid tab name:', tab);
        return;
      }
      
      const reviewRef = doc(db, collectionName, id);
      await updateDoc(reviewRef, { 
        status: 'approved',
        updatedAt: new Date().toISOString()
      });
      
      // Update local state
      setReviews(prev => prev.map(review => 
        review.id === id 
          ? { ...review, status: 'approved' } 
          : review
      ));
      
      toast.success('리뷰가 승인되었습니다');
    } catch (error) {
      console.error('Error approving review:', error);
      toast.error('승인 처리 중 오류가 발생했습니다');
    }
  };
  
  const handleRejectReview = async (id: string) => {
    if (!db) {
      toast.error('Firebase not initialized');
      return;
    }
    
    try {
      const collectionMapping: { [key: string]: string } = {
        'joinEvent': 'joinEventReviews',
        'cafeReview': 'cafeReviews',
        'blogReview': 'blogReviews',
        'instaReview': 'instaReviews'
      };
      
      const collectionName = collectionMapping[tab];
      if (!collectionName) {
        console.error('Invalid tab name:', tab);
        return;
      }
      
      const reviewRef = doc(db, collectionName, id);
      await updateDoc(reviewRef, { 
        status: 'rejected',
        updatedAt: new Date().toISOString()
      });
      
      // Update local state
      setReviews(prev => prev.map(review => 
        review.id === id 
          ? { ...review, status: 'rejected' } 
          : review
      ));
      
      toast.success('리뷰가 거절되었습니다');
    } catch (error) {
      console.error('Error rejecting review:', error);
      toast.error('거절 처리 중 오류가 발생했습니다');
    }
  };

  // Add fetchReviews function to load the correct review types
  const fetchReviews = async () => {
    if (isLoading && !isOnline) return false;
    
    try {
      if (!db) {
        console.log('Firestore 초기화되지 않음, 재초기화 시도');
        const reconnectResult = await reconnectFirebase();
        if (!reconnectResult.success || !db) {
          console.error('Firestore 재초기화 실패');
          return false;
        }
      }
      
      const reviewTypes = ['joinEvent', 'cafeReview', 'blogReview', 'instaReview'];
      const allReviews: ReviewData[] = [];
      let loadingErrors = false;
      
      for (const type of reviewTypes) {
        try {
          const collectionMapping: { [key: string]: string } = {
            'joinEvent': 'joinEventReviews',
            'cafeReview': 'cafeReviews',
            'blogReview': 'blogReviews',
            'instaReview': 'instaReviews'
          };
          
          const collectionName = collectionMapping[type];
          console.log(`${collectionName} 데이터 로드 중...`);
          
          const reviewRef = collection(db, collectionName);
          const snapshot = await getDocs(reviewRef);
          
          const reviewList = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name || '',
              phone: data.phone || '',
              accountNumber: data.accountNumber || '',
              reviewLink: data.reviewLink || '',
              createdAt: data.createdAt || new Date().toISOString(),
              service: type,
              status: data.status || 'pending',
              termsAccepted: data.termsAccepted || false,
              verificationStatus: data.verificationStatus || false
            } as ReviewData;
          });
          
          allReviews.push(...reviewList);
          console.log(`${type} 리뷰 ${reviewList.length}건 로드 완료`);
        } catch (err) {
          console.error(`${type} 리뷰 로드 실패:`, err);
          loadingErrors = true;
        }
      }
      
      if (allReviews.length > 0) {
        console.log(`총 ${allReviews.length}건의 리뷰 데이터 로드 완료`);
        setReviews(allReviews);
        
        updateConnectionStatus(true);
        setIsOnline(true);
        setError(null);
        
        if (loadingErrors) {
          toast('일부 리뷰 데이터 로드 실패');
        } else {
          toast.success('모든 리뷰 데이터 로드 완료');
        }
        return true;
      } else {
        console.log('리뷰 데이터가 없습니다');
        setReviews([]);
        toast('등록된 리뷰 데이터가 없습니다');
        return true;
      }
    } catch (error: any) {
      console.error('리뷰 데이터 로드 중 오류:', error);
      toast.error(`리뷰 데이터 로드 실패: ${error.message || '알 수 없는 오류'}`);
      setError('리뷰 데이터 로드 중 오류가 발생했습니다');
      return false;
    }
  };

  // 로그인 상태 초기화 함수 - 필요할 때 호출하여 로그인 상태 복구
  const initializeAuthState = useCallback(async () => {
    const isAuth = Cookies.get('adminAuth') === 'true';
    const savedEmail = Cookies.get('adminEmail');
    
    if (isAuth && savedEmail) {
      console.log('Restoring auth state from cookies');
      setAdminEmail(savedEmail);
      setAuthFailed(false);
      
      // 세션 타임아웃 리셋
      Cookies.set('adminAuth', 'true', { expires: 1 }); // 1일 유지
      Cookies.set('adminEmail', savedEmail, { expires: 1 });
      
      return true;
    }
    
    return false;
  }, []);
  
  // 쿠키 만료 시간 연장 - 정기적으로 호출
  useEffect(() => {
    // 페이지 활성화 상태에서 15분마다 쿠키 갱신
    const refreshCookies = () => {
      const isAuth = Cookies.get('adminAuth') === 'true';
      const savedEmail = Cookies.get('adminEmail');
      
      if (isAuth && savedEmail) {
        console.log('Refreshing auth cookies');
        Cookies.set('adminAuth', 'true', { expires: 1 }); // 1일 유지
        Cookies.set('adminEmail', savedEmail, { expires: 1 });
      }
    };
    
    const intervalId = setInterval(refreshCookies, 15 * 60 * 1000); // 15분마다 갱신
    
    return () => clearInterval(intervalId);
  }, []);
  
  // 자동 로그인 시도 - 페이지 로드 시 한 번 실행
  useEffect(() => {
    const attemptAutoLogin = async () => {
      if (authFailed) {
        const restored = await initializeAuthState();
        
        if (restored) {
          console.log('Auto-login successful');
          checkConnection().then(connected => {
            if (connected) {
              Promise.all([loadRealData(), fetchReviews()])
                .catch(err => console.error('Initial data load failed:', err));
            }
          });
        }
      }
    };
    
    attemptAutoLogin();
  }, [authFailed, initializeAuthState]);

  // 서버 시작 후 Firebase 상태 모니터링 및 자동 복구
  useEffect(() => {
    let checkAttempted = false;
    
    // Firebase가 특정 시간 후에도 초기화되지 않았는지 확인 (단 한 번만 실행)
    const checkFirebaseInitialization = setTimeout(() => {
      if (checkAttempted) return;
      checkAttempted = true;
      
      if (!db || !auth) {
        console.warn('Firebase 서비스가 아직 초기화되지 않음, 샘플 데이터 사용');
        // 연결 시도 없이 샘플 데이터 로드
        loadSampleData();
      }
    }, 5000); // 5초 후에 확인
    
    return () => clearTimeout(checkFirebaseInitialization);
  }, []);
  
  // 인증 오류 복구 메커니즘
  useEffect(() => {
    if (authFailed) {
      console.log('인증 오류 발생, 복구 시도');
      
      // 쿠키에서 인증 정보 확인
      const savedEmail = Cookies.get('adminEmail');
      const isAuth = Cookies.get('adminAuth') === 'true';
      
      if (isAuth && savedEmail) {
        // 쿠키 기반으로 세션 재설정
        console.log('쿠키에서 세션 복구 시도', savedEmail);
        setAdminEmail(savedEmail);
        setAuthFailed(false);
        
        // 세션 갱신
        Cookies.set('adminAuth', 'true', { expires: 1 });
        Cookies.set('adminEmail', savedEmail, { expires: 1 });
        
        // 데이터 로드 시도
        checkConnection().then(connected => {
          if (connected) {
            Promise.all([loadRealData(), fetchReviews()])
              .catch(err => console.error('데이터 로드 실패:', err));
          }
        });
      } else {
        // 복구 실패 시 로그인 페이지로 리디렉션
        console.error('세션 복구 실패, 로그인 필요');
        router.replace('/admin/login');
      }
    }
  }, [authFailed, router]);

  // 실시간 데이터 자동 새로고침 (서버 실행 중 유지)
  useEffect(() => {
    let refreshTimerId: NodeJS.Timeout | null = null;
    
    // 자동 새로고침 함수
    const periodicRefresh = async () => {
      // 이미 로딩 중이거나 오프라인 상태면 스킵
      if (isLoading || !navigator.onLine) {
        console.log('자동 데이터 새로고침 스킵: ' + (isLoading ? '로딩 중' : '오프라인 상태'));
        return;
      }
      
      console.log('자동 데이터 새로고침 실행');
      
      // 먼저 연결 상태 확인
      try {
        const isConnected = await checkConnection();
        if (!isConnected) {
          console.log('연결 상태 불량, 새로고침 스킵');
          return;
        }
        
        // 현재 선택된 탭에 따라 필요한 데이터만 새로고침
        if (tab === 'join' || tab === 'account') {
          await loadRealData();
        } else if (tab === 'joinEvent' || tab === 'cafeReview' || tab === 'blogReview' || tab === 'instaReview') {
          await loadReviewData();
        }
      } catch (err) {
        console.error('자동 새로고침 오류:', err);
      }
    };
    
    if (isOnline && autoRefresh && !isLoading) {
      console.log(`자동 데이터 새로고침 활성화: ${AUTO_REFRESH_INTERVAL/1000}초 간격`);
      refreshTimerId = setInterval(periodicRefresh, AUTO_REFRESH_INTERVAL);
    }
    
    return () => {
      if (refreshTimerId) {
        clearInterval(refreshTimerId);
      }
    };
  }, [isOnline, autoRefresh, isLoading, tab]);

  // 서버 시작 시 자동 연결 및 데이터 로드 기능
  useEffect(() => {
    // 클라이언트 사이드에서만 실행
    if (typeof window === 'undefined') return;
    
    let initialized = false;
    
    // 서버 시작 시 한 번만 실행되는 초기화 로직
    const initializeOnServerStart = async () => {
      // 중복 실행 방지
      if (initialized || isLoading) {
        console.log('이미 초기화 중이거나 완료됨');
        return;
      }
      
      initialized = true;
      console.log('서버 시작 - 파이어베이스 연결 및 데이터 로드 시작');
      setIsLoading(true);
      
      try {
        // 인증 상태 복구
        const adminEmail = Cookies.get('adminEmail');
        if (adminEmail) {
          setAdminEmail(adminEmail);
          setAuthFailed(false);
          Cookies.set('adminAuth', 'true', { expires: 1 });
          Cookies.set('adminEmail', adminEmail, { expires: 1 });
        }
        
        // 파이어베이스 연결 시도
        if (db) {
          try {
            // 연결 상태 확인
            const connected = await checkConnection();
            if (!connected) {
              console.log('파이어베이스 연결 실패, 재연결 시도');
              const reconnectResult = await reconnectFirebase();
              if (!reconnectResult.success) {
                throw new Error('파이어베이스 재연결 실패');
              }
            }
            
            console.log('파이어베이스 연결 성공, 데이터 로드 시도');
            // 실제 데이터 로드
            const dataLoaded = await loadRealData();
            await fetchReviews();
            
            if (dataLoaded) {
              toast.success('데이터 로드 성공');
              setIsLoading(false);
              return;
            }
          } catch (loadError) {
            console.error('파이어베이스 데이터 로드 실패:', loadError);
          }
        }
        
        // 연결 또는 데이터 로드 실패 시 샘플 데이터 사용
        console.log('실제 데이터 로드 실패, 샘플 데이터 사용');
        loadSampleData();
      } catch (err) {
        console.error('초기화 중 오류 발생:', err);
        loadSampleData();
      } finally {
        setIsLoading(false);
      }
    };
    
    // 클라이언트 사이드에서만 초기화 실행
    initializeOnServerStart();
  }, []);

  // 브라우저 새로고침 감지 및 상태 저장 (별도 분리)
  useEffect(() => {
    // 브라우저 새로고침 감지 및 상태 저장
    const handleBeforeUnload = () => {
      // 중요 상태 저장
      sessionStorage.setItem('dashboard_tab', tab);
      sessionStorage.setItem('dashboard_page', currentPage.toString());
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // 페이지 로드 시 저장된 상태 복원
    const savedTab = sessionStorage.getItem('dashboard_tab');
    const savedPage = sessionStorage.getItem('dashboard_page');
    
    if (savedTab && tabOptions.some(opt => opt.value === savedTab)) {
      setTab(savedTab);
    }
    
    if (savedPage) {
      setCurrentPage(parseInt(savedPage, 10) || 1);
    }
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [tab, currentPage, tabOptions]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>
              <div className="flex gap-2 items-center">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  isOnline 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {isOnline ? '온라인' : '오프라인'}
                </span>
                {adminEmail && (
                  <span className="text-sm text-gray-600">
                    {adminEmail}
                  </span>
                )}
              </div>
            </div>
            
            {/* Firebase 연결 상태 */}
            <div className="flex flex-wrap items-center gap-2 text-sm bg-gray-50 rounded-lg p-2 shadow-inner">
              <div className="flex items-center">
                <span className={`w-3 h-3 rounded-full mr-2 ${
                  connectionStatus.isConnected 
                    ? 'bg-green-500' 
                    : 'bg-red-500'
                }`}></span>
                <span className="font-medium mr-2">파이어베이스:</span>
                <span>{connectionStatus.isConnected ? '연결됨' : '연결 안됨'}</span>
              </div>
              <div className="hidden md:flex items-center ml-4">
                <span className="text-gray-500">마지막 확인:</span>
                <span className="ml-1 text-gray-700">
                  {typeof window !== 'undefined' 
                    ? new Date(connectionStatus.lastChecked).toLocaleTimeString('ko-KR') 
                    : ''}
                </span>
              </div>
              <div className="ml-auto">
                <label className="inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                  />
                  <div className="relative w-9 h-5 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  <span className="ml-2 text-sm font-medium text-gray-500">자동 연결 확인</span>
                </label>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={reconnectAndLoad} 
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isOnline 
                    ? 'bg-gray-200 text-gray-600 hover:bg-gray-300' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    연결 중...
                  </span>
                ) : (
                  '재연결'
                )}
              </button>
              <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                로그아웃
              </button>
              <button onClick={() => router.push('/')} className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                홈으로
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {tabOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setTab(option.value)}
                className={tab === option.value ? activeTab : tabStyle}
              >
                {option.label}
            </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="이름 또는 연락처로 검색"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={exportData}
              className="inline-flex items-center px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              엑셀 다운로드
            </button>
          </div>
        </div>

        {/* Data Display */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          {/* Data status display */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{
                tab === 'join' 
                  ? '가입 신청자' 
                  : tab === 'account' 
                    ? '가입자 + 계좌정보' 
                    : tabOptions.find(option => option.value === tab)?.label
              } 데이터</h2>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                isOnline && connectionStatus.isConnected
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {isOnline && connectionStatus.isConnected ? '실시간 데이터' : '샘플 데이터'}
              </span>
            </div>
            <div className="flex items-center gap-2">
                <button 
                onClick={reconnectAndLoad} 
                className={`inline-flex items-center px-3 py-1.5 ${
                  isLoading 
                    ? 'bg-gray-300 cursor-not-allowed' 
                    : connectionStatus.isConnected
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                } text-white text-sm font-medium rounded transition-colors`}
                  disabled={isLoading}
                >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    데이터 로드 중...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                    {connectionStatus.isConnected ? '데이터 새로고침' : '실시간 데이터 불러오기'}
                  </span>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                  <div className="mt-2 flex space-x-4">
                    <button
                      onClick={() => window.location.reload()}
                      className="inline-flex items-center text-sm font-medium text-red-600 hover:text-red-500"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      페이지 새로고침
                    </button>
                    <button
                      onClick={reconnectAndLoad}
                      className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      재연결 시도
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              <div className="space-y-6">
              {tab === 'join' && (
                  <MemoizedJoinList 
                    data={paginatedData as UserData[]} 
                    approveUser={approveUser} 
                    deleteUser={deleteUser} 
                  />
                )}
                {tab === 'account' && (
                  <MemoizedAccountList 
                    data={paginatedData as MergedAccountData[]} 
                  />
                )}
                {(tab === 'joinEvent' || tab === 'cafeReview' || tab === 'blogReview' || tab === 'instaReview') && (
                  <MemoizedReviewList 
                    tab={tabOptions.find(option => option.value === tab)?.label || ''} 
                    data={paginatedData as ReviewData[]}
                    onApprove={handleApproveReview}
                    onReject={handleRejectReview}
                  />
                )}
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center mt-6 gap-2">
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`px-3 py-1 rounded ${
                        currentPage === i + 1
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

const tabStyle = 'px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm transition-colors';
const activeTab = 'px-4 py-2 bg-blue-600 text-white rounded-lg text-sm transition-colors';

const MemoizedJoinList = memo(function JoinList({ 
  data, 
  approveUser, 
  deleteUser 
}: { 
  data: UserData[],
  approveUser: (id: string) => Promise<void>,
  deleteUser: (id: string) => Promise<void>
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">가입 신청자 ({data.length}명)</h2>
      {data.length === 0 ? <p className="text-gray-500">신청 내역이 없습니다.</p> : (
        <ul className="space-y-4">
          {data.map((user: any) => (
            <li key={user.id} className="bg-white dark:bg-gray-900 border rounded-lg p-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><strong>이름:</strong> {user.name}</div>
                <div><strong>연락처:</strong> {user.phone}</div>
                <div><strong>이메일:</strong> {user.email}</div>
                <div><strong>생년월일:</strong> {user.birthDate}</div>
                <div><strong>성별:</strong> {user.gender}</div>
                <div><strong>유입경로:</strong> {user.trafficSource}</div>
                <div><strong>통화 가능 시간:</strong> {user.callTime}</div>
                <div><strong>추천인 코드:</strong> {user.referralCode || '없음'}</div>
                {user.phoneCarrier && <div><strong>통신사:</strong> {user.phoneCarrier}</div>}
              </div>
              <div className="text-xs text-gray-400 mt-2">신청일: {typeof window !== 'undefined' 
                ? new Date(user.createdAt).toLocaleString('ko-KR') 
                : ''}</div>
              <div className="mt-3 flex gap-2">
                <strong>승인:</strong>
                {user.approved ? (
                  <span className="text-green-600">승인됨</span>
                ) : (
                  <button onClick={() => approveUser(user.id)} className="text-sm bg-black text-white px-2 py-1 rounded">승인</button>
                )}
                <button onClick={() => deleteUser(user.id)} className="ml-auto text-sm bg-red-500 text-white px-2 py-1 rounded">삭제</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

const MemoizedAccountList = memo(function AccountList({ 
  data 
}: { 
  data: MergedAccountData[] 
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">가입자 + 계좌정보 ({data.length}명)</h2>
      {data.length === 0 ? <p className="text-gray-500">데이터가 없습니다.</p> : (
        <ul className="space-y-4">
          {data.map((user: any, idx: number) => (
            <li key={idx} className="bg-white dark:bg-gray-900 border rounded-lg p-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><strong>이름:</strong> {user.name}</div>
                <div><strong>연락처:</strong> {user.phone}</div>
                <div><strong>은행:</strong> {user.bank}</div>
                <div><strong>계좌번호:</strong> {user.accountNumber}</div>
                <div><strong>승인 상태:</strong> {user.approved ? '승인됨' : '미승인'}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

const MemoizedReviewList = memo(function ReviewList({ 
  tab, 
  data,
  onApprove,
  onReject 
}: { 
  tab: string;
  data: ReviewData[];
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}) {
  const getStatusBadge = (status: string) => {
    const statusStyles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[status as keyof typeof statusStyles] || statusStyles.pending}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">{tab} ({data.length}건)</h2>
      </div>
      
      {data.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">등록된 데이터가 없습니다</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {data.map((item: ReviewData) => (
            <div key={item.id} className="bg-white rounded-lg border shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
    <div>
                  <h3 className="font-medium">{item.name}</h3>
                  <p className="text-sm text-gray-600">{item.phone}</p>
                </div>
                <span className={getStatusBadge(item.status)}>
                  {item.status === 'approved' ? '승인됨' : 
                   item.status === 'rejected' ? '거절됨' : '대기중'}
                </span>
              </div>
              
              <div className="space-y-2 text-sm">
                {item.accountNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">계좌번호:</span>
                    <span className="font-medium">{item.accountNumber}</span>
                  </div>
                )}
                
                {item.reviewLink && (
                  <div className="flex justify-between items-start">
                    <span className="text-gray-600">리뷰 링크:</span>
                    <a 
                      href={item.reviewLink} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-600 hover:text-blue-800 underline break-all max-w-[200px]"
                    >
                      {item.reviewLink}
                    </a>
                  </div>
                )}
                
                {item.verificationStatus !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">본인인증:</span>
                    <span className={item.verificationStatus ? 'text-green-600' : 'text-red-600'}>
                      {item.verificationStatus ? '완료' : '미완료'}
                    </span>
                  </div>
                )}
                
                {item.termsAccepted !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">약관동의:</span>
                    <span className={item.termsAccepted ? 'text-green-600' : 'text-red-600'}>
                      {item.termsAccepted ? '동의' : '미동의'}
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span className="text-gray-600">신청일:</span>
                  <span className="text-gray-600">
                    {typeof window !== 'undefined' 
                      ? new Date(item.createdAt).toLocaleString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : ''}
                  </span>
                </div>
              </div>
              
              <div className="mt-4 flex justify-end gap-2">
                {item.status !== 'approved' && (
                  <button 
                    onClick={() => onApprove(item.id)}
                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    승인
                  </button>
                )}
                {item.status !== 'rejected' && (
                  <button 
                    onClick={() => onReject(item.id)}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  >
                    거절
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
