// /components/TemplateViewSwitcher.tsx
'use client';

import React, { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TemplateEditor } from '@/components/TemplateEditor';
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
    // children 속성은 buildTree 과정에서 추가되므로 DB 타입에는 없습니다.
};

// DataTable이 사용할 '평탄화된' 데이터 타입
type FlatTemplateItem = {
    id: string;
    path: string; // 예: "유해위험요인 파악 > 분류"
    default_value: string | null;
};

// react-arborist가 요구하는 타입
type ArboristNode = {
    id: string;
    name: string;
    value: string | null;
    children?: ArboristNode[];
};

// DB 데이터 -> Arborist 트리 데이터로 변환 (TemplateEditor와 일치)
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

// Arborist 트리 데이터 -> 엑셀 뷰용 평탄화
function flattenForExcelView(nodes: ArboristNode[], parentPath = ''): FlatTemplateItem[] {
    let flatList: FlatTemplateItem[] = [];

    for (const node of nodes) {
        const currentPath = parentPath ? `${parentPath} > ${node.name}` : node.name;

        if (node.children && node.children.length > 0) {
            // 자식이 있으면, 자식들을 재귀적으로 탐색
            flatList = flatList.concat(flattenForExcelView(node.children, currentPath));
        } else {
            // 자식이 없는 최하위 노드만 엑셀 '행'으로 추가
            flatList.push({
                id: node.id,
                path: currentPath,
                default_value: node.value,
            });
        }
    }
    return flatList;
}

// DataTable을 위한 '컬럼' 정의
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

export function TemplateViewSwitcher({
    initialItems,
    templateId
}: {
    initialItems: TemplateItem[],
    templateId: string
}) {

    // 엑셀 뷰를 위한 데이터 가공 (useMemo로 캐싱)
    // 1. DB -> Tree -> Flat (Excel)
    const excelData = useMemo(() => {
        const tree = buildTree(initialItems);
        return flattenForExcelView(tree);
    }, [initialItems]);

    return (
        <Tabs defaultValue="tree" className="w-full">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">AI가 분석한 양식 컬럼</h3>
                <TabsList>
                    <TabsTrigger value="tree">구조 편집 (트리 뷰)</TabsTrigger>
                    <TabsTrigger value="excel">양식 미리보기 (엑셀 뷰)</TabsTrigger>
                </TabsList>
            </div>

            {/* 탭 1: 기존의 트리 에디터 */}
            <TabsContent value="tree">
                <TemplateEditor initialItems={initialItems} templateId={templateId} />
            </TabsContent>

            {/* 탭 2: 새로운 엑셀 뷰 (DataTable) */}
            <TabsContent value="excel">
                <DataTable columns={columns} data={excelData} />
            </TabsContent>
        </Tabs>
    );
}