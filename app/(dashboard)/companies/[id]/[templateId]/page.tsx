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
import { ArrowLeft } from 'lucide-react';
import { TemplateEditor } from '@/components/TemplateEditor';

export const dynamic = 'force-dynamic';

async function fetchTemplateData(companyId: string, templateId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('assessment_templates')
        .select(`
      *,
      companies (name),
      template_items (*)
    `)
        .eq('id', templateId)
        .eq('company_id', companyId)
        .single();

    if (error || !data) {
        console.error('Error fetching template details:', error);
        notFound();
    }
    return data;
}

export default async function TemplateDetailPage({ params }: { params: { id: string, templateId: string } }) {
    const { id: companyId, templateId } = await params;
    const template = await fetchTemplateData(companyId, templateId);

    // DB에서 가져온 평탄화된 데이터를 TemplateEditor로 전달
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
                {/* CardContent에 패딩 추가 */}
                <CardContent className="pt-6">
                    <TemplateEditor initialItems={items} templateId={template.id} />
                </CardContent>
            </Card>
        </div>
    );
}