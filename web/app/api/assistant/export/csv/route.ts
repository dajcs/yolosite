import { NextResponse } from "next/server";
import { sessionOk } from "@/lib/guard";
import { listApplications } from "@/lib/applications";
import { toCsv } from "@/lib/csv";
import { EXPORT_COLUMNS } from "@/lib/exportColumns";

export async function GET() {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = (await listApplications()) as unknown as Record<string, unknown>[];
  const csv = toCsv(rows, EXPORT_COLUMNS);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="applications-${date}.csv"`,
    },
  });
}
