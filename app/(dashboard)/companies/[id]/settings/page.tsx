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
import { Trash2, Loader2 } from "lucide-react";
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
import { CompanySettingsSkeleton } from "@/components/skeletons/CompanySettingsSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

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

    useEffect(() => {
        const fetchCompany = async () => {
            setIsLoading(true);
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
            setIsLoading(false);
        };

        if (companyId) {
            fetchCompany();
        }
    }, [companyId, supabase, router, form]);

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
            router.refresh(); // 현재 페이지 데이터만 새로고침 (헤더의 이름도 바뀜)
        }
    }

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
            router.push('/companies'); // 삭제 후, 전체 사업장 목록으로 이동
            router.refresh();
        }
    }

    const requiredConfirmationText = `${companyName} 삭제를 동의합니다`;

    if (isLoading) {
        // 1. 스켈레톤도 Card만 반환하도록 수정 (뒤로가기 버튼 제거)
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-28" />
                </CardFooter>
            </Card>
        );
    }

    return (
        // 2. Card 컴포넌트가 최상위가 되도록 수정 (뒤로가기 버튼 제거)
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
    );
}