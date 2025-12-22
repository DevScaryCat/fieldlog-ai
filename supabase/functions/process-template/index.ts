// /supabase/functions/process-template/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.22.0";
import { corsHeaders } from "../_shared/cors.ts";
import { encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
});

const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// 재귀 함수: AI가 반환한 계층 구조(JSON)를 DB에 맞게 평탄화(flatten)합니다.
async function insertItemsRecursively(items: any[], templateId: string, parentId: string | null = null) {
  for (const [index, item] of items.entries()) {
    const { data: parentItem, error } = await supabaseAdmin
      .from("template_items")
      .insert({
        template_id: templateId,
        header_name: item.header_name,
        default_value: item.default_value || null,
        parent_id: parentId,
        sort_order: index,
      })
      .select("id")
      .single();

    if (error) throw new Error(`DB 삽입 실패 (header: ${item.header_name}): ${error.message}`);

    if (item.children && item.children.length > 0) {
      await insertItemsRecursively(item.children, templateId, parentItem.id);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let templateId = null;

  try {
    const { record: template } = await req.json();
    templateId = template?.id;
    const fileUrl = template?.original_file_url;

    if (!templateId || !fileUrl) {
      throw new Error("Webhook 페이로드에 templateId 또는 fileUrl이 없습니다.");
    }

    const { data: fileData, error: downloadError } = await supabaseAdmin.storage.from("findings").download(fileUrl);
    if (downloadError) throw downloadError;

    const imageBuffer = await fileData.arrayBuffer();
    const imageBase64 = encode(imageBuffer);
    const imageMediaType = fileData.type || "image/jpeg";

    // --- (프롬프트 수정) 양식 타입 감지 지침 추가 ---
    const prompt = `
      당신은 문서 서식 분석 전문가 AI입니다. 
      이미지의 시각적 구조를 분석하여 '데이터 테이블 구조'와 '문서의 성격(Type)'을 추출하세요.

      [목표 1: 구조 추출]
      - 메인 데이터 테이블의 컬럼 헤더(Header)를 계층적 JSON으로 추출하세요.
      - 방향 보정, 셀 병합(부모-자식 관계), 기본값(Default Value) 인쇄 여부를 꼼꼼히 확인하세요.
      - 표의 제목이나 결재란 같은 메타 데이터는 제외하고, 실제 입력할 '항목'만 추출하세요.

      [목표 2: 문서 타입(AI Mode) 감지]
      이 양식이 어떤 용도로 쓰이는지 헤더 텍스트와 전체적인 구성을 보고 판단하세요.
      
      1. **"safety" (안전/보건 컨설팅)**:
         - 키워드: 위험성, 빈도, 강도, 법적근거, 개선대책, TBM, 순회점검, 유해위험요인 등.
         - 특징: 안전 관리나 위험성 평가와 관련된 항목이 많음.
      
      2. **"meeting" (회의/면담)**:
         - 키워드: 안건, 회의내용, 참석자, 결정사항, 비고, 일정, Action Item, 논의사항 등.
         - 특징: 줄글이나 요약 내용을 적는 칸이 넓게 배치된 경우.
      
      3. **"inspection" (시설/품질 점검)**:
         - 키워드: 점검항목, 양호/불량(O/X), 상태, 조치사항, 결과, 부적합, 수리내역 등.
         - 특징: 체크리스트 형태이거나 O/X를 표시하는 칸이 있는 경우.

      - 위 3가지 중 하나로 분류하고, 헷갈리면 기본값인 "safety"로 지정하세요.

      [출력 형식]:
      반드시 \`\`\`json ... \`\`\` 블록으로 감싸서 반환하세요.

      [JSON 구조 예시]:
      \`\`\`json
      {
        "items": [
          { "header_name": "구분", "default_value": null, "children": [] },
          { "header_name": "점검내용", "children": [ ... ] }
        ],
        "detected_type": "safety" 
      }
      \`\`\`
      (detected_type 값은 "safety", "meeting", "inspection" 중 하나여야 함)
    `;

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: imageMediaType, data: imageBase64 } },
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    const responseText = msg.content[0].text;
    const jsonMatch = responseText.match(/```json([\s\S]*?)```/);

    let jsonString: string;
    if (jsonMatch && jsonMatch[1]) {
      jsonString = jsonMatch[1].trim();
    } else {
      const firstBrace = responseText.indexOf("{");
      const lastBrace = responseText.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonString = responseText.substring(firstBrace, lastBrace + 1);
      } else {
        throw new Error("AI 응답에서 유효한 JSON 객체를 찾을 수 없습니다.");
      }
    }

    const resultJson = JSON.parse(jsonString);
    if (!Array.isArray(resultJson.items)) throw new Error("AI 응답 형식이 잘못되었습니다.");

    // 1. 아이템 재귀 삽입
    await insertItemsRecursively(resultJson.items, templateId, null);

    // 2. 템플릿 상태 업데이트 (detected_type도 같이 저장!)
    // 감지된 타입이 유효하지 않으면 기본값 'safety' 사용
    const validTypes = ["safety", "meeting", "inspection"];
    const aiTypeToSave = validTypes.includes(resultJson.detected_type) ? resultJson.detected_type : "safety";

    await supabaseAdmin
      .from("assessment_templates")
      .update({
        status: "completed",
        error_message: null,
        ai_type: aiTypeToSave, // [추가됨] 감지된 타입 저장
      })
      .eq("id", templateId);

    return new Response(JSON.stringify({ message: "Success", detected_type: aiTypeToSave }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (templateId) {
      await supabaseAdmin
        .from("assessment_templates")
        .update({ status: "failed", error_message: error.message })
        .eq("id", templateId);
    }
    console.error("AI Template Analysis Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
