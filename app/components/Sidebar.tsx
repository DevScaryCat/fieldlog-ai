// /components/Sidebar.tsx

'use client';

import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Home, Building, LogOut } from 'lucide-react';

export function Sidebar() {
    const router = useRouter();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    return (
        <aside className="sticky top-0 h-screen w-64 bg-slate-900 p-6 shadow-lg border-r border-slate-800 flex flex-col">
            <div className="flex items-center gap-3 mb-10">
                <div className="bg-gradient-to-r from-indigo-500 to-cyan-500 p-2 rounded-lg">
                    <Home className="text-white" />
                </div>
                <span className="text-xl font-bold text-white">FieldLog AI</span>
            </div>

            <nav className="flex-1">
                <ul className="space-y-2">
                    <li>
                        <Link
                            href="/"
                            className="flex items-center gap-3 rounded-md px-3 py-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                        >
                            <Home size={18} />
                            <span>대시보드</span>
                        </Link>
                    </li>
                    <li>
                        <Link
                            href="/companies"
                            className="flex items-center gap-3 rounded-md px-3 py-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                        >
                            <Building size={18} />
                            <span>사업장 관리</span>
                        </Link>
                    </li>
                </ul>
            </nav>

            <div>
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-slate-400 transition-colors hover:bg-red-900/50 hover:text-red-400"
                >
                    <LogOut size={18} />
                    <span>로그아웃</span>
                </button>
            </div>
        </aside>
    );
}