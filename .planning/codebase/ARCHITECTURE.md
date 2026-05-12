# ARCHITECTURE.md
# System Design and Patterns
# Last mapped: 2026-05-12

## Pattern

**Single-page application (SPA)** built with Next.js 16 in static export mode (`output: "export"`).

The app is a single route (`/`) that composes all page sections vertically. Navigation is anchor-scroll based, not router-based. No dynamic routes exist.

## Deployment Model

```
Static export (next build → out/)
  └── Hosted on GitHub Pages at /yolosite
      basePath: '/yolosite' configured in next.config.ts

Docker (docker compose up)
  └── Intended: standalone server mode
      Actual: broken — contradicts output: "export" (see CONCERNS.md)
```

## Layer Diagram

```
┌─────────────────────────────────────────────────────┐
│  Browser                                            │
│  ┌──────────────────────────────────────────────┐  │
│  │  page.tsx  (root composition)                │  │
│  │  Nav + [Hero, About, Career, Skills,         │  │
│  │   Education, School42, Portfolio,            │  │
│  │   DigitalTwin, Contact] + Footer             │  │
│  └──────────────────────────────────────────────┘  │
│           │ fetch("/api/chat") — SSE stream         │
└───────────┼─────────────────────────────────────────┘
            │ (only works in server/Docker mode)
┌───────────▼─────────────────────────────────────────┐
│  Next.js Server (when NOT static export)            │
│  web/app/api/chat/route.ts                          │
│  → proxies to OpenRouter (streaming POST)           │
└─────────────────────────────────────────────────────┘
```

## Entry Points

| Entry | File | Purpose |
|-------|------|---------|
| Page root | `web/app/page.tsx` | Composes all section components |
| HTML shell | `web/app/layout.tsx` | `<html>`, global metadata, font config |
| Global styles | `web/app/globals.css` | CSS variables + Tailwind `@theme inline` tokens |
| API route | `web/app/api/chat/route.ts` | Streaming chat proxy to OpenRouter |
| Config | `web/next.config.ts` | Build config + hand-rolled `.env` loader |

## Data Flow

### Static Content
All section content (career history, skills, education data) is hard-coded as TypeScript constants co-located in each component file. No CMS, no database, no data fetching for static sections.

### Chat (Digital Twin)
```
User types message
  → DigitalTwin.tsx: POST /api/chat with message history
  → api/chat/route.ts: validates + proxies to OpenRouter
  → OpenRouter: streams response via SSE
  → DigitalTwin.tsx: reads SSE stream, appends tokens to state
```

## Abstractions

- **No shared utilities** — no `lib/`, `utils/`, or `hooks/` directories
- **No custom hooks** — each component manages its own state with `useState`/`useEffect`
- **No context/state management** — no Redux, Zustand, or React Context
- **No component library** — all UI is hand-built with Tailwind + Framer Motion

## Animation Architecture

Framer Motion `whileInView` pattern is used uniformly across all sections for scroll-triggered entrance animations. No shared animation config — each component defines its own `initial/animate/transition` values.
