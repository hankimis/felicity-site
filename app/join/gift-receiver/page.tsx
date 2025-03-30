'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { Firestore } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

export default function GiftReceiver() {
  const router = useRouter();

  const [relation, setRelation] = useState<'본인'>('본인');
  const [bank, setBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [userDocId, setUserDocId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ✅ 세션 기반 접근 제한
  useEffect(() => {
    const step1 = sessionStorage.getItem('joinStep1');
    const phone = sessionStorage.getItem('joinPhone'); // 사용자의 연락처
    if (!step1 || !phone) {
      console.error('잘못된 접근: 필수 세션 정보 없음', { step1, phone });
      toast.error('잘못된 접근입니다.');
      router.replace('/');
      return;
    }

    // Firestore에서 phone 기준으로 joinUsers 문서 ID 가져오기
    const fetchUserDoc = async () => {
      if (!db) {
        console.error('Firestore 인스턴스가 없습니다.');
        toast.error('데이터베이스 연결 오류가 발생했습니다.');
        router.replace('/');
        return;
      }

      try {
        console.log('사용자 문서 조회 시도 - 연락처:', phone);
        const q = query(collection(db as Firestore, 'joinUsers'), where('phone', '==', phone));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const docId = snapshot.docs[0].id;
          console.log('사용자 문서 조회 성공:', docId);
          setUserDocId(docId);
          
          // 저장된 docId와 비교하여 추가 검증
          const savedDocId = sessionStorage.getItem('joinDocId');
          if (savedDocId && savedDocId !== docId) {
            console.warn('세션 docId와 조회된 docId 불일치:', { saved: savedDocId, fetched: docId });
          }
        } else {
          console.error('연락처에 해당하는 가입 정보를 찾을 수 없음:', phone);
          toast.error('가입 정보를 찾을 수 없습니다.');
          router.replace('/');
        }
      } catch (error) {
        console.error('사용자 문서 조회 중 오류 발생:', error);
        toast.error('데이터 조회 중 오류가 발생했습니다.');
        router.replace('/');
      }
    };

    fetchUserDoc();
  }, [router]);

  // 유효성 검사 함수
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!bank) {
      newErrors.bank = '은행을 선택해주세요';
    }
    
    if (!accountNumber) {
      newErrors.accountNumber = '계좌번호를 입력해주세요';
    } else if (!/^\d{10,14}$|^\d{3,5}-\d{2,6}-\d{3,6}$/.test(accountNumber.replace(/-/g, ''))) {
      // 대략적인 계좌번호 유효성 검사 (정확한 패턴은 은행마다 다를 수 있음)
      newErrors.accountNumber = '올바른 계좌번호 형식이 아닙니다';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('입력 정보를 확인해주세요.');
      return;
    }

    try {
      setLoading(true);
      if (!db) {
        throw new Error('데이터베이스 연결이 초기화되지 않았습니다.');
      }
      
      const userRef = doc(db as Firestore, 'joinUsers', userDocId!);
      await updateDoc(userRef, {
        relation,
        bank,
        accountNumber,
      });

      sessionStorage.setItem('joinStep2', 'true'); // 다음 단계 접근 허용
      toast.success('계좌 정보가 저장되었습니다.');
      router.push('/join/terms');
    } catch (error) {
      console.error('Error updating user payment info:', error);
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrev = () => {
    router.back();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6 md:py-10"
    >
      <div className="max-w-lg mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 md:p-8">
        {/* 진행 과정 표시바 */}
        <div className="flex justify-center mb-8 space-x-2 text-sm text-gray-500 dark:text-gray-300">
          <div className="text-gray-400 flex items-center">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white inline-flex items-center justify-center mr-1 text-xs">1</span>
            정보입력
          </div>
          <span className="text-gray-300 dark:text-gray-600">›</span>
          <div className="text-blue-600 font-medium flex items-center">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white inline-flex items-center justify-center mr-1 text-xs">2</span>
            사은품
          </div>
          <span className="text-gray-300 dark:text-gray-600">›</span>
          <div className="text-gray-400 flex items-center">
            <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 inline-flex items-center justify-center mr-1 text-xs">3</span>
            약관동의
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-4 text-center text-gray-800 dark:text-white">
          현금 이벤트 받는 분 정보
        </h2>

        <div className="bg-blue-50 dark:bg-blue-900/30 text-sm text-blue-600 dark:text-blue-300 p-4 rounded-lg mb-6 border border-blue-100 dark:border-blue-800 flex items-start">
          <svg className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path>
          </svg>
          <span>이벤트 계좌는 가입자 정보와 동일해야 합니다.<br />입력하신 계좌로 가입비가 지급됩니다.</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 받는 분과의 관계 */}
          <div className="border-b border-gray-100 dark:border-gray-700 pb-4 mb-2">
            <div className="flex items-center justify-between mb-2">
              <label className="block font-medium text-gray-700 dark:text-gray-200">받는 분과의 관계</label>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">필수</span>
            </div>
            <div className="bg-blue-50/70 dark:bg-blue-900/30 rounded-lg py-3 px-4 text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-800 font-medium text-center">
              본인
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">가입자 본인 명의의 계좌만 신청이 가능합니다.</p>
          </div>

          {/* 계좌정보 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="bank" className="block font-medium text-gray-700 dark:text-gray-200">은행</label>
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
              <option value="">은행 선택</option>
              <option value="신한은행">신한은행</option>
              <option value="국민은행">국민은행</option>
              <option value="하나은행">하나은행</option>
              <option value="우리은행">우리은행</option>
              <option value="농협은행">농협은행</option>
              <option value="카카오뱅크">카카오뱅크</option>
              <option value="토스뱅크">토스뱅크</option>
              <option value="케이뱅크">케이뱅크</option>
            </select>
            {errors.bank && <p className="text-sm text-red-500 mt-1">{errors.bank}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="accountNumber" className="block font-medium text-gray-700 dark:text-gray-200">계좌번호</label>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">필수</span>
            </div>
            <input
              type="text"
              id="accountNumber"
              name="accountNumber"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              required
              placeholder="'-' 없이 숫자만 입력"
              className={`w-full border rounded-lg p-3 bg-white dark:bg-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                errors.accountNumber ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
              }`}
            />
            {errors.accountNumber && <p className="text-sm text-red-500 mt-1">{errors.accountNumber}</p>}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">계좌번호는 추후 변경이 불가하니 정확하게 입력해주세요.</p>
          </div>

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
              className="sm:w-1/2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3.5 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors flex justify-center items-center"
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  저장 중...
                </>
              ) : (
                '다음 단계로'
              )}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}