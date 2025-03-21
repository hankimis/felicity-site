"use client";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebaseConfig";
import { useRouter } from "next/navigation";

export default function AdminSettings() {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    alert("로그아웃되었습니다.");
    router.push("/admin/login");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <h1 className="text-3xl font-bold mb-6">관리자 설정</h1>
      <button onClick={handleLogout} className="bg-red-500 text-white p-3 rounded-lg">
        로그아웃
      </button>
    </div>
  );
}
