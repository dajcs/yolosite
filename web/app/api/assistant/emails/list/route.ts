import { NextRequest, NextResponse } from "next/server";
import { sessionOk } from "@/lib/guard";
import { listEmailHeaders } from "@/lib/email";
import { listEmails, upsertEmails } from "@/lib/emails";
import { setState } from "@/lib/state";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { start, end } = (await req.json()) as { start?: string; end?: string };
  if (!start || !end) {
    return NextResponse.json(
      { error: "start and end dates are required" },
      { status: 400 },
    );
  }
  const startDate = new Date(start);
  const endDate = new Date(end);

  let headers;
  try {
    headers = await listEmailHeaders(startDate, endDate);
  } catch (error) {
    return NextResponse.json(
      { error: `IMAP failed: ${String(error)}` },
      { status: 502 },
    );
  }
  await upsertEmails(headers);
  await setState("last_email_check", end);
  return NextResponse.json({ emails: await listEmails(startDate, endDate) });
}
