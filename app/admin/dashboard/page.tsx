'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth, analytics, signInWithEmail, testDbConnection } from '../../lib/firebase';
import { collection, getDocs, updateDoc, deleteDoc, doc, query, orderBy, DocumentData, onSnapshot, enableNetwork, disableNetwork, setLogLevel } from 'firebase/firestore';
import { exportToExcel } from '../../lib/exportExcel';
import { useSessionTimeout } from '../../hooks/useSessionTimeout';
import Cookies from 'js-cookie';
import { toast } from 'react-hot-toast';
import { onAuthStateChanged } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';

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
}

const itemsPerPage = 20;
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export default function AdminReviewDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<'join' | 'account' | 'cafe' | 'blog' | 'instagram'>('join');
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
  const authCheckComplete = useRef(false);
  const [authFailed, setAuthFailed] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<any>(null);

  // Session timeout hook
  useSessionTimeout(SESSION_TIMEOUT, () => {
    Cookies.remove('adminAuth');
    Cookies.remove('adminEmail');
    toast.error('세션이 만료되었습니다. 다시 로그인해주세요.');
    router.replace('/admin/login');
  });

  // Firebase 초기화 및 디버깅 설정
  useEffect(() => {
    // 디버깅을 위한 로그 레벨 설정
    if (process.env.NODE_ENV === 'development') {
      setLogLevel('debug');
    }
    
    // 저장된 이메일로 Firebase 인증 시도 - 네트워크 연결 이슈가 있으므로 우선 하이브리드 방식 채택
    const setupFirebase = async () => {
      try {
        const savedEmail = Cookies.get('adminEmail');
        setAdminEmail(savedEmail || null);
        
        // 인증 시도
        console.log('Firebase 초기화 시도 - 하이브리드 모드');
        
        // 최초 샘플 데이터 로드 (백업용)
        loadSampleData();
        
        // 실제 데이터 로드 시도 - 비동기로 실행
        setTimeout(() => {
          loadRealData();
        }, 500);
      } catch (err) {
        console.error('Firebase 초기화 실패:', err);
        // 오류 발생 시에도 샘플 데이터 유지
      }
    };
    
    setupFirebase();
    
    return () => {
      // 로그 레벨 원상복구
      setLogLevel('info');
    };
  }, []);

  // 샘플 데이터 로드 함수
  const loadSampleData = () => {
    console.log('샘플 데이터 로드 중...');
    
    // 가입 신청자 샘플 데이터
    const sampleUsers = [
      {
        id: '1',
        name: '홍길동',
        phone: '010-1234-5678',
        email: 'hong@example.com',
        birthDate: '1990-01-01',
        gender: '남성',
        trafficSource: '네이버 검색',
        callTime: '오후',
        referralCode: '',
        createdAt: '2025-03-20T15:00:00.000Z',
        approved: false
      },
      {
        id: '2',
        name: '김철수',
        phone: '010-9876-5432',
        email: 'kim@example.com',
        birthDate: '1985-05-05',
        gender: '남성',
        trafficSource: '추천',
        callTime: '오전',
        referralCode: 'FRIEND1',
        createdAt: '2025-03-22T10:00:00.000Z',
        approved: true
      },
      {
        id: '3',
        name: '이영희',
        phone: '010-2222-3333',
        email: 'lee@example.com',
        birthDate: '1995-12-25',
        gender: '여성',
        trafficSource: '인스타그램',
        callTime: '저녁',
        referralCode: '',
        createdAt: '2025-03-25T18:30:00.000Z',
        approved: false
      }
    ];
    
    // 계좌 정보 샘플 데이터
    const sampleAccounts = sampleUsers.map(user => ({
      ...user,
      bank: ['국민은행', '신한은행', '우리은행'][Math.floor(Math.random() * 3)],
      accountNumber: '123-45-678901'
    }));
    
    // 리뷰 샘플 데이터
    const sampleReviews = [
      {
        id: '1',
        name: '박지성',
        phone: '010-5555-6666',
        accountNumber: '111-22-333333',
        reviewLink: 'https://example.com/review1',
        createdAt: '2025-03-18T14:00:00.000Z'
      },
      {
        id: '2',
        name: '손흥민',
        phone: '010-7777-8888',
        accountNumber: '444-55-666666',
        reviewLink: 'https://example.com/review2',
        createdAt: '2025-03-21T09:00:00.000Z'
      }
    ];
    
    // 데이터 설정
    setUsers(sampleUsers);
    setAccounts(sampleAccounts);
    setReviews(sampleReviews);
    
    // 연결 상태 표시
    setConnectionStatus({
      success: false,
      error: new Error('Firebase 연결 불가 - 샘플 데이터 사용 중')
    });
    
    // 로딩 완료
    setIsLoading(false);
    setIsOnline(false);
    setError('Firebase 연결이 불가능하여 샘플 데이터를 표시합니다. 네트워크 연결을 확인하세요.');
    
    console.log('샘플 데이터 로드 완료');
  };

  // 실제 데이터 로드 함수 
  const loadRealData = async () => {
    if (!db) {
      console.error('Firestore가 초기화되지 않았습니다');
      return;
    }
    
    try {
      console.log('실제 데이터 로드 시도 중...');
      
      // 사용자 컬렉션 로드
      const joinRef = collection(db, 'joinUsers');
      const joinSnap = await getDocs(joinRef);
      
      // 성공적으로 데이터 로드됨
      console.log('joinUsers 컬렉션에서', joinSnap.docs.length, '개 문서 로드됨');
      
      if (joinSnap.docs.length > 0) {
        const userList = joinSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as UserData));
        
        setUsers(userList);
        setAuthFailed(false);
        setIsOnline(true);
        setError(null);
        toast.success('실제 데이터 로드 성공!');
        
        // 계좌 정보도 로드 시도
        try {
          const paymentRef = collection(db, 'paymentInfo');
          const paymentSnap = await getDocs(paymentRef);
          console.log('paymentInfo 컬렉션에서', paymentSnap.docs.length, '개 문서 로드됨');
          
          const accList = paymentSnap.docs.map(doc => {
            const data = doc.data();
            return {
              phone: data.phone || '',
              bank: data.bank || '',
              accountNumber: data.accountNumber || '',
            } as AccountData;
          });
          
          // 병합된 데이터 생성
          const merged = userList.map(user => {
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
          
          setAccounts(merged);
        } catch (err) {
          console.error('계좌정보 로드 실패:', err);
        }
        
        // 리뷰 데이터 로드
        try {
          const reviewTabs = ['cafe', 'blog', 'instagram'];
          
          for (const tabName of reviewTabs) {
            const reviewRef = collection(db, `${tabName}Reviews`);
            const reviewSnap = await getDocs(reviewRef);
            
            if (tabName === 'cafe' && reviewSnap.docs.length > 0) {
              const reviewsList = reviewSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
              } as ReviewData));
              
              setReviews(reviewsList);
            }
          }
        } catch (err) {
          console.error('리뷰 데이터 로드 실패:', err);
        }
      }
      
      // 연결 상태 업데이트
      setConnectionStatus({
        success: true
      });
      
    } catch (err) {
      console.error('실제 데이터 로드 실패:', err);
    }
  };

  // 쿠키 기반 인증 체크
  useEffect(() => {
    // 무한 리다이렉션 방지
    if (authCheckComplete.current) return;
    
    const adminAuth = Cookies.get('adminAuth');
    if (adminAuth !== 'true') {
      authCheckComplete.current = true;
      router.replace('/admin/login');
      return;
    }
    
    authCheckComplete.current = true;
  }, [router]);
  
  // 탭 변경시 데이터 페치 트리거
  useEffect(() => {
    // 샘플 데이터가 아닐 때만 실행
    if (!authFailed && db) {
      setIsLoading(true);
      
      // 간단한 버전으로 다시 시도
      setTimeout(async () => {
        try {
          if (tab === 'join') {
            console.log('join 탭 데이터 로드 시도');
            const joinRef = collection(db as Firestore, 'joinUsers');
            const joinSnap = await getDocs(joinRef);
            
            if (joinSnap.docs.length > 0) {
              console.log('joinUsers 문서 수:', joinSnap.docs.length);
              const userList = joinSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
              } as UserData));
              setUsers(userList);
            }
          } else if (tab === 'account') {
            console.log('account 탭 데이터 로드 시도');
            try {
              // Firebase에서 paymentInfo 컬렉션과 joinUsers 컬렉션을 모두 가져옴
              const [userSnap, accSnap] = await Promise.all([
                getDocs(collection(db as Firestore, 'joinUsers')),
                getDocs(collection(db as Firestore, 'paymentInfo'))
              ]);
              
              console.log('joinUsers 문서 수:', userSnap.docs.length);
              console.log('paymentInfo 문서 수:', accSnap.docs.length);
              
              if (userSnap.docs.length > 0) {
                const userList = userSnap.docs.map(doc => {
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
                    approved: data.approved || false,
                  } as UserData;
                });
                
                const accList = accSnap.docs.map(doc => {
                  const data = doc.data();
                  return {
                    phone: data.phone || '',
                    bank: data.bank || '',
                    accountNumber: data.accountNumber || '',
                  } as AccountData;
                });
                
                // 전화번호 기준으로 두 데이터 병합
                const merged = userList.map(user => {
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
                
                setAccounts(merged);
              }
            } catch (err) {
              console.error('account 데이터 로드 실패:', err);
            }
          } else if (tab === 'cafe') {
            console.log(tab + ' 리뷰 데이터 로드 시도');
            try {
              const reviewRef = collection(db as Firestore, `${tab}Reviews`);
              const reviewSnap = await getDocs(reviewRef);
              
              if (reviewSnap.docs.length > 0) {
                console.log(tab + 'Reviews 문서 수:', reviewSnap.docs.length);
                const reviewList = reviewSnap.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data(),
                } as ReviewData));
                setReviews(reviewList);
              } else {
                setReviews([]);
              }
            } catch (err) {
              console.error(tab + ' 리뷰 데이터 로드 실패:', err);
              setReviews([]);
            }
          }
        } catch (err) {
          console.error('탭 전환 데이터 로드 실패:', err);
        } finally {
          setIsLoading(false);
        }
      }, 500);
    }
  }, [tab, authFailed, db]);

  // 로컬 방식으로 수정한 처리 함수들
  const approveUser = async (id: string) => {
    try {
      // 로컬 데이터 업데이트
      if (authFailed) {
        setUsers(prev => prev.map(user => 
          user.id === id ? { ...user, approved: true } : user
        ));
        toast.success('사용자가 승인되었습니다.');
        return;
      }
      
      // Firebase 처리 (연결 가능한 경우)
      if (!db) {
        toast.error('Firebase 연결이 초기화되지 않았습니다.');
        return;
      }
      const userRef = doc(db, 'joinUsers', id);
      await updateDoc(userRef, { approved: true });
      setUsers(prev => prev.map(user => user.id === id ? { ...user, approved: true } : user));
      toast.success('사용자가 승인되었습니다.');
    } catch (error) {
      console.error('Error approving user:', error);
      toast.error('승인 처리 중 오류가 발생했습니다.');
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm('정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    
    try {
      // 로컬 데이터 업데이트
      if (authFailed) {
        setUsers(prev => prev.filter(user => user.id !== id));
        toast.success('사용자가 삭제되었습니다.');
        return;
      }
      
      // Firebase 처리 (연결 가능한 경우)
      if (!db) {
        toast.error('Firebase 연결이 초기화되지 않았습니다.');
        return;
      }
      await deleteDoc(doc(db, 'joinUsers', id));
      setUsers(prev => prev.filter(user => user.id !== id));
      toast.success('사용자가 삭제되었습니다.');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('삭제 처리 중 오류가 발생했습니다.');
    }
  };

  const filterData = (list: any[]) => {
    return list.filter(item => {
      const matchText = search === '' || 
        item.name?.toLowerCase().includes(search.toLowerCase()) || 
        item.phone?.includes(search);
      const matchStart = startDate ? new Date(item.createdAt) >= new Date(startDate) : true;
      const matchEnd = endDate ? new Date(item.createdAt) <= new Date(endDate) : true;
      return matchText && matchStart && matchEnd;
    });
  };

  const exportData = () => {
    try {
      const data = tab === 'join' ? filterData(users) : tab === 'account' ? filterData(accounts) : filterData(reviews);
      exportToExcel(data, tab === 'join' ? '가입신청자' : tab === 'account' ? '계좌정보' : `${tab}후기`);
      toast.success('엑셀 파일이 다운로드되었습니다.');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('엑셀 다운로드 중 오류가 발생했습니다.');
    }
  };

  const handleLogout = () => {
    Cookies.remove('adminAuth');
    Cookies.remove('adminEmail');
    // 강제 페이지 이동으로 변경
    window.location.href = '/admin/login';
  };

  const handleRetryConnection = () => {
    setIsLoading(true);
    toast('Firebase 연결 재시도 중...');
    
    // 실제 데이터 로드 재시도
    loadRealData()
      .then(() => {
        setIsLoading(false);
      })
      .catch(err => {
        console.error('재시도 실패:', err);
        setIsLoading(false);
        toast.error('재시도 실패. 샘플 데이터 유지합니다.');
      });
  };

  const dataToShow = filterData(tab === 'join' ? users : tab === 'account' ? accounts : reviews);
  const totalPages = Math.ceil(dataToShow.length / itemsPerPage);
  const paginatedData = dataToShow.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
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
            <div className="flex gap-2">
              <button 
                onClick={handleRetryConnection} 
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
                  '연결 재시도'
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
            <button onClick={() => setTab('join')} className={tab === 'join' ? activeTab : tabStyle}>
              가입 신청자
            </button>
            <button onClick={() => setTab('account')} className={tab === 'account' ? activeTab : tabStyle}>
              가입자 + 계좌정보
            </button>
            <button onClick={() => setTab('cafe')} className={tab === 'cafe' ? activeTab : tabStyle}>
              카페 후기
            </button>
            <button onClick={() => setTab('blog')} className={tab === 'blog' ? activeTab : tabStyle}>
              블로그 후기
            </button>
            <button onClick={() => setTab('instagram')} className={tab === 'instagram' ? activeTab : tabStyle}>
              인스타 후기
            </button>
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
          {/* 데이터 상태 표시 */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{
                tab === 'join' 
                  ? '가입 신청자' 
                  : tab === 'account' 
                    ? '가입자 + 계좌정보' 
                    : `${tab.toUpperCase()} 후기`
              } 데이터</h2>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                isOnline 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {isOnline ? '실시간 데이터' : '샘플 데이터'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!isOnline && (
                <button 
                  onClick={handleRetryConnection} 
                  className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
                  disabled={isLoading}
                >
                  {isLoading ? '연결 중...' : '실시간 데이터 가져오기'}
                </button>
              )}
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
                      onClick={handleRetryConnection}
                      className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      연결 재시도
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
              {tab === 'join' && (
                <JoinList data={paginatedData as UserData[]} approveUser={approveUser} deleteUser={deleteUser} />
              )}
              {tab === 'account' && <AccountList data={paginatedData as MergedAccountData[]} />}
              {['cafe', 'blog', 'instagram'].includes(tab) && (
                <ReviewList tab={tab} data={paginatedData as ReviewData[]} />
              )}
              
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

function JoinList({ data, approveUser, deleteUser }: { 
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
                <div><strong>추천인 코드:</strong> {user.referralCode}</div>
              </div>
              <div className="text-xs text-gray-400 mt-2">신청일: {new Date(user.createdAt).toLocaleString()}</div>
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
}

function AccountList({ data }: { data: MergedAccountData[] }) {
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
}

function ReviewList({ tab, data }: { tab: string, data: ReviewData[] }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">{tab.toUpperCase()} 후기 ({data.length}건)</h2>
      {data.length === 0 ? <p className="text-gray-500">신청 내역이 없습니다.</p> : (
        <ul className="space-y-4">
          {data.map((item: any, i: number) => (
            <li key={i} className="bg-white dark:bg-gray-900 border rounded-lg p-4 text-sm">
              <div><strong>이름:</strong> {item.name}</div>
              <div><strong>연락처:</strong> {item.phone}</div>
              <div><strong>계좌번호:</strong> {item.accountNumber}</div>
              <div><strong>링크:</strong> <a href={item.reviewLink} target="_blank" className="text-blue-600 underline">{item.reviewLink}</a></div>
              <div className="text-xs text-gray-400 mt-1">신청일: {new Date(item.createdAt).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
