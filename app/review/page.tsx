'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { db } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';

interface ReviewUser {
  name: string;
  phone: string;
  email: string;
  reviewType: string;
  reviewLink: string;
  userId: string;
}

const eventTypes = [
  {
    id: 'cafe',
    title: '카페 리뷰',
    description: '카페 리뷰를 작성하고 보상을 받으세요.',
    icon: '☕',
    color: '#FF6B6B'
  },
  {
    id: 'blog',
    title: '블로그 리뷰',
    description: '블로그 리뷰를 작성하고 보상을 받으세요.',
    icon: '✍️',
    color: '#4ECDC4'
  },
  {
    id: 'instagram',
    title: '인스타그램 리뷰',
    description: '인스타그램 리뷰를 작성하고 보상을 받으세요.',
    icon: '📸',
    color: '#45B7D1'
  }
];

export default function ReviewPage() {
  const router = useRouter();
  const [user, setUser] = useState<ReviewUser | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [reviewLink, setReviewLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
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
  }, [router]);

  const handleEventSelect = (eventId: string) => {
    setSelectedEvent(eventId);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reviewLink) {
      setError('리뷰 링크를 입력해주세요.');
      return;
    }

    if (!selectedEvent || !user) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (!db) {
        toast.error('데이터베이스 연결에 실패했습니다.');
        return;
      }

      // 리뷰 정보 저장
      const reviewData = {
        userId: user.userId,
        name: user.name,
        phone: user.phone,
        email: user.email,
        eventType: selectedEvent,
        reviewLink: reviewLink,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      // 리뷰 컬렉션에 저장
      const reviewRef = collection(db, `${selectedEvent}Reviews`);
      await addDoc(reviewRef, reviewData);

      // 계좌 정보 업데이트
      const accountRef = collection(db, 'accounts');
      const accountQuery = query(accountRef, where('userId', '==', user.userId));
      const accountSnapshot = await getDocs(accountQuery);

      if (!accountSnapshot.empty) {
        const accountDoc = accountSnapshot.docs[0];
        await updateDoc(doc(db, 'accounts', accountDoc.id), {
          [`${selectedEvent}Review`]: true,
          [`reviewStatus.${selectedEvent}`]: 'pending',
          [`reviewLinks.${selectedEvent}`]: reviewLink,
          updatedAt: new Date().toISOString()
        });
      }

      toast.success('리뷰가 성공적으로 등록되었습니다.');
      router.push('/review/complete');
    } catch (error) {
      console.error('리뷰 저장 중 오류 발생:', error);
      toast.error('리뷰 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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
          <div className="text-blue-600 font-bold flex items-center">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white inline-flex items-center justify-center mr-1 text-xs">2</span>
            리뷰 선택
          </div>
          <span className="text-gray-300 dark:text-gray-600">›</span>
          <div className={`${selectedEvent ? 'text-blue-600 font-bold' : 'text-gray-400'} flex items-center`}>
            <span className={`w-6 h-6 rounded-full ${selectedEvent ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'} inline-flex items-center justify-center mr-1 text-xs`}>3</span>
            리뷰 작성
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-white">
          {selectedEvent ? '리뷰 링크 입력' : '이벤트 신청'}
        </h2>

        <div className="bg-blue-50 dark:bg-blue-900/30 text-sm text-blue-600 dark:text-blue-300 p-4 rounded-lg mb-6 border border-blue-100 dark:border-blue-800 flex items-start">
          <svg className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path>
          </svg>
          <span>
            {selectedEvent ? '작성하신 리뷰의 링크를 입력해주세요.' : '원하시는 이벤트를 선택해주세요.'}
            <br />
            {selectedEvent ? '리뷰는 90일 동안 삭제가 불가능합니다.' : '각 이벤트의 상세 내용을 확인하실 수 있습니다.'}
          </span>
        </div>

        {!selectedEvent ? (
          <div className="space-y-4">
            {eventTypes.map((event) => (
              <div
                key={event.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer"
                onClick={() => handleEventSelect(event.id)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      {event.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {event.description}
                    </p>
                  </div>
                  <span className="text-2xl">{event.icon}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="reviewLink" className="block text-sm font-medium text-gray-700 dark:text-gray-200">리뷰 링크</label>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">필수</span>
              </div>
              <input
                type="url"
                id="reviewLink"
                name="reviewLink"
                value={reviewLink}
                onChange={(e) => {
                  setReviewLink(e.target.value);
                  setError('');
                }}
                required
                className={`w-full border rounded-lg p-3 bg-white dark:bg-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                  error ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                }`}
                placeholder="https://example.com/review"
              />
              {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-3 pt-6 mt-6 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="sm:w-1/2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium py-3.5 px-6 rounded-lg transition-colors"
              >
                이전 단계
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
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
                  '완료'
                )}
              </button>
            </div>
          </form>
        )}

        {!selectedEvent && (
          <div className="flex flex-col sm:flex-row justify-between gap-3 pt-6 mt-6 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() => router.push('/review-access')}
              className="sm:w-1/2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium py-3.5 px-6 rounded-lg transition-colors"
            >
              이전 단계
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
} 