// /app/(dashboard)/companies/[id]/page.tsx

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
import { FileScan } from 'lucide-react';
import UploadTemplateDialog from '@/components/UploadTemplateDialog';

export const dynamic = 'force-dynamic';

export default async function CompanyTemplatesPage({ params }: { params: { id: string } }) {
    // 1. Next.js 16+ 방식: params를 await로 풀어줍니다.
    const { id: companyId } = await params;
    const supabase = await createClient();

    let templates: any[] | null = [];
    let fetchError: any = null;

    try {
        const { data, error } = await supabase
            .from('assessment_templates')
            .select(`*`)
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        templates = data;
    } catch (error) {
        fetchError = error;
        console.error('💥 Error fetching templates for company:', JSON.stringify(fetchError, null, 2));
    }

    // 2. 탭 레이아웃이 있으므로 Card만 반환합니다.
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>평가 양식</CardTitle>
                    <CardDescription>
                        이 사업장에 연결된 디지털 양식 목록입니다.
                    </CardDescription>
                </div>
                <UploadTemplateDialog />
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
                            <TableHead>양식 이름</TableHead>
                            <TableHead>생성일</TableHead>
                            <TableHead className="w-[100px] text-right">작업</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {templates && templates.length > 0 ? (
                            templates.map((template) => (
                                <TableRow key={template.id}>
                                    <TableCell className="font-medium">{template.template_name}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {new Date(template.created_at).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" asChild>
                                            {/* 3. '보기' 링크 경로 수정 (새로운 구조) */}
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
                                    {fetchError ? '데이터를 불러올 수 없습니다.' : '등록된 평가 양식이 없습니다.'}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}