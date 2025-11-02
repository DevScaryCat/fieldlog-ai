// /components/UploadTemplateDialog.tsx

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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
import imageCompression from 'browser-image-compression'; // 1. 이미지 압축 라이브러리 임포트

type Company = {
    id: string;
    name: string;
};

// 2. Zod 스키마 수정: 파일 타입 검사를 더 관대하게 (File 객체인지 여부만 확인)
const formSchema = z.object({
    templateName: z.string().min(2, {
        message: "양식 이름은 2글자 이상이어야 합니다.",
    }),
    companyId: z.string({
        required_error: "연결할 사업장을 선택해야 합니다.",
    }),
    file: z.instanceof(File).refine(
        (file) => file.size > 0, "파일을 선택해야 합니다."
    ),
});

export default function UploadTemplateDialog() {
    const [open, setOpen] = useState(false);
    const [companies, setCompanies] = useState<Company[]>([]);
    const router = useRouter();
    const supabase = createClient();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            templateName: "",
        },
    });

    useEffect(() => {
        if (open) {
            const fetchCompanies = async () => {
                const { data, error } = await supabase.from('companies').select('id, name');
                if (error) {
                    toast.error("사업장 목록을 불러오는데 실패했습니다.");
                } else {
                    setCompanies(data);
                }
            };
            fetchCompanies();
            form.reset({ templateName: "", companyId: undefined, file: undefined });
        }
    }, [open, supabase, form]);

    // 3. 업로드 핸들러 수정
    async function onSubmit(values: z.infer<typeof formSchema>) {
        let { file, companyId, templateName } = values;

        let createdTemplateId: string | null = null;
        let createdFileUrl: string | null = null;
        form.control.register('file'); // isSubmitting을 위해 수동 등록

        try {
            // 4. 이미지 파일인 경우 압축 수행
            if (file.type.startsWith('image/')) {
                console.log(`원본 이미지 크기: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
                toast.info("이미지 압축을 시작합니다... (용량이 큰 경우 시간이 걸릴 수 있습니다)");

                const options = {
                    maxSizeMB: 4.5, // Claude 5MB 제한(Base64 오버헤드 감안)보다 작게
                    maxWidthOrHeight: 1920, // 최대 해상도 1920px
                    useWebWorker: true,
                };
                const compressedFile = await imageCompression(file, options);
                console.log(`압축된 이미지 크기: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
                file = compressedFile; // 업로드할 파일을 압축된 파일로 교체
            }

            // 5. (압축된) 파일을 Supabase Storage에 업로드
            const fileExt = file.name.split('.').pop();
            const fileName = `${companyId}/${uuidv4()}.${fileExt}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('findings')
                .upload(fileName, file);

            if (uploadError) throw uploadError;
            createdFileUrl = uploadData.path;

            // 6. DB에 템플릿 정보 저장
            const { data: templateData, error: dbError } = await supabase
                .from('assessment_templates')
                .insert({
                    company_id: companyId,
                    template_name: templateName,
                    original_file_url: createdFileUrl,
                })
                .select('id')
                .single();

            if (dbError) throw dbError;
            createdTemplateId = templateData.id;

            toast.success("양식 업로드 성공. AI 분석을 시작합니다...");

            // 7. AI 분석 API 호출
            const analyzeResponse = await fetch('/api/analyze-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateId: createdTemplateId,
                    fileUrl: createdFileUrl,
                }),
            });

            if (!analyzeResponse.ok) {
                const errorResult = await analyzeResponse.json();
                throw new Error(errorResult.error || "AI 분석 API 호출에 실패했습니다.");
            }

            const analyzeResult = await analyzeResponse.json();
            toast.success("AI 분석 완료!", {
                description: analyzeResult.message,
            });

            setOpen(false);
            router.refresh();

        } catch (error: any) {
            console.error('Template upload process error:', error);
            toast.error("작업 실패", { description: error.message });
        }
        // 'finally' 블록을 제거하여 isSubmitting이 자동으로 관리되도록 함
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
                        엑셀, PDF 또는 이미지 파일을 업로드하여 디지털 양식을 생성합니다.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="file"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>파일 선택 (엑셀, PDF, 이미지)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="file"
                                            accept=".xls,.xlsx,.pdf,.png,.jpg,.jpeg"
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
                        <FormField
                            control={form.control}
                            name="companyId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>연결할 사업장</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="사업장을 선택하세요..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {companies.map((company) => (
                                                <SelectItem key={company.id} value={company.id}>
                                                    {company.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="templateName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>양식 이름</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="파일 이름으로 자동 완성됩니다."
                                            {...field}
                                        />
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
                                {form.formState.isSubmitting ? '분석 중...' : '업로드 및 AI 분석'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}