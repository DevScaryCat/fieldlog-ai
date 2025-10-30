// /app/(dashboard)/assessments/[id]/report/page.tsx

import { createClient } from '@/utils/supabase/server'; // async 함수 임포트
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { FileText, MapPin, AlertTriangle, Wrench } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ReportPage({ params }: { params: { id: string } }) {
    // createClient() 호출 앞에 await를 추가합니다.
    const supabase = await createClient();
    const assessmentId = params.id;

    let assessment: any = null;
    let fetchError: any = null;

    try {
        const { data, error } = await supabase
            .from('assessments')
            .select(`
        assessment_date,
        companies (name),
        findings (*)
      `)
            .eq('id', assessmentId)
            .single();

        if (error) throw error;
        assessment = data;
    } catch (error) {
        fetchError = error;
        console.error('💥 Error fetching report data:', JSON.stringify(fetchError, null, 2));
    }

    // 데이터 로딩 실패 시 notFound 대신 에러 메시지 표시 (디버깅용)
    if (fetchError || !assessment) {
        return (
            <div className="w-full max-w-5xl mx-auto p-12">
                <h1 className="text-2xl font-bold text-destructive mb-4">보고서 로딩 오류</h1>
                <p className="text-muted-foreground mb-4">데이터를 불러오는 중 문제가 발생했습니다.</p>
                {fetchError && (
                    <pre className="mt-2 text-xs whitespace-pre-wrap bg-muted p-4 rounded">
                        {JSON.stringify(fetchError, null, 2)}
                    </pre>
                )}
            </div>
        )
        // return notFound(); // 최종 배포 시에는 이 코드로 변경
    }

    const { assessment_date, findings, companies: company } = assessment;

    return (
        <div className="w-full max-w-5xl mx-auto bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl p-12">
            <header className="text-center mb-12 border-b border-slate-800 pb-8">
                <h1 className="text-4xl font-extrabold text-white mb-2">위험성 평가 보고서</h1>
                <p className="text-lg text-slate-400">{company?.name || '알 수 없는 사업장'}</p>
                <p className="text-sm text-slate-500 mt-1">평가일: {new Date(assessment_date).toLocaleDateString()}</p>
            </header>

            <div className="space-y-10">
                {findings && findings.length > 0 ? (
                    findings.map((finding: any, index: number) => {
                        // getPublicUrl은 서버 컴포넌트에서도 안전하게 사용 가능
                        const { data: { publicUrl } } = supabase.storage.from('findings').getPublicUrl(finding.photo_before_url!);
                        return (
                            <div key={finding.id} className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                <div className="flex flex-col">
                                    <h3 className="text-lg font-semibold text-indigo-400 mb-4">
                                        {index + 1}. 조치 전 현장 사진
                                    </h3>
                                    <div className="relative w-full h-80 rounded-lg overflow-hidden border-2 border-slate-700">
                                        <Image
                                            src={publicUrl}
                                            alt={`위험 요인 ${index + 1}`}
                                            fill
                                            className="object-cover bg-slate-800"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-6 pt-1">
                                    {/* ... 분석 내용 표시 부분 (이전과 동일) ... */}
                                    <div className="flex items-start gap-4">
                                        <div className="bg-slate-800 p-2 rounded-md mt-1"><MapPin className="text-slate-400" size={20} /></div>
                                        <div>
                                            <h4 className="font-semibold text-slate-300">장소 / 위치</h4>
                                            <p className="text-white">{finding.location || '분석 중...'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="bg-slate-800 p-2 rounded-md mt-1"><AlertTriangle className="text-slate-400" size={20} /></div>
                                        <div>
                                            <h4 className="font-semibold text-slate-300">부적합 사항 (위험 요인)</h4>
                                            <p className="text-white">{finding.issue_description || '분석 중...'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="bg-slate-800 p-2 rounded-md mt-1"><Wrench className="text-slate-400" size={20} /></div>
                                        <div>
                                            <h4 className="font-semibold text-slate-300">개선 조치 제안</h4>
                                            <p className="text-white">{finding.suggested_improvement || '분석 중...'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-20 rounded-lg bg-slate-950">
                        <FileText size={48} className="mx-auto text-slate-600 mb-4" />
                        <h3 className="text-xl font-semibold text-white">데이터 없음</h3>
                        <p className="text-slate-400 mt-2">이 평가에 대해 등록된 위험 요인이 없습니다.</p>
                    </div>
                )}
            </div>
        </div>
    );
}