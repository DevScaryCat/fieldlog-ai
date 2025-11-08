// /app/dev/mp3-test/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlayCircle, UploadCloud, Loader2 } from "lucide-react";
import { toast } from 'sonner';

type Company = { id: string; name: string; };
type Template = { id: string; template_name: string; };

// 1. (수정) getAudioDuration 헬퍼 함수 제거됨

export default function Mp3TestPage() {
    const [loading, setLoading] = useState(false);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        const fetchCompanies = async () => {
            const { data } = await supabase.from('companies').select('id, name');
            if (data) {
                setCompanies(data);
                if (data.length > 0) setSelectedCompanyId(data[0].id);
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
            const { data, error } = await supabase
                .from('assessment_templates')
                .select('id, template_name')
                .eq('company_id', selectedCompanyId)
                .eq('status', 'completed');

            if (error) {
                toast.error("양식 목록 로딩 실패");
            } else {
                setTemplates(data || []);
                if (data && data.length > 0) {
                    setSelectedTemplateId(data[0].id);
                } else {
                    setSelectedTemplateId('');
                }
            }
        };
        fetchTemplates();
    }, [selectedCompanyId, supabase]);

    const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setAudioFile(file);
    };

    // 2. (수정) 테스트 시작 핸들러 (duration 제거)
    const handleStartAnalysis = async () => {
        if (!selectedCompanyId || !selectedTemplateId || !audioFile) {
            toast.error('사업장, 양식, 오디오 파일을 모두 선택해야 합니다.');
            return;
        }
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('로그인이 필요합니다.');

            const { data: assessmentData, error: assessmentError } = await supabase
                .from('assessments')
                .insert({
                    company_id: selectedCompanyId,
                    consultant_id: user.id,
                    template_id: selectedTemplateId,
                    status: 'in_progress'
                })
                .select().single();
            if (assessmentError) throw new Error(`평가 생성 실패: ${assessmentError.message}`);
            const assessmentId = assessmentData.id;

            // (duration 측정 로직 제거됨)
            const formData = new FormData();
            formData.append('audioFile', audioFile);
            formData.append('assessmentId', assessmentId);
            // (duration 전송 제거됨)

            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(`백엔드 API 실패: ${errorBody.error || response.statusText}`);
            }

            toast.success('AI 분석이 완료되었습니다. 보고서 페이지로 이동합니다.');
            router.push(`/assessments/${assessmentId}/report`);

        } catch (error: any) {
            console.error('🔥🔥🔥 테스트 실패! 원인:', error);
            toast.error("오류가 발생했습니다.", { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto p-8">
            <Card>
                <CardHeader>
                    <CardTitle className="text-3xl font-bold text-white">AI 파이프라인 테스트 (Deepgram)</CardTitle>
                    <CardDescription>
                        음성 파일을 업로드하여 'Deepgram STT' 및 'AI 양식 채우기'를 테스트합니다.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="company">1. 사업장 선택</Label>
                        <Select onValueChange={setSelectedCompanyId} value={selectedCompanyId}>
                            <SelectTrigger id="company"><SelectValue placeholder="사업장을 선택하세요..." /></SelectTrigger>
                            <SelectContent>
                                {companies.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="template">2. 평가 양식 선택</Label>
                        <Select onValueChange={setSelectedTemplateId} value={selectedTemplateId} disabled={templates.length === 0}>
                            <SelectTrigger id="template"><SelectValue placeholder={templates.length === 0 ? "선택 가능한 양식 없음" : "양식을 선택하세요..."} /></SelectTrigger>
                            <SelectContent>
                                {templates.map(t => (
                                    <SelectItem key={t.id} value={t.id}>{t.template_name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="audio-upload">3. 테스트용 오디오 파일 (MP3, WebM)</Label>
                        <Input
                            type="file"
                            id="audio-upload"
                            accept="audio/*" // 모든 오디오 파일 허용
                            className="file:text-foreground"
                            onChange={handleAudioUpload}
                        />
                    </div>
                    <Button
                        onClick={handleStartAnalysis}
                        disabled={loading || !audioFile || !selectedTemplateId || templates.length === 0}
                        className="w-full"
                        size="lg"
                    >
                        <PlayCircle size={20} className="mr-2" />
                        {loading ? 'AI 분석 중...' : '오디오로 AI 분석 시작'}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}