"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]); // ✅ 가입 신청자 목록을 저장할 상태

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => { // ✅ Firestore에서 데이터 가져오는 함수
    try {
      const querySnapshot = await getDocs(collection(db, "users")); // Firestore의 "users" 컬렉션 가져오기
      const usersList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(usersList);
    } catch (error) {
      console.error("데이터를 불러오는 중 오류 발생:", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <h1 className="text-3xl font-bold mb-6">가입 신청자 목록</h1>
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-2xl">
        {users.length === 0 ? (
          <p className="text-gray-500 text-center">가입한 사용자가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-300">
            {users.map((user) => (
              <li key={user.id} className="p-3 flex justify-between">
                <span className="font-semibold">{user.name}</span>
                <span className="text-gray-600">{user.phone}</span>
                <span className="text-gray-500">{user.birthDate}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
