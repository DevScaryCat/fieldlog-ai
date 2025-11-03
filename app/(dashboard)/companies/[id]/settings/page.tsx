// /app/(dashboard)/companies/[id]/settings/page.tsx

'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
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
import { ArrowLeft, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
// 1. 스켈레톤 컴포넌트 임포트
import { CompanySettingsSkeleton } from "@/components/skeletons/CompanySettingsSkeleton";

const formSchema = z.object({
    name: z.string().min(2, {
        message: "사업장 이름은 2글자 이상이어야 합니다.",
    }),
    address: z.string().optional(),
});

export default function CompanySettingsPage() {
    const router = useRouter();
    const params = useParams();
    const companyId = params.id as string;
    const supabase = createClient();
    const [isLoading, setIsLoading] = useState(true);

    const [companyName, setCompanyName] = useState('');
    const [confirmationText, setConfirmationText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            address: "",
        },
    });

    // 페이지 로드 시 기존 데이터 불러오기
    useEffect(() => {
        const fetchCompany = async () => {
            // setIsLoading(true); // <-- useEffect 시작 시 true로 설정 (기본값이 이미 true)
            const { data, error } = await supabase
                .from('companies')
                .select('*')
                .eq('id', companyId)
                .single();

            if (error || !data) {
                toast.error("사업장 정보를 불러오는데 실패했습니다.");
                console.error(error);
                router.push('/companies');
            } else {
                form.reset({
                    name: data.name,
                    address: data.address || '',
                });
                setCompanyName(data.name);
            }
            setIsLoading(false); // <-- 데이터 로드 완료 후 false로 변경
        };

        if (companyId) {
            fetchCompany();
        }
    }, [companyId, supabase, router, form]);

    // 폼 제출 핸들러 (Update)
    async function onSubmit(values: z.infer<typeof formSchema>) {
        const { error } = await supabase
            .from('companies')
            .update({ name: values.name, address: values.address || null })
            .eq('id', companyId);

        if (error) {
            toast.error("사업장 수정 실패", { description: error.message });
        } else {
            toast.success("사업장 정보가 성공적으로 수정되었습니다.");
            setCompanyName(values.name);
            router.push(`/companies/${companyId}/settings`);
            router.refresh();
        }
    }

    // 삭제 핸들러 (Delete)
    async function onDelete() {
        setIsDeleting(true);
        const { error } = await supabase
            .from('companies')
            .delete()
            .eq('id', companyId);

        if (error) {
            toast.error("사업장 삭제 실패", { description: error.message });
            setIsDeleting(false);
        } else {
            toast.success("사업장이 삭제되었습니다.");
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
            router.push('/companies');
            router.refresh();
        }
    }

    const requiredConfirmationText = `${companyName} 삭제를 동의합니다`;

    // 2. 로딩 중일 때, 텍스트 대신 스켈레톤 컴포넌트를 반환
    if (isLoading) {
        return <CompanySettingsSkeleton />;
    }

    // 3. 로딩 완료 후 실제 폼 렌더링
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
                        <CardFooter className="flex justify-between mt-8">
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {form.formState.isSubmitting ? '수정 중...' : '수정하기'}
                            </Button>

                            <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                                <DialogTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        disabled={form.formState.isSubmitting}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        삭제하기
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>정말로 삭제하시겠습니까?</DialogTitle>
                                        <DialogDescription>
                                            이 작업은 되돌릴 수 없습니다. 이 사업장과 연결된
                                            모든 양식 및 평가 이력이 **영구적으로 삭제됩니다.**
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="py-4 space-y-2">
                                        <Label htmlFor="delete-confirm">
                                            계속하려면 <span className="font-bold text-foreground">{requiredConfirmationText}</span> 라고 입력하세요.
                                        </Label>
                                        <Input
                                            id="delete-confirm"
                                            value={confirmationText}
                                            onChange={(e) => setConfirmationText(e.target.value)}
                                            autoComplete="off"
                                        />
                                    </div>
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button variant="outline">취소</Button>
                                        </DialogClose>
                                        <Button
                                            variant="destructive"
                                            onClick={onDelete}
                                            disabled={isDeleting || confirmationText !== requiredConfirmationText}
                                        >
                                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                            {isDeleting ? '삭제 중...' : '삭제를 확인합니다'}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </CardFooter>
                    </form>
                </Form>
            </Card>
        </div>
    );
}