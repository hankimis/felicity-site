"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useSearchParams, useRouter } from "next/navigation";

export default function ApproveUser() {
  const [user, setUser] = useState<any>(null);
  const searchParams = useSearchParams();
  const userId = searchParams.get("id");
  const router = useRouter();

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

  const handleApproval = async (status: string) => {
    if (!userId) return;
    const docRef = doc(db, "users", userId);
    await updateDoc(docRef, { status });
    alert(`가입 신청이 ${status === "approved" ? "승인" : "거절"}되었습니다.`);
    router.push("/admin/dashboard");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <h1 className="text-3xl font-bold mb-6">가입 승인 / 거절</h1>
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-lg">
        {user ? (
          <>
            <p><strong>이름:</strong> {user.name}</p>
            <p><strong>연락처:</strong> {user.phone}</p>
            <p><strong>생년월일:</strong> {user.birthDate}</p>
            <div className="flex gap-4 mt-4">
              <button
                onClick={() => handleApproval("approved")}
                className="bg-green-500 text-white p-2 rounded-lg"
              >
                승인
              </button>
              <button
                onClick={() => handleApproval("rejected")}
                className="bg-red-500 text-white p-2 rounded-lg"
              >
                거절
              </button>
            </div>
          </>
        ) : (
          <p className="text-gray-500">신청자 정보를 불러오는 중...</p>
        )}
      </div>
    </div>
  );
}
