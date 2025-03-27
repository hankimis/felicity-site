'use client';

import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, Firestore } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export default function InstagramReview() {
  const [url, setUrl] = useState('');
  const [userInfo, setUserInfo] = useState<{ name: string; phone: string; account: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem('reviewUserInfo');
    if (saved) setUserInfo(JSON.parse(saved));
    else router.push('/review-access');
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!userInfo) return;
    if (!url || !url.includes('http')) {
      setError('올바른 링크를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      if (!db) {
        throw new Error('데이터베이스 연결에 실패했습니다.');
      }

      await addDoc(collection(db as Firestore, 'instagramReviews'), {
        name: userInfo.name,
        phone: userInfo.phone,
        account: userInfo.account,
        reviewLink: url,
        createdAt: new Date().toISOString(),
      });
      alert('인스타 후기 제출이 완료되었습니다!');
      router.push('/');
    } catch (err) {
      console.error(err);
      setError('후기 제출 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-6 text-pink-600">인스타그램 후기 신청</h1>

      <form onSubmit={handleSubmit} className="bg-white shadow-lg rounded-lg p-6 w-full max-w-md">
        <label className="block mb-2 text-gray-700">인스타 후기 링크</label>
        <input
          type="url"
          className="w-full p-2 border rounded-lg mb-4"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <button
          type="submit"
          className="w-full bg-pink-500 hover:bg-pink-600 text-white p-3 rounded-lg font-bold"
          disabled={loading}
        >
          {loading ? '제출 중...' : '후기 제출하기'}
        </button>
      </form>
    </div>
  );
}
