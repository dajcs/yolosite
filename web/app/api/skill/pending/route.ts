import { NextResponse } from "next/server";
import { skillOk } from "@/lib/guard";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  if (!skillOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await db()`
    SELECT id, employer, title, link, ref_id, offer_text
    FROM applications WHERE status = 'pending' ORDER BY id`;
  return NextResponse.json({ applications: rows });
}
