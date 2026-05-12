# STRUCTURE.md
# Directory Layout and Organization
# Last mapped: 2026-05-12

## Root Layout

```
yolosite/
├── web/                        # Next.js app (all source code lives here)
│   ├── app/                    # Next.js App Router root
│   │   ├── page.tsx            # Single page — composes all sections
│   │   ├── layout.tsx          # Root HTML shell + global metadata
│   │   ├── globals.css         # CSS variables + Tailwind @theme tokens
│   │   ├── favicon.ico
│   │   ├── components/         # One file per page section
│   │   │   ├── Nav.tsx         # Sticky navigation bar
│   │   │   ├── Hero.tsx        # Landing hero section
│   │   │   ├── About.tsx       # About me section
│   │   │   ├── Career.tsx      # Career timeline
│   │   │   ├── Skills.tsx      # Skills grid
│   │   │   ├── Education.tsx   # Education section (includes DLH)
│   │   │   ├── School42.tsx    # School 42 section
│   │   │   ├── Portfolio.tsx   # Portfolio projects
│   │   │   ├── DigitalTwin.tsx # AI chat interface
│   │   │   ├── Contact.tsx     # Contact form
│   │   │   └── Footer.tsx      # Footer
│   │   └── api/
│   │       └── chat/
│   │           └── route.ts    # POST /api/chat — OpenRouter proxy
│   ├── next.config.ts          # Next.js config (output: export, basePath)
│   ├── tsconfig.json           # TypeScript config
│   ├── eslint.config.mjs       # ESLint 9 flat config
│   ├── package.json            # Dependencies and scripts
│   ├── Dockerfile              # Docker build (currently broken — see CONCERNS.md)
│   └── .dockerignore
├── sources/                    # Source documents (PDFs, motivation letters)
│   ├── linkedin.pdf
│   ├── resume-references.pdf
│   ├── cv_anemet.pdf
│   ├── 42transcript.pdf
│   └── *.pdf
├── .planning/                  # GSD planning artifacts (this directory)
│   ├── config.json
│   └── codebase/
├── .env                        # OPENROUTER_API_KEY (gitignored)
├── docker-compose.yml          # Docker Compose for local dev
├── CLAUDE.md                   # Claude Code instructions
├── AGENTS.md                   # Original project requirements
└── README.md
```

## Key Locations

| What | Where |
|------|-------|
| Page sections | `web/app/components/*.tsx` |
| Global theme | `web/app/globals.css` |
| API handler | `web/app/api/chat/route.ts` |
| Env config | `.env` (root level, not in `web/`) |
| Build config | `web/next.config.ts` |
| Dependencies | `web/package.json` |

## Naming Conventions

| Entity | Convention | Notes |
|--------|-----------|-------|
| Component files | PascalCase | `DigitalTwin.tsx` |
| Component functions | PascalCase | `export default function DigitalTwin()` |
| Static data variables | camelCase | `careerItems`, `skillGroups` |
| CSS variables | `--kebab-case` | `--surface2`, `--navy` |
| API route dirs | lowercase | `api/chat/` |
| Config files | camelCase or dot-notation | `next.config.ts`, `eslint.config.mjs` |

## Section Order (page.tsx)

1. Nav
2. Hero
3. About
4. Career
5. Skills
6. Education
7. School42
8. Portfolio
9. DigitalTwin
10. Contact
11. Footer

## Anchor Navigation

Nav links use `#section-id` anchors that scroll to section wrappers. Each section component wraps its content in a `<section id="...">` element.
