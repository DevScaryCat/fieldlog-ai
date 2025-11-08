// /app/(dashboard)/assessments/[id]/report/page.tsx

import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { FileText, MapPin, AlertTriangle, Wrench, ArrowLeft, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function ReportPage({ params }: { params: { id: string } }) {
    // 1. (버그 수정) Next.js 16+를 위해 'params'를 await로 풀어줍니다.
    const { id: assessmentId } = await params;
    const supabase = await createClient();

    // 2. (로직 수정) 'template'이 아닌 'assessment' 데이터를 불러옵니다.
    //    '답안지(assessment_results)'와 '질문지(template_items)'를 모두 JOIN합니다.
    const { data: assessment, error } = await supabase
        .from('assessments')
        .select(`
      *,
      companies (name),
      assessment_templates ( 
        template_name, 
        template_items (id, header_name, sort_order, parent_id) 
      ),
      findings (id, photo_before_url, timestamp_seconds),
      assessment_results ( template_item_id, result_value )
    `)
        .eq('id', assessmentId)
        .single();

    if (error || !assessment) {
        // 3. (버그 수정) 에러 로그를 올바르게 표시
        console.error('💥 Error fetching report data:', JSON.stringify(error, null, 2));
        return notFound();
    }

    const { companies: company, assessment_templates: template, findings, assessment_results: results } = assessment;

    // 4. "질문지"(template_items)를 기준으로 "답안지"(results)를 매핑합니다.
    const templateItems = template?.template_items?.sort(
        (a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)
    ) || [];

    // 5. AI가 여러 세트의 답안을 생성했을 수 있으므로, 세트별로 그룹화합니다.
    const resultsMap = new Map<string, string[]>();
    if (results) {
        for (const result of results) {
            if (!resultsMap.has(result.template_item_id)) {
                resultsMap.set(result.template_item_id, []);
            }
            resultsMap.get(result.template_item_id)!.push(result.result_value || '(내용 없음)');
        }
    }

    // 6. AI가 발견한 "세트"의 수 (예: 위험 요인 2개 발견 시 2)
    const resultSetCount = resultsMap.size > 0 ? Math.max(...Array.from(resultsMap.values()).map(v => v.length)) : 0;

    return (
        <div className="w-full">
            <Button variant="outline" size="sm" className="mb-4" asChild>
                {/* 7. '평가 이력' 페이지로 돌아가기 (올바른 경로) */}
                <Link href={`/companies/${assessment.company_id}/assessments`}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    평가 이력으로 돌아가기
                </Link>
            </Button>

            <Card>
                <CardHeader>
                    <CardTitle className="text-3xl font-bold">{company?.name || '사업장'}</CardTitle>
                    <CardDescription className="text-lg">
                        {template?.template_name || '위험성 평가 보고서'}
                    </CardDescription>
                    <p className="text-sm text-muted-foreground pt-2">
                        평가일: {new Date(assessment.assessment_date).toLocaleDateString()}
                    </p>
                </CardHeader>
                <CardContent className="space-y-10">

                    {/* --- 8. AI 분석 결과 (답안지) 테이블 --- */}
                    <div>
                        <h3 className="text-2xl font-semibold mb-4">AI 자동 분석 결과</h3>
                        {resultSetCount > 0 ? (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[200px]">평가 항목 (질문지)</TableHead>
                                            {Array.from({ length: resultSetCount }).map((_, index) => (
                                                <TableHead key={index}>AI 분석 결과 #{index + 1}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {templateItems.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">{item.header_name}</TableCell>
                                                {Array.from({ length: resultSetCount }).map((_, index) => (
                                                    <TableCell key={index}>
                                                        {resultsMap.get(item.id)?.[index] || <span className="text-muted-foreground">/</span>}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="text-center py-10 rounded-lg bg-slate-950">
                                <FileText size={48} className="mx-auto text-slate-600 mb-4" />
                                <h3 className="text-xl font-semibold text-white">데이터 없음</h3>
                                <p className="text-slate-400 mt-2">AI가 분석한 결과가 없거나, 아직 분석이 진행 중입니다.</p>
                            </div>
                        )}
                    </div>

                    {/* --- 9. 첨부된 현장 사진 목록 --- */}
                    <div>
                        <h3 className="text-2xl font-semibold mb-4">첨부된 현장 사진</h3>
                        {findings && findings.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {findings.map((finding: any) => {
                                    const { data: { publicUrl } } = supabase.storage.from('findings').getPublicUrl(finding.photo_before_url!);
                                    return (
                                        <div key={finding.id} className="rounded-lg border overflow-hidden">
                                            <div className="relative w-full h-80">
                                                <Image
                                                    src={publicUrl}
                                                    alt="현장 사진"
                                                    fill
                                                    className="object-cover bg-slate-800"
                                                />
                                            </div>
                                            <div className="p-4 bg-muted/50">
                                                <p className="text-sm text-muted-foreground">
                                                    촬영 시점: (Timestamp: {finding.timestamp_seconds})
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-10 rounded-lg bg-slate-950">
                                <Camera size={48} className="mx-auto text-slate-600 mb-4" />
                                <h3 className="text-xl font-semibold text-white">데이터 없음</h3>
                                <p className="text-slate-400 mt-2">이 평가에 대해 첨부된 사진이 없습니다.</p>
                            </div>
                        )}
                    </div>

                </CardContent>
            </Card>
        </div>
    );
}