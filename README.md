# yolosite

Personal professional website for Attila Nemet, built with [Next.js](https://nextjs.org).

The site also includes a private job-application assistant at `/assistant` (Google sign-in, single allow-listed account). See `docs/specs/2026-07-08-job-assistant-vision.md`.

## Run with [Docker](https://www.docker.com/)

```
docker compose up --build
```

## Run without Docker

```
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on [Vercel](https://vercel.com/)

Import the GitHub repo, then in the Vercel project settings:

- **Root Directory**: `web` (the Next.js app is in a subdirectory — required).
- **Environment Variables**: `OPENROUTER_API_KEY` (required). `OPENROUTER_MODEL` is optional (defaults in code). The `/assistant` area needs the additional env vars listed in `CLAUDE.md`.
- **Live site**: [https://yolosite.vercel.app](https://yolosite.vercel.app)

Framework, build command, and output are auto-detected. Docker is only for local use; Vercel builds the app directly.
