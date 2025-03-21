"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { useSearchParams } from "next/navigation";

export default function UserDetail() {
  const [user, setUser] = useState<any>(null);
  const searchParams = useSearchParams();
  const userId = searchParams.get("id");

  useEffect(() => {
    if (userId) fetchUser();
  }, [userId]);

  const fetchUser = async () => {
    const docRef = doc(db, "users", userId!);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      setUser(docSnap.data());
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <h1 className="text-3xl font-bold mb-6">가입 신청자 상세 정보</h1>
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-lg">
        {user ? (
          <>
            <p><strong>이름:</strong> {user.name}</p>
            <p><strong>연락처:</strong> {user.phone}</p>
            <p><strong>생년월일:</strong> {user.birthDate}</p>
          </>
        ) : (
          <p className="text-gray-500">신청자 정보를 불러오는 중...</p>
        )}
      </div>
    </div>
  );
}
