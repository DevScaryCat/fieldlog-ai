// /app/(dashboard)/companies/[id]/assessments/page.tsx

'use client'; // 1. 클라이언트 컴포넌트로 전환

import { createClient } from '@/utils/supabase/client'; // 2. 클라이언트용 Supabase 사용
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
import { FileText, Loader2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { StartAssessmentDialog } from '@/components/StartAssessmentDialog';
import { useParams } from 'next/navigation'; // 3. useParams 훅 사용
import { useState, useEffect, useCallback } from 'react'; // 4. 훅 임포트
import { toast } from 'sonner';

export default function CompanyAssessmentsPage() {
    // 5. Next.js 16+의 클라이언트 컴포넌트에서 params 읽기
    const params = useParams();
    const companyId = params.id as string;
    const supabase = createClient();

    const [assessments, setAssessments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    let fetchError: any = null; // 에러는 단순 변수로 처리

    // 6. 데이터를 불러오는 함수 (useCallback으로 감싸기)
    const fetchAssessments = useCallback(async () => {
        if (!companyId) return;

        setLoading(true);
        const { data, error } = await supabase
            .from('assessments')
            .select('*')
            .eq('company_id', companyId)
            .order('assessment_date', { ascending: false });

        if (error) {
            fetchError = error;
            console.error('💥 Error fetching assessments:', JSON.stringify(fetchError, null, 2));
            toast.error("평가 이력 로딩 실패");
        } else {
            setAssessments(data);
        }
        setLoading(false);
    }, [companyId, supabase]);

    // 7. 페이지 로드 시 데이터 불러오기
    useEffect(() => {
        fetchAssessments();
    }, [fetchAssessments]);

    // 8. Supabase Realtime 구독 설정 (핵심!)
    useEffect(() => {
        // assessments 테이블의 모든 변경 사항 구독
        const channel = supabase.channel(`company-assessments-${companyId}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // INSERT, UPDATE, DELETE 모두 감지
                    schema: 'public',
                    table: 'assessments',
                    filter: `company_id=eq.${companyId}` // 이 사업장의 변경 사항만
                },
                (payload) => {
                    console.log('Realtime change detected (Assessments)!', payload);
                    // DB가 변경되면, 목록을 새로고침
                    toast.info("평가 상태가 업데이트되었습니다.");
                    fetchAssessments();
                }
            )
            .subscribe();

        // 컴포넌트가 언마운트될 때 구독 해제
        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, companyId, fetchAssessments]);


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
                                            <Badge variant={getStatusVariant(assessment.status)} className={assessment.status === 'analyzing' ? 'animate-pulse' : ''}>
                                                {getStatusText(assessment.status)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {assessment.status === 'completed' ? (
                                                <Button variant="outline" size="sm" asChild>
                                                    <Link href={`/assessments/${assessment.id}/report`}>
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
                )}
            </CardContent>
        </Card>
    );
}