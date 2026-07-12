import type { Column } from "./csv";

export const EXPORT_COLUMNS: Column[] = [
  { key: "date", header: "Date" },
  { key: "link", header: "Job offer link" },
  { key: "offer_text", header: "Job offer text" },
  { key: "employer", header: "Employer" },
  { key: "title", header: "Position" },
  { key: "ref_id", header: "Job ref. id" },
  { key: "status", header: "Status" },
  { key: "cv_url", header: "CV link" },
  { key: "letter_url", header: "Cover letter link" },
  { key: "notes", header: "Notes" },
];
