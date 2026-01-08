import { google } from "googleapis";
import path from "path";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(process.cwd(), "service-account.json"),
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    const drive = google.drive({ version: "v3", auth });

    // 1. 휴지통 비우기 (가장 중요 - 용량 확보의 핵심)
    try {
      console.log("🗑️ 휴지통 비우기 시도...");
      await drive.files.emptyTrash();
      console.log("✅ 휴지통 비우기 성공");
    } catch (e: any) {
      console.log("⚠️ 휴지통 비우기 실패 (이미 비어있거나 권한 문제):", e.message);
    }

    // 2. 파일 목록 조회 (조건: 내가 주인인 파일만 조회)
    // ★ 'me' in owners 조건이 핵심입니다! 남의 파일은 건드리지 않습니다.
    const list = await drive.files.list({
      q: "'me' in owners and trashed = false",
      pageSize: 100,
      fields: "files(id, name)",
    });

    const files = list.data.files || [];
    if (files.length === 0) {
      return NextResponse.json({ message: "지울 파일이 없습니다. (휴지통만 비웠을 수 있음)" });
    }

    // 3. 파일 삭제 (안전하게 하나씩)
    let count = 0;
    let errors = 0;

    for (const file of files) {
      try {
        if (file.id) {
          await drive.files.delete({ fileId: file.id });
          console.log(`❌ 삭제됨: ${file.name}`);
          count++;
        }
      } catch (err: any) {
        console.error(`⚠️ 삭제 실패 (${file.name}):`, err.message);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `청소 완료! 삭제: ${count}개, 실패: ${errors}개`,
    });
  } catch (error: any) {
    console.error("Clean Drive Critical Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
