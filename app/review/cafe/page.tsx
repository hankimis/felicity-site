"use client";
import { useState } from "react";

export default function CafeReview() {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`카페 후기 제출 완료! \nURL: ${url}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-6 text-green-600">카페 후기 신청 </h1>

      <form onSubmit={handleSubmit} className="bg-white shadow-lg rounded-lg p-6 w-full max-w-md">
        <label className="block mb-2 text-gray-700">카페 후기 링크</label>
        <input
          type="text"
          className="w-full p-2 border rounded-lg mb-4"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />

        <button type="submit" className="w-full bg-green-500 hover:bg-green-600 text-white p-3 rounded-lg font-bold">
          후기 제출하기 🚀
        </button>
      </form>
    </div>
  );
}
