// /middleware.ts

import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // 1. 미들웨어용 Supabase 클라이언트 생성
  const supabase = createMiddlewareClient({ req, res });

  // 2. 현재 로그인 세션 정보 가져오기
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;

  // 3. 로그인한 사용자가 /login 페이지 접근 시:
  //    -> 메인 페이지(/)로 강제 이동
  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // 4. 로그인하지 않은 사용자가 /login이 아닌 페이지 접근 시:
  //    -> /login 페이지로 강제 이동 (메인 페이지 보호)
  if (!session && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return res;
}

// 미들웨어를 적용할 경로 설정
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - auth/callback (Supabase auth callback)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|auth/callback).*)",
  ],
};
