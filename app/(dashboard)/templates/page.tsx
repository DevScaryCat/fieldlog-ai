// /app/(dashboard)/templates/page.tsx

import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileScan } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
// 1. 방금 만든 업로드 다이얼로그 컴포넌트 임포트
import UploadTemplateDialog from "@/components/UploadTemplateDialog";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const supabase = await createClient();

  let templates: any[] | null = [];
  let fetchError: any = null;

  try {
    const { data, error } = await supabase
      .from("assessment_templates")
      .select(
        `
        *, 
        companies(name)
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    templates = data;
  } catch (error) {
    fetchError = error;
    console.error("💥 Error fetching templates:", JSON.stringify(fetchError, null, 2));
  }

  return (
    <div className="w-full">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight">평가 양식 관리</h1>
        {/* 2. 기존 버튼을 다이얼로그 컴포넌트로 교체 */}
        <UploadTemplateDialog />
      </header>

      {fetchError && (
        <div className="mb-4 rounded border border-destructive bg-destructive/10 p-4 text-destructive">
          <p>
            <strong>데이터 로딩 실패:</strong>
          </p>
          <pre className="mt-2 text-xs whitespace-pre-wrap">{JSON.stringify(fetchError, null, 2)}</pre>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>등록된 양식 목록</CardTitle>
          <CardDescription>기존 엑셀/종이 문서를 스캔하여 업로드한 디지털 양식입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>양식 이름</TableHead>
                <TableHead>연결된 사업장</TableHead>
                <TableHead>생성일</TableHead>
                <TableHead className="w-[100px] text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates && templates.length > 0 ? (
                templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.template_name}</TableCell>
                    <TableCell className="text-muted-foreground">{template.companies?.name || "미지정"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(template.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/templates/${template.id}`}>
                          <FileScan className="mr-2 h-4 w-4" /> 보기
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    {fetchError ? "데이터를 불러올 수 없습니다." : "등록된 평가 양식이 없습니다."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
