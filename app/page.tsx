'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function Home() {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);

  const handleJoinClick = () => {
    sessionStorage.setItem('joinStep1', 'true');
    router.push('/join');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: '펠리시티 가입 이벤트',
        text: '펠리시티 가입 이벤트에 참여하고 혜택을 받아보세요!',
        url: window.location.href,
      })
      .catch(error => console.log('공유하기 실패:', error));
    } else {
      // 공유 API를 지원하지 않는 경우 URL 복사
      navigator.clipboard.writeText(window.location.href);
      setShowDialog(true);
      setTimeout(() => setShowDialog(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Header */}
      <header className="flex justify-between items-center p-5 max-w-6xl mx-auto w-full">
        <span className="text-white text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">Felicity</span>
        <button 
          onClick={handleShare}
          className="border border-white/30 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-sm hover:bg-white/20 transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
          </svg>
          공유하기
        </button>
      </header>

      {/* Main Visual */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h1 className="text-5xl sm:text-6xl font-extrabold leading-tight tracking-tight mb-6">
            <span className="inline-block bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">EVENT</span>
            <br />
            <span className="relative">
              가입
              이벤트
            </span>
          </h1>
          <p className="text-xl text-gray-300 mb-8 font-normal">펠리시티와 함께하는 특별한 혜택</p>
        </motion.div>

        {/* Main Image */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative w-full max-w-md mb-12"
        >
          <div className="absolute -top-4 -left-4 w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 blur-2xl opacity-40"></div>
          <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 blur-2xl opacity-40"></div>
        </motion.div>

        {/* 이벤트 배너 */}
        <div className="mb-8 w-full max-w-md">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-0.5 shadow-xl">
            <div className="bg-black/30 rounded-[calc(0.75rem-1px)] p-4 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <div className="bg-white/10 rounded-full p-2">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white">가입만 해도 5만원 지급</h3>
                  <p className="text-sm text-blue-200">가입 후 7일동안 <br></br>15시간 방송시 5만원 추가지급</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="w-full max-w-md space-y-4"
        >
          <button
            onClick={handleJoinClick}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 w-full py-4 rounded-xl text-lg font-medium shadow-lg transform hover:-translate-y-1 transition-all duration-200 flex items-center justify-center"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
            </svg>
            가입 신청하기
          </button>

          <a
            href="/review-access"
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 w-full block py-4 rounded-xl text-lg font-medium shadow-lg transform hover:-translate-y-1 transition-all duration-200 flex items-center justify-center"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h8V3a1 1 0 112 0v1h1a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h1V3a1 1 0 011-1zm2 5a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm0 2a1 1 0 000 2h8a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
            가입 이벤트 신청하기
          </a>

          <a
            href="/admin/login"
            className="bg-gray-700 hover:bg-gray-600 text-white w-full block py-3 rounded-xl text-base font-medium text-center"
          >
            관리자 로그인
          </a>
        </motion.div>
      </main>

      <footer className="mt-auto text-center text-sm py-6 text-gray-400 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4">
          <p className="mb-2">© 2025 Felicity Entertainment. All rights reserved.</p>
          <div className="flex justify-center gap-4 text-xs text-gray-500">
            <a href="#" className="hover:text-gray-300 transition-colors">이용약관</a>
            <a href="#" className="hover:text-gray-300 transition-colors">개인정보처리방침</a>
            <a href="#" className="hover:text-gray-300 transition-colors">고객센터</a>
          </div>
        </div>
      </footer>

      {/* URL 복사 알림 */}
      {showDialog && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-md shadow-lg text-sm">
          URL이 클립보드에 복사되었습니다
        </div>
      )}
    </div>
  );
}
