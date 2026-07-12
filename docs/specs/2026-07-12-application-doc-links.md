# Application Document Links — Design Spec

Date: 2026-07-12
Status: approved by owner (brainstormed and decided 2026-07-12)
Supersedes: the per-application zip document store of
`docs/specs/2026-07-08-job-assistant-vision.md` ("DB document store" and the
zip parts of the `/apply` handoff). Everything else in that document is unchanged.

## 1. Problem

Each application currently stores its generated documents as a base64 zip in
Postgres (`zip_filename`, `zip_base64`), uploaded by the `/apply` skill and
downloadable from the applications table. This duplicates the canonical GitHub
archive in the `cv` repo, bloats the database, and forces a size cap on the
skill upload. The GitHub archive already holds the rendered PDFs, so the app
only needs links.

## 2. Decisions (all agreed with owner)

| # | Area | Decision |
|---|---|---|
| 1 | Link source | The `/apply` skill sends **two full GitHub URLs** (`cv_url`, `letter_url`) pointing at the rendered PDFs in the cv repo archive. No URL construction in the app. |
| 2 | Zip storage | **Removed entirely** — DB columns, download route, UI link, and skill-contract fields. The GitHub archive is the single document store. |
| 3 | Existing rows | Zips are dropped without backfill (GitHub archive still has everything). `archive_path` is kept; old rows simply have no URL links until regenerated. |
| 4 | Export | Both links are added to the CSV/Excel export columns. |

## 3. Schema

In `applications`: add `cv_url text` and `letter_url text`; drop `zip_filename`
and `zip_base64`. `lib/schema.sql` gains idempotent migration statements after
the CREATE TABLEs:

```sql
ALTER TABLE applications ADD COLUMN IF NOT EXISTS cv_url text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS letter_url text;
ALTER TABLE applications DROP COLUMN IF EXISTS zip_filename;
ALTER TABLE applications DROP COLUMN IF EXISTS zip_base64;
```

`npm run db:init` applies them to the live Neon DB in place.

## 4. Skill report contract

`POST /api/skill/report` payload becomes:

```json
{
  "application_id": 123,
  "archive_path": "archive/2026-07-12_acme",
  "cv_url": "https://github.com/<owner>/cv/blob/main/archive/2026-07-12_acme/cv_acme.pdf",
  "letter_url": "https://github.com/<owner>/cv/blob/main/archive/2026-07-12_acme/letter_acme.pdf"
}
```

All four fields required. The route sets `status = 'docs_generated'`,
`archive_path`, `cv_url`, `letter_url`. The zip size-limit check is removed.

**Follow-up in the cv repo (out of scope here):** update the `/apply` skill to
send this payload instead of the zip.

## 5. App changes

- `lib/types.ts` — `Application` drops `zip_filename`/`has_zip`, gains
  `cv_url`/`letter_url` (both `string | null`).
- `lib/applications.ts` — column list updated; `UPDATABLE` unchanged (URLs come
  only from the skill).
- `app/api/assistant/applications/[id]/zip/route.ts` — deleted.
- `ApplicationsTable.tsx` Docs cell — two links, "CV" and "Letter", opening in
  a new tab; `archive_path` stays as the small gray caption; zip link removed.
- `lib/exportColumns.ts` — add `cv_url` → "CV link" and `letter_url` →
  "Cover letter link"; CSV and Excel exports pick these up automatically.

## 6. Docs

- CLAUDE.md: "applications + zip download" wording updated to reflect links.
- Vision spec: short superseded-by note on the document-storage decision.

## 7. Testing & verification

- `npm test` (vitest) still passes; no zip-specific tests exist.
- Manual verification: run the app, POST the new payload to `/api/skill/report`
  via curl, confirm the CV/Letter links render in the applications table and
  appear in the CSV export.
