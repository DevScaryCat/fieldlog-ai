import { Sidebar, MobileSidebar } from '@/components/Sidebar'; // MobileSidebar 추가 임포트
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen flex-col lg:flex-row">
            {/* 1. 데스크톱 사이드바 (lg 이상일 때만 표시됨 - Sidebar 컴포넌트 내부 css로 제어) */}
            <Sidebar />

            {/* 2. 모바일 헤더 (lg 미만일 때만 표시됨) */}
            <div className="sticky top-0 z-50 flex items-center border-b bg-background p-4 lg:hidden">
                <MobileSidebar />
                <span className="ml-3 text-lg font-semibold">FieldLog AI</span>
            </div>

            {/* 3. 메인 콘텐츠 영역 */}
            <main className="flex-1 overflow-auto p-4 lg:p-8">
                <div className="mx-auto max-w-7xl">
                    {children}
                </div>
                <SonnerToaster />
            </main>
        </div>
    );
}