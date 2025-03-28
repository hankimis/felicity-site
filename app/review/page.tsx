'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';

interface ReviewUser {
  name: string;
  phone: string;
  userId: string;
}

const eventTypes = [
  {
    id: 'joinEvent',
    title: '가입 이벤트 신청',
    description: '계좌번호 확인 및 본인인증 후 신청 가능합니다.',
    icon: '💰',
    color: 'from-green-500 to-emerald-500'
  },
  {
    id: 'cafeReview',
    title: '카페 후기 이벤트 신청',
    description: '카페에 작성한 후기 링크를 첨부해주세요. (90일 동안 삭제 불가)',
    icon: '☕',
    color: 'from-orange-500 to-amber-500'
  },
  {
    id: 'blogReview',
    title: '블로그 후기 이벤트 신청',
    description: '블로그에 작성한 후기 링크를 첨부해주세요. (90일 동안 삭제 불가)',
    icon: '📝',
    color: 'from-blue-500 to-indigo-500'
  },
  {
    id: 'instaReview',
    title: '인스타 후기 이벤트 신청',
    description: '인스타그램에 작성한 후기 링크를 첨부해주세요. (90일 동안 삭제 불가)',
    icon: '📸',
    color: 'from-pink-500 to-purple-500'
  }
];

export default function ReviewPage() {
  const router = useRouter();
  const [user, setUser] = useState<ReviewUser | null>(null);

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
    if (!user) {
      toast.error('먼저 본인 확인이 필요합니다.');
      router.replace('/review-access');
      return;
    }
    router.push(`/review/${eventId}`);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto"
      >
        <div className="text-center mb-12">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-4xl font-extrabold text-gray-900 sm:text-5xl"
          >
            이벤트 신청
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-3 text-xl text-gray-500"
          >
            원하시는 이벤트를 선택해주세요
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-4 text-lg text-gray-600"
          >
            <span className="font-medium text-blue-600">{user.name}</span>님 환영합니다
          </motion.div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {eventTypes.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * index }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group relative bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300 cursor-pointer border border-gray-100"
            >
              <div className="absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-2xl"
                style={{ backgroundImage: `linear-gradient(to right, ${event.color})` }}
              />
              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-gray-900">
                    {event.title}
                  </h2>
                  <span className="text-4xl transform group-hover:scale-110 transition-transform duration-300">
                    {event.icon}
                  </span>
                </div>
                <p className="text-gray-600 text-base mb-6">
                  {event.description}
                </p>
                <div className="flex justify-end">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleEventSelect(event.id)}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-gray-600 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300"
                  >
                    신청하기
                    <svg className="ml-2 -mr-1 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
} 