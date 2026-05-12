# External Integrations

**Analysis Date:** 2026-05-12

## APIs & External Services

**AI / LLM:**
- OpenRouter - Proxies LLM completions for the Digital Twin chat feature
  - Endpoint: `https://openrouter.ai/api/v1/chat/completions`
  - Model: `openai/gpt-oss-120b:free`
  - SDK/Client: Native `fetch` (no SDK)
  - Auth: `OPENROUTER_API_KEY` environment variable
  - Implementation: `web/app/api/chat/route.ts` — streaming POST route returning SSE (`text/event-stream`)
  - Consumed by: `web/app/components/DigitalTwin.tsx` — client calls `/api/chat` with message history

## Data Storage

**Databases:**
- None — no database used. Application is fully stateless.

**File Storage:**
- Local filesystem only — static assets in `web/public/`, source PDFs in `sources/`, images in `img/`

**Caching:**
- None — API route sets `Cache-Control: no-cache`

## Authentication & Identity

**Auth Provider:**
- None — no user authentication or session management

## Monitoring & Observability

**Error Tracking:**
- None

**Logs:**
- Server-side errors returned as JSON error responses; no structured logging framework

## CI/CD & Deployment

**Hosting:**
- GitHub Pages — static export deployed to `https://<user>.github.io/yolosite`
- Docker — self-hosted via `docker-compose.yml` at repo root (port 3000)

**CI Pipeline:**
- GitHub Actions — `.github/workflows/nextjs.yml`
  - Trigger: push to `main` branch or manual dispatch
  - Steps: checkout → Node.js 24 setup → `npm ci` → `npm run build` → upload `web/out/` artifact → deploy to GitHub Pages
  - Uses: `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-pages-artifact@v4`, `actions/deploy-pages@v4`

## Environment Configuration

**Required env vars:**
- `OPENROUTER_API_KEY` — API key for OpenRouter LLM service; must be set in root-level `.env` for Docker or as a GitHub Actions secret for CI

**Secrets location:**
- Root-level `.env` file (gitignored); loaded at build/runtime by `web/next.config.ts` using Node.js `fs`
- Note: static export (`output: "export"`) means API routes are NOT included in the GitHub Pages build — the Digital Twin chat feature only works in Docker/server deployments

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None (OpenRouter is called on-demand per user message, not via webhook)

---

*Integration audit: 2026-05-12*
