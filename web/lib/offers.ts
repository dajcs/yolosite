import { db } from "./db";
import { createApplication } from "./applications";
import { fetchPostingText } from "./fetchPosting";
import type { ExtractedOffer, Offer } from "./types";

export async function listOffers(): Promise<Offer[]> {
  const rows = await db()`
    SELECT id, to_char(created_at, 'YYYY-MM-DD') AS created_at, source, email_ref,
           link, posting_text, employer, title, location, ref_id, deadline, requirements
    FROM offers WHERE dismissed = false ORDER BY id DESC`;
  return rows as unknown as Offer[];
}

export async function createOffer(
  offer: ExtractedOffer,
  extra: {
    source: string;
    email_ref?: string | null;
    posting_text?: string | null;
    link?: string | null;
  },
): Promise<number> {
  const rows = await db()`
    INSERT INTO offers (source, email_ref, link, posting_text, employer, title,
                        location, ref_id, deadline, requirements)
    VALUES (${extra.source}, ${extra.email_ref ?? null}, ${extra.link ?? offer.link},
            ${extra.posting_text ?? null}, ${offer.employer}, ${offer.title},
            ${offer.location}, ${offer.ref_id}, ${offer.deadline}, ${offer.requirements})
    RETURNING id`;
  return (rows[0] as { id: number }).id;
}

export async function dismissOffer(id: number): Promise<void> {
  await db()`UPDATE offers SET dismissed = true WHERE id = ${id}`;
}

export async function applyToOffer(id: number): Promise<number | null> {
  const rows = await db()`SELECT * FROM offers WHERE id = ${id}`;
  if (rows.length === 0) return null;
  const offer = rows[0] as unknown as Offer;

  if (!offer.posting_text && offer.link) {
    const posting = await fetchPostingText(offer.link);
    if (posting) {
      await db()`UPDATE offers SET posting_text = ${posting} WHERE id = ${id}`;
      offer.posting_text = posting;
    }
  }

  const applicationId = await createApplication({
    offer_id: offer.id,
    link: offer.link,
    offer_text: offer.posting_text,
    employer: offer.employer,
    title: offer.title,
    ref_id: offer.ref_id,
  });
  await dismissOffer(id);
  return applicationId;
}
