// /app/(dashboard)/page.tsx

export default function Home() {
  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center overflow-hidden rounded-lg">
      {/* Vercel-style Spectrum Gradient */}
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
      </div>
    </div>
  );
}