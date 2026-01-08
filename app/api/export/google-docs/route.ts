import { NextRequest, NextResponse } from "next/server";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { Readable } from "stream";

// 1. Supabase 클라이언트 설정
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// 2. ★ 사장님(2TB 계정) 인증 정보 (로그에서 추출한 값 적용 완료) ★

// 3. OAuth2 클라이언트 생성 (만능 열쇠 장착)
const oauth2Client = new google.auth.OAuth2(
  process.env.OAUTH_CLIENT_ID!,
  process.env.OAUTH_CLIENT_SECRET!,
  "https://developers.google.com/oauthplayground"
);

// 리프레시 토큰 설정
oauth2Client.setCredentials({ refresh_token: process.env.OAUTH_REFRESH_TOKEN! });

export async function POST(req: NextRequest) {
  try {
    const { assessmentId } = await req.json();

    if (!assessmentId) {
      return NextResponse.json({ success: false, error: "Assessment ID is missing" }, { status: 400 });
    }

    // 4. DB 조회
    const { data: assessment, error } = await supabase
      .from("assessments")
      .select(
        `
        *,
        companies(name),
        assessment_results(
          result_value, 
          legal_basis, 
          solution,
          template_item_id
        )
      `
      )
      .eq("id", assessmentId)
      .single();

    if (error || !assessment) throw new Error("데이터 조회 실패: " + error?.message);

    // 5. 데이터 가공
    const reportData = {
      company_name: assessment.companies?.name || "미지정 사업장",
      date: new Date(assessment.assessment_date).toLocaleDateString(),
      results: assessment.assessment_results.map((r: any, index: number) => ({
        no: index + 1,
        unit_work: r.result_value || "-",
        amount: "1일 3회",
        burden: "허리 굽힘",
        load: "3",
        freq: "2",
        score: "6",
        check: r.solution ? "완료" : "대상",
      })),
    };

    // 6. 워드 템플릿 로드
    const templatePath = path.join(process.cwd(), "public", "templates", "report_template.docx");

    if (!fs.existsSync(templatePath)) {
      throw new Error(`템플릿 파일을 찾을 수 없습니다: ${templatePath}`);
    }

    const content = fs.readFileSync(templatePath, "binary");
    const zip = new PizZip(content);

    // 7. Docxtemplater 초기화 (괄호 [[ ]] 사용)
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "[[", end: "]]" },
      parser: function (tag) {
        return {
          get: function (scope, context) {
            if (tag === ".") return scope;
            if (scope && scope[tag] !== undefined && scope[tag] !== null) {
              return scope[tag];
            }
            return "";
          },
        };
      },
    });

    doc.render(reportData);
    const buf = doc.getZip().generate({ type: "nodebuffer" });

    // 8. ★ 구글 드라이브 업로드 (사장님 권한 사용)
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    const fileMetadata = {
      name: `[결과보고서] ${reportData.company_name}_${reportData.date}`,
      mimeType: "application/vnd.google-apps.document",
      // ★ 사용자님의 2TB 폴더 ID
      parents: ["17xgGK1fxYpSZiJnAw9eWI7WTAHpCDs7t"],
    };

    const media = {
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      body: Readable.from(buf),
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, webViewLink",
    });

    console.log("✅ 구글 닥스 생성 성공 (OAuth 사용):", file.data.webViewLink);

    return NextResponse.json({
      success: true,
      fileId: file.data.id,
      link: file.data.webViewLink,
    });
  } catch (error: any) {
    console.error("Upload Error:", error);

    if (error.properties && error.properties.errors) {
      error.properties.errors.forEach((e: any) => {
        console.error("Detail:", e);
      });
    }

    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
