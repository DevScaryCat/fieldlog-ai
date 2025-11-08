// /app/(dashboard)/assessments/[id]/page.tsx

'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Camera, StopCircle, Loader2, Mic, ArrowLeft } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import Link from 'next/link';

type TemplateItem = {
    id: string;
    header_name: string | null;
    default_value: string | null;
    sort_order: number | null;
    template_id: string;
    parent_id: string | null;
};

// 1. (수정) getAudioDuration 헬퍼 함수 제거됨

export default function RecordPage() {
    const [assessment, setAssessment] = useState<any>(null);
    const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const photoInputRef = useRef<HTMLInputElement | null>(null);

    const params = useParams();
    const assessmentId = params.id as string;
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        async function setupAssessment() {
            if (!assessmentId) return;

            const { data, error } = await supabase
                .from('assessments')
                .select(`*, assessment_templates (*, template_items (*))`)
                .eq('id', assessmentId)
                .single();

            if (error || !data) {
                toast.error("평가 정보를 불러오지 못했습니다.");
                router.push('/companies');
                return;
            }

            setAssessment(data);
            const items = data.assessment_templates?.template_items || [];
            setTemplateItems(items.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)));

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) audioChunksRef.current.push(event.data);
                };
                mediaRecorder.start(1000);
                setIsRecording(true);
            } catch (err) {
                toast.error("마이크 권한이 필요합니다.", { description: "브라우저 설정에서 마이크 접근을 허용해주세요." });
                router.back();
            }

            setIsLoading(false);
        }
        setupAssessment();

        return () => {
            mediaRecorderRef.current?.stop();
        };
    }, [assessmentId, router, supabase]);

    const handleTakePhotoClick = () => {
        photoInputRef.current?.click();
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        toast.info("사진 업로드를 시작합니다...");
        const timestamp = Math.floor(Date.now() / 1000);

        try {
            const photoFileName = `${assessmentId}/${uuidv4()}.${file.name.split('.').pop()}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('findings')
                .upload(photoFileName, file);

            if (uploadError) throw uploadError;

            const { error: dbError } = await supabase
                .from('findings')
                .insert({
                    assessment_id: assessmentId,
                    photo_before_url: uploadData.path,
                    timestamp_seconds: timestamp,
                });

            if (dbError) throw dbError;
            toast.success("사진이 성공적으로 첨부되었습니다.");
        } catch (error: any) {
            toast.error("사진 업로드 실패", { description: error.message });
        } finally {
            setIsUploading(false);
            if (photoInputRef.current) photoInputRef.current.value = "";
        }
    };

    // 2. (수정) '평가 종료' 핸들러 (duration 제거)
    const handleStopAssessment = async () => {
        if (!mediaRecorderRef.current || isRecording === false) return;

        setIsLoading(true);
        setIsRecording(false);
        toast.info("평가를 종료하고 파일 처리를 시작합니다...");

        const stopRecording = (): Promise<Blob> => {
            return new Promise((resolve, reject) => {
                if (!mediaRecorderRef.current) return reject(new Error("MediaRecorder가 없습니다."));
                mediaRecorderRef.current.onstop = () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    audioChunksRef.current = [];
                    resolve(audioBlob);
                };
                mediaRecorderRef.current.onerror = (event: any) => reject(event.error || new Error("녹음 실패"));
                mediaRecorderRef.current.stop();
            });
        };

        try {
            const audioBlob = await stopRecording();
            if (audioBlob.size === 0) throw new Error("녹음된 데이터가 없습니다.");

            const audioFile = new File([audioBlob], `${uuidv4()}.webm`, { type: 'audio/webm' });
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
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const errorBody = await response.json();
                    throw new Error(`AI 분석 API 호출 실패: ${errorBody.error || '알 수 없는 오류'}`);
                } else {
                    throw new Error(`서버 오류: ${response.status} ${response.statusText}`);
                }
            }

            toast.success("평가 완료! AI 분석이 시작되었습니다.");
            router.push(`/assessments/${assessmentId}/report`);
            router.refresh();

        } catch (error: any) {
            toast.error("평가 종료 처리 실패", { description: error.message });
            setIsLoading(false);
        }
    };

    if (isLoading && !assessment) {
        return (
            <div className="w-full flex justify-center items-center p-10">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Button variant="outline" size="sm" className="mb-4" asChild>
                <Link href={`/companies/${assessment?.company_id}/assessments`}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    평가 이력으로 돌아가기
                </Link>
            </Button>

            <input
                type="file"
                ref={photoInputRef}
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
            />

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>{assessment?.assessment_templates?.template_name || '평가 진행 중'}</CardTitle>
                        <CardDescription>현장 평가를 기록하고 있습니다.</CardDescription>
                    </div>
                    {isRecording && (
                        <div className="flex items-center gap-2 text-red-500 animate-pulse">
                            <Mic className="h-5 w-5" />
                            <span className="font-bold">REC</span>
                        </div>
                    )}
                </CardHeader>
                <CardContent className="flex flex-col md:flex-row gap-4">
                    <Button
                        className="w-full md:w-1/2"
                        size="lg"
                        onClick={handleTakePhotoClick}
                        disabled={isUploading || isLoading}
                    >
                        {isUploading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Camera className="mr-2 h-5 w-5" />}
                        {isUploading ? '사진 첨부 중...' : '사진 촬영 / 첨부'}
                    </Button>
                    <Button
                        className="w-full md:w-1/2"
                        size="lg"
                        variant="destructive"
                        onClick={handleStopAssessment}
                        disabled={isLoading}
                    >
                        {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <StopCircle className="mr-2 h-5 w-5" />}
                        {isLoading ? '저장 중...' : '평가 종료 및 저장'}
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>평가 양식 항목</CardTitle>
                    <CardDescription>녹음 중 참고용 체크리스트입니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {templateItems.map((item) => (
                        <div key={item.id} className="flex items-center space-x-3">
                            <Checkbox id={`item-${item.id}`} />
                            <Label htmlFor={`item-${item.id}`} className="text-base">
                                {item.header_name}
                                {item.default_value && (
                                    <span className="text-muted-foreground ml-2">({item.default_value})</span>
                                )}
                            </Label>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}