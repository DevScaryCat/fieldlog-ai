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

// DataTable이 사용할 '평탄화된' 데이터 타입
type FlatTemplateItem = {
    id: string;
    path: string; // 예: "유해위험요인 파악 > 분류"
    default_value: string | null;
};

// Arborist 트리 데이터 타입 (헬퍼 함수용)
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

// 2. Arborist 트리 데이터 -> 엑셀 뷰용 평탄화
function flattenForExcelView(nodes: ArboristNode[], parentPath = ''): FlatTemplateItem[] {
    let flatList: FlatTemplateItem[] = [];

    for (const node of nodes) {
        const currentPath = parentPath ? `${parentPath} > ${node.name}` : node.name;

        if (node.children && node.children.length > 0) {
            flatList = flatList.concat(flattenForExcelView(node.children, currentPath));
        } else {
            flatList.push({
                id: node.id,
                path: currentPath,
                default_value: node.value,
            });
        }
    }
    return flatList;
}

// 3. DataTable을 위한 '컬럼' 정의
const columns: ColumnDef<FlatTemplateItem>[] = [
    {
        accessorKey: 'path',
        header: '평가 항목 (계층 구조)',
        cell: ({ row }) => <div className="font-medium">{row.getValue('path')}</div>,
    },
    {
        accessorKey: 'default_value',
        header: '기본값',
        cell: ({ row }) => row.getValue('default_value') || <span className="text-muted-foreground">(비어있음)</span>,
    },
];

// 4. 메인 엑셀 뷰 컴포넌트
export function TemplateExcelView({ initialItems }: { initialItems: TemplateItem[] }) {
    const excelData = useMemo(() => {
        const tree = buildTree(initialItems);
        return flattenForExcelView(tree);
    }, [initialItems]);

    return <DataTable columns={columns} data={excelData} />;
}