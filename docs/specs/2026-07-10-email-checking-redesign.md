# Email Checking Redesign — Design Spec

Date: 2026-07-10
Status: approved by owner (brainstormed and decided 2026-07-10)
Supersedes: the "check email" workflow of `docs/specs/2026-07-08-job-assistant-vision.md` §4.1 and Task 12 of `docs/plans/2026-07-09-job-assistant-implementation.md`. Everything else in those documents (offers triage, applications, exports, skill API, `/apply` skill) is unchanged.

## 1. Problem

The Task 12 implementation (`POST /api/assistant/check-email`, OpenRouter free model) is not good enough:

1. **Unreliable extraction** — the free OpenRouter model misses offers and returns malformed output. Free-tier routing is flaky.
2. **Slow, capped scans** — a serverless request downloads full email bodies and processes at most 5 emails per click. The owner wants all emails handled from a single click.
3. **Missing postings** — `fetchPostingText()` returns `null` for many valid links (bot blocks, JS-rendered pages, e.g. LinkedIn).
4. **Cookie noise** — fetched postings are polluted with cookie-consent boilerplate.
5. **No visibility** — one opaque button; no way to see which emails exist, which were processed, or what was found.

Constraint that shaped the solution: extraction must stay effectively free. A Claude Pro / ChatGPT Plus subscription cannot legally or technically power API calls from a deployed Vercel app, so a cloud LLM with a real free tier is used instead.

## 2. Decisions (all agreed with owner)

| # | Area | Decision |
|---|---|---|
| 1 | Extraction LLM | **Google Gemini API free tier** with native JSON-schema structured output. `GEMINI_API_KEY` env var; model via `GEMINI_MODEL`, default `gemini-2.5-flash`. The public DigitalTwin chat (`/api/chat`) stays on OpenRouter, untouched. |
| 2 | Flow | **Two-phase**: (1) fast header-only listing of all emails in a date range, color-classified; (2) one-click "pull all" that extracts offers email-by-email with live progress. |
| 3 | Pull scope | "Pull all" processes **green + yellow** emails only (predicted-job + unknown). Red (predicted no-job) emails are skipped but can be pulled individually. |
| 4 | Classification learning | **Automatic by sender + manual override.** After a pull, the email is classified `job`/`no_job` by whether offers were found. New emails inherit the most recent classification of the same sender. Clicking a row's color chip cycles the classification manually; manual marks are never overwritten by automatic classification. |
| 5 | Live progress | **Client-driven loop** — the browser calls a pull endpoint once per email and updates the UI after each call. No SSE, no long-running function. Naturally respects Gemini free-tier rate limits (~10–15 requests/min). |
| 6 | Posting fetch | **Direct fetch → Jina Reader fallback.** Plain fetch first; if blocked/short, retry via `https://r.jina.ai/<url>` (free, renders JS, returns clean markdown). Optional `JINA_API_KEY` raises its rate limits. Consent-banner selectors added to `htmlToPostingText()`. |

## 3. Architecture overview

```
Phase 1 (one fast request)
  UI date range [start=last checked, end=today]
    → POST /api/assistant/emails/list {start, end}
    → IMAP header-only fetch (envelopes, no bodies)
    → upsert rows into `emails` table, predict classification by sender
    → return all rows → UI renders color-coded email table

Manual override (any time)
  click color chip on a row
    → PATCH /api/assistant/emails/[id] {classification}  (sets manual=true)

Phase 2 (client loop, one request per email)
  "Pull all" button
    → for each unpulled green/yellow row, sequentially:
        POST /api/assistant/emails/[id]/pull
          → IMAP fetch this ONE body (by UID)
          → Gemini: extract offers (structured output)
          → per offer with link: fetch posting (direct → Jina), Gemini re-extract
          → insert offers, update email row (pulled_at, offers_found, classification)
          → return {offers, ...} → UI appends to live progress log
```

Everything runs inside the existing authenticated `/assistant` area (Auth.js session guard via `sessionOk()`), same as all other assistant routes.

## 4. Data model

New table `emails` (add to `web/lib/schema.sql`; init script is idempotent):

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

- `classification` ∈ `'job' | 'no_job' | 'unknown'`. UI color mapping: `job` → green tint, `no_job` → red tint, `unknown` → yellow tint.
- `uid` is the IMAP UID in INBOX, stored at listing time so the pull endpoint can fetch the single body without re-searching. (UIDs are stable per mailbox unless UIDVALIDITY changes; if a UID fetch returns nothing, the pull endpoint reports a clear error and the row can be re-listed.)
- `manual = true` means the owner set the color by hand; automatic post-pull classification must not overwrite it.
- `pulled_at IS NOT NULL` means the email body was processed. Re-listing the same date range must not reset pulled/classification state (upsert keeps existing values, only refreshes header fields).
- **Sender prediction**: for a newly inserted email, classification = the classification of the most recent *classified* (`classification != 'unknown'`) email with the same `from_addr`, else `'unknown'`. One SQL query over `emails`; no separate senders table.
- The old `processed_emails` table is superseded by `pulled_at` and dropped (`DROP TABLE IF EXISTS processed_emails` — dev-stage data, nothing to migrate).
- `app_state` key `last_email_check` remains: it is the default **start date** of the next listing, and is set to the listing's **end date** after a successful list.

Existing `offers` table and offer flow are unchanged; pulled offers are inserted via the existing `createOffer()` with `source: "email"`.

## 5. Components

### 5.1 `web/lib/llm.ts` — Gemini client

Replace the OpenRouter `chatJson()` with a Gemini call (keep `parseModelJson()` as safety net for tests and defensive parsing):

- Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent`, header `x-goog-api-key: <GEMINI_API_KEY>`.
- Model: `process.env.GEMINI_MODEL ?? "gemini-2.5-flash"`. Free tier: Flash ≈ 10 RPM / 250 req/day; if the daily cap becomes a problem, set `GEMINI_MODEL=gemini-2.5-flash-lite` (≈ 15 RPM / 1000 req/day).
- Request body:
  ```json
  {
    "contents": [{ "parts": [{ "text": "<prompt>" }] }],
    "generationConfig": {
      "responseMimeType": "application/json",
      "responseSchema": { ... }
    }
  }
  ```
- Signature: `chatJson(prompt: string, schema: object): Promise<unknown | null>` — the caller supplies the response schema, so the two extraction shapes (offers array vs single offer) each get an exact schema. Response text is at `candidates[0].content.parts[0].text`; parse with `parseModelJson()`.
- Rate-limit signalling: on HTTP 429 return a distinguishable value (e.g. throw a typed error or return a `{rateLimited: true}` marker) so the pull endpoint can respond `429` and the client can wait and retry. All other failures → `null` (same contract as today).

### 5.2 `web/lib/extract.ts` — prompts + schemas

- `normalizeOffer()` unchanged (still the validation layer).
- `extractOffersFromEmail(subject, from, body)` now returns `ExtractedOffer[] | null` — `null` means the model call failed (leave the email unpulled, show an error), `[]` means the model answered "no job offers" (mark pulled, classify `no_job`). `extractOfferFromText(text, link?)` keeps its signature. Both pass Gemini response schemas mirroring `ExtractedOffer` (all fields nullable strings; email variant wraps in `{"offers": [...]}`). Prompts can drop the "respond with ONLY strict JSON" boilerplate — structured output guarantees shape — but keep the classification instruction (non-job email → empty offers array).

### 5.3 `web/lib/email.ts` — IMAP

- `listEmailHeaders(start: Date, end: Date): Promise<EmailHeader[]>` — connect, `search({ since: start, before: end+1day })` (IMAP dates are day-granular), `fetch(..., { envelope: true, uid: true })`. No bodies, no `source: true` — this is what makes listing fast. Returns `{messageId, uid, date, from, to, subject}`.
- `fetchEmailBody(uid: number): Promise<{subject, from, body} | null>` — fetch one message by UID with `source: true`, parse with `mailparser`, body = text or `htmlToPostingText(html)` (as today).
- `fetchEmailsSince()`, `isProcessed()`, `markProcessed()` are deleted along with their callers.

### 5.4 `web/lib/emails.ts` — email-row queries (new)

- `upsertEmails(headers)` — insert new rows with predicted classification (sender lookup); on conflict update only header fields (`uid`, `date`, `from_addr`, `to_addr`, `subject`).
- `listEmails(start, end)` — rows in range, newest first.
- `setClassification(messageId, classification)` — manual override, sets `manual = true`.
- `markPulled(messageId, offersFound)` — sets `pulled_at`, `offers_found`, and (only when `manual = false`) classification to `job`/`no_job`.
- `getEmail(messageId)` — single row for the pull endpoint.

### 5.5 `web/lib/fetchPosting.ts` — Jina fallback + consent cleanup

- `htmlToPostingText()` gains skip-selectors for common consent containers (e.g. `#onetrust-consent-sdk`, `#CybotCookiebotDialog`, `[id*="cookie" i]`, `[class*="cookie-banner" i]`, `[aria-label*="cookie" i]`) and a post-filter dropping lines that are obviously consent text.
- `fetchPostingText(url)`: direct fetch as today → if result is `null`, retry via `GET https://r.jina.ai/<url>` (plain text response; optional `Authorization: Bearer <JINA_API_KEY>` header when set; generous timeout ~25 s). Jina result subject to the same ≥300-char sanity check and 30 000-char cap.

### 5.6 API routes (all session-guarded)

| Route | Method | Behavior |
|---|---|---|
| `/api/assistant/emails/list` | POST `{start, end}` (ISO dates) | IMAP header listing → `upsertEmails` → `setState("last_email_check", end)` → returns `{emails: EmailRow[]}` |
| `/api/assistant/emails/[id]` | PATCH `{classification}` | Manual color set (`[id]` = URL-encoded `message_id`). Returns updated row. |
| `/api/assistant/emails/[id]/pull` | POST | Pull one email (see §3 Phase 2). Returns `{offers: ExtractedOffer[], offersFound, classification}`. On Gemini rate limit returns HTTP 429 → client waits ~30 s and retries the same email (max 3 attempts). Errors (IMAP miss, etc.) return 4xx/5xx with a message shown inline on that row. |
| `/api/assistant/check-email` | — | **Deleted**, together with `CheckEmailButton.tsx`. |

### 5.7 UI — `web/app/assistant/components/EmailPanel.tsx` (client)

Replaces `CheckEmailButton` on the `/assistant` page (rendered above the offers list; the server component passes `lastCheck` from `app_state`).

- **Date range**: two `<input type="date">` — start defaults to `last_email_check` (or 7 days back if unset), end defaults to today.
- **"List emails"** button → calls list route, renders the email table: Date | From | To | Subject | color chip. Row background tinted by classification (green/red/yellow at low opacity over the dark theme, e.g. `bg-green-500/10`-style tints consistent with existing tokens; text stays readable).
- **Color chip click** → cycles `job → no_job → unknown` via PATCH, updates row instantly.
- **"Pull all"** button → sequential client loop over unpulled green + yellow rows: current row shows a spinner; finished rows show `n offers` (and the extracted titles) or an error; a header line shows `Pulled 12/34 — 5 offers found`. A per-row "pull" affordance lets red or failed rows be pulled individually. After the loop, `router.refresh()` so the offers list below updates (or refresh incrementally per pull).
- Pulled rows are visually marked (e.g. dimmed / checkmark) and excluded from subsequent "Pull all" runs.
- The page must stay open during a pull (client-driven loop); this is acceptable to the owner.
- Mobile: the table collapses gracefully (horizontal scroll or stacked layout) — private pages must remain phone-usable.

## 6. Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | yes (new) | Gemini API key — aistudio.google.com → "Get API key" (free) |
| `GEMINI_MODEL` | no | Default `gemini-2.5-flash`; set `gemini-2.5-flash-lite` if the daily free cap bites |
| `JINA_API_KEY` | no | Raises r.jina.ai rate limits; works without it |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | existing | IMAP |
| `OPENROUTER_API_KEY` | existing | DigitalTwin chat only (no longer used for extraction) |

Set new vars in `web/.env.local` and Vercel project env. `EXTRACTION_MODEL` (OpenRouter-era) is retired.

## 7. Error handling (keep it simple)

- Gemini 429 → route returns 429, client waits and retries that email (bounded). Any other Gemini failure → `chatJson` returns `null` → email is marked pulled with 0 offers and classified `no_job` only if the model actually responded with an empty offers list; a `null` (transport/parse failure) leaves the email unpulled and surfaces an inline error so it can be retried.
- IMAP failures → 502 with message, shown in the panel.
- Posting fetch failure after both attempts → offer is still created from email-derived data (same fallback as today: single-offer recruiter emails use the email body as `posting_text`).

## 8. Testing

Pure-function vitest coverage (no network in tests, consistent with the existing suite):

- Gemini response parsing (`candidates[0].content.parts[0].text` → object; malformed → null).
- Sender-prediction SQL logic exercised via a pure helper where practical, otherwise verified manually in the browser.
- Consent-noise stripping in `htmlToPostingText` (fixture HTML with a cookie banner → banner text absent, job text present).
- Existing `normalizeOffer` / `parseModelJson` / `toCsv` tests keep passing.

Manual verification steps per stage (browser against real Gmail + Gemini), as in the existing plan.

## 9. Non-goals

- No scheduled/automatic checking (still manual).
- No background jobs / queues — the client loop is the orchestrator.
- No changes to offers/applications/exports/skill-API/public site.
- No ML classifier — sender history + manual override only.
