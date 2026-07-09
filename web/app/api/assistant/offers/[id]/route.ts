import { NextRequest, NextResponse } from "next/server";
import { sessionOk } from "@/lib/guard";
import { dismissOffer, applyToOffer } from "@/lib/offers";

export const maxDuration = 60;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { action } = (await req.json()) as { action?: string };

  if (action === "dismiss") {
    await dismissOffer(Number(id));
    return NextResponse.json({ ok: true });
  }
  if (action === "apply") {
    const applicationId = await applyToOffer(Number(id));
    if (applicationId === null) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ application_id: applicationId });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
