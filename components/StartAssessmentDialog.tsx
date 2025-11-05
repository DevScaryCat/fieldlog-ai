"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
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
import { PlusCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Template = {
  id: string;
  template_name: string;
};

export function StartAssessmentDialog({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (open) {
      const fetchTemplates = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
          .from("assessment_templates")
          .select("id, template_name")
          .eq("company_id", companyId)
          .eq("status", "completed");

        if (error) {
          toast.error("양식 목록을 불러오는데 실패했습니다.");
        } else {
          setTemplates(data || []);
        }
        setIsLoading(false);
      };
      fetchTemplates();
      setSelectedTemplateId(null);
    }
  }, [open, companyId, supabase]);

  const handleStart = async () => {
    if (!selectedTemplateId) {
      toast.warning("평가를 시작할 양식을 선택해주세요.");
      return;
    }
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다.");

      const { data: newAssessment, error } = await supabase
        .from("assessments")
        .insert({
          company_id: companyId,
          consultant_id: user.id,
          template_id: selectedTemplateId,
          status: "in_progress",
        })
        .select("id")
        .single();

      if (error) throw error;

      toast.success("새로운 평가를 시작합니다!");
      setOpen(false);
      router.push(`/record/${newAssessment.id}`);
    } catch (error: any) {
      console.error("Error starting assessment:", error);
      toast.error("평가 시작 실패", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />새 평가 시작
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>새 평가 시작</DialogTitle>
          <DialogDescription>이번 평가에 사용할 양식을 선택하세요.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isLoading && templates.length === 0 ? (
            <div className="text-center">
              <Loader2 className="mr-2 h-4 w-4 animate-spin inline-block" />
              양식 목록을 불러오는 중...
            </div>
          ) : null}
          {!isLoading && templates.length === 0 ? (
            <div className="text-center text-muted-foreground">이 사업장에 등록된 (분석 완료된) 양식이 없습니다.</div>
          ) : null}
          <RadioGroup
            onValueChange={setSelectedTemplateId}
            value={selectedTemplateId || undefined}
            className="space-y-2 max-h-[300px] overflow-y-auto"
          >
            {templates.map((template) => (
              <Label
                htmlFor={template.id}
                key={template.id}
                className="flex items-center space-x-3 rounded-md border p-4 hover:bg-accent has-[button:disabled]:opacity-50 has-[button:disabled]:hover:bg-transparent cursor-pointer"
              >
                <RadioGroupItem value={template.id} id={template.id} />
                <span className="flex-1">{template.template_name}</span>
              </Label>
            ))}
          </RadioGroup>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">취소</Button>
          </DialogClose>
          <Button onClick={handleStart} disabled={isLoading || !selectedTemplateId}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            평가 시작
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
