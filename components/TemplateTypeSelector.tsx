// /components/TemplateTypeSelector.tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';
import { Badge } from "@/components/ui/badge";
import { FileText, ShieldAlert, CheckSquare } from 'lucide-react';

interface TemplateTypeSelectorProps {
    templateId: string;
    initialType: string;
}

export function TemplateTypeSelector({ templateId, initialType }: TemplateTypeSelectorProps) {
    const [currentType, setCurrentType] = useState(initialType);
    const [loading, setLoading] = useState(false);
    const supabase = createClient();

    const handleTypeChange = async (newType: string) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('assessment_templates')
                .update({ ai_type: newType })
                .eq('id', templateId);

            if (error) throw error;

            setCurrentType(newType);
            toast.success("분석 모드가 변경되었습니다.");
        } catch (error) {
            toast.error("변경 실패");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        // [수정] bg-white 제거 -> 투명하게 두고 부모 컨테이너 색상 따라감
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">🤖 AI 분석 모드 설정</Label>
                <Badge variant="outline" className={
                    currentType === 'safety' ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800' :
                        currentType === 'meeting' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' :
                            'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800'
                }>
                    {currentType === 'safety' && '안전 전문가'}
                    {currentType === 'meeting' && '회의록 서기'}
                    {currentType === 'inspection' && '품질 검사관'}
                </Badge>
            </div>

            {/* [수정] text-slate-500 -> text-muted-foreground (다크모드 자동 대응) */}
            <p className="text-sm text-muted-foreground">
                이 양식을 사용할 때, AI가 어떤 관점에서 분석할지 결정합니다.
            </p>

            <Select onValueChange={handleTypeChange} value={currentType} disabled={loading}>
                <SelectTrigger className="w-full bg-background border-input">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="safety">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-orange-500" />
                            <span>🚧 안전 보건 컨설팅 (법령/위험성/대책)</span>
                        </div>
                    </SelectItem>
                    <SelectItem value="meeting">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-500" />
                            <span>📝 회의/면담 (요약/결정사항/할일)</span>
                        </div>
                    </SelectItem>
                    <SelectItem value="inspection">
                        <div className="flex items-center gap-2">
                            <CheckSquare className="h-4 w-4 text-green-500" />
                            <span>✅ 시설/품질 점검 (상태/원인/보수)</span>
                        </div>
                    </SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}