import { NextResponse } from "next/server";
import { sessionOk } from "@/lib/guard";
import { getState, setState } from "@/lib/state";
import { fetchEmailsSince, isProcessed, markProcessed, type InboxEmail } from "@/lib/email";
import { extractOffersFromEmail, extractOfferFromText } from "@/lib/extract";
import { fetchPostingText } from "@/lib/fetchPosting";
import { createOffer } from "@/lib/offers";
import type { ExtractedOffer } from "@/lib/types";

export const maxDuration = 300;

const EMAILS_PER_RUN = 5;
const FETCH_CAP = 8;
const DEFAULT_LOOKBACK_MS = 7 * 24 * 3600 * 1000;

export async function POST() {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lastCheck = await getState("last_email_check");
  const since = lastCheck
    ? new Date(lastCheck)
    : new Date(Date.now() - DEFAULT_LOOKBACK_MS);
  const scanStart = new Date();

  let emails: InboxEmail[];
  try {
    emails = await fetchEmailsSince(since);
  } catch (error) {
    return NextResponse.json(
      { error: `IMAP failed: ${String(error)}` },
      { status: 502 },
    );
  }

  const fresh: InboxEmail[] = [];
  for (const email of emails) {
    if (email.date <= since) continue; // IMAP SINCE is day-granular
    if (await isProcessed(email.messageId)) continue;
    fresh.push(email);
  }

  const batch = fresh.slice(0, EMAILS_PER_RUN);
  let offersAdded = 0;
  let fetches = 0;

  for (const email of batch) {
    const extracted = await extractOffersFromEmail(
      email.subject,
      email.from,
      email.body,
    );
    for (const offer of extracted) {
      let postingText: string | null = null;
      let enriched: ExtractedOffer = offer;

      if (offer.link && fetches < FETCH_CAP) {
        fetches += 1;
        postingText = await fetchPostingText(offer.link);
        if (postingText) {
          const better = await extractOfferFromText(postingText, offer.link);
          if (better) {
            enriched = {
              ...offer,
              ...Object.fromEntries(
                Object.entries(better).filter(([, v]) => v !== null),
              ),
            } as ExtractedOffer;
          }
        }
      }

      await createOffer(enriched, {
        source: "email",
        email_ref: `${email.subject} — ${email.date.toISOString().slice(0, 10)}`,
        // A recruiter email that yields exactly one offer IS the description.
        posting_text:
          postingText ??
          (extracted.length === 1 ? email.body.slice(0, 30_000) : null),
        link: enriched.link,
      });
      offersAdded += 1;
    }
    await markProcessed(email.messageId);
  }

  const remaining = fresh.length - batch.length;
  if (remaining === 0) {
    await setState("last_email_check", scanStart.toISOString());
  }

  return NextResponse.json({ scanned: batch.length, offersAdded, remaining });
}
