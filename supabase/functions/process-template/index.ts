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

  try {
    const { record: template } = await req.json();
    const templateId = template?.id;
    const fileUrl = template?.original_file_url;

    if (!templateId || !fileUrl) {
      throw new Error("Webhook 페이로드에 templateId 또는 fileUrl이 없습니다.");
    }

    const { data: fileData, error: downloadError } = await supabaseAdmin.storage.from("findings").download(fileUrl);
    if (downloadError) throw downloadError;

    const imageBuffer = await fileData.arrayBuffer();
    const imageBase64 = encode(imageBuffer);
    const imageMediaType = fileData.type || "image/jpeg";

    // --- (핵심 수정) 범용성을 극대화한 프롬프트 ---
    const prompt = `
      당신은 다양한 형태의 문서(표, 체크리스트, 명단 등)를 디지털 양식으로 변환하는 전문가 AI입니다.
      이미지의 내용을 추측하지 말고, **오직 시각적인 구조(Visual Structure)**에 근거하여 분석하세요.

      [핵심 임무]:
      이미지에 있는 **'메인 데이터 테이블(Main Data Table)'**을 찾아서, 그 **'컬럼 헤더(Header)' 구조**를 계층적 JSON으로 추출하세요.

      [판단 규칙 (General Rules)]:
      1.  **방향 보정:** 이미지가 90도, 180도 회전되어 있거나 기울어져 있을 수 있습니다. 텍스트가 올바르게 읽히는 방향을 기준으로 분석하세요.
      2.  **헤더 식별 기준:**
          - 표의 **가장 위쪽(또는 왼쪽)**에 위치하며, 데이터가 아닌 **'항목의 이름'**을 나타내는 셀들을 찾으세요.
          - 일반적으로 배경색이 있거나, 굵은 글씨이거나, 데이터 행보다 위계가 높습니다.
          - 예시: "품명", "규격", "수량" (O) / "볼트", "10mm", "5개" (X - 이건 데이터임)
      3.  **계층 구조 (Hierarchy):**
          - 셀이 병합(Merge)되어 상위 개념과 하위 개념으로 나뉘는 경우, 이를 **부모-자식(children)** 구조로 표현하세요.
          - (예: '위험성' 칸 아래에 '빈도'와 '강도' 칸이 있음 -> '위험성'이 부모, '빈도/강도'가 자식)
      4.  **기본값(Default Value) 처리:**
          - 헤더 셀 내부에, 또는 헤더 바로 아래에 **"이미 인쇄되어 있는 고정된 값"**이 있다면 'default_value'로 추출하세요.
          - (예: '단위' 컬럼 아래에 'mm'가 인쇄됨 -> default_value: "mm")
          - 사용자가 수기로 작성해야 하는 빈칸은 null로 두세요.
      5.  **제외 대상:**
          - 표의 제목(Title), 결재란, 날짜/서명란, 페이지 번호 등 **표의 '구조'가 아닌 메타 데이터**는 제외하세요.

      [출력 형식]:
      반드시 \`\`\`json ... \`\`\` 블록으로 감싸서 반환하세요.

      [JSON 구조 예시]:
      \`\`\`json
      {
        "items": [
          { "header_name": "상위헤더1", "default_value": null, "children": [] },
          { 
            "header_name": "상위헤더2", 
            "default_value": null,
            "children": [
              { "header_name": "하위헤더A", "default_value": "고정값", "children": [] },
              { "header_name": "하위헤더B", "default_value": null, "children": [] }
            ]
          }
        ]
      }
      \`\`\`
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

    await insertItemsRecursively(resultJson.items, templateId, null);

    await supabaseAdmin
      .from("assessment_templates")
      .update({ status: "completed", error_message: null })
      .eq("id", templateId);

    return new Response(JSON.stringify({ message: "Success" }), {
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
