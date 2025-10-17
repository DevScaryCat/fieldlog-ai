// /app/page.tsx

'use client'; // <-- 1. 클라이언트 컴포넌트로 전환

import { supabase } from '@/lib/supabaseClient'; // 2. Supabase 클라이언트 임포트
import { useRouter } from 'next/navigation'; // 3. 리디렉션을 위한 라우터 임포트

export default function Home() {
  const router = useRouter(); // 4. 라우터 초기화

  // 5. 로그아웃 핸들러 함수
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login'); // 로그아웃 후 로그인 페이지로 이동
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-24">
      {/* Vercel-style Spectrum Gradient (이전과 동일) */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full
          bg-[conic-gradient(from_0deg_at_50%_50%,#00c4ff_0%,#00ff95_25%,#fffb00_50%,#ff0000_75%,#00c4ff_100%)]
          opacity-20 blur-3xl"
        />
      </div>

      {/* Content (Above the gradient) */}
      <div className="z-10 flex flex-col items-center">
        <h1 className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-center text-5xl font-extrabold text-transparent">
          FieldLog AI
        </h1>
        <p className="mt-4 max-w-lg text-center text-lg text-slate-300">
          AI 기반 위험성 평가 보고서 자동화 솔루션. 현장의 목소리가
          보고서가 됩니다.
        </p>

        {/* --- 6. 로그아웃 버튼 추가 --- */}
        <button
          onClick={handleLogout}
          className="mt-8 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-colors
           hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
           focus:ring-offset-slate-950"
        >
          로그아웃
        </button>
        {/* --------------------------- */}
      </div>
    </main>
  );
}