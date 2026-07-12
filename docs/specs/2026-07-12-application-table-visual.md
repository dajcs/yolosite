# Applications Table Visual Tweaks — Design Spec

Date: 2026-07-12
Status: approved by owner (round 3, after screenshot review of the deployed table)
Builds on: `docs/specs/2026-07-12-application-table-tweaks.md`.

## 1. Problem

Screenshot review of the live table showed: the Notes column sits mid-table
where it pushes the informative columns apart; the two Docs links side by side
eat width; long position titles wrap into ~7 thin lines because the shared
`/assistant` layout caps the page at 1024px and the Position/Employer columns
get squeezed.

## 2. Decisions (all agreed with owner)

| # | Area | Decision |
|---|---|---|
| 1 | Page width | Shared `/assistant` layout container: `max-w-5xl` → `max-w-7xl` (1024px → 1280px). Applies to the whole private area (offers/emails page included — intentional). |
| 2 | Notes last | Web column order: ID, Date, Employer, Position, Ref, Status, Docs, Notes, ✕(delete). Export column order ends with … Status, CV link, Cover letter link, Notes. |
| 3 | Docs links | Stacked: each link is a `block` element, cv first line, cover below; the `ml-2` spacing is removed. |
| 4 | Column widths | Employer cell `min-w-40` (10rem), Position cell `min-w-56` (14rem) so long titles wrap in 2–3 lines at 1280px. Table layout stays automatic; narrow screens keep the existing `overflow-x-auto` scroll. |

## 3. Changes

- `web/app/assistant/layout.tsx` — `<main className="mx-auto max-w-5xl p-4">`
  → `max-w-7xl`.
- `web/app/assistant/components/ApplicationsTable.tsx` —
  - header row: move `Notes` `<th>` after `Docs`;
  - body row: move the `NotesCell` `<td>` after the Docs cell (delete button
    stays last);
  - Employer `<td>`: add `min-w-40`; Position `<td>`: add `min-w-56`;
  - Docs cell: links get `block` (cv) and `block` (cover, no `ml-2`);
    `whitespace-nowrap` stays on the cell so each name keeps to one line.
- `web/lib/exportColumns.ts` — move `{ key: "notes", header: "Notes" }` to the
  end (after `letter_url`).

No DB, route, type, or cv-repo changes.

## 4. Testing & verification

- `npx tsc --noEmit` + `npm test` (export-order change is data-only; no new
  tests warranted).
- Push to deploy; visual confirmation by the owner on the live site (agent
  cannot pass Google sign-in).
