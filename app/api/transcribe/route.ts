// /app/api/transcribe/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceRoleClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
// Deepgram SDK 임포트 제거

export const maxDuration = 300;

const supabaseAdmin = createServiceRoleClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Deepgram API URL 직접 정의
const DEEPGRAM_API_URL = "https://api.deepgram.com/v1/listen?model=nova-2&language=ko&smart_format=true&diarize=true";

// --- 헬퍼 함수 1: STT (Deepgram - fetch 사용) ---
async function transcribeAudio(audioFile: File): Promise<string | null> {
  console.log(`[AI Pipeline] Using Deepgram API (fetch) for file: ${audioFile.name}`);

  const audioBuffer = await audioFile.arrayBuffer();

  // 1. (핵심 수정) 파일 확장자를 기반으로 MIME Type을 직접 결정합니다.
  //    File.type이 가끔 부정확할 수 있기 때문에, 확장자가 더 확실합니다.
  let mimeType = audioFile.type;
  const ext = audioFile.name.split(".").pop()?.toLowerCase();

  if (ext === "mp3") mimeType = "audio/mpeg";
  else if (ext === "wav") mimeType = "audio/wav";
  else if (ext === "m4a") mimeType = "audio/mp4";
  else if (ext === "webm") mimeType = "audio/webm";

  // 만약 여전히 타입이 없다면 Deepgram이 알아서 하도록 헤더를 생략하거나 일반 타입 사용
  if (!mimeType) mimeType = "audio/*";

  console.log(`[AI Pipeline] Determining MIME type for Deepgram: ${mimeType}`);

  const response = await fetch(DEEPGRAM_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY!}`,
      "Content-Type": mimeType, // 결정된 MIME Type 사용
    },
    body: audioBuffer,
  });

  if (!response.ok) {
    const errorBody = await response.json();
    throw new Error(`Deepgram STT Error: ${errorBody.err_msg || errorBody.reason || "Unknown error"}`);
  }

  const result = await response.json();
  const transcript = result.results?.channels[0]?.alternatives[0]?.transcript;

  if (!transcript || transcript.trim().length === 0) {
    console.log("[AI Pipeline] No speech detected.");
    return null;
  }

  console.log("[AI Pipeline] Deepgram STT Complete.");
  return transcript;
}

// --- 헬퍼 함수 2: LLM (양식 채우기 - Claude) ---
async function analyzeTranscript(assessmentId: string, transcript: string): Promise<void> {
  const { data: assessmentData, error: fetchError } = await supabaseAdmin
    .from("assessments")
    .select(
      `
      id,
      assessment_templates (
        template_name,
        template_items (id, header_name, sort_order, parent_id)
      ),
      findings (id, photo_before_url, timestamp_seconds)
    `
    )
    .eq("id", assessmentId)
    .single();

  if (fetchError) throw new Error(`DB 조회 실패: ${fetchError.message}`);

  const templateItems = (assessmentData.assessment_templates.template_items || []).sort(
    (a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)
  );
  const findings = assessmentData.findings || [];

  const prompt = `
    당신은 베테랑 안전 컨설턴트의 AI 비서입니다.
    [현장 녹음 대본]:
    ---
    ${transcript}
    ---
    [평가 양식]:
    ${JSON.stringify(
      templateItems.map((item) => ({ id: item.id, header: item.header_name, parent_id: item.parent_id })),
      null,
      2
    )}
    [사진 목록]:
    ${JSON.stringify(
      findings.map((f) => ({ id: f.id, timestamp: f.timestamp_seconds })),
      null,
      2
    )}

    [지시 사항]:
    대본을 읽고 양식의 빈칸을 채우세요. 헤더를 직접 말하지 않아도 맥락을 추론하여 채워야 합니다.
    대본에서 여러 위험 요인 세트를 발견하면 각각 별도로 생성하세요.
    답변을 찾을 수 없으면 null로 두세요.

    [출력 형식]:
    반드시 [JSON_START]와 [JSON_END] 사이에 JSON 배열만 넣으세요.
    [JSON_START]
    [
      { 
        "set_id": 1,
        "results": [
          { "template_item_id": "...", "result_value": "..." }
        ]
      }
    ]
    [JSON_END]
  `;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = msg.content[0].text;
  const jsonMatch = responseText.match(/\[JSON_START\]([\s\S]*?)\[JSON_END\]/);

  let jsonString: string;
  if (jsonMatch && jsonMatch[1]) {
    jsonString = jsonMatch[1].trim();
  } else {
    const start = responseText.indexOf("[");
    const end = responseText.lastIndexOf("]");
    if (start !== -1 && end !== -1 && end > start) {
      jsonString = responseText.substring(start, end + 1);
    } else {
      throw new Error("AI 응답에서 JSON을 찾을 수 없습니다.");
    }
  }

  const resultsSets = JSON.parse(jsonString);
  const resultsToInsert: any[] = [];

  if (Array.isArray(resultsSets)) {
    resultsSets.forEach((set: any) => {
      if (Array.isArray(set.results)) {
        set.results.forEach((result: any) => {
          resultsToInsert.push({
            assessment_id: assessmentId,
            template_item_id: result.template_item_id,
            result_value: result.result_value,
          });
        });
      }
    });
  }

  if (resultsToInsert.length > 0) {
    const { error: insertError } = await supabaseAdmin.from("assessment_results").insert(resultsToInsert);
    if (insertError) throw new Error(`결과 저장 실패: ${insertError.message}`);
  }

  console.log(`[AI Pipeline] LLM Complete. ${resultsToInsert.length} answers saved.`);
}

// --- 메인 POST 핸들러 ---
export async function POST(req: NextRequest) {
  let assessmentId: string | null = null;

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audioFile") as File | null;
    assessmentId = formData.get("assessmentId") as string | null;

    if (!audioFile || !assessmentId) {
      return NextResponse.json({ error: "Audio, Assessment ID required" }, { status: 400 });
    }

    // 1. STT (Deepgram fetch)
    const transcript = await transcribeAudio(audioFile);

    if (transcript === null) {
      await supabaseAdmin
        .from("assessments")
        .update({ status: "failed", error_message: "음성 내용이 없습니다." })
        .eq("id", assessmentId);
      return NextResponse.json({ message: "No speech detected" });
    }

    await supabaseAdmin
      .from("assessments")
      .update({ transcript: transcript, status: "analyzing" })
      .eq("id", assessmentId);

    // 2. LLM (Claude)
    await analyzeTranscript(assessmentId, transcript);

    // 3. 완료
    await supabaseAdmin.from("assessments").update({ status: "completed", error_message: null }).eq("id", assessmentId);

    return NextResponse.json({ message: "Analysis complete" });
  } catch (error: any) {
    console.error("🔥🔥🔥 Pipeline Error:", error.message);
    if (assessmentId) {
      try {
        await supabaseAdmin
          .from("assessments")
          .update({ status: "failed", error_message: error.message })
          .eq("id", assessmentId);
      } catch (e) {}
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
