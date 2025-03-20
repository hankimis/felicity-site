import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      {/* 헤더 */}
      <header className="w-full bg-black text-white p-6 flex flex-col items-center">
        {/* 회사 로고 */}
        <Image src="/logo.png" alt="Felicity Logo" width={150} height={70} priority />
        <h1 className="text-2xl font-bold mt-2">펠리시티 가입 이벤트 </h1>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="flex flex-col items-center text-center p-6">
        <h1 className="text-3xl font-bold mb-4">
          <span className="text-blue-500"> 가입만 해도 최대 10만원 지급!</span>!
        </h1>
        <p className="text-lg text-gray-400 mb-6">
          친구 초대하면 추가 보너스! 지금 바로 참여하세요.
        </p>

        {/* 가입 버튼 */}
        <a href="/join" className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg text-lg font-bold shadow-md mb-4">
          가입 신청하기 →
        </a>

        {/* 후기 이벤트 신청 섹션 */}
        <div className="bg-white p-6 shadow-md rounded-lg w-full max-w-lg mt-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">후기 이벤트 신청</h2>
          <p className="text-gray-600 mb-4">후기를 작성하고 추가 보상을 받아보세요!</p>

          {/* 후기 이벤트 버튼들 */}
          <div className="grid grid-cols-1 gap-4">
            <a href="/review/cafe" className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-bold block text-center">
              카페 후기 신청 
            </a>
            <a href="/review/blog" className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-lg font-bold block text-center">
              블로그 후기 신청 
            </a>
            <a href="/review/instagram" className="bg-pink-500 hover:bg-pink-600 text-white px-6 py-3 rounded-lg font-bold block text-center">
              인스타 후기 신청 
            </a>
          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="w-full bg-gray-900 text-white p-4 text-center">
        © 2025 Felicity. All rights reserved.
      </footer>
    </div>
  );
}
