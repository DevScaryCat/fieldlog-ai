// /app/(dashboard)/companies/[id]/edit/page.tsx

'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { createClient } from '@/utils/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

// '신규 등록'과 동일한 스키마 사용
const formSchema = z.object({
    name: z.string().min(2, {
        message: "사업장 이름은 2글자 이상이어야 합니다.",
    }),
    address: z.string().optional(),
});

// Supabase 'companies' 테이블의 타입을 정의 (간단하게)
type Company = {
    id: string;
    name: string;
    address: string | null;
};

export default function EditCompanyPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string; // URL에서 ID 가져오기
    const supabase = createClient();
    const [isLoading, setIsLoading] = useState(true);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            address: "",
        },
    });

    // 1. 페이지 로드 시 기존 데이터 불러오기
    useEffect(() => {
        const fetchCompany = async () => {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('companies')
                .select('*')
                .eq('id', id)
                .single(); // 단일 항목만 가져오기

            if (error || !data) {
                toast.error("사업장 정보를 불러오는데 실패했습니다.");
                console.error(error);
                router.push('/companies');
            } else {
                // 폼의 기본값을 불러온 데이터로 설정
                form.reset({
                    name: data.name,
                    address: data.address || '',
                });
            }
            setIsLoading(false);
        };

        if (id) {
            fetchCompany();
        }
    }, [id, supabase, router, form]);

    // 2. 폼 제출 핸들러 (Update)
    async function onSubmit(values: z.infer<typeof formSchema>) {
        const { error } = await supabase
            .from('companies')
            .update({ name: values.name, address: values.address || null })
            .eq('id', id); // ID가 일치하는 항목을 업데이트

        if (error) {
            toast.error("사업장 수정 실패", { description: error.message });
        } else {
            toast.success("사업장 정보가 성공적으로 수정되었습니다.");
            router.push('/companies');
            router.refresh(); // 목록 페이지 새로고침
        }
    }

    // 3. 삭제 핸들러 (Delete)
    async function onDelete() {
        if (!confirm("정말로 이 사업장을 삭제하시겠습니까?\n관련된 모든 평가 데이터가 함께 삭제될 수 있습니다.")) {
            return;
        }

        const { error } = await supabase
            .from('companies')
            .delete()
            .eq('id', id); // ID가 일치하는 항목을 삭제

        if (error) {
            toast.error("사업장 삭제 실패", { description: error.message });
        } else {
            toast.success("사업장이 삭제되었습니다.");
            router.push('/companies');
            router.refresh();
        }
    }

    if (isLoading) {
        return <div className="text-center p-10">데이터를 불러오는 중...</div>;
    }

    return (
        <div className="w-full max-w-2xl mx-auto">
            <Button variant="outline" size="sm" className="mb-4" asChild>
                <Link href="/companies">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    목록으로 돌아가기
                </Link>
            </Button>
            <Card>
                <CardHeader>
                    <CardTitle>사업장 정보 수정</CardTitle>
                </CardHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <CardContent className="space-y-6">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>사업장 이름 (필수)</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="address"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>주소 (선택)</FormLabel>
                                        <FormControl>
                                            <Input {...field} value={field.value ?? ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                        <CardFooter className="flex justify-between">
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? '수정 중...' : '수정하기'}
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={onDelete}
                                disabled={form.formState.isSubmitting}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                삭제하기
                            </Button>
                        </CardFooter>
                    </form>
                </Form>
            </Card>
        </div>
    );
}