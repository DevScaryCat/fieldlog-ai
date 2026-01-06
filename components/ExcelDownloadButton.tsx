"use client";

import { Button } from "@/components/ui/button";
import { downloadPrettyExcel } from "@/utils/excelExport";
import { FileSpreadsheet } from "lucide-react";

interface Props {
    title: string;
    headers: any[];
    results: any[];
}

export function ExcelDownloadButton({ title, headers, results }: Props) {
    const handleDownload = () => {
        if (!results || results.length === 0) {
            alert("다운로드할 데이터가 없습니다.");
            return;
        }

        // 1. 엑셀 헤더 정의
        // 기본 질문 항목들 + (자동 추가) 법적근거 + 개선대책
        const excelColumns = [
            { header: "No", key: "row_no", width: 6 },
            ...headers.map((h) => ({
                header: h.header_name,
                key: h.id,
                width: h.header_name.length > 10 ? 40 : 25, // 긴 제목은 넓게
            })),
            // ★ 별도 컬럼 추가
            { header: "관련 법령 / 근거", key: "legal_basis_all", width: 50 },
            { header: "개선 대책 (솔루션)", key: "solution_all", width: 50 },
        ];

        // 2. 데이터 피벗 (행 단위 조립)
        const groupedResults: Record<string, any[]> = {};

        // 각 질문(헤더)별로 답변들을 모음
        headers.forEach(h => {
            groupedResults[h.id] = results.filter(r => r.template_item_id === h.id);
        });

        // 전체 행 개수 (가장 많은 답변을 가진 항목 기준)
        const maxRows = Math.max(...Object.values(groupedResults).map(arr => arr.length));
        const excelRows = [];

        for (let i = 0; i < maxRows; i++) {
            const rowObj: any = { row_no: i + 1 };
            let rowLegalBasis: string[] = [];
            let rowSolutions: string[] = [];

            // 각 질문에 대한 답변 채우기
            headers.forEach((h) => {
                const item = groupedResults[h.id]?.[i];
                if (item) {
                    rowObj[h.id] = item.result_value || "-";

                    // 법적 근거와 솔루션이 있으면 따로 수집 (중복 제거)
                    if (item.legal_basis && item.legal_basis.length > 2) {
                        rowLegalBasis.push(item.legal_basis);
                    }
                    if (item.solution && item.solution.length > 2) {
                        rowSolutions.push(item.solution);
                    }
                } else {
                    rowObj[h.id] = "";
                }
            });

            // 수집된 법령과 대책을 맨 뒤 컬럼에 몰아넣기 (줄바꿈으로 구분)
            // Set을 이용해 중복 문구 제거
            rowObj["legal_basis_all"] = Array.from(new Set(rowLegalBasis)).join("\n\n");
            rowObj["solution_all"] = Array.from(new Set(rowSolutions)).join("\n\n");

            excelRows.push(rowObj);
        }

        // 3. 다운로드 실행
        downloadPrettyExcel(title, excelColumns, excelRows);
    };

    return (
        <Button
            variant="outline"
            onClick={handleDownload}
            className="gap-2 border-green-600 text-green-700 hover:bg-green-50"
        >
            <FileSpreadsheet className="h-4 w-4" />
            엑셀 다운로드
        </Button>
    );
}