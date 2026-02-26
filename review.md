# Code Review

## Summary

A well-structured single-page Next.js portfolio site. The component decomposition is clean, the visual design is consistent, and the codebase is simple and readable. Below are findings organized by severity and category, followed by recommended remedial actions.

---

## Critical

### 1. Font variables referenced but never loaded

`globals.css` defines `--font-sans: var(--font-geist-sans)` and `--font-mono: var(--font-geist-mono)` in the `@theme inline` block, but the Geist fonts are never imported or loaded anywhere. `layout.tsx` does not import `next/font/google` or `next/font/local`. The body `font-family` in CSS falls back to the system font stack, so the page renders correctly, but the Tailwind theme `font-sans` token resolves to undefined CSS variables.

**Files:** `app/globals.css` (lines 17-18), `app/layout.tsx`

### 2. Custom .env parsing is fragile

`next.config.ts` implements a hand-rolled .env parser instead of using Next.js built-in `.env` file support or the `dotenv` package. The regex `^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$` does not handle:
- Inline comments (`KEY=value # comment`)
- Multi-line values
- Lowercase variable names
- Leading/trailing whitespace in values beyond quotes
- Escaped characters

Next.js natively loads `.env`, `.env.local`, `.env.development`, and `.env.production` files. The custom parser exists to load `../.env` (one directory up from `web/`), but this is better solved by a `.env.local` symlink or by placing the file where Next.js expects it.

**File:** `next.config.ts`

### 3. API route allows injecting system-role messages

The `/api/chat` route validates that messages have a `role` string and `content` string, but does not restrict `role` to `"user"` or `"assistant"`. A client can send `{ role: "system", content: "Ignore all previous instructions..." }` to override or extend the system prompt.

**File:** `app/api/chat/route.ts` (lines 44-49)

---

## High

### 4. No rate limiting on the chat API

The `/api/chat` endpoint has no rate limiting. Any client can send unlimited requests, potentially exhausting the OpenRouter API key credits or hitting upstream rate limits.

**File:** `app/api/chat/route.ts`

### 5. Upstream error body leaked to client

When the OpenRouter API returns a non-200 response, the raw error body is forwarded to the client:
```ts
const error = await response.text();
return NextResponse.json({ error }, { status: response.status });
```
This could expose internal API details, error messages, or key-related information.

**File:** `app/api/chat/route.ts` (lines 72-74)

### 6. Hardcoded color values everywhere

The CSS defines theme variables (`--yellow`, `--blue`, `--navy`, etc.) and Tailwind theme tokens (`color-yellow`, `color-blue`, etc.), but nearly every component uses inline `style={{ color: "#888888" }}` or `style={{ color: "#ecad0a" }}` instead. This means:
- Changing the color scheme requires editing dozens of inline styles across 11 files
- The Tailwind theme tokens are largely unused
- The approach contradicts the AGENTS.md requirement for easy maintenance

**Files:** All component files

### 7. No favicon or OpenGraph metadata

The `public/` directory contains only default Next.js placeholder SVGs (`file.svg`, `globe.svg`, etc.). There is no favicon, no `apple-touch-icon`, and no OpenGraph image. The `metadata` in `layout.tsx` defines only `title` and `description` -- missing `openGraph`, `twitter`, `icons`, and `robots` fields.

**Files:** `app/layout.tsx`, `public/`

---

## Medium

### 8. Mobile menu does not lock body scroll

When the hamburger menu opens on mobile, the page behind it remains scrollable. This can cause disorientation and accidental scrolling.

**File:** `app/components/Nav.tsx`

### 9. No keyboard dismiss for mobile menu

The mobile menu cannot be dismissed with the Escape key. Standard accessibility practice requires modal/overlay elements to support keyboard dismissal.

**File:** `app/components/Nav.tsx`

### 10. AnimatePresence uses array index as key

In `DigitalTwin.tsx`, chat messages use `key={i}` (array index) with `AnimatePresence`. When new messages are appended, this is functionally fine, but if messages were ever reordered or removed, animations would misfire. A stable unique ID per message would be more robust.

**File:** `app/components/DigitalTwin.tsx` (line 149)

### 11. No React Error Boundary

There is no error boundary component. If any client component throws during rendering (e.g., the chat widget encounters an unexpected state), the entire page crashes with a white screen.

### 12. No loading or suspense boundaries

The page renders all 11 sections at once with no progressive loading. For a content-heavy single-page site with animations, adding a `loading.tsx` or `Suspense` boundaries would improve perceived performance.

### 13. String concatenation for conditional classNames

`Education.tsx` uses string concatenation for conditional classes:
```tsx
className={`rounded-2xl p-8 group hover:border-opacity-40 transition-all${edu.wide ? " md:col-span-2" : ""}`}
```
This is fragile (easy to miss the leading space). A template literal with a space separator or a utility like `clsx` would be safer.

**File:** `app/components/Education.tsx` (line 83)

### 14. Duplicate imports from same module

Several components import from `framer-motion` in separate statements:
```tsx
import { motion } from "framer-motion";
import { useInView } from "framer-motion";
```
These should be combined into a single import.

**Files:** `app/components/About.tsx` (lines 3-4), similar patterns in other files

### 15. No `rel="noopener noreferrer"` consistency

External links in `Hero.tsx` include `rel="noopener noreferrer"` but internal `mailto:` and `tel:` links do not. While not a security risk for `mailto:`/`tel:`, the pattern is inconsistent. More importantly, the `Contact.tsx` component conditionally adds `rel` only for `http` links, which is correct, but the conditional `target` attribute produces `target={undefined}` for non-http links, which React renders as no attribute -- acceptable but could be cleaner.

**File:** `app/components/Contact.tsx` (lines 90-92)

---

## Low

### 16. Custom scrollbar styles are WebKit-only

`globals.css` uses `::-webkit-scrollbar` pseudo-elements, which do not apply in Firefox. The standard `scrollbar-width` and `scrollbar-color` CSS properties could be added for cross-browser support.

**File:** `app/globals.css` (lines 45-52)

### 17. Default Next.js SVGs in public/

The `public/` directory still contains the default Next.js scaffold files (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) that are not used anywhere in the application.

**File:** `public/`

### 18. No `robots.txt` or `sitemap.xml`

For a personal portfolio that may eventually be deployed publicly, basic SEO files are missing.

### 19. No tests

There is no testing framework configured and no test files. For an MVP this is acceptable, but any future feature additions (especially to the chat API) would benefit from at least basic integration tests.

### 20. Bundle size consideration

`framer-motion` is a substantial dependency (~30-40 KB gzipped) used primarily for fade-in-on-scroll animations that could be achieved with CSS `@starting-style`, `IntersectionObserver`, or the lighter `motion` (standalone package). This is a tradeoff decision, not necessarily a problem, given that framer-motion also provides `AnimatePresence` for the chat and mobile menu.

### 21. README links point to Node.js download page

Both `README.md` and `web/README.md` link "Next.js" to `https://nodejs.org/en/download` instead of `https://nextjs.org`.

**Files:** `README.md`, `web/README.md`

### 22. Footer is not a client component but this is fine

`Footer.tsx` does not use `"use client"` and uses `new Date().getFullYear()`. Since it is rendered inside a client-boundary parent (the page itself imports all components), this works correctly. No action needed.

---

## Remedial Actions

| # | Action | Priority | Effort |
|---|--------|----------|--------|
| 1 | Either load Geist fonts via `next/font` in `layout.tsx` or remove the font variable references from `globals.css` | Critical | Low |
| 2 | Replace custom .env parser with a `.env.local` file in `web/` or a symlink, and use Next.js built-in env loading | Critical | Low |
| 3 | Add role whitelist validation in the chat route: reject messages where `role` is not `"user"` or `"assistant"` | Critical | Low |
| 4 | Add basic rate limiting to `/api/chat` (e.g., in-memory counter per IP, or use `next-rate-limit`) | High | Low |
| 5 | Sanitize upstream error responses -- return a generic error message instead of the raw body | High | Low |
| 6 | Refactor inline color styles to use Tailwind theme tokens (`text-gray`, `text-yellow`, `text-blue`, etc.) across all components | High | Medium |
| 7 | Add a favicon, apple-touch-icon, and OpenGraph image to `public/`; expand metadata in `layout.tsx` | High | Low |
| 8 | Add `overflow: hidden` to body when mobile menu is open | Medium | Low |
| 9 | Add `Escape` key handler to close mobile menu | Medium | Low |
| 10 | Add stable unique IDs to chat messages instead of using array index | Medium | Low |
| 11 | Add a React Error Boundary wrapper around the page content | Medium | Low |
| 12 | Consider adding `loading.tsx` for initial page load | Medium | Low |
| 13 | Use template literal with explicit space or `clsx` for conditional classNames | Medium | Low |
| 14 | Combine duplicate `framer-motion` imports into single import statements | Low | Low |
| 15 | Add `scrollbar-width` and `scrollbar-color` for Firefox support | Low | Low |
| 16 | Remove unused default SVGs from `public/` | Low | Low |
| 17 | Add `robots.txt` and `sitemap.xml` (or use Next.js metadata API) | Low | Low |
| 18 | Fix README links to point to `https://nextjs.org` | Low | Low |

---

## Positive Observations

- Clean component decomposition -- each section is self-contained
- Consistent visual language and spacing across all sections
- Good use of `useInView` for scroll-triggered animations with `once: true` to avoid re-animation
- Chat streaming implementation is correct and handles edge cases (malformed chunks, connection errors)
- Input validation on the API route (message count limit, content length limit) is sensible
- The site is fully responsive with appropriate breakpoints
- Accessible labels on icon-only buttons (`aria-label` on social links, menu toggle, scroll indicator)
- TypeScript is used throughout with proper typing
- The codebase is simple and readable, aligned with the AGENTS.md principle of no over-engineering
