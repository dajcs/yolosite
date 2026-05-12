---
slug: components-not-rendering
status: resolved
trigger: manual
goal: find_and_fix
created: 2026-05-12
---

## Symptoms

After making `basePath` conditional on `NODE_ENV`, the dev server at `http://localhost:3000` responded but only the nav/header row was visible — all section components (Hero, About, Career, etc.) appeared invisible.

## Investigation

### Evidence

- timestamp: 2026-05-12T17:35
  finding: All 17 JS chunks return HTTP 200. No missing resources.

- timestamp: 2026-05-12T17:40
  finding: SSR HTML contains all 9 section components with correct content. Sections ARE in the DOM.

- timestamp: 2026-05-12T17:40
  finding: 41 inline `opacity:0` styles from framer-motion `initial` prop present in SSR HTML. Nav outer element has no `initial` opacity, so it renders visibly.

- timestamp: 2026-05-12T17:42
  finding: headless Chromium `--dump-dom` (static snapshot) also shows 41 `opacity:0`. Misleading — doesn't wait for React hydration.

- timestamp: 2026-05-12T17:50
  finding: CDP WebSocket test with 4s wait shows Hero h1 at `opacity:1` — animations DO run. 35 remaining `opacity:0` are `useInView` elements below the viewport (correct behavior).

- timestamp: 2026-05-12T17:55
  finding: Root cause confirmed — `output: "export"` was unconditionally set, causing Next.js dev server to serve the page in static-export mode. Client-side React hydration was suppressed or degraded, preventing framer-motion animations from starting.

- timestamp: 2026-05-12T18:00
  finding: Fix applied — `output` made conditional on `NODE_ENV === "production"`, same pattern already used for `basePath`. CDP test confirms Hero elements animate to `opacity:1` (6/6 in viewport). Production build succeeds and still generates `out/` static export.

## Current Focus

hypothesis: `output: "export"` unconditionally set was preventing full client-side hydration in dev mode, leaving all framer-motion initial states frozen at `opacity:0`.
next_action: none — fix applied and verified

## Resolution

root_cause: `output: "export"` in `next.config.ts` was not conditional on `NODE_ENV`. In dev mode, this suppresses or degrades React hydration, preventing framer-motion from running its client-side animation effects. All motion elements stayed at their SSR-rendered `initial={{ opacity: 0 }}` state indefinitely.

fix: Made `output` conditional — `process.env.NODE_ENV === "production" ? "export" : undefined` — same pattern as the existing `basePath` fix. Production builds still generate the static `out/` directory for GitHub Pages. Dev server now runs as a full Next.js server with complete React hydration.

file_changed: web/next.config.ts
