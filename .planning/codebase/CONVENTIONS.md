# CONVENTIONS.md
# Code Style and Patterns
# Last mapped: 2026-05-12

## Language & Tooling

- **TypeScript** throughout — strict mode via `tsconfig.json`
- **ESLint 9** with `eslint-config-next` (flat config `eslint.config.mjs`)
- No Prettier configured — formatting is manual/editor-driven
- No barrel (`index.ts`) files — import directly from component files

## Component Conventions

- All components use `"use client"` directive at the top
- **PascalCase** naming for component files and functions (e.g. `Hero.tsx`, `function Hero()`)
- One component per file, no multi-export files
- Static data (career items, skill lists, etc.) co-located in the same component file — no separate data layer

## Styling Patterns

- **Tailwind v4** for layout, spacing, responsive breakpoints
- **Inline `style` props** for dynamic/CSS-variable colors (e.g. `style={{ color: 'var(--yellow)' }}`)
- CSS variables defined in `globals.css` and registered as Tailwind tokens via `@theme inline`
- Color palette: `--yellow`, `--blue`, `--purple`, `--navy`, `--gray`, `--bg`, `--surface`, `--surface2`

## Animation Patterns

- **Framer Motion** for all animations — `motion.div` wrappers
- Scroll-triggered `whileInView` pattern is standard across sections
- `useReducedMotion()` not yet implemented (concern)
- Common pattern:
```tsx
<motion.div
  initial={{ opacity: 0, y: 30 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ duration: 0.6 }}
>
```

## File & Import Conventions

- Component imports use relative paths from `app/components/`
- Icons from `lucide-react` (named imports)
- No path aliases configured beyond Next.js defaults

## Error Handling

- Minimal error handling — mostly at API route boundary (`api/chat/route.ts`)
- No global error boundary component
- No try/catch in component code — server errors surface as unhandled rejections

## Naming Conventions

| Entity | Convention | Example |
|--------|-----------|---------|
| Components | PascalCase | `DigitalTwin.tsx` |
| CSS variables | kebab-case | `--surface2` |
| API routes | kebab-case dir | `api/chat/route.ts` |
| Static data vars | camelCase | `careerItems`, `skillGroups` |
