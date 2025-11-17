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
import { FileText, Loader2, RefreshCw } from 'lucide-react'; // RefreshCw 아이콘 임포트
import { Badge } from "@/components/ui/badge";
import { StartAssessmentDialog } from '@/components/StartAssessmentDialog';
import { useParams, useRouter } from 'next/navigation';
// 1. (핵심) 'useMemo' 임포트
import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';

export default function CompanyAssessmentsPage() {
    const params = useParams();
    const companyId = params.id as string;
    const router = useRouter();

    // 2. (핵심) Supabase 클라이언트를 useMemo로 감싸서, 렌더링 시 재성성 방지
    const supabase = useMemo(() => createClient(), []);

    const [assessments, setAssessments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<any>(null);

    // 3. fetchAssessments (useCallback으로 감싸서 안정화)
    const fetchAssessments = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        setFetchError(null);

        const { data, error } = await supabase
            .from('assessments')
            .select('*')
            .eq('company_id', companyId)
            .order('assessment_date', { ascending: false });

        if (error) {
            setFetchError(error);
            console.error('💥 Error fetching assessments:', JSON.stringify(error, null, 2));
            toast.error("평가 이력 로딩 실패");
        } else {
            setAssessments(data);
        }
        setLoading(false);
    }, [companyId, supabase]);

    // 4. 페이지 로드 시 데이터 1회 불러오기
    useEffect(() => {
        fetchAssessments();
    }, [fetchAssessments]);

    // 5. Realtime 구독 (안정화된 버전)
    useEffect(() => {
        // 6. (중요) Realtime 핸들러: DB fetch 대신, React 상태(useState)를 직접 수정
        const handleRealtimePayload = (payload: any) => {
            console.log('Realtime change detected!', payload);

            if (payload.eventType === 'INSERT') {
                // (dev/mp3-test로 올린 새 항목이 여기에 해당)
                toast.info("새로운 평가가 목록에 추가되었습니다.");
                setAssessments((currentAssessments) => [
                    payload.new, // 새 항목
                    ...currentAssessments, // 기존 목록
                ]);
            }
            else if (payload.eventType === 'UPDATE') {
                // (음성 없음 -> 'failed' 또는 AI 분석 -> 'completed'가 여기에 해당)
                toast.info("평가 상태가 업데이트되었습니다.");
                setAssessments((currentAssessments) =>
                    currentAssessments.map((item) =>
                        item.id === payload.new.id ? payload.new : item // 기존 항목 교체
                    )
                );
            }
            else if (payload.eventType === 'DELETE') {
                toast.info("평가 항목이 삭제되었습니다.");
                setAssessments((currentAssessments) =>
                    currentAssessments.filter((item) => item.id !== payload.old.id) // 항목 제거
                );
            }
        };

        const channel = supabase.channel(`company-assessments-${companyId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'assessments',
                    filter: `company_id=eq.${companyId}`
                },
                handleRealtimePayload // 분리된 핸들러 사용
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
        // 7. (중요) 의존성 배열에 'supabase'와 'companyId'만 둠
    }, [supabase, companyId]);


    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'completed': return 'default';
            case 'in_progress': return 'destructive';
            case 'analyzing': return 'outline';
            case 'failed': return 'destructive'; // '실패' 상태는 destructive(빨간색)
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

    // '다시 평가' 버튼 핸들러
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
                        <p><strong>데이터 로딩 실패:</strong> {fetchError.message}</p>
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
                                            {/* --- (핵심 수정) 버튼 로직 --- */}
                                            {assessment.status === 'completed' ? (
                                                <Button variant="outline" size="sm" asChild>
                                                    <Link href={`/assessments/${assessment.id}/report`}>
                                                        <FileText className="mr-2 h-4 w-4" /> 보기
                                                    </Link>
                                                </Button>
                                            ) : assessment.status === 'failed' ? (
                                                // (실패) "다시 시도" 버튼
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => handleRetryAssessment(assessment.id)}
                                                >
                                                    <RefreshCw className="mr-2 h-4 w-4" /> 다시 시도
                                                </Button>
                                            ) : (
                                                // (진행 중 / 분석 중) 비활성화된 "보기" 버튼
                                                <Button variant="outline" size="sm" disabled>
                                                    <FileText className="mr-2 h-4 w-4" /> 보기
                                                </Button>
                                            )}
                                            {/* --------------------------- */}
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
                )}
            </CardContent>
        </Card>
    );
}