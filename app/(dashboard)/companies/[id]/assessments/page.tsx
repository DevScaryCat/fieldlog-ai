// /app/(dashboard)/companies/[id]/assessments/page.tsx

'use client';

import { createClient } from '@/utils/supabase/client';
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
import { FileText, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { StartAssessmentDialog } from '@/components/StartAssessmentDialog';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';

export default function CompanyAssessmentsPage() {
    const params = useParams();
    const companyId = params.id as string;
    const router = useRouter();

    const supabase = useMemo(() => createClient(), []);

    const [assessments, setAssessments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<any>(null);

    const loadData = async () => {
        try {
            const { data, error } = await supabase
                .from('assessments')
                .select('*')
                .eq('company_id', companyId)
                .order('assessment_date', { ascending: false });

            if (error) throw error;
            setAssessments(data || []);
        } catch (error) {
            console.error('Error loading assessments:', error);
            setFetchError(error);
            toast.error("데이터 로딩 실패");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!companyId) return;
        loadData();

        const channel = supabase.channel(`assessments-realtime-${companyId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'assessments',
                    filter: `company_id=eq.${companyId}`
                },
                (payload) => {
                    console.log('Realtime update:', payload);
                    if (payload.eventType === 'UPDATE') {
                        const newStatus = payload.new.status;
                        if (newStatus === 'completed') toast.success("AI 분석이 완료되었습니다!");
                    }
                    setTimeout(() => { loadData(); }, 500);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, companyId]);


    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'completed': return 'default';
            case 'in_progress': return 'destructive';
            case 'analyzing': return 'outline';
            case 'failed': return 'destructive';
            default: return 'secondary';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'completed': return '완료됨';
            case 'in_progress': return '진행 중';
            case 'analyzing': return 'AI 분석 중';
            case 'failed': return '실패';
            default: return status;
        }
    }

    const handleRetryAssessment = (assessmentId: string) => {
        router.push(`/assessments/${assessmentId}`);
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
                <StartAssessmentDialog companyId={companyId} />
            </CardHeader>
            <CardContent>
                {fetchError && (
                    <div className="mb-4 p-4 text-destructive border border-destructive rounded-md">
                        <p><strong>데이터 로딩 실패</strong></p>
                    </div>
                )}
                {loading && (
                    <div className="flex justify-center items-center h-24">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                )}
                {!loading && (
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
                                            <Badge
                                                variant={getStatusVariant(assessment.status)}
                                                className={assessment.status === 'analyzing' ? 'animate-pulse' : ''}
                                            >
                                                {getStatusText(assessment.status)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                {/* 실패 시 재시도 버튼 표시 (선택사항) */}
                                                {assessment.status === 'failed' && (
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleRetryAssessment(assessment.id)}
                                                    >
                                                        <RefreshCw className="h-4 w-4" />
                                                    </Button>
                                                )}

                                                {/* --- (핵심 수정) 상태 상관없이 무조건 활성화된 '보기' 버튼 --- */}
                                                <Button variant="outline" size="sm" asChild>
                                                    <Link href={`/assessments/${assessment.id}/report`}>
                                                        <FileText className="mr-2 h-4 w-4" /> 보기
                                                    </Link>
                                                </Button>
                                                {/* ----------------------------------------------------- */}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                        평가 이력이 없습니다.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}