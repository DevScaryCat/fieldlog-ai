// /components/UploadTemplateDialog.tsx

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, UploadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from 'uuid'; // 파일명 중복 방지

// Supabase 'companies' 테이블 타입 (간단하게)
type Company = {
    id: string;
    name: string;
};

export default function UploadTemplateDialog() {
    const [open, setOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [templateName, setTemplateName] = useState('');
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>(undefined);

    const router = useRouter();
    const supabase = createClient();

    // 1. 팝업이 열릴 때 사업장 목록을 불러옵니다.
    useEffect(() => {
        if (open) {
            const fetchCompanies = async () => {
                const { data, error } = await supabase.from('companies').select('id, name');
                if (error) {
                    toast.error("사업장 목록을 불러오는데 실패했습니다.");
                } else {
                    setCompanies(data);
                }
            };
            fetchCompanies();
        }
    }, [open, supabase]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            // 파일 이름으로 템플릿 이름 자동 완성 (확장자 제외)
            setTemplateName(file.name.replace(/\.[^/.]+$/, ""));
            setSelectedFile(file);
        }
    };

    // 2. 업로드 핸들러
    const handleSubmit = async () => {
        if (!selectedFile || !templateName || !selectedCompanyId) {
            toast.warning("모든 필드를 채워주세요 (파일, 양식 이름, 사업장).");
            return;
        }

        setIsUploading(true);

        try {
            // 2a. 파일을 Supabase Storage에 업로드
            const fileExt = selectedFile.name.split('.').pop();
            const fileName = `${selectedCompanyId}/${uuidv4()}.${fileExt}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('findings') // 'findings' 버킷을 같이 사용 (나중에 'templates' 버킷을 따로 만들어도 됨)
                .upload(fileName, selectedFile);

            if (uploadError) throw uploadError;

            // 2b. 파일 정보를 DB에 저장
            const { error: dbError } = await supabase
                .from('assessment_templates')
                .insert({
                    company_id: selectedCompanyId,
                    template_name: templateName,
                    original_file_url: uploadData.path, // Storage에 저장된 경로
                });

            if (dbError) throw dbError;

            toast.success("양식이 성공적으로 업로드되었습니다.");
            setOpen(false); // 팝업 닫기
            router.refresh(); // 목록 페이지 새로고침

        } catch (error: any) {
            console.error('Template upload error:', error);
            toast.error("업로드 실패", { description: error.message });
        } finally {
            setIsUploading(false);
            // 폼 초기화
            setSelectedFile(null);
            setTemplateName('');
            setSelectedCompanyId(undefined);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    신규 양식 스캔/업로드
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>신규 양식 업로드</DialogTitle>
                    <DialogDescription>
                        엑셀, PDF 또는 이미지 파일을 업로드하여 디지털 양식을 생성합니다.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                    {/* 파일 선택 */}
                    <div className="space-y-2">
                        <Label htmlFor="file-upload">파일 선택 (엑셀, PDF, 이미지)</Label>
                        <Input
                            id="file-upload"
                            type="file"
                            onChange={handleFileChange}
                            accept=".xls,.xlsx,.pdf,.png,.jpg,.jpeg"
                            className="file:text-foreground"
                        />
                        {selectedFile && <p className="text-sm text-muted-foreground">{selectedFile.name}</p>}
                    </div>

                    {/* 사업장 선택 */}
                    <div className="space-y-2">
                        <Label htmlFor="company">연결할 사업장</Label>
                        <Select onValueChange={setSelectedCompanyId} value={selectedCompanyId}>
                            <SelectTrigger id="company">
                                <SelectValue placeholder="사업장을 선택하세요..." />
                            </SelectTrigger>
                            <SelectContent>
                                {companies.map((company) => (
                                    <SelectItem key={company.id} value={company.id}>
                                        {company.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 양식 이름 */}
                    <div className="space-y-2">
                        <Label htmlFor="template-name">양식 이름</Label>
                        <Input
                            id="template-name"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder="파일 이름으로 자동 완성됩니다."
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={isUploading}
                    >
                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                        {isUploading ? '업로드 중...' : '업로드 및 저장'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}