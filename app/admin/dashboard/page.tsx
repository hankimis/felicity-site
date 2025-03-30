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
  paymentStatus: 'completed' | 'pending';
  paymentCompletedAt?: string;
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
    if (!db) return;

    console.log('실시간 데이터 구독 설정...');
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
            paymentStatus: data.paymentStatus || 'pending',
            paymentCompletedAt: data.paymentCompletedAt || undefined
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
  }, []);

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
          paymentStatus: data.paymentStatus || 'pending',
          paymentCompletedAt: data.paymentCompletedAt || undefined
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
  const handlePaymentComplete = async (accountId: string) => {
    if (!db) {
      toast.error('데이터베이스 연결에 실패했습니다.');
      return;
    }

    try {
      const accountRef = doc(db, 'accounts', accountId);
      await updateDoc(accountRef, {
        paymentStatus: 'completed',
        paymentCompletedAt: new Date().toISOString()
      });

      // 상태 업데이트
      setAccounts(prevAccounts => 
        prevAccounts.map(account => 
          account.id === accountId 
            ? { 
                ...account, 
                paymentStatus: 'completed',
                paymentCompletedAt: new Date().toISOString()
              } 
            : account
        )
      );

      toast.success('입금 완료 처리되었습니다.');
    } catch (error) {
      console.error('입금 완료 처리 중 오류:', error);
      toast.error('입금 완료 처리 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">관리자 대시보드</h1>
                <a
                  href="/"
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  홈으로
                </a>
              </div>
              <button 
                onClick={handleLogout}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                로그아웃
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 py-8">
          {/* 탭 메뉴 */}
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg mb-8 max-w-md">
            <button
              onClick={() => setActiveTab('applications')}
              className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-md ${
                activeTab === 'applications'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              가입 신청 ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('accounts')}
              className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-md ${
                activeTab === 'accounts'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              계좌 정보 ({accounts.length})
            </button>
          </div>

          {/* 필터 영역 */}
          <div className="mb-8 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-5">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">필터</h2>
              <div className="flex flex-wrap gap-6">
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
                <div
                  key={user.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-blue-500 dark:hover:border-blue-500 transition-colors duration-200"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {user.name}
                          </h3>
                          <span
                            className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                              user.approved
                                ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}
                          >
                            {user.approved ? '승인됨' : '대기중'}
                          </span>
                </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          신청일: {formatDate(user.createdAt)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {!user.approved && (
                    <button
                            onClick={() => handleApprove(user.id)}
                            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                            title="승인"
                    >
                            <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                            승인하기
                    </button>
                        )}
                    <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="inline-flex items-center p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30"
                          title="삭제"
                    >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-20 text-sm font-medium text-gray-500 dark:text-gray-400">연락처</span>
                          <span className="text-sm text-gray-900 dark:text-white">{user.phone}</span>
              </div>
                        <div className="flex items-center gap-2">
                          <span className="w-20 text-sm font-medium text-gray-500 dark:text-gray-400">이메일</span>
                          <span className="text-sm text-gray-900 dark:text-white">{user.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-20 text-sm font-medium text-gray-500 dark:text-gray-400">생년월일</span>
                          <span className="text-sm text-gray-900 dark:text-white">{user.birthDate}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-20 text-sm font-medium text-gray-500 dark:text-gray-400">성별</span>
                          <span className="text-sm text-gray-900 dark:text-white">{user.gender}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-24 text-sm font-medium text-gray-500 dark:text-gray-400">유입경로</span>
                          <span className="text-sm text-gray-900 dark:text-white">{user.trafficSource}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-24 text-sm font-medium text-gray-500 dark:text-gray-400">통화가능시간</span>
                          <span className="text-sm text-gray-900 dark:text-white">{user.callTime}</span>
                        </div>
                        {user.referralCode && (
                          <div className="flex items-center gap-2">
                            <span className="w-24 text-sm font-medium text-gray-500 dark:text-gray-400">추천인 코드</span>
                            <span className="text-sm text-gray-900 dark:text-white">{user.referralCode}</span>
            </div>
          )}
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
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{user.name}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {user.phone} | {user.email}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-8">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">계좌 정보</h4>
                          <div className="space-y-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-16 text-sm font-medium text-gray-500 dark:text-gray-400">은행</span>
                                <span className="text-sm text-gray-900 dark:text-white">{account.bankName}</span>
                              </div>
                              {account.paymentStatus === 'completed' ? (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                  <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  입금완료
                                </span>
                              ) : (
                    <button
                                  onClick={() => handlePaymentComplete(account.id)}
                                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                                >
                                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  입금완료 처리
                    </button>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-16 text-sm font-medium text-gray-500 dark:text-gray-400">계좌번호</span>
                              <span className="text-sm text-gray-900 dark:text-white">{account.accountNumber}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-16 text-sm font-medium text-gray-500 dark:text-gray-400">예금주</span>
                              <span className="text-sm text-gray-900 dark:text-white">{account.accountHolder}</span>
                            </div>
                            {account.paymentStatus === 'completed' && account.paymentCompletedAt && (
                              <div className="flex items-center gap-2">
                                <span className="w-16 text-sm font-medium text-gray-500 dark:text-gray-400">입금일시</span>
                                <span className="text-sm text-gray-900 dark:text-white">
                                  {new Date(account.paymentCompletedAt).toLocaleString('ko-KR', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                </div>
          )}
        </div>
    </div>
    <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">리뷰 상태</h4>
                          <div className="space-y-3">
                            {Object.entries(account.reviewStatus).map(([type, status]) => (
                              <div key={type} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {type === 'cafe' ? '카페' : type === 'blog' ? '블로그' : '인스타그램'}
                                  </span>
                                  {account.reviewLinks[type as keyof typeof account.reviewLinks] ? (
                                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-full dark:bg-blue-900/30 dark:text-blue-400">
                                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                      </svg>
                                      링크첨부
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-full dark:bg-gray-800 dark:text-gray-400">
                                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                      </svg>
                                      미첨부
                                    </span>
                                  )}
              </div>
                                <div className="flex items-center gap-3">
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
                                  {account.reviewLinks[type as keyof typeof account.reviewLinks] && (
                                    <a
                                      href={account.reviewLinks[type as keyof typeof account.reviewLinks]}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center px-2 py-1 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30"
                                    >
                                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                      링크보기
                                    </a>
                                  )}
                                  {status === 'pending' && (
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleReviewApprove(account.id, type as keyof typeof account.reviewStatus)}
                                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:hover:bg-green-500 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200"
                                        title="승인"
                                        disabled={!account.reviewLinks[type as keyof typeof account.reviewLinks]}
                                      >
                                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        승인
                                      </button>
                                      <button
                                        onClick={() => handleReviewReject(account.id, type as keyof typeof account.reviewStatus)}
                                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:hover:bg-red-500 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                                        title="거절"
                                      >
                                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                        거절
                                      </button>
    </div>
                                  )}
              </div>
                              </div>
                            ))}
                          </div>
                        </div>
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
