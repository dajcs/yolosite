import { cleanUrl } from "./fetchPosting";
import type { DuplicateMatch } from "./types";

export type Candidate = {
  link?: string | null;
  employer?: string | null;
  ref_id?: string | null;
};

export type CandidateKey = {
  link: string | null;
  ref: string | null;
  employer: string | null;
};

export type AppRow = {
  employer: string | null;
  title: string | null;
  ref_id: string | null;
  link: string | null;
  date: string;
};

export type OfferRow = {
  employer: string | null;
  title: string | null;
  ref_id: string | null;
  link: string | null;
  dismissed: boolean;
  dismissed_date: string | null;
};

// Null when the candidate has nothing to match on (no link, no ref).
export function candidateKey(c: Candidate): CandidateKey | null {
  const link = c.link?.trim() ? cleanUrl(c.link.trim()) : null;
  const ref = c.ref_id?.trim() || null;
  if (!link && !ref) return null;
  return { link, ref, employer: c.employer?.trim() || null };
}

// Fuzzy: case-insensitive, one name contains the other. Missing names never match.
export function employerMatches(
  a?: string | null,
  b?: string | null,
): boolean {
  const x = a?.trim().toLowerCase();
  const y = b?.trim().toLowerCase();
  if (!x || !y) return false;
  return x.includes(y) || y.includes(x);
}

function rowMatches(
  key: CandidateKey,
  row: { link: string | null; ref_id: string | null; employer: string | null },
): boolean {
  if (key.link && row.link === key.link) return true;
  if (key.ref && row.ref_id?.trim().toLowerCase() === key.ref.toLowerCase()) {
    return employerMatches(key.employer, row.employer);
  }
  return false;
}

// Precedence: applied > dismissed > still-active offer.
export function pickDuplicate(
  key: CandidateKey,
  apps: AppRow[],
  offers: OfferRow[],
): DuplicateMatch | null {
  const app = apps.find((r) => rowMatches(key, r));
  if (app) {
    return {
      status: "applied",
      date: app.date,
      employer: app.employer,
      title: app.title,
      ref_id: app.ref_id,
      link: app.link,
    };
  }
  const matched = offers.filter((r) => rowMatches(key, r));
  const hit = matched.find((r) => r.dismissed) ?? matched[0];
  if (!hit) return null;
  return {
    status: hit.dismissed ? "dismissed" : "active",
    date: hit.dismissed ? hit.dismissed_date : null,
    employer: hit.employer,
    title: hit.title,
    ref_id: hit.ref_id,
    link: hit.link,
  };
}

export function formatDuplicate(m: DuplicateMatch): string {
  const name =
    [m.employer, m.title].filter(Boolean).join(" — ") || "(unknown)";
  const ref = m.ref_id ? ` (${m.ref_id})` : "";
  const history =
    m.status === "applied"
      ? `APPLIED on ${m.date}`
      : m.status === "dismissed"
        ? `DISMISSED on ${m.date ?? "unknown date"}`
        : "ALREADY IN OFFERS";
  return `${name}${ref} — ${history}`;
}
