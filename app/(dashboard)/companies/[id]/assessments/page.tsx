// /app/(dashboard)/companies/[id]/assessments/page.tsx

import { createClient } from '@/utils/supabase/server';
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
import { FileText } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
// 1. StartAssessmentDialog 임포트
import { StartAssessmentDialog } from '@/components/StartAssessmentDialog';

export const dynamic = 'force-dynamic';

export default async function CompanyAssessmentsPage({ params }: { params: { id: string } }) {
    const { id: companyId } = await params;
    const supabase = await createClient();

    let assessments: any[] | null = [];
    let fetchError: any = null;

    try {
        const { data, error } = await supabase
            .from('assessments')
            .select('*')
            .eq('company_id', companyId)
            .order('assessment_date', { ascending: false });

        if (error) throw error;
        assessments = data;
    } catch (error) {
        fetchError = error;
        console.error('💥 Error fetching assessments:', JSON.stringify(fetchError, null, 2));
    }

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'completed': return 'default';
            case 'in_progress': return 'destructive';
            default: return 'outline';
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>평가 이력</CardTitle>
                    <CardDescription>
                        이 사업장에서 수행된 모든 평가 이력입니다.
                    </CardDescription>
                </div>
                {/* 2. 기존 Button을 Dialog 컴포넌트로 교체하고 companyId 전달 */}
                <StartAssessmentDialog companyId={companyId} />
            </CardHeader>
            <CardContent>
                {fetchError && (
                    <div className="mb-4 p-4 text-destructive border border-destructive rounded-md">
                        <p><strong>데이터 로딩 실패:</strong> {fetchError.message}</p>
                    </div>
                )}
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>평가일</TableHead>
                            <TableHead>상태</TableHead>
                            <TableHead className="w-[100px] text-right">보고서</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {assessments && assessments.length > 0 ? (
                            assessments.map((assessment) => (
                                <TableRow key={assessment.id}>
                                    <TableCell className="font-medium">
                                        {new Date(assessment.assessment_date).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={getStatusVariant(assessment.status)}>
                                            {assessment.status === 'completed' ? '완료됨' : '진행 중'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {assessment.status === 'completed' ? (
                                            <Button variant="outline" size="sm" asChild>
                                                {/* 3. (중요) 보고서 보기 링크 경로 수정 */}
                                                {/* /assessments/[id]/report -> /record/[id]/report */}
                                                <Link href={`/record/${assessment.id}/report`}>
                                                    <FileText className="mr-2 h-4 w-4" /> 보기
                                                </Link>
                                            </Button>
                                        ) : (
                                            <Button variant="outline" size="sm" disabled>
                                                <FileText className="mr-2 h-4 w-4" /> 보기
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                    {fetchError ? '데이터를 불러올 수 없습니다.' : '진행된 평가가 없습니다.'}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}