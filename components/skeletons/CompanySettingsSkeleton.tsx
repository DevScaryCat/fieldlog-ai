// /components/skeletons/CompanySettingsSkeleton.tsx

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export function CompanySettingsSkeleton() {
    return (
        <div className="w-full max-w-2xl mx-auto">
            {/* 뒤로가기 버튼 스켈레톤 */}
            <Button variant="outline" size="sm" className="mb-4" disabled>
                <ArrowLeft className="mr-2 h-4 w-4" />
                목록으로 돌아가기
            </Button>

            {/* 폼 카드 스켈레톤 */}
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-48" /> {/* CardTitle */}
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* 폼 아이템 1 */}
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-32" /> {/* FormLabel */}
                        <Skeleton className="h-10 w-full" /> {/* Input */}
                    </div>
                    {/* 폼 아이템 2 */}
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-32" /> {/* FormLabel */}
                        <Skeleton className="h-10 w-full" /> {/* Input */}
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Skeleton className="h-10 w-24" /> {/* 수정하기 버튼 */}
                    <Skeleton className="h-10 w-28" /> {/* 삭제하기 버튼 */}
                </CardFooter>
            </Card>
        </div>
    );
}