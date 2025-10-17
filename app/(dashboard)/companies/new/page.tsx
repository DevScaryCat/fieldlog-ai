// /app/(dashboard)/companies/new/page.tsx

'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function NewCompanyPage() {
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleCreateCompany = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) {
            alert('사업장 이름을 입력해 주세요.');
            return;
        }

        setLoading(true);

        const { error } = await supabase
            .from('companies')
            .insert({ name, address });

        if (error) {
            console.error('Error creating company:', error);
            alert('사업장 생성 중 오류가 발생했습니다.');
        } else {
            // 성공 시, 사업장 목록 페이지로 이동
            router.push('/companies');
            // (중요) 서버 컴포넌트인 /companies 페이지의 데이터를 새로고침(revalidate)
            router.refresh();
        }
        setLoading(false);
    };

    return (
        <div className="w-full max-w-2xl mx-auto">
            <Link
                href="/companies"
                className="flex items-center gap-2 mb-6 text-sm text-slate-400 hover:text-white"
            >
                <ChevronLeft size={18} />
                목록으로 돌아가기
            </Link>

            <h1 className="text-3xl font-bold text-white mb-8">신규 사업장 등록</h1>

            <form
                onSubmit={handleCreateCompany}
                className="rounded-lg border border-slate-800 bg-slate-900 shadow-xl p-8 space-y-6"
            >
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
                        사업장 이름 (필수)
                    </label>
                    <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-md bg-slate-800 border-slate-700 text-white
                       focus:border-indigo-500 focus:ring-indigo-500"
                        required
                    />
                </div>

                <div>
                    <label htmlFor="address" className="block text-sm font-medium text-slate-300 mb-2">
                        주소
                    </label>
                    <input
                        id="address"
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full rounded-md bg-slate-800 border-slate-700 text-white
                       focus:border-indigo-500 focus:ring-indigo-500"
                    />
                </div>

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md 
                       transition-colors hover:bg-indigo-500 
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900
                       disabled:bg-slate-700 disabled:cursor-not-allowed"
                    >
                        {loading ? '저장 중...' : '저장하기'}
                    </button>
                </div>
            </form>
        </div>
    );
}