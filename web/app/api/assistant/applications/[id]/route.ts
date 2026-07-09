import { NextRequest, NextResponse } from "next/server";
import { sessionOk } from "@/lib/guard";
import { updateApplication, deleteApplication } from "@/lib/applications";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const ok = await updateApplication(Number(id), await req.json());
  if (!ok) {
    return NextResponse.json(
      { error: "Nothing to update or invalid status" },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await deleteApplication(Number(id));
  return NextResponse.json({ ok: true });
}
