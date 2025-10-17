// /app/(dashboard)/companies/page.tsx

import { createServer } from '@/lib/supabaseServer';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0;

export default async function CompaniesPage() {
    const supabase = createServer();
    const { data: companies } = await supabase.from('companies').select('*');

    return (
        <div className="w-full">
            <header className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-white">사업장 관리</h1>
                <Link
                    href="/companies/new"
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950"
                >
                    <Plus size={16} />
                    신규 사업장 등록
                </Link>
            </header>

            <div className="rounded-lg border border-slate-800 bg-slate-900 shadow-xl">
                <ul className="divide-y divide-slate-800">
                    {companies && companies.length > 0 ? (
                        companies.map((company) => (
                            <li
                                key={company.id}
                                className="flex items-center justify-between p-6 hover:bg-slate-800/50"
                            >
                                <div>
                                    <h3 className="text-lg font-semibold text-white">
                                        {company.name}
                                    </h3>
                                    <p className="text-sm text-slate-400">
                                        {company.address || '주소 정보 없음'}
                                    </p>
                                </div>
                                <Link
                                    href={`/companies/${company.id}/edit`}
                                    className="text-sm text-indigo-400 hover:text-indigo-300"
                                >
                                    수정
                                </Link>
                            </li>
                        ))
                    ) : (
                        <li className="p-6 text-center text-slate-400">
                            등록된 사업장이 없습니다.
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
}