// /app/(auth)/login/page.tsx

'use client';

import { supabase } from '@/lib/supabaseClient';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation'; // 1. useRouter 임포트

export default function LoginPage() {
    const [mounted, setMounted] = useState(false);
    const router = useRouter(); // 2. router 초기화

    useEffect(() => {
        setMounted(true);

        // 3. Supabase 인증 상태 변경 감지 리스너 추가
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            // 4. 'SIGNED_IN' 이벤트(로그인 성공)가 발생하면,
            if (event === 'SIGNED_IN') {
                // 5. 메인 페이지로 즉시 이동
                router.push('/');
            }
        });

        // 6. 컴포넌트가 언마운트될 때 리스너 정리
        return () => {
            subscription.unsubscribe();
        };
    }, [router]); // 7. dependency array에 router 추가

    if (!mounted) {
        return null;
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
            <div className="w-full max-w-md rounded-lg bg-slate-900 p-8 shadow-2xl">
                <h1 className="mb-6 bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-center text-3xl font-extrabold text-transparent">
                    FieldLog AI
                </h1>
                <Auth
                    supabaseClient={supabase}
                    appearance={{
                        theme: ThemeSupa,
                        variables: {
                            default: {
                                colors: {
                                    brand: '#6366f1',
                                    brandAccent: '#818cf8',
                                    inputText: '#e2e8f0',
                                    inputBackground: '#1e293b',
                                    inputBorder: '#334155',
                                    inputPlaceholder: '#64748b',
                                },
                            },
                        },
                    }}
                    theme="dark"
                    providers={[]}
                    localization={{
                        variables: {
                            sign_in: {
                                email_label: '이메일 주소',
                                password_label: '비밀번호',
                                button_label: '로그인',
                                social_provider_text: '{{provider}}로 로그인',
                                link_text: '이미 계정이 있으신가요? 로그인',
                            },
                            sign_up: {
                                email_label: '이메일 주소',
                                password_label: '비밀번호',
                                button_label: '회원가입',
                                link_text: '계정이 없으신가요? 회원가입',
                            },
                            forgotten_password: {
                                link_text: '비밀번호를 잊으셨나요?',
                                email_label: '이메일 주소',
                                button_label: '비밀번호 재설정 링크 보내기',
                            },
                        },
                    }}
                />
            </div>
        </div>
    );
}