// /components/ui/data-table.tsx

'use client';

import * as React from 'react';
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    className?: string;
}

export function DataTable<TData, TValue>({
    columns,
    data,
    className,
}: DataTableProps<TData, TValue>) {
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <div className={`rounded-md border ${className}`}>
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => {
                                return (
                                    <TableHead
                                        key={header.id}
                                        className="border-r last:border-r-0 h-10 bg-muted/50 font-bold text-center"
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                    </TableHead>
                                );
                            })}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                            <TableRow
                                key={row.id}
                                data-state={row.getIsSelected() && 'selected'}
                                className="hover:bg-transparent" // 엑셀 느낌을 위해 호버 효과 제거 (선택 사항)
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell
                                        key={cell.id}
                                        // [핵심 수정]
                                        // 1. border-r: 세로 줄 추가
                                        // 2. last:border-r-0: 마지막 칸은 세로 줄 제거
                                        // 3. h-10: 행 높이 고정 (빈 셀도 높이 유지)
                                        // 4. p-2: 패딩
                                        className="border-r last:border-r-0 h-10 p-2 align-middle"
                                    >
                                        {/* 내용이 없으면 공백(&nbsp;)을 렌더링하여 셀 높이/테두리 유지 */}
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={columns.length} className="h-24 text-center">
                                데이터가 없습니다.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}