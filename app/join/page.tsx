'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, query, where, limit } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';

export default function Join() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCarrier, setPhoneCarrier] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [isUnderage, setIsUnderage] = useState(false);
  const [gender, setGender] = useState<'남성' | '여성' | ''>('');
  const [trafficSource, setTrafficSource] = useState('');
  const [callTime, setCallTime] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 네트워크 상태 모니터링
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Firebase 연결 상태 확인 - 단순화된 버전
  const checkFirebaseConnection = useCallback(async () => {
    if (!db) {
      console.error('Firebase가 초기화되지 않았습니다.');
      return false;
    }

    try {
      // 간단한 쿼리로 연결 테스트
      const testRef = collection(db, 'joinUsers');
      const testQuery = query(testRef, limit(1));
      await getDocs(testQuery);
      return true;
    } catch (error) {
      console.error('Firebase 연결 오류:', error);
      return false;
    }
  }, []);

  // 세션 스토리지 초기화
  useEffect(() => {
    try {
      sessionStorage.setItem('joinStep1', 'true');
    } catch (error) {
      console.error('세션 스토리지 초기화 오류:', error);
    }
  }, []);

  const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBirthDate(value);

    const today = new Date();
    const birth = new Date(value);
    const age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    const d = today.getDate() - birth.getDate();
    const isAdult = age > 19 || (age === 19 && (m > 0 || (m === 0 && d >= 0)));
    setIsUnderage(!isAdult);
  };

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = '이름을 입력해주세요';
    
    const phoneRegex = /^01[0-9]-\d{3,4}-\d{4}$/;
    if (!phone.trim()) {
      newErrors.phone = '전화번호를 입력해주세요';
    } else if (!phoneRegex.test(phone)) {
      newErrors.phone = '올바른 전화번호 형식이 아닙니다 (예: 010-1234-5678)';
    }
    
    if (!phoneCarrier) newErrors.phoneCarrier = '통신사를 선택해주세요';
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      newErrors.email = '이메일을 입력해주세요';
    } else if (!emailRegex.test(email)) {
      newErrors.email = '올바른 이메일 형식이 아닙니다';
    }
    
    if (!birthDate) newErrors.birthDate = '생년월일을 입력해주세요';
    if (!gender) newErrors.gender = '성별을 선택해주세요';
    if (!trafficSource) newErrors.trafficSource = '유입경로를 선택해주세요';
    if (!callTime) newErrors.callTime = '통화 가능 시간을 선택해주세요';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, phone, phoneCarrier, email, birthDate, gender, trafficSource, callTime]);

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('입력 정보를 확인해주세요.');
      return;
    }

    if (!isOnline) {
      toast.error('인터넷 연결을 확인해주세요.');
      return;
    }

    if (isSubmitting) {
      return; // 중복 제출 방지
    }

    setIsSubmitting(true);

    try {
      // 1. Firebase 연결 확인
      const isConnected = await checkFirebaseConnection();
      if (!isConnected) {
        throw new Error('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
      }

      // 2. 중복 가입 체크
      if (!db) throw new Error('Firebase가 초기화되지 않았습니다.');
      const userRef = collection(db, 'joinUsers');
      const duplicateQuery = query(userRef, where('phone', '==', phone));
      const duplicateCheck = await getDocs(duplicateQuery);
      
      if (!duplicateCheck.empty) {
        throw new Error('이미 가입된 전화번호입니다.');
      }

      // 3. 새 사용자 데이터 생성
      const newUser = {
        name,
        phone,
        phoneCarrier,
        email,
        birthDate,
        gender,
        trafficSource,
        callTime,
        referralCode: referralCode || '없음',
        createdAt: new Date().toISOString(),
        status: 'pending',
      };

      // 4. Firestore에 데이터 저장
      const docRef = await addDoc(collection(db, 'joinUsers'), newUser);

      // 5. 세션 스토리지 저장
      try {
        sessionStorage.setItem('joinStep2', 'true');
        sessionStorage.setItem('joinPhone', phone);
        sessionStorage.setItem('joinDocId', docRef.id);
      } catch (storageError) {
        console.error('세션 스토리지 저장 오류:', storageError);
        // 세션 스토리지 오류는 무시하고 진행
      }

      toast.success('정보가 성공적으로 저장되었습니다!');
      router.push('/join/gift-receiver');
    } catch (error: any) {
      console.error('가입 처리 오류:', error);
      
      let errorMessage = '오류가 발생했습니다. 다시 시도해주세요.';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.code === 'unavailable') {
        errorMessage = '서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.';
      } else if (error.code === 'permission-denied') {
        errorMessage = '데이터 저장 권한이 없습니다. 관리자에게 문의하세요.';
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrev = () => {
    router.push('/');
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
          <div className="text-blue-600 font-medium flex items-center">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white inline-flex items-center justify-center mr-1 text-xs">1</span>
            정보입력
          </div>
          <span className="text-gray-300 dark:text-gray-600">›</span>
          <div className="text-gray-400 flex items-center">
            <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 inline-flex items-center justify-center mr-1 text-xs">2</span>
            사은품
          </div>
          <span className="text-gray-300 dark:text-gray-600">›</span>
          <div className="text-gray-400 flex items-center">
            <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 inline-flex items-center justify-center mr-1 text-xs">3</span>
            약관동의
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-white">
          가입자 정보를 입력해주세요
        </h2>

        <form onSubmit={handleNext} className="space-y-5">
          {/* 고객 구분 */}
          <div className="border-b border-gray-100 dark:border-gray-700 pb-4 mb-2">
            <div className="flex items-center justify-between mb-2">
              <label className="block font-medium text-gray-700 dark:text-gray-200">고객 구분</label>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">필수</span>
            </div>
            <div className="bg-blue-50/70 dark:bg-blue-900/30 rounded-lg py-3 px-4 text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-800 font-medium text-center">
              크리에이터
            </div>
          </div>

          {/* 이름 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block font-medium text-gray-700 dark:text-gray-200">가입자명</label>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">필수</span>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={`w-full border rounded-lg p-3 bg-white dark:bg-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                errors.name ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
              }`}
              placeholder="이름을 입력하세요"
            />
            {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* 생년월일 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block font-medium text-gray-700 dark:text-gray-200">생년월일</label>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">필수</span>
            </div>
            <input
              type="date"
              value={birthDate}
              onChange={handleBirthDateChange}
              required
              className={`w-full border rounded-lg p-3 bg-white dark:bg-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                errors.birthDate || isUnderage ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
              }`}
            />
            {errors.birthDate && <p className="text-sm text-red-500 mt-1">{errors.birthDate}</p>}
            {isUnderage && (
              <p className="text-sm text-red-500 mt-1 bg-red-50 dark:bg-red-900/30 p-2 rounded-md">
                미성년자는 가입이 불가능합니다.
              </p>
            )}
          </div>

          {/* 성별 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block font-medium text-gray-700 dark:text-gray-200">성별</label>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">필수</span>
            </div>
            <div className="flex gap-2">
              {['남성', '여성'].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setGender(option as '남성' | '여성')}
                  className={`flex-1 border rounded-lg py-3 px-4 font-medium transition-all ${
                    gender === option
                      ? 'text-blue-600 border-blue-500 bg-blue-50/70 dark:bg-blue-900/30 dark:border-blue-700'
                      : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            {errors.gender && <p className="text-sm text-red-500 mt-1">{errors.gender}</p>}
          </div>

          {/* 연락처 + 통신사 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block font-medium text-gray-700 dark:text-gray-200">가입자 명의 연락처</label>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">필수</span>
            </div>
            <div className="flex gap-2">
              <div className="w-2/3">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className={`w-full border rounded-lg p-3 bg-white dark:bg-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                    errors.phone ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                  }`}
                  placeholder="010-1234-5678"
                />
                {errors.phone && <p className="text-sm text-red-500 mt-1">{errors.phone}</p>}
              </div>
              <div className="w-1/3">
                <select
                  value={phoneCarrier}
                  onChange={(e) => setPhoneCarrier(e.target.value)}
                  required
                  className={`w-full border rounded-lg p-3 bg-white dark:bg-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                    errors.phoneCarrier ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <option value="">통신사</option>
                  <option value="SKT">SKT</option>
                  <option value="KT">KT</option>
                  <option value="LG U+">LG U+</option>
                  <option value="알뜰폰">알뜰폰</option>
                </select>
                {errors.phoneCarrier && <p className="text-sm text-red-500 mt-1">{errors.phoneCarrier}</p>}
              </div>
            </div>
          </div>

          {/* 이메일 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block font-medium text-gray-700 dark:text-gray-200">이메일</label>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">필수</span>
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={`w-full border rounded-lg p-3 bg-white dark:bg-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                errors.email ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
              }`}
              placeholder="example@email.com"
            />
            {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 유입경로 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block font-medium text-gray-700 dark:text-gray-200">유입경로</label>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">필수</span>
              </div>
              <select
                value={trafficSource}
                onChange={(e) => setTrafficSource(e.target.value)}
                required
                className={`w-full border rounded-lg p-3 bg-white dark:bg-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                  errors.trafficSource ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <option value="">유입경로 선택</option>
                <option value="Google 검색">Google 검색</option>
                <option value="네이버 검색">네이버 검색</option>
                <option value="SNS 광고">SNS 광고</option>
                <option value="지인 추천">지인 추천</option>
                <option value="기타">기타</option>
              </select>
              {errors.trafficSource && <p className="text-sm text-red-500 mt-1">{errors.trafficSource}</p>}
            </div>

            {/* 통화 가능 시간 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block font-medium text-gray-700 dark:text-gray-200">통화 가능 시간</label>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">필수</span>
              </div>
              <select
                value={callTime}
                onChange={(e) => setCallTime(e.target.value)}
                required
                className={`w-full border rounded-lg p-3 bg-white dark:bg-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                  errors.callTime ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <option value="">시간 선택</option>
                <option value="09:00 - 10:00">09:00 - 10:00</option>
                <option value="10:00 - 11:00">10:00 - 11:00</option>
                <option value="11:00 - 12:00">11:00 - 12:00</option>
                <option value="13:00 - 14:00">13:00 - 14:00</option>
                <option value="14:00 - 15:00">14:00 - 15:00</option>
                <option value="15:00 - 16:00">15:00 - 16:00</option>
                <option value="16:00 - 17:00">16:00 - 17:00</option>
              </select>
              {errors.callTime && <p className="text-sm text-red-500 mt-1">{errors.callTime}</p>}
            </div>
          </div>

          {/* 추천인 코드 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block font-medium text-gray-700 dark:text-gray-200">추천인 코드</label>
              <span className="text-xs text-gray-500 dark:text-gray-400">선택</span>
            </div>
            <input
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
              placeholder="추천인 코드가 있으면 입력하세요"
            />
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
              disabled={isSubmitting || isUnderage}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  처리 중...
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
