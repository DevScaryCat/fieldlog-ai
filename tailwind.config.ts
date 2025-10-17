// /tailwind.config.ts

import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class", // 다크 모드 활성화
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-pretendard)", "system-ui", "sans-serif"], // 기본 폰트를 Pretendard로
      },
    },
  },
  plugins: [],
};
export default config;
