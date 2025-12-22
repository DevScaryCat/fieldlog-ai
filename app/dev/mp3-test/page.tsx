// /app/dev/mp3-test/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlayCircle, Loader2, Info, Briefcase, FileText, ListChecks, MessageCircle } from "lucide-react";
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { cn } from "@/lib/utils";

type Company = { id: string; name: string; };
type Template = { id: string; template_name: string; ai_type: string; };

// [추가] 답변 스타일 옵션 (StartAssessmentDialog와 동일)
const RESPONSE_STYLES = [
    { id: 'expert', icon: Briefcase, title: '전문가형', desc: '번호 매김, 논리적, 전문용어' },
    { id: 'general', icon: FileText, title: '일반형', desc: '표준적인 줄글과 요약 병행' },
    { id: 'summary', icon: ListChecks, title: '요약형', desc: '핵심 키워드, 불릿 포인트' },
];

export default function Mp3TestPage() {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState('');
    const [companies, setCompanies] = useState<Company[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [selectedStyle, setSelectedStyle] = useState<string>('expert'); // [추가] 스타일 상태
    const [audioFile, setAudioFile] = useState<File | null>(null);

    const router = useRouter();
    const supabase = createClient();

    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

    useEffect(() => {
        const fetchCompanies = async () => {
            const { data } = await supabase.from('companies').select('id, name');
            if (data && data.length > 0) {
                setCompanies(data);
                setSelectedCompanyId(data[0].id);
            }
        };
        fetchCompanies();
    }, [supabase]);

    useEffect(() => {
        if (!selectedCompanyId) {
            setTemplates([]);
            return;
        }
        const fetchTemplates = async () => {
            const { data } = await supabase
                .from('assessment_templates')
                .select('id, template_name, ai_type')
                .eq('company_id', selectedCompanyId)
                .eq('status', 'completed');

            setTemplates(data || []);
            if (data && data.length > 0) setSelectedTemplateId(data[0].id);
            else setSelectedTemplateId('');
        };
        fetchTemplates();
    }, [selectedCompanyId, supabase]);

    const handleStartAnalysis = async () => {
        if (!selectedCompanyId || !selectedTemplateId || !audioFile) {
            toast.error('모든 항목을 선택해주세요.');
            return;
        }
        setLoading(true);
        setProgress('파일 업로드 중...');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('로그인 필요');

            // 1. 평가 생성 (스타일 저장)
            const { data: assessmentData, error: assessmentError } = await supabase
                .from('assessments')
                .insert({
                    company_id: selectedCompanyId,
                    consultant_id: user.id,
                    template_id: selectedTemplateId,
                    status: 'in_progress',
                    title: `[임시] ${audioFile.name}`,
                    response_style: selectedStyle, // [핵심] 스타일 저장
                })
                .select().single();

            if (assessmentError) throw assessmentError;
            const assessmentId = assessmentData.id;

            // 2. 파일 업로드
            const fileExt = audioFile.name.split('.').pop();
            const fileName = `temp_uploads/${assessmentId}_${uuidv4()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('findings').upload(fileName, audioFile);
            if (uploadError) throw new Error(`업로드 실패: ${uploadError.message}`);

            const { data: { publicUrl } } = supabase.storage.from('findings').getPublicUrl(fileName);

            // 3. API 호출
            setProgress('AI 분석 중 (최대 1분 소요)...');
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audioUrl: publicUrl,
                    assessmentId: assessmentId
                }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "분석 실패");
            }

            toast.success('분석 완료!');
            router.push(`/assessments/${assessmentId}/report`);

        } catch (error: any) {
            console.error(error);
            toast.error(error.message);
        } finally {
            setLoading(false);
            setProgress('');
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto p-8">
            <Card>
                <CardHeader>
                    <CardTitle className="text-3xl font-bold">AI 파이프라인 테스트</CardTitle>
                    <CardDescription>양식(Template) 및 답변 스타일을 설정하여 분석합니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>1. 사업장</Label>
                            <Select onValueChange={setSelectedCompanyId} value={selectedCompanyId}>
                                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                                <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>2. 양식</Label>
                            <Select onValueChange={setSelectedTemplateId} value={selectedTemplateId}>
                                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                                <SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.template_name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* AI 타입 안내 */}
                    {selectedTemplate && (
                        <div className="bg-slate-100 p-4 rounded-md flex items-start gap-3 text-sm text-slate-700">
                            <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                            <div>
                                <span className="font-bold block mb-1">
                                    감지된 AI 모드: {selectedTemplate.ai_type === 'meeting' ? '📝 회의록 전문가' : '🚧 안전 보건 컨설턴트'}
                                </span>
                                <p className="text-xs text-slate-500">
                                    {selectedTemplate.ai_type === 'meeting'
                                        ? "논의 내용 요약, 비고, 향후 계획(Action Item) 위주로 분석합니다."
                                        : "위험성 평가, 관련 법령(KOSHA), 기술적 솔루션 위주로 분석합니다."}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* [추가] 3. 답변 스타일 선택 */}
                    <div className="space-y-3">
                        <Label>3. 답변 스타일 설정</Label>
                        <div className="grid grid-cols-2 gap-3">
                            {RESPONSE_STYLES.map((style) => {
                                const Icon = style.icon;
                                const isSelected = selectedStyle === style.id;
                                return (
                                    <div
                                        key={style.id}
                                        onClick={() => setSelectedStyle(style.id)}
                                        className={cn(
                                            "relative flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm",
                                            isSelected ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "hover:bg-slate-50"
                                        )}
                                    >
                                        <div className={cn("p-2 rounded-full shrink-0", isSelected ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500")}>
                                            <Icon size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className={cn("font-semibold text-sm truncate", isSelected ? "text-blue-700" : "text-slate-900")}>
                                                {style.title}
                                            </h4>
                                            <p className="text-xs text-slate-500 truncate">
                                                {style.desc}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>4. 파일 업로드</Label>
                        <Input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
                    </div>

                    <Button onClick={handleStartAnalysis} disabled={loading || !audioFile || !selectedTemplateId} className="w-full" size="lg">
                        {loading ? <Loader2 className="mr-2 animate-spin" /> : <PlayCircle className="mr-2" />}
                        {loading ? progress : '분석 시작'}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}