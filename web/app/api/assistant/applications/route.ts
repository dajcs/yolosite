import { NextRequest, NextResponse } from "next/server";
import { sessionOk } from "@/lib/guard";
import { listApplications, createApplication } from "@/lib/applications";

export async function GET() {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ applications: await listApplications() });
}

export async function POST(req: NextRequest) {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as Record<string, unknown>;
  const clean = Object.fromEntries(
    Object.entries(body).map(([k, v]) => [k, v === "" ? null : v]),
  );
  if (!clean.employer && !clean.title && !clean.link) {
    return NextResponse.json(
      { error: "Provide at least an employer, position, or link" },
      { status: 400 },
    );
  }
  const id = await createApplication(clean);
  return NextResponse.json({ id }, { status: 201 });
}
