// /app/(dashboard)/assessments/[id]/page.tsx

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Camera, StopCircle, Loader2, Mic, ArrowLeft, RefreshCw, Lock, Smartphone, Unlock } from "lucide-react";
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

export default function RecordPage() {
    const [assessment, setAssessment] = useState<any>(null);
    const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isEmptyTranscript, setIsEmptyTranscript] = useState(false);

    // Wake Lock 상태 (화면 꺼짐 방지)
    const [wakeLockActive, setWakeLockActive] = useState(false);
    // Touch Lock 상태 (오터치 방지)
    const [isTouchLocked, setIsTouchLocked] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const photoInputRef = useRef<HTMLInputElement | null>(null);
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);

    const params = useParams();
    const assessmentId = params.id as string;
    const router = useRouter();
    const supabase = createClient();

    // --- [수정됨] 화면 꺼짐 방지 (Wake Lock) 로직 ---
    const requestWakeLock = useCallback(async () => {
        // 이미 활성화되어 있다면 무시
        if (wakeLockRef.current) return;

        if ('wakeLock' in navigator) {
            try {
                const wakeLock = await navigator.wakeLock.request('screen');
                wakeLockRef.current = wakeLock;
                setWakeLockActive(true);
                console.log('✅ Screen Wake Lock activated (화면 꺼짐 방지 켜짐)');

                wakeLock.addEventListener('release', () => {
                    console.log('🛑 Screen Wake Lock released');
                    setWakeLockActive(false);
                    wakeLockRef.current = null;
                });
            } catch (err: any) {
                console.error(`❌ Wake Lock request failed: ${err.name}, ${err.message}`);

                // [핵심 수정] 권한 거부(NotAllowedError) 시, 사용자의 다음 터치를 기다렸다가 재시도
                if (err.name === 'NotAllowedError') {
                    console.log('👆 Waiting for user interaction to retry Wake Lock...');
                    const retryOnInteraction = () => {
                        requestWakeLock(); // 재귀 호출 (다시 시도)
                    };
                    // 클릭이나 터치 이벤트가 발생하면 딱 한 번만 실행하고 리스너 제거
                    document.addEventListener('click', retryOnInteraction, { once: true });
                    document.addEventListener('touchstart', retryOnInteraction, { once: true });
                }
            }
        }
    }, []);

    const releaseWakeLock = useCallback(async () => {
        if (wakeLockRef.current) {
            try {
                await wakeLockRef.current.release();
            } catch (err) {
                console.log('Wake Lock release error (already released?)', err);
            }
            wakeLockRef.current = null;
            setWakeLockActive(false);
        }
    }, []);

    // 녹음 상태에 따라 Wake Lock 자동 제어
    useEffect(() => {
        if (isRecording) {
            requestWakeLock();
        } else {
            releaseWakeLock();
            setIsTouchLocked(false); // 녹음 끝나면 터치 잠금도 자동 해제
        }

        // 컴포넌트 언마운트 시 해제
        return () => { releaseWakeLock(); };
    }, [isRecording, requestWakeLock, releaseWakeLock]);

    // 탭 전환(백그라운드 갔다가 복귀) 시 재요청
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && isRecording) {
                requestWakeLock();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => { document.removeEventListener('visibilitychange', handleVisibilityChange); };
    }, [isRecording, requestWakeLock]);
    // -----------------------------------------------------

    // 초기 데이터 로드 및 녹음 자동 시작
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
                mediaRecorder.start();
                setIsRecording(true);
            } catch (err) {
                toast.error("마이크 권한이 필요합니다.", { description: "브라우저 설정에서 마이크 접근을 허용해주세요." });
                router.back();
            }
            setIsLoading(false);
        }
        setupAssessment();
        return () => { mediaRecorderRef.current?.stop(); };
    }, [assessmentId, router, supabase]);

    const handleTakePhotoClick = () => photoInputRef.current?.click();

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        toast.info("사진 업로드 중...");
        const timestamp = Math.floor(Date.now() / 1000);
        try {
            const photoFileName = `${assessmentId}/${uuidv4()}.${file.name.split('.').pop()}`;
            const { data: uploadData, error: uploadError } = await supabase.storage.from('findings').upload(photoFileName, file);
            if (uploadError) throw uploadError;
            const { error: dbError } = await supabase.from('findings').insert({
                assessment_id: assessmentId,
                photo_before_url: uploadData.path,
                timestamp_seconds: timestamp,
            });
            if (dbError) throw dbError;
            toast.success("사진 첨부 완료");
        } catch (error: any) {
            toast.error("업로드 실패", { description: error.message });
        } finally {
            setIsUploading(false);
            if (photoInputRef.current) photoInputRef.current.value = "";
        }
    };

    const handleStopAssessment = async () => {
        if (!mediaRecorderRef.current || isRecording === false) return;
        setIsLoading(true);
        setIsRecording(false);
        toast.info("평가 종료, 분석 시작...");

        const stopRecording = (): Promise<Blob> => {
            return new Promise((resolve, reject) => {
                if (!mediaRecorderRef.current) return reject(new Error("MediaRecorder 없음"));
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
            if (audioBlob.size < 1000) throw new Error("녹음 데이터 부족 (음성 없음).");

            const audioFile = new File([audioBlob], `${uuidv4()}.webm`, { type: 'audio/webm' });
            const formData = new FormData();
            formData.append('audioFile', audioFile);
            formData.append('assessmentId', assessmentId);

            const response = await fetch('/api/transcribe', { method: 'POST', body: formData });

            if (!response.ok) {
                const errorBody = await response.json();
                if (errorBody.message === "No speech detected") {
                    throw new Error("음성 내용 없음");
                }
                throw new Error(errorBody.error || "API 호출 실패");
            }

            const result = await response.json();
            if (result.message === "No speech detected") {
                throw new Error("음성 내용 없음");
            }

            toast.success("분석 시작됨");
            router.push(`/assessments/${assessmentId}/report`);
            router.refresh();

        } catch (error: any) {
            console.error("Evaluation failed:", error);
            if (error.message.includes("음성") || error.message.includes("speech")) {
                toast.error("음성 감지 실패");
                setIsEmptyTranscript(true);
                await supabase.from('assessments').update({ status: 'failed', error_message: '음성 내용 없음' }).eq('id', assessmentId);
            } else {
                toast.error("평가 실패", { description: error.message });
                await supabase.from('assessments').update({ status: 'failed', error_message: error.message }).eq('id', assessmentId);
            }
            setIsLoading(false);
        }
    };

    if (isLoading && !assessment) {
        return <div className="w-full flex justify-center items-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (isEmptyTranscript) {
        return (
            <div className="space-y-6 text-center">
                <Card>
                    <CardHeader><CardTitle className="text-destructive">음성 감지 실패</CardTitle></CardHeader>
                    <CardContent className="flex gap-4">
                        <Button className="w-full" onClick={() => window.location.reload()}><RefreshCw className="mr-2 h-4 w-4" />재시도</Button>
                        <Button className="w-full" variant="outline" asChild><Link href={`/companies/${assessment?.company_id}/assessments`}><ArrowLeft className="mr-2 h-4 w-4" />나가기</Link></Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20">
            {/* [Touch Lock Overlay] 터치 잠금 화면 */}
            {isTouchLocked && (
                <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center text-white touch-none">
                    <div className="animate-pulse mb-8">
                        <Mic className="h-16 w-16 text-red-500" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">녹음 중입니다...</h2>
                    <p className="text-gray-400 mb-10">화면이 잠겨 있습니다.</p>

                    <Button
                        variant="outline"
                        className="h-20 w-20 rounded-full border-2 border-white bg-transparent text-white hover:bg-white/20 hover:text-white"
                        onDoubleClick={() => setIsTouchLocked(false)}
                    >
                        <div className="flex flex-col items-center">
                            <Unlock className="h-6 w-6 mb-1" />
                            <span className="text-xs">두 번 탭</span>
                        </div>
                    </Button>
                </div>
            )}

            {/* 상단 알림 바 (상태 표시) */}
            {isRecording && (
                <div
                    className={`p-3 text-sm text-center rounded-md flex items-center justify-center gap-2 ${wakeLockActive ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
                // 여기를 클릭해도 재시도가 트리거될 수 있도록 함
                >
                    {wakeLockActive ? (
                        <><Lock className="h-4 w-4" /><span>화면 켜짐 유지 중 (안전)</span></>
                    ) : (
                        <><Smartphone className="h-4 w-4" /><span>화면을 한 번 터치해주세요! (꺼짐 방지 활성화)</span></>
                    )}
                </div>
            )}

            <Button variant="outline" size="sm" asChild><Link href={`/companies/${assessment?.company_id}/assessments`}><ArrowLeft className="mr-2 h-4 w-4" />목록으로</Link></Button>

            <input type="file" ref={photoInputRef} accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" />

            <Card className="border-2 border-slate-200">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                        <CardTitle className="text-lg">{assessment?.assessment_templates?.template_name}</CardTitle>
                        <CardDescription>녹음 진행 중</CardDescription>
                    </div>
                    {isRecording && <div className="flex items-center gap-1 text-red-500 animate-pulse"><Mic className="h-5 w-5" /><span className="font-bold">REC</span></div>}
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <Button className="h-14 text-base" variant="secondary" onClick={handleTakePhotoClick} disabled={isUploading || isLoading}>
                            {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5 mr-2" />} 사진
                        </Button>

                        <Button className="h-14 text-base" variant="outline" onClick={() => setIsTouchLocked(true)} disabled={isLoading}>
                            <Lock className="h-5 w-5 mr-2" /> 잠금
                        </Button>
                    </div>

                    <Button className="w-full h-16 text-lg font-bold" variant="destructive" onClick={handleStopAssessment} disabled={isLoading}>
                        {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <StopCircle className="h-6 w-6 mr-2" />}
                        평가 종료 및 저장
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>체크리스트</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {templateItems.map((item) => (
                        <div key={item.id} className="flex items-center space-x-3 p-2 bg-slate-50 rounded-md">
                            <Checkbox id={`item-${item.id}`} />
                            <Label htmlFor={`item-${item.id}`} className="text-base leading-snug">{item.header_name}</Label>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}