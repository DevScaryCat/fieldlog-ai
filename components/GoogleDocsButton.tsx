"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";

export function GoogleDocsButton({ assessmentId }: { assessmentId: string }) {
    const [loading, setLoading] = useState(false);

    const handleExport = async () => {
        if (!confirm("구글 드라이브에 결과 보고서를 생성하시겠습니까?")) return;

        setLoading(true);
        try {
            const res = await fetch("/api/export/google-docs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assessmentId }),
            });

            const data = await res.json();

            if (data.success) {
                // 새 창으로 생성된 구글 닥스 열기
                window.open(data.link, "_blank");
            } else {
                alert("생성 실패: " + data.error);
            }
        } catch (e) {
            alert("오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            onClick={handleExport}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
        >
            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <FileText className="h-4 w-4" />}
            구글 닥스로 내보내기
        </Button>
    );
}