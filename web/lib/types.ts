export const STATUSES = [
  "pending",
  "docs_generated",
  "applied",
  "interview",
  "offer",
  "rejected",
] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  pending: "Pending",
  docs_generated: "Docs generated",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

export type Application = {
  id: number;
  date: string;
  link: string | null;
  offer_text: string | null;
  employer: string | null;
  title: string | null;
  ref_id: string | null;
  status: Status;
  notes: string | null;
  archive_path: string | null;
  zip_filename: string | null;
  has_zip: boolean;
};

export type Offer = {
  id: number;
  created_at: string;
  source: string;
  email_ref: string | null;
  link: string | null;
  posting_text: string | null;
  employer: string | null;
  title: string | null;
  location: string | null;
  ref_id: string | null;
  deadline: string | null;
  requirements: string | null;
};

export type ExtractedOffer = {
  employer: string | null;
  title: string | null;
  location: string | null;
  ref_id: string | null;
  deadline: string | null;
  requirements: string | null;
  link: string | null;
};
