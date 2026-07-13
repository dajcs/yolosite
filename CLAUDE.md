# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Run from repo root with Docker:

```bash
docker compose up --build
```

## Architecture

Single-page Next.js 16 app (React 19, TypeScript, Tailwind v4, Framer Motion, Lucide React). Everything lives in `web/app/`:

- `page.tsx` — composes all section components in order
- `layout.tsx` — sets `<html>` and global metadata
- `globals.css` — defines all CSS variables (colors, surfaces) and registers them as Tailwind tokens via `@theme inline`
- `components/` — one file per page section (Hero, About, Career, Skills, Education, School42, Portfolio, DigitalTwin, Contact, Nav, Footer)
- `api/chat/route.ts` — streaming POST route; proxies to OpenRouter (`OPENROUTER_MODEL`, default `nvidia/nemotron-3-super-120b-a12b:free`), returns SSE; requires `OPENROUTER_API_KEY` env var (provided via `env_file: .env` in docker-compose.yml)

## Job Application Assistant (private area)

Private tool at `/assistant` (Google sign-in, allow-listed to `ALLOWED_EMAIL`).
Spec: `docs/specs/2026-07-08-job-assistant-vision.md`; email flow:
`docs/specs/2026-07-10-email-checking-redesign.md`.

- `web/app/assistant/` — offers + email panel page, applications table, client components
- `web/app/api/assistant/*` — session-guarded routes (offers, applications, emails
  list/pull, CSV/Excel export); application docs are GitHub links (`cv_url`, `letter_url`)
- `web/app/api/skill/*` — bearer-token routes (`SKILL_API_TOKEN`) for the local `/apply`
  Claude Code skill in the `cv` repo
- `web/lib/` — `db.ts` (Neon), `types.ts` (client-safe types), `applications.ts`/`offers.ts`/
  `emails.ts` (queries), `dedup.ts` (duplicate-offer matching: cleaned-link / employer+ref rules),
  `email.ts` (Gmail IMAP: header listing + single-body fetch),
  `llm.ts` (Gemini structured output, default `gemini-flash-lite-latest`), `extract.ts`
  (offer extraction), `fetchPosting.ts` (direct fetch → Jina Reader fallback, LinkedIn guest
  endpoint, link cleanup), `csv.ts`, `exportColumns.ts`, `state.ts`, `guard.ts`

Commands (from `web/`): `npm test` (vitest), `npm run db:init` (apply `lib/schema.sql` to Neon).

Env vars: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAIL`,
`GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GEMINI_API_KEY`, `GEMINI_MODEL` (optional), `JINA_API_KEY`
(optional), `SKILL_API_TOKEN`. The public chat uses `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` (optional).

## Color Scheme

Use these CSS variables (available as Tailwind classes like `text-yellow`, `bg-surface`):

| Variable     | Hex       | Use                            |
|-------------|-----------|--------------------------------|
| `--yellow`  | `#ecad0a` | Accent lines, highlights       |
| `--blue`    | `#209dd7` | Links, key sections            |
| `--purple`  | `#753991` | Submit buttons, important actions |
| `--navy`    | `#032147` | Main headings                  |
| `--gray`    | `#888888` | Supporting text, labels        |
| `--bg`      | `#060f1e` | Page background                |
| `--surface` | `#0a1a30` | Card backgrounds               |
| `--surface2`| `#0d2040` | Nested card backgrounds        |

## Coding Standards

- Latest library versions, idiomatic approaches
- Keep it simple — no over-engineering, no unnecessary defensive programming, no extra features
- Keep README minimal

## AGENTS.md

The original project requirements in @AGENTS.md
Should be used as a reference when implementing features or making design decisions.
