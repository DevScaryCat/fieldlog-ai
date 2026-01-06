import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceRoleClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. 대용량 처리를 위한 타임아웃 설정 (최대 60초)
export const maxDuration = 60;

// --- 설정 및 클라이언트 초기화 ---
const supabaseAdmin = createServiceRoleClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// [디버깅] 구글 키 확인
console.log("🔑 Google Key Status:", process.env.GOOGLE_GENERATIVE_AI_API_KEY ? "OK" : "MISSING");

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

const DEEPGRAM_API_URL = "https://api.deepgram.com/v1/listen?model=nova-2&language=ko&smart_format=true&diarize=true";

// 2. [RAG 핵심] AI 번역 + 하이브리드 검색
async function searchRelatedLaws(transcript: string): Promise<string> {
  try {
    // (1) [AI 번역] 현장 상황을 '법률 용어'로 변환
    const translationMsg = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022", // 속도 빠른 모델 사용
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `
          너는 '산업안전보건법 검색 에이전트'다. 
          아래 [현장 작업 내용]을 읽고, 우리 법령 DB에서 검색할 **'표준 법률 키워드'** 5개를 뽑아라.
          
          [변환 규칙]:
          - "허리/어깨/손목 아픔", "무거운 것" -> **"근골격계", "중량물", "요통"**
          - "넘어짐", "미끄러짐" -> **"전도", "작업장 바닥"**
          - "떨어짐" -> **"추락", "안전난간"**
          - "칼", "베임", "기계" -> **"기계", "절단", "협착", "방호조치"**
          - "냄새", "가스" -> **"밀폐공간", "유해가스", "환기"**
          
          *주의: 작업 내용과 전혀 상관없는 단어(예: 방사선, 잠수, 소음)는 절대 포함하지 마라.*

          [현장 작업 내용]: 
          ${transcript.slice(0, 3000)}
          
          [출력 형식 (쉼표로 구분, 설명 없이 단어만)]:
          키워드1, 키워드2, 키워드3, 키워드4, 키워드5
        `,
        },
      ],
    });

    // @ts-ignore
    const searchKeywordsRaw = translationMsg.content[0].text;
    console.log(`🔍 [RAG] AI 변환 검색어: ${searchKeywordsRaw}`);

    // 키워드 배열로 변환
    const keywords = searchKeywordsRaw
      .split(/[,,\n]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 1);

    // (2) 벡터 검색 (의미 기반)
    const result = await embeddingModel.embedContent(searchKeywordsRaw);
    const embedding = result.embedding.values;

    const { data: vectorLaws, error: vectorError } = await supabaseAdmin.rpc("match_legal_docs", {
      query_embedding: embedding,
      match_threshold: 0.05, // 문턱값 낮게 유지
      match_count: 7,
    });

    if (vectorError) console.error("Vector Search Error:", vectorError);

    // (3) [Keyword Boost] 중요 키워드가 있으면 강제 검색 (정확도 보장)
    let keywordLaws: any[] = [];
    const criticalTerms = [
      "근골격계",
      "중량물",
      "밀폐공간",
      "석면",
      "소음",
      "지게차",
      "크레인",
      "비계",
      "거푸집",
      "보호구",
      "절단",
      "협착",
      "전도",
      "추락",
    ];

    // AI가 뽑은 키워드 중 criticalTerms에 포함된 게 있는지 확인
    const activeCriticalTerms = keywords.filter((k) => criticalTerms.some((ct) => k.includes(ct) || ct.includes(k)));

    if (activeCriticalTerms.length > 0) {
      console.log(`⚡ [Keyword Boost] 핵심 법률용어 감지: ${activeCriticalTerms.join(", ")} -> 관련 조항 강제 소환`);

      // 해당 단어가 content에 포함된 법령을 텍스트 매칭으로 가져옴
      const orQuery = activeCriticalTerms.map((term) => `content.ilike.%${term}%`).join(",");
      const { data: textData } = await supabaseAdmin.from("legal_docs").select("*").or(orQuery).limit(6); // 키워드 매칭된 법령 6개 추가

      if (textData) keywordLaws = textData;
    }

    // (4) 결과 합치기 & 중복 제거
    const allLaws = [...(vectorLaws || []), ...keywordLaws];
    const uniqueLaws = Array.from(new Map(allLaws.map((item) => [item["id"], item])).values());

    // (5) [필터링] 엉뚱한 결과(방사선, 잠수 등) 제외 (안전장치)
    // 현재 맥락(키워드)에 없는 엉뚱한 카테고리는 제거
    const finalLaws = uniqueLaws.filter((law: any) => {
      const badTerms = ["방사선", "잠수", "고압", "병원체"];
      // 검색어에 저 단어들이 없는데 결과에 나왔다면 필터링
      const isBad = badTerms.some((bad) => law.content.includes(bad)) && !keywords.some((k) => k.includes(bad));
      return !isBad;
    });

    if (finalLaws.length === 0) {
      return "관련된 구체적 법령을 찾을 수 없음 (일반 안전 수칙 적용 필요)";
    }

    console.log(`✅ [RAG] 최종 확보된 법령: ${finalLaws.length}개`);
    finalLaws.slice(0, 5).forEach((l: any, i: number) => console.log(`   [${i + 1}] ${l.content.substring(0, 30)}...`));

    return finalLaws.map((law: any) => `[법적 근거 DB] ${law.content}`).join("\n\n");
  } catch (e) {
    console.error("RAG Pipeline Error:", e);
    return "";
  }
}

// 3. STT 함수
async function transcribeAudioUrl(audioUrl: string): Promise<string | null> {
  const response = await fetch(DEEPGRAM_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: audioUrl }),
  });

  if (!response.ok) throw new Error("Deepgram Error");
  const result = await response.json();
  return result.results?.channels[0]?.alternatives[0]?.transcript || null;
}

// 4. JSON 복구 유틸리티
function safeJsonParse(text: string) {
  try {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    let cleanText = jsonMatch ? jsonMatch[1] : text;
    const start = cleanText.indexOf("{");
    const end = cleanText.lastIndexOf("}");
    if (start !== -1 && end !== -1) cleanText = cleanText.substring(start, end + 1);
    return JSON.parse(cleanText);
  } catch (e) {
    return null;
  }
}

async function callClaudeWithRetry(params: any, retries = 3) {
  const paramsWithTemp = { ...params, temperature: 0 };
  for (let i = 0; i < retries; i++) {
    try {
      return await anthropic.messages.create(paramsWithTemp);
    } catch (error: any) {
      if (error.status === 529 || (error.status >= 500 && error.status < 600)) {
        await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
}

// 5. LLM 분석 로직
async function analyzeTranscriptWithInternalTypeCheck(assessmentId: string, transcript: string): Promise<void> {
  const { data: assessmentData, error } = await supabaseAdmin
    .from("assessments")
    .select(
      `id, response_style, assessment_templates (template_name, ai_type, template_items (id, header_name, sort_order))`
    )
    .eq("id", assessmentId)
    .single();

  if (error) throw new Error(error.message);

  const template = assessmentData.assessment_templates;
  const templateItems = (template?.template_items || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
  const responseStyle = assessmentData.response_style || "expert";

  // [RAG 실행]
  const relatedLaws = await searchRelatedLaws(transcript);

  const itemMapping = templateItems
    .map((item: any) => `ID: "${item.id}" -> 질문항목: "${item.header_name}"`)
    .join("\n");
  const stylePrompt = responseStyle === "summary" ? "불릿포인트 위주 요약" : "전문적이고 명확한 문장";

  const systemPrompt = `
    당신은 대한민국 최고의 산업안전보건 전문가입니다.
    제공된 [녹음 대본]을 분석하여 [작성 양식]을 채우는 JSON 데이터를 생성하세요.
  `;

  // [작성 규칙]
  const ragInstruction = `
    ★ [법적 근거(legal_basis) 작성 핵심 원칙] ★
    
    1. **[One-Pick 원칙]:** - 한 항목당 법령을 나열하지 말고, **가장 핵심적인 법령 1개(최대 2개)**만 선정하여 적으세요.
       - 여러 개가 해당된다면 **가장 구체적이고 직접적인 조항** 하나만 남기세요.
    
    2. **[우선순위 결정]:**
       - 1순위: **제12장 근골격계** (허리, 어깨, 반복작업 시) -> **'제656조'** 또는 **'제657조'**
       - 2순위: **중량물** (무게 언급 시) -> **'제663조'**
       - 3순위: **전도/추락** (미끄러짐, 높이) -> **'제3조'** 또는 **'제13조'**
       - 4순위: 일반 안전 -> '제38조', '제4조' (위 1~3순위가 없을 때만 사용)

    3. **[작성 포맷]:**
       - "산업안전보건기준에 관한 규칙 제OO조(제목) - (적용 이유 간략히)"
       - 예: "산업안전보건기준에 관한 규칙 제663조(중량물의 제한) - 부품 운반 시 허리 부담 방지"
  `;

  const prompt = `
    ${systemPrompt}
    ${ragInstruction}

    [스타일]: ${stylePrompt}

    [참고 법령 DB (RAG 검색 결과)]:
    ${relatedLaws}

    [작성 양식 (ID 매핑)]:
    ${itemMapping}

    [녹음 대본]:
    ${transcript.slice(0, 50000)} ...

    [출력 포맷 (Strict JSON)]:
    {
      "title": "보고서 제목",
      "sets": [
        { 
          "results": [
             { 
               "template_item_id": "반드시_위_매핑정보의_UUID_복사", 
               "result_value": "...", 
               "legal_basis": "...", 
               "solution": "..." 
             }
          ]
        }
      ]
    }
  `;

  const msg: any = await callClaudeWithRetry({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const parsedData = safeJsonParse(msg.content[0].text);
  if (!parsedData) throw new Error("AI 응답 파싱 실패");

  if (parsedData.title)
    await supabaseAdmin.from("assessments").update({ title: parsedData.title }).eq("id", assessmentId);

  const resultsToInsert: any[] = [];
  if (Array.isArray(parsedData.sets)) {
    parsedData.sets.forEach((set: any) => {
      const resultsArray = set.results || set;
      if (Array.isArray(resultsArray)) {
        resultsArray.forEach((result: any) => {
          if (result.template_item_id && result.template_item_id.length > 10) {
            resultsToInsert.push({
              assessment_id: assessmentId,
              template_item_id: result.template_item_id,
              result_value: result.result_value,
              legal_basis: result.legal_basis || null,
              solution: result.solution || null,
            });
          }
        });
      }
    });
  }

  if (resultsToInsert.length > 0) {
    const { error } = await supabaseAdmin.from("assessment_results").insert(resultsToInsert);
    if (error) console.error("❌ DB Insert Error:", error);
    else console.log(`✅ DB 저장 완료 (${resultsToInsert.length}건)`);
  }
}

// POST 핸들러
export async function POST(req: NextRequest) {
  let assessmentId = null;
  try {
    const body = await req.json();
    assessmentId = body.assessmentId;
    const audioUrl = body.audioUrl;

    if (!audioUrl || !assessmentId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const transcript = await transcribeAudioUrl(audioUrl);
    if (!transcript) return NextResponse.json({ message: "No speech" });

    await supabaseAdmin.from("assessments").update({ status: "analyzing", transcript }).eq("id", assessmentId);
    await analyzeTranscriptWithInternalTypeCheck(assessmentId, transcript);
    await supabaseAdmin.from("assessments").update({ status: "completed" }).eq("id", assessmentId);

    return NextResponse.json({ message: "Success" });
  } catch (error: any) {
    if (assessmentId)
      await supabaseAdmin
        .from("assessments")
        .update({ status: "failed", error_message: error.message })
        .eq("id", assessmentId);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
