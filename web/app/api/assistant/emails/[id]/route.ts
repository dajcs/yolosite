import { NextRequest, NextResponse } from "next/server";
import { sessionOk } from "@/lib/guard";
import { setClassification } from "@/lib/emails";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { classification } = (await req.json()) as { classification?: string };
  const ok = await setClassification(
    decodeURIComponent(id),
    classification ?? "",
  );
  if (!ok) {
    return NextResponse.json(
      { error: "Invalid classification" },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
