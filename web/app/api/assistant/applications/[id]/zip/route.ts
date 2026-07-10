import { NextRequest, NextResponse } from "next/server";
import { sessionOk } from "@/lib/guard";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const rows = await db()`
    SELECT zip_filename, zip_base64 FROM applications WHERE id = ${Number(id)}`;
  const row = rows[0] as
    | { zip_filename: string | null; zip_base64: string | null }
    | undefined;
  if (!row?.zip_base64) {
    return NextResponse.json({ error: "No documents stored" }, { status: 404 });
  }
  const bytes = Buffer.from(row.zip_base64, "base64");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${row.zip_filename ?? `application-${id}.zip`}"`,
    },
  });
}
