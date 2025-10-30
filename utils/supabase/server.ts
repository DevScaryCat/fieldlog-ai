// /utils/supabase/server.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// 함수를 async로 변경합니다.
export async function createClient() {
  // cookies() 함수 호출을 await 합니다.
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get(name: string) {
        // 이제 cookieStore는 정상적인 객체입니다.
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch (error) {
          // 서버 컴포넌트에서 set 시도 시 에러 발생 가능
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch (error) {
          // 서버 컴포넌트에서 set 시도 시 에러 발생 가능
        }
      },
    },
  });
}
