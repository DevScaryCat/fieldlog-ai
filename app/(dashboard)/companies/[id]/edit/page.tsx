// /app/(dashboard)/companies/[id]/edit/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Trash2 } from 'lucide-react';

export default function EditCompanyPage() {
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    useEffect(() => {
        if (id) {
            const fetchCompany = async () => {
                const { data, error } = await supabase
                    .from('companies')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) {
                    console.error('Error fetching company:', error);
                    router.push('/companies');
                } else {
                    setName(data.name);
                    setAddress(data.address || '');
                }
                setLoading(false);
            };
            fetchCompany();
        }
    }, [id, router]);

    const handleUpdateCompany = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) {
            alert('사업장 이름을 입력해 주세요.');
            return;
        }

        setLoading(true);
        const { error } = await supabase
            .from('companies')
            .update({ name, address })
            .eq('id', id);

        if (error) {
            alert('업데이트 중 오류가 발생했습니다.');
        } else {
            router.push('/companies');
            router.refresh();
        }
        setLoading(false);
    };

    const handleDeleteCompany = async () => {
        if (confirm('이 사업장을 정말 삭제하시겠습니까? 관련 데이터가 모두 삭제됩니다.')) {
            setLoading(true);
            const { error } = await supabase
                .from('companies')
                .delete()
                .eq('id', id);

            if (error) {
                alert('삭제 중 오류가 발생했습니다.');
                setLoading(false);
            } else {
                router.push('/companies');
                router.refresh();
            }
        }
    };

    if (loading && !name) {
        return <div className="text-center p-10">로딩 중...</div>
    }

    return (
        <div className="w-full max-w-2xl mx-auto">
            <Link
                href="/companies"
                className="flex items-center gap-2 mb-6 text-sm text-slate-400 hover:text-white"
            >
                <ChevronLeft size={18} />
                목록으로 돌아가기
            </Link>

            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-white">사업장 정보 수정</h1>
                <button
                    onClick={handleDeleteCompany}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-red-400 
                     transition-colors hover:bg-red-900/50
                     disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Trash2 size={16} />
                    삭제
                </button>
            </div>

            <form
                onSubmit={handleUpdateCompany}
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
                        {loading ? '수정 중...' : '수정하기'}
                    </button>
                </div>
            </form>
        </div>
    );
}