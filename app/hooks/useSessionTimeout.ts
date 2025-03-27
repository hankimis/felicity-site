import { useEffect } from 'react';

export const useSessionTimeout = (timeout: number, onTimeout: () => void) => {
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const resetTimeout = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(onTimeout, timeout);
    };

    // Reset timeout on user activity
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, resetTimeout);
    });

    // Initial timeout setup
    resetTimeout();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetTimeout);
      });
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeout, onTimeout]);
}; 