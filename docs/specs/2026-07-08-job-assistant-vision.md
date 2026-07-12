# Job Application Assistant — Project Vision

Date: 2026-07-08
Status: implemented (see docs/plans/2026-07-09-job-assistant-implementation.md)

## 1. Summary

Extend **yolosite** (currently a public CV/portfolio single-page site) with a **private job-application assistant** for Attila's personal use. The assistant:

1. On request, scans Attila's Gmail for new job offers (job-board alerts and recruiter emails).
2. Presents a persistent, dismissible list of offers with the full job posting fetched and key characteristics extracted.
3. For positions Attila marks "apply", hands the job description off to **Claude Code running locally** in the separate `cv` repo, which tailors the CV + cover letter per that repo's instructions, builds PDFs, archives to GitHub, and reports back.
4. Tracks all applications in a table with a hand-updated status lifecycle and free-text notes, downloadable as CSV/Excel.

## 2. What stays / what goes

- **Stays:** the existing public portfolio site (Hero, About, Career, Skills, Education, School42, Portfolio, DigitalTwin chat, Contact) remains the public face of `https://yolosite.vercel.app/`. The DigitalTwin chat route (`api/chat`, OpenRouter free model) is unchanged.
- **Goes:** the self-hosted deployment at `yolosite.voxpo.me` will be taken down (owner action). Vercel is the only deployment. Docker files may remain for local dev.
- **New:** a private area (e.g. `/app`) behind authentication, accessible only to Attila, usable from desktop and phone browsers.

## 3. Systems involved

| System | Role |
|---|---|
| **Web app** (Next.js on Vercel, this repo) | Public site + private assistant UI + API routes + database access |
| **Gmail** (attila.nemet@gmail.com) | Source of job offers: job-board alerts (LinkedIn, Indeed, jobs.lu, etc.) and individual recruiter emails |
| **OpenRouter (free model)** | Cloud LLM for email parsing and job-characteristic extraction only |
| **`cv` repo on GitHub** (`../cv` locally) | Canonical store of CV/cover templates, tailoring instructions (its CLAUDE.md), and the `archive/<iso_date>_<target>/` record of finished applications |
| **Claude Code (local, Pro subscription)** | Does the actual CV/cover tailoring, extra-question answers, pdflatex builds, archiving, git push — via a custom skill (working name `/apply`) in the cv repo |
| **Database** (provider TBD) | Offers, applications table, statuses, notes, last-check timestamp |

Key constraint that shaped this split: a Claude Pro subscription cannot legally/technically power API calls from a deployed app, and the owner prefers not to pay for a separate API key for tailoring. Tailoring therefore runs locally under the Pro subscription; only lightweight extraction runs in the cloud (free OpenRouter model).

## 4. Core workflows

### 4.1 Check email
- Triggered manually from the private UI ("check my email"). No scheduled/automatic checking.
- Scans Gmail messages **newer than the last check** (timestamp persisted).
- Two email shapes: job-board alert digests (multiple listings per email) and recruiter emails (one position, described in body or attachment).
- For each candidate offer: follow the link, fetch the full posting, and extract structured characteristics (employer, position title, location, key requirements, reference ID, deadline if present) using the free OpenRouter model. No fit scoring / opinions.
- New offers are appended to the persistent offer list.

### 4.2 Triage
- Offer list shows all non-dismissed offers, newest first, with extracted characteristics and link to the original posting + source email.
- **Manual entry:** besides email scanning, an offer can be added by hand — paste a link (app fetches + extracts it) or paste/type the position description directly.
- Actions per offer: **dismiss** (hidden, kept in DB) or **apply** (creates an application row with status `pending`, queues it for local tailoring).

### 4.3 Tailoring (local, Claude Code)
- On Attila's machine, a custom Claude Code skill in the cv repo (working name `/apply`):
  1. Calls an authenticated web-app API endpoint to fetch pending application(s): job description text, link, extracted metadata.
  2. Follows the cv repo's existing CLAUDE.md workflow: copy `cv.tex`/`cover.tex` → `cv_<target>.tex`/`cover_<target>.tex`, adapt content, update hypersetup, build with two pdflatex passes, verify with pdftotext.
  3. Supports the review loop interactively in Claude Code: Attila previews PDFs, gives free-text feedback, regenerates until satisfied.
  4. Also generates answers to any extra application questions (some applications ask supplemental questions); answers are saved alongside the application in the archive.
  5. Archives the finalized pair + job description (+ extra answers) under `archive/<iso_date>_<target>/` and pushes to GitHub.
  6. Reports back to the web-app API: flips the application status to `docs generated` and records the GitHub archive path.
- **Hidden-block note:** the `/apply` skill defers to the cv repo's own CLAUDE.md for tailoring conventions and contains no instructions of its own about the invisible white-text keyword block — it neither inserts it nor strips it. That convention is owned and managed in the cv repo by the owner. The skill does explicitly cover the visible ATS optimization: hypersetup/pdfkeywords metadata and job-description keywords woven into the visible text.

### 4.4 Submission & tracking
- Attila submits applications manually (email or portal). The app never sends anything.
- Applications table columns: **Date | job offer link | job offer text | Employer | Position | job ref. id | Status | Notes**, plus links to the generated CV/cover PDFs in the GitHub archive.
- Status lifecycle, updated by hand in the UI: `pending` → `docs generated` → `applied` → `interview` → `offer` / `rejected`.
- Table downloadable on request as CSV and Excel.

## 5. Data stored

- **DB:** offers (source email ref or manual origin, link, fetched posting text, extracted fields, dismissed flag), applications (table columns above + archive path), last-check timestamp.
- **DB document store:** ~~when the `/apply` skill reports back, it uploads a single `.zip` containing the application's `.tex` sources and rendered PDFs; the zip is stored with the application row and downloadable on click in the UI.~~ *Superseded 2026-07-12: the skill reports two GitHub PDF links instead — see `docs/specs/2026-07-12-application-doc-links.md`.*
- **GitHub cv repo:** `.tex` sources, rendered PDFs, job description copy, extra-question answers — the canonical document archive, as today. The app additionally links to the archive path.

## 6. Access & security

- Single user: Attila, from any device (desktop + phone; private UI must be responsive).
- Private area protected by login. Gmail access requires Google OAuth in any case; sign-in restricted to attila.nemet@gmail.com is the natural mechanism (final choice in technical decisions).
- The local-skill API endpoints are authenticated with a secret (mechanism TBD in technical decisions).
- Gmail scope should be read-only.

## 7. Non-goals (MVP)

- No automatic/scheduled email checking.
- No fit scoring or ranking of offers.
- No sending of applications or email drafts.
- No cloud-side CV generation or LaTeX compilation.
- No multi-user support.
- No changes to the public portfolio content.

## 8. Decisions already made (with reasons)

| Decision | Choice | Why |
|---|---|---|
| Site structure | Keep public site, add private `/app` area | Portfolio stays useful; one deployment |
| Email source | Gmail, alert digests + recruiter mails | Where offers arrive |
| Offer scan window | Since last check; persistent dismissible list | No re-processing, nothing lost |
| Offer enrichment | Fetch full posting + structured extraction, no scoring | Needed for tailoring/archive anyway |
| Tailoring execution | Local Claude Code under Pro subscription | Pro can't be used from a deployed app; avoids API costs |
| Cloud LLM | OpenRouter free model, extraction only | Lightweight structured task; zero cost |
| cv repo | Remains canonical archive; local skill pushes to GitHub | Preserves existing workflow |
| Handoff out | `/apply` skill pulls pending jobs from app API | One command, no copy-paste |
| Handoff back | Skill reports status + archive path to app API | Fully automatic, symmetric |
| Review loop | Interactive in Claude Code (preview + feedback + extra questions) | Tailoring lives where the LLM runs |
| Tracking | Full lifecycle statuses + notes; CSV/Excel export | Owner's spec |
| Submission | Manual by owner | Owner's spec |
| Manual offer entry | Paste a link or a position text besides email scanning | Owner's spec |
| Document storage | Per-application `.zip` (.tex + .pdf) stored app-side, downloadable; GitHub archive remains canonical | Owner's spec |
| Hidden keyword block | Skill is silent on it (defers to cv repo conventions); visible ATS optimization automated | Assistant's constraint + owner's repo ownership |

## 9. Technical decisions (settled 2026-07-09)

| # | Area | Decision | Notes |
|---|---|---|---|
| 1 | Database | **Neon Postgres** via Vercel integration; per-application `.zip` stored as a binary column in Postgres | One service; portable plain Postgres; fine at owner's scale |
| 2 | Gmail access | **IMAP with a Gmail app password** (env var), read-only usage | Avoids Google's restricted-scope verification and the 7-day token expiry of Testing-mode OAuth |
| 3 | Login | **Auth.js (NextAuth v5) Google sign-in, identity only**, allow-listed to attila.nemet@gmail.com | No Gmail scopes → no restricted-scope issues; one-click on any device |
| 4 | Posting fetch | **Plain server-side fetch + text extraction**, falling back to email content and manual paste when blocked (LinkedIn etc.) | Upgradeable to a scraping service later if needed |
| 5 | Skill API auth | Static bearer secret `SKILL_API_TOKEN` in Vercel env + local env | Rotate to revoke |
| 6 | Exports | CSV natively; Excel via `exceljs` | Download endpoints on the applications table |
| 7 | Frontend | Existing stack unchanged (Next.js 16, React 19, Tailwind v4, existing color tokens) | Private area under `/app` route group |
| 8 | Extraction LLM | OpenRouter free model via existing `OPENROUTER_API_KEY` | Same setup as the DigitalTwin chat |
| 9 | Housekeeping | Docker compose kept for local dev; legacy root files untouched; voxpo.me takedown is an owner action outside this project | |

### Required owner setup (one-time)
1. **Neon Postgres**: add via Vercel dashboard → Storage → Neon (free tier); `DATABASE_URL` lands in env automatically.
2. **Gmail app password**: Google Account → Security → 2-Step Verification → App passwords → generate; store as `GMAIL_APP_PASSWORD` (+ `GMAIL_USER`) in Vercel env.
3. **Google OAuth client** (login only): Google Cloud Console → new project → OAuth consent screen (External, Testing is fine — identity-only scopes don't expire the same way) → OAuth client ID (Web) with the Vercel callback URL; store `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` + `AUTH_SECRET` in env.
4. **`SKILL_API_TOKEN`**: generate a random secret; set in Vercel env and locally for the `/apply` skill.
