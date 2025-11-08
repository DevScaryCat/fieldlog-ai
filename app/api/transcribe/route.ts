// /app/api/transcribe/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceRoleClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { DeepgramClient, PrerecordedTranscriptionOptions } from "@deepgram/sdk"; // 1. Deepgram 임포트

export const maxDuration = 300; // 5분

const supabaseAdmin = createServiceRoleClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// 2. Deepgram 클라이언트 초기화
const deepgram = new DeepgramClient(process.env.DEEPGRAM_API_KEY!);

// --- 헬퍼 함수 1: STT (Deepgram) ---
async function transcribeAudio(audioFile: File): Promise<string> {
  console.log(`[AI Pipeline] Using Deepgram API for file: ${audioFile.name}`);

  // 1. File 객체를 Buffer로 변환
  const audioBuffer = await audioFile.arrayBuffer();
  const buffer = Buffer.from(audioBuffer);

  // 2. Deepgram API 호출 옵션
  const options: PrerecordedTranscriptionOptions = {
    model: "nova-2",
    language: "ko",
    smart_format: true, // 단락, 문장 부호 등 자동 서식
    diarize: true, // (선택 사항) 화자 분리
  };

  // 3. Deepgram에 파일 전송 및 변환 요청
  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(buffer, options);

  if (error) {
    throw new Error(`Deepgram STT Error: ${error.message}`);
  }

  // 4. 결과 텍스트 추출
  const transcript = result.results.channels[0].alternatives[0].transcript;
  console.log("[AI Pipeline] Deepgram STT Complete.");

  return transcript;
}

// --- 헬퍼 함수 2: LLM (양식 채우기 - Claude) ---
// (이 함수는 STT와 무관하므로, 이전과 100% 동일합니다)
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

  const prompt = `
    당신은 베테랑 안전 컨설턴트의 AI 비서입니다.
    당신의 임무는 컨설턴트의 [현장 녹음 대본]을 분석하여, 미리 준비된 [평가 양식]의 빈칸을 채우는 것입니다.
    [현장 녹음 대본 (답안지)]:
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
    1.  [현장 녹음 대본]을 주의 깊게 읽고, 각 [평가 양식] 항목(header)에 대한 "답변(value)"을 대본에서 찾으세요.
    2.  대본은 여러 위험 요인을 순서대로 언급할 수 있습니다. 각 위험 요인마다 **새로운 "답안지 세트"**를 만드세요.
    3.  답변은 [평가 양식]의 \`id\`와 매칭하여 JSON 형식으로 반환해야 합니다.
    [출력 형식 (JSON 배열)]:
    대본에서 발견한 위험 요인 "세트"의 수만큼 배열을 만드세요.
    \`\`\`json
    [
      { 
        "set_id": 1,
        "results": [
          { "template_item_id": "db640dbc-...", "result_value": "화학적 요인" },
          { "template_item_id": "8ededd17-...", "result_value": "고온의 기름(식용유)이 방치됨" }
        ]
      },
      { 
        "set_id": 2,
        "results": [
          { "template_item_id": "db640dbc-...", "result_value": "전기적 요인" },
          { "template_item_id": "8ededd17-...", "result_value": "전선 피복이 벗겨져 심선이 노출됨" }
        ]
      }
    ]
    \`\`\`
  `;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = msg.content[0].text;
  const jsonMatch = responseText.match(/```json([\sS]*?)```/);
  let jsonString: string;
  if (jsonMatch && jsonMatch[1]) {
    jsonString = jsonMatch[1].trim();
  } else {
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

    // 3. (수정) 'duration'은 더 이상 필요 없습니다.
    // const durationStr = formData.get('duration') as string | null;

    if (!audioFile || !assessmentId) {
      return NextResponse.json({ error: "Audio, Assessment ID가 모두 필요합니다." }, { status: 400 });
    }

    // [Step 1: STT] (Deepgram 사용)
    const transcript = await transcribeAudio(audioFile); // duration 인자 제거

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
