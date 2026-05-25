# AI coding agent instructions for `altcha-docker`

## Overview

- Purpose: Dockerized ALTCHA challenge/verify microservice using Bun + Express. Provides `/challenge` and `/verify` used by the ALTCHA widget, plus a separate demo UI service.
- Key libs: `altcha`, `altcha-lib`, `express@5`, `helmet`, `cors`, `dotenv`.
- API entrypoint: `src/index.ts` → transpiled to `build/index.js`.
- Demo entrypoint: `src/demo.ts` → transpiled to `build/demo.js`.

## Repo layout

- `src/index.ts`: API startup; loads dotenv, parses API config, starts the API app on `PORT` (default 3000).
- `src/api-app.ts`: Express API app with `/`, `/challenge`, and `/verify`.
- `src/demo.ts`: Demo startup; loads dotenv, parses demo config, starts the demo app on `DEMO_PORT` (default 8080).
- `src/demo-app.ts`: Express demo app, static demo assets, `GET /challenge` proxy to API `/challenge`, and `POST /test` form handler that calls API `/verify`.
- `src/config.ts`: API/demo env parsing and validation.
- `src/replay-store.ts`: In-memory single-use token replay protection.
- `Dockerfile`: multi-stage Bun build with separate `api` and `demo` targets; does not copy `.env` into final images.
- `compose.yaml`: runs `server` and `demo` separately; exposes 3000 for API and 8080 for demo.
- `package.json` scripts: `build` (tsc via Bun plus demo assets), `dev` (API watch), `start` (run built API), `start:demo` (run built demo).

## Build & run

- Local (Bun):
  - PowerShell: `bun install; bun run build; bun start`
  - Unix/macOS: `bun install && bun run build && bun start`
- Docker Compose: `docker compose up --build`
  - API: `http://localhost:3000`
  - Demo: `http://localhost:8080`
  - Override secret once:
    - PowerShell: `$env:ALTCHA_SECRET = "<long-random>"; docker compose up --build`
    - Unix: `ALTCHA_SECRET="<long-random>" docker compose up --build`

## Configuration (env)

- `SECRET` (required): HMAC key for ALTCHA. The API app requires this container/runtime variable. Compose maps `ALTCHA_SECRET` to container `SECRET` and supplies `$ecret.key` only as a local testing fallback when `ALTCHA_SECRET` is unset; code logs a warning if that fallback is used.
- `PORT`: API port (default 3000).
- `EXPIREMINUTES`: challenge expiry minutes (default 10).
- `MAXRECORDS`: in-memory single-use token cache size (default 1000).
- `CORS_ORIGIN`: allowed API CORS origin(s), default `*`.
- `ALGORITHM`: ALTCHA v2 algorithm (default `PBKDF2/SHA-256`).
- `MAXNUMBER`: ALTCHA v2 proof-of-work cost (default 5000); preferred over legacy `COST`.
- `API_BASE_URL`: demo proxy target (default `http://server:3000`).
- `DEMO_PORT`: demo port (default 8080).
- `.env` is loaded by `dotenv` at runtime for local/Bun runs and by Docker Compose for variable substitution; final Docker images must not contain `.env`.

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
- Start demo with Compose: `docker compose up --build demo` and open `http://localhost:8080`.

## Gotchas

- Do not ship with the default `ALTCHA_SECRET`/container `SECRET`.
- In-memory token cache is not shared across replicas; use a shared store if you scale (out of scope here).
- Demo routes: serves `/`, exposes `GET /challenge` for the widget and proxies it to API `/challenge`, and accepts `POST /test` for the demo form, which calls API `/verify` through `API_BASE_URL`. The demo does not expose a public `/verify` route.
- Do not reintroduce API-process `DEMO=true` behavior; the demo must remain a separate process/container.
