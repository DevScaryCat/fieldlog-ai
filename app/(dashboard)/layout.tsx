// /app/(dashboard)/layout.tsx

import { Sidebar } from '@/components/Sidebar';
import { Toaster as SonnerToaster } from "@/components/ui/sonner"; // 1. SonnerToaster 임포트

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 p-6 lg:p-8 overflow-auto">
                <div className="mx-auto max-w-7xl">
                    {children}
                </div>
                {/* 2. 기존 Toaster 대신 SonnerToaster 사용 */}
                <SonnerToaster />
            </main>
        </div>
    );
}