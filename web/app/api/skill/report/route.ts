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
    cv_url?: unknown;
    letter_url?: unknown;
  };
  const { application_id, archive_path, cv_url, letter_url } = body;
  if (
    typeof application_id !== "number" ||
    typeof archive_path !== "string" ||
    typeof cv_url !== "string" ||
    typeof letter_url !== "string"
  ) {
    return NextResponse.json(
      {
        error:
          "Required: application_id (number), archive_path, cv_url, letter_url (strings)",
      },
      { status: 400 },
    );
  }
  const rows = await db()`
    UPDATE applications
    SET status = 'docs_generated', archive_path = ${archive_path},
        cv_url = ${cv_url}, letter_url = ${letter_url}
    WHERE id = ${application_id}
    RETURNING id`;
  if (rows.length === 0) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
