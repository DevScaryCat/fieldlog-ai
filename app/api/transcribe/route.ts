import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceRoleClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

// 1. 대용량 처리를 위한 타임아웃 설정 (최대 60초)
export const maxDuration = 60;

const supabaseAdmin = createServiceRoleClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const DEEPGRAM_API_URL = "https://api.deepgram.com/v1/listen?model=nova-2&language=ko&smart_format=true&diarize=true";

// 2. STT 함수
async function transcribeAudioUrl(audioUrl: string): Promise<string | null> {
  const response = await fetch(DEEPGRAM_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: audioUrl }),
  });

  if (!response.ok) {
    const errorBody = await response.json();
    throw new Error(`Deepgram Error: ${errorBody.err_msg || "Unknown error"}`);
  }

  const result = await response.json();
  const transcript = result.results?.channels[0]?.alternatives[0]?.transcript;
  return transcript && transcript.trim().length > 0 ? transcript : null;
}

// 3. JSON 복구 함수
function safeJsonParse(jsonString: string) {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.warn("⚠️ JSON 파싱 실패. 복구 시도 중...");
    const lastValidObject = jsonString.lastIndexOf("},");
    if (lastValidObject !== -1) {
      const recoveredString = jsonString.substring(0, lastValidObject + 1) + "]} }";
      try {
        console.log("🛠️ 복구된 JSON으로 재시도...");
        return JSON.parse(recoveredString);
      } catch (e2) {
        console.error("❌ JSON 복구 실패.");
      }
    }
    throw new Error("AI 응답이 너무 길어서 중간에 끊겼으며, 복구에 실패했습니다.");
  }
}

// 4. Claude API 재시도 래퍼
async function callClaudeWithRetry(params: any, retries = 3, delay = 2000) {
  // [중요] temperature: 0 유지 (사실 기반 답변)
  const paramsWithTemp = { ...params, temperature: 0 };

  for (let i = 0; i < retries; i++) {
    try {
      return await anthropic.messages.create(paramsWithTemp);
    } catch (error: any) {
      const isOverloaded = error.status === 529 || (error.status >= 500 && error.status < 600);
      if (isOverloaded && i < retries - 1) {
        console.warn(`⚠️ Claude API Busy (Attempt ${i + 1}/${retries}). Retrying...`);
        await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
        continue;
      }
      throw error;
    }
  }
}

// 5. LLM 분석 함수 (핵심 로직 수정)
async function analyzeTranscriptWithInternalTypeCheck(assessmentId: string, transcript: string): Promise<void> {
  const { data: assessmentData, error: fetchError } = await supabaseAdmin
    .from("assessments")
    .select(
      `
      id,
      response_style,
      assessment_templates (template_name, ai_type, template_items (id, header_name, sort_order))
    `
    )
    .eq("id", assessmentId)
    .single();

  if (fetchError) throw new Error(`DB 조회 실패: ${fetchError.message}`);

  const template = assessmentData.assessment_templates;
  const aiType = template?.ai_type || "safety";
  const responseStyle = assessmentData.response_style || "expert";

  const templateItems = (template?.template_items || []).sort(
    (a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)
  );

  console.log(`[AI Pipeline] Mode: ${aiType}, Style: ${responseStyle}`);

  // --- [A] 답변 스타일 ---
  let styleInstruction = "";
  switch (responseStyle) {
    case "expert":
      styleInstruction = `[답변 스타일: 전문가형] 번호(1. 2. 3.)를 매겨 논리적으로 구조화하고, 전문 용어를 사용하여 명사형(~함)으로 간결하게 종결하세요.`;
      break;
    case "general":
      styleInstruction = `[답변 스타일: 일반형] 이해하기 쉬운 줄글로 설명하되, 핵심 내용은 요약하여 균형 잡힌 문체(~합니다)를 사용하세요.`;
      break;
    case "summary":
      styleInstruction = `[답변 스타일: 요약형] 모든 내용을 불릿 포인트(•)로 작성하고, 미사여구를 뺀 핵심 키워드(Key Fact) 위주로 나열하세요.`;
      break;
    default:
      styleInstruction = `[답변 스타일: 전문가형] 번호를 매겨 논리적으로 작성하세요.`;
  }

  // --- [B] AI 모드 & 법령 적극 인용 원칙 (수정됨) ---
  let systemPrompt = "";
  let structureInstruction = "";

  const commonRules = `
    ★ [팩트 체크 및 법령 인용 원칙] ★
    1. **질문 유도 배제:** 질문자(컨설턴트)의 유도 질문에 답변자가 명확히 동의하지 않았다면 사실로 확정하지 마세요.
    2. **[핵심] 법령 적극 적용:** 당신은 방대한 법률 데이터를 학습했습니다. '산업안전보건기준에 관한 규칙', 'KOSHA Guide' 지식을 총동원하여 해당 위험 요인에 딱 맞는 조항을 찾아내세요.
       - 예: 감전/전선 손상 -> '안전보건규칙 제301조(충전부 방호)' 또는 '제313조(배선 등의 절연피복)' 인용.
       - 예: 고온/화상 -> '안전보건규칙 제225조(화상 등의 방지)' 인용.
       - 예: 추락 -> '안전보건규칙 제13조(안전난간의 구조)' 등.
       - **주의:** 없는 조항 번호를 지어내지는 말되(할루시네이션 금지), 존재하는 표준 조항은 반드시 명시하세요. "검토 필요"라는 말로 회피하지 마세요.
    3. **추측 금지:** 녹음 내용에 없는 정보는 빈칸("")이나 "확인 불가"로 남기세요.
  `;

  if (aiType === "meeting") {
    systemPrompt = `당신은 '전문 회의록 작성 AI'입니다. ${commonRules}`;
    structureInstruction = `
       - result_value: 안건별 핵심 논의 내용 요약.
       - legal_basis: (비고) 관련 부서/담당자/특이사항.
       - solution: (Action Item) 향후 계획 및 일정.
    `;
  } else if (aiType === "inspection") {
    systemPrompt = `당신은 '시설 및 품질 점검 전문가 AI'입니다. ${commonRules}`;
    structureInstruction = `
       - result_value: 점검 대상의 현재 상태 기술 (양호/불량).
       - legal_basis: 결함 발생 원인 (기술적 분석 위주).
       - solution: 구체적인 보수 및 조치 방법.
    `;
  } else {
    // safety (기본값)
    systemPrompt = `당신은 '산업안전보건 전문가 AI'입니다. ${commonRules}`;
    structureInstruction = `
       - result_value: 현장 상황 및 위험 요인 기술.
       - legal_basis: **[필수]** 관련된 '산업안전보건기준에 관한 규칙' 또는 'KOSHA Guide'의 구체적 조항 명시. (단순 '검토 필요' 금지)
       - solution: 기술적 개선 대책.
    `;
  }

  // --- [C] 범용적 분리 및 매핑 프롬프트 ---
  const splitInstruction = `
    ★ [최우선 구조 원칙: 주제별 분리 및 매핑 (Split & Mapping Rule)] ★
    
    1. **행(Set) 분리:** 녹음 내용에서 서로 다른 설비, 장소, 작업이 식별되면 반드시 별도의 행(Set)으로 나누세요.
    
    2. **[중요] 교차 오염 방지 (No Cross-Contamination):** - A설비의 위험요인을 B설비의 칸에 적는 실수를 절대 하지 마세요.
       - 작성 전, **"이 위험요인/법적근거가 이 설비의 것이 맞는가?"**를 반드시 스스로 검증하세요.
  `;

  const prompt = `
    ${systemPrompt}
    
    [작업 목표]:
    녹음 대본을 분석하여 양식의 빈칸을 채우세요.
    
    ${splitInstruction}

    ${styleInstruction}

    [작성 지침]:
    ${structureInstruction}

    [녹음 대본]:
    ${transcript.slice(0, 100000)} ...

    [양식 구조]:
    ${JSON.stringify(
      templateItems.map((item: any) => ({ id: item.id, header: item.header_name })),
      null,
      2
    )}

    [출력 포맷 (Strict JSON)]:
    {
      "title": "제목",
      "sets": [
        { 
          "results": [
             { "template_item_id": "...", "result_value": "...", "legal_basis": "...", "solution": "..." }
          ]
        },
        { 
          "results": [ ...대상이 다르면 여기에 새로운 객체 생성... ] 
        }
      ]
    }
  `;

  const msg: any = await callClaudeWithRetry({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = msg.content[0].text;

  // JSON 파싱
  let jsonString = responseText;
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (jsonMatch) jsonString = jsonMatch[0];
  else {
    const start = responseText.indexOf("{");
    if (start !== -1) jsonString = responseText.substring(start);
  }

  const parsedData = safeJsonParse(jsonString);

  if (parsedData.title) {
    await supabaseAdmin.from("assessments").update({ title: parsedData.title }).eq("id", assessmentId);
  }

  const resultsToInsert: any[] = [];
  if (Array.isArray(parsedData.sets)) {
    parsedData.sets.forEach((set: any) => {
      const resultsArray = set.results || set;
      if (Array.isArray(resultsArray)) {
        resultsArray.forEach((result: any) => {
          resultsToInsert.push({
            assessment_id: assessmentId,
            template_item_id: result.template_item_id,
            result_value: result.result_value,
            legal_basis: result.legal_basis || null,
            solution: result.solution || null,
          });
        });
      }
    });
  }

  if (resultsToInsert.length > 0) {
    await supabaseAdmin.from("assessment_results").insert(resultsToInsert);
  }
}

export async function POST(req: NextRequest) {
  let assessmentId: string | null = null;
  try {
    const body = await req.json();
    const { audioUrl } = body;
    assessmentId = body.assessmentId;

    if (!audioUrl || !assessmentId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const transcript = await transcribeAudioUrl(audioUrl);
    if (!transcript) {
      await updateStatus(assessmentId, "failed", "음성 내용 없음");
      return NextResponse.json({ message: "No speech detected" });
    }

    await updateStatus(assessmentId, "analyzing", null, transcript);
    await analyzeTranscriptWithInternalTypeCheck(assessmentId, transcript);
    await updateStatus(assessmentId, "completed");

    return NextResponse.json({ message: "Success" });
  } catch (error: any) {
    console.error("Pipeline Error:", error.message);
    if (assessmentId) await updateStatus(assessmentId, "failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function updateStatus(
  id: string,
  status: string,
  errorMsg: string | null = null,
  transcript: string | null = null
) {
  const updateData: any = { status, error_message: errorMsg };
  if (transcript) updateData.transcript = transcript;
  await supabaseAdmin.from("assessments").update(updateData).eq("id", id);
}
