// app/admin/layout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const isAuthed = Cookies.get('adminAuth');
    if (isAuthed !== 'true') {
      router.replace('/admin/login');
    }
  }, [router]);

  return <>{children}</>;
}
