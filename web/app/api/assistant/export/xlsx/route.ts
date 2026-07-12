import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { sessionOk } from "@/lib/guard";
import { listApplications } from "@/lib/applications";
import { EXPORT_COLUMNS } from "@/lib/exportColumns";
import { docName } from "@/lib/docLinks";

export async function GET() {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = (await listApplications()) as unknown as Record<string, unknown>[];

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Applications");
  sheet.columns = EXPORT_COLUMNS.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.key === "offer_text" ? 60 : 18,
  }));
  for (const row of rows) {
    const added = sheet.addRow(row);
    for (const key of ["cv_url", "letter_url"]) {
      const url = row[key];
      if (typeof url === "string" && url !== "") {
        const cell = added.getCell(key);
        cell.value = { text: docName(url), hyperlink: url };
        cell.font = { color: { argb: "FF209DD7" }, underline: true };
      }
    }
  }
  sheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="applications-${date}.xlsx"`,
    },
  });
}
