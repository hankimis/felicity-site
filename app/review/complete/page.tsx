'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

export default function Complete() {
  const router = useRouter();

  useEffect(() => {
    const reviewUser = sessionStorage.getItem('reviewUser');
    if (!reviewUser) {
      toast.error('잘못된 접근입니다. 첫 페이지로 이동합니다.');
      router.replace('/');
    }
  }, [router]);

  const clauses = [
    {
      key: 'clause1',
      label: '1. 이벤트 개요 및 보상 조건',
      content: `[중요] 보상 지급 조건
① 가입 보상: 크리에이터 등록 완료 시 - <span class="text-blue-600 font-bold">50,000원</span>
② 활동 보상: 가입일로부터 <span class="text-red-600 font-bold">7일 이내</span> 누적 방송 <span class="text-red-600 font-bold">15시간 이상</span> 달성 - <span class="text-blue-600 font-bold">50,000원</span>`
    },
    {
      key: 'clause2',
      label: '2. 활동 유지 조건',
      content: `[필수] 활동 유지 의무 사항
1. 본인은 지급일로부터 <span class="text-red-600 font-bold">최소 14일간</span> 회사의 크리에이터로 등록 및 활동 의사를 유지해야 합니다.
2. <span class="text-red-600 font-bold">활동 유지 기간 내 자발적 탈퇴, 고의적 비활동, 연락 두절</span> 등의 사유가 발생할 경우, 이미 지급된 보상금은 <span class="text-red-600 font-bold">전액 반환</span> 대상이 됩니다.`
    },
    {
      key: 'clause3',
      label: '3. 반환 동의 및 법적 고지',
      content: `[중요] 반환 의무 동의
본인은 위 기간 내 자진 탈퇴 또는 활동 중단 시, 회사의 요청에 따라 지급받은 금액(<span class="text-blue-600 font-bold">5만원</span>)을 <span class="text-red-600 font-bold">전액 반환</span>해야 함에 동의합니다.

[법적 근거]
- <span class="font-semibold">민법 제390조</span>: 의무 불이행 시 손해배상 및 반환 청구
- <span class="font-semibold">민법 제103조</span>: 사회질서에 위배되지 않는 한 계약 유효
- <span class="font-semibold">전자서명법 및 전자거래기본법</span>: 전자 동의의 법적 유효성 보장`
    }
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
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-white">
          이벤트 신청이 완료되었습니다
        </h2>

        {/* 중요 안내사항 */}
        <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h3 className="text-yellow-800 dark:text-yellow-300 font-bold mb-2">⚠️ 중요 안내사항</h3>
          <ul className="text-sm text-yellow-700 dark:text-yellow-200 space-y-1">
            <li>• 아래 내용을 <span className="font-bold">반드시 확인</span>해주세요.</li>
            <li>• 활동 조건 <span className="font-bold">미이행</span> 시 보상금이 <span className="font-bold">반환</span>될 수 있습니다.</li>
            <li>• <span className="font-bold">[중요]</span> 표시 항목을 특히 유의해서 읽어주세요.</li>
          </ul>
        </div>

        {/* 약관 내용 */}
        <div className="space-y-6">
          {clauses.map(({ key, label, content }) => (
            <div
              key={key}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                {label}
              </h3>
              <div
                className="text-sm text-gray-700 dark:text-gray-300 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </div>
          ))}
        </div>

        {/* 버튼 영역 */}
        <div className="flex justify-center mt-8">
          <button
            onClick={() => {
              sessionStorage.clear();
              router.push('/');
            }}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            홈으로 이동
          </button>
        </div>
      </div>
    </motion.div>
  );
} 