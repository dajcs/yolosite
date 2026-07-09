import { chatJson } from "./llm";
import type { ExtractedOffer } from "./types";

const FIELDS = [
  "employer",
  "title",
  "location",
  "ref_id",
  "deadline",
  "requirements",
  "link",
] as const;

export function normalizeOffer(raw: unknown): ExtractedOffer | null {
  if (typeof raw !== "object" || raw === null) return null;
  const source = raw as Record<string, unknown>;
  const offer = {} as Record<(typeof FIELDS)[number], string | null>;
  for (const field of FIELDS) {
    const value = source[field];
    offer[field] =
      typeof value === "string" && value.trim() !== "" ? value.trim() : null;
  }
  return offer.title || offer.employer ? offer : null;
}

const OFFER_SHAPE = `{
  "employer": "company name or null",
  "title": "position title or null",
  "location": "city/country or null",
  "ref_id": "job reference id or null",
  "deadline": "application deadline or null",
  "requirements": "2-4 sentence summary of the key requirements, or null",
  "link": "direct URL to the job posting or null"
}`;

export async function extractOffersFromEmail(
  subject: string,
  from: string,
  body: string,
): Promise<ExtractedOffer[]> {
  const prompt = `Below is an email. If it is job-related (a job-board alert digest with one or more listings, or a recruiter describing a position), extract every distinct job offer it contains. If it is not job-related (newsletter, receipt, personal mail, spam), return {"offers": []}.

Respond with ONLY strict JSON, no markdown fences, in this shape:
{"offers": [${OFFER_SHAPE}]}

Email subject: ${subject}
Email from: ${from}
Email body:
${body.slice(0, 15000)}`;

  const parsed = await chatJson(prompt);
  const offers = (parsed as { offers?: unknown[] } | null)?.offers;
  if (!Array.isArray(offers)) return [];
  return offers
    .map(normalizeOffer)
    .filter((o): o is ExtractedOffer => o !== null);
}

export async function extractOfferFromText(
  text: string,
  link?: string,
): Promise<ExtractedOffer | null> {
  const prompt = `Below is the text of a job posting. Extract its key characteristics.

Respond with ONLY strict JSON, no markdown fences, in this shape:
${OFFER_SHAPE}

${link ? `Posting URL: ${link}\n` : ""}Posting text:
${text.slice(0, 15000)}`;

  const offer = normalizeOffer(await chatJson(prompt));
  if (offer && link && !offer.link) offer.link = link;
  return offer;
}
