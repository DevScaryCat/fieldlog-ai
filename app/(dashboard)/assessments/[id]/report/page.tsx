// /app/(dashboard)/assessments/[id]/report/page.tsx

import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Camera, Eye } from 'lucide-react'; // Eye 아이콘 임포트
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { ReportDataTable } from '@/components/ReportDataTable'; // 1. ReportDataTable 임포트
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"; // 2. Dialog 임포트

export const dynamic = 'force-dynamic';

export default async function ReportPage({ params }: { params: { id: string } }) {
    const { id: assessmentId } = await params;
    const supabase = await createClient();

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
        console.error('Error fetching report data:', error);
        return notFound();
    }

    const { companies: company, assessment_templates: template, findings, assessment_results: results } = assessment;

    const templateItems = template?.template_items?.sort(
        (a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)
    ) || [];

    return (
        <div className="w-full">
            <Button variant="outline" size="sm" className="mb-4" asChild>
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

                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-2xl font-semibold">AI 자동 분석 결과</h3>
                            {/* 3. (핵심) "엑셀 뷰" 모달 버튼 */}
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline">
                                        <Eye className="mr-2 h-4 w-4" />
                                        엑셀 뷰로 열기
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-4xl md:max-w-6xl">
                                    <DialogHeader>
                                        <DialogTitle>{template?.template_name || '분석 결과'}</DialogTitle>
                                        <DialogDescription>
                                            AI가 대본을 분석하여 {company?.name}의 양식을 자동으로 채운 결과입니다.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="max-h-[70vh] overflow-y-auto p-4">
                                        {/* 4. 모달 안에 ReportDataTable 렌더링 */}
                                        <ReportDataTable
                                            templateItems={templateItems}
                                            results={results || []}
                                        />
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                        {/* 5. 페이지 본문에는 간단한 요약이나 사진만 남김 */}
                        <p className="text-muted-foreground">
                            총 {results?.length || 0}개의 분석 항목과 {findings?.length || 0}개의 현장 사진이 발견되었습니다.
                            자세한 내용은 '엑셀 뷰로 열기' 버튼을 클릭하세요.
                        </p>
                    </div>

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