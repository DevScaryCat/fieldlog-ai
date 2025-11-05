// /app/api/transcribe/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server'; // 서버 클라이언트
import { createClient as createServiceRoleClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

export const config = {
  maxDuration: 300, // Vercel Hobby 플랜 기준, 함수 최대 실행 시간을 5분으로 늘립니다.
};

// 서비스 키로 RLS를 우회하는 어드민 클라이언트 생성 (테이블 업데이트용)
const supabaseAdmin = createServiceRoleClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// CLOVA Speech API (긴 음성 파일용)
const NAVER_SPEECH_API_URL = `${process.env.NCP_CLOVA_SPEECH_INVOKE_URL}/recognizer/upload`;

export async function POST(req: NextRequest) {
  const { audioUrl, assessmentId } = await req.json();

  if (!audioUrl || !assessmentId) {
    return NextResponse.json({ error: 'Audio URL and Assessment ID are required' }, { status: 400 });
  }
  
  console.log(`[AI Pipeline] 1. Job Started for: ${assessmentId}`);

  try {
    // 1. 평가 정보, 연결된 양식(template_items), 사진(findings)을 모두 DB에서 가져옵니다.
    const { data: assessmentData, error: fetchError } = await supabaseAdmin
      .from('assessments')
      .select(`
        id,
        assessment_templates (
          template_name,
          template_items (id, header_name, sort_order)
        ),
        findings (id, photo_before_url, timestamp_seconds)
      `)
      .eq('id', assessmentId)
      .single();

    if (fetchError) throw fetchError;
    
    const templateItems = assessmentData.assessment_templates.template_items.sort(
      (a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)
    );
    const findings = assessmentData.findings;
    
    console.log(`[AI Pipeline] 2. Fetched Template: ${templateItems.length} items. Fetched Findings: ${findings.length} photos.`);

    // 2. (STT) Supabase Storage에서 파일 URL 가져오기
    const { data: publicUrlData } = supabaseAdmin.storage
      .from('findings')
      .getPublicUrl(audioUrl);
    const fileDownloadUrl = publicUrlData.publicUrl;

    // 3. (STT) 네이버 CLOVA Speech API 호출 (긴 음성 인식)
    const jobResponse = await fetch(NAVER_SPEECH_API_URL, {
      method: 'POST',
      headers: {
        'X-CLOVA-API-KEY': process.env.NCP_CLOVA_SPEECH_SECRET_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ language: 'ko-KR', url: fileDownloadUrl, completion: 'sync' }),
    });

    if (!jobResponse.ok) throw new Error(`CLOVA Speech API Error: ${await jobResponse.text()}`);
    
    const result = await jobResponse.json();
    const transcript = result.text; // 음성 변환된 전체 대본
    console.log('[AI Pipeline] 3. STT (Naver) Complete.');

    // 4. (LLM) Claude API에 "빈칸 채우기" 요청
    console.log('[AI Pipeline] 4. LLM (Claude) Analysis Started...');
    const prompt = `
      당신은 안전보건 컨설턴트의 비서 AI입니다.
      컨설턴트의 [현장 녹음 대본]을 듣고, 주어진 [평가 양식]의 빈칸을 채워야 합니다.

      [현장 녹음 대본]:
      ---
      ${transcript}
      ---

      [평가 양식 (질문지)]:
      ${JSON.stringify(templateItems.map(item => ({ id: item.id, header: item.header_name })), null, 2)}

      [참고 자료 (사진 목록)]:
      ${JSON.stringify(findings.map(f => ({ id: f.id, timestamp: f.timestamp_seconds, url: f.photo_before_url })), null, 2)}

      [당신의 임무]:
      [평가 양식]의 각 항목(header)에 대한 "답변(value)"을 [현장 녹음 대본]에서 찾아서 채워주세요.
      - "답변"은 대본에 근거해야 합니다.
      - "답변"을 찾을 수 없으면 null로 두세요.
      - 사진(finding)은 답변의 근거로 사용될 수 있습니다.

      [출력 형식]:
      반드시 아래와 같은 JSON 배열 형식으로만 응답하세요.
      \`\`\`json
      [
        { "template_item_id": "(양식 항목의 id)", "result_value": "(AI가 찾은 답변)" },
        { "template_item_id": "(양식 항목의 id)", "result_value": "(AI가 찾은 답변)" }
      ]
      \`\`\`
    `;

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    // 5. JSON 파싱
    const responseText = msg.content[0].text;
    const jsonMatch = responseText.match(/```json([\s\S]*?)```/);
    let jsonString: string;
    if (jsonMatch && jsonMatch[1]) {
      jsonString = jsonMatch[1].trim();
    } else { // AI가 ```json``` 없이 보냈을 경우 대비
      jsonString = responseText.substring(responseText.indexOf('['), responseText.lastIndexOf(']') + 1);
    }
    
    const results = JSON.parse(jsonString);
    if (!Array.isArray(results)) throw new Error("AI 응답이 배열 형식이 아닙니다.");
    
    // 6. 'assessment_results' (답안지) 테이블에 AI가 찾은 답변 삽입
    const resultsToInsert = results.map((result: any) => ({
      assessment_id: assessmentId,
      template_item_id: result.template_item_id,
      result_value: result.result_value,
      // TODO: AI가 finding_id도 추론하게 할 수 있음 (고급)
    }));

    const { error: insertError } = await supabaseAdmin
      .from('assessment_results')
      .insert(resultsToInsert);
    if (insertError) throw insertError;
    
    console.log(`[AI Pipeline] 5. LLM (Claude) Complete. ${resultsToInsert.length}