// /components/ExcelDownloadButton.tsx

'use client';

import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react"; // 아이콘 변경
import * as XLSX from 'xlsx';
import { toast } from "sonner";

interface ExcelDownloadButtonProps {
    title: string;
    headers: any[];       // 템플릿의 헤더 정보 (template_items)
    results: any[];       // 분석 결과 데이터 (assessment_results)
    className?: string;
}

export function ExcelDownloadButton({ title, headers, results, className }: ExcelDownloadButtonProps) {

    const handleDownload = () => {
        try {
            if (!headers || headers.length === 0) {
                toast.error("내보낼 양식 헤더가 없습니다.");
                return;
            }

            // 1. 동적 헤더 생성 (템플릿의 헤더 순서대로)
            // 예: ["공정명", "작업내용", "위험요인", "관련법령", "개선대책"]
            const sortedHeaders = [...headers].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            const excelHeaderRow = ["No", ...sortedHeaders.map(h => h.header_name)];

            // 2. 데이터 그룹화 (피벗팅 로직)
            // DB에는 데이터가 일렬로(Flat) 저장되어 있으므로, 이를 '행(Row)' 단위로 묶어야 합니다.
            // 묶는 기준: 각 헤더별로 데이터가 몇 개씩 있는지 확인하여 최대 행 개수 파악

            // (1) 아이템 ID별로 결과값들을 모읍니다.
            const dataMap: Record<string, any[]> = {};
            results.forEach((res) => {
                if (!dataMap[res.template_item_id]) {
                    dataMap[res.template_item_id] = [];
                }
                dataMap[res.template_item_id].push(res);
            });

            // (2) 생성될 엑셀의 총 행(Row) 개수를 계산합니다.
            // (예: '공정명' 데이터가 5개면, 엑셀도 5줄이 나와야 함)
            let maxRows = 0;
            Object.values(dataMap).forEach(arr => {
                if (arr.length > maxRows) maxRows = arr.length;
            });

            // 3. 엑셀 행 데이터 생성
            const excelRows = [];
            for (let i = 0; i < maxRows; i++) {
                const rowData = [i + 1]; // No 컬럼

                // 각 헤더(컬럼)에 해당하는 i번째 데이터를 찾아 넣음
                sortedHeaders.forEach(header => {
                    const cellData = dataMap[header.id] ? dataMap[header.id][i] : null;

                    // [중요] 셀 내용 조합
                    // AI가 result_value 외에도 legal_basis, solution을 별도로 줬을 경우 한 셀에 합쳐서 보여줌
                    let cellText = cellData?.result_value || '';

                    // 만약 법적근거/솔루션이 별도 컬럼이 아니라 속성으로 붙어있다면 괄호로 병기
                    // (템플릿에 '법적근거' 컬럼이 따로 있다면 그 컬럼에 텍스트가 들어갈 테니 중복 방지 필요)
                    // 여기서는 깔끔하게 텍스트가 있으면 줄바꿈으로 추가해줍니다.
                    if (cellData?.legal_basis && cellData.legal_basis !== '-' && cellData.legal_basis !== 'null') {
                        cellText += `\n[법적근거] ${cellData.legal_basis}`;
                    }
                    if (cellData?.solution && cellData.solution !== '-' && cellData.solution !== 'null') {
                        cellText += `\n[대책] ${cellData.solution}`;
                    }

                    rowData.push(cellText);
                });

                excelRows.push(rowData);
            }

            // 4. 워크시트 생성
            const ws = XLSX.utils.aoa_to_sheet([excelHeaderRow, ...excelRows]);

            // (옵션) 스타일: 컬럼 너비 자동 조정 (대략적으로)
            const wscols = [{ wch: 5 }]; // No 컬럼 너비
            sortedHeaders.forEach(() => wscols.push({ wch: 30 })); // 나머지 컬럼 기본 30
            ws['!cols'] = wscols;

            // 5. 파일 내보내기
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "평가결과");

            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `${title}_${dateStr}.xlsx`;

            XLSX.writeFile(wb, fileName);
            toast.success("엑셀 다운로드가 완료되었습니다.");

        } catch (error) {
            console.error(error);
            toast.error("엑셀 생성 중 오류가 발생했습니다.");
        }
    };

    return (
        <Button onClick={handleDownload} variant="outline" className={className}>
            <FileDown className="mr-2 h-4 w-4" />
            엑셀로 내보내기
        </Button>
    );
}