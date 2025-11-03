// /components/skeletons/TemplateEditorSkeleton.tsx

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { GripVertical } from "lucide-react";

export function TemplateEditorSkeleton({ itemsCount }: { itemsCount: number }) {
    const count = itemsCount > 0 ? itemsCount : 3; // 최소 3개의 스켈레톤 표시

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <Skeleton className="h-7 w-48" />
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-32" />
                    <Skeleton className="h-9 w-32" />
                </div>
            </div>
            <div className="space-y-2">
                {/* itemsCount만큼 스켈레톤 아이템을 렌더링 */}
                {Array.from({ length: count }).map((_, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-background rounded-md border">
                        <Button variant="ghost" size="icon" disabled>
                            <GripVertical className="h-4 w-4" />
                        </Button>
                        <Skeleton className="h-10 flex-1" />
                        <Skeleton className="h-10 flex-1" />
                        <Skeleton className="h-10 w-10" />
                    </div>
                ))}
            </div>
        </div>
    );
}