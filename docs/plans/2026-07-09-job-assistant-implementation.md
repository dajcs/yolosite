# Job Application Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a private job-application assistant to yolosite: Gmail offer scanning, offer triage, application tracking with exports, a skill API, and a local Claude Code `/apply` skill in the cv repo.

**Architecture:** The public portfolio site stays untouched. A new private area at `/assistant` (Google sign-in, allow-listed to one email) reads/writes a Neon Postgres database. Server components read via `web/lib/*` query modules; client components mutate via route handlers under `/api/assistant/*`. A bearer-token API under `/api/skill/*` serves the local Claude Code skill that lives in the separate cv repo. LLM extraction uses OpenRouter (free model, non-streaming JSON). Email reading uses Gmail IMAP with an app password.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4, TypeScript strict, Auth.js (next-auth v5), `@neondatabase/serverless`, `imapflow` + `mailparser`, `html-to-text`, `exceljs`, `vitest`.

**Spec:** `docs/specs/2026-07-08-job-assistant-vision.md` — read it before starting.

## Global Constraints

- All `npm`/`npx` commands run from `web/`. All `git` commands run from the repo root (`/mnt/c/Users/dajcs/code/yolosite`), except Task 14 which works in the cv repo (`/mnt/c/Users/dajcs/code/cv`).
- TypeScript strict; no `any`. Follow existing code style (see `web/app/api/chat/route.ts`).
- No ORM, no client-state library, no new UI libraries. Simple > clever. No defensive programming beyond what each task shows.
- **Client components (`"use client"`) must never import from `web/lib/db.ts` or any module that imports it.** Shared types and constants live in `web/lib/types.ts` (no imports). Server-only modules (`db.ts`, `applications.ts`, `offers.ts`, `email.ts`, `state.ts`) are imported only by server components, route handlers, and each other.
- Import convention: app code imports lib modules via `@/lib/...` and auth via `@/auth`; lib modules import each other relatively (`./db`); test files import relatively (`../csv`) because vitest does not resolve the `@/` alias.
- Styling: existing Tailwind tokens only — `bg-bg`, `bg-surface`, `bg-surface2`, `text-text`, `text-gray`, `text-blue`, `text-yellow`, `text-purple`, `border-surface2`. Dark theme, mobile-first (private pages must be usable on a phone).
- Status values (exact strings, everywhere): `pending`, `docs_generated`, `applied`, `interview`, `offer`, `rejected`.
- Never write code or skill instructions that insert hidden/invisible text into documents. The cv-repo skill defers to that repo's own CLAUDE.md for tailoring conventions and stays silent about the invisible keyword block (see spec §4.3).
- Commit after every task with a conventional-commit message ending in the `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer.
- Environment variables (local `web/.env.local`, and Vercel → Project → Settings → Environment Variables):

| Variable | Purpose | Introduced |
|---|---|---|
| `DATABASE_URL` | Neon Postgres connection string | Task 2 |
| `AUTH_SECRET` | Auth.js session encryption (`openssl rand -base64 32`) | Task 3 |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client (login only) | Task 3 |
| `ALLOWED_EMAIL` | `attila.nemet@gmail.com` — the only allowed login | Task 3 |
| `OPENROUTER_API_KEY` | Already exists (chat twin); reused for extraction | Task 7 |
| `EXTRACTION_MODEL` | Optional; defaults to the chat model | Task 7 |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | IMAP read access | Task 12 |
| `SKILL_API_TOKEN` | Bearer token for `/api/skill/*` (`openssl rand -hex 32`) | Task 13 |

## File Structure

```
web/
  auth.ts                                    # Auth.js config (Task 3)
  vitest.config.ts                           # not needed — vitest zero-config
  scripts/init-db.mjs                        # applies schema.sql (Task 2)
  lib/
    schema.sql                               # DDL, idempotent (Task 2)
    db.ts                                    # lazy neon client (Task 2)
    types.ts                                 # shared types/constants, NO imports (Task 4)
    guard.ts                                 # sessionOk() (Task 4), skillOk() (Task 13)
    applications.ts                          # application queries (Task 4)
    csv.ts                                   # toCsv() pure (Task 6)
    exportColumns.ts                         # shared export column spec (Task 6)
    llm.ts                                   # parseModelJson(), chatJson() (Task 7)
    extract.ts                               # normalizeOffer(), extract* prompts (Task 8)
    fetchPosting.ts                          # htmlToPostingText(), fetchPostingText() (Task 9)
    offers.ts                                # offer queries (Task 10)
    state.ts                                 # app_state get/set (Task 12)
    email.ts                                 # IMAP fetch + processed_emails (Task 12)
    __tests__/                               # vitest specs (Tasks 1,6,7,8,9)
  app/
    api/auth/[...nextauth]/route.ts          # Task 3
    api/assistant/applications/route.ts      # GET list, POST create (Task 4)
    api/assistant/applications/[id]/route.ts # PATCH, DELETE (Task 4)
    api/assistant/applications/[id]/zip/route.ts  # GET download (Task 13)
    api/assistant/export/csv/route.ts        # Task 6
    api/assistant/export/xlsx/route.ts       # Task 6
    api/assistant/offers/route.ts            # GET list, POST manual add (Task 10)
    api/assistant/offers/[id]/route.ts       # PATCH dismiss/apply (Task 10)
    api/assistant/check-email/route.ts       # POST scan (Task 12)
    api/skill/pending/route.ts               # GET (Task 13)
    api/skill/report/route.ts                # POST (Task 13)
    assistant/
      layout.tsx                             # auth guard + nav (Task 3)
      page.tsx                               # offers list (Tasks 3, 11, 12)
      applications/page.tsx                  # applications table (Task 5)
      components/
        ApplicationsTable.tsx                # Task 5
        AddApplication.tsx                   # Task 5
        AddOffer.tsx                         # Task 11
        OfferCard.tsx                        # Task 11
        CheckEmailButton.tsx                 # Task 12

/mnt/c/Users/dajcs/code/cv/.claude/skills/apply/SKILL.md   # Task 14
```

---

# Stage 1 — Private foundation (Tasks 1–3)

### Task 1: Dependencies and test infrastructure

**Files:**
- Modify: `web/package.json` (via npm commands)
- Create: `web/lib/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: `npm test` script running vitest; all runtime deps installed for later tasks.

- [ ] **Step 1: Install dependencies**

```bash
cd web
npm install @neondatabase/serverless imapflow mailparser html-to-text exceljs
npm install next-auth@beta
npm install -D vitest @types/mailparser
```

Note on `next-auth`: v5 is the App Router version. First check `npm view next-auth dist-tags` — if `latest` is a `5.x`, run `npm install next-auth` instead of `next-auth@beta`.

- [ ] **Step 2: Add scripts to `web/package.json`**

In the `"scripts"` object add (keep existing entries):

```json
"test": "vitest run",
"db:init": "node --env-file=.env.local scripts/init-db.mjs"
```

- [ ] **Step 3: Write the smoke test**

Create `web/lib/__tests__/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("test infrastructure", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 5: Verify the site still builds**

Run: `npm run build`
Expected: build succeeds (public site unaffected).

- [ ] **Step 6: Commit**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git add web/package.json web/package-lock.json web/lib/__tests__/smoke.test.ts
git commit -m "chore: add assistant dependencies and vitest

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Database schema, client, and init script

> **OWNER SETUP required before verification:** In the Vercel dashboard → yolosite project → Storage → Create Database → Neon (free tier). This injects `DATABASE_URL` into the Vercel env. Then copy it locally: create `web/.env.local` (git-ignored) containing `DATABASE_URL=postgres://...` (from Vercel → Settings → Environment Variables, or `npx vercel env pull`).

**Files:**
- Create: `web/lib/schema.sql`
- Create: `web/lib/db.ts`
- Create: `web/scripts/init-db.mjs`

**Interfaces:**
- Produces: `db()` from `web/lib/db.ts` — returns the neon client; usable as tagged template ``await db()`SELECT ...` `` (returns row array) and as `await db().query(text, params)` (returns row array). Tables `offers`, `applications`, `app_state`, `processed_emails`.

- [ ] **Step 1: Write the schema**

Create `web/lib/schema.sql`. IMPORTANT: statements are separated by `;` and must not contain internal semicolons (the init script splits on `;`).

```sql
CREATE TABLE IF NOT EXISTS offers (
  id serial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'manual',
  email_ref text,
  link text,
  posting_text text,
  employer text,
  title text,
  location text,
  ref_id text,
  deadline text,
  requirements text,
  dismissed boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS applications (
  id serial PRIMARY KEY,
  offer_id integer REFERENCES offers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  link text,
  offer_text text,
  employer text,
  title text,
  ref_id text,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  archive_path text,
  zip_filename text,
  zip_base64 text
);

CREATE TABLE IF NOT EXISTS app_state (
  key text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS processed_emails (
  message_id text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
)
```

(`title` is used for the position name because `position` is a reserved word in SQL. UI and exports label it "Position". The `zip_base64` column stores the application documents zip as base64 text — simple, and well within Neon limits at ~few MB per row.)

- [ ] **Step 2: Write the db client**

Create `web/lib/db.ts`:

```ts
import { neon } from "@neondatabase/serverless";

// Lazy so that importing this module never throws at build/test time
// when DATABASE_URL is absent.
let client: ReturnType<typeof neon> | null = null;

export function db() {
  if (!client) client = neon(process.env.DATABASE_URL!);
  return client;
}
```

- [ ] **Step 3: Write the init script**

Create `web/scripts/init-db.mjs`:

```js
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (expected in web/.env.local)");
  process.exit(1);
}
const sql = neon(url);
const schema = readFileSync(new URL("../lib/schema.sql", import.meta.url), "utf8");

for (const statement of schema.split(";").map((s) => s.trim()).filter(Boolean)) {
  await sql.query(statement);
  console.log("OK:", statement.slice(0, 60).replace(/\s+/g, " "));
}
console.log("Schema applied.");
```

- [ ] **Step 4: Apply the schema**

Run: `npm run db:init`
Expected: four `OK: CREATE TABLE IF NOT EXISTS ...` lines and `Schema applied.` Run it a second time — must succeed identically (idempotent).

- [ ] **Step 5: Commit**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git add web/lib/schema.sql web/lib/db.ts web/scripts/init-db.mjs
git commit -m "feat: add Neon Postgres schema, client, and init script

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Google sign-in and the /assistant shell

> **OWNER SETUP required before verification:**
> 1. Google Cloud Console → new project (e.g. "yolosite-login") → "APIs & Services" → OAuth consent screen: External, app name "yolosite assistant", add attila.nemet@gmail.com as test user. No sensitive scopes.
> 2. Credentials → Create Credentials → OAuth client ID → Web application. Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` and `https://yolosite.vercel.app/api/auth/callback/google`.
> 3. Add to `web/.env.local` AND Vercel env: `AUTH_SECRET` (from `openssl rand -base64 32`), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAIL=attila.nemet@gmail.com`.

**Files:**
- Create: `web/auth.ts`
- Create: `web/app/api/auth/[...nextauth]/route.ts`
- Create: `web/app/assistant/layout.tsx`
- Create: `web/app/assistant/page.tsx`

**Interfaces:**
- Produces: `auth`, `handlers`, `signIn`, `signOut` exported from `@/auth`. `/assistant` renders only for the allow-listed Google account; everyone else is rejected by Auth.js with an AccessDenied error page.

- [ ] **Step 1: Write the Auth.js config**

Create `web/auth.ts`:

```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  callbacks: {
    signIn({ user }) {
      return user.email === process.env.ALLOWED_EMAIL;
    },
  },
});
```

(The Google provider reads `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` from the environment automatically; sessions are stateless JWTs — no database adapter.)

- [ ] **Step 2: Write the auth route handler**

Create `web/app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 3: Write the assistant layout with auth guard and nav**

Create `web/app/assistant/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/auth";

export const metadata = { title: "Assistant — Attila Nemet" };

export default async function AssistantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/api/auth/signin?callbackUrl=/assistant");

  return (
    <div className="min-h-screen bg-bg text-text">
      <nav className="flex items-center gap-5 border-b border-surface2 px-4 py-3 text-sm">
        <span className="font-bold text-yellow">Job Assistant</span>
        <Link href="/assistant" className="text-blue hover:underline">
          Offers
        </Link>
        <Link href="/assistant/applications" className="text-blue hover:underline">
          Applications
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
          className="ml-auto"
        >
          <button type="submit" className="text-gray hover:text-text">
            Sign out
          </button>
        </form>
      </nav>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Write the placeholder offers page**

Create `web/app/assistant/page.tsx`:

```tsx
export default function OffersPage() {
  return <p className="text-gray">Offers will appear here.</p>;
}
```

- [ ] **Step 5: Verify locally**

Run: `npm run dev`, open `http://localhost:3000/assistant`.
Expected: redirect to Google sign-in; after signing in with the allow-listed account, the shell renders with nav and placeholder. Sign out returns to the public site. Signing in with a different Google account shows Auth.js "AccessDenied". The public site at `/` is unchanged.

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: success.

- [ ] **Step 7: Commit and deploy**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git add web/auth.ts web/app/api/auth web/app/assistant
git commit -m "feat: add Google sign-in and private /assistant shell

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```

After Vercel deploys (env vars must be set first), verify `https://yolosite.vercel.app/assistant` behaves like the local test.

---

# Stage 2 — Applications table (Tasks 4–6)

### Task 4: Shared types, guard, application queries, and API routes

**Files:**
- Create: `web/lib/types.ts`
- Create: `web/lib/guard.ts`
- Create: `web/lib/applications.ts`
- Create: `web/app/api/assistant/applications/route.ts`
- Create: `web/app/api/assistant/applications/[id]/route.ts`

**Interfaces:**
- Consumes: `db()` from Task 2, `auth` from Task 3.
- Produces (used by Tasks 5, 6, 10, 13):
  - `web/lib/types.ts`: `STATUSES` const array, `Status`, `Application`, `Offer`, `ExtractedOffer` types. **No imports in this file — safe for client components.**
  - `web/lib/guard.ts`: `sessionOk(): Promise<boolean>`.
  - `web/lib/applications.ts`: `listApplications(): Promise<Application[]>`, `createApplication(a: NewApplication): Promise<number>`, `updateApplication(id: number, fields: Record<string, unknown>): Promise<boolean>`, `deleteApplication(id: number): Promise<void>`.
  - HTTP: `GET/POST /api/assistant/applications`, `PATCH/DELETE /api/assistant/applications/[id]`.

- [ ] **Step 1: Write the shared types module**

Create `web/lib/types.ts`:

```ts
export const STATUSES = [
  "pending",
  "docs_generated",
  "applied",
  "interview",
  "offer",
  "rejected",
] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  pending: "Pending",
  docs_generated: "Docs generated",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

export type Application = {
  id: number;
  date: string;
  link: string | null;
  offer_text: string | null;
  employer: string | null;
  title: string | null;
  ref_id: string | null;
  status: Status;
  notes: string | null;
  archive_path: string | null;
  zip_filename: string | null;
  has_zip: boolean;
};

export type Offer = {
  id: number;
  created_at: string;
  source: string;
  email_ref: string | null;
  link: string | null;
  posting_text: string | null;
  employer: string | null;
  title: string | null;
  location: string | null;
  ref_id: string | null;
  deadline: string | null;
  requirements: string | null;
};

export type ExtractedOffer = {
  employer: string | null;
  title: string | null;
  location: string | null;
  ref_id: string | null;
  deadline: string | null;
  requirements: string | null;
  link: string | null;
};
```

- [ ] **Step 2: Write the session guard**

Create `web/lib/guard.ts`:

```ts
import { auth } from "@/auth";

export async function sessionOk(): Promise<boolean> {
  const session = await auth();
  return Boolean(session);
}
```

- [ ] **Step 3: Write the application queries**

Create `web/lib/applications.ts`:

```ts
import { db } from "./db";
import { STATUSES, type Application, type Status } from "./types";

const COLUMNS = `id, to_char(date, 'YYYY-MM-DD') AS date, link, offer_text, employer,
  title, ref_id, status, notes, archive_path, zip_filename,
  (zip_base64 IS NOT NULL) AS has_zip`;

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
```

- [ ] **Step 4: Write the collection route**

Create `web/app/api/assistant/applications/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { sessionOk } from "@/lib/guard";
import { listApplications, createApplication } from "@/lib/applications";

export async function GET() {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ applications: await listApplications() });
}

export async function POST(req: NextRequest) {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as Record<string, unknown>;
  const clean = Object.fromEntries(
    Object.entries(body).map(([k, v]) => [k, v === "" ? null : v]),
  );
  if (!clean.employer && !clean.title && !clean.link) {
    return NextResponse.json(
      { error: "Provide at least an employer, position, or link" },
      { status: 400 },
    );
  }
  const id = await createApplication(clean);
  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 5: Write the item route**

Create `web/app/api/assistant/applications/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { sessionOk } from "@/lib/guard";
import { updateApplication, deleteApplication } from "@/lib/applications";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const ok = await updateApplication(Number(id), await req.json());
  if (!ok) {
    return NextResponse.json(
      { error: "Nothing to update or invalid status" },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await deleteApplication(Number(id));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Verify types and build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both succeed. (Route behavior is exercised through the UI in Task 5 — the session cookie makes curl testing impractical.)

- [ ] **Step 7: Commit**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git add web/lib/types.ts web/lib/guard.ts web/lib/applications.ts web/app/api/assistant/applications
git commit -m "feat: application queries and CRUD API routes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Applications table UI

**Files:**
- Create: `web/app/assistant/applications/page.tsx`
- Create: `web/app/assistant/components/ApplicationsTable.tsx`
- Create: `web/app/assistant/components/AddApplication.tsx`

**Interfaces:**
- Consumes: `listApplications` (server), `Application`/`STATUSES`/`STATUS_LABELS` from `@/lib/types` (client-safe), HTTP routes from Task 4.
- Produces: `/assistant/applications` page. Task 6 modifies `page.tsx` to add export links; Task 13's zip download link is already rendered here (hidden until `has_zip`).

- [ ] **Step 1: Write the page (server component)**

Create `web/app/assistant/applications/page.tsx`:

```tsx
import { listApplications } from "@/lib/applications";
import ApplicationsTable from "../components/ApplicationsTable";
import AddApplication from "../components/AddApplication";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const applications = await listApplications();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Applications</h1>
        <AddApplication />
      </div>
      <ApplicationsTable applications={applications} />
    </div>
  );
}
```

- [ ] **Step 2: Write the table component**

Create `web/app/assistant/components/ApplicationsTable.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STATUSES, STATUS_LABELS, type Application } from "@/lib/types";

export default function ApplicationsTable({
  applications,
}: {
  applications: Application[];
}) {
  const router = useRouter();

  async function patch(id: number, fields: Record<string, unknown>) {
    await fetch(`/api/assistant/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    router.refresh();
  }

  async function remove(id: number) {
    if (!confirm("Delete this application?")) return;
    await fetch(`/api/assistant/applications/${id}`, { method: "DELETE" });
    router.refresh();
  }

  if (applications.length === 0) {
    return <p className="text-gray">No applications yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded border border-surface2">
      <table className="w-full text-sm">
        <thead className="bg-surface2 text-left">
          <tr>
            <th className="p-2">Date</th>
            <th className="p-2">Employer</th>
            <th className="p-2">Position</th>
            <th className="p-2">Ref</th>
            <th className="p-2">Status</th>
            <th className="p-2">Notes</th>
            <th className="p-2">Docs</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {applications.map((a) => (
            <tr key={a.id} className="border-t border-surface2 align-top">
              <td className="whitespace-nowrap p-2">{a.date}</td>
              <td className="p-2">{a.employer}</td>
              <td className="p-2">
                {a.link ? (
                  <a
                    href={a.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue hover:underline"
                  >
                    {a.title ?? a.link}
                  </a>
                ) : (
                  a.title
                )}
              </td>
              <td className="p-2">{a.ref_id}</td>
              <td className="p-2">
                <select
                  value={a.status}
                  onChange={(e) => patch(a.id, { status: e.target.value })}
                  className="rounded bg-surface2 p-1"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="p-2">
                <NotesCell id={a.id} notes={a.notes} onSave={patch} />
              </td>
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
              <td className="p-2">
                <button
                  onClick={() => remove(a.id)}
                  className="text-gray hover:text-text"
                  aria-label="Delete"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotesCell({
  id,
  notes,
  onSave,
}: {
  id: number;
  notes: string | null;
  onSave: (id: number, fields: Record<string, unknown>) => Promise<void>;
}) {
  const [value, setValue] = useState(notes ?? "");
  return (
    <textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value !== (notes ?? "")) onSave(id, { notes: value });
      }}
      rows={1}
      className="w-40 rounded bg-surface2 p-1"
    />
  );
}
```

- [ ] **Step 3: Write the add form**

Create `web/app/assistant/components/AddApplication.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const EMPTY = {
  employer: "",
  title: "",
  link: "",
  ref_id: "",
  offer_text: "",
  notes: "",
};

export default function AddApplication() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");

  function set(key: keyof typeof EMPTY) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => setForm({ ...form, [key]: e.target.value });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/assistant/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setError(((await res.json()) as { error?: string }).error ?? "Failed");
      return;
    }
    setForm(EMPTY);
    setError("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-purple px-3 py-1 text-sm"
      >
        + Add application
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-full space-y-2 rounded border border-surface2 bg-surface p-4"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          placeholder="Employer"
          value={form.employer}
          onChange={set("employer")}
          className="rounded bg-surface2 p-2"
        />
        <input
          placeholder="Position"
          value={form.title}
          onChange={set("title")}
          className="rounded bg-surface2 p-2"
        />
        <input
          placeholder="Link"
          value={form.link}
          onChange={set("link")}
          className="rounded bg-surface2 p-2"
        />
        <input
          placeholder="Ref. ID"
          value={form.ref_id}
          onChange={set("ref_id")}
          className="rounded bg-surface2 p-2"
        />
      </div>
      <textarea
        placeholder="Job offer text"
        rows={4}
        value={form.offer_text}
        onChange={set("offer_text")}
        className="w-full rounded bg-surface2 p-2"
      />
      <textarea
        placeholder="Notes"
        rows={2}
        value={form.notes}
        onChange={set("notes")}
        className="w-full rounded bg-surface2 p-2"
      />
      {error && <p className="text-sm text-yellow">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="rounded bg-purple px-3 py-1 text-sm">
          Save
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded bg-surface2 px-3 py-1 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`, open `http://localhost:3000/assistant/applications`.
Expected: add an application (employer + position), it appears in the table; change its status to "Applied" and reload — persisted; edit notes, blur, reload — persisted; delete works; empty form submission shows the error message.

- [ ] **Step 5: Commit**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git add web/app/assistant
git commit -m "feat: applications table UI with inline status and notes editing

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: CSV and Excel export

**Files:**
- Create: `web/lib/csv.ts`
- Create: `web/lib/__tests__/csv.test.ts`
- Create: `web/lib/exportColumns.ts`
- Create: `web/app/api/assistant/export/csv/route.ts`
- Create: `web/app/api/assistant/export/xlsx/route.ts`
- Modify: `web/app/assistant/applications/page.tsx`

**Interfaces:**
- Consumes: `listApplications` from Task 4.
- Produces: `toCsv(rows, columns)` pure function; `EXPORT_COLUMNS`; `GET /api/assistant/export/csv` and `/xlsx` download endpoints.

- [ ] **Step 1: Write the failing tests**

Create `web/lib/__tests__/csv.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toCsv } from "../csv";

const columns = [
  { key: "a", header: "A" },
  { key: "b", header: "B" },
];

describe("toCsv", () => {
  it("renders header and rows", () => {
    expect(toCsv([{ a: "1", b: "x" }], columns)).toBe("A,B\r\n1,x\r\n");
  });

  it("escapes quotes, commas and newlines", () => {
    const csv = toCsv([{ a: 'say "hi", ok', b: "line1\nline2" }], columns);
    expect(csv).toBe('A,B\r\n"say ""hi"", ok","line1\nline2"\r\n');
  });

  it("renders null and undefined as empty cells", () => {
    expect(toCsv([{ a: null, b: undefined }], columns)).toBe("A,B\r\n,\r\n");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../csv'` (or equivalent).

- [ ] **Step 3: Write the implementation**

Create `web/lib/csv.ts`:

```ts
export type Column = { key: string; header: string };

export function toCsv(
  rows: Record<string, unknown>[],
  columns: Column[],
): string {
  const escape = (value: unknown): string => {
    const s = value == null ? "" : String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => escape(c.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escape(row[c.key])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Write the shared column spec**

Create `web/lib/exportColumns.ts` (owner's exact column spec — do not reorder):

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
];
```

- [ ] **Step 6: Write the CSV route**

Create `web/app/api/assistant/export/csv/route.ts`:

```ts
import { NextResponse } from "next/server";
import { sessionOk } from "@/lib/guard";
import { listApplications } from "@/lib/applications";
import { toCsv } from "@/lib/csv";
import { EXPORT_COLUMNS } from "@/lib/exportColumns";

export async function GET() {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = (await listApplications()) as unknown as Record<string, unknown>[];
  const csv = toCsv(rows, EXPORT_COLUMNS);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="applications-${date}.csv"`,
    },
  });
}
```

- [ ] **Step 7: Write the Excel route**

Create `web/app/api/assistant/export/xlsx/route.ts`:

```ts
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { sessionOk } from "@/lib/guard";
import { listApplications } from "@/lib/applications";
import { EXPORT_COLUMNS } from "@/lib/exportColumns";

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
  for (const row of rows) sheet.addRow(row);
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

- [ ] **Step 8: Add export links to the applications page**

In `web/app/assistant/applications/page.tsx`, replace the header `<div className="flex flex-wrap items-center justify-between gap-3">...</div>` block with:

```tsx
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Applications</h1>
        <div className="flex items-center gap-3">
          <a
            href="/api/assistant/export/csv"
            className="rounded bg-surface2 px-3 py-1 text-sm text-blue"
          >
            CSV
          </a>
          <a
            href="/api/assistant/export/xlsx"
            className="rounded bg-surface2 px-3 py-1 text-sm text-blue"
          >
            Excel
          </a>
          <AddApplication />
        </div>
      </div>
```

- [ ] **Step 9: Verify in the browser**

Run: `npm run dev` → `/assistant/applications` → click CSV and Excel.
Expected: both download; CSV opens with the exact headers `Date, Job offer link, Job offer text, Employer, Position, Job ref. id, Status, Notes`; Excel opens in a spreadsheet app with a bold header row.

- [ ] **Step 10: Commit and deploy Stage 2**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git add web/lib/csv.ts web/lib/__tests__/csv.test.ts web/lib/exportColumns.ts web/app/api/assistant/export web/app/assistant/applications/page.tsx
git commit -m "feat: CSV and Excel export of the applications table

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```

Verify the deployed `/assistant/applications` end-to-end on Vercel (add, edit, export).

---

# Stage 3 — Manual offer entry + posting fetch (Tasks 7–11)

### Task 7: LLM client (`parseModelJson`, `chatJson`)

**Files:**
- Create: `web/lib/llm.ts`
- Create: `web/lib/__tests__/llm.test.ts`

**Interfaces:**
- Produces: `parseModelJson(text: string): unknown | null` (pure) and `chatJson(prompt: string): Promise<unknown | null>` (OpenRouter, non-streaming; returns parsed JSON or null on any failure). Used by Task 8.

- [ ] **Step 1: Write the failing tests**

Create `web/lib/__tests__/llm.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseModelJson } from "../llm";

describe("parseModelJson", () => {
  it("parses plain JSON", () => {
    expect(parseModelJson('{"a": 1}')).toEqual({ a: 1 });
  });

  it("parses JSON inside a markdown fence", () => {
    expect(parseModelJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it("parses JSON surrounded by prose", () => {
    expect(parseModelJson('Here you go: {"offers": []} Hope that helps!')).toEqual({
      offers: [],
    });
  });

  it("returns null for text without JSON", () => {
    expect(parseModelJson("no json here")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseModelJson('{"a": unquoted}')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `web/lib/llm.ts`:

```ts
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

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

export async function chatJson(prompt: string): Promise<unknown | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:
          process.env.EXTRACTION_MODEL ??
          process.env.OPENROUTER_MODEL ??
          "nvidia/nemotron-3-super-120b-a12b:free",
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return parseModelJson(data.choices?.[0]?.message?.content ?? "");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git add web/lib/llm.ts web/lib/__tests__/llm.test.ts
git commit -m "feat: OpenRouter JSON chat client with robust JSON parsing

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Offer extraction (`normalizeOffer`, prompts)

**Files:**
- Create: `web/lib/extract.ts`
- Create: `web/lib/__tests__/extract.test.ts`

**Interfaces:**
- Consumes: `chatJson` from Task 7, `ExtractedOffer` from `./types`.
- Produces: `normalizeOffer(raw: unknown): ExtractedOffer | null` (pure), `extractOffersFromEmail(subject: string, from: string, body: string): Promise<ExtractedOffer[]>`, `extractOfferFromText(text: string, link?: string): Promise<ExtractedOffer | null>`. Used by Tasks 10 and 12.

- [ ] **Step 1: Write the failing tests**

Create `web/lib/__tests__/extract.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeOffer } from "../extract";

describe("normalizeOffer", () => {
  it("keeps valid string fields and trims them", () => {
    const offer = normalizeOffer({
      employer: "  ESA ",
      title: "AI Engineer",
      location: "Luxembourg",
      ref_id: "REF-1",
      deadline: "2026-08-01",
      requirements: "Python, ML",
      link: "https://example.com/job",
    });
    expect(offer).toEqual({
      employer: "ESA",
      title: "AI Engineer",
      location: "Luxembourg",
      ref_id: "REF-1",
      deadline: "2026-08-01",
      requirements: "Python, ML",
      link: "https://example.com/job",
    });
  });

  it("coerces missing, empty, and non-string fields to null", () => {
    const offer = normalizeOffer({ title: "Dev", employer: 42, link: "" });
    expect(offer).toEqual({
      employer: null,
      title: "Dev",
      location: null,
      ref_id: null,
      deadline: null,
      requirements: null,
      link: null,
    });
  });

  it("returns null when both employer and title are missing", () => {
    expect(normalizeOffer({ location: "Paris" })).toBeNull();
  });

  it("returns null for non-objects", () => {
    expect(normalizeOffer("job")).toBeNull();
    expect(normalizeOffer(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `web/lib/extract.ts`:

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

const OFFER_SHAPE = `{
  "employer": "company name or null",
  "title": "position title or null",
  "location": "city/country or null",
  "ref_id": "job reference id or null",
  "deadline": "application deadline or null",
  "requirements": "2-4 sentence summary of the key requirements, or null",
  "link": "direct URL to the job posting or null"
}`;

export async function extractOffersFromEmail(
  subject: string,
  from: string,
  body: string,
): Promise<ExtractedOffer[]> {
  const prompt = `Below is an email. If it is job-related (a job-board alert digest with one or more listings, or a recruiter describing a position), extract every distinct job offer it contains. If it is not job-related (newsletter, receipt, personal mail, spam), return {"offers": []}.

Respond with ONLY strict JSON, no markdown fences, in this shape:
{"offers": [${OFFER_SHAPE}]}

Email subject: ${subject}
Email from: ${from}
Email body:
${body.slice(0, 15000)}`;

  const parsed = await chatJson(prompt);
  const offers = (parsed as { offers?: unknown[] } | null)?.offers;
  if (!Array.isArray(offers)) return [];
  return offers
    .map(normalizeOffer)
    .filter((o): o is ExtractedOffer => o !== null);
}

export async function extractOfferFromText(
  text: string,
  link?: string,
): Promise<ExtractedOffer | null> {
  const prompt = `Below is the text of a job posting. Extract its key characteristics.

Respond with ONLY strict JSON, no markdown fences, in this shape:
${OFFER_SHAPE}

${link ? `Posting URL: ${link}\n` : ""}Posting text:
${text.slice(0, 15000)}`;

  const offer = normalizeOffer(await chatJson(prompt));
  if (offer && link && !offer.link) offer.link = link;
  return offer;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git add web/lib/extract.ts web/lib/__tests__/extract.test.ts
git commit -m "feat: LLM offer extraction from emails and posting text

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Posting fetcher

**Files:**
- Create: `web/lib/fetchPosting.ts`
- Create: `web/lib/__tests__/fetchPosting.test.ts`

**Interfaces:**
- Produces: `htmlToPostingText(html: string): string` (pure) and `fetchPostingText(url: string): Promise<string | null>` — null on network error, non-OK status, non-HTML content, or suspiciously short pages (login walls / bot blocks). Used by Tasks 10 and 12.

- [ ] **Step 1: Write the failing tests**

Create `web/lib/__tests__/fetchPosting.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { htmlToPostingText } from "../fetchPosting";

describe("htmlToPostingText", () => {
  it("extracts readable text and skips nav/footer/script", () => {
    const html = `<html><body>
      <nav>Home | Jobs | About</nav>
      <h1>AI Engineer</h1>
      <p>We are hiring an <strong>AI Engineer</strong> in Luxembourg.</p>
      <script>track();</script>
      <footer>© Example Corp</footer>
    </body></html>`;
    const text = htmlToPostingText(html);
    expect(text).toContain("AI Engineer");
    expect(text).toContain("Luxembourg");
    expect(text).not.toContain("track()");
    expect(text).not.toContain("© Example Corp");
    expect(text).not.toContain("Home | Jobs");
  });

  it("collapses runs of blank lines", () => {
    const text = htmlToPostingText("<p>a</p><br/><br/><br/><br/><p>b</p>");
    expect(text).not.toMatch(/\n{3,}/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `web/lib/fetchPosting.ts`:

```ts
import { convert } from "html-to-text";

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
    ],
  });
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

export async function fetchPostingText(url: string): Promise<string | null> {
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
  return text.length >= 300 ? text.slice(0, 30_000) : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git add web/lib/fetchPosting.ts web/lib/__tests__/fetchPosting.test.ts
git commit -m "feat: job posting fetcher with HTML-to-text extraction

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Offer queries and API routes

**Files:**
- Create: `web/lib/offers.ts`
- Create: `web/app/api/assistant/offers/route.ts`
- Create: `web/app/api/assistant/offers/[id]/route.ts`

**Interfaces:**
- Consumes: `db()`, `createApplication`, `fetchPostingText`, `extractOfferFromText`, `Offer`/`ExtractedOffer` types.
- Produces (used by Tasks 11, 12):
  - `listOffers(): Promise<Offer[]>` — non-dismissed, newest first.
  - `createOffer(offer: ExtractedOffer, extra: { source: string; email_ref?: string | null; posting_text?: string | null; link?: string | null }): Promise<number>`.
  - `dismissOffer(id: number): Promise<void>`.
  - `applyToOffer(id: number): Promise<number | null>` — creates an application (status `pending`), retries the posting fetch if text is missing, dismisses the offer; returns the application id.
  - HTTP: `GET/POST /api/assistant/offers` (POST body `{ link?: string; text?: string }`; 422 with `{"error":"fetch_failed"}` when a link can't be fetched, 422 `{"error":"extraction_failed"}` when the LLM fails), `PATCH /api/assistant/offers/[id]` (body `{ action: "dismiss" | "apply" }`).

- [ ] **Step 1: Write the offer queries**

Create `web/lib/offers.ts`:

```ts
import { db } from "./db";
import { createApplication } from "./applications";
import { fetchPostingText } from "./fetchPosting";
import type { ExtractedOffer, Offer } from "./types";

export async function listOffers(): Promise<Offer[]> {
  const rows = await db()`
    SELECT id, to_char(created_at, 'YYYY-MM-DD') AS created_at, source, email_ref,
           link, posting_text, employer, title, location, ref_id, deadline, requirements
    FROM offers WHERE dismissed = false ORDER BY id DESC`;
  return rows as unknown as Offer[];
}

export async function createOffer(
  offer: ExtractedOffer,
  extra: {
    source: string;
    email_ref?: string | null;
    posting_text?: string | null;
    link?: string | null;
  },
): Promise<number> {
  const rows = await db()`
    INSERT INTO offers (source, email_ref, link, posting_text, employer, title,
                        location, ref_id, deadline, requirements)
    VALUES (${extra.source}, ${extra.email_ref ?? null}, ${extra.link ?? offer.link},
            ${extra.posting_text ?? null}, ${offer.employer}, ${offer.title},
            ${offer.location}, ${offer.ref_id}, ${offer.deadline}, ${offer.requirements})
    RETURNING id`;
  return (rows[0] as { id: number }).id;
}

export async function dismissOffer(id: number): Promise<void> {
  await db()`UPDATE offers SET dismissed = true WHERE id = ${id}`;
}

export async function applyToOffer(id: number): Promise<number | null> {
  const rows = await db()`SELECT * FROM offers WHERE id = ${id}`;
  if (rows.length === 0) return null;
  const offer = rows[0] as unknown as Offer;

  if (!offer.posting_text && offer.link) {
    const posting = await fetchPostingText(offer.link);
    if (posting) {
      await db()`UPDATE offers SET posting_text = ${posting} WHERE id = ${id}`;
      offer.posting_text = posting;
    }
  }

  const applicationId = await createApplication({
    offer_id: offer.id,
    link: offer.link,
    offer_text: offer.posting_text,
    employer: offer.employer,
    title: offer.title,
    ref_id: offer.ref_id,
  });
  await dismissOffer(id);
  return applicationId;
}
```

- [ ] **Step 2: Write the collection route**

Create `web/app/api/assistant/offers/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { sessionOk } from "@/lib/guard";
import { listOffers, createOffer } from "@/lib/offers";
import { extractOfferFromText } from "@/lib/extract";
import { fetchPostingText } from "@/lib/fetchPosting";

// Fetch (15s) + LLM extraction (up to 60s) must fit.
export const maxDuration = 120;

export async function GET() {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ offers: await listOffers() });
}

export async function POST(req: NextRequest) {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as { link?: string; text?: string };
  const link = body.link?.trim() || undefined;
  const text = body.text?.trim() || undefined;

  if (text) {
    const offer = await extractOfferFromText(text, link);
    if (!offer) {
      return NextResponse.json({ error: "extraction_failed" }, { status: 422 });
    }
    const id = await createOffer(offer, {
      source: "manual",
      posting_text: text,
      link: link ?? offer.link,
    });
    return NextResponse.json({ id }, { status: 201 });
  }

  if (link) {
    const posting = await fetchPostingText(link);
    if (!posting) {
      return NextResponse.json({ error: "fetch_failed" }, { status: 422 });
    }
    const offer = await extractOfferFromText(posting, link);
    if (!offer) {
      return NextResponse.json({ error: "extraction_failed" }, { status: 422 });
    }
    const id = await createOffer(offer, {
      source: "manual",
      posting_text: posting,
      link,
    });
    return NextResponse.json({ id }, { status: 201 });
  }

  return NextResponse.json({ error: "Provide a link or text" }, { status: 400 });
}
```

- [ ] **Step 3: Write the item route**

Create `web/app/api/assistant/offers/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { sessionOk } from "@/lib/guard";
import { dismissOffer, applyToOffer } from "@/lib/offers";

export const maxDuration = 60;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { action } = (await req.json()) as { action?: string };

  if (action === "dismiss") {
    await dismissOffer(Number(id));
    return NextResponse.json({ ok: true });
  }
  if (action === "apply") {
    const applicationId = await applyToOffer(Number(id));
    if (applicationId === null) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ application_id: applicationId });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
```

- [ ] **Step 4: Verify types and build**

Run: `npx tsc --noEmit && npm run build`
Expected: success. (Behavior verified via UI in Task 11.)

- [ ] **Step 5: Commit**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git add web/lib/offers.ts web/app/api/assistant/offers
git commit -m "feat: offer queries and API routes (manual add, dismiss, apply)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Offers UI

**Files:**
- Create: `web/app/assistant/components/AddOffer.tsx`
- Create: `web/app/assistant/components/OfferCard.tsx`
- Modify: `web/app/assistant/page.tsx` (replace placeholder)

**Interfaces:**
- Consumes: `listOffers` (server), `Offer` type from `@/lib/types`, HTTP routes from Task 10.
- Produces: working `/assistant` offers page. Task 12 adds the CheckEmailButton to this page's header.

- [ ] **Step 1: Write the add-offer form**

Create `web/app/assistant/components/AddOffer.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddOffer() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/assistant/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link, text }),
    });
    setBusy(false);
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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-purple px-3 py-1 text-sm"
      >
        + Add offer
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-full space-y-2 rounded border border-surface2 bg-surface p-4"
    >
      <input
        placeholder="Job posting link (optional if you paste text)"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        className="w-full rounded bg-surface2 p-2"
      />
      <textarea
        placeholder="Or paste the position description here"
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full rounded bg-surface2 p-2"
      />
      {message && <p className="text-sm text-yellow">{message}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-purple px-3 py-1 text-sm disabled:opacity-50"
        >
          {busy ? "Extracting…" : "Add"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded bg-surface2 px-3 py-1 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Write the offer card**

Create `web/app/assistant/components/OfferCard.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Offer } from "@/lib/types";

export default function OfferCard({ offer }: { offer: Offer }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: "dismiss" | "apply") {
    setBusy(true);
    const res = await fetch(`/api/assistant/offers/${offer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (action === "apply" && res.ok) {
      router.push("/assistant/applications");
    } else {
      router.refresh();
    }
  }

  return (
    <div className="rounded border border-surface2 bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="font-bold">{offer.title ?? "Untitled position"}</span>
          {offer.employer && <span className="text-gray"> — {offer.employer}</span>}
        </div>
        <span className="text-xs text-gray">
          {offer.source} · {offer.created_at}
        </span>
      </div>
      <div className="mt-1 space-y-1 text-sm text-gray">
        {offer.location && <div>Location: {offer.location}</div>}
        {offer.ref_id && <div>Ref: {offer.ref_id}</div>}
        {offer.deadline && <div>Deadline: {offer.deadline}</div>}
        {offer.requirements && <div className="text-text">{offer.requirements}</div>}
        {offer.email_ref && <div className="text-xs">From email: {offer.email_ref}</div>}
        {offer.link && (
          <a
            href={offer.link}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-blue hover:underline"
          >
            {offer.link}
          </a>
        )}
      </div>
      {offer.posting_text && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-blue">Full posting</summary>
          <pre className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap rounded bg-surface2 p-3 font-sans">
            {offer.posting_text}
          </pre>
        </details>
      )}
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => act("apply")}
          disabled={busy}
          className="rounded bg-purple px-3 py-1 text-sm disabled:opacity-50"
        >
          Apply
        </button>
        <button
          onClick={() => act("dismiss")}
          disabled={busy}
          className="rounded bg-surface2 px-3 py-1 text-sm disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Replace the offers page**

Replace the full contents of `web/app/assistant/page.tsx` with:

```tsx
import { listOffers } from "@/lib/offers";
import AddOffer from "./components/AddOffer";
import OfferCard from "./components/OfferCard";

export const dynamic = "force-dynamic";

export default async function OffersPage() {
  const offers = await listOffers();
  return (
    <div className="space-y-6">
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

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev` → `/assistant`.
Expected:
1. Add an offer with a public job-posting link (e.g. from jobs.lu) → card appears with extracted employer/title and the full posting under "Full posting".
2. Add an offer with a LinkedIn job link and no text → yellow message about the login wall; paste the description text → offer created from the text.
3. Dismiss an offer → disappears.
4. Apply on an offer → lands on `/assistant/applications` with a new `Pending` row carrying the offer's data (including offer text).

- [ ] **Step 5: Commit and deploy Stage 3**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git add web/app/assistant
git commit -m "feat: offers page with manual entry, dismiss, and apply

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```

Verify on Vercel with a real posting link.

---

# Stage 4 — Email scanning (Task 12)

### Task 12: IMAP scan, check-email route, and UI button

> **OWNER SETUP required before verification:** Google Account → Security → 2-Step Verification (must be on) → App passwords → create one named "yolosite". Add to `web/.env.local` AND Vercel env: `GMAIL_USER=attila.nemet@gmail.com`, `GMAIL_APP_PASSWORD=<16 chars, no spaces>`.

**Files:**
- Create: `web/lib/state.ts`
- Create: `web/lib/email.ts`
- Create: `web/app/api/assistant/check-email/route.ts`
- Create: `web/app/assistant/components/CheckEmailButton.tsx`
- Modify: `web/app/assistant/page.tsx`

**Interfaces:**
- Consumes: `db()`, `extractOffersFromEmail`, `extractOfferFromText`, `fetchPostingText`, `htmlToPostingText`, `createOffer`.
- Produces:
  - `getState(key)/setState(key, value)` on the `app_state` table.
  - `fetchEmailsSince(since: Date): Promise<InboxEmail[]>` where `InboxEmail = { messageId, subject, from, date, body }`.
  - `isProcessed(messageId)` / `markProcessed(messageId)` on `processed_emails`.
  - `POST /api/assistant/check-email` → `{ scanned, offersAdded, remaining }`.

**Design notes (implement exactly):**
- IMAP `SINCE` has day granularity, so re-fetching same-day messages is normal; the `processed_emails` table plus a date filter prevents double processing.
- Per run: at most 5 unprocessed emails, at most 8 posting fetches — keeps the request inside Vercel's function ceiling (`maxDuration = 300`, supported on the Hobby plan with Fluid Compute; if the deploy rejects it, lower to 60 and set `EMAILS_PER_RUN = 2`).
- `last_email_check` state only advances when a run drains all fresh emails; otherwise the next click continues where it left off.

- [ ] **Step 1: Write the state helpers**

Create `web/lib/state.ts`:

```ts
import { db } from "./db";

export async function getState(key: string): Promise<string | null> {
  const rows = await db()`SELECT value FROM app_state WHERE key = ${key}`;
  return rows.length ? (rows[0] as { value: string }).value : null;
}

export async function setState(key: string, value: string): Promise<void> {
  await db()`
    INSERT INTO app_state (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}
```

- [ ] **Step 2: Write the email module**

Create `web/lib/email.ts`:

```ts
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { db } from "./db";
import { htmlToPostingText } from "./fetchPosting";

export type InboxEmail = {
  messageId: string;
  subject: string;
  from: string;
  date: Date;
  body: string;
};

export async function fetchEmailsSince(since: Date): Promise<InboxEmail[]> {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER!,
      pass: process.env.GMAIL_APP_PASSWORD!,
    },
    logger: false,
  });

  await client.connect();
  const emails: InboxEmail[] = [];
  const lock = await client.getMailboxLock("INBOX");
  try {
    const uids = await client.search({ since });
    const recent = (uids || []).slice(-50); // hard cap per connection
    if (recent.length > 0) {
      for await (const message of client.fetch(recent, { source: true })) {
        const parsed = await simpleParser(message.source);
        const body =
          parsed.text?.trim() ||
          (parsed.html ? htmlToPostingText(parsed.html) : "");
        emails.push({
          messageId: parsed.messageId ?? `uid-${message.uid}`,
          subject: parsed.subject ?? "(no subject)",
          from: parsed.from?.text ?? "",
          date: parsed.date ?? new Date(),
          body,
        });
      }
    }
  } finally {
    lock.release();
  }
  await client.logout();
  return emails;
}

export async function isProcessed(messageId: string): Promise<boolean> {
  const rows = await db()`
    SELECT 1 FROM processed_emails WHERE message_id = ${messageId}`;
  return rows.length > 0;
}

export async function markProcessed(messageId: string): Promise<void> {
  await db()`
    INSERT INTO processed_emails (message_id) VALUES (${messageId})
    ON CONFLICT DO NOTHING`;
}
```

- [ ] **Step 3: Write the check-email route**

Create `web/app/api/assistant/check-email/route.ts`:

```ts
import { NextResponse } from "next/server";
import { sessionOk } from "@/lib/guard";
import { getState, setState } from "@/lib/state";
import { fetchEmailsSince, isProcessed, markProcessed, type InboxEmail } from "@/lib/email";
import { extractOffersFromEmail, extractOfferFromText } from "@/lib/extract";
import { fetchPostingText } from "@/lib/fetchPosting";
import { createOffer } from "@/lib/offers";
import type { ExtractedOffer } from "@/lib/types";

export const maxDuration = 300;

const EMAILS_PER_RUN = 5;
const FETCH_CAP = 8;
const DEFAULT_LOOKBACK_MS = 7 * 24 * 3600 * 1000;

export async function POST() {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lastCheck = await getState("last_email_check");
  const since = lastCheck
    ? new Date(lastCheck)
    : new Date(Date.now() - DEFAULT_LOOKBACK_MS);
  const scanStart = new Date();

  let emails: InboxEmail[];
  try {
    emails = await fetchEmailsSince(since);
  } catch (error) {
    return NextResponse.json(
      { error: `IMAP failed: ${String(error)}` },
      { status: 502 },
    );
  }

  const fresh: InboxEmail[] = [];
  for (const email of emails) {
    if (email.date <= since) continue; // IMAP SINCE is day-granular
    if (await isProcessed(email.messageId)) continue;
    fresh.push(email);
  }

  const batch = fresh.slice(0, EMAILS_PER_RUN);
  let offersAdded = 0;
  let fetches = 0;

  for (const email of batch) {
    const extracted = await extractOffersFromEmail(
      email.subject,
      email.from,
      email.body,
    );
    for (const offer of extracted) {
      let postingText: string | null = null;
      let enriched: ExtractedOffer = offer;

      if (offer.link && fetches < FETCH_CAP) {
        fetches += 1;
        postingText = await fetchPostingText(offer.link);
        if (postingText) {
          const better = await extractOfferFromText(postingText, offer.link);
          if (better) {
            enriched = {
              ...offer,
              ...Object.fromEntries(
                Object.entries(better).filter(([, v]) => v !== null),
              ),
            } as ExtractedOffer;
          }
        }
      }

      await createOffer(enriched, {
        source: "email",
        email_ref: `${email.subject} — ${email.date.toISOString().slice(0, 10)}`,
        // A recruiter email that yields exactly one offer IS the description.
        posting_text:
          postingText ??
          (extracted.length === 1 ? email.body.slice(0, 30_000) : null),
        link: enriched.link,
      });
      offersAdded += 1;
    }
    await markProcessed(email.messageId);
  }

  const remaining = fresh.length - batch.length;
  if (remaining === 0) {
    await setState("last_email_check", scanStart.toISOString());
  }

  return NextResponse.json({ scanned: batch.length, offersAdded, remaining });
}
```

- [ ] **Step 4: Write the button**

Create `web/app/assistant/components/CheckEmailButton.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CheckEmailButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function check() {
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/assistant/check-email", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setMessage(((await res.json()) as { error?: string }).error ?? "Failed");
      return;
    }
    const { scanned, offersAdded, remaining } = (await res.json()) as {
      scanned: number;
      offersAdded: number;
      remaining: number;
    };
    setMessage(
      `Scanned ${scanned} email${scanned === 1 ? "" : "s"}, added ${offersAdded} offer${offersAdded === 1 ? "" : "s"}` +
        (remaining > 0 ? `. ${remaining} more to scan — click again.` : "."),
    );
    router.refresh();
  }

  return (
    <span className="flex items-center gap-3">
      <button
        onClick={check}
        disabled={busy}
        className="rounded bg-blue px-3 py-1 text-sm disabled:opacity-50"
      >
        {busy ? "Checking…" : "Check email"}
      </button>
      {message && <span className="text-sm text-gray">{message}</span>}
    </span>
  );
}
```

- [ ] **Step 5: Add the button to the offers page**

In `web/app/assistant/page.tsx`, add the import and place the button next to AddOffer:

```tsx
import CheckEmailButton from "./components/CheckEmailButton";
```

and replace the header div with:

```tsx
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Offers</h1>
        <div className="flex flex-wrap items-center gap-3">
          <CheckEmailButton />
          <AddOffer />
        </div>
      </div>
```

- [ ] **Step 6: Verify against the real mailbox**

Run: `npm run dev` → `/assistant` → "Check email".
Expected: status line reports scanned/added counts; job-alert emails from the last 7 days appear as offers (digests → multiple cards); non-job emails add nothing. Click again if `remaining > 0`. A third click after draining reports `Scanned 0`. If quality of extraction is poor, inspect raw responses by temporarily logging in `chatJson` — but do not change the free-model default without owner approval.

- [ ] **Step 7: Commit and deploy Stage 4**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git add web/lib/state.ts web/lib/email.ts web/app/api/assistant/check-email web/app/assistant
git commit -m "feat: Gmail IMAP scanning with LLM offer extraction

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```

Set `GMAIL_USER`/`GMAIL_APP_PASSWORD` in Vercel env first, then verify "Check email" on production. If Vercel rejects `maxDuration = 300`, lower it to 60 and `EMAILS_PER_RUN` to 2, commit, and re-deploy.

---

# Stage 5 — Skill API (Task 13)

### Task 13: Skill endpoints and zip download

> **OWNER SETUP required before verification:** generate the token with `openssl rand -hex 32`; add `SKILL_API_TOKEN=<token>` to `web/.env.local` AND Vercel env.

**Files:**
- Modify: `web/lib/guard.ts`
- Create: `web/app/api/skill/pending/route.ts`
- Create: `web/app/api/skill/report/route.ts`
- Create: `web/app/api/assistant/applications/[id]/zip/route.ts`

**Interfaces:**
- Consumes: `db()`, `sessionOk`.
- Produces (consumed by the Task 14 skill):
  - `GET /api/skill/pending` with `Authorization: Bearer $SKILL_API_TOKEN` → `{ "applications": [{ id, employer, title, link, ref_id, offer_text }] }` (status `pending` only).
  - `POST /api/skill/report` same auth, JSON body `{ application_id: number, archive_path: string, zip_filename: string, zip_base64: string }` → sets status `docs_generated`, stores archive path and zip → `{ "ok": true }`.
  - `GET /api/assistant/applications/[id]/zip` (session auth) → zip download.
  - `skillOk(req: Request): boolean` in guard.ts.

- [ ] **Step 1: Add the bearer guard**

Append to `web/lib/guard.ts`:

```ts
export function skillOk(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  const token = process.env.SKILL_API_TOKEN;
  return Boolean(token) && header === `Bearer ${token}`;
}
```

- [ ] **Step 2: Write the pending route**

Create `web/app/api/skill/pending/route.ts`:

```ts
import { NextResponse } from "next/server";
import { skillOk } from "@/lib/guard";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  if (!skillOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await db()`
    SELECT id, employer, title, link, ref_id, offer_text
    FROM applications WHERE status = 'pending' ORDER BY id`;
  return NextResponse.json({ applications: rows });
}
```

- [ ] **Step 3: Write the report route**

Create `web/app/api/skill/report/route.ts`:

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
    zip_filename?: unknown;
    zip_base64?: unknown;
  };
  const { application_id, archive_path, zip_filename, zip_base64 } = body;
  if (
    typeof application_id !== "number" ||
    typeof archive_path !== "string" ||
    typeof zip_filename !== "string" ||
    typeof zip_base64 !== "string"
  ) {
    return NextResponse.json(
      {
        error:
          "Required: application_id (number), archive_path, zip_filename, zip_base64 (strings)",
      },
      { status: 400 },
    );
  }
  if (zip_base64.length > 6_000_000) {
    return NextResponse.json(
      { error: "Zip too large (max ~4.5 MB)" },
      { status: 413 },
    );
  }
  const rows = await db()`
    UPDATE applications
    SET status = 'docs_generated', archive_path = ${archive_path},
        zip_filename = ${zip_filename}, zip_base64 = ${zip_base64}
    WHERE id = ${application_id}
    RETURNING id`;
  if (rows.length === 0) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Write the zip download route**

Create `web/app/api/assistant/applications/[id]/zip/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { sessionOk } from "@/lib/guard";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await sessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const rows = await db()`
    SELECT zip_filename, zip_base64 FROM applications WHERE id = ${Number(id)}`;
  const row = rows[0] as
    | { zip_filename: string | null; zip_base64: string | null }
    | undefined;
  if (!row?.zip_base64) {
    return NextResponse.json({ error: "No documents stored" }, { status: 404 });
  }
  const bytes = Buffer.from(row.zip_base64, "base64");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${row.zip_filename ?? `application-${id}.zip`}"`,
    },
  });
}
```

- [ ] **Step 5: Verify with curl against the dev server**

With `npm run dev` running and at least one `pending` application in the DB (create one via the UI). Use the token from `web/.env.local`:

```bash
export SKILL_API_TOKEN=<value from web/.env.local>

# 1. Unauthorized without token:
curl -s http://localhost:3000/api/skill/pending
# → {"error":"Unauthorized"}

# 2. Pending list:
curl -s -H "Authorization: Bearer $SKILL_API_TOKEN" http://localhost:3000/api/skill/pending
# → {"applications":[{"id":...,"employer":...,...}]}

# 3. Report back with a test zip (replace <ID> with a real pending id):
cd /tmp && echo "test" > cv_test.txt && zip test.zip cv_test.txt
python3 -c "
import base64, json
zip_b64 = base64.b64encode(open('/tmp/test.zip','rb').read()).decode()
json.dump({'application_id': <ID>, 'archive_path': 'archive/test', 'zip_filename': 'test.zip', 'zip_base64': zip_b64}, open('/tmp/report.json','w'))
"
curl -s -X POST -H "Authorization: Bearer $SKILL_API_TOKEN" -H "Content-Type: application/json" \
  --data @/tmp/report.json http://localhost:3000/api/skill/report
# → {"ok":true}
```

Then in the browser: the application row shows status "Docs generated", the archive path, and a purple "zip" link that downloads `test.zip`.

- [ ] **Step 6: Commit and deploy Stage 5**

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git add web/lib/guard.ts web/app/api/skill web/app/api/assistant/applications
git commit -m "feat: skill API (pending, report) and application zip download

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```

Set `SKILL_API_TOKEN` in Vercel env, then repeat the curl checks against `https://yolosite.vercel.app`.

---

# Stage 6 — /apply skill in the cv repo (Task 14)

### Task 14: The `/apply` Claude Code skill

**Files (in the cv repo, `/mnt/c/Users/dajcs/code/cv`):**
- Create: `.claude/skills/apply/SKILL.md`
- Modify: `.gitignore` (add `.env` if not present)

**Interfaces:**
- Consumes: `GET /api/skill/pending` and `POST /api/skill/report` from Task 13 (exact shapes documented there).
- Produces: a user-invocable `/apply` skill in the cv repo.

**Constraint reminder:** the skill defers to the cv repo's CLAUDE.md for tailoring conventions and must contain no instructions about the invisible white-text keyword block (spec §4.3).

- [ ] **Step 1: Write the skill**

Create `/mnt/c/Users/dajcs/code/cv/.claude/skills/apply/SKILL.md`:

````markdown
---
name: apply
description: Tailor CV + cover letter for a pending job application pulled from the yolosite assistant, build the PDFs, archive, push, and report back. Use when the user runs /apply or asks to work on a pending application.
---

# Apply — tailor an application from the yolosite assistant

## Configuration

- `YOLOSITE_URL` — base URL of the assistant. Default: `https://yolosite.vercel.app`.
- `SKILL_API_TOKEN` — bearer token for the skill API. Read from the environment; if unset, read `.env` at the repo root (line `SKILL_API_TOKEN=...`). If still unset, stop and ask the user for it.

## Workflow

### 1. Fetch pending applications

```bash
curl -s -H "Authorization: Bearer $SKILL_API_TOKEN" "${YOLOSITE_URL:-https://yolosite.vercel.app}/api/skill/pending"
```

The response is `{"applications": [{"id", "employer", "title", "link", "ref_id", "offer_text"}]}`.

- If the user passed an id as the skill argument, use that application.
- If exactly one is pending, confirm it with the user.
- Otherwise list them (id — employer — title) and ask which one to work on.

If the chosen application's `offer_text` is empty but `link` is set, fetch the link content yourself; if that fails (login wall), ask the user to paste the job description.

### 2. Tailor per this repo's workflow

Follow the "Tailoring a new application" procedure in this repo's CLAUDE.md exactly. In summary:

- Choose a short `<target>` slug from employer/position (lowercase, underscores, e.g. `esa_ai_engineer`).
- Copy `cv.tex` → `cv_<target>.tex` and `cover.tex` → `cover_<target>.tex`.
- Adapt both to the job description per CLAUDE.md's rules (use `sources/` for reference, date rules, page limits, natural human tone, keep the template layout).
- Update `\hypersetup` (pdftitle, pdfsubject, pdfkeywords) for the role.
- Build each with two pdflatex passes; verify content with pdftotext.

### 3. Review loop with the user

Tell the user where the built PDFs are and wait for feedback. Apply requested changes and rebuild until the user approves.

If the application has extra questions to answer (the user will say so or they appear in the offer text), draft the answers together with the user and save them as `answers.md` next to the .tex files.

### 4. Archive and push

- Save the job description as `job.md` (offer text + link + ref id).
- Create `archive/<iso_date>_<target>/` containing: `cv_<target>.tex`, `cover_<target>.tex`, both PDFs, `job.md`, and `answers.md` if it exists.
- Clean the repo root of build artifacts per CLAUDE.md step 7.
- Commit and push:

```bash
git add archive/ && git commit -m "Application: <employer> — <title>" && git push
```

### 5. Report back to the assistant

Replace `<ID>`, `<iso_date>` and `<target>` with the real values:

```bash
cd archive/<iso_date>_<target>
zip -j /tmp/application.zip cv_<target>.tex cover_<target>.tex cv_<target>.pdf cover_<target>.pdf
python3 -c "
import base64, json
zip_b64 = base64.b64encode(open('/tmp/application.zip','rb').read()).decode()
json.dump({'application_id': <ID>, 'archive_path': 'archive/<iso_date>_<target>', 'zip_filename': '<iso_date>_<target>.zip', 'zip_base64': zip_b64}, open('/tmp/report.json','w'))
"
curl -s -X POST -H "Authorization: Bearer $SKILL_API_TOKEN" -H "Content-Type: application/json" \
  --data @/tmp/report.json "${YOLOSITE_URL:-https://yolosite.vercel.app}/api/skill/report"
```

Confirm the response is `{"ok":true}` and tell the user the application is now marked "Docs generated" in the assistant, with the zip downloadable there.
````

- [ ] **Step 2: Git-ignore the token file**

In `/mnt/c/Users/dajcs/code/cv/.gitignore`, ensure a line `.env` exists (create the file if the repo has none). Then create `/mnt/c/Users/dajcs/code/cv/.env` with `SKILL_API_TOKEN=<the token>` (owner provides the value; never commit it).

- [ ] **Step 3: Commit the skill (cv repo)**

```bash
cd /mnt/c/Users/dajcs/code/cv
git add .claude/skills/apply/SKILL.md .gitignore
git commit -m "Add /apply skill: tailor applications from the yolosite assistant

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```

- [ ] **Step 4: End-to-end verification (with the owner)**

1. In the deployed assistant, mark a real offer "Apply" (status `pending`).
2. In a new Claude Code session in the cv repo, run `/apply`.
3. Walk the full flow: fetch → tailor → build → review → archive → push → report.
4. In the assistant: status is "Docs generated", archive path shown, zip downloads and contains the four files.
5. Owner manually submits and flips status to "Applied".

This step requires the owner interactively; the executing agent prepares everything and hands over.

---

# Stage 7 — Polish and documentation (Task 15)

### Task 15: Mobile pass, docs, and cleanup

**Files:**
- Modify: `CLAUDE.md` (repo root)
- Modify: `README.md` (repo root)
- Modify: `docs/specs/2026-07-08-job-assistant-vision.md` (status line only)

**Interfaces:** none new.

- [ ] **Step 1: Mobile check**

Run `npm run dev`, open `/assistant` and `/assistant/applications` in a browser at 390px width (devtools device toolbar).
Expected: nav wraps or fits; offer cards stack; the applications table scrolls horizontally inside its container without the page itself scrolling sideways; forms are usable. Fix only concrete overflow/tap-target issues found — no redesign.

- [ ] **Step 2: Update CLAUDE.md**

Add a section to the repo-root `CLAUDE.md` after the existing "Architecture" section:

```markdown
## Job Application Assistant (private area)

Private tool at `/assistant` (Google sign-in, allow-listed to `ALLOWED_EMAIL`). Spec: `docs/specs/2026-07-08-job-assistant-vision.md`.

- `web/app/assistant/` — offers page, applications table, client components
- `web/app/api/assistant/*` — session-guarded routes (offers, applications, check-email, exports, zip)
- `web/app/api/skill/*` — bearer-token routes for the local `/apply` Claude Code skill in the `cv` repo
- `web/lib/` — `db.ts` (Neon), `types.ts` (client-safe types), `applications.ts`/`offers.ts` (queries), `email.ts` (Gmail IMAP), `extract.ts`/`llm.ts` (OpenRouter extraction), `fetchPosting.ts`, `csv.ts`, `state.ts`, `guard.ts`

Commands (from `web/`): `npm test` (vitest), `npm run db:init` (apply `lib/schema.sql` to Neon).

Env vars: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAIL`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `OPENROUTER_API_KEY`, `EXTRACTION_MODEL` (optional), `SKILL_API_TOKEN`.
```

- [ ] **Step 3: Update README.md**

Add one short paragraph (keep the README minimal per repo standards): the site includes a private job-application assistant at `/assistant`; see `docs/specs/2026-07-08-job-assistant-vision.md`.

- [ ] **Step 4: Mark the spec implemented**

In `docs/specs/2026-07-08-job-assistant-vision.md`, change the `Status:` line to `Status: implemented (see docs/plans/2026-07-09-job-assistant-implementation.md)`.

- [ ] **Step 5: Full check and final commit**

Run: `npm test && npm run build`
Expected: all pass.

```bash
cd /mnt/c/Users/dajcs/code/yolosite
git add CLAUDE.md README.md docs/specs/2026-07-08-job-assistant-vision.md
git commit -m "docs: document the job application assistant

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```

---

## Verification checklist (whole project)

- [ ] Public site at `/` unchanged (visual check + chat twin works).
- [ ] `/assistant` requires the allow-listed Google account; others rejected.
- [ ] "Check email" ingests job alerts and recruiter mails; repeats are not duplicated.
- [ ] Manual offer entry works for a fetchable link, a blocked link (paste fallback), and raw text.
- [ ] Apply creates a `pending` application; `/apply` in the cv repo picks it up, and reporting back flips it to "Docs generated" with a downloadable zip.
- [ ] Status lifecycle and notes editable inline; CSV and Excel exports carry the owner's exact columns.
- [ ] Everything works from a phone browser.
