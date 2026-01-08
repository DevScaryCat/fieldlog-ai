import { google } from "googleapis";
import path from "path";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const keyPath = path.join(process.cwd(), "service-account.json");
    const auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    const drive = google.drive({ version: "v3", auth });

    // 1. 현재 계정 정보 및 용량 조회
    const about = await drive.about.get({
      fields: "user, storageQuota",
    });

    const quota = about.data.storageQuota;
    const user = about.data.user;

    // 용량 계산 (MB 단위)
    const limit = parseInt(quota?.limit || "0");
    const usage = parseInt(quota?.usage || "0");
    const free = limit - usage;

    return NextResponse.json({
      who_am_i: user?.emailAddress, // 현재 작동 중인 이메일
      total_limit: `${(limit / 1024 / 1024 / 1024).toFixed(2)} GB`, // 전체 용량
      used: `${(usage / 1024 / 1024).toFixed(2)} MB`, // 사용량
      remaining: `${(free / 1024 / 1024 / 1024).toFixed(2)} GB`, // 남은 용량
      is_full: usage >= limit, // 꽉 찼는지 여부
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
