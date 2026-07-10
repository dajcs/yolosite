# Email Checking Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the v1 check-email flow with a two-phase design: fast header-only email listing with color-coded job/no-job classification, then a one-click client-driven pull loop that extracts offers per email with live progress, using the Gemini API free tier for extraction.

**Architecture:** Phase 1: `POST /api/assistant/emails/list` does a header-only IMAP fetch for a date range and upserts rows into a new `emails` table, predicting each email's classification from its sender's history. Phase 2: the browser loops over green/yellow rows calling `POST /api/assistant/emails/[id]/pull` once per email; each call fetches that one body via IMAP UID, extracts offers with Gemini structured output, fetches postings (direct → Jina Reader fallback), and inserts offers via the existing `createOffer()`. No SSE, no long-running functions — the client loop is the orchestrator and naturally respects Gemini free-tier rate limits.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4, TypeScript strict, `@neondatabase/serverless`, `imapflow` + `mailparser`, `html-to-text`, Google Gemini API (`gemini-2.5-flash`, JSON-schema structured output), Jina Reader (`r.jina.ai`), `vitest`.

**Spec:** `docs/specs/2026-07-10-email-checking-redesign.md` — read it before starting. It supersedes §4.1 of the vision spec and Task 12 of `docs/plans/2026-07-09-job-assistant-implementation.md`; Tasks 13–14 of that plan (skill API, `/apply` skill) remain to be done after this plan.

## Global Constraints

- All `npm`/`npx`/`node` commands run from `web/`. All `git` commands run from the repo root (`/mnt/c/Users/dajcs/code/yolosite`).
- TypeScript strict; no `any`. Follow existing code style.
- No ORM, no client-state library, no new npm dependencies. Simple > clever. No defensive programming beyond what each task shows.
- **Client components (`"use client"`) must never import from `web/lib/db.ts` or any module that imports it.** Shared types/constants live in `web/lib/types.ts` (no imports in that file). Server-only modules (`db.ts`, `email.ts`, `emails.ts`, `extract.ts`, `llm.ts`, `offers.ts`, `state.ts`, `fetchPosting.ts`) are imported only by server components, route handlers, and each other.
- Import convention: app code imports lib modules via `@/lib/...`; lib modules import each other relatively (`./db`); test files import relatively (`../csv`).
- Styling: existing Tailwind tokens (`bg-bg`, `bg-surface`, `bg-surface2`, `text-gray`, `text-blue`, `text-yellow`, `text-purple`, `border-surface2`) plus Tailwind default palette tints for row colors (`bg-green-500/10`, `bg-red-500/10`, `bg-yellow-500/10`). Dark theme, mobile-first.
- Email classification values (exact strings, everywhere): `job`, `no_job`, `unknown`. Color mapping: `job` = green, `no_job` = red, `unknown` = yellow.
- The public site and `/api/chat` (OpenRouter DigitalTwin) are untouched. Offers, applications, exports are untouched.
- Commit after every task with a conventional-commit message ending in the `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer.
- Environment variables (local `web/.env.local`, and Vercel → Project → Settings → Environment Variables):

| Variable | Purpose | Introduced |
|---|---|---|
| `GEMINI_API_KEY` | Gemini API key (aistudio.google.com → Get API key, free) | Task 4 |
| `GEMINI_MODEL` | Optional; defaults to `gemini-2.5-flash` (`gemini-2.5-flash-lite` if the ~250 req/day free cap bites) | Task 4 |
| `JINA_API_KEY` | Optional; raises r.jina.ai rate limits, works without it | Task 7 |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Existing — IMAP read access | already set |
| `OPENROUTER_API_KEY` | Existing — DigitalTwin chat only after this plan | already set |

`EXTRACTION_MODEL` (OpenRouter-era) is retired in Task 4.

## File Structure

```
web/
  lib/
    schema.sql            # modify: + emails table, − processed_emails (Task 3)
    types.ts              # modify: + EMAIL_CLASSIFICATIONS, EmailClassification, EmailRow (Task 3)
    llm.ts                # rewrite: Gemini chatJson(prompt, schema), geminiText(), RateLimitedError (Task 4)
    extract.ts            # modify: Gemini schemas, prompts, null-vs-[] contract (Task 4)
    email.ts              # rewrite: listEmailHeaders(), fetchEmailBody() (Task 5)
    emails.ts             # create: emails-table queries (Task 6)
    fetchPosting.ts       # modify: consent cleanup + Jina fallback (Task 7)
    __tests__/
      llm.test.ts         # modify (Task 4)
      extract.test.ts     # modify (Task 4)
      fetchPosting.test.ts # modify (Task 7)
  app/
    api/assistant/check-email/route.ts        # DELETE (Task 2)
    api/assistant/emails/list/route.ts        # create (Task 8)
    api/assistant/emails/[id]/route.ts        # create (Task 8)
    api/assistant/emails/[id]/pull/route.ts   # create (Task 9)
    assistant/
      page.tsx                                # modify (Tasks 2, 10)
      components/CheckEmailButton.tsx         # DELETE (Task 2)
      components/EmailPanel.tsx               # create (Task 10)
```

`web/lib/state.ts`, `web/lib/offers.ts`, `web/lib/guard.ts`, `web/lib/db.ts` are used as-is.

---

# Stage 1 — Baseline and teardown (Tasks 1–3)

### Task 1: Commit the v1 work-in-progress as a baseline

The working tree holds the uncommitted Task 12 (v1 check-email) implementation. Commit it as-is so the redesign lands as reviewable diffs on top.

**Files:**
- Commit as-is: `.gitignore`, `web/app/assistant/page.tsx`, `web/app/api/assistant/check-email/route.ts`, `web/app/assistant/components/CheckEmailButton.tsx`, `web/lib/email.ts`, `web/lib/state.ts`

- [ ] **Step 1: Verify the tree state**

Run: `git status --short` (from repo root)
Expected: modified `.gitignore` and `web/app/assistant/page.tsx`; untracked `web/app/api/assistant/check-email/`, `web/app/assistant/components/CheckEmailButton.tsx`, `web/lib/email.ts`, `web/lib/state.ts`. If anything else shows up, stop and ask the owner.

- [ ] **Step 2: Verify tests and build still pass**

Run (from `web/`): `npm test` then `npm run build`
Expected: all tests pass; build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git add .gitignore web/app/assistant/page.tsx web/app/api/assistant/check-email web/app/assistant/components/CheckEmailButton.tsx web/lib/email.ts web/lib/state.ts
git commit -m "feat: email check v1 (OpenRouter, 5-email batches) — superseded by redesign

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Retire the v1 check-email flow

Delete the v1 route and button so later tasks can change `extract.ts`/`llm.ts`/`email.ts` signatures without breaking the build.

**Files:**
- Delete: `web/app/api/assistant/check-email/route.ts` (and its now-empty directory)
- Delete: `web/app/assistant/components/CheckEmailButton.tsx`
- Modify: `web/app/assistant/page.tsx`

**Interfaces:**
- Produces: a tree where nothing imports `fetchEmailsSince`, `isProcessed`, `markProcessed`, or `CheckEmailButton`.

- [ ] **Step 1: Delete the route and component**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git rm -r web/app/api/assistant/check-email
git rm web/app/assistant/components/CheckEmailButton.tsx
```

- [ ] **Step 2: Remove the button from the page**

In `web/app/assistant/page.tsx`, remove the import line `import CheckEmailButton from "./components/CheckEmailButton";` and the `<CheckEmailButton />` element (leave `<AddOffer />` in place).

- [ ] **Step 3: Verify build**

Run (from `web/`): `npx tsc --noEmit && npm run build`
Expected: both succeed. (`web/lib/email.ts` still exports the v1 functions; they're merely unused until Task 5 rewrites the file.)

- [ ] **Step 4: Commit**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git add -A web/app
git commit -m "refactor: remove v1 check-email route and button

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `emails` table and shared types

**Files:**
- Modify: `web/lib/schema.sql`
- Modify: `web/lib/types.ts`

**Interfaces:**
- Produces (used by Tasks 6, 8, 9, 10):
  - Table `emails` (columns below); table `processed_emails` dropped.
  - `web/lib/types.ts`: `EMAIL_CLASSIFICATIONS` const array, `EmailClassification`, `EmailRow`. **This file keeps zero imports — safe for client components.**

- [ ] **Step 1: Update the schema**

In `web/lib/schema.sql`: delete the entire `CREATE TABLE IF NOT EXISTS processed_emails (...)` statement, and append (remember: statements separated by `;`, no internal semicolons):

```sql
CREATE TABLE IF NOT EXISTS emails (
  message_id text PRIMARY KEY,
  uid integer,
  date timestamptz,
  from_addr text,
  to_addr text,
  subject text,
  classification text NOT NULL DEFAULT 'unknown',
  manual boolean NOT NULL DEFAULT false,
  pulled_at timestamptz,
  offers_found integer
)
```

- [ ] **Step 2: Apply the schema and drop the old table**

Run (from `web/`):

```bash
npm run db:init
node --env-file=.env.local -e "import('@neondatabase/serverless').then(async ({ neon }) => { await neon(process.env.DATABASE_URL).query('DROP TABLE IF EXISTS processed_emails'); console.log('processed_emails dropped'); })"
```

Expected: `OK: CREATE TABLE IF NOT EXISTS emails ...` among the init lines, then `processed_emails dropped`. Run `npm run db:init` a second time — must succeed identically (idempotent).

- [ ] **Step 3: Add the shared types**

Append to `web/lib/types.ts`:

```ts
export const EMAIL_CLASSIFICATIONS = ["job", "no_job", "unknown"] as const;
export type EmailClassification = (typeof EMAIL_CLASSIFICATIONS)[number];

export type EmailRow = {
  message_id: string;
  uid: number | null;
  date: string; // 'YYYY-MM-DD HH24:MI'
  from_addr: string;
  to_addr: string;
  subject: string;
  classification: EmailClassification;
  manual: boolean;
  pulled: boolean;
  offers_found: number | null;
};
```

- [ ] **Step 4: Verify types**

Run (from `web/`): `npx tsc --noEmit`
Expected: success.

- [ ] **Step 5: Commit**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git add web/lib/schema.sql web/lib/types.ts
git commit -m "feat: emails table and classification types; drop processed_emails

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

# Stage 2 — Gemini extraction (Task 4)

### Task 4: Gemini client and extraction rewrite

> **OWNER SETUP required before Step 8 verification:** get a free API key at https://aistudio.google.com → "Get API key", then add `GEMINI_API_KEY=...` to `web/.env.local` (and later to Vercel env in Task 11). Optionally `GEMINI_MODEL=gemini-2.5-flash-lite`.

`llm.ts` and `extract.ts` change together: `chatJson` gains a required `schema` parameter and `extractOffersFromEmail` gains a `null`-vs-`[]` contract.

**Files:**
- Rewrite: `web/lib/llm.ts`
- Modify: `web/lib/extract.ts`
- Modify: `web/lib/__tests__/llm.test.ts`
- Modify: `web/lib/__tests__/extract.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces (used by Task 9):
  - `llm.ts`: `parseModelJson(text): unknown | null` (unchanged); `geminiText(data: unknown): string` (pure); `chatJson(prompt: string, schema: object): Promise<unknown | null>` — **throws `RateLimitedError` on HTTP 429**, returns `null` on any other failure; `class RateLimitedError extends Error`.
  - `extract.ts`: `normalizeOffer(raw): ExtractedOffer | null` (unchanged); `extractOffersFromEmail(subject, from, body): Promise<ExtractedOffer[] | null>` — `null` = model call failed (caller must NOT mark the email pulled), `[]` = model said "no job offers"; `extractOfferFromText(text, link?): Promise<ExtractedOffer | null>`. Both propagate `RateLimitedError`.

- [ ] **Step 1: Write the failing tests for the Gemini client**

In `web/lib/__tests__/llm.test.ts`, keep the existing `parseModelJson` describe block, change the import line to `import { parseModelJson, geminiText } from "../llm";`, and add:

```ts
describe("geminiText", () => {
  it("extracts and joins candidate part texts", () => {
    expect(
      geminiText({
        candidates: [
          { content: { parts: [{ text: '{"a":' }, { text: " 1}" }] } },
        ],
      }),
    ).toBe('{"a": 1}');
  });

  it("returns empty string for missing candidates or parts", () => {
    expect(geminiText({})).toBe("");
    expect(geminiText({ candidates: [] })).toBe("");
    expect(geminiText({ candidates: [{ content: {} }] })).toBe("");
    expect(geminiText(null)).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `web/`): `npm test`
Expected: FAIL — `geminiText` is not exported.

- [ ] **Step 3: Rewrite the LLM client**

Replace the full contents of `web/lib/llm.ts`:

```ts
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export class RateLimitedError extends Error {}

export function parseModelJson(text: string): unknown | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function geminiText(data: unknown): string {
  const d = data as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  } | null;
  return (
    d?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? ""
  );
}

export async function chatJson(
  prompt: string,
  schema: object,
): Promise<unknown | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  let response: Response;
  try {
    response = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return null;
  }
  if (response.status === 429) throw new RateLimitedError("Gemini rate limit");
  if (!response.ok) return null;

  return parseModelJson(geminiText(await response.json()));
}
```

- [ ] **Step 4: Write the failing tests for the extraction contract**

In `web/lib/__tests__/extract.test.ts`, keep the existing `normalizeOffer` describe block. At the very top of the file (before other imports) add the mock, and add the new describe block:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../llm", () => ({ chatJson: vi.fn() }));

import { chatJson } from "../llm";
import { normalizeOffer, extractOffersFromEmail } from "../extract";

const chatJsonMock = vi.mocked(chatJson);

describe("extractOffersFromEmail", () => {
  beforeEach(() => chatJsonMock.mockReset());

  it("returns null when the model call fails", async () => {
    chatJsonMock.mockResolvedValue(null);
    expect(await extractOffersFromEmail("s", "f", "b")).toBeNull();
  });

  it("returns [] when the model finds no offers", async () => {
    chatJsonMock.mockResolvedValue({ offers: [] });
    expect(await extractOffersFromEmail("s", "f", "b")).toEqual([]);
  });

  it("normalizes offers and drops invalid ones", async () => {
    chatJsonMock.mockResolvedValue({
      offers: [{ title: "Dev", employer: " ESA " }, { location: "junk only" }],
    });
    const offers = await extractOffersFromEmail("s", "f", "b");
    expect(offers).toHaveLength(1);
    expect(offers?.[0]).toMatchObject({ title: "Dev", employer: "ESA" });
  });
});
```

- [ ] **Step 5: Run tests to verify the new ones fail**

Run (from `web/`): `npm test`
Expected: `geminiText` tests now pass; two of the three `extractOffersFromEmail` tests FAIL — the current implementation returns `[]` (not `null`) when the model call fails, and the mocked `chatJson` returns `undefined` for the normalization test. Only the `[]`-for-no-offers test may pass by coincidence.

- [ ] **Step 6: Update the extraction module**

Replace the full contents of `web/lib/extract.ts`:

```ts
import { chatJson } from "./llm";
import type { ExtractedOffer } from "./types";

const FIELDS = [
  "employer",
  "title",
  "location",
  "ref_id",
  "deadline",
  "requirements",
  "link",
] as const;

export function normalizeOffer(raw: unknown): ExtractedOffer | null {
  if (typeof raw !== "object" || raw === null) return null;
  const source = raw as Record<string, unknown>;
  const offer = {} as Record<(typeof FIELDS)[number], string | null>;
  for (const field of FIELDS) {
    const value = source[field];
    offer[field] =
      typeof value === "string" && value.trim() !== "" ? value.trim() : null;
  }
  return offer.title || offer.employer ? offer : null;
}

// Gemini structured-output schema (OpenAPI-style subset, uppercase types).
const OFFER_SCHEMA = {
  type: "OBJECT",
  properties: {
    employer: { type: "STRING", nullable: true },
    title: { type: "STRING", nullable: true },
    location: { type: "STRING", nullable: true },
    ref_id: { type: "STRING", nullable: true },
    deadline: { type: "STRING", nullable: true },
    requirements: { type: "STRING", nullable: true },
    link: { type: "STRING", nullable: true },
  },
};

const OFFERS_SCHEMA = {
  type: "OBJECT",
  properties: { offers: { type: "ARRAY", items: OFFER_SCHEMA } },
  required: ["offers"],
};

export async function extractOffersFromEmail(
  subject: string,
  from: string,
  body: string,
): Promise<ExtractedOffer[] | null> {
  const prompt = `Below is an email. If it is job-related (a job-board alert digest with one or more listings, or a recruiter describing a position), extract every distinct job offer it contains. If it is not job-related (newsletter, receipt, personal mail, spam), return an empty offers array.

For each offer: employer (company name), title (position title), location (city/country), ref_id (job reference id), deadline (application deadline), requirements (2-4 sentence summary of the key requirements), link (direct URL to the job posting). Use null for anything not present.

Email subject: ${subject}
Email from: ${from}
Email body:
${body.slice(0, 15000)}`;

  const parsed = await chatJson(prompt, OFFERS_SCHEMA);
  if (parsed === null) return null;
  const offers = (parsed as { offers?: unknown[] }).offers;
  if (!Array.isArray(offers)) return null;
  return offers
    .map(normalizeOffer)
    .filter((o): o is ExtractedOffer => o !== null);
}

export async function extractOfferFromText(
  text: string,
  link?: string,
): Promise<ExtractedOffer | null> {
  const prompt = `Below is the text of a job posting. Extract its key characteristics: employer (company name), title (position title), location (city/country), ref_id (job reference id), deadline (application deadline), requirements (2-4 sentence summary of the key requirements), link (direct URL to the job posting). Use null for anything not present.

${link ? `Posting URL: ${link}\n` : ""}Posting text:
${text.slice(0, 15000)}`;

  const offer = normalizeOffer(await chatJson(prompt, OFFER_SCHEMA));
  if (offer && link && !offer.link) offer.link = link;
  return offer;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run (from `web/`): `npm test`
Expected: all pass (including the untouched `normalizeOffer`, `parseModelJson`, `toCsv`, `htmlToPostingText` suites).

- [ ] **Step 8: Sanity-check the real Gemini API (needs `GEMINI_API_KEY`)**

Run (from `web/`, single line):

```bash
node --env-file=.env.local -e "fetch('https://generativelanguage.googleapis.com/v1beta/models/' + (process.env.GEMINI_MODEL ?? 'gemini-2.5-flash') + ':generateContent', { method: 'POST', headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: 'Return the employer for: Acme Corp is hiring a Baker in Paris.' }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { employer: { type: 'STRING', nullable: true } } } } }) }).then(r => r.json()).then(d => console.log(JSON.stringify(d.candidates?.[0]?.content?.parts)))"
```

Expected: something like `[{"text":"{\"employer\": \"Acme Corp\"}"}]`. If the API rejects `responseSchema` (400 naming that field), check the error message and adjust the schema casing (`"object"`/`"string"` lowercase) in both `extract.ts` and this check — then re-run `npm test`.

- [ ] **Step 9: Commit**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git add web/lib/llm.ts web/lib/extract.ts web/lib/__tests__/llm.test.ts web/lib/__tests__/extract.test.ts
git commit -m "feat: Gemini structured-output extraction replaces OpenRouter

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

# Stage 3 — IMAP and email rows (Tasks 5–6)

### Task 5: IMAP rewrite — header listing and single-body fetch

**Files:**
- Rewrite: `web/lib/email.ts`

**Interfaces:**
- Consumes: `htmlToPostingText` from `./fetchPosting` (unchanged signature).
- Produces (used by Tasks 6, 8, 9):
  - `EmailHeader` type: `{ messageId: string; uid: number; date: Date; from: string; to: string; subject: string }`.
  - `listEmailHeaders(start: Date, end: Date): Promise<EmailHeader[]>` — header-only (no bodies), whole range in one connection.
  - `fetchEmailBody(uid: number): Promise<{ subject: string; from: string; body: string } | null>` — one full message by IMAP UID; `null` if the UID no longer exists.
- Deletes: `fetchEmailsSince`, `isProcessed`, `markProcessed`, `InboxEmail` (nothing imports them since Task 2).

- [ ] **Step 1: Rewrite the module**

Replace the full contents of `web/lib/email.ts`:

```ts
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { htmlToPostingText } from "./fetchPosting";

export type EmailHeader = {
  messageId: string;
  uid: number;
  date: Date;
  from: string;
  to: string;
  subject: string;
};

function imapClient(): ImapFlow {
  return new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER!,
      pass: process.env.GMAIL_APP_PASSWORD!,
    },
    logger: false,
  });
}

function addressList(
  entries: { address?: string; name?: string }[] | undefined,
): string {
  return (entries ?? []).map((a) => a.address ?? a.name ?? "").join(", ");
}

export async function listEmailHeaders(
  start: Date,
  end: Date,
): Promise<EmailHeader[]> {
  const client = imapClient();
  await client.connect();
  const headers: EmailHeader[] = [];
  const lock = await client.getMailboxLock("INBOX");
  try {
    // IMAP date search is day-granular and BEFORE is exclusive.
    const before = new Date(end);
    before.setDate(before.getDate() + 1);
    const uids = await client.search({ since: start, before }, { uid: true });
    if (uids && uids.length > 0) {
      for await (const msg of client.fetch(
        uids,
        { envelope: true, uid: true },
        { uid: true },
      )) {
        const env = msg.envelope;
        if (!env) continue;
        headers.push({
          messageId: env.messageId ?? `uid-${msg.uid}`,
          uid: msg.uid,
          date: env.date ?? new Date(),
          from: addressList(env.from),
          to: addressList(env.to),
          subject: env.subject ?? "(no subject)",
        });
      }
    }
  } finally {
    lock.release();
  }
  await client.logout();
  return headers;
}

export async function fetchEmailBody(
  uid: number,
): Promise<{ subject: string; from: string; body: string } | null> {
  const client = imapClient();
  await client.connect();
  let result: { subject: string; from: string; body: string } | null = null;
  const lock = await client.getMailboxLock("INBOX");
  try {
    const msg = await client.fetchOne(
      String(uid),
      { source: true },
      { uid: true },
    );
    if (msg && msg.source) {
      const parsed = await simpleParser(msg.source);
      result = {
        subject: parsed.subject ?? "(no subject)",
        from: parsed.from?.text ?? "",
        body:
          parsed.text?.trim() ||
          (parsed.html ? htmlToPostingText(parsed.html) : ""),
      };
    }
  } finally {
    lock.release();
  }
  await client.logout();
  return result;
}
```

- [ ] **Step 2: Verify types and build**

Run (from `web/`): `npx tsc --noEmit && npm run build`
Expected: both succeed. (If `client.fetchOne` types complain about the return union, note it returns `false | FetchMessageObject` — the `if (msg && msg.source)` guard handles it.)

- [ ] **Step 3: Runtime smoke test against real Gmail (optional but recommended)**

Run (from `web/`):

```bash
cat > smoke-imap.ts <<'EOF'
import { listEmailHeaders } from "./lib/email";

const end = new Date();
const start = new Date(Date.now() - 3 * 86400_000);
const headers = await listEmailHeaders(start, end);
console.log(headers.length, "headers");
console.log(headers.slice(0, 3));
process.exit(0);
EOF
npx tsx --env-file=.env.local smoke-imap.ts
rm smoke-imap.ts
```

(`npx tsx` runs one-off without adding a dependency; if it fails to install, delete the file and skip — the browser test in Task 10 covers this path.)
Expected: a count plus the first three headers with `messageId`, `uid`, `date`, `from`, `to`, `subject` populated, returned in a few seconds even when the range holds many emails.

- [ ] **Step 4: Commit**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git add web/lib/email.ts
git commit -m "feat: header-only IMAP listing and single-body fetch by UID

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Email-row queries

**Files:**
- Create: `web/lib/emails.ts`

**Interfaces:**
- Consumes: `db()` from `./db`; `EmailHeader` from `./email`; `EmailRow`, `EmailClassification`, `EMAIL_CLASSIFICATIONS` from `./types`.
- Produces (used by Tasks 8, 9):
  - `upsertEmails(headers: EmailHeader[]): Promise<void>` — inserts new rows with sender-predicted classification; on conflict refreshes header fields only (never `classification`/`manual`/`pulled_at`).
  - `listEmails(start: Date, end: Date): Promise<EmailRow[]>` — newest first.
  - `getEmail(messageId: string): Promise<EmailRow | null>`.
  - `setClassification(messageId: string, classification: string): Promise<boolean>` — `false` on invalid value; sets `manual = true`.
  - `markPulled(messageId: string, offersFound: number): Promise<void>` — sets `pulled_at`/`offers_found`; auto-classifies `job`/`no_job` unless `manual`.

- [ ] **Step 1: Write the module**

Create `web/lib/emails.ts`:

```ts
import { db } from "./db";
import type { EmailHeader } from "./email";
import {
  EMAIL_CLASSIFICATIONS,
  type EmailClassification,
  type EmailRow,
} from "./types";

const COLUMNS = `message_id, uid, to_char(date, 'YYYY-MM-DD HH24:MI') AS date,
  from_addr, to_addr, subject, classification, manual,
  (pulled_at IS NOT NULL) AS pulled, offers_found`;

export async function upsertEmails(headers: EmailHeader[]): Promise<void> {
  for (const h of headers) {
    // Predict from the sender's most recent classified email.
    const prior = await db()`
      SELECT classification FROM emails
      WHERE from_addr = ${h.from} AND classification <> 'unknown'
      ORDER BY date DESC LIMIT 1`;
    const predicted = prior.length
      ? (prior[0] as { classification: string }).classification
      : "unknown";
    await db()`
      INSERT INTO emails (message_id, uid, date, from_addr, to_addr, subject, classification)
      VALUES (${h.messageId}, ${h.uid}, ${h.date}, ${h.from}, ${h.to}, ${h.subject}, ${predicted})
      ON CONFLICT (message_id) DO UPDATE
        SET uid = EXCLUDED.uid, date = EXCLUDED.date, from_addr = EXCLUDED.from_addr,
            to_addr = EXCLUDED.to_addr, subject = EXCLUDED.subject`;
  }
}

export async function listEmails(start: Date, end: Date): Promise<EmailRow[]> {
  const endExclusive = new Date(end);
  endExclusive.setDate(endExclusive.getDate() + 1);
  const rows = await db().query(
    `SELECT ${COLUMNS} FROM emails WHERE date >= $1 AND date < $2 ORDER BY date DESC`,
    [start, endExclusive],
  );
  return rows as unknown as EmailRow[];
}

export async function getEmail(messageId: string): Promise<EmailRow | null> {
  const rows = await db().query(
    `SELECT ${COLUMNS} FROM emails WHERE message_id = $1`,
    [messageId],
  );
  return rows.length ? (rows as unknown as EmailRow[])[0] : null;
}

export async function setClassification(
  messageId: string,
  classification: string,
): Promise<boolean> {
  if (!EMAIL_CLASSIFICATIONS.includes(classification as EmailClassification)) {
    return false;
  }
  await db()`
    UPDATE emails SET classification = ${classification}, manual = true
    WHERE message_id = ${messageId}`;
  return true;
}

export async function markPulled(
  messageId: string,
  offersFound: number,
): Promise<void> {
  await db()`
    UPDATE emails
    SET pulled_at = now(), offers_found = ${offersFound},
        classification = CASE
          WHEN manual THEN classification
          WHEN ${offersFound} > 0 THEN 'job'
          ELSE 'no_job'
        END
    WHERE message_id = ${messageId}`;
}
```

- [ ] **Step 2: Verify types and build**

Run (from `web/`): `npx tsc --noEmit && npm run build`
Expected: both succeed. (Query behavior is exercised through the UI in Task 10.)

- [ ] **Step 3: Commit**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git add web/lib/emails.ts
git commit -m "feat: emails-table queries with sender-based classification prediction

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

# Stage 4 — Posting fetch (Task 7)

### Task 7: Consent cleanup and Jina Reader fallback

**Files:**
- Modify: `web/lib/fetchPosting.ts`
- Modify: `web/lib/__tests__/fetchPosting.test.ts`

**Interfaces:**
- Produces: `htmlToPostingText(html): string` (same signature, now consent-free); `stripConsentLines(text): string` (pure, exported for tests and reused on Jina output); `fetchPostingText(url): Promise<string | null>` (same signature — now tries direct fetch, then Jina Reader).

- [ ] **Step 1: Write the failing tests**

Append to `web/lib/__tests__/fetchPosting.test.ts` (adjust the import line to include `stripConsentLines`):

```ts
describe("consent cleanup", () => {
  it("drops cookie banner markup and consent lines", () => {
    const html = `<html><body>
      <div id="onetrust-consent-sdk"><p>We value your privacy</p></div>
      <h1>AI Engineer</h1>
      <p>Build ML pipelines in Luxembourg.</p>
      <p>This website uses cookies to improve your experience.</p>
      <p>By clicking Accept you consent to our use of tracking.</p>
    </body></html>`;
    const text = htmlToPostingText(html);
    expect(text).toContain("AI Engineer");
    expect(text).toContain("ML pipelines");
    expect(text).not.toMatch(/cookies/i);
    expect(text).not.toMatch(/consent/i);
  });

  it("stripConsentLines keeps normal lines", () => {
    const cleaned = stripConsentLines(
      "Great job\nWe use cookies here\nApply now",
    );
    expect(cleaned).toBe("Great job\nApply now");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `web/`): `npm test`
Expected: FAIL — `stripConsentLines` not exported; cookie lines present.

- [ ] **Step 3: Update the implementation**

Replace the full contents of `web/lib/fetchPosting.ts`:

```ts
import { convert } from "html-to-text";

const CONSENT_LINE = /\b(cookies?|consent)\b/i;

export function stripConsentLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => !CONSENT_LINE.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function htmlToPostingText(html: string): string {
  const text = convert(html, {
    wordwrap: false,
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" },
      { selector: "nav", format: "skip" },
      { selector: "footer", format: "skip" },
      { selector: "script", format: "skip" },
      { selector: "style", format: "skip" },
      // Common consent-manager containers.
      { selector: "#onetrust-consent-sdk", format: "skip" },
      { selector: "#CybotCookiebotDialog", format: "skip" },
      { selector: "#cookie-banner", format: "skip" },
      { selector: ".cookie-banner", format: "skip" },
      { selector: ".cc-window", format: "skip" },
    ],
  });
  return stripConsentLines(text);
}

const MIN_LENGTH = 300;
const MAX_LENGTH = 30_000;

async function fetchDirect(url: string): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("html") && !contentType.includes("text")) {
    return null;
  }

  const text = htmlToPostingText(await response.text());
  // Login walls and bot blocks typically produce short pages.
  return text.length >= MIN_LENGTH ? text.slice(0, MAX_LENGTH) : null;
}

async function fetchViaJina(url: string): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Accept: "text/plain",
        ...(process.env.JINA_API_KEY
          ? { Authorization: `Bearer ${process.env.JINA_API_KEY}` }
          : {}),
      },
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  const text = stripConsentLines((await response.text()).trim());
  return text.length >= MIN_LENGTH ? text.slice(0, MAX_LENGTH) : null;
}

export async function fetchPostingText(url: string): Promise<string | null> {
  return (await fetchDirect(url)) ?? (await fetchViaJina(url));
}
```

Known trade-off (accepted in the spec): the line filter drops any line containing "cookie(s)"/"consent" — vanishingly rare in genuine job-posting text.

- [ ] **Step 4: Run tests to verify they pass**

Run (from `web/`): `npm test`
Expected: all pass, including the pre-existing `htmlToPostingText` tests.

- [ ] **Step 5: Runtime spot-check the Jina fallback**

Run: `curl -s https://r.jina.ai/https://example.com | head -20`
Expected: markdown-ish plain text of example.com (title + body). This confirms the endpoint shape; no code change needed.

- [ ] **Step 6: Commit**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git add web/lib/fetchPosting.ts web/lib/__tests__/fetchPosting.test.ts
git commit -m "feat: consent-banner cleanup and Jina Reader fallback for posting fetch

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

# Stage 5 — API routes (Tasks 8–9)

### Task 8: List and classify routes

**Files:**
- Create: `web/app/api/assistant/emails/list/route.ts`
- Create: `web/app/api/assistant/emails/[id]/route.ts`

**Interfaces:**
- Consumes: `sessionOk` (`@/lib/guard`), `listEmailHeaders` (`@/lib/email`), `upsertEmails`/`listEmails`/`setClassification` (`@/lib/emails`), `setState` (`@/lib/state`).
- Produces (used by Task 10):
  - `POST /api/assistant/emails/list` body `{start: "YYYY-MM-DD", end: "YYYY-MM-DD"}` → `{emails: EmailRow[]}`; stores `end` in `app_state.last_email_check`; 502 on IMAP failure.
  - `PATCH /api/assistant/emails/[id]` (`[id]` = URL-encoded `message_id`) body `{classification}` → `{ok: true}`; 400 on invalid value.

- [ ] **Step 1: Write the list route**

Create `web/app/api/assistant/emails/list/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { sessionOk } from "@/lib/guard";
import { listEmailHeaders } from "@/lib/email";
import { listEmails, upsertEmails } from "@/lib/emails";
import { setState } from "@/lib/state";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { start, end } = (await req.json()) as { start?: string; end?: string };
  if (!start || !end) {
    return NextResponse.json(
      { error: "start and end dates are required" },
      { status: 400 },
    );
  }
  const startDate = new Date(start);
  const endDate = new Date(end);

  let headers;
  try {
    headers = await listEmailHeaders(startDate, endDate);
  } catch (error) {
    return NextResponse.json(
      { error: `IMAP failed: ${String(error)}` },
      { status: 502 },
    );
  }
  await upsertEmails(headers);
  await setState("last_email_check", end);
  return NextResponse.json({ emails: await listEmails(startDate, endDate) });
}
```

- [ ] **Step 2: Write the classify route**

Create `web/app/api/assistant/emails/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { sessionOk } from "@/lib/guard";
import { setClassification } from "@/lib/emails";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { classification } = (await req.json()) as { classification?: string };
  const ok = await setClassification(
    decodeURIComponent(id),
    classification ?? "",
  );
  if (!ok) {
    return NextResponse.json(
      { error: "Invalid classification" },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verify types and build**

Run (from `web/`): `npx tsc --noEmit && npm run build`
Expected: both succeed. (Route behavior is exercised through the UI in Task 10 — the session cookie makes curl testing impractical.)

- [ ] **Step 4: Commit**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git add web/app/api/assistant/emails
git commit -m "feat: email listing and manual-classification API routes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Pull route

**Files:**
- Create: `web/app/api/assistant/emails/[id]/pull/route.ts`

**Interfaces:**
- Consumes: `sessionOk`; `getEmail`/`markPulled` (`@/lib/emails`); `fetchEmailBody` (`@/lib/email`); `extractOffersFromEmail`/`extractOfferFromText` (`@/lib/extract`); `RateLimitedError` (`@/lib/llm`); `fetchPostingText` (`@/lib/fetchPosting`); `createOffer` (`@/lib/offers`).
- Produces (used by Task 10): `POST /api/assistant/emails/[id]/pull` → `{offersFound: number, titles: string[], classification: EmailClassification}`. Status codes: 404 unknown email, 409 UID missing/stale (re-list), 429 Gemini rate limit (client should wait ~30 s and retry), 502 IMAP or extraction failure (email left unpulled).

- [ ] **Step 1: Write the pull route**

Create `web/app/api/assistant/emails/[id]/pull/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { sessionOk } from "@/lib/guard";
import { getEmail, markPulled } from "@/lib/emails";
import { fetchEmailBody } from "@/lib/email";
import { extractOffersFromEmail, extractOfferFromText } from "@/lib/extract";
import { RateLimitedError } from "@/lib/llm";
import { fetchPostingText } from "@/lib/fetchPosting";
import { createOffer } from "@/lib/offers";
import type { ExtractedOffer } from "@/lib/types";

export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const messageId = decodeURIComponent(id);

  const row = await getEmail(messageId);
  if (!row) {
    return NextResponse.json({ error: "Unknown email" }, { status: 404 });
  }
  if (row.uid === null) {
    return NextResponse.json(
      { error: "No IMAP UID stored — list emails again" },
      { status: 409 },
    );
  }

  let email;
  try {
    email = await fetchEmailBody(row.uid);
  } catch (error) {
    return NextResponse.json(
      { error: `IMAP failed: ${String(error)}` },
      { status: 502 },
    );
  }
  if (!email) {
    return NextResponse.json(
      { error: "Email no longer on server — list emails again" },
      { status: 409 },
    );
  }

  // null = model failure (leave unpulled); [] = genuinely no offers.
  let extracted: ExtractedOffer[] | null;
  try {
    extracted = await extractOffersFromEmail(
      email.subject,
      email.from,
      email.body,
    );
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return NextResponse.json({ error: "Gemini rate limited" }, { status: 429 });
    }
    throw error;
  }
  if (extracted === null) {
    return NextResponse.json(
      { error: "Extraction failed — retry this email" },
      { status: 502 },
    );
  }

  const titles: string[] = [];
  for (const offer of extracted) {
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

  await markPulled(messageId, extracted.length);
  const updated = await getEmail(messageId);
  return NextResponse.json({
    offersFound: extracted.length,
    titles,
    classification: updated?.classification ?? row.classification,
  });
}
```

- [ ] **Step 2: Verify types and build**

Run (from `web/`): `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git add web/app/api/assistant/emails
git commit -m "feat: per-email pull route (IMAP body, Gemini extraction, posting fetch)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

# Stage 6 — UI and deployment (Tasks 10–11)

### Task 10: EmailPanel UI with live pull progress

**Files:**
- Create: `web/app/assistant/components/EmailPanel.tsx`
- Modify: `web/app/assistant/page.tsx`

**Interfaces:**
- Consumes: the three routes from Tasks 8–9; `EmailRow`, `EmailClassification` from `@/lib/types` (client-safe); `getState` from `@/lib/state` (server side, in `page.tsx`).
- Produces: the complete redesigned `/assistant` page.

- [ ] **Step 1: Write the panel component**

Create `web/app/assistant/components/EmailPanel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EmailClassification, EmailRow } from "@/lib/types";

const ROW_TINT: Record<EmailClassification, string> = {
  job: "bg-green-500/10",
  no_job: "bg-red-500/10",
  unknown: "bg-yellow-500/10",
};
const CHIP: Record<EmailClassification, string> = {
  job: "bg-green-500",
  no_job: "bg-red-500",
  unknown: "bg-yellow-500",
};
const NEXT: Record<EmailClassification, EmailClassification> = {
  unknown: "job",
  job: "no_job",
  no_job: "unknown",
};

type PullStatus = { state: "pulling" | "done" | "error"; text: string };

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function EmailPanel({ lastCheck }: { lastCheck: string | null }) {
  const router = useRouter();
  const [start, setStart] = useState(
    lastCheck?.slice(0, 10) ?? isoDay(new Date(Date.now() - 7 * 86400_000)),
  );
  const [end, setEnd] = useState(isoDay(new Date()));
  const [emails, setEmails] = useState<EmailRow[] | null>(null);
  const [listing, setListing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [status, setStatus] = useState<Record<string, PullStatus>>({});
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  function patchRow(messageId: string, fields: Partial<EmailRow>) {
    setEmails(
      (prev) =>
        prev?.map((e) =>
          e.message_id === messageId ? { ...e, ...fields } : e,
        ) ?? null,
    );
  }

  function setRowStatus(messageId: string, s: PullStatus) {
    setStatus((prev) => ({ ...prev, [messageId]: s }));
  }

  async function list() {
    setListing(true);
    setError("");
    setStatus({});
    setProgress("");
    const res = await fetch("/api/assistant/emails/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start, end }),
    });
    setListing(false);
    if (!res.ok) {
      setError(((await res.json()) as { error?: string }).error ?? "Failed");
      return;
    }
    setEmails(((await res.json()) as { emails: EmailRow[] }).emails);
  }

  async function cycle(row: EmailRow) {
    const next = NEXT[row.classification];
    const res = await fetch(
      `/api/assistant/emails/${encodeURIComponent(row.message_id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classification: next }),
      },
    );
    if (res.ok) patchRow(row.message_id, { classification: next, manual: true });
  }

  async function pullOne(row: EmailRow): Promise<number> {
    const id = encodeURIComponent(row.message_id);
    for (let attempt = 0; attempt < 3; attempt++) {
      setRowStatus(row.message_id, {
        state: "pulling",
        text: attempt === 0 ? "pulling…" : `retry ${attempt}…`,
      });
      const res = await fetch(`/api/assistant/emails/${id}/pull`, {
        method: "POST",
      });
      if (res.status === 429) {
        setRowStatus(row.message_id, {
          state: "pulling",
          text: "rate limited — waiting 30 s…",
        });
        await new Promise((r) => setTimeout(r, 30_000));
        continue;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setRowStatus(row.message_id, {
          state: "error",
          text: body.error ?? "failed",
        });
        return 0;
      }
      const { offersFound, titles, classification } = (await res.json()) as {
        offersFound: number;
        titles: string[];
        classification: EmailClassification;
      };
      setRowStatus(row.message_id, {
        state: "done",
        text: offersFound > 0 ? titles.join(" · ") : "no offers",
      });
      patchRow(row.message_id, {
        pulled: true,
        offers_found: offersFound,
        classification,
      });
      router.refresh(); // offers list below updates live
      return offersFound;
    }
    setRowStatus(row.message_id, {
      state: "error",
      text: "rate limited — gave up, retry later",
    });
    return 0;
  }

  async function pullAll() {
    if (!emails) return;
    setPulling(true);
    const queue = emails.filter(
      (e) => !e.pulled && e.classification !== "no_job",
    );
    let done = 0;
    let found = 0;
    for (const row of queue) {
      found += await pullOne(row);
      done += 1;
      setProgress(
        `Pulled ${done}/${queue.length} — ${found} offer${found === 1 ? "" : "s"} found`,
      );
    }
    setPulling(false);
  }

  async function pullSingle(row: EmailRow) {
    setPulling(true);
    await pullOne(row);
    setPulling(false);
  }

  return (
    <div className="space-y-3 rounded border border-surface2 bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-bold">Email check</h2>
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="rounded bg-surface2 p-1 text-sm"
        />
        <span className="text-gray">→</span>
        <input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="rounded bg-surface2 p-1 text-sm"
        />
        <button
          onClick={list}
          disabled={listing || pulling}
          className="rounded bg-blue px-3 py-1 text-sm disabled:opacity-50"
        >
          {listing ? "Listing…" : "List emails"}
        </button>
        {emails && emails.length > 0 && (
          <button
            onClick={pullAll}
            disabled={pulling || listing}
            className="rounded bg-purple px-3 py-1 text-sm disabled:opacity-50"
          >
            {pulling ? "Pulling…" : "Pull all"}
          </button>
        )}
        {progress && <span className="text-sm text-gray">{progress}</span>}
        {error && <span className="text-sm text-yellow">{error}</span>}
      </div>

      {emails &&
        (emails.length === 0 ? (
          <p className="text-sm text-gray">No emails in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray">
                <tr>
                  <th className="p-1"></th>
                  <th className="p-1">Date</th>
                  <th className="p-1">From</th>
                  <th className="p-1">Subject</th>
                  <th className="p-1">Result</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((e) => {
                  const s = status[e.message_id];
                  return (
                    <tr
                      key={e.message_id}
                      className={`border-t border-surface2 align-top ${ROW_TINT[e.classification]} ${e.pulled ? "opacity-60" : ""}`}
                    >
                      <td className="p-1">
                        <button
                          onClick={() => cycle(e)}
                          disabled={pulling}
                          aria-label={`Classification: ${e.classification} — click to change`}
                          title={e.classification}
                          className={`h-3 w-3 rounded-full ${CHIP[e.classification]}`}
                        />
                      </td>
                      <td className="whitespace-nowrap p-1">{e.date}</td>
                      <td className="max-w-48 truncate p-1">{e.from_addr}</td>
                      <td className="max-w-md truncate p-1">{e.subject}</td>
                      <td className="p-1">
                        {s ? (
                          <span
                            className={
                              s.state === "error" ? "text-yellow" : "text-gray"
                            }
                          >
                            {s.text}
                          </span>
                        ) : e.pulled ? (
                          <span className="text-gray">
                            {e.offers_found ?? 0} offer
                            {e.offers_found === 1 ? "" : "s"}
                          </span>
                        ) : (
                          <button
                            onClick={() => pullSingle(e)}
                            disabled={pulling}
                            className="text-blue hover:underline disabled:opacity-50"
                          >
                            pull
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}
```

- [ ] **Step 2: Wire the panel into the page**

Replace the full contents of `web/app/assistant/page.tsx`:

```tsx
import { listOffers } from "@/lib/offers";
import { getState } from "@/lib/state";
import AddOffer from "./components/AddOffer";
import OfferCard from "./components/OfferCard";
import EmailPanel from "./components/EmailPanel";

export const dynamic = "force-dynamic";

export default async function OffersPage() {
  const [offers, lastCheck] = await Promise.all([
    listOffers(),
    getState("last_email_check"),
  ]);
  return (
    <div className="space-y-6">
      <EmailPanel lastCheck={lastCheck} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Offers</h1>
        <AddOffer />
      </div>
      {offers.length === 0 ? (
        <p className="text-gray">No open offers.</p>
      ) : (
        <div className="space-y-4">
          {offers.map((o) => (
            <OfferCard key={o.id} offer={o} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify types, tests, build**

Run (from `web/`): `npx tsc --noEmit && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 4: Verify end-to-end in the browser**

Run: `npm run dev`, open `http://localhost:3000/assistant`. Check in order:

1. Date inputs default to last-check (or 7 days back) and today; both adjustable.
2. "List emails" over a few days returns **all** emails in the range within seconds; all rows yellow on first ever run.
3. Clicking a color chip cycles yellow → green → red → yellow; reload the page and re-list — the manual color persists.
4. "Pull all" walks green+yellow rows one at a time: the active row shows "pulling…", finished rows show extracted titles or "no offers", the header shows `Pulled n/m — k offers found`, and new offers appear in the list below while the loop runs.
5. Red rows are skipped by "Pull all" but have a working per-row "pull" link.
6. After pulls, re-list: rows from senders that produced offers are green, no-offer senders red; pulled rows are dimmed with their offer counts; a second "Pull all" processes only new emails.
7. An offer from a LinkedIn (or similar previously-blocked) link has non-empty `posting_text` (open the offer card) without cookie-banner text.
8. Phone-width viewport (devtools): the panel remains usable (table scrolls horizontally).

- [ ] **Step 5: Commit**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git add web/app/assistant
git commit -m "feat: email panel with date range, color classification, and live pull

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Deploy and verify on Vercel

> **OWNER SETUP:** In Vercel → yolosite → Settings → Environment Variables add `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`, `JINA_API_KEY`). Remove `EXTRACTION_MODEL` if it was set.

**Files:** none (deployment only).

- [ ] **Step 1: Push**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git push
```

- [ ] **Step 2: Verify the deployed app**

After Vercel deploys, on `https://yolosite.vercel.app/assistant` repeat the Task 10 Step 4 checklist items 1–6 (a short date range is enough). Also verify from a phone: list + pull a couple of emails.

- [ ] **Step 3: Verify the public site is untouched**

Open `https://yolosite.vercel.app/` — portfolio renders; the DigitalTwin chat still answers (OpenRouter path unchanged).
