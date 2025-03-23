'use client';
import { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

export default function Join() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [trafficSource, setTrafficSource] = useState('');
  const [callTime, setCallTime] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newUser = {
      name,
      phone,
      birthDate,
      trafficSource,
      callTime,
      referralCode: referralCode || '없음',
      createdAt: new Date().toISOString(),
    };

    try {
      setLoading(true);
      await addDoc(collection(db, 'joinUsers'), newUser); // Firestore에 저장
      alert('가입 신청이 완료되었습니다!');
      setName('');
      setPhone('');
      setBirthDate('');
      setTrafficSource('');
      setCallTime('');
      setReferralCode('');
    } catch (error) {
      console.error('Error saving to Firestore:', error);
      alert('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-6 text-blue-600">펠리시티 가입 신청</h1>

      <form onSubmit={handleSubmit} className="bg-white shadow-lg rounded-lg p-6 w-full max-w-md">
        <label className="block mb-2 text-gray-700">성함</label>
        <input type="text" className="w-full p-2 border rounded-lg mb-4" value={name} onChange={(e) => setName(e.target.value)} required />

        <label className="block mb-2 text-gray-700">연락처</label>
        <input type="tel" className="w-full p-2 border rounded-lg mb-4" value={phone} onChange={(e) => setPhone(e.target.value)} required />

        <label className="block mb-2 text-gray-700">생년월일</label>
        <input type="date" className="w-full p-2 border rounded-lg mb-4" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />

        <label className="block mb-2 text-gray-700">유입경로</label>
        <select className="w-full p-2 border rounded-lg mb-4" value={trafficSource} onChange={(e) => setTrafficSource(e.target.value)} required>
          <option value="">유입경로 선택</option>
          <option value="Google 검색">Google 검색</option>
          <option value="네이버 검색">네이버 검색</option>
          <option value="SNS 광고">SNS 광고</option>
          <option value="지인 추천">지인 추천</option>
          <option value="기타">기타</option>
        </select>

        <label className="block mb-2 text-gray-700">통화 가능 시간</label>
        <select className="w-full p-2 border rounded-lg mb-4" value={callTime} onChange={(e) => setCallTime(e.target.value)} required>
          <option value="">시간 선택</option>
          <option value="09:00 - 10:00">09:00 - 10:00</option>
          <option value="10:00 - 11:00">10:00 - 11:00</option>
          <option value="11:00 - 12:00">11:00 - 12:00</option>
          <option value="13:00 - 14:00">13:00 - 14:00</option>
          <option value="14:00 - 15:00">14:00 - 15:00</option>
          <option value="15:00 - 16:00">15:00 - 16:00</option>
          <option value="16:00 - 17:00">16:00 - 17:00</option>
        </select>

        <label className="block mb-2 text-gray-700">추천인 코드 (선택)</label>
        <input type="text" className="w-full p-2 border rounded-lg mb-4" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} />

        <button
          type="submit"
          className="w-full bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-lg font-bold disabled:opacity-50"
          disabled={loading}
        >
          {loading ? '처리 중...' : '가입 신청하기'}
        </button>
      </form>
    </div>
  );
}
