// /app/(dashboard)/companies/new/page.tsx

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
import { createClient } from '@/utils/supabase/client'; // 클라이언트 컴포넌트용 클라이언트 사용
import { useRouter } from 'next/navigation';
import { toast } from "sonner"; // sonner 토스트 임포트
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

// 1. Zod 스키마 정의 (유효성 검사 규칙)
const formSchema = z.object({
    name: z.string().min(2, {
        message: "사업장 이름은 2글자 이상이어야 합니다.",
    }),
    address: z.string().optional(), // 주소는 선택 사항
});

export default function NewCompanyPage() {
    const router = useRouter();
    const supabase = createClient();

    // 2. react-hook-form 초기화
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            address: "",
        },
    });

    // 3. 폼 제출 핸들러
    async function onSubmit(values: z.infer<typeof formSchema>) {
        // Supabase에 데이터 삽입
        const { error } = await supabase
            .from('companies')
            .insert({ name: values.name, address: values.address || null }); // address가 비어있으면 null로 저장

        if (error) {
            console.error('Error creating company:', error);
            toast.error("사업장 생성 실패", {
                description: error.message,
            });
        } else {
            toast.success("사업장이 성공적으로 생성되었습니다.");
            // 목록 페이지로 이동하고, 서버 컴포넌트 데이터를 새로고침
            router.push('/companies');
            router.refresh();
        }
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
                    <CardTitle>신규 사업장 등록</CardTitle>
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
                                            <Input placeholder="예: (주)필드로그 본사" {...field} />
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
                                            <Input placeholder="예: 경기도 부천시 ..." {...field} value={field.value ?? ''} />
                                        </FormControl>
                                        <FormDescription>
                                            사업장의 주소를 입력하세요.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? '저장 중...' : '사업장 저장'}
                            </Button>
                        </CardFooter>
                    </form>
                </Form>
            </Card>
        </div>
    );
}