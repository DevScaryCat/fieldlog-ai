// /app/(auth)/login/page.tsx

'use client';

import { useState } from 'react';
// 1. Import 경로를 새로운 유틸리티 함수로 변경합니다.
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSignUp, setIsSignUp] = useState(false);
    const router = useRouter();

    // 2. 클라이언트 생성 함수를 호출합니다.
    const supabase = createClient();

    const handleAuth = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            if (isSignUp) {
                // 회원가입 로직
                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: { emailRedirectTo: `${location.origin}/auth/callback` },
                });
                if (signUpError) throw signUpError;
                alert('회원가입 성공! 이메일을 확인하여 인증을 완료해주세요.');
                setIsSignUp(false);
            } else {
                // 로그인 로직
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (signInError) throw signInError;
                router.push('/');
                router.refresh();
            }
        } catch (err: any) {
            console.error('Authentication error:', err);
            setError(err.error_description || err.message || '오류가 발생했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center px-4">
            <Card className="w-full max-w-sm">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl font-bold">
                        {isSignUp ? '회원가입' : '로그인'}
                    </CardTitle>
                    <CardDescription>
                        {isSignUp ? '이메일과 비밀번호로 계정을 생성하세요.' : '이메일과 비밀번호를 입력하세요.'}
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleAuth}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">이메일</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="m@example.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isSubmitting}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">비밀번호</Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isSubmitting}
                                minLength={6}
                            />
                        </div>
                        {error && <p className="text-sm text-destructive">{error}</p>}
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? '처리 중...' : (isSignUp ? '가입하기' : '로그인하기')}
                        </Button>
                        <Button
                            type="button"
                            variant="link"
                            className="text-sm text-muted-foreground"
                            onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                            disabled={isSubmitting}
                        >
                            {isSignUp ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}