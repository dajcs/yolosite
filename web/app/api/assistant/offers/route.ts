import { NextRequest, NextResponse } from "next/server";
import { sessionOk } from "@/lib/guard";
import { listOffers, createOffer } from "@/lib/offers";
import { extractOfferFromText } from "@/lib/extract";
import { fetchPostingText } from "@/lib/fetchPosting";

// Fetch (15s) + LLM extraction (up to 60s) must fit.
export const maxDuration = 120;

export async function GET() {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ offers: await listOffers() });
}

export async function POST(req: NextRequest) {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as { link?: string; text?: string };
  const link = body.link?.trim() || undefined;
  const text = body.text?.trim() || undefined;

  if (text) {
    const offer = await extractOfferFromText(text, link);
    if (!offer) {
      return NextResponse.json({ error: "extraction_failed" }, { status: 422 });
    }
    const id = await createOffer(offer, {
      source: "manual",
      posting_text: text,
      link: link ?? offer.link,
    });
    return NextResponse.json({ id }, { status: 201 });
  }

  if (link) {
    const posting = await fetchPostingText(link);
    if (!posting) {
      return NextResponse.json({ error: "fetch_failed" }, { status: 422 });
    }
    const offer = await extractOfferFromText(posting, link);
    if (!offer) {
      return NextResponse.json({ error: "extraction_failed" }, { status: 422 });
    }
    const id = await createOffer(offer, {
      source: "manual",
      posting_text: posting,
      link,
    });
    return NextResponse.json({ id }, { status: 201 });
  }

  return NextResponse.json({ error: "Provide a link or text" }, { status: 400 });
}
