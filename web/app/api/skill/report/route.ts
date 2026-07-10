import { NextResponse } from "next/server";
import { skillOk } from "@/lib/guard";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  if (!skillOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as {
    application_id?: unknown;
    archive_path?: unknown;
    zip_filename?: unknown;
    zip_base64?: unknown;
  };
  const { application_id, archive_path, zip_filename, zip_base64 } = body;
  if (
    typeof application_id !== "number" ||
    typeof archive_path !== "string" ||
    typeof zip_filename !== "string" ||
    typeof zip_base64 !== "string"
  ) {
    return NextResponse.json(
      {
        error:
          "Required: application_id (number), archive_path, zip_filename, zip_base64 (strings)",
      },
      { status: 400 },
    );
  }
  if (zip_base64.length > 6_000_000) {
    return NextResponse.json(
      { error: "Zip too large (max ~4.5 MB)" },
      { status: 413 },
    );
  }
  const rows = await db()`
    UPDATE applications
    SET status = 'docs_generated', archive_path = ${archive_path},
        zip_filename = ${zip_filename}, zip_base64 = ${zip_base64}
    WHERE id = ${application_id}
    RETURNING id`;
  if (rows.length === 0) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
