// /app/(dashboard)/companies/[id]/[templateId]/page.tsx

import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"; // 1. Dialog 임포트
import { ArrowLeft, Edit, Eye } from 'lucide-react'; // 2. Eye 아이콘 임포트
import { TemplateEditor } from '@/components/TemplateEditor';
import { TemplateExcelView } from '@/components/TemplateExcelView'; // 3. 엑셀 뷰 임포트

export const dynamic = 'force-dynamic';

export default async function TemplateDetailPage({ params }: { params: { id: string, templateId: string } }) {
    const { id: companyId, templateId } = await params;
    const supabase = await createClient();

    const { data: template, error } = await supabase
        .from('assessment_templates')
        .select(`
      *,
      companies (name),
      template_items (*)
    `)
        .eq('id', templateId)
        .eq('company_id', companyId)
        .single();

    if (error || !template) {
        console.error('Error fetching template details:', error);
        return notFound();
    }

    const items = template.template_items || [];

    return (
        <div className="w-full">
            <Button variant="outline" size="sm" className="mb-4" asChild>
                <Link href={`/companies/${companyId}`}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    양식 목록으로 돌아가기
                </Link>
            </Button>

            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">{template.template_name}</CardTitle>
                    <CardDescription>
                        연결된 사업장: {template.companies?.name || '미지정'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* 4. (수정) "엑셀 뷰로 미리보기" 버튼 + Dialog 추가 */}
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">양식 구조 편집 (트리 뷰)</h3>
                        <div className="flex gap-2">
                            {/* 엑셀 뷰 모달 */}
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        <Eye className="mr-2 h-4 w-4" />
                                        엑셀 뷰로 미리보기
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-4xl md:max-w-6xl"> {/* 5. 모달 크기 크게 */}
                                    <DialogHeader>
                                        <DialogTitle>{template.template_name}</DialogTitle>
                                        <DialogDescription>
                                            AI가 분석한 양식의 최종 "엑셀 뷰" 미리보기입니다.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="max-h-[70vh] overflow-y-auto p-4">
                                        <TemplateExcelView initialItems={items} />
                                    </div>
                                </DialogContent>
                            </Dialog>

                            {/* 기존 수정하기 버튼 (TemplateEditor가 처리) */}
                        </div>
                    </div>

                    {/* 6. (수정) TemplateEditor를 CardContent 바로 아래로 이동 */}
                    <TemplateEditor initialItems={items} templateId={template.id} />
                </CardContent>
            </Card>
        </div>
    );
}