---
slug: nextjs-404-local
status: resolved
trigger: manual
goal: find_and_fix
created: 2026-05-12
---

## Symptoms

Running `npm run dev` in `web/` starts Next.js 16.2.6 (Turbopack) at http://localhost:3000, but `GET / 404 in 248ms`.

## Investigation

### Hypothesis

`basePath: '/yolosite'` in `next.config.ts` shifts the root route from `/` to `/yolosite`, causing the dev server to return 404 for `/`.

### Evidence

- `web/app/page.tsx` exists and exports a default component — valid App Router entry point.
- `web/app/layout.tsx` exists and is valid.
- No `web/src/` conflict.
- `web/next.config.ts` had `basePath: '/yolosite'` set unconditionally alongside `output: "export"`.
- This config was introduced in commit `7e288ae` ("gh pages") for GitHub Pages deployment at `https://<user>.github.io/yolosite/`.
- No hardcoded `/yolosite` strings in `web/app/` or `web/public/`.
- No `.github/workflows/` deploy scripts.

## Resolution

### Root Cause

`basePath: '/yolosite'` was set unconditionally in `next.config.ts`. This is correct for GitHub Pages production builds but causes `GET /` to return 404 in local dev because the dev server only serves `/yolosite/`.

### Fix

Made `basePath` conditional on `NODE_ENV`:

```ts
basePath: process.env.NODE_ENV === "production" ? "/yolosite" : "",
```

`next dev` runs with `NODE_ENV=development`, so `basePath` is empty and `/` works locally.
`next build` runs with `NODE_ENV=production`, so `/yolosite` is preserved for GitHub Pages.

### File Changed

- `web/next.config.ts`
