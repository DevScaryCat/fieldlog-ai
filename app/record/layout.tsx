// /app/record/layout.tsx

// 이 레이아웃은 (dashboard) 그룹 밖에 있으므로
// 사이드바가 없는 깔끔한 전체 화면을 제공합니다.
export default function RecordLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen flex-col">
            {/* 나중에 여기에 녹음/보고서 전용 헤더를 추가할 수 있습니다. */}
            <main className="flex-1 p-6 lg:p-8">
                <div className="mx-auto max-w-5xl">
                    {children}
                </div>
            </main>
        </div>
    );
}