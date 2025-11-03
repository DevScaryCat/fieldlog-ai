// /components/EditTemplateDialog.tsx

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
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Edit, Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";

// id를 optional로 유지
const itemSchema = z.object({
    id: z.string().uuid().optional(),
    header_name: z.string().min(1, "헤더 이름은 필수입니다."),
    default_value: z.string().nullable(),
    sort_order: z.number(),
    template_id: z.string().uuid(),
});

const templateFormSchema = z.object({
    items: z.array(itemSchema),
});

type TemplateItem = {
    id: string;
    header_name: string | null;
    default_value: string | null;
    sort_order: number | null;
    template_id: string;
};

type EditTemplateDialogProps = {
    templateId: string;
    items: TemplateItem[];
};

export function EditTemplateDialog({ templateId, items }: EditTemplateDialogProps) {
    const router = useRouter();
    const supabase = createClient();
    const [open, setOpen] = useState(false);
    const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]);

    const form = useForm<z.infer<typeof templateFormSchema>>({
        resolver: zodResolver(templateFormSchema),
        defaultValues: {
            items: [],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items",
        keyName: "key",
    });

    useEffect(() => {
        if (open) {
            const formattedItems = items.map(item => ({
                ...item,
                id: item.id,
                header_name: item.header_name || '',
                default_value: item.default_value || null,
                sort_order: item.sort_order || 0,
                template_id: item.template_id,
            }));
            form.reset({ items: formattedItems });
            setDeletedItemIds([]);
        }
    }, [open, items, form]);

    const handleDeleteRow = (index: number) => {
        const itemToDelete = fields[index];
        if (itemToDelete.id) {
            setDeletedItemIds((prev) => [...prev, itemToDelete.id!]);
        }
        remove(index);
    };

    const handleAddRow = () => {
        append({
            // id는 여기서 추가하지 않습니다 (undefined 상태)
            header_name: "새 컬럼",
            default_value: null,
            sort_order: fields.length,
            template_id: templateId,
        });
    };

    // --- 8. 이 부분이 핵심 수정 사항입니다 (onSubmit 함수) ---
    async function onSubmit(data: z.infer<typeof templateFormSchema>) {
        try {
            // 8a. 삭제 (기존과 동일)
            if (deletedItemIds.length > 0) {
                const { error: deleteError } = await supabase
                    .from('template_items')
                    .delete()
                    .in('id', deletedItemIds);
                if (deleteError) throw deleteError;
            }

            // 8b. 수정(UPDATE)할 항목과 추가(INSERT)할 항목을 분리
            const itemsToUpdate: any[] = [];
            const itemsToInsert: any[] = [];

            data.items.forEach((item, index) => {
                const newItem = {
                    ...item,
                    sort_order: index,
                    template_id: templateId,
                };

                // id가 있고, 유효한 UUID인 경우 -> 수정 목록
                if (item.id && z.string().uuid().safeParse(item.id).success) {
                    itemsToUpdate.push(newItem);
                } else {
                    // id가 없는 경우 -> 추가 목록
                    // (중요) id 속성 자체를 삭제합니다.
                    delete (newItem as any).id;
                    itemsToInsert.push(newItem);
                }
            });

            // 8c. 수정 작업 실행
            if (itemsToUpdate.length > 0) {
                const { error: updateError } = await supabase
                    .from('template_items')
                    .upsert(itemsToUpdate); // upsert (id가 있으므로 안전)

                if (updateError) throw updateError;
            }

            // 8d. 추가 작업 실행
            if (itemsToInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from('template_items')
                    .insert(itemsToInsert); // insert (id가 없음)

                if (insertError) throw insertError; // 여기서 났던 에러
            }

            toast.success("양식이 성공적으로 수정되었습니다.");
            setOpen(false);
            router.refresh();

        } catch (error: any) {
            console.error('Error updating template:', error);
            toast.error("수정 실패", { description: error.message });
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Edit className="mr-2 h-4 w-4" />
                    양식 수정하기
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>양식 수정하기</DialogTitle>
                    <DialogDescription>
                        AI가 분석한 양식의 컬럼을 수정, 추가, 삭제할 수 있습니다.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4">
                            {fields.map((field, index) => (
                                <div key={field.key} className="flex items-start gap-2 p-3 border rounded-md">
                                    <div className="flex-1 grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name={`items.${index}.header_name`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input placeholder="컬럼 헤더" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`items.${index}.default_value`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input placeholder="기본값 (선택)" {...field} value={field.value || ''} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:bg-destructive/10"
                                        onClick={() => handleDeleteRow(index)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={handleAddRow}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            컬럼 추가하기
                        </Button>

                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline">취소</Button>
                            </DialogClose>
                            <Button
                                type="submit"
                                disabled={form.formState.isSubmitting}
                            >
                                {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {form.formState.isSubmitting ? '저장 중...' : '변경사항 저장'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}