// /components/DeleteAssessmentButton.tsx

'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';

interface DeleteAssessmentButtonProps {
    assessmentId: string;
    companyId: string;
}

export function DeleteAssessmentButton({ assessmentId, companyId }: DeleteAssessmentButtonProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            // 1. DB에서 평가 데이터 삭제 
            // (Supabase 설정에서 CASCADE가 되어 있다면 하위 결과들도 같이 삭제됨)
            const { error } = await supabase
                .from('assessments')
                .delete()
                .eq('id', assessmentId);

            if (error) throw error;

            toast.success("보고서가 삭제되었습니다.");

            // 2. 목록 페이지로 이동 및 새로고침
            router.push(`/companies/${companyId}/assessments`);
            router.refresh();

        } catch (error: any) {
            toast.error("삭제 실패", { description: error.message });
            setIsDeleting(false);
        }
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isDeleting}>
                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    삭제하기
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
                    <AlertDialogDescription>
                        이 작업은 되돌릴 수 없습니다. 관련된 모든 분석 결과와 현장 사진 데이터가 영구적으로 삭제됩니다.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                        삭제 확인
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}