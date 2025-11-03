// /components/UploadTemplateDialog.tsx

'use client';

import { useState } from 'react';
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, UploadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from 'uuid';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import imageCompression from 'browser-image-compression';

// 1. companyId가 schema에서 제거됨
const formSchema = z.object({
    templateName: z.string().min(2, {
        message: "양식 이름은 2글자 이상이어야 합니다.",
    }),
    file: z.instanceof(File).refine(
        (file) => file.size > 0, "파일을 선택해야 합니다."
    ),
});

// 2. companyId를 prop으로 받음
export default function UploadTemplateDialog({ companyId }: { companyId: string }) {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            templateName: "",
        },
    });

    // 3. onSubmit 함수가 AI 분석을 호출하지 않고 즉시 종료되도록 수정
    async function onSubmit(values: z.infer<typeof formSchema>) {
        let { file, templateName } = values;
        form.control.register('file');

        try {
            if (file.type.startsWith('image/')) {
                toast.info("이미지 압축을 시작합니다...");
                const options = { maxSizeMB: 4.5, maxWidthOrHeight: 1920, useWebWorker: true };
                file = await imageCompression(file, options);
            }

            const fileExt = file.name.split('.').pop();
            const fileName = `${companyId}/${uuidv4()}.${fileExt}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('findings')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            // 4. DB에 'status: processing'으로 삽입 (AI 분석 API 호출 X)
            // Webhook이 이 INSERT 이벤트를 감지하여 백그라운드에서 AI를 실행함
            const { error: dbError } = await supabase
                .from('assessment_templates')
                .insert({
                    company_id: companyId,
                    template_name: templateName,
                    original_file_url: uploadData.path,
                    status: 'processing', // AI가 처리해야 할 작업으로 등록
                });

            if (dbError) throw dbError;

            toast.success("파일 업로드 성공!", {
                description: "백그라운드에서 AI 분석을 시작합니다.",
            });

            setOpen(false); // 5. 즉시 모달 닫기
            router.refresh(); // 목록 페이지 새로고침

        } catch (error: any) {
            console.error('Template upload error:', error);
            toast.error("업로드 실패", { description: error.message });
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    신규 양식 스캔/업로드
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>신규 양식 업로드</DialogTitle>
                    <DialogDescription>
                        종이 문서를 폰 카메라로 찍거나, PDF/엑셀 파일을 업로드하세요.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="file"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>파일 선택 (사진, PDF 등)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="file"
                                            // 6. 모바일 카메라 바로 실행
                                            capture="environment"
                                            accept="image/*,.pdf,.xls,.xlsx"
                                            className="file:text-foreground"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    field.onChange(file);
                                                    form.setValue('templateName', file.name.replace(/\.[^/.]+$/, ""), { shouldValidate: true });
                                                }
                                            }}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* 7. 사업장 선택 <Select> 컴포넌트 제거됨 */}

                        <FormField
                            control={form.control}
                            name="templateName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>양식 이름</FormLabel>
                                    <FormControl>
                                        <Input placeholder="파일 이름으로 자동 완성됩니다." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline">취소</Button>
                            </DialogClose>
                            <Button
                                type="submit"
                                disabled={form.formState.isSubmitting}
                            >
                                {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                                {form.formState.isSubmitting ? '업로드 중...' : '업로드하기'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}