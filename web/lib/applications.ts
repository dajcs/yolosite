import { db } from "./db";
import { STATUSES, type Application, type Status } from "./types";

const COLUMNS = `id, to_char(date, 'YYYY-MM-DD') AS date, link, offer_text, employer,
  title, ref_id, status, notes, archive_path, cv_url, letter_url`;

export type NewApplication = {
  offer_id?: number | null;
  link?: string | null;
  offer_text?: string | null;
  employer?: string | null;
  title?: string | null;
  ref_id?: string | null;
  notes?: string | null;
};

export async function listApplications(): Promise<Application[]> {
  const rows = await db().query(
    `SELECT ${COLUMNS} FROM applications ORDER BY date DESC, id DESC`,
  );
  return rows as unknown as Application[];
}

export async function createApplication(a: NewApplication): Promise<number> {
  const rows = await db()`
    INSERT INTO applications (offer_id, link, offer_text, employer, title, ref_id, notes)
    VALUES (${a.offer_id ?? null}, ${a.link ?? null}, ${a.offer_text ?? null},
            ${a.employer ?? null}, ${a.title ?? null}, ${a.ref_id ?? null}, ${a.notes ?? null})
    RETURNING id`;
  return (rows[0] as { id: number }).id;
}

const UPDATABLE = [
  "date",
  "link",
  "offer_text",
  "employer",
  "title",
  "ref_id",
  "status",
  "notes",
] as const;

export async function updateApplication(
  id: number,
  fields: Record<string, unknown>,
): Promise<boolean> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of UPDATABLE) {
    if (key in fields) {
      if (key === "status" && !STATUSES.includes(fields.status as Status)) return false;
      values.push(fields[key] === "" ? null : fields[key]);
      sets.push(`${key} = $${values.length}`);
    }
  }
  if (sets.length === 0) return false;
  values.push(id);
  await db().query(
    `UPDATE applications SET ${sets.join(", ")} WHERE id = $${values.length}`,
    values,
  );
  return true;
}

export async function deleteApplication(id: number): Promise<void> {
  await db()`DELETE FROM applications WHERE id = ${id}`;
}
