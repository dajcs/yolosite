import { NextRequest, NextResponse } from "next/server";
import { sessionOk } from "@/lib/guard";
import { getEmail, markPulled, setClassification } from "@/lib/emails";
import { fetchEmailBody } from "@/lib/email";
import { extractOffersFromEmail, extractOfferFromText } from "@/lib/extract";
import { RateLimitedError } from "@/lib/llm";
import { fetchPostingText } from "@/lib/fetchPosting";
import { createOffer, findDuplicate } from "@/lib/offers";
import { formatDuplicate } from "@/lib/dedup";
import type { ExtractedOffer } from "@/lib/types";

// Pull can take a while (IMAP + Gemini + posting fetches).
export const maxDuration = 300;

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

// Pull one email: fetch its body by UID, extract offers with Gemini, fetch
// each posting (direct → Jina), and insert offers. Lives here as POST rather
// than a nested `[id]/pull` route: Next 16 (Turbopack) does not resolve a
// nested route under a dynamic `[id]` segment that holds a URL-encoded
// message-id, so the id must stay in a single dynamic segment.
export async function POST(_req: NextRequest, { params }: Params) {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const messageId = decodeURIComponent(id);

  const row = await getEmail(messageId);
  if (!row) {
    return NextResponse.json({ error: "Unknown email" }, { status: 404 });
  }
  if (row.uid === null) {
    return NextResponse.json(
      { error: "No IMAP UID stored — list emails again" },
      { status: 409 },
    );
  }

  let email;
  try {
    email = await fetchEmailBody(row.uid);
  } catch (error) {
    return NextResponse.json(
      { error: `IMAP failed: ${String(error)}` },
      { status: 502 },
    );
  }
  if (!email) {
    return NextResponse.json(
      { error: "Email no longer on server — list emails again" },
      { status: 409 },
    );
  }

  // null = model failure (leave unpulled); [] = genuinely no offers.
  let extracted: ExtractedOffer[] | null;
  try {
    extracted = await extractOffersFromEmail(
      email.subject,
      email.from,
      email.body,
    );
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return NextResponse.json(
        { error: "Gemini rate limited" },
        { status: 429 },
      );
    }
    throw error;
  }
  if (extracted === null) {
    return NextResponse.json(
      { error: "Extraction failed — retry this email" },
      { status: 502 },
    );
  }

  const titles: string[] = [];
  const skipped: string[] = [];
  for (const offer of extracted) {
    // Check before the posting fetch + refinement: a known link/ref skips
    // the expensive enrichment entirely.
    const early = await findDuplicate(offer);
    if (early) {
      skipped.push(formatDuplicate(early));
      continue;
    }

    let postingText: string | null = null;
    let enriched: ExtractedOffer = offer;

    if (offer.link) {
      postingText = await fetchPostingText(offer.link);
      if (postingText) {
        try {
          const better = await extractOfferFromText(postingText, offer.link);
          if (better) {
            enriched = {
              ...offer,
              ...Object.fromEntries(
                Object.entries(better).filter(([, v]) => v !== null),
              ),
            } as ExtractedOffer;
          }
        } catch (error) {
          // Refinement is best-effort: a rate limit here must not abort the
          // pull (offers may already be inserted; a retry would duplicate them).
          if (!(error instanceof RateLimitedError)) throw error;
        }
      }
    }

    // Enrichment may have filled in a ref_id or canonical link the email lacked.
    const dup = await findDuplicate(enriched);
    if (dup) {
      skipped.push(formatDuplicate(dup));
      continue;
    }

    await createOffer(enriched, {
      source: "email",
      email_ref: `${email.subject} — ${row.date.slice(0, 10)}`,
      // A recruiter email that yields exactly one offer IS the description.
      posting_text:
        postingText ??
        (extracted.length === 1 ? email.body.slice(0, 30_000) : null),
      link: enriched.link,
    });
    titles.push(enriched.title ?? enriched.employer ?? "(untitled)");
  }

  await markPulled(messageId, titles.length);
  const updated = await getEmail(messageId);
  return NextResponse.json({
    offersFound: titles.length,
    titles,
    skipped,
    classification: updated?.classification ?? row.classification,
  });
}
