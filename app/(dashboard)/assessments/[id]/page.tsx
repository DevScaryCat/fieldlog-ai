// /app/(dashboard)/assessments/[id]/page.tsx

'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useParams } from 'next/navigation';
import { Camera, StopCircle, Upload } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// uuid 라이브러리 설치가 필요합니다. 터미널에서 npm install uuid
// 타입 정의도 설치합니다: npm install @types/uuid

export default function AssessmentPage() {
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const router = useRouter();
    const params = useParams();
    const assessmentId = params.id as string;

    // 1. 페이지 로드 시 즉시 마이크 권한 요청 및 녹음 시작
    useEffect(() => {
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

                mediaRecorder.ondataavailable = (event) => {
                    audioChunksRef.current.push(event.data);
                };

                mediaRecorder.start();
                console.log('녹음 시작됨');
            } catch (err) {
                console.error('마이크 권한 오류:', err);
                alert('마이크 권한이 필요합니다.');
                router.back();
            }
        }
        startRecording();

        // 2. 페이지 이탈 시 녹음 중지
        return () => {
            mediaRecorderRef.current?.stop();
        };
    }, [router]);

    // 3. '평가 종료' 버튼 클릭 시
    const handleStopAssessment = async () => {
        if (!mediaRecorderRef.current || !assessmentId) return;

        setLoading(true);

        mediaRecorderRef.current.onstop = async () => {
            // 4. 전체 오디오 파일을 Blob으로 합치기
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const audioFile = new File([audioBlob], 'full_assessment.webm', { type: 'audio/webm' });
            const audioFileName = `${assessmentId}/${uuidv4()}.webm`;

            // 5. Supabase Storage에 전체 오디오 파일 업로드
            const { error: uploadError } = await supabase.storage
                .from('findings') // 'findings' 버킷 사용
                .upload(audioFileName, audioFile);

            if (uploadError) {
                alert('오디오 파일 업로드에 실패했습니다: ' + uploadError.message);
                setLoading(false);
                return;
            }

            // 6. 'assessments' 테이블에 전체 오디오 파일 경로 업데이트
            const { error: dbError } = await supabase
                .from('assessments')
                .update({
                    status: 'completed',
                    full_audio_url: audioFileName
                })
                .eq('id', assessmentId);

            if (dbError) {
                alert('평가 완료 처리에 실패했습니다: ' + dbError.message);
            } else {
                alert('평가가 완료되었습니다.');
                router.push(`/companies`); // 사업장 목록으로 이동
                router.refresh();
            }
            setLoading(false);
        };

        mediaRecorderRef.current.stop();
        console.log('녹음 중지됨');
    };

    // 7. '위험 요인 추가 (사진)' 버튼 클릭 시
    const handlePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !assessmentId) return;

        setUploading(true);
        const photoFileName = `${assessmentId}/${uuidv4()}.${file.name.split('.').pop()}`;

        // 8. Supabase Storage에 사진 업로드
        const { error: uploadError } = await supabase.storage
            .from('findings')
            .upload(photoFileName, file);

        if (uploadError) {
            alert('사진 업로드에 실패했습니다: ' + uploadError.message);
            setUploading(false);
            return;
        }

        // 9. 'findings' 테이블에 새 레코드 생성 (핵심 로직)
        const { error: dbError } = await supabase
            .from('findings')
            .insert({
                assessment_id: assessmentId,
                photo_before_url: photoFileName,
                // TODO: 이 시점의 음성 텍스트를 나중에 여기에 추가
                raw_text_from_audio: '...사진 촬영 시점의 음성 텍스트 (임시)...'
            });

        if (dbError) {
            alert('위험 요인 생성에 실패했습니다: ' + dbError.message);
        } else {
            alert('위험 요인이 추가되었습니다.');
        }
        setUploading(false);
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">위험성 평가 진행 중...</h1>
                <div className="flex items-center gap-2 text-red-500 animate-pulse">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span>REC</span>
                </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900 shadow-xl p-8 space-y-6">
                <p className="text-slate-300">
                    평가가 진행 중이며, 음성 녹음이 시작되었습니다.
                    위험 요인을 발견하면 '위험 요인 추가' 버튼을 눌러 사진을 첨부하세요.
                </p>

                {/* 사진 첨부 버튼 */}
                <div className="relative">
                    <input
                        type="file"
                        id="picture-upload"
                        accept="image/*"
                        capture="environment" // 모바일에서 즉시 카메라 실행
                        className="absolute w-0 h-0 opacity-0"
                        onChange={handlePictureUpload}
                        disabled={uploading}
                    />
                    <label
                        htmlFor="picture-upload"
                        className={`flex items-center justify-center gap-2 w-full rounded-lg bg-indigo-600 px-4 py-3 text-base font-semibold text-white 
                       shadow-md transition-colors hover:bg-indigo-500 
                       ${uploading ? 'bg-slate-700 cursor-not-allowed' : ''}`}
                    >
                        <Camera size={20} />
                        {uploading ? '업로드 중...' : '위험 요인 추가 (사진 첨부)'}
                    </label>
                </div>

                {/* 평가 종료 버튼 */}
                <button
                    onClick={handleStopAssessment}
                    disabled={loading}
                    className="w-full flex justify-center items-center gap-2 rounded-lg bg-red-700 px-4 py-3 text-base font-semibold text-white shadow-md 
                     transition-colors hover:bg-red-600 
                     disabled:bg-slate-700 disabled:cursor-not-allowed"
                >
                    <StopCircle size={20} />
                    {loading ? '저장 중...' : '평가 종료 및 저장'}
                </button>
            </div>

            {/* TODO: 여기에 실시간으로 추가된 'findings' 목록을 보여줄 수 있습니다. */}
        </div>
    );
}