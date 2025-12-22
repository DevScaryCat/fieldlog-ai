// /components/ReportDataTable.tsx
'use client';

import React, { useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { FileText } from 'lucide-react';

type TemplateItem = {
    id: string;
    header_name: string | null;
    sort_order: number | null;
    parent_id: string | null;
};

type AssessmentResult = {
    template_item_id: string;
    result_value: string | null;
    legal_basis?: string | null;
    solution?: string | null;
};

interface ReportDataTableProps {
    templateItems: TemplateItem[];
    results: AssessmentResult[];
    aiType?: string; // [추가] AI 모드 (safety | meeting)
}

export function ReportDataTable({ templateItems, results, aiType = 'safety' }: ReportDataTableProps) {

    // 1. 결과 데이터를 Map으로 정리
    const resultsMap = useMemo(() => {
        const map = new Map<string, AssessmentResult[]>();
        if (results) {
            for (const result of results) {
                if (!map.has(result.template_item_id)) {
                    map.set(result.template_item_id, []);
                }
                map.get(result.template_item_id)!.push(result);
            }
        }
        return map;
    }, [results]);

    // 2. 행(Row) 개수 계산
    const rowCount = useMemo(() => {
        return resultsMap.size > 0
            ? Math.max(...Array.from(resultsMap.values()).map(v => v.length))
            : 0;
    }, [resultsMap]);

    // 3. 컬럼 정의 (헤더 이름 동적 변경)
    const columns: ColumnDef<any>[] = useMemo(() => {
        // (1) 동적 컬럼: 템플릿의 질문들
        const dynamicColumns = templateItems.map((item) => ({
            accessorKey: item.id,
            header: item.header_name || '(이름 없음)',
            cell: (info: any) => (
                <div className="min-h-[20px] w-full h-full flex items-center whitespace-pre-wrap">
                    {info.getValue() || ""}
                </div>
            ),
            minSize: 150,
        }));

        // [핵심] 모드에 따른 헤더 이름 결정
        const isMeeting = aiType === 'meeting';

        const headerLabel1 = isMeeting ? "비고 / 특이사항" : "관련 법령 / 근거";
        const headerLabel2 = isMeeting ? "향후 계획 (Action Item)" : "개선 대책 (솔루션)";

        // (2) 고정 컬럼 1
        const extraColumn1 = {
            accessorKey: 'legal_basis',
            header: headerLabel1,
            cell: (info: any) => (
                <div className="min-h-[20px] w-full h-full flex items-center whitespace-pre-wrap text-blue-400">
                    {info.getValue() || ""}
                </div>
            ),
            minSize: 200,
        };

        // (3) 고정 컬럼 2
        const extraColumn2 = {
            accessorKey: 'solution',
            header: headerLabel2,
            cell: (info: any) => (
                <div className="min-h-[20px] w-full h-full flex items-center whitespace-pre-wrap text-green-400">
                    {info.getValue() || ""}
                </div>
            ),
            minSize: 200,
        };

        return [...dynamicColumns, extraColumn1, extraColumn2];
    }, [templateItems, aiType]); // aiType 의존성 추가

    // 4. 데이터 행 구성
    const data = useMemo(() => {
        const rows = [];
        for (let i = 0; i < rowCount; i++) {
            const row: Record<string, string> = {};
            let collectedCol1: string[] = [];
            let collectedCol2: string[] = [];

            templateItems.forEach((item) => {
                const resultsArr = resultsMap.get(item.id) || [];
                const resultObj = resultsArr[i];

                row[item.id] = resultObj?.result_value || "";

                if (resultObj?.legal_basis) collectedCol1.push(resultObj.legal_basis);
                if (resultObj?.solution) collectedCol2.push(resultObj.solution);
            });

            row['legal_basis'] = collectedCol1.join("\n");
            row['solution'] = collectedCol2.join("\n");
            rows.push(row);
        }
        const emptyRow = {};
        return [...rows, ...Array(5).fill(emptyRow)];
    }, [rowCount, templateItems, resultsMap]);

    if (rowCount === 0 && results.length === 0) {
        return (
            <div className="text-center py-10 rounded-lg bg-slate-950">
                <FileText size={48} className="mx-auto text-slate-600 mb-4" />
                <h3 className="text-xl font-semibold text-white">데이터 없음</h3>
                <p className="text-slate-400 mt-2">AI 분석 결과가 없습니다.</p>
            </div>
        );
    }

    return (
        <div className="border rounded-lg overflow-x-auto bg-slate-950 text-slate-200">
            <div className="min-w-max">
                <DataTable columns={columns} data={data} />
            </div>
        </div>
    );
}