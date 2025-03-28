'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ReviewCompletePage() {
  const router = useRouter();

  useEffect(() => {
    // Clear the session storage after successful submission
    sessionStorage.removeItem('reviewUser');
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <svg
            className="mx-auto h-12 w-12 text-green-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            이벤트 신청이 완료되었습니다
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            관리자 검토 후 승인될 예정입니다. 승인까지 최대 24시간이 소요될 수 있습니다.
          </p>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="text-sm text-gray-500">
              <p className="font-medium text-gray-700 mb-4">
                다음 단계
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>관리자가 제출하신 후기를 검토합니다</li>
                <li>검토가 완료되면 등록하신 연락처로 안내드립니다</li>
                <li>승인 시 이벤트 혜택이 자동으로 지급됩니다</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <button
            onClick={() => router.push('/')}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
} 