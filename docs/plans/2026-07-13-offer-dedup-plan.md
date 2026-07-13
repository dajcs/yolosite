# Offer Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect incoming job offers that were already applied to, dismissed, or are already listed — skip inserting them and report their history instead (spec: `docs/specs/2026-07-13-offer-dedup.md`).

**Architecture:** No new table. `offers` (dismissed rows kept forever) + `applications` are the ledger; one new `dismissed_at` column supplies the dismissal date. Pure matching logic lives in a new `web/lib/dedup.ts` (unit-tested, no DB); `findDuplicate()` in `web/lib/offers.ts` runs two SQL lookups and delegates to the pure `pickDuplicate()`. The email-pull route and the manual-add route call `findDuplicate` before `createOffer`.

**Tech Stack:** Next.js 16 route handlers, `@neondatabase/serverless` tagged-template SQL, vitest, React 19 client components, Tailwind v4.

## Global Constraints

- Keep it simple — no over-engineering, no defensive programming (CLAUDE.md).
- All commands run from `web/`: `npm test` (vitest), `npm run db:init` (applies `lib/schema.sql` to Neon; splits the file on `;`).
- Stored links are canonical: `cleanUrl()` from `web/lib/fetchPosting.ts` is applied at every insert; comparisons are plain SQL string equality.
- Employer+ref matching only when the candidate has a non-empty `ref_id` (owner decision).
- Duplicates are **skipped, never inserted** (except manual add with `force: true`).

---

### Task 1: Schema — `dismissed_at` column, set on dismiss

**Files:**
- Modify: `web/lib/schema.sql` (append at end)
- Modify: `web/lib/offers.ts:34-36` (`dismissOffer`)

**Interfaces:**
- Produces: `offers.dismissed_at timestamptz` column, populated for all dismissed rows (backfilled with `created_at`) and by every future `dismissOffer()` call (which `applyToOffer()` also uses).

- [ ] **Step 1: Append migration statements to `web/lib/schema.sql`**

The file currently ends with `ALTER TABLE applications DROP COLUMN IF EXISTS zip_base64` (no trailing `;`). Add `;` after it, then append:

```sql
ALTER TABLE offers ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

UPDATE offers SET dismissed_at = created_at
  WHERE dismissed = true AND dismissed_at IS NULL
```

(The init script splits on `;` and skips empties, so the last statement needs no trailing semicolon.)

- [ ] **Step 2: Apply to Neon**

Run: `cd web && npm run db:init`
Expected: `OK: …` line per statement (including the two new ones), then `Schema applied.`

- [ ] **Step 3: Set `dismissed_at` in `dismissOffer`**

In `web/lib/offers.ts` replace:

```ts
export async function dismissOffer(id: number): Promise<void> {
  await db()`UPDATE offers SET dismissed = true WHERE id = ${id}`;
}
```

with:

```ts
export async function dismissOffer(id: number): Promise<void> {
  await db()`UPDATE offers SET dismissed = true, dismissed_at = now() WHERE id = ${id}`;
}
```

- [ ] **Step 4: Regression check**

Run: `cd web && npm test`
Expected: all existing tests PASS (nothing touches this path yet).

- [ ] **Step 5: Commit**

```bash
git add web/lib/schema.sql web/lib/offers.ts
git commit -m "feat: add offers.dismissed_at, set on dismiss"
```

---

### Task 2: Pure dedup logic — `web/lib/dedup.ts` (TDD)

**Files:**
- Modify: `web/lib/types.ts` (append `DuplicateMatch`)
- Create: `web/lib/dedup.ts`
- Test: `web/lib/__tests__/dedup.test.ts`

**Interfaces:**
- Consumes: `cleanUrl(url: string): string` from `web/lib/fetchPosting.ts`.
- Produces (used by Tasks 3–5):
  - `type DuplicateMatch = { status: "applied" | "dismissed" | "active"; date: string | null; employer: string | null; title: string | null; ref_id: string | null; link: string | null }` (in `types.ts` — client-safe, the AddOffer component reads `match.link`)
  - `type Candidate = { link?: string | null; employer?: string | null; ref_id?: string | null }`
  - `type CandidateKey = { link: string | null; ref: string | null; employer: string | null }`
  - `type AppRow = { employer: string | null; title: string | null; ref_id: string | null; link: string | null; date: string }`
  - `type OfferRow = { employer: string | null; title: string | null; ref_id: string | null; link: string | null; dismissed: boolean; dismissed_date: string | null }`
  - `candidateKey(c: Candidate): CandidateKey | null` — null when there is neither link nor ref_id (candidate can never be a duplicate)
  - `employerMatches(a?: string | null, b?: string | null): boolean`
  - `pickDuplicate(key: CandidateKey, apps: AppRow[], offers: OfferRow[]): DuplicateMatch | null`
  - `formatDuplicate(m: DuplicateMatch): string`

- [ ] **Step 1: Add `DuplicateMatch` to `web/lib/types.ts`**

Append:

```ts
export type DuplicateMatch = {
  status: "applied" | "dismissed" | "active";
  date: string | null;
  employer: string | null;
  title: string | null;
  ref_id: string | null;
  link: string | null;
};
```

- [ ] **Step 2: Write the failing tests**

Create `web/lib/__tests__/dedup.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  candidateKey,
  employerMatches,
  pickDuplicate,
  formatDuplicate,
  type AppRow,
  type OfferRow,
} from "../dedup";

describe("employerMatches", () => {
  it("matches case-insensitively", () => {
    expect(employerMatches("Amazon", "amazon")).toBe(true);
  });
  it("matches when one name contains the other", () => {
    expect(employerMatches("Amazon", "Amazon Web Services")).toBe(true);
    expect(employerMatches("Amazon Web Services", "amazon")).toBe(true);
  });
  it("rejects different employers", () => {
    expect(employerMatches("Amazon", "Google")).toBe(false);
  });
  it("is conservative on missing names", () => {
    expect(employerMatches(null, "Amazon")).toBe(false);
    expect(employerMatches("Amazon", "")).toBe(false);
    expect(employerMatches(null, null)).toBe(false);
  });
});

describe("candidateKey", () => {
  it("cleans the link", () => {
    const key = candidateKey({
      link: "https://www.linkedin.com/comm/jobs/view/123/?trackingId=x&trk=eml",
    });
    expect(key?.link).toBe("https://www.linkedin.com/jobs/view/123");
  });
  it("returns null when there is neither link nor ref_id", () => {
    expect(candidateKey({ employer: "Acme" })).toBeNull();
    expect(candidateKey({ ref_id: "  " })).toBeNull();
  });
  it("trims ref and employer", () => {
    const key = candidateKey({ ref_id: " R-1 ", employer: " Acme " });
    expect(key).toEqual({ link: null, ref: "R-1", employer: "Acme" });
  });
});

const row = {
  employer: "Acme",
  title: "Engineer",
  ref_id: "R-1",
  link: "https://acme.com/jobs/1",
};
const appRow: AppRow = { ...row, date: "2026-06-01" };
const dismissedRow: OfferRow = {
  ...row,
  dismissed: true,
  dismissed_date: "2026-06-02",
};
const activeRow: OfferRow = { ...row, dismissed: false, dismissed_date: null };

describe("pickDuplicate", () => {
  const byLink = candidateKey({ link: "https://acme.com/jobs/1" })!;
  const byRef = candidateKey({ ref_id: "r-1", employer: "ACME Corp" })!;

  it("matches by link regardless of employer/ref", () => {
    expect(pickDuplicate(byLink, [], [activeRow])?.status).toBe("active");
  });
  it("matches by ref + fuzzy employer when links differ", () => {
    expect(pickDuplicate(byRef, [], [dismissedRow])?.status).toBe("dismissed");
  });
  it("rejects ref match when employers differ", () => {
    const key = candidateKey({ ref_id: "R-1", employer: "Google" })!;
    expect(pickDuplicate(key, [], [dismissedRow])).toBeNull();
  });
  it("rejects ref match when candidate employer is missing", () => {
    const key = candidateKey({ ref_id: "R-1" })!;
    expect(pickDuplicate(key, [], [dismissedRow])).toBeNull();
  });
  it("prefers applied over dismissed over active", () => {
    const applied = pickDuplicate(byLink, [appRow], [dismissedRow, activeRow]);
    expect(applied?.status).toBe("applied");
    expect(applied?.date).toBe("2026-06-01");
    const dismissed = pickDuplicate(byLink, [], [activeRow, dismissedRow]);
    expect(dismissed?.status).toBe("dismissed");
    expect(dismissed?.date).toBe("2026-06-02");
  });
  it("returns null when nothing matches", () => {
    const key = candidateKey({ link: "https://other.com/j/9" })!;
    expect(pickDuplicate(key, [appRow], [dismissedRow, activeRow])).toBeNull();
  });
});

describe("formatDuplicate", () => {
  it("formats applied / dismissed / active", () => {
    expect(
      formatDuplicate({ ...row, status: "applied", date: "2026-06-01" }),
    ).toBe("Acme — Engineer (R-1) — APPLIED on 2026-06-01");
    expect(
      formatDuplicate({ ...row, status: "dismissed", date: "2026-06-02" }),
    ).toBe("Acme — Engineer (R-1) — DISMISSED on 2026-06-02");
    expect(formatDuplicate({ ...row, status: "active", date: null })).toBe(
      "Acme — Engineer (R-1) — ALREADY IN OFFERS",
    );
  });
  it("handles missing fields", () => {
    expect(
      formatDuplicate({
        status: "active",
        date: null,
        employer: null,
        title: "Engineer",
        ref_id: null,
        link: null,
      }),
    ).toBe("Engineer — ALREADY IN OFFERS");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd web && npx vitest run lib/__tests__/dedup.test.ts`
Expected: FAIL — `Cannot find module '../dedup'` (or equivalent resolve error).

- [ ] **Step 4: Implement `web/lib/dedup.ts`**

```ts
import { cleanUrl } from "./fetchPosting";
import type { DuplicateMatch } from "./types";

export type Candidate = {
  link?: string | null;
  employer?: string | null;
  ref_id?: string | null;
};

export type CandidateKey = {
  link: string | null;
  ref: string | null;
  employer: string | null;
};

export type AppRow = {
  employer: string | null;
  title: string | null;
  ref_id: string | null;
  link: string | null;
  date: string;
};

export type OfferRow = {
  employer: string | null;
  title: string | null;
  ref_id: string | null;
  link: string | null;
  dismissed: boolean;
  dismissed_date: string | null;
};

// Null when the candidate has nothing to match on (no link, no ref).
export function candidateKey(c: Candidate): CandidateKey | null {
  const link = c.link?.trim() ? cleanUrl(c.link.trim()) : null;
  const ref = c.ref_id?.trim() || null;
  if (!link && !ref) return null;
  return { link, ref, employer: c.employer?.trim() || null };
}

// Fuzzy: case-insensitive, one name contains the other. Missing names never match.
export function employerMatches(
  a?: string | null,
  b?: string | null,
): boolean {
  const x = a?.trim().toLowerCase();
  const y = b?.trim().toLowerCase();
  if (!x || !y) return false;
  return x.includes(y) || y.includes(x);
}

function rowMatches(
  key: CandidateKey,
  row: { link: string | null; ref_id: string | null; employer: string | null },
): boolean {
  if (key.link && row.link === key.link) return true;
  if (key.ref && row.ref_id?.trim().toLowerCase() === key.ref.toLowerCase()) {
    return employerMatches(key.employer, row.employer);
  }
  return false;
}

// Precedence: applied > dismissed > still-active offer.
export function pickDuplicate(
  key: CandidateKey,
  apps: AppRow[],
  offers: OfferRow[],
): DuplicateMatch | null {
  const app = apps.find((r) => rowMatches(key, r));
  if (app) {
    return {
      status: "applied",
      date: app.date,
      employer: app.employer,
      title: app.title,
      ref_id: app.ref_id,
      link: app.link,
    };
  }
  const matched = offers.filter((r) => rowMatches(key, r));
  const hit = matched.find((r) => r.dismissed) ?? matched[0];
  if (!hit) return null;
  return {
    status: hit.dismissed ? "dismissed" : "active",
    date: hit.dismissed ? hit.dismissed_date : null,
    employer: hit.employer,
    title: hit.title,
    ref_id: hit.ref_id,
    link: hit.link,
  };
}

export function formatDuplicate(m: DuplicateMatch): string {
  const name =
    [m.employer, m.title].filter(Boolean).join(" — ") || "(unknown)";
  const ref = m.ref_id ? ` (${m.ref_id})` : "";
  const history =
    m.status === "applied"
      ? `APPLIED on ${m.date}`
      : m.status === "dismissed"
        ? `DISMISSED on ${m.date ?? "unknown date"}`
        : "ALREADY IN OFFERS";
  return `${name}${ref} — ${history}`;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd web && npx vitest run lib/__tests__/dedup.test.ts`
Expected: all PASS.

- [ ] **Step 6: Full test run and commit**

Run: `cd web && npm test` — all PASS.

```bash
git add web/lib/types.ts web/lib/dedup.ts web/lib/__tests__/dedup.test.ts
git commit -m "feat: pure offer-dedup matching logic"
```

---

### Task 3: `findDuplicate` query + canonical application links

**Files:**
- Modify: `web/lib/offers.ts` (add `findDuplicate`)
- Modify: `web/lib/applications.ts` (clean `link` in `createApplication`)

**Interfaces:**
- Consumes: `candidateKey`, `pickDuplicate`, `AppRow`, `OfferRow`, `Candidate` from `web/lib/dedup.ts` (Task 2).
- Produces: `findDuplicate(c: Candidate): Promise<DuplicateMatch | null>` exported from `web/lib/offers.ts` — used by both routes in Tasks 4–5.

- [ ] **Step 1: Add `findDuplicate` to `web/lib/offers.ts`**

Add imports at the top:

```ts
import {
  candidateKey,
  pickDuplicate,
  type Candidate,
  type AppRow,
  type OfferRow,
} from "./dedup";
import type { DuplicateMatch } from "./types";
```

Add the function (after `listOffers`):

```ts
// SQL narrows by link/ref equality (NULL params match nothing); the exact
// match rules and precedence live in pickDuplicate.
export async function findDuplicate(
  c: Candidate,
): Promise<DuplicateMatch | null> {
  const key = candidateKey(c);
  if (!key) return null;
  const apps = await db()`
    SELECT employer, title, ref_id, link, to_char(date, 'YYYY-MM-DD') AS date
    FROM applications
    WHERE link = ${key.link} OR lower(ref_id) = lower(${key.ref})`;
  const offers = await db()`
    SELECT employer, title, ref_id, link, dismissed,
           to_char(dismissed_at, 'YYYY-MM-DD') AS dismissed_date
    FROM offers
    WHERE link = ${key.link} OR lower(ref_id) = lower(${key.ref})`;
  return pickDuplicate(
    key,
    apps as unknown as AppRow[],
    offers as unknown as OfferRow[],
  );
}
```

- [ ] **Step 2: Clean links in `createApplication`**

In `web/lib/applications.ts`, add the import:

```ts
import { cleanUrl } from "./fetchPosting";
```

and in `createApplication` change the `link` value in the INSERT from
`${a.link ?? null}` to:

```ts
${a.link ? cleanUrl(a.link) : null}
```

(Offer links are already cleaned at offer insert; this makes skill-created
applications canonical too, so `findDuplicate`'s SQL equality holds everywhere.)

- [ ] **Step 3: Regression check**

Run: `cd web && npm test`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add web/lib/offers.ts web/lib/applications.ts
git commit -m "feat: findDuplicate lookup; canonical application links"
```

---

### Task 4: Email pull skips duplicates and reports them

**Files:**
- Modify: `web/app/api/assistant/emails/[id]/route.ts:98-142` (offer loop + response)
- Modify: `web/app/assistant/components/EmailPanel.tsx:112-127` (`pullOne` result handling)

**Interfaces:**
- Consumes: `findDuplicate` from `web/lib/offers.ts` (Task 3), `formatDuplicate` from `web/lib/dedup.ts` (Task 2).
- Produces: pull response gains `skipped: string[]`; `offersFound` now counts only inserted offers (and `markPulled` stores that count).

- [ ] **Step 1: Update the route**

In `web/app/api/assistant/emails/[id]/route.ts`, extend the offers import and add the dedup import:

```ts
import { createOffer, findDuplicate } from "@/lib/offers";
import { formatDuplicate } from "@/lib/dedup";
```

Replace the offer loop and response (currently `const titles: string[] = [];` down to the final `return NextResponse.json({...})`) with:

```ts
  const titles: string[] = [];
  const skipped: string[] = [];
  for (const offer of extracted) {
    // Check before the posting fetch + refinement: a known link/ref skips
    // the expensive enrichment entirely.
    const early = await findDuplicate(offer);
    if (early) {
      skipped.push(formatDuplicate(early));
      continue;
    }

    let postingText: string | null = null;
    let enriched: ExtractedOffer = offer;

    if (offer.link) {
      postingText = await fetchPostingText(offer.link);
      if (postingText) {
        try {
          const better = await extractOfferFromText(postingText, offer.link);
          if (better) {
            enriched = {
              ...offer,
              ...Object.fromEntries(
                Object.entries(better).filter(([, v]) => v !== null),
              ),
            } as ExtractedOffer;
          }
        } catch (error) {
          // Refinement is best-effort: a rate limit here must not abort the
          // pull (offers may already be inserted; a retry would duplicate them).
          if (!(error instanceof RateLimitedError)) throw error;
        }
      }
    }

    // Enrichment may have filled in a ref_id or canonical link the email lacked.
    const dup = await findDuplicate(enriched);
    if (dup) {
      skipped.push(formatDuplicate(dup));
      continue;
    }

    await createOffer(enriched, {
      source: "email",
      email_ref: `${email.subject} — ${row.date.slice(0, 10)}`,
      // A recruiter email that yields exactly one offer IS the description.
      posting_text:
        postingText ??
        (extracted.length === 1 ? email.body.slice(0, 30_000) : null),
      link: enriched.link,
    });
    titles.push(enriched.title ?? enriched.employer ?? "(untitled)");
  }

  await markPulled(messageId, titles.length);
  const updated = await getEmail(messageId);
  return NextResponse.json({
    offersFound: titles.length,
    titles,
    skipped,
    classification: updated?.classification ?? row.classification,
  });
```

- [ ] **Step 2: Show skipped entries in `EmailPanel`**

In `pullOne` (`web/app/assistant/components/EmailPanel.tsx`), replace the response handling:

```ts
      const { offersFound, titles, skipped, classification } =
        (await res.json()) as {
          offersFound: number;
          titles: string[];
          skipped: string[];
          classification: EmailClassification;
        };
      const parts = [...titles, ...skipped.map((s) => `skipped: ${s}`)];
      setRowStatus(row.message_id, {
        state: "done",
        text: parts.length > 0 ? parts.join(" · ") : "no offers",
      });
```

(The `patchRow` / `router.refresh()` / `return offersFound;` lines below stay unchanged.)

- [ ] **Step 3: Regression check**

Run: `cd web && npm test`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add "web/app/api/assistant/emails/[id]/route.ts" web/app/assistant/components/EmailPanel.tsx
git commit -m "feat: email pull skips and reports duplicate offers"
```

---

### Task 5: Manual add — 409 on duplicate, "Add anyway" escape hatch

**Files:**
- Modify: `web/app/api/assistant/offers/route.ts` (POST)
- Modify: `web/app/assistant/components/AddOffer.tsx`

**Interfaces:**
- Consumes: `findDuplicate` from `web/lib/offers.ts` (Task 3), `formatDuplicate` from `web/lib/dedup.ts` (Task 2), `DuplicateMatch` from `web/lib/types.ts` (Task 2).
- Produces: POST `/api/assistant/offers` returns `409 { error: "duplicate", match: DuplicateMatch, message: string }` unless the body has `force: true`.

- [ ] **Step 1: Update the route**

In `web/app/api/assistant/offers/route.ts`, update imports:

```ts
import { listOffers, createOffer, findDuplicate } from "@/lib/offers";
import { formatDuplicate } from "@/lib/dedup";
import type { DuplicateMatch } from "@/lib/types";
```

Add above `POST`:

```ts
function duplicateResponse(match: DuplicateMatch) {
  return NextResponse.json(
    { error: "duplicate", match, message: formatDuplicate(match) },
    { status: 409 },
  );
}
```

Replace the body parsing in `POST`:

```ts
  const body = (await req.json()) as {
    link?: string;
    text?: string;
    force?: boolean;
  };
  const link = body.link?.trim() || undefined;
  const text = body.text?.trim() || undefined;
  const force = body.force === true;
```

In the `if (text)` branch, before `createOffer`:

```ts
    if (!force) {
      const dup = await findDuplicate({
        link: link ?? offer.link,
        employer: offer.employer,
        ref_id: offer.ref_id,
      });
      if (dup) return duplicateResponse(dup);
    }
```

In the `if (link)` branch, add a cheap link check first (before `fetchPostingText`):

```ts
    if (!force) {
      const dup = await findDuplicate({ link });
      if (dup) return duplicateResponse(dup);
    }
```

and after `extractOfferFromText` succeeds, before `createOffer`:

```ts
    if (!force) {
      const dup = await findDuplicate({
        link,
        employer: offer.employer,
        ref_id: offer.ref_id,
      });
      if (dup) return duplicateResponse(dup);
    }
```

- [ ] **Step 2: Update `AddOffer` with duplicate message + "Add anyway"**

Replace the top of the component and `submit` in
`web/app/assistant/components/AddOffer.tsx`:

```tsx
export default function AddOffer() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [dup, setDup] = useState<{
    message: string;
    link: string | null;
  } | null>(null);

  async function post(force: boolean) {
    setBusy(true);
    setMessage("");
    setDup(null);
    const res = await fetch("/api/assistant/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link, text, force }),
    });
    setBusy(false);
    if (res.status === 409) {
      const { message: dupMessage, match } = (await res.json()) as {
        message: string;
        match: { link: string | null };
      };
      setDup({ message: dupMessage, link: match.link });
      return;
    }
    if (res.status === 422) {
      const { error } = (await res.json()) as { error: string };
      setMessage(
        error === "fetch_failed"
          ? "Couldn't fetch that link (login wall or bot block). Paste the posting text below and submit again."
          : "Couldn't extract offer details. Check the text and try again.",
      );
      return;
    }
    if (!res.ok) {
      setMessage(((await res.json()) as { error?: string }).error ?? "Failed");
      return;
    }
    setLink("");
    setText("");
    setOpen(false);
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await post(false);
  }
```

Replace the `{message && …}` line in the JSX with:

```tsx
      {message && <p className="text-sm text-yellow">{message}</p>}
      {dup && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <p className="text-yellow">
            {dup.link ? (
              <a
                href={dup.link}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {dup.message}
              </a>
            ) : (
              dup.message
            )}
          </p>
          <button
            type="button"
            onClick={() => post(true)}
            disabled={busy}
            className="rounded bg-surface2 px-3 py-1 disabled:opacity-50"
          >
            Add anyway
          </button>
        </div>
      )}
```

- [ ] **Step 3: Regression check**

Run: `cd web && npm test`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/assistant/offers/route.ts web/app/assistant/components/AddOffer.tsx
git commit -m "feat: manual add rejects duplicates with Add-anyway override"
```

---

### Task 6: Docs and end-to-end verification

**Files:**
- Modify: `CLAUDE.md` (the `web/lib/` bullet in the Job Application Assistant section)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Mention `dedup.ts` in CLAUDE.md**

In the `web/lib/` bullet, after `emails.ts\` (queries),` add:

```
`dedup.ts` (duplicate-offer matching: cleaned-link / employer+ref rules),
```

- [ ] **Step 2: Full test run**

Run: `cd web && npm test`
Expected: all PASS.

- [ ] **Step 3: Manual verification (spec §7)**

Start the app (`docker compose up --build` from repo root, or the usual dev setup) and check:

1. Add offer with a link that already exists in `applications` → yellow line
   `… — APPLIED on <date>` appears, offer NOT added.
2. Click **Add anyway** → offer appears in the offers list.
3. Pull an email whose offer matches a dismissed offer → result line shows
   `skipped: … — DISMISSED on <date>`, offers list unchanged.

Report the observed results (screenshots or pasted output) before closing out.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note dedup module in CLAUDE.md"
```
