'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';

type PageParams = Promise<{ type: string }>;

type ReviewType = {
  id: string;
  title: string;
  description: string;
  placeholder?: string;
  icon: string;
  color: string;
};

interface ReviewUser {
  name: string;
  phone: string;
  userId: string;
}

const reviewTypes: { [key: string]: ReviewType } = {
  joinEvent: {
    id: 'joinEvent',
    title: '가입 이벤트 신청',
    description: '계좌번호 확인 및 본인인증 후 신청 가능합니다.',
    placeholder: '계좌번호를 입력해주세요',
    icon: '💰',
    color: 'from-green-500 to-emerald-500'
  },
  cafeReview: {
    id: 'cafeReview',
    title: '카페 후기 이벤트 신청',
    description: '카페에 작성한 후기 링크를 첨부해주세요. (90일 동안 삭제 불가)',
    placeholder: '카페 후기 링크를 입력해주세요',
    icon: '☕',
    color: 'from-orange-500 to-amber-500'
  },
  blogReview: {
    id: 'blogReview',
    title: '블로그 후기 이벤트 신청',
    description: '블로그에 작성한 후기 링크를 첨부해주세요. (90일 동안 삭제 불가)',
    placeholder: '블로그 후기 링크를 입력해주세요',
    icon: '📝',
    color: 'from-blue-500 to-indigo-500'
  },
  instaReview: {
    id: 'instaReview',
    title: '인스타 후기 이벤트 신청',
    description: '인스타그램에 작성한 후기 링크를 첨부해주세요. (90일 동안 삭제 불가)',
    icon: '📸',
    color: 'from-pink-500 to-purple-500'
  }
};

export default async function ReviewPage({ params }: { params: PageParams }) {
  const { type } = await params;
  const router = useRouter();
  const [user, setUser] = useState<ReviewUser | null>(null);
  const [reviewLink, setReviewLink] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const reviewType = reviewTypes[type as keyof typeof reviewTypes];

  useEffect(() => {
    if (!reviewType) {
      router.replace('/review');
      return;
    }

    const userStr = sessionStorage.getItem('reviewUser');
    if (!userStr) {
      toast.error('먼저 본인 확인이 필요합니다.');
      router.replace('/review-access');
      return;
    }

    try {
      const userData = JSON.parse(userStr);
      setUser(userData);
    } catch (error) {
      console.error('사용자 정보 파싱 오류:', error);
      toast.error('사용자 정보가 올바르지 않습니다.');
      router.replace('/review-access');
    }
  }, [router, reviewType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('사용자 정보가 없습니다.');
      return;
    }

    if (!reviewLink) {
      toast.error('후기 링크를 입력해주세요.');
      return;
    }

    if (!termsAccepted) {
      toast.error('약관 동의가 필요합니다.');
      return;
    }

    if (!db) {
      toast.error('데이터베이스 연결에 실패했습니다.');
      return;
    }

    setIsLoading(true);

    try {
      const eventRef = collection(db, `${type}s`);
      await addDoc(eventRef, {
        userId: user.userId,
        name: user.name,
        phone: user.phone,
        reviewLink,
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

  if (!reviewType || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-extrabold text-gray-900">
            {reviewType.title}
          </h1>
          <p className="mt-2 text-gray-600">
            {reviewType.description}
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                후기 링크
              </label>
              <input
                type="url"
                value={reviewLink}
                onChange={(e) => setReviewLink(e.target.value)}
                placeholder={reviewType.placeholder}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
            </div>

            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    후기는 90일 동안 삭제할 수 없습니다.
                  </p>
                </div>
              </div>
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
                  후기 90일 유지 등 이벤트 참여를 위한 필수 약관에 동의합니다.
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
                disabled={isLoading || !termsAccepted}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
