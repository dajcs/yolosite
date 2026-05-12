# CONCERNS.md
# Technical Debt and Issues
# Last mapped: 2026-05-12

## Critical Bugs

### 1. Static Export vs. API Routes Conflict
- **File:** `web/next.config.ts`
- **Issue:** `output: "export"` produces a static site with no server — API routes (including `/api/chat`) are silently excluded from the build. The Digital Twin chat feature is permanently broken when deployed as a static export (GitHub Pages).
- **Impact:** Digital Twin / AI chat is non-functional in production.

### 2. Docker Build Broken
- **File:** `Dockerfile`
- **Issue:** Dockerfile expects `.next/standalone` output mode, but `next.config.ts` is set to `output: "export"`. The build produces a static site, not a standalone server — Docker deployments fail silently.
- **Impact:** `docker compose up` produces a broken container.

### 3. BasePath Not Applied to API Fetch
- **File:** `web/app/components/DigitalTwin.tsx` (or wherever chat fetch lives)
- **Issue:** `fetch("/api/chat")` ignores `basePath: '/yolosite'` configured in `next.config.ts`. On GitHub Pages the correct path is `/yolosite/api/chat`.
- **Impact:** Chat requests 404 even if API routes were enabled.

## Security Issues

| Severity | Issue | Location |
|----------|-------|----------|
| High | No rate limiting on `/api/chat` — free OpenRouter quota can be exhausted | `web/app/api/chat/route.ts` |
| Medium | OpenRouter error bodies forwarded verbatim to client (info leakage) | `web/app/api/chat/route.ts` |
| Medium | Message `role` field not validated — system prompt injection possible | `web/app/api/chat/route.ts` |
| Low | No CORS/origin validation on the chat API route | `web/app/api/chat/route.ts` |

## Tech Debt

### Inline Style Props Instead of Tailwind Tokens
- **Scope:** All 11 component files
- CSS variables (`--yellow`, `--blue`, etc.) are registered as Tailwind tokens in `globals.css` via `@theme inline`, but components use `style={{ color: 'var(--yellow)' }}` instead of `text-yellow` / `bg-yellow` Tailwind classes.
- Inconsistent mixing makes theming harder.

### Unnecessary `"use client"` Directives
- Every component file has `"use client"` at the top, regardless of whether it actually uses client-side hooks or browser APIs.
- Several sections (e.g. Education, School42, Footer) are fully static and could be Server Components, reducing bundle size.

### Hand-Rolled `.env` Parser
- **File:** `web/next.config.ts`
- Custom `.env` parsing logic that silently fails on comments or malformed lines. Should use `dotenv` or rely on Next.js built-in `.env` handling.

## Content Bugs

| File | Issue |
|------|-------|
| `web/app/components/Education.tsx` | Typo: "Cybersecuirty" (should be "Cybersecurity") |
| Portfolio component | `status` field stores a URL but renders as a text badge with no hyperlink — dead links |

## Missing Features

- No `<meta og:*>` / Twitter card tags — poor social sharing previews
- No `robots.txt` or `sitemap.xml`
- No `useReducedMotion()` — animations play even for users with motion sensitivity preferences
- No skeleton/loading states for the chat UI
- Zero automated tests — no CI quality gate

## Fragile Areas

- **`next.config.ts` `.env` parser** — brittle, undocumented, easy to break with `.env` comment lines
- **Digital Twin chat** — depends on `OPENROUTER_API_KEY` at runtime; fails silently if missing with no user-visible error message
- **Static/server split** — `output: "export"` vs Docker/standalone is a latent contradiction that will re-surface every deployment
