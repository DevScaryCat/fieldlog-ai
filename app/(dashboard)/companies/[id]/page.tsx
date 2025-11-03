// /app/(dashboard)/companies/[id]/page.tsx

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
import { FileScan, ArrowLeft } from 'lucide-react';
import UploadTemplateDialog from '@/components/UploadTemplateDialog';
// 1. 탭 컴포넌트 임포트
import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";

export const dynamic = 'force-dynamic';

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
    // 2. 'params'를 'await'로 풀어줍니다. (Next.js 16 버그 수정)
    const { id: companyId } = await params;
    const supabase = await createClient();

    // 3. 사업장 정보와 템플릿 목록을 모두 불러옵니다.
    const companyPromise = supabase
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single();

    const templatesPromise = supabase
        .from('assessment_templates')
        .select(`*`)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

    const [{ data: company, error: companyError }, { data: templates, error: templatesError }] = await Promise.all([
        companyPromise,
        templatesPromise
    ]);

    if (companyError || !company) {
        console.error('Error fetching company:', companyError);
        return notFound();
    }
    if (templatesError) {
        console.error('Error fetching templates:', templatesError);
    }

    return (
        <div className="w-full">
            {/* 4. 레이아웃 헤더 (뒤로가기, 사업장 이름) */}
            <div className="mb-4 flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/companies">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold tracking-tight">{company.name}</h1>
            </div>

            {/* 5. 탭 네비게이션 (Link로 변경) */}
            <Tabs defaultValue="templates" className="w-full">
                <TabsList className="mb-6 grid w-full grid-cols-3 md:w-[400px]">
                    <TabsTrigger value="assessments" asChild>
                        <Link href={`/companies/${companyId}/assessments`}>평가 이력</Link>
                    </TabsTrigger>
                    <TabsTrigger value="templates" asChild>
                        <Link href={`/companies/${companyId}`}>평가 양식</Link>
                    </TabsTrigger>
                    <TabsTrigger value="settings" asChild>
                        <Link href={`/companies/${companyId}/settings`}>사업장 설정</Link>
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            {/* 6. 양식 목록 카드 (기존 이 파일의 메인 콘텐츠) */}
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
                    {templatesError && (
                        <div className="mb-4 p-4 text-destructive border border-destructive rounded-md">
                            <p><strong>데이터 로딩 실패:</strong> {templatesError.message}</p>
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
                                                {/* 7. '보기' 링크 경로 수정 */}
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
                                        {templatesError ? '데이터를 불러올 수 없습니다.' : '등록된 평가 양식이 없습니다.'}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}