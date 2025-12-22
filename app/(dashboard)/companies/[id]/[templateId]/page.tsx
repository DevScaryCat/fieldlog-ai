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
} from "@/components/ui/dialog";
import { ArrowLeft, Edit, Eye } from 'lucide-react';
import { TemplateEditor } from '@/components/TemplateEditor';
import { TemplateExcelView } from '@/components/TemplateExcelView';
import { TemplateTypeSelector } from '@/components/TemplateTypeSelector';

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
    const currentAiType = template.ai_type || 'safety';

    return (
        <div className="w-full">
            <Button variant="outline" size="sm" className="mb-4" asChild>
                <Link href={`/companies/${companyId}`}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    양식 목록으로 돌아가기
                </Link>
            </Button>

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-2xl">{template.template_name}</CardTitle>
                                <CardDescription className="mt-1">
                                    연결된 사업장: {template.companies?.name || '미지정'}
                                </CardDescription>
                            </div>

                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        <Eye className="mr-2 h-4 w-4" />
                                        엑셀 뷰로 미리보기
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-4xl md:max-w-6xl">
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
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* [수정] bg-slate-50 -> bg-muted/50 (다크모드 대응) */}
                        <div className="p-4 bg-muted/50 rounded-lg border">
                            <TemplateTypeSelector
                                templateId={template.id}
                                initialType={currentAiType}
                            />
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-4">양식 구조 편집 (트리 뷰)</h3>
                            <TemplateEditor initialItems={items} templateId={template.id} />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}