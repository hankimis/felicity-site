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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6"
    >
      <div className="max-w-4xl mx-auto">
        {/* 상단 네비게이션 */}
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            홈으로
          </button>
        </div>

        <div className="max-w-lg mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 md:p-8">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-white">
            이벤트 신청
          </h2>

          {/* 가입 이벤트 배너 */}
          <div className="mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold mb-2">가입 이벤트 진행중! 🎉</h2>
                <p className="text-blue-100 text-sm">지금 가입하시고 특별한 혜택을 받아가세요.</p>
              </div>
              <button
                onClick={() => {
                  router.push('/review/complete');
                  sessionStorage.setItem('eventJoin', 'true');
                }}
                className="px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors text-sm"
              >
                가입 신청하기
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
} 