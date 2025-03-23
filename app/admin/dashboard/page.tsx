'use client';

import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { exportToExcel } from '../../lib/exportExcel';

export default function AdminReviewDashboard() {
  const [tab, setTab] = useState<'join' | 'cafe' | 'blog' | 'instagram'>('join');
  const [users, setUsers] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const fetchJoinUsers = async () => {
      const snapshot = await getDocs(collection(db, 'joinUsers'));
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(list);
    };

    const fetchReviews = async () => {
      const snapshot = await getDocs(collection(db, `${tab}Reviews`));
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReviews(list);
    };

    if (tab === 'join') fetchJoinUsers();
    else fetchReviews();
  }, [tab]);

  const approveUser = async (id: string) => {
    const userRef = doc(db, 'joinUsers', id);
    await updateDoc(userRef, { approved: true });
    setUsers(prev => prev.map(user => user.id === id ? { ...user, approved: true } : user));
  };

  const filterData = (list: any[]) => {
    return list.filter(item => {
      const matchText = search === '' || item.name?.includes(search) || item.phone?.includes(search);
      const matchStart = startDate ? new Date(item.createdAt) >= new Date(startDate) : true;
      const matchEnd = endDate ? new Date(item.createdAt) <= new Date(endDate) : true;
      return matchText && matchStart && matchEnd;
    });
  };

  const exportData = () => {
    const data = tab === 'join' ? filterData(users) : filterData(reviews);
    exportToExcel(data, tab === 'join' ? '가입신청자' : `${tab}후기`);
  };

  const dataToShow = tab === 'join' ? filterData(users) : filterData(reviews);

  return (
    <div className="min-h-screen p-6 bg-gray-100">
      <h1 className="text-3xl font-bold mb-4">관리자 대시보드</h1>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('join')} className={tab === 'join' ? activeTab : tabStyle}>가입 신청자</button>
        <button onClick={() => setTab('cafe')} className={tab === 'cafe' ? activeTab : tabStyle}>카페 후기</button>
        <button onClick={() => setTab('blog')} className={tab === 'blog' ? activeTab : tabStyle}>블로그 후기</button>
        <button onClick={() => setTab('instagram')} className={tab === 'instagram' ? activeTab : tabStyle}>인스타 후기</button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 text-sm">
        <input type="text" placeholder="이름 또는 연락처 검색" value={search} onChange={e => setSearch(e.target.value)} className="p-2 border rounded w-60" />
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded" />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded" />
        <button onClick={exportData} className="bg-black text-white px-3 py-2 rounded hover:bg-gray-800">엑셀 다운로드</button>
      </div>

      {tab === 'join' ? (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-xl font-semibold mb-3">가입 신청자 ({dataToShow.length}명)</h2>
          {dataToShow.length === 0 ? (
            <p className="text-gray-500">신청 내역이 없습니다.</p>
          ) : (
            <ul className="space-y-3">
              {dataToShow.map(user => (
                <li key={user.id} className="border-b pb-3 text-sm text-gray-800">
                  <div><strong>이름:</strong> {user.name}</div>
                  <div><strong>연락처:</strong> {user.phone}</div>
                  <div><strong>생년월일:</strong> {user.birthDate}</div>
                  <div><strong>유입경로:</strong> {user.trafficSource}</div>
                  <div><strong>통화 가능 시간:</strong> {user.callTime}</div>
                  <div><strong>추천인 코드:</strong> {user.referralCode}</div>
                  <div className="text-xs text-gray-400 mt-1">신청일: {new Date(user.createdAt).toLocaleString()}</div>
                  <div className="mt-2">
                    <strong>승인 상태:</strong>{' '}
                    {user.approved ? (
                      <span className="text-green-600 font-semibold">승인됨</span>
                    ) : (
                      <button
                        onClick={() => approveUser(user.id)}
                        className="ml-2 bg-black text-white px-3 py-1 rounded hover:bg-gray-800"
                      >
                        승인하기
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-xl font-semibold mb-3">{tab.toUpperCase()} 후기 ({dataToShow.length}건)</h2>
          {dataToShow.length === 0 ? (
            <p className="text-gray-500">신청 내역이 없습니다.</p>
          ) : (
            <ul className="space-y-3">
              {dataToShow.map((item, i) => (
                <li key={i} className="border-b pb-3 text-sm text-gray-800">
                  <div><strong>이름:</strong> {item.name}</div>
                  <div><strong>연락처:</strong> {item.phone}</div>
                  <div><strong>계좌번호:</strong> {item.account}</div>
                  <div><strong>링크:</strong> <a href={item.reviewLink} target="_blank" className="text-blue-600 underline">{item.reviewLink}</a></div>
                  <div className="text-xs text-gray-400 mt-1">신청일: {new Date(item.createdAt).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const tabStyle = 'px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm';
const activeTab = 'px-4 py-2 bg-black text-white rounded text-sm';
