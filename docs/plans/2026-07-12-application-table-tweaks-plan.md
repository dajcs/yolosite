# Applications Table Round-2 Tweaks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the application id in the table, replace the CV/Letter link labels with document names (clickable in Excel), drop the archive caption, and let the `/apply` skill's `job.md` content replace the Gemini-parsed `offer_text`.

**Architecture:** A tiny `docName(url)` helper derives link text from the URL's last path segment (no schema change). `POST /api/skill/report` gains a required `job_md` field written to `offer_text`. The xlsx export writes real ExcelJS hyperlink cell values. The cv repo's `/apply` skill step 5 switches to a python3-built JSON payload including `job.md`. Spec: `docs/specs/2026-07-12-application-table-tweaks.md`.

**Tech Stack:** Next.js 16 (App Router), Neon Postgres, ExcelJS, vitest 4 (config with `@` alias already exists).

## Global Constraints

- Keep it simple — no over-engineering, no defensive programming, no extra features (project CLAUDE.md).
- npm/npx commands run from `web/`; git commits from the repo root.
- Do NOT run `npm run build` (too slow on this /mnt/c checkout) — verify with `npx tsc --noEmit` + `npm test`; Vercel does the real build. If tsc errors ONLY inside `.next/dev/types/`, run `rm -rf web/.next/dev` and re-run.
- No schema change, no migration — do NOT run `npm run db:init`.
- Excel hyperlink font color is the site blue: `argb: "FF209DD7"`, underlined.
- Commit messages end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: `docName` helper (TDD)

**Files:**
- Create: `web/lib/docLinks.ts`
- Test: `web/lib/__tests__/docLinks.test.ts`

**Interfaces:**
- Consumes: nothing (pure function, no dependencies; must stay client-safe — no server imports).
- Produces: `docName(url: string): string` — last path segment of the URL minus its extension. Tasks 3 and 4 import it as `import { docName } from "@/lib/docLinks"` (Task 3 uses the relative-style `@/lib/docLinks` too).

- [ ] **Step 1: Write the failing test**

`web/lib/__tests__/docLinks.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { docName } from "../docLinks";

describe("docName", () => {
  it("strips path and extension", () => {
    expect(
      docName("https://github.com/dajcs/cv/blob/main/archive/2026-07-12_x/cv_unilu_dr_mlsec.pdf"),
    ).toBe("cv_unilu_dr_mlsec");
  });

  it("handles other extensions", () => {
    expect(docName("https://example.com/a/cover_y.tex")).toBe("cover_y");
  });

  it("returns the bare segment when there is no extension", () => {
    expect(docName("https://example.com/a/readme")).toBe("readme");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `web/`): `npx vitest run lib/__tests__/docLinks.test.ts`
Expected: FAIL — cannot resolve `../docLinks` (module does not exist).

- [ ] **Step 3: Write the implementation**

`web/lib/docLinks.ts`:

```ts
export function docName(url: string): string {
  return url.split("/").pop()!.replace(/\.[^.]+$/, "");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/__tests__/docLinks.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add web/lib/docLinks.ts web/lib/__tests__/docLinks.test.ts
git commit -m "feat: docName helper for document link labels"
```

---

### Task 2: Report route — require `job_md`, write `offer_text` (TDD)

**Files:**
- Modify: `web/app/api/skill/report/route.test.ts` (full rewrite below)
- Modify: `web/app/api/skill/report/route.ts` (full rewrite below)

**Interfaces:**
- Consumes: `skillOk(req: Request): boolean` from `@/lib/guard`; tagged-template `db()` from `@/lib/db`.
- Produces: `POST /api/skill/report` accepting `{application_id: number, archive_path: string, cv_url: string, letter_url: string, job_md: string}` (all required); sets `status='docs_generated'`, `archive_path`, `cv_url`, `letter_url`, and `offer_text = job_md`. Returns `{ok: true}` / 400 / 404 / 401. Task 5's e2e script relies on exactly this contract.

- [ ] **Step 1: Rewrite the test file for the new contract**

Replace the full contents of `web/app/api/skill/report/route.test.ts` with:

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

const validBody = {
  application_id: 1,
  archive_path: "archive/2026-07-12_acme",
  cv_url: "https://github.com/x/cv/blob/main/archive/2026-07-12_acme/cv_acme.pdf",
  letter_url: "https://github.com/x/cv/blob/main/archive/2026-07-12_acme/cover_acme.pdf",
  job_md: "# Job\n\nfull description from job.md",
};

describe("POST /api/skill/report", () => {
  beforeEach(() => {
    updates.length = 0;
    updateResult = [{ id: 1 }];
  });

  it("accepts the payload and stores both URLs and job_md as offer_text", async () => {
    const res = await POST(request(validBody));
    expect(res.status).toBe(200);
    expect(updates[0]).toContain(validBody.cv_url);
    expect(updates[0]).toContain(validBody.letter_url);
    expect(updates[0]).toContain(validBody.job_md);
  });

  it("rejects a payload missing job_md with 400", async () => {
    const { job_md: _job_md, ...withoutJobMd } = validBody;
    const res = await POST(request(withoutJobMd));
    expect(res.status).toBe(400);
    expect(updates).toHaveLength(0);
  });

  it("returns 404 for an unknown application", async () => {
    updateResult = [];
    const res = await POST(request({ ...validBody, application_id: 999 }));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/api/skill/report/route.test.ts`
Expected: FAIL — test 1 fails (`updates[0]` does not contain `job_md`; the route ignores the field) and test 2 fails (route returns 200, not 400, without `job_md`).

- [ ] **Step 3: Rewrite the route**

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
    job_md?: unknown;
  };
  const { application_id, archive_path, cv_url, letter_url, job_md } = body;
  if (
    typeof application_id !== "number" ||
    typeof archive_path !== "string" ||
    typeof cv_url !== "string" ||
    typeof letter_url !== "string" ||
    typeof job_md !== "string"
  ) {
    return NextResponse.json(
      {
        error:
          "Required: application_id (number), archive_path, cv_url, letter_url, job_md (strings)",
      },
      { status: 400 },
    );
  }
  const rows = await db()`
    UPDATE applications
    SET status = 'docs_generated', archive_path = ${archive_path},
        cv_url = ${cv_url}, letter_url = ${letter_url}, offer_text = ${job_md}
    WHERE id = ${application_id}
    RETURNING id`;
  if (rows.length === 0) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/api/skill/report/route.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Run the whole suite and commit**

Run: `npm test` — expected: all suites pass.

```bash
git add web/app/api/skill/report/route.test.ts web/app/api/skill/report/route.ts
git commit -m "feat: report requires job_md, replaces offer_text"
```

---

### Task 3: UI — ID column, named links, drop archive caption

**Files:**
- Modify: `web/app/assistant/components/ApplicationsTable.tsx`

**Interfaces:**
- Consumes: `docName(url: string): string` from `@/lib/docLinks` (Task 1); `Application.cv_url` / `letter_url` / `id` (existing).
- Produces: table with an "ID" first column; Docs cell links labeled `docName(url)`; no `archive_path` caption.

- [ ] **Step 1: Add the import**

In `web/app/assistant/components/ApplicationsTable.tsx`, after the existing imports (`import { STATUSES, ... } from "@/lib/types";`), add:

```tsx
import { docName } from "@/lib/docLinks";
```

- [ ] **Step 2: Add the ID header column**

Replace:

```tsx
          <tr>
            <th className="p-2">Date</th>
```

with:

```tsx
          <tr>
            <th className="p-2">ID</th>
            <th className="p-2">Date</th>
```

- [ ] **Step 3: Add the ID body cell**

Replace:

```tsx
            <tr key={a.id} className="border-t border-surface2 align-top">
              <td className="whitespace-nowrap p-2">{a.date}</td>
```

with:

```tsx
            <tr key={a.id} className="border-t border-surface2 align-top">
              <td className="p-2">{a.id}</td>
              <td className="whitespace-nowrap p-2">{a.date}</td>
```

- [ ] **Step 4: Rename the links and drop the caption**

Replace the Docs cell:

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
                    {docName(a.cv_url)}
                  </a>
                )}
                {a.letter_url && (
                  <a
                    href={a.letter_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 text-purple hover:underline"
                  >
                    {docName(a.letter_url)}
                  </a>
                )}
              </td>
```

- [ ] **Step 5: Typecheck, test, commit**

Run (from `web/`): `npx tsc --noEmit && npm test`
Expected: tsc clean, all tests pass.

```bash
git add web/app/assistant/components/ApplicationsTable.tsx
git commit -m "feat: ID column and named doc links in applications table"
```

---

### Task 4: Excel export — clickable hyperlinks

**Files:**
- Modify: `web/app/api/assistant/export/xlsx/route.ts` (full rewrite below)

**Interfaces:**
- Consumes: `docName(url: string): string` from `@/lib/docLinks` (Task 1); `EXPORT_COLUMNS` (has `cv_url`/`letter_url` keys); `listApplications()`.
- Produces: xlsx download where `cv_url`/`letter_url` cells are `{ text: docName(url), hyperlink: url }`, blue (`FF209DD7`) underlined. CSV export is untouched.

- [ ] **Step 1: Rewrite the xlsx route**

Replace the full contents of `web/app/api/assistant/export/xlsx/route.ts` with:

```ts
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { sessionOk } from "@/lib/guard";
import { listApplications } from "@/lib/applications";
import { EXPORT_COLUMNS } from "@/lib/exportColumns";
import { docName } from "@/lib/docLinks";

export async function GET() {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = (await listApplications()) as unknown as Record<string, unknown>[];

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Applications");
  sheet.columns = EXPORT_COLUMNS.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.key === "offer_text" ? 60 : 18,
  }));
  for (const row of rows) {
    const added = sheet.addRow(row);
    for (const key of ["cv_url", "letter_url"]) {
      const url = row[key];
      if (typeof url === "string" && url !== "") {
        const cell = added.getCell(key);
        cell.value = { text: docName(url), hyperlink: url };
        cell.font = { color: { argb: "FF209DD7" }, underline: true };
      }
    }
  }
  sheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="applications-${date}.xlsx"`,
    },
  });
}
```

(Only the `for (const row of rows)` loop body and the `docName` import differ from the previous version.)

- [ ] **Step 2: Typecheck, test, commit**

Run (from `web/`): `npx tsc --noEmit && npm test`
Expected: tsc clean, all tests pass.

```bash
git add web/app/api/assistant/export/xlsx/route.ts
git commit -m "feat: clickable named doc links in Excel export"
```

---

### Task 5: E2E verification + push

**Files:**
- Create (temporary, deleted before finishing): `web/verify-tweaks.mts`

**Interfaces:**
- Consumes: the Task 2 report contract; `DATABASE_URL` and `SKILL_API_TOKEN` in `web/.env.local`.
- Produces: verified deploy — nothing new committed except what Tasks 1–4 already committed; this task ends with `git push`.

- [ ] **Step 1: Write the temporary e2e script**

`web/verify-tweaks.mts`:

```ts
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const [row] = await sql`
  INSERT INTO applications (employer, title, offer_text)
  VALUES ('E2E Test Co', 'Test role', 'old gemini text')
  RETURNING id`;
const id = (row as { id: number }).id;
console.log("inserted test application", id);

const jobMd = "# Test Job\n\nline two of job.md";
const res = await fetch("http://localhost:3000/api/skill/report", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.SKILL_API_TOKEN}`,
  },
  body: JSON.stringify({
    application_id: id,
    archive_path: "archive/2026-07-12_e2e-test",
    cv_url:
      "https://github.com/dajcs/cv/blob/main/archive/2026-07-12_e2e-test/cv_e2e_test.pdf",
    letter_url:
      "https://github.com/dajcs/cv/blob/main/archive/2026-07-12_e2e-test/cover_e2e_test.pdf",
    job_md: jobMd,
  }),
});
console.log("report response", res.status, await res.json());

const [check] = await sql`
  SELECT status, offer_text, cv_url, letter_url FROM applications WHERE id = ${id}`;
console.log(
  "offer_text replaced:",
  (check as { offer_text: string }).offer_text === jobMd,
);
console.log("row after report:", check);

await sql`DELETE FROM applications WHERE id = ${id}`;
console.log("test row deleted");
```

- [ ] **Step 2: Start the dev server**

Run (from `web/`): `pkill -9 -f '[n]ext'; nohup npm run dev > /tmp/next-dev.log 2>&1 &` then poll `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000` until it returns `200` (first compile can take ~30s on /mnt/c). Note the bracketed pkill pattern — a plain `pkill -9 -f next` matches its own invoking shell and kills itself.

- [ ] **Step 3: Run the verification script**

Run (from `web/`): `npx tsx --env-file=.env.local verify-tweaks.mts`
Expected output:
- `report response 200 { ok: true }`
- `offer_text replaced: true`
- `row after report:` shows `status: 'docs_generated'` and both URLs
- `test row deleted`

- [ ] **Step 4: Clean up and push**

```bash
rm web/verify-tweaks.mts
pkill -9 -f '[n]ext'
git push
```

Expected: push succeeds; Vercel redeploys. (The deployed app stays working throughout — no schema change.)

---

### Task 6: cv repo — `/apply` skill sends `job_md`

**Files:**
- Modify: `/mnt/c/Users/dajcs/code/cv/.claude/skills/apply/SKILL.md` (separate git repo at `/mnt/c/Users/dajcs/code/cv`)

**Interfaces:**
- Consumes: the Task 2 report contract (five required fields).
- Produces: updated skill instructions; committed and pushed in the cv repo.

- [ ] **Step 1: Replace the "### 5. Report back to the assistant" section**

In `/mnt/c/Users/dajcs/code/cv/.claude/skills/apply/SKILL.md`, replace the entire `### 5. Report back to the assistant` section (from the heading to the end of the file) with:

````markdown
### 5. Report back to the assistant

Replace `<ID>`, `<iso_date>` and `<target>` with the real values. The URLs point at
the PDFs pushed to GitHub in step 4; `job_md` is the job description saved as `job.md`:

```bash
cd archive/<iso_date>_<target>
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

All five fields are required. Confirm the response is `{"ok":true}` and tell the user
the application is now marked "Docs generated" in the assistant, with named CV and
cover links in the Docs column and the job offer text refreshed from `job.md`.
````

(The `cd` matters: `open('job.md')` reads from the archive directory.)

- [ ] **Step 2: Commit and push in the cv repo**

```bash
git -C /mnt/c/Users/dajcs/code/cv add .claude/skills/apply/SKILL.md
git -C /mnt/c/Users/dajcs/code/cv commit -m "apply skill: send job_md (job.md content) in the report"
git -C /mnt/c/Users/dajcs/code/cv push
```

Expected: push to `github.com/dajcs/cv` succeeds.
