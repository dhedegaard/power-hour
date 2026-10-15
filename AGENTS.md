<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Build

`npm run build` prerenders `/` with live data from `api.energidataservice.dk`. `getPrices` makes one ranged request and retries a 429 (honouring `retry-after`), because the API allows only ~3 calls per 10 s and Next gives up on a prerender cache fill after ~50 s. If the retries are exhausted, the build fails.

## Commands

- `npm run dev` / `npm run build` / `npm run start`
- `npm run lint` (ESLint)

No tests and no typecheck script; verify with `lint` + `build`. No GitHub Actions; Vercel deploys on push to `main`.
