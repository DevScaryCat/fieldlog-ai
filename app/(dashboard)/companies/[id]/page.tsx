// /app/(dashboard)/companies/[id]/page.tsx

'use client'; // 1. 실시간(Realtime) 감지를 위해 클라이언트 컴포넌트로 전환

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
import { FileScan, Loader2, AlertTriangle } from 'lucide-react';
import UploadTemplateDialog from '@/components/UploadTemplateDialog';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function CompanyTemplatesPage() {
    const params = useParams();
    const companyId = params.id as string;
    const supabase = createClient();

    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // 3. 데이터를 불러오는 함수
    const fetchTemplates = async () => {
        const { data, error } = await supabase
            .from('assessment_templates')
            .select(`*`)
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('💥 Error fetching templates:', error);
            toast.error("양식 목록 로딩 실패", { description: error.message });
        } else {
            setTemplates(data);
        }
        setLoading(false);
    };

    // 4. 페이지 로드 시 데이터 불러오기
    useEffect(() => {
        fetchTemplates();
    }, [companyId]); // companyId가 변경될 때만 실행

    // 5. Supabase Realtime 설정 (핵심)
    useEffect(() => {
        // assessment_templates 테이블의 모든 변경 사항 구독
        const channel = supabase.channel(`company-templates-${companyId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'assessment_templates',
                    filter: `company_id=eq.${companyId}`
                },
                (payload) => {
                    console.log('Realtime change received!', payload);
                    // 변경 사항이 감지되면, 목록을 새로고침
                    fetchTemplates();
                }
            )
            .subscribe();

        // 컴포넌트가 언마운트될 때 구독 해제
        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, companyId]); // 의존성 배열에 supabase, companyId 추가

    // 로딩 상태 UI
    if (loading) {
        return <div className="text-center p-10">양식 목록을 불러오는 중...</div>;
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>평가 양식</CardTitle>
                    <CardDescription>
                        이 사업장에 연결된 디지털 양식 목록입니다.
                    </CardDescription>
                </div>
                {/* 6. companyId를 prop으로 전달 */}
                <UploadTemplateDialog companyId={companyId} />
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>양식 이름</TableHead>
                            <TableHead>상태</TableHead>
                            <TableHead className="w-[100px] text-right">작업</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {templates && templates.length > 0 ? (
                            templates.map((template) => (
                                <TableRow key={template.id}>
                                    <TableCell className="font-medium">{template.template_name}</TableCell>
                                    {/* 7. 실시간 상태 표시 */}
                                    <TableCell>
                                        {template.status === 'completed' && <Badge variant="default">분석 완료</Badge>}
                                        {template.status === 'processing' && <Badge variant="outline" className="animate-pulse"><Loader2 className="mr-2 h-3 w-3 animate-spin" />분석 중...</Badge>}
                                        {template.status === 'failed' && <Badge variant="destructive"><AlertTriangle className="mr-2 h-3 w-3" />분석 실패</Badge>}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            asChild
                                            // 8. 분석이 완료된 항목만 '보기' 버튼 활성화
                                            disabled={template.status !== 'completed'}
                                        >
                                            <Link href={`/companies/${companyId}/${template.id}`}>
                                                <FileScan className="mr-2 h-4 w-4" /> 보기
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                    등록된 평가 양식이 없습니다.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}