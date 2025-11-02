// /app/(dashboard)/templates/[id]/page.tsx

import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent
} from "@/components/ui/card";
import { ArrowLeft, Edit } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function TemplateDetailPage({ params }: { params: { id: string } }) {
  // Next.js 15+ 에서는 params가 Promise이므로 await로 값을 풀어줍니다.
  const { id: templateId } = await params;
  const supabase = await createClient();

  // 1. 템플릿 기본 정보와, 템플릿에 속한 모든 항목(items)을 함께 불러옵니다.
  const { data: template, error } = await supabase
    .from('assessment_templates')
    .select(`
      *,
      companies (name),
      template_items (*)
    `)
    .eq('id', templateId)
    .single(); // 단일 항목만 가져옵니다.

  if (error || !template) {
    console.error('Error fetching template details:', error);
    return notFound(); // 데이터가 없으면 404 페이지 표시
  }

  // AI가 추출한 항목들을 'sort_order' 순서대로 정렬합니다.
  const items = template.template_items?.sort(
    (a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)
  ) || [];

  return (
    <div className="w-full">
      <Button variant="outline" size="sm" className="mb-4" asChild>
        <Link href="/templates">
          <ArrowLeft className="mr-2 h-4 w-4" />
          양식 목록으로 돌아가기
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{template.template_name}</CardTitle>
          <CardDescription>
            연결된 사업장: {template.companies?.name || '미지정'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">AI가 분석한 양식 컬럼</h3>
            <Button variant="outline" size="sm">
              <Edit className="mr-2 h-4 w-4" />
              양식 수정하기
            </Button>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>컬럼 헤더 (AI 분석)</TableHead>
                  <TableHead>기본값 (AI 분석)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length > 0 ? (
                  items.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.category}</TableCell>
                      <TableCell>{item.item_text || '(비어있음)'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                      AI가 분석한 항목이 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}