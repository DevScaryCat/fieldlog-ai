// /app/(dashboard)/companies/[id]/layout.tsx

'use client';

import { createClient } from '@/utils/supabase/client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
// 1. react에서 'use' 훅을 임포트합니다.
import { useEffect, useState, use } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

type Company = { name: string };

export default function CompanyDetailLayout({
    children,
    params, // params는 이제 Promise<{ id: string }> 입니다.
}: {
    children: React.ReactNode;
    params: { id: string }; // 타입은 동일하게 유지
}) {
    // 2. React.use()를 사용하여 Promise인 params를 풀어줍니다.
    const { id: companyId } = use(params);

    const supabase = createClient();
    const pathname = usePathname();
    const router = useRouter();

    const [company, setCompany] = useState<Company | null>(null);
    const [loading, setLoading] = useState(true);

    // 4. 클라이언트 컴포넌트에서 데이터를 fetch
    useEffect(() => {
        // companyId가 정상적으로(undefined가 아님) 넘어올 때만 fetch 실행
        if (companyId) {
            const fetchCompany = async () => {
                const { data, error } = await supabase
                    .from('companies')
                    .select('name')
                    .eq('id', companyId)
                    .single();

                if (error || !data) {
                    console.error('Error fetching company:', error);
                    router.push('/companies'); // 에러 시 목록으로
                } else {
                    setCompany(data);
                }
                setLoading(false);
            };
            fetchCompany();
        }
    }, [companyId, supabase, router]);

    // 5. 현재 경로를 기반으로 활성 탭 값을 결정
    const getCurrentTab = () => {
        // 3. 경로 비교를 더 안전하게 수정
        if (pathname === `/companies/${companyId}/assessments`) return 'assessments';
        if (pathname === `/companies/${companyId}/settings`) return 'settings';
        return 'templates'; // 기본값
    };
    const currentTab = getCurrentTab();

    return (
        <div className="w-full">
            <div className="mb-4 flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/companies">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                {loading ? (
                    <Skeleton className="h-9 w-48" />
                ) : (
                    <h1 className="text-3xl font-bold tracking-tight">{company?.name}</h1>
                )}
            </div>

            {/* 6. Tabs 컴포넌트가 Link와 연동되도록 수정 */}
            <Tabs value={currentTab} className="w-full">
                <TabsList className="mb-6 grid w-full grid-cols-3 md:w-[400px]">
                    <TabsTrigger value="assessments" asChild>
                        <Link href={`/companies/${companyId}/assessments`}>평가 이력</Link>
                    </TabsTrigger>
                    <TabsTrigger value="templates" asChild>
                        <Link href={`/companies/${companyId}`}>평가 양식</Link>
                    </TabsTrigger>
                    <TabsTrigger value="settings" asChild>
                        <Link href={`/companies/${companyId}/settings`}>사업장 설정</Link>
                    </TabsTrigger>
                </TabsList>

                {children}
            </Tabs>
        </div>
    );
}