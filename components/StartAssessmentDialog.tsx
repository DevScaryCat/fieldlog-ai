// /components/StartAssessmentDialog.tsx

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { PlusCircle, Loader2, Briefcase, FileText, ListChecks } from "lucide-react"; // 아이콘 정리
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Template = {
  id: string;
  template_name: string;
};

// [수정] 3가지 스타일로 변경
const RESPONSE_STYLES = [
  {
    id: 'expert',
    icon: Briefcase,
    title: '전문가형 (Expert)',
    desc: '번호를 매겨 논리정연하게 정리하며 전문 용어를 적극 사용합니다.',
  },
  {
    id: 'general',
    icon: FileText,
    title: '일반형 (General)',
    desc: '가장 표준적인 스타일로, 줄글 설명과 요약을 적절히 병행합니다.',
  },
  {
    id: 'summary',
    icon: ListChecks,
    title: '요약형 (Summary)',
    desc: '군더더기 없이 핵심 키워드와 불릿 포인트(•) 위주로 간결하게 작성합니다.',
  },
];

export function StartAssessmentDialog({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>('expert');

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (open) {
      const fetchTemplates = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('assessment_templates')
          .select('id, template_name')
          .eq('company_id', companyId)
          .eq('status', 'completed');

        if (error) {
          toast.error("양식 목록을 불러오는데 실패했습니다.");
        } else {
          setTemplates(data || []);
        }
        setIsLoading(false);
      };
      fetchTemplates();
      setSelectedTemplateId(null);
      setSelectedStyle('expert');
      setStep(1);
    }
  }, [open, companyId, supabase]);

  const handleNextStep = () => {
    if (!selectedTemplateId) {
      toast.warning("양식을 먼저 선택해주세요.");
      return;
    }
    setStep(2);
  };

  const handleStart = async () => {
    if (!selectedTemplateId) return;

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다.");

      const { data: newAssessment, error } = await supabase
        .from('assessments')
        .insert({
          company_id: companyId,
          consultant_id: user.id,
          template_id: selectedTemplateId,
          status: 'in_progress',
          response_style: selectedStyle,
        })
        .select('id')
        .single();

      if (error) throw error;

      toast.success("평가를 시작합니다!");
      setOpen(false);
      router.push(`/assessments/${newAssessment.id}`);

    } catch (error: any) {
      console.error('Error starting assessment:', error);
      toast.error("평가 시작 실패", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          새 평가 시작
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] transition-all duration-300">
        <DialogHeader>
          <DialogTitle>{step === 1 ? "1단계: 양식 선택" : "2단계: AI 답변 스타일 설정"}</DialogTitle>
          <DialogDescription>
            {step === 1 ? "이번 평가에 사용할 양식을 선택하세요." : "AI가 결과를 작성할 때 어떤 말투와 형식을 사용할지 고르세요."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 min-h-[300px]">
          {/* 1단계 */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-300">
              {isLoading && templates.length === 0 && (
                <div className="text-center py-10"><Loader2 className="animate-spin inline mr-2" />로딩 중...</div>
              )}
              {!isLoading && templates.length === 0 && (
                <div className="text-center text-muted-foreground py-10">등록된 양식이 없습니다.</div>
              )}

              <RadioGroup onValueChange={setSelectedTemplateId} value={selectedTemplateId || undefined} className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {templates.map((template) => (
                  <Label
                    htmlFor={template.id}
                    key={template.id}
                    className={cn(
                      "flex items-center space-x-3 rounded-lg border p-4 hover:bg-accent cursor-pointer transition-colors",
                      selectedTemplateId === template.id ? "border-primary bg-accent/50" : "border-border"
                    )}
                  >
                    <RadioGroupItem value={template.id} id={template.id} />
                    <span className="font-medium">{template.template_name}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* 2단계: 스타일 선택 */}
          {step === 2 && (
            <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
              {RESPONSE_STYLES.map((style) => {
                const Icon = style.icon;
                const isSelected = selectedStyle === style.id;
                return (
                  <div
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={cn(
                      "relative flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all hover:shadow-sm",
                      isSelected ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 ring-1 ring-blue-500" : "hover:bg-accent"
                    )}
                  >
                    <div className={cn("mt-1 p-2 rounded-full", isSelected ? "bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-200" : "bg-muted text-muted-foreground")}>
                      <Icon size={20} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <h4 className={cn("font-semibold text-sm", isSelected ? "text-blue-700 dark:text-blue-300" : "text-foreground")}>
                        {style.title}
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {style.desc}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="absolute top-4 right-4 h-3 w-3 rounded-full bg-blue-500 shadow-sm" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          {step === 1 ? (
            <DialogClose asChild>
              <Button variant="outline" type="button">취소</Button>
            </DialogClose>
          ) : (
            <Button variant="outline" onClick={() => setStep(1)} type="button">이전</Button>
          )}

          {step === 1 ? (
            <Button onClick={handleNextStep} disabled={!selectedTemplateId}>
              다음 단계
            </Button>
          ) : (
            <Button onClick={handleStart} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              평가 시작하기
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}