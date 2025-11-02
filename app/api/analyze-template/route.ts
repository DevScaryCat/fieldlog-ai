// /app/api/analyze-template/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient as createServiceRoleClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const supabaseAdmin = createServiceRoleClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { templateId, fileUrl } = await req.json();

  if (!templateId || !fileUrl) {
    return NextResponse.json({ error: "Template ID와 File URL이 필요합니다." }, { status: 400 });
  }

  try {
    // 1. Supabase Storage에서 이미지 파일 다운로드
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage.from("findings").download(fileUrl);

    if (downloadError) throw new Error(`파일 다운로드 실패: ${downloadError.message}`);

    // 2. 파일을 Base64로 인코딩
    const imageBuffer = await fileData.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString("base64");
    const imageMediaType = fileData.type || "image/jpeg";

    // 3. Claude Vision API에 보낼 프롬프트 정의
    const prompt = `
      당신은 이 이미지에 있는 표(Table)의 구조를 분석하는 AI입니다.
      표의 각 **컬럼 헤더(Column Header)**를 순서대로 정확하게 추출해야 합니다.
      
      또한, '유해인자' 컬럼처럼 이미 '소음'이라는 값이 채워져 있다면, 그 **기본값(Default Value)**도 함께 추출해야 합니다.

      [분석 목표]:
      1.  **헤더 추출:** 이미지에 있는 표의 헤더를 순서대로 추출합니다. (예: "no", "성함", "부서명", "공정명", "유해인자", "착용 보호구", "비고")
      2.  **기본값 추출:** 만약 특정 컬럼(예: 유해인자)에 "소음"처럼 이미 값이 채워져 있다면, 그 값을 'default_value'로 추출합니다. 값이 비어있다면 null로 설정합니다.

      [출력 형식]:
      반드시 아래와 같은 JSON 배열 형식으로만 응답해 주세요. 다른 설명은 절대 추가하지 마세요.
      \`\`\`json
      {
        "columns": [
          { "header_name": "no", "default_value": null },
          { "header_name": "성함", "default_value": null },
          { "header_name": "부서명", "default_value": null },
          { "header_name": "공정명", "default_value": null },
          { "header_name": "유해인자", "default_value": "소음" },
          { "header_name": "착용 보호구", "default_value": null },
          { "header_name": "비고", "default_value": null }
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

    // 5. Claude의 응답(JSON)을 안정적으로 파싱
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

    if (!Array.isArray(resultJson.columns)) {
      throw new Error("AI 응답 형식이 잘못되었습니다. (columns 배열이 아님)");
    }

    // 6. 'template_items' 테이블에 AI가 추출한 "헤더"와 "기본값"을 저장
    const itemsToInsert = resultJson.columns.map((item: any, index: number) => ({
      template_id: templateId,
      category: item.header_name,
      // --- 이 부분이 수정되었습니다 ---
      // item.default_value가 null이나 undefined이면, 빈 문자열('')을 대신 삽입합니다.
      item_text: item.default_value || "",
      // ----------------------------
      sort_order: index,
    }));

    const supabase = await createClient();
    const { error: insertError } = await supabase.from("template_items").insert(itemsToInsert);

    if (insertError) throw new Error(`DB 삽입 실패: ${insertError.message}`);

    return NextResponse.json({ message: `${itemsToInsert.length}개의 컬럼이 성공적으로 생성되었습니다.` });
  } catch (error: any) {
    console.error("AI Template Analysis Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
