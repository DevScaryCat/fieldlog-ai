// /components/ReportDataTable.tsx
'use client';

import React, { useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge'; // Badge는 클라이언트에서도 사용 가능

// 1. 서버 컴포넌트에서 넘겨받을 Props 타입 정의
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

// 2. 이 컴포넌트가 'use client'이므로, 여기서 함수를 정의하는 것은 안전합니다.
export function ReportDataTable({ templateItems, results }: ReportDataTableProps) {

    // 3. 서버 페이지에 있던 로직을 클라이언트로 이동 (useMemo 사용)
    const resultsMap = useMemo(() => {
        const map = new Map<string, string[]>();
        if (results) {
            for (const result of results) {
                if (!map.has(result.template_item_id)) {
                    map.set(result.template_item_id, []);
                }
                map.get(result.template_item_id)!.push(result.result_value || '(내용 없음)');
            }
        }
        return map;
    }, [results]);

    const resultSetCount = useMemo(() => {
        return resultsMap.size > 0 ? Math.max(...Array.from(resultsMap.values()).map(v => v.length)) : 0;
    }, [resultsMap]);

    // 4. (핵심) 'columns' 정의가 서버가 아닌 클라이언트 컴포넌트 내부에 있습니다.
    const columns: ColumnDef<any>[] = useMemo(() => {
        const cols: ColumnDef<any>[] = [
            {
                accessorKey: 'header',
                header: '평가 항목 (질문지)',
                // 'cell' 함수가 이제 클라이언트 측에 있으므로 안전합니다.
                cell: (info) => <div className="font-medium">{info.getValue() as string}</div>
            }
        ];

        for (let i = 0; i < resultSetCount; i++) {
            cols.push({
                accessorKey: `result_${i + 1}`,
                header: `AI 분석 결과 #${i + 1}`,
            });
        }
        return cols;
    }, [resultSetCount]);

    // 5. 'data' 생성 로직도 클라이언트로 이동
    const data = useMemo(() => {
        return templateItems.map(item => {
            const row: { [key: string]: any } = {
                header: item.header_name,
            };

            const itemResults = resultsMap.get(item.id) || [];
            for (let i = 0; i < resultSetCount; i++) {
                row[`result_${i + 1}`] = itemResults[i] || <span className="text-muted-foreground">/</span>;
            }
            return row;
        });
    }, [templateItems, resultsMap, resultSetCount]);

    // 6. 데이터가 없을 경우의 UI
    if (resultSetCount === 0) {
        return (
            <div className="text-center py-10 rounded-lg bg-slate-950">
                <FileText size={48} className="mx-auto text-slate-600 mb-4" />
                <h3 className="text-xl font-semibold text-white">데이터 없음</h3>
                <p className="text-slate-400 mt-2">AI가 분석한 결과가 없거나, 아직 분석이 진행 중입니다.</p>
            </div>
        );
    }

    // 7. 데이터가 있을 경우 DataTable 렌더링
    return <DataTable columns={columns} data={data} />;
}