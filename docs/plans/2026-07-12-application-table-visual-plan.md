# Applications Table Visual Tweaks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Widen the assistant pages to 1280px, move Notes to the last data column (web + exports), stack the two Docs links vertically, and give Employer/Position minimum widths so long titles wrap in 2–3 lines.

**Architecture:** Pure presentation changes — one Tailwind class in the shared layout, column reordering and class tweaks in the table component, and a reordered export column list. No DB, route, type, or cv-repo changes. Spec: `docs/specs/2026-07-12-application-table-visual.md`.

**Tech Stack:** Next.js 16 (App Router), Tailwind v4, vitest 4.

## Global Constraints

- Keep it simple — no over-engineering, no extra features (project CLAUDE.md).
- npm/npx commands run from `web/`; git commits from the repo root.
- Do NOT run `npm run build` (too slow on this /mnt/c checkout) — verify with `npx tsc --noEmit` + `npm test`; Vercel does the real build. If tsc errors ONLY inside `.next/dev/types/`, run `rm -rf web/.next/dev` and re-run.
- No schema change — do NOT run `npm run db:init`.
- Exact values: layout `max-w-7xl`; Employer cell `min-w-40`; Position cell `min-w-56`; web column order ID, Date, Employer, Position, Ref, Status, Docs, Notes, ✕(delete); export order ends … Status, CV link, Cover letter link, Notes.
- Commit messages end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Visual tweaks — layout width, column order, stacked links, min widths

**Files:**
- Modify: `web/app/assistant/layout.tsx:37` (the `<main>` class)
- Modify: `web/app/assistant/components/ApplicationsTable.tsx` (header row, body row)
- Modify: `web/lib/exportColumns.ts` (order only)

**Interfaces:**
- Consumes: existing `Application` fields and `docName(url)` — unchanged.
- Produces: nothing new — same components and constants, different presentation/order. CSV and Excel routes pick up the `EXPORT_COLUMNS` order automatically.

- [ ] **Step 1: Widen the layout container**

In `web/app/assistant/layout.tsx`, replace:

```tsx
      <main className="mx-auto max-w-5xl p-4">{children}</main>
```

with:

```tsx
      <main className="mx-auto max-w-7xl p-4">{children}</main>
```

- [ ] **Step 2: Reorder the header row**

In `web/app/assistant/components/ApplicationsTable.tsx`, replace:

```tsx
          <tr>
            <th className="p-2">ID</th>
            <th className="p-2">Date</th>
            <th className="p-2">Employer</th>
            <th className="p-2">Position</th>
            <th className="p-2">Ref</th>
            <th className="p-2">Status</th>
            <th className="p-2">Notes</th>
            <th className="p-2">Docs</th>
            <th className="p-2"></th>
          </tr>
```

with:

```tsx
          <tr>
            <th className="p-2">ID</th>
            <th className="p-2">Date</th>
            <th className="p-2">Employer</th>
            <th className="p-2">Position</th>
            <th className="p-2">Ref</th>
            <th className="p-2">Status</th>
            <th className="p-2">Docs</th>
            <th className="p-2">Notes</th>
            <th className="p-2"></th>
          </tr>
```

- [ ] **Step 3: Widen Employer and Position cells**

In the body row, replace:

```tsx
              <td className="p-2">{a.employer}</td>
              <td className="p-2">
                {a.link ? (
```

with:

```tsx
              <td className="min-w-40 p-2">{a.employer}</td>
              <td className="min-w-56 p-2">
                {a.link ? (
```

- [ ] **Step 4: Move the Notes cell after the Docs cell and stack the links**

Replace (the Notes `<td>`, the Docs `<td>`, in their current order):

```tsx
              <td className="p-2">
                <NotesCell id={a.id} notes={a.notes} onSave={patch} />
              </td>
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

with (Docs first with `block` links, Notes second):

```tsx
              <td className="whitespace-nowrap p-2">
                {a.cv_url && (
                  <a
                    href={a.cv_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-purple hover:underline"
                  >
                    {docName(a.cv_url)}
                  </a>
                )}
                {a.letter_url && (
                  <a
                    href={a.letter_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-purple hover:underline"
                  >
                    {docName(a.letter_url)}
                  </a>
                )}
              </td>
              <td className="p-2">
                <NotesCell id={a.id} notes={a.notes} onSave={patch} />
              </td>
```

- [ ] **Step 5: Reorder the export columns**

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
  { key: "cv_url", header: "CV link" },
  { key: "letter_url", header: "Cover letter link" },
  { key: "notes", header: "Notes" },
];
```

- [ ] **Step 6: Typecheck and test**

Run (from `web/`): `npx tsc --noEmit && npm test`
Expected: tsc clean; all tests pass (the export routes and xlsx hyperlink loop key off column `key`s, not positions, so reordering breaks nothing).

- [ ] **Step 7: Commit and push**

```bash
git add web/app/assistant/layout.tsx web/app/assistant/components/ApplicationsTable.tsx web/lib/exportColumns.ts
git commit -m "feat: wider assistant layout, Notes last, stacked doc links"
git push
```

Expected: push succeeds; Vercel redeploys. Visual confirmation is the owner's (Google-auth page) on the deployed site.
