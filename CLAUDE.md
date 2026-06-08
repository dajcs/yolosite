# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from `web/`:

```bash
npm run dev      # dev server at http://localhost:3000
npm run build    # production build
npm run lint     # ESLint
```

Or from the repo root with Docker:

```bash
docker compose up --build
```

## Architecture

Single-page Next.js 16 app (React 19, TypeScript, Tailwind v4, Framer Motion, Lucide React). Everything lives in `web/app/`:

- `page.tsx` — composes all section components in order
- `layout.tsx` — sets `<html>` and global metadata
- `globals.css` — defines all CSS variables (colors, surfaces) and registers them as Tailwind tokens via `@theme inline`
- `components/` — one file per page section (Hero, About, Career, Skills, Education, School42, Portfolio, DigitalTwin, Contact, Nav, Footer)
- `api/chat/route.ts` — streaming POST route; proxies to OpenRouter (`openai/gpt-oss-120b:free`), returns SSE; requires `OPENROUTER_API_KEY` env var (provided via `env_file: .env` in docker-compose.yml)

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
- No emojis anywhere in code or content
- Keep README minimal

## AGENTS.md 

The original project requirements in @AGENTS.md
Should be used as a reference when implementing features or making design decisions.
