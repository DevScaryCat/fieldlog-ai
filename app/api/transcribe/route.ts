// /app/api/transcribe/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceRoleClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { DeepgramClient, PrerecordedTranscriptionOptions, Source } from "@deepgram/sdk";

export const maxDuration = 300;

const supabaseAdmin = createServiceRoleClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const deepgram = new DeepgramClient(process.env.DEEPGRAM_API_KEY!);

// --- 헬퍼 함수 1: STT (Deepgram) ---
async function transcribeAudio(audioFile: File): Promise<string | null> {
  console.log(`[AI Pipeline] Using Deepgram API for file: ${audioFile.name}`);

  const audioBuffer = await audioFile.arrayBuffer();
  const buffer = Buffer.from(audioBuffer);

  const source: Source = {
    buffer: buffer,
    mimetype: "audio/webm",
  };

  const options: PrerecordedTranscriptionOptions = {
    model: "nova-2",
    language: "ko",
    smart_format: true,
  };

  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(source, options);

  if (error) {
    throw new Error(`Deepgram STT Error: ${error.message}`);
  }

  const transcript = result.results.channels[0].alternatives[0].transcript;

  if (!transcript || transcript.trim().length === 0) {
    console.log("[AI Pipeline] No speech detected in audio file.");
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

  if (fetchError) throw new Error(`DB에서 양식/사진 정보 조회 실패: ${fetchError.message}`);
  if (!assessmentData.assessment_templates) {
    throw new Error(`assessment_id ${assessmentId}에 연결된 'assessment_templates'가 없습니다.`);
  }

  const templateItems = (assessmentData.assessment_templates.template_items || []).sort(
    (a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)
  );
  const findings = assessmentData.findings || [];

  // --- (수정됨) 백틱 문제를 피하기 위해 안전한 문자열로 변경 ---
  const prompt = `
    당신은 베테랑 안전 컨설턴트의 AI 비서입니다.
    당신의 임무는 컨설턴트의 [현장 녹음 대본]을 분석하여, 미리 준비된 [평가 양식]의 빈칸을 "추론"하여 채우는 것입니다.

    [현장 녹음 대본 (컨설턴트의 자연스러운 대화)]:
    ---
    ${transcript}
    ---

    [평가 양식 (질문지)]:
    ${JSON.stringify(
      templateItems.map((item) => ({ id: item.id, header: item.header_name, parent_id: item.parent_id })),
      null,
      2
    )}

    [참고 자료 (현장 사진 목록)]:
    ${JSON.stringify(
      findings.map((f) => ({ id: f.id, timestamp: f.timestamp_seconds })),
      null,
      2
    )}

    [지시 사항]:
    1.  [중요] 컨설턴트는 양식의 헤더(예: 분류는..., 원인은...)를 절대 말하지 않습니다.
    2.  당신은 컨설턴트의 자연스러운 대화 (예: 와, 여기 기름 끓는데 덮개도 없네요. 화상 위험이 큽니다.)를 이해하고 추론해야 합니다.
    3.  대화의 맥락을 파악하여, 이 대화가 [평가 양식]의 어떤 항목에 대한 답변인지 스스로 판단하세요.
        * 예: 기름, 화상 위험 -> 유해위험요인 - 분류 항목에 화학적 요인 또는 고온 위험이라고 추론.
        * 예: 전선 피복이 벗겨짐 -> 유해위험요인 - 분류 항목에 전기적 요인이라고 추론.
        * 예: 감전 재해 -> 유해위험요인 - 유해위험요인 항목에 작업자 감전 재해라고 추론.
    4.  대본에서 여러 개의 개별 위험 요인 세트를 발견하고, 각각의 세트별로 답변을 생성하세요.
    5.  답변을 찾을 수 없는 항목은 null (소문자 텍스트)로 두세요.

    [출력 형식 (JSON 배열)]:
    대본에서 발견한 위험 요인 "세트"의 수만큼 배열을 만드세요.
    반드시 [JSON_START] 태그와 [JSON_END] 태그 사이에 유효한 JSON 배열만 넣으세요.

    [JSON_START]
    [
      { 
        "set_id": 1,
        "results": [
          { "template_item_id": "ID_HERE", "result_value": "화학적 요인" },
          { "template_item_id": "ID_HERE", "result_value": "고온의 기름이 방치됨" }
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

  // --- JSON 파싱 로직 수정 (태그 기반 추출) ---
  const jsonMatch = responseText.match(/\[JSON_START\]([\s\S]*?)\[JSON_END\]/);
  let jsonString: string;

  if (jsonMatch && jsonMatch[1]) {
    jsonString = jsonMatch[1].trim();
  } else {
    // 태그가 없을 경우 대괄호로 추출 시도
    const start = responseText.indexOf("[");
    const end = responseText.lastIndexOf("]");
    if (start !== -1 && end !== -1 && end > start) {
      jsonString = responseText.substring(start, end + 1);
    } else {
      throw new Error("AI 응답에서 유효한 JSON 배열을 찾을 수 없습니다.");
    }
  }

  const resultsSets = JSON.parse(jsonString);
  if (!Array.isArray(resultsSets)) throw new Error("AI 응답이 배열 형식이 아닙니다.");

  const resultsToInsert: any[] = [];
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

  if (resultsToInsert.length > 0) {
    const { error: insertError } = await supabaseAdmin.from("assessment_results").insert(resultsToInsert);
    if (insertError) throw new Error(`AI 분석 결과(assessment_results) 저장 실패: ${insertError.message}`);
  }

  console.log(
    `[AI Pipeline] LLM (Claude) Complete. ${resultsSets.length}개의 세트, ${resultsToInsert.length}개의 답변 저장 완료.`
  );
}

// --- 메인 POST 핸들러 ---
export async function POST(req: NextRequest) {
  let assessmentId: string | null = null;

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audioFile") as File | null;
    assessmentId = formData.get("assessmentId") as string | null;

    if (!audioFile || !assessmentId) {
      return NextResponse.json({ error: "Audio, Assessment ID가 모두 필요합니다." }, { status: 400 });
    }

    // [Step 1: STT] (Deepgram 사용)
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
      .update({
        transcript: transcript,
        status: "analyzing",
      })
      .eq("id", assessmentId);
    console.log("[AI Pipeline] Transcript saved to DB, starting LLM analysis...");

    // [Step 2: LLM]
    await analyzeTranscript(assessmentId, transcript);

    // [Step 3: 최종 완료]
    await supabaseAdmin.from("assessments").update({ status: "completed", error_message: null }).eq("id", assessmentId);

    return NextResponse.json({ message: "Analysis complete" });
  } catch (error: any) {
    console.error("🔥🔥🔥 [API Transcribe] 전체 프로세스 실패! 원인:", error.message);

    if (assessmentId) {
      try {
        await supabaseAdmin
          .from("assessments")
          .update({ status: "failed", error_message: error.message })
          .eq("id", assessmentId);
      } catch (dbError) {
        console.error("🔥🔥🔥 [API Transcribe] 실패 상태 업데이트조차 실패!", dbError);
      }
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
