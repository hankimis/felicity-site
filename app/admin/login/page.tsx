'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { auth, signInWithEmail } from '../../lib/firebase';
import { toast } from 'react-hot-toast';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const redirectAttempted = useRef(false);
  const authInitialized = useRef(false);

  // 쿠키 기반 인증 체크
  useEffect(() => {
    // 무한 리다이렉션 방지를 위해 한 번만 체크
    if (redirectAttempted.current) return;
    
    // If already logged in, redirect to dashboard
    const isAuthed = Cookies.get('adminAuth');
    if (isAuthed === 'true') {
      redirectAttempted.current = true;
      router.push('/admin/dashboard');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 하드코딩된 이메일 및 비밀번호 확인
      const expectedEmail = 'hankim.masion@gmail.com';
      const expectedPassword = '123456';
      
      if (email === expectedEmail && password === expectedPassword) {
        try {
          // Firebase 이메일 로그인 시도 - 실패해도 진행
          try {
            await signInWithEmail(email, password);
            console.log('Firebase 이메일 인증 성공');
          } catch (authErr) {
            console.error('Firebase 인증 실패 - 네트워크 문제로 인해 오프라인 모드로 진행:', authErr);
            // 인증 실패해도 계속 진행
          }
          
          // 인증 성공 시 쿠키 설정
          Cookies.set('adminAuth', 'true', { 
            expires: 1, // 1일 후 만료
            path: '/',  // 모든 경로에서 접근 가능
            sameSite: 'strict' // CSRF 방지
          });
          
          // 사용자 정보 쿠키에 저장
          Cookies.set('adminEmail', email, { 
            expires: 1,
            path: '/',
            sameSite: 'strict'
          });
          
          setIsLoading(false);
          toast.success('로그인 성공!');
          
          // 강제 페이지 이동 (Next.js router가 아닌 window.location 사용)
          window.location.href = '/admin/dashboard';
        } catch (error) {
          console.error('로그인 처리 중 오류:', error);
          setError('로그인 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
          setIsLoading(false);
        }
      } else {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('로그인 중 오류:', error);
      setError('로그인 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">관리자 로그인</h1>
        {error && <p className="text-red-500 mb-4 text-center">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full ${isLoading ? 'bg-gray-500' : 'bg-black hover:bg-gray-800'} text-white p-2 rounded transition-colors`}
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}