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
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage.from("findings").download(fileUrl);

    if (downloadError) throw new Error(`파일 다운로드 실패: ${downloadError.message}`);

    const imageBuffer = await fileData.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString("base64");
    const imageMediaType = fileData.type || "image/jpeg";

    // --- 이 부분이 핵심 수정 사항입니다 (새로운 프롬프트) ---
    const prompt = `
      당신은 이미지에서 표(Table)의 구조를 분석하는 OCR 및 데이터 추출 AI입니다.

      [분석 목표]:
      이미지에 있는 표의 **최상단 메인 컬럼 헤더(Main Column Headers)**를 **보이는 순서대로** 정확하게 추출합니다.

      [중요 규칙]:
      1.  **회전 고려:** 이미지가 90도 또는 180도 회전되어 있을 수 있습니다. 텍스트를 인식할 때 이 점을 반드시 고려하여, 회전된 상태에서도 표의 헤더를 정확히 읽어주세요.
      2.  **제목 무시:** '소음밀착검사 대상자 명단'과 같은 표의 **제목(Title)**은 헤더가 아니므로 **완전히 무시**하세요.
      3.  **하위 헤더 무시:** '공정명칭'이나 '유해인자'처럼 여러 하위 셀을 포함하는 병합된 헤더가 있더라도, **최상위 헤더('공정명칭', '유해인자')만 추출**하고 그 아래의 하위 텍스트(예: '소음')는 무시합니다.
      4.  **헤더만 추출:** 오직 **컬럼 헤더 이름**만 추출합니다. (기본값 추출 X)
      5.  **정확한 순서:** 표에 보이는 순서대로(왼쪽에서 오른쪽, 또는 회전된 경우 위에서 아래) 추출해야 합니다.

      [출력 형식]:
      추출한 헤더 이름들을 **JSON 배열** 형식으로만 응답해 주세요.
      다른 설명이나 대화 없이, 오직 JSON 객체만 \`\`\`json ... \`\`\` 마크다운 블록으로 감싸서 반환해야 합니다.
      
      [출력 예시 (제공된 이미지 기준)]:
      \`\`\`json
      {
        "headers": ["no", "성함", "부서명", "공정명칭", "유해인자", "착용 보호구", "비고"]
      }
      \`\`\`
    `;
    // --------------------------------------------------------

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

    if (!Array.isArray(resultJson.headers)) {
      throw new Error("AI 응답 형식이 잘못되었습니다. (headers 배열이 아님)");
    }

    // --- 이 부분이 수정되었습니다 (DB 저장 로직) ---
    // 6. 'template_items' 테이블에 AI가 추출한 "헤더"만 저장
    const itemsToInsert = resultJson.headers.map((headerName: string, index: number) => ({
      template_id: templateId,
      header_name: headerName, // 'header_name' 컬럼에 헤더 이름 저장
      default_value: null, // 'default_value'는 null로 저장
      sort_order: index,
    }));
    // ------------------------------------------------

    const supabase = await createClient();
    const { error: insertError } = await supabase.from("template_items").insert(itemsToInsert);

    if (insertError) throw new Error(`DB 삽입 실패: ${insertError.message}`);

    return NextResponse.json({ message: `${itemsToInsert.length}개의 컬럼이 성공적으로 생성되었습니다.` });
  } catch (error: any) {
    console.error("AI Template Analysis Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
