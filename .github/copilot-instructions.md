# AI coding agent instructions for `altcha-docker`

## Overview

- Purpose: Dockerized ALTCHA challenge/verify microservice using Bun + Express. Provides `/challenge` and `/verify` used by the ALTCHA widget. Optional demo UI.
- Key libs: `altcha`, `altcha-lib`, `express@5`, `helmet`, `cors`, `dotenv`.
- Entrypoint: `src/index.ts` → transpiled to `build/index.js`.

## Repo layout

- `src/index.ts`: Express server with two roles:
  - API (always): `/`, `/challenge`, `/verify` on `PORT` (default 3000)
  - Demo (when `DEMO=true`): simple site on port 8080 (`src/demo/index.html`)
- `Dockerfile`: multi-stage Bun build; copies `.env` and demo html into image; runs `bun start`.
- `compose.yaml`: exposes 3000 (API) and 8080 (demo); sets `SECRET` (default is placeholder), `NODE_ENV=production`.
- `package.json` scripts: `build` (tsc via Bun), `dev` (watch), `start` (run built server).

## Build & run

- Local (Bun):
  - PowerShell: `bun install; bun run build; bun start`
  - Unix/macOS: `bun install && bun run build && bun start`
- Docker Compose: `docker compose up --build`
  - Override secret once:
    - PowerShell: `$env:SECRET = "<long-random>"; docker compose up --build`
    - Unix: `SECRET="<long-random>" docker compose up --build`

## Configuration (env)

- `SECRET` (required): HMAC key for ALTCHA. Default `$ecret.key` is unsafe; code logs a warning if used.
- `PORT`: API port (default 3000).
- `EXPIREMINUTES`: challenge expiry minutes (default 10).
- `MAXRECORDS`: in-memory single-use token cache size (default 1000).
- `DEMO`: when `true`, serve demo on 8080 with CSP via Helmet.
- `.env` is loaded by `dotenv` at runtime; Dockerfile also copies `.env` into image.

## API contracts (keep stable)

- `GET /` → `204 No Content` (liveness).
- `GET /challenge` → `200 OK` JSON from `altcha-lib#createChallenge({ hmacKey: SECRET, expires })`.
- `GET /verify?altcha=<payload>` → `202 Accepted` on success, `417 Expectation Failed` on invalid or reused token.
- Reuse prevention uses an in-memory `recordCache` (size = `MAXRECORDS`); cache clears on restart/scaling.
- CORS is `*` for simplicity; demo sets strict CSP.

## Patterns & conventions

- TypeScript strict mode; output in `build/` (`tsconfig.json` → `outDir`=`build`).
- Express 5 style middleware; minimal error handling by design (status-only API).
- Keep endpoints and status codes as-is to preserve client integrations and docs.
- When adding env vars or endpoints, update `README.md` and `.env.example`.

## CI/CD

- GitHub Actions: `.github/workflows/docker-publish.yml` builds multi-arch images (amd64/arm64) with Buildx/QEMU.
- Publishes to GHCR `ghcr.io/<owner>/<repo>` on pushes to `main` and version tags `v*.*.*`.
- Uses `docker/metadata-action` for tags/labels; caches via GHA cache.

## Common tasks (examples)

- Test verify manually:
  - PowerShell: `curl "http://localhost:3000/verify?altcha=$([uri]::EscapeDataString($payload))" -Method GET -UseBasicParsing`
  - Unix: `curl -G --data-urlencode "altcha=$payload" http://localhost:3000/verify -i`
- Enable demo: set `DEMO=true` and open `http://localhost:8080`.

## Gotchas

- Do not ship with default `SECRET`.
- In-memory token cache is not shared across replicas; use a shared store if you scale (out of scope here).
- The demo proxy posts to `/test` and calls API locally at `http://localhost:3000`.
