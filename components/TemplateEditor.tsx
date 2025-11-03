// /components/TemplateEditor.tsx
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Tree, NodeRendererProps, TreeApi, NodeApi } from 'react-arborist';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GripVertical, Trash2, Plus, Loader2 } from "lucide-react";
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

// DB 원본 타입
type TemplateItem = {
    id: string;
    header_name: string | null;
    default_value: string | null;
    sort_order: number | null;
    template_id: string;
    parent_id: string | null;
};

// react-arborist가 요구하는 타입
type ArboristNode = {
    id: string;
    name: string;
    value: string | null;
    children?: ArboristNode[];
};

// --- 유틸리티 함수들 ---

// DB 데이터 -> Arborist 트리 데이터로 변환
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

// 1. (핵심 수정) Arborist의 "NodeApi" 트리를 -> DB 저장용 평탄화
function flattenTreeApiForSave(
    nodes: NodeApi<ArboristNode>[], // TreeApi의 .root.children을 받음
    templateId: string,
    parentId: string | null = null
): (TemplateItem | Omit<TemplateItem, 'id'>)[] {
    let flatList: (TemplateItem | Omit<TemplateItem, 'id'>)[] = [];

    // 'undefined.forEach' 에러를 여기서 방지
    if (!nodes) {
        return flatList;
    }

    nodes.forEach((node, index) => {
        // node.data가 ArboristNode (id, name, value)
        const dbItem: any = {
            id: node.data.id.startsWith('temp-') ? undefined : node.data.id,
            template_id: templateId,
            header_name: node.data.name,
            default_value: node.data.value,
            parent_id: parentId,
            sort_order: index,
        };
        if (!dbItem.id) delete dbItem.id;

        flatList.push(dbItem);

        // 재귀 호출
        if (node.children) {
            flatList = flatList.concat(flattenTreeApiForSave(node.children, templateId, node.data.id));
        }
    });
    return flatList;
}

// --- 스켈레톤 ---
function TemplateEditorSkeleton({ itemsCount }: { itemsCount: number }) {
    // (이전과 동일, 생략)
    const count = itemsCount > 0 ? itemsCount : 3;
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center"><Skeleton className="h-7 w-48" /><div className="flex gap-2"><Skeleton className="h-9 w-32" /><Skeleton className="h-9 w-32" /></div></div>
            <div className="space-y-2">
                {Array.from({ length: count }).map((_, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-background rounded-md border">
                        <Button variant="ghost" size="icon" disabled><GripVertical className="h-4 w-4" /></Button>
                        <Skeleton className="h-10 flex-1" /><Skeleton className="h-10 flex-1" /><Skeleton className="h-10 w-10" />
                    </div>
                ))}
            </div>
        </div>
    );
}

// --- 각 노드(항목)를 렌더링하는 컴포넌트 ---
const Node = React.memo(({ node, style, dragHandle }: NodeRendererProps<ArboristNode>) => {
    return (
        <div
            ref={dragHandle}
            style={style}
            className="flex items-center gap-2 p-2 bg-background rounded-md border"
        >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <Input
                value={node.data.name}
                onChange={(e) => node.edit({ ...node.data, name: e.target.value })}
                placeholder="컬럼 헤더"
                className="flex-1"
            />
            <Input
                value={node.data.value || ''}
                onChange={(e) => node.edit({ ...node.data, value: e.target.value })}
                placeholder="기본값 (선택)"
                className="flex-1"
            />
            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => node.tree.delete(node.id)}>
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
});
Node.displayName = 'Node';

// --- 메인 편집기 ---
export function TemplateEditor({ initialItems, templateId }: {
    initialItems: TemplateItem[],
    templateId: string,
}) {
    const [isMounted, setIsMounted] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const router = useRouter();
    const supabase = createClient();
    const treeRef = useRef<TreeApi<ArboristNode> | null>(null);

    const initialItemIds = useMemo(() => new Set(initialItems.map(i => i.id)), [initialItems]);
    const initialData = useMemo(() => buildTree(initialItems), [initialItems]);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // 저장 핸들러 (수정됨)
    const handleSave = async () => {
        if (!treeRef.current) return;
        setIsSaving(true);

        // 2. (핵심 수정) ref.current.root.children을 통해 현재 상태를 가져옵니다.
        const currentTreeData = treeRef.current.root.children;
        // 3. (핵심 수정) NodeApi[]를 평탄화하는 새 함수 호출
        const flatItemsToSave = flattenTreeApiForSave(currentTreeData, templateId);

        const currentItemIds = new Set(flatItemsToSave.map(i => i.id).filter(id => id));
        const idsToDelete = [...initialItemIds].filter(id => !currentItemIds.has(id) && !id.startsWith('temp-'));

        try {
            if (idsToDelete.length > 0) {
                const { error: deleteError } = await supabase
                    .from('template_items')
                    .delete()
                    .in('id', idsToDelete);
                if (deleteError) throw deleteError;
                toast.success(`${idsToDelete.length}개 항목 삭제 완료.`);
            }

            const { error: upsertError } = await supabase.from('template_items').upsert(
                flatItemsToSave,
                { onConflict: 'id' }
            );
            if (upsertError) throw upsertError;

            toast.success("양식이 성공적으로 저장되었습니다.");
            router.refresh();

        } catch (error: any) {
            toast.error("양식 저장 실패", { description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    // 새 항목 추가 핸들러
    const handleAddItem = () => {
        if (treeRef.current) {
            treeRef.current.create({ parentId: null, data: { id: `temp-${Math.random()}`, name: "새 컬럼", value: null } });
        }
    };

    // 4. (중요) onDelete 핸들러 제거
    //    삭제는 Node 컴포넌트의 node.tree.delete()가 UI상으로만 처리하고,
    //    'handleSave'가 최종 DB 상태를 동기화합니다.

    if (!isMounted) {
        return <TemplateEditorSkeleton itemsCount={initialItems.length} />;
    }

    return (
        <div className="space-y-4">
            <Tree
                ref={treeRef}
                // "비제어" 모드 + 핸들러 없음
                initialData={initialData}
                // 5. onDelete 핸들러 제거 (에러의 원인)
                width="100%"
                height={600}
                rowHeight={60}
                padding={20}
                indent={40}
            >
                {Node}
            </Tree>

            <div className="flex justify-between items-center">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddItem}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    최상위 항목 추가
                </Button>
                <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isSaving ? '저장 중...' : '양식 저장하기'}
                </Button>
            </div>
        </div>
    );
}