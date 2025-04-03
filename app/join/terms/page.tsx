'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../../lib/firebase';

// 약관 조항 타입 정의
interface Clause {
  key: 'clause1' | 'clause2' | 'clause3' | 'clause4';
  label: string;
  content: string;
}

// 약관 동의 상태 타입 정의
interface AgreementState {
  clause1: boolean;
  clause2: boolean;
  clause3: boolean;
  clause4: boolean;
  [key: string]: boolean;
}

export default function Terms() {
  const router = useRouter();

  useEffect(() => {
    const step1 = sessionStorage.getItem('joinStep1');
    const step2 = sessionStorage.getItem('joinStep2');
    
    if (!step1 || !step2) {
      toast.error('잘못된 접근입니다. 첫 페이지로 이동합니다.');
      router.replace('/');
    }
  }, [router]);

  const [agreements, setAgreements] = useState<AgreementState>({
    clause1: false,
    clause2: false,
    clause3: false,
    clause4: false,
  });

  const [expanded, setExpanded] = useState<AgreementState>({
    clause1: false,
    clause2: false,
    clause3: false,
    clause4: false,
  });

  // 모든 약관에 동의했는지 확인
  const allAgreed = Object.values(agreements).every(Boolean);
  // 모든 약관을 펼쳤는지 확인
  const allExpanded = Object.values(expanded).every(Boolean);

  // 약관을 모두 보기 또는 접기
  const toggleAllExpand = () => {
    const newExpandedState = !allExpanded;
    setExpanded({
      clause1: newExpandedState,
      clause2: newExpandedState,
      clause3: newExpandedState,
      clause4: newExpandedState,
    });
  };

  const toggleExpand = (key: string) => {
    setExpanded({ ...expanded, [key]: !expanded[key] });
  };

  const toggleAgreement = (key: string) => {
    if (!expanded[key]) {
      // 자동으로 펼치기로 변경 (alert 대신)
      setExpanded({ ...expanded, [key]: true });
    }
    setAgreements({ ...agreements, [key]: !agreements[key] });
  };

  const handleAllAgree = () => {
    const newState = !allAgreed;
    
    // 모든 약관 동의 시 자동으로 모두 펼치기
    if (newState && !allExpanded) {
      setExpanded({
        clause1: true,
        clause2: true,
        clause3: true,
        clause4: true,
      });
    }
    
    setAgreements({
      clause1: newState,
      clause2: newState,
      clause3: newState,
      clause4: newState,
    });
  };

  const handleNext = async () => {
    if (!allAgreed) {
      toast.error('모든 약관에 동의해주세요.');
      return;
    }

    try {
      // 이전 단계 데이터 확인
      const joinStep1 = sessionStorage.getItem('joinStep1');
      const joinStep2 = sessionStorage.getItem('joinStep2');
      const userData = sessionStorage.getItem('joinUserData');
      const giftData = sessionStorage.getItem('giftData');

      if (!joinStep1 || !joinStep2 || !userData || !giftData) {
        toast.error('가입 정보가 유실되었습니다. 처음부터 다시 시도해주세요.');
        router.push('/join');
        return;
      }

      // Firebase에 최종 데이터 저장
      const parsedUserData = JSON.parse(userData);
      const parsedGiftData = JSON.parse(giftData);
      
      const finalData = {
        ...parsedUserData,
        ...parsedGiftData,
        termsAgreedAt: new Date().toISOString(),
      };

      if (!db) {
        throw new Error('데이터베이스 연결에 실패했습니다.');
      }

      const docRef = await addDoc(collection(db, 'joinUsers'), finalData);

      // 세션 스토리지 정리
      sessionStorage.clear();

      toast.success('가입 신청이 완료되었습니다!');
      router.push('/join/complete');
    } catch (error) {
      console.error('가입 처리 오류:', error);
      toast.error('가입 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  // 약관 내용 정의
  const clauses: Clause[] = [
    {
      key: 'clause1',
      label: '1. 이벤트 개요 및 보상 조건',
      content: `[중요] 보상 지급 조건
① 가입 보상: 크리에이터 등록 완료 시 - <span class="text-blue-600 font-bold">50,000원</span>
② 활동 보상: 가입일로부터 <span class="text-red-600 font-bold">7일 이내</span> 누적 방송 <span class="text-red-600 font-bold">15시간 이상</span> 달성 - <span class="text-blue-600 font-bold">50,000원</span>`,
    },
    {
      key: 'clause2',
      label: '2. 활동 유지 조건',
      content: `[필수] 활동 유지 의무 사항
1. 본인은 지급일로부터 <span class="text-red-600 font-bold">최소 14일간</span> 회사의 크리에이터로 등록 및 활동 의사를 유지해야 합니다.
2. <span class="text-red-600 font-bold">활동 유지 기간 내 자발적 탈퇴, 고의적 비활동, 연락 두절</span> 등의 사유가 발생할 경우, 이미 지급된 보상금은 <span class="text-red-600 font-bold">전액 반환</span> 대상이 됩니다.`,
    },
    {
      key: 'clause4',
      label: '3. 반환 동의 및 법적 고지',
      content: `[중요] 반환 의무 동의
본인은 위 기간 내 자진 탈퇴 또는 활동 중단 시, 회사의 요청에 따라 지급받은 금액(<span class="text-blue-600 font-bold">5만원</span>)을 <span class="text-red-600 font-bold">전액 반환</span>해야 함에 동의합니다.

[법적 근거]
- <span class="font-semibold">민법 제390조</span>: 의무 불이행 시 손해배상 및 반환 청구
- <span class="font-semibold">민법 제103조</span>: 사회질서에 위배되지 않는 한 계약 유효
- <span class="font-semibold">전자서명법 및 전자거래기본법</span>: 전자 동의의 법적 유효성 보장`,
    },
  ];

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
          <div className="text-blue-600 font-medium flex items-center">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white inline-flex items-center justify-center mr-1 text-xs">2</span>
            사은품
          </div>
          <span className="text-gray-300 dark:text-gray-600">›</span>
          <div className="text-blue-600 font-bold flex items-center">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white inline-flex items-center justify-center mr-1 text-xs">3</span>
            약관동의
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-white">
          약관에 동의해주세요
        </h2>

        {/* 중요 안내사항 추가 */}
        <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h3 className="text-yellow-800 dark:text-yellow-300 font-bold mb-2">⚠️ 중요 안내사항</h3>
          <ul className="text-sm text-yellow-700 dark:text-yellow-200 space-y-1">
            <li>• 모든 약관을 <span className="font-bold">반드시 확인</span>하신 후 동의해주세요.</li>
            <li>• 약관 동의 후 <span className="font-bold">활동 조건 미이행</span> 시 보상금이 <span className="font-bold">반환</span>될 수 있습니다.</li>
            <li>• 각 약관의 <span className="font-bold">[중요]</span> 표시 항목을 특히 유의해서 읽어주세요.</li>
          </ul>
        </div>

        <div className="space-y-4">
          {/* 전체 동의 박스 */}
          <motion.div 
            layout 
            className="border border-blue-200 bg-blue-50/70 dark:bg-blue-900/30 dark:border-blue-900 p-4 rounded-lg shadow-sm"
          >
            <div className="flex flex-wrap justify-between items-center gap-2">
              <label className="flex items-center text-blue-800 dark:text-blue-300 font-medium text-sm md:text-base cursor-pointer">
                <input
                  type="checkbox"
                  checked={allAgreed}
                  onChange={handleAllAgree}
                  className="mr-2 min-w-[20px] w-5 h-5 accent-blue-600 rounded-sm focus:ring-blue-500"
                />
                <span className="whitespace-nowrap">활동 조건 전체 동의</span>
                <span className="ml-1 whitespace-nowrap">(필수)</span>
              </label>
              <button
                onClick={toggleAllExpand}
                className="text-xs text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/50 px-3 py-1.5 rounded-full transition-colors"
              >
                {allExpanded ? '모두 접기' : '모두 펼치기'}
              </button>
            </div>
          </motion.div>

          {/* 약관 항목들 */}
          {clauses.map(({ key, label, content }) => (
            <motion.div 
              layout 
              key={key} 
              className={`border rounded-lg p-4 shadow-sm transition-colors ${
                agreements[key] 
                  ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/50' 
                  : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
              }`}
            >
              <div className="flex justify-between items-center">
                <label className="flex items-center text-sm md:text-base text-gray-800 dark:text-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreements[key]}
                    onChange={() => toggleAgreement(key)}
                    className="mr-2 w-5 h-5 accent-blue-600 rounded-sm focus:ring-blue-500"
                  />
                  <span className="font-medium">{label}</span> 
                  <span className="ml-1.5 text-blue-500 text-xs">(필수)</span>
                </label>
                <button
                  type="button"
                  onClick={() => toggleExpand(key)}
                  className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                    expanded[key]
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  aria-label={expanded[key] ? '접기' : '펼치기'}
                >
                  {expanded[key] ? 
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    : 
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  }
                </button>
              </div>
              <AnimatePresence initial={false}>
                {expanded[key] && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden mt-3"
                  >
                    <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line bg-white dark:bg-gray-700/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: content }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}

          {/* 버튼 영역 */}
          <div className="flex flex-col sm:flex-row justify-between gap-3 pt-8">
            <button
              type="button"
              onClick={() => router.back()}
              className="sm:w-1/2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium py-3.5 px-6 rounded-lg transition-colors"
            >
              이전 단계
            </button>
            <button
              type="submit"
              onClick={handleNext}
              disabled={!allAgreed}
              className="sm:w-1/2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3.5 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
            >
              동의하고 완료
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}