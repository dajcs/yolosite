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

// Gemini structured-output schema (OpenAPI-style subset, uppercase types).
const OFFER_SCHEMA = {
  type: "OBJECT",
  properties: {
    employer: { type: "STRING", nullable: true },
    title: { type: "STRING", nullable: true },
    location: { type: "STRING", nullable: true },
    ref_id: { type: "STRING", nullable: true },
    deadline: { type: "STRING", nullable: true },
    requirements: { type: "STRING", nullable: true },
    link: { type: "STRING", nullable: true },
  },
};

const OFFERS_SCHEMA = {
  type: "OBJECT",
  properties: { offers: { type: "ARRAY", items: OFFER_SCHEMA } },
  required: ["offers"],
};

// Like OFFER_SCHEMA plus posting_text: the full posting transcribed from the
// PDF, stored so downstream (the /apply skill) has the job description.
const PDF_OFFER_SCHEMA = {
  type: "OBJECT",
  properties: {
    ...OFFER_SCHEMA.properties,
    posting_text: { type: "STRING", nullable: true },
  },
};

export async function extractOffersFromEmail(
  subject: string,
  from: string,
  body: string,
): Promise<ExtractedOffer[] | null> {
  const prompt = `Below is an email. If it is job-related (a job-board alert digest with one or more listings, or a recruiter describing a position), extract every distinct job offer it contains. If it is not job-related (newsletter, receipt, personal mail, spam), return an empty offers array.

For each offer: employer (company name), title (position title), location (city/country), ref_id (job reference id), deadline (application deadline), requirements (2-4 sentence summary of the key requirements), link (direct URL to the job posting). Use null for anything not present.

Email subject: ${subject}
Email from: ${from}
Email body:
${body.slice(0, 15000)}`;

  const parsed = await chatJson(prompt, OFFERS_SCHEMA);
  if (parsed === null) return null;
  const offers = (parsed as { offers?: unknown[] }).offers;
  if (!Array.isArray(offers)) return null;
  return offers
    .map(normalizeOffer)
    .filter((o): o is ExtractedOffer => o !== null);
}

export async function extractOfferFromText(
  text: string,
  link?: string,
): Promise<ExtractedOffer | null> {
  const prompt = `Below is the text of a job posting. Extract its key characteristics: employer (company name), title (position title), location (city/country), ref_id (job reference id), deadline (application deadline), requirements (2-4 sentence summary of the key requirements), link (direct URL to the job posting). Use null for anything not present.

${link ? `Posting URL: ${link}\n` : ""}Posting text:
${text.slice(0, 15000)}`;

  const offer = normalizeOffer(await chatJson(prompt, OFFER_SCHEMA));
  if (offer && link && !offer.link) offer.link = link;
  return offer;
}

export async function extractOfferFromPdf(
  base64: string,
  link?: string,
): Promise<{ offer: ExtractedOffer; text: string | null } | null> {
  const prompt = `Attached is a PDF of a job posting. Extract its key characteristics: employer (company name), title (position title), location (city/country), ref_id (job reference id), deadline (application deadline), requirements (2-4 sentence summary of the key requirements), link (direct URL to the job posting), and posting_text (the full text of the posting, transcribed verbatim). Use null for anything not present.${
    link ? `\n\nPosting URL: ${link}` : ""
  }`;

  const raw = await chatJson(prompt, PDF_OFFER_SCHEMA, {
    mimeType: "application/pdf",
    base64,
  });
  const offer = normalizeOffer(raw);
  if (!offer) return null;
  if (link && !offer.link) offer.link = link;
  const value = (raw as { posting_text?: unknown }).posting_text;
  const text =
    typeof value === "string" && value.trim() !== "" ? value.trim() : null;
  return { offer, text };
}
