// /app/(dashboard)/assessments/[id]/page.tsx

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useParams } from 'next/navigation';
import { Camera, StopCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';

// Finding 데이터 타입을 정의합니다.
type Finding = {
    id: string;
    photo_before_url: string;
    raw_text_from_audio: string;
};

export default function AssessmentPage() {
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [findings, setFindings] = useState<Finding[]>([]); // 1. findings 목록 상태 추가
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const router = useRouter();
    const params = useParams();
    const assessmentId = params.id as string;

    // 2. findings 목록을 불러오는 함수
    const fetchFindings = useCallback(async () => {
        if (!assessmentId) return;
        const { data, error } = await supabase
            .from('findings')
            .select('id, photo_before_url, raw_text_from_audio')
            .eq('assessment_id', assessmentId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching findings:', error);
        } else {
            setFindings(data as Finding[]);
        }
    }, [assessmentId]);

    useEffect(() => {
        // 페이지 로드 시 마이크 권한 요청 및 녹음 시작
        async function startRecording() {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert('마이크 녹음 기능이 지원되지 않는 브라우저입니다.');
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];
                mediaRecorder.ondataavailable = (event) => audioChunksRef.current.push(event.data);
                mediaRecorder.start();
                console.log('녹음 시작됨');
            } catch (err) {
                console.error('마이크 권한 오류:', err);
                alert('마이크 권한이 필요합니다.');
                router.back();
            }
        }
        startRecording();
        fetchFindings(); // 3. 페이지 로드 시 기존 findings 불러오기

        return () => mediaRecorderRef.current?.stop();
    }, [router, fetchFindings]);

    // '평가 종료' 버튼 클릭 시 (이전과 동일)
    const handleStopAssessment = async () => {
        if (!mediaRecorderRef.current || !assessmentId) return;
        setLoading(true);
        mediaRecorderRef.current.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const audioFile = new File([audioBlob], 'full_assessment.webm', { type: 'audio/webm' });
            const audioFileName = `${assessmentId}/${uuidv4()}.webm`;
            const { error: uploadError } = await supabase.storage.from('findings').upload(audioFileName, audioFile);
            if (uploadError) {
                alert('오디오 파일 업로드 실패: ' + uploadError.message);
                setLoading(false);
                return;
            }
            const { error: dbError } = await supabase.from('assessments').update({ status: 'completed', full_audio_url: audioFileName }).eq('id', assessmentId);
            if (dbError) {
                alert('평가 완료 처리 실패: ' + dbError.message);
            } else {
                alert('평가가 완료되었습니다.');
                router.push(`/companies`);
                router.refresh();
            }
            setLoading(false);
        };
        mediaRecorderRef.current.stop();
    };

    // '위험 요인 추가 (사진)' 버튼 클릭 시
    const handlePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !assessmentId) return;
        setUploading(true);
        const photoFileName = `${assessmentId}/${uuidv4()}.${file.name.split('.').pop()}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('findings').upload(photoFileName, file);
        if (uploadError) {
            alert('사진 업로드 실패: ' + uploadError.message);
            setUploading(false);
            return;
        }
        const { error: dbError } = await supabase.from('findings').insert({
            assessment_id: assessmentId,
            photo_before_url: uploadData.path,
            raw_text_from_audio: '...사진 촬영 시점의 음성 텍스트 (임시)...',
        });
        if (dbError) {
            alert('위험 요인 생성 실패: ' + dbError.message);
        } else {
            console.log('위험 요인이 추가되었습니다.');
            fetchFindings(); // 4. finding 추가 후 목록 새로고침
        }
        setUploading(false);
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">위험성 평가 진행 중...</h1>
                <div className="flex items-center gap-2 text-red-500 animate-pulse"><div className="w-3 h-3 bg-red-500 rounded-full"></div><span>REC</span></div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 shadow-xl p-8 space-y-6">
                <p className="text-slate-300">위험 요인을 발견하면 '위험 요인 추가' 버튼을 눌러 사진을 첨부하세요.</p>
                <div className="relative">
                    <input type="file" id="picture-upload" accept="image/*" capture="environment" className="absolute w-0 h-0 opacity-0" onChange={handlePictureUpload} disabled={uploading} />
                    <label htmlFor="picture-upload" className={`flex items-center justify-center gap-2 w-full rounded-lg bg-indigo-600 px-4 py-3 text-base font-semibold text-white shadow-md transition-colors hover:bg-indigo-500 ${uploading ? 'bg-slate-700 cursor-not-allowed' : ''}`}>
                        <Camera size={20} />{uploading ? '업로드 중...' : '위험 요인 추가 (사진 첨부)'}
                    </label>
                </div>
                <button onClick={handleStopAssessment} disabled={loading} className="w-full flex justify-center items-center gap-2 rounded-lg bg-red-700 px-4 py-3 text-base font-semibold text-white shadow-md transition-colors hover:bg-red-600 disabled:bg-slate-700 disabled:cursor-not-allowed">
                    <StopCircle size={20} />{loading ? '저장 중...' : '평가 종료 및 저장'}
                </button>
            </div>

            {/* --- 5. 실시간 Finding 목록 표시 --- */}
            <div className="mt-10">
                <h2 className="text-xl font-semibold text-white mb-4">발견된 위험 요인</h2>
                {findings.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {findings.map((finding) => {
                            const { data: { publicUrl } } = supabase.storage.from('findings').getPublicUrl(finding.photo_before_url);
                            return (
                                <div key={finding.id} className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
                                    <div className="relative w-full h-48">
                                        <Image src={publicUrl} alt="위험 요인 사진" layout="fill" objectFit="cover" className="bg-slate-800" />
                                    </div>
                                    <div className="p-4">
                                        <p className="text-sm text-slate-400">{finding.raw_text_from_audio}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-10 rounded-lg bg-slate-900 border border-slate-800">
                        <p className="text-slate-400">아직 발견된 위험 요인이 없습니다.</p>
                    </div>
                )}
            </div>
            {/* ------------------------------------ */}
        </div>
    );
}