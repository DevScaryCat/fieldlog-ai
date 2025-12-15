// /components/TemplateExcelView.tsx

'use client';

import React, { useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';

// DB 원본 타입
type TemplateItem = {
    id: string;
    header_name: string | null;
    default_value: string | null;
    sort_order: number | null;
    template_id: string;
    parent_id: string | null;
};

// DataTable이 사용할 데이터 타입
type DynamicRowData = Record<string, string | null>;

// Arborist 트리 데이터 타입
type ArboristNode = {
    id: string;
    name: string;
    value: string | null;
    children?: ArboristNode[];
};

// 1. DB 데이터 -> Arborist 트리 데이터로 변환
function buildTree(items: TemplateItem[], parentId: string | null = null): ArboristNode[] {
    return items
        .filter(item => item.parent_id === parentId)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(item => {
            const children = buildTree(items, item.id);
            return {
                id: item.id,
                name: item.header_name || '',
                value: item.default_value || null,
                ...(children.length > 0 && { children }),
            };
        });
}

// 2. 트리 데이터 -> Dynamic Column/Row 데이터로 변환
function generateExcelStructure(nodes: ArboristNode[], parentPath = ''): { columns: ColumnDef<DynamicRowData>[], rowData: DynamicRowData } {
    const columns: ColumnDef<DynamicRowData>[] = [];
    const rowData: DynamicRowData = {};

    for (const node of nodes) {
        const accessorKey = node.id;
        const headerName = node.name;

        if (node.children && node.children.length > 0) {
            const childResult = generateExcelStructure(node.children, headerName);
            columns.push(...childResult.columns);
            Object.assign(rowData, childResult.rowData);
        } else {
            // 2-1. 컬럼 정의 생성
            columns.push({
                accessorKey: accessorKey,
                // 계층 구조를 헤더에 표시 (상위헤더 / 하위헤더)
                header: (parentPath ? `${parentPath} / ` : '') + headerName,
                // 셀 렌더링 수정: (비어있음) 텍스트 제거 및 빈 셀 높이 확보
                cell: ({ row }) => {
                    const value = row.getValue(accessorKey) as string | null;
                    return (
                        <div className="min-h-[20px] w-full h-full flex items-center">
                            {value || ""}
                        </div>
                    );
                },
                minSize: 150,
            });

            // 2-2. 첫 번째 행의 데이터 (Default Value) 설정
            rowData[accessorKey] = node.value;
        }
    }

    return { columns, rowData };
}

// 3. 메인 엑셀 뷰 컴포넌트
export function TemplateExcelView({ initialItems }: { initialItems: TemplateItem[] }) {

    const isInitialItemsEmpty = !initialItems || initialItems.length === 0;

    const { columns, excelData } = useMemo(() => {
        if (isInitialItemsEmpty) {
            return { columns: [], excelData: [] };
        }

        const tree = buildTree(initialItems);
        const { columns: generatedColumns, rowData } = generateExcelStructure(tree);

        // 3-1. 첫 번째 행 (기본값) + 빈 행 5개 생성
        const emptyRow = {}; // 빈 객체 (모든 값이 undefined)
        const dataWithPlaceholders = [
            rowData,              // 1행: AI가 추출한 기본값
            ...Array(5).fill(emptyRow) // 2~6행: 빈 줄 (미리보기용)
        ];

        return { columns: generatedColumns, excelData: dataWithPlaceholders };
    }, [initialItems, isInitialItemsEmpty]);


    if (isInitialItemsEmpty) {
        return <div className="p-4 text-center text-muted-foreground">분석된 평가 항목이 없습니다.</div>;
    }

    return (
        <div className="border rounded-lg overflow-hidden">
            {/* 데이터 테이블 렌더링 */}
            <DataTable columns={columns} data={excelData} />
        </div>
    );
}