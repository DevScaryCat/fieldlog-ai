'use client';

import { createClient } from '@/utils/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Building, LogOut, Menu } from 'lucide-react'; // Menu 아이콘 추가
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import {
    Sheet,
    SheetContent,
    SheetTrigger,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";

// 1. 사이드바 내부 콘텐츠 (재사용 컴포넌트)
function SidebarContent({ onClick }: { onClick?: () => void }) {
    const router = useRouter();
    const pathname = usePathname();
    const supabase = createClient();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
        if (onClick) onClick(); // 모바일에서 로그아웃 시 메뉴 닫기
    };

    const menuItems = [
        { href: '/', label: '대시보드', icon: Home },
        { href: '/companies', label: '사업장 관리', icon: Building },
    ];

    return (
        <div className="flex h-full flex-col">
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
                                onClick={onClick} // 클릭 시 실행할 함수 (모바일 닫기용)
                                className={cn(
                                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                                    pathname === item.href ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                <span>{item.label}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>

            <div className="mt-auto pt-4">
                <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={handleLogout}
                >
                    <LogOut className="h-4 w-4" />
                    <span>로그아웃</span>
                </Button>
            </div>
        </div>
    );
}

// 2. 데스크톱용 사이드바 (lg 이상에서만 보임)
export function Sidebar() {
    return (
        <aside className="hidden lg:flex h-screen w-64 flex-col border-r bg-background p-4 sticky top-0">
            <SidebarContent />
        </aside>
    );
}

// 3. 모바일용 사이드바 (lg 미만에서만 보임 - 햄버거 메뉴)
export function MobileSidebar() {
    const [open, setOpen] = useState(false);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">메뉴 열기</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-4 w-64">
                {/* 접근성 준수를 위한 타이틀 (숨김 처리 가능) */}
                <SheetHeader className="sr-only">
                    <SheetTitle>메뉴</SheetTitle>
                </SheetHeader>
                <SidebarContent onClick={() => setOpen(false)} />
            </SheetContent>
        </Sheet>
    );
}