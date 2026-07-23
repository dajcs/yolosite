import { NextRequest, NextResponse } from "next/server";
import { sessionOk } from "@/lib/guard";
import { listOffers, createOffer, findDuplicate } from "@/lib/offers";
import { formatDuplicate } from "@/lib/dedup";
import type { DuplicateMatch } from "@/lib/types";
import { extractOfferFromText, extractOfferFromPdf } from "@/lib/extract";
import { fetchPostingText } from "@/lib/fetchPosting";

// Fetch (15s) + LLM extraction (up to 60s) must fit.
export const maxDuration = 120;

function duplicateResponse(match: DuplicateMatch) {
  return NextResponse.json(
    { error: "duplicate", match, message: formatDuplicate(match) },
    { status: 409 },
  );
}

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
  const body = (await req.json()) as {
    link?: string;
    text?: string;
    pdf?: string;
    force?: boolean;
  };
  const link = body.link?.trim() || undefined;
  const text = body.text?.trim() || undefined;
  const pdf = body.pdf?.trim() || undefined;
  const force = body.force === true;

  if (text) {
    const offer = await extractOfferFromText(text, link);
    if (!offer) {
      return NextResponse.json({ error: "extraction_failed" }, { status: 422 });
    }
    if (!force) {
      const dup = await findDuplicate({
        link: link ?? offer.link,
        employer: offer.employer,
        ref_id: offer.ref_id,
      });
      if (dup) return duplicateResponse(dup);
    }
    const id = await createOffer(offer, {
      source: "manual",
      posting_text: text,
      link: link ?? offer.link,
    });
    return NextResponse.json({ id }, { status: 201 });
  }

  if (pdf) {
    const extracted = await extractOfferFromPdf(pdf, link);
    if (!extracted) {
      return NextResponse.json({ error: "extraction_failed" }, { status: 422 });
    }
    const { offer, text } = extracted;
    if (!force) {
      const dup = await findDuplicate({
        link: link ?? offer.link,
        employer: offer.employer,
        ref_id: offer.ref_id,
      });
      if (dup) return duplicateResponse(dup);
    }
    const id = await createOffer(offer, {
      source: "manual",
      posting_text: text,
      link: link ?? offer.link,
    });
    return NextResponse.json({ id }, { status: 201 });
  }

  if (link) {
    if (!force) {
      const dup = await findDuplicate({ link });
      if (dup) return duplicateResponse(dup);
    }
    const posting = await fetchPostingText(link);
    if (!posting) {
      return NextResponse.json({ error: "fetch_failed" }, { status: 422 });
    }
    const offer = await extractOfferFromText(posting, link);
    if (!offer) {
      return NextResponse.json({ error: "extraction_failed" }, { status: 422 });
    }
    if (!force) {
      const dup = await findDuplicate({
        link,
        employer: offer.employer,
        ref_id: offer.ref_id,
      });
      if (dup) return duplicateResponse(dup);
    }
    const id = await createOffer(offer, {
      source: "manual",
      posting_text: posting,
      link,
    });
    return NextResponse.json({ id }, { status: 201 });
  }

  return NextResponse.json({ error: "Provide a link, text, or PDF" }, { status: 400 });
}
