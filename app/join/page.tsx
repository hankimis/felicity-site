"use client";
import { useState } from "react";

export default function Join() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [trafficSource, setTrafficSource] = useState("");
  const [callTime, setCallTime] = useState("");
  const [referralCode, setReferralCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 사용자가 입력한 데이터를 콘솔에 출력
    console.log("사용자 입력 데이터:", {
      성함: name,
      연락처: phone,
      생년월일: birthDate,
      유입경로: trafficSource,
      통화가능시간: callTime,
      추천인코드: referralCode || "없음",
    });

    alert("가입 신청 완료! 콘솔에서 데이터를 확인하세요.");
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

        <button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-lg font-bold">
          가입 신청하기 
        </button>
      </form>
    </div>
  );
}
