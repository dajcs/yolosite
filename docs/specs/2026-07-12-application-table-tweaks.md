# Applications Table Round-2 Tweaks — Design Spec

Date: 2026-07-12
Status: approved by owner (brainstormed after first real `/apply` run with the doc-links flow)
Builds on: `docs/specs/2026-07-12-application-doc-links.md` (unchanged except where noted).

## 1. Problem

The first real run of the new doc-links flow surfaced five gaps:

1. The applications table doesn't show the application `id`, which the owner
   needs for the cv repo's `/apply <id>` command.
2. The `archive/<iso_date>_<target>` caption in the Docs column is noise.
3. / 4. The "CV" / "Letter" link labels are uninformative; they should show the
   document name (e.g. `cv_unilu_dr_mlsec`, `cover_unilu_dr_mlsec`) and be
   clickable in the downloaded Excel file.
5. The `/apply` skill produces a clean `job.md`; its content is better than the
   Gemini-parsed `offer_text` and should replace it on report.

## 2. Decisions (all agreed with owner)

| # | Area | Decision |
|---|---|---|
| 1 | ID column | New first column "ID" in the applications table showing the numeric id. |
| 2 | Docs cell | `archive_path` caption removed from the UI. The column stays in the DB and in the report payload. |
| 3 | Link text | Derived from the URL: last path segment minus extension (`docName(url)`), shared helper in `web/lib/docLinks.ts`. Both links point at PDFs. No schema change. |
| 4 | Excel | `cv_url`/`letter_url` cells become real ExcelJS hyperlinks `{ text: docName(url), hyperlink: url }`, styled blue + underlined. CSV keeps raw URLs. |
| 5 | job.md | `POST /api/skill/report` gains a required `job_md: string`; the route sets `offer_text = job_md` alongside the existing fields. The cv repo's `/apply` skill sends the `job.md` content. |

## 3. `docName` helper

`web/lib/docLinks.ts`:

```ts
export function docName(url: string): string {
  return url.split("/").pop()!.replace(/\.[^.]+$/, "");
}
```

`docName("https://github.com/dajcs/cv/blob/main/archive/2026-07-12_x/cv_x.pdf")`
→ `"cv_x"`. Used by the client table and the xlsx export route (client-safe,
no dependencies).

## 4. Skill report contract

Payload becomes (all five fields required):

```json
{
  "application_id": 123,
  "archive_path": "archive/2026-07-12_acme",
  "cv_url": "https://github.com/dajcs/cv/blob/main/archive/2026-07-12_acme/cv_acme.pdf",
  "letter_url": "https://github.com/dajcs/cv/blob/main/archive/2026-07-12_acme/cover_acme.pdf",
  "job_md": "# Job offer …full job.md content…"
}
```

The route sets `status = 'docs_generated'`, `archive_path`, `cv_url`,
`letter_url`, **and `offer_text = job_md`**.

**cv repo follow-up (applied together with this change):** step 5 of the
`/apply` skill builds the JSON with python3 (multiline `job.md` content cannot
live safely inside a `curl -d '…'` shell literal) and POSTs it:

```bash
python3 -c "
import json
json.dump({'application_id': <ID>, 'archive_path': 'archive/<iso_date>_<target>',
  'cv_url': 'https://github.com/dajcs/cv/blob/main/archive/<iso_date>_<target>/cv_<target>.pdf',
  'letter_url': 'https://github.com/dajcs/cv/blob/main/archive/<iso_date>_<target>/cover_<target>.pdf',
  'job_md': open('job.md').read()}, open('/tmp/report.json','w'))
"
curl -s -X POST -H "Authorization: Bearer $SKILL_API_TOKEN" -H "Content-Type: application/json" \
  --data @/tmp/report.json "${YOLOSITE_URL:-https://yolosite.vercel.app}/api/skill/report"
```

## 5. App changes

- `web/lib/docLinks.ts` — new, the `docName` helper (with unit test).
- `web/app/api/skill/report/route.ts` — require `job_md`, set `offer_text`;
  tests updated.
- `ApplicationsTable.tsx` — "ID" column first; Docs cell renders
  `docName(a.cv_url)` / `docName(a.letter_url)` as the link text; the
  `archive_path` caption is removed.
- `web/app/api/assistant/export/xlsx/route.ts` — after `addRow`, set the two
  URL cells to `{ text: docName(url), hyperlink: url }` with
  `font: { color: { argb: "FF209DD7" }, underline: true }`.
- CSV export unchanged (raw URLs).
- No schema change; no migration.

## 6. Testing & verification

- Unit: `docName` (pdf, tex, trailing-segment cases); report route (400 when
  `job_md` missing, `offer_text` set on success).
- `npx tsc --noEmit` + `npm test`.
- e2e: dev server + temporary script — insert row, POST new payload, check
  `offer_text` equals the sent `job_md`, delete row. Manual: download the
  Excel export and confirm the links are clickable.
