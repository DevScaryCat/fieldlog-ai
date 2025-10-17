// /components/StartAssessmentButton.tsx

'use client';

import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';
import { useState } from 'react';

export function StartAssessmentButton({ companyId }: { companyId: string }) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleStart = async () => {
        setLoading(true);

        // 1. 현재 로그인한 사용자 정보 가져오기
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            alert('로그인 정보가 필요합니다.');
            setLoading(false);
            return;
        }

        // 2. DB에 'consultant_id'와 함께 레코드 생성
        const { data, error } = await supabase
            .from('assessments')
            .insert({
                company_id: companyId,
                status: 'in_progress',
                consultant_id: user.id, // <-- 이 줄이 추가되었습니다!
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating assessment:', error);
            alert('평가 시작 중 오류가 발생했습니다.');
            setLoading(false);
            return;
        }

        const assessmentId = data.id;
        router.push(`/assessments/${assessmentId}`);
    };

    return (
        <button
            onClick={handleStart}
            disabled={loading}
            className="flex items-center gap-2 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm
                 transition-colors hover:bg-green-500
                 disabled:bg-slate-700 disabled:cursor-not-allowed"
        >
            <Play size={14} />
            {loading ? '시작 중...' : '평가 시작'}
        </button>
    );
}