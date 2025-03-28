import { useEffect, useRef } from 'react';
import Cookies from 'js-cookie';

export const useSessionTimeout = (timeout: number, onTimeout: () => void) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    const resetTimeout = () => {
      // 이전 타이머 취소
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // 활동 시간 업데이트
      lastActivityRef.current = Date.now();
      
      // 관리자 쿠키 갱신 (있는 경우에만)
      const adminEmail = Cookies.get('adminEmail');
      if (adminEmail) {
        Cookies.set('adminAuth', 'true', { expires: 1 }); // 1일 유지
        Cookies.set('adminEmail', adminEmail, { expires: 1 });
      }
      
      // 새 타이머 설정
      timeoutRef.current = setTimeout(() => {
        // 실제 비활성 시간 확인
        const inactiveTime = Date.now() - lastActivityRef.current;
        if (inactiveTime >= timeout) {
          console.log('세션 타임아웃 발생:', inactiveTime);
          onTimeout();
        } else {
          // 아직 활동 중이면 타이머 재설정
          resetTimeout();
        }
      }, timeout);
    };

    // Reset timeout on user activity
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, resetTimeout);
    });
    
    // 페이지 포커스 이벤트도 처리
    window.addEventListener('focus', resetTimeout);

    // Initial timeout setup
    resetTimeout();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetTimeout);
      });
      window.removeEventListener('focus', resetTimeout);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [timeout, onTimeout]);
}; 