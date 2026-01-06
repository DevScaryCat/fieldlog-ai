import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export const downloadPrettyExcel = async (
  title: string,
  headers: { header: string; key: string; width: number }[],
  data: any[]
) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("평가 결과");

    // 1. 컬럼 설정
    worksheet.columns = headers.map((h) => ({
      header: h.header,
      key: h.key,
      width: h.width, // 넘겨받은 너비 적용
    }));

    // 2. 헤더 행 스타일링
    const headerRow = worksheet.getRow(1);
    headerRow.height = 35; // 헤더 높이 넉넉하게
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF374151" }, // Tailwind Gray-700 (진한 회색)
      };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // 3. 데이터 행 추가
    data.forEach((row) => {
      worksheet.addRow(row);
    });

    // 4. 데이터 셀 전체 스타일링 (핵심!)
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // 헤더 건너뜀

      // 내용이 많으면 행 높이를 자동으로 늘려주지만, 최소 높이를 설정
      row.height = 45;

      row.eachCell((cell) => {
        // [중요] 텍스트 줄바꿈 & 상단 정렬
        cell.alignment = {
          vertical: "top",
          horizontal: "left",
          wrapText: true, // ★ 글자 넘침 방지
          indent: 1, // 1칸 들여쓰기 (여백 효과)
        };

        // 테두리 적용
        cell.border = {
          top: { style: "thin", color: { argb: "FFD1D5DB" } },
          left: { style: "thin", color: { argb: "FFD1D5DB" } },
          bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
          right: { style: "thin", color: { argb: "FFD1D5DB" } },
        };
      });
    });

    // 5. 파일 내보내기
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `${title}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (error) {
    console.error("Excel Export Error:", error);
    alert("엑셀 생성 중 오류가 발생했습니다.");
  }
};
