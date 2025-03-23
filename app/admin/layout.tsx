// app/admin/layout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const isAuthed = localStorage.getItem('adminAuth');
    if (!isAuthed) {
      router.replace('/admin/login');
    }
  }, []);

  return <>{children}</>;
}
