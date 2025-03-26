'use client';

import { useState } from 'react';
import { db } from '../lib/firebase'; // ✅ 수정된 부분
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export default function ReviewAccessPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCheckApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const q = query(
        collection(db, 'joinUsers'),
        where('name', '==', name),
        where('phone', '==', phone)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('해당 정보로 가입된 사용자를 찾을 수 없습니다.');
      } else {
        const userData = querySnapshot.docs[0].data();
        if (userData.approved) {
          // 승인된 사용자 → 후기 선택 페이지로 이동
          router.push('/review/select');
        } else {
          setError('아직 승인이 완료되지 않았습니다.');
        }
      }
    } catch (err) {
      console.error(err);
      setError('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-6 text-green-600">후기 신청 확인</h1>

      <form onSubmit={handleCheckApproval} className="bg-white shadow-lg rounded-lg p-6 w-full max-w-md">
        <label className="block mb-2 text-gray-700">성함</label>
        <input type="text" className="w-full p-2 border rounded-lg mb-4" value={name} onChange={(e) => setName(e.target.value)} required />

        <label className="block mb-2 text-gray-700">연락처</label>
        <input type="tel" className="w-full p-2 border rounded-lg mb-4" value={phone} onChange={(e) => setPhone(e.target.value)} required />

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <button type="submit" disabled={loading} className="w-full bg-green-500 hover:bg-green-600 text-white p-3 rounded-lg font-bold">
          {loading ? '확인 중...' : '후기 작성하러 가기'}
        </button>
      </form>
    </div>
  );
}
