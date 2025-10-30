// /app/(dashboard)/page.tsx

export default function DashboardPage() {
    // TODO: 로그인한 사용자 이름 표시 (서버 컴포넌트에서 세션 정보 가져오기)
    return (
        <div>
            <h1 className="text-3xl font-bold tracking-tight mb-4">대시보드</h1>
            <p className="text-muted-foreground">
                FieldLog AI에 오신 것을 환영합니다! 사이드바 메뉴를 통해 작업을 시작하세요.
            </p>
            {/* 여기에 나중에 차트나 요약 정보 등을 추가할 수 있습니다. */}
        </div>
    );
}