// /components/Sidebar.tsx

'use client';

import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// 1. FileText, FileScan 아이콘 제거, LayoutDashboard -> Home으로 변경
import { Home, Building, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
// import { usePathname } from 'next/navigation';

export function Sidebar() {
    const router = useRouter();
    // const pathname = usePathname();
    const supabase = createClient();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    // 2. 메뉴 아이템 수정 (대시보드와 사업장 관리만 남김)
    const menuItems = [
        { href: '/', label: '대시보드', icon: Home },
        { href: '/companies', label: '사업장 관리', icon: Building },
    ];

    return (
        <aside className="sticky top-0 h-screen w-64 flex-col border-r bg-background p-4 flex">
            <div className="mb-8 flex items-center gap-3 p-2">
                <div className="rounded-lg bg-primary p-2">
                    {/* 3. 로고 아이콘 Home으로 변경 */}
                    <Home className="text-primary-foreground" />
                </div>
                <span className="text-xl font-semibold">FieldLog AI</span>
            </div>

            <nav className="flex-1">
                <ul className="space-y-1">
                    {menuItems.map((item) => (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground'
                                    // pathname === item.href ? 'bg-accent text-accent-foreground' : ''
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                <span>{item.label}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>

            <div className="mt-auto">
                <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={handleLogout}
                >
                    <LogOut className="h-4 w-4" />
                    <span>로그아웃</span>
                </Button>
            </div>
        </aside>
    );
}