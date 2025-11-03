// /supabase/functions/process-template/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.22.0";
import { corsHeaders } from "../_shared/cors.ts";
// 1. Deno 표준 Base64 라이브러리 임포트 (btoa 대체)
import { encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
});

const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 2. req.json()을 맨 처음에 *단 한 번만* 호출합니다.
  const { record: template } = await req.json();
  const templateId = template?.id;
  const fileUrl = template?.original_file_url;

  try {
    if (!templateId || !fileUrl) {
      throw new Error("Webhook 페이로드에 templateId 또는 fileUrl이 없습니다.");
    }

    // 1. Storage에서 파일 다운로드
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage.from("findings").download(fileUrl);
    if (downloadError) throw downloadError;

    // 3. (FIX 1) Base64 인코딩: Deno 표준 'encode' 함수로 변경
    const imageBuffer = await fileData.arrayBuffer();
    const imageBase64 = encode(imageBuffer); // <-- Call Stack 문제 해결
    const imageMediaType = fileData.type || "image/jpeg";

    // 4. Claude Vision API 프롬프트
    const prompt = `
      당신은 이 이미지에 있는 표(Table)의 구조를 분석하는 AI입니다.
      표의 각 **컬럼 헤더(Column Header)**를 순서대로 정확하게 추출해야 합니다.
      
      [중요]: 이미지가 90도 또는 180도 회전되어 있을 수 있습니다. 텍스트를 인식할 때 이 점을 반드시 고려하여, 회전된 상태에서도 표의 헤더를 정확히 읽어주세요.

      [분석 목표]:
      1.  **헤더 추출:** 이미지에 있는 표의 헤더를 순서대로 추출합니다. (예: "no", "성함", "부서명", "공정명", "유해인자", "착용 보호구", "비고")
      2.  **기본값 추출:** 만약 '유해인자' 컬럼처럼 특정 컬럼에 "소음"처럼 이미 값이 채워져 있다면, 그 값을 'default_value'로 추출합니다. 값이 비어있다면 null로 설정합니다.

      [출력 형식]:
      반드시 아래와 같은 JSON 배열 형식으로만 응답해 주세요. 다른 설명은 절대 추가하지 마세요.
      \`\`\`json
      {
        "columns": [
          { "header_name": "no", "default_value": null },
          { "header_name": "성함", "default_value": null },
          { "header_name": "유해인자", "default_value": "소음" }
        ]
      }
      \`\`\`
    `;

    // 5. Claude Vision API 호출
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

    // 6. JSON 파싱
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
    if (!Array.isArray(resultJson.columns)) throw new Error("AI 응답 형식이 잘못되었습니다.");

    // 7. 'template_items'에 삽입
    const itemsToInsert = resultJson.columns.map((item: any, index: number) => ({
      template_id: templateId,
      header_name: item.header_name,
      default_value: item.default_value || null,
      sort_order: index,
    }));

    const { error: insertError } = await supabaseAdmin.from("template_items").insert(itemsToInsert);
    if (insertError) throw insertError;

    // 8. 성공! 'assessment_templates' 상태를 'completed'로 업데이트
    await supabaseAdmin
      .from("assessment_templates")
      .update({ status: "completed", error_message: null })
      .eq("id", templateId);

    return new Response(JSON.stringify({ message: "Success" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    // 9. (FIX 2) 실패! 'catch' 블록에서 req.json()을 다시 호출하지 않음
    //    맨 위에서 가져온 templateId를 바로 사용합니다.
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
