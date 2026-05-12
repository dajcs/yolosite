# TESTING.md
# Test Structure and Practices
# Last mapped: 2026-05-12

## Status: No Automated Tests

This codebase has **zero test infrastructure**. No test framework is installed or configured.

### Confirmed Absent

- `jest` / `vitest` — not in `package.json` dependencies or devDependencies
- `@testing-library/react` — not installed
- `playwright` / `cypress` — no e2e framework
- No `*.test.ts`, `*.spec.ts`, or `__tests__/` directories
- No CI pipeline (no `.github/workflows/`, no `Dockerfile` test stage)

## Manual Testing Only

Current validation approach:
- Visual inspection via `npm run dev` dev server at `http://localhost:3000`
- `npm run lint` — ESLint static analysis (only automated check)
- `npm run build` — Next.js build for type and compile errors

## Implications for Future Work

Any phase adding tests would need to:
1. Choose a framework (Vitest recommended for Next.js 16 / React 19)
2. Configure test runner in `web/package.json`
3. Add `@testing-library/react` for component tests
4. Add `@playwright/test` or `cypress` for e2e
5. Set up CI (GitHub Actions)

The `web/` subdirectory structure means test configs belong at `web/jest.config.ts` or `web/vitest.config.ts`.

## Current Quality Gates

| Gate | Tool | How |
|------|------|-----|
| Linting | ESLint 9 | `npm run lint` |
| Type checking | TypeScript | `npm run build` |
| UI validation | Manual | Dev server inspection |
| API testing | Manual | Browser/curl |
