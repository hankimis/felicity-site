'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  db, 
  initializeFirebase,
  enableFirestoreNetwork 
} from '../../lib/firebase';
import { collection, getDocs, query, orderBy, Firestore, onSnapshot, doc, updateDoc, deleteDoc, where, Timestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import Cookies from 'js-cookie';
import Link from 'next/link';

interface UserData {
  id: string;
  name: string;
  phone: string;
  email: string;
  birthDate: string;
  gender: string;
  trafficSource: string;
  callTime: string;
  referralCode?: string;
  approved: boolean;
  createdAt: Timestamp | { seconds: number; nanoseconds: number } | null;
  phoneCarrier: string;
}

interface AccountData {
  id: string;
  userId: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  reviewStatus: {
    cafe: 'approved' | 'pending' | 'rejected';
    blog: 'approved' | 'pending' | 'rejected';
    insta: 'approved' | 'pending' | 'rejected';
  };
  reviewLinks: {
    cafe: string;
    blog: string;
    insta: string;
  };
  paymentStatus: {
    account: 'completed' | 'pending';
    cafe: 'completed' | 'pending';
    blog: 'completed' | 'pending';
    insta: 'completed' | 'pending';
  };
  paymentCompletedAt: {
    account: string | null;
    cafe: string | null;
    blog: string | null;
    insta: string | null;
  };
}

interface DateFilter {
  startDate: Date | null;
  endDate: Date | null;
}

export default function Dashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('applications');
  const [users, setUsers] = useState<UserData[]>([]);
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>({
    startDate: null,
    endDate: null
  });
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending'>('all');

  // 날짜 변환 함수
  const convertToDate = (timestamp: Timestamp | { seconds: number; nanoseconds: number } | string | null): Date | null => {
    if (!timestamp) return null;
    try {
      if (timestamp instanceof Timestamp) {
        return timestamp.toDate();
      }
      if (typeof timestamp === 'object' && 'seconds' in timestamp) {
        return new Date(timestamp.seconds * 1000);
      }
      return new Date(timestamp);
    } catch (error) {
      console.error('날짜 변환 오류:', error);
      return null;
    }
  };

  // 날짜 포맷 함수
  const formatDate = (timestamp: Timestamp | { seconds: number; nanoseconds: number } | string | null) => {
    if (!timestamp) return '-';
    try {
      const date = convertToDate(timestamp);
      if (!date) return '-';
      
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      return date.toLocaleDateString('ko-KR', options);
    } catch (error) {
      console.error('날짜 변환 오류:', error);
      return '-';
    }
  };

  // Firebase 실시간 구독 설정
  useEffect(() => {
    const initializeFirebaseAndLoadData = async () => {
      try {
        if (!db) {
          console.error('데이터베이스가 초기화되지 않았습니다.');
      return;
    }
    
        // Firebase 네트워크 연결 활성화
        await enableFirestoreNetwork();
        console.log('Firebase 네트워크 연결이 활성화되었습니다.');
  
      setIsLoading(true);
        const firestore = db as Firestore;

        // 가입 신청자 구독
        const unsubscribeUsers = onSnapshot(
          query(collection(firestore, 'joinUsers'), orderBy('createdAt', 'desc')),
          (snapshot) => {
            const userData = snapshot.docs.map(doc => {
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
                createdAt: data.createdAt || null,
                    approved: data.approved || false,
                phoneCarrier: data.phoneCarrier || ''
                  } as UserData;
                });
            setUsers(userData);
            console.log(`${userData.length}건의 가입 신청 데이터 업데이트`);
          },
          (error) => {
            console.error('가입 신청 데이터 구독 오류:', error);
            toast.error('가입 신청 데이터 로드 실패');
          }
        );

        // 계좌 정보 및 리뷰 상태 구독
        const unsubscribeAccounts = onSnapshot(
          query(collection(firestore, 'accounts'), orderBy('createdAt', 'desc')),
          async (snapshot) => {
            const accountsData = snapshot.docs.map(doc => {
                  const data = doc.data();
                  return {
                id: doc.id,
                userId: data.userId || '',
                bankName: data.bank || '',
                    accountNumber: data.accountNumber || '',
                accountHolder: data.accountHolder || '',
                reviewStatus: {
                  cafe: data.reviewStatus?.cafe || 'pending',
                  blog: data.reviewStatus?.blog || 'pending',
                  insta: data.reviewStatus?.insta || 'pending'
                },
                reviewLinks: {
                  cafe: data.reviewLinks?.cafe || '',
                  blog: data.reviewLinks?.blog || '',
                  insta: data.reviewLinks?.insta || ''
                },
                paymentStatus: {
                  account: data.paymentStatus || 'pending',
                  cafe: data.paymentStatus?.cafe || 'pending',
                  blog: data.paymentStatus?.blog || 'pending',
                  insta: data.paymentStatus?.insta || 'pending'
                },
                paymentCompletedAt: {
                  account: data.paymentCompletedAt || null,
                  cafe: data.paymentCompletedAt?.cafe || null,
                  blog: data.paymentCompletedAt?.blog || null,
                  insta: data.paymentCompletedAt?.insta || null
                }
                  } as AccountData;
                });
            setAccounts(accountsData);
            console.log(`${accountsData.length}건의 계좌 정보 데이터 업데이트`);
          },
          (error) => {
            console.error('계좌 정보 데이터 구독 오류:', error);
            toast.error('계좌 정보 데이터 로드 실패');
          }
        );

        setIsLoading(false);
        
        return () => {
          unsubscribeUsers();
          unsubscribeAccounts();
        };
      } catch (error) {
        console.error('Firebase 초기화 오류:', error);
        setError('데이터베이스 연결에 실패했습니다.');
        setIsLoading(false);
      }
    };

    initializeFirebaseAndLoadData();
  }, []);

  // 로딩 상태 표시
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 에러 상태 표시
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-gray-600 dark:text-gray-300">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // 사용자 승인 처리
  const handleApprove = async (userId: string) => {
    if (!db) {
      toast.error('데이터베이스 연결 오류');
      return;
    }
    
    try {
      const userRef = doc(db, 'joinUsers', userId);
      await updateDoc(userRef, {
        approved: true,
        updatedAt: new Date().toISOString()
      });
      toast.success('사용자가 승인되었습니다');
    } catch (error) {
      console.error('승인 처리 오류:', error);
      toast.error('승인 처리 중 오류가 발생했습니다');
    }
  };

  // 리뷰 승인 처리
  const handleReviewApprove = async (accountId: string, reviewType: 'cafe' | 'blog' | 'insta') => {
      if (!db) {
      toast.error('데이터베이스 연결 오류');
        return;
      }

    try {
      const accountRef = doc(db, 'accounts', accountId);
      await updateDoc(accountRef, {
        [`reviewStatus.${reviewType}`]: 'approved',
        updatedAt: new Date().toISOString()
      });
      toast.success(`${reviewType} 리뷰가 승인되었습니다`);
    } catch (error) {
      console.error('리뷰 승인 처리 오류:', error);
      toast.error('승인 처리 중 오류가 발생했습니다');
    }
  };

  // 리뷰 거절 처리
  const handleReviewReject = async (accountId: string, reviewType: 'cafe' | 'blog' | 'insta') => {
    if (!db) {
      toast.error('데이터베이스 연결 오류');
      return;
    }

    try {
      const accountRef = doc(db, 'accounts', accountId);
      await updateDoc(accountRef, {
        [`reviewStatus.${reviewType}`]: 'rejected',
        updatedAt: new Date().toISOString()
      });
      toast.success(`${reviewType} 리뷰가 거절되었습니다`);
    } catch (error) {
      console.error('리뷰 거절 처리 오류:', error);
      toast.error('거절 처리 중 오류가 발생했습니다');
    }
  };

  // 로그아웃 처리
  const handleLogout = () => {
    Cookies.remove('adminAuth');
    Cookies.remove('adminEmail');
      router.replace('/admin/login');
  };

  // 데이터 로드 함수
  const loadData = async () => {
      if (!db) {
      setError('데이터베이스 연결에 실패했습니다.');
        return;
      }
    
    try {
      setIsLoading(true);
      setError(null);

      // 가입 신청자 데이터 로드
      const usersRef = collection(db as Firestore, 'joinUsers');
      const usersSnapshot = await getDocs(usersRef);
      const usersData = usersSnapshot.docs.map(doc => ({
                id: doc.id,
        ...doc.data()
      })) as UserData[];
      setUsers(usersData);

      // 계좌 정보 데이터 로드
      const accountsRef = collection(db as Firestore, 'accounts');
      const accountsSnapshot = await getDocs(accountsRef);
      const accountsData = accountsSnapshot.docs.map(doc => {
                  const data = doc.data();
                  return {
                    id: doc.id,
          userId: data.userId,
          bankName: data.bankName,
          accountNumber: data.accountNumber,
          accountHolder: data.accountHolder,
          reviewStatus: {
            cafe: data.reviewStatus?.cafe || 'pending',
            blog: data.reviewStatus?.blog || 'pending',
            insta: data.reviewStatus?.insta || 'pending'
          },
          reviewLinks: {
            cafe: data.reviewLinks?.cafe || '',
            blog: data.reviewLinks?.blog || '',
            insta: data.reviewLinks?.insta || ''
          },
          paymentStatus: {
            account: data.paymentStatus || 'pending',
            cafe: data.paymentStatus?.cafe || 'pending',
            blog: data.paymentStatus?.blog || 'pending',
            insta: data.paymentStatus?.insta || 'pending'
          },
          paymentCompletedAt: {
            account: data.paymentCompletedAt || null,
            cafe: data.paymentCompletedAt?.cafe || null,
            blog: data.paymentCompletedAt?.blog || null,
            insta: data.paymentCompletedAt?.insta || null
          }
                  } as AccountData;
                });
      setAccounts(accountsData);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
        } finally {
          setIsLoading(false);
        }
  };

  // 날짜 필터링 함수
  const filterByDate = (items: UserData[], filterType: string): UserData[] => {
    return items.filter(item => {
      if (!item.createdAt) return true;

      const itemDate = convertToDate(item.createdAt);
      if (!itemDate) return true;

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      switch (filterType) {
        case 'today':
          const today = new Date(now);
          return itemDate >= today;
        case 'week':
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return itemDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(now);
          monthAgo.setDate(monthAgo.getDate() - 30);
          return itemDate >= monthAgo;
        case 'custom':
          if (!dateFilter.startDate) return true;
          const start = new Date(dateFilter.startDate);
          start.setHours(0, 0, 0, 0);
          const end = dateFilter.endDate ? new Date(dateFilter.endDate) : new Date();
          end.setHours(23, 59, 59, 999);
          return itemDate >= start && itemDate <= end;
        default:
          return true;
      }
    });
  };

  // 계정 날짜 필터링 함수
  const filterAccountsByDate = (items: AccountData[], filterType: string): AccountData[] => {
    return items.filter(item => {
      const user = users.find(u => u.id === item.userId);
      if (!user?.createdAt) return true;

      const itemDate = convertToDate(user.createdAt);
      if (!itemDate) return true;

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      switch (filterType) {
        case 'today':
          const today = new Date(now);
          return itemDate >= today;
        case 'week':
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return itemDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(now);
          monthAgo.setDate(monthAgo.getDate() - 30);
          return itemDate >= monthAgo;
        case 'custom':
          if (!dateFilter.startDate) return true;
          const start = new Date(dateFilter.startDate);
          start.setHours(0, 0, 0, 0);
          const end = dateFilter.endDate ? new Date(dateFilter.endDate) : new Date();
          end.setHours(23, 59, 59, 999);
          return itemDate >= start && itemDate <= end;
        default:
          return true;
      }
    });
  };

  // 상태 필터링 함수
  const filterByStatus = (data: UserData[]): UserData[] => {
    if (statusFilter === 'all') return data;
    return data.filter(user => 
      statusFilter === 'approved' ? user.approved : !user.approved
    );
  };

  // 사용자 삭제 함수
  const handleDeleteUser = async (userId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      if (!db) {
        toast.error('데이터베이스 연결에 실패했습니다.');
        return;
      }
      
      // joinUsers 컬렉션에서 삭제
      const userRef = doc(db as Firestore, 'joinUsers', userId);
      await deleteDoc(userRef);

      // accounts 컬렉션에서 관련 데이터 삭제
      const accountRef = collection(db as Firestore, 'accounts');
      const accountQuery = query(accountRef, where('userId', '==', userId));
      const accountSnapshot = await getDocs(accountQuery);
      
      if (!accountSnapshot.empty) {
        await deleteDoc(doc(db as Firestore, 'accounts', accountSnapshot.docs[0].id));
      }

      // 리뷰 데이터 삭제
      const reviewTypes = ['cafeReviews', 'blogReviews', 'instagramReviews'];
      for (const type of reviewTypes) {
        const reviewRef = collection(db as Firestore, type);
        const reviewQuery = query(reviewRef, where('userId', '==', userId));
        const reviewSnapshot = await getDocs(reviewQuery);
        
        reviewSnapshot.docs.forEach(async (doc) => {
          await deleteDoc(doc.ref);
        });
      }

      toast.success('사용자가 삭제되었습니다.');
      loadData(); // 데이터 새로고침
    } catch (error) {
      console.error('삭제 중 오류 발생:', error);
      toast.error('삭제 중 오류가 발생했습니다.');
    }
  };

  // 입금 완료 처리 함수
  const handlePaymentComplete = async (accountId: string, type: 'account' | 'cafe' | 'blog' | 'insta') => {
    if (!db) {
      toast.error('데이터베이스 연결에 실패했습니다.');
      return;
    }

    try {
      const accountRef = doc(db, 'accounts', accountId);
      const account = accounts.find(a => a.id === accountId);
      
      // 리뷰 타입인 경우 승인 상태 확인
      if (type !== 'account') {
        const reviewStatus = account?.reviewStatus[type];
        if (reviewStatus !== 'approved') {
          toast.error('리뷰가 승인된 후에만 입금 처리가 가능합니다.');
          return;
        }
      }
      
      const newStatus = account?.paymentStatus[type] === 'completed' ? 'pending' : 'completed';
      
      await updateDoc(accountRef, {
        [`paymentStatus.${type}`]: newStatus,
        [`paymentCompletedAt.${type}`]: newStatus === 'completed' ? new Date().toISOString() : null
      });

      // 상태 업데이트
      setAccounts(prevAccounts => 
        prevAccounts.map(acc => 
          acc.id === accountId 
            ? { 
                ...acc,
                paymentStatus: {
                  ...acc.paymentStatus,
                  [type]: newStatus
                },
                paymentCompletedAt: {
                  ...acc.paymentCompletedAt,
                  [type]: newStatus === 'completed' ? new Date().toISOString() : null
                }
              } as AccountData
            : acc
        )
      );

      toast.success(newStatus === 'completed' ? '입금 완료 처리되었습니다.' : '입금 완료가 취소되었습니다.');
    } catch (error) {
      console.error('입금 상태 변경 중 오류:', error);
      toast.error('입금 상태 변경 중 오류가 발생했습니다.');
    }
  };

  // 계좌 정보 섹션의 입금완료 버튼 렌더링
  const renderPaymentButton = (account: AccountData | undefined, type: 'account' | 'cafe' | 'blog' | 'insta') => {
    if (!account) return null;

    // 리뷰 타입인 경우 승인 상태 확인
    if (type !== 'account' && account.reviewStatus[type] !== 'approved') {
      return null;
    }

    return account.paymentStatus[type] === 'completed' ? (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        입금완료
      </span>
    ) : (
      <button
        onClick={() => handlePaymentComplete(account.id, type)}
        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
      >
        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        입금완료
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">관리자 대시보드</h1>
              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
                >
                  <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  홈으로
                </Link>
                <Link
                  href="/admin/login"
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
                >
                  <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  로그아웃
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* 탭 메뉴 */}
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg mb-6 sm:mb-8 max-w-full sm:max-w-md overflow-x-auto">
            <button
              onClick={() => setActiveTab('applications')}
              className={`flex-1 px-3 sm:px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap ${
                activeTab === 'applications'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              가입 신청 ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('accounts')}
              className={`flex-1 px-3 sm:px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap ${
                activeTab === 'accounts'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              계좌 정보 ({accounts.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`flex-1 px-3 sm:px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap ${
                activeTab === 'completed'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              입금완료 목록
            </button>
          </div>

          {/* 필터 영역 */}
          <div className="mb-6 sm:mb-8 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-4">필터</h2>
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">조회 기간</label>
                  <select
                    value={dateFilter.startDate ? 'custom' : 'all'}
                    onChange={(e) => {
                      const now = new Date();
                      now.setHours(0, 0, 0, 0);
                      
                      switch (e.target.value) {
                        case 'today':
                          setDateFilter({
                            startDate: now,
                            endDate: new Date(now.getTime() + 24 * 60 * 60 * 1000 - 1)
                          });
                          break;
                        case 'week':
                          const weekAgo = new Date(now);
                          weekAgo.setDate(weekAgo.getDate() - 7);
                          setDateFilter({ startDate: weekAgo, endDate: now });
                          break;
                        case 'month':
                          const monthAgo = new Date(now);
                          monthAgo.setDate(monthAgo.getDate() - 30);
                          setDateFilter({ startDate: monthAgo, endDate: now });
                          break;
                        case 'custom':
                          setDateFilter({ startDate: now, endDate: now });
                          break;
                        default:
                          setDateFilter({ startDate: null, endDate: null });
                      }
                    }}
                    className="min-w-[140px] rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="all">전체 기간</option>
                    <option value="today">오늘</option>
                    <option value="week">최근 7일</option>
                    <option value="month">최근 30일</option>
                    <option value="custom">기간 지정</option>
                  </select>
                </div>

                {dateFilter.startDate && (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">기간 설정</label>
                    <div className="flex items-center gap-2">
              <input
                type="date"
                        value={dateFilter.startDate ? dateFilter.startDate.toISOString().split('T')[0] : ''}
                        onChange={(e) => {
                          const date = e.target.value ? new Date(e.target.value) : null;
                          if (date) {
                            date.setHours(0, 0, 0, 0);
                            setDateFilter({ ...dateFilter, startDate: date });
                          }
                        }}
                        className="rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-gray-500">~</span>
              <input
                type="date"
                        value={dateFilter.endDate ? dateFilter.endDate.toISOString().split('T')[0] : ''}
                        onChange={(e) => {
                          const date = e.target.value ? new Date(e.target.value) : null;
                          if (date) {
                            date.setHours(23, 59, 59, 999);
                            setDateFilter({ ...dateFilter, endDate: date });
                          }
                        }}
                        min={dateFilter.startDate ? dateFilter.startDate.toISOString().split('T')[0] : ''}
                        className="rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
                )}

                {activeTab === 'applications' && (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">승인 상태</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as 'all' | 'approved' | 'pending')}
                      className="min-w-[140px] rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="all">전체</option>
                      <option value="pending">대기중</option>
                      <option value="approved">승인됨</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 가입 신청 목록 */}
          {activeTab === 'applications' && (
            <div className="space-y-4">
              {filterByStatus(filterByDate(users, dateFilter.startDate ? 'custom' : 'all')).map((user) => (
                <div key={user.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-blue-500 dark:hover:border-blue-500 transition-colors duration-200">
                  <div className="p-6">
                    <div className="flex flex-col lg:flex-row justify-between gap-4 lg:gap-6">
                      {/* 사용자 정보 */}
                      <div className="w-full">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{user.name}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 break-all">
                              {user.phone} | {user.email}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {!user.approved ? (
                              <button
                                onClick={() => handleApprove(user.id)}
                                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm"
                              >
                                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                승인
                              </button>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                승인됨
                              </span>
                            )}
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm"
                            >
                              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              삭제
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-2 min-w-[100px] text-sm font-medium text-gray-500 dark:text-gray-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                연락처
                              </span>
                              <span className="text-sm text-gray-900 dark:text-white">{user.phone}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-2 min-w-[100px] text-sm font-medium text-gray-500 dark:text-gray-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                                </svg>
                                이메일
                              </span>
                              <span className="text-sm text-gray-900 dark:text-white">{user.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-2 min-w-[100px] text-sm font-medium text-gray-500 dark:text-gray-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                생년월일
                              </span>
                              <span className="text-sm text-gray-900 dark:text-white">{user.birthDate}</span>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-2 min-w-[100px] text-sm font-medium text-gray-500 dark:text-gray-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                성별
                              </span>
                              <span className="text-sm text-gray-900 dark:text-white">{user.gender}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-2 min-w-[100px] text-sm font-medium text-gray-500 dark:text-gray-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                </svg>
                                유입경로
                              </span>
                              <span className="text-sm text-gray-900 dark:text-white">{user.trafficSource}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-2 min-w-[100px] text-sm font-medium text-gray-500 dark:text-gray-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                통화가능시간
                              </span>
                              <span className="text-sm text-gray-900 dark:text-white">{user.callTime}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-2 min-w-[100px] text-sm font-medium text-gray-500 dark:text-gray-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                신청일시
                              </span>
                              <span className="text-sm text-gray-900 dark:text-white">{formatDate(user.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 계좌 정보 목록 */}
          {activeTab === 'accounts' && (
            <div className="space-y-4">
              {filterAccountsByDate(accounts, dateFilter.startDate ? 'custom' : 'all').map((account) => {
                const user = users.find(u => u.id === account.userId);
                if (!user) return null;

                return (
                  <div
                    key={account.id}
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-blue-500 dark:hover:border-blue-500 transition-colors duration-200"
                  >
                    <div className="p-6">
                      <div className="flex flex-col lg:flex-row justify-between gap-4 lg:gap-6">
                        {/* 사용자 정보 */}
                        <div className="w-full">
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{user.name}</h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400 break-all">
                                {user.phone} | {user.email}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-4">
                            {/* 계좌 정보 */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">계좌 정보</h4>
                              <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400 min-w-[60px]">은행</span>
                                    <span className="text-sm text-gray-900 dark:text-white">{account.bankName}</span>
                                  </div>
                                  {renderPaymentButton(account, 'account')}
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400 min-w-[60px]">계좌번호</span>
                                  <span className="text-sm text-gray-900 dark:text-white break-all">{account.accountNumber}</span>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400 min-w-[60px]">예금주</span>
                                  <span className="text-sm text-gray-900 dark:text-white">{account.accountHolder}</span>
                                </div>
                              </div>
                            </div>

                            {/* 리뷰 상태 */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">리뷰 상태</h4>
                              <div className="space-y-4">
                                {Object.entries(account.reviewStatus).map(([type, status]) => (
                                  <div key={type} className="flex flex-col gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                        <span className="text-sm font-medium text-gray-900 dark:text-white min-w-[80px]">
                                          {type === 'cafe' ? '카페' : type === 'blog' ? '블로그' : '인스타그램'}
                                        </span>
                                        {(() => {
                                          const account = accounts.find(a => a.userId === user.id);
                                          const reviewLink = account?.reviewLinks[type as keyof typeof account.reviewLinks];
                                          return reviewLink ? (
                                            <a
                                              href={reviewLink}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-blue-600 hover:text-blue-800 text-sm inline-flex items-center"
                                            >
                                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                              </svg>
                                              리뷰 링크
                                            </a>
                                          ) : (
                                            <span className="text-sm text-gray-500">링크 미첨부</span>
                                          );
                                        })()}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span
                                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                            status === 'approved'
                                              ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                              : status === 'rejected'
                                              ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                              : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                          }`}
                                        >
                                          {status === 'approved' ? '승인' : status === 'rejected' ? '거절' : '대기중'}
                                        </span>
                                        {status === 'pending' && (() => {
                                          const account = accounts.find(a => a.userId === user.id);
                                          if (!account) return null;
                                          return (
                                            <div className="flex gap-2 mt-2 sm:mt-0">
                                              <button
                                                onClick={() => handleReviewApprove(account.id, type as 'cafe' | 'blog' | 'insta')}
                                                className="inline-flex items-center px-2 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm"
                                                disabled={!account.reviewLinks[type as keyof typeof account.reviewLinks]}
                                              >
                                                승인
                                              </button>
                                              <button
                                                onClick={() => handleReviewReject(account.id, type as 'cafe' | 'blog' | 'insta')}
                                                className="inline-flex items-center px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm"
                                              >
                                                거절
                                              </button>
                                            </div>
                                          );
                                        })()}
                                        {status === 'approved' && (() => {
                                          const account = accounts.find(a => a.userId === user.id);
                                          return account ? renderPaymentButton(account, type as 'cafe' | 'blog' | 'insta') : null;
                                        })()}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 입금완료 목록 */}
          {activeTab === 'completed' && (
            <div className="space-y-4">
              {accounts
                .filter(account => 
                  account.paymentStatus.account === 'completed' ||
                  account.paymentStatus.cafe === 'completed' ||
                  account.paymentStatus.blog === 'completed' ||
                  account.paymentStatus.insta === 'completed'
                )
                .map((account) => {
                  const user = users.find(u => u.id === account.userId);
                  if (!user) return null;

                  return (
                    <div
                      key={account.id}
                      className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-blue-500 dark:hover:border-blue-500 transition-colors duration-200"
                    >
                      <div className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{user.name}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 break-all">
                              {user.phone} | {user.email}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          {/* 계좌 입금 상태 */}
                          {account.paymentStatus.account === 'completed' && (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                <span className="text-sm font-medium text-gray-900 dark:text-white min-w-[60px]">계좌</span>
                                <span className="text-sm text-gray-500 break-all">{account.bankName} {account.accountNumber}</span>
                              </div>
                              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                                <span className="text-sm text-gray-500 whitespace-nowrap">
                                  {formatDate(account.paymentCompletedAt.account)}
                                </span>
                                <button
                                  onClick={() => handlePaymentComplete(account.id, 'account')}
                                  className="w-full sm:w-auto inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm"
                                >
                                  입금취소
                                </button>
                              </div>
                            </div>
                          )}
                          
                          {/* 리뷰 입금 상태 */}
                          {['cafe', 'blog', 'insta'].map((type) => {
                            if (account.paymentStatus[type as keyof typeof account.paymentStatus] === 'completed') {
                              return (
                                <div key={type} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                    <span className="text-sm font-medium text-gray-900 dark:text-white min-w-[80px] whitespace-nowrap">
                                      {type === 'cafe' ? '카페' : type === 'blog' ? '블로그' : '인스타그램'} 리뷰
                                    </span>
                                    {(() => {
                                      const reviewLink = account.reviewLinks[type as keyof typeof account.reviewLinks];
                                      return reviewLink ? (
                                        <a
                                          href={reviewLink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-600 hover:text-blue-800 text-sm inline-flex items-center break-all"
                                        >
                                          <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                          </svg>
                                          <span className="break-all">{reviewLink}</span>
                                        </a>
                                      ) : (
                                        <span className="text-sm text-gray-500">링크 미첨부</span>
                                      );
                                    })()}
                                  </div>
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-3 sm:mt-0">
                                    <span className="text-sm text-gray-500 whitespace-nowrap">
                                      {formatDate(account.paymentCompletedAt[type as keyof typeof account.paymentCompletedAt])}
                                    </span>
                                    <button
                                      onClick={() => handlePaymentComplete(account.id, type as 'cafe' | 'blog' | 'insta')}
                                      className="w-full sm:w-auto inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm"
                                    >
                                      입금취소
                                    </button>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
