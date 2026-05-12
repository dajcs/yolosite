# Technology Stack

**Analysis Date:** 2026-05-12

## Languages

**Primary:**
- TypeScript 5.x - All application code in `web/app/`

**Secondary:**
- CSS - Global styles and Tailwind theme tokens in `web/app/globals.css`

## Runtime

**Environment:**
- Node.js 20 (Docker image: `node:20-alpine`); Node.js 24 used in CI (GitHub Actions)
- Local dev environment running Node.js 22.22.2

**Package Manager:**
- npm 10.9.7
- Lockfile: `web/package-lock.json` present

## Frameworks

**Core:**
- Next.js 16.1.6 - Full-stack React framework; configured with `output: "export"` (static export) and `basePath: '/yolosite'`
- React 19.2.3 - UI rendering

**Animations:**
- Framer Motion 12.34.3 - Scroll-triggered animations (`useInView`), page transitions, `AnimatePresence`

**Icons:**
- Lucide React 0.575.0 - SVG icon library used across all components

**Build/Dev:**
- Tailwind CSS 4.x - Utility-first CSS; configured via `@theme inline` in `web/app/globals.css`; PostCSS plugin `@tailwindcss/postcss`
- ESLint 9.x - Linting with `eslint-config-next` (core-web-vitals + typescript presets); config at `web/eslint.config.mjs`
- TypeScript 5.x - Strict mode; config at `web/tsconfig.json`

## Key Dependencies

**Critical:**
- `next` 16.1.6 - Framework powering routing, API routes, and static export
- `framer-motion` 12.34.3 - Used in every section component for scroll-reveal and interactive animations
- `lucide-react` 0.575.0 - Icon rendering throughout UI

**Infrastructure:**
- `@tailwindcss/postcss` ^4 - PostCSS integration for Tailwind v4 compilation; config at `web/postcss.config.mjs`
- `@types/react` ^19, `@types/node` ^20 - TypeScript type definitions

## Configuration

**Environment:**
- Root-level `.env` file (gitignored, not present in repo) loaded by `web/next.config.ts` using Node.js `fs` built-in at server startup
- Required env var: `OPENROUTER_API_KEY` - consumed by `web/app/api/chat/route.ts`
- Docker Compose passes env file via `env_file: .env` in `docker-compose.yml`

**Build:**
- `web/next.config.ts` - Static export mode, `basePath: '/yolosite'`, unoptimized images, manual `.env` loader
- `web/tsconfig.json` - Target ES2017, strict mode, path alias `@/*` → `web/*`
- `web/postcss.config.mjs` - Single plugin: `@tailwindcss/postcss`

## Platform Requirements

**Development:**
- Node.js 20+ (Docker) or 22+ (local)
- Run `npm run dev` from `web/` directory (dev server at http://localhost:3000)

**Production:**
- **Docker:** Multi-stage build (`web/Dockerfile`), runs `node server.js` on port 3000; orchestrated via `docker-compose.yml` at repo root
- **GitHub Pages:** CI/CD via `.github/workflows/nextjs.yml`; static export deployed to GitHub Pages at path `/yolosite`

---

*Stack analysis: 2026-05-12*
