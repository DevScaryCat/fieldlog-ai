// /app/api/transcribe/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceRoleClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";

export const config = {
  maxDuration: 300, // 긴 파일 처리(Polling)를 위해 5분으로 설정
};

// 1. 필요한 클라이언트 및 API URL 모두 정의
const supabaseAdmin = createServiceRoleClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// "짧은" 음성 API (CSR) - 파일 직접 전송
const NAVER_CSR_API_URL = "https://naveropenapi.apigw.ntruss.com/recog/v1/stt?lang=ko-KR";
// "긴" 음성 API (CLOVA Speech) - URL 전송
const NAVER_LONG_SPEECH_API_URL = `${process.env.NCP_CLOVA_SPEECH_INVOKE_URL}/recognizer/upload`;

// 2. STT (음성 변환) 로직을 별도 함수로 분리
async function transcribeAudio(audioFile: File, duration: number, assessmentId: string): Promise<string> {
  let transcript = "";

  if (duration < 60) {
    // --- 60초 미만: "짧은 음성 API" (CSR) 사용 ---
    console.log(`[AI Pipeline] Using SHORT API (CSR) for ${duration}s file...`);

    const audioBuffer = await audioFile.arrayBuffer();
    const response = await fetch(NAVER_CSR_API_URL, {
      method: "POST",
      headers: {
        "X-NCP-APIGW-API-KEY-ID": process.env.NCP_CLIENT_ID!,
        "X-NCP-APIGW-API-KEY": process.env.NCP_CLIENT_SECRET!,
        "Content-Type": "application/octet-stream",
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CSR API (Short) Error: ${errorText}`);
    }
    const result = await response.json();
    transcript = result.text;
    console.log("[AI Pipeline] SHORT API (CSR) Complete.");
  } else {
    // --- 60초 이상: "긴 음성 API" (CLOVA Speech) 사용 ---
    console.log(`[AI Pipeline] Using LONG API (CLOVA Speech) for ${duration}s file...`);

    // 1. 파일 업로드
    const audioFileName = `${assessmentId}/${uuidv4()}.${audioFile.name.split(".").pop()}`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("findings")
      .upload(audioFileName, audioFile);
    if (uploadError) throw new Error(`오디오 업로드 실패 (Long): ${uploadError.message}`);

    // 2. 공개 URL 가져오기
    const { data: publicUrlData } = supabaseAdmin.storage.from("findings").getPublicUrl(uploadData.path);
    const fileDownloadUrl = publicUrlData.publicUrl;

    // 3. 작업(Job) 제출
    const jobResponse = await fetch(NAVER_LONG_SPEECH_API_URL, {
      method: "POST",
      headers: {
        "X-CLOVA-API-KEY": process.env.NCP_CLOVA_SPEECH_SECRET_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ language: "ko-KR", url: fileDownloadUrl, completion: "sync" }),
    });

    if (!jobResponse.ok) throw new Error(`CLOVA Speech API (Long) Error: ${await jobResponse.text()}`);

    const jobResult = await jobResponse.json();
    transcript = jobResult.text;
    console.log("[AI Pipeline] LONG API (CLOVA Speech) Complete.");
  }

  return transcript;
}

// 3. 메인 POST 핸들러
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audioFile") as File | null;
    const assessmentId = formData.get("assessmentId") as string | null;
    const durationStr = formData.get("duration") as string | null;

    if (!audioFile || !assessmentId || !durationStr) {
      return NextResponse.json({ error: "Audio, Assessment ID, Duration이 모두 필요합니다." }, { status: 400 });
    }

    const duration = parseFloat(durationStr);

    // [Step 1: STT] 스마트 분기 로직 호출
    const transcript = await transcribeAudio(audioFile, duration, assessmentId);

    // STT 성공 후 DB에 대본 및 상태 업데이트
    await supabaseAdmin
      .from("assessments")
      .update({
        transcript: transcript,
        status: "completed", // AI 분석 대기 상태 (또는 'analyzing')
      })
      .eq("id", assessmentId);
    console.log("[AI Pipeline] Transcript saved to DB.");

    // [Step 2: LLM] Claude 분석 파이프라인 호출 (이전과 동일)
    console.log("[AI Pipeline] Analysis API (Claude) triggered.");
    // (에러 처리를 위해 await 추가)
    const analyzeResponse = await fetch(`${new URL(req.url).origin}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assessmentId }),
    });

    if (!analyzeResponse.ok) {
      throw new Error(`Claude 분석 API 호출 실패: ${await analyzeResponse.text()}`);
    }

    console.log("[AI Pipeline] Analysis complete.");
    return NextResponse.json({ message: "Analysis complete" });
  } catch (error: any) {
    console.error("🔥🔥🔥 [API Transcribe] 전체 프로세스 실패! 원인:", error);
    // 실패 시에도 assessmentId가 있다면 상태를 'failed'로 업데이트 시도
    const formData = await req.formData(); // body가 소비되었을 수 있으므로 재시도 (권장되진 않음)
    const assessmentId = formData.get("assessmentId") as string | null;
    if (assessmentId) {
      await supabaseAdmin
        .from("assessments")
        .update({ status: "failed", error_message: error.message })
        .eq("id", assessmentId);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
