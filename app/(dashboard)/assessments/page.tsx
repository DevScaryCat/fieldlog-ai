// /app/(dashboard)/assessments/page.tsx

import { createClient } from '@/utils/supabase/server'; // async 함수 임포트
import Link from 'next/link';
import { FileText } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AssessmentsListPage() {
    // createClient() 호출 앞에 await를 추가합니다.
    const supabase = await createClient();

    let assessments: any[] | null = [];
    let fetchError: any = null;

    try {
        const { data, error } = await supabase
            .from('assessments')
            .select(`*, companies(name)`)
            .order('created_at', { ascending: false });

        if (error) throw error;
        assessments = data;
    } catch (error) {
        fetchError = error;
        console.error('💥 Error fetching assessments:', JSON.stringify(fetchError, null, 2));
    }

    return (
        <div className="w-full">
            <header className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-white">평가 관리</h1>
            </header>

            {fetchError && (
                <div className="mb-4 rounded border border-destructive bg-destructive/10 p-4 text-destructive">
                    <p><strong>데이터 로딩 실패:</strong></p>
                    <pre className="mt-2 text-xs whitespace-pre-wrap">
                        {JSON.stringify(fetchError, null, 2)}
                    </pre>
                </div>
            )}

            <div className="rounded-lg border border-slate-800 bg-slate-900 shadow-xl">
                <ul className="divide-y divide-slate-800">
                    {assessments && assessments.length > 0 ? (
                        assessments.map((assessment) => (
                            <li
                                key={assessment.id}
                                className="flex items-center justify-between p-6 hover:bg-slate-800/50"
                            >
                                <div>
                                    <h3 className="text-lg font-semibold text-white">
                                        {assessment.companies?.name || '알 수 없는 사업장'}
                                    </h3>
                                    <p className="text-sm text-slate-400">
                                        평가일: {new Date(assessment.assessment_date).toLocaleDateString()}
                                    </p>
                                </div>
                                {assessment.status === 'completed' ? (
                                    <Link
                                        href={`/assessments/${assessment.id}/report`}
                                        className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-colors hover:bg-indigo-500"
                                    >
                                        <FileText size={16} />
                                        보고서 보기
                                    </Link>
                                ) : (
                                    <span className="text-sm font-medium text-yellow-400 px-3 py-1 rounded-full bg-yellow-900/50">
                                        {assessment.status === 'in_progress' ? '진행 중' : assessment.status}
                                    </span>
                                )}
                            </li>
                        ))
                    ) : (
                        <li className="p-6 text-center text-slate-400">
                            {fetchError ? '데이터를 불러올 수 없습니다.' : '진행된 평가가 없습니다.'}
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
}