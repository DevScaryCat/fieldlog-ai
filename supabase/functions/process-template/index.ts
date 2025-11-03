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
    // 1. 부모 아이템을 DB에 삽입
    const { data: parentItem, error } = await supabaseAdmin
      .from("template_items")
      .insert({
        template_id: templateId,
        header_name: item.header_name,
        default_value: item.default_value || null,
        parent_id: parentId, // 부모 ID 지정
        sort_order: index,
      })
      .select("id")
      .single();

    if (error) throw new Error(`DB 삽입 실패 (header: ${item.header_name}): ${error.message}`);

    // 2. 자식 아이템이 있다면, '자신'의 ID를 'parent_id'로 넘겨 재귀 호출
    if (item.children && item.children.length > 0) {
      await insertItemsRecursively(item.children, templateId, parentItem.id);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const { record: template } = await req.json();
  const templateId = template?.id;
  const fileUrl = template?.original_file_url;

  try {
    if (!templateId || !fileUrl) {
      throw new Error("Webhook 페이로드에 templateId 또는 fileUrl이 없습니다.");
    }

    const { data: fileData, error: downloadError } = await supabaseAdmin.storage.from("findings").download(fileUrl);
    if (downloadError) throw downloadError;

    const imageBuffer = await fileData.arrayBuffer();
    const imageBase64 = encode(imageBuffer);
    const imageMediaType = fileData.type || "image/jpeg";

    // 3. 고도화된 새 프롬프트 (계층 구조 요청)
    const prompt = `
      당신은 이미지 속 표의 구조를 분석하는 AI입니다.

      [핵심 임무]:
      이미지에 있는 표의 **'계층 구조(Hierarchy)'**를 분석하여 **'중첩된 JSON(Nested JSON)'** 형식으로 추출하세요.

      [중요 지시사항]:
      1.  **회전 처리:** 이미지가 90도 회전되어 있을 수 있습니다. 회전 상태를 보정하여 텍스트를 정확히 읽어주세요.
      2.  **계층 구조 인식 (가장 중요):**
          - "유해위험요인 파악" 처럼 여러 하위 컬럼을 가진 헤더는 **'children' 배열**을 가진 부모 노드로 만드세요.
          - "분류", "원인" 등은 '유해위험요인 파악'의 'children'이 됩니다.
          - "평가대상 공정"처럼 하위 항목이 없는 단일 컬럼은 'children' 배열을 비워두세요.
      3.  **기본값 추출:** '유해인자' 컬럼의 '소음'처럼, 이미 채워진 값이 있다면 'default_value'로 추출하세요.
      4.  **무시할 내용:** 표의 제목, 페이지 번호, 서명란 등은 무시하세요.

      [출력 형식]:
      반드시 \`\`\`json ... \`\`\` 블록으로 감싸서 반환하세요.
      
      [IMG_5501 기준 올바른 출력 예시]:
      \`\`\`json
      {
        "items": [
          { "header_name": "평가대상 공정", "default_value": null, "children": [] },
          { "header_name": "세부공정(작업)", "default_value": null, "children": [] },
          { 
            "header_name": "유해위험요인 파악", 
            "default_value": null,
            "children": [
              { "header_name": "분류", "default_value": null, "children": [] },
              { "header_name": "원인", "default_value": null, "children": [] },
              { "header_name": "유해위험요인", "default_value": null, "children": [] }
            ]
          },
          { "header_name": "설비 / 물질", "default_value": null, "children": [] },
          { "header_name": "현재 안전보건조치(사진 등)", "default_value": null, "children": [] },
          {
            "header_name": "현재 위험성",
            "default_value": null,
            "children": [
              { "header_name": "가능성(빈도)", "default_value": null, "children": [] },
              { "header_name": "중대성[강도]", "default_value": null, "children": [] },
              { "header_name": "위험성", "default_value": null, "children": [] }
            ]
          },
          {
            "header_name": "감소대책",
            "default_value": null,
            "children": [
              { "header_name": "No.", "default_value": null, "children": [] },
              { "header_name": "세부내용", "default_value": null, "children": [] }
            ]
          }
        ]
      }
      \`\`\`
    `;

    // 4. Claude Vision API 호출
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

    // 5. JSON 파싱
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

    // 6. 'template_items'에 "재귀적으로" 삽입 (수정됨)
    await insertItemsRecursively(resultJson.items, templateId, null);

    // 7. 성공! 'assessment_templates' 상태를 'completed'로 업데이트
    await supabaseAdmin
      .from("assessment_templates")
      .update({ status: "completed", error_message: null })
      .eq("id", templateId);

    return new Response(JSON.stringify({ message: "Success" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    // 8. 실패!
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
