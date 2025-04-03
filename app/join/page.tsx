'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, query, where, limit } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';

// 성별 타입 정의
type Gender = '남성' | '여성' | '';

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
  const [gender, setGender] = useState<Gender>('');
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
    
    // 생년월일이 선택된 경우에만 나이 체크
    if (value) {
      const today = new Date();
      const birth = new Date(value);
      const age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      const d = today.getDate() - birth.getDate();
      const isAdult = age > 19 || (age === 19 && (m > 0 || (m === 0 && d >= 0)));
      
      if (!isAdult) {
        toast.error('만 19세 이상만 가입이 가능합니다.');
        setBirthDate('');
        setIsUnderage(true);
        return;
      }
    }
    
    setBirthDate(value);
    setIsUnderage(false);
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
    
    return newErrors;
  }, [name, phone, phoneCarrier, email, birthDate, gender, trafficSource, callTime]);

  // 입력값이 변경될 때마다 해당 필드의 에러만 업데이트
  const handleInputChange = (field: string, value: string) => {
    const fieldErrors = validateForm();
    setErrors(prev => ({
      ...prev,
      [field]: fieldErrors[field] || ''
    }));
  };

  // 폼 제출 시에만 전체 유효성 검사
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formErrors = validateForm();
    setErrors(formErrors);

    if (Object.keys(formErrors).length === 0) {
      // 폼 제출 로직
    }
  };

  // 전화번호 포맷팅 함수
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/[^\d]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  // 전화번호 입력 핸들러
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  };

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

    if (isUnderage) {
      toast.error('만 19세 이상만 가입이 가능합니다.');
      return;
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

      // 3. 세션 스토리지에 임시 저장
      try {
        const userData = {
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
        sessionStorage.setItem('joinStep1', 'true');
        sessionStorage.setItem('joinUserData', JSON.stringify(userData));
      } catch (storageError) {
        console.error('세션 스토리지 저장 오류:', storageError);
        throw new Error('임시 데이터 저장에 실패했습니다. 다시 시도해주세요.');
      }

      router.push('/join/gift-receiver');
    } catch (error: any) {
      console.error('처리 오류:', error);
      
      let errorMessage = '오류가 발생했습니다. 다시 시도해주세요.';
      if (error.message) {
        errorMessage = error.message;
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
          <div className="text-blue-600 font-bold flex items-center">
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
          가입 신청
        </h2>

        <div className="bg-blue-50 dark:bg-blue-900/30 text-sm text-blue-600 dark:text-blue-300 p-4 rounded-lg mb-6 border border-blue-100 dark:border-blue-800 flex items-start">
          <svg className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path>
          </svg>
          <span>입력하신 정보는 안전하게 보호되며,<br />담당자 확인 후 연락드리겠습니다.</span>
        </div>

        <form onSubmit={handleNext} className="space-y-6">
          {/* 기본 정보 */}
          <div className="border-b border-gray-100 dark:border-gray-700 pb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900 dark:text-white">기본 정보</h3>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">필수</span>
            </div>
            
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
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">정확한 전화번호를 입력 부탁드립니다.</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="phoneCarrier" className="block text-sm font-medium text-gray-700 dark:text-gray-200">통신사</label>
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">필수</span>
                </div>
                <select
                  id="phoneCarrier"
                  name="phoneCarrier"
                  value={phoneCarrier}
                  onChange={(e) => setPhoneCarrier(e.target.value)}
                  required
                  className={`w-full border rounded-lg p-3 bg-white dark:bg-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                    errors.phoneCarrier ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <option value="">선택해주세요</option>
                  <option value="SKT">SKT</option>
                  <option value="KT">KT</option>
                  <option value="LGU+">LGU+</option>
                </select>
                {errors.phoneCarrier && <p className="mt-1 text-sm text-red-500">{errors.phoneCarrier}</p>}
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

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="birthDate" className="block text-sm font-medium text-gray-700 dark:text-gray-200">생년월일</label>
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">필수</span>
                </div>
                <input
                  type="date"
                  id="birthDate"
                  name="birthDate"
                  value={birthDate}
                  onChange={handleBirthDateChange}
                  required
                  max={new Date().toISOString().split('T')[0]}
                  min="1900-01-01"
                  className={`w-full border rounded-lg p-3 bg-white dark:bg-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                    errors.birthDate ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                  }`}
                />
                {errors.birthDate && <p className="mt-1 text-sm text-red-500">{errors.birthDate}</p>}
                {isUnderage && (
                  <p className="mt-1 text-sm text-red-500">만 19세 이상만 가입이 가능합니다.</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">성별</label>
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">필수</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setGender('남성')}
                    className={`flex items-center justify-center p-3 rounded-lg border ${
                      gender === '남성'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/50 dark:border-blue-400 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-500 dark:hover:border-blue-400'
                    }`}
                  >
                    남성
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('여성')}
                    className={`flex items-center justify-center p-3 rounded-lg border ${
                      gender === '여성'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/50 dark:border-blue-400 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-500 dark:hover:border-blue-400'
                    }`}
                  >
                    여성
                  </button>
                </div>
                {errors.gender && <p className="mt-1 text-sm text-red-500">{errors.gender}</p>}
              </div>
            </div>
          </div>

          {/* 추가 정보 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900 dark:text-white">추가 정보</h3>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">필수</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="trafficSource" className="block text-sm font-medium text-gray-700 dark:text-gray-200">유입경로</label>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">필수</span>
              </div>
              <select
                id="trafficSource"
                name="trafficSource"
                value={trafficSource}
                onChange={(e) => setTrafficSource(e.target.value)}
                required
                className={`w-full border rounded-lg p-3 bg-white dark:bg-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                  errors.trafficSource ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <option value="">선택해주세요</option>
                <option value="Naver Search">네이버 검색</option>
                <option value="Google Search">구글 검색</option>
                <option value="Instagram">인스타그램</option>
                <option value="Threads">스레드</option>
                <option value="Recommendation">지인 추천</option>
                <option value="Other">기타</option>
              </select>
              {errors.trafficSource && <p className="mt-1 text-sm text-red-500">{errors.trafficSource}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="callTime" className="block text-sm font-medium text-gray-700 dark:text-gray-200">통화 가능 시간</label>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">필수</span>
              </div>
              <select
                id="callTime"
                name="callTime"
                value={callTime}
                onChange={(e) => setCallTime(e.target.value)}
                required
                className={`w-full border rounded-lg p-3 bg-white dark:bg-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                  errors.callTime ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <option value="">선택해주세요</option>
                <option value="09:00-10:00">09:00-10:00</option>
                <option value="10:00-11:00">10:00-11:00</option>
                <option value="11:00-12:00">11:00-12:00</option>
                <option value="12:00-13:00">12:00-13:00</option>
                <option value="13:00-14:00">13:00-14:00</option>
                <option value="14:00-15:00">14:00-15:00</option>
                <option value="15:00-16:00">15:00-16:00</option>
                <option value="16:00-17:00">16:00-17:00</option>
                <option value="17:00-18:00">17:00-18:00</option>
                <option value="18:00-19:00">18:00-19:00</option>
                <option value="19:00-20:00">19:00-20:00</option>
                <option value="20:00-21:00">20:00-21:00</option>
                <option value="21:00-22:00">21:00-22:00</option>
              </select>
              {errors.callTime && <p className="mt-1 text-sm text-red-500">{errors.callTime}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="referralCode" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  추천인 코드 <span className="text-gray-500">(선택사항)</span>
                </label>
              </div>
              <input
                type="text"
                id="referralCode"
                name="referralCode"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                className="w-full border rounded-lg p-3 bg-white dark:bg-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors border-gray-200 dark:border-gray-700"
                placeholder="추천인 코드를 입력해주세요"
              />
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
              disabled={isSubmitting || Object.keys(validateForm()).length > 0}
              className="sm:w-1/2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3.5 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors flex justify-center items-center"
            >
              {isSubmitting ? (
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
      </div>
    </motion.div>
  );
}
