'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function ReviewStepPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [account, setAccount] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!name || !phone || !account) {
      setError('모든 정보를 입력해주세요.');
      setLoading(false);
      return;
    }

    try {
      const q = query(
        collection(db, 'joinUsers'),
        where('name', '==', name),
        where('phone', '==', phone),
        where('approved', '==', true)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError('승인된 가입자가 아닙니다. 관리자에게 문의해주세요.');
        setLoading(false);
        return;
      }

      localStorage.setItem('reviewUserInfo', JSON.stringify({ name, phone, account }));
      router.push('/review/select');
    } catch (err) {
      console.error('승인 확인 오류:', err);
      setError('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-6 text-green-600">후기 신청 정보 입력</h1>

      <form onSubmit={handleSubmit} className="bg-white shadow-lg rounded-lg p-6 w-full max-w-md">
        <label className="block mb-2 text-gray-700">성함</label>
        <input type="text" className="w-full p-2 border rounded-lg mb-4" value={name} onChange={(e) => setName(e.target.value)} required />

        <label className="block mb-2 text-gray-700">연락처</label>
        <input type="tel" className="w-full p-2 border rounded-lg mb-4" value={phone} onChange={(e) => setPhone(e.target.value)} required />

        <label className="block mb-2 text-gray-700">계좌번호</label>
        <input type="text" className="w-full p-2 border rounded-lg mb-4" value={account} onChange={(e) => setAccount(e.target.value)} required />

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <button
          type="submit"
          className="w-full bg-green-500 hover:bg-green-600 text-white p-3 rounded-lg font-bold"
          disabled={loading}
        >
          {loading ? '확인 중...' : '후기 작성하러 가기'}
        </button>
      </form>
    </div>
  );
}