// /components/ReportDataTable.tsx
'use client';

import React, { useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { FileText } from 'lucide-react';

// 타입 정의
type TemplateItem = {
    id: string;
    header_name: string | null;
    sort_order: number | null;
    parent_id: string | null;
};
type AssessmentResult = {
    template_item_id: string;
    result_value: string | null;
};
interface ReportDataTableProps {
    templateItems: TemplateItem[];
    results: AssessmentResult[];
}

export function ReportDataTable({ templateItems, results }: ReportDataTableProps) {

    // 1. 결과 데이터를 Map으로 정리 (Key: template_item_id, Value: 답변 배열)
    const resultsMap = useMemo(() => {
        const map = new Map<string, string[]>();
        if (results) {
            for (const result of results) {
                if (!map.has(result.template_item_id)) {
                    map.set(result.template_item_id, []);
                }
                // 값이 있으면 추가
                if (result.result_value) {
                    map.get(result.template_item_id)!.push(result.result_value);
                }
            }
        }
        return map;
    }, [results]);

    // 2. AI가 찾아낸 "답변 세트"의 최대 개수 계산 (이것이 곧 '행(Row)'의 개수가 됩니다)
    const rowCount = useMemo(() => {
        return resultsMap.size > 0
            ? Math.max(...Array.from(resultsMap.values()).map(v => v.length))
            : 0;
    }, [resultsMap]);


    // 3. (핵심 변경) '질문지(Template Items)'를 '컬럼(Column)'으로 만듭니다.
    const columns: ColumnDef<any>[] = useMemo(() => {
        // 순서대로 정렬된 템플릿 항목들을 순회하며 컬럼 정의 생성
        return templateItems.map((item) => ({
            accessorKey: item.id, // 데이터의 키는 항목의 ID
            // 헤더 이름 (계층 구조가 있다면 '상위 > 하위' 형태로 보여줄 수도 있음)
            header: item.header_name || '(이름 없음)',
            cell: (info) => (
                <div className="min-h-[20px] w-full h-full flex items-center whitespace-pre-wrap">
                    {info.getValue() as string || ""}
                </div>
            ),
            minSize: 150, // 컬럼 최소 너비
        }));
    }, [templateItems]);


    // 4. (핵심 변경) '답변 세트'를 '데이터 행(Row)'으로 만듭니다.
    const data = useMemo(() => {
        const rows = [];

        // 발견된 세트 수(행 수)만큼 반복
        for (let i = 0; i < rowCount; i++) {
            const row: Record<string, string> = {};

            // 각 질문(컬럼)에 대해 i번째 답변을 매핑
            templateItems.forEach((item) => {
                const answers = resultsMap.get(item.id) || [];
                // i번째 답변이 없으면 빈 문자열
                row[item.id] = answers[i] || "";
            });

            rows.push(row);
        }

        // 보기 좋게 빈 행 5개 추가 (엑셀 느낌)
        const emptyRow = {};
        return [...rows, ...Array(5).fill(emptyRow)];
    }, [rowCount, templateItems, resultsMap]);


    // 데이터가 아예 없을 때 UI
    if (rowCount === 0 && results.length === 0) {
        return (
            <div className="text-center py-10 rounded-lg bg-slate-950">
                <FileText size={48} className="mx-auto text-slate-600 mb-4" />
                <h3 className="text-xl font-semibold text-white">데이터 없음</h3>
                <p className="text-slate-400 mt-2">AI가 분석한 결과가 없거나, 아직 분석이 진행 중입니다.</p>
            </div>
        );
    }

    // DataTable 렌더링 (가로 스크롤 가능하도록 overflow 설정)
    return (
        <div className="border rounded-lg overflow-x-auto">
            {/* min-w-max를 주어 컬럼이 많을 때 찌그러지지 않고 스크롤되게 함 */}
            <div className="min-w-max">
                <DataTable columns={columns} data={data} />
            </div>
        </div>
    );
}