'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { exportToExcel } from '../../lib/exportExcel';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      {/* 헤더 */}
      <header className="w-full bg-black text-white p-6 flex flex-col items-center">
        <h1 className="text-2xl font-bold mt-2">펠리시티 이벤트 센터</h1>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="flex flex-col items-center text-center p-6 w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-blue-600">이벤트 참여 안내</h1>

        {/* 분기 버튼 */}
        <div className="grid grid-cols-1 gap-4 w-full">
          <Link
            href="/join"
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-4 rounded-lg text-lg font-bold shadow-md block"
          >
            가입 신청하러 가기
          </Link>

          <Link
            href="/review-access"
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-4 rounded-lg text-lg font-bold shadow-md block"
          >
            후기 신청하러 가기
          </Link>

          <Link
            href="/admin/login"
            className="bg-gray-700 hover:bg-gray-800 text-white px-6 py-4 rounded-lg text-lg font-bold shadow-md block"
          >
            관리자 로그인
          </Link>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="w-full bg-gray-900 text-white p-4 text-center">
        © 2025 Felicity. All rights reserved.
      </footer>
    </div>
  );
}
