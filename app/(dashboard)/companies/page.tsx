// /app/(dashboard)/companies/page.tsx

import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { PlusCircle, Settings } from 'lucide-react'; // Edit -> Settings 아이콘

export const dynamic = 'force-dynamic';

export default async function CompaniesPage() {
    const supabase = await createClient();

    const { data: companies, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('💥 Error fetching companies:', JSON.stringify(error, null, 2));
    }

    return (
        <div className="w-full">
            <header className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold tracking-tight">사업장 관리</h1>
                <Button asChild>
                    <Link href="/companies/new">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        신규 등록
                    </Link>
                </Button>
            </header>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[200px]">사업장명</TableHead>
                            <TableHead>주소</TableHead>
                            <TableHead className="w-[100px] text-right">관리</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {companies && companies.length > 0 ? (
                            companies.map((company) => (
                                <TableRow key={company.id}>
                                    <TableCell className="font-medium">{company.name}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {company.address || '-'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {/* --- 링크와 버튼이 수정되었습니다 --- */}
                                        <Button variant="outline" size="sm" asChild>
                                            {/* '/edit'을 빼고 사업장 ID의 메인 페이지로 연결 */}
                                            <Link href={`/companies/${company.id}`}>
                                                <Settings className="mr-2 h-4 w-4" /> 관리
                                            </Link>
                                        </Button>
                                        {/* --------------------------------- */}
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                    등록된 사업장이 없습니다.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}