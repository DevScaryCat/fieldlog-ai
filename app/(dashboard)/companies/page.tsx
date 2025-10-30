// /app/(dashboard)/companies/page.tsx

import { createClient } from '@/utils/supabase/server' // async 함수 임포트
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
import { PlusCircle, Edit } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CompaniesPage() {
    // createClient() 호출 앞에 await를 추가합니다.
    const supabase = await createClient();

    console.log("Attempting to fetch companies with async client...");

    let companies: any[] | null = [];
    let fetchError: any = null;

    try {
        const { data, error } = await supabase
            .from('companies')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        companies = data;
        console.log("Successfully fetched companies:", companies?.length);

    } catch (error) {
        fetchError = error;
        console.error('💥 Error fetching companies:', JSON.stringify(fetchError, null, 2));
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

            {fetchError && (
                <div className="mb-4 rounded border border-destructive bg-destructive/10 p-4 text-destructive">
                    <p><strong>데이터 로딩 실패:</strong></p>
                    <pre className="mt-2 text-xs whitespace-pre-wrap">
                        {JSON.stringify(fetchError, null, 2)}
                    </pre>
                </div>
            )}

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[200px]">사업장명</TableHead>
                            <TableHead>주소</TableHead>
                            <TableHead className="w-[100px] text-right">작업</TableHead>
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
                                        <Button variant="outline" size="sm" asChild>
                                            <Link href={`/companies/${company.id}/edit`}>
                                                <Edit className="mr-2 h-4 w-4" /> 수정
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                    {fetchError ? '데이터를 불러올 수 없습니다.' : '등록된 사업장이 없습니다.'}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}