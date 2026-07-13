# Offer Deduplication — Design Spec

Date: 2026-07-13
Status: approved by owner (brainstormed and decided 2026-07-13)

## 1. Problem

Offers already applied to or dismissed reappear later — reposted on the same
board or surfaced via a different source (email alert vs manual add). They land
in the offers list again and must be recognized and dismissed by hand. The app
should detect these duplicates on arrival and report their history instead of
re-listing them.

## 2. Decisions (all agreed with owner)

| # | Area | Decision |
|---|---|---|
| 1 | Ledger | **No new table.** `offers` (dismissed rows are kept forever) plus `applications` already hold entry date, link, employer, title, ref_id. Only gap: add `dismissed_at` timestamp to `offers`. |
| 2 | Duplicate handling | **Skip + notify.** A detected duplicate is not inserted; the pull result / manual-add response reports its history. |
| 3 | Link match | Cleaned candidate link (`cleanUrl`) equals a stored `offers.link` or `applications.link`. Stored links are already cleaned at insert. |
| 4 | Employer + ref match | Only when the candidate has a `ref_id`: ref matches case-insensitively AND employer matches fuzzily (lowercased, one contains the other — "Amazon" ↔ "Amazon Web Services"). |
| 5 | Escape hatch | Manual add gets an **"Add anyway"** button (`force: true` re-post) so a dismissed role can be reconsidered. Email pull has no force — duplicates are just reported. |

## 3. Schema

Idempotent migration statements appended to `lib/schema.sql`
(`npm run db:init` applies them to Neon):

```sql
ALTER TABLE offers ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

UPDATE offers SET dismissed_at = created_at
  WHERE dismissed = true AND dismissed_at IS NULL;
```

The backfill uses `created_at` as the best available approximation for rows
dismissed before this feature.

`dismissOffer()` sets `dismissed_at = now()` alongside `dismissed = true`
(this covers `applyToOffer()` too, which dismisses via the same function).

## 4. Matching — `findDuplicate` in `lib/offers.ts`

```ts
findDuplicate(candidate: { link?, employer?, ref_id? }): Promise<DuplicateMatch | null>
```

A stored row matches when:

- **Link:** `cleanUrl(candidate.link)` equals `offers.link` or
  `applications.link` (exact string equality in SQL), OR
- **Employer + ref** (only if `candidate.ref_id` is non-empty):
  `lower(ref_id)` equal AND
  (`lower(stored.employer)` contains `lower(candidate.employer)` or vice
  versa). Checked against both tables.

Result precedence when multiple rows match:

1. `applications` row → `status: "applied"`, date = application `date`
2. dismissed offer (no application) → `status: "dismissed"`, date = `dismissed_at`
3. active offer → `status: "active"` (already in offers list), no date

`DuplicateMatch` carries `{ status, date, employer, title, ref_id, link }` —
enough to render a line like
`Luxinnovation — DevOps Engineer (R-2026-123) — DISMISSED on 2026-06-02`.

A candidate with neither link nor ref_id is never treated as a duplicate.

So that all stored links stay canonical and SQL equality suffices,
`createApplication()` also runs its `link` through `cleanUrl()` (today only
offer links are cleaned; skill-created applications store the raw link).

## 5. Entry points

### Email pull — `app/api/assistant/emails/[id]/route.ts` POST

Two-phase check per extracted offer:

1. **Before enrichment:** `findDuplicate` on the raw extracted offer
   (cleaned link + employer/ref). A hit skips the posting fetch and the
   Gemini refinement call entirely.
2. **After enrichment:** `findDuplicate` again on the enriched offer
   (enrichment may fill in a ref_id or canonical link the email lacked).

Skipped offers are formatted server-side and returned in the response:

```json
{ "offersFound": 2, "titles": ["…"], "skipped": ["Employer — Title (ref) — APPLIED on 2026-06-01"] }
```

`offersFound` and `markPulled` count only **inserted** offers.

### Manual add — `app/api/assistant/offers/route.ts` POST

- For a `link` submission: check the cleaned link before fetching/extracting
  (cheap reject). After extraction (both link and text paths), run the full
  check before `createOffer`.
- On duplicate: respond `409` with `{ error: "duplicate", match, message }`.
- `force: true` in the request body bypasses the check and inserts normally.

## 6. UI changes

- **EmailPanel** — the per-email result line appends skipped entries to the
  existing `titles.join(" · ")` text, e.g.
  `DevOps Engineer · skipped: Luxinnovation — Analyst (R-123) — DISMISSED on 2026-06-02`.
- **AddOffer** — on 409, show the duplicate message (position as a link when
  one exists) plus an **"Add anyway"** button that re-submits with
  `force: true`.

## 7. Testing & verification

- Vitest unit tests in `lib/__tests__/` for the pure matching pieces:
  fuzzy employer comparison, candidate normalization (link cleaning before
  compare), and the applied > dismissed > active precedence given mocked rows.
- `npm test` passes.
- Manual verification: re-add a link already in applications → 409 with
  APPLIED message; pull an email containing an already-dismissed offer →
  result line shows the skipped entry; "Add anyway" inserts despite the match.
