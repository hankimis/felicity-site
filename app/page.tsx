'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();

  const handleJoinClick = () => {
    sessionStorage.setItem('joinStep1', 'true');
    router.push('/join');
  };

  return (
    <div className="min-h-screen flex flex-col bg-black text-white font-bold">
      {/* Header */}
      <header className="flex justify-between items-center p-4">
        <span className="text-white text-lg">Felicity</span>
        <button className="border border-white px-3 py-1 rounded-full text-sm">공유하기</button>
      </header>

      {/* Main Visual */}
      <main className="flex flex-col items-center justify-center px-6 py-8 text-center">
        <h1 className="text-4xl sm:text-5xl leading-tight">
          EVENT <br /> 가<span className="inline-block bg-white text-black rounded px-2">입</span> <br /> 이벤트 <br /> 펠리시티
        </h1>
        <div className="mt-4 border border-white rounded-full px-4 py-1 text-sm">홈피드 편</div>

        {/* 이미지 꾸밈 요소들 (예시) */}
        <div className="relative mt-8 w-full max-w-md">
          <div className="absolute -top-8 left-4 w-16 h-16 bg-red-500 rounded-full" />
          <div className="absolute -top-4 right-4 w-12 h-12 bg-blue-500 rounded-full" />
          <div className="absolute bottom-0 left-1/3 w-10 h-10 bg-green-500 rounded-full" />
          <div className="absolute bottom-4 right-8 w-10 h-10 bg-yellow-400 rounded-full" />
          <img src="/event-bg.png" alt="이벤트 배경" className="rounded-xl w-full" />
        </div>

        {/* Call to Action */}
        <div className="mt-12 w-full max-w-md space-y-4">
          <button
            onClick={handleJoinClick}
            className="bg-white text-black w-full py-4 rounded-lg text-lg hover:bg-gray-200 transition"
          >
            가입 신청하러 가기
          </button>

          <a
            href="/review-access"
            className="bg-[#00C73C] w-full block py-4 rounded-lg text-lg text-white hover:bg-green-600 transition text-center"
          >
            후기 신청하러 가기
          </a>

          <a
            href="/admin/login"
            className="bg-gray-700 w-full block py-4 rounded-lg text-lg text-white hover:bg-gray-600 transition text-center"
          >
            관리자 로그인
          </a>
        </div>

        {/* 이벤트 안내 배너 */}
        <div className="mt-8 px-6 py-3 rounded-lg bg-gradient-to-r from-purple-400 to-blue-500 text-black text-center text-sm">
          <strong className="text-white block">가입 만 해도 10만원 지급</strong>
        </div>
      </main>

      <footer className="mt-auto text-center text-sm py-4 text-gray-400">
        © 2025 Felicity. All rights reserved.
      </footer>
    </div>
  );
}
