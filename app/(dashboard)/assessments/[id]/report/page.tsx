// /app/(dashboard)/assessments/[id]/report/page.tsx

import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Camera, Eye, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { ReportDataTable } from '@/components/ReportDataTable';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { DeleteAssessmentButton } from '@/components/DeleteAssessmentButton';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton'; // [추가] 엑셀 버튼 임포트

export const dynamic = 'force-dynamic';

export default async function ReportPage({ params }: { params: { id: string } }) {
    // Next.js 15+ 대응: await params
    const { id: assessmentId } = await params;
    const supabase = await createClient();

    // 1. 데이터 조회 (주석 제거됨)
    const { data: assessment, error } = await supabase
        .from('assessments')
        .select(`
            *,
            companies (name),
            assessment_templates ( 
                template_name,
                ai_type,
                template_items (id, header_name, sort_order, parent_id) 
            ),
            findings (id, photo_before_url, timestamp_seconds),
            assessment_results ( template_item_id, result_value, legal_basis, solution )
        `)
        .eq('id', assessmentId)
        .single();

    if (error || !assessment) {
        console.error("Error fetching assessment:", error);
        return notFound();
    }

    const { companies: company, assessment_templates: template, findings, assessment_results: results } = assessment;
    const templateItems = template?.template_items?.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)) || [];

    const aiType = template?.ai_type || 'safety';

    // --- [누락 항목 분석 로직] ---
    const filledItemIds = new Set(results?.map((r: any) => r.template_item_id));
    const missingItems = templateItems.filter((item: any) => !filledItemIds.has(item.id));

    const totalCount = templateItems.length;
    const filledCount = totalCount - missingItems.length;
    const progress = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;
    // -------------------------

    return (
        <div className="w-full pb-20">
            {/* 상단 네비게이션 및 액션 바 */}
            <div className="flex items-center justify-between mb-4">
                <Button variant="outline" size="sm" asChild>
                    <Link href={`/companies/${assessment.company_id}/assessments`}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        평가 이력으로 돌아가기
                    </Link>
                </Button>

                {/* 보고서 삭제 버튼 */}
                <DeleteAssessmentButton
                    assessmentId={assessment.id}
                    companyId={assessment.company_id}
                />
            </div>

            <div className="grid gap-6">
                {/* 1. 상단 요약 카드 (제목 & 진행률) */}
                <Card>
                    <CardHeader>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-2xl font-bold">
                                    {assessment.title || template?.template_name || '위험성 평가 보고서'}
                                </CardTitle>
                                <CardDescription className="text-lg mt-1">
                                    {company?.name} | {new Date(assessment.assessment_date).toLocaleDateString()}
                                </CardDescription>
                                <div className="mt-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                    {aiType === 'meeting' ? '📝 회의록 모드' : '🚧 안전점검 모드'}
                                </div>
                            </div>
                            <div className="min-w-[200px] text-right">
                                <span className="text-sm text-muted-foreground mb-1 block">항목 작성률</span>
                                <div className="flex items-center gap-2">
                                    <div className="h-2 flex-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${progress === 100 ? 'bg-green-500' : 'bg-blue-600'}`}
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <span className="font-bold">{progress}%</span>
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* 누락 항목 경고창 */}
                        {missingItems.length > 0 ? (
                            <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900 rounded-md p-4">
                                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-500 font-semibold mb-2">
                                    <AlertTriangle className="h-5 w-5" />
                                    <span>작성되지 않은 항목이 {missingItems.length}개 있습니다.</span>
                                </div>
                                <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-600 space-y-1 ml-1">
                                    {missingItems.map((item: any) => (
                                        <li key={item.id}>{item.header_name}</li>
                                    ))}
                                </ul>
                                <p className="text-xs text-yellow-600 dark:text-yellow-700 mt-2">
                                    * 해당 내용은 녹음 대본에서 감지되지 않았습니다. 추가 인터뷰가 필요할 수 있습니다.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-md p-4 flex items-center gap-2 text-green-800 dark:text-green-500">
                                <CheckCircle2 className="h-5 w-5" />
                                <span className="font-semibold">모든 평가 항목이 작성되었습니다. 완벽합니다!</span>
                            </div>
                        )}

                        <div className="flex justify-between items-center pt-4 border-t">
                            <h3 className="text-xl font-semibold">AI 자동 분석 상세</h3>

                            {/* [수정] 버튼 그룹 (엑셀 다운로드 + 결과 보기) */}
                            <div className="flex gap-2">
                                <ExcelDownloadButton
                                    title={assessment.title || "평가결과"}
                                    headers={templateItems}
                                    results={results || []}
                                />

                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="default">
                                            <Eye className="mr-2 h-4 w-4" />
                                            전체 결과 보기
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-4xl md:max-w-6xl w-[95vw] h-[80vh]">
                                        <DialogHeader>
                                            <DialogTitle>{assessment.title || template?.template_name}</DialogTitle>
                                            <DialogDescription>
                                                {aiType === 'meeting'
                                                    ? "AI가 분석한 회의 논의 내용 및 향후 계획입니다."
                                                    : "AI가 분석한 현장 상황, 법적 근거, 개선 솔루션입니다."}
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="flex-1 overflow-auto p-1">
                                            <ReportDataTable
                                                templateItems={templateItems}
                                                results={results || []}
                                                aiType={aiType}
                                            />
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. 사진 카드 */}
                <Card>
                    <CardHeader>
                        <CardTitle>현장 사진 ({findings?.length || 0})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {findings && findings.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {findings.map((finding: any) => {
                                    const { data: { publicUrl } } = supabase.storage.from('findings').getPublicUrl(finding.photo_before_url!);
                                    return (
                                        <div key={finding.id} className="relative aspect-video rounded-lg overflow-hidden border bg-black">
                                            <Image
                                                src={publicUrl}
                                                alt="현장 사진"
                                                fill
                                                className="object-contain"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <Camera className="mx-auto h-10 w-10 mb-2 opacity-20" />
                                <p>등록된 사진이 없습니다.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}