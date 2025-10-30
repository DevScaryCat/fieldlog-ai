// /components/Sidebar.tsx

'use client';

// 변경: 새로운 클라이언트 유틸리티 함수를 임포트합니다.
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Home, LayoutDashboard, Building, FileText, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
// import { usePathname } from 'next/navigation'; // 활성 메뉴 스타일링에 필요

export function Sidebar() {
    const router = useRouter();
    // pathname = usePathname(); // 활성 메뉴 스타일링에 필요

    // 변경: 클라이언트를 함수 호출 방식으로 생성합니다.
    const supabase = createClient();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    const menuItems = [
        { href: '/', label: '대시보드', icon: LayoutDashboard },
        { href: '/assessments', label: '평가 관리', icon: FileText },
        { href: '/companies', label: '사업장 관리', icon: Building },
    ];

    return (
        <aside className="sticky top-0 h-screen w-64 flex flex-col border-r bg-background p-4">
            <div className="mb-8 flex items-center gap-3 p-2">
                <div className="rounded-lg bg-primary p-2">
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
                                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
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