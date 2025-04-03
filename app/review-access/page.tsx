'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';

export default function ReviewAccess() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [bank, setBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({
    name: '',
    phone: '',
    email: '',
    bank: '',
    accountNumber: '',
    accountHolder: ''
  });

  const handlePrev = () => {
    router.push('/');
  };

  const validateForm = () => {
    const newErrors = {
      name: '',
      phone: '',
      email: '',
      bank: '',
      accountNumber: '',
      accountHolder: ''
    };

    if (!name) newErrors.name = '이름을 입력해주세요';
    if (!phone) newErrors.phone = '전화번호를 입력해주세요';
    if (!email) newErrors.email = '이메일을 입력해주세요';
    if (!bank) newErrors.bank = '은행을 선택해주세요';
    if (!accountNumber) newErrors.accountNumber = '계좌번호를 입력해주세요';
    if (!accountHolder) newErrors.accountHolder = '예금주를 입력해주세요';

    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error !== '');
  };

  // 전화번호 하이픈 자동 추가 함수
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/[^\d]/g, '');
    if (numbers.length <= 3) {
      return numbers;
    } else if (numbers.length <= 7) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    } else {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      if (!db) {
        toast.error('데이터베이스 연결에 실패했습니다.');
        return;
      }

      // 가입 승인 여부 확인
      const joinRef = collection(db, 'joinUsers');
      const joinQuery = query(
        joinRef,
        where('name', '==', name),
        where('phone', '==', phone),
        where('approved', '==', true)
      );
      
      const joinSnapshot = await getDocs(joinQuery);
      
      if (joinSnapshot.empty) {
        toast.error('가입 승인된 회원을 찾을 수 없습니다.');
        return;
      }

      // 계좌 정보 저장
      const accountData = {
        userId: joinSnapshot.docs[0].id,
        name,
        phone,
        email,
        bank,
        accountNumber,
        accountHolder,
        createdAt: new Date().toISOString()
      };

      // 계좌 정보가 이미 존재하는지 확인
      const accountRef = collection(db, 'accounts');
      const accountQuery = query(accountRef, where('userId', '==', joinSnapshot.docs[0].id));
      const accountSnapshot = await getDocs(accountQuery);

      if (accountSnapshot.empty) {
        // 계좌 정보가 없으면 새로 생성
        await addDoc(accountRef, accountData);
      } else {
        // 계좌 정보가 있으면 업데이트
        const accountDoc = accountSnapshot.docs[0];
        await updateDoc(doc(db, 'accounts', accountDoc.id), accountData);
      }
      
      // 세션에 사용자 정보 저장
      sessionStorage.setItem('reviewUser', JSON.stringify({
        name,
        phone,
        email,
        userId: joinSnapshot.docs[0].id
      }));
      
      toast.success('확인되었습니다.');
      router.push('/review/complete');
    } catch (error) {
      console.error('확인 중 오류 발생:', error);
      toast.error('확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 md:p-8"
        >
          {/* 진행 과정 표시바 */}
          <div className="flex justify-center mb-8 space-x-2 text-sm text-gray-500 dark:text-gray-300">
            <div className="text-blue-600 font-bold flex items-center">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white inline-flex items-center justify-center mr-1 text-xs">1</span>
              정보입력
            </div>
            <span className="text-gray-300 dark:text-gray-600">›</span>
            <div className="text-gray-400 flex items-center">
              <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 inline-flex items-center justify-center mr-1 text-xs">2</span>
              리뷰 선택
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-white">
            계좌 정보 입력
          </h2>

          <div className="bg-blue-50 dark:bg-blue-900/30 text-sm text-blue-600 dark:text-blue-300 p-4 rounded-lg mb-6 border border-blue-100 dark:border-blue-800 flex items-start">
            <svg className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path>
            </svg>
            <span>승인된 가입자의 정보와 계좌 정보를 입력해주세요.<br />입력하신 정보는 안전하게 보호됩니다.</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 기본 정보 */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">기본 정보</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200">이름</label>
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">필수</span>
                  </div>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className={`w-full border rounded-lg p-3 bg-white dark:bg-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                      errors.name ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                    }`}
                    placeholder="홍길동"
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-200">연락처</label>
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">필수</span>
                  </div>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={phone}
                    onChange={(e) => {
                      const formattedNumber = formatPhoneNumber(e.target.value);
                      setPhone(formattedNumber);
                    }}
                    required
                    maxLength={13}
                    placeholder="010-0000-0000"
                    className={`w-full border rounded-lg p-3 bg-white dark:bg-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                      errors.phone ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                    }`}
                  />
                  {errors.phone && <p className="mt-1 text-sm text-red-500">{errors.phone}</p>}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200">이메일</label>
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">필수</span>
                  </div>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={`w-full border rounded-lg p-3 bg-white dark:bg-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                      errors.email ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                    }`}
                    placeholder="example@email.com"
                  />
                  {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
                </div>
              </div>
            </div>

            {/* 계좌 정보 */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">계좌 정보</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="bank" className="block text-sm font-medium text-gray-700 dark:text-gray-200">은행</label>
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">필수</span>
                  </div>
                  <select
                    id="bank"
                    name="bank"
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                    required
                    className={`w-full border rounded-lg p-3 bg-white dark:bg-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                      errors.bank ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <option value="">선택해주세요</option>
                    <option value="KB">국민은행</option>
                    <option value="SHINHAN">신한은행</option>
                    <option value="WOORI">우리은행</option>
                    <option value="HANA">하나은행</option>
                    <option value="NH">농협은행</option>
                    <option value="IBK">기업은행</option>
                    <option value="SC">SC제일은행</option>
                    <option value="CITI">시티은행</option>
                  </select>
                  {errors.bank && <p className="mt-1 text-sm text-red-500">{errors.bank}</p>}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-200">계좌번호</label>
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">필수</span>
                  </div>
                  <input
                    type="text"
                    id="accountNumber"
                    name="accountNumber"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    required
                    className={`w-full border rounded-lg p-3 bg-white dark:bg-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                      errors.accountNumber ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                    }`}
                    placeholder="계좌번호를 입력해주세요"
                  />
                  {errors.accountNumber && <p className="mt-1 text-sm text-red-500">{errors.accountNumber}</p>}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="accountHolder" className="block text-sm font-medium text-gray-700 dark:text-gray-200">예금주</label>
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">필수</span>
                  </div>
                  <input
                    type="text"
                    id="accountHolder"
                    name="accountHolder"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    required
                    className={`w-full border rounded-lg p-3 bg-white dark:bg-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                      errors.accountHolder ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                    }`}
                    placeholder="예금주명을 입력해주세요"
                  />
                  {errors.accountHolder && <p className="mt-1 text-sm text-red-500">{errors.accountHolder}</p>}
                </div>
              </div>
            </div>

            {/* 버튼 영역 */}
            <div className="flex flex-col sm:flex-row justify-between gap-3 pt-6 mt-6 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={handlePrev}
                className="sm:w-1/2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium py-3.5 px-6 rounded-lg transition-colors"
              >
                이전 단계
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="sm:w-1/2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3.5 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors flex justify-center items-center"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    저장 중...
                  </>
                ) : (
                  '다음 단계'
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
