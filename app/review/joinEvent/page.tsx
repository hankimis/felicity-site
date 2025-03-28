'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../lib/firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { toast } from 'react-hot-toast';

interface ReviewUser {
  name: string;
  phone: string;
  userId: string;
}

export default function JoinEventPage() {
  const router = useRouter();
  const [user, setUser] = useState<ReviewUser | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [bank, setBank] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const banks = [
    '국민은행', '신한은행', '우리은행', '하나은행', '농협은행',
    'SC제일은행', '카카오뱅크', '토스뱅크', '케이뱅크'
  ];

  useEffect(() => {
    // 세션에서 사용자 정보 확인
    const userStr = sessionStorage.getItem('reviewUser');
    if (!userStr) {
      toast.error('먼저 본인 확인이 필요합니다.');
      router.replace('/review-access');
      return;
    }

    try {
      const userData = JSON.parse(userStr);
      setUser(userData);

      // 기존 계좌 정보 확인
      checkExistingAccount(userData);
    } catch (error) {
      console.error('사용자 정보 파싱 오류:', error);
      toast.error('사용자 정보가 올바르지 않습니다.');
      router.replace('/review-access');
    }
  }, [router]);

  const checkExistingAccount = async (userData: ReviewUser) => {
    if (!db) return;

    try {
      const accountRef = collection(db, 'paymentInfo');
      const q = query(accountRef, where('phone', '==', userData.phone));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const accountData = snapshot.docs[0].data();
        setAccountNumber(accountData.accountNumber || '');
        setBank(accountData.bank || '');
      }
    } catch (error) {
      console.error('계좌 정보 조회 오류:', error);
    }
  };

  const handleVerification = () => {
    // 본인인증 로직 구현 필요
    toast.success('본인인증이 완료되었습니다.');
    setIsVerified(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('사용자 정보가 없습니다.');
      return;
    }

    if (!isVerified) {
      toast.error('본인인증이 필요합니다.');
      return;
    }

    if (!termsAccepted) {
      toast.error('약관 동의가 필요합니다.');
      return;
    }

    if (!accountNumber || !bank) {
      toast.error('계좌 정보를 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      // 이벤트 신청 정보 저장
      const eventRef = collection(db, 'joinEventReviews');
      await addDoc(eventRef, {
        userId: user.userId,
        name: user.name,
        phone: user.phone,
        accountNumber,
        bank,
        verificationStatus: isVerified,
        termsAccepted,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      toast.success('이벤트 신청이 완료되었습니다.');
      router.push('/review/complete');
    } catch (error) {
      console.error('이벤트 신청 오류:', error);
      toast.error('이벤트 신청 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-extrabold text-gray-900">
            가입 이벤트 신청
          </h1>
          <p className="mt-2 text-gray-600">
            계좌 정보 확인 및 본인인증 후 신청이 가능합니다
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                은행 선택
              </label>
              <select
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                required
              >
                <option value="">은행을 선택하세요</option>
                {banks.map((bankName) => (
                  <option key={bankName} value={bankName}>
                    {bankName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                계좌번호
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="'-' 없이 입력해주세요"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
            </div>

            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
              <div>
                <h3 className="text-sm font-medium text-gray-900">본인인증</h3>
                <p className="text-sm text-gray-500">
                  계좌 실명 확인을 위해 필요합니다
                </p>
              </div>
              <button
                type="button"
                onClick={handleVerification}
                disabled={isVerified}
                className={`${
                  isVerified
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
              >
                {isVerified ? '인증완료' : '인증하기'}
              </button>
            </div>

            <div className="relative flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="terms"
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="terms" className="font-medium text-gray-700">
                  이벤트 약관 동의
                </label>
                <p className="text-gray-500">
                  이벤트 참여를 위한 필수 약관에 동의합니다.
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                이전으로
              </button>
              <button
                type="submit"
                disabled={isLoading || !isVerified || !termsAccepted}
                className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  isLoading || !isVerified || !termsAccepted
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                }`}
              >
                {isLoading ? '처리 중...' : '신청하기'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 