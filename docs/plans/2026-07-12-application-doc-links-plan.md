# Application Document Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-application zip stored in Postgres with two GitHub URLs (`cv_url`, `letter_url`) pointing at the rendered PDFs in the cv repo archive.

**Architecture:** The `/apply` skill's report payload changes from `{application_id, archive_path, zip_filename, zip_base64}` to `{application_id, archive_path, cv_url, letter_url}`. The two URLs are stored as text columns on `applications`, rendered as "CV" / "Letter" links in the table's Docs cell, and added to the CSV/Excel exports. The zip columns, download route, and UI link are removed. Spec: `docs/specs/2026-07-12-application-doc-links.md`.

**Tech Stack:** Next.js 16 (App Router), Neon Postgres (`@neondatabase/serverless` tagged-template client), vitest 4, Tailwind v4.

## Global Constraints

- Keep it simple — no over-engineering, no defensive programming, no extra features (project CLAUDE.md).
- All commands run from `web/` unless stated otherwise. Commits run from repo root.
- Do NOT run `npm run build` — on this /mnt/c (WSL) checkout it can exceed tool timeouts. Verify with `npx tsc --noEmit` + `npm test` instead; Vercel does the real build.
- If `npx tsc --noEmit` errors ONLY inside `.next/dev/types/`, it's a stale artifact: `rm -rf web/.next/dev` and re-run.
- The Neon DB is the single live DB (dev = prod). Task 5 runs the migration; do not run `npm run db:init` before Task 5.
- New status after report stays `docs_generated` (existing value in `lib/types.ts` STATUSES — do not touch the status lifecycle).

---

### Task 1: Skill report route — new contract (TDD)

**Files:**
- Create: `web/vitest.config.ts`
- Create: `web/app/api/skill/report/route.test.ts`
- Modify: `web/app/api/skill/report/route.ts`

**Interfaces:**
- Consumes: `skillOk(req: Request): boolean` from `@/lib/guard`; `db()` tagged-template client from `@/lib/db`.
- Produces: `POST /api/skill/report` accepting `{application_id: number, archive_path: string, cv_url: string, letter_url: string}`; sets `status='docs_generated'`, `archive_path`, `cv_url`, `letter_url` on the row. Returns `{ok: true}` / 400 / 404 / 401. Tasks 2–5 rely on the DB columns `cv_url text`, `letter_url text` (added to schema in Task 5).

Background: existing tests import only relative paths, so there is no vitest config. The route imports `@/lib/guard`, so vitest needs the `@` alias — that's why `vitest.config.ts` is created here. Mocking `@/lib/guard` also prevents loading `@/auth` (next-auth) in tests.

- [ ] **Step 1: Create the vitest config with the `@` alias**

`web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
});
```

- [ ] **Step 2: Verify existing tests still pass with the new config**

Run (from `web/`): `npm test`
Expected: all existing suites pass (csv, extract, fetchPosting, llm, smoke).

- [ ] **Step 3: Write the failing route test**

`web/app/api/skill/report/route.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const updates: unknown[][] = [];
let updateResult: { id: number }[] = [{ id: 1 }];

vi.mock("@/lib/guard", () => ({ skillOk: () => true }));
vi.mock("@/lib/db", () => ({
  db: () => (_strings: TemplateStringsArray, ...values: unknown[]) => {
    updates.push(values);
    return Promise.resolve(updateResult);
  },
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://test/api/skill/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/skill/report", () => {
  beforeEach(() => {
    updates.length = 0;
    updateResult = [{ id: 1 }];
  });

  it("accepts the new payload and stores both URLs", async () => {
    const res = await POST(
      request({
        application_id: 1,
        archive_path: "archive/2026-07-12_acme",
        cv_url: "https://github.com/x/cv/blob/main/archive/2026-07-12_acme/cv.pdf",
        letter_url: "https://github.com/x/cv/blob/main/archive/2026-07-12_acme/letter.pdf",
      }),
    );
    expect(res.status).toBe(200);
    expect(updates[0]).toContain(
      "https://github.com/x/cv/blob/main/archive/2026-07-12_acme/cv.pdf",
    );
    expect(updates[0]).toContain(
      "https://github.com/x/cv/blob/main/archive/2026-07-12_acme/letter.pdf",
    );
  });

  it("rejects the old zip payload with 400", async () => {
    const res = await POST(
      request({
        application_id: 1,
        archive_path: "archive/x",
        zip_filename: "x.zip",
        zip_base64: "AAAA",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown application", async () => {
    updateResult = [];
    const res = await POST(
      request({ application_id: 999, archive_path: "a", cv_url: "u", letter_url: "v" }),
    );
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run app/api/skill/report/route.test.ts`
Expected: FAIL — "accepts the new payload" gets 400 (route still requires `zip_filename`/`zip_base64`), "rejects the old zip payload" passes 400 for the wrong reason or fails; the suite must be red overall.

- [ ] **Step 5: Rewrite the route for the new contract**

Replace the full contents of `web/app/api/skill/report/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { skillOk } from "@/lib/guard";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  if (!skillOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as {
    application_id?: unknown;
    archive_path?: unknown;
    cv_url?: unknown;
    letter_url?: unknown;
  };
  const { application_id, archive_path, cv_url, letter_url } = body;
  if (
    typeof application_id !== "number" ||
    typeof archive_path !== "string" ||
    typeof cv_url !== "string" ||
    typeof letter_url !== "string"
  ) {
    return NextResponse.json(
      {
        error:
          "Required: application_id (number), archive_path, cv_url, letter_url (strings)",
      },
      { status: 400 },
    );
  }
  const rows = await db()`
    UPDATE applications
    SET status = 'docs_generated', archive_path = ${archive_path},
        cv_url = ${cv_url}, letter_url = ${letter_url}
    WHERE id = ${application_id}
    RETURNING id`;
  if (rows.length === 0) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
```

(The zip size-limit check is gone with the zip.)

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run app/api/skill/report/route.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 7: Run the whole suite**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 8: Commit**

```bash
git add web/vitest.config.ts web/app/api/skill/report/route.test.ts web/app/api/skill/report/route.ts
git commit -m "feat: skill report sends cv_url/letter_url instead of zip"
```

---

### Task 2: Read path — Application type, query columns, export columns

**Files:**
- Modify: `web/lib/types.ts:20-33` (the `Application` type)
- Modify: `web/lib/applications.ts:4-6` (the `COLUMNS` constant)
- Modify: `web/lib/exportColumns.ts`

**Interfaces:**
- Consumes: DB columns `cv_url`, `letter_url` (migration in Task 5; nothing here touches the live DB).
- Produces: `Application` type with `cv_url: string | null` and `letter_url: string | null` (and WITHOUT `zip_filename`/`has_zip`) — Task 3's UI renders these. `EXPORT_COLUMNS` entries `{key: "cv_url", header: "CV link"}` and `{key: "letter_url", header: "Cover letter link"}` — picked up automatically by the CSV and Excel export routes.

Note: after this task `ApplicationsTable.tsx` no longer typechecks (it still references `a.has_zip`); Task 3 fixes it. Run only `npm test` here, and `npx tsc --noEmit` at the end of Task 3.

- [ ] **Step 1: Update the `Application` type**

In `web/lib/types.ts`, replace:

```ts
  archive_path: string | null;
  zip_filename: string | null;
  has_zip: boolean;
};
```

with:

```ts
  archive_path: string | null;
  cv_url: string | null;
  letter_url: string | null;
};
```

- [ ] **Step 2: Update the query column list**

In `web/lib/applications.ts`, replace:

```ts
const COLUMNS = `id, to_char(date, 'YYYY-MM-DD') AS date, link, offer_text, employer,
  title, ref_id, status, notes, archive_path, zip_filename,
  (zip_base64 IS NOT NULL) AS has_zip`;
```

with:

```ts
const COLUMNS = `id, to_char(date, 'YYYY-MM-DD') AS date, link, offer_text, employer,
  title, ref_id, status, notes, archive_path, cv_url, letter_url`;
```

(`UPDATABLE` stays unchanged — the URLs are written only by the skill report route.)

- [ ] **Step 3: Add the export columns**

Replace the full contents of `web/lib/exportColumns.ts` with:

```ts
import type { Column } from "./csv";

export const EXPORT_COLUMNS: Column[] = [
  { key: "date", header: "Date" },
  { key: "link", header: "Job offer link" },
  { key: "offer_text", header: "Job offer text" },
  { key: "employer", header: "Employer" },
  { key: "title", header: "Position" },
  { key: "ref_id", header: "Job ref. id" },
  { key: "status", header: "Status" },
  { key: "notes", header: "Notes" },
  { key: "cv_url", header: "CV link" },
  { key: "letter_url", header: "Cover letter link" },
];
```

- [ ] **Step 4: Run the test suite**

Run: `npm test`
Expected: PASS (nothing tests these constants directly; confirms no import broke).

- [ ] **Step 5: Commit**

```bash
git add web/lib/types.ts web/lib/applications.ts web/lib/exportColumns.ts
git commit -m "feat: cv_url/letter_url on Application, in query and exports"
```

---

### Task 3: UI — Docs cell links, delete zip download route

**Files:**
- Modify: `web/app/assistant/components/ApplicationsTable.tsx:84-96` (the Docs `<td>`)
- Delete: `web/app/api/assistant/applications/[id]/zip/route.ts`

**Interfaces:**
- Consumes: `Application.cv_url` / `Application.letter_url` from Task 2.
- Produces: Docs cell with "CV" and "Letter" links (new tab) and the `archive_path` gray caption; no zip link, no zip route.

- [ ] **Step 1: Replace the Docs cell**

In `web/app/assistant/components/ApplicationsTable.tsx`, replace:

```tsx
              <td className="whitespace-nowrap p-2">
                {a.has_zip && (
                  <a
                    href={`/api/assistant/applications/${a.id}/zip`}
                    className="text-purple hover:underline"
                  >
                    zip
                  </a>
                )}
                {a.archive_path && (
                  <div className="text-xs text-gray">{a.archive_path}</div>
                )}
              </td>
```

with:

```tsx
              <td className="whitespace-nowrap p-2">
                {a.cv_url && (
                  <a
                    href={a.cv_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-purple hover:underline"
                  >
                    CV
                  </a>
                )}
                {a.letter_url && (
                  <a
                    href={a.letter_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 text-purple hover:underline"
                  >
                    Letter
                  </a>
                )}
                {a.archive_path && (
                  <div className="text-xs text-gray">{a.archive_path}</div>
                )}
              </td>
```

- [ ] **Step 2: Delete the zip download route**

```bash
git rm web/app/api/assistant/applications/\[id\]/zip/route.ts
```

(This removes the now-empty `zip/` directory too.)

- [ ] **Step 3: Typecheck and test**

Run (from `web/`): `npx tsc --noEmit && npm test`
Expected: tsc clean (this also proves no leftover reference to `has_zip`/`zip_filename` anywhere), all tests pass. If tsc errors ONLY inside `.next/dev/types/` (e.g. stale generated types for the deleted zip route), run `rm -rf .next/dev` and re-run.

- [ ] **Step 4: Commit**

```bash
git add web/app/assistant/components/ApplicationsTable.tsx
git commit -m "feat: CV/Letter links in Docs cell, drop zip download"
```

(The `git rm` from Step 2 is already staged.)

---

### Task 4: Docs — CLAUDE.md and vision-spec superseded note

**Files:**
- Modify: `CLAUDE.md` (repo root, the assistant routes bullet)
- Modify: `docs/specs/2026-07-08-job-assistant-vision.md:67` (the "DB document store" bullet)

**Interfaces:**
- Consumes / Produces: documentation only.

- [ ] **Step 1: Update CLAUDE.md**

In root `CLAUDE.md`, replace:

```markdown
- `web/app/api/assistant/*` — session-guarded routes (offers, applications + zip download,
  emails list/pull, CSV/Excel export)
```

with:

```markdown
- `web/app/api/assistant/*` — session-guarded routes (offers, applications, emails
  list/pull, CSV/Excel export); application docs are GitHub links (`cv_url`, `letter_url`)
```

- [ ] **Step 2: Mark the vision spec's zip decision as superseded**

In `docs/specs/2026-07-08-job-assistant-vision.md`, replace:

```markdown
- **DB document store:** when the `/apply` skill reports back, it uploads a single `.zip` containing the application's `.tex` sources and rendered PDFs; the zip is stored with the application row and downloadable on click in the UI.
```

with:

```markdown
- **DB document store:** ~~when the `/apply` skill reports back, it uploads a single `.zip` containing the application's `.tex` sources and rendered PDFs; the zip is stored with the application row and downloadable on click in the UI.~~ *Superseded 2026-07-12: the skill reports two GitHub PDF links instead — see `docs/specs/2026-07-12-application-doc-links.md`.*
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/specs/2026-07-08-job-assistant-vision.md
git commit -m "docs: reflect GitHub doc links replacing stored zips"
```

---

### Task 5: Schema migration + end-to-end verification

**Files:**
- Modify: `web/lib/schema.sql` (append ALTER statements)
- Create (temporary, deleted before commit): `web/verify-doc-links.mts`

**Interfaces:**
- Consumes: everything above; `DATABASE_URL` and `SKILL_API_TOKEN` in `web/.env.local`.
- Produces: live `applications` table with `cv_url`/`letter_url` and without `zip_filename`/`zip_base64`.

⚠️ The Neon DB is shared with the deployed app. Between this migration and the next Vercel deploy, the deployed `/assistant` page errors (its SELECT still names `zip_filename`). That's acceptable for this single-user tool — push promptly after migrating (Step 7).

- [ ] **Step 1: Append migration statements to the schema**

At the end of `web/lib/schema.sql` (after the `emails` CREATE TABLE), add:

```sql
;

ALTER TABLE applications ADD COLUMN IF NOT EXISTS cv_url text;

ALTER TABLE applications ADD COLUMN IF NOT EXISTS letter_url text;

ALTER TABLE applications DROP COLUMN IF EXISTS zip_filename;

ALTER TABLE applications DROP COLUMN IF EXISTS zip_base64
```

(Note: `scripts/init-db.mjs` splits the file on `;` — the existing file has no trailing semicolon after the `emails` table, hence the leading `;`. Keep one statement per `;`.)

- [ ] **Step 2: Run the migration**

Run (from `web/`): `npm run db:init`
Expected: `OK: ...` lines for every statement including the four ALTERs, then `Schema applied.`

- [ ] **Step 3: Write the temporary e2e verification script**

`web/verify-doc-links.mts`:

```ts
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const [row] = await sql`
  INSERT INTO applications (employer, title) VALUES ('E2E Test Co', 'Test role')
  RETURNING id`;
const id = (row as { id: number }).id;
console.log("inserted test application", id);

const res = await fetch("http://localhost:3000/api/skill/report", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.SKILL_API_TOKEN}`,
  },
  body: JSON.stringify({
    application_id: id,
    archive_path: "archive/2026-07-12_e2e-test",
    cv_url: "https://github.com/example/cv/blob/main/archive/2026-07-12_e2e-test/cv.pdf",
    letter_url:
      "https://github.com/example/cv/blob/main/archive/2026-07-12_e2e-test/letter.pdf",
  }),
});
console.log("report response", res.status, await res.json());

const [check] = await sql`
  SELECT status, archive_path, cv_url, letter_url FROM applications WHERE id = ${id}`;
console.log("row after report:", check);

await sql`DELETE FROM applications WHERE id = ${id}`;
console.log("test row deleted");
```

- [ ] **Step 4: Start the dev server**

Run (from `web/`): `pkill -9 -f next; nohup npm run dev > /tmp/next-dev.log 2>&1 &` then wait until `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000` returns `200` (first compile can take ~30s on /mnt/c).

- [ ] **Step 5: Run the verification script**

Run (from `web/`): `npx tsx --env-file=.env.local verify-doc-links.mts`
Expected output:
- `report response 200 { ok: true }`
- `row after report:` shows `status: 'docs_generated'` and both URLs
- `test row deleted`

- [ ] **Step 6: Clean up and commit**

```bash
rm web/verify-doc-links.mts
pkill -9 -f next
git add web/lib/schema.sql
git commit -m "feat: migrate applications to cv_url/letter_url, drop zip columns"
```

- [ ] **Step 7: Push so Vercel redeploys against the migrated DB**

```bash
git push
```

Expected: deployed `/assistant` works again once the Vercel build finishes.

---

## Out of scope (follow-up in the cv repo)

The `/apply` skill in the separate `cv` repo must be updated to POST `{application_id, archive_path, cv_url, letter_url}` (full GitHub blob URLs of the two rendered PDFs) to `/api/skill/report` instead of building and uploading a zip. Until then, newly generated applications won't get their links.
